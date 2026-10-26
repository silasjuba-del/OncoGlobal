// Prova em Chromium real: fora de `npm test` (os shards de CI não instalam navegador).
// Uso: npx vitest run --config tests/hostil-cursor/navegador/vitest.config.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { chromium } from "playwright";

describe("U-H9 · prefers-reduced-motion: animações e transições desligam", () => {
  it("Playwright com reducedMotion='reduce' zera transitionDuration nos componentes de consulta-local.css e oncochart/tokens.css", async () => {
    const consultaCss = readFileSync(join(process.cwd(), "src/ui/consulta/consulta-local.css"), "utf8");
    const oncoTokensCss = readFileSync(join(process.cwd(), "src/ui/oncochart/tokens.css"), "utf8");

    const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<style>
  ${consultaCss}
  ${oncoTokensCss}
</style>
</head>
<body>
  <div class="oncoassist-local">
    <button type="button" class="oc21-trigger-pill"><span class="oc21-chevron">▾</span></button>
    <div class="oc21-acordeon"><span class="oc21-acordeon-icon">▾</span></div>
    <button type="button" class="oc21-combo-card">Card</button>
    <div class="oc21-segmented"><button type="button">Filtro</button></div>
    <table class="ficha-bento-table"><tbody><tr><td>Linha</td></tr></tbody></table>
    <details class="oc21-details-card"><summary>Detalhe</summary></details>
  </div>
  <div class="oc-viewport" data-tema-onco="noite">
    <button type="button" class="oc-rail-btn">Rail</button>
    <div class="oc-tab-ind"></div>
    <div class="oc-b3"></div>
  </div>
</body>
</html>`;

    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setContent(html, { waitUntil: "load" });

      const ativosComTransicao = await page.evaluate(() => {
        const seletores = [
          ".oncoassist-local",
          ".oc21-trigger-pill",
          ".oc21-chevron",
          ".oc21-acordeon",
          ".oc21-combo-card",
          ".oc21-segmented button",
          ".ficha-bento-table tbody tr",
          ".oc21-details-card",
          ".oc-viewport",
          ".oc-rail-btn",
          ".oc-tab-ind",
          ".oc-b3",
        ];
        const falhas: string[] = [];
        for (const sel of seletores) {
          const el = document.querySelector(sel);
          if (!el) {
            falhas.push(`${sel}: ausente`);
            continue;
          }
          const st = window.getComputedStyle(el);
          const duracoes = st.transitionDuration.split(",").map((s) => s.trim());
          if (duracoes.some((d) => d !== "0s" && d !== "0ms")) {
            falhas.push(`${sel}: transitionDuration=${st.transitionDuration}`);
          }
        }
        return falhas;
      });

      expect(ativosComTransicao).toEqual([]);
    } finally {
      await browser.close();
    }
  });
});
