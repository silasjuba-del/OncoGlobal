import { z } from "zod";
import type { ClinicalEvent } from "../../contracts/operacao.js";
import { dadosDoEvento, eventosVigentes, projetarSnapshot } from "../../kernel/projections/snapshot.js";
import { avaliarTetosExposicao, calcularTotalExposicao, chaveDroga, type EntradaExposicaoCumulativa,
  type LimiteExposicaoCumulativa } from "../../rules/cumulativoAlerta.js";

const id = z.string().trim().min(1);
const fonte = id.nullable();
const administracao = z.object({ adminId: id, patientId: id, episodioId: id, droga: id,
  status: z.enum(["COMPLETA", "PARCIAL", "INTERROMPIDA", "OMITIDA"]), quantidadeEfetivaMgM2: z.number().finite().nonnegative().nullable(),
  unidade: z.enum(["mg/m2", "U", "U/m2"]), fonte, realizadaEm: id.nullable().optional() }).strict();
const instanteEfetivo = z.iso.datetime({ offset: true }).refine((s) => Number.isFinite(Date.parse(s)));

/** Snapshot explícito de uma droga: dose já normalizada por administração; não faz conversão mg→mg/m². */
export const ExposicaoCumulativaDados = z.object({ patientId: id, droga: id, administracoes: z.array(administracao),
  historicoCompleto: z.boolean().nullable(), fonteCompletude: fonte }).strict().superRefine((dados, ctx) => {
  dados.administracoes.forEach((a, index) => {
    if (a.patientId !== dados.patientId) ctx.addIssue({ code: "custom", path: ["administracoes", index, "patientId"], message: "Paciente divergente" });
    if (a.droga !== dados.droga) ctx.addIssue({ code: "custom", path: ["administracoes", index, "droga"], message: "Droga divergente; equivalência não autorizada" });
  });
});
export type ExposicaoCumulativaDados = z.infer<typeof ExposicaoCumulativaDados>;

export interface EntradaCumulativoClinico {
  eventos: readonly ClinicalEvent[];
  patientId: string;
  tumorLotId: string | null;
  encounterId: string;
  agora: string;
  programados: readonly string[] | null;
  limites: readonly LimiteExposicaoCumulativa[];
  /** Decisão de apresentação explícita. O padrão continua comparação pendente se faltar limite. */
  somenteTotal?: boolean;
}

export function projetarCumulativoClinico(i: EntradaCumulativoClinico) {
  const instante = Date.parse(i.agora);
  const pendencias: string[] = [];
  if (!Number.isFinite(instante) || !i.patientId.trim() || !i.encounterId.trim()) pendencias.push("ESCOPO_OU_AGORA_INVALIDO");
  if (i.programados === null || i.programados.some((d) => !d.trim())) pendencias.push("ELENCO_DESCONHECIDO");
  // Exposição pertence ao paciente/droga, inclusive outros lotes e consultas anteriores do mesmo paciente.
  const eventos = i.eventos.filter((e) => e.tipo === "FATO" && e.patientId === i.patientId
    && (e.revisao === "CONFIRMADO" || e.revisao === "ASSINADO") && Number.isFinite(Date.parse(e.criadoEm))
    && Date.parse(e.criadoEm) <= instante && dadosDoEvento(e)?.campo === "exposicaoCumulativa");
  const grupos = new Map<string, ClinicalEvent[]>();
  const invalidos: string[] = [];
  for (const e of eventosVigentes(eventos)) {
    const parsed = ExposicaoCumulativaDados.safeParse(dadosDoEvento(e)?.valor);
    if (!parsed.success || parsed.data.patientId !== i.patientId) { invalidos.push(e.eventId); continue; }
    grupos.set(chaveDroga(parsed.data.droga), [...(grupos.get(chaveDroga(parsed.data.droga)) ?? []), e]);
  }
  if (invalidos.length) pendencias.push("FATOS_CUMULATIVOS_INVALIDOS");
  const pendenciasEntrada = [...pendencias];
  const drogas = [...new Set((i.programados ?? []).filter((d) => d.trim()))];
  const avaliacoes = drogas.map((droga) => {
    const originais = grupos.get(chaveDroga(droga)) ?? [];
    // A cópia só permite ao projetor aplicar sua política de conflito/substituição ao alcance longitudinal.
    // Metadados originais são mantidos em origens; nenhum evento do ledger é alterado.
    const vista = originais.map((e) => ({ ...e, tumorLotId: i.tumorLotId, encounterId: i.encounterId,
      payload: { data: { campo: "exposicaoCumulativa", valor: dadosDoEvento(e)?.valor } } }));
    const snapshot = projetarSnapshot(vista, i.patientId, i.tumorLotId, i.encounterId, "f0c-exposicao-paciente-v1");
    const campo = snapshot.campos.exposicaoCumulativa;
    const eventIds = campo?.eventIds ?? [];
    const vigentes = originais.filter((e) => eventIds.includes(e.eventId));
    const sourceIds = [...new Set(vigentes.flatMap((e) => e.fontes.map((f) => f.sourceId)).filter((s) => s.trim()))].sort();
    const locais: string[] = [];
    if (pendenciasEntrada.length) locais.push(...pendenciasEntrada);
    if (!campo) locais.push("EXPOSICAO_AUSENTE");
    else if (campo.estado !== "VERDE") locais.push(campo.estado === "VERMELHO" ? "EXPOSICAO_DIVERGENTE" : "EXPOSICAO_PENDENTE");
    if (campo && !sourceIds.length) locais.push("FONTE_EVENTO_AUSENTE");
    const parsed = ExposicaoCumulativaDados.safeParse(campo?.valor);
    const dados = !locais.length && parsed.success ? parsed.data : {
      patientId: i.patientId, droga, administracoes: [], historicoCompleto: null, fonteCompletude: null,
    };
    let temporalIncompleto = false;
    const administracoes: EntradaExposicaoCumulativa["administracoes"][number][] = [];
    const assinaturas = new Map<string, string>(), conflitantes = new Set<string>();
    for (const a of dados.administracoes) {
      const assinatura = JSON.stringify([a.episodioId, a.status, a.quantidadeEfetivaMgM2, a.unidade, a.realizadaEm ?? null]);
      if (assinaturas.has(a.adminId) && assinaturas.get(a.adminId) !== assinatura) conflitantes.add(a.adminId);
      assinaturas.set(a.adminId, assinatura);
    }
    for (const a of dados.administracoes) {
      if (conflitantes.has(a.adminId)) {
        temporalIncompleto = true;
        locais.push(`CONFLITO_ADMINISTRACAO:${a.adminId}`);
        continue;
      }
      const realizada = instanteEfetivo.safeParse(a.realizadaEm);
      if (!realizada.success || Date.parse(realizada.data) > instante) {
        temporalIncompleto = true;
        locais.push(`${realizada.success ? "ADMINISTRACAO_FUTURA" : "ADMINISTRACAO_SEM_INSTANTE_EFETIVO"}:${a.adminId}`);
        continue;
      }
      administracoes.push({ ...a, realizadaEm: realizada.data });
    }
    const entrada: EntradaExposicaoCumulativa = { ...dados, administracoes,
      historicoCompleto: temporalIncompleto ? false : dados.historicoCompleto };
    const limites = i.limites.filter((l) => chaveDroga(l.droga) === chaveDroga(droga));
    const apenasTotal = i.somenteTotal === true;
    const unidades = limites.map((l) => l.unidade);
    const resultado = apenasTotal ? calcularTotalExposicao(entrada) : avaliarTetosExposicao(entrada, limites);
    if (!apenasTotal && new Set(unidades).size !== unidades.length) locais.push("LIMITE_AMBIGUO");
    const faltouLimite = !apenasTotal && (limites.length === 0 || resultado.pendencias.includes("LIMITE_CURADO_INCOMPATIVEL_OU_AUSENTE"));
    if (faltouLimite) locais.push("PENDENTE_LIMITE");
    const avaliacao = { ...resultado, pendencias: [...new Set([...locais, ...resultado.pendencias])] };
    pendencias.push(...avaliacao.pendencias.map((p) => `${droga}:${p}`));
    return { droga, modo: apenasTotal ? "SOMENTE_TOTAL" as const : "COMPARAR_LIMITE" as const, avaliacao, eventIds: [...eventIds], sourceIds,
      origens: vigentes.map((e) => ({ eventId: e.eventId, tumorLotId: e.tumorLotId, encounterId: e.encounterId })) };
  });
  return { avaliacoes, pendencias: [...new Set(pendencias)], invalidEventIds: invalidos };
}
