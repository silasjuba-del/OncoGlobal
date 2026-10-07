// GROK-14 · K-26 / N17. Uma ficha aprovada inteira por templateId + version + hash.
// Identidade = tumor + nome + cenário + versão (D-W9-22b). Sem corpus/fichas e sem dose de trechos.

export class ErroFicha extends Error {
  readonly codigo: "TRECHOS" | "VERSAO" | "HASH" | "IDENTIDADE";

  constructor(codigo: ErroFicha["codigo"], mensagem: string) {
    super(mensagem);
    this.name = "ErroFicha";
    this.codigo = codigo;
  }
}

export interface FichaAprovada {
  templateId: string;
  versao: string;
  hash: string;
  tumor: string;
  nome: string;
  cenario: string;
}

const CATALOGO_PADRAO: readonly FichaAprovada[] = [
  {
    templateId: "ficha-teste",
    versao: "2.0.0",
    hash: "sha256:esperado",
    tumor: "tumor-sintetico",
    nome: "ficha-teste",
    cenario: "cenario-sintetico",
  },
  {
    templateId: "ficha-teste",
    versao: "1.0.0",
    hash: "sha256:anterior",
    tumor: "tumor-sintetico",
    nome: "ficha-teste",
    cenario: "cenario-sintetico-anterior",
  },
];

export function identidadeFicha(ficha: Pick<FichaAprovada, "tumor" | "nome" | "cenario" | "versao">): string {
  return `${ficha.tumor}\u001f${ficha.nome}\u001f${ficha.cenario}\u001f${ficha.versao}`;
}

export function carregarFichaAprovada(
  pedido: unknown,
  catalogo: readonly FichaAprovada[] = CATALOGO_PADRAO,
): FichaAprovada {
  if (!ehRegistro(pedido)) throw new ErroFicha("IDENTIDADE", "pedido de ficha ausente (D-W9-22b)");
  if ("trechos" in pedido || pedido.semFicha === true) {
    throw new ErroFicha("TRECHOS", "dose remontada de trechos fora de ficha inteira é recusada (K-26)");
  }
  const templateId = texto(pedido.templateId);
  const version = texto(pedido.version);
  const hash = texto(pedido.hash);
  if (templateId === null || version === null || hash === null) {
    throw new ErroFicha("IDENTIDADE", "templateId, version e hash são obrigatórios (K-26)");
  }

  const mesmas = catalogo.filter((ficha) => ficha.templateId === templateId && ficha.versao === version);
  if (mesmas.length === 0) {
    throw new ErroFicha("VERSAO", `versão inexistente: ${version} (N17)`);
  }
  const exata = mesmas.find((ficha) => ficha.hash === hash);
  if (exata === undefined) throw new ErroFicha("HASH", "hash não confere com a ficha aprovada (K-26)");
  return fichaInteira(exata);
}

function fichaInteira(ficha: FichaAprovada): FichaAprovada {
  const campos = [ficha.templateId, ficha.versao, ficha.hash, ficha.tumor, ficha.nome, ficha.cenario];
  if (campos.some((valor) => typeof valor !== "string" || valor.trim() === "")) {
    throw new ErroFicha("IDENTIDADE", "ficha sem identidade completa (D-W9-22b)");
  }
  return {
    templateId: ficha.templateId,
    versao: ficha.versao,
    hash: ficha.hash,
    tumor: ficha.tumor,
    nome: ficha.nome,
    cenario: ficha.cenario,
  };
}

function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return !!valor && typeof valor === "object" && !Array.isArray(valor);
}

function texto(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpo = valor.trim();
  return limpo.length === 0 ? null : limpo;
}
