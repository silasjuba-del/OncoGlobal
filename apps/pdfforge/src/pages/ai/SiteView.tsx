import { isDesktop } from '../../platform/platform';

/** Site do provedor embutido (sessão própria e persistente por aba). No navegador, oferece abrir em nova janela. */
export function SiteView({ url, partition, name }: { url: string; partition: string; name: string }) {
  if (!isDesktop()) {
    return (
      <div className="site-fallback">
        <p>O site embutido funciona no app desktop.</p>
        <a className="btn btn-primary" href={url} target="_blank" rel="noopener noreferrer">
          Abrir {name} em nova janela
        </a>
      </div>
    );
  }
  return (
    <div className="site-view">
      <webview src={url} partition={partition} allowpopups="true" className="site-webview" />
      <p className="site-hint muted">
        Login com Google pode ser bloqueado em janelas embutidas; nesse caso entre com e-mail ou use{' '}
        <a href={url} target="_blank" rel="noopener noreferrer">
          o navegador
        </a>
        .
      </p>
    </div>
  );
}
