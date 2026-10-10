import { dataCivilNoOffset } from "../../rules/intervaloQt.js";
import { z } from "zod";
import { Ciclo, TreatmentEpisode } from "../../contracts/clinico.js";
import type { ClinicalEvent } from "../../contracts/operacao.js";
import { ProtocolTemplate } from "../../contracts/w10/prescricao.js";
import { ClinicalFact } from "../../contracts/w10/extracao.js";
import { administrations, labSeries } from "../../kernel/projections/series.js";
import { dadosDoEvento, eventosVigentes, projetarSnapshot, type ValorProjetado } from "../../kernel/projections/snapshot.js";
import { projetarHistoricoTratamento, type FatoTratamento } from "../../kernel/projections/historicoTratamento.js";

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => {
  const d = new Date(`${s}T12:00:00Z`); return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
});
const texto = z.string().trim().min(1);
const objeto = (v: unknown): Record<string, unknown> | null => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null;
export interface EntradaContextoClinico {
  eventos: readonly ClinicalEvent[]; patientId: string; tumorLotId: string | null; encounterId: string; agora: string; offsetServico?: string;
  episodio?: unknown; ciclo?: unknown; templates?: readonly unknown[];
}
function noEscopo(i: EntradaContextoClinico) {
  const instante = Date.parse(i.agora);
  return i.eventos.filter(e => e.patientId === i.patientId && (e.tumorLotId === i.tumorLotId || e.tumorLotId === null)
    && Number.isFinite(Date.parse(e.criadoEm)) && Date.parse(e.criadoEm) <= instante);
}
const fontes = (e: ClinicalEvent) => [...new Set([...e.fontes.map(f => f.sourceId),
  ...(typeof dadosDoEvento(e)?.sourceId === "string" ? [dadosDoEvento(e)!.sourceId as string] : [])])];
function termos(v: unknown): string[] {
  if (Array.isArray(v)) return v.flatMap(termos);
  if (typeof v === "string") return v.trim() ? [v.trim()] : [];
  const o = objeto(v);
  if (!o || o.negated === true || o.presente === false || o.ativo === false || o.resolvido === true) return [];
  return typeof o.nome === "string" ? [o.nome] : typeof o.sintoma === "string" ? [o.sintoma]
    : typeof o.symptom === "string" ? [o.symptom] : typeof o.texto === "string" ? [o.texto] : [];
}
function resumoCampo(v: ValorProjetado & { sourceIds: string[] }): string {
  if (v.estado === "VERMELHO") return "A CONFERIR — fontes divergentes";
  if (v.valor === null) return "Não informada";
  const o = objeto(v.valor);
  if (o?.negated === true || o?.negado === true || o?.presente === false) return "Negada explicitamente";
  return termos(v.valor).join("; ") || "Não informada";
}

/** Somente fatos confirmados: recência nunca declara aptidão do ciclo. */
export function projetarContextoClinico(i: EntradaContextoClinico) {
  const escopo = noEscopo(i), vigentes = eventosVigentes(escopo), hoje = dataCivilNoOffset(i.agora, i.offsetServico ?? "-03:00") ?? "";
  const fatos = escopo.filter(e => e.tipo === "FATO");
  const snapshot = projetarSnapshot(fatos, i.patientId, i.tumorLotId, i.encounterId, "f0c-contexto-v1");
  const atuais = projetarSnapshot(fatos.filter(e => e.encounterId === i.encounterId), i.patientId, i.tumorLotId, i.encounterId, "f0c-tox-v1");
  const campo = (nome: string) => {
    const v = (nome === "toxicidades" ? atuais : snapshot).campos[nome] ?? { valor: null, eventIds: [], estado: "PENDENTE" as const };
    return { ...v, sourceIds: [...new Set(v.eventIds.flatMap(id => { const e = escopo.find(e => e.eventId === id); return e ? fontes(e) : []; }))] };
  };
  const campos = { alergias: campo("alergias"), comorbidades: campo("comorbidades"), toxicidades: campo("toxicidades"), medicamentos: campo("medicamentos") };
  const pontos = labSeries(escopo).filter(p => Number.isFinite(p.valor) && dia.safeParse(p.data).success && p.data <= hoje);
  const laboratoriosFonte = pontos.map(p => ({ ...p, conflito: pontos.some(outro => outro.campo === p.campo && outro.data === p.data
    && (outro.valor !== p.valor || outro.unidade !== p.unidade)) })).sort((a,b) => b.data.localeCompare(a.data) || a.eventId.localeCompare(b.eventId));
  const ultimaData = new Map<string, string>();
  for (const p of laboratoriosFonte) if (!ultimaData.has(p.campo)) ultimaData.set(p.campo, p.data);
  const laboratorios = laboratoriosFonte.filter(p => ultimaData.get(p.campo) === p.data || p.conflito).map(p => ({
    data: p.data, nome: p.campo, fraseLaudo: `${p.valor} ${p.unidade}${p.conflito ? " — A CONFERIR: resultados divergentes" : ""}`,
    situacao: "SEM_REFERENCIA" as const, eventId: p.eventId, sourceIds: [p.sourceId], conflito: p.conflito,
  }));
  const exames = vigentes.filter(e => e.tumorLotId === i.tumorLotId && ["Biopsy", "ImagingReport"].includes(e.tipo)).flatMap(e => {
    const d = dadosDoEvento(e);
    if (!d || !dia.safeParse(d.dataClinica).success || String(d.dataClinica) > hoje || typeof d.fraseLaudo !== "string" || !d.fraseLaudo.trim()) return [];
    return [{ data: String(d.dataClinica), nome: typeof d.nome === "string" ? d.nome : e.tipo,
      fraseLaudo: d.fraseLaudo, situacao: d.situacao === "DENTRO_DO_LIMITE" ? "DENTRO_DO_LIMITE" as const
        : d.situacao === "FORA_DO_LIMITE" ? "FORA_DO_LIMITE" as const : "SEM_REFERENCIA" as const, eventId: e.eventId, sourceIds: fontes(e) }];
  }).sort((a,b) => b.data.localeCompare(a.data) || a.eventId.localeCompare(b.eventId));
  const toxicidadesFonte = vigentes.filter(e => e.encounterId === i.encounterId && e.tipo === "FATO").flatMap(e => {
    const d = dadosDoEvento(e);
    if (!d || typeof d.campo !== "string" || !d.campo.startsWith("extracao.toxicity")) return [];
    const f = ClinicalFact.safeParse({ id: d.factId, segmentId: `reviewed:${e.eventId}`, patientCandidateId: null,
      domain: d.domain ?? "toxicity", value: d.valor, sourceType: d.sourceType, evidence: d.evidence, sourceId: d.sourceId,
      rawEvidence: d.rawEvidence, confidence: d.confidence, requiresConfirmation: d.requiresConfirmation });
    if (!f.success || f.data.domain !== "toxicity" || f.data.evidence !== "EXPLICIT" || f.data.requiresConfirmation) return [];
    if (typeof d.factDate === "string" && (!dia.safeParse(d.factDate).success || d.factDate > hoje)) return [];
    const o = objeto(f.data.value);
    const negada = o?.negated === true || o?.presente === false;
    const nomes = negada ? termos({ ...o, negated: false, presente: true }) : termos(f.data.value);
    return nomes.map(nome => ({ nome, negada, eventId: e.eventId, sourceIds: fontes(e), rawEvidence: f.data.rawEvidence }));
  });
  const tox = campos.toxicidades.estado === "VERMELHO" ? [] : termos(campos.toxicidades.valor);
  const chaveNome = (nome: string) => nome.trim().toLocaleLowerCase("pt-BR").normalize("NFC");
  const negadas = new Set(toxicidadesFonte.filter(t => t.negada).map(t => chaveNome(t.nome)));
  const positivas = [...tox, ...toxicidadesFonte.filter(t => !t.negada).map(t => t.nome)];
  const conflitoTox = positivas.some(nome => negadas.has(chaveNome(nome)));
  const ep = TreatmentEpisode.safeParse(i.episodio), ci = Ciclo.safeParse(i.ciclo);
  const episodio = ep.success && ep.data.tumorLotId === i.tumorLotId ? ep.data : null;
  const ciclo = ci.success && episodio && ci.data.episodioId === episodio.episodioId ? ci.data : null;
  const templates = (i.templates ?? []).flatMap(t => { const p = ProtocolTemplate.safeParse(t); return p.success ? [p.data] : []; })
    .filter(t => t.templateId === episodio?.esquemaId && t.status === "CONFERIDA_MEDICO");
  const template = templates.length === 1 ? templates[0]! : null;
  const totaisExplicitos = vigentes.filter(e => e.tipo === "FATO" && e.tumorLotId === i.tumorLotId).flatMap(e => {
    const d = dadosDoEvento(e);
    return d?.campo === "ciclosPrevistos" && episodio && d.episodioId === episodio.episodioId
      && typeof d.valor === "number" && Number.isInteger(d.valor) && d.valor > 0 ? [d.valor] : [];
  });
  const totais = [...new Set([...totaisExplicitos, ...(template?.ciclos ? [template.ciclos] : [])])];
  const ciclosPrevistos = totais.length === 1 && (ciclo === null || totais[0]! >= ciclo.numero) ? totais[0] : undefined;
  const ciclos = vigentes.filter(e => e.tipo === "Ciclo" && e.tumorLotId === i.tumorLotId).flatMap(e => {
    const p = Ciclo.safeParse(dadosDoEvento(e)); return p.success && p.data.episodioId === episodio?.episodioId ? [p.data] : [];
  });
  const administracoes = administrations(vigentes.filter(e => e.tumorLotId === i.tumorLotId)).filter(a =>
    a.status !== "OMITIDA" && a.quantidadeEfetivaMg > 0 && a.inicio !== null && Date.parse(a.inicio) <= Date.parse(i.agora)
    && ciclos.some(c => c.cicloId === a.cicloId)).sort((a,b) => Date.parse(b.inicio!) - Date.parse(a.inicio!) || a.eventId.localeCompare(b.eventId));
  const ultimo = administracoes[0], ultimoCiclo = ultimo ? ciclos.find(c => c.cicloId === ultimo.cicloId) : null;
  const pendencias = [ ...((campos.toxicidades.estado === "VERMELHO" || conflitoTox) ? ["TOXICIDADES_DIVERGENTES"] : []),
    ...(templates.length > 1 ? ["TEMPLATE_AMBIGUO"] : []), ...(totais.length > 1 || (totais.length === 1 && ciclosPrevistos === undefined) ? ["TOTAL_CICLOS_DIVERGENTE"] : []), ...(laboratoriosFonte.some(p => p.conflito) ? ["LABORATORIOS_DIVERGENTES"] : []) ];
  return { flash: { exames, laboratorios, alergia: resumoCampo(campos.alergias),
    toxicidades: [...new Set(positivas.filter(nome => !negadas.has(chaveNome(nome))))],
    ...(episodio?.esquemaId ? { protocolo: template?.nome ?? episodio.esquemaId } : {}),
    ...(ciclo ? { cicloAtual: ciclo.numero } : {}), ...(ciclosPrevistos ? { ciclosPrevistos } : {}),
    ...(ultimo && ultimoCiclo ? { ultimoAdministrado: `C${ultimoCiclo.numero} em ${(dataCivilNoOffset(ultimo.inicio!, i.offsetServico ?? "-03:00") ?? "data desconhecida")} (${ultimo.status})` } : {}),
  }, campos, laboratoriosFonte, toxicidadesFonte, administracoes, pendencias };
}

const cirurgia = z.object({ tipo: z.literal("CIRURGIA"), id: texto, data: dia, procedimento: texto.nullable(), observacao: z.string().nullable() }).strict();
const rt = z.object({ tipo: z.literal("RT"), id: texto, inicio: dia, fim: dia.nullable(), fracoes: z.number().int().nonnegative().nullable(),
  doseTotalGy: z.number().nonnegative().nullable(), boost: z.string().nullable(), topografia: texto.nullable(), medicoResponsavel: texto.nullable(),
  local: texto.nullable(), observacao: z.string().nullable() }).strict().refine(r => r.fim === null || r.fim >= r.inicio);
/** Cirurgia/RT exigem o formato explícito do histórico; payload incompleto permanece pendente. */
export function projetarHistoricoClinico(i: EntradaContextoClinico) {
  const pendencias: string[] = [], fatos: FatoTratamento[] = [];
  const origens: Record<string, string[]> = {};
  for (const e of eventosVigentes(noEscopo(i)).filter(e => e.tumorLotId === i.tumorLotId)) {
    const d = dadosDoEvento(e);
    if (!["Surgery", "FatoCirurgia", "Radiotherapy", "FatoRadioterapia", "FatoRT"].includes(e.tipo)) continue;
    const p = ["Surgery", "FatoCirurgia"].includes(e.tipo) ? cirurgia.safeParse(d) : rt.safeParse(d);
    if (!p.success) { pendencias.push(e.eventId); continue; }
    const data = p.data.tipo === "CIRURGIA" ? p.data.data : p.data.inicio;
    if (data > (dataCivilNoOffset(i.agora, i.offsetServico ?? "-03:00") ?? "")) continue;
    fatos.push({ ...p.data, id: e.eventId }); origens[e.eventId] = fontes(e);
  }
  return { linhas: projetarHistoricoTratamento(fatos), estado: "PARCIAL" as const,
    codigo: pendencias.length ? "HISTORICO_INVALIDO" : null, pendencias, origens };
}
