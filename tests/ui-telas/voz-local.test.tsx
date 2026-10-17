// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BotaoVoz, type ReconhecimentoLocal } from "../../src/ui/telas/importar/BotaoVoz.js";
import { TranscricaoLocal } from "../../src/ui/consulta/TranscricaoLocal.js";
import { UploadDocumentoLocal } from "../../src/ui/consulta/UploadDocumentoLocal.js";
import { criarPortaFalsa } from "../../src/ui/api/fake.js";
import type { ResultadoTranscricaoLocal } from "../../src/ui/api/porta.js";

let ultima: Captura | undefined;
class Captura implements ReconhecimentoLocal {
  static available = vi.fn(async () => "available");
  processLocally = false; lang = ""; continuous = false; interimResults = true;
  onresult: ReconhecimentoLocal["onresult"] = null; onerror: ReconhecimentoLocal["onerror"] = null; onend: ReconhecimentoLocal["onend"] = null;
  start = vi.fn(); stop = vi.fn(() => this.onend?.()); abort = vi.fn();
  constructor() { ultima = this; }
}
function instalar() {
  Captura.available.mockResolvedValue("available"); vi.stubGlobal("SpeechRecognition", Captura);
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); Captura.available.mockClear(); ultima = undefined; });
it("sem suporte local não inicia nem usa provider remoto", () => {
  vi.stubGlobal("SpeechRecognition", undefined); const webkit=vi.fn(); vi.stubGlobal("webkitSpeechRecognition",webkit);
  render(<BotaoVoz aoTrecho={vi.fn()} />);
  expect(screen.getByRole("button",{name:"comando de voz"}).hasAttribute("disabled")).toBe(true);
  expect(webkit).not.toHaveBeenCalled();
});
it.each(["downloadable","downloading","unavailable"])("idioma %s não inicia captura nem baixa modelo",async status=>{
  instalar();Captura.available.mockResolvedValue(status);const trecho=vi.fn();
  render(<BotaoVoz aoTrecho={trecho}/>);fireEvent.click(screen.getByRole("button",{name:"comando de voz"}));
  await screen.findByText(/Português ainda não está disponível/);expect(trecho).not.toHaveBeenCalled();
  expect(Captura.available).toHaveBeenCalledWith({langs:["pt-BR"],processLocally:true});
});
it("ditado explicitamente local entrega resultado final uma vez e aborta ao desmontar",async()=>{
  instalar();const trecho=vi.fn(),tela=render(<BotaoVoz aoTrecho={trecho}/>);
  fireEvent.click(screen.getByRole("button",{name:"comando de voz"}));await screen.findByText(/Ouvindo neste computador/);
  if (!ultima) throw Error("CAPTURA_NAO_INICIADA");
  expect(ultima?.processLocally).toBe(true);expect(ultima?.lang).toBe("pt-BR");expect(ultima?.start).toHaveBeenCalledWith();
  const evento={resultIndex:0,results:[{isFinal:true,0:{transcript:"nega dor"}}]};
  act(()=>{ultima!.onresult?.(evento);ultima!.onresult?.(evento);});expect(trecho).toHaveBeenCalledExactlyOnceWith("nega dor");
  const eventoTardio=ultima!.onresult;tela.unmount();expect(ultima!.abort).toHaveBeenCalledOnce();
  eventoTardio?.({resultIndex:1,results:[evento.results[0]!,{isFinal:true,0:{transcript:"outro paciente"}}]});
  expect(trecho).toHaveBeenCalledTimes(1);
});
it("desmontar durante verificação impede início tardio",async()=>{
  instalar();let resolver!:(s:string)=>void;Captura.available.mockImplementationOnce(()=>new Promise(r=>{resolver=r;}));
  const tela=render(<BotaoVoz aoTrecho={vi.fn()}/>);fireEvent.click(screen.getByRole("button",{name:"comando de voz"}));
  tela.unmount();await act(async()=>{resolver("available");});expect(screen.queryByText(/Ouvindo/)).toBeNull();
});
it("cancelar instalação não abre microfone e ignora resolução tardia",async()=>{
  instalar();let resolver!:(ok:boolean)=>void;
  Captura.available.mockResolvedValueOnce("downloadable");(Captura as unknown as {install:()=>Promise<boolean>}).install=()=>new Promise(r=>{resolver=r;});
  render(<BotaoVoz aoTrecho={vi.fn()}/>);fireEvent.click(screen.getByRole("button",{name:"comando de voz"}));
  fireEvent.click(await screen.findByRole("button",{name:"Preparar português para ditado local"}));
  fireEvent.click(screen.getByRole("button",{name:"Cancelar preparação do idioma"}));
  await screen.findByText(/Preparação cancelada/);await act(async()=>{resolver(true);});
  expect(screen.getByText(/Preparação cancelada/)).toBeTruthy();expect(ultima).toBeUndefined();
});
it("transcrição editada conserva captura original e só envia rascunho após revisão",async()=>{
  instalar();const porta=criarPortaFalsa(),aoSalvar=vi.fn();
  porta.importarTranscricaoLocal=vi.fn(async()=>({codigo:"RASCUNHO_SALVO" as const,draftId:"d",revision:0,linkedPatientId:null,requiresMedicalReview:true as const}));
  render(<TranscricaoLocal porta={porta} contexto={{patientId:"p",encounterId:"e",tumorLotId:null}} aoSalvar={aoSalvar}/>);
  fireEvent.click(screen.getByRole("button",{name:"comando de voz"}));await screen.findByText(/Ouvindo/);
  if (!ultima) throw Error("CAPTURA_NAO_INICIADA");
  const capturaAtual=ultima;
  act(()=>capturaAtual.onresult?.({resultIndex:0,results:[{isFinal:true,0:{transcript:"Creatinina 12"}}]}));
  fireEvent.click(screen.getByRole("button",{name:"comando de voz"}));
  fireEvent.change(screen.getByLabelText("Texto da transcrição"),{target:{value:"Creatinina 1,2; nega dor."}});
  const salvar=screen.getByRole("button",{name:"Salvar transcrição para revisão clínica"});
  expect(salvar.hasAttribute("disabled")).toBe(true);expect(porta.importarTranscricaoLocal).not.toHaveBeenCalled();
  fireEvent.click(screen.getByLabelText("Revisei o texto para salvar como rascunho"));fireEvent.click(salvar);
  await screen.findByText(/Rascunho salvo/);
  expect(porta.importarTranscricaoLocal).toHaveBeenCalledWith(expect.objectContaining({rawTranscript:"Creatinina 1,2; nega dor.",
    capturedTranscript:"Creatinina 12",captureMethod:"LOCAL_DICTATION",contexto:{patientId:"p",encounterId:"e",tumorLotId:null}}),expect.any(AbortSignal));
  expect(aoSalvar).toHaveBeenCalledOnce();
});
it("troca de paciente limpa ditado e ignora resposta de gravação antiga",async()=>{
  instalar();const porta=criarPortaFalsa(),aoSalvar=vi.fn();let resolver!:(x:ResultadoTranscricaoLocal)=>void;
  porta.importarTranscricaoLocal=vi.fn(()=>new Promise<ResultadoTranscricaoLocal>(r=>{resolver=r;}));
  const tela=render(<TranscricaoLocal porta={porta} contexto={{patientId:"p",encounterId:"e",tumorLotId:null}} aoSalvar={aoSalvar}/>);
  fireEvent.change(screen.getByLabelText("Texto da transcrição"),{target:{value:"nota sintética"}});
  fireEvent.click(screen.getByLabelText("Revisei o texto para salvar como rascunho"));
  fireEvent.click(screen.getByRole("button",{name:"Salvar transcrição para revisão clínica"}));
  tela.rerender(<TranscricaoLocal porta={porta} contexto={{patientId:"p2",encounterId:"e2",tumorLotId:null}} aoSalvar={aoSalvar}/>);
  await act(async()=>{resolver({codigo:"RASCUNHO_SALVO",draftId:"d",revision:0,linkedPatientId:null,requiresMedicalReview:true});});
  expect((screen.getByLabelText("Texto da transcrição") as HTMLTextAreaElement).value).toBe("");
  expect(aoSalvar).not.toHaveBeenCalled();expect(screen.queryByText(/Rascunho salvo/)).toBeNull();
});
it.each(["PENDENTE",undefined])("replay de upload %s permanece pendente na UI",async status=>{
  const porta=criarPortaFalsa();porta.uploadDocumentoLocal=vi.fn(async()=>({codigo:"REPLAY" as const,draftId:"d",revision:0,
    linkedPatientId:null,requiresMedicalReview:true as const,...(status?{conversionStatus:"PENDENTE" as const}:{}),paginasPendentes:[2]}));
  render(<UploadDocumentoLocal porta={porta} contexto={{patientId:"p",encounterId:"e",tumorLotId:null}} aoSalvar={vi.fn()}/>);
  fireEvent.change(screen.getByLabelText("Documento local"),{target:{files:[new File(["sintético"],"sintetico.pdf",{type:"application/pdf"})]}});
  fireEvent.click(screen.getByRole("button",{name:"Converter e revisar"}));
  await screen.findByText(/Páginas a conferir: 2/);expect(screen.queryByText(/Texto convertido/)).toBeNull();
});
