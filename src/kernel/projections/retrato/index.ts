import { createHash } from "node:crypto";
import { DataCivil, Instante } from "../../../contracts/base.js";
import { validarPayloadEvento } from "../../../contracts/envelope.js";
import { Fonte } from "../../../contracts/base.js";
import { ClinicalEvent } from "../../../contracts/operacao.js";
import { Retrato, type FatoRetrato } from "../../../contracts/f1/retrato.js";
import { substituicoesValidas } from "../../ledger/supersessao.js";

export interface ContextoRetrato {
  patientId: string; encounterId: string; tumorLotId: string | null; agora: string;
  regras: Retrato["regras"]; biblioteca: Retrato["biblioteca"];
}
/** JSON canônico: não aceita valores não persistíveis nem usa ordem de inserção. */
function canonico(valor: unknown): string {
  if (valor === null || typeof valor === "string" || typeof valor === "boolean") return JSON.stringify(valor);
  if (typeof valor === "number" && Number.isFinite(valor)) return JSON.stringify(valor);
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(",")}]`;
  if (valor && typeof valor === "object" && Object.getPrototypeOf(valor) === Object.prototype)
    return `{${Object.keys(valor).sort().map(k => `${JSON.stringify(k)}:${canonico((valor as Record<string, unknown>)[k])}`).join(",")}}`;
  throw new Error("CONTEUDO_NAO_CANONICO");
}
export function hashCanonico(valor: unknown): string { return createHash("sha256").update(canonico(valor)).digest("hex"); }
function dados(e: ClinicalEvent): Record<string, unknown> | null {
  if (!e.payload || typeof e.payload !== "object" || Array.isArray(e.payload)) return null;
  const data = (e.payload as Record<string, unknown>).data;
  return data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : null;
}
const normalizarChave = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const sistemicos = new Set(["alergias", "alergia", "comorbidades", "medicamentos", "medicacao", "funcaoorganica", "exposicoes", "exposicaocumulativa", "cumulativos", "dosecumulativa", "alturacm"]);
const materiaisConhecidos = new Set(["Paciente", "TumorLot", "Weight", "ImagingReport", "Biopsy", "TreatmentEpisode", "Ciclo", "DOCUMENTO",
  "LabResult", "TreatmentAdministration", "TreatmentCycle", "SignedDocument", "DocumentSigned",
  "Triagem", "Triagem@1", "TumorLot@1"]);
function escopo(e: ClinicalEvent, d: Record<string, unknown>): FatoRetrato["escopo"] {
  const campo = normalizarChave(String(d.campo));
  return sistemicos.has(campo) || campo.startsWith("extracao.lab:") || campo === "extracao.drug"
    || ["Paciente", "Weight", "LabResult", "TreatmentAdministration"].includes(e.tipo) ? "PACIENTE" : "TUMOR";
}
function tempo(d: Record<string, unknown>, e: ClinicalEvent): string | null {
  for (const chave of ["dataClinica", "factDate", "data", "date"]) if (typeof d[chave] === "string") return d[chave] as string;
  const datas = [...new Set(e.fontes.map(f => f.dataClinica).filter((v): v is string => v !== null))];
  return datas.length === 1 ? datas[0]! : null;
}
function ordem(a: ClinicalEvent, b: ClinicalEvent): number {
  return Date.parse(a.criadoEm) - Date.parse(b.criadoEm) || a.operationId.localeCompare(b.operationId)
    || a.eventIndex - b.eventIndex || a.eventId.localeCompare(b.eventId);
}
function consulta(e: ClinicalEvent): boolean {
  return ["ConsultaConfirmada", "ConsultaConfirmada@1"].includes(e.tipo) && validarPayloadEvento(e.tipo, dados(e)).ok;
}
const diaClinico = (instante: number) => new Date(instante - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
const objeto = (v: unknown): Record<string, unknown> | null => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null;

/** O fechamento Flash registra o dia da assinatura, não declara a data da consulta.
 * A exceção exige o conjunto exato de documentos assinados na mesma operação. */
function fechamentoFlash(e: ClinicalEvent, operacao: readonly ClinicalEvent[]): boolean {
  if (!consulta(e) || e.criadoPor.tipo !== "SESSAO" || e.supersedesEventId !== null
    || dados(e)?.dataClinica !== diaClinico(Date.parse(e.criadoEm))) return false;
  const refs = dados(e)!.documentoIds as { documentId: string; documentVersion: number }[];
  const documentos = operacao.filter(d => d.tipo === "DOCUMENTO");
  const chave = (id: string, versao: number) => JSON.stringify([id, versao]);
  const esperados = new Set(refs.map(r => chave(r.documentId, r.documentVersion)));
  const encontrados = new Set<string>();
  if (esperados.size !== refs.length || documentos.length !== refs.length) return false;
  let temFlash = false;
  for (const doc of documentos) {
    const d = dados(doc), corpo = objeto(d?.data), assinatura = objeto(d?.signature), ctx = objeto(corpo?.contexto);
    if (doc.revisao !== "ASSINADO" || !validarPayloadEvento(doc.tipo, d).ok || !corpo || !assinatura
      || doc.patientId !== e.patientId || doc.encounterId !== e.encounterId || doc.tumorLotId !== e.tumorLotId
      || doc.operationId !== e.operationId || doc.criadoPor.tipo !== "SESSAO" || doc.criadoPor.id !== e.criadoPor.id
      || Date.parse(doc.criadoEm) !== Date.parse(e.criadoEm)
      || ctx?.encounterId !== e.encounterId || ctx?.tumorLotId !== e.tumorLotId
      || (ctx.patientId !== undefined && ctx.patientId !== e.patientId)
      || assinatura.documentId !== corpo.documentId || assinatura.documentVersion !== corpo.documentVersion
      || assinatura.serverActorId !== e.criadoPor.id
      || assinatura.reviewDecisionId !== objeto(e.payload)?.reviewDecisionId
      || assinatura.reviewDecisionId !== objeto(doc.payload)?.reviewDecisionId) return false;
    try { if (assinatura.documentHash !== hashCanonico(corpo)) return false; } catch { return false; }
    const ref = chave(String(corpo.documentId), Number(corpo.documentVersion));
    if (!esperados.has(ref) || encontrados.has(ref)) return false;
    encontrados.add(ref);
    temFlash ||= corpo.origem === "CONSULTA_FLASH" && typeof corpo.tipoDocumento === "string" && corpo.tipoDocumento.startsWith("FLASH_");
  }
  return temFlash;
}
function documentoFlash(e: ClinicalEvent): boolean {
  const corpo = objeto(dados(e)?.data);
  return e.tipo === "DOCUMENTO" && (corpo?.origem === "CONSULTA_FLASH"
    || typeof corpo?.tipoDocumento === "string" && corpo.tipoDocumento.startsWith("FLASH_"));
}
/** Indício identifica a tentativa; nunca valida assinatura nem confere data clínica. */
function classificarMarco(e: ClinicalEvent, operacao: readonly ClinicalEvent[], documentosFlash: readonly ClinicalEvent[],
  operacaoComFalha: boolean): "TECNICO_VALIDO" | "TECNICO_INVALIDO" | "CLINICO" {
  const idDoProdutor = createHash("sha256").update(`${e.operationId}:consulta-confirmada`).digest("hex");
  const refs = dados(e)?.documentoIds;
  const ids = new Set(Array.isArray(refs) ? refs.flatMap(r => typeof objeto(r)?.documentId === "string" ? [objeto(r)!.documentId] : []) : []);
  const tentativa = e.eventId === idDoProdutor || documentosFlash.some(doc => doc.operationId === e.operationId
    || ids.has(objeto(dados(doc)?.data)?.documentId) || ids.has(objeto(dados(doc)?.signature)?.documentId));
  if (!tentativa) return "CLINICO";
  return !operacaoComFalha && fechamentoFlash(e, operacao) ? "TECNICO_VALIDO" : "TECNICO_INVALIDO";
}

function wrapperDado(v:unknown):Record<string,unknown>|null {
  const d=objeto(v);
  return d&&Object.hasOwn(d,"valor")&&["campo","revisao","estado","fontes"].some(k=>Object.hasOwn(d,k))?d:null;
}
function valorConfirmado(v:unknown):unknown {
  const d=wrapperDado(v);
  if(!d)return v;
  return d.campo==="PRESENTE"&&["CONFIRMADO","ASSINADO"].includes(String(d.revisao))&&d.valor!==null
    &&Array.isArray(d.fontes)&&d.fontes.length>0&&d.fontes.every(f=>Fonte.safeParse(f).success)?d.valor:null;
}
function qualificadores(d:Record<string,unknown>):string {
  const itens=["status","certeza","evidence","provenance","negado","suspeita","incerto"].flatMap(k=>{
    const v=d[k];if(v===undefined||v===null||v==="EXPLICIT"||v==="DOCUMENT_CONFIRMED")return [];
    return typeof v==="string"||typeof v==="boolean"?[`${k}: ${typeof v==="boolean"?(v?"sim":"não"):v}`]:[];
  });
  return itens.length?` (${itens.join("; ")})`:"";
}
/** Somente estruturas clínicas conhecidas viram narrativa; IDs/contratos não viram prosa. */
function textoClinico(bruto:unknown):string|null {
  const valor=valorConfirmado(bruto);
  if(valor===null||valor===undefined)return null;
  if(typeof valor==="string")return valor.trim()||null;
  if(typeof valor==="number")return Number.isFinite(valor)?String(valor):null;
  if(typeof valor==="boolean")return valor?"sim":"não";
  if(Array.isArray(valor)){const itens=valor.map(textoClinico).filter((s):s is string=>s!==null);return itens.length?itens.join("; "):null;}
  const d=objeto(valor);if(!d)return null;
  const literal=["literal","texto","nome"].find(k=>typeof d[k]==="string"&&String(d[k]).trim());
  if(literal)return `${String(d[literal]).trim()}${qualificadores(d)}`;
  const marker=typeof d.marker==="string"?d.marker:typeof d.codigo==="string"?d.codigo:null;
  const medida=Object.hasOwn(d,"value")?d.value:d.valor;
  const texto=marker?textoClinico(medida):null;
  if(marker&&texto!==null){const unidade=typeof d.unit==="string"?d.unit:typeof d.unidade==="string"?d.unidade:null;
    return `${marker}: ${texto}${unidade?` ${unidade}`:""}${qualificadores(d)}`;}
  if(typeof d.prefixo==="string"&&["T","N","M","grupo"].some(k=>typeof d[k]==="string")){
    const termos=["T","N","M","grupo"].filter(k=>typeof d[k]==="string").map(k=>`${k}: ${d[k]}`);
    return `${d.prefixo} · ${termos.join("; ")}${typeof d.data==="string"?` · ${d.data}`:""}`;
  }
  return null;
}
const rotulos:Record<string,string>={nome:"Paciente",nascimento:"Nascimento",sexoCadastral:"Sexo cadastral",cid:"CID",topografia:"Topografia",histologia:"Histologia",estadiamentos:"Estadiamento",TNM:"Estadiamento",
  diagnostico:"Diagnóstico",alergias:"Alergias",comorbidades:"Comorbidades",medicamentos:"Medicamentos",pesoKg:"Peso (kg)",valor:"Valor",unidade:"Unidade",origem:"Origem",textoLaudo:"Laudo",resumo:"Laudo",achados:"Achados",biomarcadores:"Biomarcadores",resultado:"Resultado",
  modalidade:"Modalidade",intencao:"Intenção",linha:"Linha",esquemaId:"Esquema",inicio:"Início",fim:"Fim",numero:"Ciclo",previstoEm:"Previsto para",origemPeso:"Origem do peso",esquema:"Esquema",dataClinica:"Data clínica",campo:"Analito",data:"Data",valores:"Laboratório",droga:"Droga",quantidadeEfetivaMg:"Quantidade efetiva (mg)",status:"Situação",motivo:"Motivo",
  "extracao.lab":"Laboratório","extracao.diagnosis":"Diagnóstico","extracao.histology":"Histologia","extracao.biomarker":"Biomarcador","extracao.metastasis":"Metástase","extracao.drug":"Medicamento","extracao.regimen":"Esquema","extracao.cycle":"Ciclo","extracao.symptom":"Sintoma","extracao.toxicity":"Toxicidade","extracao.imaging":"Imagem","extracao.procedure":"Procedimento","extracao.plan":"Plano"};
function fraseClinica(f:FatoRetrato,campo:string,bruto:unknown):Retrato["resumo"] {
  const rotulo=rotulos[campo.split(":")[0]!]??campo;
  const wrapper=wrapperDado(bruto);
  if(wrapper?.campo==="CONFLITO")return [{texto:`${rotulo}: conflito documentado; revisão pendente, sem valor selecionado.`,fatos:[f.ref]}];
  const texto=textoClinico(bruto);if(!texto||texto==="NAO_INFORMADO")return [];
  return [{texto:`${rotulo}: ${texto}${wrapper?qualificadores(wrapper):""}.`,fatos:[f.ref]}];
}

/** Projeção pura. Contexto é fornecido pelo chamador; nenhum evento pode mudar o encontro aberto. */
export function projetarRetrato(eventos: readonly ClinicalEvent[], contexto: ContextoRetrato,
  integridade: Retrato["integridade"] = []): Retrato {
  const horizonte = Date.parse(contexto.agora);
  if (!Number.isFinite(horizonte)) throw new Error("HORIZONTE_INVALIDO");
  const problemas = [...integridade];
  const impedidos = new Set(integridade.map(i => i.eventoId));
  const diagnostico = (e: ClinicalEvent, motivo: string) => problemas.push({ eventoId: e.eventId, tipo: e.tipo, motivo });
  const porId = new Map<string, ClinicalEvent>();
  const duplicados = new Set<string>();
  for (const bruto of eventos) {
    const validado = ClinicalEvent.safeParse(bruto);
    if (!validado.success) { diagnostico(bruto, "ENVELOPE_INVALIDO"); continue; }
    const e = validado.data;
    if (porId.has(e.eventId)) { duplicados.add(e.eventId); diagnostico(e, "EVENT_ID_DUPLICADO"); }
    porId.set(e.eventId, e);
  }
  const confirmados = [...porId.values()].filter(e => !duplicados.has(e.eventId) && !impedidos.has(e.eventId)
    && e.patientId === contexto.patientId && Date.parse(e.criadoEm) <= horizonte
    && ["CONFIRMADO", "ASSINADO"].includes(e.revisao)).sort(ordem);
  const porOperacao = new Map<string, ClinicalEvent[]>();
  // A correlação examina a operação inteira recebida: filtrar paciente antes
  // poderia esconder um documento divergente e validar apenas seu subconjunto.
  for (const e of porId.values()) {
    const grupo = porOperacao.get(e.operationId) ?? []; grupo.push(e); porOperacao.set(e.operationId, grupo);
  }
  const documentosFlash = [...porId.values()].filter(documentoFlash);
  const fechamentos = new Set<string>(), fechamentosInvalidos = new Set<string>();
  for (const e of confirmados.filter(e => ["ConsultaConfirmada", "ConsultaConfirmada@1"].includes(e.tipo))) {
    const operacao = porOperacao.get(e.operationId)!;
    const classe = classificarMarco(e, operacao, documentosFlash, operacao.some(item => duplicados.has(item.eventId) || impedidos.has(item.eventId)));
    if (classe === "TECNICO_VALIDO") fechamentos.add(e.eventId);
    if (classe === "TECNICO_INVALIDO") {
      fechamentosInvalidos.add(e.eventId); diagnostico(e, "FECHAMENTO_FLASH_CORRELACAO_INVALIDA");
    }
  }
  // A agenda ancora somente o dia civil, nunca assinatura ou horário de conclusão.
  // Sem marco verificável, permanece o horizonte legado de registro/data clínica.
  const marcos = new Map<string, { consultas: ClinicalEvent[]; agendas: ClinicalEvent[] }>();
  for (const e of confirmados) {
    const ehConsulta = ["ConsultaConfirmada", "ConsultaConfirmada@1"].includes(e.tipo);
    if (!ehConsulta && !["AgendaEntry", "AgendaEntry@1"].includes(e.tipo)) continue;
    const encontro = marcos.get(e.encounterId) ?? { consultas: [], agendas: [] };
    encontro[ehConsulta ? "consultas" : "agendas"].push(e);
    marcos.set(e.encounterId, encontro);
  }
  const limitesEncontros = new Map<string, string>();
  const encontrosIndeterminados = new Set<string>();
  for (const [encounterId, encontro] of marcos) {
    const clinicas = encontro.consultas.filter(e => !fechamentos.has(e.eventId) && !fechamentosInvalidos.has(e.eventId));
    const assinaturas = encontro.consultas.filter(e => fechamentos.has(e.eventId));
    const apenasAssinaturas = !clinicas.length && !encontro.agendas.length && assinaturas.length > 0;
    const candidatos = clinicas.length ? clinicas : encontro.agendas.length ? encontro.agendas : assinaturas;
    // Tentativa inválida sozinha não cria um horizonte; âncoras verificáveis
    // continuam úteis quando presentes, sem apagar fatos anteriores por esse erro.
    if (!candidatos.length) { encontrosIndeterminados.add(encounterId); continue; }
    const datas = new Set<string>();
    for (const e of candidatos) {
      const ehAgenda = ["AgendaEntry", "AgendaEntry@1"].includes(e.tipo);
      const d = dados(e), data = d?.[ehAgenda ? "data" : "dataClinica"];
      const motivo = !DataCivil.safeParse(data).success ? "DATA_ENCONTRO_INVALIDA"
        : !validarPayloadEvento(e.tipo, d).ok ? "MARCO_ENCONTRO_INVALIDO"
        : ehAgenda && (d?.patientId !== e.patientId || d?.encounterId !== e.encounterId)
          ? "CONTEXTO_ENCONTRO_DIVERGENTE" : null;
      if (motivo) { diagnostico(e, motivo); encontrosIndeterminados.add(encounterId); }
      else datas.add(data as string);
    }
    if (apenasAssinaturas && !encontrosIndeterminados.has(encounterId)) {
      // Sem data clínica/agenda, assinaturas só impõem um teto observacional.
      // A interseção dos tetos nunca amplia o histórico numa re-assinatura tardia.
      candidatos.forEach(e => diagnostico(e, "DATA_ENCONTRO_AUSENTE_LIMITE_ASSINATURA"));
      if (datas.size) limitesEncontros.set(encounterId, [...datas].sort()[0]!);
    } else if (datas.size > 1) {
      candidatos.forEach(e => diagnostico(e, "DATA_ENCONTRO_AMBIGUA"));
      encontrosIndeterminados.add(encounterId);
    }
    if (!encontrosIndeterminados.has(encounterId) && datas.size === 1) limitesEncontros.set(encounterId, [...datas][0]!);
  }
  const dataEncontroAtual = limitesEncontros.get(contexto.encounterId);
  const materiais = new Map<string, FatoRetrato>();
  for (const e of confirmados) {
    const d = dados(e);
    if (!d) { diagnostico(e, "PAYLOAD_SEM_DADOS"); continue; }
    if (consulta(e)) continue;
    // Eventos de operação não são fatos clínicos. Campo clínico ou tipo material explícito.
    if (typeof d.campo !== "string" && !materiaisConhecidos.has(e.tipo)) continue;
    if (["Triagem", "Triagem@1"].includes(e.tipo) && (!validarPayloadEvento(e.tipo, d).ok
      || d.patientId !== e.patientId || d.encounterId !== e.encounterId)) {
      diagnostico(e, "TRIAGEM_CONTEXTO_OU_PAYLOAD_INVALIDO"); continue;
    }
    if (encontrosIndeterminados.has(contexto.encounterId) || encontrosIndeterminados.has(e.encounterId)) continue;
    const dataOrigem = limitesEncontros.get(e.encounterId);
    if (dataEncontroAtual && dataOrigem && dataOrigem > dataEncontroAtual) continue;
    const alcance = escopo(e, d);
    if (alcance === "TUMOR" && e.tumorLotId !== contexto.tumorLotId) continue;
    const dataClinica = tempo(d, e);
    if (dataClinica && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(dataClinica)) {
      const civil = dataClinica.length === 10;
      if (!(civil ? DataCivil : Instante).safeParse(dataClinica).success) { diagnostico(e, "TEMPO_CLINICO_INVALIDO"); continue; }
      const dia = civil ? dataClinica : diaClinico(Date.parse(dataClinica));
      if (civil ? dia > diaClinico(horizonte) : Date.parse(dataClinica) > horizonte) { diagnostico(e, "TEMPO_CLINICO_FUTURO"); continue; }
      if (dataEncontroAtual && dia > dataEncontroAtual) continue;
    }
    try {
      const ref = { eventId: e.eventId, revisao: hashCanonico(e) };
      materiais.set(e.eventId, { ref, tipo: e.tipo, campo: typeof d.campo === "string" ? d.campo : null,
        patientId: e.patientId, encounterId: e.encounterId, tumorLotId: e.tumorLotId, escopo: alcance,
        tempoClinico: dataClinica, tempoRegistro: e.criadoEm, fontes: structuredClone(e.fontes), dados: structuredClone(d) });
    } catch { diagnostico(e, "CONTEUDO_NAO_CANONICO"); }
  }
  const substituidos = new Map<string, ClinicalEvent>();
  // Apply the shared causal rule only after this view's material/horizon filters.
  const arestasValidas = substituicoesValidas(confirmados.filter(e => materiais.has(e.eventId)));
  for (const e of confirmados) {
    if (!e.supersedesEventId || !materiais.has(e.eventId)) continue;
    const anterior = porId.get(e.supersedesEventId), atual = materiais.get(e.eventId)!;
    const antigo = anterior ? materiais.get(anterior.eventId) : undefined;
    if (!anterior) { diagnostico(e, "SUPERSESSION_ALVO_AUSENTE"); continue; }
    if (!antigo || antigo.escopo !== atual.escopo || !arestasValidas.has(e.eventId)) {
      diagnostico(e, "SUPERSESSION_CONTEXTO_INVALIDO"); continue;
    }
    substituidos.set(anterior.eventId, e);
  }
  const fatos = [...materiais.values()].filter(f => !substituidos.has(f.ref.eventId))
    .sort((a, b) => (a.tempoClinico ?? "9999").localeCompare(b.tempoClinico ?? "9999")
      || a.tempoRegistro.localeCompare(b.tempoRegistro) || a.ref.eventId.localeCompare(b.ref.eventId));
  const marcoAtual = confirmados.filter(e => e.encounterId === contexto.encounterId && consulta(e)
    && !fechamentosInvalidos.has(e.eventId) && !encontrosIndeterminados.has(e.encounterId)).at(-1);
  const inicioAtual = confirmados.filter(e => e.encounterId === contexto.encounterId).at(0);
  const limite = marcoAtual ?? inicioAtual;
  // A data de um exame importado não é a data da consulta aberta.
  // Sem âncora, o fallback de registro permanece exclusivo do delta legado.
  const dataAtual = dataEncontroAtual ?? (inicioAtual ? diaClinico(Date.parse(inicioAtual.criadoEm)) : null);
  const diaDoEncontro = (e: ClinicalEvent) => limitesEncontros.get(e.encounterId) ?? String(dados(e)?.dataClinica);
  const anterior = confirmados.filter(e => consulta(e) && e.encounterId !== contexto.encounterId
    && !fechamentosInvalidos.has(e.eventId)
    && !encontrosIndeterminados.has(contexto.encounterId) && !encontrosIndeterminados.has(e.encounterId)
    && e.tumorLotId === contexto.tumorLotId && limite && ordem(e, limite) < 0
    && (!dataAtual || diaDoEncontro(e) < dataAtual))
    .sort((a, b) => diaDoEncontro(a).localeCompare(diaDoEncontro(b)) || ordem(a, b)).at(-1);
  const novos = anterior ? fatos.filter(f => Date.parse(f.tempoRegistro) > Date.parse(anterior.criadoEm)).map(f => f.ref) : [];
  const antigas = anterior ? [...substituidos.keys()].flatMap(id => {
    const antigo = materiais.get(id)!, novo = substituidos.get(id)!;
    return Date.parse(antigo.tempoRegistro) <= Date.parse(anterior.criadoEm) && Date.parse(novo.criadoEm) > Date.parse(anterior.criadoEm) ? [antigo.ref] : [];
  }) : [];
  const resumo = fatos.flatMap(f => {
    if (["DOCUMENTO", "SignedDocument", "DocumentSigned"].includes(f.tipo) || ["farmacia.conferencia","apac.validacaoEmissao"].includes(f.campo??"")) return [];
    if (!f.campo) {
      // Subcampos Dado conservam a revisão própria; confirmação do contêiner não os promove.
      const camposPorTipo: Record<string, readonly string[]> = {
        Paciente: ["nome", "nascimento", "sexoCadastral"],
        TumorLot: ["cid", "topografia", "histologia", "estadiamentos"],
        Weight: ["pesoKg", "valor", "unidade", "origem"],
        ImagingReport: ["textoLaudo", "resumo", "achados"], Biopsy: ["histologia", "topografia", "resultado", "biomarcadores", "textoLaudo"],
        TreatmentEpisode: ["modalidade", "intencao", "linha", "esquemaId", "inicio", "fim"],
        Ciclo: ["numero", "previstoEm", "pesoKg", "origemPeso"], TreatmentCycle: ["numero", "dataClinica", "esquema"],
        LabResult: ["campo", "valor", "unidade", "data", "valores"],
        TreatmentAdministration: ["droga", "quantidadeEfetivaMg", "status", "motivo", "inicio", "fim"],
      };
      return (camposPorTipo[f.tipo] ?? []).flatMap(campo => !Object.hasOwn(f.dados,campo)?[]:fraseClinica(f,campo,f.dados[campo]));
    }
    if (!Object.hasOwn(f.dados, "valor") || f.dados.valor === null) return [];
    // Renderização literal: confirmação documental não transforma uma suspeita em diagnóstico.
    return fraseClinica(f,f.campo,f.dados.valor).map(frase=>({...frase,texto:frase.texto.replace(/\.$/,`${qualificadores(f.dados)}.`)}));
  });
  const conteudo = { schema: "Retrato@1" as const, patientId: contexto.patientId, encounterId: contexto.encounterId,
    tumorLotId: contexto.tumorLotId, versaoProjecao: "retrato-f1-v3", regras: [...contexto.regras].sort((a,b)=>a.id.localeCompare(b.id)||a.versao.localeCompare(b.versao)||a.hash.localeCompare(b.hash)),
    biblioteca: contexto.biblioteca, fatos, integridade: problemas.sort((a,b)=>a.eventoId.localeCompare(b.eventoId)||a.motivo.localeCompare(b.motivo)),
    delta: { encounterAnteriorId: anterior?.encounterId ?? null, novos, substituidos: antigas }, resumo };
  return Retrato.parse({ ...conteudo, revisao: hashCanonico(conteudo), geradoEm: contexto.agora });
}
