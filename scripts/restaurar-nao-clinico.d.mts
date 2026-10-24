export function restaurarNaoClinico(opcoes: {
  raiz?: string;
  destino: string;
  caminhos?: string[];
}): { destino: string; arquivos: number; bytes: number };
