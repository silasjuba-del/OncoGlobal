// Tag <webview> do Electron (abas "Site"): atributos usados pelo app.
declare namespace JSX {
  interface IntrinsicElements {
    webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      src?: string;
      partition?: string;
      allowpopups?: string;
      useragent?: string;
    };
  }
}
