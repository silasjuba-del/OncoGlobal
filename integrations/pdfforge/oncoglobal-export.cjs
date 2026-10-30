// Salva somente na pasta local do aplicativo. O prontuário importa em sessão autenticada.
const { app, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { montarPacoteDocumental } = require('./exportar-pacote.cjs');
function registrar(getWindow, devUrl) {
  ipcMain.handle('oncoglobal:export', async (event, entrada) => {
    try {
      const win = getWindow();
      const u = new URL(event.senderFrame?.url ?? 'about:blank');
      const origemApp = u.protocol === 'app:' && u.hostname === 'pdfforge';
      const origemDev = devUrl && u.origin === new URL(devUrl).origin;
      if (!win || event.sender !== win.webContents || event.senderFrame !== event.sender.mainFrame || !(origemApp || origemDev)) throw Error('ORIGEM_NAO_AUTORIZADA');
      const pacote = montarPacoteDocumental(entrada);
      const pasta = path.join(app.getPath('userData'), 'oncoglobal-export');
      await fs.mkdir(pasta, { recursive: true });
      const destino = path.join(pasta, `${pacote.pacoteId}.oncoglobal.json`);
      await fs.writeFile(destino, JSON.stringify(pacote), { encoding: 'utf8', flag: 'wx' });
      return { ok: true, caminho: destino, pacoteId: pacote.pacoteId };
    } catch (erro) {
      const codigo = String(erro?.message ?? 'EXPORTACAO_FALHOU');
      return { ok: false, codigo: /^[A-Z_]+$/.test(codigo) ? codigo : 'EXPORTACAO_FALHOU' };
    }
  });
}
module.exports = { registrar };
