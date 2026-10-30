import { useState } from 'react';
import { useActions } from '../app/actions';
import { StartPage } from './StartPage';
import { IconGlobe, IconSearch } from '../components/icons';
import { ToolIcon } from '../components/ToolIcon';
import { clearHistory, useAppState } from '../store/store';
import { TOOLS, toolById } from '../tools/catalog';
import { CATEGORY_ORDER, type ToolDef } from '../tools/types';
import { showInFolder } from '../platform/platform';


import type { HomeSection } from '../app/actions';

/** Conteúdo da aba Página inicial; a navegação fica no drawer global (components/Drawer). */
export function HomeView({ section, onSection }: { section: HomeSection; onSection(s: HomeSection): void }) {
  return (
    <div className="home-main">
      {section === 'recents' && <StartPage onAllTools={() => onSection('tools')} onHistory={() => onSection('history')} />}
      {section === 'tools' && <ToolsSection />}
      {section === 'history' && <HistorySection />}
    </div>
  );
}

export function ToolTile({ tool, compact, onPick }: { tool: ToolDef; compact?: boolean; onPick?(t: ToolDef): void }) {
  const actions = useActions();
  const planned = tool.status === 'planned';
  return (
    <button
      className={`tool-tile ${compact ? 'compact' : ''} ${planned ? 'planned' : ''}`}
      onClick={() => (onPick ? onPick(tool) : actions.openTool(tool.id))}
      title={planned ? `Em breve — ${tool.plannedReason}` : tool.description}
    >
      {tool.internet && <IconGlobe className="tile-badge" width={14} height={14} aria-label="Requer internet" />}
      <ToolIcon tool={tool} size={compact ? 46 : 42} />
      <span className="tile-name">{tool.name}</span>
      {!compact && <span className="tile-desc">{tool.description}</span>}
      {planned && <span className="tag">Em breve</span>}
    </button>
  );
}

function ToolsSection() {
  const [q, setQ] = useState('');
  const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const filtered = TOOLS.filter((t) => !q || norm(`${t.name} ${t.description} ${t.category}`).includes(norm(q)));
  return (
    <div className="page">
      <div className="tools-head">
        <h1>Todas as ferramentas</h1>
        <label className="search">
          <IconSearch />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar ferramenta" aria-label="Buscar ferramenta" />
        </label>
      </div>
      {CATEGORY_ORDER.map((cat) => {
        const list = filtered.filter((t) => t.category === cat);
        if (!list.length) return null;
        return (
          <section key={cat} className="category">
            <h2>{cat}</h2>
            <div className="tool-grid">
              {list.map((t) => (
                <ToolTile key={t.id} tool={t} />
              ))}
            </div>
          </section>
        );
      })}
      {filtered.length === 0 && <p className="empty">Nenhuma ferramenta encontrada para “{q}”.</p>}
    </div>
  );
}

function HistorySection() {
  const { history } = useAppState();
  const actions = useActions();
  return (
    <div className="page">
      <div className="section-head">
        <h1>Histórico de tarefas</h1>
        {history.length > 0 && (
          <button className="link-danger" onClick={clearHistory}>
            Limpar histórico
          </button>
        )}
      </div>
      {history.length === 0 ? (
        <p className="empty">Cada tarefa executada fica registrada aqui, com entradas, saídas e duração.</p>
      ) : (
        <table className="history">
          <thead>
            <tr>
              <th>Ferramenta</th>
              <th>Arquivos de entrada</th>
              <th>Resultado</th>
              <th>Quando</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {history.map((h) => {
              const tool = toolById(h.toolId);
              return (
                <tr key={h.id}>
                  <td>
                    <span className="hist-tool">
                      {tool && <ToolIcon tool={tool} size={26} />}
                      {h.toolName}
                    </span>
                  </td>
                  <td className="muted">{h.inputs.join(', ')}</td>
                  <td>
                    {h.status === 'ok' ? (
                      <span className="ok">
                        {h.outputs.length} arquivo(s) · {(h.durationMs / 1000).toFixed(1)}s
                      </span>
                    ) : (
                      <span className="err" title={h.error}>
                        Falhou: {h.error}
                      </span>
                    )}
                  </td>
                  <td className="muted">{new Date(h.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td>
                    {h.outputs.find((o) => o.path) ? (
                      <button className="link" onClick={() => showInFolder(h.outputs.find((o) => o.path)!.path!)}>
                        Mostrar
                      </button>
                    ) : tool?.status === 'ready' ? (
                      <button className="link" onClick={() => actions.openTool(h.toolId)}>
                        Repetir
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
