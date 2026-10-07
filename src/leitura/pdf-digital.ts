// FUGU-02 · PDF digital local (D-W9-58: dependência aprovada `pdfjs-dist`).
// Import ESTÁTICO do build legado para Node (import dinâmico reprova o check de fronteiras);
// sem worker remoto, sem fontes/CMaps buscados por rede e sem envio de PHI a serviço externo.
// PDF escaneado/sem texto continua PENDENTE (D-W9-09) — nunca pede foto nova.
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export interface PaginaTexto {
  readonly n: number;
  readonly texto: string;
}

/** Extrai o texto por página de um PDF digital; nada sai do PC e nenhum recurso remoto é carregado. */
export async function lerPdfDigital(conteudo: Uint8Array): Promise<readonly PaginaTexto[]> {
  // Cópia para um Uint8Array próprio: o parser não deve receber (nem mutar) o buffer do chamador,
  // e Buffers pequenos do Node compartilham o ArrayBuffer do pool — o parser precisa do recorte exato.
  const dados = new Uint8Array(conteudo.byteLength);
  dados.set(conteudo);
  const tarefa = getDocument({
    data: dados,
    disableFontFace: true,
    useSystemFonts: false,
    useWorkerFetch: false,
    useWasm: false,
    verbosity: 0,
  });
  const documento = await tarefa.promise;
  try {
    const paginas: PaginaTexto[] = [];
    for (let n = 1; n <= documento.numPages; n++) {
      const pagina = await documento.getPage(n);
      const conteudoPagina = await pagina.getTextContent();
      const texto = conteudoPagina.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ").replace(/\s+/g, " ").trim();
      paginas.push({ n, texto });
    }
    return paginas;
  } finally {
    await tarefa.destroy();
  }
}
