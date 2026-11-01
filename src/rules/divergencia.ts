import { Divergencia } from "../contracts/divergencia.js";
import type { SafetyVerdict } from "../contracts/w10/prescricao.js";

export interface ContextoDivergencia {
  cartaoId: string;
  contexto: NonNullable<Divergencia["decisao"]>["contexto"];
  dadosDecisivosDisponiveis: boolean | null;
  /** Only the item identities present in the dose-bearing document being assessed. */
  itensComDose: readonly string[];
}
export interface AvaliacaoDivergencia {
  divergenciaId: string;
  resultado: SafetyVerdict["resultado"] | "INDETERMINADO";
  polos: Divergencia["polos"];
  poloAplicado: Divergencia["polos"][number] | null;
  proveniencia: Divergencia["decisao"];
  aviso: string;
  bloqueiaMedico: false;
  bloqueiaSalvar: false;
}
/** Pure policy for declared uncertainty. Does not compute dose, infer eligibility or sign a decision. */
export function avaliarDivergencias(entrada: readonly Divergencia[], ctx: ContextoDivergencia): AvaliacaoDivergencia[] {
  return entrada.map(d => Divergencia.parse(d)).filter(d => d.cartaoIds.includes(ctx.cartaoId) && d.estado !== "SUPERADA").map(d => {
    const base = { divergenciaId: d.id, polos: d.polos, poloAplicado: null, proveniencia: null,
      bloqueiaMedico: false as const, bloqueiaSalvar: false as const };
    if (ctx.dadosDecisivosDisponiveis !== true) return { ...base, resultado: "NOT_EVALUABLE" as const, aviso: "Dados decisivos ausentes ou não verificados; conferir os polos." };
    if (d.estado === "DECIDIDA" && d.decisao) {
      const a = d.decisao.contexto, b = ctx.contexto;
      if (a.patientId !== b.patientId || a.encounterId !== b.encounterId || a.tumorLotId !== b.tumorLotId)
        return { ...base, resultado: "NOT_EVALUABLE" as const, aviso: "Decisão fora deste paciente/encontro; nenhum polo aplicado." };
      return { ...base, resultado: "PASS" as const, poloAplicado: d.polos.find(p => p.id === d.decisao!.poloEscolhido)!,
        proveniencia: d.decisao, aviso: "Polo indicado no registro médico assinado; não confirma elegibilidade nem libera tratamento." };
    }
    const tocaDose = d.itensAfetados.some(item => ctx.itensComDose.includes(item));
    const resultado = d.efeitoNoMotor === "INDETERMINADO" ? "INDETERMINADO" as const
      : d.efeitoNoMotor === "BLOQUEIA_DOCUMENTO_COM_DOSE" && tocaDose ? "BLOCK_ARTEFATO" as const : "WARNING" as const;
    return { ...base, resultado, aviso: resultado === "BLOCK_ARTEFATO"
      ? "Divergência aberta neste item com dose: manter plano sem posologia; conferir os polos."
      : "Divergência aberta: conferir os polos; nenhuma escolha automática." };
  });
}
