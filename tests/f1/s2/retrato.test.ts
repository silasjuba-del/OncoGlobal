import { describe, it, expect } from "vitest";
import type { ClinicalEvent } from "../../../src/contracts/operacao.js";
import { projetarRetrato, hashCanonico, type ContextoRetrato } from "../../../src/kernel/projections/retrato/index.js";
import { prepararRevisaoExtracao } from "../../../src/app/revisaoExtracao.js";
import { abrirLedger } from "../../../src/kernel/ledger/db.js";
import { salvarDraft, confirmar } from "../../../src/kernel/ledger/writeRouter.js";
import { listarEventos } from "../../../src/kernel/ledger/ledger.js";
const contexto: ContextoRetrato = { patientId: "p1", encounterId: "consulta2", tumorLotId: "t2", agora: "2026-10-12T12:00:00-03:00",
  regras: [], biblioteca: {id: "biblioteca", versao: "1", hash: "hash-biblioteca"} };
function evento(id: string, campo = "diagnostico", extra: Partial<ClinicalEvent> = {}): ClinicalEvent {
  return { eventId: id, operationId: `op-${id}`, eventIndex: 0, patientId: "p1", encounterId: "consulta2", tumorLotId: "t2",
    tipo: "FATO", payload: {reviewDecisionId: "medico-revisou", data: {campo, valor: "literal", dataClinica: "2026-10-10"}},
    fontes: [{sourceId: "fonte", classe: "DOCUMENT", localizador: "p1", dataClinica: "2026-10-10", dataCaptura: "2026-10-10T12:00:00-03:00", versao: "1", contentHash: "hash-fonte"}],
    revisao: "CONFIRMADO", criadoEm: "2026-10-10T12:00:00-03:00", criadoPor: {tipo: "SESSAO", id: "medico"}, supersedesEventId: null, ...extra };
}
function consulta(id: string, encounterId: string, dia: string): ClinicalEvent {
  return evento(id, "consulta", { encounterId, criadoEm: `${dia}T12:00:00-03:00`, tipo: "ConsultaConfirmada@1",
    payload: {reviewDecisionId: "review", data: {dataClinica: dia, documentoIds: [{documentId: "evolucao", documentVersion: 1}]}} });
}
describe("S2 Retrato longitudinal", () => {
  it("altura confirmada pertence ao paciente e conserva sua fonte no outro lote", () => {
    const altura = evento("altura-paciente", "alturaCm", { tumorLotId: "t1",
      payload: { data: { campo: "alturaCm", valor: 170, dataClinica: "2026-10-10" } } });
    const r = projetarRetrato([altura], contexto);
    expect(r.fatos).toEqual([expect.objectContaining({ escopo: "PACIENTE", campo: "alturaCm", fontes: altura.fontes })]);
  });
  it("preserva materiais legados e texto assinado sem usá-lo como fato diagnóstico", () => {
    const cadastro = evento("cadastro", "", {tipo: "Paciente", tumorLotId: null, payload: {data: {patientId: "p1", nome: "Pessoa sintética", nascimento: null, sexoCadastral: "F"}}});
    const imagem = evento("imagem", "", {tipo: "ImagingReport", payload: {data: {textoLaudo: "Lesão indeterminada", achados: {incerto: true}}}});
    const biopsia = evento("biopsia", "", {tipo: "Biopsy", payload: {data: {histologia: "carcinoma", data: "2026-10-10"}}});
    const documento = evento("doc", "", {tipo: "DOCUMENTO", revisao: "ASSINADO", payload: {data: {texto: "prosa médica preservada", signature: {serverActorId: "m"}}}});
    const r = projetarRetrato([cadastro,imagem,biopsia,documento], contexto);
    expect(r.fatos).toHaveLength(4); expect(r.fatos.find(f=>f.tipo==="Paciente")?.escopo).toBe("PACIENTE");
    expect(r.fatos.find(f=>f.tipo==="DOCUMENTO")?.dados.texto).toBe("prosa médica preservada");
    expect(r.resumo.some(f=>f.texto.includes("prosa médica preservada"))).toBe(false);
    expect(r.resumo.some(f=>f.texto.includes("Lesão indeterminada"))).toBe(true);
  });
  it("projeta Paciente@1 como fato do paciente e TumorLot@1 apenas no lote selecionado", () => {
    const ausente = { campo: "AUSENTE", valor: null, estado: "PENDENTE", motivo: "não consta",
      fontes: [], revisao: "RAW" };
    const topografia = { campo: "PRESENTE", valor: "Esôfago", estado: "VERDE", motivo: "laudo sintético",
      fontes: evento("fonte").fontes, revisao: "CONFIRMADO" };
    const cadastro = evento("paciente-alias", "", { tipo: "Paciente@1", tumorLotId: null,
      payload: { data: { patientId: "p1", nome: "Pessoa sintética", identificadores: [],
        nascimento: null, sexoCadastral: "F", divergencia: false } } });
    const lote = evento("lote-alias", "", { tipo: "TumorLot@1",
      payload: { data: { patientId: "p1", tumorLotId: "t2", cid: ausente,
        topografia, histologia: ausente, estadiamentos: [], finalidadeApac: ausente, marcos: [] } } });
    const retrato = projetarRetrato([cadastro, lote], contexto);
    expect(retrato.fatos).toEqual(expect.arrayContaining([
      expect.objectContaining({ tipo: "Paciente@1", escopo: "PACIENTE" }),
      expect.objectContaining({ tipo: "TumorLot@1", escopo: "TUMOR" }),
    ]));
    expect(retrato.resumo.some(f => f.texto.includes("Pessoa sintética"))).toBe(true);
    expect(retrato.resumo.some(f => f.texto.includes("Esôfago"))).toBe(true);
  });
  it("não promove alias com identidade do payload divergente do envelope", () => {
    const alias = evento("alias-divergente", "", { tipo: "Paciente@1", tumorLotId: null,
      payload: { data: { patientId: "outro-paciente", nome: "Nome de outro paciente", identificadores: [],
        nascimento: null, sexoCadastral: "F", divergencia: false } } });
    const retrato = projetarRetrato([alias], contexto);
    expect(retrato.fatos).toEqual([]);
    expect(retrato.integridade).toContainEqual(expect.objectContaining({
      eventoId: "alias-divergente", motivo: "ALIAS_CONTEXTO_OU_PAYLOAD_INVALIDO",
    }));
  });
  it("exposição cumulativa e labs extraídos atravessam tumor sem perder factDate", () => {
    const r = projetarRetrato([evento("cum", "exposicaoCumulativa", {tumorLotId: "t1"}),
      evento("lab", "extracao.lab:HB", {tumorLotId: "t1", payload: {data: {campo: "extracao.lab:HB", domain: "lab", valor: {marker: "HB", value: 10, unit: "g/dL"}, factDate: "2026-10-08"}}})], contexto);
    expect(r.fatos).toHaveLength(2); expect(r.fatos.every(f=>f.escopo === "PACIENTE")).toBe(true);
    expect(r.fatos.find(f=>f.ref.eventId==="lab")?.tempoClinico).toBe("2026-10-08");
  });
  it("usa os FATO reais preparados e confirmados pelo WriteRouter com domain e marker íntegros", () => {
    const db = abrirLedger(":memory:");
    try {
      const rawTranscript = "Hemoglobina 10 g/dL em 08/10/2026.";
      const preparo = prepararRevisaoExtracao({draftId: "extracao",sourceId:"lab-source",rawTranscript,sourceType:"lab_feed",
        facts: [{id:"hb",segmentId:"seg",patientCandidateId:"p1",domain:"lab",value:{marker:"HB",value:10,unit:"g/dL"},
          sourceType:"lab_feed",evidence:"EXPLICIT",sourceId:"lab-source",rawEvidence:rawTranscript,date:"2026-10-08",confidence:1,requiresConfirmation:false}],
        exceptions:[],patientId:"p1",encounterId:"consulta2",tumorLotId:"t2",factIds:["hb"],operationId:"confirm-lab",medicoId:"m",em:contexto.agora});
      salvarDraft(db,{draftId:"draft-lab",patientId:"p1",sourceId:"lab-source",rawRef:"opaco",payload:preparo.payload,diagnostics:[],revision:0,criadoEm:contexto.agora});
      const gravado = confirmar(db,{operationId:"confirm-lab",patientId:"p1",tumorLotId:"t2",encounterId:"consulta2",reviewDecisionId:"review-lab",em:contexto.agora,
        sessao:{medicoId:"m",crm:"CRM-TESTE",emitidaEm:contexto.agora,expiraEm:"2026-10-12T13:00:00-03:00"},
        registros:preparo.registros.map(r=>({...r,fontes:[...r.fontes],draftId:"draft-lab",expectedRevision:0,revisao:"CONFIRMADO" as const}))});
      expect(gravado.estado).toBe("GRAVADA");
      const r = projetarRetrato(listarEventos(db,"p1"),contexto);
      expect(r.fatos[0]?.dados.domain).toBe("lab"); expect(r.fatos[0]?.campo).toBe("extracao.lab:HB");
      expect(r.fatos[0]?.dados.valor).toEqual({marker:"HB",value:10,unit:"g/dL"});
      expect(r.fatos[0]?.tempoClinico).toBe("2026-10-08"); expect(r.resumo[0]?.fatos).toEqual([r.fatos[0]?.ref]);
    } finally {db.close();}
  });
  it("é independente de ordem de entrada, ordem de chaves e instante de geração", () => {
    const a = evento("a"), b = evento("b", "TNM");
    const primeiro = projetarRetrato([a,b], contexto);
    const segundo = projetarRetrato([b,a], {...contexto, agora: "2026-10-12T13:00:00-03:00"});
    expect(primeiro.revisao).toBe(segundo.revisao);
    expect(hashCanonico({a: 1,b: 2})).toBe(hashCanonico({b: 2,a: 1}));
    expect(primeiro.fatos[0]?.ref.revisao).toBe(hashCanonico(a));
  });
  it("não cria sujeito e não troca encontro por correção antiga gravada agora", () => {
    const antiga = evento("correcao", "TNM", {encounterId: "consulta-antiga", criadoEm: "2026-10-12T11:00:00-03:00"});
    const r = projetarRetrato([antiga], contexto);
    expect(r.patientId).toBe("p1"); expect(r.encounterId).toBe("consulta2");
    expect(r.delta.encounterAnteriorId).toBeNull();
    expect(r.fatos[0]?.tempoClinico).toBe("2026-10-10");
    expect(r.fatos[0]?.tempoRegistro).toBe(antiga.criadoEm);
  });
  it("alergias e medicamentos atravessam tumores; diagnóstico fica no tumor", () => {
    const eventos = [evento("alergia", "alergias", {tumorLotId: "t1"}), evento("muc", "medicamentos", {tumorLotId: "t1"}),
      evento("outro-dx", "diagnostico", {tumorLotId: "t1"}), evento("dx")];
    const r = projetarRetrato(eventos, contexto);
    expect(r.fatos.map(f=>f.ref.eventId).sort()).toEqual(["alergia","dx","muc"]);
  });
  it("supersession não remove fato de outro paciente/tumor/campo nem alvo inexistente", () => {
    const alvo = evento("alvo");
    const ruim = evento("ruim", "alergias", {criadoEm: "2026-10-11T12:00:00-03:00", supersedesEventId: "alvo"});
    const dangling = evento("dangling", "TNM", {supersedesEventId: "inexistente"});
    const r = projetarRetrato([alvo, ruim, dangling], contexto);
    expect(r.fatos).toHaveLength(3);
    expect(r.integridade.map(i=>i.motivo)).toEqual(expect.arrayContaining(["SUPERSESSION_ALVO_AUSENTE", "SUPERSESSION_CONTEXTO_INVALIDO"]));
  });
  it("delta toma consulta confirmada e não o último evento de encontro anterior", () => {
    const antigo = evento("fato-anterior", "diagnostico", {encounterId: "consulta1", criadoEm: "2026-10-01T11:00:00-03:00"});
    const novo = evento("fato-novo", "diagnostico", {supersedesEventId: antigo.eventId});
    const r = projetarRetrato([antigo,consulta("confirmada1","consulta1","2026-10-01"), novo,
      evento("correcao-antiga","TNM", {encounterId: "consulta0", criadoEm: "2026-10-12T11:00:00-03:00"})], contexto);
    expect(r.delta.encounterAnteriorId).toBe("consulta1");
    expect(r.delta.substituidos.map(f=>f.eventId)).toEqual(["fato-anterior"]);
    expect(r.delta.novos.map(f=>f.eventId)).toContain("fato-novo");
  });
  it("não promove rascunho nem suspeita e cada frase tem referência", () => {
    const incerto = evento("incerto", "diagnostico", {payload: {reviewDecisionId: "r", data: {campo: "diagnostico", valor: "metástase?", status: "INCERTO", negado: false}}});
    const r = projetarRetrato([incerto,evento("raw", "TNM", {revisao: "RAW"})], contexto);
    expect(r.fatos).toHaveLength(1); expect(r.resumo[0]?.texto).toContain("INCERTO");
    expect(r.resumo[0]?.fatos[0]).toEqual(r.fatos[0]?.ref);
  });
  it("não altera documento assinado ou fato de snapshot histórico após correção", () => {
    const antigo = evento("assinado", "TNM", {revisao: "ASSINADO", criadoEm: "2026-10-01T12:00:00-03:00",
      payload: {data: {campo: "TNM", valor: "cT2", dataClinica: "2026-10-01"}}});
    antigo.fontes = antigo.fontes.map(f => ({...f, dataClinica: "2026-10-01", dataCaptura: antigo.criadoEm}));
    const antes = JSON.stringify(antigo);
    const antigoRetrato = projetarRetrato([antigo], {...contexto, agora: "2026-10-02T12:00:00-03:00"});
    const novo = evento("novo", "TNM", {supersedesEventId: antigo.eventId});
    const repetido = projetarRetrato([antigo,novo], {...contexto, agora: "2026-10-02T12:00:00-03:00"});
    expect(antigoRetrato.fatos.map(f=>f.ref.eventId)).toEqual(["assinado"]);
    expect(repetido.fatos.map(f=>f.ref.eventId)).toEqual(["assinado"]);
    expect(repetido.fatos.some(f=>f.ref.eventId === "novo")).toBe(false);
    expect(antigoRetrato).toEqual(repetido); expect(JSON.stringify(antigo)).toBe(antes);
  });
  it("tempo futuro não entra no presente; duplicata não elege valor", () => {
    const futuro = evento("futuro", "TNM", {payload: {data: {campo: "TNM", valor: "cT4", dataClinica: "2026-12-10"}}});
    const duplicado = evento("duplicado");
    const r = projetarRetrato([futuro,duplicado,{...duplicado,payload: {data: {campo: "diagnostico",valor: "outro"}}}], contexto);
    expect(r.fatos).toEqual([]); expect(r.integridade.map(i=>i.motivo)).toContain("TEMPO_CLINICO_FUTURO");
    expect(r.integridade.map(i=>i.motivo)).toContain("EVENT_ID_DUPLICADO");
  });
});
