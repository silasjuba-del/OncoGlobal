/** Autoridade única de teclado/foco dos diálogos registrados por documento. */
const FOCAVEIS = 'a[href],button,input,select,textarea,summary,[contenteditable="true"],[tabindex]';

function visivel(elemento: HTMLElement): boolean {
  if (!elemento.isConnected) return false;
  for (let atual: HTMLElement | null = elemento; atual; atual = atual.parentElement) {
    const estilo = atual.ownerDocument.defaultView!.getComputedStyle(atual);
    if (atual.hidden || atual.hasAttribute("inert") || atual.getAttribute("aria-hidden") === "true"
      || estilo.display === "none" || estilo.visibility === "hidden" || estilo.visibility === "collapse") return false;
    if (atual.tagName === "DETAILS" && !atual.hasAttribute("open")) {
      const resumo = atual.querySelector(":scope > summary");
      if (elemento !== atual && !resumo?.contains(elemento)) return false;
    }
  }
  return true;
}

function focaveis(raiz: HTMLElement): HTMLElement[] {
  return [...raiz.querySelectorAll<HTMLElement>(FOCAVEIS)]
    .filter(el => el.tabIndex >= 0 && !el.matches(':disabled,input[type="hidden"]') && visivel(el))
    .sort((a, b) => (a.tabIndex || Number.MAX_SAFE_INTEGER) - (b.tabIndex || Number.MAX_SAFE_INTEGER));
}

type Contexto = { elemento: HTMLElement; z: number };

/** Contextos usados nas telas: z-index, fixed/sticky, transform, opacity e isolation.
 * A comparação é por ancestral comum: z-index de um filho nunca ultrapassa o contexto pai.
 * Não substitui a top layer nativa (<dialog>.showModal/popover), que não é usada aqui.
 */
function contextos(elemento: HTMLElement): Contexto[] {
  const caminho: Contexto[] = [];
  for (let atual: HTMLElement | null = elemento; atual; atual = atual.parentElement) {
    const css = atual.ownerDocument.defaultView!.getComputedStyle(atual);
    const z = Number.parseInt(css.zIndex, 10);
    if (Number.isFinite(z) || css.position === "fixed" || css.position === "sticky"
      || (css.transform && css.transform !== "none") || (css.opacity && Number(css.opacity) < 1)
      || css.isolation === "isolate") caminho.unshift({ elemento: atual, z: Number.isFinite(z) ? z : 0 });
  }
  return caminho;
}

function depois(a: HTMLElement, b: HTMLElement): boolean {
  return !!(b.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING);
}

function acima(a: HTMLElement, b: HTMLElement): boolean {
  if (b.contains(a)) return true;
  if (a.contains(b)) return false;
  const ca = contextos(a), cb = contextos(b);
  let i = 0;
  while (ca[i] && cb[i] && ca[i]!.elemento === cb[i]!.elemento) i++;
  const x = ca[i], y = cb[i];
  if ((x?.z ?? 0) !== (y?.z ?? 0)) return (x?.z ?? 0) > (y?.z ?? 0);
  return depois(x?.elemento ?? a, y?.elemento ?? b);
}

function topo(documento: Document, excluir?: Element): HTMLElement | undefined {
  return [...documento.querySelectorAll<HTMLElement>('[role="dialog"]')]
    .filter(el => el !== excluir && !excluir?.contains(el) && visivel(el))
    .reduce<HTMLElement | undefined>((atual, el) => !atual || acima(el, atual) ? el : atual, undefined);
}

export function camadaCoberta(raiz: Element): boolean {
  const ativa = topo(raiz.ownerDocument);
  return !!ativa && ativa !== raiz;
}

type Camada = {
  raiz: HTMLElement;
  fechar: () => void;
  focoNaRaiz: boolean;
  anterior: HTMLElement | null;
  ultimoFoco: HTMLElement | null;
};

type Controle = { registrar: (raiz: HTMLElement, fechar: () => void, focoNaRaiz: boolean) => () => void };
const controles = new WeakMap<Document, Controle>();

function criarControle(documento: Document): Controle {
  const camadas = new Map<HTMLElement, Camada>();
  const abridor = documento.activeElement instanceof HTMLElement ? documento.activeElement : null;
  let redirecionando = false;
  const ativa = () => {
    const raiz = topo(documento);
    return raiz ? camadas.get(raiz) : undefined;
  };
  function focar(camada: Camada, preferido?: HTMLElement | null) {
    const destino = preferido && camada.raiz.contains(preferido) && visivel(preferido) && !preferido.matches(":disabled")
      ? preferido : camada.focoNaRaiz ? camada.raiz : focaveis(camada.raiz)[0] ?? camada.raiz;
    destino.focus();
  }
  function teclado(evento: KeyboardEvent) {
    const camada = ativa();
    if (!camada || evento.defaultPrevented) return;
    if (evento.key === "Escape") {
      evento.preventDefault();
      // Um único consumidor; menus e camadas inferiores não recebem o mesmo Escape.
      evento.stopPropagation();
      camada.fechar();
    } else if (evento.key === "Tab") {
      const itens = focaveis(camada.raiz);
      const foco = documento.activeElement;
      const indice = itens.findIndex(el => el === foco);
      if (!itens.length || (evento.shiftKey ? indice <= 0 : indice < 0 || indice === itens.length - 1)) {
        evento.preventDefault();
        evento.stopPropagation();
        (evento.shiftKey ? itens.at(-1) ?? camada.raiz : itens[0] ?? camada.raiz).focus();
      }
    }
  }
  function foco(evento: FocusEvent) {
    if (redirecionando) return;
    const camada = ativa();
    if (!camada) return;
    const alvo = evento.target;
    if (alvo instanceof HTMLElement && camada.raiz.contains(alvo) && visivel(alvo)) {
      camada.ultimoFoco = alvo;
    } else {
      redirecionando = true;
      try { focar(camada, camada.ultimoFoco); } finally { redirecionando = false; }
    }
  }
  documento.addEventListener("keydown", teclado, true);
  documento.addEventListener("focusin", foco, true);
  return {
    registrar(raiz, fechar, focoNaRaiz) {
      const anterior = documento.activeElement instanceof HTMLElement ? documento.activeElement : null;
      const tabindex = raiz.getAttribute("tabindex");
      if (tabindex === null) raiz.tabIndex = -1;
      const camada: Camada = { raiz, fechar, focoNaRaiz, anterior, ultimoFoco: null };
      camadas.set(raiz, camada);
      if (!camadaCoberta(raiz)) focar(camada);
      return () => {
        const tinhaFoco = raiz.contains(documento.activeElement);
        camadas.delete(raiz);
        const restante = topo(documento, raiz);
        const registro = restante ? camadas.get(restante) : undefined;
        if (!camadas.size) {
          documento.removeEventListener("keydown", teclado, true);
          documento.removeEventListener("focusin", foco, true);
          controles.delete(documento);
        }
        if (registro && (tinhaFoco || !restante!.contains(documento.activeElement))) {
          focar(registro, anterior && restante!.contains(anterior) ? anterior : registro.ultimoFoco);
        } else if (!restante) {
          const destino = anterior && visivel(anterior) ? anterior : abridor && visivel(abridor) ? abridor : null;
          destino?.focus();
        }
        if (tabindex === null) raiz.removeAttribute("tabindex");
      };
    },
  };
}

export function registrarDialogo(raiz: HTMLElement, fechar: () => void, focoNaRaiz: boolean): () => void {
  const documento = raiz.ownerDocument;
  let controle = controles.get(documento);
  if (!controle) {
    controle = criarControle(documento);
    controles.set(documento, controle);
  }
  return controle.registrar(raiz, fechar, focoNaRaiz);
}
