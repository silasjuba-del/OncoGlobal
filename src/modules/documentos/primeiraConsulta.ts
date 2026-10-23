import { DocumentoSkill, type ConfiguracaoPrimeiraConsulta, type ExecucaoSkill } from "../../contracts/skillsClinicas.js";
import type { ClinicalFact } from "../../contracts/w10/extracao.js";
import { hashCanonico } from "../hash.js";

const rotulos: Record<ClinicalFact["domain"], string> = { diagnosis: "Diagnóstico relatado", histology: "Histologia", stage: "Estadiamento documentado",
  biomarker: "Biomarcadores", metastasis: "Achado de doença metastática", drug: "Medicação mencionada", regimen: "Tratamento mencionado",
  cycle: "Ciclo mencionado", lab: "Laboratório", imaging: "Imagem", symptom: "Sintomas", toxicity: "Toxicidade relatada",
  procedure: "Procedimento mencionado", plan: "Plano mencionado na fonte" };
function valorLegivel(f: ClinicalFact): string {
  if (typeof f.value === "string" || typeof f.value === "number") return String(f.value);
  const v = f.value && typeof f.value === "object" ? f.value as Record<string, unknown> : {};
  if (typeof v.marker === "string") return `${v.marker}: ${v.value ?? "NÃO INFORMADO"} ${v.unit ?? ""}`.trim();
  if (typeof v.literal === "string") return v.literal;
  if (typeof v.raw === "string") return v.raw;
  return f.rawEvidence;
}

/** Prévia de evidências recebidas. Não usa o renderizador de fatos CONFIRMADOS para propostas. */
export function prepararPrimeiraConsulta(input: {
  execucaoId: string; contexto: ExecucaoSkill["contexto"]; nome: string; configuracao: ConfiguracaoPrimeiraConsulta;
  fontes: ExecucaoSkill["fontes"]; facts: readonly ClinicalFact[]; pendenciasFontes: readonly string[];
}) {
  const evidencias: ExecucaoSkill["evidencias"] = input.facts.map(f => ({ factId: f.id, sourceId: f.sourceId,
    segmentId: f.segmentId, dominio: f.domain, data: f.date ?? null,
    valor: valorLegivel(f),
    trecho: f.rawEvidence.slice(0, 4000), trechoAbreviado: f.rawEvidence.length > 4000,
    exigeConfirmacao: true, qualificadores: f.qualificadores ? JSON.stringify(f.qualificadores) : "NÃO REGISTRADOS NA EXTRAÇÃO",
  }));
  const ordenadas = [...evidencias].sort((a, b) => input.configuracao.estiloResumo === "CRONOLOGICO"
    ? (a.data ?? "9999").localeCompare(b.data ?? "9999") || a.factId.localeCompare(b.factId)
    : a.dominio.localeCompare(b.dominio) || (a.data ?? "9999").localeCompare(b.data ?? "9999") || a.factId.localeCompare(b.factId));
  const pendencias = [...new Set(["REVISÃO MÉDICA DAS INFORMAÇÕES RECEBIDAS", ...input.pendenciasFontes,
    ...(!evidencias.length ? ["SEM FATOS EXTRAÍDOS: CONSULTAR OS ORIGINAIS"] : [])])];
  const linhas = ordenadas.map(e => `[${e.data ?? "DATA NÃO INFORMADA"}] ${rotulos[e.dominio as ClinicalFact["domain"]] ?? e.dominio}: ${e.valor}\n`
    + `Fonte: ${e.sourceId}; segmento: ${e.segmentId}; qualificadores: ${e.qualificadores}.\n`
    + `Trecho recebido: ${e.trecho}${e.trechoAbreviado ? " [ABREVIADO — ORIGINAL PRESERVADO]" : ""}`);
  const cabecalho = [`Paciente: ${input.nome}`, `Prontuário: ${input.contexto.patientId}`, `Consulta: ${input.contexto.encounterId}`];
  const p = ["Pendências para revisão", ...pendencias.map(v => `- ${v}`)].join("\n");
  const resumo = (input.configuracao.priorizarPendencias ? [p, ...linhas] : [...linhas, p]).join("\n\n");
  const titulos = { RESUMO_CASO: "Resumo do caso — primeira consulta", EVOLUCAO: "Evolução — primeira consulta",
    RECEITA: "Receita — preparação para revisão", PEDIDO_EXAMES: "Pedidos de exames — preparação para revisão",
    ENCAMINHAMENTO: "Encaminhamento — preparação para revisão", ORIENTACOES: "Orientações — preparação para revisão" };
  const documentos = input.configuracao.documentos.map(tipo => {
    const faltas = [...pendencias];
    let corpo = resumo;
    if (tipo === "EVOLUCAO") { corpo += "\n\nAvaliação médica: PENDENTE\nConduta da consulta: PENDENTE"; faltas.push("AVALIAÇÃO E CONDUTA MÉDICA"); }
    if (tipo === "RECEITA") {
      // Somente itens explicitamente pedidos como rascunho pelo médico, nunca medicamentos citados no kit.
      corpo = input.configuracao.receitas.length ? input.configuracao.receitas.map((r, i) => {
        for (const [campo, valor] of Object.entries(r)) if (valor === null) faltas.push(`RECEITA ${i + 1}: ${campo}`);
        return `${i + 1}. ${r.medicamento}\nDose: ${r.dose ?? "PENDENTE"}; via: ${r.via ?? "PENDENTE"}; frequência: ${r.frequencia ?? "PENDENTE"}; duração: ${r.duracao ?? "PENDENTE"}; quantidade: ${r.quantidade ?? "PENDENTE"}`;
      }).join("\n\n") : "Medicamento, dose, via, frequência, duração e quantidade: PENDENTES DE DEFINIÇÃO MÉDICA";
      if (!input.configuracao.receitas.length) faltas.push("ITENS DA RECEITA NÃO DEFINIDOS");
    }
    if (tipo === "PEDIDO_EXAMES") {
      corpo = input.configuracao.exames.length ? input.configuracao.exames.map((e, i) => {
        if (!e.indicacao) faltas.push(`EXAME ${i + 1}: indicação`);
        return `${i + 1}. ${e.exame}\nIndicação: ${e.indicacao ?? "PENDENTE"}`;
      }).join("\n\n") : "Exames a solicitar e indicações: PENDENTES DE DEFINIÇÃO MÉDICA";
      if (!input.configuracao.exames.length) faltas.push("EXAMES NÃO DEFINIDOS");
    }
    if (tipo === "ENCAMINHAMENTO") { corpo = `Destino: PENDENTE\nMotivo: PENDENTE\n\nInformações recebidas para revisão:\n${resumo}`; faltas.push("DESTINO E MOTIVO DO ENCAMINHAMENTO"); }
    if (tipo === "ORIENTACOES") { corpo = "Orientações específicas desta consulta: PENDENTES DE DEFINIÇÃO MÉDICA"; faltas.push("ORIENTAÇÕES NÃO DEFINIDAS"); }
    return DocumentoSkill.parse({ kind: "SKILL_DOCUMENTO_RASCUNHO", documentId: `skill-doc:${hashCanonico([input.execucaoId, tipo])}`,
      execucaoId: input.execucaoId, contexto: input.contexto, tipo, titulo: titulos[tipo],
      texto: ["RASCUNHO — NÃO ASSINADO — REVISÃO MÉDICA OBRIGATÓRIA", ...cabecalho, corpo].join("\n\n"),
      estado: "RASCUNHO", assinatura: null, pendencias: [...new Set(faltas)], fontes: input.fontes });
  });
  return { documentos, evidencias, pendencias };
}
