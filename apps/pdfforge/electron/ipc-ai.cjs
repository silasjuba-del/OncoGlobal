// IPC do Lote 2: LLMs, chaves, transcrição, YouTube/Reels, plugins, biblioteca e sites embutidos (webview).
const { app, ipcMain, session, BrowserWindow, desktopCapturer, shell } = require('electron');
const llm = require('./services/llm.cjs');
const secrets = require('./services/secrets.cjs');
const media = require('./services/media.cjs');
const plugins = require('./services/plugins.cjs');

// Sites que podem ser abertos nas abas "Site" (webview). Tudo o mais abre no navegador do sistema.
const SITE_HOSTS = [
  'claude.ai',
  'chatgpt.com',
  'chat.openai.com',
  'grok.com',
  'x.ai',
  'gemini.google.com',
  'notebooklm.google.com',
  'accounts.google.com',
  'auth.openai.com',
  'auth0.openai.com',
  'appleid.apple.com',
  'login.live.com',
  'x.com',
  'api.x.com',
];
const SITE_PARTITIONS = /^persist:site-(claude|gpt|grok|gemini|notebooklm)$/;
// Navegador geral e OncoGlobal: qualquer http(s); sessões separadas das abas de LLM.
const OPEN_PARTITIONS = /^persist:(web|oncoglobal)$/;
const isHttp = (url) => /^https?:\/\//i.test(String(url));
const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const hostAllowed = (url) => {
  try {
    const host = new URL(url).hostname;
    return SITE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
};

function register(getWindow, isAppOrigin) {
  const controllers = new Map();

  ipcMain.handle('llm:chat', async (event, requestId, req) => {
    const controller = new AbortController();
    controllers.set(requestId, controller);
    const send = (payload) => !event.sender.isDestroyed() && event.sender.send('llm:event', requestId, payload);
    try {
      const result = await llm.chat(req, (delta) => send({ type: 'delta', text: delta }), controller.signal);
      return { ok: true, ...result };
    } catch (err) {
      return { ok: false, error: err.message };
    } finally {
      controllers.delete(requestId);
    }
  });
  ipcMain.handle('llm:abort', (_e, requestId) => controllers.get(requestId)?.abort());
  ipcMain.handle('llm:models', async (_e, provider) => {
    try {
      return { ok: true, models: await llm.listModels(provider) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('secrets:status', () => secrets.status());
  ipcMain.handle('secrets:set', (_e, provider, value) => secrets.setKey(provider, value));

  const wrap = (fn) => async (...args) => {
    try {
      return { ok: true, value: await fn(...args) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  };

  ipcMain.handle('media:transcribe', wrap((_e, payload) => llm.transcribe(payload)));
  ipcMain.handle(
    'media:transcribePath',
    wrap(async (_e, filePath, opts) => {
      const file = await plugins.readFolderFile(filePath);
      if (!file.bytes) throw new Error('Arquivo não é de áudio/vídeo.');
      return llm.transcribe({ bytes: file.bytes, name: file.name, ...opts });
    }),
  );
  ipcMain.handle('media:youtube', wrap((_e, url) => media.youtubeTranscript(url)));
  ipcMain.handle('media:reels', wrap((_e, url) => media.reelsMeta(url)));

  ipcMain.handle('word:export', wrap((_e, payload) => plugins.wordExport(getWindow(), payload)));
  ipcMain.handle('word:import', wrap(() => plugins.wordImport(getWindow())));
  ipcMain.handle('folder:detectDrive', wrap(() => plugins.detectDrive()));
  ipcMain.handle('folder:pick', wrap((_e, title) => plugins.pickFolder(getWindow(), title)));
  ipcMain.handle('folder:list', wrap((_e, dir) => plugins.listFolder(dir)));
  ipcMain.handle('folder:read', wrap((_e, filePath) => plugins.readFolderFile(filePath)));
  ipcMain.handle(
    'folder:write',
    wrap(async (_e, dir, name, content, asDocx) => {
      const data = asDocx ? await plugins.wordToBuffer({ title: name, markdown: content }) : content;
      return plugins.writeFolderFile(dir, asDocx ? name.replace(/\.[^.]+$/, '') + '.docx' : name, data);
    }),
  );
  ipcMain.handle('share:whatsapp', wrap((_e, text) => plugins.shareWhatsApp(text)));
  ipcMain.handle('library:get', () => plugins.libraryGet());
  ipcMain.handle('library:set', (_e, value) => plugins.librarySet(value));

  // Microfone apenas para a interface do app; sites embutidos não recebem permissões sensíveis.
  app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((wc, permission, callback, details) => {
      const fromApp = isAppOrigin(details.requestingUrl || wc.getURL());
      callback(fromApp && ['media', 'display-capture', 'clipboard-sanitized-write', 'fullscreen'].includes(permission));
    });
  });

  app.on('web-contents-created', (_e, contents) => {
    contents.on('will-attach-webview', (event, webPreferences, params) => {
      delete webPreferences.preload;
      webPreferences.nodeIntegration = false;
      webPreferences.contextIsolation = true;
      webPreferences.sandbox = true;
      const partition = params.partition || '';
      const allowed = OPEN_PARTITIONS.test(partition) ? isHttp(params.src) : SITE_PARTITIONS.test(partition) && hostAllowed(params.src);
      if (!allowed) event.preventDefault();
    });
    if (contents.getType() === 'webview') {
      const ses = contents.session;
      if (!ses.__pdfforgeConfigured) {
        ses.__pdfforgeConfigured = true;
        ses.setUserAgent(CHROME_UA);
        ses.setPermissionRequestHandler((_wc, permission, callback) =>
          callback(['clipboard-sanitized-write', 'fullscreen', 'notifications'].includes(permission)),
        );
      }
      // Navegador geral e OncoGlobal usam sessões próprias; as abas de LLM seguem a lista de hosts.
      const open = ses === session.fromPartition('persist:web') || ses === session.fromPartition('persist:oncoglobal');
      contents.setWindowOpenHandler(({ url }) => {
        if (hostAllowed(url)) return { action: 'allow' }; // pop-ups de login (Google, Apple, Microsoft)
        if (open && isHttp(url)) {
          // Navegador interno: links que abririam nova janela viram nova aba do app.
          contents.hostWebContents?.send('browser:open', url);
          return { action: 'deny' };
        }
        shell.openExternal(url);
        return { action: 'deny' };
      });
      contents.on('will-navigate', (ev, url) => {
        if (open ? !isHttp(url) : !hostAllowed(url)) {
          ev.preventDefault();
          shell.openExternal(url);
        }
      });
    }
  });
}

/** Scraper → PDF: carrega a URL numa janela oculta (sessão do navegador interno) e imprime em PDF. */
async function urlToPdf(url, { waitMs = 2500 } = {}) {
  if (!isHttp(url)) throw new Error('Informe uma URL http(s).');
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 1600,
    webPreferences: { partition: 'persist:web', sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: true },
  });
  try {
    await win.loadURL(url);
    await new Promise((r) => setTimeout(r, waitMs));
    const title = win.webContents.getTitle();
    const text = await win.webContents.executeJavaScript('(document.body && document.body.innerText) || ""');
    const pdf = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4', margins: { marginType: 'default' } });
    return { title, text, bytes: new Uint8Array(pdf) };
  } finally {
    win.destroy();
  }
}

// ---------- Captura de tela (foto, vídeo, frames) ----------
let pendingSource = null;

function registerCapture() {
  ipcMain.handle('capture:sources', async () => {
    const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 320, height: 200 } });
    return sources.map((s) => ({ id: s.id, name: s.name, thumb: s.thumbnail.toDataURL() }));
  });
  ipcMain.handle('capture:select', (_e, id) => {
    pendingSource = id;
    return true;
  });
  app.whenReady().then(() => {
    // getDisplayMedia() do app usa a fonte escolhida no seletor próprio; áudio do sistema por loopback (Windows).
    session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
      const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
      const source = sources.find((s) => s.id === pendingSource) ?? sources[0];
      pendingSource = null;
      callback(process.platform === 'win32' ? { video: source, audio: 'loopback' } : { video: source });
    });
  });
}

function registerWeb() {
  ipcMain.handle('web:toPdf', async (_e, url) => {
    try {
      return { ok: true, value: await urlToPdf(url) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}

module.exports = { register: (...args) => (register(...args), registerCapture(), registerWeb()) };
