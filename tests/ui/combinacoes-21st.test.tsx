// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OncoassistLocal } from "../../src/ui/OncoassistLocal.js";
import { criarPortaFalsa, ID } from "../../src/ui/api/fake.js";
import { COMBINACOES_21ST } from "../../src/ui/oncochart/combinacoes21st.js";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("Aparência, agrupamento de seções e revisão clínica", () => {
  it("alterna entre as 4 aparências pelo menu e pelo diálogo e agrupa seções", async () => {
    const porta = criarPortaFalsa();
    porta.login = async () => ({ ok: true, expiraEm: null });
    const fabrica = vi.fn(() => porta);

    const { container } = render(<OncoassistLocal fabricaPorta={fabrica} />);
    const main = container.querySelector("main.oncoassist-local")!;
    expect(main.getAttribute("data-combo-21st")).toBe("violet-halo");

    // 1. Trocar aparência pelo menu rápido
    fireEvent.click(screen.getByRole("button", { name: /^Aparência ·/ }));
    expect(screen.getByRole("region", { name: "Aparência e seções da consulta" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Verde-azulado alto contraste/i }));
    expect(main.getAttribute("data-combo-21st")).toBe("accessible-teal");

    // 2. Autenticar e abrir paciente para testar acordeões e foco em 1 clique
    fireEvent.change(screen.getByLabelText("Senha do servidor"), { target: { value: "senha-sintetica-local" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    fireEvent.change(await screen.findByLabelText("Paciente da agenda"), { target: { value: "en-verde" } });
    await screen.findByRole("region", { name: "Identificação da consulta" });

    // Todas as 5 seções começam abertas por padrão
    const secaoDocs = document.getElementById("consulta-documentos")!;
    const secaoFase2 = document.getElementById("consulta-fase2")!;
    expect(secaoDocs.style.display).not.toBe("none");
    expect(secaoFase2.style.display).not.toBe("none");

    // 3. Clicar em "Focar grupo" na seção 02 (Captura & Entrada única) recolhe as outras em 1 clique
    const botoesFocar = screen.getAllByRole("button", { name: "Focar grupo" });
    expect(botoesFocar.length).toBe(5);
    fireEvent.click(botoesFocar[1]!); // grupo 02 = consulta-documentos
    expect(secaoDocs.style.display).not.toBe("none");
    expect(secaoFase2.style.display).toBe("none");

    // 4. Clicar na âncora "Ficha e packs" reabre automaticamente a seção recolhida
    fireEvent.click(screen.getByRole("link", { name: "Ficha e packs" }));
    expect(secaoFase2.style.display).not.toBe("none");

    // 5. Botão "Expandir tudo" reabre todos os grupos em 1 clique
    const btnExpandirTudo = screen.getByRole("button", { name: /Expandir tudo/i });
    fireEvent.click(btnExpandirTudo);
    expect(document.getElementById("consulta-revisao")!.style.display).not.toBe("none");
    expect(document.getElementById("consulta-medicamentos")!.style.display).not.toBe("none");
    expect(document.getElementById("consulta-sintese")!.style.display).not.toBe("none");

    // 6. Abrir o diálogo de aparência, aplicar "Âmbar operacional" e fechar com Esc
    const abrir = screen.getByRole("button", { name: "Aparência e seções" });
    abrir.focus();
    fireEvent.click(abrir);
    const dialog = screen.getByRole("dialog", { name: "Aparência da tela e organização das seções" });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(COMBINACOES_21ST).toHaveLength(4);
    const card = within(dialog).getByRole("button", { name: /Âmbar operacional/ });
    expect(card.tabIndex).toBe(0);
    card.focus();
    fireEvent.click(card);
    expect(main.getAttribute("data-combo-21st")).toBe("amber-glow");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Aparência da tela e organização das seções" })).toBeNull();
    expect(document.activeElement).toBe(abrir);

    // O alvo recolhido só recebe rolagem/foco depois da expansão e do fechamento do diálogo.
    fireEvent.click(screen.getByRole("button", { name: "Recolher painéis" }));
    expect(secaoDocs.style.display).toBe("none");
    const scroll = vi.fn();
    secaoDocs.scrollIntoView = scroll;
    fireEvent.click(abrir);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Captura/ }));
    expect(secaoDocs.style.display).not.toBe("none");
    expect(scroll).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(secaoDocs);

    // Nenhum jargão de design na superfície clínica.
    expect(document.body.textContent).not.toMatch(/21st|Bento|1 clique|Estúdio/);
  });

  it("impressão expande os corpos clínicos apesar do estilo inline de recolhimento", () => {
    const css = readFileSync(resolve(process.cwd(), "src/ui/consulta/consulta-local.css"), "utf8");
    expect(css).toMatch(/@media print\s*\{[\s\S]*?\.oncoassist-local \.oc21-acordeon-body\s*\{\s*display:\s*block\s*!important;\s*\}/);
  });

  it("RT-ADV-03: filtra a ficha pelo estado real e o diálogo de fontes tem Esc, Tab preso e foco restaurado", async () => {
    const porta = criarPortaFalsa();
    porta.login = async () => ({ ok: true, expiraEm: null });
    porta.revisaoClinica = async (ctx) => ({
      codigo: "REVISAO_CLINICA_CARREGADA",
      contexto: ctx,
      revisao: "r-bento",
      ficha: [
        {
          id: "ecog",
          rotulo: "ECOG",
          valor: 1,
          estado: "DOCUMENTADO",
          motivo: "ECOG confirmado pelo médico",
          data: "2026-10-20",
          fontes: [{
            sourceId: "f-ecog",
            classe: "MANUAL",
            localizador: "linha 1",
            dataClinica: "2026-10-20",
            dataCaptura: "2026-10-20T12:00:00Z",
            versao: "v1",
            contentHash: "a".repeat(64),
          }],
          fatos: [],
        },
        {
          id: "lesao-alvo",
          rotulo: "Lesão alvo",
          valor: "Lesão 24mm",
          estado: "CONFLITANTE",
          motivo: "Laudos divergentes",
          data: "2026-10-20",
          fontes: [],
          fatos: [],
        },
        {
          id: "bsa",
          rotulo: "Superfície corporal",
          valor: "1.72",
          estado: "CALCULADO",
          motivo: "Calculado a partir de peso e altura",
          data: "2026-10-20",
          fontes: [],
          fatos: [],
        },
        {
          id: "peso",
          rotulo: "Peso",
          valor: null,
          estado: "DOCUMENTADO",
          motivo: "Sem valor registrado",
          data: null,
          fontes: [],
          fatos: [],
        },
        {
          id: "kps",
          rotulo: "KPS",
          valor: null,
          estado: "PENDENTE",
          motivo: "KPS ainda não documentado",
          data: null,
          fontes: [],
          fatos: [],
        },
      ],
      preQt: { estado: "PENDENTE", autorizaTratamento: false, pendencias: ["Conferir neutrófilos"] },
      packs: [],
      pack: null,
      pendencias: [],
      estadosDoenca: [],
      respostaTumoral: {
        criterio: "RECIST_1_1",
        aplicabilidade: "CONFERIR_CRITERIO_DO_TUMOR",
        series: [{ eventId: "serie-sintetica", episodioId: "episodio-sintetico",
          tumorLotId: null, avaliacoes: [], pendencias: [] }],
        patologica: [],
        pendencias: [],
      },
    });

    render(<OncoassistLocal fabricaPorta={() => porta} />);
    fireEvent.change(screen.getByLabelText("Senha do servidor"), { target: { value: "senha-sintetica-local" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    fireEvent.change(await screen.findByLabelText("Paciente da agenda"), { target: { value: "en-verde" } });

    await screen.findByRole("button", { name: "Todos (5)" });
    const regiaoFicha = screen.getByRole("region", { name: "Ficha e revisão clínica" });
    const secaoResposta = within(regiaoFicha).getByText("Resposta tumoral e patológica")
      .closest("details")!;
    expect(secaoResposta.open).toBe(true);
    fireEvent.click(within(regiaoFicha).getByRole("button", { name: "Recolher subseções" }));
    expect(secaoResposta.open).toBe(false);
    expect(within(regiaoFicha).getByRole("button", { name: "Expandir subseções" })).toBeTruthy();
    fireEvent.click(within(regiaoFicha).getByRole("button", { name: "Expandir subseções" }));
    expect(secaoResposta.open).toBe(true);
    const contagens = { Documentados: 1, Calculados: 1, Conflitantes: 1, Pendentes: 2 };
    for (const [rotulo, n] of Object.entries(contagens))
      expect(within(regiaoFicha).getByRole("button", { name: `${rotulo} (${n})` })).toBeTruthy();

    // CONFLITANTE e CALCULADO com valor nunca aparecem como documentados; DOCUMENTADO sem valor é pendência.
    fireEvent.click(within(regiaoFicha).getByRole("button", { name: "Documentados (1)" }));
    expect(within(regiaoFicha).getByText("ECOG")).toBeTruthy();
    for (const fora of ["Lesão alvo", "Superfície corporal", "Peso", "KPS"])
      expect(within(regiaoFicha).queryByText(fora)).toBeNull();

    fireEvent.click(within(regiaoFicha).getByRole("button", { name: "Pendentes (2)" }));
    expect(within(regiaoFicha).getByText("KPS")).toBeTruthy();
    expect(within(regiaoFicha).getByText("Peso")).toBeTruthy();
    expect(within(regiaoFicha).queryByText("ECOG")).toBeNull();

    fireEvent.click(within(regiaoFicha).getByRole("button", { name: "Conflitantes (1)" }));
    expect(within(regiaoFicha).getByText("Lesão alvo")).toBeTruthy();
    expect(within(regiaoFicha).queryByText("Superfície corporal")).toBeNull();

    const abrir = within(regiaoFicha).getByRole("button", { name: "Conferir fontes" });
    abrir.focus();
    fireEvent.click(abrir);
    const dialogo = screen.getByRole("dialog", { name: "Fontes consolidadas da ficha clínica" });
    expect(screen.getByText("ECOG confirmado pelo médico")).toBeTruthy();
    const fechar = within(dialogo).getByRole("button", { name: "Fechar" });
    expect(document.activeElement).toBe(fechar);
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(dialogo.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Fontes consolidadas da ficha clínica" })).toBeNull();
    expect(document.activeElement).toBe(abrir);
  });
});
