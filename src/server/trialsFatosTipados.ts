import type { ClinicalEvent } from "../contracts/operacao.js";
import type { ContextoAcaoComposta } from "../contracts/api/acoesCompostas.js";
import type { Retrato, FatoRetrato } from "../contracts/f1/retrato.js";
import type { EvidenceRef, PatientFact } from "../contracts/pesquisa/tipos.js";
import { DataCivil } from "../contracts/base.js";
import { FactQualifiers } from "../contracts/w10/extracao.js";
import { validarPayloadEvento } from "../contracts/envelope.js";
import { montarFichaMinima } from "../modules/consulta/revisaoClinica.js";
import { dadosDoEvento } from "../kernel/projections/snapshot.js";
import { escopoDoEventoRetrato, hashCanonico, tempoClinicoDoEvento } from "../kernel/projections/retrato/index.js";
import { dataCivilDoServico } from "../rules/tempoServico.js";
import { hashConteudoExibido as hash } from "./sessao.js";

const objeto = (v: unknown): Record<string, unknown> | null =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null;
export const chaveTrial = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const tipos = new Set(["Triagem", "Triagem@1", "TumorLot", "TumorLot@1", "FATO", "FATO@1"]);
const campos = [
  { id: "ecog", aliases: ["ecog"], tipos: ["Triagem", "Triagem@1"] },
  { id: "cid", aliases: ["cid", "cid10"], tipos: ["TumorLot", "TumorLot@1"] },
  { id: "histologia", aliases: ["histologia", "extracao.histology"], tipos: ["TumorLot", "TumorLot@1"] },
] as const;
function diaDocumentado(valor: unknown): string | null {
  if (DataCivil.safeParse(valor).success) return valor as string;
  if (typeof valor !== "string") return null;
  const r = dataCivilDoServico(valor);
  return r.estado === "OK" ? r.dataCivil : null;
}
function subcampo(f: FatoRetrato, id: string, aliases: readonly string[]): Record<string, unknown> | null {
  return objeto(f.campo && aliases.includes(chaveTrial(f.campo)) ? f.dados.valor : f.dados[id]);
}
/** Horizonte do subcampo: a data da fonte externa não prevalece sobre a observação. */
function dataNoHorizonte(valor: unknown, limiteCivil: string, agora: string): boolean {
  if (valor === undefined || valor === null) return true;
  if (DataCivil.safeParse(valor).success) return (valor as string) <= limiteCivil;
  const dia = diaDocumentado(valor);
  return dia !== null && dia <= limiteCivil && Date.parse(String(valor)) <= Date.parse(agora);
}
function dentroDoHorizonte(f: FatoRetrato, spec: typeof campos[number], limiteCivil: string, agora: string): boolean {
  if (f.dados.observacaoDatada === true) return false;
  const w = subcampo(f, spec.id, spec.aliases);
  if (!w) return true;
  const datas: unknown[] = [w.data, ...(Array.isArray(w.fontes) ? w.fontes.map(v => objeto(v)?.dataClinica) : [])];
  return datas.every(d => dataNoHorizonte(d, limiteCivil, agora));
}

function materialIntegro(f: FatoRetrato, e: ClinicalEvent | undefined, contexto: ContextoAcaoComposta): boolean {
  if (!e) return false;
  const d = dadosDoEvento(e);
  const escopo = escopoDoEventoRetrato(e);
  return d !== null && f.ref.revisao === hashCanonico(e) && f.tipo === e.tipo
    && e.patientId === contexto.patientId && (escopo === "PACIENTE" || e.tumorLotId === contexto.tumorLotId)
    && f.escopo === escopo
    && f.patientId === e.patientId && f.encounterId === e.encounterId && f.tumorLotId === e.tumorLotId
    && f.tempoRegistro === e.criadoEm && f.tempoClinico === tempoClinicoDoEvento(e)
    && f.campo === (typeof d.campo === "string" ? d.campo : null)
    && hashCanonico(f.dados) === hashCanonico(d) && hashCanonico(f.fontes) === hashCanonico(e.fontes);
}

export function evidenciaEventoTrial(evento: ClinicalEvent): EvidenceRef {
  return { sourceId: evento.eventId, sourceRef: `ledger:${evento.eventId}`, locator: "payload.data",
    exactText: JSON.stringify(evento), contentHash: hash(evento) };
}
/** Não transforma qualificador documental, inclusive em Dado aninhado, em afirmação atual. */
export function afirmacaoAtualTrial(valor: unknown): boolean {
  const d = objeto(valor);
  if (!d) return true;
  if (d.requiresConfirmation === true || d.negado === true || d.negated === true
    || ["INFERRED", "UNCERTAIN"].includes(String(d.evidence))) return false;
  if (d.qualificadores !== undefined) {
    const q = FactQualifiers.safeParse(d.qualificadores);
    if (!q.success || q.data.polaridade !== "AFIRMADA" || q.data.sujeito !== "PACIENTE" || q.data.temporalidade !== "ATUAL") return false;
  }
  return !Object.hasOwn(d, "valor") || afirmacaoAtualTrial(d.valor);
}

export function adaptarFatosTipados(eventos: readonly ClinicalEvent[], contexto: ContextoAcaoComposta,
  agora: string, retrato?: Retrato): { fatos: PatientFact[]; substituidas: Set<string>; revisao: string | null } {
  const fatos: PatientFact[] = [], substituidas = new Set<string>();
  if (!retrato || retrato.patientId !== contexto.patientId || retrato.encounterId !== contexto.encounterId
    || retrato.tumorLotId !== contexto.tumorLotId) return { fatos, substituidas, revisao: null };
  const civil = dataCivilDoServico(agora);
  if (civil.estado !== "OK") return { fatos, substituidas, revisao: null };
  const porId = new Map(eventos.map(e => [e.eventId, e]));
  const materiais = retrato.fatos.filter(f => tipos.has(f.tipo));
  const { revisao, geradoEm: _geradoEm, ...conteudoRetrato } = retrato;
  if (hashCanonico(conteudoRetrato) !== revisao || retrato.fatos.some(f => !materialIntegro(f, porId.get(f.ref.eventId), contexto))) {
    // An inconsistent view cannot authorize a value or reopen a scalar-alias shortcut.
    for (const spec of campos) for (const alias of spec.aliases) {
      substituidas.add(chaveTrial(alias)); substituidas.add(chaveTrial(`${alias}.data`));
    }
    return { fatos, substituidas, revisao: null };
  }
  const limiteCivil = retrato.dataClinicaEncontro && retrato.dataClinicaEncontro < civil.dataCivil
    ? retrato.dataClinicaEncontro : civil.dataCivil;
  const problemas = new Set(retrato.integridade.map(p => p.eventoId));
  for (const spec of campos) {
    // A presença de um campo tipado, mesmo pendente, impede um atalho por alias escalar.
    if (!materiais.some(f => (spec.tipos as readonly string[]).includes(f.tipo) && Object.hasOwn(f.dados, spec.id))) continue;
    for (const alias of spec.aliases) { substituidas.add(chaveTrial(alias)); substituidas.add(chaveTrial(`${alias}.data`)); }
    const ficha = montarFichaMinima({ ...retrato,
      // ECOG é avaliação da consulta atual. Filtrar antes de comparar evita que
      // triagens históricas do mesmo dia contaminem ou apaguem a avaliação atual.
      fatos: materiais.filter(f => (spec.id !== "ecog" || f.encounterId === contexto.encounterId)
        && dentroDoHorizonte(f, spec, limiteCivil, agora)) });
    const campo = ficha.find(f => f.id === spec.id);
    if (!campo?.fatos.length) continue;
    const refs = [...new Set(campo.fatos.map(f => f.eventId))];
    const fontes = refs.flatMap(id => porId.has(id) ? [porId.get(id)!] : []);
    if (fontes.length !== refs.length || fontes.some(e => {
      const ref = campo.fatos.find(f => f.eventId === e.eventId)!;
      const d = dadosDoEvento(e);
      if (!d || problemas.has(e.eventId) || ref.revisao !== hashCanonico(e) || !tipos.has(e.tipo)
        || e.patientId !== contexto.patientId || !["CONFIRMADO", "ASSINADO"].includes(e.revisao)
        || Date.parse(e.criadoEm) > Date.parse(agora) || !validarPayloadEvento(e.tipo, d).ok) return true;
      if (["Triagem", "Triagem@1"].includes(e.tipo) && (d.patientId !== e.patientId || d.encounterId !== e.encounterId
        || e.encounterId !== contexto.encounterId)) return true;
      if (["TumorLot", "TumorLot@1"].includes(e.tipo) && (d.patientId !== e.patientId || d.tumorLotId !== e.tumorLotId)) return true;
      return !afirmacaoAtualTrial(d) || !afirmacaoAtualTrial(d[spec.id]);
    })) continue;
    // Fonte interna do Dado não pode esconder uma data futura sob a data do contêiner.
    if (campo.fontes.some(f => !dataNoHorizonte(f.dataClinica, limiteCivil, agora))) continue;
    if (!dataNoHorizonte(campo.data, limiteCivil, agora)) continue;
    const evidencias = fontes.map(evidenciaEventoTrial);
    if (campo.estado === "CONFLITANTE") {
      if (evidencias.length >= 2) fatos.push({ patientId: contexto.patientId, factKey: spec.id, status: "CONFLITO", sources: evidencias });
      // Um conflito dentro de um único Dado continua pendente; não fabricamos duas fontes.
      continue;
    }
    if (campo.estado !== "DOCUMENTADO" || typeof campo.valor !== "string" && typeof campo.valor !== "number"
      || spec.id === "ecog" && campo.data === null) continue;
    const source: EvidenceRef = evidencias.length === 1 ? evidencias[0]! : {
      sourceId: `retrato:${retrato.revisao}:${spec.id}`, sourceRef: `ledger:${refs.join(",")}`,
      locator: `ficha:${spec.id}`, exactText: JSON.stringify(evidencias), contentHash: hash(evidencias),
    };
    fatos.push({ patientId: contexto.patientId, factKey: spec.id, value: campo.valor, status: "CONFIRMADO", source });
    // Data de observação é um critério próprio: não inventa janela de validade do protocolo.
    const dia = diaDocumentado(campo.data);
    if (dia !== null)
      fatos.push({ patientId: contexto.patientId, factKey: `${spec.id}.data`, value: dia, status: "CONFIRMADO", source });
  }
  return { fatos, substituidas, revisao: retrato.revisao };
}
