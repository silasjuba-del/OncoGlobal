import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { Instante, Sessao } from "../contracts/base.js";
import { BibliotecaEstado, ItemBibliotecaConteudo, type ItemBibliotecaConteudo as ItemBibliotecaConteudoTipo } from "../contracts/api/biblioteca.js";
import { BuscaAcervoResposta, DocumentRef, LeituraAcervoResposta, PedidoBuscaAcervo, PedidoLeituraAcervo,
  type LocalizadorAcervo } from "../contracts/api/consultaAcervo.js";
import { hashCanonico } from "../modules/hash.js";
import { hashCuradoriaPacote, rotearBiblioteca } from "./biblioteca.js";
import type { GerenciadorSessao } from "./sessao.js";

export interface DepsConsultaAcervo { db: DatabaseSync; sessoes: GerenciadorSessao; agora: () => string }
type Localizador = z.infer<typeof LocalizadorAcervo>;
const campos = ["TITULO", "TEXTO", "TRECHO_FONTE"] as const;
const textoCampo = (item: ItemBibliotecaConteudo, campo: Localizador["campo"]) => campo === "TITULO" ? item.titulo : campo === "TEXTO" ? item.texto : item.proveniencia.trecho;
const docId = (pacoteId: string, item: ItemBibliotecaConteudo) => `acervo:${hashCanonico({ pacoteId, itemId: item.id, versao: item.versao })}`;
function referencia(pacoteId: string, item: ItemBibliotecaConteudo, revisaoAcervo: string, localizador: Localizador) {
  const texto = textoCampo(item, localizador.campo);
  if (localizador.fim > texto.length) throw Error("ACERVO_LOCALIZADOR_INVALIDO");
  return DocumentRef.parse({ schema: "DocumentRef@1", docId: docId(pacoteId, item), pacoteId, itemId: item.id,
    versao: item.versao, hashSha256: hashCanonico(item), revisaoAcervo, titulo: item.titulo,
    natureza: "ITEM_TEXTUAL_CURADO", classificacao: "NAO_DECLARADA", originalBinarioDisponivel: false,
    localizador, trecho: texto.slice(localizador.inicio, localizador.fim), proveniencia: item.proveniencia });
}

/** Leitura autenticada dos itens já curados. Não consulta rede nem promove itens ao corpus. */
export function operarConsultaAcervo(deps: DepsConsultaAcervo, token: string, rota: string, raw: unknown): { status: number; body: unknown } {
  if (rota !== "/acervo/buscar" && rota !== "/acervo/ler") return { status: 404, body: { codigo: "ROTA_NAO_ENCONTRADA" } };
  try {
    const em = deps.agora();
    if (!Instante.safeParse(em).success) return { status: 503, body: { codigo: "RELOGIO_SERVICO_INVALIDO" } };
    const sessao = Sessao.safeParse(deps.sessoes.obter(token));
    if (!sessao.success || Date.parse(sessao.data.emitidaEm) > Date.parse(em) || Date.parse(sessao.data.expiraEm) <= Date.parse(em))
      return { status: 401, body: { codigo: "SESSAO_INVALIDA" } };
    const pedido = rota === "/acervo/buscar" ? PedidoBuscaAcervo.parse(raw) : PedidoLeituraAcervo.parse(raw);
    const resposta = rotearBiblioteca(deps, token, "/biblioteca/estado", {}, sessao.data);
    if (!resposta || resposta.status !== 200) return resposta ?? { status: 503, body: { codigo: "ACERVO_INDISPONIVEL" } };
    const estado = BibliotecaEstado.parse(resposta.body), ref = estado.referencia;
    const pacoteId = ref ? `${ref.id}@${ref.versao}` : null;
    const porId = new Map(estado.itens.map(item => [item.id, item]));
    function aprovado(id: string, caminho = new Set<string>()): boolean {
      const item = porId.get(id);
      if (!item || !["CONSULTAVEL", "ALERTA"].includes(item.estado) || caminho.has(id)) return false;
      caminho.add(id);
      const resultado = item.dependencias.every(dep => porId.get(dep.id)?.versao === dep.versao && aprovado(dep.id, caminho));
      caminho.delete(id);
      return resultado;
    }
    const itens: ItemBibliotecaConteudoTipo[] = estado.itens.filter(i => i.estado === "CONSULTAVEL" && aprovado(i.id))
      .map(i => ItemBibliotecaConteudo.parse(i));
    const revisaoAcervo = ref && pacoteId ? hashCanonico({ referencia: ref, curadoriaHash: hashCuradoriaPacote(deps.db, pacoteId),
      ativacao: deps.db.prepare('SELECT max(seq) AS seq FROM biblioteca_ativacao').get()?.seq ?? null }) : null;
    const ordenados = [...itens].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    if ("consulta" in pedido) {
      const achados: DocumentRef[] = [];
      if (ref && revisaoAcervo) for (const item of ordenados) {
        for (const campo of campos) {
          const inicio = textoCampo(item, campo).indexOf(pedido.consulta);
          if (inicio < 0) continue;
          achados.push(referencia(pacoteId!, item, revisaoAcervo, { campo, inicio, fim: inicio + pedido.consulta.length, unidade: "UTF16" }));
          break; // Uma referência por item; busca literal, sem ranking semântico.
        }
      }
      const resultados = achados.slice(0, pedido.limite);
      return { status: 200, body: BuscaAcervoResposta.parse({
        codigo: !itens.length ? "ACERVO_VAZIO" : !achados.length ? "ACERVO_SEM_RESULTADOS" : "ACERVO_RESULTADOS",
        referenciaBiblioteca: ref, revisaoAcervo,
        cobertura: { escopo: "ITENS_CONSULTAVEIS_DO_PACOTE_ATIVO", metodo: "LITERAL_SENSIVEL_A_CAIXA", completudeFontesExternas: "NAO_GARANTIDA",
          itensConsultaveis: itens.length, encontrados: achados.length, retornados: resultados.length, truncado: achados.length > resultados.length }, resultados }) };
    }
    if (!ref || !revisaoAcervo || pedido.revisaoAcervo !== revisaoAcervo) return { status: 409, body: { codigo: "ACERVO_REVISAO_DIVERGENTE" } };
    const item = itens.find(i => docId(pacoteId!, i) === pedido.docId);
    if (!item) return { status: 404, body: { codigo: "ACERVO_DOCUMENTO_AUSENTE" } };
    if (item.versao !== pedido.versao || hashCanonico(item) !== pedido.hashSha256) return { status: 409, body: { codigo: "ACERVO_DOCUMENTO_DIVERGENTE" } };
    const campoPadrao = (["TEXTO", "TITULO", "TRECHO_FONTE"] as const).find(c => textoCampo(item, c).length > 0);
    if (!campoPadrao) return { status: 409, body: { codigo: "ACERVO_CONTEUDO_AUSENTE" } };
    const documento = referencia(pacoteId!, item, revisaoAcervo, pedido.localizador ?? { campo: campoPadrao, inicio: 0, fim: textoCampo(item, campoPadrao).length, unidade: "UTF16" });
    return { status: 200, body: LeituraAcervoResposta.parse({ codigo: "ACERVO_DOCUMENTO", referenciaBiblioteca: ref, revisaoAcervo, documento, conteudo: item }) };
  } catch (error) {
    return { status: error instanceof z.ZodError ? 400 : 409, body: { codigo: error instanceof z.ZodError ? "ACERVO_PEDIDO_INVALIDO" : error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : "ACERVO_OPERACAO_RECUSADA" } };
  }
}
