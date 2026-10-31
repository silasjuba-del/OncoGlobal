import { AcaoCompostaPreparada } from "../../contracts/api/execucaoAcaoComposta.js";
import { BasePrescricaoExecutavelResposta, EdicaoPrescricaoExecutavel } from "../../contracts/api/operacaoPrescricaoExecutavel.js";
import { doseFinalEmMg } from "../../rules/prescricao/documentoExecutavel.js";

const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const contextoIgual = (a: { patientId: string; encounterId: string; tumorLotId: string | null },
  b: { patientId: string; encounterId: string; tumorLotId: string | null }) =>
  a.patientId === b.patientId && a.encounterId === b.encounterId && a.tumorLotId === b.tumorLotId;

/** Inverse conversion only for the explicit final unit; no dose policy is inferred. */
function daDoseMg(doseMg: number, unidade: string): number | null {
  const u = unidade.trim().normalize("NFKC").toLowerCase();
  const expoente = u === "mg" ? 0 : u === "g" ? -3 : ["mcg", "μg", "ug"].includes(u) ? 3 : null;
  if (expoente === null) return null;
  const dose = Number(`${doseMg}e${expoente}`);
  return Number.isFinite(dose) && dose > 0 && doseFinalEmMg(dose, unidade) === doseMg ? dose : null;
}

/** Proposal only. The server independently resolves and revalidates the stored action. */
export function edicaoDaAcao(baseEntrada: BasePrescricaoExecutavelResposta, acaoEntrada: AcaoCompostaPreparada):
  { edicao: EdicaoPrescricaoExecutavel | null; pendencias: string[] } {
  const falhar = (mensagem: string) => ({ edicao: null, pendencias: [mensagem] });
  const b = BasePrescricaoExecutavelResposta.safeParse(baseEntrada), a = AcaoCompostaPreparada.safeParse(acaoEntrada);
  if (!b.success || !a.success) return falhar("A proposta ou a base da prescrição é inválida.");
  const base = b.data, acao = a.data, r = acao.resultado;
  if (r.baseRevisao !== base.revisao) return falhar("A base mudou desde a proposta. Gere uma nova ação sobre a prescrição atual.");
  const { ciclo, episodio, vigente } = base;
  if (base.pendencias.length || !ciclo || !episodio || !vigente)
    return falhar("É necessária uma prescrição estruturada vigente, sem pendências, neste ciclo.");
  if (r.tipo === "TROCAR_PROTOCOLO")
    return falhar("A troca de protocolo exige selecionar a nova ficha e preparar uma nova prescrição.");
  if (r.estado !== "PREPARADA" || r.pendencias.length || !r.antes || !r.depois)
    return falhar("A ação ainda tem pendências; confira o plano antes de usar.");
  if (!["MANTER_CICLO", "ADIAR_CICLO", "REDUZIR_DOSE"].includes(r.tipo ?? ""))
    return falhar("Selecione uma ação compatível com a prescrição deste ciclo.");
  const antes = r.antes, depois = r.depois;
  if (!contextoIgual(base.contexto, antes.contexto) || !contextoIgual(base.contexto, depois.contexto)
    || !contextoIgual(base.contexto, vigente.contexto)
    || antes.cicloId !== ciclo.cicloId || depois.cicloId !== ciclo.cicloId || vigente.contexto.cicloId !== ciclo.cicloId
    || antes.episodioId !== episodio.episodioId || depois.episodioId !== episodio.episodioId
    || vigente.contexto.episodioId !== episodio.episodioId
    || antes.protocoloId !== vigente.protocoloId || depois.protocoloId !== vigente.protocoloId
    || episodio.esquemaId !== vigente.protocoloId || episodio.modalidade !== "QT"
    || antes.previstoEm !== ciclo.previstoEm || vigente.dataPrevista !== ciclo.previstoEm
    || ciclo.prescricaoRef?.documentId !== vigente.documentId || ciclo.prescricaoRef.documentVersion !== vigente.documentVersion)
    return falhar("A origem não corresponde à versão, ao ciclo ou ao contexto da prescrição atual.");
  if (antes.itens.length !== vigente.itens.length || depois.itens.length !== vigente.itens.length
    || ciclo.itens.length !== vigente.itens.length
    || new Set(antes.itens.map(i => i.item)).size !== antes.itens.length
    || new Set(depois.itens.map(i => i.item)).size !== depois.itens.length)
    return falhar("Os itens da proposta não correspondem à prescrição vigente.");
  for (const { item } of vigente.itens) {
    const anterior = antes.itens.find(i => i.item === item.sequence);
    const posterior = depois.itens.find(i => i.item === item.sequence);
    const atual = ciclo.itens.find(i => i.item === item.sequence);
    const mg = item.prescribedDose === null ? null : doseFinalEmMg(item.prescribedDose, item.unit);
    const quantidadeOriginalConfere = mg !== null || !!atual?.doseOriginal
      && atual.doseOriginal.valor === item.prescribedDose && atual.doseOriginal.unidade === item.unit
      && posterior?.doseMg === null;
    if (!anterior || !posterior || !atual || !quantidadeOriginalConfere || mg !== anterior.doseMg || mg !== atual.doseMg
      || item.drug !== anterior.droga || item.drug !== posterior.droga || item.drug !== atual.droga)
      return falhar("A dose, a unidade ou a identidade de um item mudou desde a proposta.");
  }
  const diferencas = depois.itens.flatMap(i => {
    const anterior = antes.itens.find(a => a.item === i.item)!;
    return i.doseMg === anterior.doseMg ? [] :
      [{ campo: "doseMg", item: i.item, antes: anterior.doseMg, depois: i.doseMg }];
  });
  if (r.tipo === "MANTER_CICLO" && (r.diff.length || diferencas.length || depois.previstoEm !== antes.previstoEm)
    || r.tipo === "ADIAR_CICLO" && (diferencas.length || depois.previstoEm <= antes.previstoEm
      || !igual(r.diff, [{ campo: "previstoEm", item: null, antes: antes.previstoEm, depois: depois.previstoEm }]))
    || r.tipo === "REDUZIR_DOSE" && (depois.previstoEm !== antes.previstoEm || !r.diff.length
      || new Set(r.diff.map(d => d.item)).size !== r.diff.length
      || r.diff.some(d => d.campo !== "doseMg" || d.item === null
        || typeof d.antes !== "number" || typeof d.depois !== "number" || d.depois <= 0 || d.depois >= d.antes
        || !antes.itens.some(i => i.item === d.item && i.doseMg === d.antes)
        || !depois.itens.some(i => i.item === d.item && i.doseMg === d.depois))
      || diferencas.length !== r.diff.length))
    return falhar("As mudanças da proposta não correspondem à ação revisada.");
  const itens = structuredClone(vigente.itens);
  if (r.tipo === "REDUZIR_DOSE") for (const { item } of itens) {
    const d = r.diff.find(d => d.item === item.sequence);
    if (!d) continue;
    const dose = daDoseMg(d.depois as number, item.unit);
    if (dose === null) return falhar("Não foi possível converter a dose proposta para a unidade da prescrição.");
    const motivo = `${r.motivo} · ${d.antes} mg → ${d.depois} mg no ciclo atual.`;
    item.prescribedDose = dose;
    item.adjustmentPercent = null;
    item.adjustmentReason = motivo;
    item.source = "MANUAL";
    item.overrideMotivo = motivo;
  }
  const e = EdicaoPrescricaoExecutavel.safeParse({
    protocoloId: vigente.protocoloId, dataPrevista: depois.previstoEm, motivo: r.motivo,
    planejamento: { modo: "CICLO_ATUAL", linha: episodio.linha, intencao: episodio.intencao, numeroCiclo: ciclo.numero },
    itens, origemProposta: { draftId: acao.draftId, revision: acao.revision, hash: acao.conteudoHash },
    encaminharFarmacia: false,
  });
  return e.success ? { edicao: e.data, pendencias: [] } : falhar("A proposta exige completar o planejamento antes de prescrever.");
}
