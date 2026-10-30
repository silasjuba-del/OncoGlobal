import { useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { FilePayload } from '../platform/platform';
import { getLibrary } from '../ai/library';

export function EnviarOncoGlobal({ original, documento, obterDerivado }: {
  original: FilePayload; documento: PDFDocumentProxy | null;
  obterDerivado?: () => Promise<{ name: string; bytes: Uint8Array; descricao: string } | undefined>;
}) {
  const [autor, setAutor] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const emCurso = useRef(false);
  async function exportar() {
    if (!autor.trim() || !documento || emCurso.current) return;
    const ponte = window.pdfforge?.exportarOncoGlobal;
    if (!ponte) { setMensagem('Abra no aplicativo desktop para exportar o pacote local.'); return; }
    emCurso.current = true; setOcupado(true); setMensagem('');
    try {
      let paginasExtraidas: { pagina: number; texto: string }[] = [];
      let textoOmitido = documento.numPages > 1000, totalTexto = 0;
      for (let n = 1; n <= documento.numPages && !textoOmitido; n++) {
        const conteudo = await (await documento.getPage(n)).getTextContent();
        const texto = conteudo.items.map(x => 'str' in x ? x.str : '').join(' ');
        totalTexto += texto.length;
        if (totalTexto > 200000) { textoOmitido = true; paginasExtraidas = []; }
        else paginasExtraidas.push({ pagina: n, texto });
      }
      const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(original.bytes));
      const chaveDocumento = `sha256:${Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')}`;
      const notasLegadas = getLibrary().annotations.some(a => a.docKey === (original.path ?? `${original.name}:${original.bytes.length}`));
      const anotacoes = getLibrary().annotations.filter(a => a.docKey === chaveDocumento).map(a => ({
        id: a.id, pagina: a.page, texto: a.text, autorTipo: a.source === 'ai' ? 'IA' as const : 'USUARIO' as const,
        autor: a.source === 'ai' ? 'Proposta IA não revisada' : autor.trim(), criadoEm: new Date(a.createdAt).toISOString(),
      }));
      const derivado = await obterDerivado?.();
      const resultado = await ponte({ original, autor: autor.trim(), paginasExtraidas, anotacoes, ...(derivado ? { derivado } : {}) });
      if (!resultado.ok) throw Error(resultado.codigo ?? 'EXPORTACAO_FALHOU');
      setMensagem(`Pacote local salvo em ${resultado.caminho}.${textoOmitido ? " Texto auxiliar excedeu o limite e foi omitido; PDF original preservado integralmente." : ""} ${notasLegadas ? "Anotacoes antigas sem vinculo por conteudo nao foram incluidas; permanecem preservadas na biblioteca. " : ""}No OncoGlobal, selecione o encontro e importe em Documentos. Recebido não significa revisado.`);
    } catch (erro) { setMensagem(erro instanceof Error ? erro.message : 'EXPORTACAO_FALHOU'); }
    finally { emCurso.current = false; setOcupado(false); }
  }
  return <section aria-label="Enviar ao OncoGlobal" className="notice">
    <label>Autor declarado da exportação <input aria-label="Autor da exportação" value={autor} maxLength={160} onChange={e => setAutor(e.target.value)} disabled={ocupado} /></label>
    <button className="btn btn-primary" disabled={ocupado || !autor.trim() || !documento} onClick={() => void exportar()}>Enviar ao OncoGlobal — pacote local</button>
    <small>Contém o documento original. Não envia à nuvem, não vincula paciente e não assina.</small>
    {mensagem ? <p role="status">{mensagem}</p> : null}
  </section>;
}
