// W12-F4 · fechamento real da Consulta Flash e dados da Flash pelo servidor (HTTP real, loopback, dados sintéticos).
import { afterEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import type { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { listarDrafts, salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { listarEventos } from "../../src/kernel/ledger/ledger.js";
import { confirmar } from "../../src/kernel/ledger/writeRouter.js";
import { criarGateway, memoriaIdempotencia } from "../../src/kernel/gateway/gateway.js";
import { createSettingsService } from "../../src/config/settings.js";
import { carregarCorpusServidor } from "../../src/server/corpus.js";
import { CHAVE_CAIXA_MODELO_FLASH, NUMERO_CAIXA_MODELO_FLASH } from "../../src/config/flash.js";
import { criarServidorLocal } from "../../src/server/http.js";
import { criarGerenciadorSessao } from "../../src/server/sessao.js";
import { fonteSintetica } from "../fixtures/triagem.js";

const AGORA = "2026-10-08T12:00:00-03:00";
const PACIENTE = "Paciente Teste 41";
const ENCONTRO = "encontro-41";
const NUMERO_MODELO = NUMERO_CAIXA_MODELO_FLASH;

const dirs: string[] = [];
const servers: Server[] = [];
const databases: DatabaseSync[] = [];
const fechaveis: { close(): void }[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).filter((s) => s.listening).map((s) => new Promise<void>((r) => s.close(() => r()))));
  for (const f of fechaveis.splice(0)) { try { f.close(); } catch { /* já fechado */ } }
  for (const db of databases.splice(0)) { try { db.close(); } catch { /* já fechado */ } }
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const PLANO_BASE = {
  acoesMarcadas: [] as string[], receitasMarcadas: [] as string[],
  apac: { cid: "C50", sigtap: "", finalidade: "", competencia: "", estado: "PENDENTE", pendencias: ["SIGTAP ausente"], emitir: false },
  retorno: { dias: 30, examesAntesDoRetorno: [] as string[] },
};
const plano = (over: Record<string, unknown> = {}, tarefas = { retorno: true, laboratorio: true, imagem: false }) =>
  ({ ...PLANO_BASE, tarefasRetorno: tarefas, ...over });

async function ambiente(opts: { comSettings?: boolean } = {}) {
  const root = mkdtempSync(join(tmpdir(), "w12-f4-")); dirs.push(root);
  const db = abrirLedger(join(root, "ledger.sqlite")); databases.push(db);
  const sessoes = criarGerenciadorSessao({ medicoId: "medico-teste", crm: "CRM-TESTE",
    senha: "senha-sintetica-comprida", duracaoMs: 60_000, agora: () => AGORA });
  let efeitos = 0;
  const logs: { rota: string; codigo: string; status: number }[] = [];
  const gateway = criarGateway({ agora: () => AGORA, auditar: () => {}, store: memoriaIdempotencia(), executores: {
    IMPRIMIR: { executar: async () => { efeitos++; return { ok: true, recibo: "impresso-teste" }; } },
    ENVIAR_EMAIL: { executar: async () => { efeitos++; return { ok: true, recibo: "email-teste" }; } },
    ENVIAR_WHATSAPP: { executar: async () => { efeitos++; return { ok: true, recibo: "zap-teste" }; } },
    EXPORTAR_APAC: { executar: async () => { efeitos++; return { ok: true, recibo: "apac-teste" }; } },
  } });
  const caixas = carregarCorpusServidor().caixasTodas;
  if (!caixas.some((caixa) => caixa.numero === NUMERO_MODELO && caixa.chave === CHAVE_CAIXA_MODELO_FLASH))
    throw new Error("CAIXA_MODELO_FLASH_AUSENTE_DO_CORPUS");
  const settings = opts.comSettings === false ? undefined
    : createSettingsService({ rootDir: join(root, "config"), caixas, now: () => AGORA });
  if (settings) fechaveis.push(settings);
  const server = criarServidorLocal({ db, sessoes, gateway, agora: () => AGORA, log: (e) => logs.push(e),
    ...(settings ? { settings } : { configRootDir: join(root, "config-auto") }) });
  servers.push(server);
  await new Promise<void>((resolve) => server.listening ? resolve() : server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("porta ausente");
  const login = sessoes.login("senha-sintetica-comprida")!;
  const token = login.token;
  const post = async (path: string, corpo: unknown, comToken = true) => {
    const r = await fetch(`http://127.0.0.1:${address.port}${path}`, { method: "POST",
      headers: { "Content-Type": "application/json", ...(comToken ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(corpo) });
    return { status: r.status, body: await r.json() as Record<string, any> };
  };
  let seq = 0;
  const persistir = (tipo: string, payload: unknown, revisao: "CONFIRMADO" | "ASSINADO" = "CONFIRMADO") => {
    seq += 1;
    const draftId = `draft-f4-${seq}`;
    salvarDraft(db, { draftId, patientId: PACIENTE, sourceId: `source-f4-${seq}`, rawRef: "fixture-local",
      payload: {}, diagnostics: [], revision: 0, criadoEm: AGORA });
    const r = confirmar(db, { operationId: `op-f4-${String(seq).padStart(3, "0")}`, patientId: PACIENTE,
      tumorLotId: null, encounterId: ENCONTRO, reviewDecisionId: `review-f4-${seq}`, sessao: sessoes.obter(token)!,
      em: AGORA, registros: [{ draftId, expectedRevision: 0, eventId: `event-f4-${seq}`, tipo, payload,
        fontes: tipo === "Paciente" ? [] : [fonteSintetica(`fonte-f4-${seq}`)], revisao }] });
    expect(r.estado).toBe("GRAVADA");
  };
  persistir("Paciente", { patientId: PACIENTE, identificadores: [], nome: "Paciente Teste 41", nascimento: null,
    sexoCadastral: "NAO_INFORMADO", divergencia: false });
  const carregar = () => post("/consulta/carregar", { patientId: PACIENTE });
  const ctx = { patientId: PACIENTE, encounterId: ENCONTRO, tumorLotId: null as string | null };
  const finalizar = async (p: object, key: string) => {
    const prep = await post("/consulta/flash/preparar", { ...ctx, plano: p, idempotencyKey: key });
    if (prep.status !== 200) return { prep, bundle: null, conf: null };
    const bundle = await post("/consulta/bundle", ctx);
    const conf = await post("/consulta/confirmar", { ...ctx, bloco: "TUDO", registros: prep.body.registros,
      documentosExibidos: (prep.body.documentos as { documentId: string; documentVersion: number }[])
        .map((d) => ({ documentId: d.documentId, documentVersion: d.documentVersion })),
      reconhecerAlertas: [], idempotencyKey: key });
    return { prep, bundle, conf };
  };
  const assinados = () => listarEventos(db, PACIENTE).filter((e) => e.revisao === "ASSINADO");
  const tiposAssinados = () => assinados().map((e) => {
    const d = (e.payload as { data?: { data?: { tipoDocumento?: string } } }).data?.data;
    return d?.tipoDocumento ?? e.tipo;
  }).sort();
  return { db, post, persistir, carregar, ctx, finalizar, assinados, tiposAssinados, settings, sessoes, token,
    logs, efeitos: () => efeitos };
}

describe("W12-F4 · SALVAR RASCUNHO", () => {
  it("grava RASCUNHO sem assinatura e sem documento no bundle", async () => {
    const f = await ambiente();
    expect((await f.carregar()).status).toBe(200);
    const r = await f.post("/consulta/flash/rascunho", { ...f.ctx, plano: plano(), expectedRevision: null });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ codigo: "RASCUNHO_SALVO", revision: 0 });
    const draft = listarDrafts(f.db, PACIENTE).find((d) => d.draftId === r.body.draftId)!;
    expect(draft.payload).toMatchObject({ kind: "FLASH_RASCUNHO", status: "RASCUNHO", assinada: false });
    expect((draft.payload as Record<string, unknown>).documentId).toBeUndefined();
    expect(f.assinados()).toHaveLength(0);
    expect(listarEventos(f.db, PACIENTE).filter((e) => e.tipo === "DOCUMENTO")).toHaveLength(0);
    // não aparece no fechamento nem no bundle
    const visao = await f.carregar();
    expect(visao.body.fechamento.registros.map((x: { id: string }) => x.id)).not.toContain(draft.draftId);
    const bundle = await f.post("/consulta/bundle", f.ctx);
    expect(bundle.body.documentos).toHaveLength(0);
    expect(f.efeitos()).toBe(0);
  });

  it("expectedRevision: segundo salvar exige a revisão corrente; defasada = 409 e nada é perdido", async () => {
    const f = await ambiente();
    await f.carregar();
    expect((await f.post("/consulta/flash/rascunho", { ...f.ctx, plano: plano(), expectedRevision: null })).status).toBe(201);
    const velho = await f.post("/consulta/flash/rascunho", { ...f.ctx, plano: plano({ retorno: { dias: 99, examesAntesDoRetorno: [] } }), expectedRevision: null });
    expect(velho.status).toBe(409);
    expect(velho.body.codigo).toBe("REVISAO_RASCUNHO_CONFLITANTE");
    const novo = await f.post("/consulta/flash/rascunho", { ...f.ctx, plano: plano({ retorno: { dias: 14, examesAntesDoRetorno: [] } }), expectedRevision: 0 });
    expect(novo.body).toMatchObject({ codigo: "RASCUNHO_SALVO", revision: 1 });
    const visao = await f.carregar();
    expect(visao.body.flash.rascunho).toMatchObject({ revision: 1 });
    expect(f.assinados()).toHaveLength(0);
  });
});

describe("W12-F4 · FINALIZAR", () => {
  it("gera evolução, pedido de laboratório e retorno assinados; imagem não marcada não existe", async () => {
    const f = await ambiente();
    await f.carregar();
    const { prep, conf } = await f.finalizar(plano(), "flash-final-0001");
    expect(prep.status).toBe(200);
    expect(conf!.status).toBe(200);
    expect(conf!.body.codigo).toBe("GRAVADA");
    expect(f.tiposAssinados()).toEqual(["FLASH_EVOLUCAO", "FLASH_PEDIDO_LABORATORIO", "FLASH_RETORNO"]);
    expect(f.tiposAssinados()).not.toContain("FLASH_PEDIDO_IMAGEM");
    // APAC: só rascunho com pendências, nunca assinada nem emitida
    const apac = listarDrafts(f.db, PACIENTE).find((d) => (d.payload as { kind?: string }).kind === "FLASH_APAC_RASCUNHO")!;
    expect(apac.payload).toMatchObject({ status: "RASCUNHO", assinada: false, emitida: false, apac: { emitir: false, pendencias: ["SIGTAP ausente"] } });
    // retorno registrado com o prazo e visível na Flash seguinte
    const visao = await f.carregar();
    expect(visao.body.flash.retornoDias).toBe(30);
    expect(f.efeitos()).toBe(0);
  });

  it("imagem marcada gera o pedido de imagem", async () => {
    const f = await ambiente();
    await f.carregar();
    const { conf } = await f.finalizar(plano({}, { retorno: true, laboratorio: true, imagem: true }), "flash-final-0002");
    expect(conf!.body.codigo).toBe("GRAVADA");
    expect(f.tiposAssinados()).toEqual(["FLASH_EVOLUCAO", "FLASH_PEDIDO_IMAGEM", "FLASH_PEDIDO_LABORATORIO", "FLASH_RETORNO"]);
  });

  it("sem laboratório nem imagem: só evolução e retorno; prazo ausente fica PENDENTE e não vira número", async () => {
    const f = await ambiente();
    await f.carregar();
    const { conf } = await f.finalizar(plano({ retorno: { dias: null, examesAntesDoRetorno: [] } },
      { retorno: true, laboratorio: false, imagem: false }), "flash-final-0003");
    expect(conf!.body.codigo).toBe("GRAVADA");
    expect(f.tiposAssinados()).toEqual(["FLASH_EVOLUCAO", "FLASH_RETORNO"]);
    const retorno = f.assinados().map((e) => (e.payload as any).data.data).find((d) => d.tipoDocumento === "FLASH_RETORNO");
    expect(retorno).toMatchObject({ retornoDias: null, retornoEstado: "PENDENTE" });
    expect(retorno.texto).toContain("PENDENTE");
    expect((await f.carregar()).body.flash.retornoDias).toBeNull();
  });

  it("mesma intenção repetida não duplica: replay do plano já finalizado é recusado", async () => {
    const f = await ambiente();
    await f.carregar();
    await f.finalizar(plano(), "flash-final-0004");
    const deNovo = await f.post("/consulta/flash/preparar", { ...f.ctx, plano: plano(), idempotencyKey: "flash-final-0004" });
    expect(deNovo.status).toBe(409);
    expect(deNovo.body.codigo).toBe("FLASH_JA_FINALIZADA");
    expect(f.tiposAssinados()).toHaveLength(3);
  });

  it("receita ou ação marcada não tem documento gerado: recusa e não grava nada", async () => {
    const f = await ambiente();
    await f.carregar();
    const antes = listarDrafts(f.db, PACIENTE).length;
    const r = await f.post("/consulta/flash/preparar", { ...f.ctx, plano: plano({ receitasMarcadas: ["rec-1"] }), idempotencyKey: "flash-final-0005" });
    expect(r.status).toBe(409);
    expect(r.body.codigo).toBe("ITENS_FLASH_SEM_DOCUMENTO");
    expect(listarDrafts(f.db, PACIENTE)).toHaveLength(antes);
  });

  it("APAC emitir:true no plano é payload inválido (400)", async () => {
    const f = await ambiente();
    await f.carregar();
    const r = await f.post("/consulta/flash/preparar", { ...f.ctx, idempotencyKey: "flash-final-0006",
      plano: plano({ apac: { ...PLANO_BASE.apac, emitir: true } }) });
    expect(r.status).toBe(400);
  });
});

describe("W12-F4 · sessão e escopo", () => {
  it("sem sessão: 401 nas duas rotas e nada é gravado", async () => {
    const f = await ambiente();
    await f.carregar();
    const antes = listarDrafts(f.db, PACIENTE).length;
    const a = await f.post("/consulta/flash/rascunho", { ...f.ctx, plano: plano(), expectedRevision: null }, false);
    const b = await f.post("/consulta/flash/preparar", { ...f.ctx, plano: plano(), idempotencyKey: "flash-sem-sessao" }, false);
    expect([a.status, b.status]).toEqual([401, 401]);
    expect(listarDrafts(f.db, PACIENTE)).toHaveLength(antes);
  });

  it("consulta não selecionada ou outra consulta: 409", async () => {
    const f = await ambiente();
    const sem = await f.post("/consulta/flash/rascunho", { ...f.ctx, plano: plano(), expectedRevision: null });
    expect(sem.status).toBe(409);
    expect(sem.body.codigo).toBe("CONTEXTO_CONSULTA_NAO_SELECIONADO");
    await f.carregar();
    const outra = await f.post("/consulta/flash/preparar", { ...f.ctx, encounterId: "outro-encontro", plano: plano(), idempotencyKey: "flash-outro-enc" });
    expect(outra.status).toBe(409);
    expect(outra.body.codigo).toBe("CONTEXTO_CONSULTA_ALTERADO");
  });
});

describe("W12-F4 · nada fora do exibido é assinado", () => {
  it("documento preparado mas fora de documentosExibidos: 409 e nenhuma assinatura", async () => {
    const f = await ambiente();
    await f.carregar();
    const prep = await f.post("/consulta/flash/preparar", { ...f.ctx, plano: plano(), idempotencyKey: "flash-escopo-01" });
    await f.post("/consulta/bundle", f.ctx);
    const docs = prep.body.documentos as { documentId: string; documentVersion: number }[];
    const conf = await f.post("/consulta/confirmar", { ...f.ctx, bloco: "TUDO", registros: prep.body.registros,
      documentosExibidos: [{ documentId: docs[0]!.documentId, documentVersion: 1 }],
      reconhecerAlertas: [], idempotencyKey: "flash-escopo-01" });
    expect(conf.status).toBe(409);
    expect(conf.body.codigo).toBe("DOCUMENTO_NAO_SELECIONADO");
    expect(f.assinados()).toHaveLength(0);
  });

  it("sem exibir o bundle: 409 BUNDLE_NAO_EXIBIDO", async () => {
    const f = await ambiente();
    await f.carregar();
    const prep = await f.post("/consulta/flash/preparar", { ...f.ctx, plano: plano(), idempotencyKey: "flash-escopo-02" });
    const conf = await f.post("/consulta/confirmar", { ...f.ctx, bloco: "TUDO", registros: prep.body.registros,
      documentosExibidos: prep.body.documentos.map((d: any) => ({ documentId: d.documentId, documentVersion: 1 })),
      reconhecerAlertas: [], idempotencyKey: "flash-escopo-02" });
    expect(conf.body.codigo).toBe("BUNDLE_NAO_EXIBIDO");
    expect(f.assinados()).toHaveLength(0);
  });

  it("documento alterado depois de exibido: 409 e nada assinado", async () => {
    const f = await ambiente();
    await f.carregar();
    const prep = await f.post("/consulta/flash/preparar", { ...f.ctx, plano: plano(), idempotencyKey: "flash-escopo-03" });
    await f.post("/consulta/bundle", f.ctx);
    const alvo = listarDrafts(f.db, PACIENTE).find((d) => d.draftId === prep.body.registros[0].id)!;
    salvarDraft(f.db, { ...alvo, revision: alvo.revision + 1, payload: { ...(alvo.payload as object), texto: "texto trocado" } });
    const conf = await f.post("/consulta/confirmar", { ...f.ctx, bloco: "TUDO",
      registros: prep.body.registros.map((r: any, i: number) => i === 0 ? { ...r, expectedRevision: 1 } : r),
      documentosExibidos: prep.body.documentos.map((d: any) => ({ documentId: d.documentId, documentVersion: 1 })),
      reconhecerAlertas: [], idempotencyKey: "flash-escopo-03" });
    expect(conf.status).toBe(409);
    expect(f.assinados()).toHaveLength(0);
  });

  it("o rascunho da Flash nunca é assinado: confirmar com ele é recusado", async () => {
    const f = await ambiente();
    await f.carregar();
    const r = await f.post("/consulta/flash/rascunho", { ...f.ctx, plano: plano(), expectedRevision: null });
    await f.post("/consulta/bundle", f.ctx);
    const conf = await f.post("/consulta/confirmar", { ...f.ctx, bloco: "TUDO",
      registros: [{ id: r.body.draftId, expectedRevision: 0 }], documentosExibidos: [],
      reconhecerAlertas: [], idempotencyKey: "flash-escopo-04" });
    expect(conf.status).toBe(409);
    expect(f.assinados()).toHaveLength(0);
  });
});

describe("W12-F4 · visão entrega a Flash do ledger", () => {
  it("sem dados: exames vazios, retorno null (PENDENTE), sem modelo e nada pré-marcado", async () => {
    const f = await ambiente();
    const visao = await f.carregar();
    expect(visao.status).toBe(200);
    expect(visao.body.flash).toEqual({ exames: [], retornoDias: null, modeloPadraoSalvo: false,
      laboratorioPreMarcado: false, imagemPreMarcada: false });
  });

  it("sem serviço de configuração: continua sem modelo", async () => {
    const f = await ambiente({ comSettings: false });
    const visao = await f.carregar();
    expect(visao.body.flash.modeloPadraoSalvo).toBe(false);
  });

  it("exames: só fato confirmado, com data e frase do laudo, do mais recente ao mais antigo", async () => {
    const f = await ambiente();
    f.persistir("Biopsy", { dataClinica: "2026-09-20", nome: "Biópsia de mama",
      fraseLaudo: "carcinoma invasivo de tipo não especial", situacao: "SEM_REFERENCIA" });
    f.persistir("ImagingReport", { dataClinica: "2026-10-01", nome: "TC de tórax",
      fraseLaudo: "sem lesão nova", situacao: "DENTRO_DO_LIMITE" });
    f.persistir("ImagingReport", { dataClinica: "2026-10-02", nome: "RM sem frase", situacao: "SEM_REFERENCIA" });
    f.persistir("ImagingReport", { dataClinica: "2026-12-31", nome: "Exame de data futura", fraseLaudo: "x" });
    const visao = await f.carregar();
    expect(visao.body.flash.exames).toEqual([
      { data: "2026-10-01", nome: "TC de tórax", fraseLaudo: "sem lesão nova", situacao: "DENTRO_DO_LIMITE" },
      { data: "2026-09-20", nome: "Biópsia de mama", fraseLaudo: "carcinoma invasivo de tipo não especial", situacao: "SEM_REFERENCIA" },
    ]);
  });

  it("prazo do retorno vem do último plano registrado", async () => {
    const f = await ambiente();
    await f.carregar();
    await f.finalizar(plano({ retorno: { dias: 30, examesAntesDoRetorno: [] } }), "flash-prazo-0001");
    expect((await f.carregar()).body.flash.retornoDias).toBe(30);
    await f.finalizar(plano({ retorno: { dias: 21, examesAntesDoRetorno: [] } }), "flash-prazo-0002");
    expect((await f.carregar()).body.flash.retornoDias).toBe(21);
  });

  it("modelo padrão das configurações locais: só o salvo pré-marca", async () => {
    const f = await ambiente();
    const r = f.settings!.changeBox({ numero: NUMERO_MODELO, valorNovo: { laboratorio: true, imagem: false },
      expectedRevision: 0, operationId: "op-modelo-flash-1", autorizacaoMedica: true }, f.sessoes.obter(f.token)!);
    expect(r.estado).toBe("GRAVADA");
    const flash = (await f.carregar()).body.flash;
    expect(flash).toMatchObject({ modeloPadraoSalvo: true, laboratorioPreMarcado: true, imagemPreMarcada: false });
  });

  it("modelo com formato inesperado vale como sem modelo", async () => {
    const f = await ambiente();
    f.settings!.changeBox({ numero: NUMERO_MODELO, valorNovo: { laboratorio: "sim" },
      expectedRevision: 0, operationId: "op-modelo-flash-2", autorizacaoMedica: true }, f.sessoes.obter(f.token)!);
    expect((await f.carregar()).body.flash.modeloPadraoSalvo).toBe(false);
  });
});

describe("W12-F4 · nenhum efeito externo", () => {
  it("salvar e finalizar não executam impressão, e-mail, WhatsApp nem exportação; sem PHI no log", async () => {
    const f = await ambiente();
    await f.carregar();
    await f.post("/consulta/flash/rascunho", { ...f.ctx, plano: plano(), expectedRevision: null });
    const { conf } = await f.finalizar(plano(), "flash-efeito-0001");
    expect(conf!.body.codigo).toBe("GRAVADA");
    expect(f.efeitos()).toBe(0);
    expect(f.logs.some((l) => l.rota === "acao")).toBe(false);
    const eventos = listarEventos(f.db, PACIENTE);
    expect(eventos.some((e) => /ENVIAR|WHATSAPP|EMAIL|EXPORT/i.test(e.tipo))).toBe(false);
    expect(JSON.stringify(f.logs)).not.toContain("SIGTAP");
    expect(JSON.stringify(f.logs)).not.toContain("Paciente Teste");
  });
});
