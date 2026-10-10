export type BackupStoreFile = "ledger.sqlite" | "config-w10.sqlite" | "workspace.sqlite";

export interface ResultadoRestoreLegado {
  database: string;
  arquivos: number;
  databases?: never;
}

export interface ResultadoRestoreStores {
  database: string;
  arquivos: number;
  databases: Record<BackupStoreFile, string>;
}

export declare function restaurarBackup(options: {
  arquivo: string;
  destino: string;
  senha: string;
}): ResultadoRestoreLegado | ResultadoRestoreStores;
