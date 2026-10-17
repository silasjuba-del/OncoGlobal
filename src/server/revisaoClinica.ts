import { Retrato } from "../contracts/f1/retrato.js";
import { RevisaoClinicaResposta } from "../contracts/fase2/revisaoClinica.js";
import { montarFichaMinima, selecionarPack, packCorrespondeAoCid, cidsDaFicha } from "../modules/consulta/revisaoClinica.js";
import type { CatalogoTumorPacks } from "../kernel/corpus/tumorPacks.js";
import type { criarMotorF1 } from "../kernel/orquestracao/runtime.js";
import { obterInvestigacao } from "./investigacao.js";
import type { lerRecist } from './leituras.js';
import { RegistroEstadoDoenca } from '../contracts/fase2/estadoDoenca.js';
import { hashCanonico } from '../modules/hash.js';

/** Mantém cada registro e seus qualificadores; discordância não elege uma resposta. */
export function projetarRespostaPatologica(r:Retrato):RevisaoClinicaResposta['respostaTumoral']['patologica']{
  const registros=r.fatos.filter(f=>f.campo==='pcr'&&f.fontes.length&&f.dados.valor!==undefined).map(f=>{
    const qualificadores=Object.fromEntries(['negated','negado','evidence','requiresConfirmation']
      .filter(k=>f.dados[k]!==undefined).map(k=>[k,f.dados[k]])) as RevisaoClinicaResposta['respostaTumoral']['patologica'][number]['qualificadores'];
    const incerto=qualificadores.requiresConfirmation===true||(qualificadores.evidence!==undefined&&qualificadores.evidence!=='EXPLICIT');
    const negado=qualificadores.negated===true||qualificadores.negado===true;
    return {valor:f.dados.valor as RevisaoClinicaResposta['respostaTumoral']['patologica'][number]['valor'],data:f.tempoClinico,fato:f.ref,fontes:f.fontes,
      qualificadores,estado:incerto?'INCERTO' as const:negado?'NEGADO' as const:'DOCUMENTADO' as const,conflito:false};
  });
  for(const p of registros)p.conflito=new Set(registros.filter(o=>o.data===p.data).map(o=>hashCanonico({valor:o.valor,
    negado:o.qualificadores.negated===true||o.qualificadores.negado===true}))).size>1;
  return registros;
}

export async function obterRevisaoClinica(motor:Pick<ReturnType<typeof criarMotorF1>,"retrato"|"consultar">,catalogo:CatalogoTumorPacks,
  contexto:RevisaoClinicaResposta["contexto"],packId?:string,recist?:()=>ReturnType<typeof lerRecist>):Promise<RevisaoClinicaResposta> {
  const avaliacao=await motor.consultar(contexto),r=Retrato.parse(avaliacao.retrato);
  if(r.patientId!==contexto.patientId||r.encounterId!==contexto.encounterId||r.tumorLotId!==contexto.tumorLotId)throw Error("RETRATO_FORA_CONTEXTO");
  if(motor.retrato(contexto).revisao!==r.revisao)throw Error("RETRATO_ALTERADO");
  const ficha=montarFichaMinima(r),pack=packId?catalogo.packs.find(p=>p.referencia.id===packId)??null:selecionarPack(r,catalogo.packs);
  const pendencias=catalogo.rejeitados.map(p=>`${p.arquivo}: ${p.motivo}`);
  if(!pack)pendencias.push("Pack específico não selecionado ou CID ausente/conflitante.");
  const preQt=ficha.filter(f=>!["ecog","kps"].includes(f.id)&&!["DOCUMENTADO","CALCULADO"].includes(f.estado)).map(f=>`${f.rotulo}: ${f.motivo}`);
  if(!ficha.some(f=>["ecog","kps"].includes(f.id)&&f.estado==="DOCUMENTADO"))preQt.push("Performance: ECOG/KPS documentado não disponível.");
  if(!pack||pack.estado!=="ATIVO")preQt.push("Pack sem requisitos clinicamente conferidos e ativos.");
  if(pack&&!packCorrespondeAoCid(pack,cidsDaFicha(ficha)))preQt.push("Pack consultado não corresponde ao CID confirmado.");
  const v=avaliacao.visaoIntegrada;
  if(!v||v.correlacao.revisaoFatos!==r.revisao||v.correlacao.patientId!==r.patientId||v.correlacao.encounterId!==r.encounterId||v.correlacao.tumorLotId!==r.tumorLotId)
    preQt.push("Avaliação integrada indisponível ou desatualizada.");
  else{
    preQt.push(...v.lacunas.map(l=>`${l.setor}: ${l.texto}`),...v.achados.filter(a=>a.estado!=="VERDE").map(a=>a.texto));
    if(!v.cobertura.avaliados||v.cobertura.semRegraAprovada||v.cobertura.setoresAvaliados.length!==v.cobertura.setoresEsperados.length)
      preQt.push("Cobertura de regras clínicas incompleta; conferir biomarcadores, função orgânica e esquema.");
  }
  if(pack?.estado==="ATIVO"&&packCorrespondeAoCid(pack,cidsDaFicha(ficha))){
    const i=obterInvestigacao({motorF1:{retrato:()=>r},packInvestigacao:()=>({referencia:pack.referencia,status:"CONFERIDA_MEDICO",
      fonte:pack.original.arquivo,requisitos:pack.requisitos})},contexto);
    preQt.push(...i.lacunas.map(l=>l.texto),...(i.resultado?.lacunas.map(l=>l.texto)??[]),
      ...(i.resultado?.requisitos.filter(req=>!["confirmado","naoAplicavel"].includes(req.classificacao)).map(req=>`${req.exameCodigo}: ${req.classificacao}`)??[]));
  }
  const resposta=recist?.();
  const estadosDoenca:RevisaoClinicaResposta["estadosDoenca"]=r.fatos.filter(f=>f.campo?.startsWith("doenca.estado:")).flatMap(f=>{
    const p=RegistroEstadoDoenca.safeParse(f.dados.valor);
    if(!p.success||!f.fontes.length||f.campo!==`doenca.estado:${p.data.data}`){pendencias.push("Registro de estado da doença sem contrato/fonte íntegros.");return[];}
    return [{...p.data,fato:f.ref,fontes:f.fontes,conflito:false}];
  }).sort((a,b)=>a.data.localeCompare(b.data)||a.fato.eventId.localeCompare(b.fato.eventId));
  for(const e of estadosDoenca)e.conflito=new Set(estadosDoenca.filter(o=>o.data===e.data).map(o=>o.estado)).size>1;
  const respostaTumoral:RevisaoClinicaResposta["respostaTumoral"]={criterio:"RECIST_1_1",aplicabilidade:"CONFERIR_CRITERIO_DO_TUMOR",
    series:resposta?.series.map(s=>({eventId:s.eventId,episodioId:s.episodioId,tumorLotId:s.tumorLotId,
      avaliacoes:s.resultado?.pontos.flatMap(p=>p.avaliacao?[p.avaliacao]:[])??[],
      pendencias:s.resultado?[...s.resultado.pendencias]:["ESCOPO_OU_PROVENIENCIA_INVALIDA"]}))??[],
    patologica:projetarRespostaPatologica(r),
    pendencias:resposta?.estado==="PARCIAL"?[]:["Série RECIST confirmada com medidas e fontes não disponível."]};
  return RevisaoClinicaResposta.parse({codigo:"REVISAO_CLINICA_CARREGADA",contexto,revisao:r.revisao,ficha,
    preQt:{estado:preQt.length?"PENDENTE":"AGUARDA_DECISAO_MEDICA",autorizaTratamento:false,pendencias:preQt},
    packs:catalogo.packs.map(p=>({id:p.referencia.id,titulo:p.titulo,estado:p.estado,cids:p.cids})),pack,pendencias,respostaTumoral,estadosDoenca});
}
