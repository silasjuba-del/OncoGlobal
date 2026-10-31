// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {PainelSkillsClinicas} from '../../src/ui/consulta/PainelSkillsClinicas.js';
import {criarPortaFalsa} from '../../src/ui/api/fake.js';
import {ResultadoSkillClinica,type PedidoSkillClinica} from '../../src/contracts/skillsClinicas.js';
import {ResultadoJornada} from '../../src/contracts/jornadaClinica.js';
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
it('mostra L1 e L2 como referência e não como dose',async()=>{
 const jornada=ResultadoJornada.parse({versao:'1.0.0',tipo:'RETORNO',estado:'PARCIAL',corpusHash:null,ledgerHash:'h',avaliacaoHash:'h',
  etapas:[],alertas:[],seguranca:[],mudancas:[],criterios:[],acoes:[],fontes:[],divergencias:[],pendencias:[],autorizaTratamento:false,
  cartoes:[{id:'PUL-26',grupo:'CPNPC',estadiamento:'IV / avançado',subtipo:'EGFR del19/L858R',modalidades:['SISTEMICO'],papeis:['PALIATIVO'],
   trilha:'Terapia dirigida.',fontes:[{fonte:'SBOC-AVANCADO',paginas_pdf:[15]}],
   linhas:{1:{opcoes:['Osimertinibe'],fontes:[{fonte:'SBOC-AVANCADO',paginas_pdf:[15]}],condicao:'',estado:'EXTRAIDO_PARA_REVISAO'},
    2:{opcoes:['Após TKI: osimertinibe'],fontes:[{fonte:'SBOC-AVANCADO',paginas_pdf:[15]}],condicao:'Reavaliar resistência.',estado:'EXTRAIDO_PARA_REVISAO'},
    3:{opcoes:[],fontes:[],condicao:'Não completar por analogia.',estado:'SEM_FONTE_ESTRUTURADA'},
    4:{opcoes:[],fontes:[],condicao:'Não completar por analogia.',estado:'SEM_FONTE_ESTRUTURADA'},
    5:{opcoes:[],fontes:[],condicao:'Não completar por analogia.',estado:'SEM_FONTE_ESTRUTURADA'}},
   condicoes_e_limites:[],divergencias:[],estado:'RASCUNHO_DOCUMENTAL_NAO_EXECUTAVEL'}]});
 const base=preparada();
 if(base.codigo!=='SKILL_PREPARADA')throw Error();
 const pronto:ResultadoSkillClinica={...base,execucao:{...base.execucao,jornada}};
 const call=vi.fn(async(p:PedidoSkillClinica):Promise<ResultadoSkillClinica>=>p.acao==='CATALOGO'?catalogo:p.acao==='FONTES'?fontes:p.acao==='HISTORICO'?hist:pronto);
 render(<PainelSkillsClinicas porta={{...criarPortaFalsa(),skillsClinicas:call}} contexto={contexto}/>);
 fireEvent.click(screen.getByRole('button',{name:'Jornada por skills'}));
 fireEvent.click(await screen.findByRole('checkbox',{name:/Laudo sintético/}));
 fireEvent.click(screen.getByRole('button',{name:'Preparar rascunhos da jornada'}));
 const linhas=await screen.findByRole('region',{name:'Linhas de referência sem dose'});
 expect(linhas.textContent).toContain('L1.');
 expect(linhas.textContent).toContain('Osimertinibe');
 expect(linhas.textContent).toContain('L2.');
 expect(linhas.textContent).toContain('Após TKI');
 expect(linhas.textContent).toContain('Sem opção extraída. Não completar por analogia.');
 expect(linhas.textContent).not.toMatch(/\bL[45]\./);
 expect(linhas.textContent).not.toMatch(/\d+\s*mg/);
});
