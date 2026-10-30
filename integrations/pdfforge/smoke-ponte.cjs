// Electron real, userData temporário sintético, sem chaves ou provedores reais.
const { app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { createHash } = require('node:crypto');
// O teste não exige GPU; evita dependência do driver gráfico da estação Windows.
app.disableHardwareAcceleration();
const destino = process.env.PDFFORGE_SMOKE_ROOT || process.argv[2];
const raiz = path.resolve(destino || '');
if (!destino || !fs.existsSync(path.join(raiz, 'electron/services/oncoglobal-export.cjs'))) throw Error('COPIA_COM_PONTE_OBRIGATORIA');
const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfforge-m123-smoke-'));
app.setPath('userData', dados);
process.env.PDFFORGE_LLM_MOCK = '1';
let concluido = false;
const prazo = setTimeout(() => { console.error('SMOKE_PONTE_TIMEOUT'); app.exit(1); }, 45000);
app.on('browser-window-created', (_event, win) => {
  win.hide();
  win.webContents.once('did-finish-load', async () => {
    if (concluido) return;
    try {
      const { PDFDocument, StandardFonts } = require(path.join(raiz, 'node_modules/@cantoo/pdf-lib'));
      const doc = await PDFDocument.create(), font = await doc.embedFont(StandardFonts.Helvetica);
      doc.addPage().drawText('Documento SINTETICO M123; nega febre. A CONFERIR.', { x: 30, y: 700, font, size: 12 });
      const bytes = Buffer.from(await doc.save()), b64 = bytes.toString('base64');
      await win.webContents.executeJavaScript(`(async () => {
        const esperar = async (predicado) => { for(let i=0;i<100;i++){if(predicado())return;await new Promise(r=>setTimeout(r,100));}throw Error('UI_SINTETICA_INDISPONIVEL'); };
        await esperar(()=>document.querySelector('.app'));
        const bytes=Uint8Array.from(atob(${JSON.stringify(b64)}),c=>c.charCodeAt(0));
        const dt=new DataTransfer();dt.items.add(new File([bytes],'documento-SINTETICO.pdf',{type:'application/pdf'}));
        for(const tipo of ['dragover','drop'])document.querySelector('.app').dispatchEvent(new DragEvent(tipo,{bubbles:true,cancelable:true,dataTransfer:dt}));
        const ativo=()=>document.querySelector('.tab-panel:not([hidden])');
        await esperar(()=>ativo()?.querySelector('[aria-label="Autor da exportação"]'));
        await esperar(()=>ativo()?.querySelector('[aria-label="Nova anotação"]'));
        const nota=ativo().querySelector('[aria-label="Nova anotação"]');
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(nota,'Anotacao SINTETICA vinculada aos bytes.');
        nota.dispatchEvent(new Event('input',{bubbles:true}));
        await esperar(()=>[...ativo().querySelectorAll('button')].some(b=>b.textContent.trim()==='Anotar'&&!b.disabled));
        [...ativo().querySelectorAll('button')].find(b=>b.textContent.trim()==='Anotar').click();
        await esperar(()=>ativo().querySelector('.notes')?.textContent.includes('Anotacao SINTETICA vinculada aos bytes.'));
        const input=ativo().querySelector('[aria-label="Autor da exportação"]');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Autor SINTETICO');
        input.dispatchEvent(new Event('input',{bubbles:true}));
        await esperar(()=>[...ativo().querySelectorAll('button')].some(b=>b.textContent.includes('Enviar ao OncoGlobal')&&!b.disabled));
        [...ativo().querySelectorAll('button')].find(b=>b.textContent.includes('Enviar ao OncoGlobal')).click();
        await esperar(()=>ativo().textContent.includes('Pacote local salvo em'));
        return true;
      })()`);
      const arquivos = fs.readdirSync(path.join(dados, 'oncoglobal-export'));
      if (arquivos.length !== 1) throw Error('PACOTE_UNICO_NAO_COMPROVADO');
      const pacote = JSON.parse(fs.readFileSync(path.join(dados, 'oncoglobal-export', arquivos[0]), 'utf8'));
      if (pacote.schema !== 'oncoglobal.import.v1' || pacote.autor !== 'Autor SINTETICO'
        || pacote.original.sha256 !== createHash('sha256').update(bytes).digest('hex')
        || !Buffer.from(pacote.original.bytesBase64, 'base64').equals(bytes)
        || pacote.anotacoes.length !== 1 || pacote.anotacoes[0].texto !== 'Anotacao SINTETICA vinculada aos bytes.') throw Error('PACOTE_DIVERGENTE');
      concluido = true; clearTimeout(prazo);
      console.log(JSON.stringify({ prova: 'PDFFORGE_UI_IPC_EXPORT_REAL', ok: true, pacoteId: pacote.pacoteId, sha256: pacote.original.sha256, userDataSintetico: dados }));
      app.exit(0);
    } catch (error) { clearTimeout(prazo); console.error(error); app.exit(1); }
  });
});
require(path.join(raiz, 'electron/main.cjs'));
