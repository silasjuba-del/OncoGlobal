import type { ClinicalEvent } from "../../contracts/operacao.js";
import type { ContextoTriagem } from "../../contracts/regras.js";
import { Ciclo, TreatmentEpisode } from "../../contracts/clinico.js";
import { dadosDoEvento, eventosVigentes } from "../../kernel/projections/snapshot.js";
import { labSeries } from "../../kernel/projections/series.js";
import { dataCivilDoServico } from "../../kernel/gateway/tempo.js";
import { avaliarValidadeExame } from "../../rules/f0c/clinica.js";
import { hashConteudoExibido } from "../sessao.js";

/** D-F0C-07 · Dr. Silas, 2026-10-10: prazo do salão = 21 dias contados da assinatura.
 * O dia civil da assinatura entra. Quando os dias decorridos chegam a 21, deixa de valer.
 * Não cobre prazo próprio de ficha de droga: esse contrato ainda não existe no documento. */
export const PRAZO_PRESCRICAO_SALAO_DIAS = 21;

const objeto = (v: unknown): Record<string, unknown> | null => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null;
const nome = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
export interface EntradaFontesSalao { eventos: readonly ClinicalEvent[]; patientId: string; encounterId: string; hoje: string; agora: string }
export interface FontesSalao {
  creatininaCentesimos: number | null; pad: number | null; prescricaoVigente: ContextoTriagem["prescricaoVigente"]; avisos: string[];
  creatininaObservada?: {valor: number; unidade: string; data: string; sourceId: string};
  fontes: { creatinina: string[]; pad: string[]; prescricao: string[] };
}
/** Projeção pura; avisos não decidem atendimento nem tornam exames ausentes uma trava universal. */
export function coletarFontesSalao(i: EntradaFontesSalao): FontesSalao {
  const saida: FontesSalao = {creatininaCentesimos:null,pad:null,prescricaoVigente:null,avisos:[],fontes:{creatinina:[],pad:[],prescricao:[]}};
  const agora = Date.parse(i.agora);
  if(!Number.isFinite(agora)) { saida.avisos.push("HORARIO_ATUAL_INVALIDO"); return saida; }
  const eventos = eventosVigentes(i.eventos.filter(e=>e.patientId===i.patientId && Date.parse(e.criadoEm)<=agora));
  const labs = labSeries(eventos).filter(p=>["cr","creat","creatinina"].includes(nome(p.campo)));
  const semData = labs.some(p=>!Number.isFinite(Date.parse(p.data)));
  const candidatos=labs.filter(p=>Number.isFinite(Date.parse(p.data)) && p.data.slice(0,10)<=i.hoje && Date.parse(p.data)<=agora)
    .sort((a,b)=>Date.parse(b.data)-Date.parse(a.data));
  const ultimo=candidatos[0];
  if(semData) saida.avisos.push("CREATININA_COM_DATA_INVALIDA");
  if(!ultimo) saida.avisos.push("CREATININA_AUSENTE_OU_DATA_FUTURA");
  else {
    const empatados=candidatos.filter(p=>Date.parse(p.data)===Date.parse(ultimo.data));
    saida.fontes.creatinina=empatados.map(p=>p.eventId);
    saida.creatininaObservada={valor:ultimo.valor,unidade:ultimo.unidade,data:ultimo.data,sourceId:ultimo.sourceId};
    const conflito=new Set(empatados.map(p=>JSON.stringify([p.valor,p.unidade]))).size>1;
    const fonte=empatados.every(p=>p.sourceId.trim() && eventos.find(e=>e.eventId===p.eventId)?.fontes.some(f=>f.sourceId===p.sourceId));
    const valido=Number.isFinite(ultimo.valor) && ultimo.valor>0 && Number.isSafeInteger(Math.round(ultimo.valor*100)) && ultimo.unidade==="mg/dL";
    const validade=avaliarValidadeExame("BIOQUIMICA",ultimo.data,i.agora);
    if(conflito) saida.avisos.push("CREATININA_CONFLITANTE_NA_MESMA_COLETA");
    else if(!fonte || !valido) saida.avisos.push("CREATININA_VALOR_UNIDADE_OU_FONTE_INVALIDOS");
    else if(validade.estado==="VENCIDO") saida.avisos.push("CREATININA_VENCIDA");
    else if(validade.estado==="PENDENTE") saida.avisos.push(`CREATININA_VALIDADE_PENDENTE:${validade.motivo}`);
    else {
      saida.creatininaCentesimos=Math.round(ultimo.valor*100);
    }
  }
  const pads=eventos.filter(e=>e.encounterId===i.encounterId && e.tipo==="FATO" && nome(String(dadosDoEvento(e)?.campo))==="pad");
  saida.fontes.pad=pads.map(e=>e.eventId);
  const valores=pads.map(e=>dadosDoEvento(e)?.valor);
  if(!pads.length) saida.avisos.push("PAD_AUSENTE");
  else if(pads.some(e=>!e.fontes.length) || valores.some(v=>typeof v!=="number" || !Number.isInteger(v) || v<=0)
    || new Set(valores).size!==1) saida.avisos.push("PAD_INVALIDA_OU_CONFLITANTE");
  else saida.pad=valores[0] as number;

  const ciclos=eventos.filter(e=>e.encounterId===i.encounterId && e.tipo==="Ciclo").flatMap(e=>{
    const p=Ciclo.safeParse(dadosDoEvento(e)); return p.success ? [{evento:e,ciclo:p.data}] : [];
  });
  if(ciclos.length!==1) { saida.avisos.push("PRESCRICAO_CICLO_AUSENTE_OU_AMBIGUO"); return saida; }
  const {evento:ce,ciclo}=ciclos[0]!;
  const episodios=eventos.filter(e=>e.tipo==="TreatmentEpisode" && e.tumorLotId===ce.tumorLotId).flatMap(e=>{
    const p=TreatmentEpisode.safeParse(dadosDoEvento(e)); return p.success && p.data.episodioId===ciclo.episodioId && p.data.tumorLotId===ce.tumorLotId ? [p.data] : [];
  });
  if(!ciclo.prescricaoRef || episodios.length!==1) { saida.avisos.push("PRESCRICAO_REFERENCIA_OU_EPISODIO_PENDENTE"); return saida; }
  const docs=eventos.filter(e=>e.tipo==="DOCUMENTO" && e.revisao==="ASSINADO" && e.tumorLotId===ce.tumorLotId).filter(e=>{
    const d=objeto(dadosDoEvento(e)?.data); return d?.documentId===ciclo.prescricaoRef!.documentId && d.documentVersion===ciclo.prescricaoRef!.documentVersion;
  });
  saida.fontes.prescricao=docs.map(e=>e.eventId);
  if(docs.length!==1) { saida.avisos.push("PRESCRICAO_ASSINADA_AUSENTE_OU_AMBIGUA"); return saida; }
  const documento=docs[0]!, envelope=dadosDoEvento(documento)!, corpo=objeto(envelope.data)!, assinatura=objeto(envelope.signature), contexto=objeto(corpo.contexto);
  if(!assinatura || assinatura.documentId!==corpo.documentId || assinatura.documentVersion!==corpo.documentVersion
    || assinatura.serverActorId!==documento.criadoPor.id || documento.criadoPor.tipo!=="SESSAO"
    || assinatura.documentHash!==hashConteudoExibido(corpo) || !contexto
    || contexto.patientId!==i.patientId || contexto.tumorLotId!==ce.tumorLotId || contexto.episodioId!==ciclo.episodioId) {
    saida.avisos.push("PRESCRICAO_INTEGRIDADE_OU_CONTEXTO_PENDENTE"); return saida;
  }
  // ClinicalOrder e Ciclo não persistem prazo. Campo livre no texto não constitui contrato.
  // D-F0C-07: 21 dias civis a partir do instante do DOCUMENTO assinado. ciclosCobertos=1
  // registra o único ciclo ligado por prescricaoRef, não uma cobertura de ciclos futuros.
  const fuso = fusoDoInstante(i.agora);
  const assinadaEm = fuso ? dataCivilDoServico(documento.criadoEm, fuso) : { estado: "PENDENTE" as const, codigo: "FUSO_INVALIDO" as const };
  if (assinadaEm.estado !== "OK") { saida.avisos.push("PRESCRICAO_ASSINATURA_SEM_DATA_CIVIL"); return saida; }
  if (Date.parse(documento.criadoEm) > agora || assinadaEm.dataCivil > i.hoje) {
    saida.avisos.push("PRESCRICAO_ASSINATURA_FUTURA"); return saida;
  }
  const validaAte = somarDiasCivis(assinadaEm.dataCivil, PRAZO_PRESCRICAO_SALAO_DIAS - 1);
  if (validaAte < i.hoje) { saida.avisos.push("PRESCRICAO_FORA_DO_PRAZO"); return saida; }
  saida.prescricaoVigente = { documentId: String(corpo.documentId), ciclosCobertos: 1, validaAte };
  return saida;
}

function fusoDoInstante(instante: string): string | null {
  const marca = /(?:Z|[+-]\d{2}:\d{2})$/i.exec(instante);
  if (!marca) return null;
  return marca[0]!.toUpperCase() === "Z" ? "+00:00" : marca[0]!;
}

function somarDiasCivis(iso: string, dias: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error("DATA_INVALIDA");
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + dias));
  const mes = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(dt.getUTCDate()).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${mes}-${dia}`;
}

