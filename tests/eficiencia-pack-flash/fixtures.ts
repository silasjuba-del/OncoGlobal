import { createHash } from 'node:crypto';
import { adaptarPackDocumental } from '../../src/kernel/corpus/tumorPacks.js';
import { montarLoteCompleto } from '../../src/kernel/corpus/loteCompleto.js';
import { contexto, packOriginal } from '../fase2/fixtures.js';
import type { RevisaoClinicaResposta } from '../../src/contracts/fase2/revisaoClinica.js';
export { contexto };
export function fixturePack() {
  const original = { ...packOriginal, tratamento: { protocolos: [
    { nome: 'Esquema sintético', variante: 'com bolus', fonte: 'fonte sintética A' },
    { nome: 'Esquema sintético', variante: 'sem bolus', fonte: 'fonte sintética B' },
  ] }, conflitos: ['Divergência sintética a conferir'] };
  const hash = createHash('sha256').update(JSON.stringify(original)).digest('hex');
  const pack = adaptarPackDocumental(original, 'fonte-sintetica.json', hash);
  const lote = montarLoteCompleto(original, pack.original.arquivo, hash);
  const catalogo = { packs: [pack], rejeitados: [], lotes: { [pack.referencia.id]: lote } };
  const resposta: RevisaoClinicaResposta = { codigo: 'REVISAO_CLINICA_CARREGADA', contexto, revisao: 'r-sintetica',
    ficha: [], preQt: { estado: 'PENDENTE', autorizaTratamento: false, pendencias: [] },
    packs: [{ id: pack.referencia.id, titulo: pack.titulo, estado: pack.estado, cids: pack.cids }],
    pack, loteCompleto: lote, pendencias: [], estadosDoenca: [],
    respostaTumoral: { criterio: 'RECIST_1_1', aplicabilidade: 'CONFERIR_CRITERIO_DO_TUMOR', series: [], patologica: [], pendencias: [] } };
  return { original, pack, lote, catalogo, resposta,
    pedido: { ...contexto, packId: pack.referencia.id, hashOriginal: hash } };
}
