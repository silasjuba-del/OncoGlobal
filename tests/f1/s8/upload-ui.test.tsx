// @vitest-environment jsdom
import { afterEach,expect,it,vi } from "vitest";
import { cleanup,fireEvent,render,screen,waitFor } from "@testing-library/react";
import { UploadDocumentoLocal } from "../../../src/ui/consulta/UploadDocumentoLocal.js";
import { criarPortaFalsa } from "../../../src/ui/api/fake.js";
import type { PedidoUploadLocal } from "../../../src/ui/api/porta.js";
afterEach(cleanup);
it("arquivo vira payload opaco com contexto explícito, sem nome transmitido e revisita as fontes",async()=>{
  const porta=criarPortaFalsa(),upload=vi.fn(async(_pedido:PedidoUploadLocal)=>({codigo:"RASCUNHO_SALVO" as const,draftId:"draft-local",revision:0,linkedPatientId:null,requiresMedicalReview:true as const,conversionStatus:"PRONTO" as const}));
  porta.uploadDocumentoLocal=upload;const aoSalvar=vi.fn(),contexto={patientId:"p1",encounterId:"e1",tumorLotId:"t1"};
  render(<UploadDocumentoLocal porta={porta} contexto={contexto} aoSalvar={aoSalvar}/>);
  const arquivo=new File(["%PDF-1.4\nPDF SINTETICO"],"nome-nao-transmitido.pdf",{type:"application/pdf"});
  fireEvent.change(screen.getByLabelText("Documento local"),{target:{files:[arquivo]}});
  fireEvent.click(screen.getByRole("button",{name:"Converter e revisar"}));
  await screen.findByText(/Confira a fonte e vincule/);
  expect(upload).toHaveBeenCalledTimes(1);const p=upload.mock.calls[0]![0] as unknown as Record<string,unknown>;
  expect(p).toMatchObject({...contexto,tipo:"PDF",sourceType:"medical_note"});expect(String(p.bytesBase64)).toMatch(/^[A-Za-z0-9+/]+=*$/);
  expect(JSON.stringify(p)).not.toContain("nome-nao-transmitido");expect(aoSalvar).toHaveBeenCalledTimes(1);
});
it("mudar paciente durante upload não atualiza fontes nem exibe resposta antiga",async()=>{
  const porta=criarPortaFalsa();let resolver!:(v:{codigo:"RASCUNHO_SALVO";draftId:string;revision:number;linkedPatientId:null;requiresMedicalReview:true})=>void;
  const upload=vi.fn(()=>new Promise<{codigo:"RASCUNHO_SALVO";draftId:string;revision:number;linkedPatientId:null;requiresMedicalReview:true}>(r=>{resolver=r;}));porta.uploadDocumentoLocal=upload;
  const aoSalvar=vi.fn(),tela=render(<UploadDocumentoLocal porta={porta} contexto={{patientId:"p1",encounterId:"e1",tumorLotId:null}} aoSalvar={aoSalvar}/>);
  fireEvent.change(screen.getByLabelText("Documento local"),{target:{files:[new File(["imagem"],"sintetica.png",{type:"image/png"})]}});
  fireEvent.click(screen.getByRole("button",{name:"Converter e revisar"}));await waitFor(()=>expect(upload).toHaveBeenCalledTimes(1));
  tela.rerender(<UploadDocumentoLocal porta={porta} contexto={{patientId:"p2",encounterId:"e2",tumorLotId:null}} aoSalvar={aoSalvar}/>);
  resolver({codigo:"RASCUNHO_SALVO",draftId:"d",revision:0,linkedPatientId:null,requiresMedicalReview:true});
  await waitFor(()=>expect(screen.queryByText(/Texto convertido/)).toBeNull());expect(aoSalvar).not.toHaveBeenCalled();
});
