// Ícone de grade com modal de atalhos (estilo "apps do Google"): editável, abre abas internas ou sites no navegador do app.
import { useEffect, useRef, useState } from 'react';
import { useActions, type AiTabKind } from '../app/actions';
import { PROVIDERS, type Provider } from '../ai/bridge';
import { setUi, useAppState, type LauncherItem } from '../store/store';
import { IconGrid, IconPen } from './icons';

const AI_TABS: AiTabKind[] = ['notebooklm', 'library', 'prompts', 'settings', 'round', 'capture', 'oncoglobal'];

export function Launcher() {
  const actions = useActions();
  const { settings } = useAppState();
  const items = settings.ui.launcher;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: '', target: '', color: '#4285F4' });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const launch = (it: LauncherItem) => {
    setOpen(false);
    if (it.target.startsWith('app:')) {
      const dest = it.target.slice(4);
      if (PROVIDERS.some((p) => p.id === dest)) actions.openLlm(dest as Provider);
      else if ((AI_TABS as string[]).includes(dest)) actions.openAiTab(dest as AiTabKind);
      else actions.toast(`Destino interno desconhecido: ${dest}`, 'error');
    } else actions.openWeb(it.target);
  };

  const add = () => {
    let target = draft.target.trim();
    if (!target.startsWith('app:') && !/^https?:\/\//.test(target)) target = `https://${target}`;
    setUi({ launcher: [...items, { id: `l-${Date.now().toString(36)}`, name: draft.name.trim() || target, target, color: draft.color }] });
    setDraft({ name: '', target: '', color: '#4285F4' });
  };

  return (
    <div className="launcher" ref={ref}>
      <button className="icon-btn" aria-label="Apps" aria-expanded={open} title="Apps" onClick={() => setOpen((o) => !o)}>
        <IconGrid />
      </button>
      {open && (
        <div className="launcher-pop" role="dialog" aria-label="Apps favoritos">
          <div className="launcher-head">
            <strong>Seus favoritos</strong>
            <button className={`icon-btn ${editing ? 'on' : ''}`} aria-label="Editar favoritos" aria-pressed={editing} onClick={() => setEditing((e) => !e)}>
              <IconPen />
            </button>
          </div>
          <div className="launcher-grid">
            {items.map((it, idx) => (
              <div key={it.id} className="launcher-cell">
                <button className="launcher-item" onClick={() => !editing && launch(it)} title={it.target}>
                  <span className="launcher-icon" style={{ background: it.color }}>
                    {it.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="launcher-name">{it.name}</span>
                </button>
                {editing && (
                  <div className="launcher-edit">
                    <button aria-label={`Mover ${it.name} para trás`} disabled={idx === 0} onClick={() => setUi({ launcher: swap(items, idx, idx - 1) })}>
                      ‹
                    </button>
                    <button aria-label={`Remover ${it.name}`} onClick={() => setUi({ launcher: items.filter((x) => x.id !== it.id) })}>
                      ×
                    </button>
                    <button aria-label={`Mover ${it.name} para frente`} disabled={idx === items.length - 1} onClick={() => setUi({ launcher: swap(items, idx, idx + 1) })}>
                      ›
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {editing && (
            <form
              className="launcher-add"
              onSubmit={(e) => {
                e.preventDefault();
                if (draft.target.trim()) add();
              }}
            >
              <input type="text" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Nome" aria-label="Nome do atalho" />
              <input type="text" value={draft.target} onChange={(e) => setDraft({ ...draft, target: e.target.value })} placeholder="URL ou app:claude" aria-label="Destino do atalho" />
              <input type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} aria-label="Cor" />
              <button className="btn btn-sm btn-primary" disabled={!draft.target.trim()}>
                Adicionar
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function swap<T>(list: T[], a: number, b: number): T[] {
  const next = [...list];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}
