// Processo principal do Electron: janela, menu nativo e IPC de arquivos/persistência.
const { app, BrowserWindow, ipcMain, dialog, shell, Menu, protocol, net } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');

const DIST = path.join(__dirname, '..', 'dist');

// O build é servido por app:// (origem segura e estável): workers de módulo e fetch não funcionam em file://.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

const DEV_URL = process.env.PDFFORGE_DEV_URL;
const isAppOrigin = (url) => String(url).startsWith('app://pdfforge') || (DEV_URL ? String(url).startsWith(DEV_URL) : false);
const storePath = () => path.join(app.getPath('userData'), 'pdfforge-store.json');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 880,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0b0b0d',
    title: 'PDFForge',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Tarefas longas (OCR, compressão) continuam com a janela minimizada.
      backgroundThrottling: false,
      // Abas "Site" (claude.ai, chatgpt.com…) usam <webview> isolado; ver electron/ipc-ai.cjs.
      webviewTag: true,
    },
  });
  if (DEV_URL) mainWindow.loadURL(DEV_URL);
  else mainWindow.loadURL('app://pdfforge/index.html');

  // Links externos abrem no navegador padrão, nunca dentro do app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

function buildMenu() {
  const send = (channel) => () => mainWindow?.webContents.send(channel);
  const template = [
    {
      label: 'Arquivo',
      submenu: [
        { label: 'Nova aba do navegador', accelerator: 'CmdOrCtrl+T', click: send('menu:newtab') },
        { label: 'Abrir arquivo…', accelerator: 'CmdOrCtrl+O', click: send('menu:open') },
        { label: 'Paleta de comandos…', accelerator: 'CmdOrCtrl+K', click: send('menu:palette') },
        { label: 'Fechar aba', accelerator: 'CmdOrCtrl+W', click: send('menu:closetab') },
        { label: 'Ferramentas', accelerator: 'CmdOrCtrl+Shift+F', click: send('menu:tools') },
        { type: 'separator' },
        { role: 'quit', label: 'Sair' },
      ],
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Desfazer' },
        { role: 'redo', label: 'Refazer' },
        { type: 'separator' },
        { role: 'cut', label: 'Recortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Colar' },
        { role: 'selectAll', label: 'Selecionar tudo' },
      ],
    },
    {
      label: 'Exibir',
      submenu: [
        { role: 'reload', label: 'Recarregar' },
        { role: 'toggleDevTools', label: 'Ferramentas de desenvolvedor' },
        { type: 'separator' },
        { role: 'zoomIn', label: 'Aumentar zoom' },
        { role: 'zoomOut', label: 'Diminuir zoom' },
        { role: 'resetZoom', label: 'Zoom padrão' },
        { role: 'togglefullscreen', label: 'Tela cheia' },
      ],
    },
    {
      label: 'Ajuda',
      submenu: [{ label: 'Sobre o PDFForge', click: send('menu:about') }],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

const FILTERS = {
  pdf: [{ name: 'PDF', extensions: ['pdf'] }],
  image: [{ name: 'Imagens', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'] }],
  any: [{ name: 'Todos os arquivos', extensions: ['*'] }],
};

async function readAsPayload(filePath) {
  const data = await fs.readFile(filePath);
  return { name: path.basename(filePath), path: filePath, bytes: new Uint8Array(data) };
}

ipcMain.handle('files:open', async (_e, { kind = 'pdf', multiple = true } = {}) => {
  const res = await dialog.showOpenDialog(mainWindow, {
    properties: multiple ? ['openFile', 'multiSelections'] : ['openFile'],
    filters: FILTERS[kind] ?? FILTERS.any,
  });
  if (res.canceled) return [];
  return Promise.all(res.filePaths.map(readAsPayload));
});

ipcMain.handle('files:read', async (_e, filePath) => readAsPayload(filePath));

ipcMain.handle('files:save', async (_e, { name, bytes }) => {
  const res = await dialog.showSaveDialog(mainWindow, { defaultPath: name });
  if (res.canceled || !res.filePath) return null;
  await fs.writeFile(res.filePath, Buffer.from(bytes));
  return res.filePath;
});

ipcMain.handle('files:saveMany', async (_e, files) => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Escolha a pasta de destino',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (res.canceled || !res.filePaths[0]) return null;
  const dir = res.filePaths[0];
  const saved = [];
  for (const f of files) {
    const target = await uniquePath(path.join(dir, f.name));
    await fs.writeFile(target, Buffer.from(f.bytes));
    saved.push(target);
  }
  return saved;
});

ipcMain.handle('files:showInFolder', (_e, filePath) => shell.showItemInFolder(filePath));

ipcMain.handle('store:get', async () => {
  try {
    return JSON.parse(await fs.readFile(storePath(), 'utf8'));
  } catch {
    return null;
  }
});

ipcMain.handle('store:set', async (_e, value) => {
  // Escrita atômica: grava em temporário e renomeia.
  const tmp = storePath() + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(value), 'utf8');
  await fs.rename(tmp, storePath());
  return true;
});

async function uniquePath(target) {
  const { dir, name, ext } = path.parse(target);
  let candidate = target;
  for (let i = 1; ; i++) {
    try {
      await fs.access(candidate);
      candidate = path.join(dir, `${name} (${i})${ext}`);
    } catch {
      return candidate;
    }
  }
}

require('./ipc-ai.cjs').register(() => mainWindow, isAppOrigin);
require('./services/oncoglobal-export.cjs').registrar(() => mainWindow, DEV_URL);

app.whenReady().then(() => {
  protocol.handle('app', (request) => {
    const rel = decodeURIComponent(new URL(request.url).pathname).replace(/^\/+/, '');
    const target = path.normalize(path.join(DIST, rel || 'index.html'));
    if (!target.startsWith(DIST)) return new Response('Proibido', { status: 403 });
    return net.fetch(pathToFileURL(target).toString());
  });
  buildMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
