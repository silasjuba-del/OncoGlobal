export type PhiType = "cpf" | "cns" | "telefone" | "email" | "credencial_portal" | "nome_cabecalho_laudo";
export type DispositionStatus =
  | "technical_token_false_positive"
  | "synthetic_declared"
  | "public_author_metadata"
  | "public_contact_metadata"
  | "technical_font_asset"
  | "synthetic_visual_review"
  | "PENDENTE";
export type HashMode = "raw" | "utf8-lf";

export interface PhiCandidate {
  type: PhiType;
  path: string;
  line: number;
  ordinal: number;
  contextTag: string | null;
  page?: number;
}

export interface PhiDispositionItem {
  type: PhiType;
  line: number;
  ordinal: number;
  page?: number;
  status: DispositionStatus;
  evidenceRef?: string;
  reason?: string;
  contextTag?: string | null;
}

export interface PhiFileDisposition {
  path: string;
  sha256: string;
  hashMode?: HashMode;
  category?: "synthetic_visual_review" | "technical_font_asset";
  magic?: string;
  evidenceRef?: string;
  reason?: string;
  items?: PhiDispositionItem[];
}

export interface PhiManifest {
  schemaVersion: 1;
  files: PhiFileDisposition[];
  protectedPaths?: Array<{ path: string; doNotRead: true; type?: string; evidenceRef?: string }>;
}

export interface PhiFinding {
  type: PhiType;
  path: string;
  line: number;
  ordinal?: number;
  contextTag?: string | null;
  page?: number;
}

export interface PhiScanResult {
  findings: PhiFinding[];
  unscanned: Array<{ type: string; path: string; status: "UNVERIFIED" | "PENDENTE" }>;
  dispositionsApplied: Array<{ type: string; path: string; line?: number; ordinal?: number; contextTag?: string | null; page?: number; status: string }>;
  pending: Array<{ type: string; path: string; line?: number; status: string; reason?: string; evidenceRef?: string | null }>;
}

export function sha256(bytes: Uint8Array | string, hashMode?: HashMode, path?: string): string;
export function findTextCandidates(text: string, path?: string): PhiCandidate[];
export function scanText(text: string, path: string, options?: { sha256?: string; manifest?: PhiManifest }): PhiScanResult;
export function extractXlsxRows(bytes: Uint8Array): Array<{ line: number; text: string }>;
export function scanRepository(root: string, manifest?: PhiManifest): Promise<PhiScanResult>;
