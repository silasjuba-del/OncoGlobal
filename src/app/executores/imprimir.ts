import { createHash, randomUUID } from "node:crypto";
import { link, mkdir, open, readFile, unlink } from "node:fs/promises";
import { resolve, sep } from "node:path";
import type { Executor } from "../../kernel/gateway/gateway.js";

export interface DocumentoParaImpressao {
  id: string;
  version: number;
  patientId: string | null;
  html: string;
  assinado: boolean;
  hash: string;
  /** Modelo intencionalmente vazio precisa estar identificado no próprio documento. */
  modeloEmBranco?: boolean;
}

export interface ResolverDocumentoImpressao {
  resolver(input: { id: string; version: number }): Promise<DocumentoParaImpressao | null>;
}

export interface OpcoesExecutorImprimir {
  dataDir: string;
  resolverDocumento: ResolverDocumentoImpressao;
  agora?: () => string;
}

const segmentoSeguro = (value: string) =>
  /^[A-Za-z0-9_-]{1,160}$/.test(value);

function hashHtml(html: string): string {
  return createHash("sha256").update(html, "utf8").digest("hex");
}

/** Acrescenta botão explícito; nunca dispara impressão ao abrir o arquivo. */
export function htmlComImpressaoPorClique(html: string): string {
  const control = '<button id="imprimir-documento" type="button">Imprimir</button><script>document.getElementById("imprimir-documento")?.addEventListener("click",()=>window.print())</script>';
  return /<\/body\s*>/i.test(html)
    ? html.replace(/<\/body\s*>/i, `${control}</body>`)
    : `${html}${control}`;
}

function objetoDoIntent(intent: Parameters<Executor["executar"]>[0]) {
  return intent.objeto;
}

/** Executor puro em relação a autorização: identidade/assinatura são resolvidas no servidor. */
export function criarExecutorImprimir(options: OpcoesExecutorImprimir): Executor {
  const dataRoot = resolve(options.dataDir);
  const agora = options.agora ?? (() => new Date().toISOString());

  return {
    async executar(intent) {
      if (intent.verbo !== "IMPRIMIR") return { ok: false, incerto: false, erro: "VERBO_INVALIDO" };
      const { id, versao } = objetoDoIntent(intent);
      if (intent.objeto.tipo !== "DOCUMENTO" || !segmentoSeguro(id) || !Number.isSafeInteger(versao) || versao < 1) {
        return { ok: false, incerto: false, erro: "DOCUMENTO_INVALIDO" };
      }
      let documento: DocumentoParaImpressao | null;
      try {
        documento = await options.resolverDocumento.resolver({ id, version: versao });
      } catch {
        return { ok: false, incerto: false, erro: "DOCUMENTO_NAO_RESOLVIDO" };
      }
      if (!documento || documento.id !== id || documento.version !== versao) {
        return { ok: false, incerto: false, erro: "DOCUMENTO_NAO_RESOLVIDO" };
      }
      const modeloVazio = documento.modeloEmBranco === true && documento.patientId === null &&
        intent.escopo.patientId === null && /modelo\s+em\s+branco/i.test(documento.html);
      if (!modeloVazio && (!documento.assinado || !documento.patientId || intent.escopo.patientId !== documento.patientId)) {
        return { ok: false, incerto: false, erro: "DOCUMENTO_NAO_ASSINADO_OU_ESCOPO_DIVERGENTE" };
      }
      const actualHash = hashHtml(documento.html);
      if (!/^[a-f0-9]{64}$/i.test(documento.hash) || actualHash.toLowerCase() !== documento.hash.toLowerCase()) {
        return { ok: false, incerto: false, erro: "HASH_DOCUMENTO_DIVERGENTE" };
      }
      const date = agora().slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, incerto: false, erro: "DATA_INVALIDA" };
      const folder = resolve(dataRoot, "impressao", date);
      const path = resolve(folder, `${id}@${versao}.html`);
      if (!folder.startsWith(`${dataRoot}${sep}`) || !path.startsWith(`${folder}${sep}`)) {
        return { ok: false, incerto: false, erro: "CAMINHO_FORA_DO_DATA_DIR" };
      }
      const printable = htmlComImpressaoPorClique(documento.html);
      const temporaryPath = resolve(folder, `.print-${randomUUID()}.tmp`);
      let ownsTemporary = false;
      try {
        await mkdir(folder, { recursive: true });
        const file = await open(temporaryPath, "wx", 0o600);
        ownsTemporary = true;
        try {
          await file.writeFile(printable, "utf8");
          await file.sync();
        } finally {
          await file.close();
        }
        try {
          // Hard-link publication is atomic and fails if another operation already owns the target.
          await link(temporaryPath, path);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
            return { ok: false, incerto: true, erro: "FALHA_PUBLICACAO_IMPRESSAO" };
          }
          // An EEXIST target was published atomically by another writer, never read mid-write.
          try {
            const existing = await readFile(path, "utf8");
            if (existing !== printable) return { ok: false, incerto: false, erro: "VERSAO_DOCUMENTO_JA_GRAVADA_COM_OUTRO_CONTEUDO" };
          } catch {
            return { ok: false, incerto: true, erro: "ARTEFATO_EXISTENTE_INDISPONIVEL" };
          }
        }
        return { ok: true, recibo: path };
      } catch (error) {
        return { ok: false, incerto: true, erro: "FALHA_ESCRITA_IMPRESSAO" };
      } finally {
        if (ownsTemporary) await unlink(temporaryPath).catch(() => undefined);
      }
    },
  };
}
