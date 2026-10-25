// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AcoesCompostas } from "../../../src/ui/consulta/AcoesCompostas.js";
import { EditorPrescricaoExecutavel } from "../../../src/ui/consulta/EditorPrescricaoExecutavel.js";
import { PrepararApacConsulta } from "../../../src/ui/consulta/PrepararApacConsulta.js";
import { BarraFechamento } from "../../../src/ui/consulta/BarraFechamento.js";
import { criarPortaFalsa } from "../../../src/ui/api/fake.js";
import { presente, ausente } from "../../fixtures/triagem.js";
import type {
  BasePrescricaoExecutavelResposta,
  PrescricaoExecutavelPreparada,
} from "../../../src/contracts/api/operacaoPrescricaoExecutavel.js";
import type {
  ApacRascunhoPreparado,
  BaseApacRascunhoResposta,
} from "../../../src/contracts/api/apacRascunho.js";

afterEach(cleanup);

const contexto = { patientId: "pt-multi", encounterId: "en-multi", tumorLotId: "lot-multi-a" };

describe("U-H5 · duplo clique e corrida: confirmar, aceitar e fechar disparados duas vezes rápidas → uma única ação", () => {
  it("AcoesCompostas: duplo clique rápido em 'Preparar prévia' e em 'Usar esta proposta revisada' dispara apenas 1 chamada cada", async () => {
    const snap = {
      contexto,
      cicloId: "ci-sint-uh5",
      episodioId: "ep-sint-uh5",
      protocoloId: "AC-T",
      previstoEm: "2026-10-20",
      itens: [{ item: 1, droga: "doxorrubicina", doseMg: 60 }],
    };
    const resultadoPreparado = {
      estado: "PREPARADA" as const,
      tipo: "MANTER_CICLO" as const,
      motivo: "Mantido SINTETICO",
      baseRevisao: "rev-sint-uh5",
      baseHash: "a".repeat(64),
      antes: snap,
      depois: snap,
      diff: [],
      pendencias: [],
    };
    const aoPreparar = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 20));
      return resultadoPreparado;
    });
    const aoUsar = vi.fn();

    render(
      <AcoesCompostas
        base={{ ...snap, revisao: "rev-sint-uh5", baseHash: "a".repeat(64) }}
        tipoInicial="MANTER_CICLO"
        aoPreparar={aoPreparar}
        aoUsar={aoUsar}
      />,
    );

    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Mantido SINTETICO" } });
    const btnPreparar = screen.getByRole("button", { name: "Preparar prévia" });
    act(() => {
      btnPreparar.click();
      btnPreparar.click();
    });

    expect(aoPreparar).toHaveBeenCalledTimes(1);

    const btnUsar = await screen.findByRole("button", { name: "Usar esta proposta revisada" });
    act(() => {
      btnUsar.click();
      btnUsar.click();
    });

    expect(aoUsar).toHaveBeenCalledTimes(1);
  });

  it("EditorPrescricaoExecutavel: duplo clique rápido em 'Preparar prévia exata' e em 'Confirmar e assinar prescrição' dispara apenas 1 chamada cada", async () => {
    const conteudo: PrescricaoExecutavelPreparada["conteudo"] = {
      schema: "PrescricaoExecutavel@1",
      contexto: { ...contexto, episodioId: "ep-sintetico", cicloId: "ciclo-sintetico" },
      documentId: "rx-sintetica-uh5",
      documentVersion: 1,
      protocoloId: "protocolo-sintetico",
      dataPrevista: "2026-10-20",
      motivo: "Revisão sintética",
      origemProposta: null,
      itens: [
        {
          itemId: "item-sintetico",
          item: {
            drug: "Fármaco sintético",
            classe: "QT",
            sequence: 1,
            standardDose: null,
            doseBasis: "FIXED",
            calculatedDose: null,
            prescribedDose: 100,
            unit: "mg",
            adjustmentPercent: null,
            adjustmentReason: null,
            route: "EV",
            diluent: "SF 0,9%",
            finalVolumeMl: 100,
            infusionTime: "30 min",
            days: ["d1"],
            observacao: null,
            source: "MANUAL",
            overrideMotivo: "Motivo sintético explícito",
          },
        },
      ],
    };
    const base: BasePrescricaoExecutavelResposta = {
      contexto,
      pacienteNome: "Paciente SINTETICO U-H5",
      revisao: "a".repeat(64),
      pendencias: [],
      vigente: conteudo,
      episodio: {
        episodioId: "ep-sintetico",
        tumorLotId: contexto.tumorLotId,
        modalidade: "QT",
        intencao: "PALIATIVA",
        intentModifier: null,
        linha: 1,
        esquemaId: "protocolo-sintetico",
        inicio: ausente<string>(),
        fim: ausente<string>(),
      },
      ciclo: {
        cicloId: "ciclo-sintetico",
        episodioId: "ep-sintetico",
        numero: 1,
        previstoEm: "2026-10-20",
        pesoKg: presente(70),
        origemPeso: "MEDIDO",
        ciclosSemPesoConsecutivos: 0,
        comMedico: true,
        prescricaoRef: { documentId: "rx-sintetica-uh5", documentVersion: 1 },
        itens: [{ item: 1, droga: "Fármaco sintético", doseMg: 100, reducaoPct: null }],
      },
    };
    const aoPreparar = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 20));
      return {
        draftId: "draft-sintetico-uh5",
        revision: 0,
        conteudoHash: "b".repeat(64),
        baseHash: base.revisao,
        conteudo: { ...conteudo, documentVersion: 2 },
        texto: "Prescrição sintética 100 mg",
        avisos: [],
        efeitos: ["Assinar versão 2"],
      };
    });
    const aoAssinar = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    render(<EditorPrescricaoExecutavel base={base} aoPreparar={aoPreparar} aoAssinar={aoAssinar} />);

    fireEvent.change(screen.getByLabelText("Motivo da prescrição"), {
      target: { value: "Motivo SINTETICO U-H5" },
    });

    const btnPreparar = screen.getByRole("button", { name: "Preparar prévia exata" });
    act(() => {
      btnPreparar.click();
      btnPreparar.click();
    });

    expect(aoPreparar).toHaveBeenCalledTimes(1);

    const btnAssinar = await screen.findByRole("button", { name: "Confirmar e assinar prescrição" });
    act(() => {
      btnAssinar.click();
      btnAssinar.click();
    });

    expect(aoAssinar).toHaveBeenCalledTimes(1);
  });

  it("PrepararApacConsulta: duplo clique rápido em 'Preparar prévia exata da APAC' e em 'Salvar APAC em rascunho' dispara apenas 1 chamada cada", async () => {
    const baseApac: BaseApacRascunhoResposta = {
      contexto,
      revisao: "c".repeat(64),
      prescricao: {
        documentId: "rx-sintetica-uh5",
        documentVersion: 1,
        protocoloId: "protocolo-sintetico",
        dataPrevista: "2026-10-20",
      },
      camposClinicos: [{ chave: "cid", rotulo: "CID principal", valor: "C50" }],
      sugestao: {
        competencia: "2026-10",
        campos: {
          procedimentoPrincipal: "0304050067",
          quantidadePrincipal: 1,
          pacienteCns: "700000000000005",
          pacienteNascimento: "1958-03-03",
          pacienteSexo: "F",
          nomeMae: "Mãe Sintética",
          nomeEstabelecimento: "Hospital Sintético",
          cnesSolicitante: "2605473",
          solicitanteNome: "Médico Sintético",
          solicitanteCns: "700000000000099",
          justificativa: "Justificativa sintética",
          descricaoDiagnostico: "Carcinoma mamário sintético",
        },
      },
      existentes: [],
      pendencias: [],
    };
    const apacPreparada: ApacRascunhoPreparado = {
      contexto,
      draftId: "draft-apac-uh5",
      revision: 0,
      baseHash: baseApac.revisao,
      conteudoHash: "d".repeat(64),
      permiteExportar: false,
      texto: "APAC RASCUNHO SINTETICO",
      avisos: [],
      pendencias: [],
      apac: {
        apacId: "apac-uh5-1",
        tumorLotId: contexto.tumorLotId,
        prescricaoAssinadaRef: { documentId: "rx-sintetica-uh5", documentVersion: 1 },
        dataGeracaoApp: "2026-10-05",
        competencia: "2026-10",
        campos: baseApac.sugestao.campos,
        estado: "RASCUNHO",
        resultadoExterno: null,
        versao: 1,
        substituiApacId: null,
      },
    };

    const prepararApac = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 20));
      return apacPreparada;
    });
    const confirmarApac = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 20));
      return {
        codigo: "GRAVADA" as const,
        apacId: "apac-uh5-1",
        versao: 1,
        eventId: "ev-apac-uh5",
        estado: "RASCUNHO" as const,
        permiteExportar: false as const,
      };
    });

    const porta = {
      ...criarPortaFalsa(),
      lerBaseApacRascunho: vi.fn(async () => baseApac),
      prepararApacRascunho: prepararApac,
      confirmarApacRascunho: confirmarApac,
    };

    render(<PrepararApacConsulta porta={porta} contexto={contexto} aberto />);

    const btnPreparar = await screen.findByRole("button", { name: "Preparar prévia exata da APAC" });
    await waitFor(() => expect((btnPreparar as HTMLButtonElement).disabled).toBe(false));
    act(() => {
      btnPreparar.click();
      btnPreparar.click();
    });

    expect(prepararApac).toHaveBeenCalledTimes(1);

    const btnConfirmar = await screen.findByRole("button", { name: "Salvar APAC em rascunho" });
    act(() => {
      btnConfirmar.click();
      btnConfirmar.click();
    });

    expect(confirmarApac).toHaveBeenCalledTimes(1);
  });

  it("BarraFechamento: duplo clique rápido em 'validar tudo' e em 'imprimir' dispara apenas 1 chamada cada", () => {
    const onValidar = vi.fn();
    const onImprimir = vi.fn();

    render(
      <BarraFechamento
        patientId="pt-sintetico-uh5"
        tumorLotId="lot-sintetico-uh5"
        encounterId="en-sintetico-uh5"
        blocoAtual="EVOLUCAO"
        registros={[{ id: "reg-uh5", expectedRevision: 0 }]}
        documentos={[
          {
            documentId: "doc-uh5",
            documentVersion: 1,
            titulo: "evolução",
            preMarcado: true,
            visivel: true,
            origem: "MODELO_MEDICO",
          },
        ]}
        alertasVermelhosExibidos={[]}
        idempotencyKey="chave-idempotente-uh5"
        autorExibido="Médico Sintético"
        alvoImpressao={{ tipo: "EVOLUCAO", id: "doc-uh5", versao: 1 }}
        chaveImpressao="chave-impressao-uh5"
        onValidar={onValidar}
        onImprimir={onImprimir}
      />,
    );

    const btnValidar = screen.getByRole("button", { name: "validar tudo" });
    act(() => {
      btnValidar.click();
      btnValidar.click();
    });
    expect(onValidar).toHaveBeenCalledTimes(1);

    const btnImprimir = screen.getByRole("button", { name: "imprimir" });
    act(() => {
      btnImprimir.click();
      btnImprimir.click();
    });
    expect(onImprimir).toHaveBeenCalledTimes(1);
  });
});
