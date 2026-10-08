import { cpfValido } from "../../rules/w8/identificadores.js";
export { cpfValido };
import { cnsValido } from "../../rules/cns.js";
export { cnsValido };
// FN-24 · Desidentificação ANTES de qualquer saída (INV-12, G-02, G-24). Pura: sem I/O.
// O mapa de reidentificação nunca sai do PC; tokens são por chamada (K-22).

export interface DicionarioPaciente {
  /** nomes do paciente, familiares, médicos, hospital, cidade — o que for conhecido localmente */
  nomes: readonly string[];
  /** identificadores literais conhecidos (prontuário, telefone, e-mail cadastrados) */
  identificadores: readonly string[];
}

export interface ResultadoDesidentificacao {
  texto: string;
  /** token → original. FICA LOCAL. */
  mapa: ReadonlyMap<string, string>;
  achados: { tipo: TipoAchado; token: string }[];
}

export type TipoAchado = "NOME" | "IDENTIFICADOR" | "CPF" | "CNS" | "TELEFONE" | "EMAIL" | "DATA_NASC";

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** só letras, sem acento, minúsculas */
function letrasCompactas(s: string): string {
  return compactarComIndices(s).compacto;
}
/** compacto + índice (no original) de cada letra mantida */
function compactarComIndices(s: string): { compacto: string; indices: number[] } {
  let compacto = "";
  const indices: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = semAcento(s[i] ?? "").toLowerCase();
    if (/^\p{L}$/u.test(c)) { compacto += c; indices.push(i); }
  }
  return { compacto, indices };
}

/** CPF com dígitos verificadores válidos (11 dígitos, aceita pontuação). */

export function desidentificar(textoOriginal: string, dic: DicionarioPaciente): ResultadoDesidentificacao {
  const mapa = new Map<string, string>();
  const achados: ResultadoDesidentificacao["achados"] = [];
  const cont: Record<TipoAchado, number> = { NOME: 0, IDENTIFICADOR: 0, CPF: 0, CNS: 0, TELEFONE: 0, EMAIL: 0, DATA_NASC: 0 };
  const tokenPara = (tipo: TipoAchado, original: string) => {
    for (const [t, o] of mapa) if (o === original) return t;
    const token = `⟨${tipo}_${++cont[tipo]}⟩`;
    mapa.set(token, original);
    achados.push({ tipo, token });
    return token;
  };

  let texto = textoOriginal;

  // 1. Identificadores literais conhecidos (mais longos primeiro)
  for (const id of [...dic.identificadores].filter(Boolean).sort((a, b) => b.length - a.length))
    texto = texto.replace(new RegExp(escapar(id), "g"), (m) => tokenPara("IDENTIFICADOR", m));

  // 2. Padrões estruturados
  texto = texto.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, (m) => tokenPara("EMAIL", m));
  texto = texto.replace(/\b\d{3}[ .]?\d{4}[ .]?\d{4}[ .]?\d{4}\b/g, (m) => tokenPara("CNS", m));
  texto = texto.replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, (m) => (cpfValido(m) ? tokenPara("CPF", m) : m));
  texto = texto.replace(/(?:\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}-?\d{4}\b/g, (m) => tokenPara("TELEFONE", m));
  // Mesma detecção é reutilizada por G-02 para barrar texto residual.
  // Exige contexto explícito de nascimento: datas clínicas avulsas não são DN.
  texto = texto.replace(/\b(?:nascid[oa]|nasc\.?|DN|data de nascimento)\s*(?:em\s+)?(?::\s*)?\d{1,2}([/.-])\d{1,2}\1\d{2,4}\b/gi,
    (m) => tokenPara("DATA_NASC", m));

  // 3. Nomes do dicionário: sem acento, sem caixa, por palavra; também partes com ≥3 letras
  const partes = new Set<string>();
  for (const nome of dic.nomes) {
    if (!nome.trim()) continue;
    partes.add(nome.trim());
    for (const p of nome.trim().split(/\s+/)) if (p.length >= 3 && !/^(da|de|do|das|dos)$/i.test(p)) partes.add(p);
  }
  for (const parte of [...partes].sort((a, b) => b.length - a.length)) {
    const alvo = semAcento(parte).toLowerCase();
    const re = /[\p{L}][\p{L}'-]*(?:\s+[\p{L}][\p{L}'-]*)*/gu;
    texto = texto.replace(re, (trecho) => {
      // varre janelas de palavras do trecho procurando a parte (com ou sem acento)
      const palavras = trecho.split(/(\s+)/);
      const n = parte.trim().split(/\s+/).length;
      const out: string[] = [];
      for (let i = 0; i < palavras.length; i++) {
        const janela = palavras.slice(i, i + 2 * n - 1).join("");
        if (semAcento(janela).toLowerCase() === alvo) {
          out.push(tokenPara("NOME", janela));
          i += 2 * n - 2;
        } else out.push(palavras[i] ?? "");
      }
      return out.join("");
    });
  }

  // 4. Nome compacto (URL, caminho, nome de arquivo, camelCase, snake_case, sem acento, %20): RT-12a.
  //    Por trecho sem espaços, reduz a letras e procura o nome completo / pares de palavras consecutivas colados.
  const sequencias = new Set<string>();
  for (const nome of dic.nomes) {
    const pal = nome.trim().split(/\s+/).filter((p) => p.length > 0);
    for (let i = 0; i < pal.length; i++)
      for (let j = i + 2; j <= pal.length; j++) {
        const c = letrasCompactas(pal.slice(i, j).join(" "));
        if (c.length >= 7) sequencias.add(c);
      }
  }
  if (sequencias.size) {
    const alvos = [...sequencias].sort((a, b) => b.length - a.length);
    const decodificado = (trecho: string): string => {
      try { return decodeURIComponent(trecho); } catch { return trecho; }
    };
    texto = texto.replace(/\S+/g, (trecho) => {
      if (/^⟨[A-Z_]+_\d+⟩$/.test(trecho)) return trecho;
      // trechos já tokenizados dentro do caminho: preserva-os, só examina o resto
      const base = decodificado(trecho);
      const { compacto, indices } = compactarComIndices(base);
      for (const alvo of alvos) {
        const pos = compacto.indexOf(alvo);
        if (pos >= 0) {
          const ini = indices[pos] ?? 0;
          const fim = (indices[pos + alvo.length - 1] ?? base.length - 1) + 1;
          return base.slice(0, ini) + tokenPara("NOME", base.slice(ini, fim)) + base.slice(fim);
        }
      }
      // base64 (padrão ou URL-safe) em qualquer parte do trecho: decodifica e confere o conteúdo
      let mudou = false;
      const sem64 = trecho.replace(/[A-Za-z0-9+/_-]{16,}={0,2}/g, (b64) => {
        try {
          const dec = Buffer.from(b64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
          if (/^[ -~À-ſ]+$/.test(dec) && alvos.some((x) => compactarComIndices(dec).compacto.includes(x))) {
            mudou = true;
            return tokenPara("NOME", b64);
          }
        } catch { /* não é base64 */ }
        return b64;
      });
      if (mudou) return sem64;
      return trecho;
    });
  }

  return { texto, mapa, achados };
}

/** Reidentifica SÓ tokens do próprio mapa; token desconhecido permanece (nunca troca paciente A por B). */
export function reidentificar(texto: string, mapa: ReadonlyMap<string, string>): string {
  return texto.replace(/⟨[A-Z_]+_\d+⟩/g, (t) => mapa.get(t) ?? t);
}

/** G-02: PHI residual após desidentificação? true = NÃO pode sair. */
export function contemPhiResidual(texto: string, dic: DicionarioPaciente): boolean {
  return desidentificar(texto, dic).achados.length > 0;
}

// G-27 · sanitizador de artefato (implementação em ./sanitizador.ts; reexportado aqui por contrato dos testes adversariais).
export { sanitizarArtefato } from "./sanitizador.js";
