import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { ambienteHttp } from "../server/http-fixture.js";
import { listarEventos } from "../../src/kernel/ledger/ledger.js";
it("HTTP usa as cadeias RADS do corpus, preserva trecho/fonte e não confirma emergência", async () => {
  const f = await ambienteHttp();
  try {
    for (const [modelo, linhas] of [["PT08-tc-abdome-pelve.txt", [7, 27]], ["PT08-tc-cranio.txt", []]] as const) {
      const rawTranscript = readFileSync(new URL(`../../docs/referencias/modelos/laudos-sinteticos/${modelo}`, import.meta.url), "utf8");
      const response = await f.request("/consulta/extrair", "POST", JSON.stringify({ recordingId: modelo,
        sourceId: "fonte-sintetica", sourceType: "imaging_report", rawTranscript }), f.token, "application/json");
      expect(response.status).toBe(201);
      const data = JSON.parse(response.body);
      expect(data.alertasRads.map((a: { linha: number }) => a.linha)).toEqual(linhas);
      for (const alerta of data.alertasRads) {
        expect(alerta).toMatchObject({ confirmadoPeloMedico: false, bloqueiaSalvar: false, sourceId: "fonte-sintetica" });
        expect(rawTranscript).toContain(alerta.trecho);
      }
    }
    expect(listarEventos(f.db, "Paciente Teste 01")).toEqual([]);
  } finally { await f.close(); }
});
