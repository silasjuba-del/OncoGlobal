// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CartaoTransversal } from "../../src/ui/consulta/CartaoTransversal.js";
import { CAMPOS_EXTENSAO, CAMPOS_NUCLEO } from "../../src/ui/consulta/formatoTransversal.js";

afterEach(cleanup);

const NI = { estado: "NAO_INFORMADO", valor: null, origem: null };
const laudo = { tipo: "LAUDO", documentoId: "doc-lau-1", dataDocumento: "2026-05-01", trecho: null };
const enc = { tipo: "ENCAMINHADOR", documentoId: "doc-enc-2", dataDocumento: null, trecho: null };
const V = (valor: unknown, origem: unknown = laudo, extra: object = {}) => ({ estado: "VALOR", valor, origem, ...extra });

const nucleoVazio = () => Object.fromEntries(CAMPOS_NUCLEO.map((s) => [s.chave, NI]));
const nucleoCheio = () => ({
  histologia: V("adenocarcinoma sintético"), lateralidade: V("ESQUERDA"), topografia: V("sítio sintético"), grauHistologico: V("G2"), cTNM: V("cT2N0M0"), pTNM: V("pT2N1a"),
  ypTNM: V("ypT1N0"), estadio: V("IIB"), tamanhoMm: V(22), profundidade: V("submucosa"),
  linfonodos: V({ positivos: 2, avaliados: 14 }), metastase: V({ presente: true, sitios: ["fígado"] }),
  invasaoAngiolinfatica: V(true), invasaoPerineural: V(false), margem: V("LIVRE"), necrose: V(false),
  indiceMitotico: V("5/10 CGA"), ki67Pct: V(30), neoadjuvancia: V("esquema sintético"),
  respostaNeoadjuvancia: V({ sistema: "TRG_MANDARD", resultado: "TRG 2" }), progressaoNaVigencia: V(false),
});
const vazioExt = (tumor: string) => ({ tumor, ...Object.fromEntries(CAMPOS_EXTENSAO[tumor]!.map((s) => [s.chave, NI])) });
const cheioExt: Record<string, object> = {
  MAMA: { tumor: "MAMA", rePct: V(90), rpPct: V(40), her2: V("2+_ISH_NEG"), rcb: V("RCB-II") },
  PROSTATA: { tumor: "PROSTATA", gleason: V({ primario: 3, secundario: 4 }), isup: V(2), psaNgMl: V(8.5), fragmentosPositivos: V({ positivos: 4, total: 12 }) },
  COLON: { tumor: "COLON", mmr: V("DEFICIENTE"), msi: V("MSI_H"), kras: V("selvagem"), nras: V("selvagem"), braf: V("V600E"), trg: V("TRG 1"), budding: V("baixo") },
  PULMAO: { tumor: "PULMAO", egfr: V("exon 19 del"), alk: V("negativo"), ros1: V("negativo"), pdl1TpsPct: V(60), krasG12c: V(false) },
  COLO_UTERINO: { tumor: "COLO_UTERINO", figo: V("IB2"), hpvP16: V("p16 positivo"), invasaoEstromalMm: V(7) },
  GASTRICO: { tumor: "GASTRICO", her2: V("3+"), mmr: V("PROFICIENTE"), lauren: V("DIFUSO"), cldn18: V("2+ em 80%"), pdl1Cps: V(5) },
};
const TUMORES = Object.keys(cheioExt);
const retrato = (nucleo: object, extensao: object, ref = "Paciente Teste 01") => ({ pacienteRef: ref, tumorIndice: true, nucleo, extensao });
const linhas = (c: HTMLElement) => c.querySelectorAll("tr[data-campo]");

describe("CartaoTransversal · 6 tumores", () => {
  for (const t of TUMORES) {
    it(`${t}: caso completo mostra valores, origem do laudo e todos os campos`, () => {
      const { container } = render(<CartaoTransversal entrada={retrato(nucleoCheio(), cheioExt[t] as object)} />);
      const esperado = 5 + CAMPOS_NUCLEO.length + CAMPOS_EXTENSAO[t]!.length;
      expect(linhas(container).length).toBe(esperado);
      expect(screen.queryByText("não informado")).toBeNull();
      expect(container.querySelectorAll('[data-origem="LAUDO"]').length).toBeGreaterThan(20);
      expect(screen.getAllByText("laudo (doc-lau-1 · 01/05/2026)").length).toBeGreaterThan(0);
      expect(screen.getAllByText("presente: fígado").length).toBeGreaterThan(0);
      expect(screen.getAllByText("IIB").length).toBeGreaterThan(0);
      expect(screen.getAllByText("2 positivos de 14 avaliados").length).toBeGreaterThan(0);
    });
    it(`${t}: caso com lacunas mantém todos os campos e mostra "não informado"`, () => {
      const { container } = render(<CartaoTransversal entrada={retrato(nucleoVazio(), vazioExt(t))} />);
      const esperado = 5 + CAMPOS_NUCLEO.length + CAMPOS_EXTENSAO[t]!.length;
      expect(linhas(container).length).toBe(esperado);
      expect(container.querySelectorAll('[data-vazio="nao-informado"]').length).toBe(esperado);
      expect(container.querySelector("[data-origem]")).toBeNull();
    });
  }

  it("valores específicos de próstata e cólon formatados", () => {
    render(<CartaoTransversal entrada={retrato(nucleoCheio(), cheioExt.PROSTATA as object)} />);
    expect(screen.getByText("3+4=7")).toBeTruthy();
    expect(screen.getByText("8.5 ng/mL")).toBeTruthy();
    expect(screen.getByText("4 de 12")).toBeTruthy();
    cleanup();
    render(<CartaoTransversal entrada={retrato(nucleoCheio(), cheioExt.COLON as object)} />);
    expect(screen.getByText("MSI-H")).toBeTruthy();
    expect(screen.getByText("deficiente")).toBeTruthy();
  });

  it("origem ENCAMINHADOR: 'não confirmado', marca distinta, data desconhecida", () => {
    const nucleo = { ...nucleoVazio(), cTNM: V("cT3N1M0", enc), histologia: V("CEC sintético", laudo) };
    const { container } = render(<CartaoTransversal entrada={retrato(nucleo, vazioExt("PULMAO"))} />);
    const linha = container.querySelector('tr[data-campo="nucleo.cTNM"]') as HTMLElement;
    expect(within(linha).getByText(/afirmado pelo encaminhador \(não confirmado\)/)).toBeTruthy();
    expect(within(linha).getByText(/data desconhecida/)).toBeTruthy();
    expect(linha.querySelector('[data-origem="ENCAMINHADOR"]')).toBeTruthy();
    expect(linha.querySelector('[data-origem="LAUDO"]')).toBeNull();
    const l = container.querySelector('tr[data-campo="nucleo.histologia"]') as HTMLElement;
    const estiloEnc = (linha.querySelector("[data-origem]") as HTMLElement).style.borderLeft;
    const estiloLau = (l.querySelector("[data-origem]") as HTMLElement).style.borderLeft;
    expect(estiloEnc).not.toBe(estiloLau);
  });

  it("confiança BAIXA mostra marca manuscrito/baixa confiança", () => {
    const nucleo = { ...nucleoVazio(), ki67Pct: V(25, laudo, { confianca: "BAIXA" }) };
    const { container } = render(<CartaoTransversal entrada={retrato(nucleo, vazioExt("MAMA"))} />);
    const linha = container.querySelector('tr[data-campo="nucleo.ki67Pct"]') as HTMLElement;
    expect(within(linha).getByText("manuscrito/baixa confiança")).toBeTruthy();
    expect(within(linha).getByText("25 %")).toBeTruthy();
    expect(container.querySelectorAll('[data-marca="baixa-confianca"]').length).toBe(1);
  });

  it("NAO_SE_APLICA mostra 'não se aplica'", () => {
    const ext = { ...vazioExt("MAMA"), rcb: { estado: "NAO_SE_APLICA", valor: null, origem: null } };
    render(<CartaoTransversal entrada={retrato(nucleoVazio(), ext)} />);
    expect(screen.getByText("não se aplica")).toBeTruthy();
  });

  it("CONFLITO mostra os dois candidatos com origens e não elege nenhum", () => {
    const conflito = { estado: "CONFLITO", valor: null, origem: null, candidatos: [
      { valor: "cT2N1M0", origem: enc }, { valor: "cT2N0M0", origem: laudo }] };
    const { container } = render(<CartaoTransversal entrada={retrato({ ...nucleoVazio(), cTNM: conflito }, vazioExt("GASTRICO"))} />);
    const linha = container.querySelector('tr[data-campo="nucleo.cTNM"]') as HTMLElement;
    expect(within(linha).getByText(/CONFLITO/)).toBeTruthy();
    expect(within(linha).getByText("cT2N1M0")).toBeTruthy();
    expect(within(linha).getByText("cT2N0M0")).toBeTruthy();
    expect(linha.querySelectorAll("[data-candidato]").length).toBe(2);
    expect(linha.querySelector('[data-origem="ENCAMINHADOR"]')).toBeTruthy();
    expect(linha.querySelector('[data-origem="LAUDO"]')).toBeTruthy();
    expect(linha.getAttribute("data-estado")).toBe("CONFLITO");
  });

  it("destaque no topo traz metástase e estádio/TNM antes da grade", () => {
    const { container } = render(<CartaoTransversal entrada={retrato(nucleoCheio(), cheioExt.MAMA as object)} />);
    const topo = container.querySelector('[data-destaque="topo"]') as HTMLElement;
    expect(topo).toBeTruthy();
    for (const k of ["metastase", "estadio", "cTNM", "pTNM", "ypTNM"]) {
      expect(topo.querySelector(`tr[data-campo="destaque.${k}"]`)).toBeTruthy();
    }
    const grade = container.querySelector('table[aria-label="Campos anatomopatológicos"]') as HTMLElement;
    expect(topo.compareDocumentPosition(grade) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("entrada inválida: aviso de erro, nenhum valor parcial", () => {
    const ruim = retrato({ ...nucleoCheio(), ki67Pct: V(250), histologia: V("texto que não pode vazar") }, cheioExt.MAMA as object);
    const { container } = render(<CartaoTransversal entrada={ruim} />);
    expect(screen.getByRole("alert").textContent).toMatch(/Erro de dados/);
    expect(linhas(container).length).toBe(0);
    expect(container.textContent).not.toMatch(/texto que não pode vazar/);
    cleanup();
    const { container: c2 } = render(<CartaoTransversal entrada={null} />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(linhas(c2).length).toBe(0);
  });

  it("nenhuma string proibida nem cor amarela", () => {
    for (const t of TUMORES) {
      const { container } = render(<CartaoTransversal entrada={retrato(nucleoCheio(), cheioExt[t] as object)} />);
      expect(container.textContent).not.toMatch(/liberad|aprovad|\bapto|\bapta/i);
      expect(container.innerHTML).not.toMatch(/yellow|amarel|#ff0|#fc0|amber/i);
      cleanup();
    }
    const { container } = render(<CartaoTransversal entrada={{ x: 1 }} />);
    expect(container.textContent).not.toMatch(/liberad|aprovad|\bapto|\bapta/i);
  });

  it("acessível: tabelas com legenda e cabeçalhos de linha", () => {
    const { container } = render(<CartaoTransversal entrada={retrato(nucleoCheio(), cheioExt.PULMAO as object)} />);
    expect(container.querySelectorAll("table caption").length).toBe(3);
    expect(container.querySelectorAll('th[scope="row"]').length).toBe(5 + CAMPOS_NUCLEO.length + CAMPOS_EXTENSAO.PULMAO!.length);
  });
});
