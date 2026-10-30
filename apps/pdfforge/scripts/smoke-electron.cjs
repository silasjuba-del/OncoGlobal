// Smoke test do shell Electron: carrega dist/ com o preload real, confere a ponte e a UI e encerra.
// Uso: npm run build && npm run smoke
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');

process.env.PDFFORGE_LLM_MOCK = '1';
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'pdfforge-smoke-')));
require('../electron/main.cjs');

async function samplePdfBase64() {
  const { PDFDocument, StandardFonts } = require('@cantoo/pdf-lib');
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 3; i++) doc.addPage().drawText('Smoke ' + i, { x: 50, y: 700, size: 20, font });
  return Buffer.from(await doc.save()).toString('base64');
}

app.on('browser-window-created', (_e, win) => {
  win.webContents.on('console-message', (_ev, level, message) => {
    if (level >= 2) console.error('RENDERER', message);
  });
  win.webContents.once('did-finish-load', async () => {
    try {
      const b64 = await samplePdfBase64();
      const result = await win.webContents.executeJavaScript(`(async () => { try {
        for (let i = 0; i < 40 && !document.querySelector('.app'); i++) await new Promise(r => setTimeout(r, 250));
        if (!document.querySelector('.app')) return { scriptError: 'UI não montou: ' + document.body.innerHTML.slice(0, 300) };
        const bytes = Uint8Array.from(atob('${b64}'), c => c.charCodeAt(0));
        const dt = new DataTransfer();
        dt.items.add(new File([bytes], 'smoke.pdf', { type: 'application/pdf' }));
        for (const t of ['dragover', 'drop']) document.querySelector('.app').dispatchEvent(new DragEvent(t, { bubbles: true, cancelable: true, dataTransfer: dt }));
        await new Promise(r => setTimeout(r, 3000));
        const viewer = document.querySelector('.tab-panel:not([hidden]) .viewer-toolbar')?.innerText.split(String.fromCharCode(10))[0] ?? null;
        const viewerError = document.querySelector('.tab-panel:not([hidden]) .notice.error')?.innerText ?? null;
        document.querySelector('.tab').click();
        const bridge = typeof window.pdfforge === 'object' && typeof window.pdfforge.openFiles === 'function';
        const nodeLeak = typeof window.require !== 'undefined' || typeof window.process !== 'undefined';
        const tabs = [...document.querySelectorAll('.tab')].map(t => t.innerText.trim());
        const tiles = document.querySelectorAll('.tool-tile').length;
        await window.pdfforge.storeSet({ version: 1, recents: [], toolUsage: { merge: { count: 1, lastUse: 1 } }, history: [], settings: { theme: 'dark' } });
        const back = await window.pdfforge.storeGet();
        // Ponte de IA (provedor simulado), biblioteca, YouTube e suporte a <webview>.
        let deltas = 0;
        const off = window.pdfforge.ai.onEvent(() => deltas++);
        const chat = await window.pdfforge.ai.chat('smoke-1', { provider: 'claude', model: 'claude-opus-5-5', messages: [{ role: 'user', content: [{ type: 'text', text: 'olá' }] }] });
        off();
        const keys = await window.pdfforge.ai.keyStatus();
        await window.pdfforge.plugins.librarySet({ version: 1, docs: [], annotations: [], prompts: [{ id: 'x' }] });
        const libBack = await window.pdfforge.plugins.libraryGet();
        const yt = await window.pdfforge.ai.youtube('https://youtu.be/aircAruvnKk');
        const tmp = ${JSON.stringify(os.tmpdir())};
        const docx = await window.pdfforge.plugins.writeFolderFile(tmp, 'pdfforge-smoke.md', '# Título do teste\\n- item **negrito**\\n\\nParágrafo final.', true);
        const docxBack = docx.ok ? await window.pdfforge.plugins.readFolderFile(docx.value) : docx;
        const srt = await window.pdfforge.plugins.writeFolderFile(tmp, 'pdfforge-plaud.srt', '1\\n00:00:01,000 --> 00:00:03,000\\nPaciente relata dor.\\n\\n2\\n00:01:05,000 --> 00:01:07,000\\nPlano: exame de imagem.', false);
        const srtBack = await window.pdfforge.plugins.readFolderFile(srt.value);
        const word = docxBack.ok ? docxBack.value.text.replace(/\\s+/g, ' ').trim() : docxBack.error;
        const plaud = srtBack.ok ? srtBack.value.text : srtBack.error;
        // Lote 3: scraper → PDF, fontes de captura, aba de navegador interno com <webview>.
        const scrape = await window.pdfforge.web.toPdf('https://example.com/');
        const sources = await window.pdfforge.capture.sources();
        const navBtn = [...document.querySelectorAll('.drawer .side-item')].find((b) => b.getAttribute('aria-label') === 'Navegador');
        navBtn.click();
        await new Promise((r) => setTimeout(r, 300));
        const wv = document.querySelector('.tab-panel:not([hidden]) webview');
        await new Promise((resolve) => { wv.addEventListener('dom-ready', resolve, { once: true }); setTimeout(resolve, 15000); });
        await wv.loadURL('https://example.com/').catch(() => {});
        const pageTitle = await wv.executeJavaScript('document.title').catch((e) => 'erro: ' + e.message);
        const pdfFromTab = await wv.printToPDF({ printBackground: true }).then((b) => b.length).catch((e) => 'erro: ' + e.message);
        const lote3 = {
          scrape: scrape.ok ? { title: scrape.value.title, pdfBytes: scrape.value.bytes.length, isPdf: String.fromCharCode(...scrape.value.bytes.slice(0, 4)) === '%PDF' } : scrape.error,
          captureSources: sources.length,
          webviewTitle: pageTitle,
          pdfFromTab,
        };
        const ai = { lote3, word, plaud, chatOk: chat.ok, chatChars: chat.text?.length, deltas, keys, library: libBack?.prompts?.[0]?.id === 'x', youtube: yt.ok ? yt.value.text.split(String.fromCharCode(10)).length + ' linhas' : yt.error, webviewTag: Boolean(customElements.get('webview')) };
        return { ai, origin: location.origin, bridge, nodeLeak, tabs, tiles, viewer, viewerError, storeRoundTrip: back?.toolUsage?.merge?.count === 1 };
      } catch (e) { return { scriptError: String(e && e.stack || e) }; } })()`);
      console.log('SMOKE_RESULT ' + JSON.stringify(result));
      const ok = result.bridge && !result.nodeLeak && result.tabs.length > 0 && result.storeRoundTrip && result.viewer === 'Página 1 de 3' && result.ai.chatOk && result.ai.deltas > 5 && result.ai.library && result.ai.webviewTag && result.ai.lote3.scrape.isPdf && result.ai.lote3.webviewTitle === 'Example Domain';
      app.exit(ok ? 0 : 1);
    } catch (err) {
      console.error('SMOKE_ERROR', err);
      app.exit(1);
    }
  });
});

setTimeout(() => {
  console.error('SMOKE_TIMEOUT');
  app.exit(2);
}, 30_000);
void BrowserWindow;
