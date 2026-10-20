import { fork } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { registerHooks, stripTypeScriptTypes } from "node:module";

export const REPORTS = "C:/Users/silas/Projects/OncoGlobal-coordination/20261019-cursor-long-task/reports/oa02";
export const CONTEXTO = { patientId: "paciente-oa02-sintetico", encounterId: "encontro-oa02", tumorLotId: null };
export const SENHA = "senha-sintetica-oa02-testes";

/** Harness compartilhado pelos dois testes: SQLite e HTTP vivem somente no processo filho. */
export async function iniciarProcesso(opcoes: { banco?: string; habilitado?: boolean; controlado?: boolean } = {}) {
  mkdirSync(REPORTS, { recursive: true });
  const banco = opcoes.banco ?? join(mkdtempSync(join(REPORTS, "sqlite-")), "ledger.sqlite");
  if (!resolve(banco).toLowerCase().startsWith(resolve(REPORTS).toLowerCase() + sep))
    throw new Error("BANCO_FORA_DO_ESCOPO_OA02");
  const child = fork(fileURLToPath(import.meta.url), [], { execArgv: [], stdio: ["ignore", "pipe", "pipe", "ipc"],
    env: { SystemRoot: process.env.SystemRoot, PATH: process.env.PATH, NODE_NO_WARNINGS: "1",
      OA02_CHILD: "1", OA02_BANCO: banco, OA02_HABILITADO: String(opcoes.habilitado ?? true),
      OA02_CONTROLADO: String(opcoes.controlado ?? false) } });
  let stderr = "";
  child.stderr?.on("data", data => { stderr += String(data); });
  const ready = await new Promise<{ base: string; token: string; baseline: number }>((res, rej) => {
    const timer = setTimeout(() => { child.kill(); rej(new Error(`WORKER_TIMEOUT ${stderr}`)); }, 30_000);
    child.once("error", erro => { clearTimeout(timer); rej(erro); });
    child.once("exit", code => { clearTimeout(timer); rej(new Error(`WORKER_EXIT_${code} ${stderr}`)); });
    child.on("message", (msg: any) => { if (msg.ready) { clearTimeout(timer); res(msg); } });
  });
  let sequencia = 0;
  const comando = (acao: string, dados: Record<string, unknown> = {}): Promise<any> => new Promise((res, rej) => {
    const id = ++sequencia;
    const timer = setTimeout(() => { child.off("message", receber); rej(new Error(`IPC_TIMEOUT_${acao} ${stderr}`)); }, 10_000);
    const receber = (msg: any) => {
      if (msg.id !== id) return;
      clearTimeout(timer); child.off("message", receber);
      if (msg.erro) rej(new Error(msg.erro)); else res(msg.resultado);
    };
    child.on("message", receber); child.send({ id, acao, ...dados });
  });
  const post = async (rota: string, corpo: unknown, signal?: AbortSignal, token = ready.token) => {
    const r = await fetch(ready.base + rota, { method: "POST", headers: {
      Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(corpo),
      ...(signal ? { signal } : {}) });
    const texto = await r.text();
    return { status: r.status, body: JSON.parse(texto) as any, texto };
  };
  const parar = async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    await new Promise<void>(res => { child.once("exit", () => res()); child.kill(); });
  };
  return { ...ready, banco, comando, post, parar, pid: child.pid };
}

async function executarWorker() {
  // Node 24 executa esta entrada TS; os imports .js do produto são transpilados em memória,
  // sem build, cache ou qualquer arquivo adicional fora de reports/oa02.
  registerHooks({
    resolve(specifier, context, next) {
      if (specifier.endsWith(".js") && specifier.startsWith(".") && context.parentURL) {
        const candidato = new URL(specifier.replace(/\.js$/, ".ts"), context.parentURL);
        if (existsSync(fileURLToPath(candidato))) return next(candidato.href, context);
      }
      return next(specifier, context);
    },
    load(url, context, next) {
      if (url.startsWith("file:") && url.endsWith(".ts")) return { format: "module", shortCircuit: true,
        // Node 24 oferece transform; @types/node 26 instalado tipa somente strip.
        source: Reflect.apply(stripTypeScriptTypes, undefined,
          [readFileSync(fileURLToPath(url), "utf8"), { mode: "transform", sourceUrl: url }]) as string };
      return next(url, context);
    },
  });
  const { createServer } = await import("node:http");
  const { abrirLedger } = await import("../../src/kernel/ledger/db.js");
  const { salvarDraft, lerDraft, listarDrafts } = await import("../../src/kernel/ledger/drafts.js");
  const { confirmar } = await import("../../src/kernel/ledger/writeRouter.js");
  const { criarGateway, memoriaIdempotencia } = await import("../../src/kernel/gateway/gateway.js");
  const { criarGerenciadorSessao } = await import("../../src/server/sessao.js");
  const { rotear } = await import("../../src/server/rotas.js");
  const { criarOncoassistJev } = await import("../../src/kernel/llm/jev/oncoassist.js");
  let instante = "2026-10-19T12:00:00.000Z";
  const agora = () => instante;
  const db = abrirLedger(process.env.OA02_BANCO!);
  const sessoes = criarGerenciadorSessao({ medicoId: "medico-oa02", crm: "CRM-SINTETICO", senha: SENHA,
    duracaoMs: 600_000, agora });
  const token = sessoes.login(SENHA)!.token;
  sessoes.selecionarConsulta(token, CONTEXTO);
  if (!lerDraft(db, "cadastro-oa02")) {
    salvarDraft(db, { draftId: "cadastro-oa02", patientId: CONTEXTO.patientId, sourceId: "cadastro",
      rawRef: "fixture", payload: {}, revision: 0, criadoEm: agora(), diagnostics: [] });
    confirmar(db, { ...CONTEXTO, operationId: "cadastro-oa02", reviewDecisionId: "review-cadastro",
      sessao: sessoes.obter(token)!, em: agora(), registros: [{ draftId: "cadastro-oa02", expectedRevision: 0,
        eventId: "paciente-oa02", tipo: "Paciente", fontes: [], revisao: "CONFIRMADO", payload: {
          patientId: CONTEXTO.patientId, nome: "Paciente Sintético OA02", identificadores: [],
          nascimento: null, sexoCadastral: "NAO_INFORMADO", divergencia: false } }] });
    for (const n of [1, 2]) salvarDraft(db, { draftId: `fonte-${n}`, patientId: CONTEXTO.patientId,
      sourceId: `documento-${n}`, rawRef: "fixture-sintetica", revision: 0, criadoEm: agora(), diagnostics: [],
      payload: { kind: "EXTRACAO_RASCUNHO", input: { sourceId: `documento-${n}`, rawTranscript: "Hemograma sintético" },
        patientLinkReview: { ...CONTEXTO, segmentId: `segmento-${n}` },
        state: { segments: [{ id: `segmento-${n}`, sourceId: `documento-${n}`, rawTranscript: "Hemograma sintético" }] } } });
  }
  const contar = () => Number(db.prepare("SELECT COUNT(*) AS n FROM clinical_event").get()!.n);
  const baseline = contar();
  let chamadas = 0;
  const marcadores: string[] = [];
  const transacoesNoTransporte: boolean[] = [];
  const pendentes: Array<(r: unknown) => void> = [];
  const resposta = (categoria = "LAB") => ({ model: "jev-1.0", answers: { categoria: { type: "choice", choice: categoria,
    confidence: 1, probabilities: Object.fromEntries(["LAB", "RADS", "PATH", "NOTA", "OUTRO", "INDETERMINADO"].map(c => [c, c === categoria ? 1 : 0])) } },
    usage: { input_tokens: 10, output_tokens: 1 } });
  let habilitado = process.env.OA02_HABILITADO === "true";
  const ligado = criarOncoassistJev({ env: { ONCOASSIST_JEV_ENABLED: "true", TYPESAFE_API_KEY: "fixture-sem-rede" },
    transporte: { avaliar: async texto => {
      chamadas++; marcadores.push(texto); transacoesNoTransporte.push(db.isTransaction);
      if (process.env.OA02_CONTROLADO === "true") return new Promise(res => pendentes.push(res));
      return resposta();
    } } });
  const desligado = criarOncoassistJev({ env: {} });
  const logs: unknown[] = [];
  const deps = { db, sessoes, agora, log: (e: unknown) => logs.push(e),
    gateway: criarGateway({ agora, auditar: () => {}, store: memoriaIdempotencia(), executores: {} }),
    oncoassistJev: { status: () => (habilitado ? ligado : desligado).status(),
      avaliar: (...args: Parameters<typeof ligado.avaliar>) => (habilitado ? ligado : desligado).avaliar(...args) } };
  const server = createServer((req, res) => { void rotear(deps, req, res); });
  server.listen(0, "127.0.0.1", () => {
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("PORTA_AUSENTE");
    process.send!({ ready: true, base: `http://127.0.0.1:${addr.port}`, token, baseline });
  });
  process.on("message", (m: any) => {
    try {
      let resultado: unknown = true;
      if (m.acao === "stats") resultado = { chamadas, clinicalEvents: contar(), drafts: listarDrafts(db),
        marcadores, transacoesNoTransporte, logs, pendentes: pendentes.length };
      else if (m.acao === "liberar") pendentes.shift()?.(resposta(m.categoria));
      else if (m.acao === "desligar") habilitado = false;
      else if (m.acao === "expirar") instante = "2026-10-20T12:00:00.000Z";
      else if (m.acao === "selecionar") sessoes.selecionarConsulta(token, m.contexto);
      else if (m.acao === "fonte") {
        const draft = lerDraft(db, m.draftId ?? "fonte-1")!;
        const payload = structuredClone(draft.payload) as any;
        if (m.modo === "hash") {
          payload.state.segments[0].rawTranscript = "Tomografia sintética alterada";
          // Mutação adversarial sem incremento: prova independente da guarda por revision.
          db.prepare("UPDATE draft_envelope SET payload=? WHERE draftId=?").run(JSON.stringify(payload), draft.draftId);
        } else {
          if (m.modo === "encontro") payload.patientLinkReview.encounterId = "outro-encontro";
          if (m.modo === "lote") payload.patientLinkReview.tumorLotId = "outro-lote";
          if (m.modo === "paciente") payload.patientLinkReview.patientId = "outro-paciente";
          salvarDraft(db, { ...draft, payload, revision: draft.revision + 1 });
        }
      } else if (m.acao === "promover") {
        const draft = lerDraft(db, m.draftId)!;
        resultado = confirmar(db, { ...CONTEXTO, operationId: "tentativa-promocao", reviewDecisionId: "review-forjado",
          sessao: sessoes.obter(token)!, em: agora(), registros: [{ draftId: draft.draftId, expectedRevision: draft.revision,
            eventId: "evento-forjado", tipo: "FATO", payload: { valor: "nao-promover" }, fontes: [], revisao: "CONFIRMADO" }] });
      } else throw new Error("COMANDO_TESTE_DESCONHECIDO");
      process.send!({ id: m.id, resultado });
    } catch (erro) { process.send!({ id: m.id, erro: erro instanceof Error ? erro.message : "ERRO_FIXTURE" }); }
  });
}

if (process.env.OA02_CHILD === "1" && process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await executarWorker();
}
