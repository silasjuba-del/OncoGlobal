import type { ContextoInstrumento, EntradaAlbi, EntradaChildPugh, EntradaG8, EntradaKhorana, EntradaKps,
  InstrumentoId, MedidaInstrumento, RegraInstrumento, ResultadoInstrumento } from "../../contracts/f0c/instrumentos.js";

const texto = (s: string | null | undefined): boolean => typeof s === "string" && s.trim().length > 0 && !s.includes("[VERIFICAR]");
const positivo = (n: number | null): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;
function base(id: InstrumentoId, e: ContextoInstrumento, rs: RegraInstrumento | null): ResultadoInstrumento {
  const pendencias: string[] = [];
  if (e.aplicavel !== false) {
    if (e.aplicavel !== true) pendencias.push("aplicabilidade");
    if (!texto(e.fonteDados)) pendencias.push("fonteDados");
    if (!rs || rs.id !== id || rs.ativo !== true || !texto(rs.versao) || !texto(rs.fonte?.referencia) || !texto(rs.fonte?.conferidoEm)) pendencias.push("regra_curada");
  }
  return { instrumento: id, estado: e.aplicavel === false ? "NAO_APLICAVEL" : "PENDENTE", escore: null,
    classificacao: null, parcelas: {}, pendencias, regraVersao: rs?.versao ?? null, fonteRegra: rs?.fonte?.referencia ?? null,
    fonteDados: e.fonteDados, condutaAutomatica: false, consultaSegue: true };
}
function medida(m: MedidaInstrumento, unidade: string, campo: string, r: ResultadoInstrumento, zero = false): number | null {
  if (typeof m.valor !== "number" || !Number.isFinite(m.valor) || (zero ? m.valor < 0 : m.valor <= 0) || m.unidade !== unidade || !texto(m.fonte)) {
    r.pendencias.push(campo); return null;
  }
  return m.valor;
}
function escolha(valor: string | null, mapa: Readonly<Record<string, number>>, campo: string, r: ResultadoInstrumento): number | null {
  if (valor === null || !Object.hasOwn(mapa, valor)) { r.pendencias.push(campo); return null; }
  return mapa[valor]!;
}
function finalizar(r: ResultadoInstrumento, parcelas: Record<string, number>, classificacao: (n: number) => string): ResultadoInstrumento {
  if (r.pendencias.length) return r;
  const escore = Object.values(parcelas).reduce((a, b) => a + b, 0);
  if (!Number.isFinite(escore)) return { ...r, pendencias: ["resultado_invalido"] };
  return { ...r, estado: "CALCULADO", parcelas, escore, classificacao: classificacao(escore) };
}

/** KPS é registrado pelo médico; não é inferido de ECOG ou texto clínico. */
export function registrarKps(e: EntradaKps, rs: RegraInstrumento | null): ResultadoInstrumento {
  const r = base("KPS", e, rs);
  if (r.estado === "NAO_APLICAVEL") return r;
  if (e.kpsDocumentado === null || !Number.isInteger(e.kpsDocumentado) || e.kpsDocumentado < 0 || e.kpsDocumentado > 100 || e.kpsDocumentado % 10 !== 0) r.pendencias.push("kpsDocumentado");
  return finalizar(r, { kps: e.kpsDocumentado! }, (n) => `KPS ${n}`);
}

/** Variante INR da tabela VA; população cirrose, sem variantes colestáticas inferidas. */
export function calcularChildPugh(e: EntradaChildPugh, rs: RegraInstrumento | null): ResultadoInstrumento {
  const r = base("CHILD_PUGH", e, rs);
  if (r.estado === "NAO_APLICAVEL") return r;
  const b = medida(e.bilirrubina, "mg/dL", "bilirrubina", r);
  const a = medida(e.albumina, "g/dL", "albumina", r);
  const i = medida(e.inr, "INR", "inr", r);
  const ascite = escolha(e.ascite, { AUSENTE: 1, RESPONSIVA_DIURETICO: 2, REFRATARIA: 3 }, "ascite", r);
  const encefalopatia = escolha(e.encefalopatia, { AUSENTE: 1, GRAU_1_2: 2, GRAU_3_4: 3 }, "encefalopatia", r);
  return finalizar(r, { bilirrubina: b! < 2 ? 1 : b! <= 3 ? 2 : 3, albumina: a! > 3.5 ? 1 : a! >= 2.8 ? 2 : 3,
    inr: i! < 1.7 ? 1 : i! <= 2.3 ? 2 : 3, ascite: ascite!, encefalopatia: encefalopatia! }, (n) => n <= 6 ? "A" : n <= 9 ? "B" : "C");
}

/** Johnson 2015: log10(bilirrubina µmol/L)*0.66 - albumina g/L*0.085. Sem arredondar antes de classificar. */
export function calcularAlbi(e: EntradaAlbi, rs: RegraInstrumento | null): ResultadoInstrumento {
  const r = base("ALBI", e, rs);
  if (r.estado === "NAO_APLICAVEL") return r;
  const b = medida(e.bilirrubina, "umol/L", "bilirrubina", r);
  const a = medida(e.albumina, "g/L", "albumina", r);
  return finalizar(r, { bilirrubina: Math.log10(b!) * 0.66, albumina: a! * -0.085 }, (n) => n <= -2.60 ? "1" : n <= -1.39 ? "2" : "3");
}

/** Modelo original 2008: variáveis pré-QT de paciente ambulatorial; nunca prescreve profilaxia. */
export function calcularKhorana(e: EntradaKhorana, rs: RegraInstrumento | null): ResultadoInstrumento {
  const r = base("KHORANA", e, rs);
  if (r.estado === "NAO_APLICAVEL") return r;
  const sitio = escolha(e.sitio, { ESTOMAGO: 2, PANCREAS: 2, PULMAO: 1, LINFOMA: 1, GINECOLOGICO: 1, BEXIGA: 1, TESTICULO: 1, OUTRO: 0 }, "sitio", r);
  const p = medida(e.plaquetas, "10^9/L", "plaquetas", r, true);
  const h = medida(e.hemoglobina, "g/dL", "hemoglobina", r);
  const l = medida(e.leucocitos, "10^9/L", "leucocitos", r, true);
  const imc = medida(e.imc, "kg/m2", "imc", r);
  if (typeof e.usaEstimulanteEritropoiese !== "boolean") r.pendencias.push("usaEstimulanteEritropoiese");
  return finalizar(r, { sitio: sitio!, plaquetas: p! >= 350 ? 1 : 0, hemoglobinaOuEstimulante: h! < 10 || e.usaEstimulanteEritropoiese === true ? 1 : 0,
    leucocitos: l! > 11 ? 1 : 0, imc: imc! >= 35 ? 1 : 0 }, (n) => n === 0 ? "BAIXO" : n <= 2 ? "INTERMEDIARIO" : "ALTO");
}

/** G8 SIOG: oito itens; respostas desconhecidas só pontuam quando opção prevista no questionário. */
export function calcularG8(e: EntradaG8, rs: RegraInstrumento | null): ResultadoInstrumento {
  const r = base("G8", e, rs);
  if (r.estado === "NAO_APLICAVEL") return r;
  const ingestao = escolha(e.ingestao3Meses, { REDUCAO_GRAVE: 0, REDUCAO_MODERADA: 1, SEM_REDUCAO: 2 }, "ingestao3Meses", r);
  const peso = escolha(e.perdaPeso3Meses, { MAIS_3_KG: 0, NAO_SABE: 1, ENTRE_1_3_KG: 2, SEM_PERDA: 3 }, "perdaPeso3Meses", r);
  const mobilidade = escolha(e.mobilidade, { LEITO_CADEIRA: 0, SAI_LEITO_NAO_CASA: 1, SAI_CASA: 2 }, "mobilidade", r);
  const neuro = escolha(e.neuropsicologico, { DEMENCIA_OU_DEPRESSAO_GRAVE: 0, LEVE: 1, AUSENTE: 2 }, "neuropsicologico", r);
  const saude = escolha(e.autoavaliacaoSaude, { PIOR: 0, NAO_SABE: 0.5, IGUAL: 1, MELHOR: 2 }, "autoavaliacaoSaude", r);
  const imc = medida(e.imc, "kg/m2", "imc", r);
  if (e.medicamentosPorDia === null || !Number.isInteger(e.medicamentosPorDia) || e.medicamentosPorDia < 0) r.pendencias.push("medicamentosPorDia");
  if (!positivo(e.idadeAnos)) r.pendencias.push("idadeAnos");
  return finalizar(r, { ingestao: ingestao!, peso: peso!, mobilidade: mobilidade!, neuropsicologico: neuro!,
    imc: imc! < 19 ? 0 : imc! < 21 ? 1 : imc! < 23 ? 2 : 3, medicamentos: e.medicamentosPorDia! > 3 ? 0 : 1,
    saude: saude!, idade: e.idadeAnos! > 85 ? 0 : e.idadeAnos! >= 80 ? 1 : 2 }, (n) => n <= 14 ? "RASTREAMENTO_ALTERADO" : "RASTREAMENTO_NAO_ALTERADO");
}
