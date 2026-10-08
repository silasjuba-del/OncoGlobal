// W10-INT-APAC-03 · Antiglosa determinística (D-W9-19). Função pura.
// ALERTA nunca bloqueia o médico; BLOQUEIA_EXPORTACAO bloqueia só a exportação ao SIA.
// Regra sem fonte NÃO está aqui (ver docs/w10/PEDIDOS-INT-APAC.md, [VERIFICAR]).
import type { Apac } from "../contracts/operacao.js";
import type { AchadoAntiglosa as Achado, CaixaNumerada } from "../contracts/w10/clinico-w10.js";
import { VereditoAntiglosa } from "../contracts/w10/clinico-w10.js";
import { validarCns } from "./cns.js";
import {
  FINALIDADES_QT, FINALIDADES_RT, lerCampo, lerSecundarios, lerTexto, normalizarFinalidade, ROTULO_FINALIDADE,
} from "./campos.js";
import { diasEntre, idadeEmMeses, parseData } from "./datas.js";
import { buscarProcedimento, codigoProcValido, normalizarCodigoProc, type TabelasSigtap } from "./sigtap.js";

/** Campos exigidos pelo laudo (D-W5-06). Lista injetável: a exigência do SIA por campo é [VERIFICAR]. */
export const CAMPOS_OBRIGATORIOS_PADRAO: readonly string[] = [
  "pacienteNome", "pacienteCns", "pacienteNascimento", "pacienteSexo", "nomeMae",
  "procedimentoPrincipal", "quantidadePrincipal", "cidPrincipal", "finalidadeApac",
  "nomeEstabelecimento", "cnesSolicitante", "solicitanteNome", "solicitanteCns",
  "dataSolicitacao", "justificativa", "descricaoDiagnostico",
];

export const DIA_AVISO_APAC = 85; // D85 aviso (Q34); emitido em D85 exato, nunca depois
export const DIA_VENCIDA_APAC = 90; // D90 VENCIDA (Q34)

export interface ContextoAntiglosa {
  hoje: string; // YYYY-MM-DD, injetado
  sigtap: TabelasSigtap;
  caixas: readonly CaixaNumerada[]; // chave "apac.<campo>" -> número
  cnesConfigurado: string; // exemplo editável: 2605473 (D-W9-10)
  competenciaLote?: string | null; // competência única do lote (D-W5-10)
  apacsDoLote?: readonly Apac[]; // demais APACs do lote (duplicidade)
  camposObrigatorios?: readonly string[];
  /** Tabela CID x sexo (corpus/rulesets/apac-cid-sexo.v1.json, injetada). Ausente = gate AG-13 desligado. */
  regrasCidSexo?: readonly RegraCidSexo[] | null;
  /** Códigos da tabela local de referência (gate AG-17). Ausente = gate desligado. */
  codigosSigtapLocal?: ReadonlySet<string> | null;
  /** Esquema da ficha/prescrição vigente (gate AG-18). Ausente = gate desligado. */
  esquemaVigente?: string | null;
}

export interface RegraCidSexo { prefixo: string; sexoExigido: "M" | "F" }

const F = {
  sigtap: "SIGTAP/DATASUS, tabela da competência (D-W9-11)",
  cid: "SIGTAP RL_PROCEDIMENTO_CID, competência (D-W9-11)",
  fin: "Portaria SAES/MS 470/2021 Anexo II; PC SAES/MS 1/2022 art. 385 (D-W9-12)",
  cns: "Algoritmo e-SUS/LEDI Validar CNS; Portaria GM/MS 940/2011 (D-W9-13)",
  laudo: "Laudo APAC oficial (D-W5-06)",
  lote: "D-W5-10 (uma competência por lote)",
  prazo: "D-W5-02 / Q34 (D85 aviso, D90 vencida)",
} as const;

function normCid(c: string): string {
  return c.toUpperCase().replace(/[.\s]/g, "");
}
function cidCompativel(cid: string, lista: readonly string[]): boolean {
  const c = normCid(cid);
  return lista.some((l) => {
    const x = normCid(l);
    return x === c || (x.length === 3 && c.startsWith(x));
  });
}

/** Campo com algum conteúdo real (texto não vazio, número, true, lista ou objeto com conteúdo). */
function temConteudo(v: unknown): boolean {
  if (v === null || v === undefined || v === false) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (typeof v === "number") return true;
  if (v === true) return true;
  if (Array.isArray(v)) return v.some(temConteudo);
  if (typeof v === "object") return Object.values(v).some(temConteudo);
  return false;
}

function normEsquema(v: string): string {
  return v.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase().replace(/\s+/g, " ").trim();
}

/**
 * Gates de coerência do laudo (página 2 e cruzamentos). VERMELHO = BLOQUEIA_EXPORTACAO;
 * PENDENTE = ALERTA (falta dado). Nunca corrige dado, nunca bloqueia o clínico.
 * Campos da página 2 ainda não contratados são lidos tolerantemente: ausentes não geram achado.
 */
export function gatesCoerencia(apac: Apac, ctx: ContextoAntiglosa): Achado[] {
  const campos = apac.campos;
  const out: Achado[] = [];
  const caixa = (campo: string): number | null => ctx.caixas.find((c) => c.chave === `apac.${campo}`)?.numero ?? null;
  const vermelho = (regraId: string, campo: string, motivo: string, fonte: string): void => {
    out.push({ regraId, caixaNumero: caixa(campo), severidade: "BLOQUEIA_EXPORTACAO", motivo: `VERMELHO: ${motivo}`, fonte });
  };
  const pendente = (regraId: string, campo: string, motivo: string, fonte: string): void => {
    out.push({ regraId, caixaNumero: caixa(campo), severidade: "ALERTA", motivo: `PENDENTE: ${motivo}`, fonte });
  };

  const cid = lerTexto(campos, "cidPrincipal");
  const sexo = lerTexto(campos, "pacienteSexo");

  // AG-13 CID principal x sexo cadastrado (tabela injetada, por prefixo CID-10)
  // H20: só M/F canônicos decidem o gate; sexo em outra forma ("masculino", "X") é PENDENTE, nunca VERMELHO falso.
  if (cid && sexo && ctx.regrasCidSexo && sexo !== "M" && sexo !== "F")
    pendente("AG-13", "pacienteSexo", `sexo "${sexo}" não é M ou F; compatibilidade CID x sexo não avaliada.`, F.cid);
  else if (cid && sexo && ctx.regrasCidSexo) {
    const c = normCid(cid);
    const regra = ctx.regrasCidSexo.find((r) => c.startsWith(normCid(r.prefixo)) && sexo !== r.sexoExigido);
    if (regra) {
      const tumor = lerTexto(campos, "localizacaoTumorPrimario");
      const sufixo = tumor && normEsquema(tumor).includes("PROST") ? " Tumor primário informado: próstata; CID de mama em paciente masculino indica resíduo de modelo." : "";
      vermelho("AG-13", "cidPrincipal",
        `CID ${cid} é incompatível com o sexo ${sexo} (exige ${regra.sexoExigido}).${sufixo}`, F.cid);
    }
  }

  // AG-14 CID principal (37) x CID da topografia (57)
  const cidTopografia = lerTexto(campos, "cidTopografia");
  if (cid && cidTopografia && normCid(cid) !== normCid(cidTopografia))
    vermelho("AG-14", "cidPrincipal", `CID principal ${cid} difere do CID da topografia ${cidTopografia}.`, F.laudo);

  // AG-15 bloco de radioterapia preenchido sem RT solicitada (mesmas chaves da página 2 em laudo.ts)
  const rtSolicitadaCampo = lerCampo(campos, "radioterapiaSolicitada");
  const solicitada = rtSolicitadaCampo.estado === "PRESENTE"
    && (rtSolicitadaCampo.valor === true || (typeof rtSolicitadaCampo.valor === "string" && normEsquema(rtSolicitadaCampo.valor) === "SIM"));
  const chavesRt = ["rtTratamentoAnterior", "rtContinuidade", "rtDataInicioSolicitado", "rtFinalidade", "rtCidTopografico",
    "rtDescricaoArea", "rtNumeroCampos", "rtDataInicio", "rtDataTermino", "historicoRadioterapia"];
  const preenchidas = chavesRt.filter((k) => { const c = lerCampo(campos, k); return c.estado === "PRESENTE" && temConteudo(c.valor); });
  if (preenchidas.length > 0 && !solicitada)
    vermelho("AG-15", "radioterapiaSolicitada", `RT preenchida sem RT solicitada (${preenchidas.join(", ")}).`, F.laudo);

  // AG-16 tratamentos anteriores: ciclos do mesmo esquema lançados como tratamentos com a mesma data
  const anteriores = lerCampo(campos, "historicoQuimioterapia");
  if (anteriores.estado === "PRESENTE" && Array.isArray(anteriores.valor)) {
    const grupos = new Map<string, string[]>();
    for (const t of anteriores.valor) {
      if (!t || typeof t !== "object") continue;
      const esq = (t as { esquema?: unknown }).esquema;
      const dat = (t as { dataInicio?: unknown }).dataInicio;
      if (typeof esq !== "string" || typeof dat !== "string") continue;
      const chave = normEsquema(esq).replace(/\b(CICLO|C)\s*\d+\b/g, "").replace(/\s+/g, " ").trim();
      grupos.set(chave, [...(grupos.get(chave) ?? []), dat]);
    }
    for (const [esq, datas] of grupos)
      if (datas.length >= 2 && new Set(datas).size === 1)
        vermelho("AG-16", "historicoQuimioterapia",
          `ciclos lançados como tratamentos: ${datas.length} entradas de "${esq}" com a mesma data (${datas[0]}). A caixa pede tratamentos/esquemas anteriores, não ciclos.`, F.laudo);
  }

  // AG-17 código SIGTAP do principal ausente da tabela local de referência
  const codPrincipal = lerTexto(campos, "procedimentoPrincipal");
  if (ctx.codigosSigtapLocal && codPrincipal && codigoProcValido(codPrincipal)
    && !ctx.codigosSigtapLocal.has(normalizarCodigoProc(codPrincipal)))
    pendente("AG-17", "procedimentoPrincipal",
      `código ${normalizarCodigoProc(codPrincipal)} não consta da tabela local; conferir código na tabela vigente.`, F.sigtap);

  // AG-18 esquema da APAC x esquema da prescrição/ficha vigente
  if (ctx.esquemaVigente) {
    const esq = lerTexto(campos, "qtEsquema");
    if (esq === null)
      pendente("AG-18", "qtEsquema", "esquema da APAC não informado; não dá para comparar com a ficha vigente.", F.laudo);
    else if (normEsquema(esq) !== normEsquema(ctx.esquemaVigente))
      vermelho("AG-18", "qtEsquema", `esquema da APAC (${esq}) difere do esquema da prescrição/ficha vigente (${ctx.esquemaVigente}).`, F.laudo);
  }

  return out;
}

export function antiglosa(apac: Apac, ctx: ContextoAntiglosa): VereditoAntiglosa {
  const achados: Achado[] = [];
  const caixa = (campo: string | null): number | null =>
    campo === null ? null : (ctx.caixas.find((c) => c.chave === `apac.${campo}`)?.numero ?? null);
  const add = (regraId: string, campo: string | null, severidade: Achado["severidade"], motivo: string, fonte: string): void => {
    achados.push({ regraId, caixaNumero: caixa(campo), severidade, motivo, fonte });
  };
  const campos = apac.campos;

  // AG-08 campos obrigatórios (ausente = PENDENTE, nunca preenchido)
  for (const c of ctx.camposObrigatorios ?? CAMPOS_OBRIGATORIOS_PADRAO) {
    const l = lerCampo(campos, c);
    if (l.estado === "PENDENTE") add("AG-08", c, "BLOQUEIA_EXPORTACAO", `Campo obrigatório PENDENTE: ${c} (${l.motivo}).`, F.laudo);
  }

  // AG-09 competência única do lote
  if (ctx.competenciaLote && apac.competencia !== ctx.competenciaLote)
    add("AG-09", null, "BLOQUEIA_EXPORTACAO",
      `Competência ${apac.competencia} difere da do lote (${ctx.competenciaLote}); vai para o lote dela.`, F.lote);

  const codPrincipal = lerTexto(campos, "procedimentoPrincipal");
  const procs: { campo: string; codigo: string }[] = [];
  if (codPrincipal) procs.push({ campo: "procedimentoPrincipal", codigo: codPrincipal });
  for (const s of lerSecundarios(campos)) procs.push({ campo: "procedimentosSecundarios", codigo: s.codigo });

  const cid = lerTexto(campos, "cidPrincipal");
  const sexo = lerTexto(campos, "pacienteSexo");
  const nasc = lerTexto(campos, "pacienteNascimento");
  const dataSol = lerTexto(campos, "dataSolicitacao");
  const idadeMeses = nasc && dataSol ? idadeEmMeses(nasc, dataSol) : null;
  let modalidade = lerTexto(campos, "modalidade");
  let principal: ReturnType<typeof buscarProcedimento> | null = null;

  for (const p of procs) {
    const ehPrincipal = p.campo === "procedimentoPrincipal";
    if (!codigoProcValido(p.codigo)) {
      add("AG-01", p.campo, "BLOQUEIA_EXPORTACAO", `Código de procedimento inválido (esperado 10 dígitos): ${p.codigo}.`, F.sigtap);
      continue;
    }
    const r = buscarProcedimento(ctx.sigtap, apac.competencia, p.codigo);
    if (ehPrincipal) principal = r;
    if (!r.achou) {
      add("AG-01", p.campo, "BLOQUEIA_EXPORTACAO",
        r.motivo === "COMPETENCIA_SEM_TABELA"
          ? `Sem tabela SIGTAP carregada para a competência ${apac.competencia}; não dá para validar ${normalizarCodigoProc(p.codigo)}.`
          : `Procedimento ${normalizarCodigoProc(p.codigo)} não existe na competência ${apac.competencia}.`, F.sigtap);
      continue;
    }
    const proc = r.proc;
    // AG-02 CID x procedimento (relacionamento ausente = não verificado, dito explicitamente)
    if (cid) {
      if (proc.cidsCompativeis === null)
        add("AG-02", "cidPrincipal", "ALERTA", `Compatibilidade CID x ${proc.codigo} não carregada na tabela; não verificada.`, F.cid);
      else if (!cidCompativel(cid, proc.cidsCompativeis))
        add("AG-02", "cidPrincipal", "BLOQUEIA_EXPORTACAO", `CID ${cid} não é compatível com o procedimento ${proc.codigo} na competência ${apac.competencia}.`, F.cid);
    }
    // AG-04 sexo
    if (sexo && proc.sexo && proc.sexo !== "AMBOS" && sexo !== proc.sexo)
      add("AG-04", "pacienteSexo", "BLOQUEIA_EXPORTACAO", `Procedimento ${proc.codigo} é restrito ao sexo ${proc.sexo}; paciente ${sexo}.`, F.sigtap);
    // AG-03 idade
    if (idadeMeses !== null
      && ((proc.idadeMinMeses !== null && idadeMeses < proc.idadeMinMeses)
        || (proc.idadeMaxMeses !== null && idadeMeses > proc.idadeMaxMeses)))
      add("AG-03", "pacienteNascimento", "BLOQUEIA_EXPORTACAO",
        `Idade (${idadeMeses} meses) fora da faixa do procedimento ${proc.codigo} (${proc.idadeMinMeses ?? "-"} a ${proc.idadeMaxMeses ?? "-"} meses).`, F.sigtap);
    if (ehPrincipal && !modalidade && proc.modalidade) modalidade = proc.modalidade;
  }

  // AG-05 finalidade escolhida pelo médico (nunca deduzida da intenção)
  const finBruta = lerTexto(campos, "finalidadeApac");
  if (finBruta) {
    const fin = normalizarFinalidade(finBruta);
    const mod = modalidade?.toUpperCase() ?? null;
    const validas: readonly string[] = mod === "RT" ? FINALIDADES_RT : mod === "QT" ? FINALIDADES_QT : [...FINALIDADES_QT, ...FINALIDADES_RT];
    if (!validas.includes(fin))
      add("AG-05", "finalidadeApac", "BLOQUEIA_EXPORTACAO", `Finalidade "${finBruta}" não é válida${mod ? ` para ${mod}` : ""}.`, F.fin);
    else if (!mod)
      add("AG-05", "modalidade", "ALERTA", "Modalidade (QT/RT) não informada; finalidade checada contra a união das listas.", F.fin);
    // AG-12 compara com a finalidade do grupo SIGTAP; nunca preenche nem altera
    if (principal?.achou && principal.proc.finalidadeDoGrupo) {
      const g = normalizarFinalidade(principal.proc.finalidadeDoGrupo);
      if (g !== fin)
        add("AG-12", "finalidadeApac", "ALERTA",
          `Finalidade escolhida (${ROTULO_FINALIDADE[fin] ?? finBruta}) difere do grupo do procedimento (${ROTULO_FINALIDADE[g] ?? g}). Confirme; o app não altera a escolha.`, F.sigtap);
    }
  }

  // AG-06 CNS do paciente e do solicitante (DV válido não prova identidade)
  for (const campo of ["pacienteCns", "solicitanteCns"] as const) {
    const v = lerTexto(campos, campo);
    if (!v) continue; // PENDENTE já reportado em AG-08
    const r = validarCns(v);
    if (!r.valido) add("AG-06", campo, "BLOQUEIA_EXPORTACAO", `CNS inválido (${r.motivo}).`, F.cns);
  }

  // AG-07 CNES
  const cnes = lerTexto(campos, "cnesSolicitante");
  if (cnes) {
    if (!/^\d{7}$/.test(cnes)) add("AG-07", "cnesSolicitante", "BLOQUEIA_EXPORTACAO", `CNES deve ter 7 dígitos: "${cnes}".`, F.laudo);
    else if (cnes !== ctx.cnesConfigurado)
      add("AG-07", "cnesSolicitante", "ALERTA", `CNES ${cnes} difere do CNES configurado (${ctx.cnesConfigurado}).`, "Configuração do estabelecimento (D-W9-10)");
  }

  // AG-10 duplicidade no lote: mesmo CNS + procedimento principal + competência (chave [VERIFICAR])
  const cns = lerTexto(campos, "pacienteCns");
  for (const o of ctx.apacsDoLote ?? []) {
    if (o === apac) continue;
    const igualId = o.apacId === apac.apacId;
    const chaveIgual = !!cns && !!codPrincipal && lerTexto(o.campos, "pacienteCns") === cns
      && lerTexto(o.campos, "procedimentoPrincipal") === codPrincipal && o.competencia === apac.competencia;
    if (igualId || chaveIgual) {
      add("AG-10", null, "ALERTA",
        igualId ? `APAC ${apac.apacId} aparece mais de uma vez no lote.` : `Possível duplicidade com ${o.apacId} (mesmo CNS, procedimento e competência).`,
        "D-W9-19 (duplicidade; chave de comparação [VERIFICAR])");
      break;
    }
  }

  // AG-11 datas
  if (dataSol && !parseData(dataSol)) add("AG-11", "dataSolicitacao", "BLOQUEIA_EXPORTACAO", `Data da solicitação inválida: ${dataSol}.`, F.laudo);
  if (nasc && !parseData(nasc)) add("AG-11", "pacienteNascimento", "BLOQUEIA_EXPORTACAO", `Data de nascimento inválida: ${nasc}.`, F.laudo);
  if (nasc && dataSol && (diasEntre(nasc, dataSol) ?? 0) < 0)
    add("AG-11", "pacienteNascimento", "BLOQUEIA_EXPORTACAO", "Nascimento posterior à data da solicitação.", "Consistência interna do laudo");
  const dias = diasEntre(apac.dataGeracaoApp, ctx.hoje);
  if (dias !== null) {
    if (dias >= DIA_VENCIDA_APAC)
      add("AG-11", "dataSolicitacao", "BLOQUEIA_EXPORTACAO", `APAC com ${dias} dias desde a geração: VENCIDA (D${DIA_VENCIDA_APAC}).`, F.prazo);
    else if (dias >= DIA_AVISO_APAC)
      add("AG-11", "dataSolicitacao", "ALERTA", `APAC com ${dias} dias: aviso D${DIA_AVISO_APAC}; vence em D${DIA_VENCIDA_APAC}.`, F.prazo);
  }

  achados.push(...gatesCoerencia(apac, ctx));

  return VereditoAntiglosa.parse({
    apacId: apac.apacId, competencia: apac.competencia, achados,
    exportavel: !achados.some((a) => a.severidade === "BLOQUEIA_EXPORTACAO"),
  });
}
