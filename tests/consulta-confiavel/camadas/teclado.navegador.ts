import { afterAll, beforeAll, expect, it } from "vitest";
import { chromium, type Page } from "playwright";
import { createServer } from "vite";

let servidor: Awaited<ReturnType<typeof createServer>>;
let navegador: Awaited<ReturnType<typeof chromium.launch>>;
let url: string;
beforeAll(async () => {
  servidor = await createServer({ configFile: false, root: process.cwd(), server: { host: "127.0.0.1", port: 0 } });
  await servidor.listen();
  url = servidor.resolvedUrls!.local[0]! + "tests/consulta-confiavel/camadas/fixture.html";
  navegador = await chromium.launch({ headless: true });
  const aquecimento = await navegador.newPage();
  await aquecimento.goto(url);
  await aquecimento.getByRole("button", { name: "Abrir camadas sintéticas", exact: true }).waitFor();
  await aquecimento.close();
}, 30_000); // Compilação inicial Vite; não altera timeout das asserções de navegação.
afterAll(async () => { await navegador?.close(); await servidor?.close(); });

async function focoDentro(page: Page, nome: string) {
  expect(await page.getByRole("dialog", { name: nome, exact: true }).evaluate(el => el.contains(document.activeElement))).toBe(true);
}

it.each([false, true])("teclado real: camadas preservam foco, texto e retorno (ancestral alto=%s)", async ancestral => {
  const page = await navegador.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  try {
    await page.goto(url);
    const abrir = page.getByRole("button", { name: ancestral ? "Abrir com ancestral alto" : "Abrir camadas sintéticas", exact: true });
    await abrir.click();
    const jornada = page.getByRole("dialog", { name: "Jornada oncológica 3D", exact: true });
    const cfg = page.getByRole("dialog", { name: "Configurações", exact: true });
    await cfg.waitFor();
    if (ancestral) {
      await focoDentro(page, "Jornada oncológica 3D");
      await page.keyboard.press("Space");
      await jornada.getByRole("button", { name: "Pausar tour", exact: true }).waitFor();
      await page.keyboard.press("Escape");
      await jornada.waitFor({ state: "detached" });
    }
    await focoDentro(page, "Configurações");
    // O primeiro controle é Fechar; Shift+Tab circula e Tab retorna a ele, de verdade no Chromium.
    const primeiro = cfg.getByRole("button", { name: "Fechar configurações", exact: true });
    await primeiro.focus();
    await page.keyboard.press("Shift+Tab");
    await focoDentro(page, "Configurações");
    expect(await primeiro.evaluate(el => el === document.activeElement)).toBe(false);
    await page.keyboard.press("Tab");
    expect(await primeiro.evaluate(el => el === document.activeElement)).toBe(true);
    await cfg.getByRole("textbox", { name: "CRM", exact: true }).fill("CRM-SINTETICO-123");
    await page.keyboard.press("Tab");
    expect(await cfg.getByRole("textbox", { name: "CRM", exact: true }).inputValue()).toBe("CRM-SINTETICO-123");
    await page.keyboard.press("Escape");
    await cfg.waitFor({ state: "detached" });
    if (!ancestral) {
      await focoDentro(page, "Jornada oncológica 3D");
      await page.keyboard.press("Space");
      await jornada.getByRole("button", { name: "Pausar tour", exact: true }).waitFor();
      await page.keyboard.press("Escape");
      await jornada.waitFor({ state: "detached" });
    }
    await focoDentro(page, "Consulta Flash");
    await page.keyboard.press("Escape");
    await page.getByRole("dialog", { name: "Consulta Flash", exact: true }).waitFor({ state: "detached" });
    expect(await abrir.evaluate(el => el === document.activeElement)).toBe(true);
  } finally { await page.close(); }
});
