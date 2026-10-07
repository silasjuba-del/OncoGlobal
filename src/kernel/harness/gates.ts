// Gates do Harness ativáveis em F0 (R-15 + G-23..28). Cada um: decisão + motivo. Puros.
// Efeito mínimo (K-xx / auditoria seção 9): nenhum gate bloqueia salvar rascunho; bloqueiam artefato, saída ou autoridade.
import type { Semaforo } from "../../contracts/index.js";
import { contemPhiResidual, type DicionarioPaciente } from "../llm/desidentificar.js";
import { ALIAS_ORGAO, LATERALIDADE_POR_ORGAO, LATERALIDADE_SINONIMOS, VALORES_AUSENTES } from "./gates-tabelas.js";

export interface Veredito {
  gate: string;
  decisao: "PASSA" | "ALERTA" | "PENDENTE" | "BLOQUEIA_ARTEFATO" | "BLOQUEIA_SAIDA" | "BLOQUEIA_AUTORIDADE";
  motivo: string;
}
const passa = (gate: string): Veredito => ({ gate, decisao: "PASSA", motivo: "ok" });

/** G-02 · PHI residual a caminho de provider externo ⇒ bloqueia só a saída. */
export function g02PhiEgress(payloadTexto: string, dic: DicionarioPaciente): Veredito {
  return contemPhiResidual(payloadTexto, dic)
    ? { gate: "G-02", decisao: "BLOQUEIA_SAIDA", motivo: "PHI residual detectado; nada sai do PC" }
    : passa("G-02");
}

/** G-03 · assinatura só por humano com CRM, vindo da sessão do servidor. */
export function g03Assinatura(ator: { tipo: "SESSAO" | "AGENTE" | "SISTEMA" | "EXECUTOR"; crm?: string | null }): Veredito {
  return ator.tipo === "SESSAO" && !!ator.crm
    ? passa("G-03")
    : { gate: "G-03", decisao: "BLOQUEIA_AUTORIDADE", motivo: "assinatura exige médico com CRM na sessão" };
}

/** G-05 · VERDE honesto: sem checks executados ou com pendência obrigatória não há VERDE. */
export function g05VerdeHonesto(cor: Semaforo, checksExecutados: boolean, pendenciasObrigatorias: number): Veredito {
  return cor === "VERDE" && (!checksExecutados || pendenciasObrigatorias > 0)
    ? { gate: "G-05", decisao: "ALERTA", motivo: "VERDE indevido: rebaixado para PENDENTE (dado preservado)" }
    : passa("G-05");
}

/** G-10 · dose calculada por LLM é proibida; menção literal com fonte é permitida (K-13). */
export function g10DosePura(saidaAgente: Record<string, unknown>, origem: "LLM" | "FUNCAO_PURA"): Veredito {
  const temDoseCalculada = "doseFinalMg" in saidaAgente || "doseCalculadaMg" in saidaAgente;
  return origem === "LLM" && temDoseCalculada
    ? { gate: "G-10", decisao: "BLOQUEIA_AUTORIDADE", motivo: "LLM não calcula dose; só FN-04" }
    : passa("G-10");
}

/** G-13 · intenção persistida como termo, nunca letra A–D. */
export function g13Letra(intencao: string): Veredito {
  return /^[A-D]$/i.test(intencao.trim())
    ? { gate: "G-13", decisao: "BLOQUEIA_ARTEFATO", motivo: "intenção deve ser o termo (ex.: ADJUVANTE), não a letra" }
    : passa("G-13");
}

/** G-14 · ponto interpolado nunca é observação. */
export function g14Interpolacao(ponto: { interpolado: boolean; observado: boolean }): Veredito {
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
  const fora = assinar.filter((a) => !exibidos.some((e) => e.documentId === a.documentId && e.documentVersion === a.documentVersion));
  return fora.length
    ? { gate: "G-25", decisao: "BLOQUEIA_AUTORIDADE", motivo: `documento não exibido: ${fora.map((f) => `${f.documentId}@${f.documentVersion}`).join(", ")}` }
    : passa("G-25");
}

/** G-26 · sugestão visual não altera TNM/RECIST/resposta/protocolo/APAC nem gera VERDE. */
export function g26VisaoSemAutoridade(alvo: string, origem: "VISUAL_SUGGESTION" | "MEDICO" | "REGRA"): Veredito {
  const protegidos = ["TNM", "RECIST", "RESPOSTA", "PROTOCOLO", "APAC", "SEMAFORO"];
  return origem === "VISUAL_SUGGESTION" && protegidos.includes(alvo.toUpperCase())
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
