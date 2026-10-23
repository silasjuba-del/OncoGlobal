import type { DatabaseSync } from "node:sqlite";

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
  aoCapturarStore?: (storeKey: string) => void | Promise<void>;
}

export type CriarBackupOptions = BackupOptionsBase & (
  | { stores: BackupStorePaths; dbPath?: never }
  | { dbPath: string; stores?: never }
);

export declare function refsLedger(
  db: DatabaseSync,
  files: readonly string[],
  filesRoot?: string,
): string[];

export declare function criarBackup(options: CriarBackupOptions): Promise<string>;
