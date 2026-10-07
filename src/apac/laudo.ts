// W10-INT-APAC-04 · Preenchimento do laudo APAC (D-W5-06, D-W9-19).
// Só a parte SOLICITAÇÃO, só de dado confirmado; AUTORIZAÇÃO fica em branco; ausente = PENDENTE.
// A finalidade é transportada como o médico escolheu (D-W9-12), nunca deduzida.
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
];

export const MAX_SECUNDARIOS = 5;

export interface LaudoApac {
  apacId: string;
  competencia: string;
  solicitacao: Record<string, CampoLaudo>;
  procedimentoPrincipalNome: CampoLaudo;
  secundarios: { codigo: string; nome: CampoLaudo; qtde: number }[];
  /** Escolha do médico, transportada como veio (não é caixa do laudo impresso; vai ao registro SIA). */
  finalidadeApac: CampoLaudo;
  autorizacao: Record<string, "EM_BRANCO">;
  assinaturaSolicitante: "EM_BRANCO"; // o médico assina e carimba
  pendentes: string[]; // rótulos PENDENTES, para a tela de revisão
}

function texto(campos: Record<string, unknown>, chave: string): CampoLaudo {
  const l = lerCampo(campos, chave);
  if (l.estado === "PENDENTE") return { estado: "PENDENTE", motivo: l.motivo };
  const v = l.valor;
  return typeof v === "string" || typeof v === "number" ? { estado: "PREENCHIDO", valor: String(v) } : { estado: "PENDENTE", motivo: "tipo inesperado" };
}

export function preencherLaudo(apac: Apac, sigtap: TabelasSigtap): LaudoApac {
  const campos = apac.campos;
  const solicitacao: Record<string, CampoLaudo> = {};
  const pendentes: string[] = [];
  for (const [chave, rotulo] of Object.entries(CAMPOS_SOLICITACAO)) {
    const c = texto(campos, chave);
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
  return {
    apacId: apac.apacId, competencia: apac.competencia, solicitacao, procedimentoPrincipalNome: nomePrincipal,
    secundarios, finalidadeApac,
    autorizacao: Object.fromEntries(CAMPOS_AUTORIZACAO.map((c) => [c, "EM_BRANCO" as const])),
    assinaturaSolicitante: "EM_BRANCO", pendentes,
  };
}
