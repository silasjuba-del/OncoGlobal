// Navegador dentro do app (<webview> isolado, sem Node/preload). O texto lido das páginas é tratado como dado,
// nunca como instrução: só vai para a IA/biblioteca quando o usuário clica.
import { useEffect, useRef, useState } from 'react';
import { useActions } from '../app/actions';
import { imageAttachment, textAttachment } from '../ai/attachments';
import { addDoc } from '../ai/library';
import { IconBack, IconForward, IconRotate, IconStar } from '../components/icons';
import { isDesktop, saveFile } from '../platform/platform';
import { setUi, useAppState } from '../store/store';

interface WebviewEl extends HTMLElement {
  loadURL(url: string): Promise<void>;
  goBack(): void;
  goForward(): void;
  reload(): void;
  canGoBack(): boolean;
  canGoForward(): boolean;
  getURL(): string;
  getTitle(): string;
  executeJavaScript<T = unknown>(code: string): Promise<T>;
  printToPDF(opts: { printBackground?: boolean; pageSize?: string }): Promise<Uint8Array>;
  capturePage(): Promise<{ toDataURL(): string; toPNG(): Uint8Array }>;
}

export function normalizeUrl(input: string, home: string): string {
  const v = input.trim();
  if (!v) return home;
  if (/^(https?|app):\/\//i.test(v)) return v;
  if (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(v)) return `http://${v}`;
  if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(v)) return `https://${v}`;
  return `https://www.google.com/search?q=${encodeURIComponent(v)}`;
}

const safeName = (s: string) => s.replace(/[<>:"/\\|?*]+/g, ' ').trim().slice(0, 80) || 'pagina';

export function BrowserPage({
  initialUrl,
  partition,
  label,
  onTitle,
}: {
  initialUrl: string;
  partition: 'persist:web' | 'persist:oncoglobal';
  label?: string;
  onTitle?(title: string): void;
}) {
  const actions = useActions();
  const { settings } = useAppState();
  const ui = settings.ui;
  const ref = useRef<WebviewEl | null>(null);
  const [ready, setReady] = useState(false);
  const [address, setAddress] = useState(initialUrl || ui.homeUrl);
  const [current, setCurrent] = useState({ url: initialUrl || ui.homeUrl, title: label ?? '' });
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [nav, setNav] = useState({ back: false, fwd: false });
  const startUrl = useRef(normalizeUrl(initialUrl, ui.homeUrl));
  const onTitleRef = useRef(onTitle);
  onTitleRef.current = onTitle;

  useEffect(() => {
    const wv = ref.current;
    if (!wv) return;
    const sync = () => {
      setCurrent({ url: wv.getURL(), title: wv.getTitle() });
      onTitleRef.current?.(wv.getTitle() || wv.getURL());
      setAddress(wv.getURL());
      setNav({ back: wv.canGoBack(), fwd: wv.canGoForward() });
    };
    const onReady = () => setReady(true);
    const onStart = () => {
      setLoading(true);
      setFailed(null);
    };
    const onStop = () => {
      setLoading(false);
      sync();
    };
    const onFail = (e: Event) => {
      const ev = e as Event & { errorCode: number; errorDescription: string; isMainFrame: boolean; validatedURL: string };
      if (ev.isMainFrame && ev.errorCode !== -3) setFailed(`${ev.errorDescription} (${ev.validatedURL})`);
    };
    wv.addEventListener('dom-ready', onReady);
    wv.addEventListener('did-start-loading', onStart);
    wv.addEventListener('did-stop-loading', onStop);
    wv.addEventListener('did-navigate-in-page', sync);
    wv.addEventListener('page-title-updated', sync);
    wv.addEventListener('did-fail-load', onFail);
    return () => {
      wv.removeEventListener('dom-ready', onReady);
      wv.removeEventListener('did-start-loading', onStart);
      wv.removeEventListener('did-stop-loading', onStop);
      wv.removeEventListener('did-navigate-in-page', sync);
      wv.removeEventListener('page-title-updated', sync);
      wv.removeEventListener('did-fail-load', onFail);
    };
  }, []);

  const go = (input: string) => {
    const url = normalizeUrl(input, ui.homeUrl);
    setAddress(url);
    if (ready) void ref.current?.loadURL(url).catch(() => {});
  };

  const readPage = async () => {
    const wv = ref.current;
    if (!wv) throw new Error('Página não carregada.');
    return wv.executeJavaScript<{ title: string; url: string; text: string }>(
      '({ title: document.title, url: location.href, text: (document.body && document.body.innerText) || "" })',
    );
  };

  const guard = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      actions.toast((e as Error).message, 'error');
    }
  };

  const isFav = ui.favorites.some((f) => f.url === current.url);

  if (!isDesktop()) {
    return (
      <div className="site-fallback">
        <p>O navegador interno funciona no app desktop.</p>
        <a className="btn btn-primary" href={startUrl.current} target="_blank" rel="noopener noreferrer">
          Abrir {startUrl.current} em nova janela
        </a>
      </div>
    );
  }

  return (
    <div className="browser">
      <div className="browser-bar">
        <button className="icon-btn" aria-label="Voltar" disabled={!nav.back} onClick={() => ref.current?.goBack()}>
          <IconBack />
        </button>
        <button className="icon-btn" aria-label="Avançar" disabled={!nav.fwd} onClick={() => ref.current?.goForward()}>
          <IconForward />
        </button>
        <button className="icon-btn" aria-label="Recarregar" onClick={() => ref.current?.reload()}>
          <IconRotate />
        </button>
        <form
          className="browser-url"
          onSubmit={(e) => {
            e.preventDefault();
            go(address);
          }}
        >
          <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} onFocus={(e) => e.target.select()} aria-label="Endereço ou pesquisa" spellCheck={false} />
          {loading && <span className="browser-spin" aria-label="Carregando" />}
        </form>
        <button
          className={`icon-btn ${isFav ? 'on' : ''}`}
          aria-label={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          aria-pressed={isFav}
          onClick={() =>
            setUi({
              favorites: isFav ? ui.favorites.filter((f) => f.url !== current.url) : [...ui.favorites, { name: (current.title || current.url).slice(0, 40), url: current.url }],
            })
          }
        >
          <IconStar />
        </button>
        <div className="browser-actions">
          <button
            className="btn btn-sm"
            title="Enviar o texto visível da página ao Claude"
            onClick={() =>
              guard(async () => {
                const p = await readPage();
                actions.openLlm('claude', { attachments: [textAttachment(`Página: ${p.title || p.url}`, `Fonte: ${p.url}\n\n${p.text}`, p.url)] });
              })
            }
          >
            Ler → IA
          </button>
          <button
            className="btn btn-sm"
            onClick={() =>
              guard(async () => {
                const p = await readPage();
                const d = addDoc(p.title || p.url, 'texto', [{ text: p.text }], p.url);
                actions.toast(`Página na biblioteca (${d.chunks.length} trechos).`, 'success');
              })
            }
          >
            → Biblioteca
          </button>
          <button
            className="btn btn-sm"
            title="Salvar a página como PDF e abrir no visualizador"
            onClick={() =>
              guard(async () => {
                const bytes = await ref.current!.printToPDF({ printBackground: true, pageSize: 'A4' });
                const name = `${safeName(current.title || 'pagina')}.pdf`;
                actions.openViewer({ name, bytes: new Uint8Array(bytes), path: null });
              })
            }
          >
            Página → PDF
          </button>
          <button
            className="btn btn-sm"
            title="Captura da área visível"
            onClick={() =>
              guard(async () => {
                const img = await ref.current!.capturePage();
                const url = img.toDataURL();
                const bytes = Uint8Array.from(atob(url.split(',')[1]), (c) => c.charCodeAt(0));
                const att = await imageAttachment(`Print ${current.title || current.url}.png`, bytes, 'image/png');
                actions.openLlm('claude', { attachments: [att], promptId: 'foto-prompt' });
              })
            }
          >
            Print → IA
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() =>
              guard(async () => {
                const img = await ref.current!.capturePage();
                await saveFile(`${safeName(current.title || 'print')}.png`, new Uint8Array(img.toPNG()));
              })
            }
          >
            Salvar print
          </button>
        </div>
      </div>
      {ui.favorites.length > 0 && (
        <div className="favorites" aria-label="Sites preferidos">
          {ui.favorites.map((f) => (
            <button key={f.url} className="fav" onClick={() => go(f.url)} title={f.url}>
              {f.name}
            </button>
          ))}
        </div>
      )}
      {failed && (
        <div className="notice error browser-fail">
          Não foi possível carregar: {failed}
          {partition === 'persist:oncoglobal' && (
            <>
              <br />
              O OncoGlobal precisa estar rodando. No repositório do OncoGlobal: <code>npm run ui:dev</code>. Ajuste a URL em Configurações → Aparência.
            </>
          )}
        </div>
      )}
      <webview ref={ref as never} src={startUrl.current} partition={partition} allowpopups="true" className="site-webview" />
    </div>
  );
}
