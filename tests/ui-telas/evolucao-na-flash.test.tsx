// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EvolucaoNaFlash } from "../../src/ui/consulta/EvolucaoNaFlash.js";
import type { AtendimentoV6Resposta } from "../../src/contracts/api/atendimentoV6.js";
afterEach(cleanup);
const dados: AtendimentoV6Resposta = { codigo: "ATENDIMENTO_BASE", formato: "ONCOLOGIA_V6", contexto: { patientId: "paciente-sintetico", encounterId: "encontro-sintetico", tumorLotId: null }, criaEventoClinico: false, assinado: false,
 base: { revisao: "b".repeat(64), pacienteNome: "Paciente sintético", dataReferencia: "2026-10-29", recuperadoEm: "2026-10-29T12:00:00Z", citacoes: [], delta: { encounterAnteriorId: null, novos: [], substituidos: [] }, integridade: [] }, estadoRascunho: "ATUAL", rascunho: { revisaoBase: "b".repeat(64), entrada: { hoje: "Relato sintético", decisao: "Decisão sintética", saidas: ["EVOLUCAO"] }, salvoEm: "2026-10-29T12:00:00Z", id: "evolucao-sintetica", versao: 2, conteudoHash: "a".repeat(64), dataClinica: "2026-10-29", autor: { medicoId: "medico-sintetico", crm: "teste" }, documentos: [{ tipo: "EVOLUCAO", titulo: "Evolução", estado: "PRONTO_PARA_REVISAO", texto: "Texto sintético preservado", pendencias: [] }] } };
it("recupera sob demanda e só inclui a versão por escolha explícita", async () => {
 const carregar = vi.fn().mockResolvedValue(dados), selecionar = vi.fn();
 render(<EvolucaoNaFlash carregar={carregar} selecionada={undefined} aoSelecionar={selecionar} ocupado={false}/>);
 expect(carregar).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole("button", { name: "Conferir evolução salva" }));
 await screen.findByRole("button", { name: "Incluir esta evolução" }); expect(selecionar).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole("button", { name: "Incluir esta evolução" }));
 expect(selecionar).toHaveBeenCalledWith({ id: "evolucao-sintetica", versao: 2, conteudoHash: "a".repeat(64) });
});
it("versão desatualizada permanece visível para conferência mas não pode ser incluída", async () => {
 const selecionar = vi.fn(); render(<EvolucaoNaFlash carregar={async () => ({ ...dados, estadoRascunho: "DESATUALIZADO" })} selecionada={undefined} aoSelecionar={selecionar} ocupado={false}/>);
 fireEvent.click(screen.getByRole("button", { name: "Conferir evolução salva" }));
 const b = await screen.findByRole("button", { name: "Incluir esta evolução" }); expect((b as HTMLButtonElement).disabled).toBe(true);
 fireEvent.click(b); expect(selecionar).not.toHaveBeenCalled();
});
it("falha de rede mantém seleção salva e permite retirada explícita", async () => {
 const selecionar = vi.fn(), ref = { id: "evolucao-sintetica", versao: 2, conteudoHash: "a".repeat(64) };
 render(<EvolucaoNaFlash carregar={async () => { throw Error("offline"); }} selecionada={ref} aoSelecionar={selecionar} ocupado={false}/>);
 fireEvent.click(screen.getByRole("button", { name: "Conferir evolução salva" })); await screen.findByRole("alert"); expect(selecionar).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole("button", { name: "Retirar evolução da Flash" })); expect(selecionar).toHaveBeenCalledWith(undefined);
});
