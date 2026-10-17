// @vitest-environment jsdom
import { act,cleanup,fireEvent,render,screen } from "@testing-library/react";
import { afterEach,expect,it,vi } from "vitest";
import { RevisaoClinica } from "../../src/ui/consulta/RevisaoClinica.js";
import { BotaoVoz,type ReconhecimentoLocal } from "../../src/ui/telas/importar/BotaoVoz.js";
import { etapaDoClique,contarClique,metricasVazias } from "../../src/ui/consulta/metricasConsulta.js";
import { criarPortaFalsa } from "../../src/ui/api/fake.js";
import type { RevisaoClinicaResposta } from "../../src/contracts/fase2/revisaoClinica.js";
import { contexto } from "./fixtures.js";
import { ConsultaFlash } from '../../src/ui/consulta/ConsultaFlash.js';
import type { ConsultaFlashProps } from '../../src/contracts/api/flash.js';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const resposta:RevisaoClinicaResposta={codigo:"REVISAO_CLINICA_CARREGADA",contexto,revisao:"r",ficha:[],preQt:{estado:"PENDENTE",autorizaTratamento:false,pendencias:["Paciente antigo sintético"]},packs:[],pack:null,pendencias:[],estadosDoenca:[],
  respostaTumoral:{criterio:"RECIST_1_1",aplicabilidade:"CONFERIR_CRITERIO_DO_TUMOR",series:[],patologica:[],pendencias:[]}};
it("resposta tardia de outro paciente não entra na ficha atual",async()=>{
  const porta=criarPortaFalsa();let resolver!:(r:RevisaoClinicaResposta)=>void;
  porta.revisaoClinica=vi.fn(()=>new Promise<RevisaoClinicaResposta>(r=>{resolver=r;}));
  const tela=render(<RevisaoClinica porta={porta} contexto={contexto} versaoClinica={0}/>);const antigo=resolver;
  tela.rerender(<RevisaoClinica porta={porta} contexto={{...contexto,patientId:"outro"}} versaoClinica={0}/>);
  await act(async()=>antigo(resposta));expect(screen.queryByText("Paciente antigo sintético")).toBeNull();
});
it('pCR negada ou incerta mostra seus qualificadores e conflitos na tela',async()=>{
  const porta=criarPortaFalsa();
  porta.revisaoClinica=vi.fn(async()=>({...resposta,respostaTumoral:{...resposta.respostaTumoral,patologica:[
    {valor:'pCR',data:'2026-10-16',fato:{eventId:'negada',revisao:'1'},fontes:[],estado:'NEGADO' as const,conflito:true,qualificadores:{negated:true}},
    {valor:'pCR',data:'2026-10-16',fato:{eventId:'incerta',revisao:'1'},fontes:[],estado:'INCERTO' as const,conflito:true,qualificadores:{evidence:'UNCERTAIN',requiresConfirmation:true}},
  ]}}));
  render(<RevisaoClinica porta={porta} contexto={contexto} versaoClinica={0}/>);
  expect(await screen.findByText(/pCR negada/)).toBeTruthy();
  expect(screen.getByText(/pCR incerta/).textContent).toContain('confirmação médica pendente');
  expect(screen.getAllByText(/CONFLITO entre registros/)).toHaveLength(2);
});
it("métrica só conserva etapa e contagem; texto e paciente nunca são coletados",()=>{
  const tela=render(<div id="consulta-documentos"><button>Nome sintético reservado</button><textarea defaultValue="conteúdo clínico sintético"/></div>);
  const etapa=etapaDoClique(screen.getByRole("button"));expect(etapa).toBe("ENTRADA");
  const m=contarClique(metricasVazias(),etapa!);expect(m.ENTRADA).toBe(1);
  expect(JSON.stringify(m)).not.toMatch(/paciente|conteúdo|Nome/);expect(etapaDoClique(screen.getByRole("textbox"))).toBe("ENTRADA");
  expect(etapaDoClique(tela.container)).toBeNull();
});
it("download do idioma exige clique separado e nunca inicia microfone automaticamente",async()=>{
  const start=vi.fn(),install=vi.fn(async()=>true),available=vi.fn().mockResolvedValueOnce("downloadable").mockResolvedValue("available");
  class Captura implements ReconhecimentoLocal {static available=available;static install=install;processLocally=false;lang="";continuous=false;interimResults=false;
    onresult=null;onerror=null;onend=null;start=start;stop(){}abort(){}}
  vi.stubGlobal("SpeechRecognition",Captura);
  render(<BotaoVoz aoTrecho={vi.fn()}/>);fireEvent.click(screen.getByRole("button",{name:"comando de voz"}));
  const preparar=await screen.findByRole("button",{name:"Preparar português para ditado local"});expect(install).not.toHaveBeenCalled();expect(start).not.toHaveBeenCalled();
  fireEvent.click(preparar);await screen.findByText(/Português preparado/);
  expect(install).toHaveBeenCalledExactlyOnceWith({langs:["pt-BR"],processLocally:true});expect(start).not.toHaveBeenCalled();
});
it("encaminhamento incompleto salva rascunho, mas só prepara após destino e conteúdo",()=>{
  const salvar=vi.fn(),finalizar=vi.fn();const props:ConsultaFlashProps={cabecalho:{},exames:[],acoesHoje:[],receitas:[],iaFala:[],
    apac:{cid:'',sigtap:'',finalidade:'',competencia:'',estado:'PENDENTE',pendencias:[]},retorno:{dias:null,examesAntesDoRetorno:[]},aoSalvarRascunho:salvar,aoFinalizar:finalizar};
  render(<ConsultaFlash {...props}/>);fireEvent.click(screen.getByText('Encaminhamentos, laudos e orientações'));
  fireEvent.click(screen.getByRole('button',{name:'Adicionar encaminhamento'}));
  const revisar=screen.getByRole('button',{name:'REVISAR · IMPRIMIR'});expect(revisar.hasAttribute('disabled')).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'SALVAR RASCUNHO'}));expect(salvar).toHaveBeenCalledOnce();expect(finalizar).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Destino do encaminhamento 1'),{target:{value:'Nutrição'}});
  fireEvent.change(screen.getByLabelText('Conteúdo do documento 1'),{target:{value:'Avaliação nutricional solicitada pelo médico no caso sintético.'}});
  fireEvent.click(revisar);expect(finalizar).toHaveBeenCalledWith(expect.objectContaining({documentosManuais:[expect.objectContaining({tipo:'ENCAMINHAMENTO',destino:'Nutrição'})]}));
});
