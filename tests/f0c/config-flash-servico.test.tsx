// @vitest-environment jsdom
import { cleanup,fireEvent,render,screen,waitFor } from "@testing-library/react";
import { afterEach,describe,expect,it,vi } from "vitest";
import { Configuracoes } from "../../src/ui/oncochart/Configuracoes.js";
import { ConsultaFlash,type ConsultaFlashProps } from "../../src/ui/consulta/ConsultaFlash.js";
import { lerModeloFlashConfigurado,NUMERO_CAIXA_MODELO_FLASH } from "../../src/config/flash.js";
import { NUMERO_CAIXA_RECEITUARIO_ESPECIAL,lerConfiguracaoServico } from "../../src/config/servico.js";
afterEach(cleanup);
const flash=():ConsultaFlashProps=>({cabecalho:{},exames:[],acoesHoje:[],receitas:[],apac:{cid:"",sigtap:"",finalidade:"",competencia:"",estado:"PENDENTE",pendencias:[]},iaFala:[],retorno:{dias:null,examesAntesDoRetorno:[]},aoSalvarRascunho:vi.fn(),aoFinalizar:vi.fn()});
describe("modelo explícito e configuração do serviço",()=>{
 it("mantém legado sem inferir exames; invalida injeção de decisão QT",()=>{
  expect(lerModeloFlashConfigurado({laboratorio:true,imagem:true})).toEqual({laboratorio:true,imagem:true});
  expect(lerModeloFlashConfigurado({laboratorio:true,imagem:false,decisaoQt:{solicitarCiclo:true}})).toBeNull();
  expect(lerModeloFlashConfigurado({laboratorio:true,imagem:false,solicitacoes:{laboratorio:[""],imagem:[]}})).toBeNull();
 });
 it("pré-marca somente listas do médico, rascunho vazio prevalece e QT não nasce marcada",()=>{
  const p=flash();const modelo={laboratorio:["HMG","INR"],imagem:["TC tórax"]};
  const {unmount}=render(<ConsultaFlash {...p} modeloSolicitacoes={modelo}/>);
  expect((screen.getByRole("checkbox",{name:"HMG"}) as HTMLInputElement).checked).toBe(true);
  expect((screen.getByLabelText("Outros LAB") as HTMLInputElement).value).toBe("INR");
  expect((screen.getByRole("checkbox",{name:/Liberar ciclo/}) as HTMLInputElement).checked).toBe(false);
  unmount();render(<ConsultaFlash {...p} modeloSolicitacoes={modelo} planoInicial={{acoesMarcadas:[],receitasMarcadas:[],apac:{...p.apac,emitir:false},retorno:p.retorno,solicitacoes:{laboratorio:[],imagem:[]}}}/>);
  expect((screen.getByRole("checkbox",{name:"HMG"}) as HTMLInputElement).checked).toBe(false);
  expect((screen.getByLabelText("Outros LAB") as HTMLInputElement).value).toBe("");
 });
 it("grava escolhas LAB/RAD e serviço em caixas separadas com revisão autenticada",async()=>{
  const lerCaixaConfiguracao=vi.fn(async(numero:number)=>({revision:numero===NUMERO_CAIXA_MODELO_FLASH?2:5,value:null}));
  const alterarCaixaConfiguracao=vi.fn(async()=>({estado:"GRAVADA" as const,revision:6}));
  render(<Configuracoes tema="dia" onTema={()=>{}} onFechar={()=>{}} porta={{lerCaixaConfiguracao,alterarCaixaConfiguracao}}/>);
  await waitFor(()=>expect((screen.getByRole("checkbox",{name:"Modelo HMG"}) as HTMLInputElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("checkbox",{name:"Modelo HMG"}));
  fireEvent.change(screen.getByLabelText("Modelo outros LAB"),{target:{value:"INR"}});
  fireEvent.click(screen.getByRole("button",{name:"Salvar modelo Flash"}));
  await waitFor(()=>expect(alterarCaixaConfiguracao).toHaveBeenCalledWith(expect.objectContaining({numero:17,expectedRevision:2,valorNovo:{laboratorio:true,imagem:false,solicitacoes:{laboratorio:["HMG","INR"],imagem:[]}}})));
  const especial=screen.getByRole("checkbox",{name:"Serviço possui receituário especial"}) as HTMLInputElement;
  expect(especial.checked).toBe(false);fireEvent.click(especial);
  fireEvent.click(screen.getByRole("button",{name:"Salvar configuração do serviço"}));
  await waitFor(()=>expect(alterarCaixaConfiguracao).toHaveBeenCalledWith(expect.objectContaining({numero:NUMERO_CAIXA_RECEITUARIO_ESPECIAL,expectedRevision:5,valorNovo:{servicoTemReceituarioEspecial:true}})));
 });
 it("somenteFlash com incluirServico grava a caixa 18 e reabre o valor autenticado, sem CNES demonstrativo",async()=>{
  let valor:unknown=null,revisao=5;
  const lerCaixaConfiguracao=vi.fn(async(numero:number)=>({revision:numero===NUMERO_CAIXA_MODELO_FLASH?2:revisao,value:numero===NUMERO_CAIXA_RECEITUARIO_ESPECIAL?valor:null}));
  const alterarCaixaConfiguracao=vi.fn(async(pedido:{valorNovo:unknown})=>{valor=pedido.valorNovo;revisao=6;return {estado:"GRAVADA" as const,revision:6};});
  const props={tema:"dia" as const,onTema:()=>{},onFechar:()=>{},somenteFlash:true,incluirServico:true,porta:{lerCaixaConfiguracao,alterarCaixaConfiguracao}};
  const {unmount}=render(<Configuracoes {...props}/>);
  expect(screen.queryByLabelText("CNES")).toBeNull();
  const especial=await screen.findByRole("checkbox",{name:"Serviço possui receituário especial"});
  await waitFor(()=>expect((especial as HTMLInputElement).disabled).toBe(false));
  expect((especial as HTMLInputElement).checked).toBe(false);
  fireEvent.click(especial);
  fireEvent.click(screen.getByRole("button",{name:"Salvar configuração do serviço"}));
  await waitFor(()=>expect(alterarCaixaConfiguracao).toHaveBeenCalledWith(expect.objectContaining({numero:NUMERO_CAIXA_RECEITUARIO_ESPECIAL,expectedRevision:5,valorNovo:{servicoTemReceituarioEspecial:true}})));
  unmount();
  render(<Configuracoes {...props}/>);
  await waitFor(()=>expect((screen.getByRole("checkbox",{name:"Serviço possui receituário especial"}) as HTMLInputElement).checked).toBe(true));
 });
 it("serviço ausente ou inválido permanece falso",()=>{
  expect(lerConfiguracaoServico(null).servicoTemReceituarioEspecial).toBe(false);
  expect(lerConfiguracaoServico({servicoTemReceituarioEspecial:"true"}).servicoTemReceituarioEspecial).toBe(false);
 });
});
