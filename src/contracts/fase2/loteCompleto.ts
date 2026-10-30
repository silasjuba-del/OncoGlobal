import {z} from 'zod';
import {Id} from '../base.js';
export const SETORES_PACK=['identidade','cenarios','diagnostico','estadiamento','biomarcadores','exames','pre_tratamento','tratamento','suporte','seguranca','resposta','seguimento','orientacoes','encaminhamentos','documentos','ensaios','relacoes','fontes','conflitos','pendencias','complementos'] as const;
export const TITULOS_SETORES:Record<typeof SETORES_PACK[number],string>={identidade:'Identidade e limites',cenarios:'Cenários',diagnostico:'Diagnóstico e patologia',estadiamento:'Estadiamento e risco',biomarcadores:'Biomarcadores e farmacogenética',exames:'Exames',pre_tratamento:'Antes do tratamento',tratamento:'Tratamento e protocolos',suporte:'Suporte e cuidados',seguranca:'Toxicidades, interações e contraindicações',resposta:'Avaliação de resposta',seguimento:'Seguimento',orientacoes:'Orientações e sinais de alarme',encaminhamentos:'Encaminhamentos',documentos:'Documentos e acesso',ensaios:'Ensaios clínicos',relacoes:'Relações entre itens',fontes:'Fontes e curadoria',conflitos:'Conflitos preservados',pendencias:'Pendências',complementos:'Conteúdo complementar'};
export const ItemLoteCompleto=z.object({id:Id,setor:z.enum(SETORES_PACK),titulo:Id,localizador:Id,origem:z.enum(['LEGADO','UNIVERSAL']),cenarios:z.array(z.string()),conteudo:z.json()}).strict();
export const LoteCompleto=z.object({schema:z.literal('LoteTumoralCompleto@1'),packId:Id,titulo:Id,cids:z.array(Id),
 original:z.object({arquivo:Id,sha256:z.string().regex(/^[a-f0-9]{64}$/),versao:Id}).strict(),
 setores:z.array(z.object({id:z.enum(SETORES_PACK),titulo:Id,itens:z.array(ItemLoteCompleto)}).strict()),
 protocolosLegados:z.number().int().nonnegative(),itensUniversais:z.number().int().nonnegative(),
 conteudoIntegral:z.json(),avisos:z.array(Id),autorizaTratamento:z.literal(false),
}).strict().superRefine(conferirSetoresPack);
export function conferirSetoresPack(l:{setores:{id:string;itens:{id:string;setor:string}[]}[]}, c:z.RefinementCtx) {
 if(l.setores.length!==SETORES_PACK.length||new Set(l.setores.map(s=>s.id)).size!==SETORES_PACK.length)c.addIssue({code:'custom',message:'SETORES_INCOMPLETOS'});
 const itens=l.setores.flatMap(s=>s.itens);if(new Set(itens.map(i=>i.id)).size!==itens.length)c.addIssue({code:'custom',message:'ITEM_DUPLICADO'});
 if(l.setores.some(s=>s.itens.some(i=>i.setor!==s.id)))c.addIssue({code:'custom',message:'SETOR_DIVERGENTE'});
}

export type LoteCompleto=z.infer<typeof LoteCompleto>;
export type ItemLoteCompleto=z.infer<typeof ItemLoteCompleto>;
