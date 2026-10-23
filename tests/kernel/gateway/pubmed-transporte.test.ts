import { describe, expect, it } from "vitest";
import { criarTransportePubMed } from "../../../src/kernel/gateway/executores/pubmed.js";
import { ORIGEM_EUTILS } from "../../../src/contracts/leituraPubMed.js";

const AGORA = "2026-10-05T12:00:00Z";
const SINAL = new AbortController().signal;

function jsonResposta(corpo: unknown, status = 200, contentLength?: string) {
  const bytes = new TextEncoder().encode(JSON.stringify(corpo));
  let leu = false;
  return {
    resposta: {
      ok: status >= 200 && status < 300,
      headers: { get: (nome: string) => nome.toLowerCase() === "content-length" ? (contentLength ?? String(bytes.byteLength)) : null },
      arrayBuffer: async () => {
        leu = true;
        const copia = new Uint8Array(bytes.byteLength);
        copia.set(bytes);
        return copia.buffer;
      },
    } as unknown as Response,
    leu: () => leu,
  };
}

function clienteDe(responder: (url: URL, init: RequestInit) => Response) {
  const chamadas: { url: URL; init: RequestInit }[] = [];
  const cliente = (async (entrada: URL | RequestInfo, init?: RequestInit) => {
    const url = entrada instanceof URL ? entrada : new URL(String(entrada));
    chamadas.push({ url, init: init ?? {} });
    return responder(url, init ?? {});
  }) as typeof fetch;
  return { cliente, chamadas };
}

describe("transporte PubMed", () => {
  it("consulta só o E-utilities, sem identificador, e monta a referência bibliográfica", async () => {
    const { cliente, chamadas } = clienteDe((url) => {
      if (url.pathname.endsWith("/esearch.fcgi")) return jsonResposta({ esearchresult: { idlist: ["12345678", "12345678"] } }).resposta;
      return jsonResposta({ result: { uids: ["12345678"], "12345678": {
        uid: "12345678", title: "Pembrolizumab  in   NSCLC", source: "N Engl J Med", pubdate: "2026 Jan",
      } } }).resposta;
    });
    const transporte = criarTransportePubMed({ cliente, agora: () => AGORA });
    const saida = await transporte({ query: "pembrolizumab metastatic nsclc", signal: SINAL });
    expect(chamadas.map((c) => c.url.pathname)).toEqual(["/entrez/eutils/esearch.fcgi", "/entrez/eutils/esummary.fcgi"]);
    for (const chamada of chamadas) {
      expect(chamada.url.origin).toBe(ORIGEM_EUTILS);
      expect(chamada.url.searchParams.get("db")).toBe("pubmed");
      expect(chamada.url.searchParams.get("retmode")).toBe("json");
      expect(chamada.url.searchParams.get("tool")).toBe("oncoglobal");
      expect(chamada.url.searchParams.has("email")).toBe(false);
      expect(chamada.init).toMatchObject({ method: "GET", redirect: "error", signal: SINAL });
      expect(chamada.url.toString()).not.toMatch(/paciente|medico|CRM|@/i);
    }
    expect(chamadas[0]?.url.searchParams.get("term")).toBe("pembrolizumab metastatic nsclc");
    expect(chamadas[0]?.url.searchParams.get("retmax")).toBe("8");
    expect(chamadas[1]?.url.searchParams.get("id")).toBe("12345678");
    expect(saida).toEqual({ referencias: [{
      pmid: "12345678", titulo: "Pembrolizumab in NSCLC", periodico: "N Engl J Med", publicadoEm: "2026 Jan",
      url: "https://pubmed.ncbi.nlm.nih.gov/12345678/", recuperadoEm: AGORA, fatoClinico: false,
    }] });
  });

  it("não chama a rede quando a consulta traz identificador, mistura ou está cancelada", async () => {
    const { cliente, chamadas } = clienteDe(() => { throw new Error("REDE_PROIBIDA"); });
    const transporte = criarTransportePubMed({ cliente, agora: () => AGORA });
    const cancelado = new AbortController();
    cancelado.abort();
    await expect(transporte({ query: "pembrolizumab", signal: cancelado.signal })).rejects.toThrow("READ_CANCELADA");
    await expect(transporte({ query: "000.000.000-00", signal: SINAL })).rejects.toThrow("READ_CONSULTA_RECUSADA");
    await expect(transporte({ query: "12345678901", signal: SINAL })).rejects.toThrow("READ_CONSULTA_RECUSADA");
    await expect(transporte({ query: `pembrolizumab ${["user", "example.com"].join("@")}`, signal: SINAL })).rejects.toThrow("READ_CONSULTA_RECUSADA");
    await expect(transporte({ query: "pembrolizumab", refs: ["12345678"], signal: SINAL })).rejects.toThrow("READ_CONSULTA_MISTA");
    await expect(transporte({ refs: ["abc", "12345678"], signal: SINAL })).rejects.toThrow("READ_CONSULTA_RECUSADA");
    await expect(transporte({ refs: ["1", "2", "3", "4", "5", "6", "7", "8", "9"], signal: SINAL })).rejects.toThrow("READ_CONSULTA_RECUSADA");
    expect(chamadas).toEqual([]);
  });

  it("omite resumo incompleto, ignora lista vazia e recusa corpo grande antes de ler", async () => {
    const grande = jsonResposta({ esearchresult: { idlist: [] } }, 200, "999999");
    let buscas = 0;
    const { cliente, chamadas } = clienteDe((url) => {
      if (url.pathname.endsWith("/esearch.fcgi")) {
        buscas += 1;
        return buscas === 1 ? jsonResposta({ esearchresult: { idlist: [] } }).resposta : grande.resposta;
      }
      return jsonResposta({ result: {
        "111": { uid: "111", title: "   ", source: "Journal", pubdate: "2026" },
        "222": { uid: "222", title: "Osimertinib in EGFR NSCLC", source: "Lancet", pubdate: "2025" },
      } }).resposta;
    });
    const transporte = criarTransportePubMed({ cliente, agora: () => AGORA, maxBytes: 1024 });
    await expect(transporte({ query: "lista vazia controlada", signal: SINAL })).resolves.toEqual({ referencias: [] });
    expect(chamadas).toHaveLength(1);
    await expect(transporte({ query: "corpo declarado grande", signal: SINAL })).rejects.toThrow("READ_RESPOSTA_GRANDE");
    expect(grande.leu()).toBe(false);
    const saida = await transporte({ refs: ["111", "222", "111"], signal: SINAL });
    expect(saida).toEqual({ referencias: [{
      pmid: "222", titulo: "Osimertinib in EGFR NSCLC", periodico: "Lancet", publicadoEm: "2025",
      url: "https://pubmed.ncbi.nlm.nih.gov/222/", recuperadoEm: AGORA, fatoClinico: false,
    }] });
  });
});
