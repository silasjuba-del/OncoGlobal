// Índice único de comandos/destinos para a paleta (Ctrl+K) e para as sugestões da omnibox.
import { useMemo } from 'react';
import { useActions, type AiTabKind, type AppActions } from './actions';
import { PROVIDERS, type Provider } from '../ai/bridge';
import { allTemplates, docText, useLibrary } from '../ai/library';
import { textAttachment } from '../ai/attachments';
import { NAV_ITEMS } from '../components/Drawer';
import { readPath } from '../platform/platform';
import { setTheme, setUi, useAppState, getState } from '../store/store';
import { TOOLS } from '../tools/catalog';

export interface Command {
  id: string;
  label: string;
  group: 'Ações' | 'Telas' | 'Ferramentas' | 'Recentes' | 'Biblioteca' | 'Prompts' | 'Apps';
  hint?: string;
  keywords?: string;
  shortcut?: string;
  run(): void;
}

export const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();

/** Filtra por todas as palavras digitadas (sem acento); prioriza rótulos que começam com a consulta. */
export function filterCommands(cmds: Command[], query: string, limit = 60): Command[] {
  const q = norm(query.trim());
  if (!q) return cmds.slice(0, limit);
  const words = q.split(/\s+/);
  return cmds
    .map((c) => {
      const label = norm(c.label);
      const hay = `${label} ${norm(c.keywords ?? '')} ${norm(c.hint ?? '')} ${norm(c.group)}`;
      if (!words.every((w) => hay.includes(w))) return null;
      const score = (label.startsWith(q) ? 0 : label.includes(q) ? 1 : 2) + (c.group === 'Ações' || c.group === 'Telas' ? 0 : 0.5);
      return { c, score };
    })
    .filter((x): x is { c: Command; score: number } => Boolean(x))
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((x) => x.c);
}

function openTarget(a: AppActions, target: string) {
  if (!target.startsWith('app:')) return a.openWeb(target);
  const dest = target.slice(4);
  if (PROVIDERS.some((p) => p.id === dest)) a.openLlm(dest as Provider);
  else a.openAiTab(dest as AiTabKind);
}

export function useCommands(): Command[] {
  const actions = useActions();
  const { recents, settings } = useAppState();
  const lib = useLibrary();
  return useMemo(() => {
    const cmds: Command[] = [
      { id: 'a-newtab', group: 'Ações', label: 'Nova aba do navegador', shortcut: 'Ctrl+T', keywords: 'web site url', run: () => actions.openWeb('') },
      { id: 'a-open', group: 'Ações', label: 'Abrir PDF…', shortcut: 'Ctrl+O', keywords: 'arquivo documento', run: () => actions.pickAndOpen() },
      {
        id: 'a-theme',
        group: 'Ações',
        label: settings.theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro',
        keywords: 'aparência cor modo',
        run: () => setTheme(getState().settings.theme === 'dark' ? 'light' : 'dark'),
      },
      {
        id: 'a-drawer',
        group: 'Ações',
        label: settings.ui.sidebarCollapsed ? 'Expandir barra lateral' : 'Recolher barra lateral',
        shortcut: 'Ctrl+B',
        keywords: 'menu sidebar drawer',
        run: () => setUi({ sidebarCollapsed: !getState().settings.ui.sidebarCollapsed }),
      },
      ...NAV_ITEMS.map<Command>((n) => ({ id: `n-${n.id}`, group: 'Telas', label: n.label, hint: n.group, run: () => n.run(actions) })),
      ...TOOLS.filter((t) => t.status === 'ready').map<Command>((t) => ({
        id: `t-${t.id}`,
        group: 'Ferramentas',
        label: t.name,
        hint: t.category,
        keywords: t.description,
        run: () => actions.openTool(t.id),
      })),
      ...recents.slice(0, 15).map<Command>((r) => ({
        id: `r-${r.key}`,
        group: 'Recentes',
        label: r.name,
        hint: r.path ?? 'aberto nesta sessão',
        run: async () => {
          const f = r.path ? await readPath(r.path) : null;
          if (f) actions.openViewer(f);
          else actions.toast(`Não foi possível reabrir "${r.name}".`, 'error');
        },
      })),
      ...lib.docs.slice(0, 40).map<Command>((d) => ({
        id: `l-${d.id}`,
        group: 'Biblioteca',
        label: d.title,
        hint: 'Abrir no Claude',
        run: () => actions.openLlm('claude', { attachments: [textAttachment(d.title, docText(d), d.source)] }),
      })),
      ...allTemplates('prompt').map<Command>((p) => ({
        id: `p-${p.id}`,
        group: 'Prompts',
        label: p.name,
        hint: 'Usar no Claude',
        keywords: p.description,
        run: () => actions.openLlm('claude', { promptId: p.id }),
      })),
      ...settings.ui.launcher.map<Command>((l) => ({
        id: `x-${l.id}`,
        group: 'Apps',
        label: l.name,
        hint: l.target.replace(/^https?:\/\//, ''),
        run: () => openTarget(actions, l.target),
      })),
    ];
    return cmds;
  }, [actions, recents, settings.theme, settings.ui.sidebarCollapsed, settings.ui.launcher, lib.docs, lib.prompts]);
}
