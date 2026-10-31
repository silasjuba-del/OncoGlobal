import { DataCivil, Instante } from "../../contracts/base.js";
import type { Retrato } from "../../contracts/f1/retrato.js";
import { FactQualifiers } from "../../contracts/w10/extracao.js";
import { montarFichaMinima } from "../../modules/consulta/revisaoClinica.js";
import { dataCivilDoServico } from "../../rules/tempoServico.js";

/** O qualificador canônico pode estar no envelope do evento ou dentro do valor. */
export function evidenciaBasalAfirmada(raw: unknown): boolean {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const d=raw as Record<string,unknown>;
  if (d.negado === true || d.negated === true || d.requiresConfirmation === true
    || ["INFERRED","UNCERTAIN"].includes(String(d.evidence))
    || ["PENDENTE", "SOLICITADO", "AGENDADO", "CANCELADO"].includes(String(d.estado))) return false;
  if (d.qualificadores !== undefined) {
    const q=FactQualifiers.safeParse(d.qualificadores);
    if(!q.success || q.data.polaridade!=="AFIRMADA" || q.data.sujeito!=="PACIENTE"
      || ["FUTURA","NAO_DETERMINADA"].includes(q.data.temporalidade)) return false;
  }
  return d.valor === undefined || evidenciaBasalAfirmada(d.valor);
}

/** Basal explicitamente atribuído ao episódio. Presença de arquivo não prova exame realizado. */
export function exameBasalDocumentado(raw: unknown, episodioId: string | null, limite: string): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || !episodioId || !evidenciaBasalAfirmada(raw)) return null;
  const d = raw as Record<string, unknown>;
  if (d.episodioId !== episodioId || !DataCivil.safeParse(d.data).success || String(d.data) > limite) return null;
  return d;
}

/** A altura usada na dose deve ser a documentada na mesma visão clínica, não um escalar sem data. */
export function alturaDocumentada(retrato: Retrato, agora: string): number | null {
  const altura = montarFichaMinima(retrato).find(c => c.id === "alturaCm");
  const hoje = dataCivilDoServico(agora);
  if (!altura || altura.estado !== "DOCUMENTADO" || typeof altura.valor !== "number" || hoje.estado !== "OK") return null;
  const limite = retrato.dataClinicaEncontro && retrato.dataClinicaEncontro < hoje.dataCivil
    ? retrato.dataClinicaEncontro : hoje.dataCivil;
  const dataSegura = (v: unknown): boolean => {
    if (DataCivil.safeParse(v).success) return String(v) <= limite;
    if (!Instante.safeParse(v).success) return false;
    const dia = dataCivilDoServico(String(v));
    return dia.estado === "OK" && dia.dataCivil <= limite && Date.parse(String(v)) <= Date.parse(agora);
  };
  const afirmativa = (v: unknown): boolean => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return true;
    const d = v as Record<string, unknown>;
    if (d.requiresConfirmation === true || d.negado === true || d.negated === true
      || ["INFERRED", "UNCERTAIN"].includes(String(d.evidence))) return false;
    if (d.qualificadores !== undefined) {
      const q = FactQualifiers.safeParse(d.qualificadores);
      if (!q.success || q.data.polaridade !== "AFIRMADA" || q.data.sujeito !== "PACIENTE" || q.data.temporalidade !== "ATUAL") return false;
    }
    if (["dataClinica", "factDate", "data", "date"].some(k => d[k] !== undefined && d[k] !== null && !dataSegura(d[k]))) return false;
    return afirmativa(d.valor);
  };
  if (!dataSegura(altura.data) || altura.fontes.some(f => f.dataClinica !== null && !dataSegura(f.dataClinica))
    || !altura.fatos.length || altura.fatos.some(ref => {
      const f = retrato.fatos.find(f => f.ref.eventId === ref.eventId && f.ref.revisao === ref.revisao);
      return !f || retrato.integridade.some(p => p.eventoId === ref.eventId) || !afirmativa(f.dados);
    })) return null;
  return altura.valor;
}
