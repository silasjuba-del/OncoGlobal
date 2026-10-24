import {auditar, transacao} from "../kernel/comandos/portas.js";
import type { DatabaseSync } from "node:sqlite";
import { Alerta, type ClinicalEvent } from "../contracts/operacao.js";
import { Triagem } from "../contracts/clinico.js";
import { SalaoRuleset } from "../contracts/regras.js";
import { avaliarTriagem } from "../rules/triagem.js";
import { dadosDoEvento, eventosVigentes } from "../kernel/projections/snapshot.js";
import { hashConteudoExibido } from "./sessao.js";

type Contexto = { patientId: string; encounterId: string; tumorLotId: string | null };
/** Ciência só acompanha escrita nova; replay autentica e recupera a operação imutável. */
export function validarCienciaAlertas(atual: readonly Alerta[], exibidos: readonly string[], reconhecer: readonly string[]):
  "ALERTA_NAO_EXIBIDO_OU_ALTERADO" | "ALERTA_NOVO_NAO_EXIBIDO" | "CIENCIA_ALERTA_OBRIGATORIA" | null {
  if (new Set(reconhecer).size !== reconhecer.length
    || reconhecer.some(id => !exibidos.includes(id) || !atual.some(a => a.alertaId === id)))
    return "ALERTA_NAO_EXIBIDO_OU_ALTERADO";
  const pendentes = atual.filter(a => a.presentationOverride && !a.reconhecidoEm);
  if (pendentes.some(a => !exibidos.includes(a.alertaId))) return "ALERTA_NOVO_NAO_EXIBIDO";
  if (pendentes.some(a => !reconhecer.includes(a.alertaId))) return "CIENCIA_ALERTA_OBRIGATORIA";
  return null;
}
/** Somente eventos confirmados deste encontro; rascunhos nunca geram E1. */
export function projetarAlertasConsulta(db: DatabaseSync, eventos: readonly ClinicalEvent[], contexto: Contexto,
  hoje: string, agora: string, ruleset?: unknown): Alerta[] {
  const atuais = eventosVigentes(eventos.filter(e => e.patientId === contexto.patientId
    && e.encounterId === contexto.encounterId && (e.tumorLotId === null || e.tumorLotId === contexto.tumorLotId)
    && ["CONFIRMADO", "ASSINADO"].includes(e.revisao) && Date.parse(e.criadoEm) <= Date.parse(agora)));
  const alertas: Alerta[] = atuais.flatMap(e => {
    if (!/^Alerta(?:@1)?$/.test(e.tipo)) return [];
    const p = Alerta.safeParse(dadosDoEvento(e));
    if (!p.success || !("patientId" in p.data.alvo) || p.data.alvo.patientId !== contexto.patientId) return [];
    return [{...p.data, alertaId: `alerta-${hashConteudoExibido({eventId:e.eventId,alerta:p.data})}`, reconhecidoEm:null}];
  });
  const rs = SalaoRuleset.safeParse(ruleset);
  const triagens = atuais.filter(e => /^Triagem(?:@1)?$/.test(e.tipo)).flatMap(e => {
    const p=Triagem.safeParse(dadosDoEvento(e));return p.success && p.data.patientId===contexto.patientId
      && p.data.encounterId===contexto.encounterId ? [{evento:e,triagem:p.data}] : [];
  });
  if (rs.success && triagens.length === 1) {
    const {evento,triagem}=triagens[0]!;
    const r=avaliarTriagem(triagem,{hoje,prescricaoVigente:null,requisitosAplicaveis:["pas","fc","spo2","tempDecimos","hbDgDl","anc","plq","coletaHemograma","ecog","grauCtcae"]},rs.data);
    if(r.emergencia) alertas.push({alertaId:`e1-${hashConteudoExibido({eventId:evento.eventId,triagem,rs:rs.data})}`,
      alvo:{patientId:contexto.patientId},natureza:"AMEACA_IMEDIATA",classeRisco:null,
      texto:r.cortes.map(c=>c.texto).join("; ") || "Emergência sinalizada na triagem confirmada.",
      origemRegra:rs.data.header.id,evidencias:evento.fontes,presentationOverride:true,authorityOverride:false,
      reconhecidoEm:null,destino:"CHAT"});
  }
  if(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='alerta_reconhecimento'").get()) {
    for(const alerta of alertas){const row=db.prepare("SELECT reconhecidoEm FROM alerta_reconhecimento WHERE alertaId=? AND patientId=? AND encounterId=? AND tumorLotId=? ORDER BY reconhecidoEm DESC LIMIT 1")
      .get(alerta.alertaId,contexto.patientId,contexto.encounterId,contexto.tumorLotId??"") as {reconhecidoEm:string}|undefined;
      alerta.reconhecidoEm=row?.reconhecidoEm??null;}
  }
  return alertas;
}
export function registrarCienciaAlertas(db:DatabaseSync, contexto:Contexto, ids:readonly string[], medicoId:string, em:string, operationId:string):void {
  if(!ids.length)return;
  transacao(db,()=>{
  db.exec(`CREATE TABLE IF NOT EXISTS alerta_reconhecimento(operationId TEXT NOT NULL,alertaId TEXT NOT NULL,
    patientId TEXT NOT NULL,encounterId TEXT NOT NULL,tumorLotId TEXT NOT NULL,medicoId TEXT NOT NULL,reconhecidoEm TEXT NOT NULL,
    PRIMARY KEY(operationId,alertaId));
    CREATE TRIGGER IF NOT EXISTS alerta_reconhecimento_no_update BEFORE UPDATE ON alerta_reconhecimento
      BEGIN SELECT RAISE(ABORT, 'alerta_reconhecimento append-only'); END;
    CREATE TRIGGER IF NOT EXISTS alerta_reconhecimento_no_delete BEFORE DELETE ON alerta_reconhecimento
      BEGIN SELECT RAISE(ABORT, 'alerta_reconhecimento append-only'); END;`);
  const inserir=db.prepare("INSERT OR IGNORE INTO alerta_reconhecimento VALUES(?,?,?,?,?,?,?)");
  for(const id of new Set(ids)) {
    const r=inserir.run(operationId,id,contexto.patientId,contexto.encounterId,contexto.tumorLotId??"",medicoId,em);
    if(r.changes)auditar(db,{ator:{tipo:"SESSAO",id:medicoId},acaoPedida:`CIENCIA_ALERTA:${operationId}:${id}`,
      decisao:"PERMITIDA",motivoCodigo:"CIENCIA_EXPLICITA",politicaVersao:"F2-CIENCIA-ALERTA@1",em});
  }
  });
}
