import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { CaixaNumerada } from "../contracts/w10/clinico-w10.js";
import { SalaoRuleset } from "../contracts/regras.js";
import { PrescriptionDocumentType } from "../contracts/w10/prescricao.js";
import { ProtocolTemplate } from "../contracts/w10/prescricao.js";
import type { TabelaRegulatoria } from "../rules/prescricao/classificarDocumento.js";

const CaixaEnvelope = z.object({ schemaVersion: z.string(), versao: z.string(), caixas: z.array(CaixaNumerada) }).strict();
const EntradaRegulatoria = z.object({ nomes: z.array(z.string()), tipo: PrescriptionDocumentType, fonte: z.string() }).strict();
const RegulacaoEnvelope = z.object({ versao: z.string(), fonte: z.string(), entradas: z.array(EntradaRegulatoria) }).strict();
const ModeloReceita = z.object({ consumivel: z.boolean().optional(), aprovadoMedico: z.boolean().optional() }).passthrough();
const FichaReceita = z.object({ consumivel: z.boolean().optional(), aprovadoMedico: z.boolean().optional(),
  receitasModelos: z.array(ModeloReceita).optional() }).passthrough();
const ReceitasEnvelope = z.object({ consumivel: z.boolean(), fichas: z.array(FichaReceita) }).passthrough();

function ler(relativo: string): unknown {
  const caminho = fileURLToPath(new URL(`../../corpus/${relativo}`, import.meta.url));
  return JSON.parse(readFileSync(caminho, "utf8")) as unknown;
}
function lerTemplatesProtocolo() {
  const root = new URL("../../corpus/fichas/", import.meta.url);
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
  const caixaEnvelope = CaixaEnvelope.parse(ler("glossario/caixas.v1.json"));
  const ruleset = SalaoRuleset.parse(ler("rulesets/salao-triagem.v1.json"));
  const regulatorio = RegulacaoEnvelope.parse(ler("regulatorio/tabela-ativa.v1.json"));
  const table: TabelaRegulatoria = { versao: regulatorio.versao, fonte: regulatorio.fonte,
    entradas: regulatorio.entradas as TabelaRegulatoria["entradas"] };
  const receitasElegiveis = filtrarReceitasConsumiveis(ler("receitas/comuns.v1.json"));
  return { caixas: caixaEnvelope.caixas.filter((c) => c.chave.startsWith("config.")),
    caixasTodas: caixaEnvelope.caixas, ruleset, regulatorio: table, receitasElegiveis,
    templatesProtocolo: lerTemplatesProtocolo(),
    versoes: { caixas: caixaEnvelope.versao, regulatorio: table.versao, ruleset: ruleset.header.versao } };
}
