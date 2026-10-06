import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve, sep } from "node:path";

export interface OpcoesImpressoras {
  dataDir: string;
  /** Lista local fornecida pelo caller; não há descoberta de rede ou subprocesso interno. */
  listarInstaladas?: () => Promise<readonly string[]>;
}

export interface PreferenciasImpressora {
  listar(): Promise<string[]>;
  lerPreferida(): Promise<string | null>;
  salvarPreferida(nome: string | null): Promise<void>;
}

/** Preferência simples local. Get-Printer/consultas de rede ficam fora deste módulo. */
export function criarPreferenciasImpressora(options: OpcoesImpressoras): PreferenciasImpressora {
  const root = resolve(options.dataDir);
  const path = resolve(root, "preferencias.json");
  if (!path.startsWith(`${root}${sep}`)) throw new Error("CAMINHO_FORA_DO_DATA_DIR");

  async function lerArquivo(): Promise<{ impressoraPreferida?: string | null }> {
    try {
      const raw: unknown = JSON.parse(await readFile(path, "utf8"));
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
      const value = (raw as Record<string, unknown>).impressoraPreferida;
      return typeof value === "string" || value === null ? { impressoraPreferida: value } : {};
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw new Error("PREFERENCIAS_INVALIDAS");
    }
  }

  return {
    async listar() {
      return options.listarInstaladas ? [...await options.listarInstaladas()] : [];
    },
    async lerPreferida() {
      return (await lerArquivo()).impressoraPreferida ?? null;
    },
    async salvarPreferida(nome) {
      if (nome !== null && (!nome.trim() || nome.length > 300 || /[\0\r\n]/.test(nome))) {
        throw new TypeError("NOME_IMPRESSORA_INVALIDO");
      }
      await mkdir(root, { recursive: true });
      const tmp = resolve(root, `.preferencias-${randomUUID()}.tmp`);
      if (!tmp.startsWith(`${root}${sep}`)) throw new Error("CAMINHO_FORA_DO_DATA_DIR");
      try {
        await writeFile(tmp, JSON.stringify({ impressoraPreferida: nome }, null, 2), { encoding: "utf8", mode: 0o600, flag: "wx" });
        await rename(tmp, path);
      } finally {
        await rm(tmp, { force: true }).catch(() => undefined);
      }
    },
  };
}
