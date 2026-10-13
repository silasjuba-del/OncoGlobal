import { expect, it } from 'vitest';
import { ClinicalEvent } from '../../../src/contracts/operacao.js';
import { DutosClinicaVisao } from '../../../src/contracts/api/dutos.js';
import { projetarDutos } from '../../../src/server/projecaoDutos.js';
import { hashCanonico } from '../../../src/rules/conteudoCanonico.js';
import { fonteSintetica } from '../../fixtures/triagem.js';
const contexto={patientId:'p',encounterId:'e',tumorLotId:'l'},em='2026-10-12T12:00:00Z';
const evento=(id:string,tipo:string,data:unknown,revisao:'CONFIRMADO'|'ASSINADO'|'RAW'='CONFIRMADO',overrides:Partial<ClinicalEvent>={})=>ClinicalEvent.parse({eventId:id,operationId:`op-${id}`,eventIndex:0,...contexto,tipo,payload:{reviewDecisionId:'review',data},fontes:[fonteSintetica(id)],revisao,criadoEm:em,criadoPor:{tipo:'SESSAO',id:'m'},supersedesEventId:null,...overrides});
function doc(version=1){const data={documentId:'rx',documentVersion:version,tipoDocumento:'PRESCRICAO_QT',texto:'Documento sintético'};return evento(`rx-${version}`,'DOCUMENTO',{data,signature:{documentId:'rx',documentVersion:version,documentHash:hashCanonico(data),reviewDecisionId:'review',serverActorId:'m'}},'ASSINADO');}
const ref={...contexto,documentId:'rx',documentVersion:1,documentHash:hashCanonico({documentId:'rx',documentVersion:1,tipoDocumento:'PRESCRICAO_QT',texto:'Documento sintético'}),revisao:'ASSINADO' as const};
it('projeção distingue ENVIADA, CONFERIDA e invalida conferência com nova versão da assinatura',()=>{
 const enviada=evento('envio','FATO',{campo:'farmacia.conferencia',valor:{prescricao:ref,estado:'ENVIADA',motivo:null,atorId:'m',em}});
 expect(projetarDutos([doc(),enviada],contexto).farmacia[0]).toMatchObject({referenciaValida:true,registro:{estado:'ENVIADA'}});
 const conferida=evento('conferida','FATO',{campo:'farmacia.conferencia',valor:{prescricao:ref,estado:'CONFERIDA',motivo:null,atorId:'m',em}},'CONFIRMADO',{supersedesEventId:'envio'});
 const visao=projetarDutos([doc(),enviada,conferida],contexto);expect(visao.farmacia).toHaveLength(1);expect(visao.farmacia[0]).toMatchObject({referenciaValida:true,registro:{estado:'CONFERIDA'}});
 expect(projetarDutos([doc(),doc(2),conferida],contexto).farmacia[0]?.referenciaValida).toBe(false);
});
it('recebimento da tarefa mantém CONFIRMADA; tarefa concluída substitui a anterior',()=>{
 const tarefa={tarefaId:'t',...contexto,operationId:'op',titulo:'Retorno sintético',responsavel:'m',prazo:null,estado:'CONFIRMADA',recebidoEm:em,criadoPor:'m',substituiTarefaId:null};
 const recebida=evento('recebida','Tarefa',tarefa),concluida=evento('concluida','Tarefa',{...tarefa,estado:'CONCLUIDA'},'CONFIRMADO',{supersedesEventId:'recebida'});
 expect(projetarDutos([recebida],contexto).tarefas[0]?.tarefa).toMatchObject({estado:'CONFIRMADA',recebidoEm:em});
 expect(projetarDutos([recebida,concluida],contexto).tarefas).toHaveLength(1);expect(projetarDutos([recebida,concluida],contexto).tarefas[0]?.tarefa.estado).toBe('CONCLUIDA');
});
it('administracao exibe somente quantidade observada confirmada; outro paciente/raw não entram',()=>{
 const admin={adminId:'a',cicloId:'c',prescricaoRef:{documentId:'rx',documentVersion:1},item:1,droga:'Droga Sintética',quantidadeEfetivaMg:25,status:'PARCIAL',motivo:'Interrupção sintética',inicio:em,fim:em,fonte:fonteSintetica('admin')};
 const v=projetarDutos([doc(),evento('admin','TreatmentAdministration',admin),evento('raw','TreatmentAdministration',{...admin,quantidadeEfetivaMg:999},'RAW'),evento('foreign','TreatmentAdministration',admin,'CONFIRMADO',{patientId:'outro'})],contexto);
 expect(v.administracoes).toHaveLength(1);expect(v.administracoes[0]?.dados.quantidadeEfetivaMg).toBe(25);
});
it('APAC sem confirmação de corpus/SIGTAP permanece PENDENTE; payload inválido gera lacuna',()=>{
 const apac={apacId:'ap',tumorLotId:'l',prescricaoAssinadaRef:{documentId:'rx',documentVersion:1},dataGeracaoApp:'2026-10-12',competencia:'2026-09',campos:{},estado:'RASCUNHO',resultadoExterno:null,versao:1,substituiApacId:null};
 const v=projetarDutos([doc(),evento('ap','APAC',apac),evento('corrompido','FATO',{campo:'farmacia.conferencia',valor:{estado:'CONFERIDA'}})],contexto);
 expect(v.apacs[0]?.estado).toBe('PENDENTE');expect(v.integridade).toEqual([{eventId:'corrompido',codigo:'CONFERENCIA_FORA_CONTRATO'}]);
});
it('schema strict rejeita estados inventados e referências de outro encontro',()=>{
 const v=projetarDutos([],contexto);
 expect(DutosClinicaVisao.safeParse({...v,atorId:'forjado'}).success).toBe(false);
 expect(DutosClinicaVisao.safeParse({...v,farmacia:[{eventId:'f',registro:{prescricao:{...ref,encounterId:'outro'},estado:'CONFERIDA',motivo:null,atorId:'m',em},referenciaValida:true,motivo:null}]}).success).toBe(false);
});
it('APAC somente aparece VALIDADA com hash, prescrição e SIGTAP atuais; tabela alterada invalida',async()=>{
 const {criarValidacaoPersistida}=await import('../../../src/modules/apac/validacaoPersistida.js');
 const {montarTabelaSigtap}=await import('../../../src/modules/apac/sigtap.js');
 const {referenciaSigtapDuto}=await import('../../../src/server/dutos.js');
 const corpus={sigtap:{'2026-09':montarTabelaSigtap('2026-09',[])},sigtapEstado:'FONTE_OFICIAL_CONFERIDA'} as unknown as import('../../../src/server/dutos.js').DepsDutos['corpus'];
 const apac={apacId:'ap',tumorLotId:'l',prescricaoAssinadaRef:{documentId:'rx',documentVersion:1},dataGeracaoApp:'2026-10-12',competencia:'2026-09',campos:{},estado:'RASCUNHO',resultadoExterno:null,versao:1,substituiApacId:null};
 const v=criarValidacaoPersistida({apac,prescricao:ref,sigtap:referenciaSigtapDuto(corpus,'2026-09'),antiglosa:{apacId:'ap',competencia:'2026-09',achados:[],exportavel:true}},{...contexto,atorId:'m',em});
 expect(v.ok).toBe(true);if(!v.ok)throw Error(v.codigo);
 const eventos=[doc(),evento('ap','APAC',apac),evento('val','FATO',{campo:'apac.validacaoEmissao',valor:v.validacao})];
 expect(projetarDutos(eventos,contexto,corpus).apacs[0]?.estado).toBe('VALIDADA');
 const alterado={...corpus,sigtap:{'2026-09':{competencia:'2026-09',procedimentos:{fixture:{codigo:'fixture'}}}}} as unknown as typeof corpus;
 expect(projetarDutos(eventos,contexto,alterado).apacs[0]?.estado).toBe('PENDENTE');
 expect(projetarDutos([...eventos,doc(2)],contexto,corpus).apacs[0]?.estado).toBe('PENDENTE');
});
