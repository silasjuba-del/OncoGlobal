import { expect, it } from 'vitest';
import { criarDocumentoMedicoProposto } from '../../../src/ui/medico/documentoProposto.js';
import { PlanoFlashEntrada } from '../../../src/server/flash.js';
const contexto = { patientId: `paciente:${'a'.repeat(64)}`, encounterId: `encontro:${'b'.repeat(64)}`, tumorLotId: null };
it('IDs longos/opacos de paciente e encontro produzem ID documental válido e estável', async () => {
  const d = await criarDocumentoMedicoProposto(contexto, 'ORIENTACOES', 'Orientação SINTETICA');
  expect(d.id.length).toBeLessThanOrEqual(101);
  expect(d.id).toMatch(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,100}$/);
  expect(PlanoFlashEntrada.shape.documentosManuais.safeParse([d]).success).toBe(true);
  expect((await criarDocumentoMedicoProposto(contexto, 'ORIENTACOES', 'Outra edição SINTETICA')).id).toBe(d.id);
  expect((await criarDocumentoMedicoProposto({ ...contexto, tumorLotId: 'outro-lote' }, 'ORIENTACOES', 'SINTETICO')).id).not.toBe(d.id);
});
it('não trunca texto nem aceita documento acima do limite canônico', async () => {
  const texto = 'S'.repeat(8000);
  const d = await criarDocumentoMedicoProposto(contexto, 'LAUDO', texto);
  expect(d.texto).toBe(texto);
  expect(PlanoFlashEntrada.shape.documentosManuais.safeParse([d]).success).toBe(true);
  await expect(criarDocumentoMedicoProposto(contexto, 'LAUDO', texto + 'X')).rejects.toThrow('DOCUMENTO_TEXTO_EXCESSIVO');
});
