import { BibliotecaConsulta, BibliotecaEstado, type ApiBiblioteca, type PacoteBibliotecaHttp } from "../../contracts/api/biblioteca.js";

export interface RespostaBibliotecaHttp { status: number; json: unknown }
export type EnviarBibliotecaAutenticado = (rota: string, corpo: unknown, signal?: AbortSignal) => Promise<RespostaBibliotecaHttp>;

function codigo(json: unknown): string {
  return json && typeof json === "object" && "codigo" in json && typeof json.codigo === "string"
    ? json.codigo : "BIBLIOTECA_PAYLOAD_INVALIDO";
}

function aceitar(resposta: RespostaBibliotecaHttp, esperado: readonly number[] = [200]): Record<string, unknown> {
  if (!esperado.includes(resposta.status) || !resposta.json || typeof resposta.json !== "object")
    throw new Error(codigo(resposta.json));
  return resposta.json as Record<string, unknown>;
}

/** Cliente da biblioteca sobre o mesmo transporte autenticado e a mesma sessão da consulta local. */
export function criarApiBiblioteca(enviar: EnviarBibliotecaAutenticado): ApiBiblioteca {
  return {
    async estado(pacoteId) {
      const resposta = await enviar("/biblioteca/estado", pacoteId ? { pacoteId } : {});
      const json = aceitar(resposta);
      const parsed = BibliotecaEstado.safeParse(json);
      if (!parsed.success) throw new Error("BIBLIOTECA_PAYLOAD_INVALIDO");
      return parsed.data;
    },
    async importar(pacote: PacoteBibliotecaHttp) {
      const json = aceitar(await enviar("/biblioteca/importar", pacote), [201]);
      if (typeof json.pacoteId !== "string" || typeof json.hash !== "string") throw new Error("BIBLIOTECA_PAYLOAD_INVALIDO");
      return { codigo: String(json.codigo ?? "PACOTE_IMPORTADO_RASCUNHO"), pacoteId: json.pacoteId, hash: json.hash };
    },
    async curar(pedido) { return aceitar(await enviar("/biblioteca/curar", pedido)) as { codigo: string }; },
    async ativar(pedido) { return aceitar(await enviar("/biblioteca/ativar", pedido)) as { codigo: string }; },
    async rollback(pedido) { return aceitar(await enviar("/biblioteca/rollback", pedido)) as { codigo: string }; },
    async consultar(pedido) {
      const json = aceitar(await enviar("/biblioteca/consultar", pedido));
      const parsed = BibliotecaConsulta.safeParse(json);
      if (!parsed.success) throw new Error("BIBLIOTECA_PAYLOAD_INVALIDO");
      return parsed.data;
    },
  };
}
