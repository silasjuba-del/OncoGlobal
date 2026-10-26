// Prova em Chromium real: fora de `npm test` (os shards de CI não instalam navegador).
// Uso: npx vitest run --config tests/hostil-cursor/navegador/vitest.config.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium } from "playwright";
import { createServer } from "vite";

describe("U-H7 · layout em 320 px, 768 px, 1280 px e zoom 200% sem rolagem horizontal nem alvo < 24x24 px", () => {
  let server: Awaited<ReturnType<typeof createServer>>;
  let browser: Awaited<ReturnType<typeof chromium.launch>>;
  let url: string;
  beforeAll(async () => {
    server = await createServer({ configFile: false, root: process.cwd(), server: { host: "127.0.0.1", port: 0 } });
    await server.listen();
    url = server.resolvedUrls!.local[0]! + "tests/hostil-cursor/navegador/layout.html";
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url);
    await page.getByRole("group", { name: "Filtrar dados da ficha" }).waitFor();
    await page.close();
  });
  afterAll(async () => { await browser?.close(); await server?.close(); });
  it("Playwright em 320 px, 768 px, 1280 px e zoom 200%: sem rolagem horizontal da página e alvos >= 24x24 px", async () => {
    const baseCss = readFileSync(join(process.cwd(), "src/ui/tema/base.css"), "utf8");
    const tokensCss = readFileSync(join(process.cwd(), "src/ui/tema/tokens.css"), "utf8");
    const consultaCss = readFileSync(join(process.cwd(), "src/ui/consulta/consulta-local.css"), "utf8");

    const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  html, body { margin: 0; padding: 0; }
  ${baseCss}
  ${tokensCss}
  ${consultaCss}
</style>
</head>
<body class="tema" data-tema="gelo">
  <main class="oncoassist-local" data-combo-21st="violet-halo">
    <header class="consulta-appbar">
      <div>
        <h1>OncoAssist local — SINTETICO</h1>
        <p>Documentos do servidor local. Sugestões aguardam revisão médica.</p>
      </div>
      <div class="consulta-appbar-direita">
        <div class="oc21-toolbar">
          <button type="button" class="oc21-trigger-pill">Aparência · Violeta suave</button>
          <button type="button" class="oc21-quick-btn">Recolher painéis</button>
        </div>
      </div>
    </header>
    <section class="revisao-clinica-bento" aria-label="Ficha e revisão clínica">
      <div class="revisao-clinica-topo">
        <div>
          <h2>Ficha e revisão clínica</h2>
          <p class="revisao-clinica-sub">Dados mínimos agrupados por estado.</p>
        </div>
        <div class="revisao-clinica-toolbar" role="toolbar">
          <div class="oc21-segmented" role="group">
            <button type="button" data-ativo="1">Todos (12)</button>
            <button type="button" data-ativo="0">Confirmados (5)</button>
            <button type="button" data-ativo="0">Calculados (2)</button>
            <button type="button" data-ativo="0">Pendentes (3)</button>
            <button type="button" data-ativo="0">A conferir (2)</button>
          </div>
        </div>
      </div>
      <div class="oc21-partition-bar">
        <div class="oc21-partition-seg"><span>Confirmados</span><strong>5</strong></div>
        <div class="oc21-partition-seg"><span>Calculados</span><strong>2</strong></div>
        <div class="oc21-partition-seg"><span>Pendentes</span><strong>3</strong></div>
        <div class="oc21-partition-seg"><span>Conflitos</span><strong>1</strong></div>
        <div class="oc21-partition-seg"><span>A conferir</span><strong>1</strong></div>
      </div>
    </section>
    <section class="atendimento-v6" aria-label="Atendimento por diferenças">
      <div class="atendimento-v6__contexto">
        <strong>Paciente SINTETICO U-H7</strong>
        <span>Referência: 2026-10-05</span>
      </div>
      <div class="atendimento-v6__entrada">
        <label>Hoje — somente o que mudou<textarea rows="3">Evolução sintética sem rolagem horizontal.</textarea></label>
        <label>Decisão médica de hoje<textarea rows="3">Conduta sintética explícita.</textarea></label>
      </div>
    </section>
    <div class="colunas">
      <div class="cartao">Coluna 1 SINTETICA</div>
      <div class="cartao">Coluna 2 SINTETICA</div>
      <div class="cartao">Coluna 3 SINTETICA</div>
    </div>
    <div class="lado-a-lado">
      <div class="cartao">Lado A SINTETICO</div>
      <div class="cartao">Lado B SINTETICO</div>
    </div>
  </main>
</body>
</html>`;

    const page = await browser.newPage();
    try {

      for (const vp of [
        { width: 320, height: 640, zoom: 1 },
        { width: 768, height: 1024, zoom: 1 },
        { width: 640, height: 800, zoom: 1 },
        { width: 1280, height: 800, zoom: 1 },
        { width: 1280, height: 800, zoom: 2 },
      ]) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.setContent(html, { waitUntil: "load" });
        if (vp.zoom !== 1) {
          await page.evaluate((z) => {
            document.documentElement.style.zoom = String(z);
          }, vp.zoom);
        }
        const medidas = await page.evaluate(() => {
          const doc = document.documentElement;
          const botoes = Array.from(document.querySelectorAll<HTMLElement>("button")).map((b) => {
            const r = b.getBoundingClientRect();
            return { texto: (b.textContent ?? "").trim(), w: r.width, h: r.height };
          });
          return {
            scrollWidth: doc.scrollWidth,
            clientWidth: doc.clientWidth,
            botoesMenores24: botoes.filter((b) => b.w < 24 || b.h < 24),
          };
        });
        expect(
          medidas.scrollWidth,
          `Overflow horizontal em ${vp.width}px (zoom ${vp.zoom * 100}%): scrollWidth=${medidas.scrollWidth} > clientWidth=${medidas.clientWidth}`,
        ).toBeLessThanOrEqual(medidas.clientWidth);
        expect(medidas.botoesMenores24).toEqual([]);
        await page.goto(url);
        await page.getByRole("group", { name: "Filtrar dados da ficha" }).waitFor();
        await page.evaluate(z => { document.documentElement.style.zoom = String(z); }, vp.zoom);
        const defeitos = await page.evaluate(() => {
          const erros: string[] = [];
          if (document.documentElement.scrollWidth > document.documentElement.clientWidth) erros.push("overflow da página: " + [...document.querySelectorAll("body *")].filter(el => el.getBoundingClientRect().right > innerWidth + 1).map(el => el.className).join(","));
          const controles = [...document.querySelectorAll<HTMLElement>(".consulta-appbar button, .oc21-segmented button")];
          for (const el of controles) {
            const r = el.getBoundingClientRect();
            if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) erros.push(`texto cortado: ${el.textContent}`);
            if (r.width < 24 || r.height < 24) erros.push(`alvo pequeno: ${el.textContent}`);
          }
          for (let i = 0; i < controles.length; i++) for (let j = i + 1; j < controles.length; j++) {
            const a = controles[i]!.getBoundingClientRect(), b = controles[j]!.getBoundingClientRect();
            if (Math.min(a.right,b.right) - Math.max(a.left,b.left) > 1 && Math.min(a.bottom,b.bottom) - Math.max(a.top,b.top) > 1)
              erros.push(`sobreposição: ${controles[i]!.textContent} / ${controles[j]!.textContent}`);
          }
          return erros;
        });
        expect(defeitos, `componentes reais: ${vp.width}px zoom ${vp.zoom}`).toEqual([]);
      }
    } finally {
      await page.close();
    }
  });
});
