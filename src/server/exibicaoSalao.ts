import type {DraftEnvelope} from '../contracts/base.js';
import type {CartaoSalaoVisao} from '../contracts/api/salao.js';
import type {ServidorDeps} from './rotas.js';
import {lerDraft} from '../kernel/comandos/portas.js';
import {hashConteudoExibido} from './sessao.js';
import type {lerSalao} from './leituras.js';
export const hashExibicaoCorte=(draft:DraftEnvelope,cartao:CartaoSalaoVisao,ruleset:unknown)=>hashConteudoExibido({draft,cartao,ruleset});
export function registrarSalaoExibido(deps:ServidorDeps,token:string,visao:ReturnType<typeof lerSalao>){
 for(const relato of visao.relatosInfusao??[])for(const contexto of relato.contextosRevisao??[])
   deps.sessoes.registrarConteudoExibido?.(token,contexto,'RELATO_INFUSAO',relato.mensagemId,hashConteudoExibido(relato));
 const c=deps.sessoes.consultaSelecionada(token);if(!c)return;
 const p=visao.pacientes.find(p=>p.patientId===c.patientId&&p.encounterId===c.encounterId);
 const cartao=visao.cartoes.find(p=>p.entrada.patientId===c.patientId);
 if(!p||!('draftId' in p)||typeof p.draftId!=='string'||!cartao?.temCorte||!('ruleset' in visao)||!visao.ruleset)return;
 const draft=lerDraft(deps.db,p.draftId);if(!draft)return;
 deps.sessoes.registrarConteudoExibido?.(token,c,'SALAO_CORTE',draft.draftId,hashExibicaoCorte(draft,cartao,visao.ruleset));
}
