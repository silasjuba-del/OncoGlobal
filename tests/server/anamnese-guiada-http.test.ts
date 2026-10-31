// proveniência: dados sintéticos — não utilizar em produção
import { createHash } from "node:crypto";
import { afterEach, expect, it } from "vitest";
import { abrirIntegracao, AGORA } from "../fixtures/integracao-operacional.js";
import { receberTransporteSintetico, registrarConsentimentoCanal, revogarConsentimentoCanal } from "../../src/server/canalEntrada.js";
const ambientes: Awaited<ReturnType<typeof abrirIntegracao>>[] = [];
afterEach(async () => { for (const a of ambientes.splice(0)) await a.finalizar(); });
it("F5 HTTP confere roteiro por ação médica, preserva conflito e fonte literal e respeita revogação", async () => {
  const a = await abrirIntegracao(); ambientes.push(a);
  const contato = "+55-00-0000-0000".replace(/[ -]/g, ""), acesso = { sessoes: a.sessoes, token: a.token, agora: AGORA };
  a.seed("Contato", { contatoId: "contato-anamnese-sintetico", canal: "WHATSAPP_SERVICO", endereco: contato,
    patientId: a.contexto.patientId, relacao: "PACIENTE", vinculadoEm: AGORA, revogadoEm: null });
  for (const [i, texto] of ["Não estou com dor.", "Estou com dor."].entries()) {
    const r = receberTransporteSintetico(a.db, { accountId: "conta-anamnese-sintetica", canal: "WHATSAPP_SERVICO", providerMessageId: `mensagem-${i}`,
      senderRef: contato, providerSentAt: AGORA, ingestedAt: AGORA,
      conteudo: { tipo: "TEXT", texto, contentSha256: createHash("sha256").update(texto).digest("hex") },
      cadastros: [{ patientId: a.contexto.patientId, nome: "Paciente sintético", chaveDemografica: null, identificadores: [{ tipo: "TELEFONE", valor: contato }] }] });
    expect(r.ok).toBe(true);
  }
  const post = (acao: string, resto = {}) => a.request("/consulta/anamnese-guiada", { acao, contexto: a.contexto, ...resto });
  const antes = await post("BASE"); expect(antes.status).toBe(200); expect(antes.data.mensagens).toEqual([]);
  expect(registrarConsentimentoCanal(a.db, acesso, { contatoId: contato, patientId: a.contexto.patientId,
    referenciaTermo: "termo-sintetico", versaoTermo: "1", finalidade: ["COMUNICACAO_CLINICA"], origem: "PRESENCIAL_CONSULTORIO" }).ok).toBe(true);
  const criado = await post("CONFERIR_ROTEIRO", { tumorPackId: antes.data.packs[0].id, contextoClinico: "PRIMEIRA_CONSULTA", perguntas: ["Como está a dor?"] });
  expect(criado.status).toBe(200); expect(criado.data.roteiros[0].aprovadoPor).toBe(a.sessoes.obter(a.token)!.medicoId);
  expect(criado.data.mensagens).toHaveLength(2);
  const pedido = { roteiroId: criado.data.roteiros[0].roteiroId, contatoId: contato, pedidoId: "resumo-sintetico",
    respostas: criado.data.mensagens.map((m: { mensagemId: string; texto: string }) => ({ passoId: "passo-1", mensagemId: m.mensagemId,
      polaridade: m.texto.startsWith("Não") ? "NEGADO" : "AFIRMADO" })) };
  const r = await post("COMPILAR", pedido); expect(r.status).toBe(200);
  expect(r.data.resumo.respostasOriginais).toHaveLength(2); expect(r.data.resumo.negacoesPreservadas).toHaveLength(1);
  expect(r.data.resumo.incertezasExplicitas.join(" ")).toContain("A CONFERIR"); expect(r.data.resumo.revisao).toBe("REVISAR");
  expect((await post("COMPILAR", pedido)).data.resumo.sessaoAnamneseId).toBe(r.data.resumo.sessaoAnamneseId);
  expect((await post("COMPILAR", { ...pedido, respostas: [] })).status).toBe(409);
  expect((await post("BASE")).data.historico).toHaveLength(1);
  expect(revogarConsentimentoCanal(a.db, acesso, { contatoId: contato, patientId: a.contexto.patientId, origem: "REVOGACAO_MEDICO" }).ok).toBe(true);
  expect((await post("COMPILAR", { ...pedido, pedidoId: "apos-revogacao" })).status).toBe(409);
  expect((await post("BASE")).data.mensagens).toEqual([]);
});
