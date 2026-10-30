import { describe, expect, it } from "vitest";
import { prepararDocumentosConsulta } from "../../../src/modules/documentos/consulta.js";
import { entradaCanonica, material } from "./fixture.js";

describe("F1-S9 · decisão confirmada → documentos em revisão", () => {
  it("gera receita, dois pedidos, retorno e uma referência de tarefa sem inventar campos", () => {
    const entrada = entradaCanonica();
    const resultado = prepararDocumentosConsulta(entrada);
    expect(resultado.documentos.map(d => d.tipoDocumento)).toEqual(["RECEITA", "PEDIDO_EXAME", "PEDIDO_EXAME", "RETORNO"]);
    expect(resultado.documentos[0]!.texto).toContain("Pantoprazol");
    expect(resultado.documentos[0]!.texto).toContain("40 mg");
    expect(resultado.documentos[0]!.texto).toContain("pela manhã");
    expect(resultado.documentos[0]!.texto).toContain("30 dias");
    expect(resultado.documentos[0]!.texto).not.toMatch(/oral|30 comprimidos|diagnóstico/i);
    expect(resultado.documentos[3]!.texto).toContain("2026-10-26");
    expect(resultado.tarefas).toEqual([expect.objectContaining({ tarefaId: "tarefa-retorno-s9", dataAlvo: "2026-10-26",
      documentoRef: { documentId: resultado.documentos[3]!.documentId, documentVersion: 1 } })]);
    expect(resultado.tarefas[0]!.pedidosRef).toEqual(resultado.documentos.slice(1, 3)
      .map(d => ({ documentId: d.documentId, documentVersion: 1 })));
    expect(resultado.documentos.every(d => d.estado === "RASCUNHO" && d.contexto.encounterId === entrada.contexto.encounterId)).toBe(true);
    expect(resultado.pendencias).toEqual(expect.arrayContaining([expect.objectContaining({ tipoDocumento: "RESUMO_14", codigo: "SEM_MATERIAL_BASE" })]));
  });

  it("é determinístico e novas gerações não alteram a cópia anterior", () => {
    const entrada = entradaCanonica();
    const primeiro = prepararDocumentosConsulta(entrada);
    const anterior = JSON.stringify(primeiro);
    expect(prepararDocumentosConsulta(entrada)).toEqual(primeiro);
    entrada.decisao!.medicamentos[0]!.dose = "20 mg";
    const novo = prepararDocumentosConsulta(entrada);
    expect(novo.documentos[0]!.documentId).not.toBe(primeiro.documentos[0]!.documentId);
    expect(JSON.stringify(primeiro)).toBe(anterior);
    expect(primeiro.documentos[0]!.fontes[0]).not.toBe(entrada.decisao!.fontes[0]);
  });

  it.each(["patientId", "encounterId", "tumorLotId"] as const)("recusa decisão de outro %s", campo => {
    const entrada = entradaCanonica();
    entrada.decisao!.contexto[campo] = "outro";
    expect(() => prepararDocumentosConsulta(entrada)).toThrow("CONTEXTO_DIVERGENTE");
  });

  it.each(["patientId", "encounterId", "tumorLotId"] as const)("recusa material de outro %s", campo => {
    const entrada = entradaCanonica();
    const base = material(); base.contexto[campo] = "outro"; entrada.materiais.push(base);
    expect(() => prepararDocumentosConsulta(entrada)).toThrow("CONTEXTO_DIVERGENTE");
  });

  it.each(["RAW", "REVISAR", "INFERIDO"])("não promove decisão %s", revisao => {
    const entrada = entradaCanonica();
    Object.assign(entrada.decisao!, { revisao });
    expect(() => prepararDocumentosConsulta(entrada)).toThrow();
  });

  it.each(["ALERTA", "CORRECAO_IA", "CANDIDATO"])("recusa %s na decisão e nos materiais", origem => {
    const entrada = entradaCanonica();
    Object.assign(entrada.decisao!, { origem });
    expect(() => prepararDocumentosConsulta(entrada)).toThrow();
    const outra = entradaCanonica(), base = material();
    Object.assign(base.fatos[0]!, { origem }); outra.materiais.push(base);
    expect(() => prepararDocumentosConsulta(outra)).toThrow();
  });

  it("sem decisão/base mantém pendência sem fabricar receita, tarefa ou resumo", () => {
    const entrada = entradaCanonica(); entrada.decisao = null;
    const resultado = prepararDocumentosConsulta(entrada);
    expect(resultado.documentos).toEqual([]); expect(resultado.tarefas).toEqual([]);
    expect(resultado.pendencias.length).toBeGreaterThan(0);
  });

  it("reutiliza o renderer para complementares e mantém conflitos pendentes", () => {
    const entrada = entradaCanonica();
    entrada.materiais = [material(), material("LAUDO"), material("ORIENTACOES"), material("ENCAMINHAMENTO")];
    expect(prepararDocumentosConsulta(entrada).documentos).toHaveLength(8);
    entrada.materiais[0]!.fatos.push({ ...entrada.materiais[0]!.fatos[0]!, valor: "valor conflitante" });
    const resultado = prepararDocumentosConsulta(entrada);
    expect(resultado.documentos.find(d => d.tipoDocumento === "EVOLUCAO")).toBeUndefined();
    expect(resultado.pendencias).toContainEqual(expect.objectContaining({ tipoDocumento: "EVOLUCAO", codigo: "BASE_INCOMPLETA_OU_CONFLITANTE" }));
  });

  it("resumo-14 exige os 14 campos nomeados na base, sem inventar títulos", () => {
    const entrada = entradaCanonica(), base = material("RESUMO_14");
    entrada.materiais.push(base);
    expect(prepararDocumentosConsulta(entrada).documentos.some(d => d.tipoDocumento === "RESUMO_14")).toBe(false);
    base.template.campos = Array.from({ length: 14 }, (_, i) => ({ id: `campo-${i}`, rotulo: `Seção sintética ${i}`, obrigatorio: false }));
    base.fatos = [{ ...base.fatos[0]!, campo: "campo-0" }];
    const resultado = prepararDocumentosConsulta(entrada);
    expect(resultado.documentos.find(d => d.tipoDocumento === "RESUMO_14")!.texto).toContain("Seção sintética 13: PENDENTE");
    base.template.campos[0]!.rotulo = "[VERIFICAR]";
    expect(prepararDocumentosConsulta(entrada).documentos.some(d => d.tipoDocumento === "RESUMO_14")).toBe(false);
  });

  it.each([["2028-02-28", 2, "2028-03-01"], ["2026-12-31", 14, "2027-01-14"]] as const)("calendário civil %s + %s", (data, dias, alvo) => {
    const entrada = entradaCanonica(); entrada.dataReferencia = data; entrada.decisao!.retorno!.dias = dias;
    expect(prepararDocumentosConsulta(entrada).tarefas[0]!.dataAlvo).toBe(alvo);
  });

  it("prazo ausente não vira zero nem agendamento; data/fuso inválidos são recusados", () => {
    const entrada = entradaCanonica(); entrada.decisao!.retorno!.dias = null;
    const resultado = prepararDocumentosConsulta(entrada);
    expect(resultado.tarefas).toEqual([]);
    expect(resultado.pendencias).toContainEqual({ tipoDocumento: "RETORNO", codigo: "REVISAR", campos: ["data"] });
    expect(resultado.documentos[3]!.texto).toContain("PENDENTE");
    expect(() => prepararDocumentosConsulta({ ...entrada, dataReferencia: "2026-02-30" })).toThrow();
    expect(() => prepararDocumentosConsulta({ ...entrada, fuso: "UTC" } as never)).toThrow();
  });

  it("IDs repetidos, fonte ausente e campos extras não atravessam a entrada", () => {
    const entrada = entradaCanonica(); entrada.decisao!.pedidos.push({ ...entrada.decisao!.pedidos[0]! });
    expect(() => prepararDocumentosConsulta(entrada)).toThrow();
    const semFonte = entradaCanonica(); semFonte.decisao!.fontes = [];
    expect(() => prepararDocumentosConsulta(semFonte)).toThrow();
    expect(() => prepararDocumentosConsulta({ ...entradaCanonica(), alertas: ["não imprimir"] } as never)).toThrow();
  });

  it("retorno sem pedidos não propõe tarefa de coleta", () => {
    const entrada = entradaCanonica(); entrada.decisao!.pedidos = [];
    const tarefas = prepararDocumentosConsulta(entrada).tarefas;
    // M123 acompanha o retorno explicitamente decidido; não inventa pedido/coleta.
    expect(tarefas).toHaveLength(1);
    expect(tarefas[0]!.pedidosRef).toEqual([]);
  });
});

it("retorno explicitamente decidido gera referência de tarefa mesmo sem exames", () => {
  const entrada = entradaCanonica();
  entrada.decisao!.pedidos = [];
  entrada.decisao!.medicamentos = [];
  const r = prepararDocumentosConsulta(entrada);
  expect(r.documentos.map(d=>d.tipoDocumento)).toEqual(["RETORNO"]);
  expect(r.tarefas).toEqual([expect.objectContaining({ tarefaId:"tarefa-retorno-s9",dataAlvo:"2026-10-26",pedidosRef:[],
    documentoRef:{documentId:r.documentos[0]!.documentId,documentVersion:1} })]);
  entrada.decisao!.retorno!.dias=null;
  expect(prepararDocumentosConsulta(entrada).tarefas).toEqual([]);
});
