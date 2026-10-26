import type { Plano } from "./tipos.js";
import { SetorClinico } from "../contracts/f1/achadosSetor.js";
import { TipoEstimulo } from "../contracts/f1/estimuloTecnico.js";

const plano = (evento: string, waves: readonly (readonly string[])[]): Plano => {
  const passos = waves.flatMap((wave, idx) => wave.map((id) => ({
    id, dependsOn: idx === 0 ? [] : [...waves[idx - 1]!], timeoutMs: 2000,
  })));
  return { evento, passos, conclusao: passos.some(p => p.id === "RECONCILIADOR")
    ? { tipo: "RECONCILIADOR", passoId: "RECONCILIADOR" } : { tipo: "ALGUM_TERMINAL" } };
};

/** R-14 deterministic event table. No text/LLM can alter the ACTIVE_SET. */
const TABELA: Readonly<Record<string, Plano>> = Object.freeze({
  ...Object.fromEntries(TipoEstimulo.options.map(evento => [evento, plano(evento, [SetorClinico.options, ["RECONCILIADOR"]])])),
  LAB_CHEGOU: plano("LAB_CHEGOU", [["LAB"], ["INTERACTION", "EMERGENCY"], ["DELTA"]]),
  RADS_CHEGOU: plano("RADS_CHEGOU", [["RADS"], ["EMERGENCY"], ["DELTA"]]),
  PATH_CHEGOU: plano("PATH_CHEGOU", [["PATH"], ["DELTA"]]),
  PRE_CONSULTA: plano("PRE_CONSULTA", [["CANAL_READER"], ["DELTA"], ["COMORB", "INTERACTION", "EMERGENCY"], ["DOCUMENT"]]),
  VOZ_COMANDO: plano("VOZ_COMANDO", [["VOICE_INTENT"]]),
  TRIAGEM: plano("TRIAGEM", [["TRIAGE"], ["EMERGENCY"]]),
  INICIAR_CONSULTA: plano("INICIAR_CONSULTA", [
    ["LAB", "RADS", "PATH", "CHEMO"], ["CTCAE"], ["COMORB", "INTERACTION"], ["EMERGENCY"], ["DELTA"], ["SINTESE"],
  ]),
  VALIDAR_BLOCO: plano("VALIDAR_BLOCO", [["WriteRouter"], ["DOCUMENT"], ["APAC_RASCUNHO"]]),
  PRESCRICAO_ASSINADA: plano("PRESCRICAO_ASSINADA", [["FARMACIA_CANAL"], ["APAC_RASCUNHO"]]),
  APAC_NEGADA: plano("APAC_NEGADA", [["APAC"], ["APAC_RETROGRADA"]]),
  MENSAGEM_PACIENTE: plano("MENSAGEM_PACIENTE", [["CANAL_READER"], ["EMERGENCY"], ["ContactSummary"]]),
});

export function maestro(evento: string): Plano | null {
  if (!Object.hasOwn(TABELA, evento)) return null;
  const selected = TABELA[evento];
  return selected ? { evento, ...(selected.conclusao ? { conclusao: { ...selected.conclusao } } : {}), passos: selected.passos.map((p) => ({ ...p, dependsOn: [...p.dependsOn] })) } : null;
}
