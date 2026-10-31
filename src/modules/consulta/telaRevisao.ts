import { TelaRevisaoConsulta } from "../../contracts/fase2/revisaoClinica.js";
import { cockcroftGault } from "../../rules/f0c/clinica.js";
import { bsaMosteller } from "../../rules/prescricao/instanciarProtocolo.js";

type Estado = "INFORMADO" | "AUSENTE_CONFIRMADO" | "NAO_INFORMADO";
export interface Declarado<T> { estado: Estado; valor?: T }
export interface EntradaTelaRevisao {
  hoje?: string;
  janelaLabDias?: number;
  intencao?: Declarado<"CURATIVA" | "NEOADJUVANTE" | "ADJUVANTE" | "PALIATIVA" | "DEFINITIVA" | "HIGIENICA" | "CITORREDUTORA">;
  linha?: Declarado<number>;
  cirurgia?: Declarado<true>;
  biomarcadores?: Declarado<{ nome: string; resultado: string; data: string }[]>;
  dependenciasBiomarcador?: readonly string[];
  dataDiagnosticoAP?: Declarado<string>;
  dataInicioTratamento?: Declarado<string>;
  validadeAPAC?: Declarado<string>;
  ecog?: Declarado<number>;
  pesoKg?: Declarado<number>;
  alturaCm?: Declarado<number>;
  pesoAnteriorKg?: Declarado<number>;
  idadeAnos?: Declarado<number>;
  sexoFormula?: Declarado<"MASCULINO" | "FEMININO">;
  creatininaMgDl?: Declarado<number>;
  fontePeso?: string;
  fonteCreatinina?: string;
  labs?: readonly { exame: string; valor: string; data: string; validade?: "VALIDO" | "PENDENTE" | "VENCIDO" }[];
  toxicidade?: Declarado<{ grauMaximo: number; ajusteDose: "nenhum" | "reducao" | "adiamento" }>;
  monitorizacao?: readonly { nome: string; estado: Estado; valor?: string }[];
  acessoVenoso?: Declarado<"PERIFERICO" | "PICC" | "CATETER_IMPLANTADO">;
  resposta?: Declarado<{ criterio: "RECIST" | "clinica"; dataReavaliacao: string }>;
  proximoCiclo?: Declarado<string>;
  dataReestadiamento?: Declarado<string>;
}

const dataCivil = (s: string): number | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [ano, mes, dia] = s.split("-").map(Number) as [number, number, number];
  const t = Date.parse(`${s}T00:00:00Z`);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  return d.getUTCFullYear() === ano && d.getUTCMonth() + 1 === mes && d.getUTCDate() === dia ? t : null;
};

function ler<T>(d: Declarado<T> | undefined, bloqueia: boolean, aceita: (v: T) => boolean) {
  if (d?.estado === "AUSENTE_CONFIRMADO") return { estado: "AUSENTE_CONFIRMADO" as const, bloqueiaLiberacao: bloqueia, valor: null };
  if (d?.estado === "INFORMADO" && d.valor !== undefined && aceita(d.valor))
    return { estado: "INFORMADO" as const, bloqueiaLiberacao: false, valor: d.valor };
  return { estado: "NAO_INFORMADO" as const, bloqueiaLiberacao: bloqueia, valor: null };
}

const texto = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const data = (v: unknown): v is string => typeof v === "string" && dataCivil(v) !== null;
const positivo = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
const inteiro = (min: number, max: number) => (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** Projeta a tela a partir do que foi declarado. Omissão não vira valor nem ausência confirmada. */
export function montarTelaRevisao(e: EntradaTelaRevisao): TelaRevisaoConsulta {
  const intencao = ler(e.intencao, true, (v): v is NonNullable<EntradaTelaRevisao["intencao"]> extends Declarado<infer X> ? X : never =>
    v === "CURATIVA" || v === "NEOADJUVANTE" || v === "ADJUVANTE" || v === "PALIATIVA" || v === "DEFINITIVA" || v === "HIGIENICA" || v === "CITORREDUTORA");
  const linha = ler(e.linha, true, (v): v is number => Number.isInteger(v) && v >= 1);
  const cirurgia = ler(e.cirurgia, false, (v): v is true => v === true);
  const ecog = ler(e.ecog, false, inteiro(0, 5));
  const peso = ler(e.pesoKg, true, positivo);
  const altura = ler(e.alturaCm, true, positivo);
  const scValor = peso.estado === "INFORMADO" && altura.estado === "INFORMADO" ? bsaMosteller(peso.valor, altura.valor) : null;
  const sc = scValor === null
    ? { estado: "NAO_INFORMADO" as const, bloqueiaLiberacao: true, valor: null, origem: "CALCULADA" as const }
    : { estado: "INFORMADO" as const, bloqueiaLiberacao: false, valor: scValor, origem: "CALCULADA" as const };

  const idade = ler(e.idadeAnos, false, (v): v is number => positivo(v) && v < 140);
  const sexo = ler(e.sexoFormula, false, (v): v is "MASCULINO" | "FEMININO" => v === "MASCULINO" || v === "FEMININO");
  const creatinina = ler(e.creatininaMgDl, false, positivo);
  const fontePeso = texto(e.fontePeso) ? e.fontePeso.trim() : null;
  const fonteCr = texto(e.fonteCreatinina) ? e.fonteCreatinina.trim() : null;
  const clcrCalc = peso.estado === "INFORMADO" && idade.estado === "INFORMADO" && sexo.estado === "INFORMADO" && creatinina.estado === "INFORMADO" && fontePeso && fonteCr
    ? cockcroftGault({
      idadeAnos: idade.valor, sexoFormula: sexo.valor,
      peso: { valor: peso.valor, unidade: "kg", fonte: fontePeso },
      creatinina: { valor: creatinina.valor, unidade: "mg/dL", fonte: fonteCr },
      alturaCm: altura.estado === "INFORMADO" ? altura.valor : null,
    }) : null;
  const clcr = clcrCalc?.estado === "CALCULADO" && clcrCalc.clcrMlMin !== null && clcrCalc.clcrMlMin > 0
    ? { estado: "INFORMADO" as const, bloqueiaLiberacao: false, valor: clcrCalc.clcrMlMin, origem: "CALCULADO" as const }
    : { estado: "NAO_INFORMADO" as const, bloqueiaLiberacao: true, valor: null, origem: "CALCULADO" as const };

  const anterior = ler(e.pesoAnteriorKg, true, positivo);
  let variacao: { estado: Estado; bloqueiaLiberacao: boolean; valor: number | null; alertaRecalculo: boolean };
  if (anterior.estado === "AUSENTE_CONFIRMADO") variacao = { estado: "AUSENTE_CONFIRMADO", bloqueiaLiberacao: false, valor: null, alertaRecalculo: false };
  else if (peso.estado === "INFORMADO" && anterior.estado === "INFORMADO" && anterior.valor > 0) {
    const pct = ((peso.valor - anterior.valor) / anterior.valor) * 100;
    const alerta = Math.abs(pct) >= 10;
    variacao = { estado: "INFORMADO", bloqueiaLiberacao: alerta, valor: pct, alertaRecalculo: alerta };
  } else variacao = { estado: "NAO_INFORMADO", bloqueiaLiberacao: true, valor: null, alertaRecalculo: false };

  const janela = Number.isInteger(e.janelaLabDias) && (e.janelaLabDias ?? 0) > 0 ? e.janelaLabDias! : null;
  const hoje = e.hoje && dataCivil(e.hoje) !== null ? dataCivil(e.hoje) : null;
  const itensLab = (e.labs ?? []).map((lab) => {
    const exame = texto(lab.exame) ? lab.exame.trim() : "";
    const dentro = exame && texto(lab.valor) && data(lab.data) && (lab.validade !== undefined ? lab.validade === "VALIDO"
      : janela !== null && hoje !== null && (() => { const t = dataCivil(lab.data); return t !== null && (hoje - t) / 86_400_000 >= 0 && (hoje - t) / 86_400_000 <= janela; })());
    return dentro
      ? { exame, estado: "INFORMADO" as const, bloqueiaLiberacao: false, valor: lab.valor.trim(), data: lab.data }
      : { exame: exame || "exame", estado: "NAO_INFORMADO" as const, bloqueiaLiberacao: true, valor: null, data: null };
  });
  const labsInformados = itensLab.length > 0 && itensLab.every((i) => i.estado === "INFORMADO");
  const labPreCiclo = {
    estado: labsInformados ? "INFORMADO" as const : "NAO_INFORMADO" as const,
    bloqueiaLiberacao: !labsInformados,
    janelaDias: janela,
    itens: itensLab,
  };

  const dependencias = [...new Set((e.dependenciasBiomarcador ?? []).map((n) => n.trim()).filter(Boolean))];
  const itensBio = (e.biomarcadores?.estado === "INFORMADO" ? e.biomarcadores.valor ?? [] : []).map((b) => {
    const nome = texto(b.nome) ? b.nome.trim() : "";
    return nome && texto(b.resultado) && data(b.data)
      ? { nome, estado: "INFORMADO" as const, bloqueiaLiberacao: false, resultado: b.resultado.trim(), data: b.data }
      : { nome: nome || "biomarcador", estado: "NAO_INFORMADO" as const, bloqueiaLiberacao: dependencias.includes(nome), resultado: null, data: null };
  });
  for (const nome of dependencias) {
    if (!itensBio.some((i) => i.nome === nome && i.estado === "INFORMADO")) {
      const ja = itensBio.find((i) => i.nome === nome);
      if (ja) ja.bloqueiaLiberacao = true;
      else itensBio.push({ nome, estado: "NAO_INFORMADO", bloqueiaLiberacao: true, resultado: null, data: null });
    }
  }
  const bioInformados = itensBio.length > 0 && itensBio.every((i) => i.estado === "INFORMADO");
  const biomarcadores = {
    estado: itensBio.length === 0 ? "NAO_INFORMADO" as const : bioInformados ? "INFORMADO" as const : "NAO_INFORMADO" as const,
    bloqueiaLiberacao: itensBio.some((i) => i.bloqueiaLiberacao),
    itens: itensBio,
  };

  const dx = ler(e.dataDiagnosticoAP, true, data);
  const inicio = ler(e.dataInicioTratamento, true, data);
  const dias = dx.estado === "INFORMADO" && inicio.estado === "INFORMADO"
    ? Math.round((dataCivil(inicio.valor)! - dataCivil(dx.valor)!) / 86_400_000) : null;
  const diasDecorridos = dias !== null && dias >= 0
    ? { estado: "INFORMADO" as const, bloqueiaLiberacao: false, valor: dias, origem: "CALCULADO" as const }
    : { estado: "NAO_INFORMADO" as const, bloqueiaLiberacao: true, valor: null, origem: "CALCULADO" as const };

  const tox = ler(e.toxicidade, false, (v): v is { grauMaximo: number; ajusteDose: "nenhum" | "reducao" | "adiamento" } =>
    inteiro(0, 5)(v.grauMaximo) && (v.ajusteDose === "nenhum" || v.ajusteDose === "reducao" || v.ajusteDose === "adiamento"));
  if (tox.estado === "INFORMADO" && tox.valor.grauMaximo >= 3) tox.bloqueiaLiberacao = true;

  const monitores = (e.monitorizacao ?? []).map((m) => {
    const nome = texto(m.nome) ? m.nome.trim() : "monitorização";
    if (m.estado === "AUSENTE_CONFIRMADO") return { nome, estado: "AUSENTE_CONFIRMADO" as const, bloqueiaLiberacao: false, valor: null };
    if (m.estado === "INFORMADO" && texto(m.valor)) return { nome, estado: "INFORMADO" as const, bloqueiaLiberacao: false, valor: m.valor!.trim() };
    return { nome, estado: "NAO_INFORMADO" as const, bloqueiaLiberacao: false, valor: null };
  });
  const monitorizacaoEsquema = {
    estado: monitores.length > 0 && monitores.every((m) => m.estado === "INFORMADO") ? "INFORMADO" as const : "NAO_INFORMADO" as const,
    bloqueiaLiberacao: false,
    itens: monitores,
  };

  return TelaRevisaoConsulta.parse({
    identidade: {
      intencao, linha, cirurgia, biomarcadores,
      datasSUS: { dataDiagnosticoAP: dx, dataInicioTratamento: inicio, diasDecorridos, validadeAPAC: ler(e.validadeAPAC, true, data) },
    },
    aptidaoHoje: {
      ecog,
      antropometria: { peso, altura, sc, clcr, variacaoPesoPct: variacao },
      labPreCiclo, toxicidadeAnterior: tox, monitorizacaoEsquema,
      acessoVenoso: ler(e.acessoVenoso, false, (v): v is "PERIFERICO" | "PICC" | "CATETER_IMPLANTADO" =>
        v === "PERIFERICO" || v === "PICC" || v === "CATETER_IMPLANTADO"),
    },
    fechamento: {
      respostaDoenca: ler(e.resposta, false, (v): v is { criterio: "RECIST" | "clinica"; dataReavaliacao: string } =>
        (v.criterio === "RECIST" || v.criterio === "clinica") && data(v.dataReavaliacao)),
      plano: {
        proximoCiclo: ler(e.proximoCiclo, false, texto),
        dataReestadiamento: ler(e.dataReestadiamento, false, data),
      },
    },
  });
}

/** Copia só número já documentado na ficha. Conflito, pendência e negação ficam não informados. */
export function entradaDesdeFicha(ficha: readonly { id: string; estado: string; valor: unknown }[]): EntradaTelaRevisao {
  const num = (id: string, aceita: (v: number) => boolean): Declarado<number> | undefined => {
    const f = ficha.find((c) => c.id === id);
    if (!f || f.estado !== "DOCUMENTADO" || typeof f.valor !== "number" || !aceita(f.valor)) return undefined;
    return { estado: "INFORMADO", valor: f.valor };
  };
  const ecog = num("ecog", (v) => Number.isInteger(v) && v >= 0 && v <= 5);
  const pesoKg = num("pesoKg", (v) => v > 0 && Number.isFinite(v));
  const alturaCm = num("alturaCm", (v) => v > 0 && Number.isFinite(v));
  return { ...(ecog ? { ecog } : {}), ...(pesoKg ? { pesoKg } : {}), ...(alturaCm ? { alturaCm } : {}) };
}
