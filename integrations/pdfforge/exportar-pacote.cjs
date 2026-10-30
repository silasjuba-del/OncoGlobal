// Contrato documental local. Não chama rede, não seleciona paciente e não assina.
const { createHash, randomUUID } = require('node:crypto');
const MAX_BYTES = 8 * 1024 * 1024;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function texto(value, max, codigo) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw Error(codigo);
  return value;
}
function pdf(file) {
  if (!file || !(file.bytes instanceof Uint8Array)) throw Error('PDF_BYTES_INVALIDOS');
  const bytes = Buffer.from(file.bytes);
  if (!bytes.length || bytes.length > MAX_BYTES || bytes.subarray(0, 5).toString() !== '%PDF-') throw Error('PDF_INVALIDO_OU_EXCESSIVO');
  return { nome: texto(file.name, 240, 'NOME_INVALIDO'), mediaType: 'application/pdf', bytesBase64: bytes.toString('base64'), sha256: hash(bytes) };
}
function montarPacoteDocumental(entrada, opcoes = {}) {
  const original = pdf(entrada.original);
  const autor = texto(entrada.autor, 160, 'AUTOR_INVALIDO');
  const criadoEm = opcoes.agora ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(criadoEm))) throw Error('DATA_INVALIDA');
  const paginasExtraidas = entrada.paginasExtraidas ?? [];
  const anotacoes = entrada.anotacoes ?? [];
  if (!Array.isArray(paginasExtraidas) || paginasExtraidas.length > 1000 || !Array.isArray(anotacoes) || anotacoes.length > 1000) throw Error('METADADOS_EXCESSIVOS');
  const paginas = paginasExtraidas.map(p => {
    if (!Number.isInteger(p.pagina) || p.pagina < 1 || p.pagina > 10000 || typeof p.texto !== 'string' || p.texto.length > 200000) throw Error('PAGINA_INVALIDA');
    return { pagina: p.pagina, texto: p.texto };
  });
  const notas = anotacoes.map(a => {
    if (!Number.isInteger(a.pagina) || a.pagina < 1 || a.pagina > 10000 || !['USUARIO', 'IA'].includes(a.autorTipo)
      || !Number.isFinite(Date.parse(a.criadoEm))) throw Error('ANOTACAO_INVALIDA');
    return { id: texto(a.id, 200, 'ANOTACAO_ID_INVALIDO'), pagina: a.pagina, texto: texto(a.texto, 20000, 'ANOTACAO_TEXTO_INVALIDO'),
      autorTipo: a.autorTipo, autor: texto(a.autor, 160, 'ANOTACAO_AUTOR_INVALIDO'), criadoEm: a.criadoEm };
  });
  if (new Set(paginas.map(p => p.pagina)).size !== paginas.length || new Set(notas.map(a => a.id)).size !== notas.length
    || paginas.reduce((n, p) => n + p.texto.length, 0) > 200000 || notas.reduce((n, a) => n + a.texto.length, 0) > 200000) throw Error('METADADOS_INVALIDOS');
  const derivado = entrada.derivado ? { ...pdf(entrada.derivado), descricao: texto(entrada.derivado.descricao, 1000, 'DERIVADO_DESCRICAO_INVALIDA'), originalSha256: original.sha256 } : undefined;
  if (entrada.original.bytes.length + (entrada.derivado?.bytes.length ?? 0) > MAX_BYTES) throw Error('DOCUMENTOS_EXCESSIVOS');
  return { schema: 'oncoglobal.import.v1', pacoteId: opcoes.pacoteId ?? `pdfforge-${randomUUID()}`,
    origem: { aplicativo: 'PDFForge', versao: '0.1.0' }, autor, criadoEm, original,
    paginasExtraidas: paginas, anotacoes: notas, ...(derivado ? { derivado } : {}) };
}
module.exports = { montarPacoteDocumental, MAX_BYTES };
