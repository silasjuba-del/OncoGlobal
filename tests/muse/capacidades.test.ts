import { expect, it } from "vitest";
import { ambienteHttp } from "../server/http-fixture.js";
it.each(["/consulta/salao/triagem", "/consulta/salao/liberar", "/consulta/canal/vincular"])(
  "capacidade %s é explícita, autenticada e não fabrica persistência", async (path) => {
    const f = await ambienteHttp();
    try {
      expect((await f.request(path, "POST", "{}", undefined, "application/json")).status).toBe(401);
      const res = await f.request(path, "POST", "{}", f.token, "application/json");
      // F0 A3: capacidades implementadas; corpo vazio continua recusado sem efeito.
      expect(res.status).toBe(400);
      expect(JSON.parse(res.body)).toEqual({ codigo: "PAYLOAD_INVALIDO" });
      expect(f.db.prepare("SELECT * FROM operation").all()).toEqual([]);
      expect(f.db.prepare("SELECT * FROM clinical_event").all()).toEqual([]);
    } finally { await f.close(); }
  });
