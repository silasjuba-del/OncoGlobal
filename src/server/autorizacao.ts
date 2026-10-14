import type { DatabaseSync } from "node:sqlite";
import type { ActionIntent } from "../contracts/operacao.js";
import type { z } from "zod";
import { listarEventos } from "../kernel/comandos/portas.js";
import { Apac } from "../contracts/operacao.js";
import { ValidacaoApacPersistida, type ReferenciaSigtap } from "../contracts/f1/dutos.js";
import { validarReferenciaApac } from "../modules/apac/validacaoPersistida.js";
import { resolverPrescricaoDuto } from "./dutos.js";
import { dadosDoEvento, eventosVigentes } from "../kernel/projections/snapshot.js";

type Intent = z.infer<typeof ActionIntent>;
export type Autorizacao = { ok: true } | { ok: false; codigo: string };

/**
 * CP-001 · O cliente PEDE; o ledger PROVA. Antes do gateway, a saída externa só passa se o
 * próprio servidor encontrar o artefato ASSINADO, vigente (não substituído), do mesmo
 * paciente/encontro, na versão pedida. Reavaliado a cada chamada, inclusive replay.
 */
export function autorizarSaida(db: DatabaseSync, intent: Intent, sigtapAtual?: (competencia: string) => ReferenciaSigtap | null): Autorizacao {
  if (intent.verbo === "BACKUP_LOCAL")
    return intent.objeto.tipo === "BACKUP" && intent.destino === null ? { ok: true } : { ok: false, codigo: "BACKUP_INVALIDO" };
  // A10/G-02: canal externo exige contato vinculado e consentimento persistidos; ainda não existem.
  if (intent.verbo === "ENVIAR_WHATSAPP" || intent.verbo === "ENVIAR_EMAIL" || intent.verbo === "AGENDAR")
    return { ok: false, codigo: "CANAL_EXTERNO_NAO_HABILITADO" };
  if (intent.destino !== null) return { ok: false, codigo: "DESTINO_NAO_PERMITIDO" };
  const { patientId, encounterId } = intent.escopo;
  if (!patientId) return { ok: false, codigo: "ESCOPO_SEM_PACIENTE" };
  const vigentes = eventosVigentes(listarEventos(db, patientId));
  if (intent.verbo === "EXPORTAR_APAC") {
    const validacoes = vigentes.filter(e => e.tipo === "FATO" && e.revisao === "CONFIRMADO" && e.encounterId === encounterId && dadosDoEvento(e)?.campo === "apac.validacaoEmissao")
      .flatMap(e => { const v = ValidacaoApacPersistida.safeParse(dadosDoEvento(e)?.valor);
        return v.success && v.data.apacId === intent.objeto.id && v.data.apacVersao === intent.objeto.versao ? [{e,v:v.data}] : []; });
    if (validacoes.length) {
      if (validacoes.length !== 1) return {ok:false,codigo:"VALIDACAO_APAC_AMBIGUA"};
      const {e,v}=validacoes[0]!;
      if(v.patientId!==patientId || v.encounterId!==encounterId || v.tumorLotId!==e.tumorLotId || v.validadoPor!==e.criadoPor.id || v.validadoEm!==e.criadoEm)
        return {ok:false,codigo:"VALIDACAO_APAC_CONTEXTO_DIVERGENTE"};
      const apacs=vigentes.filter(a=>a.tipo==='APAC'&&['CONFIRMADO','ASSINADO'].includes(a.revisao)&&a.encounterId===encounterId&&a.tumorLotId===v.tumorLotId)
        .flatMap(a=>{const p=Apac.safeParse(dadosDoEvento(a));return p.success&&p.data.apacId===v.apacId?[p.data]:[];});
      if(apacs.length!==1)return {ok:false,codigo:'APAC_VIGENTE_NAO_ENCONTRADA'};
      const apac=apacs[0]!, prescricao=resolverPrescricaoDuto(vigentes,{patientId,encounterId:v.encounterId,tumorLotId:v.tumorLotId},apac.prescricaoAssinadaRef),sigtap=sigtapAtual?.(apac.competencia);
      if(!prescricao||!sigtap||!validarReferenciaApac(v,{apac,prescricao,sigtap}))return {ok:false,codigo:'VALIDACAO_APAC_DESATUALIZADA'};
      // Somente autoriza o artefato local; o gateway ainda exige executor explicitamente configurado.
      return {ok:true};
    }
  }
  const assinado = vigentes.find((e) => {
    if (e.revisao !== "ASSINADO" || e.encounterId !== encounterId) return false;
    // writeRouter guarda { reviewDecisionId, data: { data, signature } } (ver rotas.confirmarBloco).
    type Sig = { documentId?: unknown; documentVersion?: unknown };
    const sig = (e.payload as { data?: { signature?: Sig } } | null)?.data?.signature;
    return sig?.documentId === intent.objeto.id && sig.documentVersion === intent.objeto.versao;
  });
  if (!assinado) return { ok: false, codigo: "ARTEFATO_NAO_ASSINADO" };
  // Validação de emissão APAC ainda não é persistida no ledger (pendência CP-001b): contenção explícita.
  if (intent.verbo === "EXPORTAR_APAC") return { ok: false, codigo: "VALIDACAO_APAC_NAO_PERSISTIDA" };
  return { ok: true };
}
