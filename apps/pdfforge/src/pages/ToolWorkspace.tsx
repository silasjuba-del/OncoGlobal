import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { zipOutputs } from '../engine/archive';
import { useActions } from '../app/actions';
import { IconClose, IconDownload, IconGlobe, IconLock, IconPlus } from '../components/icons';
import { OptionsForm } from '../components/OptionsForm';
import { OrganizeEditor } from '../components/OrganizeEditor';
import { ToolIcon } from '../components/ToolIcon';
import { isImageName, probePdf, thumbnail } from '../engine/render';
import type { PagePlanItem } from '../engine/ops';
import { ToolError, type OutputFile } from '../engine/types';
import { FilePayload, fromFileList, openFiles, saveFile, saveMany, showInFolder } from '../platform/platform';
import { addHistory, attachSavedPaths, markToolUsed } from '../store/store';
import { TOOLS, toolById } from '../tools/catalog';
import type { Options, ToolDef } from '../tools/types';
import { ToolTile } from './HomeView';

interface WorkFile extends FilePayload {
  id: number;
  thumb: string | null;
  pages: number;
  locked: boolean;
  password?: string;
}

type Phase =
  | { kind: 'edit' }
  | { kind: 'running'; progress: number; label: string }
  | { kind: 'done'; outputs: OutputFile[]; saved: string[] | null; historyId: string }
  | { kind: 'error'; message: string };

let fileSeq = 0;

export function ToolWorkspace({ toolId, initialFiles }: { toolId: string; initialFiles?: FilePayload[] }) {
  const tool = toolById(toolId);
  if (!tool) return <div className="page empty">Ferramenta desconhecida: {toolId}</div>;
  if (tool.status === 'planned') return <PlannedTool tool={tool} />;
  return <ReadyTool tool={tool} initialFiles={initialFiles} />;
}

function PlannedTool({ tool }: { tool: ToolDef }) {
  return (
    <div className="page planned-page">
      <ToolIcon tool={tool} size={72} />
      <h1>{tool.name}</h1>
      <p>{tool.description}</p>
      <div className="notice">
        <strong>Em breve.</strong> {tool.plannedReason}
      </div>
    </div>
  );
}

function ReadyTool({ tool, initialFiles }: { tool: ToolDef; initialFiles?: FilePayload[] }) {
  const actions = useActions();
  const [files, setFiles] = useState<WorkFile[]>([]);
  const [options, setOptions] = useState<Options>(tool.defaults);
  const [phase, setPhase] = useState<Phase>({ kind: 'edit' });
  const [chainOpen, setChainOpen] = useState(false);
  const [dragId, setDragId] = useState<number | null>(null);
  const seeded = useRef(false);

  const accepts = (name: string) =>
    tool.accepts === 'image' ? isImageName(name) : tool.accepts === 'pdf' ? /\.pdf$/i.test(name) : true;

  const addFiles = useCallback(
    async (incoming: FilePayload[]) => {
      const ok = incoming.filter((f) => accepts(f.name));
      if (ok.length < incoming.length) {
        actions.toast(`${incoming.length - ok.length} arquivo(s) ignorado(s): formato não aceito por ${tool.name}.`, 'error');
      }
      if (!ok.length) return;
      let prepared: WorkFile[];
      try {
        prepared = await Promise.all(
          ok.map(async (f) => {
            if (tool.accepts === 'image') return { ...f, id: ++fileSeq, thumb: await thumbnail(f), pages: 1, locked: false };
            const probe = await probePdf(f.bytes);
            return { ...f, id: ++fileSeq, thumb: probe.thumb, pages: probe.pages, locked: probe.locked };
          }),
        );
      } catch (err) {
        actions.toast((err as Error).message, 'error');
        return;
      }
      if (tool.accepts === 'pdf') actions.rememberFiles(ok);
      if (tool.custom === 'editor') {
        actions.openEditor(ok[0]);
        return;
      }
      setFiles((cur) => {
        const merged = tool.multiple ? [...cur, ...prepared] : prepared.slice(-1);
        return tool.exactFiles ? merged.slice(-tool.exactFiles) : merged;
      });
      setPhase({ kind: 'edit' });
    },
    [tool],
  );

  useEffect(() => {
    if (!seeded.current && initialFiles?.length) {
      seeded.current = true;
      void addFiles(initialFiles);
    }
  }, [initialFiles, addFiles]);

  const pick = async () => addFiles(await openFiles(tool.accepts === 'image' ? 'image' : 'pdf', tool.multiple));

  const unlockCard = async (id: number, password: string) => {
    const f = files.find((x) => x.id === id);
    if (!f) return;
    const probe = await probePdf(f.bytes, password);
    if (probe.locked) {
      actions.toast('Senha incorreta.', 'error');
      return;
    }
    setFiles((cur) => cur.map((x) => (x.id === id ? { ...x, password, locked: false, thumb: probe.thumb, pages: probe.pages } : x)));
  };

  const onPlan = useCallback((plan: PagePlanItem[]) => setOptions((o) => ({ ...o, plan: JSON.stringify(plan) })), []);

  const blocker = useMemo(() => {
    if (tool.accepts === 'none') return null;
    if (files.length === 0) return 'Adicione arquivos para começar.';
    if (tool.exactFiles && files.length !== tool.exactFiles) return `Selecione exatamente ${tool.exactFiles} arquivos.`;
    if (tool.id === 'merge' && files.length < 2) return 'Adicione pelo menos dois PDFs.';
    if (files.some((f) => f.locked)) return 'Informe a senha dos arquivos protegidos.';
    return null;
  }, [files, tool]);

  const run = async () => {
    if (blocker || !tool.run) return;
    const started = Date.now();
    markToolUsed(tool.id);
    setPhase({ kind: 'running', progress: 0, label: 'Preparando…' });
    try {
      const outputs = await tool.run(
        files.map((f) => ({ name: f.name, bytes: f.bytes, path: f.path, password: f.password })),
        options,
        { progress: (p, label) => setPhase({ kind: 'running', progress: Math.min(1, p), label: label ?? '' }) },
      );
      const historyId = addHistory({
        toolId: tool.id,
        toolName: tool.name,
        at: started,
        durationMs: Date.now() - started,
        inputs: files.map((f) => f.name),
        outputs: outputs.map((o) => ({ name: o.name, path: null, size: o.bytes.length })),
        status: 'ok',
      });
      setPhase({ kind: 'done', outputs, saved: null, historyId });
    } catch (err) {
      const message = err instanceof ToolError ? err.message : `Erro inesperado: ${(err as Error).message}`;
      if (!(err instanceof ToolError)) console.error(err);
      setPhase({ kind: 'error', message });
      addHistory({
        toolId: tool.id,
        toolName: tool.name,
        at: started,
        durationMs: Date.now() - started,
        inputs: files.map((f) => f.name),
        outputs: [],
        status: 'error',
        error: message,
      });
    }
  };

  if (phase.kind === 'running') {
    return (
      <div className="page processing">
        <ToolIcon tool={tool} size={64} />
        <h2>Processando…</h2>
        <div className="progress" role="progressbar" aria-valuenow={Math.round(phase.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div style={{ width: `${Math.max(4, phase.progress * 100)}%` }} />
        </div>
        <p className="muted">{phase.label}</p>
      </div>
    );
  }

  if (phase.kind === 'done') {
    return (
      <ResultView
        tool={tool}
        outputs={phase.outputs}
        saved={phase.saved}
        onSaved={(saved) => {
          if (saved.some((p) => /[\\/]/.test(p))) attachSavedPaths(phase.historyId, saved);
          setPhase({ ...phase, saved });
        }}
        onBack={() => setPhase({ kind: 'edit' })}
        chainOpen={chainOpen}
        setChainOpen={setChainOpen}
      />
    );
  }

  const showOrganize = tool.custom === 'organize' && files[0] && !files[0].locked;

  return (
    <div
      className="workspace"
      onDragOver={(e) => e.dataTransfer.types.includes('Files') && e.preventDefault()}
      onDrop={async (e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        await addFiles(await fromFileList(e.dataTransfer.files));
      }}
    >
      <div className="work-main">
        <div className="work-title">
          <ToolIcon tool={tool} size={40} />
          <div>
            <h1>{tool.name}</h1>
            <p className="muted">{tool.description}</p>
          </div>
          {tool.internet && (
            <span className="pill" title="Baixa modelos de idioma na primeira execução">
              <IconGlobe width={14} height={14} /> Requer internet
            </span>
          )}
        </div>

        {tool.accepts === 'none' ? (
          <div className="dropzone big">
            <span className="muted">Preencha as opções ao lado e clique em “{tool.actionText}”.</span>
          </div>
        ) : files.length === 0 ? (
          <div className="dropzone big">
            <button className="btn btn-primary btn-lg" onClick={pick}>
              Selecionar {tool.accepts === 'image' ? 'imagens' : tool.multiple ? 'arquivos PDF' : 'arquivo PDF'}
            </button>
            <span className="muted">ou arraste e solte aqui</span>
          </div>
        ) : showOrganize ? (
          <OrganizeEditor bytes={files[0].bytes} password={files[0].password} onPlan={onPlan} />
        ) : (
          <div className="file-grid">
            {files.map((f, pos) => (
              <div
                key={f.id}
                className={`file-card ${dragId === f.id ? 'dragging' : ''}`}
                draggable={files.length > 1}
                onDragStart={() => setDragId(f.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  if (dragId === null) return;
                  e.preventDefault();
                  e.stopPropagation();
                  setFiles((cur) => {
                    const from = cur.findIndex((x) => x.id === dragId);
                    const next = [...cur];
                    const [it] = next.splice(from, 1);
                    next.splice(pos, 0, it);
                    return next;
                  });
                  setDragId(null);
                }}
                onDragEnd={() => setDragId(null)}
              >
                <button className="file-remove" aria-label={`Remover ${f.name}`} onClick={() => setFiles((cur) => cur.filter((x) => x.id !== f.id))}>
                  <IconClose width={14} height={14} />
                </button>
                {tool.exactFiles === 2 && <span className="file-role">{pos === 0 ? 'Original' : 'Revisado'}</span>}
                <div className="file-thumb">
                  {f.locked ? <IconLock width={40} height={40} /> : f.thumb ? <img src={f.thumb} alt="" /> : <span className="doc-placeholder">PDF</span>}
                </div>
                <div className="file-name" title={f.name}>
                  {f.name}
                </div>
                <div className="file-meta">
                  {f.locked ? 'Protegido' : tool.accepts === 'image' ? formatSize(f.bytes.length) : `${f.pages} pág. · ${formatSize(f.bytes.length)}`}
                </div>
                {f.locked && <PasswordInput onSubmit={(pw) => unlockCard(f.id, pw)} />}
              </div>
            ))}
            {tool.multiple && (
              <button className="file-add" onClick={pick} title="Adicionar mais arquivos">
                <IconPlus width={28} height={28} />
                <span>Adicionar</span>
              </button>
            )}
          </div>
        )}
      </div>

      <aside className="work-side">
        <h2>Opções</h2>
        {tool.fields?.length ? (
          <OptionsForm fields={tool.fields} value={options} onChange={setOptions} />
        ) : (
          <p className="muted">{tool.custom === 'organize' ? 'Arraste as páginas para reordenar; use os botões de cada página para girar, excluir ou inserir em branco.' : 'Nenhuma opção necessária.'}</p>
        )}
        {phase.kind === 'error' && <div className="notice error">{phase.message}</div>}
        <div className="side-footer">
          {blocker && files.length > 0 && <small className="muted">{blocker}</small>}
          <button className="btn btn-primary btn-block btn-lg" disabled={Boolean(blocker)} onClick={run}>
            {tool.actionText}
          </button>
        </div>
      </aside>
    </div>
  );
}

function PasswordInput({ onSubmit }: { onSubmit(pw: string): void }) {
  const [pw, setPw] = useState('');
  return (
    <form
      className="pw-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (pw) onSubmit(pw);
      }}
    >
      <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Senha" aria-label="Senha do PDF" autoComplete="off" />
      <button className="btn btn-sm" type="submit">
        OK
      </button>
    </form>
  );
}

function ResultView({
  tool,
  outputs,
  saved,
  onSaved,
  onBack,
  chainOpen,
  setChainOpen,
}: {
  tool: ToolDef;
  outputs: OutputFile[];
  saved: string[] | null;
  onSaved(paths: string[]): void;
  onBack(): void;
  chainOpen: boolean;
  setChainOpen(v: boolean): void;
}) {
  const actions = useActions();
  const pdfOutputs = outputs.filter((o) => o.mime === 'application/pdf');
  const html = outputs.find((o) => o.mime === 'text/html');
  const total = outputs.reduce((s, o) => s + o.bytes.length, 0);

  const saveAll = async () => {
    const result = outputs.length === 1 ? await saveFile(outputs[0].name, outputs[0].bytes).then((p) => (p ? [p] : null)) : await saveMany(outputs);
    if (result) {
      onSaved(result);
      actions.toast(`${result.length} arquivo(s) salvo(s).`, 'success');
    }
  };

  const saveZip = async () => {
    const bytes = await zipOutputs(outputs);
    const p = await saveFile(`${tool.id}_${outputs.length}_arquivos.zip`, bytes);
    if (p) {
      onSaved([p]);
      actions.toast('ZIP salvo.', 'success');
    }
  };

  const chainTargets = TOOLS.filter((t) => t.status === 'ready' && t.accepts === 'pdf' && t.id !== tool.id);

  return (
    <div className="page result">
      <div className="result-head">
        <ToolIcon tool={tool} size={56} />
        <div>
          <h1>Pronto!</h1>
          <p className="muted">
            {outputs.length} arquivo(s) gerado(s) · {formatSize(total)}
          </p>
        </div>
      </div>

      <div className="result-actions">
        <button className="btn btn-primary btn-lg" onClick={saveAll}>
          <IconDownload /> {outputs.length === 1 ? 'Salvar arquivo' : 'Salvar em uma pasta'}
        </button>
        {outputs.length > 1 && (
          <button className="btn btn-lg" onClick={saveZip}>
            Salvar como ZIP
          </button>
        )}
        {pdfOutputs.length > 0 && (
          <button className="btn btn-lg" onClick={() => setChainOpen(!chainOpen)}>
            Continuar com outra ferramenta
          </button>
        )}
        <button className="btn btn-ghost btn-lg" onClick={onBack}>
          Voltar às opções
        </button>
      </div>

      {saved && saved.length > 0 && saved[0].match(/[\\/]/) && (
        <p className="muted">
          Salvo em <button className="link" onClick={() => showInFolder(saved[0])}>{saved[0]}</button>
          {saved.length > 1 && ` e mais ${saved.length - 1}`}
        </p>
      )}

      {chainOpen && (
        <div className="chain">
          <h2>Usar o resultado em…</h2>
          <div className="tool-row">
            {chainTargets.map((t) => (
              <ToolTile
                key={t.id}
                tool={t}
                compact
                onPick={(target) => {
                  setChainOpen(false);
                  actions.openTool(target.id, pdfOutputs.map((o) => ({ name: o.name, bytes: o.bytes, path: null })));
                }}
              />
            ))}
          </div>
        </div>
      )}

      {html && <iframe className="report" title="Relatório" sandbox="" srcDoc={new TextDecoder().decode(html.bytes)} />}

      <ul className="output-list">
        {outputs.map((o) => (
          <li key={o.name}>
            <span className="out-name">{o.name}</span>
            <span className="muted">{formatSize(o.bytes.length)}</span>
            {o.mime === 'application/pdf' && (
              <button className="link" onClick={() => actions.openViewer({ name: o.name, bytes: o.bytes, path: null })}>
                Visualizar
              </button>
            )}
            <button className="link" onClick={() => saveFile(o.name, o.bytes)}>
              Salvar
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
