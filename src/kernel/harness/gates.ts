// Gates do Harness ativáveis em F0 (R-15 + G-23..28). Cada um: decisão + motivo. Puros.
// Efeito mínimo (K-xx / auditoria seção 9): nenhum gate bloqueia salvar rascunho; bloqueiam artefato, saída ou autoridade.
export { g16Owner, lerCatalogoDonos } from "./ownership.js";
export type { CatalogoDonos, DonoDeclarado, VereditoG16 } from "./ownership.js";
export { g06E1Destaque } from "../../modules/documentos/destaqueE1.js";
import type { Semaforo } from "../../contracts/index.js";
import { contemPhiResidual, type DicionarioPaciente } from "../llm/desidentificar.js";
import {
  ALIAS_ORGAO, ANATOMIA_CONFERIR_SEXO, ANATOMIA_SEXO_ESPERADO, CRITERIOS_PECA_RESSECCAO, LATERALIDADE_POR_ORGAO,
  LATERALIDADE_SINONIMOS, PREFIXO_CLINICO, PREFIXO_PATOLOGICO, SPECIMEN_BIOPSIA, SPECIMEN_RESSECCAO, VALORES_AUSENTES,
} from "./gates-tabelas.js";

export interface Veredito {
  gate: string;
  decisao: "PASSA" | "ALERTA" | "PENDENTE" | "BLOQUEIA_ARTEFATO" | "BLOQUEIA_SAIDA" | "BLOQUEIA_AUTORIDADE";
  motivo: string;
}
const passa = (gate: string): Veredito => ({ gate, decisao: "PASSA", motivo: "ok" });

/** G-02 · PHI residual a caminho de provider externo ⇒ bloqueia só a saída. */
export function g02PhiEgress(payloadTexto: string, dic: DicionarioPaciente): Veredito {
  if (typeof payloadTexto !== "string") return { gate: "G-02", decisao: "BLOQUEIA_SAIDA", motivo: "payload ausente/ilegível: não há prova de ausência de PHI" };
  return contemPhiResidual(payloadTexto, dic)
    ? { gate: "G-02", decisao: "BLOQUEIA_SAIDA", motivo: "PHI residual detectado; nada sai do PC" }
    : passa("G-02");
}

/** G-03 · assinatura só por humano com CRM, vindo da sessão do servidor. */
export function g03Assinatura(ator: { tipo: "SESSAO" | "AGENTE" | "SISTEMA" | "EXECUTOR"; crm?: string | null }): Veredito {
  return ator?.tipo === "SESSAO" && typeof ator.crm === "string" && ator.crm.trim() !== ""
    ? passa("G-03")
    : { gate: "G-03", decisao: "BLOQUEIA_AUTORIDADE", motivo: "assinatura exige médico com CRM na sessão" };
}

/** G-05 · VERDE honesto: sem checks executados ou com pendência obrigatória não há VERDE. */
export function g05VerdeHonesto(cor: Semaforo, checksExecutados: boolean, pendenciasObrigatorias: number): Veredito {
  const pendOk = typeof pendenciasObrigatorias === "number" && Number.isFinite(pendenciasObrigatorias);
  return cor === "VERDE" && (checksExecutados !== true || !pendOk || pendenciasObrigatorias > 0)
    ? { gate: "G-05", decisao: "ALERTA", motivo: "VERDE indevido: rebaixado para PENDENTE (dado preservado)" }
    : passa("G-05");
}

/** G-10 · dose calculada por LLM é proibida; menção literal com fonte é permitida (K-13). */
export function g10DosePura(saidaAgente: Record<string, unknown>, origem: "LLM" | "FUNCAO_PURA"): Veredito {
  const temDoseCalculada = !saidaAgente || typeof saidaAgente !== "object" || "doseFinalMg" in saidaAgente || "doseCalculadaMg" in saidaAgente;
  // só FUNCAO_PURA é origem confiável; origem ausente/desconhecida trata-se como LLM
  return origem !== "FUNCAO_PURA" && temDoseCalculada
    ? { gate: "G-10", decisao: "BLOQUEIA_AUTORIDADE", motivo: "LLM não calcula dose; só FN-04" }
    : passa("G-10");
}

/** G-13 · intenção persistida como termo, nunca letra A–D. */
export function g13Letra(intencao: string): Veredito {
  if (typeof intencao !== "string" || intencao.trim() === "") return { gate: "G-13", decisao: "PENDENTE", motivo: "intenção ausente: nada a validar" };
  return /^[A-D]$/i.test(intencao.trim())
    ? { gate: "G-13", decisao: "BLOQUEIA_ARTEFATO", motivo: "intenção deve ser o termo (ex.: ADJUVANTE), não a letra" }
    : passa("G-13");
}

/** G-14 · ponto interpolado nunca é observação. */
export function g14Interpolacao(ponto: { interpolado: boolean; observado: boolean }): Veredito {
  if (typeof ponto?.interpolado !== "boolean" || typeof ponto?.observado !== "boolean")
    return { gate: "G-14", decisao: "PENDENTE", motivo: "proveniência do ponto (interpolado/observado) não informada" };
  return ponto.interpolado && ponto.observado
    ? { gate: "G-14", decisao: "BLOQUEIA_ARTEFATO", motivo: "interpolação não vira dado observado" }
    : passa("G-14");
}

/** G-23 · só comando CURTO vai à Deepgram (A9). Limite em segundos é parâmetro (pendência 0.8-1). */
export function g23ComandoDeepgram(duracaoSeg: number, limiteSeg: number): Veredito {
  return duracaoSeg > 0 && duracaoSeg <= limiteSeg
    ? passa("G-23")
    : { gate: "G-23", decisao: "BLOQUEIA_SAIDA", motivo: `áudio de ${duracaoSeg}s não é comando curto (≤${limiteSeg}s); fica local` };
}

/** G-25 · assinatura só cobre documentos/versões exibidos no bundle (A1). */
export function g25EscopoAssinatura(
  assinar: readonly { documentId: string; documentVersion: number }[],
  exibidos: readonly { documentId: string; documentVersion: number }[],
): Veredito {
  // Lista malformada ⇒ bloqueia. Lista VAZIA = nada a assinar (confirmação sem documento): não exerce autoridade.
  if (!Array.isArray(assinar) || !Array.isArray(exibidos))
    return { gate: "G-25", decisao: "BLOQUEIA_AUTORIDADE", motivo: "escopo de assinatura ou bundle exibido ausente" };
  const fora = assinar.filter((a) => !exibidos.some((e) => e.documentId === a.documentId && e.documentVersion === a.documentVersion));
  return fora.length
    ? { gate: "G-25", decisao: "BLOQUEIA_AUTORIDADE", motivo: `documento não exibido: ${fora.map((f) => `${f.documentId}@${f.documentVersion}`).join(", ")}` }
    : passa("G-25");
}

/** G-26 · sugestão visual não altera TNM/RECIST/resposta/protocolo/APAC nem gera VERDE. */
export function g26VisaoSemAutoridade(alvo: string, origem: "VISUAL_SUGGESTION" | "MEDICO" | "REGRA"): Veredito {
  const protegidos = ["TNM", "RECIST", "RESPOSTA", "PROTOCOLO", "APAC", "SEMAFORO"];
  if (typeof alvo !== "string" || alvo.trim() === "") return { gate: "G-26", decisao: "PENDENTE", motivo: "alvo da alteração ausente" };
  if (origem !== "VISUAL_SUGGESTION" && origem !== "MEDICO" && origem !== "REGRA")
    return { gate: "G-26", decisao: "BLOQUEIA_AUTORIDADE", motivo: "origem da alteração desconhecida: sem autoridade comprovada" };
  return origem === "VISUAL_SUGGESTION" && protegidos.includes(alvo.trim().toUpperCase())
    ? { gate: "G-26", decisao: "BLOQUEIA_AUTORIDADE", motivo: "sugestão da IA sem laudo não altera dado clínico" }
    : passa("G-26");
}

// ── helpers de normalização (puros) ──────────────────────────────────────────
const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");
const norm = (t: unknown): string => (typeof t === "string" ? semAcento(t).trim().toLowerCase() : "");
/** true se o valor é ausente/vazio/NAO_INFORMADO/não-string (ausente nunca é PASSA). */
const ausente = (v: unknown): boolean => typeof v !== "string" || VALORES_AUSENTES.includes(norm(v));
const orgaoCanonico = (o: unknown): string => {
  const n = norm(o);
  return ALIAS_ORGAO[n] ?? n;
};

/**
 * G-07 · lateralidade PATH × RADS × procedimento × diagnóstico (D-W9-05).
 * Divergência ⇒ ALERTA + revisão humana obrigatória (nunca veto); ausência em qualquer fonte ⇒ PENDENTE.
 * `orgao` é opcional; se informado e fora da tabela D-W9-05, a lateralidade não é obrigatória.
 */
export function g07Lateralidade(entrada: {
  orgao?: string | null; path?: unknown; rads?: unknown; procedimento?: unknown; diagnostico?: unknown;
}): Veredito {
  const G = "G-07";
  const orgao = orgaoCanonico(entrada?.orgao);
  const dominio = orgao ? LATERALIDADE_POR_ORGAO[orgao] : undefined;
  if (orgao && !dominio) return { gate: G, decisao: "PASSA", motivo: `órgão "${orgao}" fora da tabela D-W9-05: lateralidade não obrigatória` };
  const fontes: [string, unknown][] = [["PATH", entrada?.path], ["RADS", entrada?.rads], ["procedimento", entrada?.procedimento], ["diagnóstico", entrada?.diagnostico]];
  const valores = fontes.map(([nome, v]) => ({ nome, v: ausente(v) ? null : (LATERALIDADE_SINONIMOS[norm(v)] ?? `?${String(v)}`) }));
  const presentes = valores.filter((x): x is { nome: string; v: string } => x.v !== null);
  const invalidos = presentes.filter((x) => x.v.startsWith("?") || (dominio && !dominio.includes(x.v)));
  const distintos = new Set(presentes.map((x) => x.v));
  if (distintos.size > 1 || invalidos.length)
    return { gate: G, decisao: "ALERTA", motivo: `lateralidade divergente/inválida (${presentes.map((x) => `${x.nome}=${x.v.replace(/^\?/, "")}`).join(", ")}): revisão humana obrigatória` };
  const faltam = valores.filter((x) => x.v === null).map((x) => x.nome);
  if (faltam.length) return { gate: G, decisao: "PENDENTE", motivo: `lateralidade ausente em: ${faltam.join(", ")}` };
  return passa(G);
}

/**
 * G-08 · anatomia × sexo cadastral (D-W9-06). Divergência = conferir cadastro (ALERTA), nunca veto.
 * Mama está fora da tabela (existe nos dois sexos): em cadastro M só pede conferência (PENDENTE), sem acusar incoerência.
 */
export function g08AnatomiaSexo(entrada: { anatomia?: unknown; sexoCadastral?: unknown }): Veredito {
  const G = "G-08";
  if (ausente(entrada?.anatomia)) return { gate: G, decisao: "PENDENTE", motivo: "anatomia não informada" };
  const anat = orgaoCanonico(entrada.anatomia);
  const sexo = typeof entrada.sexoCadastral === "string" ? entrada.sexoCadastral.trim().toUpperCase() : "";
  const esperado = ANATOMIA_SEXO_ESPERADO[anat];
  const conferir = ANATOMIA_CONFERIR_SEXO[anat];
  if (!esperado && !conferir) return { gate: G, decisao: "PASSA", motivo: `anatomia "${anat}" sem restrição de sexo (D-W9-06)` };
  if (sexo !== "F" && sexo !== "M")
    return { gate: G, decisao: "PENDENTE", motivo: `sexo cadastral ${sexo || "ausente"}: não é possível conferir anatomia × sexo` };
  if (esperado) {
    return sexo === esperado
      ? passa(G)
      : { gate: G, decisao: "ALERTA", motivo: `${anat} com cadastro ${sexo}: conferir cadastro/identidade (revisão humana; não bloqueia)` };
  }
  return sexo === conferir
    ? passa(G)
    : { gate: G, decisao: "PENDENTE", motivo: `${anat} em cadastro ${sexo}: possível (existe nos dois sexos); conferir cadastro` };
}

/** Entrada de G-09. `laudo` permite reconhecer peça de ressecção por conteúdo (D-W9-07) quando `specimen` não vem tipado. */
export interface EntradaG09 {
  prefixo?: unknown; tnmExplicito?: unknown; specimen?: unknown;
  laudo?: { identificacaoPecaCirurgica?: boolean; dimensoes?: boolean; peso?: boolean; margens?: boolean; linfonodos?: boolean } | null;
}
type Peca = "RESSECCAO" | "BIOPSIA" | "DESCONHECIDA";
function classificarPeca(e: EntradaG09): Peca {
  const sp = typeof e.specimen === "string" ? e.specimen.trim().toUpperCase() : "";
  if (SPECIMEN_BIOPSIA.includes(sp)) return "BIOPSIA";
  if (SPECIMEN_RESSECCAO.includes(sp)) return "RESSECCAO";
  const l = e.laudo;
  if (l?.identificacaoPecaCirurgica && CRITERIOS_PECA_RESSECCAO.some((c) => (l as Record<string, unknown>)[c] === true)) return "RESSECCAO";
  return "DESCONHECIDA";
}

/** G-09 · pTNM só com peça de ressecção + TNM explícito; biópsia dá só cT (D-W9-07). */
export function g09PtDeBiopsia(entrada: EntradaG09): Veredito {
  const G = "G-09";
  const prefixo = typeof entrada?.prefixo === "string" ? entrada.prefixo.trim().toLowerCase() : "";
  if (!prefixo) return { gate: G, decisao: "PENDENTE", motivo: "prefixo TNM ausente" };
  if (PREFIXO_CLINICO.includes(prefixo)) return passa(G);
  if (!PREFIXO_PATOLOGICO.includes(prefixo))
    return { gate: G, decisao: "PENDENTE", motivo: `prefixo "${prefixo}" não coberto pela regra pTNM: conferir` };
  const peca = classificarPeca(entrada);
  if (peca === "BIOPSIA")
    return { gate: G, decisao: "BLOQUEIA_ARTEFATO", motivo: "pTNM rejeitado: peça é biópsia (só cT; D-W9-07); campo nunca preenchido por regra" };
  if (peca === "DESCONHECIDA")
    return { gate: G, decisao: "PENDENTE", motivo: "peça de ressecção não comprovada (tamanho/peso/margens/linfonodos + identificação de peça)" };
  return entrada.tnmExplicito === true
    ? passa(G)
    : { gate: G, decisao: "PENDENTE", motivo: "ressecção sem TNM explícito no laudo: pTNM é do médico" };
}

/**
 * G-27 · saída externa limpa (N25). Artefato a caminho de serviço externo só sai com SanitizationReport
 * de risco BAIXO + versão do sanitizador e sem metadado de identificação. Sem relatório ⇒ bloqueia a SAÍDA
 * (trabalho local segue). Convive com G-02; não reabre egress (autorizacao.ts continua recusando canais externos).
 */
export function g27SaidaExternaLimpa(entrada: {
  artefato?: { tipo?: string; metadados?: Record<string, unknown> | null } | null;
  destino?: string | null;
  sanitizationReport?: { riscoResidual?: unknown; versaoSanitizador?: unknown } | null;
}): Veredito {
  const G = "G-27";
  const bloqueia = (motivo: string): Veredito => ({ gate: G, decisao: "BLOQUEIA_SAIDA", motivo });
  if (!entrada?.artefato) return bloqueia("artefato ausente: nada sai sem inspeção");
  if (ausente(entrada.destino)) return bloqueia("destino ausente/desconhecido: tratado como externo");
  const r = entrada.sanitizationReport;
  if (!r || typeof r !== "object") return bloqueia("sem SanitizationReport: saída externa bloqueada (HALTED); trabalho local segue");
  const ident = Object.entries(entrada.artefato.metadados ?? {}).filter(([, v]) => typeof v === "string" ? !ausente(v) : v !== null && v !== undefined);
  if (ident.length) return bloqueia(`metadado de identificação presente (${ident.map(([k]) => k).join(", ")}): HALTED da saída`);
  if (r.riscoResidual !== "BAIXO") return bloqueia(`risco residual ${String(r.riscoResidual)}: HALTED da saída`);
  if (typeof r.versaoSanitizador !== "string" || !r.versaoSanitizador.trim()) return bloqueia("relatório sem versão do sanitizador: inválido");
  return passa(G);
}
