// W10-INT-APAC-03 · Antiglosa determinística (D-W9-19). Função pura.
// ALERTA nunca bloqueia o médico; BLOQUEIA_EXPORTACAO bloqueia só a exportação ao SIA.
// Regra sem fonte NÃO está aqui (ver docs/w10/PEDIDOS-INT-APAC.md, [VERIFICAR]).
import type { Apac } from "../contracts/operacao.js";
import type { AchadoAntiglosa as Achado, CaixaNumerada } from "../contracts/w10/clinico-w10.js";
import { VereditoAntiglosa } from "../contracts/w10/clinico-w10.js";
import { validarCns } from "./cns.js";
import {
  FINALIDADES_QT, FINALIDADES_RT, lerCampo, lerSecundarios, lerTexto, normalizarFinalidade, ROTULO_FINALIDADE,
} from "./campos.js";
import { diasEntre, idadeEmMeses, parseData } from "./datas.js";
import { buscarProcedimento, codigoProcValido, normalizarCodigoProc, type TabelasSigtap } from "./sigtap.js";

/** Campos exigidos pelo laudo (D-W5-06). Lista injetável: a exigência do SIA por campo é [VERIFICAR]. */
export const CAMPOS_OBRIGATORIOS_PADRAO: readonly string[] = [
  "pacienteNome", "pacienteCns", "pacienteNascimento", "pacienteSexo", "nomeMae",
  "procedimentoPrincipal", "quantidadePrincipal", "cidPrincipal", "finalidadeApac",
  "nomeEstabelecimento", "cnesSolicitante", "solicitanteNome", "solicitanteCns",
  "dataSolicitacao", "justificativa", "descricaoDiagnostico",
];

export const DIA_AVISO_APAC = 85; // D85 aviso (Q34); emitido em D85 exato, nunca depois
export const DIA_VENCIDA_APAC = 90; // D90 VENCIDA (Q34)

export interface ContextoAntiglosa {
  hoje: string; // YYYY-MM-DD, injetado
  sigtap: TabelasSigtap;
  caixas: readonly CaixaNumerada[]; // chave "apac.<campo>" -> número
  cnesConfigurado: string; // exemplo editável: 2605473 (D-W9-10)
  competenciaLote?: string | null; // competência única do lote (D-W5-10)
  apacsDoLote?: readonly Apac[]; // demais APACs do lote (duplicidade)
  camposObrigatorios?: readonly string[];
}

const F = {
  sigtap: "SIGTAP/DATASUS, tabela da competência (D-W9-11)",
  cid: "SIGTAP RL_PROCEDIMENTO_CID, competência (D-W9-11)",
  fin: "Portaria SAES/MS 470/2021 Anexo II; PC SAES/MS 1/2022 art. 385 (D-W9-12)",
  cns: "Algoritmo e-SUS/LEDI Validar CNS; Portaria GM/MS 940/2011 (D-W9-13)",
  laudo: "Laudo APAC oficial (D-W5-06)",
  lote: "D-W5-10 (uma competência por lote)",
  prazo: "D-W5-02 / Q34 (D85 aviso, D90 vencida)",
} as const;

function normCid(c: string): string {
  return c.toUpperCase().replace(/[.\s]/g, "");
}
function cidCompativel(cid: string, lista: readonly string[]): boolean {
  const c = normCid(cid);
  return lista.some((l) => {
    const x = normCid(l);
    return x === c || (x.length === 3 && c.startsWith(x));
  });
}

export function antiglosa(apac: Apac, ctx: ContextoAntiglosa): VereditoAntiglosa {
  const achados: Achado[] = [];
  const caixa = (campo: string | null): number | null =>
    campo === null ? null : (ctx.caixas.find((c) => c.chave === `apac.${campo}`)?.numero ?? null);
  const add = (regraId: string, campo: string | null, severidade: Achado["severidade"], motivo: string, fonte: string): void => {
    achados.push({ regraId, caixaNumero: caixa(campo), severidade, motivo, fonte });
  };
  const campos = apac.campos;

  // AG-08 campos obrigatórios (ausente = PENDENTE, nunca preenchido)
  for (const c of ctx.camposObrigatorios ?? CAMPOS_OBRIGATORIOS_PADRAO) {
    const l = lerCampo(campos, c);
    if (l.estado === "PENDENTE") add("AG-08", c, "BLOQUEIA_EXPORTACAO", `Campo obrigatório PENDENTE: ${c} (${l.motivo}).`, F.laudo);
  }

  // AG-09 competência única do lote
  if (ctx.competenciaLote && apac.competencia !== ctx.competenciaLote)
    add("AG-09", null, "BLOQUEIA_EXPORTACAO",
      `Competência ${apac.competencia} difere da do lote (${ctx.competenciaLote}); vai para o lote dela.`, F.lote);

  const codPrincipal = lerTexto(campos, "procedimentoPrincipal");
  const procs: { campo: string; codigo: string }[] = [];
  if (codPrincipal) procs.push({ campo: "procedimentoPrincipal", codigo: codPrincipal });
  for (const s of lerSecundarios(campos)) procs.push({ campo: "procedimentosSecundarios", codigo: s.codigo });

  const cid = lerTexto(campos, "cidPrincipal");
  const sexo = lerTexto(campos, "pacienteSexo");
  const nasc = lerTexto(campos, "pacienteNascimento");
  const dataSol = lerTexto(campos, "dataSolicitacao");
  const idadeMeses = nasc && dataSol ? idadeEmMeses(nasc, dataSol) : null;
  let modalidade = lerTexto(campos, "modalidade");
  let principal: ReturnType<typeof buscarProcedimento> | null = null;

  for (const p of procs) {
    const ehPrincipal = p.campo === "procedimentoPrincipal";
    if (!codigoProcValido(p.codigo)) {
      add("AG-01", p.campo, "BLOQUEIA_EXPORTACAO", `Código de procedimento inválido (esperado 10 dígitos): ${p.codigo}.`, F.sigtap);
      continue;
    }
    const r = buscarProcedimento(ctx.sigtap, apac.competencia, p.codigo);
    if (ehPrincipal) principal = r;
    if (!r.achou) {
      add("AG-01", p.campo, "BLOQUEIA_EXPORTACAO",
        r.motivo === "COMPETENCIA_SEM_TABELA"
          ? `Sem tabela SIGTAP carregada para a competência ${apac.competencia}; não dá para validar ${normalizarCodigoProc(p.codigo)}.`
          : `Procedimento ${normalizarCodigoProc(p.codigo)} não existe na competência ${apac.competencia}.`, F.sigtap);
      continue;
    }
    const proc = r.proc;
    // AG-02 CID x procedimento (relacionamento ausente = não verificado, dito explicitamente)
    if (cid) {
      if (proc.cidsCompativeis === null)
        add("AG-02", "cidPrincipal", "ALERTA", `Compatibilidade CID x ${proc.codigo} não carregada na tabela; não verificada.`, F.cid);
      else if (!cidCompativel(cid, proc.cidsCompativeis))
        add("AG-02", "cidPrincipal", "BLOQUEIA_EXPORTACAO", `CID ${cid} não é compatível com o procedimento ${proc.codigo} na competência ${apac.competencia}.`, F.cid);
    }
    // AG-04 sexo
    if (sexo && proc.sexo && proc.sexo !== "AMBOS" && sexo !== proc.sexo)
      add("AG-04", "pacienteSexo", "BLOQUEIA_EXPORTACAO", `Procedimento ${proc.codigo} é restrito ao sexo ${proc.sexo}; paciente ${sexo}.`, F.sigtap);
    // AG-03 idade
    if (idadeMeses !== null
      && ((proc.idadeMinMeses !== null && idadeMeses < proc.idadeMinMeses)
        || (proc.idadeMaxMeses !== null && idadeMeses > proc.idadeMaxMeses)))
      add("AG-03", "pacienteNascimento", "BLOQUEIA_EXPORTACAO",
        `Idade (${idadeMeses} meses) fora da faixa do procedimento ${proc.codigo} (${proc.idadeMinMeses ?? "-"} a ${proc.idadeMaxMeses ?? "-"} meses).`, F.sigtap);
    if (ehPrincipal && !modalidade && proc.modalidade) modalidade = proc.modalidade;
  }

  // AG-05 finalidade escolhida pelo médico (nunca deduzida da intenção)
  const finBruta = lerTexto(campos, "finalidadeApac");
  if (finBruta) {
    const fin = normalizarFinalidade(finBruta);
    const mod = modalidade?.toUpperCase() ?? null;
    const validas: readonly string[] = mod === "RT" ? FINALIDADES_RT : mod === "QT" ? FINALIDADES_QT : [...FINALIDADES_QT, ...FINALIDADES_RT];
    if (!validas.includes(fin))
      add("AG-05", "finalidadeApac", "BLOQUEIA_EXPORTACAO", `Finalidade "${finBruta}" não é válida${mod ? ` para ${mod}` : ""}.`, F.fin);
    else if (!mod)
      add("AG-05", "modalidade", "ALERTA", "Modalidade (QT/RT) não informada; finalidade checada contra a união das listas.", F.fin);
    // AG-12 compara com a finalidade do grupo SIGTAP; nunca preenche nem altera
    if (principal?.achou && principal.proc.finalidadeDoGrupo) {
      const g = normalizarFinalidade(principal.proc.finalidadeDoGrupo);
      if (g !== fin)
        add("AG-12", "finalidadeApac", "ALERTA",
          `Finalidade escolhida (${ROTULO_FINALIDADE[fin] ?? finBruta}) difere do grupo do procedimento (${ROTULO_FINALIDADE[g] ?? g}). Confirme; o app não altera a escolha.`, F.sigtap);
    }
  }

  // AG-06 CNS do paciente e do solicitante (DV válido não prova identidade)
  for (const campo of ["pacienteCns", "solicitanteCns"] as const) {
    const v = lerTexto(campos, campo);
    if (!v) continue; // PENDENTE já reportado em AG-08
    const r = validarCns(v);
    if (!r.valido) add("AG-06", campo, "BLOQUEIA_EXPORTACAO", `CNS inválido (${r.motivo}).`, F.cns);
  }

  // AG-07 CNES
  const cnes = lerTexto(campos, "cnesSolicitante");
  if (cnes) {
    if (!/^\d{7}$/.test(cnes)) add("AG-07", "cnesSolicitante", "BLOQUEIA_EXPORTACAO", `CNES deve ter 7 dígitos: "${cnes}".`, F.laudo);
    else if (cnes !== ctx.cnesConfigurado)
      add("AG-07", "cnesSolicitante", "ALERTA", `CNES ${cnes} difere do CNES configurado (${ctx.cnesConfigurado}).`, "Configuração do estabelecimento (D-W9-10)");
  }

  // AG-10 duplicidade no lote: mesmo CNS + procedimento principal + competência (chave [VERIFICAR])
  const cns = lerTexto(campos, "pacienteCns");
  for (const o of ctx.apacsDoLote ?? []) {
    if (o === apac) continue;
    const igualId = o.apacId === apac.apacId;
    const chaveIgual = !!cns && !!codPrincipal && lerTexto(o.campos, "pacienteCns") === cns
      && lerTexto(o.campos, "procedimentoPrincipal") === codPrincipal && o.competencia === apac.competencia;
    if (igualId || chaveIgual) {
      add("AG-10", null, "ALERTA",
        igualId ? `APAC ${apac.apacId} aparece mais de uma vez no lote.` : `Possível duplicidade com ${o.apacId} (mesmo CNS, procedimento e competência).`,
        "D-W9-19 (duplicidade; chave de comparação [VERIFICAR])");
      break;
    }
  }

  // AG-11 datas
  if (dataSol && !parseData(dataSol)) add("AG-11", "dataSolicitacao", "BLOQUEIA_EXPORTACAO", `Data da solicitação inválida: ${dataSol}.`, F.laudo);
  if (nasc && !parseData(nasc)) add("AG-11", "pacienteNascimento", "BLOQUEIA_EXPORTACAO", `Data de nascimento inválida: ${nasc}.`, F.laudo);
  if (nasc && dataSol && (diasEntre(nasc, dataSol) ?? 0) < 0)
    add("AG-11", "pacienteNascimento", "BLOQUEIA_EXPORTACAO", "Nascimento posterior à data da solicitação.", "Consistência interna do laudo");
  const dias = diasEntre(apac.dataGeracaoApp, ctx.hoje);
  if (dias !== null) {
    if (dias >= DIA_VENCIDA_APAC)
      add("AG-11", "dataSolicitacao", "BLOQUEIA_EXPORTACAO", `APAC com ${dias} dias desde a geração: VENCIDA (D${DIA_VENCIDA_APAC}).`, F.prazo);
    else if (dias >= DIA_AVISO_APAC)
      add("AG-11", "dataSolicitacao", "ALERTA", `APAC com ${dias} dias: aviso D${DIA_AVISO_APAC}; vence em D${DIA_VENCIDA_APAC}.`, F.prazo);
  }

  return VereditoAntiglosa.parse({
    apacId: apac.apacId, competencia: apac.competencia, achados,
    exportavel: !achados.some((a) => a.severidade === "BLOQUEIA_EXPORTACAO"),
  });
}
