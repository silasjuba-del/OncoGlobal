import type { DatabaseSync } from "node:sqlite";
import { hashCanonico as hash } from "../../modules/hash.js";
import { transacao } from "../ledger/db.js";
import { Correlacao } from "../../contracts/f1/correlacao.js";
import { SetorClinico } from "../../contracts/f1/achadosSetor.js";
import { PrescricaoProposta } from "../../contracts/f1/prescricaoProposta.js";
import { VisaoIntegrada } from "../../contracts/f1/visaoIntegrada.js";
import { maestro } from "../../orchestration/maestro.js";
import { executarOrk } from "../../orchestration/ork.js";
import { avaliarLaboratorio, avaliarImagem, avaliarPatologia, avaliarComorbidades, avaliarInteracoes, avaliarToxicidades, avaliarTratamento, type OpcoesSetores } from "../../modules/setores/index.js";
import { reconciliar, type RegraCruzamento } from "../../modules/reconciliador/index.js";
import { aoCommitar } from "../ledger/writeRouter.js";
import { listarDrafts } from "../ledger/drafts.js";
import { lerLedgerIntegro } from "../ledger/leituraIntegra.js";
import { dadosDoEvento } from "../projections/snapshot.js";
import { auditar } from "../ledger/ledger.js";
import { projetarRetrato } from "../projections/retrato/index.js";
import { gravarEstimulo, listarExecucoesPendentes, registrarExecucao } from "./estimulos/gravar.js";
import type { EstimuloTecnico } from "../../contracts/f1/estimuloTecnico.js";

export interface ContextoMotor {patientId:string;encounterId:string;tumorLotId:string|null}
export interface ConfigMotor {
  regras:Correlacao["regras"];biblioteca:Correlacao["biblioteca"];
  opcoes?:OpcoesSetores;cruzamentos?:readonly RegraCruzamento[];
}
const setores = { LABORATORIO: avaliarLaboratorio, IMAGEM: avaliarImagem, PATOLOGIA: avaliarPatologia, COMORBIDADES: avaliarComorbidades, INTERACOES: avaliarInteracoes, TOXICIDADES: avaliarToxicidades, TRATAMENTO: avaliarTratamento };
type LeituraIntegra = ReturnType<typeof lerLedgerIntegro>;
/** Motor local: setores puros; nenhum efeito externo ou promoção clínica. */
export function criarMotorF1(db:DatabaseSync,agora:()=>string,config:()=>ConfigMotor) {
  let consumo:Promise<void>|null=null;
  aoCommitar(db,(req,eventos)=>{
    // Snapshot no instante do commit; processamento posterior não pode atribuir regras novas à assinatura antiga.
    const c=config();
    db.prepare('INSERT INTO confirmation_rules VALUES(?,?,?,?,?,?,?)').run(req.operationId,'F2-CONFIRMACAO@1',hash(c),JSON.stringify(c.regras),JSON.stringify(c.biblioteca),req.sessao.medicoId,req.em);
    const tipo=eventos.some(e=>e.tipo==="TreatmentAdministration")?"ADMINISTRACAO_REGISTRADA"
      :eventos.some(e=>dadosDoEvento(e)?.campo==="medicamentos")?"MED_RECONCILIADO":"FATO_CONFIRMADO";
    gravarEstimulo(db,{schema:"EstimuloTecnico@1",id:`op:${req.operationId}`,operationId:req.operationId,tipo,
      patientId:req.patientId,encounterId:req.encounterId,tumorLotId:req.tumorLotId,revisaoEntrada:hash(eventos),criadoEm:req.em,ator:"SISTEMA"});
  });
  function retrato(ctx:ContextoMotor, leituraInicial?:LeituraIntegra, c:ConfigMotor=config(), instante=agora()) {
    const leitura=leituraInicial??lerLedgerIntegro(db,ctx.patientId);
    return projetarRetrato(leitura.itens,{...ctx,agora:instante,regras:c.regras,biblioteca:c.biblioteca},leitura.pendenciasIntegridade.filter(p=>p.patientId===ctx.patientId).map(p=>({eventoId:p.eventoId,tipo:p.tipo,motivo:p.motivo})));
  }
  function propostas(ctx:ContextoMotor) {
    const candidatos=listarDrafts(db,ctx.patientId).flatMap(d=>{
      const p=PrescricaoProposta.safeParse(d.payload);
      return p.success&&p.data.correlacao.encounterId===ctx.encounterId&&p.data.correlacao.tumorLotId===ctx.tumorLotId ?[p.data]:[];
    });
    return candidatos;
  }
  function proposta(ctx:ContextoMotor){const candidatos=propostas(ctx);return candidatos.length===1?candidatos[0]:undefined;}
  const revisaoLedger = (ctx:ContextoMotor) => hash(db.prepare("SELECT count(*) AS n, max(rowid) AS ultimo FROM clinical_event WHERE patientId=?").get(ctx.patientId));
  // Only persisted evaluated contexts depend on a library; never enumerate unrelated patients.
  function distribuirBiblioteca(e:EstimuloTecnico):void {
    const c=config(),contexts=new Map<string,ContextoMotor>();
    const rows=db.prepare("SELECT conteudo FROM execucao_tecnica WHERE estado='PRONTO' ORDER BY rowid DESC").all();
    const vistos=new Set<string>();
    for(const row of rows) {
      const value=JSON.parse(String(row.conteudo)) as Record<string,unknown>;
      const v=VisaoIntegrada.safeParse(value.visaoIntegrada); if(!v.success)continue;
      const {patientId,encounterId,tumorLotId,biblioteca}=v.data.correlacao,ctx={patientId,encounterId,tumorLotId},key=hash(ctx);
      if(vistos.has(key))continue;vistos.add(key);
      if(hash(biblioteca)!==hash(c.biblioteca))contexts.set(key,ctx);
    }
    transacao(db,()=>{
      for(const [key,ctx] of contexts) {
        const id=`fanout:${hash([e.id,key,c.biblioteca])}`;
        gravarEstimulo(db,{...e,...ctx,id,operationId:e.operationId,revisaoEntrada:hash(c.biblioteca)});
      }
      registrarExecucao(db,e.id,"CONCLUIDO",{codigo:"BIBLIOTECA_DISTRIBUIDA",contextos:contexts.size},agora());
    });
  }
  async function executar(e:EstimuloTecnico, inicial?:{r:ReturnType<typeof retrato>;c:ConfigMotor;ledger?:string}):Promise<void> {
    registrarExecucao(db,e.id,"EM_CURSO",{estimuloId:e.id},agora());
    if(!e.patientId||!e.encounterId){distribuirBiblioteca(e);return;}
    try {
      const ctx={patientId:e.patientId,encounterId:e.encounterId,tumorLotId:e.tumorLotId},c=inicial?.c??config(),r=inicial?.r??retrato(ctx,undefined,c);
      const ledgerAntes=inicial?.ledger??revisaoLedger(ctx),configAntes=hash(c);
      if(propostas(ctx).length>1){registrarExecucao(db,e.id,"FALHOU",{codigo:"PROPOSTA_AMBIGUA"},agora());return;}
      const p=proposta(ctx),correlacao=Correlacao.parse({...ctx,operationId:e.operationId,revisaoFatos:r.revisao,
        regras:r.regras,biblioteca:r.biblioteca,proposta:p?{id:p.id,revisao:p.revisao}:null});
      const atual=p?{...p,correlacao}:undefined;
      const plano=maestro(e.tipo);if(!plano)throw new Error("EVENTO_SEM_PLANO");
      const agentes=Object.fromEntries(SetorClinico.options.map(setor=>[setor,async()=>{
        const op:OpcoesSetores={...c.opcoes,agora:r.geradoEm,hoje:new Date(Date.parse(r.geradoEm)-3*60*60*1000).toISOString().slice(0,10),...(atual?{proposta:atual}:{})};
        // Each sector sees an independent snapshot, never another sector's mutable state.
        return setores[setor](structuredClone(r),structuredClone(correlacao),op);
      }]));
      const run=await executarOrk(plano,{...agentes,RECONCILIADOR:async({resultados})=>reconciliar(resultados,r,correlacao,SetorClinico.options,c.cruzamentos??[])},
        {onTimeout:id=>registrarExecucao(db,e.id,"EM_CURSO",{codigo:"TIMEOUT",passo:id},agora()),
         aoDescartarTardio:id=>{try{auditar(db,{ator:{tipo:"SISTEMA",id:"ork-f1"},acaoPedida:`ORK:${id}`,decisao:"NEGADA",motivoCodigo:"RESULTADO_TARDIO_DESCARTADO",politicaVersao:"F1-S6",em:agora()});}catch{/* database may have closed */}}});
      const final=run.resultados.find(a=>a.id==="RECONCILIADOR"),v=final?.resultado==="ok"?VisaoIntegrada.safeParse(final.saida):null;
      // A revision changed while awaiting a provider cannot be published as current.
      if(!v?.success||run.estado!=="PRONTO"||revisaoLedger(ctx)!==ledgerAntes||hash(config())!==configAntes||hash(proposta(ctx))!==hash(p)){registrarExecucao(db,e.id,"FALHOU",{codigo:"VISAO_DESATUALIZADA_OU_INVALIDA"},agora());return;}
      registrarExecucao(db,e.id,"PRONTO",{retrato:r,visaoIntegrada:v.data},agora());
    }catch{registrarExecucao(db,e.id,"FALHOU",{codigo:"AVALIACAO_INDISPONIVEL"},agora());}
  }
  async function processar(iniciais?:Map<string,{r:ReturnType<typeof retrato>;c:ConfigMotor;ledger?:string}>):Promise<void> {
    if(consumo)return consumo;
    consumo=(async()=>{let fila=listarExecucoesPendentes(db);while(fila.length){for(const e of fila)await executar(e,iniciais?.get(e.id));fila=listarExecucoesPendentes(db);}})();
    try{await consumo;}finally{consumo=null;}
  }
  async function consultar(ctx:ContextoMotor, leituraInicial?:LeituraIntegra) {
    const c=config(),instante=agora(),r=retrato(ctx,leituraInicial,c,instante),p=proposta(ctx),ledgerAntes=revisaoLedger(ctx);
    if(propostas(ctx).length>1){
      const correlacao=Correlacao.parse({...ctx,operationId:`read:${hash([ctx,r.revisao,"PROPOSTA_AMBIGUA"])}`,revisaoFatos:r.revisao,regras:r.regras,biblioteca:r.biblioteca,proposta:null});
      return {retrato:r,visaoIntegrada:VisaoIntegrada.parse({schema:"VisaoIntegrada@1",correlacao,achados:[],lacunas:[{codigo:"PROPOSTA_AMBIGUA",texto:"Mais de uma proposta neste encontro: selecione uma revisão antes da avaliação.",setor:"TRATAMENTO",fatos:[]}],cobertura:{setoresEsperados:SetorClinico.options,setoresAvaliados:[],avaliados:0,semRegraAprovada:1}})};
    }
    // Exact evaluation instant: a result before a validity boundary never covers a later read.
    const chave=hash([ctx,r.revisao,p??null,c,instante]);
    if(!db.prepare("SELECT id FROM estimulo_tecnico WHERE id=?").get(`read:${chave}`))
      gravarEstimulo(db,{schema:"EstimuloTecnico@1",id:`read:${chave}`,operationId:`read:${chave}`,tipo:"FATO_VENCIDO",...ctx,revisaoEntrada:r.revisao,criadoEm:agora(),ator:"SISTEMA"});
    await processar(new Map([[`read:${chave}`,{r,c,ledger:ledgerAntes}]]));
    const rows=db.prepare("SELECT conteudo FROM execucao_tecnica WHERE runId=? AND estado='PRONTO' ORDER BY indice DESC").all(`read:${chave}`);
    for(const row of rows){const d=JSON.parse(String(row.conteudo)) as Record<string,unknown>,v=VisaoIntegrada.safeParse(d.visaoIntegrada);
      if(v.success&&v.data.correlacao.revisaoFatos===r.revisao&&hash(v.data.correlacao.biblioteca)===hash(c.biblioteca)&&hash(v.data.correlacao.regras)===hash(r.regras)&&revisaoLedger(ctx)===ledgerAntes&&hash(config())===hash(c)&&hash(proposta(ctx))===hash(p))return{retrato:r,visaoIntegrada:v.data};}
    return{retrato:r,visaoIntegrada:null};
  }
  return{processar,consultar,retrato};
}
