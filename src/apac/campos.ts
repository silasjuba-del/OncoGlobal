// Leitura tolerante de Apac.campos (valores crus ou Dado{valor,campo,revisao}). Ausente = PENDENTE.
import { normalizarCns, validarCns } from "./cns.js";

export const FINALIDADES_QT = ["PALIATIVA", "CONTROLE_TEMPORARIO", "PREVIA", "ADJUVANTE", "CURATIVA"] as const;
export const FINALIDADES_RT = ["RADICAL", "ADJUVANTE", "ANTIALGICA", "PALIATIVA", "PREVIA", "ANTI_HEMORRAGICA"] as const;

export const ROTULO_FINALIDADE: Readonly<Record<string, string>> = {
  PALIATIVA: "Paliativa", CONTROLE_TEMPORARIO: "Para Controle Temporário", PREVIA: "Prévia",
  ADJUVANTE: "Adjuvante", CURATIVA: "Curativa", RADICAL: "Radical", ANTIALGICA: "Antiálgica",
  ANTI_HEMORRAGICA: "Anti-hemorrágica",
};

export function normalizarFinalidade(v: string): string {
  return v.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase().replace(/[\s-]+/g, "_")
    .replace(/^PARA_/, "");
}

export type LeituraCampo = { estado: "PRESENTE"; valor: unknown } | { estado: "PENDENTE"; motivo: string };

export function lerCampo(campos: Record<string, unknown>, chave: string): LeituraCampo {
  const bruto = campos[chave];
  if (bruto === undefined || bruto === null) return { estado: "PENDENTE", motivo: "ausente" };
  if (typeof bruto === "object" && !Array.isArray(bruto) && "campo" in bruto && "valor" in bruto) {
    const d = bruto as { campo: unknown; valor: unknown; revisao?: unknown };
    if (d.campo !== "PRESENTE" || d.valor === null || d.valor === undefined) return { estado: "PENDENTE", motivo: "não informado" };
    if (d.revisao !== undefined && d.revisao !== "CONFIRMADO" && d.revisao !== "ASSINADO")
      return { estado: "PENDENTE", motivo: "sem confirmação do médico" };
    if (typeof d.valor === "string" && d.valor.trim() === "") return { estado: "PENDENTE", motivo: "vazio" };
    return { estado: "PRESENTE", valor: d.valor };
  }
  if (typeof bruto === "string" && bruto.trim() === "") return { estado: "PENDENTE", motivo: "vazio" };
  return { estado: "PRESENTE", valor: bruto };
}

export function lerTexto(campos: Record<string, unknown>, chave: string): string | null {
  const l = lerCampo(campos, chave);
  return l.estado === "PRESENTE" && typeof l.valor === "string" ? l.valor.trim() : null;
}

export interface ProcQtde { codigo: string; qtde: number }
export function lerSecundarios(campos: Record<string, unknown>): ProcQtde[] {
  const l = lerCampo(campos, "procedimentosSecundarios");
  if (l.estado !== "PRESENTE" || !Array.isArray(l.valor)) return [];
  const out: ProcQtde[] = [];
  for (const x of l.valor) {
    if (x && typeof x === "object" && "codigo" in x && typeof (x as { codigo: unknown }).codigo === "string") {
      const q = (x as { qtde?: unknown }).qtde;
      out.push({ codigo: (x as { codigo: string }).codigo, qtde: typeof q === "number" ? q : 1 });
    }
  }
  return out;
}

// ── Identificação da página 1 a partir do cadastro confirmado no check-in (sem retradução) ──
// Cada campo presente leva a origem (CHECKIN:<campo do cadastro> ou DERIVADO:<tabela>).
// Campo ausente ou inválido NÃO entra em `campos`: a leitura do laudo o marca PENDENTE, com o motivo em `pendencias`.

export type RacaCor = "BRANCA" | "PRETA" | "PARDA" | "AMARELA" | "INDIGENA";
const RACAS_COR: readonly RacaCor[] = ["BRANCA", "PRETA", "PARDA", "AMARELA", "INDIGENA"];
const UFS_BRASIL: ReadonlySet<string> = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR",
  "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);
/** Prefixo de 2 dígitos do código IBGE por UF; só as UFs presentes na tabela carregada. */
const PREFIXO_IBGE_UF: Readonly<Record<string, string>> = { PB: "25" };

/** Cadastro do check-in/secretaria, já como o sistema o guarda. `revisao` precisa ser CONFIRMADO ou ASSINADO. */
export interface CadastroCheckin {
  revisao?: "RASCUNHO" | "CONFIRMADO" | "ASSINADO";
  prontuario?: string | null;
  cns?: string | null;
  nome?: string | null;
  nascimento?: string | null; // AAAA-MM-DD
  sexo?: string | null; // "M" | "F"
  racaCor?: string | null;
  etnia?: string | null; // só lida quando racaCor === INDIGENA
  mae?: string | null;
  telefones?: readonly string[] | null;
  responsavel?: { nome?: string | null; telefone?: string | null } | null;
  endereco?: string | null;
  municipio?: string | null;
  uf?: string | null;
  cep?: string | null;
}

export interface EntradaIbge { nome: string; uf: string; codigoIbge: string }

export interface DadoCheckin { campo: "PRESENTE"; valor: string; revisao: "CONFIRMADO"; origem: string }

export interface PendenciaCheckin { chave: string; motivo: string }

export interface IdentificacaoCheckin {
  /** Entradas PRESENTES, no formato Dado lido por lerCampo. */
  campos: Record<string, DadoCheckin>;
  pendencias: PendenciaCheckin[];
}

/** Chaves da página 1 (identificação) que este leitor preenche. `telefoneResponsavel` não está no laudo impresso atual. */
export const CHAVES_IDENTIFICACAO: readonly string[] = [
  "numeroProntuario", "pacienteCns", "pacienteNome", "pacienteNascimento", "pacienteSexo", "racaCor", "etnia",
  "nomeMae", "telefoneContato", "nomeResponsavel", "telefoneResponsavel", "endereco", "municipioResidencia",
  "codIbgeMunicipio", "uf", "cep",
];

type Resultado = { ok: true; valor: string } | { ok: false; motivo: string };
const ok = (valor: string): Resultado => ({ ok: true, valor });
const falha = (motivo: string): Resultado => ({ ok: false, motivo });

const chaveNome = (s: string): string =>
  s.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase().replace(/\s+/g, " ").trim();

/** Dígito verificador do código IBGE de município (6 primeiros dígitos; pesos 1 e 2 alternados). */
export function dvIbge(seis: string): number {
  const pesos = [1, 2, 1, 2, 1, 2];
  let soma = 0;
  for (let i = 0; i < 6; i++) {
    const p = Number(seis[i]) * pesos[i]!;
    soma += p > 9 ? p - 9 : p;
  }
  const r = soma % 10;
  return r === 0 ? 0 : 10 - r;
}

/** Município + UF -> código IBGE, por tabela. Ausente, ambíguo ou com DV inconsistente = PENDENTE. */
export function resolverIbgeMunicipio(
  municipio: string | null, uf: string | null, tabela: readonly EntradaIbge[],
): Resultado {
  if (!municipio || !uf) return falha("município ou UF ausente");
  const achados = tabela.filter((t) => t.uf === uf && chaveNome(t.nome) === chaveNome(municipio));
  if (achados.length !== 1) return falha("IBGE não encontrado na tabela");
  const codigo = achados[0]!.codigoIbge;
  if (!/^\d{7}$/.test(codigo) || dvIbge(codigo.slice(0, 6)) !== Number(codigo[6])) return falha("código IBGE da tabela inconsistente");
  const prefixo = PREFIXO_IBGE_UF[uf];
  if (prefixo !== undefined && !codigo.startsWith(prefixo)) return falha("código IBGE da tabela inconsistente");
  return ok(codigo);
}

function textoOpcional(v: string | null | undefined): Resultado {
  if (typeof v !== "string" || v.trim() === "") return falha("ausente");
  return ok(v.trim().replace(/\s+/g, " "));
}

function telefoneValido(v: string | null | undefined): Resultado {
  if (typeof v !== "string" || v.trim() === "") return falha("ausente");
  const d = v.replace(/\D/g, "");
  return d.length === 10 || d.length === 11 ? ok(d) : falha("telefone com formato inválido");
}

function dataCivil(v: string | null | undefined): Resultado {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return falha("ausente ou fora de AAAA-MM-DD");
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? falha("data inexistente") : ok(v);
}

function cep(v: string | null | undefined): Resultado {
  if (typeof v !== "string" || v.trim() === "") return falha("ausente");
  const d = v.replace(/\D/g, "");
  return d.length === 8 ? ok(`${d.slice(0, 5)}-${d.slice(5)}`) : falha("CEP com formato inválido");
}

/**
 * Lê a identificação da página 1 do cadastro confirmado. Não traduz nem infere nada:
 * só valida formato e deriva o código IBGE pela tabela. Cadastro não confirmado = tudo PENDENTE.
 */
export function lerIdentificacaoCheckin(cadastro: CadastroCheckin, tabelaIbge: readonly EntradaIbge[]): IdentificacaoCheckin {
  const campos: Record<string, DadoCheckin> = {};
  const pendencias: PendenciaCheckin[] = [];

  if (cadastro.revisao !== "CONFIRMADO" && cadastro.revisao !== "ASSINADO") {
    for (const chave of CHAVES_IDENTIFICACAO) pendencias.push({ chave, motivo: "cadastro não confirmado" });
    return { campos, pendencias };
  }

  const registrar = (chave: string, r: Resultado, origem: string): void => {
    if (r.ok) campos[chave] = { campo: "PRESENTE", valor: r.valor, revisao: "CONFIRMADO", origem };
    else pendencias.push({ chave, motivo: r.motivo });
  };

  registrar("numeroProntuario", textoOpcional(cadastro.prontuario), "CHECKIN:prontuario");

  const cnsBruto = typeof cadastro.cns === "string" && cadastro.cns.trim() !== "" ? cadastro.cns : null;
  if (cnsBruto === null) registrar("pacienteCns", falha("ausente"), "CHECKIN:cns");
  else {
    const v = validarCns(cnsBruto);
    registrar("pacienteCns", v.valido ? ok(normalizarCns(cnsBruto)) : falha(`CNS inválido (${v.motivo})`), "CHECKIN:cns");
  }

  registrar("pacienteNome", textoOpcional(cadastro.nome), "CHECKIN:nome");
  registrar("pacienteNascimento", dataCivil(cadastro.nascimento), "CHECKIN:nascimento");

  const sexo = typeof cadastro.sexo === "string" ? cadastro.sexo.trim().toUpperCase() : "";
  registrar("pacienteSexo", sexo === "M" || sexo === "F" ? ok(sexo) : falha("sexo ausente ou fora de M/F"), "CHECKIN:sexo");

  const raca = typeof cadastro.racaCor === "string"
    ? cadastro.racaCor.normalize("NFD").replace(/\p{M}/gu, "").trim().toUpperCase() : "";
  const racaOk = RACAS_COR.find((r) => r === raca);
  registrar("racaCor", racaOk ? ok(racaOk) : falha("raça/cor ausente ou fora da lista do IBGE"), "CHECKIN:racaCor");

  // Etnia só existe para paciente indígena: nunca preenchida em outros casos.
  if (racaOk === "INDIGENA") registrar("etnia", textoOpcional(cadastro.etnia), "CHECKIN:etnia");
  else pendencias.push({ chave: "etnia", motivo: "não se aplica (raça/cor não indígena)" });

  registrar("nomeMae", textoOpcional(cadastro.mae), "CHECKIN:mae");

  const telefones = (cadastro.telefones ?? []).map(telefoneValido).filter((r): r is { ok: true; valor: string } => r.ok);
  registrar("telefoneContato",
    telefones.length > 0 ? ok(telefones.map((t) => t.valor).join(" / ")) : falha("telefone ausente ou inválido"),
    "CHECKIN:telefones");

  registrar("nomeResponsavel", textoOpcional(cadastro.responsavel?.nome), "CHECKIN:responsavel.nome");
  registrar("telefoneResponsavel", telefoneValido(cadastro.responsavel?.telefone), "CHECKIN:responsavel.telefone");
  registrar("endereco", textoOpcional(cadastro.endereco), "CHECKIN:endereco");

  const municipio = textoOpcional(cadastro.municipio);
  const ufRaw = typeof cadastro.uf === "string" ? cadastro.uf.trim().toUpperCase() : "";
  const uf = UFS_BRASIL.has(ufRaw) ? ufRaw : null;
  registrar("municipioResidencia", municipio, "CHECKIN:municipio");
  registrar("uf", uf ? ok(uf) : falha("UF ausente ou inválida"), "CHECKIN:uf");

  const ibge = resolverIbgeMunicipio(municipio.ok ? municipio.valor : null, uf, tabelaIbge);
  registrar("codIbgeMunicipio", ibge, "DERIVADO:TABELA_IBGE_MUNICIPIOS");

  registrar("cep", cep(cadastro.cep), "CHECKIN:cep");

  return { campos, pendencias };
}

/** Mescla a identificação lida ao registro de campos da APAC. Chave ausente no check-in não apaga o que já existe. */
export function aplicarIdentificacaoCheckin(
  campos: Record<string, unknown>, identificacao: IdentificacaoCheckin,
): Record<string, unknown> {
  return { ...campos, ...identificacao.campos };
}
