import type { DatabaseSync } from "node:sqlite";
import { Apac, type ClinicalEvent } from "../contracts/operacao.js";
import { apacTimeline } from "../kernel/projections/apacTimeline.js";
import { eventosVigentes } from "../kernel/projections/snapshot.js";
import { hashConteudoExibido as hash } from "./sessao.js";

/** Shared view: current ledger versions plus verified legacy external denials. */
export function lerApacsVigentes(db: DatabaseSync, agora: string, eventos: readonly ClinicalEvent[]) {
  const atuais = eventosVigentes(eventos.filter(e => ["CONFIRMADO", "ASSINADO"].includes(e.revisao)
    && Date.parse(e.criadoEm) <= Date.parse(agora)));
  type Negativa = { apacId: string; patientId: string; tumorLotId: string;
    comprovanteRef: string; apacNegadaJson: string; registradoEm: string };
  const negativas = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='f4_apac_retrograda'").get()
    ? db.prepare("SELECT apacId, patientId, tumorLotId, comprovanteRef, apacNegadaJson, registradoEm FROM f4_apac_retrograda").all() as Negativa[] : [];
  return apacTimeline(atuais).map(original => {
    const event = atuais.find(e => e.eventId === original.eventId)!;
    const row = negativas.find(n => n.apacId === original.apacId && n.patientId === event.patientId
      && n.tumorLotId === original.tumorLotId && n.tumorLotId === event.tumorLotId);
    if (!row) return original;
    try {
      const p = Apac.safeParse(JSON.parse(row.apacNegadaJson));
      if (!p.success) return original;
      const negada = p.data, recebido = negada.resultadoExterno, registrado = Date.parse(row.registradoEm);
      if (negada.apacId !== original.apacId || negada.tumorLotId !== original.tumorLotId
        || negada.versao !== original.versao || negada.estado !== "NEGADA" || recebido?.valor !== "NEGADA"
        || recebido.comprovanteRef !== row.comprovanteRef || !Number.isFinite(registrado)
        || registrado > Date.parse(agora) || Date.parse(recebido.recebidoEm) > registrado
        || Date.parse(event.criadoEm) > registrado) return original;
      if (original.resultadoExterno && Date.parse(original.resultadoExterno.recebidoEm) >= Date.parse(recebido.recebidoEm))
        return original;
      const { eventId, estado: _estado, resultadoExterno: _externo, ...conteudo } = original;
      const { estado: _negada, resultadoExterno: _resultado, ...conteudoNegado } = negada;
      return hash(conteudo) === hash(conteudoNegado) ? { ...negada, eventId } : original;
    } catch { return original; }
  });
}
