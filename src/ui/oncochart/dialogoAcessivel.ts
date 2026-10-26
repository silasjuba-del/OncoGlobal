import { useEffect, useRef } from "react";
import { registrarDialogo } from "./camadasDialogo.js";
export { camadaCoberta } from "./camadasDialogo.js";

/** Adaptador React; teclado, pilha e restauração pertencem ao controlador por documento. */
export function useDialogoAcessivel<T extends HTMLElement>(aoFechar: () => void, focoNaRaiz = false) {
  const ref = useRef<T>(null);
  const fechar = useRef(aoFechar);
  fechar.current = aoFechar;
  useEffect(() => {
    const raiz = ref.current;
    if (!raiz) return;
    return registrarDialogo(raiz, () => fechar.current(), focoNaRaiz);
  }, [focoNaRaiz]);
  return ref;
}
