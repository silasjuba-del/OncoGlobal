import { describe, expect, it } from "vitest";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { criarBiblioteca, sha256Biblioteca } from "../../src/kernel/corpus/biblioteca.js";
import { lerConhecimentoBrain } from "../../src/server/conhecimentoBrain.js";
import { produzirPropostaBrainOs, type ReferenciaCandidataBrainOs } from "../../src/kernel/llm/brainOs.js";

const agora = "2026-10-21T12:00:00Z";
const propor = (refs: ReferenciaCandidataBrainOs[], texto = "ALVO presente.") => produzirPropostaBrainOs({
  propostaId: "proposta-sintetica", agora, fontes: [{ sourceId: "s", versao: "1", conteudo: texto }], referenciasCandidatas: refs,
});

describe("Biblioteca curada alimenta Brain sem nova autoridade", () => {
  it("filtro ausente não presume tumor e dependência revogada tem motivo próprio", () => {
    const db = abrirLedger(":memory:");
    try {
      const lib = criarBiblioteca(db, { autorizarCuradoria: () => ({ atorId: "medico-sintetico" }), emitir: () => {}, agora: () => agora });
      const item = (id: string, dependencias: { id: string; versao: string }[] = []) => ({
        schema: "ItemBiblioteca@1", id, versao: "1.0.0", pilar: 1, tipo: "REFERENCIA", titulo: id === "alvo" ? "ALVO" : "BASE",
        texto: "Referência de teste", aplicabilidade: { tumor: id === "alvo" ? ["mama"] : [], histologia: [], estadio: [], biomarcador: [], linha: [] },
        proveniencia: { fonte: "https://example.org/fixture", trecho: "Fonte sintética", publicadoEm: "2026-01-01", recuperadoEm: agora, licenca: "Teste" }, dependencias,
      });
      const arquivos = new Map([["base.json", JSON.stringify(item("base"))], ["alvo.json", JSON.stringify(item("alvo", [{ id: "base", versao: "1.0.0" }]))]]);
      const id = lib.importarPacote({ schema: "PacoteBiblioteca@1", id: "teste", versao: "1.0.0", origem: "GENSPARK_MANUAL", classificacao: "PUBLIC", criadoEm: agora,
        itens: [...arquivos].map(([arquivo, texto]) => ({ id: arquivo.replace(".json", ""), versao: "1.0.0", arquivo, sha256: sha256Biblioteca(texto) })) }, arquivo => arquivos.get(arquivo)!);
      lib.revisarItem(id, "base", "CONSULTAVEL"); lib.revisarItem(id, "alvo", "CONSULTAVEL"); lib.ativar(id);
      const ausente = propor(lerConhecimentoBrain(db).referenciasCandidatas);
      expect(ausente.inclusoesMesa).toHaveLength(0);
      expect(ausente.referenciasExcluidas.find(r => r.referenciaId === "alvo")?.motivoCodigo).toBe("FORA_DO_ESCOPO_CLINICO");
      const entrada = lerConhecimentoBrain(db, { tumor: "mama" });
      expect(entrada.conhecimento.filtrosSaoFatosClinicos).toBe(false);
      expect(propor(entrada.referenciasCandidatas).inclusoesMesa.map(r => r.referenciaId)).toEqual(["alvo"]);
      lib.revisarItem(id, "base", "OBSOLETO");
      const revogada = lerConhecimentoBrain(db, { tumor: "mama" });
      expect(revogada.conhecimento.biblioteca?.hash).not.toBe(entrada.conhecimento.biblioteca?.hash);
      expect(propor(revogada.referenciasCandidatas).referenciasExcluidas.find(r => r.referenciaId === "alvo")?.motivoCodigo).toBe("DEPENDENCIA_NAO_APROVADA");
      expect(lib.estado(id, "base")).toBe("OBSOLETO");
    } finally { db.close(); }
  });

  it.each([["presente", false], ["RE positivo", true]])("sigla exige token literal: %s", (texto, inclui) => {
    const proposta = propor([{ referenciaId: "re", versao: "1", status: "CONSULTAVEL", escopoCompativel: true,
      provenienciaCompleta: true, termosChave: ["RE"], motivoInclusaoSeAplicavel: "Referência sintética" }], texto);
    expect(proposta.inclusoesMesa).toHaveLength(inclui ? 1 : 0);
  });
});
