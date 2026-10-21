import type { DatabaseSync } from "node:sqlite";
import { Apac, type ClinicalEvent } from "../contracts/operacao.js";
import { apacTimeline } from "../kernel/projections/apacTimeline.js";
import { eventosVigentes } from "../kernel/projections/snapshot.js";
import { hashConteudoExibido as hash } from "./sessao.js";

export interface FalhaFonteApac { eventId:string; apacId:string; patientId:string|null; tumorLotId:string|null; codigo:string }
/** Current ledger versions plus verified external denials. Invalid evidence never becomes a new status. */
export function lerApacsVigentes(db: DatabaseSync, agora: string, eventos: readonly ClinicalEvent[],
  aoFalhar?: (falha:FalhaFonteApac)=>void) {
  const atuais = eventosVigentes(eventos.filter(e => ["CONFIRMADO", "ASSINADO"].includes(e.revisao)
    && Date.parse(e.criadoEm) <= Date.parse(agora)));
  type Negativa = { apacId: string; patientId: string; tumorLotId: string;
    comprovanteRef: string; apacNegadaJson: string; registradoEm: string };
  const negativas = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='f4_apac_retrograda'").get()
    ? db.prepare("SELECT apacId, patientId, tumorLotId, comprovanteRef, apacNegadaJson, registradoEm FROM f4_apac_retrograda").all() as Negativa[] : [];
  return apacTimeline(atuais).flatMap(original => {
    const event = atuais.find(e => e.eventId === original.eventId)!;
    const sinalizar=(codigo:string)=>aoFalhar?.({eventId:event.eventId,apacId:original.apacId,
      patientId:event.patientId,tumorLotId:event.tumorLotId,codigo});
    const invalida=()=>{sinalizar("NEGATIVA_F4_COM_INTEGRIDADE_PENDENTE");return [original];};
    if(original.tumorLotId!==event.tumorLotId){sinalizar("APAC_FORA_DO_ESCOPO_DO_EVENTO");return [];}
    const row = negativas.find(n => n.apacId === original.apacId && n.patientId === event.patientId
      && n.tumorLotId === original.tumorLotId);
    if (!row) return [original];
    try {
      const p = Apac.safeParse(JSON.parse(row.apacNegadaJson));
      if (!p.success) return invalida();
      const negada = p.data, recebido = negada.resultadoExterno, registrado = Date.parse(row.registradoEm);
      if (negada.apacId !== original.apacId || negada.tumorLotId !== original.tumorLotId) return invalida();
      // An older version or a future registration does not override the version at this horizon.
      if (negada.versao !== original.versao || registrado > Date.parse(agora)
        || Date.parse(event.criadoEm) > registrado) return [original];
      if (negada.estado !== "NEGADA" || recebido?.valor !== "NEGADA"
        || recebido.comprovanteRef !== row.comprovanteRef || !Number.isFinite(registrado)
        || Date.parse(recebido.recebidoEm) > registrado) return invalida();
      if (original.resultadoExterno && Date.parse(original.resultadoExterno.recebidoEm) >= Date.parse(recebido.recebidoEm))
        return [original];
      const { eventId, estado: _estado, resultadoExterno: _externo, ...conteudo } = original;
      const { estado: _negada, resultadoExterno: _resultado, ...conteudoNegado } = negada;
      return hash(conteudo) === hash(conteudoNegado) ? [{ ...negada, eventId }] : invalida();
    } catch { return invalida(); }
  });
}
