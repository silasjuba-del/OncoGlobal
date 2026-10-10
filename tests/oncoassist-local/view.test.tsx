// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OncoassistLocal } from "../../src/ui/OncoassistLocal.js";
import { criarPortaFalsa } from "../../src/ui/api/fake.js";
import type { OpcoesHttp } from "../../src/ui/api/http.js";
import type { ConsultaVisao } from "../../src/ui/api/porta.js";

afterEach(cleanup);
const paciente = "paciente-local-teste";
const consulta = { patientId: paciente, encounterId: "consulta-local", tumorLotId: null };
function fixture() {
  const login = vi.fn(async () => ({ ok: true, expiraEm: null }));
  const agendaDoDia = vi.fn(async () => ({ hoje: "2026-10-07", itens: [
    { patientId: paciente, nome: "Pessoa sintética da agenda", horario: "08:00", prontuario: "teste",
      semaforo: "VERDE" as const, pendentes: 0, preConsultaPronta: true, contatosDesdeUltima: 0, temE1: false },
  ] }));
  const carregarConsulta = vi.fn(async () => consulta as ConsultaVisao);
  const oncoassistStatus = vi.fn(async () => ({ status: "PENDENTE" as const, motivo: "CHAVE_AUSENTE" }));
  const porta = { ...criarPortaFalsa(), login, agendaDoDia, carregarConsulta, oncoassistStatus,
    oncoassistFontes: async () => ({ fontes: [] }),
  };
  let opcoes!: OpcoesHttp;
  const fabrica = vi.fn((o: OpcoesHttp) => { opcoes = o; return porta; });
  return { porta, fabrica, expirar: () => opcoes.onSessaoExpirada() };
}
function entrar() {
  fireEvent.change(screen.getByLabelText("Senha do servidor"), { target: { value: "senha-sintetica-para-teste" } });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
}

describe("modo local explícito OncoAssist", () => {
  it("consulta servidor só após login; chave ausente aparece como pendência", async () => {
    const f = fixture();
    render(<OncoassistLocal fabricaPorta={f.fabrica} />);
    expect(f.porta.agendaDoDia).not.toHaveBeenCalled();
    expect(f.porta.oncoassistStatus).not.toHaveBeenCalled();
    entrar();
    const select = await screen.findByLabelText("Paciente da agenda");
    expect(f.porta.login).toHaveBeenCalledWith("senha-sintetica-para-teste");
    fireEvent.change(select, { target: { value: paciente } });
    expect(await screen.findByText(/aguardando configuração/)).toBeTruthy();
    expect(f.porta.oncoassistStatus).toHaveBeenCalledTimes(1);
    expect(f.porta.carregarConsulta).toHaveBeenCalledWith(paciente);
    expect(screen.queryByText("Abrir TC")).toBeNull();
    expect(screen.queryByLabelText("Senha do servidor")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Configurações Flash" }));
    expect(await screen.findByRole("checkbox", { name: "Serviço possui receituário especial" })).toBeTruthy();
    expect(screen.queryByLabelText("CNES")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "APAC" }));
    expect(screen.queryByLabelText("CNES")).toBeNull();
  });
  it("login recusado não carrega agenda nem retém senha no campo", async () => {
    const f = fixture(); f.porta.login.mockResolvedValue({ ok: false, expiraEm: null });
    render(<OncoassistLocal fabricaPorta={f.fabrica} />);
    entrar();
    expect(await screen.findByText("Senha não aceita.")).toBeTruthy();
    expect(f.porta.agendaDoDia).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Senha do servidor") as HTMLInputElement).value).toBe("");
  });
  it("rejeita resposta de consulta de outro paciente", async () => {
    const f = fixture();
    f.porta.carregarConsulta.mockResolvedValue({ ...consulta, patientId: "outro" } as ConsultaVisao);
    render(<OncoassistLocal fabricaPorta={f.fabrica} />); entrar();
    fireEvent.change(await screen.findByLabelText("Paciente da agenda"), { target: { value: paciente } });
    expect(await screen.findByText("Consulta local indisponível para este paciente.")).toBeTruthy();
    expect(f.porta.oncoassistStatus).not.toHaveBeenCalled();
  });
  it("expiração descarta consulta em andamento e limpa seleção", async () => {
    const f = fixture();
    let concluir!: (consulta: ConsultaVisao) => void;
    f.porta.carregarConsulta.mockImplementation(() => new Promise((resolve) => { concluir = resolve; }));
    render(<OncoassistLocal fabricaPorta={f.fabrica} />); entrar();
    fireEvent.change(await screen.findByLabelText("Paciente da agenda"), { target: { value: paciente } });
    f.expirar(); concluir(consulta as ConsultaVisao);
    expect(await screen.findByText("Sessão expirada. Entre novamente.")).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Entrar" })).toBeTruthy();
    expect(f.porta.oncoassistStatus).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByLabelText("Paciente da agenda")).toBeNull());
  });
});
