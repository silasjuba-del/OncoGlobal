import { flushSync } from "react-dom";

export function prefereMovimentoReduzido(): boolean {
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Revelação circular a partir do controle. Com movimento reduzido, troca na hora. */
export function revelarTema(origem: HTMLElement, aplicar: () => void): void {
  if (prefereMovimentoReduzido() || typeof document.startViewTransition !== "function") {
    aplicar();
    return;
  }
  const retangulo = origem.getBoundingClientRect();
  const x = retangulo.left + retangulo.width / 2;
  const y = retangulo.top + retangulo.height / 2;
  const rad = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  const transicao = document.startViewTransition(() => {
    flushSync(aplicar);
  });
  void transicao.ready.then(() => {
    if (typeof document.documentElement.animate !== "function") return;
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${rad}px at ${x}px ${y}px)`] },
      {
        duration: 650,
        easing: "cubic-bezier(.2,.8,.2,1)",
        pseudoElement: "::view-transition-new(root)",
      } as KeyframeAnimationOptions,
    );
  });
}
