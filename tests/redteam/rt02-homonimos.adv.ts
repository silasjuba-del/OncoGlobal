// RT-02 · Nomes e homônimos (S0) — FALHA real: homônimos completos SEM chamada explícita
// ("Bom dia, Maria...") não abrem fronteira: dois pacientes caem no MESMO segmento, sem
// sinal de revisão de fronteira. Especificação (PIPELINE §1): "fronteira duvidosa não faz
// merge automático" — separar e marcar REVISAR_FRONTEIRA.
// Dono provável: src/kernel/extracao/segmenter.ts (Fugu).
import { describe, expect, it } from "vitest";
import { segmentarTranscricao } from "../../src/kernel/extracao/segmenter.js";

const turnos = (...textos: readonly string[]) =>
  textos.map((text, i) => ({ text, startMs: i * 30_000, endMs: i * 30_000 + 25_000, speaker: "medico" }));

describe("RT-02 · homônimos sem chamada explícita fundem dois pacientes num segmento", () => {
  it("PROVA DE FALHA: dois homônimos completos sem 'chamo' ⇒ fronteira duvidosa separa e marca revisão", () => {
    const segmentos = segmentarTranscricao({
      recordingId: "grav-rt02-adv", sourceId: "plaud-9", sourceType: "plaud",
      turns: turnos(
        "Bom dia, Maria. 54 anos, tumor de mama direita. Como estão as dores?",
        "Bom dia, Maria. Tumor de mama esquerda hoje, vamos revisar o exame.",
      ),
    });
    expect(segmentos.length,
      `Fronteira duvidosa fundiu ${segmentos.length} consultas de pacientes homônimos num único ` +
      "segmento (rawTranscript compartilhado, uma só exceção UNLINKED_PATIENT): fatos dos dois " +
      "pacientes ficam misturados no mesmo candidato. Spec §1: fronteira duvidosa separa e marca " +
      "revisão, nunca une. Sinais de saudação + repetição de primeiro nome + mudança de " +
      "lateralidade deveriam abrir fronteira duvidosa (boundaryReviewRequired=true).")
      .toBe(2);
  });

  it("com a fronteira aberta, cada segmento carrega só o seu candidato e exige revisão", () => {
    const segmentos = segmentarTranscricao({
      recordingId: "grav-rt02-adv", sourceId: "plaud-9", sourceType: "plaud",
      turns: turnos(
        "Bom dia, Maria. 54 anos, tumor de mama direita. Como estão as dores?",
        "Bom dia, Maria. Tumor de mama esquerda hoje, vamos revisar o exame.",
      ),
    });
    if (segmentos.length < 2) return; // comportamento atual funde; guarda até a correção
    for (const s of segmentos) {
      expect(s.patientId).toBeNull();
      expect(s.boundaryReviewRequired).toBe(true);
    }
  });
});
