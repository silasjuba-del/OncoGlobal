import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, expect, it, vi } from "vitest";
import { AutorizacaoRespostaCanalServidor, RascunhoRespostaCanal } from "../../../src/contracts/f2/caixaRespostaCanal.js";
import { abrirLedger } from "../../../src/kernel/ledger/db.js";
import { receberTransporteSintetico, registrarConsentimentoCanal, revogarConsentimentoCanal } from "../../../src/server/canalEntrada.js";
import { confirmarRespostaCanalPeloMedico, executarEnvioAutorizadoCanal, prepararRascunhoRespostaCanal, revalidarAutorizacaoSaidaCanalNoLedger, invalidarRespostasPorMudancaContextoCanal } from "../../../src/server/canalResposta.js";
import { criarGerenciadorSessao } from "../../../src/server/sessao.js";
import { ambiente, ctx, EM } from "../../bateria2/fixtures.js";

const DEPOIS = "2026-10-19T18:01:00.000Z";
const SENDER = "5500" + "000007777";
const contexto = { ...ctx, revisaoContexto: "revisao-sintetica-proveniencia" };
const bancos: DatabaseSync[] = [], pastas: string[] = [];
function acessoB() {
  const sessoes = criarGerenciadorSessao({ medicoId: "medico-b-sintetico", crm: "CRM-B-SINTETICO", senha: "senha-sintetica-proveniencia", duracaoMs: 300000, agora: () => DEPOIS });
  return { sessoes, token: sessoes.login("senha-sintetica-proveniencia")!.token, agora: DEPOIS };
}
function preparar() {
  const pasta = mkdtempSync(join(tmpdir(), "pr27-autorizacao-proveniencia-")); pastas.push(pasta);
  const caminho = join(pasta, "ledger.sqlite"), a = ambiente(caminho); bancos.push(a.db);
  a.seed("Paciente", { patientId: ctx.patientId, nome: "Paciente Sintetico Proveniencia", identificadores: [], nascimento: null, sexoCadastral: "NAO_INFORMADO", divergencia: false });
  const contato = { contatoId: "contato-sintetico", canal: "WHATSAPP_SERVICO", endereco: SENDER, patientId: ctx.patientId, relacao: "PACIENTE", vinculadoEm: EM, revogadoEm: null };
  a.seed("Contato", contato);
  const recebido = receberTransporteSintetico(a.db, { accountId: "wpp-sintetico", canal: "WHATSAPP_SERVICO", providerMessageId: "mensagem-sintetica", senderRef: SENDER, providerSentAt: EM, ingestedAt: EM,
    conteudo: { tipo: "TEXT", texto: "Quando e o retorno?", contentSha256: createHash("sha256").update("Quando e o retorno?").digest("hex") },
    cadastros: [{ patientId: ctx.patientId, nome: "Paciente Sintetico Proveniencia", chaveDemografica: null, identificadores: [{ tipo: "TELEFONE", valor: SENDER }] }] });
  if (!recebido.ok) throw Error("INGRESSO_SINTETICO_FALHOU");
  const termo = { contatoId: SENDER, patientId: ctx.patientId, referenciaTermo: "termo-sintetico", versaoTermo: "1", finalidade: ["COMUNICACAO_CLINICA" as const], origem: "PRESENCIAL_CONSULTORIO" as const };
  expect(registrarConsentimentoCanal(a.db, a.acesso, termo).ok).toBe(true);
  const entrada = { respostaId: "resposta-proveniencia", versao: 1, mensagemOrigemId: recebido.reciboId, contexto, tipoResposta: "RESPOSTA_LIVRE_MEDICA" as const, texto: "Retorno na quinta-feira." };
  const preparado = prepararRascunhoRespostaCanal(a.db, a.acesso, entrada);
  if (!preparado.ok) throw Error("RASCUNHO_SINTETICO_FALHOU");
  const pedido = { respostaId: entrada.respostaId, versao: 1, comprovanteExibicao: { destinatario: preparado.rascunho.destinatario, conteudoSha256: preparado.rascunho.conteudoSha256, contexto } };
  const intent = { verbo: "ENVIAR_WHATSAPP" as const, objeto: { tipo: "MENSAGEM_CANAL", id: entrada.respostaId, versao: 1 }, escopo: { patientId: ctx.patientId, encounterId: ctx.encounterId }, destino: SENDER, idempotencyKey: "envio-sintetico-proveniencia" };
  const snapshot = (db = a.db) => ({
    aut: db.prepare("SELECT * FROM canal_resposta_autorizada ORDER BY versao").all(),
    rascunho: db.prepare("SELECT * FROM canal_resposta_rascunho ORDER BY versao").all(),
    envios: db.prepare("SELECT * FROM canal_resposta_envio").all(),
    recibos: db.prepare("SELECT * FROM canal_recibo_tecnico").all(),
  });
  return { ...a, caminho, contato, termo, entrada, pedido, intent, snapshot };
}
function confirmar(a: ReturnType<typeof preparar>) {
  const r = confirmarRespostaCanalPeloMedico(a.db, a.acesso, a.pedido);
  expect(r.ok).toBe(true); return r;
}

it.each(["sql","json","contrato","tabela-ausente"])("revogação indeterminada (%s) bloqueia autorização e envio sem declarar revogação",async caso=>{
 const a=preparar();confirmar(a);const antes=a.snapshot();
 if(caso==="tabela-ausente")a.db.exec("ALTER TABLE clinical_event RENAME TO clinical_event_indisponivel_sintetico");
 const original=a.db.prepare.bind(a.db);
 vi.spyOn(a.db,"prepare").mockImplementation(sql=>{
  if(sql.includes("SELECT payload FROM clinical_event WHERE tipo = 'Contato'")){
   if(caso==="sql")throw Error("falha sintética de leitura");
   if(caso==="json")return original("SELECT '{json-invalido' AS payload");
   if(caso==="contrato")return original("SELECT '{}' AS payload");
  }
  return original(sql);
 });
 const rev=revalidarAutorizacaoSaidaCanalNoLedger(a.db,a.intent);
 expect(rev).toEqual({ok:false,codigo:"CONTATO_REVOGACAO_INDISPONIVEL"});
 expect(confirmarRespostaCanalPeloMedico(a.db,a.acesso,a.pedido)).toMatchObject({ok:false,codigo:"ARMAZENAMENTO_INDISPONIVEL"});
 let efeitos=0;
 const envio=await executarEnvioAutorizadoCanal(a.db,a.acesso,{intent:a.intent,revisaoContextoAtual:contexto.revisaoContexto,
  transporteSaida:async()=>{efeitos++;return {ok:true,providerReceiptId:"nao-deve-enviar"};}});
 expect(envio.resultadoGateway.decisao).toBe("NEGADA");expect(efeitos).toBe(0);expect(a.snapshot()).toEqual(antes);
});
afterEach(() => {
  vi.restoreAllMocks();
  for (const db of bancos.splice(0)) { try { db.close(); } catch { /* ja fechado */ } }
  for (const pasta of pastas.splice(0)) rmSync(pasta, { recursive: true, force: true });
});

it("retry por outro medico/data devolve autorizacao inicial e nao reescreve JSON ou autoria do rascunho", () => {
  const a = preparar(), original = confirmar(a), antes = a.snapshot();
  expect(confirmarRespostaCanalPeloMedico(a.db, acessoB(), a.pedido)).toEqual(original);
  expect(a.snapshot()).toEqual(antes);
  expect(original).toMatchObject({ autorizacao: { aprovadoPor: { medicoId: a.login.sessao.medicoId, crm: a.login.sessao.crm, em: EM } } });
  // UPDATEs que antes trocavam autoria agora sao impossiveis neste replay.
  a.db.exec("CREATE TRIGGER bloquear_update_aut BEFORE UPDATE ON canal_resposta_autorizada BEGIN SELECT RAISE(ABORT, 'aut imutavel'); END; CREATE TRIGGER bloquear_update_draft BEFORE UPDATE ON canal_resposta_rascunho BEGIN SELECT RAISE(ABORT, 'draft imutavel'); END");
  expect(confirmarRespostaCanalPeloMedico(a.db, acessoB(), a.pedido)).toEqual(original);
});

it("depois de efetivamente enviada e reaberta, reconfirmacao preserva autorizacao e recibos; nao reenvia", async () => {
  const a = preparar(), original = confirmar(a); let efeitos = 0;
  const transporteSaida = async () => { efeitos++; return { ok: true as const, providerReceiptId: "recibo-sintetico-proveniencia" }; };
  const enviado = await executarEnvioAutorizadoCanal(a.db, a.acesso, { intent: a.intent, revisaoContextoAtual: contexto.revisaoContexto, transporteSaida });
  expect(enviado.resultadoGateway.decisao).toBe("EXECUTADA"); expect(efeitos).toBe(1);
  const antes = a.snapshot(); a.db.close(); const db = abrirLedger(a.caminho); bancos.push(db);
  expect(confirmarRespostaCanalPeloMedico(db, acessoB(), a.pedido)).toEqual(original);
  expect(a.snapshot(db)).toEqual(antes);
  const replay = await executarEnvioAutorizadoCanal(db, acessoB(), { intent: { ...a.intent, idempotencyKey: "retry-outro-medico" }, revisaoContextoAtual: contexto.revisaoContexto, transporteSaida });
  expect(replay.resultadoGateway.decisao).toBe("REPLAY"); expect(efeitos).toBe(1);
  expect(a.snapshot(db)).toEqual(antes);
});

it.each(["mesmos-metadados", "novo-termo", "revogar-renovar"])("novo consentimento nao substitui snapshot antigo na mesma versao: %s", caso => {
  const a = preparar(), original = confirmar(a);
  if (caso === "revogar-renovar") expect(revogarConsentimentoCanal(a.db, acessoB(), { contatoId: SENDER, patientId: ctx.patientId, origem: "REVOGACAO_MEDICO" }).ok).toBe(true);
  expect(registrarConsentimentoCanal(a.db, caso === "mesmos-metadados" ? a.acesso : acessoB(), caso === "novo-termo" ? { ...a.termo, referenciaTermo: "termo-renovado", versaoTermo: "2" } : a.termo).ok).toBe(true);
  const antes = a.snapshot();
  expect(confirmarRespostaCanalPeloMedico(a.db, acessoB(), a.pedido)).toEqual({ ok: false, codigo: "CONSENTIMENTO_REVOGADO_OU_AUSENTE" });
  expect(a.snapshot()).toEqual(antes);
  expect(revalidarAutorizacaoSaidaCanalNoLedger(a.db, a.intent)).toEqual({ ok: false, codigo: "CONSENTIMENTO_REVOGADO_OU_AUSENTE" });
  const nova = prepararRascunhoRespostaCanal(a.db, acessoB(), { ...a.entrada, versao: 2 });
  expect(nova.ok).toBe(true); if (!nova.ok) throw Error("NOVA_VERSAO_FALHOU");
  const novaAut = confirmarRespostaCanalPeloMedico(a.db, acessoB(), { ...a.pedido, versao: 2, comprovanteExibicao: { destinatario: nova.rascunho.destinatario, conteudoSha256: nova.rascunho.conteudoSha256, contexto } });
  expect(novaAut).toMatchObject({ ok: true, autorizacao: { versao: 2, aprovadoPor: { medicoId: "medico-b-sintetico", em: DEPOIS } } });
  const row = a.db.prepare("SELECT autorizacaoJson FROM canal_resposta_autorizada WHERE versao=1").get() as { autorizacaoJson: string };
  expect(JSON.parse(row.autorizacaoJson)).toEqual(original.ok && original.autorizacao);
});

it.each(["consentimento", "contato", "contexto"])("replay nao contorna revogacao/invalidacao atual: %s", caso => {
  const a = preparar(); confirmar(a);
  if (caso === "consentimento") expect(revogarConsentimentoCanal(a.db, acessoB(), { contatoId: SENDER, patientId: ctx.patientId, origem: "REVOGACAO_MEDICO" }).ok).toBe(true);
  if (caso === "contato") a.seed("Contato", { ...a.contato, revogadoEm: DEPOIS });
  if (caso === "contexto") invalidarRespostasPorMudancaContextoCanal(a.db, ctx.patientId, ctx.encounterId);
  const antes = a.snapshot(), r = confirmarRespostaCanalPeloMedico(a.db, acessoB(), a.pedido);
  expect(r.ok).toBe(false); expect(a.snapshot()).toEqual(antes);
});

it.each(["accountId", "mensagemOrigemId", "texto", "contexto", "tipoResposta", "confirmadoPorMedicoId", "confirmadoPorCrm", "confirmadoEm"])("autorizacao anterior divergente do rascunho nao e replay: %s", campo => {
  const a = preparar(); confirmar(a);
  const row = a.db.prepare("SELECT rascunhoJson FROM canal_resposta_rascunho").get() as { rascunhoJson: string };
  const draft = RascunhoRespostaCanal.parse(JSON.parse(row.rascunhoJson));
  if (campo === "accountId") draft.accountId = "outra-conta";
  if (campo === "mensagemOrigemId") draft.mensagemOrigemId = "outra-mensagem";
  if (campo === "texto") { draft.texto = "Outro texto aprovado?"; draft.conteudoSha256 = createHash("sha256").update(draft.texto).digest("hex"); }
  if (campo === "contexto") draft.contexto = { ...draft.contexto, encounterId: "outro-encontro" };
  if (campo === "tipoResposta") draft.tipoResposta = "ACUSO_RECEBIMENTO_TECNICO";
  if (campo === "confirmadoPorMedicoId") draft.confirmadoPorMedicoId = "outro-medico";
  if (campo === "confirmadoPorCrm") draft.confirmadoPorCrm = "OUTRO-CRM";
  if (campo === "confirmadoEm") draft.confirmadoEm = DEPOIS;
  a.db.prepare("UPDATE canal_resposta_rascunho SET rascunhoJson=?").run(JSON.stringify(draft));
  const antes = a.snapshot();
  const pedido = { ...a.pedido, comprovanteExibicao: { destinatario: draft.destinatario, conteudoSha256: draft.conteudoSha256, contexto: draft.contexto } };
  expect(confirmarRespostaCanalPeloMedico(a.db, acessoB(), pedido).ok).toBe(false);
  expect(a.snapshot()).toEqual(antes);
});

it("consentimento legado sem eventoId nao e atualizado por reconfirmacao", () => {
  const a = preparar(); confirmar(a);
  const row = a.db.prepare("SELECT autorizacaoJson FROM canal_resposta_autorizada").get() as { autorizacaoJson: string };
  const aut = AutorizacaoRespostaCanalServidor.parse(JSON.parse(row.autorizacaoJson)); delete aut.consentimento.eventoId;
  a.db.prepare("UPDATE canal_resposta_autorizada SET autorizacaoJson=?").run(JSON.stringify(aut));
  const antes = a.snapshot();
  expect(confirmarRespostaCanalPeloMedico(a.db, acessoB(), a.pedido)).toEqual({ ok: false, codigo: "CONSENTIMENTO_REVOGADO_OU_AUSENTE" });
  expect(a.snapshot()).toEqual(antes);
});

it("duas conexoes serializam confirmacoes e preservam o medico que gravou primeiro", () => {
  const a = preparar(), b = abrirLedger(a.caminho); bancos.push(b); b.exec("PRAGMA busy_timeout=0");
  const exec = a.db.exec.bind(a.db); let intercalou = false;
  let vencedor: ReturnType<typeof confirmarRespostaCanalPeloMedico> | undefined;
  vi.spyOn(a.db, "exec").mockImplementation(sql => {
    if (sql === "BEGIN IMMEDIATE" && !intercalou) {
      intercalou = true; vencedor = confirmarRespostaCanalPeloMedico(b, acessoB(), a.pedido);
    }
    return exec(sql);
  });
  const prepararSql = a.db.prepare.bind(a.db); let leuSobLock = false;
  vi.spyOn(a.db, "prepare").mockImplementation(sql => {
    if (sql.includes("SELECT autorizacaoJson, invalidada FROM canal_resposta_autorizada")) {
      leuSobLock = a.db.isTransaction;
      expect(() => b.exec("BEGIN IMMEDIATE")).toThrow(/locked|busy/i);
    }
    return prepararSql(sql);
  });
  const r = confirmarRespostaCanalPeloMedico(a.db, { ...a.acesso, agora: "2026-10-19T18:02:00.000Z" }, a.pedido);
  expect(intercalou).toBe(true); expect(leuSobLock).toBe(true);
  expect(vencedor).toMatchObject({ ok: true, autorizacao: { aprovadoPor: { medicoId: "medico-b-sintetico", em: DEPOIS } } });
  expect(r).toEqual(vencedor);
  expect(confirmarRespostaCanalPeloMedico(b, a.acesso, a.pedido)).toEqual(vencedor);
});
