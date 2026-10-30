// Plugins de intercâmbio: Word (.docx), pastas sincronizadas (Google Drive / Plaud), WhatsApp e biblioteca local.
const { app, dialog, shell } = require('electron');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs/promises');
const { Document, Packer, Paragraph, HeadingLevel, TextRun } = require('docx');
const mammoth = require('mammoth');

const TEXT_EXT = ['.txt', '.md', '.srt', '.vtt', '.json', '.csv'];
const AUDIO_EXT = ['.mp3', '.m4a', '.wav', '.ogg', '.webm', '.mp4', '.mpeg', '.mpga'];

// ---------- Word ----------

/** Converte markdown simples (títulos, listas, negrito) em parágrafos do Word. */
function markdownToParagraphs(markdown) {
  const out = [];
  let inCode = false;
  for (const raw of String(markdown).split(/\r?\n/)) {
    if (raw.trim().startsWith('```')) {
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      out.push(new Paragraph({ children: [new TextRun({ text: raw, font: 'Consolas', size: 18 })] }));
      continue;
    }
    const h = raw.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4][h[1].length - 1];
      out.push(new Paragraph({ heading: level, children: inlineRuns(h[2]) }));
      continue;
    }
    const li = raw.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (li) {
      out.push(new Paragraph({ bullet: { level: raw.match(/^\s*/)[0].length >= 2 ? 1 : 0 }, children: inlineRuns(li[1]) }));
      continue;
    }
    out.push(new Paragraph({ children: inlineRuns(raw) }));
  }
  return out;
}

function inlineRuns(text) {
  return String(text)
    .split(/(\*\*[^*]+\*\*)/)
    .filter(Boolean)
    .map((part) => (part.startsWith('**') ? new TextRun({ text: part.slice(2, -2), bold: true }) : new TextRun(part)));
}

async function wordExport(win, { name, title, markdown }) {
  const doc = new Document({
    creator: 'PDFForge',
    title: title || name,
    sections: [{ children: [...(title ? [new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(title)] })] : []), ...markdownToParagraphs(markdown)] }],
  });
  const buffer = await Packer.toBuffer(doc);
  const res = await dialog.showSaveDialog(win, { defaultPath: name.endsWith('.docx') ? name : `${name}.docx`, filters: [{ name: 'Word', extensions: ['docx'] }] });
  if (res.canceled || !res.filePath) return null;
  await fs.writeFile(res.filePath, buffer);
  return res.filePath;
}

async function wordToBuffer({ title, markdown }) {
  const doc = new Document({ creator: 'PDFForge', title, sections: [{ children: markdownToParagraphs(markdown) }] });
  return Packer.toBuffer(doc);
}

async function wordImport(win) {
  const res = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'], filters: [{ name: 'Word', extensions: ['docx'] }] });
  if (res.canceled) return [];
  return Promise.all(
    res.filePaths.map(async (p) => ({ name: path.basename(p), path: p, text: (await mammoth.extractRawText({ path: p })).value })),
  );
}

// ---------- Pastas (Google Drive para Desktop, exportações do Plaud) ----------

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function detectDrive() {
  const home = os.homedir();
  const candidates = [];
  for (const letter of 'GHIJKLMNOPQRSTUVWXYZ') candidates.push(`${letter}:\\Meu Drive`, `${letter}:\\My Drive`);
  candidates.push(path.join(home, 'Google Drive'), path.join(home, 'Meu Drive'), path.join(home, 'My Drive'));
  for (const c of candidates) if (await exists(c)) return c;
  return null;
}

async function pickFolder(win, title) {
  const res = await dialog.showOpenDialog(win, { title, properties: ['openDirectory', 'createDirectory'] });
  return res.canceled ? null : res.filePaths[0];
}

async function listFolder(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    const ext = path.extname(e.name).toLowerCase();
    const kind = ext === '.pdf' ? 'pdf' : ext === '.docx' ? 'docx' : TEXT_EXT.includes(ext) ? 'text' : AUDIO_EXT.includes(ext) ? 'audio' : null;
    if (!kind) continue;
    const st = await fs.stat(path.join(dir, e.name));
    files.push({ name: e.name, path: path.join(dir, e.name), kind, size: st.size, mtime: st.mtimeMs });
  }
  return files.sort((a, b) => b.mtime - a.mtime);
}

function srtToText(srt) {
  return srt
    .replace(/\r/g, '')
    .split(/\n\n+/)
    .map((block) => {
      const lines = block.split('\n').filter((l) => !/^\d+$/.test(l.trim()) && !/-->/.test(l) && l.trim() !== 'WEBVTT');
      const time = block.match(/(\d{2}):(\d{2}):(\d{2})/);
      const text = lines.join(' ').trim();
      return text ? `${time ? `[${time[2]}:${time[3]}] ` : ''}${text}` : '';
    })
    .filter(Boolean)
    .join('\n');
}

/** Lê um arquivo de pasta: texto (txt/md/srt/vtt), docx (texto) ou bytes (pdf/áudio). */
async function readFolderFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const name = path.basename(filePath);
  if (ext === '.docx') return { name, path: filePath, kind: 'docx', text: (await mammoth.extractRawText({ path: filePath })).value };
  if (ext === '.srt' || ext === '.vtt') return { name, path: filePath, kind: 'text', text: srtToText(await fs.readFile(filePath, 'utf8')) };
  if (TEXT_EXT.includes(ext)) return { name, path: filePath, kind: 'text', text: await fs.readFile(filePath, 'utf8') };
  const bytes = new Uint8Array(await fs.readFile(filePath));
  return { name, path: filePath, kind: ext === '.pdf' ? 'pdf' : 'audio', bytes };
}

async function writeFolderFile(dir, name, content) {
  await fs.mkdir(dir, { recursive: true });
  const safe = name.replace(/[<>:"/\\|?*]/g, '_');
  let target = path.join(dir, safe);
  const { name: base, ext } = path.parse(target);
  for (let i = 1; await exists(target); i++) target = path.join(dir, `${base} (${i})${ext}`);
  await fs.writeFile(target, typeof content === 'string' ? content : Buffer.from(content));
  return target;
}

// ---------- WhatsApp ----------

async function shareWhatsApp(text) {
  if (text.length > 3500) throw Error('Texto longo: exporte o arquivo completo para compartilhar sem perder fontes.');
  const encoded = encodeURIComponent(text);
  try {
    await shell.openExternal(`whatsapp://send?text=${encoded}`);
    return 'desktop';
  } catch {
    await shell.openExternal(`https://wa.me/?text=${encoded}`);
    return 'web';
  }
}

// ---------- Biblioteca (Memo-RAG) ----------

const libraryFile = () => path.join(app.getPath('userData'), 'pdfforge-library.json');

const { createJsonStore } = require('./json-store.cjs');
let libraryStore;
const store = () => libraryStore ??= createJsonStore(libraryFile());
const libraryGet = () => store().read();
const librarySet = value => store().write(value);
const libraryWritesPending = () => store().pending();
const flushLibrary = () => store().idle();

module.exports = {
  libraryWritesPending, flushLibrary,
  wordExport,
  wordImport,
  wordToBuffer,
  markdownToParagraphs,
  detectDrive,
  pickFolder,
  listFolder,
  readFolderFile,
  writeFolderFile,
  srtToText,
  shareWhatsApp,
  libraryGet,
  librarySet,
};
