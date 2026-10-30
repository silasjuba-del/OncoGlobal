// Biblioteca de prompts operacionais e skills de texto: usar, editar (sobrepõe o padrão), criar e remover.
import { useState } from 'react';
import { useActions } from '../../app/actions';
import { PROVIDERS, type Provider } from '../../ai/bridge';
import { allTemplates, deleteTemplate, saveTemplate, useLibrary } from '../../ai/library';
import { BUILTIN_PROMPTS, BUILTIN_SKILLS, type PromptTemplate } from '../../ai/prompts';

const BUILTIN_IDS = new Set([...BUILTIN_PROMPTS, ...BUILTIN_SKILLS].map((p) => p.id));

const EMPTY: Omit<PromptTemplate, 'id'> = { name: '', kind: 'prompt', description: '', template: '' };

export function PromptsPage() {
  const actions = useActions();
  useLibrary();
  const [kind, setKind] = useState<'prompt' | 'skill'>('prompt');
  const [editing, setEditing] = useState<(Omit<PromptTemplate, 'id'> & { id?: string }) | null>(null);
  const [provider, setProvider] = useState<Provider>('claude');
  const list = allTemplates(kind);

  return (
    <div className="llm">
      <header className="llm-head">
        <span className="llm-badge" style={{ background: '#A35FC9' }}>
          P
        </span>
        <div>
          <h1>Prompts & Skills</h1>
          <span className="muted small">Variáveis: {'{{documento}}'} {'{{selecao}}'} {'{{entrada}}'} {'{{titulo}}'}</span>
        </div>
        <div className="segmented llm-mode" role="radiogroup" aria-label="Tipo">
          <button role="radio" aria-checked={kind === 'prompt'} className={kind === 'prompt' ? 'on' : ''} onClick={() => setKind('prompt')}>
            Prompts operacionais
          </button>
          <button role="radio" aria-checked={kind === 'skill'} className={kind === 'skill' ? 'on' : ''} onClick={() => setKind('skill')}>
            Skills de texto
          </button>
        </div>
      </header>
      <div className="page prompts-page">
        <div className="row space">
          <div className="row">
            <span className="muted small">Usar com</span>
            <select value={provider} onChange={(e) => setProvider(e.target.value as Provider)} aria-label="Provedor">
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setEditing({ ...EMPTY, kind })}>
            + Nov{kind === 'prompt' ? 'o prompt' : 'a skill'}
          </button>
        </div>
        {editing && (
          <form
            className="prompt-editor"
            onSubmit={(e) => {
              e.preventDefault();
              saveTemplate(editing);
              setEditing(null);
              actions.toast('Salvo.', 'success');
            }}
          >
            <input type="text" required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Nome" aria-label="Nome" />
            <input type="text" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="Descrição curta" aria-label="Descrição" />
            <textarea
              required
              rows={12}
              value={editing.template}
              onChange={(e) => setEditing({ ...editing, template: e.target.value })}
              placeholder={kind === 'skill' ? 'Instrução… use {{selecao}} para o texto a modificar' : 'Instrução… use {{documento}} para o conteúdo anexado e {{entrada}} para o pedido'}
              aria-label="Modelo do prompt"
            />
            <div className="row">
              <button className="btn btn-primary btn-sm">Salvar</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>
                Cancelar
              </button>
            </div>
          </form>
        )}
        <div className="prompt-grid">
          {list.map((p) => (
            <article key={p.id} className="prompt-card">
              <header>
                <h3>{p.name}</h3>
                {p.builtin ? <span className="tag">padrão</span> : <span className="tag tag-user">seu</span>}
              </header>
              <p className="muted small">{p.description}</p>
              <pre className="prompt-pre">{p.template.slice(0, 260)}{p.template.length > 260 ? '…' : ''}</pre>
              <div className="row">
                {p.kind === 'prompt' && (
                  <button className="btn btn-sm btn-primary" onClick={() => actions.openLlm(provider, { promptId: p.id })}>
                    Usar
                  </button>
                )}
                <button className="btn btn-sm" onClick={() => setEditing({ ...p })}>
                  Editar
                </button>
                {!p.builtin && (
                  <button className="btn btn-sm btn-ghost" onClick={() => deleteTemplate(p.id)}>
                    {BUILTIN_IDS.has(p.id) ? 'Restaurar padrão' : 'Excluir'}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
