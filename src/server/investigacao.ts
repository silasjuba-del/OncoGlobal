import type { criarMotorF1 } from '../kernel/orquestracao/runtime.js';
import { Retrato } from '../contracts/f1/retrato.js';
import { Correlacao } from '../contracts/f1/correlacao.js';
import { ContextoDutosVisao } from '../contracts/api/dutos.js';
import { InvestigacaoConsultaVisao, PackInvestigacaoSchema } from '../contracts/api/investigacao.js';
import { avaliarInvestigacao, type PackRequisitos } from '../modules/investigacao/index.js';
import { hashCanonico } from '../rules/conteudoCanonico.js';
export interface DepsInvestigacao {
 motorF1?:Pick<ReturnType<typeof criarMotorF1>,'retrato'>;
 /** Somente config do servidor: deve selecionar pacote estruturado aprovado e versionado. */
 packInvestigacao?:(retrato:Retrato)=>unknown;
}
export function obterInvestigacao(deps:DepsInvestigacao,ctx:{patientId:string;encounterId:string;tumorLotId:string|null}):InvestigacaoConsultaVisao {
 const contexto=ContextoDutosVisao.parse(ctx),out:InvestigacaoConsultaVisao={codigo:'INVESTIGACAO_CARREGADA',schema:'InvestigacaoConsulta@1',contexto,revisao:null,estado:'PENDENTE',fatos:[],resultado:null,lacunas:[]};
 const pendente=(codigo:string,texto:string)=>{out.lacunas.push({codigo,texto,fatos:[]});return InvestigacaoConsultaVisao.parse(out);};
 if(!deps.motorF1)return pendente('RETRATO_INDISPONIVEL','Retrato confirmado indisponível para investigação.');
 let r:Retrato;
 try{r=Retrato.parse(deps.motorF1.retrato(contexto));}catch{return pendente('RETRATO_INDISPONIVEL','Retrato inválido ou indisponível para investigação.');}
 if(r.patientId!==ctx.patientId||r.encounterId!==ctx.encounterId||r.tumorLotId!==ctx.tumorLotId)return pendente('RETRATO_FORA_CONTEXTO','Retrato não corresponde à consulta selecionada.');
 out.revisao=r.revisao;out.fatos=r.fatos.map(f=>f.ref);
 if(!deps.packInvestigacao)return pendente('PACK_NAO_APROVADO','Nenhum pack estruturado aprovado e fixado na biblioteca ativa; exames não são inferidos de textos ou rascunhos.');
 let pack:unknown;
 try{pack=deps.packInvestigacao(structuredClone(r));}catch{return pendente('PACK_NAO_APROVADO','Fornecedor de pack aprovado indisponível.');}
 const p=PackInvestigacaoSchema.safeParse(pack);
 if(!p.success)return pendente('PACK_NAO_APROVADO','Pack sem estrutura, aprovação ou proveniência válidas.');
 const c=Correlacao.parse({...contexto,revisaoFatos:r.revisao,operationId:`investigacao:${hashCanonico([ctx,r.revisao,r.regras,r.biblioteca])}`,regras:r.regras,biblioteca:r.biblioteca,proposta:null});
 try{
  const packAprovado:PackRequisitos={referencia:p.data.referencia,status:p.data.status,fonte:p.data.fonte,requisitos:p.data.requisitos.map(({aplicabilidade:a,...req})=>({...req,...(a?{aplicabilidade:{...(a.tumor?{tumor:a.tumor}:{}),...(a.histologia?{histologia:a.histologia}:{}),...(a.estagio?{estagio:a.estagio}:{}),...(a.linha?{linha:a.linha}:{}),...(a.biomarcadores?{biomarcadores:a.biomarcadores}:{})}}:{})}))};
  const resultado=avaliarInvestigacao(r,c,packAprovado,{agora:r.geradoEm});
  out.resultado=resultado;out.estado=resultado.lacunas.length?'PENDENTE':'PRONTA';
  return InvestigacaoConsultaVisao.parse(out);
 }catch{return pendente('INVESTIGACAO_INVALIDA','Investigação pendente: correlação, requisitos ou referências inconsistentes.');}
}
