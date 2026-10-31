import { existsSync, readFileSync, statSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const MIME_POR_EXTENSAO: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ico": "image/x-icon",
};

function raizesCandidatas(): readonly string[] {
  const moduloDir = dirname(fileURLToPath(import.meta.url));
  const cwd = resolve(process.cwd());
  return [
    resolve(cwd, "dist", "ui"),
    resolve(moduloDir, "..", "ui"),
    resolve(moduloDir, "..", "..", "dist", "ui"),
    resolve(moduloDir, "..", "..", "..", "dist", "ui"),
    cwd,
    resolve(moduloDir, "..", ".."),
    resolve(moduloDir, "..", "..", ".."),
  ];
}

function resolverArquivoUi(relativo: string, somenteDist: boolean): string | null {
  const raizes = raizesCandidatas();
  for (const raiz of somenteDist ? raizes.slice(0, 4) : raizes) {
    const base = resolve(raiz);
    const alvo = resolve(base, relativo);
    if (!alvo.startsWith(base + sep)) continue;
    try {
      if (existsSync(alvo) && statSync(alvo).isFile()) return alvo;
    } catch {
      continue;
    }
  }
  return null;
}

/** Entrega somente a entrada operacional documentada (/oncoassist.html, /index.html e /assets/*). */
export function servirUiLocal(
  deps: { log: (entry: { rota: string; codigo: string; status: number }) => void },
  req: IncomingMessage,
  res: ServerResponse,
): boolean {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  const pathname = (req.url ?? "").split("?", 1)[0] ?? "";
  if (pathname === "/favicon.ico") {
    deps.log({ rota: "uiLocal", codigo: "UI_FAVICON_VAZIO", status: 204 });
    res.writeHead(204, { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    res.end();
    return true;
  }
  let relativo: string | null = null;
  let somenteDist = false;
  if (pathname === "/" || pathname === "/oncoassist.html") {
    relativo = "oncoassist.html";
  } else if (pathname === "/index.html") {
    relativo = "index.html";
  } else if (pathname.startsWith("/assets/")) {
    const nome = pathname.slice("/assets/".length);
    if (!/^[a-zA-Z0-9._-]{1,160}$/.test(nome) || nome.includes("..")) return false;
    relativo = `assets/${nome}`;
    somenteDist = true;
  } else {
    return false;
  }
  const arquivo = resolverArquivoUi(relativo, somenteDist);
  if (!arquivo) return false;
  const bytes = readFileSync(arquivo);
  const contentType = MIME_POR_EXTENSAO[extname(arquivo).toLowerCase()] ?? "application/octet-stream";
  deps.log({ rota: "uiLocal", codigo: "UI_SERVIDA", status: 200 });
  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": String(bytes.byteLength),
    "Cache-Control": somenteDist && /-[A-Za-z0-9_-]{8,}\.(?:js|mjs|css|woff2?)$/.test(relativo)
      ? "public, max-age=31536000, immutable" : "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(req.method === "HEAD" ? undefined : bytes);
  return true;
}
