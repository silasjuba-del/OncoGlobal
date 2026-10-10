// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConsultaFlash, type ConsultaFlashProps } from "../../src/ui/consulta/ConsultaFlash.js";
afterEach(cleanup);
const props = (): ConsultaFlashProps => ({cabecalho:{diagnostico:"Dx confirmado",tnm:"T3N1M0",estadio:"III",tratamentoAtual:"Protocolo registrado",cicloDia:"03/08",alergia:"Penicilina"},
exames:[{data:"2026-10-01",nome:"Biópsia",fraseLaudo:"Histologia confirmada",situacao:"SEM_REFERENCIA"}],toxicidades:["Diarreia", "Vômito"],acoesHoje:[],receitas:[],apac:{cid:"",sigtap:"",finalidade:"",competencia:"",estado:"PENDENTE",pendencias:[]},iaFala:[],retorno:{dias:21,examesAntesDoRetorno:[]},aoSalvarRascunho:vi.fn(),aoFinalizar:vi.fn()});
describe("Flash essencial definida pelo médico", () => {
 it("mostra fontes, TNM, ciclo, sintomas e alergia; não incorpora APAC nem ações da consulta grande", () => {
  render(<ConsultaFlash {...props()} />);
  expect(screen.getByLabelText("Biópsia e imagem").textContent).toContain("2026-10-01 · Biópsia: Histologia confirmada");
  expect(screen.getByLabelText("Revisão rápida").textContent).toContain("TNM T3N1M0");
  expect(screen.getByLabelText("Toxicidades e alergia").textContent).toContain("Diarreia · Vômito");
  expect(screen.getByLabelText("Toxicidades e alergia").textContent).toContain("Penicilina");
  expect(screen.queryByText("APAC / SUS")).toBeNull();
  expect((screen.getByRole("checkbox", {name:"Liberar ciclo 03/08"}) as HTMLInputElement).checked).toBe(false);
 });
 it("agrupa seleção real e outros sem inferir medicamentos nem decisões QT", () => {
  const p=props(); render(<ConsultaFlash {...p} />);
  fireEvent.click(screen.getByRole("button", {name:"Selecionar todos LAB"}));
  fireEvent.change(screen.getByLabelText("Outros LAB"), {target:{value:"CEA; INR"}});
  fireEvent.click(screen.getByRole("checkbox", {name:"TC tórax"}));
  fireEvent.click(screen.getByRole("button",{name:"SALVAR RASCUNHO"}));
  expect(p.aoSalvarRascunho).toHaveBeenCalledWith(expect.objectContaining({solicitacoes:{laboratorio:["HMG","U","Cr","TGO","TGP","CEA","INR"],imagem:["TC tórax"]},decisaoQt:{solicitarCiclo:false,data:null},acoesMarcadas:[],receitasMarcadas:[]}));
 });
 it("reabre seleções explícitas, outros e retorno nulo do rascunho sem usar o padrão", () => {
  const p=props(); p.planoInicial={acoesMarcadas:[],receitasMarcadas:[],apac:{...p.apac,emitir:false},retorno:{dias:null,examesAntesDoRetorno:[]},solicitacoes:{laboratorio:["HMG","INR"],imagem:["RM encéfalo"]},decisaoQt:{solicitarCiclo:true,data:"2026-10-11"}};
  render(<ConsultaFlash {...p} />);
  expect((screen.getByLabelText("Prazo do retorno em dias") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("Outros LAB") as HTMLInputElement).value).toBe("INR");
  expect((screen.getByRole("checkbox",{name:"Liberar ciclo 03/08"}) as HTMLInputElement).checked).toBe(true);
 });
});
