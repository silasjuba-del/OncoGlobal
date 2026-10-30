// Configurações de IA e plugins: chaves (cifradas no processo principal), modelos, esforço, transcrição, pastas.
import { useEffect, useState } from 'react';
import { useActions } from '../../app/actions';
import { detectDrive, hasDesktopAi, keyStatus, listModels, pickFolder, PROVIDERS, setKey, type KeyStatus, type Provider } from '../../ai/bridge';
import { setAi, useAppState, type AiSettings } from '../../store/store';
import { AppearanceSection } from './AppearanceSection';

const KEY_HELP: Record<Provider, string> = {
  claude: 'console.anthropic.com → API keys',
  gpt: 'platform.openai.com → API keys (também usada na transcrição)',
  grok: 'console.x.ai → API keys',
  gemini: 'aistudio.google.com → Get API key',
};

export function SettingsPage() {
  const actions = useActions();
  const { settings } = useAppState();
  const ai = settings.ai;
  const [keys, setKeys] = useState<KeyStatus | null>(null);
  const [drafts, setDrafts] = useState<Partial<Record<Provider, string>>>({});
  const [models, setModels] = useState<Partial<Record<Provider, string[]>>>({});
  const [loading, setLoading] = useState<Provider | null>(null);
  const desktop = hasDesktopAi();

  useEffect(() => {
    void keyStatus().then(setKeys);
  }, []);

  const saveKey = async (p: Provider, value: string) => {
    try {
      setKeys(await setKey(p, value));
      setDrafts((d) => ({ ...d, [p]: '' }));
      actions.toast(value ? 'Chave salva (cifrada pelo Windows).' : 'Chave removida.', 'success');
    } catch (e) {
      actions.toast((e as Error).message, 'error');
    }
  };

  const loadModels = async (p: Provider) => {
    setLoading(p);
    try {
      setModels((m) => ({ ...m, [p]: [] }));
      const list = await listModels(p);
      setModels((m) => ({ ...m, [p]: list }));
      actions.toast(`${list.length} modelos disponíveis.`, 'success');
    } catch (e) {
      actions.toast((e as Error).message, 'error');
    } finally {
      setLoading(null);
    }
  };

  const folder = async (field: 'driveFolder' | 'plaudFolder', title: string) => {
    try {
      const dir = await pickFolder(title);
      if (dir) setAi({ [field]: dir } as Partial<AiSettings>);
    } catch (e) {
      actions.toast((e as Error).message, 'error');
    }
  };

  return (
    <div className="llm">
      <header className="llm-head">
        <span className="llm-badge" style={{ background: '#5C5C64' }}>
          ⚙
        </span>
        <div>
          <h1>Configurações de IA e plugins</h1>
          <span className="muted small">{desktop ? 'Chaves ficam no processo principal, cifradas com DPAPI.' : 'Abra o app desktop para configurar chaves e pastas.'}</span>
        </div>
      </header>
      <div className="page settings">
        <section>
          <h2 className="sub">Provedores</h2>
          <table className="history">
            <thead>
              <tr>
                <th>Provedor</th>
                <th>Chave de API</th>
                <th>Modelo</th>
              </tr>
            </thead>
            <tbody>
              {PROVIDERS.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.name}</strong>
                    <div className="muted small">{KEY_HELP[p.id]}</div>
                  </td>
                  <td>
                    <div className="row">
                      <span className={`tag ${keys?.[p.id] === 'missing' ? '' : 'tag-ok'}`}>
                        {keys ? { saved: 'salva', env: 'variável de ambiente', missing: 'ausente' }[keys[p.id]] : '—'}
                      </span>
                      <input
                        type="password"
                        autoComplete="off"
                        disabled={!desktop}
                        value={drafts[p.id] ?? ''}
                        onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                        placeholder="Colar nova chave"
                        aria-label={`Chave ${p.name}`}
                      />
                      <button className="btn btn-sm" disabled={!desktop || !drafts[p.id]} onClick={() => saveKey(p.id, drafts[p.id] ?? '')}>
                        Salvar
                      </button>
                      {keys?.[p.id] === 'saved' && (
                        <button className="link-danger" onClick={() => saveKey(p.id, '')}>
                          Remover
                        </button>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="row">
                      <input
                        type="text"
                        list={`models-${p.id}`}
                        value={ai.models[p.id]}
                        onChange={(e) => setAi({ models: { ...ai.models, [p.id]: e.target.value.trim() } })}
                        placeholder={p.id === 'claude' ? 'claude-opus-5-5' : 'Liste e escolha'}
                        aria-label={`Modelo ${p.name}`}
                      />
                      <datalist id={`models-${p.id}`}>
                        {(models[p.id] ?? []).map((m) => (
                          <option key={m} value={m} />
                        ))}
                      </datalist>
                      <button className="btn btn-sm" disabled={!desktop || loading === p.id} onClick={() => loadModels(p.id)}>
                        {loading === p.id ? '…' : 'Listar modelos'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="settings-grid">
          <div className="field">
            <label htmlFor="effort">Esforço de raciocínio (Claude)</label>
            <select id="effort" value={ai.effort} onChange={(e) => setAi({ effort: e.target.value as AiSettings['effort'] })}>
              <option value="low">Baixo — rápido e barato</option>
              <option value="medium">Médio</option>
              <option value="high">Alto — recomendado para documentos</option>
              <option value="xhigh">Muito alto</option>
              <option value="max">Máximo — mais caro</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="tmodel">Modelo de transcrição (microfone, Reels, áudio do Plaud)</label>
            <input id="tmodel" type="text" value={ai.transcribeModel} onChange={(e) => setAi({ transcribeModel: e.target.value.trim() })} />
            <small className="help">Usa a chave do GPT (API da OpenAI).</small>
          </div>
        </section>

        <section>
          <h2 className="sub">Plugins</h2>
          <div className="plugin-list">
            <div className="plugin">
              <h3>Google Drive</h3>
              <p className="muted small">Pasta local do Google Drive para Desktop. O app salva em “PDFForge” dentro dela e lê arquivos para anexar.</p>
              <div className="row">
                <code className="ellipsis">{ai.driveFolder || 'não definida'}</code>
                <button className="btn btn-sm" disabled={!desktop} onClick={() => folder('driveFolder', 'Pasta do Google Drive')}>
                  Escolher
                </button>
                <button
                  className="btn btn-sm"
                  disabled={!desktop}
                  onClick={async () => {
                    const d = await detectDrive().catch(() => null);
                    if (d) setAi({ driveFolder: d });
                    actions.toast(d ? `Drive encontrado: ${d}` : 'Drive não encontrado. Abra o Google Drive para Desktop ou escolha a pasta.', d ? 'success' : 'error');
                  }}
                >
                  Detectar
                </button>
              </div>
            </div>
            <div className="plugin">
              <h3>Plaud</h3>
              <p className="muted small">Pasta onde você exporta transcrições (txt, md, srt, docx) ou áudios do Plaud. Áudios são transcritos ao importar.</p>
              <div className="row">
                <code className="ellipsis">{ai.plaudFolder || 'não definida'}</code>
                <button className="btn btn-sm" disabled={!desktop} onClick={() => folder('plaudFolder', 'Pasta de exportações do Plaud')}>
                  Escolher
                </button>
              </div>
            </div>
            <div className="plugin">
              <h3>Word</h3>
              <p className="muted small">Importa .docx como fonte (botão “+ Word”) e exporta respostas e fontes como .docx formatado.</p>
            </div>
            <div className="plugin">
              <h3>WhatsApp</h3>
              <p className="muted small">Abre o WhatsApp Desktop (ou Web) com o texto pronto; você escolhe o contato e envia.</p>
            </div>
          </div>
        </section>
        <AppearanceSection />
      </div>
    </div>
  );
}
