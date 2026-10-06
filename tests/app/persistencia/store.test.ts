import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ConflitoPersistencia, criarWorkspaceStore } from "../../../src/app/persistencia/store.js";

const roots: string[] = [];
function tempRoot() {
  const root = mkdtempSync(join(tmpdir(), "oncoglobal-workspace-"));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("workspace store", () => {
  it("persiste versões e eventos entre reinicializações", () => {
    const rootDir = tempRoot();
    const store = criarWorkspaceStore({ rootDir });
    store.gravar({ collection: "rascunhos", key: "draft-1", value: { texto: "um" }, expectedRevision: null });
    store.gravar({ collection: "rascunhos", key: "draft-1", value: { texto: "dois" }, expectedRevision: 1 });
    store.append({ collection: "eventos", key: "patient-opaque", event: { tipo: "salvo" } });
    store.fechar();

    const reopened = criarWorkspaceStore({ rootDir });
    expect(reopened.ler("rascunhos", "draft-1")).toMatchObject({ revision: 2, value: { texto: "dois" } });
    expect(reopened.lerHistorico("eventos", "patient-opaque")).toEqual([{ tipo: "salvo" }]);
    reopened.fechar();
  });

  it("duas abas na mesma revisão não sobrescrevem e guardam o candidato em conflito", () => {
    const store = criarWorkspaceStore({ rootDir: tempRoot() });
    store.gravar({ collection: "rascunhos", key: "draft-1", value: "base", expectedRevision: null });
    const tabA = store.ler("rascunhos", "draft-1");
    const tabB = store.ler("rascunhos", "draft-1");
    store.gravar({ collection: "rascunhos", key: "draft-1", value: "aba A", expectedRevision: tabA?.revision ?? null });
    try {
      store.gravar({ collection: "rascunhos", key: "draft-1", value: "aba B", expectedRevision: tabB?.revision ?? null });
      throw new Error("esperava conflito de revisão");
    } catch (error) {
      expect(error).toBeInstanceOf(ConflitoPersistencia);
      expect((error as ConflitoPersistencia<string>).conflito.candidato).toBe("aba B");
      expect((error as ConflitoPersistencia<string>).conflito.atual?.value).toBe("aba A");
    }
    expect(store.ler("rascunhos", "draft-1")?.value).toBe("aba A");
    store.fechar();
  });

  it("isola collections e rejeita chaves que poderiam escapar do workspace", () => {
    const store = criarWorkspaceStore({ rootDir: tempRoot() });
    store.gravar({ collection: "estudo", key: "selecionado", value: "study", expectedRevision: null });
    store.gravar({ collection: "paciente", key: "selecionado", value: "patient", expectedRevision: null });
    expect(store.ler("estudo", "selecionado")?.value).toBe("study");
    expect(store.ler("paciente", "selecionado")?.value).toBe("patient");
    expect(() => store.ler("rascunhos", "../outside")).toThrow("key inválido");
    store.fechar();
  });
});
