// Ações de intercâmbio sobre um texto gerado: Word, Google Drive, WhatsApp, biblioteca, arquivo.
import { saveFile } from '../platform/platform';
import { getState } from '../store/store';
import { hasDesktopAi, shareWhatsApp, wordExport, writeFolderFile } from './bridge';
import { addDoc, type DocKind } from './library';

type Toast = (msg: string, kind?: 'info' | 'error' | 'success') => void;

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\w-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
    .replace(/^-|-$/g, '') || 'pdfforge';

export async function toWord(title: string, markdown: string, toast: Toast) {
  if (!hasDesktopAi()) {
    await saveFile(`${slug(title)}.md`, new TextEncoder().encode(markdown));
    toast('No navegador o Word não está disponível; salvo como .md.', 'info');
    return;
  }
  try {
    const p = await wordExport(slug(title), markdown, title);
    if (p) toast(`Word salvo em ${p}`, 'success');
  } catch (e) {
    toast((e as Error).message, 'error');
  }
}

export async function toDrive(title: string, markdown: string, toast: Toast, asDocx = false) {
  const dir = getState().settings.ai.driveFolder;
  if (!dir) {
    toast('Defina a pasta do Google Drive em Configurações → Plugins.', 'error');
    return;
  }
  try {
    const p = await writeFolderFile(`${dir}\\PDFForge`, `${slug(title)}.${asDocx ? 'docx' : 'md'}`, markdown, asDocx);
    toast(`Salvo no Drive: ${p}`, 'success');
  } catch (e) {
    toast((e as Error).message, 'error');
  }
}

export async function toWhatsApp(text: string, toast: Toast) {
  try {
    const where = await shareWhatsApp(text);
    toast(where === 'desktop' ? 'WhatsApp aberto com o texto — escolha o contato.' : 'WhatsApp Web aberto com o texto.', 'success');
  } catch (e) {
    toast((e as Error).message, 'error');
  }
}

export function toLibrary(title: string, text: string, kind: DocKind, toast: Toast, source?: string) {
  const doc = addDoc(title, kind, [{ text }], source);
  toast(`"${doc.title}" adicionado à biblioteca (${doc.chunks.length} trechos).`, 'success');
}

export async function toFile(title: string, text: string, ext = 'md') {
  await saveFile(`${slug(title)}.${ext}`, new TextEncoder().encode(text));
}
