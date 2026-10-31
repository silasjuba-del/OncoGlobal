// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {PainelSkillsClinicas} from '../../src/ui/consulta/PainelSkillsClinicas.js';
import {criarPortaFalsa} from '../../src/ui/api/fake.js';
import {ResultadoSkillClinica,type PedidoSkillClinica} from '../../src/contracts/skillsClinicas.js';
afterEach(cleanup);
const contexto={patientId:'paciente-sintetico',encounterId:'consulta-sintetica',tumorLotId:null};
const catalogo:ResultadoSkillClinica={codigo:'SKILLS_DISPONIVEIS',skills:[],pacotesExternos:'ADAPTADOR_DE_ADMISSAO_NAO_CONFIGURADO',corpus:null};
const fontes:ResultadoSkillClinica={codigo:'SKILL_FONTES',fontes:[{draftId:'draft-sintetico',sourceId:'Laudo sintético',revision:3}]};
const hist:ResultadoSkillClinica={codigo:'SKILLS_HISTORICO',execucoes:[],temMais:false};
function preparada():ResultadoSkillClinica {
 return ResultadoSkillClinica.parse({codigo:'SKILL_PREPARADA',validade:'ATUAL',criaEventoClinico:false,
  execucao:{kind:'SKILL_EXECUCAO_RASCUNHO',execucaoId:'exec-sintetica',contexto,skillId:'retorno',versao:'1.0.0',mecanismo:'COMPOSICAO_LOCAL_DETERMINISTICA',
   operationId:'operacao-sintetica',inputHash:'a'.repeat(64),cadastroHash:'b'.repeat(64),criadoEm:'2026-10-30T12:00:00Z',medicoId:'medico-sintetico',
   configuracao:{},fontes:[],evidencias:[],documentos:[],pendencias:[],estado:'RASCUNHOS_PREPARADOS',criaEventoClinico:false,assinaDocumentos:false},
  documentos:[]});
}
it('só executa após ação, envia revisões e não chama assinatura; retorno admite ledger sem laudo novo',async()=>{
 const call=vi.fn(async(p:PedidoSkillClinica):Promise<ResultadoSkillClinica>=>p.acao==='CATALOGO'?catalogo:p.acao==='FONTES'?fontes:p.acao==='HISTORICO'?hist:preparada());
 const porta={...criarPortaFalsa(),skillsClinicas:call};const confirmar=vi.spyOn(porta,'confirmar');
 render(<PainelSkillsClinicas porta={porta} contexto={contexto}/>);
 expect(call).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Jornada por skills'}));
 fireEvent.click(await screen.findByRole('checkbox',{name:/Laudo sintético/}));
 await waitFor(()=>expect((screen.getByRole('button',{name:'Preparar rascunhos da jornada'}) as HTMLButtonElement).disabled).toBe(false));
 fireEvent.change(screen.getByRole('combobox',{name:'Tipo de jornada'}),{target:{value:'retorno'}});
 fireEvent.click(screen.getByRole('button',{name:'Preparar rascunhos da jornada'}));
 await screen.findByText('Rascunhos preparados — revisão médica pendente.');
 expect(call.mock.calls.some(([p])=>p.acao==='EXECUTAR'&&p.skillId==='retorno'&&p.fontes[0]?.expectedRevision===3)).toBe(true);
 expect(confirmar).not.toHaveBeenCalled();
});
it('resposta atrasada não aparece após mudar paciente',async()=>{
 let resolver!:(r:ResultadoSkillClinica)=>void;
 const call=vi.fn(async(p:PedidoSkillClinica):Promise<ResultadoSkillClinica>=>p.acao==='CATALOGO'?catalogo:p.acao==='FONTES'?fontes:p.acao==='HISTORICO'?hist:new Promise(resolve=>{resolver=resolve;}));
 const porta={...criarPortaFalsa(),skillsClinicas:call};
 const view=render(<PainelSkillsClinicas porta={porta} contexto={contexto}/>);
 fireEvent.click(screen.getByRole('button',{name:'Jornada por skills'}));fireEvent.click(await screen.findByRole('checkbox',{name:/Laudo sintético/}));
 await waitFor(()=>expect((screen.getByRole('button',{name:'Preparar rascunhos da jornada'}) as HTMLButtonElement).disabled).toBe(false));
 fireEvent.click(screen.getByRole('button',{name:'Preparar rascunhos da jornada'}));
 view.rerender(<PainelSkillsClinicas porta={porta} contexto={{...contexto,patientId:'outro-sintetico'}}/>);
 resolver(preparada());await screen.findByRole('checkbox',{name:/Laudo sintético/});
 expect(screen.queryByText('Rascunhos preparados — revisão médica pendente.')).toBeNull();
});
it('resposta de outro paciente é recusada mesmo sem mudar a consulta na tela',async()=>{
 const call=vi.fn(async(p:PedidoSkillClinica):Promise<ResultadoSkillClinica>=>{
  if(p.acao==='CATALOGO')return catalogo;if(p.acao==='FONTES')return fontes;if(p.acao==='HISTORICO')return hist;
  const r=preparada();if(r.codigo==='SKILL_PREPARADA')r.execucao.contexto.patientId='outro-paciente-sintetico';return r;
 });
 render(<PainelSkillsClinicas porta={{...criarPortaFalsa(),skillsClinicas:call}} contexto={contexto}/>);
 fireEvent.click(screen.getByRole('button',{name:'Jornada por skills'}));await screen.findByRole('checkbox',{name:/Laudo sintético/});
 await waitFor(()=>expect((screen.getByRole('combobox',{name:'Tipo de jornada'}) as HTMLSelectElement).disabled).toBe(false));
 fireEvent.change(screen.getByRole('combobox',{name:'Tipo de jornada'}),{target:{value:'retorno'}});
 fireEvent.click(screen.getByRole('button',{name:'Preparar rascunhos da jornada'}));
 await screen.findByRole('alert');expect(screen.queryByRole('article',{name:'Resultado da jornada'})).toBeNull();
});
it('falha do histórico não apaga sucesso e alteração de seleção invalida a prévia',async()=>{
 let consultas=0;
 const call=vi.fn(async(p:PedidoSkillClinica):Promise<ResultadoSkillClinica>=>{
  if(p.acao==='CATALOGO')return catalogo;if(p.acao==='FONTES')return fontes;
  if(p.acao==='HISTORICO'){if(++consultas>1)throw Error('falha sintética de histórico');return hist;}return preparada();
 });
 render(<PainelSkillsClinicas porta={{...criarPortaFalsa(),skillsClinicas:call}} contexto={contexto}/>);
 fireEvent.click(screen.getByRole('button',{name:'Jornada por skills'}));await screen.findByRole('checkbox',{name:/Laudo sintético/});
 await waitFor(()=>expect((screen.getByRole('combobox',{name:'Tipo de jornada'}) as HTMLSelectElement).disabled).toBe(false));
 fireEvent.change(screen.getByRole('combobox',{name:'Tipo de jornada'}),{target:{value:'retorno'}});
 fireEvent.click(screen.getByRole('button',{name:'Preparar rascunhos da jornada'}));
 await screen.findByText(/Rascunhos recuperados com sucesso/);
 expect(screen.getByRole('article',{name:'Resultado da jornada'})).toBeTruthy();
 fireEvent.click(screen.getByRole('checkbox',{name:'Incluir discussão do tratamento'}));
 expect(screen.queryByRole('article',{name:'Resultado da jornada'})).toBeNull();
 expect(call.mock.calls.filter(([p])=>p.acao==='EXECUTAR')).toHaveLength(1);
});
