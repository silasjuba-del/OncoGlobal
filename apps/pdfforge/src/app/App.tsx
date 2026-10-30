import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActionsContext, AppActions, Tab } from './actions';
import { HomeView } from '../pages/HomeView';
import { ToolWorkspace } from '../pages/ToolWorkspace';
import { ViewerPage } from '../pages/ViewerPage';
import { toolById } from '../tools/catalog';
import { FilePayload, fromFileList, isDesktop, onMenu, openFiles } from '../platform/platform';
import { CommandPalette } from '../components/CommandPalette';
import { addRecent, setTheme, setUi, useAppState } from '../store/store';
import { isImageName, thumbnail } from '../engine/render';
import { IconClose, IconFile, IconHome, IconMoon, IconPlus, IconSun, Logo } from '../components/icons';
import { ToolIcon } from '../components/ToolIcon';
import { LlmPage } from '../pages/ai/LlmPage';
import { NotebookLmPage } from '../pages/ai/NotebookLmPage';
import { LibraryPage } from '../pages/ai/LibraryPage';
import { PromptsPage } from '../pages/ai/PromptsPage';
import { SettingsPage } from '../pages/ai/SettingsPage';
import { providerInfo } from '../ai/bridge';
import { hydrateLibrary } from '../ai/library';

import { RoundPage } from '../pages/ai/RoundPage';
import { CapturePage } from '../pages/ai/CapturePage';
import { BrowserPage } from '../pages/BrowserPage';
import { EditorPage } from '../pages/EditorPage';
import { Drawer } from '../components/Drawer';
import { Launcher } from '../components/Launcher';
import { onBrowserOpen } from '../ai/bridge';

const AI_TAB_LABEL = {
  notebooklm: 'NotebookLM',
  library: 'Biblioteca',
  prompts: 'Prompts & Skills',
  settings: 'Configurações',
  round: 'IA-Round',
  capture: 'Captura',
  oncoglobal: 'OncoGlobal',
} as const;
const AI_TAB_COLOR = {
  notebooklm: '#1A73E8',
  library: '#6C7BD0',
  prompts: '#A35FC9',
  settings: '#5C5C64',
  round: '#B5179E',
  capture: '#E8710A',
  oncoglobal: '#0F9D8A',
} as const;

interface Toast {
  id: number;
  message: string;
  kind: 'info' | 'error' | 'success';
}

let tabSeq = 0;

export function App() {
  const { settings } = useAppState();
  const [tabs, setTabs] = useState<Tab[]>([{ id: 'home', kind: 'home' }]);
  const [active, setActive] = useState('home');
  const [homeSection, setHomeSection] = useState<'recents' | 'tools' | 'history'>('recents');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [about, setAbout] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [tabMenu, setTabMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [titles, setTitles] = useState<Record<string, string>>({});

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  // Personalização da interface: tokens CSS aplicados na raiz.
  const ui = settings.ui;
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent', ui.accent);
    root.style.setProperty('--accent-hover', `color-mix(in srgb, ${ui.accent} 82%, white)`);
    root.style.setProperty('--accent-soft', `color-mix(in srgb, ${ui.accent} 14%, transparent)`);
    root.style.setProperty('--radius', `${ui.radius}px`);
    root.style.fontSize = `${ui.fontSize}px`;
    root.dataset.density = ui.density;
    root.dataset.cards = ui.cardSize;
    document.title = ui.appName;
  }, [ui.accent, ui.radius, ui.fontSize, ui.density, ui.cardSize, ui.appName]);

  useEffect(() => {
    void hydrateLibrary();
  }, []);

  const toast = useCallback((message: string, kind: Toast['kind'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 4000);
  }, []);

  const addTab = useCallback((tab: Tab) => {
    setTabs((t) => [...t, tab]);
    setActive(tab.id);
  }, []);

  const rememberFiles = useCallback((files: FilePayload[]) => {
    for (const f of files) {
      void thumbnail(f, 160).then((thumb) =>
        addRecent({ name: f.name, path: f.path ?? null, size: f.bytes.length, thumb }),
      );
    }
  }, []);

  const actions = useMemo<AppActions>(
    () => ({
      openTool(toolId, files) {
        addTab({ id: `tool-${++tabSeq}`, kind: 'tool', toolId, initialFiles: files });
      },
      openViewer(file) {
        rememberFiles([file]);
        if (isImageName(file.name)) {
          addTab({ id: `tool-${++tabSeq}`, kind: 'tool', toolId: 'image-to-pdf', initialFiles: [file] });
          return;
        }
        addTab({ id: `view-${++tabSeq}`, kind: 'viewer', file });
      },
      openLlm(provider, init) {
        // Uma aba por provedor: reabrir foca a existente e entrega o novo contexto (initSeq).
        setTabs((t) => {
          const existing = t.find((x) => x.kind === 'llm' && x.provider === provider);
          if (existing) {
            setActive(existing.id);
            return init ? t.map((x) => (x === existing ? { ...existing, init, initSeq: (('initSeq' in x && x.initSeq) || 0) + 1 } : x)) : t;
          }
          const id = `llm-${provider}`;
          setActive(id);
          return [...t, { id, kind: 'llm', provider, init, initSeq: init ? 1 : 0 }];
        });
      },
      openWeb(url) {
        addTab({ id: `web-${++tabSeq}`, kind: 'web', url });
      },
      openEditor(file) {
        rememberFiles([file]);
        addTab({ id: `edit-${++tabSeq}`, kind: 'editor', file });
      },
      goHome(section) {
        setHomeSection(section);
        setActive('home');
      },
      openAiTab(kind) {
        setTabs((t) => {
          const id = `ai-${kind}`;
          setActive(id);
          return t.some((x) => x.id === id) ? t : [...t, { id, kind }];
        });
      },
      async pickAndOpen() {
        const files = await openFiles('pdf', true);
        files.forEach((f) => actions.openViewer(f));
      },
      rememberFiles,
      closeTab(id) {
        setTabs((t) => {
          const idx = t.findIndex((x) => x.id === id);
          const next = t.filter((x) => x.id !== id);
          setActive((cur) => (cur === id ? next[Math.max(0, idx - 1)]?.id ?? 'home' : cur));
          return next;
        });
      },
      toast,
    }),
    [addTab, rememberFiles, toast],
  );

  useEffect(() => {
    const offs = [
      onMenu('menu:open', () => actions.pickAndOpen()),
      onMenu('menu:tools', () => {
        setActive('home');
        setHomeSection('tools');
      }),
      onMenu('menu:about', () => setAbout(true)),
      onMenu('menu:newtab', () => actions.openWeb('')),
      onMenu('menu:palette', () => setPaletteOpen(true)),
      onMenu('menu:closetab', () => closeActiveRef.current()),
    ];
    offs.push(onBrowserOpen((url) => actions.openWeb(url)));
    return () => offs.forEach((off) => off());
  }, [actions]);

  const activeTab = tabs.find((t) => t.id === active);
  const closeActiveRef = useRef(() => {});
  closeActiveRef.current = () => {
    if (active !== 'home') actions.closeTab(active);
  };

  const closeMany = (keep: (t: Tab, i: number, pivot: number) => boolean, pivotId: string) =>
    setTabs((list) => {
      const pivot = list.findIndex((t) => t.id === pivotId);
      const next = list.filter((t, i) => t.kind === 'home' || keep(t, i, pivot));
      if (!next.some((t) => t.id === active)) setActive(pivotId);
      return next;
    });

  // Atalhos de navegador. No desktop, Ctrl+T/K/W vêm do menu nativo (funcionam até com o foco num site).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      const typing = (e.target as HTMLElement)?.closest?.('input, textarea, select, [contenteditable="true"]');
      const go = (fn: () => void) => {
        e.preventDefault();
        fn();
      };
      if (!isDesktop() && k === 'k') return go(() => setPaletteOpen(true));
      if (!isDesktop() && k === 't') return go(() => actions.openWeb(''));
      if (!isDesktop() && k === 'w') return go(() => closeActiveRef.current());
      if (k === 'l') {
        return go(() => {
          actions.goHome('recents');
          setTimeout(() => window.dispatchEvent(new Event('pdfforge:focus-omnibox')), 30);
        });
      }
      if (k === 'tab') {
        return go(() => {
          const i = tabs.findIndex((t) => t.id === active);
          const n = tabs.length;
          setActive(tabs[(i + (e.shiftKey ? n - 1 : 1)) % n].id);
        });
      }
      if (typing) return;
      if (k === 'b') return go(() => setUi({ sidebarCollapsed: !settings.ui.sidebarCollapsed }));
      if (/^[1-9]$/.test(k)) {
        return go(() => setActive((k === '9' ? tabs[tabs.length - 1] : (tabs[Number(k) - 1] ?? tabs[tabs.length - 1])).id));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tabs, active, actions, settings.ui.sidebarCollapsed]);
  const activeNav =
    !activeTab ? null
    : activeTab.kind === 'home' ? homeSection
    : activeTab.kind === 'llm' ? activeTab.provider
    : activeTab.kind === 'web' ? 'browser'
    : activeTab.kind === 'tool' || activeTab.kind === 'viewer' || activeTab.kind === 'editor' ? null
    : activeTab.kind;

  // "Arraste e solte em qualquer lugar" na página inicial.
  const [dragging, setDragging] = useState(false);
  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (active !== 'home') return;
    const files = await fromFileList(e.dataTransfer.files);
    const pdfs = files.filter((f) => /\.pdf$/i.test(f.name));
    const images = files.filter((f) => isImageName(f.name));
    pdfs.forEach((f) => actions.openViewer(f));
    if (images.length) actions.openTool('image-to-pdf', images);
    if (!pdfs.length && !images.length) toast('Formato não suportado. Use PDF ou imagens.', 'error');
  };

  return (
    <ActionsContext.Provider value={actions}>
      <div
        className="app"
        onDragOver={(e) => {
          if (active === 'home' && e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            setDragging(true);
          }
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDragging(false);
        }}
        onDrop={onDrop}
      >
        <header className="tabbar">
          <div className="brand">
            <Logo />
            <span>{ui.appName}</span>
          </div>
          <nav className="tabs" role="tablist">
            {tabs.map((t) => (
              <TabButton
                key={t.id}
                tab={t}
                title={titles[t.id]}
                active={t.id === active}
                onSelect={() => setActive(t.id)}
                onClose={() => actions.closeTab(t.id)}
                onMenu={(x, y) => setTabMenu({ id: t.id, x, y })}
              />
            ))}
            <button className="tab-add" title="Nova aba do navegador" aria-label="Nova aba do navegador" onClick={() => actions.openWeb('')}>
              <IconPlus />
            </button>
          </nav>
          <div className="tabbar-actions">
            <Launcher />
            <button
              className="icon-btn"
              title={settings.theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
              onClick={() => setTheme(settings.theme === 'dark' ? 'light' : 'dark')}
            >
              {settings.theme === 'dark' ? <IconSun /> : <IconMoon />}
            </button>
          </div>
        </header>

        <div className="body">
        <Drawer activeId={activeNav} onSearch={() => setPaletteOpen(true)} />
        <main className="content">
          {tabs.map((t) => (
            <section key={t.id} className="tab-panel" hidden={t.id !== active} role="tabpanel">
              {t.kind === 'home' && <HomeView section={homeSection} onSection={setHomeSection} />}
              {t.kind === 'tool' && <ToolWorkspace toolId={t.toolId} initialFiles={t.initialFiles} />}
              {t.kind === 'viewer' && <ViewerPage file={t.file} />}
              {t.kind === 'llm' && <LlmPage provider={t.provider} init={t.init} initSeq={t.initSeq} />}
              {t.kind === 'notebooklm' && <NotebookLmPage />}
              {t.kind === 'library' && <LibraryPage />}
              {t.kind === 'prompts' && <PromptsPage />}
              {t.kind === 'settings' && <SettingsPage />}
              {t.kind === 'round' && <RoundPage />}
              {t.kind === 'capture' && <CapturePage />}
              {t.kind === 'web' && (
                <BrowserPage
                  initialUrl={t.url}
                  partition="persist:web"
                  onTitle={(title) => setTitles((m) => (m[t.id] === title ? m : { ...m, [t.id]: title }))}
                />
              )}
              {t.kind === 'oncoglobal' && <BrowserPage initialUrl={ui.oncoglobalUrl} partition="persist:oncoglobal" label="OncoGlobal" />}
              {t.kind === 'editor' && <EditorPage file={t.file} />}
            </section>
          ))}
        </main>
        </div>

        {dragging && (
          <div className="drop-overlay">
            <div>Solte seus PDFs ou imagens aqui</div>
          </div>
        )}

        <div className="toasts" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast-${t.kind}`}>
              {t.message}
            </div>
          ))}
        </div>

        {about && (
          <div className="modal-backdrop" onClick={() => setAbout(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2>PDFForge 0.1.0</h2>
              <p>Suíte de ferramentas PDF local, construída a partir da engenharia reversa funcional de um app desktop de referência.</p>
              <p className="muted">Motores abertos: pdf-lib (@cantoo), pdf.js, tesseract.js. Seus arquivos são processados localmente; apenas o OCR baixa modelos de idioma na primeira execução.</p>
              <button className="btn btn-primary" onClick={() => setAbout(false)}>
                Fechar
              </button>
            </div>
          </div>
        )}
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
        {tabMenu && (
          <TabMenu
            menu={tabMenu}
            tab={tabs.find((x) => x.id === tabMenu.id)}
            onDismiss={() => setTabMenu(null)}
            onClose={(id) => actions.closeTab(id)}
            onCloseOthers={(id) => closeMany((t) => t.id === id, id)}
            onCloseRight={(id) => closeMany((_t, i, pivot) => i <= pivot, id)}
            onDuplicate={(t) => {
              if (t.kind === 'web') actions.openWeb(t.url);
              else if (t.kind === 'viewer') actions.openViewer(t.file);
              else if (t.kind === 'editor') actions.openEditor(t.file);
            }}
          />
        )}
      </div>
    </ActionsContext.Provider>
  );
}

function TabMenu({
  menu,
  tab,
  onDismiss,
  onClose,
  onCloseOthers,
  onCloseRight,
  onDuplicate,
}: {
  menu: { id: string; x: number; y: number };
  tab?: Tab;
  onDismiss(): void;
  onClose(id: string): void;
  onCloseOthers(id: string): void;
  onCloseRight(id: string): void;
  onDuplicate(t: Tab): void;
}) {
  const act = (fn: () => void) => () => {
    fn();
    onDismiss();
  };
  const canDuplicate = tab && (tab.kind === 'web' || tab.kind === 'viewer' || tab.kind === 'editor');
  return (
    <div
      className="ctx-backdrop"
      onMouseDown={onDismiss}
      onContextMenu={(e) => {
        e.preventDefault();
        onDismiss();
      }}
    >
      <div className="menu ctx-menu" style={{ left: menu.x, top: menu.y }} role="menu" onMouseDown={(e) => e.stopPropagation()}>
        {menu.id !== 'home' && (
          <button role="menuitem" onClick={act(() => onClose(menu.id))}>
            Fechar aba <kbd>Ctrl W</kbd>
          </button>
        )}
        <button role="menuitem" onClick={act(() => onCloseOthers(menu.id))}>
          Fechar outras abas
        </button>
        <button role="menuitem" onClick={act(() => onCloseRight(menu.id))}>
          Fechar abas à direita
        </button>
        {canDuplicate && (
          <button role="menuitem" onClick={act(() => onDuplicate(tab!))}>
            Duplicar aba
          </button>
        )}
      </div>
    </div>
  );
}

function TabButton({
  tab,
  title,
  active,
  onSelect,
  onClose,
  onMenu,
}: {
  tab: Tab;
  title?: string;
  active: boolean;
  onSelect(): void;
  onClose(): void;
  onMenu(x: number, y: number): void;
}) {
  const context = (e: React.MouseEvent) => {
    e.preventDefault();
    onMenu(e.clientX, e.clientY);
  };
  if (tab.kind === 'home') {
    return (
      <button role="tab" aria-selected={active} className={`tab ${active ? 'active' : ''}`} onClick={onSelect} onContextMenu={context}>
        <IconHome width={15} height={15} />
        <span>Página inicial</span>
      </button>
    );
  }
  const tool = tab.kind === 'tool' ? toolById(tab.toolId) : undefined;
  let label: string;
  let badge: { text: string; color: string } | null = null;
  if (tab.kind === 'tool') label = tool?.name ?? tab.toolId;
  else if (tab.kind === 'viewer') label = tab.file.name;
  else if (tab.kind === 'editor') {
    label = `Editar: ${tab.file.name}`;
    badge = { text: '✎', color: '#A35FC9' };
  } else if (tab.kind === 'web') {
    label = title || (tab.url ? tab.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40) : 'Nova aba');
    badge = { text: '◎', color: '#4285F4' };
  }
  else if (tab.kind === 'llm') {
    const info = providerInfo(tab.provider);
    label = info.name;
    badge = { text: info.name[0], color: info.color };
  } else {
    label = AI_TAB_LABEL[tab.kind];
    badge = { text: label[0], color: AI_TAB_COLOR[tab.kind] };
  }
  return (
    <div
      className={`tab ${active ? 'active' : ''}`}
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      onContextMenu={context}
      onAuxClick={(e) => {
        if (e.button === 1) {
          e.preventDefault();
          onClose();
        }
      }}
      title={label}
    >
      {tool ? (
        <ToolIcon tool={tool} size={18} />
      ) : badge ? (
        <span className="tab-badge" style={{ background: badge.color }}>
          {badge.text}
        </span>
      ) : (
        <IconFile width={15} height={15} className="pdf-tab-icon" />
      )}
      <span className="tab-label">{label}</span>
      <button
        className="tab-close"
        aria-label={`Fechar ${label}`}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <IconClose width={13} height={13} />
      </button>
    </div>
  );
}
