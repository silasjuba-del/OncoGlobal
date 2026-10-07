/** Canvas de referência do OncoChart. A página não rola: a grade inteira é escalada. */
export const CANVAS_LARGURA = 1680;
export const CANVAS_ALTURA = 1000;

export interface EscalaCanvas {
  escala: number;
  x: number;
  y: number;
}

/** Letterbox centrado. Mesmas proporções em qualquer viewport. */
export function escalaDoCanvas(larguraJanela: number, alturaJanela: number): EscalaCanvas {
  if (larguraJanela <= 0 || alturaJanela <= 0) return { escala: 1, x: 0, y: 0 };
  const escala = Math.min(larguraJanela / CANVAS_LARGURA, alturaJanela / CANVAS_ALTURA);
  return {
    escala,
    x: (larguraJanela - CANVAS_LARGURA * escala) / 2,
    y: (alturaJanela - CANVAS_ALTURA * escala) / 2,
  };
}
