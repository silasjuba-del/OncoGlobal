import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type Rgb = readonly [number, number, number];

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function hexParaRgb(hex: string): Rgb {
  const limpo = hex.replace("#", "").trim();
  const full =
    limpo.length === 3
      ? limpo
          .split("")
          .map((c) => c + c)
          .join("")
      : limpo;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  return [r, g, b];
}

// Conversão padrão CSS Color 4: OKLCH -> OKLab -> LMS -> sRGB linear -> sRGB
function oklchParaRgb(spec: string): Rgb {
  const m = /oklch\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)/.exec(spec);
  if (!m) throw new Error(`OKLCH inválido: ${spec}`);
  const L = Number(m[1]);
  const C = Number(m[2]);
  const hRad = (Number(m[3]) * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const mCube = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const rLin = +4.0767416621 * l - 3.3077115913 * mCube + 0.2309699292 * s;
  const gLin = -1.2684380046 * l + 2.6097574011 * mCube - 0.3413193965 * s;
  const bLin = -0.0041960863 * l - 0.7034186147 * mCube + 1.707614701 * s;

  const paraSrgb = (c: number) => {
    const cl = clamp01(c);
    return cl <= 0.0031308 ? 12.92 * cl : 1.055 * Math.pow(cl, 1 / 2.4) - 0.055;
  };
  return [paraSrgb(rLin), paraSrgb(gLin), paraSrgb(bLin)];
}

function corParaRgb(valor: string): Rgb {
  const v = valor.trim();
  if (v.startsWith("#")) return hexParaRgb(v);
  if (v.startsWith("oklch(")) return oklchParaRgb(v);
  throw new Error(`Formato de cor não suportado: ${v}`);
}

function luminanciaRelativa([r, g, b]: Rgb): number {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function razaoContraste(corA: string, corB: string): number {
  const l1 = luminanciaRelativa(corParaRgb(corA));
  const l2 = luminanciaRelativa(corParaRgb(corB));
  const maior = Math.max(l1, l2);
  const menor = Math.min(l1, l2);
  return Number(((maior + 0.05) / (menor + 0.05)).toFixed(2));
}

function extrairVarsBloco(css: string, seletorRegex: RegExp): Record<string, string> {
  const match = seletorRegex.exec(css);
  if (!match || !match[1]) throw new Error(`Bloco não encontrado: ${seletorRegex}`);
  const vars: Record<string, string> = {};
  for (const m of match[1].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    vars[m[1]!] = m[2]!.trim();
  }
  return vars;
}

describe("U-H3 · razão de contraste WCAG 2.2 AA (≥ 4,5:1 texto) em tema/tokens.css, tema/base.css e oncochart/tokens.css", () => {
  it("tema/tokens.css (gelo e contraste) atinge ≥ 4,5:1 em todos os pares texto/fundo", () => {
    const css = readFileSync(join(process.cwd(), "src/ui/tema/tokens.css"), "utf8");
    const gelo = extrairVarsBloco(css, /\[data-tema="gelo"\]\s*\{([\s\S]*?)\}/);
    const contraste = extrairVarsBloco(css, /\[data-tema="contraste"\]\s*\{([\s\S]*?)\}/);

    const fundos = ["--cor-fundo", "--cor-superficie"] as const;
    const textos = [
      "--cor-texto",
      "--cor-texto-suave",
      "--cor-destaque",
      "--cor-verde",
      "--cor-vermelho",
      "--cor-pendente",
    ] as const;

    const abaixoAA: string[] = [];
    for (const [nomeTema, mapa] of [
      ["gelo", gelo],
      ["contraste", contraste],
    ] as const) {
      for (const f of fundos) {
        for (const t of textos) {
          const r = razaoContraste(mapa[t]!, mapa[f]!);
          if (r < 4.5) abaixoAA.push(`tema/tokens.css [${nomeTema}] ${t} (${mapa[t]}) sobre ${f} (${mapa[f]}) = ${r}:1`);
        }
      }
    }
    expect(abaixoAA).toEqual([]);
  });

  it("tema/base.css (:root) atinge ≥ 4,5:1 em todos os pares texto/fundo clínicos", () => {
    const css = readFileSync(join(process.cwd(), "src/ui/tema/base.css"), "utf8");
    const root = extrairVarsBloco(css, /:root\s*\{([\s\S]*?)\}/);

    const fundos = ["--cl-superficie", "--cl-suave"] as const;
    const textos = ["--cl-tinta", "--cl-apagado", "--cl-acao", "--cl-aviso", "--cl-critico"] as const;

    const abaixoAA: string[] = [];
    for (const f of fundos) {
      for (const t of textos) {
        const r = razaoContraste(root[t]!, root[f]!);
        if (r < 4.5) abaixoAA.push(`tema/base.css [:root] ${t} (${root[t]}) sobre ${f} (${root[f]}) = ${r}:1`);
      }
    }
    expect(abaixoAA).toEqual([]);
  });

  it("oncochart/tokens.css (noite e dia) atinge ≥ 4,5:1 para todos os tokens de texto sobre fundos/superfícies do tema", () => {
    const css = readFileSync(join(process.cwd(), "src/ui/oncochart/tokens.css"), "utf8");
    const noite = extrairVarsBloco(css, /\[data-tema-onco="noite"\]\s*\{([\s\S]*?)\}/);
    const dia = extrairVarsBloco(css, /\[data-tema-onco="dia"\]\s*\{([\s\S]*?)\}/);

    const fundos = ["--bg", "--bg-2", "--surface", "--surface-2", "--surface-3"] as const;
    const textos = ["--text", "--muted", "--faint", "--accent", "--amber", "--ok", "--danger", "--info"] as const;

    const abaixoAA: string[] = [];
    for (const [nomeTema, mapa] of [
      ["noite", noite],
      ["dia", dia],
    ] as const) {
      for (const f of fundos) {
        for (const t of textos) {
          const r = razaoContraste(mapa[t]!, mapa[f]!);
          if (r < 4.5) {
            abaixoAA.push(`oncochart/tokens.css [${nomeTema}] ${t} (${mapa[t]}) sobre ${f} (${mapa[f]}) = ${r}:1`);
          }
        }
      }
      const rAccentInk = razaoContraste(mapa["--accent-ink"]!, mapa["--accent"]!);
      if (rAccentInk < 4.5) {
        abaixoAA.push(
          `oncochart/tokens.css [${nomeTema}] --accent-ink (${mapa["--accent-ink"]}) sobre --accent (${mapa["--accent"]}) = ${rAccentInk}:1`,
        );
      }
    }
    expect(abaixoAA).toEqual([]);
  });
});
