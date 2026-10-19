import {z} from 'zod';
const texto=z.string().min(1);
export const ReferenciaPropostaDose=z.object({receitaId:texto,propostaId:texto,hashFonte:texto,hashProposta:texto}).strict();
export const PropostaDoseReceita=z.object({id:texto,medicamento:texto,dose:texto,doseOriginal:texto,unidade:texto,via:texto.nullable(),orientacao:texto.nullable(),duracao:texto.nullable(),
 indicacao:texto,restricoes:z.array(texto),estado:z.literal('PROPOSTA'),requerValidacaoMedica:z.literal(true),
 fonte:z.object({arquivo:texto,versao:texto,hash:texto,localizador:texto,referencia:texto,trecho:texto,curadoria:texto}).strict(),hashProposta:texto}).strict();
export type PropostaDoseReceita=z.infer<typeof PropostaDoseReceita>;
export const PropostasDoseReceitaResposta=z.object({propostas:z.array(PropostaDoseReceita),autorizaTratamento:z.literal(false)}).strict();
