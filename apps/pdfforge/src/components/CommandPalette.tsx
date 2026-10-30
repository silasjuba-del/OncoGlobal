// Paleta de comandos (Ctrl+K) em <dialog> nativo: foco preso, Esc fecha, setas navegam, Enter executa.
import { useEffect, useMemo, useRef, useState } from 'react';
import { filterCommands, useCommands, type Command } from '../app/commands';
import { IconSearch } from './icons';

export function CommandPalette({ open, onClose }: { open: boolean; onClose(): void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const all = useCommands();
  const results = useMemo(() => filterCommands(all, query), [all, query]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setQuery('');
      setIndex(0);
      d.showModal();
    } else if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => setIndex(0), [query]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  const run = (c: Command | undefined) => {
    if (!c) return;
    onClose();
    // Executa depois de fechar o diálogo, para o foco voltar à página antes da ação.
    setTimeout(() => c.run(), 0);
  };

  let lastGroup = '';
  return (
    <dialog
      ref={ref}
      className="palette"
      aria-label="Paleta de comandos"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="palette-input">
        <IconSearch />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setIndex((i) => Math.min(results.length - 1, i + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setIndex((i) => Math.max(0, i - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              run(results[index]);
            }
          }}
          placeholder="Buscar telas, ferramentas, arquivos, biblioteca, prompts…"
          aria-label="Buscar comando"
          aria-controls="palette-list"
          aria-activedescendant={results[index] ? `cmd-${results[index].id}` : undefined}
          role="combobox"
          aria-expanded="true"
        />
        <kbd>Esc</kbd>
      </div>
      <ul id="palette-list" ref={listRef} className="palette-list" role="listbox">
        {results.length === 0 && <li className="palette-empty">Nada encontrado para “{query}”.</li>}
        {results.map((c, i) => {
          const header = c.group !== lastGroup ? c.group : null;
          lastGroup = c.group;
          return (
            <li key={c.id} role="presentation">
              {header && <div className="palette-group">{header}</div>}
              <div
                id={`cmd-${c.id}`}
                role="option"
                aria-selected={i === index}
                data-index={i}
                className={`palette-item ${i === index ? 'on' : ''}`}
                onMouseMove={() => setIndex(i)}
                onClick={() => run(c)}
              >
                <span className="palette-label">{c.label}</span>
                {c.hint && <span className="palette-hint">{c.hint}</span>}
                {c.shortcut && <kbd>{c.shortcut}</kbd>}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="palette-foot">
        <span>
          <kbd>↑</kbd> <kbd>↓</kbd> navegar
        </span>
        <span>
          <kbd>Enter</kbd> abrir
        </span>
        <span>{results.length} resultado(s)</span>
      </div>
    </dialog>
  );
}
