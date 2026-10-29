// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ClinicalEvent } from "../../../src/contracts/operacao.js";
import type { Retrato } from "../../../src/contracts/f1/retrato.js";
import { ConsultaResposta, type ConsultaIntegrada } from "../../../src/ui/api/respostas.js";
import { criarPortaFalsa, ID } from "../../../src/ui/api/fake.js";
import { montarPropsFlash } from "../../../src/ui/consulta/flashDaVisao.js";
import { ConsultaFlash } from "../../../src/ui/consulta/ConsultaFlash.js";
import { projetarRetrato } from "../../../src/kernel/projections/retrato/index.js";
import { ausente, presente } from "../../fixtures/triagem.js";

afterEach(cleanup);
const agora = "2026-10-12T12:00:00-03:00";
const ctx = { patientId: ID.verde, encounterId: "en-verde", tumorLotId: "lot-verde" };
function evento(id: string, data: Record<string, unknown>, extra: Partial<ClinicalEvent> = {}): ClinicalEvent {
  return { eventId: id, operationId: `op-${id}`, eventIndex: 0, ...ctx, tipo: "FATO", payload: { data },
    fontes: [{ sourceId: `fonte-${id}`, classe: "DOCUMENT", localizador: "página 1", dataClinica: "2026-10-09",
      dataCaptura: agora, versao: "1", contentHash: `hash-fonte-${id}` }], revisao: "CONFIRMADO", criadoEm: agora,
    criadoPor: { tipo: "SESSAO", id: "medico-sintetico" }, supersedesEventId: null, ...extra };
}
function fato(id: string, domain: "lab" | "diagnosis", valor: unknown, data: Record<string, unknown> = {}, extra: Partial<ClinicalEvent> = {}) {
  return evento(id, { campo: domain === "lab" ? "extracao.lab:HEMOGLOBINA" : "extracao.diagnosis", domain, valor,
    sourceId: `fonte-${id}`, factId: id, sourceType: "medical_note", evidence: "EXPLICIT", confidence: 1,
    requiresConfirmation: false, rawEvidence: "Texto documental sintético", dataClinica: "2026-10-09", factDate: "2026-10-09", ...data }, extra);
}
const hb = (id = "hb", valor: unknown = { marker: "HEMOGLOBINA", value: 8.2, unit: "g/dL" }, data: Record<string, unknown> = {}, extra: Partial<ClinicalEvent> = {}) => fato(id, "lab", valor, data, extra);
const dx = (id = "dx", valor: unknown = "câncer de cólon metastático", data: Record<string, unknown> = {}, extra: Partial<ClinicalEvent> = {}) => fato(id, "diagnosis", valor, data, extra);
const labLegado = (id = "legado", valor = 8.2, unidade = "g/dL", data = "2026-10-09", extra: Partial<ClinicalEvent> = {}) =>
  evento(id, { campo: "Hb", valor, unidade, data, sourceId: `fonte-${id}` }, { tipo: "LabResult", ...extra });
const linhaLegada = (id = "legado", fraseLaudo = "8.2 g/dL", data = "2026-10-09") =>
  ({ eventId: id, data, nome: "Hb", fraseLaudo, situacao: "SEM_REFERENCIA" as const });
function retrato(eventos: ClinicalEvent[], contexto: { patientId: string; encounterId: string; tumorLotId: string | null } = ctx): Retrato {
  return projetarRetrato(eventos, { ...contexto, agora, regras: [], biblioteca: { id: "bib", versao: "1", hash: "hash-bib" } });
}
async function visao(eventos: ClinicalEvent[] = []): Promise<ConsultaIntegrada> {
  const base = await criarPortaFalsa().carregarConsulta(ctx.patientId, ctx.tumorLotId, ctx.encounterId);
  return { ...base, hoje: "2026-10-12", cabecalho: { ...base.cabecalho,
    lotes: base.cabecalho.lotes.map(l => ({ ...l, topografia: ausente<string>(), histologia: ausente<string>() })) },
    flash: { exames: [], retornoDias: null, modeloPadraoSalvo: false, laboratorioPreMarcado: false, imagemPreMarcada: false,
      laboratorios: [], avisos: [] }, retrato: retrato(eventos) };
}
const props = (v: ConsultaIntegrada) => montarPropsFlash(v, null, () => {}, () => {});

describe("Flash · exibição de fatos de extração confirmados", () => {
  it("exibe diagnóstico e Hb com data, unidade e fonte, sem criar faixa ou preencher lote", async () => {
    const v = await visao([dx(), hb()]), antes = JSON.stringify(v), p = props(v);
    render(<ConsultaFlash {...p} />);
    expect(within(screen.getByRole("region", { name: "Revisão rápida" })).getByText(/câncer de cólon metastático/)).toBeTruthy();
    const labs = screen.getByRole("region", { name: "Resultados laboratoriais" });
    expect(labs.textContent).toContain("HEMOGLOBINA: 8.2 g/dL");
    expect(labs.textContent).toContain("2026-10-09");
    expect(labs.textContent).toContain("fonte-hb");
    expect(labs.textContent).toContain("sem referência");
    expect(p.laboratorios?.[0]).toMatchObject({ situacao: "SEM_REFERENCIA", sourceIds: ["fonte-hb"], fatos: [v.retrato!.fatos.find(f => f.ref.eventId === "hb")!.ref] });
    expect(p.avisos?.join(" ")).toContain("fonte-dx");
    expect(JSON.stringify(v)).toBe(antes);
    expect(v.cabecalho.lotes[0]?.topografia.campo).toBe("AUSENTE");
  });

  it.each(["patientId", "encounterId", "tumorLotId"] as const)("rejeita retrato de outro %s", async campo => {
    const v = await visao([dx(), hb()]);
    v.retrato = { ...v.retrato!, [campo]: "outro-contexto" };
    const p = props(v);
    expect(p.cabecalho.diagnostico).toBeUndefined();
    expect(p.laboratorios).toEqual([]);
    expect(p.avisos?.join(" ")).toContain("contexto ou referências");
  });

  it("sem lote explícito não herda diagnóstico do cabeçalho selecionado; lab sistêmico continua disponível", async () => {
    const v = await visao();
    v.cabecalho.lotes[0]!.topografia = presente("diagnóstico de outro lote");
    v.tumorLotId = null;
    v.retrato = retrato([dx(), hb()], { ...ctx, tumorLotId: null });
    const p = props(v);
    expect(p.cabecalho.diagnostico).toBeUndefined();
    expect(p.laboratorios).toHaveLength(1);
    expect(p.apac.cid).toBe("");
  });

  it("exibe diagnóstico literal sem lote somente do encontro atual e avisa que não houve vínculo tumoral", async () => {
    const v = await visao(); v.tumorLotId = null;
    v.retrato = retrato([dx("atual-sem-lote", "câncer de cólon metastático", {}, { tumorLotId: null }),
      dx("antigo-sem-lote", "neoplasia de outra consulta", {}, { tumorLotId: null, encounterId: "consulta-anterior" }),
      dx("com-lote", "diagnóstico de lote definido")], { ...ctx, tumorLotId: null });
    const p = props(v);
    expect(p.cabecalho.diagnostico).toBe("câncer de cólon metastático");
    expect(p.avisos?.join(" ")).toContain("lote tumoral não vinculado");
    expect(p.avisos?.join(" ")).not.toContain("neoplasia de outra consulta");
    expect(p.avisos?.join(" ")).not.toContain("diagnóstico de lote definido");
    expect(v.tumorLotId).toBeNull();
  });

  it("laboratório do paciente atravessa tumor; diagnóstico de outro tumor não é emprestado", async () => {
    const p = props(await visao([dx("outro-dx", "neoplasia de outro tumor", {}, { tumorLotId: "outro" }),
      hb("outro-lab", undefined, {}, { tumorLotId: "outro" })]));
    expect(p.cabecalho.diagnostico).toBeUndefined();
    expect(p.laboratorios).toHaveLength(1);
  });

  it("respeita o corte histórico do Retrato mesmo com Hb posterior retrodatada", async () => {
    const agenda = (id: string, encounterId: string, data: string) => evento(id,
      { patientId: ctx.patientId, encounterId, data, horario: "09:00" }, { tipo: "AgendaEntry", encounterId });
    const v = await visao();
    const todos = [agenda("e0", "historico", "2026-10-05"), agenda("e1", ctx.encounterId, "2026-10-12"),
      hb("hb-anterior", undefined, { dataClinica: "2026-10-01", factDate: "2026-10-01" }, { encounterId: "historico" }),
      hb("hb-posterior", { marker: "HEMOGLOBINA", value: 9, unit: "g/dL" }, { dataClinica: "2026-10-01", factDate: "2026-10-01" })];
    v.encounterId = "historico"; v.retrato = retrato(todos, { ...ctx, encounterId: "historico" });
    const p = props(v);
    expect(p.laboratorios).toHaveLength(1);
    expect(p.laboratorios?.[0]?.fraseLaudo).toContain("8.2 g/dL");
    expect(p.laboratorios?.[0]?.fraseLaudo).not.toContain("fonte-hb-posterior");
  });

  it("não promove RAW, ReviewDecision, texto-only, evidência incerta ou confirmação pendente", async () => {
    const p = props(await visao([hb("raw", undefined, {}, { revisao: "RAW" }),
      hb("review", undefined, {}, { tipo: "ReviewDecision" }),
      evento("texto-only", { kind: "ExtracaoResumoRevisado", texto: "Hemoglobina 7 g/dL" }, { tipo: "ReviewDecision" }),
      hb("incerto", undefined, { evidence: "UNCERTAIN" }), hb("pendente", undefined, { requiresConfirmation: true }),
      dx("dx-incerto", "neoplasia candidata", { evidence: "UNCERTAIN" }),
      dx("dx-inferido", "neoplasia inferida", { evidence: "INFERRED" })]));
    expect(p.laboratorios).toEqual([]);
    expect(p.cabecalho.diagnostico).toBeUndefined();
  });

  it.each([{ negated: true }, { negado: true }, { suspeita: true }, { presente: false }, { status: "INCERTO" }])(
    "preserva qualificador %j sem afirmar diagnóstico", async qualificador => {
      const p = props(await visao([dx("qualificado", { raw: "neoplasia", ...qualificador })]));
      expect(p.cabecalho.diagnostico).toBeUndefined();
      expect(p.avisos?.join(" ")).toContain("negação ou qualificação preservada");
      expect(p.avisos?.join(" ")).toContain("fonte-qualificado");
    });

  it("diagnósticos divergentes ou positivo versus negado não elegem uma verdade", async () => {
    for (const segundo of [dx("outro", "neoplasia pulmonar"), dx("negado", { raw: "câncer de cólon metastático", negated: true })]) {
      const p = props(await visao([dx(), segundo]));
      expect(p.cabecalho.diagnostico).toContain("A CONFERIR");
      expect(p.avisos?.join(" ")).toContain("sem eleição automática");
    }
  });

  it.each([
    { caso: "múltiplos positivos", segundo: dx("outro", "neoplasia pulmonar"), fonte: "fonte-outro", literal: "neoplasia pulmonar" },
    { caso: "positivo e negado", segundo: dx("negado", { raw: "câncer de cólon metastático", negated: true }), fonte: "fonte-negado", literal: "negação ou qualificação preservada" },
    { caso: "positivo e qualificado", segundo: dx("qualificado", { raw: "neoplasia pancreática", suspeita: true }), fonte: "fonte-qualificado", literal: "neoplasia pancreática" },
  ])("cabeçalho preenchido não elege diagnóstico diante de $caso", async ({ segundo, fonte, literal }) => {
    const v = await visao([dx(), segundo]);
    v.cabecalho.lotes[0]!.topografia = presente("câncer de cólon metastático");
    const antes = JSON.stringify(v), p = props(v);
    expect(p.cabecalho.diagnostico).toBe("A CONFERIR — afirmações diagnósticas divergentes");
    expect(p.avisos?.join(" ")).toContain("sem eleição automática");
    expect(p.avisos?.join(" ")).toContain("câncer de cólon metastático");
    expect(p.avisos?.join(" ")).toContain(literal);
    expect(p.avisos?.join(" ")).toContain("fonte-dx");
    expect(p.avisos?.join(" ")).toContain(fonte);
    render(<ConsultaFlash {...p} />);
    const cabecalho = screen.getByRole("region", { name: "Revisão rápida" });
    expect(cabecalho.textContent).toContain("A CONFERIR — afirmações diagnósticas divergentes");
    expect(cabecalho.textContent).not.toContain("câncer de cólon metastático");
    expect(cabecalho.textContent).not.toContain("neoplasia pulmonar");
    expect(cabecalho.textContent).not.toContain("neoplasia pancreática");
    expect(screen.getByLabelText("Lembretes agrupados").textContent).toContain(fonte);
    expect(JSON.stringify(v)).toBe(antes);
  });

  it.each(["sem neoplasia", "não há neoplasia", "suspeita de neoplasia", "neoplasia?"])(
    "não remove qualificadores do literal %s para afirmar diagnóstico", async literal => {
      const p = props(await visao([dx("literal-qualificado", literal)]));
      expect(p.cabecalho.diagnostico).toBeUndefined();
      expect(p.avisos?.join(" ")).toContain(literal);
      expect(p.avisos?.join(" ")).toContain("A CONFERIR");
    });

  it("conserva cabeçalho presente e sinaliza descrição diferente; cabeçalho em conflito não recebe fallback afirmativo", async () => {
    const v = await visao([dx()]), lote = v.cabecalho.lotes[0]!;
    lote.topografia = presente("neoplasia pulmonar");
    expect(props(v).cabecalho.diagnostico).toBe("neoplasia pulmonar");
    expect(props(v).avisos?.join(" ")).toContain('cabeçalho "neoplasia pulmonar"; extração "câncer de cólon metastático"');
    lote.topografia = { ...lote.topografia, campo: "CONFLITO", estado: "VERMELHO", valor: null };
    expect(props(v).cabecalho.diagnostico).toContain("A CONFERIR");
    expect(props(v).avisos?.join(" ")).toContain("extraído preservado");
  });

  it("une duplicata legada preservando fonte/referência e sinaliza valores ou unidades distintos na mesma data", async () => {
    const v = await visao([hb(), labLegado()]);
    v.flash!.laboratorios = [linhaLegada("legado", "8,2 g/dL")];
    expect(props(v).laboratorios).toHaveLength(1);
    expect(props(v).laboratorios?.[0]).toMatchObject({ sourceIds: ["fonte-hb", "fonte-legado"] });
    for (const fraseLaudo of ["9 g/dL", "8.2 mg/dL"]) {
      v.retrato = retrato([hb(), labLegado("legado", fraseLaudo === "9 g/dL" ? 9 : 8.2, fraseLaudo.endsWith("mg/dL") ? "mg/dL" : "g/dL")]);
      v.flash!.laboratorios = [{ ...linhaLegada("legado", fraseLaudo), situacao: "DENTRO_DO_LIMITE" }];
      const p = props(v);
      expect(p.laboratorios).toHaveLength(2);
      expect(p.laboratorios?.every(l => l.fraseLaudo?.includes("A CONFERIR") && l.situacao === "SEM_REFERENCIA")).toBe(true);
    }
  });

  it("mantém o último resultado e os conflitos anteriores sem alterar unidade ou valor", async () => {
    const p = props(await visao([hb("antigo", { marker: "HEMOGLOBINA", value: 10, unit: "g/dL" }, { dataClinica: "2026-10-01" }),
      hb("conflito", { marker: "HEMOGLOBINA", value: 11, unit: "g/dL" }, { dataClinica: "2026-10-01" }), hb()]));
    expect(p.laboratorios).toHaveLength(3);
    expect(p.laboratorios?.filter(l => l.data === "2026-10-01").every(l => l.fraseLaudo?.includes("A CONFERIR"))).toBe(true);
    const semConflito = props(await visao([hb("antigo", undefined, { dataClinica: "2026-10-01" }), hb()]));
    expect(semConflito.laboratorios).toHaveLength(1);
    expect(semConflito.laboratorios?.[0]?.data).toBe("2026-10-09");
  });

  it("exclui laboratório sem data/unidade, fonte ausente/divergente, marcador incoerente e registro futuro", async () => {
    const semData = hb("sem-data");
    const dados = (semData.payload as { data: Record<string, unknown> }).data;
    delete dados.dataClinica; delete dados.factDate;
    semData.fontes = semData.fontes.map(f => ({ ...f, dataClinica: null }));
    const v = await visao([semData,
      hb("sem-unidade", { marker: "HEMOGLOBINA", value: 8.2, unit: "" }),
      hb("texto-numero", { marker: "HEMOGLOBINA", value: "8.2", unit: "g/dL" }),
      hb("sem-fonte", undefined, {}, { fontes: [] }), hb("fonte-divergente", undefined, { sourceId: "outra-fonte" }),
      hb("marcador-divergente", { marker: "CREATININA", value: 8.2, unit: "g/dL" }),
      hb("futuro", undefined, { dataClinica: "2026-10-13" }),
      hb("registro-futuro", undefined, {}, { criadoEm: "2026-10-13T12:00:00-03:00" })]);
    expect(props(v).laboratorios).toEqual([]);
    expect(v.retrato!.fatos.some(f => f.ref.eventId === "sem-data")).toBe(true);
    expect(props(v).avisos?.join(" ")).toContain("data civil de coleta não disponível (NÃO CONSTA)");
  });

  it("instantes UTC/offset ficam pendentes sem ordenação lexical; data civil não elege valor contra timestamp legado", async () => {
    const v = await visao([hb("utc", undefined, { dataClinica: "2026-10-09T15:00:00Z" }),
      hb("offset", { marker: "HEMOGLOBINA", value: 9, unit: "g/dL" }, { dataClinica: "2026-10-09T12:00:00-03:00" })]);
    expect(props(v).laboratorios).toEqual([]);
    expect(props(v).avisos?.filter(a => a.includes("data civil de coleta não disponível"))).toHaveLength(2);
    v.retrato = retrato([hb(), labLegado("legado", 9, "g/dL", "2026-10-09T15:00:00Z")]);
    v.flash!.laboratorios = [{ ...linhaLegada("legado", "9 g/dL", "2026-10-09T15:00:00Z"), situacao: "DENTRO_DO_LIMITE" }];
    const p = props(v);
    expect(p.laboratorios).toHaveLength(2);
    expect(p.laboratorios?.every(l => l.fraseLaudo?.includes("A CONFERIR") && l.situacao === "SEM_REFERENCIA")).toBe(true);
  });

  it("rejeita retrato malformado, referência inexistente e fatos com integridade pendente", async () => {
    const v = await visao([hb()]);
    v.retrato!.integridade.push({ eventoId: "hb", tipo: "FATO", motivo: "PAYLOAD_INVALIDO" });
    expect(props(v).laboratorios).toEqual([]);
    v.retrato = retrato([hb()]); v.retrato.resumo[0]!.fatos = [{ eventId: "nao-existe", revisao: "x" }];
    expect(props(v).laboratorios).toEqual([]);
    v.retrato = { schema: "INVALIDO" } as unknown as Retrato;
    expect(props(v).laboratorios).toEqual([]);
  });

  it("retratos inválidos ou de contexto divergente não reativam resultados legados", async () => {
    const v = await visao([labLegado()]); v.flash!.laboratorios = [linhaLegada()];
    v.cabecalho.lotes[0]!.histologia = presente("histologia registrada");
    for (const invalido of [null, { schema: "INVALIDO" }, { ...v.retrato!, encounterId: "outro" }]) {
      const p = props({ ...v, retrato: invalido as Retrato });
      expect(p.laboratorios).toEqual([]);
      expect(p.cabecalho.diagnostico).toBe("histologia registrada");
      expect(p.avisos?.join(" ")).toContain("A CONFERIR");
    }
  });

  it("sem Retrato mantém modo legado; com Retrato não promove laboratório sem referência verificável", async () => {
    const v = await visao(); v.cabecalho.lotes[0]!.histologia = presente("histologia registrada");
    v.flash!.laboratorios = [{ data: "2026-10-01", nome: "Cr", fraseLaudo: "1 mg/dL", situacao: "DENTRO_DO_LIMITE" }];
    v.flash!.avisos = ["aviso legado"]; v.flash!.modeloSolicitacoes = { laboratorio: ["HMG"], imagem: ["TC"] };
    const naoVerificavel = props(v);
    expect(naoVerificavel.laboratorios).toEqual([]);
    expect(naoVerificavel.avisos?.join(" ")).toContain("sem referência verificável");
    delete v.retrato;
    const antes = JSON.stringify(v), p = props(v);
    expect(p.cabecalho.diagnostico).toBe("histologia registrada");
    expect(p.laboratorios).toEqual(v.flash!.laboratorios);
    expect(p.avisos).toEqual(v.flash!.avisos);
    expect(p.modeloSolicitacoes).toEqual(v.flash!.modeloSolicitacoes);
    expect(JSON.stringify(v)).toBe(antes);
  });

  it("filtra LabResult legado posterior retrodatado pelo Retrato: ausente em E0, presente em E1, metadados preservados pelo DTO", async () => {
    const eventos = [evento("agenda-e0", { patientId: ctx.patientId, encounterId: "e0", data: "2026-10-05", horario: "09:00" },
      { tipo: "AgendaEntry", encounterId: "e0" }),
    evento("agenda-e1", { patientId: ctx.patientId, encounterId: ctx.encounterId, data: "2026-10-12", horario: "09:00" }, { tipo: "AgendaEntry" }),
    labLegado("legado", 8.2, "g/dL", "2026-10-01")];
    const v = await visao(eventos); v.flash!.laboratorios = [linhaLegada("legado", "8.2 g/dL", "2026-10-01")];
    expect(props(ConsultaResposta.parse(v)).laboratorios).toHaveLength(1);
    v.encounterId = "e0"; v.retrato = retrato(eventos, { ...ctx, encounterId: "e0" });
    expect(props(ConsultaResposta.parse(v)).laboratorios).toEqual([]);
    expect(JSON.stringify(props(v))).not.toContain("8.2 g/dL");
  });

  it("deduplicação de Hb legadas mantém ambas as fontes mesmo quando o fato novo é de outro analito", async () => {
    const novaCr = hb("cr", { marker: "CREATININA", value: 1, unit: "mg/dL" }, { campo: "extracao.lab:CREATININA" });
    const v = await visao([labLegado("a"), labLegado("b"), novaCr]);
    v.flash!.laboratorios = [linhaLegada("a"), linhaLegada("b")];
    const p = props(v);
    expect(p.laboratorios).toHaveLength(2);
    const hbExibida = p.laboratorios?.find(l => l.nome === "Hb");
    expect(hbExibida).toMatchObject({ sourceIds: ["fonte-a", "fonte-b"],
      fatos: [v.retrato!.fatos.find(f => f.ref.eventId === "a")!.ref, v.retrato!.fatos.find(f => f.ref.eventId === "b")!.ref] });
  });
});

it("contexto Flash usa retrato real mesmo com evidências vazias e preserva biomarcador/data/fonte", async () => {
 const marcador = evento("her2", { campo: "extracao.biomarker:HER2", domain: "biomarker", valor: { marker: "HER2", raw: "HER2 negativo", value: "negativo" }, sourceId: "fonte-her2", evidence: "EXPLICIT", requiresConfirmation: false, dataClinica: "2026-10-09" });
 const v = await visao([evento("ecog", { campo: "ecog", valor: 2, dataClinica: "2026-10-09" }), marcador]);
 v.evidencias = [];
 expect(props(v).cabecalho.ecog).toContain("2 · 2026-10-09");
 expect(props(v).cabecalho.biomarcador).toContain("HER2 negativo");
 expect(props(v).cabecalho.biomarcador).toContain("fonte-her2");
 for (const campo of ["patientId", "encounterId", "tumorLotId"] as const) {
  const outro = { ...v, retrato: { ...v.retrato!, [campo]: "outro-contexto" } };
  expect(props(outro).cabecalho.ecog).toBeUndefined(); expect(props(outro).cabecalho.biomarcador).toBeUndefined();
 }
});

it("contexto Flash não arbitra ECOG conflitante nem oculta biomarcador incerto", async () => {
 const v = await visao([evento("ecog-a", { campo: "ecog", valor: 1, dataClinica: "2026-10-09" }),
  evento("ecog-b", { campo: "ecog", valor: 3, dataClinica: "2026-10-09" }),
  evento("marcador-incerto", { campo: "extracao.biomarker", domain: "biomarker", valor: { marker: "HER2", raw: "HER2 a confirmar" }, evidence: "UNCERTAIN", requiresConfirmation: true, dataClinica: "2026-10-09" })]);
 v.evidencias = [];
 expect(props(v).cabecalho.ecog).toContain("A CONFERIR");
 expect(props(v).cabecalho.biomarcador).toContain("A CONFERIR: HER2 a confirmar");
});
