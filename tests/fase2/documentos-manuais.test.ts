import { afterEach,expect,it } from "vitest";
import { abrirAmbiente,cadastrarPaciente,criarDiretorio,removerDiretorio,carregarConsulta,PACIENTE,ENCONTRO } from "../f0-fecha/fixtures/consulta-completa.js";
import type { PlanoFlash } from "../../src/contracts/api/flash.js";
let a:Awaited<ReturnType<typeof abrirAmbiente>>|undefined;let dir:string|undefined;
afterEach(async()=>{if(a)await a.close();if(dir)removerDiretorio(dir);a=undefined;dir=undefined;});
const contexto={patientId:PACIENTE,encounterId:ENCONTRO,tumorLotId:null};
const base:PlanoFlash={acoesMarcadas:[],receitasMarcadas:[],apac:{cid:"",sigtap:"",finalidade:"",competencia:"",estado:"PENDENTE",pendencias:[],emitir:false},
  retorno:{dias:null,examesAntesDoRetorno:[]},solicitacoes:{laboratorio:[],imagem:[]}};
it("documentos médicos incompletos salvam rascunho; completos exigem exibição e reabrem assinados",async()=>{
  dir=criarDiretorio();a=await abrirAmbiente(dir);cadastrarPaciente(a);await carregarConsulta(a);
  const incompleto:PlanoFlash={...base,documentosManuais:[{id:"encam-sintetico",tipo:"ENCAMINHAMENTO",titulo:"Encaminhamento sintético",destino:null,texto:""}]};
  expect((await a.request("/consulta/flash/rascunho",{...contexto,plano:incompleto,expectedRevision:null})).status).toBe(201);
  expect((await a.request("/consulta/flash/preparar",{...contexto,plano:incompleto,idempotencyKey:"manual-incompleto"})).data.codigo).toBe("DOCUMENTO_MANUAL_INCOMPLETO");
  const plano:PlanoFlash={...base,documentosManuais:[
    {id:"encam-sintetico",tipo:"ENCAMINHAMENTO",titulo:"Encaminhamento sintético",destino:"Serviço sintético de radioterapia",texto:"Avaliação solicitada pelo médico. Nenhuma dose definida."},
    {id:"laudo-sintetico",tipo:"LAUDO",titulo:"Laudo clínico sintético",destino:null,texto:"Informações explicitamente registradas pelo médico, sem inferir incapacidade."},
    {id:"orientacao-sintetica",tipo:"ORIENTACOES",titulo:"Orientações sintéticas",destino:null,texto:"Texto sintético revisado, sem posologia automática."},
  ]};
  const preparada=await a.request("/consulta/flash/preparar",{...contexto,plano,idempotencyKey:"manual-completo"});expect(preparada.status,JSON.stringify(preparada.data)).toBe(200);
  const input={...contexto,bloco:"TUDO",registros:preparada.data.registros,documentosExibidos:preparada.data.documentos.map((d:{documentId:string;documentVersion:number})=>({documentId:d.documentId,documentVersion:d.documentVersion})),reconhecerAlertas:[],idempotencyKey:"manual-confirmar"};
  expect((await a.request("/consulta/confirmar",input)).status).toBe(409);
  const bundle=await a.request("/consulta/bundle",{...contexto,draftIds:preparada.data.registros.map((r:{id:string})=>r.id)});expect(bundle.status).toBe(200);
  const signed=await a.request("/consulta/confirmar",input);expect(signed.data.codigo,JSON.stringify(signed.data)).toBe("GRAVADA");
  await a.close();a=await abrirAmbiente(dir);const reaberta=await a.request("/consulta/carregar",contexto);
  expect(reaberta.status).toBe(200);const historico=reaberta.data.historicoDocumentos as {titulo:string;texto:string}[];
  for(const d of plano.documentosManuais!)expect(historico).toContainEqual(expect.objectContaining({titulo:d.titulo,texto:expect.stringContaining(d.texto)}));
});
