// Somente dados sintéticos; confirmações passam pela mesma porta do produto.
import { abrirAmbiente, cadastrarPaciente, criarDiretorio, removerDiretorio, PACIENTE, ENCONTRO, AGORA } from "../f0-fecha/fixtures/consulta-completa.js";
import { salvarDraft, listarDrafts } from "../../src/kernel/comandos/portas.js";
import { executarConfirmacao } from "../../src/kernel/comandos/index.js";
import { fonteSintetica, presente } from "./triagem.js";
export { AGORA };
export async function abrirIntegracao() {
  const a = await abrirAmbiente(criarDiretorio()); cadastrarPaciente(a);
  const contexto = { patientId: PACIENTE, encounterId: ENCONTRO, tumorLotId: "lote-integracao-sintetico" };
  a.sessoes.selecionarConsulta(a.token, contexto);
  for (const d of listarDrafts(a.db, PACIENTE)) if (d.rawRef === "fixture-local-sintetica") salvarDraft(a.db, { ...d, rawRef: "referencia-local-sintetica", revision: d.revision + 1 });
  let n = 0;
  const seed = (tipo: string, payload: unknown, escopo?: { tumorLotId: string | null }) => {
    const ctx = { ...contexto, ...escopo };
    const id = `integracao-evento-${++n}`;
    salvarDraft(a.db, { draftId: id, patientId: PACIENTE, sourceId: id, rawRef: "referencia-local-sintetica", payload: { contexto: ctx }, diagnostics: [], revision: 0, criadoEm: AGORA });
    const r = executarConfirmacao(a.db, { ...ctx, operationId: id, reviewDecisionId: `revisao-${id}`,
      sessao: a.sessoes.obter(a.token)!, em: AGORA,
      registros: [{ draftId: id, expectedRevision: 0, eventId: id, tipo, payload, fontes: [fonteSintetica(id)], revisao: "CONFIRMADO", supersedesEventId: null }] });
    if (r.estado !== "GRAVADA") throw Error(`SEED_${r.estado}`);
    return id;
  };
  seed("TumorLot", { patientId: contexto.patientId, tumorLotId: contexto.tumorLotId, cid: presente("C34"), topografia: presente("Pulmão sintético"), histologia: presente("Carcinoma sintético"),
    estadiamentos: [], finalidadeApac: presente("PALIATIVA"), marcos: [] });
  return { ...a, contexto, seed, finalizar: async () => { await a.close(); removerDiretorio(a.dir); } };
}
export async function prescreverSintetico(a: Awaited<ReturnType<typeof abrirIntegracao>>) {
  const base = await a.request("/consulta/prescricao-executavel/base", a.contexto);
  const r = await a.request("/consulta/prescricao-executavel/preparar", { contexto: a.contexto, expectedBaseHash: base.data.revisao,
    idempotencyKey: "integracao-rx-preparar", edicao: { protocoloId: "protocolo-sintetico", dataPrevista: "2026-10-20", motivo: "Teste sintético",
      planejamento: { modo: "NOVA_LINHA", linha: 1, intencao: "PALIATIVA", numeroCiclo: 1 }, origemProposta: null, encaminharFarmacia: false,
      itens: [{ itemId: "item-sintetico", item: { drug: "Medicamento sintético", classe: "QT", sequence: 1, standardDose: null, doseBasis: "FIXED",
        calculatedDose: null, prescribedDose: 1.5, unit: "mg", adjustmentPercent: null, adjustmentReason: null, route: "EV", diluent: "SF 0,9%",
        finalVolumeMl: 250, infusionTime: "60 min", days: ["d1"], observacao: null, source: "MANUAL", overrideMotivo: "Decisão sintética de teste" } }],
    } });
  if (r.status !== 200) throw Error(JSON.stringify(r.data));
  const c = await a.request("/consulta/prescricao-executavel/confirmar", { contexto: a.contexto, draftId: r.data.draftId,
    expectedRevision: r.data.revision, conteudoHash: r.data.conteudoHash, idempotencyKey: "integracao-rx-assinar" });
  if (c.status !== 200) throw Error(JSON.stringify(c.data));
}
