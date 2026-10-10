export const ARQUIVOS_SIGTAP_NECESSARIOS: readonly string[];
/** Lê somente oito entradas oficiais do ZIP32 em memória, verificando hash esperado e CRC32. */
export function lerArquivosSigtapZip(input: Uint8Array, sha256Esperado: string): Record<string,string>;
