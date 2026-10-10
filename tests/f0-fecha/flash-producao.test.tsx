// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { NUMERO_CAIXA_MODELO_FLASH, CHAVE_CAIXA_MODELO_FLASH } from "../../src/config/flash.js";
import { CaixaNumerada } from "../../src/contracts/w10/clinico-w10.js";
import { lerModeloFlash } from "../../src/server/flash.js";
import { validarCatalogoApac } from "../../src/server/leituras.js";
import { criarPortaHttp } from "../../src/ui/api/http.js";
import { Configuracoes } from "../../src/ui/oncochart/Configuracoes.js";
import { ConsultaFlash, type ConsultaFlashProps } from "../../src/ui/consulta/ConsultaFlash.js";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("F0 · Consulta Flash em produção", () => {
  it("a caixa do modelo padrão existe no catálogo com o tipo REGRA_CLINICA suportado", () => {
    const rawCatalogo = JSON.parse(readFileSync("corpus/glossario/caixas.v1.json", "utf8")) as { caixas: unknown[] };
    const catalogo = { caixas: rawCatalogo.caixas.map((caixa) => CaixaNumerada.parse(caixa)) };
    const caixa = catalogo.caixas.find((item) => item.chave === CHAVE_CAIXA_MODELO_FLASH);
    expect(caixa).toMatchObject({ numero: NUMERO_CAIXA_MODELO_FLASH, tipo: "REGRA_CLINICA", editavelPor: "MEDICO" });
    expect(catalogo.caixas.some((item) => item.numero === NUMERO_CAIXA_MODELO_FLASH && item.chave !== CHAVE_CAIXA_MODELO_FLASH)).toBe(false);
    expect(lerModeloFlash({ laboratorio: true, imagem: false })).toEqual({ laboratorio: true, imagem: false });
    expect(lerModeloFlash({ laboratorio: true, imagem: false, extra: true })).toBeNull();
    const catalogoApac = validarCatalogoApac(catalogo.caixas);
    expect(catalogoApac.estado).toBe("DISPONIVEL");
    if (catalogoApac.estado === "DISPONIVEL") {
      expect(catalogoApac.caixas).toHaveLength(catalogo.caixas.filter((item) => item.chave.startsWith("apac.")).length);
      expect(catalogoApac.caixas.some((item) => item.chave === CHAVE_CAIXA_MODELO_FLASH)).toBe(false);
    }
    expect(validarCatalogoApac(catalogo.caixas.filter((item) => item.chave !== "apac.pacienteNome")))
      .toEqual({ estado: "PENDENTE" });
  });

  it("Configurações lê e grava o modelo pela porta autenticada, sem persistência em estado local", async () => {
    const lerCaixaConfiguracao = vi.fn().mockResolvedValue({ revision: 4, value: { laboratorio: false, imagem: true } });
    const alterarCaixaConfiguracao = vi.fn().mockResolvedValue({ estado: "GRAVADA", revision: 5 });
    render(<Configuracoes tema="dia" onTema={() => {}} onFechar={() => {}}
      porta={{ lerCaixaConfiguracao, alterarCaixaConfiguracao }} />);

    const laboratorio = await screen.findByRole("checkbox", { name: "Modelo HMG" });
    const imagem = screen.getByRole("checkbox", { name: "Modelo TC tórax" });
    expect((laboratorio as HTMLInputElement).checked).toBe(false);
    expect((imagem as HTMLInputElement).checked).toBe(false);
    fireEvent.click(laboratorio);
    fireEvent.click(screen.getByRole("button", { name: "Salvar modelo Flash" }));
    await waitFor(() => expect(alterarCaixaConfiguracao).toHaveBeenCalledWith(expect.objectContaining({
      numero: NUMERO_CAIXA_MODELO_FLASH, valorNovo: { laboratorio: true, imagem: false, solicitacoes: {laboratorio:["HMG"],imagem:[]} }, expectedRevision: 4,
    })));
    expect(screen.getByLabelText("status configuração Flash").textContent).toContain("gravado no servidor");
  });

  it("a porta HTTP carrega e altera a caixa usando Bearer após login", async () => {
    const chamadas: { caminho: string; init?: RequestInit }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const caminho = String(input);
      chamadas.push({ caminho, ...(init ? { init } : {}) });
      const json = caminho === "/login" ? { token: "token-sintetico", expiraEm: "2026-10-09T12:00:00Z" }
        : caminho.endsWith("/ler") ? { revision: 4, value: null, codigo: "CAIXA_CARREGADA" }
          : { codigo: "GRAVADA", estado: "GRAVADA", revision: 5 };
      return { status: 200, json: async () => json } as Response;
    }));
    const porta = criarPortaHttp({ onSessaoExpirada: () => {} });
    await porta.login("senha-sintetica");
    await porta.lerCaixaConfiguracao!(NUMERO_CAIXA_MODELO_FLASH);
    await porta.alterarCaixaConfiguracao!({ numero: NUMERO_CAIXA_MODELO_FLASH,
      valorNovo: { laboratorio: true, imagem: false }, expectedRevision: 4, operationId: "flash-modelo-test-1" });
    expect(chamadas.map((call) => call.caminho)).toEqual(["/login", "/config/caixa/ler", "/config/caixa/alterar"]);
    expect((chamadas[1]?.init?.headers as Record<string, string>).Authorization).toBe("Bearer token-sintetico");
    expect((chamadas[2]?.init?.headers as Record<string, string>).Authorization).toBe("Bearer token-sintetico");
  });

  it("o prazo editado entra no plano; limpar o campo mantém retorno PENDENTE", () => {
    const aoSalvarRascunho = vi.fn();
    const props: ConsultaFlashProps = {
      cabecalho: {}, exames: [], acoesHoje: [], receitas: [],
      apac: { cid: "", sigtap: "", finalidade: "", competencia: "", estado: "PENDENTE", pendencias: [] },
      iaFala: [], retorno: { dias: null, examesAntesDoRetorno: [] },
      aoSalvarRascunho, aoFinalizar: () => {},
    };
    render(<ConsultaFlash {...props} />);
    const prazo = screen.getByRole("spinbutton", { name: "Prazo do retorno em dias" });
    fireEvent.change(prazo, { target: { value: "21" } });
    fireEvent.click(screen.getByRole("button", { name: "SALVAR RASCUNHO" }));
    expect(aoSalvarRascunho.mock.calls[0]?.[0].retorno.dias).toBe(21);

    fireEvent.change(prazo, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "SALVAR RASCUNHO" }));
    expect(aoSalvarRascunho.mock.calls[1]?.[0].retorno.dias).toBeNull();
  });
});

