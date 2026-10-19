// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {lerPropostasDoseReceita} from '../../../src/server/propostasDoseReceita.js';
import {ConsultaFlash} from '../../../src/ui/consulta/ConsultaFlash.js';
import type {ConsultaFlashProps} from '../../../src/contracts/api/flash.js';
afterEach(cleanup);
const item={id:'fonte-sintetica',droga:'Medicamento sintético',dose:'25',unidade:'mg',nota:'Restrição de contexto sintética',pendencia:'Pendência documental sintética',orientacaoPaciente:'Condição operacional sintética',via:'VO',frequencia:'Orientação sintética',duracao:'Período sintético',indicacao:'Cenário sintético',controle344:{lista:'comum'},fonte:{estado:'VERIFICADO',referencia:'Fonte exclusivamente sintética',trecho:'Dose literal exclusivamente sintética'}};
const catalogo=(itens:unknown[])=>JSON.stringify({header:{versao:'1'},consultavel:true,status:'RASCUNHO',alerta:false,nota:'População sintética delimitada',itens});
const proposta=()=>lerPropostasDoseReceita(catalogo([item]))[0]!;
const props=():ConsultaFlashProps=>({cabecalho:{},exames:[],acoesHoje:[],receitas:[],apac:{cid:'',sigtap:'',finalidade:'',competencia:'',estado:'PENDENTE',pendencias:[]},iaFala:[],retorno:{dias:null,examesAntesDoRetorno:[]},aoSalvarRascunho:vi.fn(),aoFinalizar:vi.fn()});
it('proposta preserva dose e fonte literais; veto local e fonte incompleta não são consumidos',()=>{
 const raw=catalogo([item,{...item,id:'vetado',politicaLocal:{propor:false}},{...item,id:'sem-fonte',fonte:{referencia:'Sem trecho'}},{...item,id:'pendente',dose:'PENDENTE'}]);
 const antes=raw;const p=lerPropostasDoseReceita(raw);
 expect(p).toHaveLength(1);expect(p[0]).toMatchObject({dose:'25 mg',doseOriginal:'25',unidade:'mg',restricoes:expect.arrayContaining([item.nota,item.pendencia,item.orientacaoPaciente,'População sintética delimitada']),estado:'PROPOSTA',requerValidacaoMedica:true,fonte:{curadoria:'RASCUNHO',trecho:item.fonte.trecho}});expect(raw).toBe(antes);
});
it('preenche uma fonte única ao sair do medicamento, mas não finaliza nem inclui automaticamente',async()=>{
 const p=props();p.aoProporDose=vi.fn(async()=>[proposta()]);render(<ConsultaFlash {...p}/>);
 fireEvent.change(screen.getByLabelText('Medicamento da receita'),{target:{value:item.droga}});fireEvent.blur(screen.getByLabelText('Medicamento da receita'));
 await waitFor(()=>expect((screen.getByLabelText('Dose da receita') as HTMLInputElement).value).toBe('25 mg'));
 expect((screen.getByRole('checkbox',{name:'Incluir receita digitada'}) as HTMLInputElement).checked).toBe(false);expect(p.aoFinalizar).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'SALVAR RASCUNHO'}));expect(p.aoSalvarRascunho).toHaveBeenCalledWith(expect.objectContaining({propostasDoseReceita:[expect.objectContaining({propostaId:item.id})]}));
});
it('fontes concorrentes exigem escolha; resposta tardia não sobrescreve edição manual',async()=>{
 const p=props(),a=proposta(),b={...a,id:'alternativa',indicacao:'Outro cenário sintético',dose:'Outra dose documental'};
 p.aoProporDose=vi.fn(async()=>[a,b]);const tela=render(<ConsultaFlash {...p}/>);
 fireEvent.change(screen.getByLabelText('Medicamento da receita'),{target:{value:item.droga}});fireEvent.blur(screen.getByLabelText('Medicamento da receita'));
 await screen.findByRole('button',{name:/Usar proposta: Outro cenário/});expect((screen.getByLabelText('Dose da receita') as HTMLInputElement).value).toBe('');tela.unmount();
 let terminar!:(p:typeof a[])=>void;p.aoProporDose=()=>new Promise(r=>{terminar=r;});render(<ConsultaFlash {...p}/>);
 fireEvent.change(screen.getByLabelText('Medicamento da receita'),{target:{value:item.droga}});fireEvent.blur(screen.getByLabelText('Medicamento da receita'));
 fireEvent.change(screen.getByLabelText('Dose da receita'),{target:{value:'Dose escrita pelo médico'}});
 await act(async()=>terminar([a]));expect((screen.getByLabelText('Dose da receita') as HTMLInputElement).value).toBe('Dose escrita pelo médico');
});
it('dose pendente selecionada permite salvar, mas não preparar assinatura',()=>{
 const p=props();render(<ConsultaFlash {...p}/>);fireEvent.change(screen.getByLabelText('Medicamento da receita'),{target:{value:item.droga}});
 fireEvent.click(screen.getByRole('checkbox',{name:'Incluir receita digitada'}));
 expect((screen.getByRole('button',{name:'REVISAR · IMPRIMIR'}) as HTMLButtonElement).disabled).toBe(true);
 expect((screen.getByRole('button',{name:'SALVAR RASCUNHO'}) as HTMLButtonElement).disabled).toBe(false);
});
it('trocar medicamento remove os valores da proposta anterior, inclusive após reabrir minuta',async()=>{
 const p=props();p.aoProporDose=vi.fn(async()=>[proposta()]);const tela=render(<ConsultaFlash {...p}/>);
 fireEvent.change(screen.getByLabelText('Medicamento da receita'),{target:{value:item.droga}});fireEvent.blur(screen.getByLabelText('Medicamento da receita'));
 await waitFor(()=>expect((screen.getByLabelText('Dose da receita') as HTMLInputElement).value).toBe('25 mg'));
 fireEvent.click(screen.getByRole('button',{name:'SALVAR RASCUNHO'}));
 const salvo=vi.mocked(p.aoSalvarRascunho).mock.calls[0]![0];tela.unmount();render(<ConsultaFlash {...p} planoInicial={salvo}/>);
 fireEvent.change(screen.getByLabelText('Medicamento da receita'),{target:{value:'Outro medicamento sintético'}});
 for(const nome of ['Dose','Via','Orientação / posologia','Duração'])expect((screen.getByLabelText(`${nome} da receita`) as HTMLInputElement).value).toBe('');
 fireEvent.click(screen.getByRole('checkbox',{name:'Incluir receita digitada'}));
 expect((screen.getByRole('button',{name:'REVISAR · IMPRIMIR'}) as HTMLButtonElement).disabled).toBe(true);
});
it('trocar proposta após reabrir substitui posologia automática sem apagar edição médica explícita',async()=>{
 const p=props(),a=proposta(),b={...a,id:'alternativa',indicacao:'Outro cenário sintético',dose:'50 mg',via:'Via B',orientacao:'Posologia B',duracao:'Duração B'};
 p.aoProporDose=vi.fn(async()=>[a,b]);const tela=render(<ConsultaFlash {...p}/>);
 fireEvent.change(screen.getByLabelText('Medicamento da receita'),{target:{value:item.droga}});fireEvent.blur(screen.getByLabelText('Medicamento da receita'));
 fireEvent.click(await screen.findByRole('button',{name:/Usar proposta: Cenário sintético/}));
 fireEvent.change(screen.getByLabelText('Duração da receita'),{target:{value:'Duração escrita pelo médico'}});
 fireEvent.click(screen.getByRole('button',{name:'SALVAR RASCUNHO'}));
 const salvo=vi.mocked(p.aoSalvarRascunho).mock.calls[0]![0];tela.unmount();render(<ConsultaFlash {...p} planoInicial={salvo}/>);
 fireEvent.blur(screen.getByLabelText('Medicamento da receita'));
 fireEvent.click(await screen.findByRole('button',{name:/Usar proposta: Outro cenário/}));
 expect((screen.getByLabelText('Dose da receita') as HTMLInputElement).value).toBe('50 mg');
 expect((screen.getByLabelText('Orientação / posologia da receita') as HTMLInputElement).value).toBe('Posologia B');
 expect((screen.getByLabelText('Via da receita') as HTMLInputElement).value).toBe('Via B');
 expect((screen.getByLabelText('Duração da receita') as HTMLInputElement).value).toBe('Duração escrita pelo médico');
 expect(screen.getByText(/Edição médica preservada/)).toBeTruthy();
});
