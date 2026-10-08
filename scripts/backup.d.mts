export interface BackupStorePaths {
  ledger: string;
  settings: string;
  workspace: string;
}

interface BackupOptionsBase {
  filesRoot: string;
  files?: readonly string[];
  destino: string;
  senha: string;
  nome: string;
}

export type CriarBackupOptions = BackupOptionsBase & (
  | { stores: BackupStorePaths; dbPath?: never }
  | { dbPath: string; stores?: never }
);

export declare function criarBackup(options: CriarBackupOptions): Promise<string>;
