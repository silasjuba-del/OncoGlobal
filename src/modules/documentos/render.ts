// GRK-04 · Template + fatos CONFIRMADOS. A entrada não tem Alerta (INV-09).
import { hashCanonico } from "../tipos.js";

const FATO_CONFLITO = Symbol("fato-conflito");

export interface TemplateDocumento {
  templateId: string;
  versao: string;
  campos: readonly string[];
}

export interface FatoConfirmado {
  campo: string;
  valor: string;
  revisao: "CONFIRMADO" | "ASSINADO";
}

/** Objeto Alerta não satisfaz esta forma: falta template/fatos e sobra o tipo do chat. */
export interface EntradaRender {
  template: TemplateDocumento;
  fatos: readonly FatoConfirmado[];
}

export interface DocumentoRenderizado {
  templateId: string;
  versao: string;
  hash: string;
  campos: Record<string, string>;
  camposVazios: string[];
  conflitos: string[];
}

export function renderizarDocumento(entrada: EntradaRender): DocumentoRenderizado {
  const nomes: string[] = [];
  const vistos = new Set<string>();
  for (const nome of entrada.template.campos) {
    if (vistos.has(nome)) continue;
    vistos.add(nome);
    nomes.push(nome);
  }

  const porCampo = new Map<string, string | typeof FATO_CONFLITO>();
  for (const fato of entrada.fatos) {
    if (fato.revisao !== "CONFIRMADO" && fato.revisao !== "ASSINADO") continue;
    if (!vistos.has(fato.campo)) continue;
    const previo = porCampo.get(fato.campo);
    if (previo === undefined) porCampo.set(fato.campo, fato.valor);
    else if (previo !== fato.valor) porCampo.set(fato.campo, FATO_CONFLITO);
  }

  const campos: Record<string, string> = {};
  const camposVazios: string[] = [];
  const conflitos: string[] = [];
  const pares: [string, string][] = [];
  for (const nome of nomes) {
    const valor = porCampo.get(nome);
    if (valor === undefined || valor === FATO_CONFLITO || valor === "") {
      campos[nome] = "";
      camposVazios.push(nome);
      if (valor === FATO_CONFLITO) conflitos.push(nome);
      pares.push([nome, ""]);
      continue;
    }
    campos[nome] = valor;
    pares.push([nome, valor]);
  }

  return {
    templateId: entrada.template.templateId,
    versao: entrada.template.versao,
    hash: hashCanonico({
      templateId: entrada.template.templateId,
      versao: entrada.template.versao,
      campos: pares,
    }),
    campos,
    camposVazios,
    conflitos,
  };
}
