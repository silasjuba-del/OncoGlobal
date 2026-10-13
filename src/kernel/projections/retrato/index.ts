import { createHash } from "node:crypto";
import { DataCivil, Instante } from "../../../contracts/base.js";
import { validarPayloadEvento } from "../../../contracts/envelope.js";
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
  return ["ConsultaConfirmada", "ConsultaConfirmada@1"].includes(e.tipo) && validarPayloadEvento(e.tipo, dados(e)).ok;
}
const diaClinico = (instante: number) => new Date(instante - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

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
  // A agenda ancora somente o dia civil, nunca assinatura ou horário de conclusão.
  // Sem marco verificável, permanece o horizonte legado de registro/data clínica.
  const marcos = new Map<string, { consultas: ClinicalEvent[]; agendas: ClinicalEvent[] }>();
  for (const e of confirmados) {
    const ehConsulta = ["ConsultaConfirmada", "ConsultaConfirmada@1"].includes(e.tipo);
    if (!ehConsulta && !["AgendaEntry", "AgendaEntry@1"].includes(e.tipo)) continue;
    const encontro = marcos.get(e.encounterId) ?? { consultas: [], agendas: [] };
    encontro[ehConsulta ? "consultas" : "agendas"].push(e);
    marcos.set(e.encounterId, encontro);
  }
  const datasEncontros = new Map<string, string>();
  const encontrosIndeterminados = new Set<string>();
  for (const [encounterId, encontro] of marcos) {
    const candidatos = encontro.consultas.length ? encontro.consultas : encontro.agendas;
    const datas = new Set<string>();
    for (const e of candidatos) {
      const d = dados(e), data = d?.[encontro.consultas.length ? "dataClinica" : "data"];
      const motivo = !DataCivil.safeParse(data).success ? "DATA_ENCONTRO_INVALIDA"
        : !validarPayloadEvento(e.tipo, d).ok ? "MARCO_ENCONTRO_INVALIDO"
        : !encontro.consultas.length && (d?.patientId !== e.patientId || d?.encounterId !== e.encounterId)
          ? "CONTEXTO_ENCONTRO_DIVERGENTE" : null;
      if (motivo) { diagnostico(e, motivo); encontrosIndeterminados.add(encounterId); }
      else datas.add(data as string);
    }
    if (datas.size > 1) {
      candidatos.forEach(e => diagnostico(e, "DATA_ENCONTRO_AMBIGUA"));
      encontrosIndeterminados.add(encounterId);
    }
    if (!encontrosIndeterminados.has(encounterId) && datas.size === 1) datasEncontros.set(encounterId, [...datas][0]!);
  }
  const dataEncontroAtual = datasEncontros.get(contexto.encounterId);
  const materiais = new Map<string, FatoRetrato>();
  for (const e of confirmados) {
    const d = dados(e);
    if (!d) { diagnostico(e, "PAYLOAD_SEM_DADOS"); continue; }
    if (consulta(e)) continue;
    // Eventos de operação não são fatos clínicos. Campo clínico ou tipo material explícito.
    if (typeof d.campo !== "string" && !materiaisConhecidos.has(e.tipo)) continue;
    if (encontrosIndeterminados.has(contexto.encounterId) || encontrosIndeterminados.has(e.encounterId)) continue;
    const dataOrigem = datasEncontros.get(e.encounterId);
    if (dataEncontroAtual && dataOrigem && dataOrigem > dataEncontroAtual) continue;
    const alcance = escopo(e, d);
    if (alcance === "TUMOR" && e.tumorLotId !== contexto.tumorLotId) continue;
    const dataClinica = tempo(d, e);
    if (dataClinica && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(dataClinica)) {
      const civil = dataClinica.length === 10;
      if (!(civil ? DataCivil : Instante).safeParse(dataClinica).success) { diagnostico(e, "TEMPO_CLINICO_INVALIDO"); continue; }
      const dia = civil ? dataClinica : diaClinico(Date.parse(dataClinica));
      if (civil ? dia > diaClinico(horizonte) : Date.parse(dataClinica) > horizonte) { diagnostico(e, "TEMPO_CLINICO_FUTURO"); continue; }
      if (dataEncontroAtual && dia > dataEncontroAtual) continue;
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
  const marcoAtual = confirmados.filter(e => e.encounterId === contexto.encounterId && consulta(e)
    && !encontrosIndeterminados.has(e.encounterId)).at(-1);
  const inicioAtual = confirmados.filter(e => e.encounterId === contexto.encounterId).at(0);
  const limite = marcoAtual ?? inicioAtual;
  // A data de um exame importado não é a data da consulta aberta.
  // Sem âncora, o fallback de registro permanece exclusivo do delta legado.
  const dataAtual = dataEncontroAtual ?? (inicioAtual ? diaClinico(Date.parse(inicioAtual.criadoEm)) : null);
  const anterior = confirmados.filter(e => consulta(e) && e.encounterId !== contexto.encounterId
    && !encontrosIndeterminados.has(contexto.encounterId) && !encontrosIndeterminados.has(e.encounterId)
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
