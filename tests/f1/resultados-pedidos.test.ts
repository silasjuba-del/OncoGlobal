import { describe, expect, it } from "vitest";
import { Tarefa, type AcompanhamentoPedido } from "../../src/contracts/f1/tarefa.js";
import { atualizarResultadoPedido } from "../../src/modules/agenda/tarefas.js";

const pedido = {documentId:"pedido-sintetico",documentVersion:1};
const contexto = {patientId:"paciente-A",encounterId:"retorno-A",tumorLotId:"tumor-A",atorId:"medico",em:"2026-10-31T12:00:00Z"};
const tarefa = () => Tarefa.parse({tarefaId:"tarefa",patientId:"paciente-A",encounterId:"consulta-A",tumorLotId:"tumor-A",operationId:"origem",titulo:"Resultado",responsavel:"medico",prazo:null,estado:"CONFIRMADA",recebidoEm:null,criadoPor:"medico",substituiTarefaId:null,pedidoRefs:[pedido]});
const realizado = ():AcompanhamentoPedido => ({pedido,estado:"REALIZADO",realizadoEm:"2026-10-31",resultado:null,disponivelEm:null,revisadoEm:null,revisadoPor:null});
const fonte = {draftId:"fonte",revision:1,sourceId:"source",hash:"a".repeat(64),encounterId:"retorno-A"};
describe("Pedido e resultado longitudinal",()=>{
 it("percorre os quatro estados preservando o pedido original",()=>{
  const t=tarefa(); expect(t.acompanhamentoPedidos).toEqual([]);
  const a=atualizarResultadoPedido(t,contexto,realizado()); if(!a.ok)throw Error(a.codigo);
  const b=atualizarResultadoPedido(a.tarefa,contexto,{...realizado(),estado:"RESULTADO_DISPONIVEL",resultado:fonte,disponivelEm:contexto.em}); if(!b.ok)throw Error(b.codigo);
  const c=atualizarResultadoPedido(b.tarefa,contexto,{...b.tarefa.acompanhamentoPedidos[0]!,estado:"REVISADO",revisadoEm:contexto.em,revisadoPor:contexto.atorId}); if(!c.ok)throw Error(c.codigo);
  expect(c.tarefa.encounterId).toBe("consulta-A"); expect(c.tarefa.atualizadoNoEncontroId).toBe("retorno-A");
  expect(c.tarefa.pedidoRefs).toEqual([pedido]); expect(t.acompanhamentoPedidos).toEqual([]);
  expect(Tarefa.parse(JSON.parse(JSON.stringify(c.tarefa)))).toEqual(c.tarefa);
 });
 it("recusa outro paciente e outro tumor",()=>{
  expect(atualizarResultadoPedido(tarefa(),{...contexto,patientId:"paciente-B"},realizado()).ok).toBe(false);
  expect(atualizarResultadoPedido(tarefa(),{...contexto,tumorLotId:"tumor-B"},realizado()).ok).toBe(false);
 });
 it("recusa salto de estado, pedido estranho e tarefa cancelada",()=>{
  expect(atualizarResultadoPedido(tarefa(),contexto,{...realizado(),estado:"REVISADO"}).ok).toBe(false);
  expect(atualizarResultadoPedido(tarefa(),contexto,{...realizado(),pedido:{...pedido,documentId:"outro"}}).ok).toBe(false);
  expect(atualizarResultadoPedido({...tarefa(),estado:"CANCELADA"},contexto,realizado()).ok).toBe(false);
 });
 it("recusa resultado de outro encontro e revisão por outro autor",()=>{
  const a=atualizarResultadoPedido(tarefa(),contexto,realizado()); if(!a.ok)throw Error(a.codigo);
  const disponivel={...realizado(),estado:"RESULTADO_DISPONIVEL" as const,resultado:fonte,disponivelEm:contexto.em};
  expect(atualizarResultadoPedido(a.tarefa,contexto,{...disponivel,resultado:{...fonte,encounterId:"outro"}}).ok).toBe(false);
  const b=atualizarResultadoPedido(a.tarefa,contexto,disponivel); if(!b.ok)throw Error(b.codigo);
  expect(atualizarResultadoPedido(b.tarefa,contexto,{...disponivel,estado:"REVISADO",revisadoEm:contexto.em,revisadoPor:"outro"}).ok).toBe(false);
 });
 it("conclusão administrativa não significa resultado revisado",()=>{
  const r=atualizarResultadoPedido({...tarefa(),estado:"CONCLUIDA"},contexto,realizado());
  expect(r.ok).toBe(true); if(r.ok)expect(r.tarefa.acompanhamentoPedidos[0]?.estado).toBe("REALIZADO");
 });
});

it('revisão posterior preserva a fonte já vinculada sem aceitar sua substituição',()=>{
 const a=atualizarResultadoPedido(tarefa(),contexto,realizado());if(!a.ok)throw Error(a.codigo);
 const disponivel={...realizado(),estado:'RESULTADO_DISPONIVEL' as const,resultado:fonte,disponivelEm:contexto.em};
 const b=atualizarResultadoPedido(a.tarefa,contexto,disponivel);if(!b.ok)throw Error(b.codigo);
 const posterior={...contexto,encounterId:'retorno-posterior',em:'2026-11-01T12:00:00Z'};
 const revisado={...disponivel,estado:'REVISADO' as const,revisadoEm:posterior.em,revisadoPor:posterior.atorId};
 const c=atualizarResultadoPedido(b.tarefa,posterior,revisado);expect(c.ok).toBe(true);
 if(c.ok){expect(c.tarefa.acompanhamentoPedidos[0]?.resultado).toEqual(fonte);expect(c.tarefa.atualizadoNoEncontroId).toBe(posterior.encounterId);}
 expect(atualizarResultadoPedido(b.tarefa,posterior,{...revisado,resultado:{...fonte,hash:'b'.repeat(64)}}).ok).toBe(false);
});
