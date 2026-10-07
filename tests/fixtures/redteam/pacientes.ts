// Fixtures SINTÉTICAS de pacientes para o red team W10-GLM (RT-01/RT-02).
// Só "Paciente Teste NN"; CNS/CPF com DV INVÁLIDO de propósito; datas 2029–2031.
// PT07 e PT09 são homônimos parciais (mesmo primeiro nome, mesma idade, mesmo tumor).
import type { Paciente } from "../../../src/contracts/clinico.js";
import type { RegistryPatient } from "../../../src/kernel/extracao/patient-resolver.js";

/** CNS sintético com DV inválido (soma ponderada 15..1 não é múltiplo de 11). */
export const CNS_INVALIDO_PT07 = "700000000000001";
/** CNS sintético com DV inválido, do outro homônimo. */
export const CNS_INVALIDO_PT09 = "700000000000002";
/** CPF sintético com DV inválido de propósito (DV dado por módulo 11 não confere). */
export const CPF_INVALIDO = "11144477700";

export const pacientePt07Registry: RegistryPatient = {
  patientId: "Paciente Teste 07",
  name: "Maria Alves de Souza",
  age: 54,
  sex: "feminino",
  tumor: "mama",
  laterality: "direita",
  protocol: "carbo-taxol",
  biomarker: "RE positivo",
  eventDate: "2030-01-10",
  mother: "Joana Souza",
  birthDate: "1976-03-04",
  cns: CNS_INVALIDO_PT07,
  matricula: "MAT-0007",
};

/** Homônimo: mesmo primeiro nome, mesma idade, mesmo tumor; mãe/CNS/lateralidade diferentes. */
export const pacientePt09Registry: RegistryPatient = {
  patientId: "Paciente Teste 09",
  name: "Maria Alves de Oliveira",
  age: 54,
  sex: "feminino",
  tumor: "mama",
  laterality: "esquerda",
  protocol: "carbo-taxol",
  biomarker: "RE positivo",
  eventDate: "2030-01-10",
  mother: "Joana Oliveira",
  birthDate: "1976-03-04",
  cns: CNS_INVALIDO_PT09,
  matricula: "MAT-0009",
};

/** Paciente Teste 08 (laudos de crânio/abdome em docs/referencias/modelos/laudos-sinteticos). */
export const pacientePt08Registry: RegistryPatient = {
  patientId: "Paciente Teste 08",
  name: "Paciente Teste 08",
  age: 77,
  sex: "feminino",
  tumor: "pulmao",
};

/** Cadastro no formato do contrato C-05 (resolverIdentidade), sempre com DV inválido. */
export const cadastroHomônimos: readonly Paciente[] = [
  {
    patientId: "Paciente Teste 07",
    identificadores: [{ tipo: "CNS", valor: CNS_INVALIDO_PT07 }],
    nome: "Maria Alves de Souza",
    nascimento: "1976-03-04",
    sexoCadastral: "F",
    divergencia: false,
  },
  {
    patientId: "Paciente Teste 09",
    identificadores: [{ tipo: "CNS", valor: CNS_INVALIDO_PT09 }],
    nome: "Maria Alves de Oliveira",
    nascimento: "1976-03-04",
    sexoCadastral: "F",
    divergencia: false,
  },
];

export const pacientesRegistro = [
  pacientePt07Registry,
  pacientePt08Registry,
  pacientePt09Registry,
] as const;
