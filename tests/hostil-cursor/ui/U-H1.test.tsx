// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OverlayFlash } from "../../../src/ui/consulta/OverlayFlash.js";
import { Configuracoes } from "../../../src/ui/oncochart/Configuracoes.js";
import { ImageViewerOncoAssist } from "../../../src/ui/oncochart/ImageViewerOncoAssist.js";
import { BarraFechamento } from "../../../src/ui/consulta/BarraFechamento.js";
import { AcoesCompostas } from "../../../src/ui/consulta/AcoesCompostas.js";
import type { ConsultaFlashProps } from "../../../src/ui/consulta/ConsultaFlash.js";

afterEach(cleanup);

const apacBase = {
  cid: "C50",
  sigtap: "0304050067",
  finalidade: "ADJUVANTE",
  competencia: "2026-10",
  estado: "VALIDA" as const,
  pendencias: [],
};

const flashFixture: ConsultaFlashProps = {
  hoje: "2026-10-05",
  pacienteNome: "Paciente SINTETICO U-H1",
  cabecalho: {
    diagnostico: "Carcinoma mamário sintético",
    tnm: "cT2N0M0",
    estadio: "IIA",
    tratamentoAtual: "AC-T",
    cicloDia: "C1D1",
    ultimoAdministrado: "2026-09-14",
    alergia: "Nenhuma",
  },
  exames: [],
  acoesHoje: [],
  receitas: [],
  apac: apacBase,
  retorno: { dias: 21, examesAntesDoRetorno: [] },
  iaFala: [],
  planoInicial: {
    acoesMarcadas: [],
    receitasMarcadas: [],
    apac: { ...apacBase, emitir: false },
    retorno: { dias: 21, examesAntesDoRetorno: [] },
    tarefasRetorno: { retorno: true, laboratorio: false, imagem: false },
    solicitacoes: { laboratorio: [], imagem: [] },
    decisaoQt: { solicitarCiclo: false, data: "2026-10-05" },
    documentosManuais: [
      { id: "doc-sint-1", tipo: "LAUDO", titulo: "Laudo sintético", destino: null, texto: "Texto SINTETICO" },
    ],
  },
  aoSalvarRascunho: () => {},
  aoFinalizar: () => {},
};

describe("U-H1 · navegação por teclado, foco preso em diálogos e devolução de foco", () => {
  it("OverlayFlash prende foco incluindo textarea/select, fecha com Escape e devolve foco ao gatilho", () => {
    const gatilho = document.createElement("button");
    gatilho.textContent = "Abrir Flash Sintético";
    document.body.appendChild(gatilho);
    gatilho.focus();
    expect(document.activeElement).toBe(gatilho);

    const onFechar = vi.fn();
    const { unmount } = render(<OverlayFlash flash={flashFixture} onFechar={onFechar} />);

    const card = screen.getByRole("dialog", { name: "Consulta Flash" });
    const textareaDoc = screen.getByLabelText("Conteúdo do documento 1");
    // O documento pertence a uma seção recolhida; só conteúdo visível participa do foco.
    for (let secao = textareaDoc.closest("details"); secao; secao = secao.parentElement?.closest("details") ?? null) secao.open = true;
    // Desabilita os botões/inputs posteriores do rodapé para que o textarea seja o último focável ativo do card
    const todosBotoesInputs = Array.from(
      card.querySelectorAll<HTMLElement>("button, input, textarea, select"),
    );
    const idxTextarea = todosBotoesInputs.indexOf(textareaDoc);
    expect(idxTextarea).toBeGreaterThan(0);
    for (const el of todosBotoesInputs.slice(idxTextarea + 1)) {
      (el as HTMLButtonElement | HTMLInputElement).disabled = true;
    }

    const primeiroFocavel = screen.getByRole("button", { name: "Fechar Consulta Flash" });
    textareaDoc.focus();
    expect(document.activeElement).toBe(textareaDoc);

    // Tab no último elemento focável (textarea) deve ciclar para o primeiro focável do diálogo
    fireEvent.keyDown(document, { key: "Tab", shiftKey: false });
    expect(document.activeElement).toBe(primeiroFocavel);

    // Shift+Tab no primeiro focável deve ciclar para o último focável (textarea)
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(textareaDoc);

    // Escape fecha o diálogo
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onFechar).toHaveBeenCalledTimes(1);

    unmount();
    expect(document.activeElement).toBe(gatilho);
    gatilho.remove();
  });

  it("diálogo Configuracoes prende Tab/Shift+Tab, fecha com Escape e devolve foco ao fechar", () => {
    const gatilho = document.createElement("button");
    gatilho.textContent = "Abrir Configurações Sintético";
    document.body.appendChild(gatilho);
    gatilho.focus();

    const onFechar = vi.fn();
    const { unmount } = render(<Configuracoes tema="dia" onTema={() => {}} onFechar={onFechar} />);

    const dialogo = screen.getByRole("dialog", { name: "Configurações" });
    const focaveis = Array.from(
      dialogo.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
      ),
    );
    const primeiro = focaveis[0]!;
    const ultimo = focaveis[focaveis.length - 1]!;

    expect(dialogo.contains(document.activeElement)).toBe(true);

    primeiro.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(ultimo);

    ultimo.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: false });
    expect(document.activeElement).toBe(primeiro);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onFechar).toHaveBeenCalledTimes(1);

    unmount();
    expect(document.activeElement).toBe(gatilho);
    gatilho.remove();
  });

  it("diálogo ImageViewerOncoAssist prende Tab/Shift+Tab, fecha com Escape e devolve foco ao fechar", () => {
    const gatilho = document.createElement("button");
    gatilho.textContent = "Abrir Visualizador Sintético";
    document.body.appendChild(gatilho);
    gatilho.focus();

    const onFechar = vi.fn();
    const { unmount } = render(
      <ImageViewerOncoAssist
        exameTitulo="TC Tórax SINTETICA"
        laudo="Nódulo sintético estável."
        achados={[{ id: "a1", texto: "Nódulo 8 mm", trechoFonte: "p. 1" }]}
        alertasRads={[]}
        onFechar={onFechar}
        onTrecho={() => {}}
      />,
    );

    const dialogo = screen.getByRole("dialog", { name: "Visualizador de imagem" });
    const focaveis = Array.from(
      dialogo.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
      ),
    );
    const primeiro = focaveis[0]!;
    const ultimo = focaveis[focaveis.length - 1]!;

    expect(dialogo.contains(document.activeElement)).toBe(true);

    primeiro.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(ultimo);

    ultimo.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: false });
    expect(document.activeElement).toBe(primeiro);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onFechar).toHaveBeenCalledTimes(1);

    unmount();
    expect(document.activeElement).toBe(gatilho);
    gatilho.remove();
  });

  it("controles de BarraFechamento e AcoesCompostas são alcançáveis por foco e acionáveis sem tabIndex negativo indevido", () => {
    const snap = {
      contexto: { patientId: "pt-sintetico-uh1", encounterId: "en-sintetico-uh1", tumorLotId: "lot-sintetico-uh1" },
      cicloId: "ci-sint-1",
      episodioId: "ep-sint-1",
      protocoloId: "AC-T",
      previstoEm: "2026-10-10",
      itens: [{ item: 1, droga: "doxorrubicina", doseMg: 60 }],
    };
    render(
      <div>
        <BarraFechamento
          patientId="pt-sintetico-uh1"
          tumorLotId="lot-sintetico-uh1"
          encounterId="en-sintetico-uh1"
          blocoAtual="EVOLUCAO"
          registros={[{ id: "reg-1", expectedRevision: 0 }]}
          documentos={[
            {
              documentId: "doc-1",
              documentVersion: 1,
              titulo: "evolução",
              preMarcado: true,
              visivel: true,
              origem: "MODELO_MEDICO",
            },
          ]}
          alertasVermelhosExibidos={[]}
          idempotencyKey="key-uh1"
          autorExibido="Médico Sintético"
          alvoImpressao={{ tipo: "EVOLUCAO", id: "doc-1", versao: 1 }}
          chaveImpressao="imp-uh1"
          onValidar={() => {}}
          onImprimir={() => {}}
        />
        <AcoesCompostas
          base={{
            ...snap,
            revisao: "rev-sint-1",
            baseHash: "a".repeat(64),
          }}
          tipoInicial="MANTER_CICLO"
          aoPreparar={async () => ({
            estado: "PREPARADA",
            tipo: "MANTER_CICLO",
            motivo: "SINTETICO",
            baseRevisao: "rev-sint-1",
            baseHash: "a".repeat(64),
            antes: snap,
            depois: snap,
            diff: [],
            pendencias: [],
          })}
          aoUsar={() => {}}
        />
      </div>,
    );

    const controles = [
      screen.getByRole("button", { name: "validar tudo" }),
      screen.getByRole("button", { name: "validar bloco" }),
      screen.getByRole("button", { name: "imprimir" }),
      screen.getByLabelText("Ação"),
      screen.getByLabelText("Motivo"),
    ];
    for (const controle of controles) {
      expect(controle.getAttribute("tabindex")).not.toBe("-1");
      controle.focus();
      expect(document.activeElement).toBe(controle);
    }
  });
});
