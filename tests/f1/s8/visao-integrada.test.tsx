// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { VisaoIntegradaMinima } from "../../../src/ui/consulta/VisaoIntegradaMinima.js";
import { ConsultaPersistida } from "../../../src/ui/consulta/ConsultaPersistida.js";
import { ConsultaResposta } from "../../../src/ui/api/respostas.js";
import { criarPortaFalsa, ID } from "../../../src/ui/api/fake.js";
import type { Retrato } from "../../../src/contracts/f1/retrato.js";
import type { VisaoIntegrada } from "../../../src/contracts/f1/visaoIntegrada.js";
import type { PlanoFlash } from "../../../src/ui/consulta/ConsultaFlash.js";
afterEach(cleanup);
const ref={eventId:"evento-lab",revisao:"hash-fato"};
function retrato(patientId="p1",encounterId="e1",tumorLotId:string|null="t1"):Retrato {
  return {schema:"Retrato@1",patientId,encounterId,tumorLotId,revisao:"hash-retrato",versaoProjecao:"1",geradoEm:"2026-10-12T12:00:00-03:00",regras:[],
    biblioteca:{id:"b",versao:"1",hash:"hash-b"},integridade:[],delta:{encounterAnteriorId:null,novos:[],substituidos:[]},
    fatos:[{ref,tipo:"FATO",campo:"extracao.lab:HB",patientId,encounterId,tumorLotId,escopo:"PACIENTE",tempoClinico:"2026-10-10",tempoRegistro:"2026-10-12T12:00:00-03:00",dados:{valor:9},
      fontes:[{sourceId:"fonte-HMG",classe:"LAB_FEED",localizador:"página 2",dataClinica:"2026-10-10",dataCaptura:"2026-10-12T12:00:00-03:00",versao:"1",contentHash:"h"}]}],
    resumo:[{texto:"Hemoglobina: 9 g/dL.",fatos:[ref]}]};
}
function visao(r:Retrato):VisaoIntegrada {
  return {schema:"VisaoIntegrada@1",correlacao:{patientId:r.patientId,encounterId:r.encounterId,tumorLotId:r.tumorLotId,operationId:"op",revisaoFatos:r.revisao,regras:r.regras,biblioteca:r.biblioteca,proposta:null},
    achados:[{id:"risco",estado:"PENDENTE",texto:"Anemia e avaliação do tratamento precisam de revisão.",fatos:[ref],regras:[],setores:["LABORATORIO","TRATAMENTO"]}],
    lacunas:[{codigo:"FEVE",texto:"FEVE não disponível.",setor:"COMORBIDADES",fatos:[]}],
    cobertura:{setoresEsperados:["LABORATORIO","IMAGEM","PATOLOGIA","COMORBIDADES","INTERACOES","TOXICIDADES","TRATAMENTO"],setoresAvaliados:["LABORATORIO"],avaliados:1,semRegraAprovada:6}};
}
it("mostra resumo, avaliação transversal primeiro, cobertura e sete setores expansíveis",()=>{
  const r=retrato();render(<VisaoIntegradaMinima retrato={r} visao={visao(r)}/>);
  expect(screen.getByText("Hemoglobina: 9 g/dL.")).toBeTruthy();
  expect(screen.getByLabelText("Cobertura").textContent).toContain("1 de 7");
  expect(screen.getAllByText(/FEVE não disponível/).length).toBe(2);
  expect(document.querySelectorAll("details")).toHaveLength(10);
  const lacunas = screen.getByText("Lacunas · 1 para conferir").closest("details")!;
  expect(lacunas.open).toBe(false);
  fireEvent.click(screen.getByText("Lacunas · 1 para conferir"));
  expect(lacunas.open).toBe(true); expect(lacunas.textContent).toContain("FEVE não disponível.");
  const citacao=screen.getAllByRole("link",{name:"evento-lab"})[0]!;fireEvent.click(citacao);
  expect(screen.getByText(/Fonte fonte-HMG/).closest("details")?.open).toBe(true);
  expect(document.getElementById(citacao.getAttribute("href")!.slice(1))?.textContent).toContain("página 2");
});
it("rejeita avaliação de revisão antiga sem exibir texto clínico",()=>{
  const r=retrato(),v=visao(r);v.correlacao.revisaoFatos="antiga";
  render(<VisaoIntegradaMinima retrato={r} visao={v}/>);
  expect(screen.getByRole("alert").textContent).toContain("divergentes");expect(screen.queryByText("Hemoglobina: 9 g/dL.")).toBeNull();
});
it("dados faltantes permanecem lacuna explícita",()=>{
  render(<VisaoIntegradaMinima/>);expect(screen.getByText(/fatos confirmados indisponíveis/)).toBeTruthy();
});
it("DTO preserva campos tipados e rejeita contexto, revisão e referência divergentes",async()=>{
  const porta=criarPortaFalsa();const encontro=(await porta.agendaDoDia()).itens.find(i=>i.patientId===ID.verde)!.encounterId;
  const base=await porta.carregarConsulta(ID.verde,undefined,encontro);const r=retrato(base.patientId,base.encounterId,base.tumorLotId),v=visao(r);
  expect(ConsultaResposta.parse({...base,retrato:r,visaoIntegrada:v}).retrato?.revisao).toBe(r.revisao);
  expect(ConsultaResposta.safeParse({...base,retrato:{...r,patientId:"outro"},visaoIntegrada:v}).success).toBe(false);
  expect(ConsultaResposta.safeParse({...base,retrato:r,visaoIntegrada:{...v,correlacao:{...v.correlacao,revisaoFatos:"antiga"}}}).success).toBe(false);
  expect(ConsultaResposta.safeParse({...base,retrato:{...r,resumo:[{texto:"frase sem fato",fatos:[{...ref,eventId:"ausente"}]}]},visaoIntegrada:v}).success).toBe(false);
});
it("trocar contexto limpa a visão integrada anterior enquanto a nova resposta não chega",async()=>{
  const porta=criarPortaFalsa();const encontro=(await porta.agendaDoDia()).itens.find(i=>i.patientId===ID.verde)!.encounterId;
  const base=await porta.carregarConsulta(ID.verde,undefined,encontro);const r=retrato(base.patientId,base.encounterId,base.tumorLotId);
  const carregar=porta.carregarConsulta.bind(porta);porta.carregarConsulta=async (p,t,e)=>p===base.patientId?{...base,retrato:r,visaoIntegrada:visao(r)}:new Promise(()=>{});
  const tela=render(<ConsultaPersistida porta={porta} contexto={{patientId:base.patientId,encounterId:base.encounterId,tumorLotId:base.tumorLotId}}/>);
  await screen.findByText("Hemoglobina: 9 g/dL.");
  tela.rerender(<ConsultaPersistida porta={porta} contexto={{patientId:"outro",encounterId:"outra",tumorLotId:null}}/>);
  expect(screen.queryByText("Hemoglobina: 9 g/dL.")).toBeNull();porta.carregarConsulta=carregar;
});
const plano:PlanoFlash={acoesMarcadas:[],receitasMarcadas:[],apac:{cid:"C50",sigtap:"030401",finalidade:"tratamento",competencia:"2026-10",estado:"PENDENTE",pendencias:[],emitir:false},retorno:{dias:21,examesAntesDoRetorno:[]}};
it("fake atravessa preparação, bundle/hash, assinatura, impressão e reload com replay sem duplicar histórico",async()=>{
  const porta=criarPortaFalsa(),ctx={patientId:ID.verde,encounterId:"en-verde",tumorLotId:"lot-verde"};
  const pedido={...ctx,plano,idempotencyKey:"preparar-flash-real-fake"};
  const p=await porta.prepararFinalizacaoFlash!(pedido);
  expect(await porta.prepararFinalizacaoFlash!(pedido)).toEqual(p);
  const bundle=await porta.exibirBundle({...ctx,draftIds:p.registros.map(r=>r.id)});
  expect(bundle.documentos).toHaveLength(p.documentos.length);expect(bundle.documentos[0]?.conteudoHash).toMatch(/^[a-f0-9]{64}$/);
  const confirmar={...ctx,bloco:"TUDO" as const,registros:[...p.registros],documentosExibidos:p.documentos.map(d=>({documentId:d.documentId,documentVersion:d.documentVersion})),reconhecerAlertas:[],idempotencyKey:"assinar-flash-real-fake"};
  expect((await porta.confirmar(confirmar)).codigo).toBe("GRAVADA");expect((await porta.confirmar(confirmar)).codigo).toBe("REPLAY");
  const impressao={verbo:"IMPRIMIR" as const,objeto:{tipo:"DOCUMENTO",id:p.documentos[0]!.documentId,versao:p.documentos[0]!.documentVersion},escopo:{patientId:ctx.patientId,encounterId:ctx.encounterId},destino:null,idempotencyKey:"imprimir-flash-real-fake"};
  expect((await porta.acao(impressao)).decisao).toBe("EXECUTADA");expect((await porta.acao(impressao)).decisao).toBe("REPLAY");
  const recarregada=await porta.carregarConsulta(ctx.patientId,ctx.tumorLotId,ctx.encounterId);
  expect(recarregada.historicoDocumentos).toHaveLength(1);expect(recarregada.historicoDocumentos?.[0]).toMatchObject({documentId:p.documentos[0]!.documentId,documentVersion:1,encounterId:ctx.encounterId,tumorLotId:ctx.tumorLotId});
  await expect(porta.prepararFinalizacaoFlash!({...pedido,plano:{...plano,retorno:{dias:7,examesAntesDoRetorno:[]}}})).rejects.toThrow("IDEMPOTENCY_CONFLICT");
  await expect(porta.acao({...impressao,escopo:{...impressao.escopo,encounterId:"encontro-outro"},idempotencyKey:"outro-print-key"})).rejects.toThrow("DOCUMENTO_ASSINADO_AUSENTE");
});
it("histórico reimprime versão e encontro originais sem nova assinatura",async()=>{
  const porta=criarPortaFalsa(),base=await porta.carregarConsulta(ID.verde,undefined,"en-verde");
  porta.carregarConsulta=async()=>({...base,historicoDocumentos:[{eventId:"event-original",documentId:"doc-original",documentVersion:3,titulo:"Evolução original",texto:"Conteúdo assinado preservado",assinadoEm:"2026-09-01T10:00:00-03:00",autorId:"m",encounterId:"consulta-original",tumorLotId:"tumor-original"}]});
  const imprimir=vi.fn(async(_intent:Parameters<typeof porta.acao>[0])=>({codigo:"IMPRIMIR",decisao:"EXECUTADA" as const}));porta.acao=imprimir;
  const confirmar=vi.spyOn(porta,"confirmar");
  render(<ConsultaPersistida porta={porta} contexto={{patientId:base.patientId,encounterId:base.encounterId,tumorLotId:base.tumorLotId}}/>);
  fireEvent.click(await screen.findByRole("button",{name:"Reimprimir versão 3 · Evolução original"}));
  await screen.findByText(/Reimpressão solicitada/);
  expect(imprimir.mock.calls[0]?.[0]).toMatchObject({verbo:"IMPRIMIR",objeto:{tipo:"DOCUMENTO",id:"doc-original",versao:3},escopo:{patientId:base.patientId,encounterId:"consulta-original"}});
  expect(confirmar).not.toHaveBeenCalled();
});
