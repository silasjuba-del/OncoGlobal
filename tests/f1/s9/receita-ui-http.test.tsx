// @vitest-environment jsdom
import {afterEach,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,waitFor,within} from "@testing-library/react";
import {ConsultaPersistida} from "../../../src/ui/consulta/ConsultaPersistida.js";
import {criarPortaHttp} from "../../../src/ui/api/http.js";
import {PlanoFlashEntrada} from "../../../src/server/flash.js";
import {ActionIntent} from "../../../src/contracts/operacao.js";
import {criarGateway,memoriaIdempotencia} from "../../../src/kernel/gateway/gateway.js";
import {criarExecutorImprimir} from "../../../src/kernel/gateway/executores/imprimir.js";
import {criarResolverDocumentoLedger} from "../../../src/kernel/ledger/documentos.js";
import {autorizarSaida} from "../../../src/server/autorizacao.js";
import {readFileSync} from "node:fs";
import {abrirAmbiente,cadastrarPaciente,criarDiretorio,removerDiretorio,ENCONTRO,PACIENTE,SENHA} from "../../f0-fecha/fixtures/consulta-completa.js";
let ambiente:Awaited<ReturnType<typeof abrirAmbiente>>|undefined;
afterEach(async()=>{cleanup();vi.unstubAllGlobals();if(ambiente){await ambiente.close();removerDiretorio(ambiente.dir);ambiente=undefined;}});
it("decisão literal Pantoprazol + HMG/Cr + retorno14 entra em prévia, assinatura e tarefa sem inferir via/quantidade",async()=>{
  ambiente=await abrirAmbiente(criarDiretorio());cadastrarPaciente(ambiente);
  const transporte=globalThis.fetch,baseUrl=ambiente.baseUrl,chamadas:{path:string;body:Record<string,unknown>}[]=[];
  vi.stubGlobal("fetch",(input:Parameters<typeof fetch>[0],init?:Parameters<typeof fetch>[1])=>{
    const url=typeof input==="string"&&input.startsWith("/")?`${baseUrl}${input}`:input;
    chamadas.push({path:new URL(String(url)).pathname,body:typeof init?.body==="string"?JSON.parse(init.body) as Record<string,unknown>:{}});return transporte(url,init);
  });
  const porta=criarPortaHttp({onSessaoExpirada:()=>{throw Error("SESSAO_EXPIRADA");}});expect((await porta.login(SENHA)).ok).toBe(true);
  render(<ConsultaPersistida porta={porta} contexto={{patientId:PACIENTE,encounterId:ENCONTRO,tumorLotId:null}}/>);
  let cliques=0;const clicar=(e:HTMLElement)=>{cliques++;fireEvent.click(e);};
  clicar(await screen.findByRole("button",{name:"Consulta Flash"}));
  expect((screen.getByRole("checkbox",{name:"Incluir receita digitada"}) as HTMLInputElement).checked).toBe(false);
  fireEvent.change(screen.getByLabelText("Medicamento da receita"),{target:{value:"Pantoprazol"}});
  fireEvent.change(screen.getByLabelText("Dose da receita"),{target:{value:"40 mg"}});
  fireEvent.change(screen.getByLabelText("Orientação / posologia da receita"),{target:{value:"pela manhã"}});
  fireEvent.change(screen.getByLabelText("Duração da receita"),{target:{value:"30 dias"}});
  fireEvent.change(screen.getByLabelText("Outros LAB"),{target:{value:"HMG; Cr"}});
  fireEvent.change(screen.getByLabelText("Prazo do retorno em dias"),{target:{value:"14"}});
  clicar(screen.getByRole("checkbox",{name:"Incluir receita digitada"}));
  clicar(screen.getByRole("button",{name:"Revisar documentos para assinatura"}));
  const preview=await screen.findByRole("region",{name:"Conteúdo para assinatura"});
  expect(preview.textContent).toContain("Pantoprazol");expect(preview.textContent).toContain("40 mg");expect(preview.textContent).toContain("pela manhã");expect(preview.textContent).toContain("30 dias");
  expect(preview.textContent).toContain("Via: PENDENTE");expect(preview.textContent).toContain("Quantidade: PENDENTE");expect(preview.textContent).not.toContain("oral");
  expect(preview.textContent).toContain("Exame: HMG");expect(preview.textContent).toContain("Exame: Cr");expect(preview.textContent).toContain("Retorno em 14 dias");
  expect(ambiente.eventos().filter(e=>e.revisao==="ASSINADO")).toHaveLength(0);
  const enviado=chamadas.find(c=>c.path==="/consulta/flash/preparar")!.body.plano as {receitas:{id:string;medicamento:string;dose:string;orientacao:string;duracao:string;via:null;quantidade:null}[];receitasMarcadas:string[]};
  expect(enviado.receitas[0]).toMatchObject({medicamento:"Pantoprazol",dose:"40 mg",orientacao:"pela manhã",duracao:"30 dias",via:null,quantidade:null});expect(enviado.receitasMarcadas).toEqual([enviado.receitas[0]!.id]);
  clicar(within(preview).getByRole("button",{name:"Confirmar e assinar conteúdo exibido"}));
  await waitFor(()=>expect(ambiente!.eventos().filter(e=>e.tipo==="DOCUMENTO"&&e.revisao==="ASSINADO")).toHaveLength(5));
  await waitFor(()=>expect(screen.getByRole("region",{name:"Histórico de documentos assinados"}).textContent).toContain("Pantoprazol"));
  const eventos=ambiente.eventos(),assinados=eventos.filter(e=>e.tipo==="DOCUMENTO"&&e.revisao==="ASSINADO").map(e=>JSON.stringify(e));
  expect(eventos.some(e=>e.tipo==="Tarefa")).toBe(true);
  clicar(screen.getByRole("button",{name:"Reabrir histórico"}));
  await screen.findByRole("button",{name:/Reimprimir versão 1.*Receita/i});
  expect(cliques).toBe(5);expect(ambiente.eventos().filter(e=>e.tipo==="DOCUMENTO"&&e.revisao==="ASSINADO").map(e=>JSON.stringify(e))).toEqual(assinados);
  const receitaBotao=screen.getByRole("button",{name:/Reimprimir versão 1.*Receita/i});fireEvent.click(receitaBotao);
  await waitFor(()=>expect(chamadas.filter(c=>c.path==="/acao")).toHaveLength(2));
  expect(chamadas.filter(c=>c.path==="/acao").at(-1)?.body.escopo).toEqual({patientId:PACIENTE,encounterId:ENCONTRO});
  expect(chamadas.filter(c=>c.path==="/consulta/confirmar")).toHaveLength(1);
  // A fixture HTTP não tem executor. Aqui exercitamos o gateway e resolver reais
  // sobre os documentos assinados pela própria UI, sem simular impressão física.
  const gateway=criarGateway({agora:()=>"2026-10-09T12:00:00-03:00",store:memoriaIdempotencia(),auditar:()=>{},executores:{IMPRIMIR:criarExecutorImprimir({dataDir:ambiente.dir,agora:()=>"2026-10-09T12:00:00-03:00",resolverDocumento:criarResolverDocumentoLedger(ambiente.db)})}});
  for(const pedido of chamadas.filter(c=>c.path==="/acao")){
    const intent=ActionIntent.parse(pedido.body);expect(autorizarSaida(ambiente.db,intent)).toEqual({ok:true});
    const r=await gateway.executar(intent,ambiente.sessoes.obter(ambiente.token)!);expect(r.decisao).toBe("EXECUTADA");expect(r.recibo).toBeTruthy();
    const html=readFileSync(r.recibo!,"utf8");expect(html).toContain("Pantoprazol");expect(html).toContain("40 mg");expect(html).toContain("PENDENTE");
    expect((await gateway.executar(intent,ambiente.sessoes.obter(ambiente.token)!)).decisao).toBe("REPLAY");
  }
  expect(ambiente.eventos().filter(e=>e.tipo==="DOCUMENTO"&&e.revisao==="ASSINADO").map(e=>JSON.stringify(e))).toEqual(assinados);
});
it("contrato manual rejeita autoridade do payload, ID duplicado e valor vazio selecionado",()=>{
  const receita={id:"receita_manual",medicamento:"Pantoprazol",dose:"40 mg",orientacao:"manhã",duracao:"30 dias",via:null,quantidade:null};
  const plano={acoesMarcadas:[],receitasMarcadas:[receita.id],receitas:[receita],apac:{cid:"",sigtap:"",finalidade:"",competencia:"",estado:"PENDENTE",pendencias:[],emitir:false},retorno:{dias:14,examesAntesDoRetorno:[]}};
  expect(PlanoFlashEntrada.safeParse(plano).success).toBe(true);
  expect(PlanoFlashEntrada.safeParse({...plano,receitas:[{...receita,medicoId:"payload"}]}).success).toBe(false);
  expect(PlanoFlashEntrada.safeParse({...plano,receitas:[receita,receita]}).success).toBe(false);
  expect(PlanoFlashEntrada.safeParse({...plano,receitas:[{...receita,medicamento:""}]}).success).toBe(false);
});
