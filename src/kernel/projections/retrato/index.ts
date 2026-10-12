import { createHash } from "node:crypto";
import { ClinicalEvent } from "../../../contracts/operacao.js";
import { Retrato, type FatoRetrato } from "../../../contracts/f1/retrato.js";

export interface ContextoRetrato {
  patientId: string; encounterId: string; tumorLotId: string | null; agora: string;
  regras: Retrato["regras"]; biblioteca: Retrato["biblioteca"];
}
/** JSON canônico: não aceita valores não persistíveis nem usa ordem de inserção. */
function canonico(valor: unknown): string {
  if (valor === null || typeof valor === "string" || typeof valor === "boolean") return JSON.stringify(valor);
  if (typeof valor === "number" && Number.isFinite(valor)) return JSON.stringify(valor);
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(",")}]`;
  if (valor && typeof valor === "object" && Object.getPrototypeOf(valor) === Object.prototype)
    return `{${Object.keys(valor).sort().map(k => `${JSON.stringify(k)}:${canonico((valor as Record<string, unknown>)[k])}`).join(",")}}`;
  throw new Error("CONTEUDO_NAO_CANONICO");
}
export function hashCanonico(valor: unknown): string { return createHash("sha256").update(canonico(valor)).digest("hex"); }
function dados(e: ClinicalEvent): Record<string, unknown> | null {
  if (!e.payload || typeof e.payload !== "object" || Array.isArray(e.payload)) return null;
  const data = (e.payload as Record<string, unknown>).data;
  return data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : null;
}
const normalizarChave = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const sistemicos = new Set(["alergias", "alergia", "comorbidades", "medicamentos", "medicacao", "funcaoorganica", "exposicoes", "exposicaocumulativa", "cumulativos", "dosecumulativa"]);
const materiaisConhecidos = new Set(["Paciente", "TumorLot", "Weight", "ImagingReport", "Biopsy", "TreatmentEpisode", "Ciclo", "DOCUMENTO",
  "LabResult", "TreatmentAdministration", "TreatmentCycle", "SignedDocument", "DocumentSigned"]);
function escopo(e: ClinicalEvent, d: Record<string, unknown>): FatoRetrato["escopo"] {
  const campo = normalizarChave(String(d.campo));
  return sistemicos.has(campo) || campo.startsWith("extracao.lab:") || campo === "extracao.drug"
    || ["Paciente", "Weight", "LabResult", "TreatmentAdministration"].includes(e.tipo) ? "PACIENTE" : "TUMOR";
}
function tempo(d: Record<string, unknown>, e: ClinicalEvent): string | null {
  for (const chave of ["dataClinica", "factDate", "data", "date"]) if (typeof d[chave] === "string") return d[chave] as string;
  const datas = [...new Set(e.fontes.map(f => f.dataClinica).filter((v): v is string => v !== null))];
  return datas.length === 1 ? datas[0]! : null;
}
function ordem(a: ClinicalEvent, b: ClinicalEvent): number {
  return Date.parse(a.criadoEm) - Date.parse(b.criadoEm) || a.operationId.localeCompare(b.operationId)
    || a.eventIndex - b.eventIndex || a.eventId.localeCompare(b.eventId);
}
function consulta(e: ClinicalEvent): boolean {
  const d = dados(e);
  return ["ConsultaConfirmada", "ConsultaConfirmada@1"].includes(e.tipo) && d !== null
    && typeof d.dataClinica === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.dataClinica)
    && Array.isArray(d.documentoIds) && d.documentoIds.length > 0
    && d.documentoIds.every(v => v && typeof v === "object" && typeof v.documentId === "string"
      && v.documentId.length > 0 && Number.isInteger(v.documentVersion) && v.documentVersion > 0);
}

/** Projeção pura. Contexto é fornecido pelo chamador; nenhum evento pode mudar o encontro aberto. */
export function projetarRetrato(eventos: readonly ClinicalEvent[], contexto: ContextoRetrato,
  integridade: Retrato["integridade"] = []): Retrato {
  const horizonte = Date.parse(contexto.agora);
  if (!Number.isFinite(horizonte)) throw new Error("HORIZONTE_INVALIDO");
  const problemas = [...integridade];
  const impedidos = new Set(integridade.map(i => i.eventoId));
  const diagnostico = (e: ClinicalEvent, motivo: string) => problemas.push({ eventoId: e.eventId, tipo: e.tipo, motivo });
  const porId = new Map<string, ClinicalEvent>();
  const duplicados = new Set<string>();
  for (const bruto of eventos) {
    const validado = ClinicalEvent.safeParse(bruto);
    if (!validado.success) { diagnostico(bruto, "ENVELOPE_INVALIDO"); continue; }
    const e = validado.data;
    if (porId.has(e.eventId)) { duplicados.add(e.eventId); diagnostico(e, "EVENT_ID_DUPLICADO"); }
    porId.set(e.eventId, e);
  }
  const confirmados = [...porId.values()].filter(e => !duplicados.has(e.eventId) && !impedidos.has(e.eventId)
    && e.patientId === contexto.patientId && Date.parse(e.criadoEm) <= horizonte
    && ["CONFIRMADO", "ASSINADO"].includes(e.revisao)).sort(ordem);
  const materiais = new Map<string, FatoRetrato>();
  for (const e of confirmados) {
    const d = dados(e);
    if (!d) { diagnostico(e, "PAYLOAD_SEM_DADOS"); continue; }
    if (consulta(e)) continue;
    // Eventos de operação não são fatos clínicos. Campo clínico ou tipo material explícito.
    if (typeof d.campo !== "string" && !materiaisConhecidos.has(e.tipo)) continue;
    const alcance = escopo(e, d);
    if (alcance === "TUMOR" && e.tumorLotId !== contexto.tumorLotId) continue;
    const dataClinica = tempo(d, e);
    if (dataClinica && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(dataClinica)) {
      const instante = Date.parse(dataClinica.length === 10 ? `${dataClinica}T00:00:00-03:00` : dataClinica);
      if (!Number.isFinite(instante)) { diagnostico(e, "TEMPO_CLINICO_INVALIDO"); continue; }
      if (instante > horizonte) { diagnostico(e, "TEMPO_CLINICO_FUTURO"); continue; }
    }
    try {
      const ref = { eventId: e.eventId, revisao: hashCanonico(e) };
      materiais.set(e.eventId, { ref, tipo: e.tipo, campo: typeof d.campo === "string" ? d.campo : null,
        patientId: e.patientId, encounterId: e.encounterId, tumorLotId: e.tumorLotId, escopo: alcance,
        tempoClinico: dataClinica, tempoRegistro: e.criadoEm, fontes: structuredClone(e.fontes), dados: structuredClone(d) });
    } catch { diagnostico(e, "CONTEUDO_NAO_CANONICO"); }
  }
  const substituidos = new Map<string, ClinicalEvent>();
  for (const e of confirmados) {
    if (!e.supersedesEventId || !materiais.has(e.eventId)) continue;
    const anterior = porId.get(e.supersedesEventId), atual = materiais.get(e.eventId)!;
    const antigo = anterior ? materiais.get(anterior.eventId) : undefined;
    if (!anterior) { diagnostico(e, "SUPERSESSION_ALVO_AUSENTE"); continue; }
    if (!antigo || anterior.patientId !== e.patientId || anterior.tipo !== e.tipo || antigo.campo !== atual.campo
      || antigo.escopo !== atual.escopo || (atual.escopo === "TUMOR" && anterior.tumorLotId !== e.tumorLotId)
      || ordem(anterior, e) >= 0) { diagnostico(e, "SUPERSESSION_CONTEXTO_INVALIDO"); continue; }
    substituidos.set(anterior.eventId, e);
  }
  const fatos = [...materiais.values()].filter(f => !substituidos.has(f.ref.eventId))
    .sort((a, b) => (a.tempoClinico ?? "9999").localeCompare(b.tempoClinico ?? "9999")
      || a.tempoRegistro.localeCompare(b.tempoRegistro) || a.ref.eventId.localeCompare(b.ref.eventId));
  const marcoAtual = confirmados.filter(e => e.encounterId === contexto.encounterId && consulta(e)).at(-1);
  const inicioAtual = confirmados.filter(e => e.encounterId === contexto.encounterId).at(0);
  const limite = marcoAtual ?? inicioAtual;
  // A data de um exame importado não é a data da consulta aberta.
  const dataAtual = marcoAtual ? String(dados(marcoAtual)?.dataClinica)
    : inicioAtual ? new Date(Date.parse(inicioAtual.criadoEm) - 3 * 60 * 60 * 1000).toISOString().slice(0, 10) : null;
  const anterior = confirmados.filter(e => consulta(e) && e.encounterId !== contexto.encounterId
    && e.tumorLotId === contexto.tumorLotId && limite && ordem(e, limite) < 0
    && (!dataAtual || String(dados(e)?.dataClinica) < dataAtual))
    .sort((a, b) => String(dados(a)?.dataClinica).localeCompare(String(dados(b)?.dataClinica)) || ordem(a, b)).at(-1);
  const novos = anterior ? fatos.filter(f => Date.parse(f.tempoRegistro) > Date.parse(anterior.criadoEm)).map(f => f.ref) : [];
  const antigas = anterior ? [...substituidos.keys()].flatMap(id => {
    const antigo = materiais.get(id)!, novo = substituidos.get(id)!;
    return Date.parse(antigo.tempoRegistro) <= Date.parse(anterior.criadoEm) && Date.parse(novo.criadoEm) > Date.parse(anterior.criadoEm) ? [antigo.ref] : [];
  }) : [];
  const resumo = fatos.flatMap(f => {
    if (["DOCUMENTO", "SignedDocument", "DocumentSigned"].includes(f.tipo)) return [];
    if (!f.campo) {
      // Seleção declarada por tipo. Cada dado mantém estados e qualificadores literais.
      const camposPorTipo: Record<string, readonly string[]> = {
        Paciente: ["nome", "nascimento", "sexoCadastral"],
        TumorLot: ["cid", "topografia", "histologia", "estadiamentos"],
        Weight: ["pesoKg", "valor", "unidade", "origem"],
        ImagingReport: ["textoLaudo", "resumo", "achados"], Biopsy: ["histologia", "topografia", "resultado", "biomarcadores", "textoLaudo"],
        TreatmentEpisode: ["modalidade", "intencao", "linha", "esquemaId", "inicio", "fim"],
        Ciclo: ["numero", "previstoEm", "pesoKg", "origemPeso"], TreatmentCycle: ["numero", "dataClinica", "esquema"],
        LabResult: ["campo", "valor", "unidade", "data", "valores"],
        TreatmentAdministration: ["droga", "quantidadeEfetivaMg", "status", "motivo", "inicio", "fim"],
      };
      return (camposPorTipo[f.tipo] ?? []).flatMap(campo => !Object.hasOwn(f.dados, campo) || f.dados[campo] === null ? []
        : [{ texto: `${f.tipo}.${campo}: ${canonico(f.dados[campo])}.`, fatos: [f.ref] }]);
    }
    if (!Object.hasOwn(f.dados, "valor") || f.dados.valor === null) return [];
    const qualificadores = ["status", "certeza", "evidence", "provenance", "negado", "suspeita"].filter(k => Object.hasOwn(f.dados, k))
      .map(k => `${k}=${canonico(f.dados[k])}`).join(", ");
    // Renderização literal: confirmação documental não transforma uma suspeita em diagnóstico.
    return [{ texto: `${f.campo}: ${canonico(f.dados.valor)}${qualificadores ? ` (${qualificadores})` : ""}.`, fatos: [f.ref] }];
  });
  const conteudo = { schema: "Retrato@1" as const, patientId: contexto.patientId, encounterId: contexto.encounterId,
    tumorLotId: contexto.tumorLotId, versaoProjecao: "retrato-f1-v1", regras: [...contexto.regras].sort((a,b)=>a.id.localeCompare(b.id)||a.versao.localeCompare(b.versao)||a.hash.localeCompare(b.hash)),
    biblioteca: contexto.biblioteca, fatos, integridade: problemas.sort((a,b)=>a.eventoId.localeCompare(b.eventoId)||a.motivo.localeCompare(b.motivo)),
    delta: { encounterAnteriorId: anterior?.encounterId ?? null, novos, substituidos: antigas }, resumo };
  return Retrato.parse({ ...conteudo, revisao: hashCanonico(conteudo), geradoEm: contexto.agora });
}
