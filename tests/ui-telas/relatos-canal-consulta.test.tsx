// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ContextoAcaoComposta } from "../../src/contracts/api/acoesCompostas.js";
import type { MensagemCanalVisao } from "../../src/ui/api/porta.js";
import { RelatosCanalConsulta } from "../../src/ui/consulta/RelatosCanalConsulta.js";

afterEach(cleanup);

const contexto: ContextoAcaoComposta = {
  patientId: "pt-relato-sintetico", encounterId: "en-relato-a", tumorLotId: "lot-relato-a",
};

function relato(overrides: Partial<MensagemCanalVisao> = {}): MensagemCanalVisao {
  return {
    mensagemId: "msg-relato-1", texto: "Texto do paciente.", em: "2026-09-01T10:00:00-03:00",
    redFlag: false, contatoId: "contato-opaco-sintetico", patientId: contexto.patientId,
    estadoVinculo: "VINCULADO", nomePaciente: "Nome não comprova autoria", candidatos: [],
    origemCanal: "WHATSAPP_SERVICO", pendenciaProcessamento: false,
    reciboTecnico: "RECEBIDA", estadoConversa: "NOVA", midia: null,
    ...overrides,
  };
}

it("exibe somente relato vinculado do contexto e preserva texto literal, negações e estado do canal", () => {
  const callback = vi.fn();
  const original = "<script>não executar</script>\nNão tenho febre nem dor.";
  const view = render(<RelatosCanalConsulta contexto={contexto} aoAbrirCanal={callback} mensagens={[
    relato({ mensagemId: "msg-html", texto: original, redFlag: true, pendenciaProcessamento: true,
      midia: { providerMediaId: "media-opaco-sintetico", mimeType: "audio/ogg", processamento: "NAO_PROCESSADA" } }),
    relato({ mensagemId: "msg-conflito", texto: "Conteúdo conflitante oculto", estadoVinculo: "CONFLITO" }),
    relato({ mensagemId: "msg-revogado", texto: "Conteúdo revogado oculto", estadoVinculo: "REVOGADO" }),
    relato({ mensagemId: "msg-terceiro", texto: "Outro paciente oculto", patientId: "pt-terceiro-sintetico" }),
    relato({ mensagemId: "msg-sem-paciente", texto: "Sem vínculo a paciente", patientId: null, estadoVinculo: "SEM_VINCULO" }),
  ]} />);

  const panel = screen.getByRole("region", { name: "Relatos do canal" });
  expect(panel.textContent).toContain("1 relato vinculado");
  expect(panel.textContent).toContain("Relatos recebidos neste paciente");
  expect(panel.textContent).toContain("Autoria e data clínica: a conferir");
  expect(panel.textContent).toContain("O horário informado pelo canal não confirma quando o sintoma ocorreu.");
  expect(panel.textContent).toContain("WhatsApp do serviço");
  expect(panel.textContent).toContain("não processada; conteúdo não disponível aqui.");
  expect(panel.textContent).toContain("Sinalizador do canal: relato pendente de revisão médica.");
  expect(panel.textContent).toContain("Processamento pendente");
  expect(panel.textContent).toContain("Há 2 relatos deste paciente");
  expect(panel.textContent).not.toContain("Nome não comprova autoria");
  expect(panel.textContent).not.toContain("Conteúdo conflitante oculto");
  expect(panel.textContent).not.toContain("Conteúdo revogado oculto");
  expect(panel.textContent).not.toContain("Outro paciente oculto");
  expect(panel.textContent).not.toContain("Sem vínculo a paciente");
  expect(view.container.querySelector("script")).toBeNull();
  expect(screen.getByText(original, { normalizer: texto => texto }).textContent).toBe(original);
  expect(screen.queryByText(/E1|CTCAE/)).toBeNull();

  const time = panel.querySelector("time");
  expect(time?.getAttribute("datetime")).toBe("2026-09-01T10:00:00-03:00");
  expect(time?.textContent).not.toBe("2026-09-01T10:00:00-03:00");
  const trace = panel.querySelector("details")!;
  expect(trace.open).toBe(false);
  fireEvent.click(within(trace).getByText("Rastreabilidade"));
  expect(trace.open).toBe(true);
  expect(within(trace).getByText("media-opaco-sintetico")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Abrir caixa do canal" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Abrir caixa do canal" }));
  expect(callback).toHaveBeenCalledOnce();
});

it("ordena instantes com offsets pela hora real e identifica horário ilegível sem falhar", () => {
  const view = render(<RelatosCanalConsulta contexto={contexto} mensagens={[
    relato({ mensagemId: "msg-mais-antiga", texto: "Relato de 13:00Z", em: "2026-09-01T10:00:00-03:00" }),
    relato({ mensagemId: "msg-mais-nova", texto: "Relato de 13:30Z", em: "2026-09-01T13:30:00Z" }),
    relato({ mensagemId: "msg-data-invalida", texto: "Relato sem relógio legível", em: "data-sintetica-invalida" }),
  ]} />);

  const lista = screen.getByRole("list");
  const itens = within(lista).getAllByRole("listitem");
  expect(itens[0]?.textContent).toContain("Relato de 13:30Z");
  expect(itens[1]?.textContent).toContain("Relato de 13:00Z");
  expect(itens[2]?.textContent).toContain("Horário do canal ilegível");
  expect(itens[2]?.querySelector("time")?.getAttribute("datetime")).toBe("data-sintetica-invalida");
  expect(itens[2]?.textContent).not.toContain("hoje");
});

it("mantém expansão associada ao paciente, encontro e lote completos e oferece estado vazio discreto", () => {
  const view = render(<RelatosCanalConsulta contexto={contexto} mensagens={[relato()]} />);
  fireEvent.click(screen.getByRole("button", { name: "Ocultar relatos" }));
  expect(screen.getByRole("button", { name: "Mostrar relatos" }).getAttribute("aria-expanded")).toBe("false");

  const trocas = [
    { ...contexto, tumorLotId: "lot-relato-b" },
    { ...contexto, encounterId: "en-relato-b", tumorLotId: "lot-relato-b" },
    { ...contexto, patientId: "pt-relato-b", encounterId: "en-relato-b", tumorLotId: "lot-relato-b" },
  ];
  trocas.forEach((outroContexto, indice) => {
    view.rerender(<RelatosCanalConsulta contexto={outroContexto} mensagens={[
      relato({ mensagemId: `msg-outro-contexto-${indice}`, patientId: outroContexto.patientId,
        texto: `Relato do contexto ${indice}`, em: "2026-09-02T12:00:00Z" }),
    ]} />);
    expect(screen.getByRole("button", { name: "Ocultar relatos" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(`Relato do contexto ${indice}`)).toBeTruthy();
    if (indice < trocas.length - 1) fireEvent.click(screen.getByRole("button", { name: "Ocultar relatos" }));
  });

  const outroContexto = trocas[trocas.length - 1]!;
  view.rerender(<RelatosCanalConsulta contexto={outroContexto} mensagens={[]} />);
  expect(screen.getByText("Nenhum relato vinculado disponível para exibição.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Abrir caixa do canal" })).toBeNull();
  expect(screen.queryByText(/ausência de sintomas|sem sintomas/i)).toBeNull();
});
