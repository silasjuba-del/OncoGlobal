import { afterEach, expect, it } from "vitest";
import { abrirIntegracao, prescreverSintetico, AGORA } from "../fixtures/integracao-operacional.js";
const ambientes: Awaited<ReturnType<typeof abrirIntegracao>>[] = [];
afterEach(async () => { for (const a of ambientes.splice(0)) await a.finalizar(); });
it("F4 HTTP prepara, recupera e assina laudo com fonte vinculada, sem assinar na preparação", async () => {
  const a = await abrirIntegracao(); ambientes.push(a);
  a.seed("FATO", { campo: "diagnostico", valor: "Diagnóstico sintético confirmado", dataClinica: AGORA.slice(0, 10) });
  await prescreverSintetico(a);
  const post = (acao: string, resto = {}) => a.request("/consulta/laudo-acesso", { acao, contexto: a.contexto, ...resto });
  const base = await post("BASE"); expect(base.status).toBe(200); expect(base.data.fontes.length).toBeGreaterThan(0);
  const pedido = { baseHash: base.data.baseHash, pedidoId: "laudo-sintetico", medicamento: { nome: "Medicamento sintético", posologiaPlanejada: "Conforme prescrição assinada", duracaoPrevista: "Conforme plano sintético" },
    indicacao: "Solicitação médica sintética fundamentada na fonte selecionada.", citacoesIds: [base.data.fontes[0].citacaoId] };
  const r = await post("PREPARAR", pedido); expect(r.status).toBe(200); expect(r.data.minuta.revisao).toBe("REVISAR");
  expect(r.data.minuta.assinadoPorMedicoId).toBeNull();
  expect((await post("PREPARAR", pedido)).data.minuta.minutaId).toBe(r.data.minuta.minutaId);
  expect((await post("PREPARAR", { ...pedido, indicacao: "Mudou" })).status).toBe(409);
  const id = r.data.minuta.minutaId;
  const aberto = await post("ABRIR", { minutaId: id }); expect(aberto.data.conteudoHash).toBe(r.data.conteudoHash);
  expect((await post("ASSINAR", { minutaId: id, conteudoHash: "0".repeat(64) })).status).toBe(409);
  const assinado = await post("ASSINAR", { minutaId: id, conteudoHash: r.data.conteudoHash });
  expect(assinado.status).toBe(200); expect(assinado.data.minuta.revisao).toBe("ASSINADO");
  expect(assinado.data.minuta.assinadoPorCrm).toBe(a.sessoes.obter(a.token)!.crm);
  expect((await post("BASE")).data.historico[0].revisao).toBe("ASSINADO");
  const outro = { ...a.contexto, encounterId: "outro-encontro-sintetico" };
  a.sessoes.selecionarConsulta(a.token, outro);
  expect((await a.request("/consulta/laudo-acesso", { acao: "ABRIR", contexto: outro, minutaId: id })).status).toBe(409);
});
it("F4 HTTP não prepara laudo sem prescrição assinada nem aceita contexto trocado", async () => {
  const a = await abrirIntegracao(); ambientes.push(a);
  expect((await a.request("/consulta/laudo-acesso", { acao: "BASE", contexto: { ...a.contexto, patientId: "outro" } })).status).toBe(409);
  const base = await a.request("/consulta/laudo-acesso", { acao: "BASE", contexto: a.contexto });
  expect(base.status).toBe(200); expect(base.data.pendencias).toContain("Prescrição assinada não disponível neste encontro.");
});
