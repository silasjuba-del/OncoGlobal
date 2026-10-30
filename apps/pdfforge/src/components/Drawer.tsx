// Barra lateral global (drawer): expandida com rótulos ou recolhida só com ícones; itens ocultáveis em Configurações.
import type { ReactNode } from 'react';
import { useActions, type AiTabKind, type HomeSection } from '../app/actions';
import { PROVIDERS, type Provider } from '../ai/bridge';
import { setUi, useAppState } from '../store/store';
import { IconCamera, IconChevronLeft, IconChevronRight, IconClipboard, IconClock, IconGear, IconGlobe, IconSearch, IconWrench } from './icons';

export interface NavItem {
  id: string;
  label: string;
  group: 'PDF' | 'Inteligência artificial' | 'Navegação' | 'Sistema';
  icon: ReactNode;
  run(a: ReturnType<typeof useActions>): void;
}

const badge = (text: string, color: string) => (
  <span className="tab-badge" style={{ background: color }}>
    {text}
  </span>
);

const home = (s: HomeSection) => (a: ReturnType<typeof useActions>) => a.goHome(s);
const tab = (k: AiTabKind) => (a: ReturnType<typeof useActions>) => a.openAiTab(k);
const llm = (p: Provider) => (a: ReturnType<typeof useActions>) => a.openLlm(p);

export const NAV_ITEMS: NavItem[] = [
  { id: 'recents', label: 'Início', group: 'PDF', icon: <IconClock />, run: home('recents') },
  { id: 'tools', label: 'Ferramentas', group: 'PDF', icon: <IconWrench />, run: home('tools') },
  { id: 'history', label: 'Histórico', group: 'PDF', icon: <IconClipboard />, run: home('history') },
  ...PROVIDERS.map<NavItem>((p) => ({ id: p.id, label: p.name, group: 'Inteligência artificial', icon: badge(p.name[0], p.color), run: llm(p.id) })),
  { id: 'round', label: 'IA-Round', group: 'Inteligência artificial', icon: badge('4', '#B5179E'), run: tab('round') },
  { id: 'notebooklm', label: 'NotebookLM', group: 'Inteligência artificial', icon: badge('N', '#1A73E8'), run: tab('notebooklm') },
  { id: 'library', label: 'Biblioteca', group: 'Inteligência artificial', icon: badge('M', '#6C7BD0'), run: tab('library') },
  { id: 'prompts', label: 'Prompts & Skills', group: 'Inteligência artificial', icon: badge('P', '#A35FC9'), run: tab('prompts') },
  { id: 'browser', label: 'Navegador', group: 'Navegação', icon: <IconGlobe />, run: (a) => a.openWeb('') },
  { id: 'oncoglobal', label: 'OncoGlobal', group: 'Navegação', icon: badge('O', '#0F9D8A'), run: tab('oncoglobal') },
  { id: 'capture', label: 'Captura de tela', group: 'Navegação', icon: <IconCamera />, run: tab('capture') },
  { id: 'settings', label: 'Configurações', group: 'Sistema', icon: <IconGear />, run: tab('settings') },
];

export function Drawer({ activeId, onSearch }: { activeId: string | null; onSearch(): void }) {
  const actions = useActions();
  const { settings } = useAppState();
  const collapsed = settings.ui.sidebarCollapsed;
  const items = NAV_ITEMS.filter((i) => !settings.ui.hiddenNav.includes(i.id));
  const groups = [...new Set(items.map((i) => i.group))];
  return (
    <nav className={`drawer ${collapsed ? 'collapsed' : ''}`} aria-label="Navegação principal">
      <button className="drawer-search" onClick={onSearch} aria-label="Buscar ou executar comando (Ctrl+K)" title="Buscar (Ctrl+K)">
        <IconSearch />
        {!collapsed && (
          <>
            <span>Buscar…</span>
            <kbd>Ctrl K</kbd>
          </>
        )}
      </button>
      <div className="drawer-scroll">
        {groups.map((g) => (
          <div key={g} className="drawer-group">
            {!collapsed && <div className="side-group">{g}</div>}
            {items
              .filter((i) => i.group === g)
              .map((i) => (
                <button
                  key={i.id}
                  className={`side-item ${activeId === i.id ? 'active' : ''}`}
                  onClick={() => i.run(actions)}
                  title={collapsed ? i.label : undefined}
                  aria-label={i.label}
                >
                  {i.icon}
                  {!collapsed && <span>{i.label}</span>}
                </button>
              ))}
          </div>
        ))}
      </div>
      <button
        className="drawer-toggle"
        onClick={() => setUi({ sidebarCollapsed: !collapsed })}
        aria-label={collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
        title={collapsed ? 'Expandir' : 'Recolher'}
      >
        {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
        {!collapsed && <span>Recolher</span>}
      </button>
    </nav>
  );
}
