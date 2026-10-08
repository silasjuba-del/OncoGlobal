// W11-H21 · contrato do cadastro de check-in (promovido de src/apac/campos.ts). Só dados; todos os campos são OPCIONAIS.
// Ausente ou inválido = PENDENTE no leitor da APAC. Nada aqui é inferido.
import { z } from "zod";

const texto = z.string().nullable().optional();

export const CadastroCheckinSchema = z.object({
  revisao: z.enum(["RASCUNHO", "CONFIRMADO", "ASSINADO"]).optional(),
  prontuario: texto,
  cns: texto,
  nome: texto,
  nascimento: texto, // AAAA-MM-DD
  sexo: texto, // "M" | "F"
  racaCor: texto,
  etnia: texto, // só lida quando racaCor === INDIGENA
  mae: texto,
  telefones: z.array(z.string()).nullable().optional(),
  responsavel: z.object({ nome: texto, telefone: texto }).nullable().optional(),
  endereco: texto,
  municipio: texto,
  uf: texto,
  cep: texto,
});

export type CadastroCheckin = z.infer<typeof CadastroCheckinSchema>;
