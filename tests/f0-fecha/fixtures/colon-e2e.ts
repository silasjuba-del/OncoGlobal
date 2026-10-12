/** Kit documental + ambiente do E2E do caso cólon (câncer de cólon metastático em FOLFIRI).
 *  Tudo sintético; dados fixos conforme prompt v1.0.0 do caso.
 *  WRITE_SET desta tarefa: este arquivo, e2e-colon-f1.test.ts (mesmo diretório pai). */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { createHash } from "node:crypto";
import { createCanvas } from "@napi-rs/canvas";
import { abrirLedger } from "../../../src/kernel/ledger/db.js";
import { salvarDraft } from "../../../src/kernel/ledger/drafts.js";
import { confirmar } from "../../../src/kernel/ledger/writeRouter.js";
import { criarGateway, memoriaIdempotencia } from "../../../src/kernel/gateway/gateway.js";
import { criarExecutorImprimir } from "../../../src/kernel/gateway/executores/imprimir.js";
import { criarResolverDocumentoLedger } from "../../../src/kernel/ledger/documentos.js";
import { criarServidorLocal } from "../../../src/server/http.js";
import { criarGerenciadorSessao } from "../../../src/server/sessao.js";

export const AGORA = "2026-10-12T12:00:00-03:00"; // relógio injetado; data de registro
export const DATA_CLINICA = "2026-10-09"; // data clínica dos documentos (sintética)
export const PACIENTE_ID = "paciente-e2e-colon-001";
export const PACIENTE_NOME = "Paciente Teste Cólon 01";
export const ENCONTRO_ANTERIOR = "encontro-e2e-colon-anterior-001";
export const ENCONTRO_ATUAL = "encontro-e2e-colon-retorno-001";
export const TUMOR_LOT_ID = "tumor-e2e-colon-001";
export const SENHA = "senha-sintetica-e2e-colon-01";
export const MEDICO_ID = "medico-e2e-colon";
export const CRM = "CRM-E2E-0000";

export const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

// ── Kit documental (bytes reais; cada fonte tem id, data clínica e hash) ──────

/** PDF digital mínimo com texto Helvetica/WinAnsi (caminho de extração sem OCR). */
export function pdfDigital(linhas: string[]): Buffer {
  const stream = ["BT /F1 13 Tf 60 800 Td 18 TL"];
  for (const linha of linhas) stream.push(`(${linha.replace(/[()\\]/g, "")}) Tj T*`);
  stream.push("ET");
  const conteudo = Buffer.from(stream.join("\n"), "latin1");
  const objs = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),
    Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    Buffer.from("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>"),
    Buffer.concat([Buffer.from(`<< /Length ${conteudo.length} >>\nstream\n`), conteudo, Buffer.from("\nendstream")]),
    Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"),
  ];
  let pdf = Buffer.from("%PDF-1.4\n");
  let xref = "xref\n0 6\n0000000000 65535 f \n";
  objs.forEach((o, i) => {
    xref += `${String(pdf.length).padStart(10, "0")} 00000 n \n`;
    pdf = Buffer.concat([pdf, Buffer.from(`${i + 1} 0 obj\n`), o, Buffer.from("\nendobj\n")]);
  });
  const inicio = pdf.length;
  return Buffer.concat([pdf, Buffer.from(`${xref}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${inicio}\n%%EOF\n`)]);
}

/** PNG "escaneado" renderizado em canvas (caminho de OCR real local). */
export function pngEscaneado(linhas: string[], altura = 620): Buffer {
  const canvas = createCanvas(1800, altura), ctx = canvas.getContext("2d");
  ctx.fillStyle = "white"; ctx.fillRect(0, 0, 1800, altura);
  ctx.fillStyle = "black"; ctx.font = "64px Arial"; ctx.textBaseline = "top";
  let y = 60;
  for (const linha of linhas) { ctx.fillText(linha, 60, y); y += 130; }
  return canvas.toBuffer("image/png");
}

/** PDF somente bitmap (página renderizada comprimida) — exercita OCR sobre PDF. */
export function pdfBitmap(linhas: string[]): Buffer {
  const canvas = createCanvas(1800, 560), ctx = canvas.getContext("2d");
  ctx.fillStyle = "white"; ctx.fillRect(0, 0, 1800, 560);
  ctx.fillStyle = "black"; ctx.font = "64px Arial"; ctx.textBaseline = "top";
  let y = 60;
  for (const linha of linhas) { ctx.fillText(linha, 60, y); y += 130; }
  const rgba = ctx.getImageData(0, 0, 1800, 560).data, rgb = Buffer.alloc(1800 * 560 * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4) { rgb[j++] = rgba[i]!; rgb[j++] = rgba[i + 1]!; rgb[j++] = rgba[i + 2]!; }
  const imagem = deflateSync(rgb), draw = Buffer.from("q 1800 0 0 560 0 0 cm /Im0 Do Q");
  const objs = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),
    Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    Buffer.from("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1800 560] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>"),
    Buffer.concat([Buffer.from(`<< /Length ${draw.length} >>\nstream\n`), draw, Buffer.from("\nendstream")]),
    Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width 1800 /Height 560 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${imagem.length} >>\nstream\n`), imagem, Buffer.from("\nendstream")]),
  ];
  let pdf = Buffer.from("%PDF-1.4\n");
  let xref = "xref\n0 6\n0000000000 65535 f \n";
  objs.forEach((o, i) => {
    xref += `${String(pdf.length).padStart(10, "0")} 00000 n \n`;
    pdf = Buffer.concat([pdf, Buffer.from(`${i + 1} 0 obj\n`), o, Buffer.from("\nendobj\n")]);
  });
  const inicio = pdf.length;
  return Buffer.concat([pdf, Buffer.from(`${xref}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${inicio}\n%%EOF\n`)]);
}

export interface FonteKit { id: string; sourceId: string; sourceType: "medical_note" | "pathology" | "nursing"; tipo: "PDF" | "IMAGEM"; bytes: Buffer; sha256: string; dataClinica: string }

/** As três fontes fixas do caso (conteúdo alinhado ao prompt v1.0.0). */
export function kitColon(): FonteKit[] {
  const a = pdfDigital([
    "OncoGlobal E2E — DOCUMENTO SINTÉTICO (dados fictícios);",
    `Paciente: ${PACIENTE_NOME};`,
    "Data do documento: 09/10/2026;",
    "Diagnóstico oncológico: câncer de cólon metastático.",
    "Tratamento informado: FOLFIRI em curso.",
    "Biomarcadores: não disponíveis no material apresentado.",
  ]);
  const b = pngEscaneado([
    "Avaliacao medica - 09/10/2026 (sintetico)",
    "Relata diarreia CTCAE grau 2.",
    "Neutropenia referida; paciente sem febre.",
  ]);
  const c = pdfBitmap([
    "09/10/2026 - Laboratorio (sintetico)",
    "Hemoglobina 8,2 g/dL.",
    "Neutrofilos: nao informado.",
  ]);
  return [
    { id: "upload-e2e-colon-historico", sourceId: "e2e-colon-historico", sourceType: "medical_note", tipo: "PDF", bytes: a, sha256: sha256(a), dataClinica: DATA_CLINICA },
    { id: "upload-e2e-colon-avaliacao", sourceId: "e2e-colon-avaliacao", sourceType: "nursing", tipo: "IMAGEM", bytes: b, sha256: sha256(b), dataClinica: DATA_CLINICA },
    { id: "upload-e2e-colon-laboratorio", sourceId: "e2e-colon-laboratorio", sourceType: "medical_note", tipo: "PDF", bytes: c, sha256: sha256(c), dataClinica: DATA_CLINICA },
  ];
}

// ── Ambiente: HTTP real, SQLite em arquivo, relógio injetado, impressor real ──

export async function abrirAmbienteColon(dir: string) {
  const db = abrirLedger(join(dir, "ledger.sqlite"));
  const agora = () => AGORA;
  const sessoes = criarGerenciadorSessao({ medicoId: MEDICO_ID, crm: CRM, senha: SENHA, duracaoMs: 60_000, agora });
  const resolverDocumento = criarResolverDocumentoLedger(db);
  const gateway = criarGateway({
    agora,
    auditar: () => {},
    store: memoriaIdempotencia(),
    executores: { IMPRIMIR: criarExecutorImprimir({ dataDir: dir, agora, resolverDocumento }) },
  });
  const server = criarServidorLocal({ db, sessoes, gateway, agora, log: () => {}, configRootDir: join(dir, "config") });
  await new Promise<void>((resolve, reject) => {
    if (server.listening) return resolve();
    server.once("error", reject); server.once("listening", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("PORTA_LOCAL_AUSENTE");
  const token = sessoes.login(SENHA)!.token;
  let chamadasHttp = 0;
  const request = async <T = Record<string, any>>(path: string, body: unknown, authToken = token): Promise<{ status: number; data: T }> => {
    chamadasHttp++;
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify(body),
    });
    return { status: response.status, data: await response.json() as T };
  };
  const close = async () => {
    await new Promise<void>((resolve) => { server.close(() => resolve()); });
    db.close();
  };
  return { dir, db, sessoes, token, request, close, baseUrl: `http://127.0.0.1:${address.port}`,
    chamadasHttp: () => chamadasHttp, gateway, executoresImprimirDir: join(dir, "impressao") };
}

/** Seed único permitido: cadastro sintético (nome visível ≠ identificador técnico). */
export function cadastrarCasoColon(amb: Awaited<ReturnType<typeof abrirAmbienteColon>>) {
  const seed = (draftId: string, eventId: string, tipo: string, payload: Record<string, unknown>, encontro: string) => {
    salvarDraft(amb.db, { draftId, patientId: PACIENTE_ID, sourceId: `cadastro-fonte-${draftId}`,
      rawRef: "fixture-local-sintetica", payload: {}, diagnostics: [], revision: 0, criadoEm: AGORA });
    const r = confirmar(amb.db, { operationId: `operacao-${draftId}`, patientId: PACIENTE_ID, tumorLotId: null,
      encounterId: encontro, reviewDecisionId: `decisao-${draftId}`,
      sessao: amb.sessoes.obter(amb.token)!, em: AGORA,
      registros: [{ draftId, expectedRevision: 0, eventId, tipo, payload, fontes: [], revisao: "CONFIRMADO" }] });
    if (r.estado !== "GRAVADA") throw new Error(`SEED_NAO_GRAVADO:${draftId}:${r.estado}`);
  };
  // Encontro anterior: cadastro + apenas contexto oncológico (sem valores clínicos).
  seed("cad-e2e-colon", "cadastro-evento-e2e-colon-anterior", "Paciente",
    { patientId: PACIENTE_ID, identificadores: [], nome: PACIENTE_NOME, nascimento: null,
      sexoCadastral: "NAO_INFORMADO", divergencia: false }, ENCONTRO_ANTERIOR);
  seed("ctx-e2e-colon-anterior", "contexto-evento-e2e-colon-anterior", "ContextoOncologico",
    { texto: "Acompanhamento oncológico em andamento; sem valores clínicos registrados neste encontro." }, ENCONTRO_ANTERIOR);
  // Encontro atual: chegada para a consulta de reavaliação/pré-ciclo (achados ainda não registrados).
  seed("chegada-e2e-colon-atual", "chegada-evento-e2e-colon-atual", "ContextoOncologico",
    { texto: "Consulta de reavaliação/pré-ciclo agendada; achados serão registrados neste encontro." }, ENCONTRO_ATUAL);
  // Lote tumoral do caso (identificador fixo do prompt; sem CID/histologia inventadas).
  seed("lot-e2e-colon", "lote-evento-e2e-colon", "TumorLot", {
    tumorLotId: TUMOR_LOT_ID, patientId: PACIENTE_ID,
    cid: campoTriagem(null, "CID não informada no caso sintético"),
    topografia: campoTriagem(null, "topografia não detalhada no material apresentado"),
    histologia: campoTriagem(null, "histologia não informada"),
    estadiamentos: [], finalidadeApac: campoTriagem(null, "finalidade APAC não selecionada"), marcos: [],
  }, ENCONTRO_ANTERIOR);
}

export function criarDiretorioColon(): string { return mkdtempSync(join(tmpdir(), "e2e-colon-f1-")); }

/** Campo semáforo mínimo válido para a Triagem (salão preenche fonte/revisão no servidor;
 *  o contrato exige ≥1 fonte nos campos PRESENTE, mesmo que o servidor descarte a lista). */
export function campoTriagem<T>(valor: T | null, motivo: string) {
  const presente = valor !== null;
  const fonte = { sourceId: "fonte-e2e-colon-triagem", classe: "MANUAL" as const,
    localizador: "triagem sintética do caso cólon", dataClinica: DATA_CLINICA,
    dataCaptura: AGORA, versao: "e2e-colon-triagem-v1", contentHash: sha256("triagem-sintetica-e2e-colon") };
  return { valor, estado: "PENDENTE" as const, campo: (presente ? "PRESENTE" : "AUSENTE") as "AUSENTE" | "PRESENTE",
    motivo, fontes: presente ? [fonte] : [], revisao: (presente ? "REVISAR" : "RAW") as "RAW" | "REVISAR" };
}

/** Triagem do caso: Hb 8,2 g/dL (= 82 dg/dL), ANC e febre ausentes, diarreia grau 2 informada. */
export function triagemColon() {
  return {
    patientId: PACIENTE_ID, encounterId: ENCONTRO_ATUAL,
    pas: campoTriagem(null, "pressão não aferida no cenário sintético"),
    fc: campoTriagem(null, "frequência cardíaca não aferida no cenário sintético"),
    spo2: campoTriagem(null, "saturação não aferida no cenário sintético"),
    tempDecimos: campoTriagem(null, "febre ausente conforme relato; temperatura numérica não informada"),
    hbDgDl: campoTriagem(82, "hemoglobina 8,2 g/dL informada (convenção: décimos de g/dL)"),
    anc: campoTriagem(null, "contagem absoluta de neutrófilos não fornecida"),
    plq: campoTriagem(null, "plaquetas não informadas"),
    coletaHemograma: campoTriagem(DATA_CLINICA, "data da coleta do hemograma"),
    ecog: campoTriagem(null, "ECOG não informado"),
    grauCtcae: campoTriagem(2, "diarreia CTCAE grau 2 informada pelo médico; critérios não declarados"),
    tontura: null, vertigemHistoricoAnterior: null, vertigemInicioNovo: null,
    recurso: "AMBULATORIAL" as const, idadeAnos: null, chegadaEm: AGORA,
  };
}
