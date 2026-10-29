import { montarFichaMinima } from "../../modules/consulta/revisaoClinica.js";
import { DataCivil, Instante } from "../../contracts/base.js";
import { Retrato, type FatoRetrato } from "../../contracts/f1/retrato.js";
import type { ExameRecenteFlash } from "../../contracts/api/flash.js";

type Contexto = { patientId: string; encounterId: string; tumorLotId: string | null; hoje: string };
type LabExibido = ExameRecenteFlash & { eventId?: string; sourceIds?: string[]; fatos?: FatoRetrato["ref"][] };
type Ponto = { exame: LabExibido; valor: string; fontes: string[]; fatos: FatoRetrato["ref"][]; extraido: boolean };
const objeto = (v: unknown): Record<string, unknown> | null => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null;
const texto = (v: unknown) => typeof v === "string" ? v.trim() : "";
const chave = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
// Apenas aliases de apresentação; nenhuma conversão de unidade ou referência clínica.
const analito = (s: string) => ["hb", "hgb", "hemoglobina"].includes(chave(s)) ? "hemoglobina" : chave(s);
const referencias = (f: FatoRetrato) => [...new Set(f.fontes.map(s => s.sourceId))].sort();
const textoQualificado = (s: string) => /\?|\b(?:suspeit[ao]|incert[oa]|nega|negad[oa]|nao ha|nao confirmad[oa]|ausencia de|sem (?:evidencia|neoplasia|cancer|carcinoma|tumor|metastase))\b/.test(chave(s));
function qualificado(d: Record<string, unknown>): boolean {
  return d.negated === true || d.negado === true || d.presente === false || d.suspeita === true
    || ["INCERTO", "UNCERTAIN", "INFERRED", "CONFLITO", "PENDENTE", "SUSPEITA", "NEGADO", "NEGATED"]
      .some(v => [d.status, d.certeza, d.provenance].includes(v));
}
function dataValida(data: string | null, i: Contexto, r: Retrato): data is string {
  if (!data) return false;
  return DataCivil.safeParse(data).success ? data <= i.hoje
    : Instante.safeParse(data).success && Date.parse(data) <= Date.parse(r.geradoEm);
}
function pontoLegado(exame: ExameRecenteFlash): Ponto {
  const frase = exame.fraseLaudo ?? "";
  const partes = /^([+-]?(?:\d+(?:[.,]\d+)?|\.\d+))\s+(.+?)(?:\s+[—·].*)?$/.exec(frase.trim());
  const metadados = exame as LabExibido;
  return { exame: { ...exame }, valor: partes ? `${Number(partes[1]!.replace(",", "."))} ${partes[2]!.trim()}` : frase,
    fontes: [...(metadados.sourceIds ?? [])], fatos: [...(metadados.fatos ?? [])], extraido: false };
}
function combinarLaboratorios(legados: readonly ExameRecenteFlash[], novos: Ponto[]): LabExibido[] {
  if (!novos.length) return [...legados];
  const pontos = [...legados.map(pontoLegado), ...novos];
  const agrupados = new Map<string, Ponto>();
  for (const p of pontos) {
    const id = JSON.stringify([analito(p.exame.nome), p.exame.data, p.valor]);
    const anterior = agrupados.get(id);
    if (!anterior) { agrupados.set(id, p); continue; }
    anterior.fontes = [...new Set([...anterior.fontes, ...p.fontes])].sort();
    anterior.fatos = [...new Map([...anterior.fatos, ...p.fatos].map(f => [`${f.eventId}@${f.revisao}`, f])).values()];
    anterior.extraido ||= p.extraido;
  }
  const unicos = [...agrupados.values()];
  const nomesNovos = new Set(novos.map(p => analito(p.exame.nome)));
  return unicos.flatMap(p => {
    const nome = analito(p.exame.nome), serie = unicos.filter(q => analito(q.exame.nome) === nome);
    const tempoAmbiguo = nomesNovos.has(nome) && serie.some(q => !DataCivil.safeParse(q.exame.data).success);
    const conflito = tempoAmbiguo || serie.some(q => q.exame.data === p.exame.data && q.valor !== p.valor)
      || /A CONFERIR/.test(p.exame.fraseLaudo ?? "");
    // Mantém a política de exibição já usada no Flash: último resultado e conflitos.
    if (nomesNovos.has(nome) && !conflito && serie.some(q => q.exame.data > p.exame.data)) return [];
    if (!p.extraido && !conflito) return [{ ...p.exame, sourceIds: p.fontes, fatos: p.fatos }];
    const frase = p.exame.fraseLaudo ?? p.valor;
    return [{ ...p.exame, fraseLaudo: `${frase}${conflito && !frase.includes("A CONFERIR")
      ? ` — A CONFERIR: ${tempoAmbiguo ? "datas com precisão ou formato diferentes" : "resultados divergentes"}` : ""}`
      + (p.fontes.length ? ` · fontes: ${p.fontes.join(", ")}` : ""),
      ...(conflito ? { situacao: "SEM_REFERENCIA" as const } : {}), sourceIds: p.fontes, fatos: p.fatos }];
  });
}

/** Adaptação de EXIBIÇÃO. Consome o retrato filtrado; não cria fatos, ranges ou entradas para regras. */
export function fatosConfirmadosFlash(i: Contexto & { retrato?: unknown; diagnostico: string | undefined;
  conflitoCabecalho: boolean; laboratorios: readonly ExameRecenteFlash[] }) {
  const avisos: string[] = [], novos: Ponto[] = [], diagnosticos = new Map<string, { texto: string; fontes: string[] }>();
  const parsed = Retrato.safeParse(i.retrato);
  const legado = { diagnostico: i.diagnostico, laboratorios: [...i.laboratorios], avisos };
  if (!parsed.success) {
    if (i.retrato !== undefined) {
      avisos.push("Flash A CONFERIR: retrato de fatos inválido.");
      return { ...legado, laboratorios: [] };
    }
    return legado;
  }
  const r = parsed.data, refs = new Set(r.fatos.map(f => `${f.ref.eventId}@${f.ref.revisao}`));
  if (r.patientId !== i.patientId || r.encounterId !== i.encounterId || r.tumorLotId !== i.tumorLotId
    || new Set(r.fatos.map(f => f.ref.eventId)).size !== r.fatos.length
    || r.fatos.some(f => f.patientId !== i.patientId || f.escopo === "TUMOR" && f.tumorLotId !== i.tumorLotId)
    || r.resumo.some(s => s.fatos.some(f => !refs.has(`${f.eventId}@${f.revisao}`)))) {
    avisos.push("Flash A CONFERIR: contexto ou referências do retrato divergentes."); return { ...legado, laboratorios: [] };
  }
  const impedidos = new Set(r.integridade.map(p => p.eventoId));
  // O Flash legado também pode trazer eventos posteriores. Sua referência tem
  // de existir no retrato histórico antes de participar de qualquer combinação.
  const legadosNoRetrato = i.laboratorios.flatMap(l => {
    const eventId = (l as LabExibido).eventId;
    if (typeof eventId !== "string" || !eventId) {
      avisos.push(`Laboratório ${l.nome} PENDENTE: resultado legado sem referência verificável no retrato.`);
      return [];
    }
    const fato = r.fatos.find(f => f.ref.eventId === eventId && f.tipo === "LabResult" && !impedidos.has(eventId));
    return fato ? [{ ...l, eventId, sourceIds: referencias(fato), fatos: [fato.ref] }] : [];
  });
  let diagnosticoQualificado = false;
  for (const f of r.fatos) {
    const d = f.dados;
    if (f.tipo !== "FATO" || impedidos.has(f.ref.eventId) || d.campo !== f.campo
      || !f.fontes.length || typeof d.sourceId !== "string" || !f.fontes.some(s => s.sourceId === d.sourceId)
      || d.evidence !== "EXPLICIT" || d.requiresConfirmation !== false
      || Date.parse(f.tempoRegistro) > Date.parse(r.geradoEm)) continue;
    const valor = objeto(d.valor), fontes = referencias(f);
    if (f.campo?.startsWith("extracao.lab:") && d.domain === "lab") {
      if (qualificado(d) || valor && qualificado(valor) || !valor
        || !texto(valor.marker) || analito(f.campo.slice("extracao.lab:".length)) !== analito(texto(valor.marker))
        || typeof valor.value !== "number" || !Number.isFinite(valor.value) || !texto(valor.unit)) continue;
      // O adaptador laboratorial usa somente a data civil canônica. Instantes não
      // ganham uma ordem artificial por comparação de strings ou perda do offset.
      if (!DataCivil.safeParse(f.tempoClinico).success) {
        avisos.push(`Laboratório ${texto(valor.marker)} A CONFERIR: data civil de coleta não disponível (${f.tempoClinico ?? "NÃO CONSTA"}); fontes: ${fontes.join(", ")}.`);
        continue;
      }
      if (!dataValida(f.tempoClinico, i, r)) continue;
      const literal = `${valor.value} ${texto(valor.unit)}`;
      novos.push({ exame: { data: f.tempoClinico, nome: texto(valor.marker), fraseLaudo: literal, situacao: "SEM_REFERENCIA" },
        valor: literal, fontes, fatos: [f.ref], extraido: true });
    }
    if (f.campo === "extracao.diagnosis" && d.domain === "diagnosis"
      && f.escopo === "TUMOR" && f.tumorLotId === i.tumorLotId
      && (i.tumorLotId !== null || f.encounterId === i.encounterId)) {
      const literal = texto(d.valor) || texto(valor?.raw);
      if (!literal || f.tempoClinico !== null && !dataValida(f.tempoClinico, i, r)) continue;
      if (qualificado(d) || valor && qualificado(valor) || textoQualificado(literal)) {
        diagnosticoQualificado = true;
        avisos.push(`Diagnóstico A CONFERIR: ${literal}; negação ou qualificação preservada; fontes: ${fontes.join(", ")}.`);
        continue;
      }
      const anterior = diagnosticos.get(chave(literal));
      diagnosticos.set(chave(literal), { texto: anterior?.texto ?? literal,
        fontes: [...new Set([...(anterior?.fontes ?? []), ...fontes])].sort() });
    }
  }
  const candidatos = [...diagnosticos.values()], valores = candidatos.map(d => `${d.texto} (fontes: ${d.fontes.join(", ")})`).join(" | ");
  if (i.tumorLotId === null && candidatos.length) avisos.push("Diagnóstico literal do encontro atual; lote tumoral não vinculado.");
  let diagnostico = i.diagnostico;
  if (i.conflitoCabecalho) {
    diagnostico = "A CONFERIR — cabeçalho diagnóstico em conflito";
    if (candidatos.length) avisos.push(`Diagnóstico extraído preservado para conferência: ${valores}.`);
  } else if (candidatos.length > 1 || diagnosticoQualificado && candidatos.length) {
    diagnostico = "A CONFERIR — afirmações diagnósticas divergentes";
    avisos.push(`Diagnósticos documentados A CONFERIR, sem eleição automática: ${valores}.`);
  } else if (candidatos.length === 1) {
    const unico = candidatos[0]!;
    if (diagnostico && chave(diagnostico) !== chave(unico.texto))
      avisos.push(`Diagnóstico A CONFERIR: cabeçalho "${diagnostico}"; extração "${unico.texto}" (fontes: ${unico.fontes.join(", ")}). Descrições diferentes preservadas.`);
    else {
      diagnostico ??= unico.texto;
      avisos.push(`Fonte do diagnóstico confirmado: ${unico.fontes.join(", ")}.`);
    }
  }
  return { diagnostico, laboratorios: combinarLaboratorios(legadosNoRetrato, novos), avisos };
}

/** Contexto documentado, com datas visíveis; não avalia aptidão ao tratamento. */
export function contextoDocumentadoFlash(i: Contexto & { retrato?: unknown }): { ecog?: string; biomarcador?: string } {
  const parsed = Retrato.safeParse(i.retrato);
  if (!parsed.success) return {};
  const r = parsed.data;
  if (r.patientId !== i.patientId || r.encounterId !== i.encounterId || r.tumorLotId !== i.tumorLotId
    || r.fatos.some(f => f.patientId !== i.patientId || f.escopo === "TUMOR" && f.tumorLotId !== i.tumorLotId)) return {};
  const fatos = r.fatos.filter(f => !r.integridade.some(p => p.eventoId === f.ref.eventId)
    && (f.tempoClinico === null || dataValida(f.tempoClinico, i, r)));
  const ecog = montarFichaMinima({ ...r, fatos }).find(f => f.id === "ecog");
  const candidatos = fatos.filter(f => f.tipo === "FATO" && f.dados.domain === "biomarker"
    && f.campo?.startsWith("extracao.biomarker") && f.fontes.length
    && (!Object.hasOwn(f.dados, "sourceId") || f.fontes.some(fonte => fonte.sourceId === f.dados.sourceId))
    && (f.tumorLotId !== null ? f.tumorLotId === i.tumorLotId : f.encounterId === i.encounterId)).flatMap(f => {
    const v = objeto(f.dados.valor), literal = texto(v?.raw) || (texto(v?.marker) && (typeof v?.value === "string" || typeof v?.value === "number") ? `${v.marker}: ${v.value}` : "");
    if (!literal) return [];
    const conferir = qualificado(f.dados) || !!v && qualificado(v) || f.dados.requiresConfirmation !== false || f.dados.evidence !== "EXPLICIT"
      || /\?|\b(?:suspeit[oa]s?|inconclusiv[oa]s?|indeterminad[oa]s?|incert[oa]s?|equivoc[oa]s?|possivel|duvidos[oa]s?|pendente|a confirmar|a esclarecer)\b/.test(chave(literal));
    const marcador = texto(v?.marker);
    const valor = typeof v?.value === "string" ? chave(v.value) : typeof v?.value === "number" ? String(v.value) : chave(literal);
    return [{ f, literal, conferir, valor, grupo: marcador && f.tempoClinico ? JSON.stringify([chave(marcador), f.tempoClinico]) : null }];
  });
  const valoresPorGrupo = new Map<string, Set<string>>();
  for (const c of candidatos) {
    if (!c.grupo) continue;
    const valores = valoresPorGrupo.get(c.grupo) ?? new Set<string>();
    valores.add(c.valor); valoresPorGrupo.set(c.grupo, valores);
  }
  const marcadores = candidatos.map(c => {
    const conflito = c.grupo !== null && (valoresPorGrupo.get(c.grupo)?.size ?? 0) > 1;
    return `${c.conferir || conflito ? "A CONFERIR: " : ""}${c.literal} · ${c.f.tempoClinico ?? "data não informada"} · fontes: ${referencias(c.f).join(", ")}`;
  });
  return {
    ...(ecog && ecog.estado !== "PENDENTE" ? { ecog: `${ecog.estado === "CONFLITANTE" ? "A CONFERIR" : String(ecog.valor)} · ${ecog.data ?? "data não informada"} · fontes: ${ecog.fontes.map(f => f.sourceId).join(", ")}` } : {}),
    ...(marcadores.length ? { biomarcador: marcadores.join(" | ") } : {}),
  };
}
