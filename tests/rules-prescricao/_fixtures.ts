// Fixtures SINTÉTICAS (nenhum dado de paciente). Validadas pelos schemas de src/contracts/w10/prescricao.ts.
import { PrescriptionItem, ProtocolTemplate } from "../../src/contracts/w10/prescricao.js";

export function item(over: Partial<PrescriptionItem> & { drug: string }): PrescriptionItem {
  return PrescriptionItem.parse({
    classe: "QT", sequence: 1, standardDose: null, doseBasis: "FIXED", calculatedDose: null, prescribedDose: null,
    unit: "mg", adjustmentPercent: null, adjustmentReason: null, route: "EV", diluent: null, finalVolumeMl: null,
    infusionTime: null, days: ["d1"], observacao: null, source: "PROTOCOL", overrideMotivo: null, ...over,
  });
}

export function template(itens: PrescriptionItem[], status: ProtocolTemplate["status"] = "CONFERIDA_MEDICO"): ProtocolTemplate {
  return ProtocolTemplate.parse({
    templateId: "tpl-sintetico-01", tumor: "SINTETICO", nome: "Protocolo Teste", cenario: "TESTE", versao: "1",
    hash: "hash-sintetico", codigoInstitucional: null, intervaloDias: 21, ciclos: 4, itens,
    limiaresBula: null, fonte: "sintetico", status,
  });
}
