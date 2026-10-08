import { expect, it } from "vitest";
import { ambienteHttp } from "../server/http-fixture.js";
it.each(["/consulta/salao/triagem", "/consulta/salao/liberar", "/consulta/canal/vincular"])(
  "capacidade %s é explícita, autenticada e não fabrica persistência", async (path) => {
    const f = await ambienteHttp();
    try {
      expect((await f.request(path, "POST", "{}", undefined, "application/json")).status).toBe(401);
      const res = await f.request(path, "POST", "{}", f.token, "application/json");
      expect(res.status).toBe(501);
      expect(JSON.parse(res.body)).toEqual({ codigo: "CAPACIDADE_PENDENTE", criaEventoClinico: false });
      expect(f.db.prepare("SELECT * FROM operation").all()).toEqual([]);
    } finally { await f.close(); }
  });
