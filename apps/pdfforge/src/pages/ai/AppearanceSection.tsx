// Personalização: nome, cor, densidade, raio, fonte, tamanho dos cards, itens do menu, favoritos, OncoGlobal e léxico.
import { useState } from 'react';
import { NAV_ITEMS } from '../../components/Drawer';
import { DEFAULT_LEXICON, parseLexicon } from '../../ai/lexicon';
import { resetUi, setAi, setUi, useAppState } from '../../store/store';

export function AppearanceSection() {
  const { settings } = useAppState();
  const ui = settings.ui;
  const [fav, setFav] = useState({ name: '', url: '' });
  const lex = parseLexicon(settings.ai.lexicon);

  return (
    <>
      <section>
        <div className="row space">
          <h2 className="sub">Aparência</h2>
          <button className="btn btn-sm btn-ghost" onClick={resetUi}>
            Restaurar padrão
          </button>
        </div>
        <div className="appearance-grid">
          <div className="field">
            <label htmlFor="ap-name">Nome do app</label>
            <input id="ap-name" type="text" value={ui.appName} onChange={(e) => setUi({ appName: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="ap-accent">Cor de destaque</label>
            <div className="row">
              <input id="ap-accent" type="color" value={ui.accent} onChange={(e) => setUi({ accent: e.target.value })} />
              {['#E5322D', '#0F9D8A', '#2E7BE6', '#A35FC9', '#E8710A'].map((c) => (
                <button key={c} className="swatch" style={{ background: c }} aria-label={`Usar ${c}`} onClick={() => setUi({ accent: c })} />
              ))}
            </div>
          </div>
          <div className="field">
            <label>Densidade</label>
            <div className="segmented">
              {(['compact', 'normal'] as const).map((d) => (
                <button key={d} className={ui.density === d ? 'on' : ''} onClick={() => setUi({ density: d })}>
                  {d === 'compact' ? 'Compacta' : 'Confortável'}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Tamanho dos cards</label>
            <div className="segmented">
              {(['small', 'medium'] as const).map((d) => (
                <button key={d} className={ui.cardSize === d ? 'on' : ''} onClick={() => setUi({ cardSize: d })}>
                  {d === 'small' ? 'Pequeno (ícone)' : 'Médio (com descrição)'}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="ap-radius">Arredondamento: {ui.radius}px</label>
            <input id="ap-radius" type="range" min={0} max={20} value={ui.radius} onChange={(e) => setUi({ radius: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label htmlFor="ap-font">Tamanho da fonte: {ui.fontSize}px</label>
            <input id="ap-font" type="range" min={12} max={18} value={ui.fontSize} onChange={(e) => setUi({ fontSize: Number(e.target.value) })} />
          </div>
        </div>
        <h3 className="sub-h">Itens da barra lateral</h3>
        <div className="nav-toggles">
          {NAV_ITEMS.map((i) => (
            <label key={i.id} className="check small">
              <input
                type="checkbox"
                checked={!ui.hiddenNav.includes(i.id)}
                disabled={i.id === 'settings'}
                onChange={(e) => setUi({ hiddenNav: e.target.checked ? ui.hiddenNav.filter((x) => x !== i.id) : [...ui.hiddenNav, i.id] })}
              />
              <span>{i.label}</span>
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2 className="sub">Navegador e OncoGlobal</h2>
        <div className="appearance-grid">
          <div className="field">
            <label htmlFor="ap-home">Página inicial do navegador</label>
            <input id="ap-home" type="text" value={ui.homeUrl} onChange={(e) => setUi({ homeUrl: e.target.value.trim() })} />
          </div>
          <div className="field">
            <label htmlFor="ap-onco">Endereço do OncoGlobal</label>
            <input id="ap-onco" type="text" value={ui.oncoglobalUrl} onChange={(e) => setUi({ oncoglobalUrl: e.target.value.trim() })} />
            <small className="help">No repositório OncoGlobal: npm run ui:dev (Vite, porta 5173 por padrão).</small>
          </div>
        </div>
        <div className="fav-edit">
          <h3 className="sub-h">Sites preferidos (portais de exames, diretrizes)</h3>
          <ul>
            {ui.favorites.map((f) => (
              <li key={f.url}>
                <strong>{f.name}</strong>
                <span className="muted small ellipsis">{f.url}</span>
                <button className="link-danger small" onClick={() => setUi({ favorites: ui.favorites.filter((x) => x.url !== f.url) })}>
                  remover
                </button>
              </li>
            ))}
          </ul>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              const url = /^https?:\/\//.test(fav.url.trim()) ? fav.url.trim() : `https://${fav.url.trim()}`;
              setUi({ favorites: [...ui.favorites, { name: fav.name.trim() || url, url }] });
              setFav({ name: '', url: '' });
            }}
          >
            <input type="text" value={fav.name} onChange={(e) => setFav({ ...fav, name: e.target.value })} placeholder="Nome (ex.: Laboratório X)" aria-label="Nome do site" />
            <input type="text" value={fav.url} onChange={(e) => setFav({ ...fav, url: e.target.value })} placeholder="URL do portal" aria-label="URL do site" />
            <button className="btn btn-sm btn-primary" disabled={!fav.url.trim()}>
              Adicionar
            </button>
          </form>
        </div>
      </section>

      <section>
        <div className="row space">
          <h2 className="sub">Léxico de transcrição</h2>
          <div className="row">
            <span className="muted small">
              {lex.terms.length} termos · {lex.rules.length} correções
            </span>
            <button className="btn btn-sm btn-ghost" onClick={() => setAi({ lexicon: DEFAULT_LEXICON })}>
              Restaurar léxico de oncologia
            </button>
          </div>
        </div>
        <p className="muted small">
          Um termo por linha vira vocabulário do motor de transcrição; “errado =&gt; certo” corrige o texto depois. Vale para microfone, vídeos, Reels e áudios do Plaud.
        </p>
        <textarea className="lexicon-box" value={settings.ai.lexicon} onChange={(e) => setAi({ lexicon: e.target.value })} aria-label="Léxico de transcrição" spellCheck={false} />
      </section>
    </>
  );
}
