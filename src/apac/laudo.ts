// W10-INT-APAC-04 · Preenchimento do laudo APAC (D-W5-06, D-W9-19).
// Solicitação (página 1) e dados complementares (página 2), só de dado confirmado; AUTORIZAÇÃO fica em branco; ausente = PENDENTE.
// A finalidade é transportada como o médico escolheu (D-W9-12), nunca deduzida. Sem tradução de vocabulário: só deslocamento de dado.
import type { Apac } from "../contracts/operacao.js";
import { lerCampo, lerSecundarios, lerTexto } from "./campos.js";
import { buscarProcedimento, normalizarCodigoProc, type TabelasSigtap } from "./sigtap.js";

export type CampoLaudo = { estado: "PREENCHIDO"; valor: string } | { estado: "PENDENTE"; motivo: string };

/** Campos da SOLICITAÇÃO do laudo (docs/referencias/apac-laudo-campos.txt): chave do app -> rótulo impresso. */
export const CAMPOS_SOLICITACAO: Readonly<Record<string, string>> = {
  nomeEstabelecimento: "NOME DO ESTABELECIMENTO DE SAÚDE SOLICITANTE",
  cnesSolicitante: "CNES",
  numeroProntuario: "Nº DO PRONTUÁRIO",
  pacienteCns: "CARTÃO NACIONAL DE SAÚDE (CNS)",
  pacienteNome: "NOME DO PACIENTE",
  pacienteNascimento: "DATA DE NASCIMENTO",
  pacienteSexo: "SEXO",
  racaCor: "RAÇA/COR",
  etnia: "ETNIA",
  nomeMae: "NOME DA MÃE",
  telefoneContato: "TELEFONE DE CONTATO",
  nomeResponsavel: "NOME DO RESPONSÁVEL",
  telefoneResponsavel: "TELEFONE DO RESPONSÁVEL",
  endereco: "ENDEREÇO (RUA, Nº, BAIRRO)",
  municipioResidencia: "MUNICÍPIO DE RESIDÊNCIA",
  codIbgeMunicipio: "CÓD. IBGE MUNICÍPIO",
  uf: "UF",
  cep: "CEP",
  procedimentoPrincipal: "CÓDIGO DO PROCEDIMENTO PRINCIPAL",
  quantidadePrincipal: "QTDE. (PRINCIPAL)",
  descricaoDiagnostico: "DESCRIÇÃO DO DIAGNÓSTICO",
  cidPrincipal: "CID10 PRINCIPAL",
  cidSecundario: "CID10 SECUNDÁRIO",
  cidCausasAssociadas: "CID10 CAUSAS ASSOCIADAS",
  justificativa: "JUSTIFICATIVA DO(S) PROCEDIMENTO(S) SOLICITADO(S)",
  observacoes: "OBSERVAÇÕES",
  solicitanteNome: "NOME DO PROFISSIONAL SOLICITANTE",
  solicitanteCns: "CARTÃO NACIONAL DE SAÚDE DO PROFISSIONAL SOLICITANTE",
  dataSolicitacao: "DATA DA SOLICITAÇÃO",
};

/** Campos da AUTORIZAÇÃO: sempre em branco (preenchidos pelo órgão autorizador). */
export const CAMPOS_AUTORIZACAO: readonly string[] = [
  "NOME DO PROFISSIONAL AUTORIZADOR", "CÓD. ÓRGÃO EMISSOR", "Nº DA AUTORIZAÇÃO (APAC)", "DATA DA AUTORIZAÇÃO",
  "CARTÃO NACIONAL DE SAÚDE DO PROFISSIONAL AUTORIZADOR", "ASSINATURA E CARIMBO (AUTORIZADOR)",
  "NOME FANTASIA DO ESTABELECIMENTO DE SAÚDE EXECUTANTE", "CNES (EXECUTANTE)", "PERÍODO DE VALIDADE DA APAC",
  "Nº DE MESES AUTORIZADOS",
];

export const MAX_SECUNDARIOS = 5;

/** Máximo de linhas de tratamento anterior impressas (QT e RT): uma por esquema/linha, nunca por ciclo. */
export const MAX_LINHAS_ANTERIORES = 3;

const linhasAnteriores = (prefixo: string, tipo: string): [string, string][] =>
  Array.from({ length: MAX_LINHAS_ANTERIORES }, (_, i) => i + 1).flatMap((n): [string, string][] => [
    [`${prefixo}${n}Descricao`, `${n}º ${tipo} · DESCRIÇÃO`],
    [`${prefixo}${n}DataInicio`, `${n}º ${tipo} · DATA DE INÍCIO`],
  ]);

/** Página 2, ONCOLOGIA (caixas 56–64). */
const ONCOLOGIA: [string, string][] = [
  ["localizacaoTumorPrimario", "LOCALIZAÇÃO DO TUMOR PRIMÁRIO"],
  ["cidTopografia", "CID-10 TOPOGRAFIA"],
  ["linfonodosRegionaisInvadidos", "LINFONODOS REGIONAIS INVADIDOS (SIM/NÃO)"],
  ["localizacaoMetastases", "LOCALIZAÇÃO DE METÁSTASE(S)"],
  ["estadioUicc", "ESTÁDIO (UICC)"],
  ["estadioOutroSistema", "ESTÁDIO (OUTRO SISTEMA)"],
  ["grauHistopatologico", "GRAU HISTOPATOLÓGICO"],
  ["diagnosticoCitoHistopatologico", "DIAGNÓSTICO CITO/HISTOPATOLÓGICO"],
  ["dataDiagnosticoCitoHistopatologico", "DATA DO DIAGNÓSTICO CITO/HISTOPATOLÓGICO"],
];
/** Página 2, QUIMIOTERAPIA (caixas 65–72; a 72 é do autorizador e fica fora deste mapa). */
const QUIMIOTERAPIA: [string, string][] = [
  ["qtTratamentoAnterior", "TRATAMENTO(S) ANTERIOR(ES) · QUIMIOTERAPIA (SIM/NÃO)"],
  ...linhasAnteriores("qtAnterior", "TRATAMENTO ANTERIOR (QT)"),
  ["qtContinuidade", "CONTINUIDADE DO TRATAMENTO (SIM/NÃO)"],
  ["qtDataInicio", "DATA DE INÍCIO DO TRATAMENTO SOLICITADO"],
  ["qtEsquema", "ESQUEMA"],
  ["qtMesesPlanejados", "Nº DE MESES PLANEJADOS"],
];
/** Página 2, RADIOTERAPIA (caixas 73–83). Só entra no laudo quando há RT solicitada. */
const RADIOTERAPIA: [string, string][] = [
  ["rtTratamentoAnterior", "TRATAMENTO(S) ANTERIOR(ES) · RADIOTERAPIA (SIM/NÃO)"],
  ...linhasAnteriores("rtAnterior", "TRATAMENTO ANTERIOR (RT)"),
  ["rtContinuidade", "CONTINUIDADE DO TRATAMENTO (SIM/NÃO)"],
  ["rtDataInicioSolicitado", "DATA DE INÍCIO DO TRATAMENTO SOLICITADO"],
  ["rtFinalidade", "FINALIDADE (ESCOLHA DO MÉDICO)"],
  ["rtCidTopografico", "CID-10 TOPOGRAFIA (RADIOTERAPIA)"],
  ["rtDescricaoArea", "DESCRIÇÃO DA ÁREA IRRADIADA"],
  ["rtNumeroCampos", "Nº DE CAMPOS/INSERÇÕES"],
  ["rtDataInicio", "DATA DE INÍCIO (PLANEJAMENTO)"],
  ["rtDataTermino", "DATA DE TÉRMINO"],
];

/** Blocos da página 2 na ordem impressa. NEFROLOGIA (84–85) não se aplica à oncologia: sempre em branco. */
export const BLOCOS_COMPLEMENTARES: readonly { titulo: string; chaves: readonly string[] }[] = [
  { titulo: "ONCOLOGIA", chaves: ONCOLOGIA.map(([c]) => c) },
  { titulo: "QUIMIOTERAPIA", chaves: QUIMIOTERAPIA.map(([c]) => c) },
  { titulo: "RADIOTERAPIA", chaves: RADIOTERAPIA.map(([c]) => c) },
  { titulo: "NEFROLOGIA", chaves: [] },
];

/** Dados complementares (página 2): chave do app -> rótulo impresso. */
export const CAMPOS_COMPLEMENTARES: Readonly<Record<string, string>> = Object.fromEntries([...ONCOLOGIA, ...QUIMIOTERAPIA, ...RADIOTERAPIA]);

/** Campos Sim/Não: o valor confirmado é transportado como veio; só a leitura da resposta é normalizada. */
const CHAVES_SIM_NAO = new Set(["linfonodosRegionaisInvadidos", "qtTratamentoAnterior", "qtContinuidade", "rtTratamentoAnterior", "rtContinuidade"]);
const CHAVES_RT_SEM_SOLICITACAO = RADIOTERAPIA.map(([c]) => c);

const semAcento = (s: string): string => s.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase().trim();

export interface LaudoApac {
  apacId: string;
  competencia: string;
  solicitacao: Record<string, CampoLaudo>;
  procedimentoPrincipalNome: CampoLaudo;
  secundarios: { codigo: string; nome: CampoLaudo; qtde: number }[];
  /** Escolha do médico, transportada como veio (não é caixa do laudo impresso; vai ao registro SIA). */
  finalidadeApac: CampoLaudo;
  /** Página 2: campos com valor confirmado ou PENDENTE. */
  complementares: Record<string, CampoLaudo>;
  /** Página 2: caixas vazias por regra (RT sem solicitação), que não contam como pendência. */
  naoAplicavel: string[];
  autorizacao: Record<string, "EM_BRANCO">;
  assinaturaSolicitante: "EM_BRANCO"; // o médico assina e carimba
  pendentes: string[]; // rótulos PENDENTES (páginas 1 e 2), para a tela de revisão
}

function texto(campos: Record<string, unknown>, chave: string): CampoLaudo {
  const l = lerCampo(campos, chave);
  if (l.estado === "PENDENTE") return { estado: "PENDENTE", motivo: l.motivo };
  const v = l.valor;
  return typeof v === "string" || typeof v === "number" ? { estado: "PREENCHIDO", valor: String(v) } : { estado: "PENDENTE", motivo: "tipo inesperado" };
}

/** Resposta Sim/Não: reconhecida vira PREENCHIDO com o valor como veio; qualquer outra coisa é PENDENTE. */
function simNao(campos: Record<string, unknown>, chave: string): CampoLaudo {
  const c = texto(campos, chave);
  if (c.estado === "PENDENTE") return c;
  const r = semAcento(c.valor);
  return r === "SIM" || r === "NAO" ? c : { estado: "PENDENTE", motivo: "resposta Sim/Não não reconhecida" };
}

/** Uma linha por esquema anterior: ciclos com o mesmo esquema colapsam; a data é a da primeira ocorrência. */
function linhasHistorico(campos: Record<string, unknown>, chave: string): { descricao: string; dataInicio: string }[] {
  const l = lerCampo(campos, chave);
  if (l.estado !== "PRESENTE" || !Array.isArray(l.valor)) return [];
  const vistos = new Set<string>();
  const out: { descricao: string; dataInicio: string }[] = [];
  for (const x of l.valor) {
    if (!x || typeof x !== "object") continue;
    const esquema = (x as { esquema?: unknown }).esquema;
    const inicio = (x as { dataInicio?: unknown }).dataInicio;
    if (typeof esquema !== "string" || esquema.trim() === "" || vistos.has(esquema.trim())) continue;
    vistos.add(esquema.trim());
    out.push({ descricao: esquema.trim(), dataInicio: typeof inicio === "string" || typeof inicio === "number" ? String(inicio) : "" });
  }
  return out.slice(0, MAX_LINHAS_ANTERIORES);
}

export function preencherLaudo(apac: Apac, sigtap: TabelasSigtap): LaudoApac {
  const campos = apac.campos;
  const solicitacao: Record<string, CampoLaudo> = {};
  const pendentes: string[] = [];
  const raca = lerCampo(campos, "racaCor");
  const indigena = raca.estado === "PRESENTE" && typeof raca.valor === "string" && semAcento(raca.valor) === "INDIGENA";
  for (const [chave, rotulo] of Object.entries(CAMPOS_SOLICITACAO)) {
    const c = texto(campos, chave);
    // Etnia só se aplica a paciente indígena: fora disso a caixa fica vazia por regra, sem virar pendência.
    if (chave === "etnia" && !indigena && c.estado === "PENDENTE") { solicitacao[chave] = { estado: "PENDENTE", motivo: "não se aplica (paciente não indígena)" }; continue; }
    solicitacao[chave] = c;
    if (c.estado === "PENDENTE") pendentes.push(rotulo);
  }
  const nomeProc = (codigo: string | null): CampoLaudo => {
    if (!codigo) return { estado: "PENDENTE", motivo: "procedimento ausente" };
    const r = buscarProcedimento(sigtap, apac.competencia, codigo);
    return r.achou ? { estado: "PREENCHIDO", valor: r.proc.nome }
      : { estado: "PENDENTE", motivo: r.motivo === "COMPETENCIA_SEM_TABELA" ? "sem tabela SIGTAP da competência" : "procedimento não encontrado na competência" };
  };
  const nomePrincipal = nomeProc(lerTexto(campos, "procedimentoPrincipal"));
  if (nomePrincipal.estado === "PENDENTE") pendentes.push("NOME DO PROCEDIMENTO PRINCIPAL");
  const secundarios = lerSecundarios(campos).slice(0, MAX_SECUNDARIOS).map((s) => ({
    codigo: normalizarCodigoProc(s.codigo), nome: nomeProc(s.codigo), qtde: s.qtde,
  }));
  const finalidadeApac = texto(campos, "finalidadeApac");
  if (finalidadeApac.estado === "PENDENTE") pendentes.push("FINALIDADE (escolha do médico)");

  // Página 2: cada caixa recebe PREENCHIDO ou PENDENTE; caixas vazias por regra vão para naoAplicavel.
  const complementares: Record<string, CampoLaudo> = {};
  const naoAplicavel: string[] = [];
  const registrar = (chave: string, c: CampoLaudo): void => {
    complementares[chave] = c;
    if (c.estado === "PENDENTE") pendentes.push(CAMPOS_COMPLEMENTARES[chave] ?? chave);
  };
  const campoSimples = (chave: string): void => registrar(chave, CHAVES_SIM_NAO.has(chave) ? simNao(campos, chave) : texto(campos, chave));
  // Linhas de tratamento anterior: dependem da resposta Sim/Não. Sem resposta, ficam PENDENTE.
  const linhas = (prefixo: string, historico: string, resposta: CampoLaudo): void => {
    const entradas = linhasHistorico(campos, historico);
    const d = (n: number): string => `${prefixo}${n}Descricao`;
    const i = (n: number): string => `${prefixo}${n}DataInicio`;
    for (let n = 1; n <= MAX_LINHAS_ANTERIORES; n++) {
      if (resposta.estado === "PENDENTE") { registrar(d(n), resposta); registrar(i(n), resposta); continue; }
      const resp = semAcento(resposta.valor);
      const entrada = entradas[n - 1];
      if (resp === "NAO" || (!entrada && n > 1)) { naoAplicavel.push(d(n), i(n)); continue; }
      if (!entrada) {
        registrar(d(n), { estado: "PENDENTE", motivo: "sem histórico informado" });
        registrar(i(n), { estado: "PENDENTE", motivo: "sem histórico informado" });
        continue;
      }
      registrar(d(n), { estado: "PREENCHIDO", valor: entrada.descricao });
      registrar(i(n), entrada.dataInicio ? { estado: "PREENCHIDO", valor: entrada.dataInicio } : { estado: "PENDENTE", motivo: "data ausente" });
    }
  };

  for (const [chave] of ONCOLOGIA) campoSimples(chave);

  const qtAnterior = simNao(campos, "qtTratamentoAnterior");
  registrar("qtTratamentoAnterior", qtAnterior);
  linhas("qtAnterior", "historicoQuimioterapia", qtAnterior);
  for (const chave of ["qtContinuidade", "qtDataInicio", "qtEsquema", "qtMesesPlanejados"]) campoSimples(chave);

  // RT só existe se solicitada: sem solicitação, o bloco inteiro fica vazio e não é pendência.
  const rt = lerCampo(campos, "radioterapiaSolicitada");
  const rtSolicitada = rt.estado === "PRESENTE" && (rt.valor === true || (typeof rt.valor === "string" && semAcento(rt.valor) === "SIM"));
  if (!rtSolicitada) {
    naoAplicavel.push(...CHAVES_RT_SEM_SOLICITACAO);
  } else {
    const rtAnterior = simNao(campos, "rtTratamentoAnterior");
    registrar("rtTratamentoAnterior", rtAnterior);
    linhas("rtAnterior", "historicoRadioterapia", rtAnterior);
    for (const chave of ["rtContinuidade", "rtDataInicioSolicitado", "rtFinalidade", "rtCidTopografico", "rtDescricaoArea", "rtNumeroCampos", "rtDataInicio", "rtDataTermino"]) {
      campoSimples(chave);
    }
  }

  return {
    apacId: apac.apacId, competencia: apac.competencia, solicitacao, procedimentoPrincipalNome: nomePrincipal,
    secundarios, finalidadeApac, complementares, naoAplicavel,
    autorizacao: Object.fromEntries(CAMPOS_AUTORIZACAO.map((c) => [c, "EM_BRANCO" as const])),
    assinaturaSolicitante: "EM_BRANCO", pendentes,
  };
}
