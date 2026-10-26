import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { PacoteDocumental } from '../../../src/contracts/api/importacaoDocumental.js';
const require = createRequire(import.meta.url);
const { montarPacoteDocumental } = require('../../../integrations/pdfforge/exportar-pacote.cjs') as {
  montarPacoteDocumental: (entrada: unknown, opcoes?: { agora?: string; pacoteId?: string }) => unknown;
};
const bytes = new Uint8Array(Buffer.from('%PDF-1.4\nSINTETICO\n%%EOF'));
const entrada = () => ({ original: { name: 'SINTETICO.pdf', bytes }, autor: 'Autor SINTETICO',
  paginasExtraidas: [{ pagina: 1, texto: 'SINTETICO: nega febre, hipótese a conferir.' }],
  anotacoes: [{ id: 'nota-1', pagina: 1, texto: 'Proposta SINTETICA', autorTipo: 'IA', autor: 'IA', criadoEm: '2026-10-26T12:00:00Z' }] });
describe('conformidade exporter PDFForge → contrato OncoGlobal', () => {
  it('gera pacote aceito com bytes/hashes exatos e sem identidade de paciente ou credencial do app', () => {
    const raw = montarPacoteDocumental({ ...entrada(), patientId: 'NAO_TRANSFERIR', token: 'SEGREDO_SINTETICO' });
    const p = PacoteDocumental.parse(raw);
    expect(p.schema).toBe('oncoglobal.import.v1');
    expect(Buffer.from(p.original.bytesBase64, 'base64')).toEqual(Buffer.from(bytes));
    expect(p.original.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
    expect(p.anotacoes[0]?.autorTipo).toBe('IA');
    expect(JSON.stringify(raw)).not.toContain('NAO_TRANSFERIR');
    expect(JSON.stringify(raw)).not.toContain('SEGREDO_SINTETICO');
  });
  it('derivado conserva origem e hash próprio sem substituir original', () => {
    const alterado = new Uint8Array(Buffer.from('%PDF-1.4\nDERIVADO SINTETICO\n%%EOF'));
    const p = PacoteDocumental.parse(montarPacoteDocumental({ ...entrada(), derivado: { name: 'derivado.pdf', bytes: alterado, descricao: 'Anotação local' } }));
    expect(p.derivado?.originalSha256).toBe(p.original.sha256);
    expect(p.derivado?.sha256).not.toBe(p.original.sha256);
    expect(Buffer.from(p.original.bytesBase64, 'base64')).toEqual(Buffer.from(bytes));
  });
  it('recusa conteúdo não PDF, excesso combinado e metadados duplicados', () => {
    expect(() => montarPacoteDocumental({ ...entrada(), original: { name: 'x.pdf', bytes: new Uint8Array([1]) } })).toThrow('PDF_INVALIDO');
    const grande = new Uint8Array(5 * 1024 * 1024); grande.set(Buffer.from('%PDF-'));
    expect(() => montarPacoteDocumental({ ...entrada(), original: { name: 'a.pdf', bytes: grande }, derivado: { name: 'b.pdf', bytes: grande, descricao: 'SINTETICO' } })).toThrow('DOCUMENTOS_EXCESSIVOS');
    expect(() => montarPacoteDocumental({ ...entrada(), paginasExtraidas: [{ pagina: 1, texto: 'a' }, { pagina: 1, texto: 'b' }] })).toThrow('METADADOS_INVALIDOS');
  });
});
