import { z } from 'zod';
const fonte=z.string().trim().min(1).refine(s=>!s.includes('[VERIFICAR]'));
const instante=z.string().datetime({offset:true});
const exposicao=z.object({
  droga:z.string().trim().min(1),formulacao:z.enum(['SISTEMICA_CONVENCIONAL','LIPOSSOMAL','TOPICA','DESCONHECIDA']),
  ultimaDose:instante.nullable(),proximaDose:instante.nullable(),termino:instante.nullable(),fonte,
}).strict();
/** Resumo reconciliado do encontro: uma exposição por identidade; não é inferido da coexistência no prontuário. */
export const ContextoInteracoesCondicionadas=z.object({
  versao:z.literal(1),referencia:instante,offsetServico:z.string().regex(/^[+-](?:0\d|1[0-4]):[0-5]\d$/),
  medicamentosAtuais:z.array(z.string().trim().min(1)).nullable(),
  reconciliacao:z.object({confirmada:z.boolean(),em:instante,fonte}).strict().nullable(),
  historicoConferido:z.boolean(),exposicoesCompletas:z.boolean(),exposicoes:z.array(exposicao),
  coadministracoes:z.array(z.object({drogas:z.tuple([z.string().min(1),z.string().min(1)]),data:instante,fonte}).strict()),
  clearance:z.object({valorMlMin:z.number().finite().positive(),metodo:z.literal('COCKCROFT_GAULT'),coleta:instante,fonte,validoParaDose:z.boolean()}).strict().nullable(),
  vacinas:z.array(z.object({nome:z.string().min(1),tipo:z.enum(['VIVA','INATIVADA','RECOMBINANTE','DESCONHECIDA']),data:instante.nullable(),fonte}).strict()),
  quimioterapia:z.object({citotoxica:z.boolean(),emCurso:z.boolean(),inicio:instante.nullable(),termino:instante.nullable(),fonte}).strict().nullable(),
  recuperacaoImune:z.object({confirmada:z.boolean(),em:instante,fonte}).strict().nullable(),
}).strict();
export type ContextoInteracoesCondicionadas=z.infer<typeof ContextoInteracoesCondicionadas>;
export const TiposInteracaoCondicionada=['BRIVUDINA_FLUOROPIRIMIDINA','PEMETREXEDE_IBUPROFENO','VACINA_VIVA_QT','DOXORRUBICINA_TRASTUZUMABE'] as const;
export type TipoInteracaoCondicionada=typeof TiposInteracaoCondicionada[number];
export interface ResultadoInteracaoCondicionada {
  tipo:TipoInteracaoCondicionada;estado:'AVISO'|'PENDENTE'|'NAO_APLICAVEL';motivo:string;
  bloqueiaSalvar:false;fontes:readonly string[];regraId:string|null;
}
const evidencia=z.object({tipo:z.literal('LITERATURA'),referencia:fonte.refine(s=>{
  try { const u=new URL(s);return u.protocol==='https:'&&['dailymed.nlm.nih.gov','www.ema.europa.eu','www.cdc.gov'].includes(u.hostname); }catch{return false;}
}),trecho:fonte,edicao:fonte}).passthrough();
/** Parâmetros literais: qualquer mudança requer nova implementação/fonte, não ajuste silencioso de limiar. */
export const RegraInteracaoCondicionada=z.object({
  regraId:fonte,ativo:z.literal(false),fonte:evidencia,
  avaliacaoCondicionada:z.discriminatedUnion('tipo',[
    z.object({ativo:z.literal(true),tipo:z.literal('BRIVUDINA_FLUOROPIRIMIDINA'),params:z.object({horasAposBrivudina:z.literal(672),horasAposCapecitabina:z.literal(24)}).strict()}).strict(),
    z.object({ativo:z.literal(true),tipo:z.literal('PEMETREXEDE_IBUPROFENO'),params:z.object({clcrMin:z.literal(45),clcrMaxExclusivo:z.literal(80),diasAntes:z.literal(2),diasDepois:z.literal(2),validadeRenalHoras:z.literal(168)}).strict()}).strict(),
    z.object({ativo:z.literal(true),tipo:z.literal('VACINA_VIVA_QT'),params:z.object({mesesAposTermino:z.literal(3)}).strict()}).strict(),
    z.object({ativo:z.literal(true),tipo:z.literal('DOXORRUBICINA_TRASTUZUMABE'),params:z.object({mesesAposTrastuzumabe:z.literal(7)}).strict(),fonteConcomitancia:evidencia}).strict(),
  ]),
}).passthrough();
export type RegraInteracaoCondicionada=z.infer<typeof RegraInteracaoCondicionada>;
