// Transcrição com léxico: vocabulário como contexto do motor + correções "errado => certo" no resultado.
import { getState } from '../store/store';
import { transcribe, transcribePath } from './bridge';
import { applyLexicon, parseLexicon, transcriptionPrompt } from './lexicon';

function lexicon() {
  return parseLexicon(getState().settings.ai.lexicon);
}

export async function transcribeBytes(bytes: Uint8Array, name: string): Promise<string> {
  const lex = lexicon();
  const { text } = await transcribe(bytes, name, getState().settings.ai.transcribeModel, transcriptionPrompt(lex));
  return applyLexicon(text, lex);
}

export async function transcribeFile(path: string): Promise<string> {
  const lex = lexicon();
  const { text } = await transcribePath(path, getState().settings.ai.transcribeModel, transcriptionPrompt(lex));
  return applyLexicon(text, lex);
}
