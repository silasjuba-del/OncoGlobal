import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath, URL as NodeURL } from "node:url";
import { z } from "zod";
import { CaixaNumerada } from "../contracts/w10/clinico-w10.js";
import { SalaoRuleset } from "../contracts/regras.js";
import { PrescriptionDocumentType } from "../contracts/w10/prescricao.js";
import { ProtocolTemplate } from "../contracts/w10/prescricao.js";
import type { TabelaRegulatoria } from "../rules/prescricao/classificarDocumento.js";
import { RulesetHeader } from "../contracts/agentes.js";
import { lerRadsEmergencias } from "../rules/radsEmergencias.js";
import { lerLimiarAlertaPlaquetas, type LimiarAlertaPlaquetas } from "../rules/plaquetasAlerta.js";
import { lerAlertaFeve } from "../rules/alertaFeve.js";
import type { RulesetSemaforo } from "../rules/semaforoInteracoes.js";
import type { CatalogoInteracoes } from "../contracts/f0c/interacoes.js";
import { carregarCompetenciaSigtap, type TabelasSigtap } from "../apac/sigtap.js";
import type { RegraInstrumento } from "../contracts/f0c/instrumentos.js";
import type { RegraCondicional, RegraTermoComplementar } from "../contracts/f0c/condicionais.js";
import type { EntradaControlado } from "../rules/prescricao/receituarioEspecial.js";

const CaixaEnvelope = z.object({ schemaVersion: z.string(), versao: z.string(), caixas: z.array(CaixaNumerada) }).strict();
const EntradaRegulatoria = z.object({ nomes: z.array(z.string()), tipo: PrescriptionDocumentType, fonte: z.string() }).strict();
const RegulacaoEnvelope = z.object({ versao: z.string(), fonte: z.string(), entradas: z.array(EntradaRegulatoria) }).strict();
const ModeloReceita = z.object({ consumivel: z.boolean().optional(), aprovadoMedico: z.boolean().optional() }).passthrough();
const FichaReceita = z.object({ consumivel: z.boolean().optional(), aprovadoMedico: z.boolean().optional(),
  receitasModelos: z.array(ModeloReceita).optional() }).passthrough();
const ReceitasEnvelope = z.object({ consumivel: z.boolean(), fichas: z.array(FichaReceita) }).passthrough();

function ler(relativo: string): unknown {
  const caminho = fileURLToPath(new NodeURL(`../../corpus/${relativo}`, import.meta.url));
  return JSON.parse(readFileSync(caminho, "utf8")) as unknown;
}
function lerTemplatesProtocolo() {
  const root = new NodeURL("../../corpus/fichas/", import.meta.url);
  const dir = fileURLToPath(root);
  const encontrados: z.infer<typeof ProtocolTemplate>[] = [];
  const visitar = (path: string): void => {
    for (const entry of readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const child = `${path}/${entry.name}`;
      if (entry.isDirectory()) visitar(child);
      else if (entry.isFile() && entry.name.endsWith(".json")) {
        try {
          const parsed = ProtocolTemplate.safeParse(JSON.parse(readFileSync(child, "utf8")) as unknown);
          if (parsed.success) encontrados.push(parsed.data);
        } catch { /* malformed/incomplete corpus item remains unavailable */ }
      }
    }
  };
  visitar(dir);
  return encontrados;
}

export function filtrarReceitasConsumiveis(input: unknown) {
  const parsed = ReceitasEnvelope.safeParse(input);
  if (!parsed.success || parsed.data.consumivel !== true) return [];
  return parsed.data.fichas.flatMap((ficha) => {
    if (ficha.consumivel !== true || ficha.aprovadoMedico !== true) return [];
    return (ficha.receitasModelos ?? []).filter((model) => model.consumivel === true && model.aprovadoMedico === true);
  });
}

/** Load the checked-in, versioned local corpus. No default table is fabricated. */
export function carregarCorpusServidor() {
  let sigtap: TabelasSigtap = {};
  let sigtapEstado = "PENDENTE";
  try {
    const carga = carregarCompetenciaSigtap(ler("f0c/sigtap/2026-09.json"),
      readFileSync(new NodeURL("../../corpus/f0c/sigtap/fontes/TabelaUnificada_202609_v2610050950.zip",import.meta.url)));
    if (carga.ativo) { sigtap = {[carga.tabela.competencia]:carga.tabela}; sigtapEstado = "FONTE_OFICIAL_CONFERIDA"; }
    else sigtapEstado = carga.codigo;
  } catch { /* Fonte ausente/corrompida mantém APAC pendente, nunca usa outra competência. */ }
  const caixaEnvelope = CaixaEnvelope.parse(ler("glossario/caixas.v1.json"));
  const ruleset = SalaoRuleset.parse(ler("rulesets/salao-triagem.v1.json"));
  const regulatorio = RegulacaoEnvelope.parse(ler("regulatorio/tabela-ativa.v1.json"));
  const table: TabelaRegulatoria = { versao: regulatorio.versao, fonte: regulatorio.fonte,
    entradas: regulatorio.entradas as TabelaRegulatoria["entradas"] };
  const receitasElegiveis = filtrarReceitasConsumiveis(ler("receitas/comuns.v1.json"));
  const radsInput = ler("rulesets/rads-emergencias.v1.json");
  RulesetHeader.parse((radsInput as { header?: unknown }).header);
  const rads = lerRadsEmergencias(radsInput);
  // W11-H22: limiar do alerta de plaquetas. Ausente ou inválido = alerta PENDENTE na visão, nunca silêncio.
  let limiarPlaquetas: LimiarAlertaPlaquetas | null = null;
  try { limiarPlaquetas = lerLimiarAlertaPlaquetas(ler("rulesets/lab-thresholds.v1.json")); } catch { /* PENDENTE na visão */ }
  return { caixas: caixaEnvelope.caixas.filter((c) => c.chave.startsWith("config.")),
    caixasTodas: caixaEnvelope.caixas, ruleset, regulatorio: table, receitasElegiveis,
    templatesProtocolo: lerTemplatesProtocolo(), rads, limiarPlaquetas,
    interacoes: ler("rulesets/interacoes.v1.json") as RulesetSemaforo,
    catalogoInteracoes: ler("f0c/classes-farmacos.v1.json") as CatalogoInteracoes,
    feveRuleset: lerAlertaFeve(ler("rulesets/salao-feve.v1.json")),
    sigtap, sigtapEstado,
    instrumentos: (ler("f0c/instrumentos.v1.json") as {instrumentos:RegraInstrumento[]}).instrumentos,
    condicionais: ler("f0c/condicionais.v1.json") as {regras:RegraCondicional[];termos:RegraTermoComplementar[]},
    controlados:(ler("regulatorio/medicamentos-controlados.v1.json") as {entradas:EntradaControlado[]}).entradas,
    versoes: { caixas: caixaEnvelope.versao, regulatorio: table.versao, ruleset: ruleset.header.versao } };
}
