import { Component, type ReactNode } from "react";

/** Falha de um chunk/tela preserva a navegação e apresenta mensagem sem o conteúdo do erro. */
export class LimiteModulo extends Component<{ children: ReactNode }, { falhou: boolean }> {
  state = { falhou: false };
  static getDerivedStateFromError() { return { falhou: true }; }
  render() {
    if (!this.state.falhou) return this.props.children;
    return <section role="alert"><p>Não foi possível abrir este módulo. Os registros salvos permanecem preservados.</p>
      <button type="button" onClick={() => window.location.reload()}>Recarregar aplicativo</button></section>;
  }
}
