// W11-H28 · Fuzz determinístico das regras puras da onda W11. Só dados sintéticos.
// PRNG semeado (mulberry32, sem pacote novo): mesma semente = mesmos casos em toda execução.
// Para cada regra, ≥ 500 entradas geradas e provadas: (a) mesma entrada = mesma saída; (b) entrada congelada
// não é mutada; (c) dado clínico ausente nunca produz VERDE/liberado; (d) dado clínico ausente nunca lança exceção
// (exceções só para entrada estruturalmente inválida, que o gerador não produz); (e) nenhuma saída contém
// "amarelo", "liberado", "aprovado" ou "apto".
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ClinicalEvent } from "../../src/contracts/operacao.js";
import type { Triagem } from "../../src/contracts/clinico.js";
import type { SinaisExtraW10 } from "../../src/rules/triagem.js";
import { avaliarPortoesW10 } from "../../src/rules/triagem.js";
import { lerLimiarAlertaPlaquetas, avaliarAlertaPlaquetas, type EntradaPlaquetas, type LimiarAlertaPlaquetas } from "../../src/rules/plaquetasAlerta.js";
import { grauCtcae, lerSalaoCtcae } from "../../src/rules/portaCiclo.js";
import { elegibilidadeCiclo, type EntradasElegibilidadeCiclo, type SinalElegibilidade, type CorElegibilidade } from "../../src/rules/elegibilidadeCiclo.js";
import { calcularRetorno, type EntradaRetorno, type ExameAntesRetorno, type PrazoUnidade, type TipoRetorno } from "../../src/rules/retorno.js";
import { montarReceitas, rotearItemReceita, CONFIGURACAO_RECEITUARIO_PADRAO, type EntradaControlado, type ItemReceita } from "../../src/rules/prescricao/receituarioEspecial.js";
import { adicionarOutro, lerMatrizUniversal, subconjunto, validarMatrizUniversal, type MatrizUniversal } from "../../src/rules/matrizUniversal.js";
import { projetarDatasFixas } from "../../src/kernel/projections/datasFixas.js";
import { projetarHistoricoTratamento, type FatoTratamento } from "../../src/kernel/projections/historicoTratamento.js";
import { gatesCoerencia, type ContextoAntiglosa, type RegraCidSexo } from "../../src/apac/antiglosa.js";
import { montarTabelaSigtap } from "../../src/apac/sigtap.js";
import { apac, CAIXAS, COD_QT, COD_ZERO, proc, camposOk } from "../apac-w10/helpers.js";
import { triagemBase, presente, ausente } from "../fixtures/triagem.js";
import { salaoRuleset } from "../fixtures/rulesets.js";

const N = 500;
const SEMENTE = 0x28_2026;
const PROIBIDAS = /amarelo|liberado|aprovado|\bapto\b/i;
const ler = (rel: string): unknown => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8"));

// ── PRNG e geradores ──────────────────────────────────────────────────────────
type Rnd = () => number;
function criarPrng(semente: number): Rnd {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const inteiro = (r: Rnd, min: number, max: number): number => min + Math.floor(r() * (max - min + 1));
const escolha = <T,>(r: Rnd, itens: readonly T[]): T => itens[Math.floor(r() * itens.length)] as T;
const pode = (r: Rnd, p: number): boolean => r() < p;
const dataCivil = (r: Rnd, anoMin: number, anoMax: number): string => {
  const ano = inteiro(r, anoMin, anoMax);
  const mes = inteiro(r, 1, 12);
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const dia = inteiro(r, 1, ultimo);
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
};

/** Só os VALORES textuais da saída (chaves de metadados como "aprovadoEm" não são texto clínico). */
function textosDe(valor: unknown): string {
  if (typeof valor === "string") return valor;
  if (Array.isArray(valor)) return valor.map(textosDe).join(" ");
  if (valor !== null && typeof valor === "object") return Object.values(valor).map(textosDe).join(" ");
  return "";
}

/** Congela recursivamente: uma escrita em modo estrito lança TypeError, o que falha o teste. */
function congelar<T>(v: T): T {
  if (v !== null && typeof v === "object" && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const filho of Object.values(v as Record<string, unknown>)) congelar(filho);
  }
  return v;
}

/** Roda a regra sobre casos gerados e prova as cinco propriedades. */
function fuzzar<I, O>(
  nome: string,
  gerar: (r: Rnd, i: number) => I,
  executar: (entrada: I) => O,
  propriedades: (entrada: I, saida: O) => void,
): void {
  it(`${nome}: ${N} entradas com determinismo, imutabilidade, ausente sem verde e sem exceção`, () => {
    const r = criarPrng(SEMENTE);
    for (let i = 0; i < N; i++) {
      const entrada = gerar(r, i);
      const antes = JSON.stringify(entrada);
      const congelada = congelar(structuredClone(entrada));
      let s1: O;
      try {
        s1 = executar(congelada);
      } catch (erro) {
        throw new Error(`${nome} caso ${i} lançou para dado clínico (possivelmente ausente): ${String(erro)}\n${antes}`);
      }
      const s2 = executar(congelada);
      const texto1 = JSON.stringify(s1);
      expect(JSON.stringify(s2), `${nome} caso ${i}: saídas diferentes para a mesma entrada`).toBe(texto1);
      expect(JSON.stringify(congelada), `${nome} caso ${i}: entrada foi mutada`).toBe(antes);
      const valores = textosDe(s1);
      expect(PROIBIDAS.test(valores), `${nome} caso ${i}: valor de saída com termo proibido: ${valores.slice(0, 200)}`).toBe(false);
      propriedades(congelada, s1);
    }
  });
}

// ── Fixtures oficiais do corpus (rulesets congelados) ─────────────────────────
const labs = ler("../../corpus/rulesets/lab-thresholds.v1.json");
const salao = lerSalaoCtcae(ler("../../corpus/rulesets/salao-ctcae.v1.json"));
const limiar: LimiarAlertaPlaquetas = lerLimiarAlertaPlaquetas(labs);
const classificarPlaquetas = (valor: number | null) => grauCtcae("plaquetas", valor, salao);
const TABELA_CONTROLADOS = (ler("../../corpus/regulatorio/medicamentos-controlados.v1.json") as { entradas: EntradaControlado[] }).entradas;
const MATRIZ: MatrizUniversal = lerMatrizUniversal(ler("../../corpus/matriz/matriz-universal.v1.json"));
const regrasCidSexo = (ler("../../corpus/rulesets/apac-cid-sexo.v1.json") as { regras: RegraCidSexo[] }).regras;
const sigtap = { "2026-09": montarTabelaSigtap("2026-09", [proc(), proc({ codigo: COD_ZERO, nome: "CONSULTA SINTETICA" })]) };
const ctxApac: ContextoAntiglosa = {
  hoje: "2026-09-11", sigtap, caixas: CAIXAS, cnesConfigurado: "2605473",
  regrasCidSexo, codigosSigtapLocal: new Set([COD_QT]), esquemaVigente: "Carboplatina + paclitaxel AUC 2",
};

// ── 1 · Triagem (portões W10: triagem do ciclo e corte do salão) ─────────────
const CAMPOS_NUMERICOS: Array<{ campo: keyof Triagem; max: number }> = [
  { campo: "pas", max: 300 }, { campo: "fc", max: 250 }, { campo: "spo2", max: 100 }, { campo: "tempDecimos", max: 450 },
  { campo: "hbDgDl", max: 200 }, { campo: "anc", max: 20000 }, { campo: "plq", max: 400000 },
  { campo: "ecog", max: 5 }, { campo: "grauCtcae", max: 5 },
];
function gerarTriagem(r: Rnd): { t: Triagem; extra: SinaisExtraW10 } {
  const sobrescrita: Record<string, unknown> = {};
  for (const { campo, max } of CAMPOS_NUMERICOS) {
    sobrescrita[campo] = pode(r, 0.2) ? ausente<number>() : presente(inteiro(r, 0, max));
  }
  sobrescrita.coletaHemograma = pode(r, 0.2) ? ausente<string>() : presente(dataCivil(r, 2026, 2026));
  const t = triagemBase(sobrescrita as Partial<Triagem>);
  const extra: SinaisExtraW10 = {
    pad: pode(r, 0.2) ? null : inteiro(r, 40, 130),
    crCentesimos: pode(r, 0.2) ? null : inteiro(r, 0, 1000),
  };
  return { t, extra };
}

// ── 2 · Alerta de plaquetas ───────────────────────────────────────────────────
function gerarPlaquetas(r: Rnd): EntradaPlaquetas {
  const valor = pode(r, 0.15) ? null : pode(r, 0.1) ? inteiro(r, -50, 0) : pode(r, 0.05) ? inteiro(r, 1, 999) + 0.5 : inteiro(r, 1, 400000);
  return { valor, data: pode(r, 0.2) ? null : dataCivil(r, 2026, 2026) };
}

// ── 3 · Elegibilidade de ciclo ────────────────────────────────────────────────
const ORIGENS = ["portaCiclo", "triagem", "ctcae", "interacoes", "plaquetas", "funcaoOrganica", "intercorrencia"] as const;
const ESTADOS: CorElegibilidade[] = ["VERDE", "VERMELHO", "PENDENTE"];
function gerarSinal(r: Rnd): SinalElegibilidade | null {
  if (pode(r, 0.15)) return null;
  const motivos = Array.from({ length: inteiro(r, 0, 2) }, (_, k) => ({
    texto: `motivo sintético ${k}`,
    ...(pode(r, 0.3) ? { nivel: escolha(r, ["atencao", "importante", "contraindicacao"] as const) } : {}),
  }));
  return { estado: escolha(r, ESTADOS), motivos };
}
function gerarElegibilidade(r: Rnd): EntradasElegibilidadeCiclo {
  const e: Record<string, SinalElegibilidade | null | undefined> = {};
  for (const origem of ORIGENS.slice(0, 6)) e[origem] = gerarSinal(r);
  if (pode(r, 0.5)) e.intercorrencia = gerarSinal(r);
  return e as unknown as EntradasElegibilidadeCiclo;
}

// ── 4 · Retorno ───────────────────────────────────────────────────────────────
const UNIDADES: PrazoUnidade[] = ["DIAS", "SEMANAS", "MESES"];
const TIPOS: TipoRetorno[] = ["PROGRAMADO", "CONDICIONADO", "ANTECIPADO", "SEM_RETORNO"];
function gerarRetorno(r: Rnd): EntradaRetorno {
  const exames: ExameAntesRetorno[] = Array.from({ length: inteiro(r, 0, 3) }, () => ({
    ...(pode(r, 0.6) ? { codigo: `EX-SINT-${inteiro(r, 1, 9)}` } : {}),
    ...(pode(r, 0.4) ? { nome: "exame sintético" } : {}),
    prazoAntesDias: inteiro(r, 0, 30),
  }));
  return {
    prazo: pode(r, 0.15) ? null : { quantidade: inteiro(r, 0, 400), unidade: escolha(r, UNIDADES) },
    tipo: escolha(r, TIPOS),
    ...(pode(r, 0.5) ? { condicao: pode(r, 0.3) ? "  " : "condição sintética" } : {}),
    motivo: pode(r, 0.15) ? null : pode(r, 0.1) ? "   " : "reavaliação sintética",
    examesAntes: exames,
    dataReferencia: dataCivil(r, 1999, 2099),
  };
}

// ── 5 · Receituário especial ──────────────────────────────────────────────────
const MEDICAMENTOS = [
  "tramadol 50 mg", "TRAMADOL", "Tramadol", "tramadolina", "morfina 10 mg", "Morfina", "dexametasona 4 mg",
  "ondansetrona 8 mg", "  paracetamol  ", "codeína", "", "   ",
];
function gerarItens(r: Rnd): ItemReceita[] {
  return Array.from({ length: inteiro(r, 0, 6) }, (_, k) => ({
    id: `item-${k}`,
    medicamento: escolha(r, MEDICAMENTOS),
    ...(pode(r, 0.5) ? { contexto: escolha(r, ["COMUM", "SINTOMATICOS_QT"] as const) } : {}),
  }));
}

// ── 6 · Matriz universal (subconjunto e OUTROS) ───────────────────────────────
type NoMatriz = { id: string; [k: string]: unknown };
const niveisMatriz = (no: NoMatriz): NoMatriz[] => ["classes", "secoes", "topicos"].flatMap((k) => (no[k] as NoMatriz[] | undefined) ?? []);
/** Todos os caminhos da raiz a qualquer nó da matriz (ids do topo até o nó). */
const CAMINHOS_MATRIZ: string[][] = (() => {
  const caminhos: string[][] = [];
  const percorre = (nos: NoMatriz[], prefixo: string[]): void => {
    for (const n of nos) {
      const atual = [...prefixo, n.id];
      caminhos.push(atual);
      percorre(niveisMatriz(n), atual);
    }
  };
  percorre(MATRIZ.categorias as unknown as NoMatriz[], []);
  return caminhos;
})();

// ── 7 · Datas fixas (cabeçalho clínico) ───────────────────────────────────────
function evento(id: string, tipo: string, data: Record<string, unknown>) {
  return ClinicalEvent.parse({
    eventId: id, operationId: `op-${id}`, eventIndex: 0, patientId: "paciente-sintetico",
    tumorLotId: "lote-sintetico", encounterId: "consulta-sintetica", tipo,
    payload: { reviewDecisionId: "revisao-sintetica", data }, fontes: [], revisao: "CONFIRMADO",
    criadoEm: "2026-10-07T12:00:00Z", criadoPor: { tipo: "SESSAO", id: "medico-sintetico" },
    supersedesEventId: null,
  });
}
function gerarEventos(r: Rnd) {
  const eventos = [];
  const n = inteiro(r, 0, 6);
  for (let k = 0; k < n; k++) {
    const id = `ev-${String(k).padStart(2, "0")}`;
    const data = dataCivil(r, 2026, 2026);
    const tipo = escolha(r, ["Biopsy", "Staging", "TreatmentCycle"] as const);
    if (tipo === "Biopsy") eventos.push(evento(id, tipo, { dataClinica: data }));
    else if (tipo === "Staging") eventos.push(evento(id, tipo, { tipo: escolha(r, ["STAGING", "RESTAGING"] as const), dataClinica: data, valor: "cT2 cN1 cM0" }));
    else eventos.push(evento(id, tipo, { linha: 1, ciclo: inteiro(r, 1, 6), dataClinica: data }));
  }
  return eventos;
}

// ── 8 · Histórico de tratamento ───────────────────────────────────────────────
function gerarFatos(r: Rnd): FatoTratamento[] {
  const fatos: FatoTratamento[] = [];
  for (let k = 0; k < inteiro(r, 0, 5); k++) {
    const id = `fato-${k}`;
    const tipo = escolha(r, ["SISTEMICO", "CIRURGIA", "RT"] as const);
    if (tipo === "SISTEMICO") {
      fatos.push({
        tipo, id, data: dataCivil(r, 2026, 2026), ciclo: pode(r, 0.2) ? null : inteiro(r, 1, 8),
        protocolo: pode(r, 0.2) ? null : pode(r, 0.1) ? "   " : "PROTOCOLO SINTETICO",
        doseRelativaPct: pode(r, 0.3) ? null : inteiro(r, 0, 100), previstoEm: pode(r, 0.3) ? null : dataCivil(r, 2026, 2026),
        observacao: pode(r, 0.5) ? null : "observação sintética",
      });
    } else if (tipo === "CIRURGIA") {
      fatos.push({ tipo, id, data: dataCivil(r, 2026, 2026), procedimento: pode(r, 0.3) ? null : "procedimento sintético", observacao: null });
    } else {
      const inicioRt = dataCivil(r, 2026, 2026);
      const fimCandidato = dataCivil(r, 2026, 2026);
      fatos.push({
        tipo, id, inicio: inicioRt, fim: pode(r, 0.4) ? null : fimCandidato >= inicioRt ? fimCandidato : inicioRt,
        fracoes: pode(r, 0.3) ? null : inteiro(r, 1, 33), doseTotalGy: pode(r, 0.3) ? null : inteiro(r, 1, 70),
        boost: null, topografia: null, medicoResponsavel: null, local: null, observacao: null,
      });
    }
  }
  return fatos;
}

// ── 9 · Gates de coerência da APAC (antiglosa) ────────────────────────────────
const CAMPOS_MUTAVEIS = ["pacienteCns", "cidPrincipal", "pacienteSexo", "procedimentoPrincipal", "quantidadePrincipal", "dataSolicitacao", "finalidadeApac", "cnesSolicitante", "justificativa", "descricaoDiagnostico"] as const;
const VALORES_APAC = [null, "", "   ", "X", "C50.9", "C16.1", "M", "F", 0, 1, "2026-09-10", "2026-13-40", "PALIATIVA", "CURATIVA", "-1"];
function gerarCampos(r: Rnd): Record<string, unknown> {
  const over: Record<string, unknown> = {};
  for (const campo of CAMPOS_MUTAVEIS) if (pode(r, 0.3)) over[campo] = escolha(r, VALORES_APAC);
  return camposOk(over);
}

// ── Execução das regras ───────────────────────────────────────────────────────
describe("fuzz determinístico das regras puras W11 (H28)", () => {
  // Guardas estruturais: entrada impossível é recusada com erro documentado (não é dado clínico ausente).
  it("guarda estrutural: texto vazio em OUTROS é recusado com erro documentado", () => {
    expect(() => adicionarOutro(MATRIZ, ["procedimento"], "")).toThrow("adicionarOutro: texto vazio");
    expect(() => adicionarOutro(MATRIZ, ["procedimento"], "   ")).toThrow("adicionarOutro: texto vazio");
  });

  it("guarda estrutural: radioterapia com fim anterior ao início é recusada", () => {
    expect(() => projetarHistoricoTratamento([
      { tipo: "RT", id: "rt-x", inicio: "2026-01-15", fim: "2026-01-03", fracoes: null, doseTotalGy: null, boost: null, topografia: null, medicoResponsavel: null, local: null, observacao: null },
    ])).toThrow("fim anterior ao início");
  });

  fuzzar(
    "triagem (portões W10)",
    gerarTriagem,
    ({ t, extra }) => avaliarPortoesW10(t, extra, salaoRuleset),
    ({ t, extra }, saida) => {
      // Cada portão só lê os próprios campos (triagem do ciclo não lê ANC/plaquetas/ECOG; ver triagem.ts).
      const lidosCiclo = [t.tempDecimos, t.pas, t.fc].some((c) => c.valor === null) || extra.pad === null;
      const lidosSalao = ["tempDecimos", "spo2", "pas", "fc", "hbDgDl", "anc", "plq", "ecog"].some((k) => (t as unknown as Record<string, { valor: unknown }>)[k]?.valor === null)
        || extra.crCentesimos === null || t.idadeAnos === null;
      for (const portao of [saida.triagemCiclo, saida.corteSalao]) expect(portao.bloqueiaSalvar).toBe(false);
      if (lidosCiclo) expect(saida.triagemCiclo.destino).not.toBe("SALAO");
      if (lidosSalao) expect(saida.corteSalao.destino).not.toBe("SALAO");
      for (const portao of [saida.triagemCiclo, saida.corteSalao]) {
        if (portao.destino === "SALAO") expect(portao.pendentes).toEqual([]);
      }
    },
  );

  fuzzar(
    "alerta de plaquetas",
    gerarPlaquetas,
    (entrada) => avaliarAlertaPlaquetas(entrada, limiar, classificarPlaquetas),
    (entrada, [alerta, grau]) => {
      expect(alerta.bloqueiaSalvar).toBe(false);
      if (entrada.valor === null || entrada.data === null) expect(alerta.estado).toBe("PENDENTE");
      if (entrada.valor === null) expect(grau.grau).toBeNull();
      if (alerta.estado === "SEM_ALERTA" || alerta.estado === "ALERTA") expect(entrada.valor).not.toBeNull();
    },
  );

  fuzzar(
    "elegibilidade de ciclo",
    gerarElegibilidade,
    (e) => elegibilidadeCiclo(e),
    (e, saida) => {
      const presentes = Object.entries(e).filter(([, v]) => v !== undefined);
      if (presentes.some(([, v]) => v === null)) expect(saida.cor).not.toBe("VERDE");
      if (saida.cor === "VERDE") {
        for (const [, v] of presentes) {
          const sinal = v as SinalElegibilidade;
          expect(sinal.estado).toBe("VERDE");
          expect(sinal.motivos.every((m) => m.nivel === undefined)).toBe(true);
        }
      }
    },
  );

  fuzzar(
    "retorno",
    gerarRetorno,
    (entrada) => calcularRetorno(entrada),
    (entrada, saida) => {
      if (entrada.tipo === "SEM_RETORNO") {
        expect(saida.estado).toBe("PRONTO");
        return;
      }
      const semPrazo = entrada.prazo === null;
      const semMotivo = entrada.motivo === null || entrada.motivo.trim() === "";
      if (semPrazo || semMotivo) expect(saida.estado).toBe("PENDENTE");
      if (saida.estado === "PRONTO") {
        expect(saida.dataAlvo).not.toBeNull();
        expect(saida.agendamento).not.toBeNull();
      }
      if (saida.dataAlvo !== null) {
        for (const pedido of saida.pedidos) expect(pedido.dataLimite <= saida.dataAlvo).toBe(true);
      }
    },
  );

  fuzzar(
    "receituário especial (roteamento e montagem)",
    (r) => ({ itens: gerarItens(r), configuracao: { servicoTemReceituarioEspecial: pode(r, 0.5) } }),
    ({ itens, configuracao }) => montarReceitas(itens, configuracao, TABELA_CONTROLADOS),
    ({ itens, configuracao }, saida) => {
      const total = saida.receitaComum.length + saida.documentosEspeciais.reduce((s, d) => s + d.itens.length, 0) + saida.indisponiveis.length;
      expect(total).toBe(itens.length);
      for (const item of saida.receitaComum) {
        const r = rotearItemReceita(item, configuracao, TABELA_CONTROLADOS);
        expect(r.estado).toBe("OFERECIDO_RECEITA_COMUM");
        // Dado ausente: item sem nome de medicamento nunca é oferecido na receita.
        expect(item.medicamento.trim(), `item ${item.id} sem medicamento oferecido`).not.toBe("");
      }
    },
  );

  fuzzar(
    "matriz universal (subconjunto e OUTROS)",
    (r) => ({
      chaves: Array.from({ length: inteiro(r, 0, 8) }, () => escolha(r, CAMINHOS_MATRIZ)[0] as string),
      caminho: escolha(r, CAMINHOS_MATRIZ),
      texto: escolha(r, ["achado sintético", "  outro sintético  ", "item sintético"]),
    }),
    ({ chaves, caminho, texto }) => {
      let extra: unknown;
      try {
        extra = adicionarOutro(MATRIZ, caminho, texto);
      } catch (erro) {
        // Recusa documentada: nível sem OUTROS (regra da matriz), não é dado clínico ausente.
        if (!/nível sem OUTROS/.test(String(erro))) throw erro;
        extra = { recusado: "nível sem OUTROS" };
      }
      return { sub: subconjunto(MATRIZ, chaves), extra };
    },
    () => undefined,
  );

  fuzzar(
    "validação da matriz com entrada corrompida",
    (r) => (pode(r, 0.5) ? null : { categorias: inteiro(r, 0, 3) }),
    (entrada) => validarMatrizUniversal(entrada),
    () => undefined,
  );

  fuzzar(
    "datas fixas do cabeçalho",
    gerarEventos,
    (eventos) => projetarDatasFixas(eventos, "2026-10-08"),
    (_eventos, saida) => {
      for (const d of [saida.biopsyDate, saida.c1d1Date, saida.lastStagingDate, saida.lastRestagingDate, saida.lastTreatmentDate]) {
        expect(d.estado === "PREENCHIDO").toBe(d.data !== null);
      }
      const posterior = saida.c1d1Date.data !== null && saida.c1d1Date.data > "2026-10-08";
      expect(saida.diasDesde.c1d1 === null).toBe(saida.c1d1Date.data === null || posterior);
    },
  );

  fuzzar(
    "histórico de tratamento",
    gerarFatos,
    (fatos) => projetarHistoricoTratamento(fatos),
    (fatos, linhas) => {
      expect(linhas.length).toBe(fatos.length);
      linhas.forEach((linha) => {
        // A saída é ordenada por data: o casamento é pelo id do fato (origem), não pelo índice.
        const fato = fatos.find((f) => f.id === linha.origem);
        if (fato?.tipo === "SISTEMICO" && fato.previstoEm === null) expect(linha.atrasoDias).toBeNull();
      });
    },
  );

  fuzzar(
    "gates de coerência da APAC (antiglosa)",
    gerarCampos,
    (campos) => gatesCoerencia(apac("adv-fuzz", campos), ctxApac),
    () => undefined,
  );
});
