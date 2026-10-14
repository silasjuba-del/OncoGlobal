import { expect, it } from "vitest";
import { ConsultaCarregar } from "../../src/contracts/f1/consultaCarregar.js";
import { instanteDoServico } from "../../src/contracts/f1/relogio.js";
import { projetarSnapshot } from "../../src/kernel/projections/snapshot.js";
import type { ClinicalEvent } from "../../src/contracts/operacao.js";
it("alergia pertence ao paciente mesmo registrada em outro lote", () => {
 const e: ClinicalEvent={eventId:"a",operationId:"op-a",eventIndex:0,patientId:"p",encounterId:"e",tumorLotId:"a",tipo:"FATO",payload:{data:{campo:"alergias",valor:["dipirona"]}},fontes:[],revisao:"CONFIRMADO",criadoEm:"2026-10-11T23:30:00-03:00",criadoPor:{tipo:"SESSAO",id:"m"},supersedesEventId:null};
 expect(projetarSnapshot([e],"p","b","e","v1").campos.alergias?.valor).toEqual(["dipirona"]);
});
