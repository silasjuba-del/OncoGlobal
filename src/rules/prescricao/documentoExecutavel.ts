import {
  ConteudoPrescricaoExecutavel,
  type ConteudoPrescricaoExecutavel as Conteudo,
  type ItemPrescricaoExecutavel,
} from "../../contracts/api/prescricaoExecutavel.js";

export interface AvaliacaoDocumentoExecutavel {
  /** Structural/operational formatting gate only; true is not medical approval. */
  ok: boolean;
  pendencias: string[];
  avisos: string[];
  conteudo: Conteudo | null;
  texto: string | null;
}

const numeroPtBr = (value: number): string => String(value).replace(".", ",");

function unidadePendente(unidade: string): boolean {
  const normalizada = unidade.normalize("NFKC").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/²/g, "2").replace(/\s+/g, "").toUpperCase();
  if (normalizada === "AUC") return true;
  return /(?:^|[^A-Z0-9])(?:MG|MCG|G)\/(?:M2|KG)(?:$|[^A-Z0-9])/.test(normalizada)
    || /^(?:MG|MCG|G)\/(?:M2|KG)$/.test(normalizada);
}

function dadosPreparo(item: ItemPrescricaoExecutavel, pendencias: string[], avisos: string[]): string[] {
  const { item: prescrito, itemId } = item;
  const prefixo = `Item ${prescrito.sequence} (${itemId})`;
  if (prescrito.prescribedDose === null || !Number.isFinite(prescrito.prescribedDose) || prescrito.prescribedDose <= 0)
    pendencias.push(`${prefixo}: dose final prescrita ausente ou não positiva.`);
  if (!prescrito.unit.trim()) pendencias.push(`${prefixo}: unidade final ausente.`);
  else if (unidadePendente(prescrito.unit))
    pendencias.push(`${prefixo}: unidade ${prescrito.unit} ainda expressa denominador; falta dose final em unidade executável.`);
  if (!prescrito.route.trim()) pendencias.push(`${prefixo}: via ausente.`);
  if (prescrito.days.length === 0) pendencias.push(`${prefixo}: dias de administração ausentes.`);
  if (prescrito.adjustmentPercent !== null) {
    if (prescrito.calculatedDose === null || prescrito.prescribedDose === null) {
      pendencias.push(`${prefixo}: percentual declarado sem dose calculada de referência e dose final.`);
    } else {
      const esperada = prescrito.calculatedDose * (100 + prescrito.adjustmentPercent) / 100;
      // Tolerância apenas do IEEE-754; não institui arredondamento de dose.
      const tolerancia = Number.EPSILON * Math.max(Math.abs(esperada), Math.abs(prescrito.prescribedDose)) * 8;
      if (Math.abs(prescrito.prescribedDose - esperada) > tolerancia)
        pendencias.push(`${prefixo}: dose final incompatível com o percentual sobre a dose calculada de referência.`);
    }
  }

  const faltantes: string[] = [];
  if (prescrito.diluent === null || !prescrito.diluent.trim()) {
    faltantes.push("diluente");
    avisos.push(`${prefixo}: diluente não informado; revisar preparo.`);
  }
  if (prescrito.finalVolumeMl === null) {
    faltantes.push("volume final");
    avisos.push(`${prefixo}: volume final não informado; revisar preparo.`);
  }
  if (prescrito.infusionTime === null || !prescrito.infusionTime.trim()) {
    faltantes.push("tempo de infusão");
    avisos.push(`${prefixo}: tempo de infusão não informado; revisar preparo.`);
  }
  if (prescrito.route.trim().toUpperCase() === "EV" && faltantes.length > 0)
    avisos.push(`${prefixo}: preparo EV com parâmetros incompletos; revisão obrigatória antes de preparar.`);

  if (prescrito.sequenciamentoPendente)
    pendencias.push(`${prefixo}: sequenciamento pendente — ${prescrito.sequenciamentoPendente}.`);
  if (prescrito.resgateMtx)
    pendencias.push(`${prefixo}: resgate condicional sem plano individual estruturado.`);

  const dose = prescrito.prescribedDose === null ? "não informada" : `${numeroPtBr(prescrito.prescribedDose)} ${prescrito.unit}`;
  const diluente = prescrito.diluent?.trim() || "não informado";
  const volume = prescrito.finalVolumeMl === null ? "não informado" : `${numeroPtBr(prescrito.finalVolumeMl)} mL`;
  const tempo = prescrito.infusionTime?.trim() || "não informado";
  const dias = prescrito.days.length > 0 ? prescrito.days.join(", ") : "não informados";
  const lines = [
    `Item ${prescrito.sequence} — ${prescrito.drug} (${prescrito.classe})`,
    `Identificador do item: ${itemId}`,
    `Dose final: ${dose}`,
    `Via: ${prescrito.route.trim() || "não informada"}`,
    `Diluente: ${diluente}`,
    `Volume final: ${volume}`,
    `Tempo de infusão: ${tempo}`,
    `Dias: ${dias}`,
    `Base de dose: ${prescrito.doseBasis}`,
    `Fonte do item: ${prescrito.source}`,
  ];
  if (prescrito.adjustmentPercent !== null)
    lines.push(`Ajuste explícito: ${Math.abs(prescrito.adjustmentPercent)}% sobre a dose calculada de referência ${prescrito.calculatedDose === null ? "não informada" : `${numeroPtBr(prescrito.calculatedDose)} ${prescrito.unit}`}`,
      `Motivo do ajuste: ${prescrito.adjustmentReason ?? "não informado"}`);
  if (prescrito.overrideMotivo) lines.push(`Motivo do override: ${prescrito.overrideMotivo}`);
  if (prescrito.observacao) lines.push(`Observação: ${prescrito.observacao}`);
  if (prescrito.sequenciamentoPendente) lines.push(`Sequenciamento: pendente — ${prescrito.sequenciamentoPendente}`);
  if (prescrito.resgateMtx) lines.push("Resgate condicional: plano individual pendente");
  return lines;
}

/**
 * Validates and renders only the supplied structured order. It never infers
 * missing administration parameters, calculates doses, signs, or persists.
 */
export function avaliarDocumentoExecutavel(entrada: unknown): AvaliacaoDocumentoExecutavel {
  const parsed = ConteudoPrescricaoExecutavel.safeParse(entrada);
  if (!parsed.success) {
    return {
      ok: false,
      pendencias: ["Conteúdo estruturado inválido; revisar campos obrigatórios, itens, sequência e versão."],
      avisos: [],
      conteudo: null,
      texto: null,
    };
  }

  const conteudo = parsed.data;
  const pendencias: string[] = [];
  const avisos: string[] = [];
  const itens = [...conteudo.itens].sort((a, b) => a.item.sequence - b.item.sequence);
  const origem = conteudo.origemProposta
    ? `${conteudo.origemProposta.draftId}, revisão ${conteudo.origemProposta.revision}, hash SHA-256 ${conteudo.origemProposta.hash}`
    : "não vinculada a proposta";
  const linhas = [
    "PRESCRIÇÃO ONCOLÓGICA — QT",
    `Documento: ${conteudo.documentId} · versão ${conteudo.documentVersion}`,
    `Paciente/contexto (IDs): ${conteudo.contexto.patientId} · atendimento ${conteudo.contexto.encounterId}`,
    `Episódio: ${conteudo.contexto.episodioId} · ciclo: ${conteudo.contexto.cicloId}`,
    `Lote tumoral: ${conteudo.contexto.tumorLotId ?? "não informado"}`,
    `Protocolo: ${conteudo.protocoloId}`,
    `Data prevista: ${conteudo.dataPrevista}`,
    `Motivo informado: ${conteudo.motivo}`,
    `Origem da proposta: ${origem}`,
    "",
    ...itens.flatMap((item, index) => [
      ...(index > 0 ? [""] : []),
      ...dadosPreparo(item, pendencias, avisos),
    ]),
  ];
  if (avisos.length) linhas.push("", "AVISOS PARA REVISÃO", ...avisos.map(aviso => `- ${aviso}`));
  if (pendencias.length) linhas.push("", "PENDÊNCIAS — NÃO EXECUTAR", ...pendencias.map(pendencia => `- ${pendencia}`));
  linhas.push("", "Conteúdo estruturado para revisão médica. Este documento não comprova preparo, dispensação ou administração.");

  return {
    ok: pendencias.length === 0,
    pendencias,
    avisos,
    conteudo,
    texto: linhas.join("\n"),
  };
}
