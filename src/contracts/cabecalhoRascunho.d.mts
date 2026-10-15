import type {z} from 'zod';
export interface CabecalhoRascunhoShape {schema:'CabecalhoRascunho@1';id:string;versao:string;redigidoEm:string;fonte:{tipo:'DECISAO_MEDICA'|'DIRETRIZ'|'NORMA'|'LITERATURA';referencia:string;trecho:string|null;edicao:string|null};curador:null;aprovadoEm:null}
export const CabecalhoRascunho:z.ZodType<CabecalhoRascunhoShape>;
