import type { DatabaseSync } from "node:sqlite";
import { ConhecimentoBrainSchema, FiltrosConhecimentoBrainSchema } from "../contracts/conhecimentoBrain.js";
import { criarBiblioteca, indexarAplicabilidade } from "../kernel/corpus/biblioteca.js";
import type { ReferenciaCandidataBrainOs } from "../kernel/llm/brainOs.js";
import { referenciaBibliotecaAtiva } from "./biblioteca.js";

/** Consulta apenas o catálogo local vigente; nenhuma permissão de curadoria ou rede. */
export function lerConhecimentoBrain(db: DatabaseSync, filtrosRaw: unknown = {}) {
  const filtros = FiltrosConhecimentoBrainSchema.parse(filtrosRaw);
  const referencia = referenciaBibliotecaAtiva(db);
  if (!referencia) return { referenciasCandidatas: [] as ReferenciaCandidataBrainOs[], conhecimento: ConhecimentoBrainSchema.parse({
    biblioteca: null, origem: null, filtros, filtrosSaoFatosClinicos: false, referencias: [],
  }) };
  const lib = criarBiblioteca(db, { autorizarCuradoria: () => null, emitir: () => { throw Error("CURADORIA_NAO_AUTORIZADA"); } });
  const pacoteId = lib.ativa();
  if (!pacoteId) throw Error("BIBLIOTECA_ATIVA_AUSENTE");
  const manifesto = lib.manifesto(pacoteId);
  const itens = lib.listar(pacoteId);
  const filtrosDefinidos = Object.fromEntries(Object.entries(filtros).filter(([, value]) => value !== undefined));
  const consultaveis = new Set(lib.consultar(filtrosDefinidos).map(i => i.id));
  const aplicaveis = indexarAplicabilidade(itens)(filtrosDefinidos);
  const hashes = new Map(manifesto.itens.map(i => [i.id, i.sha256]));
  const referenciasCandidatas: ReferenciaCandidataBrainOs[] = itens.map(i => ({
    referenciaId: i.id, versao: i.versao, status: i.estado,
    // consultar aplica também aprovação transitiva das dependências.
    escopoCompativel: aplicaveis.has(i.id), provenienciaCompleta: true, dependenciasAprovadas: consultaveis.has(i.id),
    termosChave: [i.titulo, ...Object.values(i.aplicabilidade).flat()],
    motivoInclusaoSeAplicavel: `Referência local curada com correspondência lexical: ${i.titulo}. Aplicabilidade sujeita à revisão médica.`,
  }));
  return { referenciasCandidatas, conhecimento: ConhecimentoBrainSchema.parse({
    biblioteca: referencia, origem: manifesto.origem, filtros, filtrosSaoFatosClinicos: false,
    referencias: itens.map(i => ({ referenciaId: i.id, versao: i.versao, titulo: i.titulo,
      contentHash: hashes.get(i.id), fonte: i.proveniencia.fonte, publicadoEm: i.proveniencia.publicadoEm,
      recuperadoEm: i.proveniencia.recuperadoEm, trecho: i.proveniencia.trecho.slice(0, 4000), estado: i.estado })),
  }) };
}
