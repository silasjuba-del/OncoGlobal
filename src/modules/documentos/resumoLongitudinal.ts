// W11-H16 · RESUMO ONCOLÓGICO LONGITUDINAL (TEMPLATE PADRÃO, fonte M-AJ PLN-031).
// Renderizador puro: entrada tipada própria, texto/markdown de saída, sem I/O e sem data corrente.
// Duas saídas: paraTela (inclui IA FALA) e paraDocumento (exclui IA FALA e qualquer menção a IA).
// Regras: campo ausente fica vazio após os dois pontos; "suspeito" nunca vira "confirmado";
// CONDUTA — CD é sempre vazia (não há campo de entrada para ela); grau CTCAE só se fornecido.

export type StatusFato = "CONFIRMADO" | "SUSPEITO";

export type StatusTratamento = "proposto" | "prescrito" | "administrado" | "pausado" | "suspenso" | "concluído";

export type Elegibilidade = "confirmada" | "não confirmada" | "indeterminada";

export type PrioridadeApac = "ELETIVO" | "PRIORITÁRIO" | "URGÊNCIA" | "EMERGÊNCIA";

/** Fato clínico com status. Sem status, o texto sai como foi fornecido. */
export interface FatoResumo {
  texto: string;
  status?: StatusFato;
}

export interface IdentificacaoResumo {
  nome?: string;
  dn?: string;
  idade?: string;
  cidadeUf?: string;
}

export interface AnagraficosResumo {
  sexo?: string;
  cidadeOrigem?: string;
  acompanhante?: string;
  profissao?: string;
}

export interface OperacionalResumo {
  tratamentoAtual?: string;
  resposta?: string;
  problemasAtivos?: string;
  proximoPasso?: string;
}

export interface ClinicosResumo {
  ecog?: string;
  kps?: string;
  ap?: string;
  medicacoesContinuas?: string;
  cirurgiasPrevias?: string;
  historiaFamiliar?: string;
  vacinas?: string;
  habitosVida?: string;
  pesoAlturaSc?: string;
  funcaoRenalHepatica?: string;
}

export interface OncologicosResumo {
  diagnostico?: string;
  sitioPrimario?: string;
  lateralidadeSubsitio?: string;
  histologiaGrau?: string;
  /** Valores sem prefixo, ex.: cT: "2", cN: "0", cM: "0". */
  tnmClinico?: { cT?: string; cN?: string; cM?: string };
  tnmPatologico?: { pT?: string; pN?: string };
  tnmPosNeoadjuvancia?: { ypT?: string; ypN?: string };
  estadio?: string;
  biomarcadores?: string;
  sitiosMetastaticos?: FatoResumo[];
  intencaoAtual?: string;
  linhaAtual?: string;
  cid10?: string;
}

export interface EventoTimelineResumo {
  data: string;
  exame: string;
  resumo: string;
  status?: StatusFato;
}

export interface LinhaLaboratorioResumo {
  data: string;
  hb?: string;
  anc?: string;
  plaq?: string;
  crClCr?: string;
  tgoTgp?: string;
  bt?: string;
  marcador?: string;
  outros?: string;
}

export interface SerieMarcadorResumo {
  nome: string;
  medidas: readonly { data: string; valor: string }[];
}

export interface TratamentoResumo {
  protocolo?: string;
  farmacos?: string;
  dose?: string;
  cicloDia?: string;
  intencao?: string;
  inicio?: string;
  status?: StatusTratamento;
  resposta?: string;
}

export interface ToxicidadeResumo {
  toxicidade: string;
  /** Grau CTCAE somente quando já fornecido pela fonte. */
  grau?: string;
  inicio?: string;
  status?: string;
  impactoConduta?: string;
}

export interface AlergiaResumo {
  substancia: string;
  reacao?: string;
}

export interface ContraindicacoesResumo {
  itens?: readonly string[];
  /** true somente quando a avaliação de contraindicações foi efetivamente feita. */
  avaliado?: boolean;
  interacoes?: string;
  comorbidadeTratamento?: string;
  orgaoVulneravel?: string;
  doseCumulativa?: string;
  riscosEspecificos?: string;
}

export interface EventoHistoricoResumo {
  data: string;
  dataFim?: string;
  titulo: string;
  texto?: string;
}

/** Oito rótulos do bloco IA FALA. Presente apenas em paraTela. */
export interface IaFalaResumo {
  sugestoes?: readonly string[];
  pendencias?: readonly string[];
  errosConflitos?: readonly string[];
  lacunas?: readonly string[];
  pearls?: readonly string[];
  pitfalls?: readonly string[];
  caution?: readonly string[];
  naoSei?: readonly string[];
}

export interface EstudoResumo {
  texto: string;
  /** Obrigatória: estudo sem fonte é descartado. */
  fonte: string;
}

export interface SusResumo {
  cid10?: string;
  sigtap?: string;
  finalidadeEnquadramento?: string;
  prioridade?: PrioridadeApac;
  protocoloSus?: string;
  conitecPcdtDiretriz?: string;
  elegibilidade?: Elegibilidade;
  diferencaEvidenciaSus?: string;
  pendenciaApac?: string;
  /** Formato AAAA-MM. */
  competenciaSigtap?: string;
  fonteOficial?: string;
  proveniencia?: string;
}

export interface EntradaResumoLongitudinal {
  identificacao?: IdentificacaoResumo;
  anagraficos?: AnagraficosResumo;
  operacional?: OperacionalResumo;
  clinicos?: ClinicosResumo;
  oncologicos?: OncologicosResumo;
  timeline?: readonly EventoTimelineResumo[];
  laboratorio?: { linhas?: readonly LinhaLaboratorioResumo[]; series?: readonly SerieMarcadorResumo[] };
  tratamento?: TratamentoResumo;
  ctcae?: readonly ToxicidadeResumo[];
  alergias?: readonly AlergiaResumo[];
  contraindicacoes?: ContraindicacoesResumo;
  historico?: readonly EventoHistoricoResumo[];
  iaFala?: IaFalaResumo;
  estudos?: readonly EstudoResumo[];
  sus?: SusResumo;
}

export interface ResumoLongitudinalRenderizado {
  paraTela: string;
  paraDocumento: string;
}

const MAX_ESTUDOS = 3;
const LARGURA_CD = 94;
const LINHA_CD = `> **[${" ".repeat(LARGURA_CD)}]**`;

const v = (x: string | number | undefined): string => (x === undefined ? "" : String(x).trim());

const celula = (x: string | number | undefined): string => v(x).replace(/\|/g, "/").replace(/\s+/g, " ");

const rotulo = (nome: string, valor: string): string => `- **${nome}:** ${valor}`.trimEnd();

const listaPontos = (itens: readonly string[] | undefined): string =>
  (itens ?? []).map((i) => i.trim()).filter((i) => i.length > 0).join("; ");

const comStatus = (f: FatoResumo): string => {
  const texto = f.texto.trim();
  if (f.status === undefined) return texto;
  return `${texto} (${f.status === "CONFIRMADO" ? "confirmado" : "suspeito"})`;
};

const frase = (s: string): string => {
  const limpa = s.trim();
  if (limpa.length === 0) return "";
  return /[.!?]$/.test(limpa) ? limpa : `${limpa}.`;
};

const tnmClinicoTexto = (t: OncologicosResumo["tnmClinico"]): string => {
  if (!t) return "";
  return [t.cT && `cT${v(t.cT)}`, t.cN && `cN${v(t.cN)}`, t.cM && `cM${v(t.cM)}`].filter(Boolean).join(" ");
};

const tnmPatologicoTexto = (t: OncologicosResumo["tnmPatologico"]): string => {
  if (!t) return "";
  return [t.pT && `pT${v(t.pT)}`, t.pN && `pN${v(t.pN)}`].filter(Boolean).join(" ");
};

const tnmPosTexto = (t: OncologicosResumo["tnmPosNeoadjuvancia"]): string => {
  if (!t) return "";
  return [t.ypT && `ypT${v(t.ypT)}`, t.ypN && `ypN${v(t.ypN)}`].filter(Boolean).join(" ");
};

const cabecalho = (e: EntradaResumoLongitudinal): string[] => {
  const id = e.identificacao ?? {};
  const onc = e.oncologicos ?? {};
  const idade = v(id.idade);
  const linha2 = [
    `# ${v(id.nome)} — DN: ${v(id.dn)}${idade ? ` (${idade} ANOS)` : ""} — ${v(id.cidadeUf)}`.trimEnd(),
  ];
  const tnmParte = tnmClinicoTexto(onc.tnmClinico) || tnmPatologicoTexto(onc.tnmPatologico);
  const linha3 = `# ${[v(onc.diagnostico), tnmParte, v(onc.estadio), v(onc.biomarcadores)].join(" — ")}`.trimEnd();
  return ["# TEMPLATE PADRÃO — RESUMO ONCOLÓGICO LONGITUDINAL", ...linha2, linha3];
};

const anagraficos = (e: EntradaResumoLongitudinal): string[] => {
  const a = e.anagraficos ?? {};
  const id = e.identificacao ?? {};
  const dnIdade = [v(id.dn), v(id.idade) && `(${v(id.idade)} anos)`].filter(Boolean).join(" ");
  return [
    rotulo("Nome", v(id.nome)),
    rotulo("DN / idade", dnIdade),
    rotulo("Sexo", v(a.sexo)),
    rotulo("Cidade de origem / residência", v(a.cidadeOrigem)),
    rotulo("Acompanhante", v(a.acompanhante)),
    rotulo("Profissão", v(a.profissao)),
  ];
};

const resumoOperacional = (e: EntradaResumoLongitudinal): string => {
  const op = e.operacional ?? {};
  const onc = e.oncologicos ?? {};
  const dx = v(onc.diagnostico);
  const tnm = tnmClinicoTexto(onc.tnmClinico) || tnmPatologicoTexto(onc.tnmPatologico);
  const bio = v(onc.biomarcadores);
  const trat = v(op.tratamentoAtual);
  const contexto = [dx && `**${dx}**`, tnm, v(onc.estadio), bio].filter(Boolean);
  const partes: string[] = [];
  if (contexto.length > 0) partes.push(`Paciente com ${contexto.join(", ")}`);
  if (trat) partes.push(`${partes.length > 0 ? "atualmente em" : "Atualmente em"} **${trat}**`);
  const base = partes.length > 0 ? `${partes.join(", ")}.` : "";
  const resposta = v(op.resposta);
  const problemas = v(op.problemasAtivos);
  const proximo = v(op.proximoPasso);
  return [
    base,
    resposta ? `Última avaliação demonstra **${frase(resposta).replace(/\.$/, "")}**.` : "",
    problemas ? `Problemas ativos: ${frase(problemas)}` : "",
    proximo ? `Próximo passo: ${frase(proximo)}` : "",
  ]
    .filter((p) => p.length > 0)
    .join(" ");
};

const clinicos = (e: EntradaResumoLongitudinal): string[] => {
  const c = e.clinicos ?? {};
  return [
    rotulo("ECOG", v(c.ecog)),
    rotulo("KPS", v(c.kps)),
    rotulo("AP", v(c.ap)),
    rotulo("MED", v(c.medicacoesContinuas)),
    rotulo("ALERGIA", listaPontos((e.alergias ?? []).map((a) => resumoAlergia(a)))),
    rotulo("CX PRÉVIAS", v(c.cirurgiasPrevias)),
    rotulo("HF", v(c.historiaFamiliar)),
    rotulo("VACINAS", v(c.vacinas)),
    rotulo("HÁBITOS DE VIDA", v(c.habitosVida)),
    rotulo("Peso / altura / SC", v(c.pesoAlturaSc)),
    rotulo("Função renal/hepática relevante", v(c.funcaoRenalHepatica)),
  ];
};

const oncologicos = (e: EntradaResumoLongitudinal): string[] => {
  const o = e.oncologicos ?? {};
  const sitios = (o.sitiosMetastaticos ?? []).map(comStatus).join("; ");
  return [
    rotulo("Diagnóstico", v(o.diagnostico)),
    rotulo("Sítio primário", v(o.sitioPrimario)),
    rotulo("Lateralidade / subsítio", v(o.lateralidadeSubsitio)),
    rotulo("Histologia / grau", v(o.histologiaGrau)),
    rotulo("TNM clínico", tnmClinicoTexto(o.tnmClinico)),
    rotulo("TNM patológico", tnmPatologicoTexto(o.tnmPatologico)),
    rotulo("Pós-neoadjuvância", tnmPosTexto(o.tnmPosNeoadjuvancia)),
    rotulo("Estádio", v(o.estadio)),
    rotulo("Biomarcadores", v(o.biomarcadores)),
    rotulo("Sítios metastáticos", sitios),
    rotulo("Intenção atual", v(o.intencaoAtual)),
    rotulo("Linha atual", v(o.linhaAtual)),
    rotulo("CID-10", v(o.cid10)),
  ];
};

const timeline = (e: EntradaResumoLongitudinal): string[] => {
  const linhas = (e.timeline ?? []).map((ev) => {
    const resumo = ev.status === undefined ? ev.resumo : `${ev.resumo} (${ev.status === "CONFIRMADO" ? "confirmado" : "suspeito"})`;
    return `| ${celula(ev.data)} | ${celula(ev.exame)} | ${celula(resumo)} |`;
  });
  return [
    "| DATA | EXAME / EVENTO | RESUMO ONCOLÓGICO |",
    "|---|---|---|",
    ...linhas,
    "",
    "**Regra:** preservar medidas, datas e linguagem da fonte. `Suspeito ≠ confirmado`.",
  ];
};

const laboratorio = (e: EntradaResumoLongitudinal): string[] => {
  const lab = e.laboratorio ?? {};
  const linhas = (lab.linhas ?? []).map(
    (l) =>
      `| ${celula(l.data)} | ${celula(l.hb)} | ${celula(l.anc)} | ${celula(l.plaq)} | ${celula(l.crClCr)} | ${celula(l.tgoTgp)} | ${celula(l.bt)} | ${celula(l.marcador)} | ${celula(l.outros)} |`,
  );
  // Tendência só com pelo menos duas medidas do mesmo marcador.
  const tendencias = (lab.series ?? [])
    .filter((s) => s.medidas.length >= 2)
    .map((s) => `- ${s.nome.trim()}: ${s.medidas.map((m) => `${celula(m.valor)} (${celula(m.data)})`).join(" → ")}`);
  return [
    "| DATA | Hb | ANC | Plaq | Cr/ClCr | TGO/TGP | BT | MARCADOR | OUTROS |",
    "|---|---:|---:|---:|---:|---:|---:|---|---|",
    ...linhas,
    "",
    "**Tendências relevantes:**",
    ...tendencias,
  ];
};

const tratamento = (e: EntradaResumoLongitudinal): string[] => {
  const t = e.tratamento ?? {};
  return [
    rotulo("Protocolo", v(t.protocolo)),
    rotulo("Fármacos", v(t.farmacos)),
    rotulo("Dose", v(t.dose)),
    rotulo("Ciclo/Dia", v(t.cicloDia)),
    rotulo("Intenção", v(t.intencao)),
    rotulo("Início", v(t.inicio)),
    rotulo("Status", v(t.status)),
    rotulo("Resposta", v(t.resposta)),
  ];
};

const ctcae = (e: EntradaResumoLongitudinal): string[] => {
  const linhas = (e.ctcae ?? []).map(
    (t) => `| ${celula(t.toxicidade)} | ${celula(t.grau)} | ${celula(t.inicio)} | ${celula(t.status)} | ${celula(t.impactoConduta)} |`,
  );
  return [
    "| TOXICIDADE | GRAU | INÍCIO | STATUS | IMPACTO / CONDUTA |",
    "|---|---:|---|---|---|",
    ...linhas,
    "",
    "**Não atribuir grau CTCAE sem elementos suficientes.**",
  ];
};

const resumoAlergia = (a: AlergiaResumo): string => {
  const sub = a.substancia.trim();
  const reacao = v(a.reacao);
  return reacao ? `${sub} — ${reacao}` : sub;
};

const alergias = (e: EntradaResumoLongitudinal): string[] => {
  const itens = (e.alergias ?? []).map(resumoAlergia);
  return [
    ...itens.map((i) => `- ${i}`),
    "",
    `> **BLOCO DE SEGURANÇA — ALERGIAS:** ${listaPontos(itens)}`.trimEnd(),
  ];
};

const contraindicacoes = (e: EntradaResumoLongitudinal): string[] => {
  const c = e.contraindicacoes ?? {};
  const itens = listaPontos(c.itens);
  // "Nenhum identificado" só quando a avaliação foi efetivamente feita e nada foi encontrado.
  const contra = itens || (c.avaliado === true ? "Nenhum identificado" : "");
  return [
    rotulo("Contraindicações", contra),
    rotulo("Interações medicamentosas", v(c.interacoes)),
    rotulo("Comorbidade × tratamento", v(c.comorbidadeTratamento)),
    rotulo("Órgão vulnerável", v(c.orgaoVulneravel)),
    rotulo("Dose cumulativa relevante", v(c.doseCumulativa)),
    rotulo("Riscos específicos", v(c.riscosEspecificos)),
  ];
};

const conduta = (): string[] => [LINHA_CD, LINHA_CD, LINHA_CD];

const historico = (e: EntradaResumoLongitudinal): string[] => {
  const blocos = (e.historico ?? []).flatMap((ev) => {
    const periodo = ev.dataFim ? `${v(ev.data)} A ${v(ev.dataFim)}` : v(ev.data);
    return [`#### ${periodo} — ${v(ev.titulo)}:`, v(ev.texto)];
  });
  return blocos;
};

const iaFala = (e: EntradaResumoLongitudinal): string[] => {
  const ia = e.iaFala ?? {};
  return [
    rotulo("SUGESTÕES", listaPontos(ia.sugestoes)),
    rotulo("PENDÊNCIAS", listaPontos(ia.pendencias)),
    rotulo("ERROS / CONFLITOS", listaPontos(ia.errosConflitos)),
    rotulo("LACUNAS", listaPontos(ia.lacunas)),
    rotulo("PEARLS", listaPontos(ia.pearls)),
    rotulo("PITFALLS", listaPontos(ia.pitfalls)),
    rotulo("CAUTION", listaPontos(ia.caution)),
    rotulo("NÃO SEI", listaPontos(ia.naoSei)),
  ];
};

const estudos = (e: EntradaResumoLongitudinal): string[] =>
  (e.estudos ?? [])
    .filter((s) => v(s.fonte).length > 0 && v(s.texto).length > 0)
    .slice(0, MAX_ESTUDOS)
    .map((s, i) => `- **ESTUDO ${i + 1}** — ${v(s.texto)} (Fonte: ${v(s.fonte)})`);

const sus = (e: EntradaResumoLongitudinal): string[] => {
  const s = e.sus ?? {};
  const onc = e.oncologicos ?? {};
  const cid = v(s.cid10 ?? onc.cid10);
  const contexto = [v(onc.diagnostico), tnmClinicoTexto(onc.tnmClinico) || tnmPatologicoTexto(onc.tnmPatologico), v(onc.estadio), v(onc.biomarcadores)]
    .filter(Boolean)
    .join(" · ");
  return [
    `> **CID-10: ${cid} · SIGTAP: ${v(s.sigtap)} · FINALIDADE/ENQUADRAMENTO: ${v(s.finalidadeEnquadramento)} · PRIORIDADE: ${v(s.prioridade)}**`,
    rotulo("Contexto clínico (CID + diagnóstico/estágio/biomarcador)", contexto),
    rotulo("Protocolo disponível no SUS", v(s.protocoloSus)),
    rotulo("CONITEC/PCDT/Diretriz aplicável", v(s.conitecPcdtDiretriz)),
    rotulo("Elegibilidade", v(s.elegibilidade)),
    rotulo("Diferença evidência × SUS", v(s.diferencaEvidenciaSus)),
    rotulo("Pendência regulatória/APAC", v(s.pendenciaApac)),
    rotulo("Competência SIGTAP", v(s.competenciaSigtap)),
    rotulo("Fonte oficial/verificação", v(s.fonteOficial)),
    rotulo("Proveniência", v(s.proveniencia)),
  ];
};

interface SecaoResumo {
  titulo: string;
  corpo: readonly string[];
  soTela?: true;
}

function secoes(e: EntradaResumoLongitudinal): SecaoResumo[] {
  return [
    { titulo: "DADOS ANAGRÁFICOS / DEMOGRÁFICOS:", corpo: anagraficos(e) },
    { titulo: "RESUMO OPERACIONAL:", corpo: [resumoOperacional(e)] },
    { titulo: "DADOS CLÍNICOS:", corpo: clinicos(e) },
    { titulo: "DADOS ONCOLÓGICOS:", corpo: oncologicos(e) },
    { titulo: "TIMELINE ONCOLÓGICA:", corpo: timeline(e) },
    { titulo: "LABORATÓRIO / MARCADORES:", corpo: laboratorio(e) },
    { titulo: "TRATAMENTO ATUAL:", corpo: tratamento(e) },
    { titulo: "CTCAE / TOXICIDADES:", corpo: ctcae(e) },
    { titulo: "ALERGIAS:", corpo: alergias(e) },
    { titulo: "CONTRAINDICAÇÕES / INTERAÇÕES / RISCOS:", corpo: contraindicacoes(e) },
    { titulo: "CONDUTA — CD:", corpo: conduta() },
    { titulo: "HISTÓRICO ONCOLÓGICO PREGRESSO:", corpo: historico(e) },
    { titulo: "IA FALA — REVISÃO CLÍNICA:", corpo: iaFala(e), soTela: true },
    { titulo: "TRIALS / EVIDÊNCIAS APLICÁVEIS:", corpo: estudos(e) },
    { titulo: "SUS / CONITEC / APAC / SIGTAP:", corpo: sus(e) },
  ];
}

const REGRAS_SO_TELA = new Set([
  "**Regra:** preservar medidas, datas e linguagem da fonte. `Suspeito ≠ confirmado`.",
  "**Não atribuir grau CTCAE sem elementos suficientes.**",
]);

function montar(e: EntradaResumoLongitudinal, incluiIa: boolean): string {
  const blocos = secoes(e)
    .filter((s) => incluiIa || s.soTela !== true)
    // Regras do template são instrução de trabalho (tela), não conteúdo clínico: saem do documento.
    .map((s) => `### ${s.titulo}\n${s.corpo.filter((l) => incluiIa || !REGRAS_SO_TELA.has(l)).join("\n")}`.trimEnd());
  return [cabecalho(e).join("\n"), ...blocos].join("\n\n").trimEnd() + "\n";
}

/** Renderiza o resumo longitudinal (template PLN-031) em duas saídas: tela (com IA FALA) e documento (sem IA). */
export function renderizarResumoLongitudinal(entrada: EntradaResumoLongitudinal): ResumoLongitudinalRenderizado {
  return {
    paraTela: montar(entrada, true),
    paraDocumento: montar(entrada, false),
  };
}
