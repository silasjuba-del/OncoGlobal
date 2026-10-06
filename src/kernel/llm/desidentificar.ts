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

/** CPF com dígitos verificadores válidos (11 dígitos, aceita pontuação). */
export function cpfValido(raw: string): boolean {
  const d = raw.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

/** CNS (15 dígitos): soma ponderada 15..1 múltipla de 11. */
export function cnsValido(raw: string): boolean {
  const d = raw.replace(/\D/g, "");
  if (d.length !== 15 || !/^[1-9]/.test(d)) return false;
  let s = 0;
  for (let i = 0; i < 15; i++) s += Number(d[i]) * (15 - i);
  return s % 11 === 0;
}

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
  texto = texto.replace(/\b\d{3}[ .]?\d{4}[ .]?\d{4}[ .]?\d{4}\b/g, (m) => (cnsValido(m) ? tokenPara("CNS", m) : m));
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
