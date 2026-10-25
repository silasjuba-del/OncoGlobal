import { createHash } from "node:crypto";
import type { EntradaDocumentosConsulta, MaterialDocumento } from "../../../src/modules/documentos/consulta.js";

// Dados inteiramente sintéticos; a frase é decisão já estruturada pelo dono da revisão.
export const contexto = { patientId: "paciente-s9", encounterId: "encontro-s9", tumorLotId: null };
export const fonte = {
  sourceId: "decisao-s9", classe: "MANUAL" as const, localizador: "decisão médica",
  dataClinica: "2026-10-12", dataCaptura: "2026-10-12T10:00:00-03:00", versao: "1",
  // Conteúdo sintético da fonte; não representa hash do documento de saída.
  contentHash: createHash("sha256").update("fonte-sintetica-1", "utf8").digest("hex"),
};

export function entradaCanonica(): EntradaDocumentosConsulta {
  return {
    contexto: { ...contexto }, operationId: "preparar-s9", revisao: "fatos-1",
    dataReferencia: "2026-10-12", fuso: "America/Fortaleza",
    decisao: {
      decisaoId: "decisao-s9", contexto: { ...contexto }, revisao: "CONFIRMADO",
      origem: "DECISAO_MEDICA", fontes: [{ ...fonte }],
      medicamentos: [{ id: "med-1", medicamento: "Pantoprazol", dose: "40 mg", orientacao: "pela manhã",
        duracao: "30 dias", via: null, quantidade: null }],
      pedidos: [{ id: "exame-1", exame: "hemograma", indicacao: null },
        { id: "exame-2", exame: "creatinina", indicacao: null }],
      retorno: { dias: 14, motivo: null, tarefaId: "tarefa-retorno-s9" },
    },
    materiais: [],
  };
}

export function material(tipo: MaterialDocumento["tipo"] = "EVOLUCAO"): MaterialDocumento {
  return {
    tipo, contexto: { ...contexto },
    template: { templateId: `base-${tipo}`, versao: "1", fonte: { ...fonte },
      campos: [{ id: "texto", rotulo: "Registro médico", obrigatorio: true }] },
    fatos: [{ campo: "texto", valor: "Dado sintético confirmado", revisao: "CONFIRMADO",
      origem: "FATO_CONFIRMADO", fontes: [{ ...fonte }] }],
  };
}
