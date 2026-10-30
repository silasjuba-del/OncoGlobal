// Chamadas aos provedores de LLM no processo principal (chaves nunca vão ao renderer).
// Claude: SDK oficial @anthropic-ai/sdk. GPT/Grok/Gemini: SDK openai com o endpoint compatível de cada provedor.
const AnthropicModule = require('@anthropic-ai/sdk');
const OpenAIModule = require('openai');
const { getKey } = require('./secrets.cjs');

const Anthropic = AnthropicModule.default ?? AnthropicModule;
const OpenAI = OpenAIModule.default ?? OpenAIModule;
const { toFile } = OpenAIModule;

const OPENAI_COMPAT = {
  gpt: { baseURL: undefined, label: 'OpenAI' },
  grok: { baseURL: 'https://api.x.ai/v1', label: 'xAI' },
  gemini: { baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/', label: 'Google' },
};

// Modelos Claude que aceitam thinking adaptativo + effort (4.6 em diante).
const MODERN_CLAUDE = /^claude-(fable|mythos|opus-(5|4-[678])|sonnet-(5|4-6)|haiku-5)/;
// Modelos com fallback server-side no modo "default".
const FALLBACK_DEFAULT = /^claude-(fable-5-1|opus-5-5|opus-5|sonnet-5-5)$/;

const MOCK = () => process.env.PDFFORGE_LLM_MOCK === '1';

class MissingKeyError extends Error {}

async function requireKey(provider) {
  const key = await getKey(provider);
  if (!key) throw new MissingKeyError(`Chave de API ausente para ${provider}. Configure em Configurações → Chaves.`);
  return key;
}

function toClaudeContent(content) {
  return content.map((b) =>
    b.type === 'image'
      ? { type: 'image', source: { type: 'base64', media_type: b.mediaType, data: b.data } }
      : { type: 'text', text: b.text },
  );
}

function toOpenAIContent(content) {
  if (content.every((b) => b.type === 'text')) return content.map((b) => b.text).join('\n\n');
  return content.map((b) =>
    b.type === 'image'
      ? { type: 'image_url', image_url: { url: `data:${b.mediaType};base64,${b.data}` } }
      : { type: 'text', text: b.text },
  );
}

/**
 * req: { provider, model, system, messages: [{ role, content: [{type:'text',text}|{type:'image',mediaType,data}] }],
 *        effort?, maxTokens? }
 * onText(delta) recebe o texto em streaming. Retorna { text, stopReason, model, usage, note? }.
 */
async function chat(req, onText, signal) {
  if (MOCK()) return mockChat(req, onText, signal);
  if (req.provider === 'claude') return chatClaude(req, onText, signal);
  if (OPENAI_COMPAT[req.provider]) return chatOpenAICompat(req, onText, signal);
  throw new Error(`Provedor desconhecido: ${req.provider}`);
}

async function chatClaude(req, onText, signal) {
  const client = new Anthropic({ apiKey: await requireKey('claude') });
  const model = req.model || 'claude-opus-5-5';
  const params = {
    model,
    max_tokens: req.maxTokens ?? 64000,
    system: req.system || undefined,
    messages: req.messages.map((m) => ({ role: m.role, content: toClaudeContent(m.content) })),
  };
  if (MODERN_CLAUDE.test(model)) {
    params.thinking = { type: 'adaptive' };
    params.output_config = { effort: req.effort || 'high' };
  }
  const useFallback = FALLBACK_DEFAULT.test(model);
  const stream = useFallback
    ? client.beta.messages.stream({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }, { signal })
    : client.messages.stream(params, { signal });
  stream.on('text', (delta) => onText(delta));
  try {
    const final = await stream.finalMessage();
    const text = final.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const note =
      final.stop_reason === 'refusal'
        ? `O modelo recusou a solicitação${final.stop_details?.category ? ` (categoria: ${final.stop_details.category})` : ''}.`
        : final.stop_reason === 'max_tokens'
          ? 'Resposta interrompida pelo limite de tokens.'
          : final.model !== model
            ? `Respondido pelo modelo de fallback ${final.model}.`
            : undefined;
    return { text, stopReason: final.stop_reason, model: final.model, usage: final.usage, note };
  } catch (err) {
    throw friendly(err, 'claude');
  }
}

async function chatOpenAICompat(req, onText, signal) {
  const cfg = OPENAI_COMPAT[req.provider];
  const client = new OpenAI({ apiKey: await requireKey(req.provider), baseURL: cfg.baseURL });
  if (!req.model) throw new Error(`Escolha um modelo para ${cfg.label} em Configurações (botão "Listar modelos").`);
  const messages = [];
  if (req.system) messages.push({ role: 'system', content: req.system });
  for (const m of req.messages) messages.push({ role: m.role, content: toOpenAIContent(m.content) });
  let text = '';
  let finish = null;
  try {
    const stream = await client.chat.completions.create({ model: req.model, messages, stream: true }, { signal });
    for await (const chunk of stream) {
      const choice = chunk.choices?.[0];
      const delta = choice?.delta?.content;
      if (delta) {
        text += delta;
        onText(delta);
      }
      if (choice?.finish_reason) finish = choice.finish_reason;
    }
  } catch (err) {
    throw friendly(err, req.provider);
  }
  return {
    text,
    stopReason: finish,
    model: req.model,
    note: finish === 'length' ? 'Resposta interrompida pelo limite de tokens.' : finish === 'content_filter' ? 'Resposta bloqueada pelo filtro do provedor.' : undefined,
  };
}

async function listModels(provider) {
  if (MOCK()) return [`mock-${provider}-1`, `mock-${provider}-2`];
  try {
    if (provider === 'claude') {
      const client = new Anthropic({ apiKey: await requireKey('claude') });
      const ids = [];
      for await (const m of client.models.list()) ids.push(m.id);
      return ids;
    }
    const cfg = OPENAI_COMPAT[provider];
    if (!cfg) throw new Error(`Provedor desconhecido: ${provider}`);
    const client = new OpenAI({ apiKey: await requireKey(provider), baseURL: cfg.baseURL });
    const ids = [];
    for await (const m of client.models.list()) ids.push(String(m.id).replace(/^models\//, ''));
    return ids.sort();
  } catch (err) {
    throw friendly(err, provider);
  }
}

/** Transcrição de áudio/vídeo (microfone, Reels, Plaud) pela API da OpenAI. */
async function transcribe({ bytes, name, model, language, prompt }) {
  if (MOCK()) return { text: `[transcrição simulada de ${name}, ${bytes.length} bytes]` };
  const client = new OpenAI({ apiKey: await requireKey('gpt') });
  try {
    const file = await toFile(Buffer.from(bytes), name);
    const res = await client.audio.transcriptions.create({
      file,
      model: model || 'whisper-1',
      language: language || undefined,
      // Vocabulário do léxico como contexto (melhora grafia de fármacos e siglas).
      prompt: prompt || undefined,
    });
    return { text: res.text };
  } catch (err) {
    throw friendly(err, 'gpt');
  }
}

function friendly(err, provider) {
  if (err instanceof MissingKeyError) return err;
  if (err?.name === 'AbortError' || /aborted/i.test(String(err?.message))) return new Error('Cancelado.');
  const status = err?.status;
  if (status === 401 || status === 403) return new Error(`Chave inválida ou sem permissão (${provider}).`);
  if (status === 404) return new Error(`Modelo não encontrado em ${provider}. Liste os modelos em Configurações.`);
  if (status === 429) return new Error(`Limite de uso atingido em ${provider}. Tente novamente em instantes.`);
  if (status === 413) return new Error('Conteúdo grande demais para o modelo. Selecione menos páginas ou resuma antes.');
  if (status >= 500) return new Error(`${provider} indisponível no momento (${status}).`);
  return new Error(`${provider}: ${err?.message ?? err}`);
}

async function mockChat(req, onText, signal) {
  const last = req.messages[req.messages.length - 1];
  const textIn = last.content.filter((b) => b.type === 'text').map((b) => b.text).join(' ');
  const images = last.content.filter((b) => b.type === 'image').length;
  const reply = `**[simulado ${req.provider}/${req.model || 'padrão'}]**\n\n- Mensagens: ${req.messages.length}\n- Imagens: ${images}\n- Sistema: ${req.system ? 'sim' : 'não'}\n- Início da entrada: "${textIn.slice(0, 160).replace(/\s+/g, ' ')}"\n\n\`\`\`html\n<!doctype html><title>mock</title><h1>App simulado</h1>\n\`\`\``;
  for (const word of reply.split(/(?<=\s)/)) {
    if (signal?.aborted) throw new Error('Cancelado.');
    onText(word);
    await new Promise((r) => setTimeout(r, 4));
  }
  return { text: reply, stopReason: 'end_turn', model: req.model || 'mock' };
}

module.exports = { chat, listModels, transcribe };
