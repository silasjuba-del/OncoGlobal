import type { CadastroModelo08 } from "./chart-visao.js";

/** Cadastro sintético Modelo 08. CNS/matrícula com DV inválido de propósito. */
export function cadastroSintetico(patientId: string, nascimento: string | null): CadastroModelo08 {
  const digito = patientId.replace(/\D/g, "").slice(-2) || "00";
  const cns = `7000000000000${digito.padStart(2, "0")}`.slice(0, 15);
  if (patientId.includes("pendente")) {
    return {
      convenio: "SUS BPA",
      matricula: null,
      cns: null,
      dataHoraAtendimento: null,
      nascimento,
      profissao: null,
      mae: null,
      responsavel: "SEM INFORMACAO",
      cidadeUf: null,
      endereco: null,
      obs: null,
    };
  }
  return {
    convenio: "SUS BPA",
    matricula: cns,
    cns,
    dataHoraAtendimento: "2026-10-06T08:00:00-03:00",
    nascimento,
    profissao: "aposentado sintético",
    mae: "Mãe Sintética",
    responsavel: "SEM INFORMACAO",
    cidadeUf: "Cidade Teste · UF",
    endereco: "Rua Sintética, 0",
    obs: null,
  };
}
