import { z } from 'zod';
import { Id } from '../base.js';
import { ContextoDutosVisao } from '../api/dutos.js';
import { TumorPackExtract, conferirEstadoPack } from './tumorPack.js';
import { LoteCompleto, conferirSetoresPack } from './loteCompleto.js';

// Projeções de transporte: não substituem contratos de ativação nem o corpus original.
const { blocos: _blocos, ...pack } = TumorPackExtract.shape;
export const ResumoPack = z.object({ ...pack, schema: z.literal('tumor-pack-leitura.v1') }).strict().superRefine(conferirEstadoPack);
const { conteudoIntegral: _integral, ...lote } = LoteCompleto.shape;
export const LotePackLeitura = z.object({ ...lote, schema: z.literal('LoteTumoralLeitura@1') }).strict().superRefine(conferirSetoresPack);
export type LotePackLeitura = z.infer<typeof LotePackLeitura>;

export const PedidoFontePack = ContextoDutosVisao.extend({
  packId: Id, hashOriginal: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export type PedidoFontePack = z.infer<typeof PedidoFontePack>;
export const FontePackResposta = z.object({
  codigo: z.literal('FONTE_PACK_CARREGADA'), contexto: ContextoDutosVisao,
  packId: Id, original: LoteCompleto.shape.original, conteudoIntegral: z.json(),
}).strict();
export type FontePackResposta = z.infer<typeof FontePackResposta>;
