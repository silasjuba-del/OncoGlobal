// Dados integralmente sintéticos. Fronteira HTTP e SQLite reais.
import { afterEach, expect, it } from "vitest";
import { abrirAmbiente, cadastrarPaciente, carregarConsulta, criarDiretorio, removerDiretorio,
  PACIENTE, ENCONTRO, AGORA } from "../f0-fecha/fixtures/consulta-completa.js";
import { salvarDraft } from "../../src/kernel/comandos/portas.js";
import { evento, persistirFixture } from "../w10-eixo-temporal/fixtures.js";
import { lerRecist } from "../../src/server/leituras.js";
import type { RecistPontoSerie, RecistSerieInput } from "../../src/rules/recist/index.js";

let a: Awaited<ReturnType<typeof abrirAmbiente>> | undefined;
afterEach(async()=>{if(a){await a.close();removerDiretorio(a.dir);a=undefined;}});
async function abrir(){a=await abrirAmbiente(criarDiretorio());cadastrarPaciente(a);await carregarConsulta(a);return a;}
const ctx={patientId:PACIENTE,encounterId:ENCONTRO,tumorLotId:null};

it.each(["paciente","encontro","lote","sem-contexto","identidade-payload","sem-paciente"])("rascunho genérico não vaza conteúdo fora do escopo: %s",async caso=>{
 const a=await abrir();const contexto={...ctx,...(caso==="encontro"?{encounterId:"outro"}:caso==="lote"?{tumorLotId:"outro-lote"}:caso==="identidade-payload"?{patientId:"outro-paciente"}:{})};
 salvarDraft(a.db,{draftId:"generico",patientId:caso==="paciente"?"outro-paciente":caso==="sem-paciente"?null:PACIENTE,
  sourceId:"fonte-sintetica",rawRef:"referencia-local",revision:0,diagnostics:[],criadoEm:AGORA,
  payload:{kind:"FLASH_RASCUNHO",texto:"conteudo-reservado-sintetico",...(caso==="sem-contexto"?{}:{contexto})}});
 const r=await a.request("/consulta/rascunho",{draftId:"generico"});
 expect(r.status).toBe(409);expect(JSON.stringify(r.data)).not.toContain("conteudo-reservado-sintetico");
});

it("rascunho genérico do contexto selecionado permanece legível",async()=>{
 const a=await abrir();salvarDraft(a.db,{draftId:"generico",patientId:PACIENTE,sourceId:"sintetica",rawRef:"referencia-local",
  revision:0,diagnostics:[],criadoEm:AGORA,payload:{contexto:ctx,texto:"conteudo-local"}});
 const r=await a.request("/consulta/rascunho",{draftId:"generico"});expect(r.status).toBe(200);
 expect(r.data.draft.payload.texto).toBe("conteudo-local");
});

it("proposta com contrato inválido não usa contexto genérico para ocultar correlação divergente",async()=>{
 const a=await abrir();salvarDraft(a.db,{draftId:"proposta-invalida",patientId:PACIENTE,sourceId:"sintetica",rawRef:"referencia-local",
  revision:0,diagnostics:[],criadoEm:AGORA,payload:{schema:"PrescricaoProposta@1",contexto:ctx,correlacao:{...ctx,patientId:"outro"},itens:[]}});
 expect((await a.request("/consulta/rascunho",{draftId:"proposta-invalida"})).status).toBe(409);
});

it("RECIST exige encontro explícito e recusa consulta divergente",async()=>{
 const a=await abrir();
 expect((await a.request("/consulta/recist",{patientId:PACIENTE})).status).toBe(409);
 expect((await a.request("/consulta/recist",{...ctx,encounterId:"outro-encontro"})).status).toBe(409);
 expect(lerRecist(a.db,PACIENTE)).toMatchObject({estado:"PENDENTE",codigo:"CONTEXTO_ENCONTRO_OBRIGATORIO",series:[]});
});

it("RECIST histórico filtra medição futura e mantém proposta sem escrita",async()=>{
 const a=await abrir(),tumorLotId="lote-recist",episodioId="episodio-recist";
 const contexto={...ctx,tumorLotId};a.sessoes.selecionarConsulta(a.token,contexto);
 const seed=(id:string,data:unknown,criadoEm:string,tipo="FATO",encounterId=ENCONTRO)=>persistirFixture(a.db,
  evento(id,data,{patientId:PACIENTE,tumorLotId,encounterId,criadoEm,tipo,fontes:[{sourceId:`fonte-${id}`,
   classe:"DOCUMENT",localizador:null,dataClinica:null,dataCaptura:criadoEm,versao:"1",contentHash:"a".repeat(64)}]}));
 const ponto=(id:string,data:string,diametroMm:number):RecistPontoSerie=>({eventId:id,patientId:PACIENTE,tumorLotId,episodioId,data,
  metodo:"TC",tecnicaId:"tc-sintetica",espessuraCorteMm:5,qualidadeMedicao:"ADEQUADA",novasLesoes:false,naoAlvos:"AUSENTE_DOCUMENTADO",
  fonteIds:[`fonte-${id}`],lesoes:[{codigo:"L1",diametroMm,fonteIds:[`fonte-${id}`]}]});
 seed("baseline",{campo:"imagem",valor:"sintetica"},"2026-09-01T12:00:00Z");
 seed("marco-consulta-seguinte",{campo:"marco",valor:"consulta posterior"},"2026-09-10T12:00:00Z","FATO","consulta-seguinte");
 seed("futuro",{campo:"imagem",valor:"sintetica"},"2026-09-20T12:00:00Z","FATO","consulta-seguinte");
 const serie:RecistSerieInput={patientId:PACIENTE,tumorLotId,episodioId,baselineEventId:"baseline",
  alvos:[{codigo:"L1",tipo:"NAO_NODAL",eixo:"MAIOR",orgaoId:"orgao-sintetico",elegibilidadeBasal:"ELEGIVEL",fonteElegibilidadeIds:["fonte-baseline"]}],
  pontos:[ponto("baseline","2026-09-01",20),ponto("futuro","2026-09-20",30)]};
 seed("serie",serie,"2026-09-02T12:00:00Z","RecistSerie");
 const antes=a.eventos();const r=await a.request("/consulta/recist",contexto);
 expect(r.status).toBe(200);
 expect(r.data.series[0].resultado.pontos.map((p:{eventId:string})=>p.eventId)).toEqual(["baseline"]);
 expect(r.data.series[0].categoriaNuncaAssinada).toBe(true);expect(a.eventos()).toEqual(antes);
});
