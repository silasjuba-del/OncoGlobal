import { LIMITE_TEXTO_DOCUMENTO_MANUAL, type DocumentoManualFlash } from '../../contracts/api/flash.js';
export async function criarDocumentoMedicoProposto(contexto: { patientId: string; encounterId: string; tumorLotId?: string | null },
  tipo: 'ORIENTACOES' | 'LAUDO', texto: string): Promise<DocumentoManualFlash> {
  if (!texto.trim()) throw Error('DOCUMENTO_TEXTO_AUSENTE');
  if (texto.length > LIMITE_TEXTO_DOCUMENTO_MANUAL) throw Error('DOCUMENTO_TEXTO_EXCESSIVO');
  const bytes = new TextEncoder().encode(JSON.stringify([contexto.patientId, contexto.encounterId, contexto.tumorLotId ?? null, tipo]));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  return { id: `${tipo.toLowerCase()}-${hash}`, tipo, titulo: tipo === 'ORIENTACOES' ? 'Orientação dietética revisada' : 'Documento médico — proposta revisada', destino: null, texto };
}
