import { createHash } from "node:crypto";
import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { extratorDeterministico } from "../../src/kernel/extracao/extrator.js";
import { normalizarFatos, normalizarLab, normalizarSitioAnatomico } from "../../src/kernel/extracao/normalizacao.js";
import { segmentarTranscricao } from "../../src/kernel/extracao/segmenter.js";
import { converterEntradaLocal } from "../../src/leitura/caixa-unica.js";
import { executarPipelineExtracao } from "../../src/orchestration/pipeline-extracao.js";
import { reconciliarCampo } from "../../src/kernel/extracao/reconciliacao.js";

const recebidoEm = "2026-10-07T09:00:00-03:00";
function extrair(texto: string, sourceType: "medical_note" | "pathology" | "plaud" | "imaging_report" = "medical_note") {
  const segmento = segmentarTranscricao({
    recordingId: "w10-sintetico", sourceId: "fonte-w10", sourceType,
    turns: [{ text: texto, startMs: null, endMs: null }],
  })[0]!;
  return extratorDeterministico.extrair(segmento);
}
function docx(xml: Buffer): Buffer {
  const name = Buffer.from("word/document.xml");
  const compressed = deflateRawSync(xml);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(xml.length, 22);
  local.writeUInt16LE(name.length, 26);
  const directory = Buffer.alloc(46);
  directory.writeUInt32LE(0x02014b50);
  directory.writeUInt16LE(8, 10);
  directory.writeUInt32LE(compressed.length, 20);
  directory.writeUInt32LE(xml.length, 24);
  directory.writeUInt16LE(name.length, 28);
  const start = Buffer.concat([local, name, compressed]);
  const central = Buffer.concat([directory, name]);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(start.length, 16);
  return Buffer.concat([start, central, end]);
}

describe("W10 · regressões de extração clínica sem promoção automática", () => {
  it("reconhece colo uterino sem confundi-lo com cólon e mantém o literal", () => {
    const fatos = extrair("Adenocarcinoma de colo uterino.");
    const diagnostico = fatos.find((f) => f.domain === "diagnosis")!;
    expect(diagnostico.value).toMatchObject({ sitioCanonico: "utero", raw: "Adenocarcinoma de colo uterino" });
    expect(normalizarSitioAnatomico("colo uterino")).toBe("utero");
    expect(normalizarSitioAnatomico("colo do utero")).toBe("utero");
    expect(normalizarSitioAnatomico("colo")).toBeNull();
    expect(normalizarSitioAnatomico("cólon")).toBe("colon");
    expect(normalizarSitioAnatomico("colon")).toBe("colon");
  });

  it("extrai todos os laboratórios na mesma linha, com fonte, data e evidência original", () => {
    const texto = "20/04/2026 creatinina 1,4 mg/dL; Hb 11,2 g/dL";
    const fatos = extrair(texto);
    const labs = fatos.filter((f) => f.domain === "lab");
    expect(labs).toHaveLength(2);
    expect(labs.map((f) => f.value)).toEqual([
      { marker: "creatinina", value: "1,4", unit: "mg/dL" },
      { marker: "Hb", value: "11,2", unit: "g/dL" },
    ]);
    expect(labs.every((f) => f.rawEvidence === texto && f.sourceId === "fonte-w10" && f.date === "20/04/2026"))
      .toBe(true);
  });

  it("captura plaquetas com separador de milhar e unidade /mm3 sem reduzir o valor", () => {
    const fato = extrair("Plaquetas 20.000 /mm3.").find((f) => f.domain === "lab")!;
    expect(fato.value).toEqual({ marker: "Plaquetas", value: "20.000", unit: "/mm3" });
    const normalizado = normalizarLab(fato.value as { marker: string; value: string; unit: string; });
    expect(normalizado).toMatchObject({ marker: "Plaquetas", value: 20000, unit: "mm³", raw: "20.000 /mm3", normalizado: true });
  });

  it("aplica negação à cláusula e preserva laboratório afirmativo depois do ponto e vírgula", () => {
    const texto = "Nega dor; creatinina 1,4 mg/dL";
    const fatos = extrair(texto);
    expect(fatos.some((f) => f.domain === "symptom")).toBe(false);
    expect(fatos.filter((f) => f.domain === "lab")).toHaveLength(1);
    expect(fatos.find((f) => f.domain === "lab")).toMatchObject({ rawEvidence: texto, sourceId: "fonte-w10" });
  });

  it("não extrai laboratório negado nem inventa unidade ou valor ausente", () => {
    expect(extrair("Nega creatinina 1,4 mg/dL").filter((f) => f.domain === "lab")).toHaveLength(0);
    expect(extrair("Plaquetas 20.000.").filter((f) => f.domain === "lab")).toHaveLength(0);
  });

  it("aplica negação por cláusula a imagem, diagnóstico, sintoma e biomarcador", () => {
    const texto = "Sem lesões hepáticas; nódulo em pulmão 38 mm; sem neoplasia de mama; adenocarcinoma de colo uterino; nega dor; náusea; sem HER2 3+; HER2 2+";
    const fatos = extrair(texto, "imaging_report");
    const imagem = fatos.find((f) => f.domain === "imaging")!;
    expect(imagem.value).toMatchObject({ siteRaw: "pulmão", measureRaw: "38", unit: "mm" });
    expect(fatos.filter((f) => f.domain === "diagnosis").map((f) => f.value))
      .toContainEqual(expect.objectContaining({ sitioCanonico: "utero" }));
    expect(fatos.filter((f) => f.domain === "diagnosis")).toHaveLength(1);
    expect(fatos.filter((f) => f.domain === "symptom").map((f) => f.value)).toEqual(["náusea"]);
    expect(fatos.filter((f) => f.domain === "biomarker").map((f) => (f.value as { value: string }).value))
      .toEqual(["2+"]);
    expect(fatos.some((f) => f.domain === "metastasis" || f.domain === "stage")).toBe(false);

    expect(extrair("Sem nódulo em pulmão medindo 38 mm", "imaging_report")
      .some((f) => f.domain === "imaging")).toBe(false);
  });

  it("número de Plaud continua incerto e exige confirmação médica", () => {
    const fato = extrair("Creatinina 1,4 mg/dL", "plaud").find((f) => f.domain === "lab")!;
    expect(fato).toMatchObject({ sourceType: "plaud", confidence: 0.6, requiresConfirmation: true });
    expect(fato.rawEvidence).toBe("Creatinina 1,4 mg/dL");
  });

  it("termos de incerteza viram candidatos UNCERTAIN com confirmação", () => {
    const frases = [
      "Não se pode excluir neoplasia de mama.",
      "Achado sugestivo de carcinoma de mama.",
      "Compatível com neoplasia de mama.",
      "Provável adenocarcinoma de pulmão.",
    ];
    for (const texto of frases) {
      const fato = extrair(texto).find((f) => f.domain === "diagnosis")!;
      expect(fato).toMatchObject({ evidence: "UNCERTAIN", requiresConfirmation: true, confidence: 0.5, rawEvidence: texto });
    }
    const imagem = extrair("Não se pode excluir recidiva: nódulo em L4 medindo 8 mm.")
      .find((f) => f.domain === "imaging")!;
    expect(imagem).toMatchObject({ evidence: "UNCERTAIN", requiresConfirmation: true });
  });

  it("preserva unidade µmol/L como não canônica e deixa o laboratório pendente", () => {
    const fatos = extrair("Creatinina 88 µmol/L; Hb 98 g/L").filter((f) => f.domain === "lab");
    expect(fatos).toHaveLength(2);
    expect(fatos[0]!.value).toMatchObject({ value: "88", unit: "µmol/L" });
    expect(fatos[1]!.value).toMatchObject({ value: "98", unit: "g/L" });
    const normalizados = normalizarFatos(fatos);
    expect(normalizados.every((f) => (f.value as { normalizado: boolean }).normalizado === false)).toBe(true);
    expect(normalizados[0]!.value).toMatchObject({ value: null, unit: null, raw: "88 µmol/L", normalizado: false });
    expect(normalizados[1]!.value).toMatchObject({ value: null, unit: null, raw: "98 g/L", normalizado: false });
  });

  it("não interpreta 1.400 como decimal ou milhar sem confirmação", () => {
    const fato = extrair("Creatinina 1.400 mg/dL").find((f) => f.domain === "lab")!;
    expect(fato).toMatchObject({ evidence: "UNCERTAIN", requiresConfirmation: true, value: { value: null, raw: "1.400 mg/dL" } });
    expect(normalizarFatos([fato])[0]!.value).toMatchObject({ value: null, normalizado: false, raw: "1.400 mg/dL" });
  });

  it("cN2 e fármacos falados com dose/frequência ficam incertos, sem decidir conduta", () => {
    const fatos = extrair([
      "cN2 falado isoladamente.",
      "Prednisona 5 mg/dia.",
      "Prednisona 20mg por hora.",
      "Paclitaxel 80 mg/m² semanal.",
    ].join("\n"), "plaud");
    const estagio = fatos.find((f) => f.domain === "stage")!;
    expect(estagio).toMatchObject({ value: "cN2", evidence: "UNCERTAIN", requiresConfirmation: true });
    const farmacos = fatos.filter((f) => f.domain === "drug");
    expect(farmacos).toHaveLength(3);
    expect(farmacos.every((f) => f.evidence === "UNCERTAIN" && f.requiresConfirmation)).toBe(true);
    expect(farmacos.map((f) => (f.value as { normalizado: string }).normalizado))
      .toEqual(["PREDNISONA", "PREDNISONA", "PACLITAXEL"]);
    expect(farmacos.map((f) => (f.value as { doseRaw: string }).doseRaw))
      .toEqual(["5 mg/dia", "20mg por hora", "80 mg/m² semanal"]);
    expect(fatos.some((f) => f.domain === "regimen" || f.domain === "cycle")).toBe(false);
  });

  it("conversão local mantém texto riscado e hash, marca PENDENTE e não o extrai como fato", () => {
    const conteudo = "[RISCADO]Adenocarcinoma de colo uterino[/RISCADO]";
    const result = converterEntradaLocal({ id: "riscado-w10", tipo: "TEXT", conteudo, recebidoEm });
    expect(result.status).toBe("PENDENTE");
    expect(result.documento.paginas[0]?.texto).toBe(conteudo);
    expect(result.documento.hash).toBe(createHash("sha256").update(conteudo, "utf8").digest("hex"));
    expect(extrair(result.documento.paginas[0]!.texto).filter((f) => f.domain === "diagnosis")).toHaveLength(0);
  });

  it("ignora o interior de rasura multilinha e mantém candidatos antes/depois", () => {
    const texto = [
      "Adenocarcinoma de pulmão.",
      "[RISCADO]",
      "Diagnóstico: carcinoma de mama",
      "Hb 8 g/dL",
      "[/RISCADO] Náusea.",
    ].join("\n");
    const result = converterEntradaLocal({ id: "riscado-multilinha", tipo: "TEXT", conteudo: texto, recebidoEm });
    expect(result.status).toBe("PENDENTE");
    expect(result.documento.paginas[0]?.texto).toBe(texto);
    const fatos = extrair(result.documento.paginas[0]!.texto, "pathology");
    expect(fatos.filter((f) => f.domain === "diagnosis")).toHaveLength(1);
    expect(fatos.find((f) => f.domain === "diagnosis")!.value)
      .toMatchObject({ sitioCanonico: "pulmao" });
    expect(fatos.some((f) => f.domain === "lab")).toBe(false);
    expect(fatos.filter((f) => f.domain === "symptom").map((f) => f.value)).toEqual(["Náusea."]);
  });

  it("extrai texto visível antes e depois de rasura na mesma linha", () => {
    const texto = "Adenocarcinoma de pulmão. [RISCADO]Diagnóstico: carcinoma de mama[/RISCADO] Náusea.";
    const fatos = extrair(texto);
    expect(fatos.filter((f) => f.domain === "diagnosis")).toHaveLength(1);
    expect(fatos.find((f) => f.domain === "diagnosis")!.value).toMatchObject({ sitioCanonico: "pulmao" });
    expect(fatos.filter((f) => f.domain === "symptom").map((f) => f.value)).toEqual(["Náusea."]);
    expect(fatos.every((f) => f.rawEvidence === texto)).toBe(true);
  });

  it("marca PENDENTE e não extrai o restante após tag RISCADO sem fechamento", () => {
    const texto = "[RISCADO]\nDiagnóstico: carcinoma de mama\nHb 8 g/dL";
    const result = converterEntradaLocal({ id: "riscado-aberto", tipo: "TEXT", conteudo: texto, recebidoEm });
    expect(result.status).toBe("PENDENTE");
    expect(result.documento.paginas[0]?.texto).toBe(texto);
    expect(extrair(texto).filter((f) => f.domain === "diagnosis" || f.domain === "lab")).toHaveLength(0);
  });

  it("DOCX Latin-1 fica PENDENTE sem texto mojibake", () => {
    const xml = Buffer.concat([
      Buffer.from('<w:document><w:body><w:p><w:r><w:t>carcinoma de cabe'),
      Buffer.from([0xe7]),
      Buffer.from('a</w:t></w:r></w:p></w:body></w:document>'),
    ]);
    // Byte Latin-1 acentuado em um XML que, pela especificação do leitor, deve ser UTF-8.
    const result = converterEntradaLocal({ id: "docx-latin1", tipo: "DOCX", conteudo: docx(xml), recebidoEm });
    expect(result.status).toBe("PENDENTE");
    expect(result.documento.paginas).toEqual([]);
  });

  it("normalização mantém PENDENTE para laboratório falado sem unidade reconhecida", () => {
    const fato = extrair("Creatinina quatorze.", "plaud").find((f) => f.domain === "lab")!;
    const normalizado = normalizarFatos([fato])[0]!;
    expect(normalizado).toMatchObject({ confidence: 0.6, requiresConfirmation: true, value: { value: null, normalizado: false } });
  });

  it("normaliza datas extraídas antes da reconciliação longitudinal real", () => {
    const result = executarPipelineExtracao({
      recordingId: "datas-exames", sourceId: "laudo-sintetico", sourceType: "medical_note",
      rawTranscript: "01/10/2026 Creatinina 1,1 mg/dL\n02/10/2026 Creatinina 1,4 mg/dL",
    });
    const labs = result.facts.filter((f) => f.domain === "lab");
    expect(labs.map((f) => f.date)).toEqual(["2026-10-01", "2026-10-02"]);
    expect(labs.map((f) => f.rawEvidence)).toEqual([
      "01/10/2026 Creatinina 1,1 mg/dL",
      "02/10/2026 Creatinina 1,4 mg/dL",
    ]);
    expect(result.fields["lab:CREATININA:data:2026-10-01"]?.candidates).toHaveLength(1);
    expect(result.fields["lab:CREATININA:data:2026-10-02"]?.candidates).toHaveLength(1);
  });

  it("não usa a data de referência comparativa como data do exame atual", () => {
    const texto = "Lesão pulmonar 38 mm, aumentou 36% desde TC de 01/09/2026";
    const apenasReferencia = extrair(texto, "imaging_report").find((f) => f.domain === "imaging")!;
    expect(apenasReferencia.date).toBeUndefined();
    expect(apenasReferencia.rawEvidence).toBe(texto);
    expect(apenasReferencia.value).toMatchObject({ comparacao: { refData: "01/09/2026" } });
    expect(normalizarFatos([apenasReferencia])[0]?.date).toBeUndefined();
    expect(normalizarFatos([apenasReferencia])[0]?.requiresConfirmation).toBe(true);

    const comDataAtual = extrair(
      "Exame atual 02/10/2026: lesão pulmonar 38 mm, aumentou 36% desde TC de 01/09/2026",
      "imaging_report",
    ).find((f) => f.domain === "imaging")!;
    expect(comDataAtual.date).toBe("02/10/2026");
    expect(comDataAtual.value).toMatchObject({ comparacao: { refData: "01/09/2026" } });
    expect(normalizarFatos([comDataAtual])[0]).toMatchObject({ date: "2026-10-02" });
  });

  it("não promove candidato UNCERTAIN e mantém fato EXPLICIT concordante resolvido", () => {
    const pipeline = executarPipelineExtracao({
      recordingId: "uncertain-resolve", sourceId: "fonte-sintetica", sourceType: "medical_note",
      rawTranscript: "Provável adenocarcinoma de pulmão.",
    });
    const candidato = pipeline.facts.find((f) => f.domain === "diagnosis")!;
    expect(candidato).toMatchObject({ evidence: "UNCERTAIN", requiresConfirmation: true });
    expect(pipeline.fields.diagnosis).toMatchObject({ resolvedFactId: null, conflict: false });
    expect(pipeline.fields.diagnosis?.candidates).toHaveLength(1);

    const nota = extrair("Diagnóstico: adenocarcinoma de mama", "medical_note")
      .find((f) => f.domain === "diagnosis")!;
    const patologia = extrair("Diagnóstico: adenocarcinoma de mama", "pathology")
      .find((f) => f.domain === "diagnosis")!;
    const concordante = reconciliarCampo("diagnosis", [nota, patologia]);
    expect(concordante.resolvedFactId).toBe(patologia.id);
    expect(concordante.candidates).toHaveLength(2);
    expect(concordante.conflict).toBe(false);
  });

  it("data inválida ou ausente deixa laboratório PENDENTE sem data inventada", () => {
    const result = executarPipelineExtracao({
      recordingId: "datas-pendentes", sourceId: "laudo-sintetico", sourceType: "medical_note",
      rawTranscript: "31/02/2026 Creatinina 1,4 mg/dL\nCreatinina 1,2 mg/dL",
    });
    const labs = result.facts.filter((f) => f.domain === "lab");
    expect(labs).toHaveLength(2);
    expect(labs.every((f) => f.date === undefined && f.requiresConfirmation)).toBe(true);
    expect(labs[0]!.rawEvidence).toBe("31/02/2026 Creatinina 1,4 mg/dL");
    expect(labs[1]!.rawEvidence).toBe("Creatinina 1,2 mg/dL");
    expect(result.fields["lab:CREATININA"]).toMatchObject({ resolvedFactId: null, conflict: true });
    expect(result.fields["lab:CREATININA"]?.candidates).toHaveLength(2);
  });
});
