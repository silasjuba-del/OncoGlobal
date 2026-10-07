/** Regras de apresentação do cartão Modelo 08. Sem regra clínica de conduta. */

const AUSENTE_ALERGIA = new Set([
  "nenhuma alergia informada",
  "sem informacao",
  "sem informação",
  "sem informaçao",
]);

const NEGA_ALERGIA = new Set(["nega alergias", "nega alergia", "nega alergia(s)"]);

export function normalizarRotulo(texto: string): string {
  return texto.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/** Ausente = PENDENTE. "nega alergias" só com texto explícito. */
export function estadoAlergias(
  itens: readonly string[],
): { estado: "PENDENTE" } | { estado: "NEGA" } | { estado: "LISTA"; itens: readonly string[] } {
  const limpos = itens.map((i) => i.trim()).filter((i) => i.length > 0);
  if (limpos.length === 0) return { estado: "PENDENTE" };
  if (limpos.every((i) => AUSENTE_ALERGIA.has(normalizarRotulo(i)))) return { estado: "PENDENTE" };
  if (limpos.every((i) => NEGA_ALERGIA.has(normalizarRotulo(i)))) return { estado: "NEGA" };
  const reais = limpos.filter(
    (i) => !AUSENTE_ALERGIA.has(normalizarRotulo(i)) && !NEGA_ALERGIA.has(normalizarRotulo(i)),
  );
  if (reais.length === 0) return { estado: "PENDENTE" };
  return { estado: "LISTA", itens: reais };
}

/** Idade civil "NN anos e N meses". Código calcula; a tela não digita. */
export function idadeAnosEMeses(nascimento: string, hoje: string): string | null {
  const n = parseData(nascimento);
  const h = parseData(hoje);
  if (!n || !h) return null;
  if (h.getTime() < n.getTime()) return null;
  let anos = h.getUTCFullYear() - n.getUTCFullYear();
  let meses = h.getUTCMonth() - n.getUTCMonth();
  if (h.getUTCDate() < n.getUTCDate()) meses -= 1;
  if (meses < 0) {
    anos -= 1;
    meses += 12;
  }
  if (anos < 0) return null;
  return `${anos} anos e ${meses} meses`;
}

function parseData(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo || dt.getUTCDate() !== d) return null;
  return dt;
}

/** Matrícula = CNS quando iguais; se diferentes, mostra os dois. */
export function linhasMatriculaCns(
  matricula: string | null,
  cns: string | null,
): readonly { chave: "Matrícula / CNS" | "Matrícula" | "CNS"; valor: string }[] {
  const m = matricula?.trim() || null;
  const c = cns?.trim() || null;
  if (m && c && m === c) return [{ chave: "Matrícula / CNS", valor: m }];
  const out: { chave: "Matrícula" | "CNS"; valor: string }[] = [];
  if (m) out.push({ chave: "Matrícula", valor: m });
  if (c) out.push({ chave: "CNS", valor: c });
  return out;
}

/** "SEM INFORMACAO" e vazio viram PENDENTE na UI. */
export function valorOuPendente(valor: string | null | undefined): string {
  if (valor == null) return "PENDENTE";
  const t = valor.trim();
  if (t.length === 0) return "PENDENTE";
  if (normalizarRotulo(t) === "sem informacao") return "PENDENTE";
  return t;
}

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const a = partes[0]?.[0] ?? "";
  const b = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? "") : "";
  return (a + b).toUpperCase();
}

export function rotuloSexo(sexo: "F" | "M" | "OUTRO" | "NAO_INFORMADO"): string {
  switch (sexo) {
    case "F":
      return "F";
    case "M":
      return "M";
    case "OUTRO":
      return "Outro";
    case "NAO_INFORMADO":
      return "PENDENTE";
  }
}
