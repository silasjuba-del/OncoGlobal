import { FontePackResposta, ResumoPack, LotePackLeitura, type PedidoFontePack } from '../contracts/fase2/leituraPack.js';
import type { RevisaoClinicaResposta } from '../contracts/fase2/revisaoClinica.js';
import type { CatalogoTumorPacks } from '../kernel/corpus/tumorPacks.js';

/** Apenas transporte. Se não há lote completo, conserva os blocos de compatibilidade. */
export function compactarRevisaoClinica(r: RevisaoClinicaResposta): RevisaoClinicaResposta {
  if (!r.pack || !r.loteCompleto || !('blocos' in r.pack) || !('conteudoIntegral' in r.loteCompleto)) return r;
  const { blocos: _blocos, ...pack } = r.pack;
  const { conteudoIntegral: _integral, ...lote } = r.loteCompleto;
  return { ...r, pack: ResumoPack.parse({ ...pack, schema: 'tumor-pack-leitura.v1' }),
    loteCompleto: LotePackLeitura.parse({ ...lote, schema: 'LoteTumoralLeitura@1' }) };
}

/** Fonte do catálogo já carregado: nenhum caminho de disco é aceito do cliente. */
export function lerFontePack(catalogo: CatalogoTumorPacks, pedido: PedidoFontePack): FontePackResposta {
  const p = catalogo.packs.find(p => p.referencia.id === pedido.packId);
  const l = p && catalogo.lotes?.[p.referencia.id];
  if (!p || !l) throw Error('FONTE_PACK_INDISPONIVEL');
  if (p.original.hash !== pedido.hashOriginal || l.original.sha256 !== pedido.hashOriginal
    || l.original.arquivo !== p.original.arquivo) throw Error('FONTE_PACK_ALTERADA');
  const { packId, hashOriginal: _hash, ...contexto } = pedido;
  return FontePackResposta.parse({ codigo: 'FONTE_PACK_CARREGADA', contexto, packId,
    original: l.original, conteudoIntegral: l.conteudoIntegral });
}
