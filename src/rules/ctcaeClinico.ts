// W12-GROK-04 · D-W9-75. Sugere grau só com o texto literal da v6 injetado.
// PROVISORIO-W12: o contrato publicado ainda não descreve esta sugestão.
// Este arquivo não importa outras regras. Ambiguidade fica visível e não elege grau.

export interface TrechoFonte {
  inicio: number;
  fim: number;
  texto: string;
}

export interface CriterioUsado {
  tipo: string;
  grau: number;
  criterioLiteral: string;
  fonteTrecho: string;
  trecho: TrechoFonte;
}

export interface LeituraQuantidade {
  leitura: "POR_DIA" | "NO_TOTAL";
  quantidade: number;
  periodoDias: number | null;
  grau: number | null;
  criterioLiteral: string | null;
  trecho: TrechoFonte;
}

export interface ResultadoCtcaeClinico {
  termo: string | null;
  grauSugerido: number | null;
  criteriosUsados: CriterioUsado[];
  criteriosFaltantes: { pergunta: string }[];
  ambiguidades: LeituraQuantidade[];
  status: "SUGESTAO" | "PENDENTE";
  sugestao: true;
  confirmadoPeloMedico: false;
  bloqueiaSalvar: false;
  destino: "FILA_MEDICO" | null;
  e1: boolean;
  rulesetVersao: string;
}

export interface EntradaCriterio {
  tipo: string;
  termo: string | null;
  inicio: number;
  fim: number;
  texto: string;
  quantidade: number | null;
  periodoDias: number | null;
  leituraQuantidade: "POR_DIA" | "NO_TOTAL" | "AMBIGUO" | null;
  sobreBasal: boolean;
  valorLaboratorio: number | null;
  analito: "plaquetas" | "neutrofilos" | "hemoglobina" | null;
  tempDecimos: number | null;
  duracaoHoras: number | null;
  intensidade: "leve" | "moderada" | "severa" | null;
  ambulatorial: boolean;
}

interface GrauTxt {
  grau: number;
  texto: string;
}

interface TermoClinico {
  ativo: boolean;
  status: string;
  nome: string;
  fonteTrecho: string;
  graus: GrauTxt[];
}

interface FaixaNum {
  grau: number;
  minInclusivo: number | null;
  maxExclusivo: number | null;
}

interface CorpusLido {
  versao: string;
  clinicos: Record<string, TermoClinico>;
  faixas: Record<string, FaixaNum[]>;
  fontesLab: Record<string, string>;
}

type Bruto = Record<string, unknown>;

function objeto(valor: unknown, caminho: string): Bruto {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) throw new Error(`${caminho} ausente`);
  return valor as Bruto;
}

function textoDe(valor: unknown, caminho: string): string {
  if (typeof valor !== "string" || valor.trim().length === 0) throw new Error(`${caminho} ausente`);
  return valor;
}

function ler(json: unknown): CorpusLido {
  const raiz = objeto(json, "salao-ctcae");
  const header = objeto(raiz.header, "header");
  const graus = objeto(raiz.graus, "graus");
  const termos = objeto(graus.termos, "graus.termos");
  const clinicosBrutos = objeto(graus.termosClinicos, "graus.termosClinicos");
  const clinicos: Record<string, TermoClinico> = {};
  for (const [id, valor] of Object.entries(clinicosBrutos)) {
    if (id === "nota" || typeof valor !== "object" || valor === null || Array.isArray(valor)) continue;
    const termo = valor as Bruto;
    const fonte = objeto(termo.fonte, `${id}.fonte`);
    if (!Array.isArray(termo.graus)) throw new Error(`${id}.graus ausente`);
    clinicos[id] = {
      ativo: termo.ativo === true,
      status: textoDe(termo.status, `${id}.status`),
      nome: textoDe(termo.nome, `${id}.nome`),
      fonteTrecho: textoDe(fonte.trecho, `${id}.fonte.trecho`),
      graus: termo.graus.map((item) => {
        const grau = objeto(item, `${id}.grau`);
        if (typeof grau.grau !== "number") throw new Error(`${id}.grau inválido`);
        return { grau: grau.grau, texto: textoDe(grau.texto, `${id}.grau.texto`) };
      }),
    };
  }
  const faixas: Record<string, FaixaNum[]> = {};
  const fontesLab: Record<string, string> = {};
  for (const id of ["plaquetas", "neutrofilos", "hemoglobina"]) {
    const termo = termos[id];
    if (typeof termo !== "object" || termo === null) continue;
    const bloco = termo as Bruto;
    if (!Array.isArray(bloco.faixas)) continue;
    faixas[id] = bloco.faixas.map((item) => {
      const faixa = objeto(item, `${id}.faixa`);
      if (typeof faixa.grau !== "number") throw new Error(`${id}.faixa.grau inválido`);
      return {
        grau: faixa.grau,
        minInclusivo: typeof faixa.minInclusivo === "number" ? faixa.minInclusivo : null,
        maxExclusivo: typeof faixa.maxExclusivo === "number" ? faixa.maxExclusivo : null,
      };
    });
    fontesLab[id] = typeof bloco.fonte === "string" ? bloco.fonte : "";
  }
  return { versao: textoDe(header.versao, "header.versao"), clinicos, faixas, fontesLab };
}

function trechoDe(c: EntradaCriterio): TrechoFonte {
  return { inicio: c.inicio, fim: c.fim, texto: c.texto };
}

function casarUnico(graus: readonly GrauTxt[], agulha: string): GrauTxt | null {
  if (graus.filter((g) => g.texto.includes(agulha)).length !== 1) return null;
  return graus.find((g) => g.texto.includes(agulha)) ?? null;
}

function contem(valor: number, faixa: FaixaNum): boolean {
  if (faixa.minInclusivo !== null && valor < faixa.minInclusivo) return false;
  if (faixa.maxExclusivo !== null && valor >= faixa.maxExclusivo) return false;
  return true;
}

function decimosDeDecimal(s: string): number {
  const [inteiro, fracao = "0"] = s.split(".");
  return Number(inteiro) * 10 + Number(fracao[0] ?? "0");
}

function faixaFebre(texto: string):
  | { tipo: "intervalo"; exclusivoInicio: boolean; lo: number; hi: number }
  | { tipo: "acima"; lo: number; horas: "<=" | ">" }
  | null {
  const intervalo = (origem: RegExpMatchArray | null, exclusivoInicio: boolean) => {
    const lo = origem?.[1];
    const hi = origem?.[2];
    if (lo === undefined || hi === undefined) return null;
    return { tipo: "intervalo" as const, exclusivoInicio, lo: decimosDeDecimal(lo), hi: decimosDeDecimal(hi) };
  };
  const fechado = intervalo(texto.match(/^(\d+\.\d+)\s*-\s*(\d+\.\d+)\s*degrees C/), false);
  if (fechado !== null) return fechado;
  const aberto = intervalo(texto.match(/^>(\d+\.\d+)\s*-\s*(\d+\.\d+)\s*degrees C/), true);
  if (aberto !== null) return aberto;
  const acima = texto.match(/^>(\d+\.\d+)\s*degrees C[\s\S]*for\s*(<=|>)\s*24\s*hrs/);
  const lo = acima?.[1];
  const marca = acima?.[2];
  if (lo === undefined || (marca !== "<=" && marca !== ">")) return null;
  return { tipo: "acima", lo: decimosDeDecimal(lo), horas: marca };
}

function resultado(
  versao: string,
  termo: string | null,
  usados: CriterioUsado[],
  faltantes: { pergunta: string }[],
  ambiguidades: LeituraQuantidade[],
  destino: "FILA_MEDICO" | null,
  e1: boolean,
): ResultadoCtcaeClinico {
  const grauSugerido = usados.length === 0 ? null : Math.max(...usados.map((u) => u.grau));
  return {
    termo,
    grauSugerido,
    criteriosUsados: [...usados].sort((a, b) => a.trecho.inicio - b.trecho.inicio || (a.tipo < b.tipo ? -1 : a.tipo > b.tipo ? 1 : 0)),
    criteriosFaltantes: grauSugerido === null
      ? [...faltantes].sort((a, b) => (a.pergunta < b.pergunta ? -1 : a.pergunta > b.pergunta ? 1 : 0))
      : [],
    ambiguidades: [...ambiguidades].sort((a, b) => (a.leitura < b.leitura ? -1 : a.leitura > b.leitura ? 1 : 0) || a.trecho.inicio - b.trecho.inicio),
    status: grauSugerido === null ? "PENDENTE" : "SUGESTAO",
    sugestao: true,
    confirmadoPeloMedico: false,
    bloqueiaSalvar: false,
    destino: grauSugerido === null ? null : destino,
    e1: grauSugerido === null ? false : e1,
    rulesetVersao: versao,
  };
}

function semTermo(versao: string): ResultadoCtcaeClinico {
  return resultado(versao, null, [], [{ pergunta: "Nenhum termo do corpus v6 foi reconhecido no texto." }], [], null, false);
}

function grauPorEvacuacao(quantidade: number, graus: readonly GrauTxt[]): GrauTxt | null {
  if (quantidade >= 7) return casarUnico(graus, ">=7 stools per day");
  if (quantidade >= 4 && quantidade <= 6) return casarUnico(graus, "4 - 6 stools per day");
  return null;
}

function avaliarLaboratorio(termo: string, criterios: readonly EntradaCriterio[], corpus: CorpusLido): ResultadoCtcaeClinico {
  const faixas = corpus.faixas[termo] ?? [];
  const valores = criterios.filter((c) => c.tipo === "laboratorio" && c.analito === termo && c.valorLaboratorio !== null);
  if (valores.length === 0) {
    return resultado(corpus.versao, termo, [], [{ pergunta: `Valor de ${termo} ausente; não vira 0.` }], [], null, false);
  }
  if (valores.length > 1) {
    const lista = valores.map((v) => String(v.valorLaboratorio)).join(" e ");
    return resultado(corpus.versao, termo, [], [{ pergunta: `Dois valores no mesmo texto (${lista}); nenhum foi eleito.` }], [], null, false);
  }
  const primeiro = valores[0];
  const valor = primeiro?.valorLaboratorio ?? null;
  if (primeiro === undefined || valor === null || !Number.isInteger(valor)) {
    return resultado(corpus.versao, termo, [], [{ pergunta: `Valor de ${termo} ausente; não vira 0.` }], [], null, false);
  }
  const escolhida = faixas.filter((f) => contem(valor, f)).sort((a, b) => b.grau - a.grau)[0];
  if (escolhida === undefined) {
    return resultado(corpus.versao, termo, [], [{ pergunta: "Valor fora das faixas literais; grau não vira 0." }], [], null, false);
  }
  const usado: CriterioUsado = {
    tipo: "laboratorio",
    grau: escolhida.grau,
    criterioLiteral: `G${escolhida.grau} minInclusivo ${escolhida.minInclusivo ?? "null"} maxExclusivo ${escolhida.maxExclusivo ?? "null"}`,
    fonteTrecho: corpus.fontesLab[termo] ?? "",
    trecho: trechoDe(primeiro),
  };
  const fila = termo === "plaquetas" && (escolhida.grau === 3 || escolhida.grau === 4);
  return resultado(corpus.versao, termo, [usado], [], [], fila ? "FILA_MEDICO" : null, termo === "plaquetas" && escolhida.grau === 4);
}

function avaliarClinico(termo: TermoClinico, id: string, criterios: readonly EntradaCriterio[], corpus: CorpusLido): ResultadoCtcaeClinico {
  if (!termo.ativo || termo.status !== "VERIFICADO" || termo.fonteTrecho.trim().length === 0) {
    return resultado(corpus.versao, id, [], [{ pergunta: "Termo inativo no corpus (NAO_VERIFICADO)." }], [], null, false);
  }
  const usados: CriterioUsado[] = [];
  const ambiguidades: LeituraQuantidade[] = [];
  const faltantes: { pergunta: string }[] = [];
  const temHospital = criterios.some((c) => c.tipo === "hospitalizacao");
  const por = (c: EntradaCriterio, grau: GrauTxt | null, tipo: string) => {
    if (grau === null) return;
    usados.push({
      tipo,
      grau: grau.grau,
      criterioLiteral: grau.texto,
      fonteTrecho: termo.fonteTrecho,
      trecho: trechoDe(c),
    });
  };

  for (const c of criterios) {
    if (c.tipo === "quantidade" && c.quantidade !== null) {
      if (c.leituraQuantidade === "AMBIGUO") {
        const porDia = id === "diarreia" && c.sobreBasal ? grauPorEvacuacao(c.quantidade, termo.graus) : null;
        ambiguidades.push({
          leitura: "POR_DIA",
          quantidade: c.quantidade,
          periodoDias: c.periodoDias,
          grau: porDia?.grau ?? null,
          criterioLiteral: porDia?.texto ?? null,
          trecho: trechoDe(c),
        });
        ambiguidades.push({
          leitura: "NO_TOTAL",
          quantidade: c.quantidade,
          periodoDias: c.periodoDias,
          grau: null,
          criterioLiteral: null,
          trecho: trechoDe(c),
        });
      } else if (c.leituraQuantidade === "POR_DIA" && id === "diarreia") {
        if (!c.sobreBasal) faltantes.push({ pergunta: "O texto não diz que a contagem é aumento sobre o basal." });
        else por(c, grauPorEvacuacao(c.quantidade, termo.graus), "quantidade");
      }
    }
    if (c.tipo === "hospitalizacao") por(c, casarUnico(termo.graus, "hospitalization indicated"), c.tipo);
    if (c.tipo === "avdInstrumental") por(c, casarUnico(termo.graus, "limiting instrumental ADL"), c.tipo);
    if (c.tipo === "avdAutocuidado") por(c, casarUnico(termo.graus, "limiting self-care ADL"), c.tipo);
    if (c.tipo === "dietaModificada") por(c, casarUnico(termo.graus, "modified diet indicated"), c.tipo);
    if (c.tipo === "ingestaoInterfere") por(c, casarUnico(termo.graus, "interfering with oral intake"), c.tipo);
    if (c.tipo === "ingestaoNaoInterfere") por(c, casarUnico(termo.graus, "does not interfere with oral intake"), c.tipo);
    if (c.tipo === "aliviaComRepouso") por(c, casarUnico(termo.graus, "Fatigue relieved by rest"), c.tipo);
    if (c.tipo === "sonda") por(c, casarUnico(termo.graus, "tube feeding"), c.tipo);
    if (c.tipo === "obito") por(c, casarUnico(termo.graus, "Death"), c.tipo);
    if (c.tipo === "riscoDeVida") por(c, casarUnico(termo.graus, "Life-threatening consequences"), c.tipo);
    if (c.tipo === "dor" && c.intensidade === "severa") por(c, casarUnico(termo.graus, "Severe pain"), c.tipo);
    if (c.tipo === "dor" && c.intensidade === "moderada") por(c, casarUnico(termo.graus, "Moderate pain"), c.tipo);
    if (c.tipo === "dor" && c.intensidade === "leve") por(c, casarUnico(termo.graus, "mild symptoms"), c.tipo);
    if (c.tipo === "hidratacaoEv" && id === "vomito" && (c.ambulatorial || !temHospital)) {
      por(c, casarUnico(termo.graus, "outpatient IV hydration"), c.tipo);
    }
    if (c.tipo === "hidratacaoEv" && id === "nausea") por(c, casarUnico(termo.graus, "IV intervention indicated"), c.tipo);
    if (c.tipo === "hidratacaoEv" && id === "diarreia") por(c, casarUnico(termo.graus, "requires IV intervention"), c.tipo);
  }

  if (id === "febre") {
    const temps = criterios.filter((c) => c.tipo === "temperatura" && c.tempDecimos !== null);
    const duracao = criterios.find((c) => c.tipo === "duracao" && c.duracaoHoras !== null);
    const lido = temps.length === 1 ? temps[0] : undefined;
    const temp = lido?.tempDecimos ?? null;
    if (temps.length > 1) faltantes.push({ pergunta: "Dois valores de temperatura; nenhum foi eleito." });
    else if (lido !== undefined && temp !== null) {
      const horas = duracao?.duracaoHoras ?? null;
      const casaram = termo.graus.filter((g) => {
        const faixa = faixaFebre(g.texto);
        if (faixa === null || temp === null) return false;
        if (faixa.tipo === "intervalo") {
          return faixa.exclusivoInicio ? temp > faixa.lo && temp <= faixa.hi : temp >= faixa.lo && temp <= faixa.hi;
        }
        if (horas === null) return false;
        const horaOk = faixa.horas === "<=" ? horas <= 24 : horas > 24;
        return temp > faixa.lo && horaOk;
      });
      const grauFebril = casaram[0];
      if (casaram.length === 1 && grauFebril !== undefined) por(lido, grauFebril, "temperatura");
      else if (casaram.length > 1) faltantes.push({ pergunta: "A temperatura cai em mais de uma faixa literal; nenhuma foi eleita." });
      else if (termo.graus.some((g) => {
        const faixa = faixaFebre(g.texto);
        return faixa?.tipo === "acima" && temp > faixa.lo;
      }) && horas === null) faltantes.push({ pergunta: "Falta a duração da febre acima do limite literal: passou de 24 horas?" });
      else faltantes.push({ pergunta: "A temperatura não entra em faixa literal de febre no corpus." });
    }
  }

  const previa = resultado(corpus.versao, id, usados, faltantes, ambiguidades, null, false);
  if (previa.grauSugerido === null && previa.criteriosFaltantes.length === 0) {
    const perguntas = [...faltantes];
    if (ambiguidades.length > 0) perguntas.push({ pergunta: "A quantidade admite duas leituras e o grau não foi eleito." });
    if (criterios.some((c) => c.tipo === "quantidade") && id !== "diarreia") {
      perguntas.push({ pergunta: "O corpus v6 deste termo não traz corte por número de episódios." });
    }
    if (id === "fadiga" && criterios.some((c) => c.tipo === "naoAliviaComRepouso") && !criterios.some((c) => c.tipo === "avdInstrumental" || c.tipo === "avdAutocuidado")) {
      perguntas.push({ pergunta: "Falta dizer se a limitação é de AVD instrumental ou de autocuidado." });
    }
    if (perguntas.length === 0) perguntas.push({ pergunta: `Falta critério literal da v6 para ${termo.nome}.` });
    return resultado(corpus.versao, id, usados, perguntas, ambiguidades, null, false);
  }
  return previa;
}

/** Cada termo reconhecido vira uma sugestão. Grau numérico só sai de faixa ou frase literal do corpus. */
export function sugerirGrauCtcae(criterios: readonly EntradaCriterio[], corpus: unknown): ResultadoCtcaeClinico[] {
  const lido = ler(corpus);
  const termos = [...new Set(criterios.map((c) => c.termo).filter((t): t is string => t !== null))].sort();
  if (termos.length === 0) return [semTermo(lido.versao)];
  return termos.map((id) => {
    const doTermo = criterios.filter((c) => c.termo === id);
    if (lido.faixas[id] !== undefined && lido.clinicos[id] === undefined) return avaliarLaboratorio(id, doTermo, lido);
    const clinico = lido.clinicos[id];
    if (clinico === undefined) {
      return resultado(lido.versao, id, [], [{ pergunta: "Termo ausente no corpus." }], [], null, false);
    }
    return avaliarClinico(clinico, id, doTermo, lido);
  });
}
