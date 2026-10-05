import { createServer, type Server } from "node:http";
import { rotear, type ServidorDeps } from "./rotas.js";

/** Loopback only; a caller cannot override the bind address. */
export function criarServidorLocal(deps: ServidorDeps, config: { host?: string; port?: number } = {}): Server {
  if (config.host !== undefined && config.host !== "127.0.0.1")
    throw new Error("BIND_FORA_DO_LOOPBACK");
  const server = createServer((req, res) => {
    void rotear(deps, req, res).catch(() => {
      // The router handles expected failures; this fallback remains PHI-free.
      deps.log({ rota: "desconhecida", codigo: "ERRO_INTERNO", status: 500 });
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });
  server.listen(config.port ?? 0, "127.0.0.1");
  return server;
}
