// @vitest-environment jsdom
// W12-F4 · UI: os botões da Flash chamam a porta; erro mantém o overlay aberto e as marcações.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TelaConsulta } from "../../src/ui/telas/TelaConsulta.js";
import { criarChaves } from "../../src/ui/api/chaves.js";
import { criarPortaFalsa, ID } from "../../src/ui/api/fake.js";
import { ErroPorta, type PortaConsulta, type ResultadoRascunhoFlash } from "../../src/ui/api/porta.js";
import { createHash } from "node:crypto";

afterEach(cleanup);
// F0-COMPLEMENTO: prévia real antecede a decisão de assinatura. O fake base não contém o documento Flash.
function portaComDocumento(): PortaConsulta {
  const base = criarPortaFalsa();
  base.exibirBundle = async p => {
    const conteudo = {texto:"Conteúdo sintético exibido para revisão médica.",
      contexto:{patientId:p.patientId,encounterId:p.encounterId,tumorLotId:p.tumorLotId}};
    return {patientId:p.patientId,encounterId:p.encounterId,
      documentos:[{documentId:"flash-doc-sintetico",draftId:"flash-doc-sintetico",documentVersion:1,
        titulo:"Evolução da Consulta Flash",visivel:true,preMarcado:false,conteudo,
        conteudoHash:createHash("sha256").update(JSON.stringify(conteudo)).digest("hex")}]};
  };
  return base;
}

async function abrirFlash(porta: PortaConsulta) {
  render(<TelaConsulta patientId={ID.multi} porta={porta} chaves={criarChaves()} />);
  fireEvent.click(await screen.findByRole("button", { name: "Consulta Flash" }));
  await screen.findByLabelText("Solicitações laboratoriais");
}

describe("W12-F4 UI", () => {
  it("reabre no mesmo mount o plano recém-salvo e não o sobrescreve com campos antigos", async () => {
    const base = portaComDocumento();
    const salvar = vi.fn(base.salvarRascunhoFlash!); base.salvarRascunhoFlash=salvar;
    await abrirFlash(base);
    fireEvent.change(screen.getByLabelText("Outros LAB"),{target:{value:"INR"}});
    fireEvent.click(screen.getByRole("checkbox",{name:"HMG"}));
    fireEvent.click(screen.getByRole("button",{name:"SALVAR RASCUNHO"}));
    await waitFor(()=>expect(screen.queryByRole("dialog",{name:"Consulta Flash"})).toBeNull());
    fireEvent.click(screen.getByRole("button",{name:"Consulta Flash"}));
    expect((await screen.findByLabelText("Outros LAB") as HTMLInputElement).value).toBe("INR");
    expect((screen.getByRole("checkbox",{name:"HMG"}) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("button",{name:"SALVAR RASCUNHO"}));
    await waitFor(()=>expect(salvar).toHaveBeenCalledTimes(2));
    expect(salvar.mock.calls[1]![0].plano.solicitacoes?.laboratorio).toEqual(["HMG","INR"]);
    expect(salvar.mock.calls[1]![0].expectedRevision).toBe(0);
  });

  it("resposta atrasada de salvar A não fecha nem altera revisão ou conteúdo de B", async () => {
    const base=portaComDocumento(); const chaves=criarChaves();
    let resolver!: (r:ResultadoRascunhoFlash)=>void;
    const pendente=new Promise<ResultadoRascunhoFlash>(r=>{resolver=r;});
    const salvar=vi.fn(base.salvarRascunhoFlash!).mockImplementationOnce(()=>pendente);
    base.salvarRascunhoFlash=salvar;
    const carregar=vi.spyOn(base,"carregarConsulta");
    const tela=render(<TelaConsulta patientId={ID.multi} porta={base} chaves={chaves} />);
    fireEvent.click(await screen.findByRole("button",{name:"Consulta Flash"}));
    fireEvent.click(await screen.findByRole("button",{name:"SALVAR RASCUNHO"}));
    tela.rerender(<TelaConsulta patientId={ID.verde} porta={base} chaves={chaves} />);
    await waitFor(()=>expect(carregar).toHaveBeenCalledWith(ID.verde));
    await act(async()=>{ await Promise.resolve(); });
    if(!screen.queryByRole("dialog",{name:"Consulta Flash"})) fireEvent.click(screen.getByRole("button",{name:"Consulta Flash"}));
    fireEvent.change(await screen.findByLabelText("Outros LAB"),{target:{value:"CEA"}});
    await act(async()=>{resolver({codigo:"RASCUNHO_SALVO",draftId:"rascunho-A",revision:77});await pendente;});
    expect(screen.getByRole("dialog",{name:"Consulta Flash"})).toBeTruthy();
    expect((screen.getByLabelText("Outros LAB") as HTMLInputElement).value).toBe("CEA");
    fireEvent.click(screen.getByRole("button",{name:"SALVAR RASCUNHO"}));
    await waitFor(()=>expect(salvar).toHaveBeenCalledTimes(2));
    expect(salvar.mock.calls[1]![0].patientId).toBe(ID.verde);
    expect(salvar.mock.calls[1]![0].expectedRevision).toBeNull();
    expect(salvar.mock.calls[1]![0].plano.solicitacoes?.laboratorio).toEqual(["CEA"]);
  });

  it("salvar rascunho chama a porta, fecha o overlay e confirma; não chama confirmar nem acao", async () => {
    const base = portaComDocumento();
    const salvar = vi.fn(base.salvarRascunhoFlash!);
    base.salvarRascunhoFlash = salvar;
    const confirmar = vi.spyOn(base, "confirmar");
    const acao = vi.spyOn(base, "acao");
    await abrirFlash(base);
    fireEvent.click(screen.getByRole("button", { name: "SALVAR RASCUNHO" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Consulta Flash" })).toBeNull());
    expect(salvar).toHaveBeenCalledTimes(1);
    const pedido = salvar.mock.calls[0]![0];
    expect(pedido.expectedRevision).toBeNull();
    expect(pedido.plano.apac.emitir).toBe(false);
    expect(screen.getByLabelText("status da Consulta Flash").textContent).toContain("Rascunho");
    expect(confirmar).not.toHaveBeenCalled();
    expect(acao).not.toHaveBeenCalled();
  });

  it("finalizar prepara, exibe o bundle e só então confirma, com os documentos exibidos", async () => {
    const base = portaComDocumento();
    const ordem: string[] = [];
    const porta: PortaConsulta = {
      ...base,
      prepararFinalizacaoFlash: async (p) => { ordem.push("preparar"); return base.prepararFinalizacaoFlash!(p); },
      exibirBundle: async (p) => { ordem.push("exibir"); return base.exibirBundle(p); },
      confirmar: async (b) => { ordem.push("confirmar"); expect(b.bloco).toBe("TUDO");
        expect(b.documentosExibidos).toEqual([{ documentId: "flash-doc-sintetico", documentVersion: 1 }]);
        return base.confirmar(b); },
    };
    await abrirFlash(porta);
    fireEvent.click(screen.getByRole("button", { name: "REVISAR · IMPRIMIR" }));
    await screen.findByText(/Conteúdo sintético exibido para revisão médica/);
    expect(ordem).toEqual(["preparar", "exibir"]);
    fireEvent.click(screen.getByRole("button", { name: "CONFIRMAR E IMPRIMIR" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Consulta Flash" })).toBeNull());
    expect(ordem).toEqual(["preparar", "exibir", "confirmar"]);
    expect(screen.getByLabelText("status da Consulta Flash").textContent).toContain("finalizada");
  });

  it("erro ao finalizar: mostra o erro, mantém o overlay aberto e preserva as marcações; nada é confirmado", async () => {
    const base = portaComDocumento();
    const confirmar = vi.fn(base.confirmar);
    const porta: PortaConsulta = {
      ...base,
      confirmar,
      prepararFinalizacaoFlash: async () => { throw new ErroPorta("FLASH_RECUSADA", "FLASH_JA_FINALIZADA"); },
    };
    await abrirFlash(porta);
    const imagem = screen.getByRole("checkbox", { name: /^TC tórax$/ }) as HTMLInputElement;
    expect(imagem.checked).toBe(false);
    fireEvent.click(imagem);
    expect(imagem.checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "REVISAR · IMPRIMIR" }));
    const alerta = await screen.findByRole("alert");
    expect(alerta.textContent).toContain("FLASH_JA_FINALIZADA");
    expect(screen.getByRole("dialog", { name: "Consulta Flash" })).toBeTruthy();
    expect((screen.getByRole("checkbox", { name: /^TC tórax$/ }) as HTMLInputElement).checked).toBe(true);
    expect(confirmar).not.toHaveBeenCalled();
    // pode tentar de novo
    expect((screen.getByRole("button", { name: "REVISAR · IMPRIMIR" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("confirmação recusada preserva documentos em revisão sem declarar assinatura", async () => {
    const base = portaComDocumento();
    const porta: PortaConsulta = { ...base, confirmar: async () => ({ codigo: "DOCUMENTO_NAO_SELECIONADO", resultRef: null }) };
    await abrirFlash(porta);
    fireEvent.click(screen.getByRole("button", { name: "REVISAR · IMPRIMIR" }));
    await screen.findByText(/Conteúdo sintético exibido para revisão médica/);
    fireEvent.click(screen.getByRole("button", { name: "CONFIRMAR E IMPRIMIR" }));
    await waitFor(() => expect(screen.getByLabelText("status da Consulta Flash").textContent).toContain("DOCUMENTO_NAO_SELECIONADO"));
    expect(screen.getByLabelText("Revisão dos documentos Flash")).toBeTruthy();
  });

  it("erro ao salvar rascunho mantém o overlay aberto", async () => {
    const base = portaComDocumento();
    const porta: PortaConsulta = {
      ...base,
      salvarRascunhoFlash: async () => { throw new ErroPorta("FLASH_RECUSADA", "REVISAO_RASCUNHO_CONFLITANTE"); },
    };
    await abrirFlash(porta);
    fireEvent.click(screen.getByRole("button", { name: "SALVAR RASCUNHO" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Não foi possível salvar o rascunho");
    expect(screen.getByRole("dialog", { name: "Consulta Flash" })).toBeTruthy();
  });

  it("porta sem as ações novas: erro visível, overlay aberto", async () => {
    const base = portaComDocumento();
    const { prepararFinalizacaoFlash: _a, salvarRascunhoFlash: _b, ...semAcoes } = base;
    await abrirFlash(semAcoes as PortaConsulta);
    fireEvent.click(screen.getByRole("button", { name: "REVISAR · IMPRIMIR" }));
    expect((await screen.findByRole("alert")).textContent).toContain("SERVIDOR_PENDENTE");
    expect(screen.getByRole("dialog", { name: "Consulta Flash" })).toBeTruthy();
  });
});

