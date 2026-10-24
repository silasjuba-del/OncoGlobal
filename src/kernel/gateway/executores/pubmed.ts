import { z } from "zod";
import { LIMITE_BYTES_PUBMED, LIMITE_REFERENCIAS_PUBMED, ORIGEM_EUTILS, ReferenciaPubMed } from "../../../contracts/leituraPubMed.js";
import type { ReadTransport } from "../gateway.js";

const IDENTIFICADOR = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{11,}\b|@/;
const Resumo = z.object({
  uid: z.string().regex(/^\d{1,9}$/),
  title: z.string(),
  source: z.string(),
  pubdate: z.string(),
}).passthrough();

/** E-utilities recebe só a consulta bibliográfica. Paciente, sessão e prontuário não entram na URL. */
export function criarTransportePubMed(opcoes: {
  cliente?: typeof fetch; retmax?: number; maxBytes?: number; agora?: () => string;
} = {}): ReadTransport {
  const cliente = opcoes.cliente ?? fetch;
  const retmax = Math.min(opcoes.retmax ?? LIMITE_REFERENCIAS_PUBMED, LIMITE_REFERENCIAS_PUBMED);
  const maxBytes = opcoes.maxBytes ?? LIMITE_BYTES_PUBMED;
  const agora = opcoes.agora ?? (() => new Date().toISOString());
  return async ({ query, refs, signal }) => {
    if (signal.aborted) throw new Error("READ_CANCELADA");
    if (query && refs?.length) throw new Error("READ_CONSULTA_MISTA");
    if (query && IDENTIFICADOR.test(query)) throw new Error("READ_CONSULTA_RECUSADA");
    const ids = refs ? pmids(refs, retmax) : await buscar(cliente, query ?? "", retmax, maxBytes, signal);
    if (ids.length === 0) return { referencias: [] };
    const recuperadoEm = agora();
    const bruto = await lerJson(cliente, endereco("esummary.fcgi", { id: ids.join(",") }), maxBytes, signal);
    const envelope = z.object({ result: z.record(z.string(), z.unknown()) }).passthrough().safeParse(bruto);
    if (!envelope.success) throw new Error("READ_RESPOSTA_INVALIDA");
    const result = envelope.data.result;
    const referencias = ids.flatMap((pmid) => {
      const item = Resumo.safeParse(result[pmid]);
      if (!item.success || item.data.uid !== pmid) return [];
      const titulo = item.data.title.replace(/\s+/g, " ").trim().slice(0, 500);
      const periodico = item.data.source.replace(/\s+/g, " ").trim().slice(0, 240);
      const publicadoEm = item.data.pubdate.replace(/\s+/g, " ").trim().slice(0, 40);
      if (!titulo || !periodico || !publicadoEm) return [];
      const referencia = ReferenciaPubMed.safeParse({
        pmid, titulo, periodico, publicadoEm, recuperadoEm, fatoClinico: false,
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      });
      return referencia.success ? [referencia.data] : [];
    });
    return { referencias };
  };
}

function pmids(refs: readonly string[], retmax: number): string[] {
  if (refs.length > retmax || refs.some((id) => !/^\d{1,9}$/.test(id) || IDENTIFICADOR.test(id)))
    throw new Error("READ_CONSULTA_RECUSADA");
  return [...new Set(refs)];
}

async function buscar(cliente: typeof fetch, query: string, retmax: number, maxBytes: number, signal: AbortSignal) {
  const bruto = await lerJson(cliente, endereco("esearch.fcgi", { term: query, retmax: String(retmax) }), maxBytes, signal);
  const lista = z.object({ esearchresult: z.object({ idlist: z.array(z.string()) }).passthrough() }).passthrough().safeParse(bruto);
  if (!lista.success) throw new Error("READ_RESPOSTA_INVALIDA");
  return pmids(lista.data.esearchresult.idlist.slice(0, retmax), retmax);
}

function endereco(caminho: "esearch.fcgi" | "esummary.fcgi", params: Record<string, string>) {
  const url = new URL(`/entrez/eutils/${caminho}`, ORIGEM_EUTILS);
  url.searchParams.set("db", "pubmed");
  url.searchParams.set("retmode", "json");
  url.searchParams.set("tool", "oncoglobal");
  for (const [chave, valor] of Object.entries(params)) url.searchParams.set(chave, valor);
  if (url.origin !== ORIGEM_EUTILS) throw new Error("READ_DESTINO_FORA_DA_ALLOWLIST");
  return url;
}

async function lerJson(cliente: typeof fetch, url: URL, maxBytes: number, signal: AbortSignal) {
  const resposta = await cliente(url, { method: "GET", redirect: "error", signal });
  if (!resposta.ok) throw new Error("READ_PROVEDOR_RECUSOU");
  const declarado = Number(resposta.headers.get("content-length") ?? "0");
  if (Number.isFinite(declarado) && declarado > maxBytes) throw new Error("READ_RESPOSTA_GRANDE");
  const bytes = new Uint8Array(await resposta.arrayBuffer());
  if (bytes.byteLength > maxBytes) throw new Error("READ_RESPOSTA_GRANDE");
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new Error("READ_RESPOSTA_INVALIDA"); }
}
