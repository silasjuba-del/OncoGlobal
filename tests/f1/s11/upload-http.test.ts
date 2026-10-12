import { afterEach,expect,it } from "vitest";
import { createHash } from "node:crypto";
import { abrirAmbiente,cadastrarPaciente,criarDiretorio,removerDiretorio,PACIENTE,ENCONTRO } from "../../f0-fecha/fixtures/consulta-completa.js";
import { lerDraft } from "../../../src/kernel/ledger/drafts.js";
import { processarUploadLocal } from "../../../src/server/upload.js";
import { createCanvas } from "@napi-rs/canvas";
import { deflateSync } from "node:zlib";
let ambiente:Awaited<ReturnType<typeof abrirAmbiente>>|undefined;
afterEach(async()=>{if(ambiente){await ambiente.close();removerDiretorio(ambiente.dir);ambiente=undefined;}});
const pedido={patientId:PACIENTE,encounterId:ENCONTRO,tumorLotId:null,id:"upload-sintetico",sourceId:"fonte-upload",sourceType:"medical_note",tipo:"PDF",bytesBase64:Buffer.from("arquivo sintetico").toString("base64")};
async function abrir(){ambiente=await abrirAmbiente(criarDiretorio());cadastrarPaciente(ambiente);await ambiente.request("/consulta/carregar",{patientId:PACIENTE,encounterId:ENCONTRO,tumorLotId:null});return ambiente;}
it("upload HTTP preserva arquivo ilegível inerte e exige vínculo humano sem fatos assinados",async()=>{
  const a=await abrir();const r=await a.request<{draftId:string;conversionStatus:string;requiresMedicalReview:boolean}>("/consulta/upload",pedido);
  expect(r.status).toBe(201);expect(r.data.conversionStatus).toBe("PENDENTE");expect(r.data.requiresMedicalReview).toBe(true);
  const draft=lerDraft(a.db,r.data.draftId)!;expect(draft.patientId).toBeNull();
  expect(draft.payload).toMatchObject({kind:"EXTRACAO_RASCUNHO",original:{bytesBase64:pedido.bytesBase64,contentHash:createHash("sha256").update(Buffer.from(pedido.bytesBase64,"base64")).digest("hex")}});
  expect(a.eventos().filter(e=>e.revisao==="ASSINADO")).toHaveLength(0);
  const replay=await a.request("/consulta/upload",pedido);expect(replay.status).toBe(200);expect(replay.data.codigo).toBe("REPLAY");
  expect((await a.request("/consulta/upload",{...pedido,bytesBase64:Buffer.from("outro").toString("base64")})).status).toBe(409);
});
it("conversão pronta entra no mesmo pipeline de revisão com página/hash e paciente nulo",async()=>{
  const a=await abrir(),sessao=a.sessoes.obter(a.token)!;
  const r=await processarUploadLocal({db:a.db,sessoes:a.sessoes,agora:()=>"2026-10-09T12:00:00-03:00",converterUpload:async entrada=>({status:"PRONTO",documento:{id:entrada.id,tipo:entrada.tipo,hash:"hash-original",recebidoEm:entrada.recebidoEm,paginas:[{n:1,texto:"08/10/2026 Creatinina 1,2 mg/dL."}]}})},a.token,sessao,pedido);
  expect(r.status).toBe(201);const draft=lerDraft(a.db,String(r.body.draftId))!;
  expect(draft.patientId).toBeNull();expect(draft.payload).toMatchObject({input:{rawTranscript:"08/10/2026 Creatinina 1,2 mg/dL."},original:{documento:{paginas:[{n:1,texto:"08/10/2026 Creatinina 1,2 mg/dL."}]}}});
  expect(r.body.requiresMedicalReview).toBe(true);
});
it("rejeita contexto diferente e campo nomearquivo; máximo 8MB sem gravação clínica",async()=>{
  const a=await abrir();expect((await a.request("/consulta/upload",{...pedido,encounterId:"outro-encontro"})).status).toBe(409);
  expect((await a.request("/consulta/upload",{...pedido,nomeArquivo:"proibido.pdf"})).status).toBe(400);
  expect((await a.request("/consulta/upload",{...pedido,bytesBase64:"***"})).status).toBe(400);
  const sessao=a.sessoes.obter(a.token)!;
  const demais=Buffer.alloc(8*1024*1024+1).toString("base64");
  expect((await processarUploadLocal({db:a.db,sessoes:a.sessoes,agora:()=>"2026-10-09T12:00:00-03:00"},a.token,sessao,{...pedido,bytesBase64:demais})).status).toBeGreaterThanOrEqual(400);
  expect(a.eventos().filter(e=>e.revisao==="ASSINADO")).toHaveLength(0);
});
it("imagem sintética passa por OCR Tesseract realmente local e permanece rascunho não vinculado",async()=>{
  const a=await abrir(),canvas=createCanvas(1000,240),ctx=canvas.getContext("2d");
  ctx.fillStyle="white";ctx.fillRect(0,0,1000,240);ctx.fillStyle="black";ctx.font="40px sans-serif";
  ctx.fillText("08/10/2026",30,65);ctx.fillText("Creatinina 1,2 mg/dL.",30,135);
  const bytesBase64=canvas.toBuffer("image/png").toString("base64");
  const r=await a.request<{draftId:string;conversionStatus:string}>("/consulta/upload",{...pedido,id:"imagem-sintetica-real",sourceId:"imagem-fonte-real",tipo:"IMAGEM",bytesBase64});
  expect(r.status).toBe(201);expect(r.data.conversionStatus).toBe("PRONTO");
  const draft=lerDraft(a.db,r.data.draftId)!;expect(draft.patientId).toBeNull();
  const payload=draft.payload as {input:{rawTranscript:string};original:{confianca:number;bytesBase64:string}};
  expect(payload.input.rawTranscript).toMatch(/Creatinina/i);expect(payload.original.confianca).toBeGreaterThanOrEqual(70);
  expect(payload.original.bytesBase64).toBe(bytesBase64);expect(a.eventos().filter(e=>e.revisao==="ASSINADO")).toHaveLength(0);
});
it("PDF somente bitmap é renderizado e lido pelo OCR local mantendo original e página",async()=>{
  const a=await abrir(),canvas=createCanvas(1000,240),ctx=canvas.getContext("2d");
  ctx.fillStyle="white";ctx.fillRect(0,0,1000,240);ctx.fillStyle="black";ctx.font="40px sans-serif";ctx.fillText("08/10/2026 Creatinina 1,2 mg/dL.",30,100);
  const rgba=ctx.getImageData(0,0,1000,240).data,rgb=Buffer.alloc(1000*240*3);
  for(let i=0,j=0;i<rgba.length;i+=4){rgb[j++]=rgba[i]!;rgb[j++]=rgba[i+1]!;rgb[j++]=rgba[i+2]!;}
  const imagem=deflateSync(rgb),draw=Buffer.from("q 1000 0 0 240 0 0 cm /Im0 Do Q");
  const objetos=[Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    Buffer.from("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1000 240] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>"),
    Buffer.concat([Buffer.from(`<< /Length ${draw.length} >>\nstream\n`),draw,Buffer.from("\nendstream")]),
    Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width 1000 /Height 240 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${imagem.length} >>\nstream\n`),imagem,Buffer.from("\nendstream")])];
  let pdf=Buffer.from("%PDF-1.4\n"),xref="xref\n0 6\n0000000000 65535 f \n";
  objetos.forEach((o,i)=>{xref+=`${String(pdf.length).padStart(10,"0")} 00000 n \n`;pdf=Buffer.concat([pdf,Buffer.from(`${i+1} 0 obj\n`),o,Buffer.from("\nendobj\n")]);});
  const inicioXref=pdf.length;pdf=Buffer.concat([pdf,Buffer.from(`${xref}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`)]);
  const r=await a.request<{draftId:string;conversionStatus:string}>("/consulta/upload",{...pedido,id:"pdf-bitmap-local",sourceId:"pdf-bitmap-fonte",bytesBase64:pdf.toString("base64")});
  expect(r.status).toBe(201);expect(r.data.conversionStatus).toBe("PRONTO");const draft=lerDraft(a.db,r.data.draftId)!;
  const payload=draft.payload as {input:{rawTranscript:string};original:{bytesBase64:string;documento:{paginas:{n:number;texto:string}[]}}};
  expect(payload.input.rawTranscript).toMatch(/Creatinina/i);expect(payload.original.documento.paginas[0]?.n).toBe(1);expect(payload.original.bytesBase64).toBe(pdf.toString("base64"));
  expect(draft.patientId).toBeNull();
});
