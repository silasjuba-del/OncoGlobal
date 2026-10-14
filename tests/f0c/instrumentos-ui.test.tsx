// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,describe,expect,it,vi} from "vitest";
import {InstrumentosClinicos,montarPedidoInstrumento} from "../../src/ui/clinico/InstrumentosClinicos.js";
import {AvaliacaoInstrumentoRequest} from "../../src/server/f0c/instrumentosClinicos.js";
import type {InstrumentoId,ResultadoInstrumento} from "../../src/contracts/f0c/instrumentos.js";
afterEach(cleanup);
const pendente=(instrumento:InstrumentoId):ResultadoInstrumento=>({instrumento,estado:"PENDENTE",escore:null,classificacao:null,parcelas:{},pendencias:["DADOS_AUSENTES"],regraVersao:null,fonteRegra:null,fonteDados:null,condutaAutomatica:false,consultaSegue:true});
describe("instrumentos clínicos sob demanda",()=>{
 it("KPS vazio envia null e aplicabilidade desconhecida; não consulta sozinho",async()=>{
  const avaliar=vi.fn(async()=>pendente("KPS"));render(<InstrumentosClinicos aoAvaliar={avaliar}/>);
  expect(avaliar).not.toHaveBeenCalled();expect((screen.getByLabelText("KPS documentado (0–100)") as HTMLInputElement).value).toBe("");
  fireEvent.click(screen.getByRole("button",{name:"Calcular"}));
  await waitFor(()=>expect(avaliar).toHaveBeenCalledWith({instrumento:"KPS",dados:{aplicavel:null,fonteDados:null,kpsDocumentado:null}}));
  expect((await screen.findByLabelText("Resultado do instrumento")).textContent).toContain("DADOS_AUSENTES");
 });
 it("preenche ALBI com unidades exibidas e fonte, sem converter medidas",async()=>{
  const avaliar=vi.fn(async()=>({...pendente("ALBI"),estado:"CALCULADO" as const,escore:-2.6,classificacao:"Grau 1",fonteDados:"Laudo 10/10",fonteRegra:"Referência curada",regraVersao:"v1",pendencias:[]}));
  render(<InstrumentosClinicos aoAvaliar={avaliar}/>);
  fireEvent.change(screen.getByLabelText("Instrumento"),{target:{value:"ALBI"}});
  fireEvent.change(screen.getByLabelText("Aplicabilidade confirmada pelo médico"),{target:{value:"true"}});
  fireEvent.change(screen.getByLabelText("Fonte dos dados"),{target:{value:"Laudo 10/10"}});
  fireEvent.change(screen.getByLabelText("Bilirrubina (umol/L)"),{target:{value:"15"}});
  fireEvent.change(screen.getByLabelText("Albumina (g/L)"),{target:{value:"40"}});
  fireEvent.click(screen.getByRole("button",{name:"Calcular"}));
  await waitFor(()=>expect(avaliar).toHaveBeenCalledWith({instrumento:"ALBI",dados:{aplicavel:true,fonteDados:"Laudo 10/10",bilirrubina:{valor:15,unidade:"umol/L",fonte:"Laudo 10/10"},albumina:{valor:40,unidade:"g/L",fonte:"Laudo 10/10"}}}));
  expect((await screen.findByLabelText("Resultado do instrumento")).textContent).toContain("Referência curada");
  fireEvent.change(screen.getByLabelText("Albumina (g/L)"),{target:{value:"41"}});
  expect(screen.queryByLabelText("Resultado do instrumento")).toBeNull();
 });
 it.each(["KPS","CHILD_PUGH","ALBI","KHORANA","G8"] as const)("payload %s inclui todos campos desconhecidos como null, conforme contrato",id=>{
  const p=montarPedidoInstrumento(id,{},"","");expect(AvaliacaoInstrumentoRequest.safeParse(p).success).toBe(true);
  expect(JSON.stringify(p)).not.toContain('"valor":0');
 });
 it("Khorana preserva false explícito e unidades fixas; G8 não sabe é diferente de ausente",()=>{
  const k=montarPedidoInstrumento("KHORANA",{sitio:"PANCREAS",plaquetas:"400",hemoglobina:"9",leucocitos:"12",imc:"36",usaEstimulanteEritropoiese:"false"},"true","avaliação");
  expect(AvaliacaoInstrumentoRequest.safeParse(k).success).toBe(true);
  expect(k.dados).toMatchObject({usaEstimulanteEritropoiese:false,plaquetas:{valor:400,unidade:"10^9/L",fonte:"avaliação"}});
  const g=montarPedidoInstrumento("G8",{ingestao3Meses:"SEM_REDUCAO",perdaPeso3Meses:"NAO_SABE",mobilidade:"SAI_CASA",neuropsicologico:"AUSENTE",imc:"25",medicamentosPorDia:"4",autoavaliacaoSaude:"NAO_SABE",idadeAnos:"75"},"true","entrevista");
  expect(AvaliacaoInstrumentoRequest.safeParse(g).success).toBe(true);expect(g.dados.perdaPeso3Meses).toBe("NAO_SABE");
 });
 it("resposta atrasada não grava resultado de outro instrumento",async()=>{
  let liberar!:(r:ResultadoInstrumento)=>void;
  const avaliar=vi.fn(()=>new Promise<ResultadoInstrumento>(ok=>{liberar=ok;}));
  render(<InstrumentosClinicos aoAvaliar={avaliar}/>);
  fireEvent.click(screen.getByRole("button",{name:"Calcular"}));
  fireEvent.change(screen.getByLabelText("Instrumento"),{target:{value:"ALBI"}});
  liberar({...pendente("KPS"),estado:"CALCULADO",escore:80,classificacao:"80"});
  await waitFor(()=>expect(avaliar).toHaveBeenCalled());
  expect(screen.queryByLabelText("Resultado do instrumento")).toBeNull();
 });
 it("troca de contexto pela chave descarta o rascunho",()=>{
  function Host({id}:{id:string}){return <InstrumentosClinicos key={id} aoAvaliar={async()=>pendente("KPS")}/>;}
  const {rerender}=render(<Host id="paciente-a:consulta-a:"/>);
  fireEvent.change(screen.getByLabelText("KPS documentado (0–100)"),{target:{value:"80"}});
  rerender(<Host id="paciente-b:consulta-b:"/>);
  expect((screen.getByLabelText("KPS documentado (0–100)") as HTMLInputElement).value).toBe("");
 });
 it("troca instrumento apaga valores e aplicabilidade anteriores",()=>{
  render(<InstrumentosClinicos aoAvaliar={async()=>pendente("KPS")}/>);
  fireEvent.change(screen.getByLabelText("KPS documentado (0–100)"),{target:{value:"80"}});
  fireEvent.change(screen.getByLabelText("Fonte dos dados"),{target:{value:"Fonte antiga"}});
  fireEvent.change(screen.getByLabelText("Instrumento"),{target:{value:"CHILD_PUGH"}});
  expect((screen.getByLabelText("Fonte dos dados") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("Bilirrubina (mg/dL)") as HTMLInputElement).value).toBe("");
 });
});
