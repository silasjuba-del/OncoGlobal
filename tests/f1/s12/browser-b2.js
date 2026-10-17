#!/usr/bin/env node
/**
 * Harness S12 — jornadas B2 no navegador real (Playwright).
 * WRITE_SET: apenas este arquivo + fixtures/servidor-demo-b2.ts
 * Evidências: diretório temporário fora do Git (log + screenshots).
 */
import { spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { createServer as createViteServer } from "vite";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const MANIFEST = JSON.parse(readFileSync(join(ROOT, "corpus/manifesto/b2-fichas.v1.json"), "utf8"));

/** Uma ficha por família de risco (manifesto b2-fichas.v1.json). */
export const FAMILIAS_B2 = [
  { familia: "alternancia-ewing-vdc-ie", match: /ewing-vdc-ciclo-a-alternado/ },
  { familia: "multiplos-dias-map", match: /map-ciclos-1-4/ },
  { familia: "auc-cup-carbo-pac", match: /carboplatina-paclitaxel-21-21-dias/ },
  { familia: "infusao-continua-lv5fu2", match: /lv5fu2-5-fu-folinato-p1512/ },
  { familia: "resgate-ntg-mtx-fa", match: /metotrexato-acido-folinico-baixo-risco/ },
  { familia: "dose-fixa-cemiplimabe", match: /cemiplimabe__localmente-avancado/ },
].map(({ familia, match }) => {
  const f = MANIFEST.fichasNovas.find((x) => match.test(x.arquivo));
  if (!f) throw new Error(`FICHA_B2_AUSENTE:${familia}`);
  return { familia, templateId: f.templateId, versao: f.versao, hash: f.hash, arquivo: f.arquivo };
});

async function portaLivre() {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const p = s.address()?.port;
      s.close((err) => (err ? reject(err) : resolve(p)));
    });
  });
}

const SERVIDOR_B2_TS = "/tests/f1/s12/fixtures/servidor-demo-b2.ts";

/** A evidência vem do draft recebido. O manifesto serve somente para comparar. */
export function conferirTrilhaB2(template, esperado) {
  if (!template || !esperado || !["templateId", "versao", "hash"].every(k =>
    typeof template[k] === "string" && template[k].length > 0 && template[k] === esperado[k]))
    throw new Error("TRILHA_AUSENTE_OU_DIVERGENTE");
  return { templateId: template.templateId, versao: template.versao, hash: template.hash };
}

function iniciarProcesso(cmd, args, env, logStream) {
  const child = spawn(cmd, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ["pipe", "pipe", "pipe"] });
  child.stdout.on("data", (b) => logStream.write(b));
  child.stderr.on("data", (b) => logStream.write(b));
  return child;
}

async function aguardarManifesto(proc) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("TIMEOUT_SERVIDOR_B2")), 120_000);
    const onData = (chunk) => {
      for (const line of chunk.toString().split("\n")) {
        if (!line.includes("S12_DEMO_B2") && !line.includes('"baseUrl"')) continue;
        try {
          const j = JSON.parse(line);
          if (j.baseUrl && j.dir) {
            clearTimeout(t);
            proc.stdout.off("data", onData);
            resolve(j);
            return;
          }
        } catch { /* linha de log */ }
      }
    };
    proc.stdout.on("data", onData);
  });
}

/** Código Playwright injetado na sessão OncoAssist (painel de prova B2 — DOM visível). */
export async function jornadaB2NoNavegador(page, opts) {
  const { senha, patientId, encounterId, familias, promoverStdin } = opts;
  const apiBase = "";
  if (!/^http:\/\/127\.0\.0\.1:\d+\/oncoassist\.html/.test(page.url())) throw new Error("DEMO_LOCAL_OBRIGATORIA");
  const externas = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (["http:", "https:"].includes(u.protocol) && u.hostname !== "127.0.0.1") externas.push(u.origin);
  });

  await page.goto(new URL("/oncoassist.html", page.url()).href);
  await page.getByLabel("Senha do servidor").fill(senha);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByLabel("Paciente da agenda").selectOption(encounterId);
  await page.getByRole("region", { name: "Consulta persistida", exact: true }).waitFor();

  await page.exposeFunction("__s12Promover", (templateId) => promoverStdin(templateId));
  await page.exposeFunction("__s12ConferirTrilha", (template, templateId) =>
    conferirTrilhaB2(template, familias.find(f => f.templateId === templateId)));

  await page.evaluate(({ apiBase, senha, patientId, encounterId, familias }) => {
    sessionStorage.setItem("s12B2Senha", senha);
    const host = document.createElement("section");
    host.setAttribute("aria-label", "Jornada prescrição B2 — prova S12");
    host.id = "s12-b2-jornada";
    host.innerHTML = `<h2>Jornada B2 (sintética)</h2><p>Paciente <b>${patientId}</b> · Encontro <b>${encounterId}</b></p>`;
    for (const f of familias) {
      const art = document.createElement("article");
      art.dataset.familia = f.familia;
      art.dataset.templateId = f.templateId;
      art.innerHTML = `<h3>${f.familia}</h3>
        <button type="button" data-acao="rascunho-rascunho">Rascunho (ficha RASCUNHO)</button>
        <button type="button" data-acao="rascunho-conferida">Rascunho (CONFERIDA em memória)</button>
        <button type="button" data-acao="propor">Propor e conferir trilha</button>
        <div role="region" aria-label="Resultado prescrição B2 ${f.familia}"><pre data-resultado></pre></div>`;
      host.appendChild(art);
    }
    document.body.prepend(host);

    let token = sessionStorage.getItem("s12B2Token") ?? "";
    async function login() {
      if (token) return token;
      const r = await fetch(`${apiBase}/login`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha: sessionStorage.getItem("s12B2Senha") }) });
      const j = await r.json();
      token = j.token;
      sessionStorage.setItem("s12B2Token", token);
      return token;
    }
    async function post(path, body) {
      const t = await login();
      const r = await fetch(`${apiBase}${path}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify(body) });
      return { status: r.status, json: await r.json() };
    }
    async function selecionarContexto() {
      await post("/consulta/contexto/selecionar", { patientId, encounterId, tumorLotId: null });
    }
    function pintar(art, texto) {
      const pre = art.querySelector("[data-resultado]");
      pre.textContent = texto;
      pre.parentElement.setAttribute("role", "status");
    }
    host.addEventListener("click", async (ev) => {
      const btn = ev.target instanceof Element ? ev.target.closest("button[data-acao]") : null;
      if (!btn) return;
      const art = btn.closest("article");
      const f = familias.find((x) => x.familia === art?.dataset.familia);
      if (!f || !art) return;
      await selecionarContexto();
      const acao = btn.getAttribute("data-acao");
      if (acao === "rascunho-rascunho") {
        const r = await post("/consulta/prescricao/rascunho", { patientId, encounterId, tumorLotId: null, templateId: f.templateId });
        const inst = r.json.instanciacao;
        const recusa = inst?.ok === false ? inst.recusa?.codigo : null;
        const visivel = recusa === "TEMPLATE_NAO_CONFERIDO" ? "TEMPLATE_NAO_CONFERIDO" : JSON.stringify(inst);
        pintar(art, `HTTP ${r.status}\nrecusa visível: ${visivel}\n${JSON.stringify(r.json, null, 2)}`);
        art.dataset.ultimoDraft = r.json.draftId ?? "";
        return;
      }
      if (acao === "rascunho-conferida") {
        await window.__s12Promover(f.templateId);
        await new Promise((r) => setTimeout(r, 400));
        const r = await post("/consulta/prescricao/rascunho", { patientId, encounterId, tumorLotId: null, templateId: f.templateId });
        const inst = r.json.instanciacao;
        const draft = await post("/consulta/rascunho", { draftId: r.json.draftId });
        const recebida = await window.__s12ConferirTrilha(draft.json?.draft?.payload?.template, f.templateId);
        art.dataset.trilhaRecebida = JSON.stringify(recebida);
        const trilha = `template ${recebida.templateId} · versão ${recebida.versao} · hash ${recebida.hash}`;
        pintar(art, `HTTP ${r.status}\ncálculo: ${inst?.ok ? "OK" : "RECUSADO"}\ntrilha: ${trilha}\n${JSON.stringify(r.json, null, 2).slice(0, 4000)}`);
        art.dataset.ultimoDraft = r.json.draftId ?? "";
        art.dataset.instanciacaoOk = inst?.ok ? "1" : "0";
        return;
      }
      if (acao === "propor") {
        if (art.dataset.instanciacaoOk !== "1") { pintar(art, "Proposta bloqueada: instanciar CONFERIDA antes."); return; }
        const rasc = await post("/consulta/prescricao/rascunho", { patientId, encounterId, tumorLotId: null, templateId: f.templateId });
        const inst = rasc.json.instanciacao;
        if (!inst?.ok) { pintar(art, "Instanciação falhou na proposta."); return; }
        art.dataset.pendentes = String(inst.pendentes);
        const itens = inst.itens.map((i) => ({
          ...i.item,
          source: "MANUAL",
          overrideMotivo: i.item.classe === "QT"
            ? "confirmação médica — jornada B2 sintética S12 (não prescrição real)"
            : i.item.overrideMotivo,
        }));
        await post("/consulta/carregar", { patientId, encounterId, tumorLotId: null });
        const prop = await post("/consulta/prescricao/propor", {
          patientId, encounterId, tumorLotId: null, id: `proposta-b2-${f.familia}`,
          operationId: crypto.randomUUID(), expectedRevision: null, rascunhoOrigemId: rasc.json.draftId, itens,
        });
        if(prop.status===201 && typeof prop.json.draftId==="string") art.dataset.propostaSalvaId=prop.json.draftId;
        const draft = await post("/consulta/rascunho", { draftId: rasc.json.draftId });
        const recebida = await window.__s12ConferirTrilha(draft.json?.draft?.payload?.template, f.templateId);
        art.dataset.trilhaRecebida = JSON.stringify(recebida);
        pintar(art, `proposta HTTP ${prop.status} codigo ${prop.json.codigo ?? prop.json.revision}\n`
          + `documento-rascunho: ${JSON.stringify(draft.json?.draft?.payload?.schema ?? draft.json?.draft?.payload?.kind ?? draft.json).slice(0, 500)}\n`
          + `trilha: ${recebida.templateId} · ${recebida.versao} · ${recebida.hash}\n`
          + `itens calculados: ${itens.length}`);
      }
    });
  }, { apiBase, senha: opts.senha, patientId, encounterId, familias });

  const resultados = [];
  for (const f of familias) {
    const art = page.locator(`article[data-familia="${f.familia}"]`);
    await art.getByRole("button", { name: "Rascunho (ficha RASCUNHO)", exact: true }).click();
    await art.getByRole("status").filter({ hasText: "TEMPLATE_NAO_CONFERIDO" }).waitFor({ timeout: 30_000 });
    const textoRecusa = await art.locator("[data-resultado]").innerText();
    if (!textoRecusa.includes("TEMPLATE_NAO_CONFERIDO")) throw new Error(`RECUSA_NAO_VISIVEL:${f.familia}`);

    await promoverStdin(f.templateId);
    await art.getByRole("button", { name: "Rascunho (CONFERIDA em memória)", exact: true }).click();
    await art.locator("[data-resultado]").filter({ hasText: f.hash }).waitFor({ timeout: 30_000 });
    const textoPos = await art.locator("[data-resultado]").innerText();
    if (!textoPos.includes(f.hash) || !textoPos.includes(f.versao)) throw new Error(`TRILHA_AUSENTE:${f.familia}`);
    if (!textoPos.includes("cálculo: OK") && !textoPos.includes('"ok": true')) throw new Error(`CALCULO_NAO_OK:${f.familia}`);

    await art.getByRole("button", { name: "Propor e conferir trilha", exact: true }).click();
    await art.locator("[data-resultado]").filter({ hasText: /proposta HTTP/ }).waitFor({ timeout: 30_000 });
    const textoProp = await art.locator("[data-resultado]").innerText();
    const pendentes = Number(await art.getAttribute("data-pendentes"));
    if (pendentes > 0 ? !textoProp.includes("proposta HTTP 409 codigo ORIGEM_TEMPLATE_PENDENTE")
      : !textoProp.includes("proposta HTTP 201") && !textoProp.includes("proposta HTTP 200")) {
      throw new Error(`PROPOSTA_NAO_SALVA:${f.familia}:${textoProp.slice(0, 200)}`);
    }
    const recebida = conferirTrilhaB2(JSON.parse(await art.getAttribute("data-trilha-recebida") ?? "null"), f);
    resultados.push({ familia: f.familia, templateId: recebida.templateId, recusaVisivel: true, trilhaHash: recebida.hash, versao: recebida.versao, propostaId: await art.getAttribute("data-proposta-salva-id"), proposta: pendentes === 0, pendentesPreservados: pendentes });
    await page.screenshot({ path: join(opts.evidenceDir, `${f.familia}.png`), fullPage: true });
  }

  if (externas.length) throw new Error("EGRESSO_EXTERNO_NA_DEMO");
  return { resultados, externas: externas.length };
}

async function main() {
  const evidenceDir = mkdtempSync(join(tmpdir(), "s12-b2-evidence-"));
  const logPath = join(evidenceDir, "browser-b2.log");
  const logStream = createWriteStream(logPath, { flags: "a" });
  const log = (o) => { const line = `${JSON.stringify({ t: new Date().toISOString(), ...o })}\n`; logStream.write(line); process.stdout.write(line); };

  log({ fase: "inicio", root: ROOT, familias: FAMILIAS_B2.map((f) => f.familia), evidenceDir });

  let playwright;
  try { playwright = await import("playwright"); }
  catch {
    log({ limitacao: "PLAYWRIGHT_INDISPONIVEL", fallback: "HTTP-only não executado neste turno — instale playwright para prova de navegador." });
    process.exitCode = 2;
    return;
  }

  const demoDir = mkdtempSync(join(tmpdir(), "e2e-b2-f1-"));
  const apiPort = await portaLivre();
  const uiPort = await portaLivre();
  process.env.ONCOGLOBAL_API_PORT = String(apiPort);

  let demo;
  let viteDev;
  try {
    viteDev = await createViteServer({
      configFile: join(ROOT, "vite.config.ts"),
      cacheDir: join(evidenceDir, "vite-cache"),
      root: ROOT,
      server: { host: "127.0.0.1", port: uiPort, strictPort: true },
    });
    await viteDev.listen();
    const mod = await viteDev.ssrLoadModule(SERVIDOR_B2_TS);
    demo = await mod.bootServidorDemoB2(demoDir);
    log({ fase: "servidor_b2_vite_ssr", manifesto: demo.manifesto, apiPort, uiPort, sqlite: join(demoDir, "ledger.sqlite") });
  } catch (e) {
    log({ erro: "SERVIDOR_NAO_SUBIU", detalhe: String(e) });
    process.exitCode = 1;
    await viteDev?.close();
    return;
  }
  const manifesto = demo.manifesto;
  const promoverStdin = (templateId) => {
    demo.promoverTemplate(templateId);
  };

  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${uiPort}/oncoassist.html`);
    const resultado = await jornadaB2NoNavegador(page, {
      senha: manifesto.senhaDemo,
      patientId: manifesto.b2.patientId,
      encounterId: manifesto.b2.encounterId,
      familias: FAMILIAS_B2,
      promoverStdin,
      evidenceDir,
    });
    log({ prova: "JORNADA_B2_NAVEGADOR", ...resultado });

    await demo.app.close();
    await new Promise((r) => setTimeout(r, 500));
    const mod2 = await viteDev.ssrLoadModule(SERVIDOR_B2_TS);
    demo = await mod2.bootServidorDemoB2(demoDir);
    const manifesto2 = demo.manifesto;
    log({ prova: "REINICIO_SERVIDOR_MESMO_SQLITE", baseUrl: manifesto2.baseUrl });
    const { lerDraft } = await viteDev.ssrLoadModule("/src/kernel/ledger/drafts.ts");
    const propostasReabertas = resultado.resultados.filter(r => r.proposta).map(r => {
      const draft = lerDraft(demo.app.db, r.propostaId), p = draft?.payload;
      if (p?.schema !== "PrescricaoProposta@1" || p.estado !== "DRAFT" || draft.patientId !== manifesto2.b2.patientId) throw new Error("PROPOSTA_NAO_PERSISTIU");
      conferirTrilhaB2({templateId:p.templateId,versao:p.templateVersao,hash:p.templateHash},{templateId:r.templateId,versao:r.versao,hash:r.trilhaHash});
      return r.propostaId;
    });
    log({prova:"PROPOSTAS_REABERTAS_COM_TRILHA",quantidade:propostasReabertas.length});
    const page2 = await browser.newPage();
    await page2.goto(`http://127.0.0.1:${uiPort}/oncoassist.html`);
    await page2.getByLabel("Senha do servidor").fill(manifesto2.senhaDemo);
    await page2.getByRole("button", { name: "Entrar", exact: true }).click();
    await page2.getByLabel("Paciente da agenda").selectOption(manifesto2.b2.encounterId);
    await page2.getByRole("region", { name: "Consulta persistida", exact: true }).waitFor();
    const historico = page2.getByRole("region", { name: "Histórico de documentos assinados", exact: true });
    await historico.waitFor();
    const qtd = await historico.locator("article").count();
    // Histórico vazio comprova somente a leitura da região após reinício, não persistência de propostas ou assinatura.
    log({ prova: "REINICIO_MESMO_SQLITE", dir: demoDir, documentosHistorico: qtd, historicoConsultado: true });
    writeFileSync(join(evidenceDir, "resumo.json"), JSON.stringify({ manifesto: manifesto2, familias: FAMILIAS_B2, resultado, reinicio: { documentosHistorico: qtd, propostasReabertas } }, null, 2));
    await demo.app.close();
  } finally {
    await browser?.close();
    try { await demo?.app.close(); } catch { /* app pode já ter sido fechada antes do reinício */ }
    await viteDev?.close();
  }
  log({ fase: "fim", logPath, evidenceDir });
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((e) => { console.error(e); process.exitCode = 1; });
}
