/** Servidor sintético S12 — jornadas B2 no navegador. Promoção CONFERIDA_MEDICO só em memória (stdin promote). */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createServer, type Server } from "node:http";
import { carregarCorpusServidor } from "../../../../src/server/corpus.js";
import { rotear, type ServidorDeps } from "../../../../src/server/rotas.js";
import { createSettingsService } from "../../../../src/kernel/config/settings.js";
import { criarMotorF1 } from "../../../../src/kernel/orquestracao/runtime.js";
import { referenciaBibliotecaAtiva } from "../../../../src/server/biblioteca.js";
import { carregarConfigMotor } from "../../../../src/kernel/corpus/configMotor.js";
import { fonteSintetica } from "../../../fixtures/triagem.js";

export const PACIENTE_B2 = "paciente-s12-b2-jornada-001";
export const ENCONTRO_B2 = "encontro-s12-b2-jornada-001";
export const NOME_B2 = "Paciente Sintético Jornada B2";
export const SENHA_B2 = "senha-sintetica-e2e-colon-01";

const promovidasEmMemoria = new Set<string>();
/** Referência única usada pelo HTTP da demo — promoção CONFERIDA_MEDICO só aqui (nunca em disco). */
export let corpusCompartilhadoDemoB2: ReturnType<typeof carregarCorpusServidor> | null = null;

export function promoverTemplate(templateId: string) {
  promovidasEmMemoria.add(templateId);
  if (!corpusCompartilhadoDemoB2) return;
  for (const t of corpusCompartilhadoDemoB2.templatesProtocolo) {
    if (t.templateId === templateId) (t as { status: string }).status = "CONFERIDA_MEDICO";
  }
}

/** Cópia local de criarServidorLocal (http.ts) — corpus mutável para promoção em memória na demo B2. */
function criarServidorLocalDemoB2(deps: ServidorDeps, config: { host?: string; port?: number } = {}): Server {
  if (config.host !== undefined && config.host !== "127.0.0.1") throw new Error("BIND_FORA_DO_LOOPBACK");
  let corpus: ReturnType<typeof carregarCorpusServidor> | null = corpusCompartilhadoDemoB2;
  if (!corpus) {
    try { corpus = carregarCorpusServidor(); } catch { /* leitores reportam PENDENTE */ }
    corpusCompartilhadoDemoB2 = corpus;
  }
  const ownsSettings = deps.settings === undefined && !!deps.configRootDir && !!corpus;
  const settings = deps.settings === undefined
    ? ownsSettings && deps.configRootDir && corpus
      ? createSettingsService({ rootDir: deps.configRootDir, caixas: corpus.caixasTodas, now: deps.agora })
      : null
    : deps.settings;
  const runtimeDeps: ServidorDeps = { ...deps, settings, corpus,
    salaoRuleset: deps.salaoRuleset === undefined ? corpus?.ruleset ?? null : deps.salaoRuleset };
  const configMotor = carregarConfigMotor();
  runtimeDeps.motorF1 = deps.motorF1 ?? criarMotorF1(deps.db, deps.agora, () => ({
    ...configMotor, biblioteca: referenciaBibliotecaAtiva(deps.db) ?? configMotor.biblioteca,
  }));
  let encerrando = false;
  const pendentes = new Set<Promise<unknown>>();
  const acompanhar = (trabalho: Promise<unknown>) => {
    const acompanhado = trabalho.finally(() => pendentes.delete(acompanhado));
    pendentes.add(acompanhado);
    void acompanhado.catch(() => {});
  };
  acompanhar(runtimeDeps.motorF1.processar().catch(() => deps.log({ rota: "motor-f1", codigo: "RECUPERACAO_PENDENTE", status: 503 })));
  const server = createServer((req, res) => {
    if (encerrando) {
      res.writeHead(503, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify({ codigo: "SERVIDOR_ENCERRANDO" }));
      return;
    }
    acompanhar(rotear(runtimeDeps, req, res).then(() => runtimeDeps.motorF1?.processar()).catch(() => {
      deps.log({ rota: "desconhecida", codigo: "ERRO_INTERNO", status: 500 });
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }));
  });
  const fecharHttp = server.close.bind(server);
  let encerramento: Promise<Error | undefined> | null = null;
  server.close = (callback) => {
    if (!encerramento) {
      encerrando = true;
      encerramento = (async () => {
        while (pendentes.size) await Promise.allSettled([...pendentes]);
        return new Promise<Error | undefined>((resolve) => fecharHttp((error) => resolve(error)));
      })();
    }
    if (callback) void encerramento.then((error) => callback(error));
    return server;
  };
  if (ownsSettings) server.on("close", () => settings?.close());
  server.listen(config.port ?? 0, "127.0.0.1");
  return server;
}

export function criarDiretorioB2(): string {
  return mkdtempSync(join(tmpdir(), "e2e-b2-f1-"));
}

const depsColon = await (async () => {
  const colon = await import("../../../f0-fecha/fixtures/colon-e2e.js");
  const wr = await import("../../../../src/kernel/ledger/writeRouter.js");
  return { confirmar: wr.confirmar, salvarDraft: wr.salvarDraft, AGORA: colon.AGORA, SENHA: colon.SENHA,
    MEDICO_ID: colon.MEDICO_ID, CRM: colon.CRM };
})();

/** Igual ao ambiente cólon, mas porta fixa via ONCOGLOBAL_API_PORT (proxy Vite ↔ loopback). */
async function abrirAmbienteB2(dir: string) {
  const { abrirLedger } = await import("../../../../src/kernel/ledger/db.js");
  const { criarGateway, memoriaIdempotencia } = await import("../../../../src/kernel/gateway/gateway.js");
  const { criarExecutorImprimir } = await import("../../../../src/kernel/gateway/executores/imprimir.js");
  const { criarResolverDocumentoLedger } = await import("../../../../src/kernel/ledger/documentos.js");
  const { criarGerenciadorSessao } = await import("../../../../src/server/sessao.js");
  const { AGORA, SENHA, MEDICO_ID, CRM } = depsColon;
  const db = abrirLedger(join(dir, "ledger.sqlite"));
  const agora = () => AGORA;
  const sessoes = criarGerenciadorSessao({ medicoId: MEDICO_ID, crm: CRM, senha: SENHA, duracaoMs: 60_000, agora });
  const resolverDocumento = criarResolverDocumentoLedger(db);
  const gateway = criarGateway({
    agora, auditar: () => {}, store: memoriaIdempotencia(),
    executores: { IMPRIMIR: criarExecutorImprimir({ dataDir: dir, agora, resolverDocumento }) },
  });
  const portRaw = process.env.ONCOGLOBAL_API_PORT;
  const port = portRaw ? Number(portRaw) : 0;
  if (portRaw && (!Number.isInteger(port) || port < 1 || port > 65535)) throw new Error("ONCOGLOBAL_API_PORT_INVALIDA");
  const server = criarServidorLocalDemoB2({ db, sessoes, gateway, agora, log: () => {}, configRootDir: join(dir, "config") }, { port });
  await new Promise<void>((resolve, reject) => {
    if (server.listening) return resolve();
    server.once("error", reject);
    server.once("listening", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("PORTA_LOCAL_AUSENTE");
  const token = sessoes.login(SENHA)!.token;
  const close = async () => {
    await new Promise<void>((resolve) => { server.close(() => resolve()); });
    db.close();
  };
  return { dir, db, sessoes, token, close, baseUrl: `http://127.0.0.1:${address.port}` };
}

export async function bootServidorDemoB2(dirArg?: string) {
  const { confirmar, salvarDraft, AGORA } = depsColon;
  const dir = realpathSync(dirArg ?? criarDiretorioB2());
  if (dirname(dir).toLowerCase() !== realpathSync(tmpdir()).toLowerCase() || !basename(dir).startsWith("e2e-b2-f1-"))
    throw new Error("DEMO_B2_EXIGE_DIRETORIO_SINTETICO");

  const novo = !existsSync(join(dir, "ledger.sqlite"));
  const app = await abrirAmbienteB2(dir);

  function seed(patientId: string, encounterId: string, id: string, tipo: string, payload: unknown, fontes = [fonteSintetica(id)]) {
    salvarDraft(app.db, { draftId: id, patientId, sourceId: id, rawRef: "cadastro-sintetico-b2-s12",
      payload: {}, diagnostics: [], revision: 0, criadoEm: AGORA });
    const r = confirmar(app.db, { patientId, encounterId, tumorLotId: null, operationId: `op-${id}`,
      reviewDecisionId: `review-${id}`, sessao: app.sessoes.obter(app.token)!, em: AGORA,
      registros: [{ draftId: id, expectedRevision: 0, eventId: id, tipo, payload, fontes, revisao: "CONFIRMADO" }] });
    if (r.estado !== "GRAVADA") throw new Error("CADASTRO_B2_NAO_GRAVADO");
  }

  if (novo) {
    seed(PACIENTE_B2, ENCONTRO_B2, "cadastro-b2-s12", "Paciente",
      { patientId: PACIENTE_B2, identificadores: [], nome: NOME_B2, nascimento: "1970-01-01",
        sexoCadastral: "F", divergencia: false }, []);
    seed(PACIENTE_B2, ENCONTRO_B2, "agenda-b2-s12", "AgendaEntry",
      { patientId: PACIENTE_B2, encounterId: ENCONTRO_B2, data: AGORA.slice(0, 10), horario: "10:30" }, []);
    const medidaEm = "2026-10-12T08:00:00-03:00";
    const fontePeso = fonteSintetica("medida-b2-peso");
    seed(PACIENTE_B2, ENCONTRO_B2, "peso-b2-s12", "Weight",
      { kg: 70, origem: "MEDIDO", data: medidaEm, sourceId: fontePeso.sourceId }, [fontePeso]);
    seed(PACIENTE_B2, ENCONTRO_B2, "altura-b2-s12", "FATO",
      { campo: "alturaCm", valor: 170, unidade: "cm", data: medidaEm, sourceId: "medida-b2-altura" },
      [fonteSintetica("medida-b2-altura")]);
    seed(PACIENTE_B2, ENCONTRO_B2, "cr-b2-s12", "LabResult",
      { campo: "creatinina", valor: 1.0, unidade: "mg/dL", data: medidaEm, sourceId: "lab-b2-cr" },
      [fonteSintetica("lab-b2-cr")]);
  }

  mkdirSync(join(dir, "config"), { recursive: true });
  const manifesto = {
    sintético: true, providerExterno: false, dir, baseUrl: app.baseUrl, agora: AGORA, senhaDemo: SENHA_B2,
    b2: { patientId: PACIENTE_B2, encounterId: ENCONTRO_B2, nome: NOME_B2 },
    promovidasEmMemoria: [...promovidasEmMemoria],
    hashManifesto: createHash("sha256").update("demo-b2-s12").digest("hex"),
    tipo: "S12_DEMO_B2" as const,
  };
  writeFileSync(join(dir, "manifesto-demo-b2.json"), JSON.stringify(manifesto, null, 2));
  return { app, manifesto, promoverTemplate, listarPromovidas: () => [...promovidasEmMemoria] };
}

const isCli = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isCli) {
  const { app, manifesto } = await bootServidorDemoB2(process.argv[2]);
  console.log(JSON.stringify(manifesto));
  const entrada = createInterface({ input: process.stdin });
  entrada.on("line", async (line) => {
    const cmd = line.trim();
    if (cmd === "stop") { entrada.close(); await app.close(); process.exit(0); }
    if (cmd.startsWith("promote ")) {
      const templateId = cmd.slice("promote ".length).trim();
      if (!templateId) return;
      promoverTemplate(templateId);
      console.log(JSON.stringify({ codigo: "PROMOVIDO_EM_MEMORIA", templateId, gravadoEmDisco: false }));
      return;
    }
    if (cmd === "listar-promovidas") console.log(JSON.stringify({ promovidas: [...promovidasEmMemoria] }));
  });
}
