import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { DataCivil, Fonte, Instante, type Fonte as TipoFonte } from "../contracts/base.js";
import type { ClinicalEvent } from "../contracts/operacao.js";
import {
  TimelineMulticamadasResposta,
  type EventoTimelineMulticamadas,
  type TimelineMulticamadasCategoria,
  type TimelineMulticamadasTrilha,
  type VisaoTimelineMulticamadas,
} from "../contracts/api/timelineMulticamadas.js";
import { TreatmentAdministration } from "../contracts/clinico.js";
import { dataCivilDoServico } from "../kernel/gateway/tempo.js";
import { listarEventos } from "../kernel/comandos/portas.js";
import { dadosDoEvento, escopoDoEvento } from "../kernel/projections/snapshot.js";
import { FUSO_SERVICO } from "../contracts/f1/relogio.js";

type ContextoTimeline = { patientId: string; encounterId: string; tumorLotId: string | null };
type Dados = Record<string, unknown>;
type TratamentoTimeline = NonNullable<EventoTimelineMulticamadas["tratamento"]>;
type ParametrosEvento = Omit<EventoTimelineMulticamadas, "id" | "eventId" | "patientId" | "encounterId"
  | "tumorLotId" | "tipoEvento" | "revisao" | "supersedido" | "dataRegistro" | "fontes">;

function objeto(valor: unknown): Dados | null {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor) ? valor as Dados : null;
}

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}

function valorTexto(valor: unknown): string | null {
  if (typeof valor === "string") return valor;
  if (typeof valor === "number" || typeof valor === "boolean") return String(valor);
  if (valor === null || valor === undefined) return null;
  try { return JSON.stringify(valor) ?? null; } catch { return null; }
}

function detalhes(...pares: Array<[string, unknown]>): EventoTimelineMulticamadas["detalhes"] {
  return pares.flatMap(([rotulo, valor]) => {
    const representacao = valorTexto(valor);
    return representacao === null ? [] : [{ rotulo, valor: representacao }];
  });
}

/** Clinical dates retain their supplied precision; registration time is never a fallback. */
function dataClinicaValida(valor: unknown): string | null {
  if (typeof valor !== "string" || !valor.trim()) return null;
  if (DataCivil.safeParse(valor).success || Instante.safeParse(valor).success) return valor;
  if (/^\d{4}$/u.test(valor) && Number(valor) >= 1 && Number(valor) <= 9999) return valor;
  if (/^\d{4}-(0[1-9]|1[0-2])$/u.test(valor)) return valor;
  return null;
}

function diaServico(valor: string): string | null {
  if (DataCivil.safeParse(valor).success) return valor;
  const resultado = dataCivilDoServico(valor, FUSO_SERVICO);
  return resultado.estado === "OK" ? resultado.dataCivil : null;
}

function dataFutura(valor: string, hoje: string): boolean {
  const dia = diaServico(valor);
  if (dia) return dia > hoje;
  if (/^\d{4}-\d{2}$/u.test(valor)) return valor > hoje.slice(0, 7);
  if (/^\d{4}$/u.test(valor)) return valor > hoje.slice(0, 4);
  return false;
}

function diaOrdinal(valor: string): number | null {
  const dia = diaServico(valor);
  if (dia) return Date.parse(`${dia}T12:00:00Z`) / 86_400_000;
  if (/^\d{4}-\d{2}$/u.test(valor)) return Date.parse(`${valor}-01T12:00:00Z`) / 86_400_000;
  if (/^\d{4}$/u.test(valor)) return Date.parse(`${valor}-01-01T12:00:00Z`) / 86_400_000;
  return null;
}

function dataDeFontes(fontes: readonly TipoFonte[]): string | null {
  const datas = [...new Set(fontes.map(fonte => dataClinicaValida(fonte.dataClinica)).filter((data): data is string => data !== null))];
  return datas.length === 1 ? datas[0]! : null;
}

function dataDoEvento(dados: Dados, nomes: readonly string[], fontes: readonly TipoFonte[], permitirFonte = true): string | null {
  const explicit = nomes.filter(nome => Object.hasOwn(dados, nome) && dados[nome] !== null && dados[nome] !== undefined);
  if (explicit.length) return dataClinicaValida(dados[explicit[0]!]);
  return permitirFonte ? dataDeFontes(fontes) : null;
}

function campoResumo(evento: ClinicalEvent, dadosEvento: Dados, label: string): string | null {
  const data = dadosEvento;
  if (evento.tipo === "DOCUMENTO") {
    const documento = objeto(data.data);
    return texto(documento?.texto) ?? texto(documento?.titulo) ?? label;
  }
  return texto(data.fraseLaudo) ?? texto(data.textoLaudo) ?? texto(data.resumo) ?? texto(data.rawEvidence);
}

function normalizarCampoFato(dados: Dados): string | null {
  if (typeof dados.domain === "string") return dados.domain;
  if (dados.campo === "TNM") return "stage";
  const campo = texto(dados.campo);
  return campo?.startsWith("extracao.") ? campo.slice("extracao.".length).split(":")[0] ?? null : null;
}

function mapearFato(evento: ClinicalEvent, dados: Dados): Omit<ParametrosEvento, "dataRegistro"> | null {
  const domain = normalizarCampoFato(dados);
  const valor = dados.valor;
  const label = texto(dados.campo) ?? domain ?? "Fato";
  const common = { trecho: texto(dados.rawEvidence), detalhes: detalhes(["Valor", valor]) };
  const campoGlobal = texto(dados.campo);
  if (!domain && campoGlobal && ["alergias", "comorbidades", "exposicoes", "funcaoOrganica", "alturaCm", "medicamentos"].includes(campoGlobal)) {
    const trilha: TimelineMulticamadasTrilha = ["alergias", "comorbidades", "exposicoes"].includes(campoGlobal)
      ? "DEFINIDORES" : campoGlobal === "medicamentos" ? "TRATAMENTO_RESPOSTA" : "FISIOLOGIA";
    return { ...common, categoria: trilha === "DEFINIDORES" ? "DIAGNOSTICO" : trilha === "FISIOLOGIA" ? "FISIOLOGIA" : "TRATAMENTO",
      trilha, titulo: campoGlobal, resumo: valorTexto(valor) ?? label,
      dataClinica: dataDoEvento(dados, ["dataClinica", "factDate", "date"], evento.fontes), dataPlanejada: null, tratamento: null };
  }
  switch (domain) {
    case "diagnosis": return { ...common, categoria: "DIAGNOSTICO", trilha: "DEFINIDORES", titulo: "Diagnóstico", resumo: valorTexto(valor) ?? label,
      dataClinica: dataDoEvento(dados, ["dataClinica", "factDate", "date"], evento.fontes), dataPlanejada: null, tratamento: null };
    case "histology": return { ...common, categoria: "DIAGNOSTICO", trilha: "DEFINIDORES", titulo: "Histologia", resumo: valorTexto(valor) ?? label,
      dataClinica: dataDoEvento(dados, ["dataClinica", "factDate", "date"], evento.fontes), dataPlanejada: null, tratamento: null };
    case "stage": case "metastasis": case "biomarker": return { ...common, categoria: domain === "stage" ? "ESTADIAMENTO" : "DIAGNOSTICO",
      trilha: "DEFINIDORES", titulo: domain === "stage" ? "Estadiamento" : domain === "metastasis" ? "Metástase" : "Biomarcador",
      resumo: valorTexto(valor) ?? label, dataClinica: dataDoEvento(dados, ["dataClinica", "factDate", "date"], evento.fontes),
      dataPlanejada: null, tratamento: null };
    case "imaging": return { ...common, categoria: "IMAGEM", trilha: "TRATAMENTO_RESPOSTA", titulo: "Achado de imagem",
      resumo: valorTexto(valor) ?? label, dataClinica: dataDoEvento(dados, ["dataClinica", "factDate", "date"], evento.fontes),
      dataPlanejada: null, tratamento: null };
    case "lab": return { ...common, categoria: "LABORATORIO", trilha: "FISIOLOGIA", titulo: texto(objeto(valor)?.marker) ?? "Laboratório",
      resumo: valorTexto(valor) ?? label, dataClinica: dataDoEvento(dados, ["dataClinica", "factDate", "date"], evento.fontes),
      dataPlanejada: null, tratamento: null };
    case "symptom": return { ...common, categoria: "SINTOMA", trilha: "SINTOMAS", titulo: "Sintoma",
      resumo: valorTexto(valor) ?? label, dataClinica: dataDoEvento(dados, ["dataClinica", "factDate", "date"], evento.fontes),
      dataPlanejada: null, tratamento: null };
    case "toxicity": return { ...common, categoria: "TOXICIDADE", trilha: "SINTOMAS", titulo: "Toxicidade",
      resumo: valorTexto(valor) ?? label, dataClinica: dataDoEvento(dados, ["dataClinica", "factDate", "date"], evento.fontes),
      dataPlanejada: null, tratamento: null };
    case "drug": case "regimen": case "cycle": case "plan": case "procedure": return { ...common, categoria: "TRATAMENTO",
      trilha: "TRATAMENTO_RESPOSTA", titulo: "Tratamento mencionado", resumo: valorTexto(valor) ?? label,
      dataClinica: dataDoEvento(dados, ["dataClinica", "factDate", "date"], evento.fontes), dataPlanejada: null, tratamento: null };
    default: return null;
  }
}

function mapearAdiamento(dados: Dados, fontes: readonly TipoFonte[]): Omit<ParametrosEvento, "dataRegistro"> | null {
  const valor = objeto(dados.valor);
  if (dados.campo !== "plano.acaoComposta" || valor?.tipo !== "ADIAR_CICLO") return null;
  const antes = objeto(valor.antes), depois = objeto(valor.depois);
  const dataAntes = dataClinicaValida(antes?.previstoEm), dataDepois = dataClinicaValida(depois?.previstoEm);
  if (!dataAntes || !dataDepois || !DataCivil.safeParse(dataAntes).success || !DataCivil.safeParse(dataDepois).success) return null;
  const motivo = texto(valor.motivo);
  return { categoria: "ADIAMENTO", trilha: "TRATAMENTO_RESPOSTA", titulo: "Ciclo adiado",
    resumo: motivo ?? `Data prevista alterada de ${dataAntes} para ${dataDepois}.`,
    dataClinica: dataDoEvento(dados, ["dataClinica"], fontes), dataPlanejada: dataDepois,
    trecho: motivo, detalhes: detalhes(["Data prevista anterior", dataAntes], ["Nova data prevista", dataDepois], ["Motivo", motivo]),
    tratamento: { estado: "ADIADO", atrasoDias: null } };
}

function mapearEvento(evento: ClinicalEvent, dados: Dados,
  ciclos: ReadonlyMap<string, Dados>): EventoTimelineMulticamadas[] {
  const fonteData = evento.fontes;
  const make = (parametros: Omit<ParametrosEvento, "dataRegistro">, id = evento.eventId): EventoTimelineMulticamadas => ({
    id, eventId: evento.eventId, patientId: evento.patientId, encounterId: evento.encounterId, tumorLotId: evento.tumorLotId,
    tipoEvento: evento.tipo, ...parametros, dataRegistro: evento.criadoEm, revisao: evento.revisao as "CONFIRMADO" | "ASSINADO",
    supersedido: false, fontes: fonteData,
  });
  switch (evento.tipo) {
    case "FATO": {
      const adiamento = mapearAdiamento(dados, fonteData);
      if (adiamento) return [make(adiamento)];
      const fato = mapearFato(evento, dados);
      return fato ? [make(fato)] : [];
    }
    case "Biopsy": return [make({ categoria: "DIAGNOSTICO", trilha: "DEFINIDORES", titulo: "Biópsia",
      resumo: texto(dados.tipo) ?? "Biópsia confirmada", dataClinica: dataDoEvento(dados, ["dataClinica", "data"], fonteData),
      dataPlanejada: null, trecho: campoResumo(evento, dados, "Biópsia"), detalhes: detalhes(["Tipo", dados.tipo], ["Local", dados.localizacao]), tratamento: null })];
    case "Staging": return [make({ categoria: "ESTADIAMENTO", trilha: "DEFINIDORES", titulo: dados.tipo === "RESTAGING" ? "Reestadiamento" : "Estadiamento",
      resumo: texto(dados.tnm) ?? texto(dados.estadiamento) ?? "Estadiamento confirmado", dataClinica: dataDoEvento(dados, ["dataClinica"], fonteData),
      dataPlanejada: null, trecho: texto(dados.rawEvidence), detalhes: detalhes(["Tipo", dados.tipo], ["TNM", dados.tnm], ["Estádio", dados.estadio]), tratamento: null })];
    case "LabResult": return [make({ categoria: "LABORATORIO", trilha: "FISIOLOGIA", titulo: texto(dados.campo) ?? "Resultado laboratorial",
      resumo: `${texto(dados.campo) ?? "Resultado"}: ${valorTexto(dados.valor) ?? "valor não consta"}${texto(dados.unidade) ? ` ${texto(dados.unidade)}` : ""}`,
      dataClinica: dataDoEvento(dados, ["data"], fonteData), dataPlanejada: null, trecho: texto(dados.rawEvidence),
      detalhes: detalhes(["Valor", dados.valor], ["Unidade", dados.unidade]), tratamento: null })];
    case "Weight": return [make({ categoria: "FISIOLOGIA", trilha: "FISIOLOGIA", titulo: "Peso",
      resumo: `${valorTexto(dados.kg) ?? "valor não consta"} kg`, dataClinica: dataDoEvento(dados, ["data"], fonteData), dataPlanejada: null,
      trecho: texto(dados.rawEvidence), detalhes: detalhes(["Origem", dados.origem], ["Peso (kg)", dados.kg]), tratamento: null })];
    case "TreatmentEpisode": {
      const inicio = objeto(dados.inicio);
      const dataInicio = inicio?.campo === "PRESENTE" ? dataClinicaValida(inicio.valor) : null;
      const esquema = texto(dados.esquemaId) ?? "Esquema não informado";
      return [make({ categoria: "TRATAMENTO", trilha: "TRATAMENTO_RESPOSTA", titulo: "Episódio de tratamento",
        resumo: esquema, dataClinica: dataInicio, dataPlanejada: null, trecho: texto(dados.rawEvidence),
        detalhes: detalhes(["Modalidade", dados.modalidade], ["Linha", dados.linha], ["Esquema", dados.esquemaId],
          ["Início registrado", dataInicio], ["Fim registrado", objeto(dados.fim)?.campo === "PRESENTE" ? objeto(dados.fim)?.valor : null]),
        tratamento: { estado: "PLANEJADO", atrasoDias: null } })];
    }
    case "Ciclo": {
      const prescrito = !!objeto(dados.prescricaoRef);
      const dataPrevista = DataCivil.safeParse(dados.previstoEm).success ? String(dados.previstoEm) : null;
      return [make({ categoria: "CICLO", trilha: "TRATAMENTO_RESPOSTA", titulo: `Ciclo ${valorTexto(dados.numero) ?? ""}`.trim(),
        resumo: prescrito ? "Ciclo com prescrição referenciada." : "Ciclo planejado; prescrição não consta.",
        dataClinica: null, dataPlanejada: dataPrevista, trecho: texto(dados.rawEvidence),
        detalhes: detalhes(["Ciclo", dados.numero], ["Previsto para", dataPrevista], ["Episódio", dados.episodioId],
          ["Prescrição", objeto(dados.prescricaoRef)?.documentId]),
        tratamento: { estado: prescrito ? "PRESCRITO" : "PLANEJADO", atrasoDias: null } })];
    }
    case "TreatmentCycle": return [make({ categoria: "CICLO", trilha: "TRATAMENTO_RESPOSTA", titulo: "Ciclo registrado",
      resumo: "Marco de ciclo persistido; não substitui registro de administração efetiva.",
      dataClinica: dataDoEvento(dados, ["dataClinica"], fonteData), dataPlanejada: null, trecho: texto(dados.rawEvidence),
      detalhes: detalhes(["Linha", dados.linha], ["Ciclo", dados.ciclo], ["Esquema", dados.esquema]), tratamento: null })];
    case "TreatmentAdministration": {
      const parsed = TreatmentAdministration.safeParse((({ dataClinica: _dataClinica, dataPrevista: _dataPrevista, ...rest }) => rest)(dados));
      if (!parsed.success) return [];
      const administration = parsed.data;
      const ciclo = ciclos.get(administration.cicloId);
      const dataClinica = dataDoEvento(dados, ["dataClinica", "inicio"], fonteData, false);
      const dataPlanejada = DataCivil.safeParse(dados.dataPrevista).success ? String(dados.dataPrevista)
        : DataCivil.safeParse(ciclo?.previstoEm).success ? String(ciclo?.previstoEm) : null;
      const actualDay = dataClinica ? diaServico(dataClinica) : null;
      const atraso = actualDay && dataPlanejada && administration.status !== "OMITIDA"
        ? Math.max(0, Math.round((Date.parse(`${actualDay}T12:00:00Z`) - Date.parse(`${dataPlanejada}T12:00:00Z`)) / 86_400_000)) : null;
      const estado = administration.status === "OMITIDA" ? "OMITIDO"
        : administration.status === "INTERROMPIDA" ? "INTERROMPIDO"
          : administration.status === "PARCIAL" ? "ADMINISTRADO_PARCIAL" : "ADMINISTRADO";
      return [make({ categoria: "ADMINISTRACAO", trilha: "TRATAMENTO_RESPOSTA", titulo: `${estado}: ${administration.droga}`,
        resumo: administration.motivo ?? `${administration.status} · ${administration.droga}`,
        dataClinica, dataPlanejada, trecho: texto(dados.rawEvidence),
        detalhes: detalhes(["Situação", administration.status], ["Ciclo", administration.cicloId], ["Droga", administration.droga],
          ["Dose efetiva (mg)", administration.quantidadeEfetivaMg], ["Motivo", administration.motivo], ["Atraso observado (dias)", atraso]),
        tratamento: { estado, atrasoDias: atraso } })];
    }
    case "Surgery": case "FatoCirurgia": return [make({ categoria: "CIRURGIA", trilha: "TRATAMENTO_RESPOSTA",
      titulo: "Cirurgia", resumo: texto(dados.procedimento) ?? "Procedimento cirúrgico registrado",
      dataClinica: dataDoEvento(dados, ["data"], fonteData), dataPlanejada: null, trecho: texto(dados.observacao),
      detalhes: detalhes(["Procedimento", dados.procedimento], ["Observação", dados.observacao]), tratamento: null })];
    case "Radiotherapy": case "FatoRadioterapia": case "FatoRT": return [make({ categoria: "RADIOTERAPIA", trilha: "TRATAMENTO_RESPOSTA",
      titulo: "Radioterapia", resumo: texto(dados.topografia) ?? "Radioterapia registrada",
      dataClinica: dataDoEvento(dados, ["inicio"], fonteData), dataPlanejada: null, trecho: texto(dados.observacao),
      detalhes: detalhes(["Início", dados.inicio], ["Fim", dados.fim], ["Frações", dados.fracoes], ["Dose total (Gy)", dados.doseTotalGy],
        ["Topografia", dados.topografia], ["Local", dados.local]), tratamento: null })];
    case "DOCUMENTO": case "SignedDocument": case "DocumentSigned": {
      const documento = objeto(dados.data) ?? dados;
      const textoDocumento = texto(documento.texto);
      return [make({ categoria: "DOCUMENTO", trilha: "DOCUMENTOS", titulo: texto(documento.titulo) ?? "Documento assinado",
        resumo: `${texto(documento.documentId) ?? "Documento"} · versão ${valorTexto(documento.documentVersion) ?? "não informada"}`,
        dataClinica: dataDoEvento(documento, ["dataClinica", "data"], fonteData), dataPlanejada: null, trecho: textoDocumento,
        detalhes: detalhes(["Documento", documento.documentId], ["Versão", documento.documentVersion], ["Texto", textoDocumento]), tratamento: null })];
    }
    case "ImagingReport": case "ExameLaudo": {
      const trecho = texto(dados.fraseLaudo) ?? texto(dados.textoLaudo) ?? texto(dados.resumo) ?? valorTexto(dados.achados);
      return [make({ categoria: "IMAGEM", trilha: "DOCUMENTOS", titulo: texto(dados.nome) ?? "Laudo de imagem",
        resumo: trecho ?? "Laudo sem trecho textual", dataClinica: dataDoEvento(dados, ["dataClinica"], fonteData), dataPlanejada: null,
        trecho, detalhes: detalhes(["Nome", dados.nome], ["Situação", dados.situacao]), tratamento: null })];
    }
    case "RecistSerie": {
      const pontos = Array.isArray(dados.pontos) ? dados.pontos : [];
      return pontos.flatMap((valor) => {
        const ponto = objeto(valor);
        if (!ponto) return [];
        const fecha = dataClinicaValida(ponto.data);
        if (!fecha) return [];
        const lesoes = Array.isArray(ponto.lesoes) ? ponto.lesoes : [];
        return [make({ categoria: "RECIST", trilha: "TRATAMENTO_RESPOSTA", titulo: "Medidas RECIST registradas",
          resumo: "Medidas persistidas; a timeline não recalcula resposta.", dataClinica: fecha, dataPlanejada: null, trecho: null,
          detalhes: detalhes(["Método", ponto.metodo], ["Qualidade da medição", ponto.qualidadeMedicao],
            ["Lesões", lesoes.map(item => { const lesion = objeto(item); return lesion ? `${valorTexto(lesion.codigo) ?? "alvo"}: ${valorTexto(lesion.diametroMm) ?? "?"} mm` : null; }).filter(Boolean).join("; ")],
            ["Novas lesões", ponto.novasLesoes], ["Fontes", Array.isArray(ponto.fonteIds) ? ponto.fonteIds.join(", ") : null]), tratamento: null },
        `${evento.eventId}:${texto(ponto.eventId) ?? fecha}`)];
      });
    }
    default: return [];
  }
}

function compararEventos(a: EventoTimelineMulticamadas, b: EventoTimelineMulticamadas): number {
  const aDate = a.dataClinica ?? a.dataPlanejada, bDate = b.dataClinica ?? b.dataPlanejada;
  const aOrdinal = aDate ? diaOrdinal(aDate) : null, bOrdinal = bDate ? diaOrdinal(bDate) : null;
  if (aOrdinal !== null && bOrdinal !== null && aOrdinal !== bOrdinal) return aOrdinal - bOrdinal;
  if (aOrdinal !== null && bOrdinal === null) return -1;
  if (aOrdinal === null && bOrdinal !== null) return 1;
  return a.dataRegistro.localeCompare(b.dataRegistro) || a.id.localeCompare(b.id);
}

/** Projeção pura do ledger; não cria fatos, datas clínicas ou coordenadas anatômicas. */
export function lerTimelineMulticamadas(db: DatabaseSync, contexto: ContextoTimeline, agora: string): VisaoTimelineMulticamadas {
  const ctx = TimelineMulticamadasResposta.shape.contexto.parse(contexto);
  const instante = Instante.parse(agora);
  const hojeResult = dataCivilDoServico(instante, FUSO_SERVICO);
  if (hojeResult.estado !== "OK") throw new Error("INSTANTE_INVALIDO");
  const agoraMs = Date.parse(instante), hoje = hojeResult.dataCivil;
  const todosPaciente = listarEventos(db, ctx.patientId).filter(event => event.patientId === ctx.patientId);
  const relevantes = todosPaciente.filter(event =>
    ((event.tipo === "TreatmentAdministration" && event.tumorLotId === ctx.tumorLotId)
      || (event.tipo !== "TreatmentAdministration" && (escopoDoEvento(event) === "PACIENTE"
        || event.tumorLotId === ctx.tumorLotId || event.tumorLotId === null)))
    && Date.parse(event.criadoEm) <= agoraMs
    && (event.revisao === "CONFIRMADO" || event.revisao === "ASSINADO"));
  const ciclos = new Map<string, Dados>();
  for (const event of relevantes) {
    if (event.tipo !== "Ciclo") continue;
    const value = objeto(dadosDoEvento(event));
    if (typeof value?.cicloId === "string") ciclos.set(value.cicloId, value);
  }
  const candidatos = relevantes.flatMap((event) => {
    const data = dadosDoEvento(event);
    if (!data) return [];
    return mapearEvento(event, data, ciclos).filter(item => {
      if (!item.dataClinica || !dataFutura(item.dataClinica, hoje)) return true;
      return item.tratamento?.estado === "PLANEJADO" || item.tratamento?.estado === "PRESCRITO";
    });
  });
  const candidatosVisiveis = new Set(candidatos.map(item => item.eventId));
  const supersedidos = new Set(relevantes.filter(event => candidatosVisiveis.has(event.eventId))
    .map(event => event.supersedesEventId).filter((id): id is string => id !== null));
  const eventos = candidatos.map(item => ({ ...item, supersedido: supersedidos.has(item.eventId) })).sort(compararEventos);
  const revisao = createHash("sha256").update(JSON.stringify(eventos)).digest("hex");
  return TimelineMulticamadasResposta.parse({ contexto: ctx, revisao, eventos });
}
