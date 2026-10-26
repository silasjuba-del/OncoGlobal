import { mkdtemp, mkdir, symlink, readFile, writeFile, rm, realpath } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { expect, it } from "vitest";
// @ts-expect-error módulo de instalação executável JavaScript
import { aplicarPonte } from "../../../integrations/pdfforge/aplicar-ponte.mjs";
it("aplicador recusa junction antes de ler/escrever código fora da cópia", async () => {
  const base = await realpath(tmpdir());
  const dir = await mkdtemp(join(base, "SINTETICO-ponte-"));
  if (dirname(dir) !== base) throw Error("TEMP_FORA_RAIZ");
  const copia = join(dir, "copia"), original = join(dir, "original");
  await mkdir(copia); await mkdir(original); await writeFile(join(original,"main.cjs"),"ORIGINAL SINTETICO");
  await symlink(original, join(copia,"electron"), process.platform === "win32" ? "junction" : "dir");
  try {
    await expect(aplicarPonte(copia)).rejects.toThrow("DESTINO_COM_LINK_RECUSADO");
    expect(await readFile(join(original,"main.cjs"),"utf8")).toBe("ORIGINAL SINTETICO");
  } finally { await rm(dir, { recursive:true, force:true }); }
});
