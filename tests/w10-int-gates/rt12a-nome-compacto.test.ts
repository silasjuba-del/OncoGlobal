import { describe, expect, it } from "vitest";
import { contemPhiResidual, desidentificar } from "../../src/kernel/llm/desidentificar.js";

const DIC = { nomes: ["Maria Alves de Souza"], identificadores: [] };

describe("RT-12a · nome compacto (G-02)", () => {
  it.each([
    "https://x.local/pacientes/MariaAlvesDeSouza/laudos",
    "C:\pacientes\maria_alves_de_souza\laudo.pdf",
    "/tmp/mariaalvesdesouza.pdf",
    "https://x.local/?p=Maria%20Alves%20de%20Souza",
    "arquivo-MARIA-ALVES-DE-SOUZA.txt",
    "https://x.local/?q=" + Buffer.from("Maria Alves de Souza").toString("base64"),
  ])("barra %s", (t) => expect(contemPhiResidual(t, DIC)).toBe(true));

  it("mantém texto clínico sem nome", () => {
    expect(contemPhiResidual("Paciente com nódulo pulmonar de 12 mm, sem outras queixas.", DIC)).toBe(false);
  });

  it("troca por token e preserva o resto do caminho", () => {
    const r = desidentificar("/p/MariaAlvesDeSouza/laudos", DIC);
    expect(r.texto).not.toMatch(/Maria/i);
    expect(r.texto).toContain("/laudos");
  });
});
