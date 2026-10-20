// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { EstudoServicoSchema, type AvaliacaoEstudoResposta, type AvaliarEstudoPedido, type EstudoServico,
  type ImportarEstudoPedido, type RevisarEstudoPedido } from "../../src/contracts/api/trialsServico.js";
import { PainelEstudos } from "../../src/ui/pesquisa/PainelEstudos.js";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const sourceContent = "Synthetic study title\nInclusion: age is at least 18 years.";
const sourceHash = sha(sourceContent);
const candidateHash = sha("candidate draft v1");
const reviewHash = sha("human review v1");
const factsRevision = sha("confirmed facts revision");
const patientContext = { patientId: "patient-synthetic-1", encounterId: "encounter-synthetic-1", tumorLotId: "lot-synthetic-1" };

function evidence(exactText: string, locator = "page:1/title", overrides: Record<string, unknown> = {}) {
  return { sourceId: "source-study-1", sourceRef: "local:study-1", locator, exactText, contentHash: sourceHash, ...overrides };
}

function evidenced(text: string, locator: string) {
  return { text, evidence: [evidence(text, locator)] };
}

function study(overrides: Record<string, unknown> = {}): EstudoServico {
  return EstudoServicoSchema.parse({
    draftId: "draft-study-1", revision: 2,
    source: { sourceId: "source-study-1", sourceRef: "local:study-1", originalName: "study.md",
      mimeType: "text/markdown", kind: "MD", contentHash: sourceHash, originalContent: sourceContent,
      attachmentRef: null, locator: null },
    candidate: { candidateId: "candidate-1", sourceId: "source-study-1", sourceHash,
      reviewStatus: "PENDENTE_REVISAO_MEDICA", studyId: null,
      title: evidenced("Synthetic study title", "page:1/title"), description: null,
      arms: [{ armId: "arm-1", name: evidenced("Experimental arm", "page:1/arm"), description: null }],
      inclusionCriteria: [{ criterionId: "criterion-age", polarity: "INCLUSAO", groupId: null,
        groupOperator: null, expression: null, rawText: "Inclusion: age is at least 18 years.", status: "PENDENTE",
        evidence: [evidence("Inclusion: age is at least 18 years.", "page:1/paragraph:2")] }],
      exclusionCriteria: [], outcomes: [], warnings: [] },
    candidateHash, review: null,
    ...overrides,
  });
}

function reviewedStudy(): EstudoServico {
  const current = study();
  return EstudoServicoSchema.parse({ ...current, review: {
    candidateId: current.candidate.candidateId, decisionId: "decision-1", reviewerId: "reviewer-1",
    reviewedAt: "2026-10-20T14:30:00-03:00", decision: "CONFIRMAR", version: 1,
    candidateHash, reviewHash, studyId: "study-1", title: evidenced("Synthetic study title", "page:1/title"),
    reviewedCriteria: [{ criterionId: "criterion-age", polarity: "INCLUSAO", groupId: null, groupOperator: null,
      expression: { kind: "NUMBER", factKey: "ageYears", operator: "GTE", value: 18, unit: "years" },
      applicability: "APLICAVEL", notApplicableReason: null,
      rawText: "Inclusion: age is at least 18 years.", evidence: [evidence("Inclusion: age is at least 18 years.", "page:1/paragraph:2")] }],
    reviewedArmIds: ["arm-1"],
  } });
}

function reviewedStudyWithoutArms(): EstudoServico {
  const current = reviewedStudy();
  return EstudoServicoSchema.parse({ ...current, candidate: { ...current.candidate, arms: [] },
    review: { ...current.review!, reviewedArmIds: [] } });
}

function evaluation(context = patientContext): AvaliacaoEstudoResposta {
  return {
    contexto: context,
    estudo: reviewedStudy(),
    revisaoFatos: factsRevision,
    resultado: { status: "POSSIBLE_MATCH", reviewedStudyVersion: 1,
      criteria: [{ criterionId: "criterion-age", status: "ATENDIDO", reason: "Idade confirmada atende à regra.",
        sources: [evidence("Idade 62 anos confirmada.", "ledger:event-1")] }] },
    fatos: [{ patientId: context.patientId, factKey: "ageYears", value: 62, unit: "years", status: "CONFIRMADO",
      source: evidence("Idade 62 anos confirmada.", "ledger:event-1"), validFrom: "2025-01-01", validTo: "2026-12-31" }],
    elegivel: false,
  };
}

function reviewDraftFields() {
  return {
    "Título revisado": "Synthetic study title",
    "ID do estudo": "study-1",
    "Evidência exata do título": "page:1/title",
    "Fato vinculado · criterion-age": "ageYears",
    "Operador · criterion-age": "GTE",
    "Valor numérico · criterion-age": "18",
    "Unidade · criterion-age": "years",
  };
}

function fillReviewMetadata(includeArm = true) {
  const values = reviewDraftFields();
  fireEvent.change(screen.getByLabelText("Título revisado"), { target: { value: values["Título revisado"] } });
  fireEvent.change(screen.getByLabelText("ID do estudo"), { target: { value: values["ID do estudo"] } });
  fireEvent.change(screen.getByLabelText("Evidência exata do título"), { target: { value: values["Evidência exata do título"] } });
  fireEvent.change(screen.getByLabelText("Aplicabilidade · critério 1"), { target: { value: "APLICAVEL" } });
  fireEvent.change(screen.getByLabelText("Tipo de vinculação · critério 1"), { target: { value: "NUMBER" } });
  fireEvent.change(screen.getByLabelText("Fato vinculado · critério 1"), { target: { value: values["Fato vinculado · criterion-age"] } });
  fireEvent.change(screen.getByLabelText("Operador · critério 1"), { target: { value: values["Operador · criterion-age"] } });
  fireEvent.change(screen.getByLabelText("Valor numérico · critério 1"), { target: { value: values["Valor numérico · criterion-age"] } });
  fireEvent.change(screen.getByLabelText("Unidade · critério 1"), { target: { value: values["Unidade · criterion-age"] } });
  if (includeArm) fireEvent.click(screen.getByLabelText("Revisar braço · arm-1"));
}

describe("PainelEstudos", () => {
  it("importa texto literal com idempotency key estável no retry e preserva o formulário após erro", async () => {
    const imported = study();
    const aoImportar = vi.fn<(...args: [ImportarEstudoPedido]) => Promise<EstudoServico>>()
      .mockRejectedValueOnce(new Error("Falha de importação sintética"))
      .mockResolvedValueOnce(imported);
    const aoAlterarPendente = vi.fn();
    const aoAlterarSalvamento = vi.fn();
    render(<PainelEstudos estudos={[]} contexto={null} aoImportar={aoImportar} aoRevisar={vi.fn()}
      aoAvaliar={vi.fn()} aoAlterarPendente={aoAlterarPendente} aoAlterarSalvamento={aoAlterarSalvamento} />);
    const sourceText = "# Synthetic study\nLiteral source text with exact line endings.\n";
    fireEvent.change(screen.getByLabelText("Nome do arquivo-fonte"), { target: { value: "study.md" } });
    fireEvent.change(screen.getByLabelText("Tipo MIME da fonte"), { target: { value: "text/markdown" } });
    fireEvent.change(screen.getByLabelText("Conteúdo literal da fonte"), { target: { value: sourceText } });
    expect(aoAlterarPendente).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: "Importar fonte local" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Falha de importação sintética");
    expect(aoAlterarSalvamento.mock.calls.map(([value]) => value)).toEqual([false, true, false]);
    expect(aoAlterarPendente).toHaveBeenLastCalledWith(true);
    expect((screen.getByLabelText("Conteúdo literal da fonte") as HTMLTextAreaElement).value).toBe(sourceText);
    fireEvent.click(screen.getByRole("button", { name: "Importar fonte local" }));
    await screen.findByRole("article", { name: /estudo pendente: synthetic study/i });
    expect(aoImportar).toHaveBeenCalledTimes(2);
    const first = aoImportar.mock.calls[0]![0];
    const second = aoImportar.mock.calls[1]![0];
    expect(first).toEqual({ nome: "study.md", mimeType: "text/markdown", conteudo: sourceText, idempotencyKey: second.idempotencyKey });
    expect(second).toEqual(first);
    expect(screen.getByText("Status: Aguardando revisão médica")).toBeTruthy();
    expect(aoAlterarPendente).toHaveBeenLastCalledWith(false);
  });

  it("lê arquivo TXT localmente e não simula suporte a PDF", async () => {
    const aoImportar = vi.fn(async (_request: ImportarEstudoPedido) => study());
    render(<PainelEstudos estudos={[]} contexto={null} aoImportar={aoImportar} aoRevisar={vi.fn()}
      aoAvaliar={vi.fn()} />);
    const fileInput = screen.getByLabelText("Arquivo de estudo local") as HTMLInputElement;
    expect(fileInput.accept).not.toMatch(/pdf/i);
    fireEvent.change(fileInput, { target: { files: [new File(["literal text"], "paper.txt", { type: "text/plain" })] } });
    await waitFor(() => expect((screen.getByLabelText("Conteúdo literal da fonte") as HTMLTextAreaElement).value).toBe("literal text"));
    expect((screen.getByLabelText("Nome do arquivo-fonte") as HTMLInputElement).value).toBe("paper.txt");
    expect((screen.getByLabelText("Tipo MIME da fonte") as HTMLSelectElement).value).toBe("text/plain");
    fireEvent.change(fileInput, { target: { files: [new File(["fake pdf"], "paper.pdf", { type: "application/pdf" })] } });
    expect((await screen.findByRole("alert")).textContent).toMatch(/TXT, Markdown ou JSON/i);
    expect(aoImportar).not.toHaveBeenCalled();
  });

  it("exige decisão humana, título com evidência exata, bindings e braço revisados", async () => {
    const base = study();
    const current = EstudoServicoSchema.parse({ ...base, candidate: { ...base.candidate,
      arms: [...base.candidate.arms, { armId: "arm-2", name: evidenced("Control arm", "page:1/arm-2"), description: null }] } });
    const reviewed = reviewedStudy();
    const aoRevisar = vi.fn(async (_request: RevisarEstudoPedido) => EstudoServicoSchema.parse({ ...reviewed,
      candidate: { ...reviewed.candidate, arms: current.candidate.arms },
      review: { ...reviewed.review!, reviewedArmIds: ["arm-1", "arm-2"] } }));
    render(<PainelEstudos estudos={[current]} contexto={null} aoImportar={vi.fn()} aoRevisar={aoRevisar}
      aoAvaliar={vi.fn()} />);
    expect(screen.getAllByText("Inclusion: age is at least 18 years.").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Revisar estudo" }));
    expect(screen.getByLabelText("Aplicabilidade · critério 1").matches(":disabled")).toBe(false);
    expect((screen.getByLabelText("Tipo de vinculação · critério 1") as HTMLSelectElement).value).toBe("");
    expect(aoRevisar).not.toHaveBeenCalled();
    fillReviewMetadata();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar estudo revisado" }));
    expect(aoRevisar).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/todos os braços declarados/i);
    fireEvent.click(screen.getByLabelText("Revisar braço · arm-2"));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar estudo revisado" }));

    await waitFor(() => expect(aoRevisar).toHaveBeenCalledTimes(1));
    const request = aoRevisar.mock.calls[0]![0];
    expect(request).toEqual(expect.objectContaining({ draftId: current.draftId, expectedRevision: current.revision,
      candidateHash, studyId: "study-1", decision: "CONFIRMAR", titleText: "Synthetic study title",
      titleEvidenceLocator: "page:1/title", reviewedArmIds: ["arm-1", "arm-2"] }));
    expect(request.bindings).toEqual([{ criterionId: "criterion-age", groupId: null, groupOperator: null,
      expression: { kind: "NUMBER", factKey: "ageYears", operator: "GTE", value: 18, unit: "years" },
      applicability: "APLICAVEL", notApplicableReason: null }]);
    expect("reviewerId" in request).toBe(false);
  });

  it("permite revisar e confirmar candidato sem braços declarados", async () => {
    const pending = EstudoServicoSchema.parse({ ...study(), candidate: { ...study().candidate, arms: [] } });
    const aoRevisar = vi.fn(async (_request: RevisarEstudoPedido) => reviewedStudyWithoutArms());
    render(<PainelEstudos estudos={[pending]} contexto={null} aoImportar={vi.fn()} aoRevisar={aoRevisar}
      aoAvaliar={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Revisar estudo" }));
    fillReviewMetadata(false);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar estudo revisado" }));
    await waitFor(() => expect(aoRevisar).toHaveBeenCalledTimes(1));
    expect(aoRevisar.mock.calls[0]![0].reviewedArmIds).toEqual([]);
    expect(screen.getByText("Status: Protocolo revisado")).toBeTruthy();
  });

  it("mantém os valores editados quando o pai atualiza o guard de pendência em cada mudança", async () => {
    const current = study();
    const aoRevisar = vi.fn(async (_request: RevisarEstudoPedido) => reviewedStudy());
    function ParentControlled() {
      const [pending, setPending] = useState(false);
      return <>
        <output aria-label="Estado de pendência do pai">{pending ? "pendente" : "limpo"}</output>
        <PainelEstudos estudos={[current]} contexto={null} aoImportar={vi.fn()} aoRevisar={aoRevisar}
          aoAvaliar={vi.fn()} aoAlterarPendente={setPending} />
      </>;
    }
    render(<ParentControlled />);
    fireEvent.click(screen.getByRole("button", { name: "Revisar estudo" }));
    fillReviewMetadata();
    expect(screen.getByLabelText("Estado de pendência do pai").textContent).toBe("pendente");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar estudo revisado" }));
    await waitFor(() => expect(aoRevisar).toHaveBeenCalledTimes(1));
    expect(aoRevisar.mock.calls[0]![0]).toEqual(expect.objectContaining({ studyId: "study-1",
      titleText: "Synthetic study title", reviewedArmIds: ["arm-1"] }));
  });

  it("exige motivo para critério não aplicável e mantém o valor quando revisão falha", async () => {
    const aoRevisar = vi.fn(async (_request: RevisarEstudoPedido) => { throw new Error("Falha sintética na revisão"); });
    render(<PainelEstudos estudos={[study()]} contexto={null} aoImportar={vi.fn()} aoRevisar={aoRevisar}
      aoAvaliar={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Revisar estudo" }));
    fireEvent.change(screen.getByLabelText("Título revisado"), { target: { value: "Synthetic study title" } });
    fireEvent.change(screen.getByLabelText("ID do estudo"), { target: { value: "study-1" } });
    fireEvent.change(screen.getByLabelText("Evidência exata do título"), { target: { value: "page:1/title" } });
    fireEvent.change(screen.getByLabelText("Aplicabilidade · critério 1"), { target: { value: "NAO_APLICAVEL" } });
    fireEvent.click(screen.getByLabelText("Revisar braço · arm-1"));
    fireEvent.click(screen.getByRole("button", { name: "Rejeitar estudo" }));
    expect(aoRevisar).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/motivo.*n[aã]o aplic[aá]vel/i);

    fireEvent.change(screen.getByLabelText("Motivo de não aplicável · critério 1"), { target: { value: "Critério não corresponde a este braço." } });
    fireEvent.click(screen.getByRole("button", { name: "Rejeitar estudo" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(aoRevisar).toHaveBeenCalledWith(expect.objectContaining({ decision: "REJEITAR",
      bindings: [expect.objectContaining({ applicability: "NAO_APLICAVEL", notApplicableReason: "Critério não corresponde a este braço." })] }));
    expect((screen.getByLabelText("Título revisado") as HTMLInputElement).value).toBe("Synthetic study title");
    expect((screen.getByLabelText("Motivo de não aplicável · critério 1") as HTMLTextAreaElement).value)
      .toBe("Critério não corresponde a este braço.");
  });

  it("só avalia estudo revisado com contexto, não envia fatos de paciente e nunca declara elegibilidade", async () => {
    const reviewed = reviewedStudy();
    const aoAvaliar = vi.fn(async (_pedido: AvaliarEstudoPedido) => evaluation());
    const view = render(<PainelEstudos estudos={[reviewed]} contexto={null} aoImportar={vi.fn()}
      aoRevisar={vi.fn()} aoAvaliar={aoAvaliar} />);
    expect((screen.getByRole("button", { name: "Avaliar critérios" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Avaliar critérios" }));
    expect(aoAvaliar).not.toHaveBeenCalled();

    view.rerender(<PainelEstudos estudos={[reviewed]} contexto={patientContext} aoImportar={vi.fn()}
      aoRevisar={vi.fn()} aoAvaliar={aoAvaliar} />);
    fireEvent.click(screen.getByRole("button", { name: "Avaliar critérios" }));
    await screen.findByRole("region", { name: "Resultado da avaliação" });
    expect(aoAvaliar).toHaveBeenCalledWith({ contexto: patientContext, draftId: reviewed.draftId,
      expectedRevision: reviewed.revision, expectedReviewHash: reviewHash });
    expect(JSON.stringify(aoAvaliar.mock.calls[0]?.[0])).not.toContain("fatos");
    expect(screen.getByRole("region", { name: "Resultado da avaliação" }).textContent).toContain("ATENDIDO");
    expect(screen.getByText("Idade confirmada atende à regra.")).toBeTruthy();
    expect(screen.getByText(/elegibilidade: n[aã]o determinada/i)).toBeTruthy();
    expect(screen.getByRole("region", { name: "Resultado da avaliação" }).textContent).toContain("Idade 62 anos confirmada.");
  });

  it("ignora resposta de avaliação que chega após troca de contexto", async () => {
    let resolve!: (value: AvaliacaoEstudoResposta) => void;
    const aoAvaliar = vi.fn(() => new Promise<AvaliacaoEstudoResposta>(done => { resolve = done; }));
    const reviewed = reviewedStudy();
    const firstContext = patientContext;
    const view = render(<PainelEstudos estudos={[reviewed]} contexto={firstContext} aoImportar={vi.fn()}
      aoRevisar={vi.fn()} aoAvaliar={aoAvaliar} />);
    fireEvent.click(screen.getByRole("button", { name: "Avaliar critérios" }));
    await waitFor(() => expect(aoAvaliar).toHaveBeenCalledTimes(1));

    const nextContext = { ...patientContext, patientId: "patient-synthetic-2" };
    view.rerender(<PainelEstudos estudos={[reviewed]} contexto={nextContext} aoImportar={vi.fn()}
      aoRevisar={vi.fn()} aoAvaliar={aoAvaliar} />);
    await act(async () => { resolve(evaluation(firstContext)); });
    expect(screen.queryByRole("region", { name: "Resultado da avaliação" })).toBeNull();
    expect(screen.queryByText("Idade 62 anos confirmada.")).toBeNull();
  });

  it.each(["antes", "depois"])("retira resultado antigo quando revisao muda %s da resposta", async (momento) => {
    let resolver!: (value: AvaliacaoEstudoResposta) => void;
    const aoAvaliar = vi.fn(() => new Promise<AvaliacaoEstudoResposta>(done => { resolver = done; }));
    const reviewed = reviewedStudy();
    const props = { contexto: patientContext, aoImportar: vi.fn(), aoRevisar: vi.fn(), aoAvaliar };
    const view = render(<PainelEstudos {...props} estudos={[reviewed]} />);
    fireEvent.click(screen.getByRole("button", { name: "Avaliar critérios" }));
    if (momento === "depois") {
      await act(async () => { resolver(evaluation()); });
      expect(screen.getByRole("region", { name: "Resultado da avaliação" })).toBeTruthy();
    }
    const nova = { ...reviewed, revision: reviewed.revision + 1,
      review: { ...reviewed.review!, version: 2, reviewHash: sha("revisao rejeitada"), decision: "REJEITAR" as const } };
    view.rerender(<PainelEstudos {...props} estudos={[nova]} />);
    if (momento === "antes") await act(async () => { resolver(evaluation()); });
    expect(screen.queryByRole("region", { name: "Resultado da avaliação" })).toBeNull();
    expect(screen.queryByText("Idade confirmada atende à regra.")).toBeNull();
  });

  it("libera leitura de arquivo ao trocar consulta e ignora retorno antigo", async () => {
    const leitores: Array<{ result: string; onload: (() => void) | null }> = [];
    vi.stubGlobal("FileReader", class {
      result = ""; onload: (() => void) | null = null;
      readAsText() { leitores.push(this); }
    });
    const props = { estudos: [], aoImportar: vi.fn(), aoRevisar: vi.fn(), aoAvaliar: vi.fn() };
    const view = render(<PainelEstudos {...props} contexto={patientContext} />);
    fireEvent.change(screen.getByLabelText("Arquivo de estudo local"), {
      target: { files: [new File(["antigo"], "antigo.txt", { type: "text/plain" })] },
    });
    view.rerender(<PainelEstudos {...props} contexto={{ ...patientContext, encounterId: "encontro-2" }} />);
    expect((screen.getByLabelText("Arquivo de estudo local") as HTMLInputElement).disabled).toBe(false);
    fireEvent.change(screen.getByLabelText("Arquivo de estudo local"), {
      target: { files: [new File(["novo"], "novo.txt", { type: "text/plain" })] },
    });
    await act(async () => { leitores[1]!.result = "novo"; leitores[1]!.onload?.(); });
    await act(async () => { leitores[0]!.result = "antigo"; leitores[0]!.onload?.(); });
    expect((screen.getByLabelText("Conteúdo literal da fonte") as HTMLTextAreaElement).value).toBe("novo");
    expect((screen.getByLabelText("Arquivo de estudo local") as HTMLInputElement).disabled).toBe(false);
  });

  it("salvar uma revisao mantem o aviso de outra revisao ainda editada", async () => {
    const pendente = vi.fn();
    render(<PainelEstudos estudos={[study(), study({ draftId: "draft-study-2" })]} contexto={patientContext}
      aoImportar={vi.fn()} aoRevisar={vi.fn(async () => reviewedStudy())} aoAvaliar={vi.fn()}
      aoAlterarPendente={pendente} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Revisar estudo" })[0]!);
    fillReviewMetadata();
    fireEvent.click(screen.getAllByRole("button", { name: "Revisar estudo" })[1]!);
    fireEvent.change(screen.getByLabelText("ID do estudo"), { target: { value: "edicao-pendente-2" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Revisar estudo" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar estudo revisado" }));
    await screen.findByText(/Revisão humana registrada/);
    expect(pendente).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: "Revisar estudo" }));
    expect((screen.getByLabelText("ID do estudo") as HTMLInputElement).value).toBe("edicao-pendente-2");
  });
});
