// Página "Nova aba": omnibox (endereço, busca na web, pergunta à IA e busca local), apps, continuar de onde parou.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useActions, type AiTabKind } from '../app/actions';
import { filterCommands, useCommands, type Command } from '../app/commands';
import { PROVIDERS, type Provider } from '../ai/bridge';
import { textAttachment } from '../ai/attachments';
import { docText, useLibrary } from '../ai/library';
import { IconMore, IconSearch, Logo } from '../components/icons';
import { ToolIcon } from '../components/ToolIcon';
import { readPath, showInFolder } from '../platform/platform';
import { removeRecent, useAppState, type RecentFile } from '../store/store';
import { TOOLS, toolById } from '../tools/catalog';
import type { ToolDef } from '../tools/types';
import { normalizeUrl } from './BrowserPage';

const looksLikeUrl = (v: string) => /^(https?:\/\/|localhost|127\.0\.0\.1)/i.test(v) || /^[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/.test(v);

interface Suggestion {
  id: string;
  label: string;
  hint: string;
  run(): void;
}

interface SuggestionSources {
  /** Presente só quando o texto parece um endereço (ex.: pubmed.gov, localhost:5173). */
  url: Suggestion | null;
  web: Suggestion;
  ai: Suggestion;
  /** Telas, ferramentas, recentes, biblioteca, prompts e apps que casam com o texto (já ordenados). */
  local: Suggestion[];
}

/**
 * Ordem das sugestões da omnibox: a primeira é o que o Enter executa.
 * TODO(human): decidir a política de ordenação (ver pedido "Learn by Doing").
 * Comportamento atual (provisório): endereço → web → IA → resultados locais.
 */
function rankSuggestions(query: string, s: SuggestionSources): Suggestion[] {
  void query;
  return [...(s.url ? [s.url] : []), s.web, s.ai, ...s.local];
}

function Omnibox() {
  const actions = useActions();
  const { settings } = useAppState();
  const cmds = useCommands();
  const [q, setQ] = useState('');
  const [index, setIndex] = useState(0);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ctrl+L (atalho global) foca a omnibox.
  useEffect(() => {
    const focus = () => inputRef.current?.focus();
    window.addEventListener('pdfforge:focus-omnibox', focus);
    return () => window.removeEventListener('pdfforge:focus-omnibox', focus);
  }, []);

  const suggestions = useMemo<Suggestion[]>(() => {
    const v = q.trim();
    if (!v) return [];
    return rankSuggestions(v, {
      url: looksLikeUrl(v) ? { id: 'go', label: v, hint: 'Abrir endereço', run: () => actions.openWeb(normalizeUrl(v, settings.ui.homeUrl)) } : null,
      web: { id: 'web', label: v, hint: 'Pesquisar na web', run: () => actions.openWeb(`https://www.google.com/search?q=${encodeURIComponent(v)}`) },
      ai: { id: 'ai', label: v, hint: 'Perguntar ao Claude', run: () => actions.openLlm('claude', { text: v }) },
      local: filterCommands(cmds, v, 6).map((c: Command) => ({ id: c.id, label: c.label, hint: `${c.group}${c.hint ? ` · ${c.hint}` : ''}`, run: c.run })),
    });
  }, [q, cmds, actions, settings.ui.homeUrl]);

  useEffect(() => setIndex(0), [q]);

  const go = (s?: Suggestion) => {
    if (!s) return;
    s.run();
    setQ('');
  };

  const open = focused && suggestions.length > 0;
  return (
    <div className={`omnibox ${open ? 'open' : ''}`}>
      <form
        className="omnibox-field"
        onSubmit={(e) => {
          e.preventDefault();
          go(suggestions[index]);
        }}
      >
        <IconSearch />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setIndex((i) => Math.min(suggestions.length - 1, i + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setIndex((i) => Math.max(0, i - 1));
            } else if (e.key === 'Escape') setQ('');
          }}
          placeholder="Digite um endereço, pesquise na web, pergunte à IA ou ache uma ferramenta"
          aria-label="Endereço, pesquisa ou pergunta"
          role="combobox"
          aria-expanded={open}
          aria-controls="omnibox-list"
          aria-activedescendant={open ? `sug-${suggestions[index]?.id}` : undefined}
          spellCheck={false}
        />
        <kbd>Ctrl L</kbd>
      </form>
      {open && (
        <ul id="omnibox-list" className="omnibox-list" role="listbox">
          {suggestions.map((s, i) => (
            <li
              key={s.id}
              id={`sug-${s.id}`}
              role="option"
              aria-selected={i === index}
              className={i === index ? 'on' : ''}
              onMouseDown={(e) => {
                e.preventDefault();
                go(s);
              }}
              onMouseMove={() => setIndex(i)}
            >
              <span className="omni-label">{s.label}</span>
              <span className="omni-hint">{s.hint}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function launch(actions: ReturnType<typeof useActions>, target: string) {
  if (!target.startsWith('app:')) return actions.openWeb(target);
  const dest = target.slice(4);
  if (PROVIDERS.some((p) => p.id === dest)) actions.openLlm(dest as Provider);
  else actions.openAiTab(dest as AiTabKind);
}

export function StartPage({ onAllTools, onHistory }: { onAllTools(): void; onHistory(): void }) {
  const actions = useActions();
  const { recents, toolUsage, settings } = useAppState();
  const lib = useLibrary();
  const recentTools = useMemo(() => {
    const used = Object.entries(toolUsage)
      .sort((a, b) => b[1].lastUse - a[1].lastUse)
      .map(([id]) => toolById(id))
      .filter((t): t is ToolDef => Boolean(t && t.status === 'ready'));
    const fill = TOOLS.filter((t) => ['edit', 'merge', 'compress', 'ocr', 'pdf-to-md', 'split', 'html-to-pdf', 'pdf-to-jpg'].includes(t.id));
    return [...used, ...fill.filter((t) => !used.includes(t))].slice(0, 8);
  }, [toolUsage]);

  const reopen = async (r: RecentFile) => {
    const f = r.path ? await readPath(r.path) : null;
    if (f) actions.openViewer(f);
    else {
      actions.toast(r.path ? `Não encontrei "${r.name}".` : 'Arquivo aberto sem caminho no disco; abra-o novamente.', 'error');
      if (r.path) removeRecent(r.key);
    }
  };

  return (
    <div className="start">
      <div className="start-hero">
        <Logo width={40} height={40} />
        <h1>{settings.ui.appName}</h1>
      </div>
      <Omnibox />
      <div className="start-apps" aria-label="Apps">
        {settings.ui.launcher.map((l) => (
          <button key={l.id} className="start-app" onClick={() => launch(actions, l.target)} title={l.target}>
            <span className="launcher-icon" style={{ background: l.color }}>
              {l.name.slice(0, 1).toUpperCase()}
            </span>
            <span>{l.name}</span>
          </button>
        ))}
      </div>

      <div className="start-grid">
        <section className="start-card">
          <header>
            <h2>Continuar</h2>
            <button className="btn btn-sm btn-primary" onClick={() => actions.pickAndOpen()}>
              Abrir PDF
            </button>
          </header>
          {recents.length === 0 ? (
            <p className="start-empty">Abra ou arraste um PDF para começar. Ele aparecerá aqui.</p>
          ) : (
            <ul className="start-list">
              {recents.slice(0, 6).map((r) => (
                <RecentRow key={r.key} file={r} onOpen={() => reopen(r)} />
              ))}
            </ul>
          )}
          <button className="link start-more" onClick={onHistory}>
            Histórico de tarefas
          </button>
        </section>

        <section className="start-card">
          <header>
            <h2>Ferramentas</h2>
            <button className="link" onClick={onAllTools}>
              Ver todas
            </button>
          </header>
          <div className="start-tools">
            {recentTools.map((t) => (
              <button key={t.id} className="start-tool" onClick={() => actions.openTool(t.id)} title={t.description}>
                <ToolIcon tool={t} size={34} />
                <span>{t.name}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="start-card">
          <header>
            <h2>Biblioteca</h2>
            <button className="link" onClick={() => actions.openAiTab('library')}>
              Abrir
            </button>
          </header>
          {lib.docs.length === 0 ? (
            <p className="start-empty">PDFs, transcrições e respostas que você guardar ficam pesquisáveis aqui.</p>
          ) : (
            <ul className="start-list">
              {lib.docs.slice(0, 5).map((d) => (
                <li key={d.id}>
                  <button className="start-row" onClick={() => actions.openLlm('claude', { attachments: [textAttachment(d.title, docText(d), d.source)] })}>
                    <span className="start-row-title">{d.title}</span>
                    <span className="start-row-meta">{d.chunks.length} trechos</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="start-ai">
            <button className="btn btn-sm" onClick={() => actions.openAiTab('round')}>
              IA-Round
            </button>
            <button className="btn btn-sm" onClick={() => actions.openAiTab('capture')}>
              Captura de tela
            </button>
          </div>
        </section>
      </div>
      <p className="start-hint">
        Arraste PDFs ou imagens para qualquer lugar · <kbd>Ctrl K</kbd> comandos · <kbd>Ctrl T</kbd> nova aba
      </p>
    </div>
  );
}

function RecentRow({ file, onOpen }: { file: RecentFile; onOpen(): void }) {
  const [menu, setMenu] = useState(false);
  return (
    <li className="start-recent" onMouseLeave={() => setMenu(false)}>
      <button className="start-row" onClick={onOpen} title={file.path ?? file.name}>
        <span className="start-thumb">{file.thumb ? <img src={file.thumb} alt="" /> : 'PDF'}</span>
        <span className="start-row-title">{file.name}</span>
        <span className="start-row-meta">{new Date(file.openedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
      </button>
      <button className="icon-btn start-row-menu" aria-label={`Opções de ${file.name}`} onClick={() => setMenu((m) => !m)}>
        <IconMore width={16} height={16} />
      </button>
      {menu && (
        <div className="menu">
          <button onClick={onOpen}>Abrir</button>
          {file.path && <button onClick={() => showInFolder(file.path!)}>Mostrar na pasta</button>}
          <button onClick={() => removeRecent(file.key)}>Remover dos recentes</button>
        </div>
      )}
    </li>
  );
}
