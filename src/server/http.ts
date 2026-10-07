import { createServer, type Server } from "node:http";
import { rotear, type ServidorDeps } from "./rotas.js";
import { createSettingsService } from "../config/settings.js";
import { carregarCorpusServidor } from "./corpus.js";

/** Loopback only; a caller cannot override the bind address. */
export function criarServidorLocal(deps: ServidorDeps, config: { host?: string; port?: number } = {}): Server {
  if (config.host !== undefined && config.host !== "127.0.0.1")
    throw new Error("BIND_FORA_DO_LOOPBACK");
  let corpus: ReturnType<typeof carregarCorpusServidor> | null = null;
  try { corpus = carregarCorpusServidor(); } catch { /* dependent readers report PENDENTE */ }
  const ownsSettings = deps.settings === undefined && !!deps.configRootDir && !!corpus;
  const settings = deps.settings === undefined
    ? ownsSettings && deps.configRootDir && corpus
      ? createSettingsService({ rootDir: deps.configRootDir, caixas: corpus.caixasTodas, now: deps.agora })
      : null
    : deps.settings;
  const runtimeDeps: ServidorDeps = { ...deps, settings,
    corpus,
    salaoRuleset: deps.salaoRuleset === undefined ? corpus?.ruleset ?? null : deps.salaoRuleset };
  const server = createServer((req, res) => {
    void rotear(runtimeDeps, req, res).catch(() => {
      // The router handles expected failures; this fallback remains PHI-free.
      runtimeDeps.log({ rota: "desconhecida", codigo: "ERRO_INTERNO", status: 500 });
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });
  if (ownsSettings) server.on("close", () => settings?.close());
  server.listen(config.port ?? 0, "127.0.0.1");
  return server;
}
