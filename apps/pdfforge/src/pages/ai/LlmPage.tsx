import { answerWithSources, appendSourceContext } from '../../ai/answerSources';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useActions, type ChatInit } from '../../app/actions';
import { approxTokens, docsText, imageBlocks, type Attachment } from '../../ai/attachments';
import { aiAvailable, chatStream, keyStatus, providerInfo, type ChatBlock, type ChatMessage, type KeyStatus, type Provider } from '../../ai/bridge';
import { allTemplates, docTitle, searchLibrary, useLibrary } from '../../ai/library';
import { fillTemplate } from '../../ai/prompts';
import { RAG_SYSTEM } from '../../ai/rag';
import { toDrive, toFile, toLibrary, toWhatsApp, toWord } from '../../ai/share';
import { Markdown } from '../../components/Markdown';
import { MicButton } from '../../components/MicButton';
import { setAi, useAppState } from '../../store/store';
import { SiteView } from './SiteView';
import { SourcesPanel } from './SourcesPanel';

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  /** Texto exibido na conversa. */
  display: string;
  /** Conteúdo efetivamente enviado ao modelo (com documentos/trechos). */
  blocks: ChatBlock[];
  chips?: string[];
  meta?: string;
  sourceSnapshot?: string;
  error?: boolean;
  streaming?: boolean;
}

const SYSTEM =
  'Você é o assistente do PDFForge. Responda em português do Brasil, de forma objetiva e verificável. ' +
  'Ao usar documentos anexados, cite a página como [p. N]. Não invente dados; quando algo faltar ou houver conflito, escreva "A CONFERIR". ' +
  'Quando pedirem um app ou protótipo, entregue um único arquivo HTML autocontido em bloco ```html.';

let msgSeq = 0;
const mid = () => `m${++msgSeq}`;

export function LlmPage({ provider, init, initSeq }: { provider: Provider; init?: ChatInit; initSeq?: number }) {
  const info = providerInfo(provider);
  const { settings } = useAppState();
  const mode = settings.ai.modes[provider];
  const [keys, setKeys] = useState<KeyStatus | null>(null);

  useEffect(() => {
    void keyStatus().then(setKeys);
  }, []);

  return (
    <div className="llm">
      <header className="llm-head">
        <span className="llm-badge" style={{ background: info.color }}>
          {info.name[0]}
        </span>
        <div>
          <h1>{info.name}</h1>
          <span className="muted small">{info.vendor}</span>
        </div>
        <div className="segmented llm-mode" role="radiogroup" aria-label="Modo">
          {(['api', 'site'] as const).map((m) => (
            <button key={m} role="radio" aria-checked={mode === m} className={mode === m ? 'on' : ''} onClick={() => setAi({ modes: { ...settings.ai.modes, [provider]: m } })}>
              {m === 'api' ? 'API (integrado)' : 'Site (assinatura)'}
            </button>
          ))}
        </div>
      </header>
      {mode === 'site' ? (
        <SiteView url={info.site} partition={`persist:site-${provider}`} name={info.name} />
      ) : (
        <Chat provider={provider} init={init} initSeq={initSeq} keys={keys} />
      )}
    </div>
  );
}

function Chat({ provider, init, initSeq, keys }: { provider: Provider; init?: ChatInit; initSeq?: number; keys: KeyStatus | null }) {
  const actions = useActions();
  const { settings } = useAppState();
  const lib = useLibrary();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const sourceEntries = useRef<readonly string[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [input, setInput] = useState('');
  const [promptId, setPromptId] = useState('');
  const [skillOpen, setSkillOpen] = useState(false);
  const [useRag, setUseRag] = useState(false);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<() => void>(() => {});
  const endRef = useRef<HTMLDivElement>(null);
  const model = settings.ai.models[provider];
  const templates = useMemo(() => allTemplates('prompt'), [lib.prompts]);
  const prompt = templates.find((t) => t.id === promptId);

  useEffect(() => {
    if (!init) return;
    if (init.attachments?.length) setAttachments((a) => [...a, ...init.attachments!]);
    if (init.promptId) setPromptId(init.promptId);
    if (init.text) setInput(init.text);
    // Reaplica apenas quando chega um novo pedido de abertura (initSeq).
  }, [initSeq]);

  useEffect(() => {
    // Sem retorno: scrollIntoView devolve Promise no Chromium recente, e o React a trataria como cleanup.
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [msgs]);

  const missingKey = keys?.[provider] === 'missing';
  const pendingChars = attachments.reduce((s, a) => s + (a.text?.length ?? 0), 0);

  const send = (override?: { text: string; display: string; chips?: string[] }) => {
    if (busy) return;
    let userText: string;
    let display: string;
    let chips = attachments.map((a) => a.name);
    let system = SYSTEM;
    let contextSources = appendSourceContext(sourceEntries.current, [], docTitle);
    if (override) {
      userText = override.text;
      display = override.display;
      chips = override.chips ?? [];
    } else {
      const { documento, titulo } = docsText(attachments);
      if (prompt) userText = fillTemplate(prompt.template, { documento, titulo, entrada: input, selecao: input });
      else userText = (documento ? `--- DOCUMENTOS ANEXADOS: ${titulo} ---\n${documento}\n--- FIM DOS DOCUMENTOS ---\n\n` : '') + input;
      display = prompt ? `**${prompt.name}**${input ? `\n\n${input}` : ''}` : input;
      if (useRag) {
        const hits = searchLibrary(input || prompt?.name || titulo, 8);
        if (hits.length) {
          contextSources = appendSourceContext(sourceEntries.current, hits, docTitle);
          userText = `Trechos da biblioteca:\n${contextSources.current}\n\n---\n${userText}`;
          system = `${SYSTEM}\n\n${RAG_SYSTEM}`;
          chips = [...chips, `biblioteca: ${hits.length} trechos`];
        } else chips = [...chips, 'biblioteca: nada encontrado'];
      }
    }
    if (!userText.trim() && !attachments.some((a) => a.kind === 'image')) return;
    sourceEntries.current = contextSources.entries;
    const sourceSnapshot = contextSources.snapshot;
    const blocks: ChatBlock[] = [...(override ? [] : imageBlocks(attachments)), { type: 'text', text: userText || 'Analise as imagens anexadas.' }];
    const userMsg: Msg = { id: mid(), role: 'user', display: display || '(anexos)', blocks, chips };
    const botMsg: Msg = { id: mid(), role: 'assistant', display: '', blocks: [], streaming: true, sourceSnapshot };
    const history: ChatMessage[] = [...msgs.filter((m) => !m.error && m.blocks.length), userMsg].map((m) => ({ role: m.role, content: m.blocks }));
    setMsgs((cur) => [...cur, userMsg, botMsg]);
    if (!override) {
      setInput('');
      setAttachments([]);
      setPromptId('');
    }
    setBusy(true);
    let acc = '';
    const { done, abort } = chatStream({ provider, model, system, messages: history, effort: settings.ai.effort }, (delta) => {
      acc += delta;
      setMsgs((cur) => cur.map((m) => (m.id === botMsg.id ? { ...m, display: acc } : m)));
    });
    abortRef.current = abort;
    done
      .then((r) => setMsgs((cur) => cur.map((m) => (m.id === botMsg.id ? { ...m, display: r.text || acc, blocks: [{ type: 'text', text: r.text || acc }], streaming: false, meta: [r.model, r.note].filter(Boolean).join(' · ') } : m))))
      .catch((e: Error) => setMsgs((cur) => cur.map((m) => (m.id === botMsg.id ? { ...m, display: acc ? `${acc}\n\n— ${e.message}` : e.message, streaming: false, error: true } : m))))
      .finally(() => setBusy(false));
  };

  const titleOf = (m: Msg) => {
    const idx = msgs.indexOf(m);
    const q = msgs[idx - 1]?.display.replace(/\*\*/g, '').split('\n')[0] ?? 'Resposta';
    return `${providerInfo(provider).name} — ${q.slice(0, 60)}`;
  };

  return (
    <div className="chat-layout">
      <div className="chat-main">
        {!aiAvailable() && <div className="notice">A conversa por API funciona no app desktop (npm run dev). Aqui, use o modo Site.</div>}
        {aiAvailable() && missingKey && (
          <div className="notice">
            Sem chave de API para {providerInfo(provider).name}.{' '}
            <button className="link" onClick={() => actions.openAiTab('settings')}>
              Configurar chave
            </button>{' '}
            ou use o modo Site.
          </div>
        )}
        {provider !== 'claude' && !model && aiAvailable() && (
          <div className="notice">
            Escolha o modelo em{' '}
            <button className="link" onClick={() => actions.openAiTab('settings')}>
              Configurações → Modelos
            </button>
            .
          </div>
        )}
        <div className="messages" aria-live="polite">
          {msgs.length === 0 && (
            <div className="chat-empty">
              <h2>Converse com {providerInfo(provider).name} sobre seus PDFs</h2>
              <p className="muted">Anexe fontes à direita, escolha um prompt da biblioteca ou dite pelo microfone.</p>
            </div>
          )}
          {msgs.map((m) => (
            <div key={m.id} className={`msg msg-${m.role} ${m.error ? 'msg-error' : ''}`}>
              {m.chips && m.chips.length > 0 && (
                <div className="msg-chips">
                  {m.chips.map((c) => (
                    <span key={c} className="chip static">
                      {c}
                    </span>
                  ))}
                </div>
              )}
              {m.role === 'assistant' ? (
                <Markdown
                  text={m.display || (m.streaming ? '…' : '')}
                  codeActions={[{ label: 'Salvar arquivo', onClick: (code, lang) => void toFile(titleOf(m), code, lang === 'html' ? 'html' : lang || 'txt') }]}
                />
              ) : (
                <Markdown text={m.display} />
              )}
              {m.sourceSnapshot && <details><summary>Fontes desta resposta</summary><pre style={{ whiteSpace: 'pre-wrap' }}>{m.sourceSnapshot}</pre></details>}
              {m.role === 'assistant' && !m.streaming && !m.error && (
                <div className="msg-actions">
                  <button className="link" onClick={() => navigator.clipboard.writeText(answerWithSources(m))}>
                    Copiar
                  </button>
                  <button className="link" onClick={() => toWord(titleOf(m), answerWithSources(m), actions.toast)}>
                    Word
                  </button>
                  <button className="link" onClick={() => toDrive(titleOf(m), answerWithSources(m), actions.toast)}>
                    Drive
                  </button>
                  <button className="link" onClick={() => toWhatsApp(answerWithSources(m), actions.toast)}>
                    WhatsApp
                  </button>
                  <button className="link" onClick={() => toLibrary(titleOf(m), answerWithSources(m), 'resposta', actions.toast)}>
                    + Biblioteca
                  </button>
                  {m.meta && <span className="muted small">{m.meta}</span>}
                </div>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <div className="composer">
          {skillOpen && <SkillBox onApply={(text, display) => send({ text, display })} />}
          <form
            className="composer-box"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            {attachments.length > 0 && (
              <div className="att-row">
                {attachments.map((a) => (
                  <span key={a.id} className="att" title={a.text ? `${a.text.length.toLocaleString('pt-BR')} caracteres` : a.name}>
                    {a.image && <img src={a.image.preview} alt="" />}
                    {a.name}
                    {a.pages ? ` · ${a.pages} p.` : ''}
                    <button type="button" aria-label={`Remover ${a.name}`} onClick={() => setAttachments((l) => l.filter((x) => x.id !== a.id))}>
                      ×
                    </button>
                  </span>
                ))}
                {pendingChars > 0 && <span className="muted small">≈ {approxTokens(pendingChars).toLocaleString('pt-BR')} tokens</span>}
              </div>
            )}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={3}
              placeholder={prompt ? `${prompt.name}: instrução complementar (opcional)` : `Pergunte ao ${providerInfo(provider).name}… Enter envia · Shift+Enter quebra linha`}
              aria-label="Mensagem"
            />
            <div className="composer-bar">
              <select className="composer-select" value={promptId} onChange={(e) => setPromptId(e.target.value)} aria-label="Prompt da biblioteca">
                <option value="">Prompt livre</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={`chip ${useRag ? 'on' : ''}`}
                aria-pressed={useRag}
                onClick={() => setUseRag((v) => !v)}
                title="Buscar trechos na biblioteca e responder com citações"
              >
                Biblioteca
              </button>
              <button type="button" className={`chip ${skillOpen ? 'on' : ''}`} aria-pressed={skillOpen} onClick={() => setSkillOpen((v) => !v)}>
                Skill de texto
              </button>
              <MicButton onText={(t) => setInput((v) => (v ? `${v} ${t}` : t))} onError={(m) => actions.toast(m, 'error')} />
              <span className="composer-spacer" />
              {busy ? (
                <button type="button" className="btn btn-sm" onClick={() => abortRef.current()}>
                  Parar
                </button>
              ) : (
                <button className="btn btn-sm btn-primary composer-send" disabled={!input.trim() && !prompt && attachments.length === 0} aria-label="Enviar">
                  Enviar ↵
                </button>
              )}
            </div>
          </form>
          <p className="privacy muted small">
            {prompt ? `${prompt.description} · ` : ''}O conteúdo vai para {providerInfo(provider).vendor}; evite dados identificáveis de pacientes sem base legal e contrato.
          </p>
        </div>
      </div>
      <aside className="chat-side">
        <h2>Fontes</h2>
        <SourcesPanel onAdd={(a) => setAttachments((l) => [...l, ...a])} toast={actions.toast} />
        {msgs.length > 0 && (
          <button className="btn btn-sm btn-ghost" onClick={() => { setMsgs([]); sourceEntries.current = []; }}>
            Nova conversa
          </button>
        )}
      </aside>
    </div>
  );
}

/** Entrada de skill: aplica uma transformação de texto (corrigir, traduzir, simplificar…) ao trecho colado. */
function SkillBox({ onApply }: { onApply(text: string, display: string): void }) {
  const lib = useLibrary();
  const skills = useMemo(() => allTemplates('skill'), [lib.prompts]);
  const [skillId, setSkillId] = useState(skills[0]?.id ?? '');
  const [text, setText] = useState('');
  const [extra, setExtra] = useState('');
  const skill = skills.find((s) => s.id === skillId);
  return (
    <div className="skill-box">
      <div className="row">
        <select value={skillId} onChange={(e) => setSkillId(e.target.value)} aria-label="Skill">
          {skills.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input type="text" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Instrução extra (opcional)" aria-label="Instrução extra" />
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="Cole aqui o texto a modificar" aria-label="Texto para a skill" />
      <button
        className="btn btn-sm btn-primary"
        disabled={!text.trim() || !skill}
        onClick={() => {
          onApply(fillTemplate(skill!.template, { selecao: text, entrada: extra }), `**Skill: ${skill!.name}**\n\n${text.slice(0, 400)}${text.length > 400 ? '…' : ''}`);
          setText('');
        }}
      >
        Aplicar skill
      </button>
    </div>
  );
}
