import type { CabecalhoVisao } from "../consulta/viewmodels.js";
import {
  estadoAlergias,
  idadeAnosEMeses,
  iniciais,
  linhasMatriculaCns,
  rotuloSexo,
  valorOuPendente,
} from "./cadastro.js";

// PROVISORIO-W10: trocar por src/contracts/w10/ quando o tech lead publicar o cartão Modelo 08.
export interface CadastroModelo08 {
  convenio: string | null;
  matricula: string | null;
  cns: string | null;
  dataHoraAtendimento: string | null;
  nascimento: string | null;
  profissao: string | null;
  mae: string | null;
  responsavel: string | null;
  cidadeUf: string | null;
  endereco: string | null;
  obs: string | null;
}

// PROVISORIO-W10: trocar por ClinicalFact / estágio versionado do contrato w10.
export interface DiagnosticoChart {
  cid: string | null;
  titulo: string | null;
  histologia: string | null;
  tnmPrefixo: string | null;
  t: string | null;
  n: string | null;
  m: string | null;
  estadio: string | null;
  ecog: number | null;
  biomarcadores: readonly { rotulo: string; fonte: string }[];
  stageHistory: readonly { em: string; estadio: string; tnm: string }[];
}

export interface CabecalhoChart {
  pacienteNome: string;
  iniciais: string;
  idade: string;
  sexo: string;
  prontuario: string;
  alergia: ReturnType<typeof estadoAlergias>;
  diagnosticoChip: string;
  diagnostico: DiagnosticoChart;
  cadastro: CadastroModelo08;
  cicloNumero: number | null;
}

function dadoTexto(d: { campo: string; valor: string | null }): string | null {
  if (d.campo === "PRESENTE" && d.valor) return d.valor;
  return null;
}

function idDe(paciente: CabecalhoVisao["paciente"], tipo: "CNS" | "PRONTUARIO"): string | null {
  return paciente.identificadores.find((i) => i.tipo === tipo)?.valor ?? null;
}

/** Monta a visão do OncoChart a partir do cabeçalho da porta + cadastro provisório. */
export function montarCabecalhoChart(
  cabecalho: CabecalhoVisao,
  cadastro: CadastroModelo08,
  extras?: { ecog?: number | null; biomarcadores?: DiagnosticoChart["biomarcadores"] },
): CabecalhoChart {
  const lote =
    cabecalho.lotes.find((l) => l.tumorLotId === cabecalho.loteSelecionadoId) ?? cabecalho.lotes[0] ?? null;
  const cid = lote ? dadoTexto(lote.cid) : null;
  const topo = lote ? dadoTexto(lote.topografia) : null;
  const histo = lote ? dadoTexto(lote.histologia) : null;
  const est = lote?.estadiamentos[0] ?? null;
  const nascimento = cadastro.nascimento ?? cabecalho.paciente.nascimento;
  const idade =
    nascimento != null ? (idadeAnosEMeses(nascimento, cabecalho.hoje) ?? "PENDENTE") : "PENDENTE";
  const cns = cadastro.cns ?? idDe(cabecalho.paciente, "CNS");

  return {
    pacienteNome: cabecalho.paciente.nome,
    iniciais: iniciais(cabecalho.paciente.nome),
    idade,
    sexo: rotuloSexo(cabecalho.paciente.sexoCadastral),
    prontuario: idDe(cabecalho.paciente, "PRONTUARIO") ?? "PENDENTE",
    alergia: estadoAlergias(cabecalho.alergiasPaciente),
    diagnosticoChip: topo ?? cid ?? "PENDENTE",
    diagnostico: {
      cid,
      titulo: topo,
      histologia: histo,
      tnmPrefixo: est?.prefixo ?? null,
      t: est?.T ?? null,
      n: est?.N ?? null,
      m: est?.M ?? null,
      estadio: est?.grupo ?? null,
      ecog: extras?.ecog ?? null,
      biomarcadores: extras?.biomarcadores ?? [],
      stageHistory: (lote?.estadiamentos ?? []).map((e) => ({
        em: e.data,
        estadio: e.grupo ?? "PENDENTE",
        tnm: `${e.prefixo}${e.T ?? "?"}${e.N ?? "?"}${e.M ?? "?"}`,
      })),
    },
    cadastro: {
      ...cadastro,
      nascimento,
      cns,
      matricula: cadastro.matricula ?? cns,
    },
    cicloNumero: cabecalho.ciclo?.numero ?? null,
  };
}

/** Ordem do Modelo 08. */
export function linhasCartaoModelo08(chart: CabecalhoChart): readonly { rotulo: string; valor: string }[] {
  const linhas: { rotulo: string; valor: string }[] = [
    { rotulo: "Nome", valor: valorOuPendente(chart.pacienteNome) },
    { rotulo: "Convênio", valor: valorOuPendente(chart.cadastro.convenio) },
    { rotulo: "Prontuário", valor: valorOuPendente(chart.prontuario) },
  ];
  const ids = linhasMatriculaCns(chart.cadastro.matricula, chart.cadastro.cns);
  if (ids.length === 0) linhas.push({ rotulo: "Matrícula / CNS", valor: "PENDENTE" });
  else for (const linha of ids) linhas.push({ rotulo: linha.chave, valor: linha.valor });
  linhas.push(
    { rotulo: "Data/Hora", valor: valorOuPendente(chart.cadastro.dataHoraAtendimento) },
    { rotulo: "Nascimento", valor: valorOuPendente(chart.cadastro.nascimento) },
    { rotulo: "Idade", valor: chart.idade },
    { rotulo: "Sexo", valor: chart.sexo === "PENDENTE" ? "PENDENTE" : chart.sexo },
    { rotulo: "Profissão", valor: valorOuPendente(chart.cadastro.profissao) },
    { rotulo: "Mãe", valor: valorOuPendente(chart.cadastro.mae) },
    { rotulo: "Responsável", valor: valorOuPendente(chart.cadastro.responsavel) },
    { rotulo: "Cidade", valor: valorOuPendente(chart.cadastro.cidadeUf) },
    { rotulo: "Endereço", valor: valorOuPendente(chart.cadastro.endereco) },
    { rotulo: "Obs", valor: valorOuPendente(chart.cadastro.obs) },
  );
  return linhas;
}
