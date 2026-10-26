import { useEffect, useRef } from "react";

const FOCAVEIS = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * A camada com maior z-index recebe o teclado; empates seguem a ordem do DOM.
 * Uma camada coberta não reage a Esc nem a Tab; senão um Esc fecharia duas camadas de uma vez.
 */
function dialogoTopo(excluir?: Element): HTMLElement | undefined {
  const dialogos = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')]
    .filter(el => el !== excluir && !excluir?.contains(el) && !el.hidden && getComputedStyle(el).display !== "none" && getComputedStyle(el).visibility !== "hidden");
  const topo = dialogos.reduce<HTMLElement | undefined>((atual, el) => {
    const z = (item: HTMLElement) => Number.parseInt(getComputedStyle(item).zIndex, 10) || 0;
    return !atual || z(el) >= z(atual) ? el : atual;
  }, undefined);
  return topo;
}

export function camadaCoberta(raiz: Element): boolean {
  const topo = dialogoTopo();
  return !!topo && topo !== raiz && !topo.contains(raiz);
}

/**
 * Diálogo modal: Esc fecha, Tab/Shift+Tab ficam presos no diálogo e o foco volta
 * ao elemento que abriu ao fechar.
 */
function focaveis(raiz: HTMLElement): HTMLElement[] {
  return [...raiz.querySelectorAll<HTMLElement>(FOCAVEIS)].filter(el => el.tabIndex !== -1);
}

export function useDialogoAcessivel<T extends HTMLElement>(aoFechar: () => void, focoNaRaiz = false) {
  const ref = useRef<T>(null);
  const fechar = useRef(aoFechar);
  fechar.current = aoFechar;
  useEffect(() => {
    const raiz = ref.current;
    if (!raiz) return;
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!camadaCoberta(raiz)) (focoNaRaiz ? raiz : focaveis(raiz)[0] ?? raiz).focus();
    const aoTeclar = (e: KeyboardEvent) => {
      if (camadaCoberta(raiz)) return;
      if (e.key === "Escape") { e.preventDefault(); fechar.current(); return; }
      if (e.key !== "Tab" || !raiz) return;
      const itens = focaveis(raiz);
      if (!itens.length) { e.preventDefault(); raiz.focus(); return; }
      const primeiro = itens[0]!, ultimo = itens[itens.length - 1]!;
      const ativo = document.activeElement;
      if (e.shiftKey && (ativo === primeiro || !raiz.contains(ativo))) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && (ativo === ultimo || !raiz.contains(ativo))) { e.preventDefault(); primeiro.focus(); }
    };
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      const restante = dialogoTopo(raiz);
      if (restante) {
        if (anterior?.isConnected && restante.contains(anterior)) anterior.focus();
        else if (!restante.contains(document.activeElement)) (focaveis(restante)[0] ?? restante).focus();
      } else if (anterior?.isConnected) anterior.focus();
    };
  }, []);
  return ref;
}
