// Ponte mínima e tipada entre renderer e processo principal (sem Node no renderer).
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('pdfforge', {
  exportarOncoGlobal: (entrada) => ipcRenderer.invoke('oncoglobal:export', entrada),
  openFiles: (opts) => ipcRenderer.invoke('files:open', opts),
  readFile: (filePath) => ipcRenderer.invoke('files:read', filePath),
  saveFile: (name, bytes) => ipcRenderer.invoke('files:save', { name, bytes }),
  saveMany: (files) => ipcRenderer.invoke('files:saveMany', files),
  showInFolder: (filePath) => ipcRenderer.invoke('files:showInFolder', filePath),
  storeGet: () => ipcRenderer.invoke('store:get'),
  storeSet: (value) => ipcRenderer.invoke('store:set', value),
  pathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file) || null;
    } catch {
      return null;
    }
  },
  ai: {
    chat: (requestId, req) => ipcRenderer.invoke('llm:chat', requestId, req),
    abort: (requestId) => ipcRenderer.invoke('llm:abort', requestId),
    onEvent: (cb) => {
      const listener = (_e, requestId, payload) => cb(requestId, payload);
      ipcRenderer.on('llm:event', listener);
      return () => ipcRenderer.removeListener('llm:event', listener);
    },
    models: (provider) => ipcRenderer.invoke('llm:models', provider),
    keyStatus: () => ipcRenderer.invoke('secrets:status'),
    setKey: (provider, value) => ipcRenderer.invoke('secrets:set', provider, value),
    transcribe: (payload) => ipcRenderer.invoke('media:transcribe', payload),
    transcribePath: (filePath, opts) => ipcRenderer.invoke('media:transcribePath', filePath, opts),
    youtube: (url) => ipcRenderer.invoke('media:youtube', url),
    reels: (url) => ipcRenderer.invoke('media:reels', url),
  },
  plugins: {
    wordExport: (payload) => ipcRenderer.invoke('word:export', payload),
    wordImport: () => ipcRenderer.invoke('word:import'),
    detectDrive: () => ipcRenderer.invoke('folder:detectDrive'),
    pickFolder: (title) => ipcRenderer.invoke('folder:pick', title),
    listFolder: (dir) => ipcRenderer.invoke('folder:list', dir),
    readFolderFile: (filePath) => ipcRenderer.invoke('folder:read', filePath),
    writeFolderFile: (dir, name, content, asDocx, subdirectory) => ipcRenderer.invoke('folder:write', dir, name, content, asDocx, subdirectory),
    whatsapp: (text) => ipcRenderer.invoke('share:whatsapp', text),
    libraryGet: () => ipcRenderer.invoke('library:get'),
    librarySet: (value) => ipcRenderer.invoke('library:set', value),
  },
  web: {
    toPdf: (url) => ipcRenderer.invoke('web:toPdf', url),
    onOpen: (cb) => {
      const listener = (_e, url) => cb(url);
      ipcRenderer.on('browser:open', listener);
      return () => ipcRenderer.removeListener('browser:open', listener);
    },
  },
  capture: {
    sources: () => ipcRenderer.invoke('capture:sources'),
    select: (id) => ipcRenderer.invoke('capture:select', id),
  },
  onMenu: (channel, cb) => {
    const allowed = ['menu:open', 'menu:tools', 'menu:about', 'menu:newtab', 'menu:palette', 'menu:closetab'];
    if (!allowed.includes(channel)) return () => {};
    const listener = () => cb();
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
});
