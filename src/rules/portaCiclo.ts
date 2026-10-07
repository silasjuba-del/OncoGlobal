// D-W9-22a · porta de ciclo lê limiar de bula do protocolo. Grau CTCAE só candidata toxicidade.
// PROVISORIO-W10: trocar ProtocoloCiclo / LabsCiclo por src/contracts/w10/ quando a ficha publicar os limiares.

export interface FaixaCtcae {
  grau: number;
  minInclusivo: number | null;
  maxExclusivo: number | null;
}

export interface TermoCtcae {
  unidade: string;
  faixas: FaixaCtcae[];
}

export interface SalaoCtcae {
  id: string;
  versao: string;
  decisaoPorta: string;
  decisaoGrau: string;
  codigosPorta: readonly string[];
  termos: Readonly<Record<string, TermoCtcae>>;
}

export interface LabsCiclo {
  anc: number | null;
  plq: number | null;
  clearance: number | null;
  feve: number | null;
}

export interface LimiarBula {
  codigo: "anc" | "plq" | "clearance" | "feve";
  minimo: number;
}

export interface ProtocoloCiclo {
  protocoloId: string;
  versao: string;
  limiares: readonly LimiarBula[];
  /** Armadilha. A porta não lê isto. */
  portaPorGrau?: { grauMinimo: number } | null;
}

export interface MotivoPorta {
  codigo: string;
  texto: string;
  regraId: string;
  rulesetVersao: string;
}

export interface ResultadoPortaCiclo {
  solta: boolean;
  destino: "FILA_MEDICO" | "SEM_FILA";
  motivos: MotivoPorta[];
  pendentes: MotivoPorta[];
  bloqueiaSalvar: false;
  grauUsadoNaPorta: false;
  decisao: string;
  rulesetVersao: string;
}

export interface ResultadoGrau {
  termo: string;
  grau: number | null;
  estado: "PENDENTE";
  confirmadoPeloMedico: false;
  motivo: string;
  decisao: string;
  rulesetVersao: string;
}

type Bruto = Record<string, unknown>;

function objeto(valor: unknown, caminho: string): Bruto {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
    throw new Error(`${caminho} ausente`);
  }
  return valor as Bruto;
}

function texto(bloco: Bruto, chave: string, caminho: string): string {
  const v = bloco[chave];
  if (typeof v !== "string" || v.length === 0) throw new Error(`${caminho}.${chave} ausente`);
  return v;
}

function inteiroOuNulo(valor: unknown, caminho: string): number | null {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== "number" || !Number.isInteger(valor)) throw new Error(`${caminho} não é inteiro`);
  return valor;
}

function faixaDe(valor: unknown, caminho: string): FaixaCtcae {
  const bloco = objeto(valor, caminho);
  const grau = bloco.grau;
  if (typeof grau !== "number" || !Number.isInteger(grau) || grau < 1 || grau > 5) {
    throw new Error(`${caminho}.grau inválido`);
  }
  const faixa: FaixaCtcae = {
    grau,
    minInclusivo: inteiroOuNulo(bloco.minInclusivo, `${caminho}.minInclusivo`),
    maxExclusivo: inteiroOuNulo(bloco.maxExclusivo, `${caminho}.maxExclusivo`),
  };
  if (faixa.minInclusivo === null && faixa.maxExclusivo === null) {
    throw new Error(`${caminho} sem limite`);
  }
  return faixa;
}

/** Lê o ruleset injetado. Número clínico fora do JSON não entra. */
export function lerSalaoCtcae(json: unknown): SalaoCtcae {
  const raiz = objeto(json, "salao-ctcae");
  const header = objeto(raiz.header, "header");
  const porta = objeto(raiz.portaCiclo, "portaCiclo");
  const graus = objeto(raiz.graus, "graus");
  if (porta.igualAoLimitePassa !== true) throw new Error("portaCiclo.igualAoLimitePassa deve ser true");
  if (porta.bloqueiaSalvar !== false) throw new Error("portaCiclo não pode bloquear salvar");
  if (porta.grauNaoAbrePorta !== true) throw new Error("portaCiclo.grauNaoAbrePorta deve ser true");
  if (graus.ausenteNaoViraZero !== true) throw new Error("graus.ausenteNaoViraZero deve ser true");
  if (graus.confirmacaoMedicaObrigatoria !== true) throw new Error("graus.confirmacaoMedicaObrigatoria deve ser true");
  const codigos = porta.codigos;
  if (!Array.isArray(codigos) || codigos.some((c) => typeof c !== "string" || c.length === 0)) {
    throw new Error("portaCiclo.codigos inválido");
  }
  const termosBrutos = objeto(graus.termos, "graus.termos");
  const termos: Record<string, TermoCtcae> = {};
  for (const [nome, bruto] of Object.entries(termosBrutos)) {
    const termo = objeto(bruto, `graus.termos.${nome}`);
    const faixasBrutas = termo.faixas;
    if (!Array.isArray(faixasBrutas) || faixasBrutas.length === 0) {
      throw new Error(`graus.termos.${nome}.faixas vazio`);
    }
    termos[nome] = {
      unidade: texto(termo, "unidade", `graus.termos.${nome}`),
      faixas: faixasBrutas.map((f, i) => faixaDe(f, `graus.termos.${nome}.faixas[${i}]`)),
    };
  }
  return {
    id: texto(header, "id", "header"),
    versao: texto(header, "versao", "header"),
    decisaoPorta: texto(porta, "decisao", "portaCiclo"),
    decisaoGrau: texto(graus, "decisao", "graus"),
    codigosPorta: codigos as string[],
    termos,
  };
}

function motivo(codigo: string, textoMotivo: string, decisao: string, rs: SalaoCtcae): MotivoPorta {
  return {
    codigo,
    texto: `${textoMotivo} (${decisao})`,
    regraId: rs.id,
    rulesetVersao: rs.versao,
  };
}

function labDe(labs: LabsCiclo, codigo: LimiarBula["codigo"]): number | null {
  switch (codigo) {
    case "anc":
      return labs.anc;
    case "plq":
      return labs.plq;
    case "clearance":
      return labs.clearance;
    case "feve":
      return labs.feve;
  }
}

function nomeLab(codigo: LimiarBula["codigo"]): string {
  switch (codigo) {
    case "anc":
      return "neutrófilos";
    case "plq":
      return "plaquetas";
    case "clearance":
      return "clearance";
    case "feve":
      return "FEVE";
  }
}

/**
 * Porta do ciclo. Só os mínimos declarados no protocolo. Igual ao mínimo passa.
 * `portaPorGrau` é ignorado de propósito (D-W9-22a).
 */
export function portaCiclo(labs: LabsCiclo, protocolo: ProtocoloCiclo, rs: SalaoCtcae): ResultadoPortaCiclo {
  const motivos: MotivoPorta[] = [];
  const pendentes: MotivoPorta[] = [];
  const decisao = rs.decisaoPorta;
  if (protocolo.portaPorGrau != null && !Number.isInteger(protocolo.portaPorGrau.grauMinimo)) {
    throw new Error("portaPorGrau.grauMinimo não é inteiro");
  }

  if (protocolo.limiares.length === 0) {
    pendentes.push(motivo(
      "pendente.portaCiclo.limiares",
      "protocolo sem limiar de bula; grau CTCAE não abre a porta",
      decisao,
      rs,
    ));
  }

  for (const limiar of protocolo.limiares) {
    if (!rs.codigosPorta.includes(limiar.codigo)) {
      pendentes.push(motivo(
        "pendente.portaCiclo.codigo",
        `limiar ${limiar.codigo} fora da porta de bula`,
        decisao,
        rs,
      ));
      continue;
    }
    if (typeof limiar.minimo !== "number" || !Number.isInteger(limiar.minimo)) {
      throw new Error(`limiar ${limiar.codigo} não é inteiro`);
    }
    const valor = labDe(labs, limiar.codigo);
    if (valor === null) {
      pendentes.push(motivo(
        `pendente.portaCiclo.${limiar.codigo}`,
        `${nomeLab(limiar.codigo)} ausente`,
        decisao,
        rs,
      ));
      continue;
    }
    if (!Number.isInteger(valor)) {
      pendentes.push(motivo(
        `pendente.portaCiclo.${limiar.codigo}`,
        `${nomeLab(limiar.codigo)} não é inteiro`,
        decisao,
        rs,
      ));
      continue;
    }
    if (valor < limiar.minimo) {
      motivos.push(motivo(
        `portaCiclo.${limiar.codigo}.abaixo`,
        `${nomeLab(limiar.codigo)} ${valor} abaixo do limiar de bula ${limiar.minimo}`,
        decisao,
        rs,
      ));
    }
  }

  const solta = motivos.length === 0 && pendentes.length === 0;
  return {
    solta,
    destino: solta ? "SEM_FILA" : "FILA_MEDICO",
    motivos,
    pendentes,
    bloqueiaSalvar: false,
    grauUsadoNaPorta: false,
    decisao,
    rulesetVersao: rs.versao,
  };
}

function contem(valor: number, faixa: FaixaCtcae): boolean {
  if (faixa.minInclusivo !== null && valor < faixa.minInclusivo) return false;
  if (faixa.maxExclusivo !== null && valor >= faixa.maxExclusivo) return false;
  return true;
}

/** Candidato de toxicidade. Estado PENDENTE: o médico confirma. Nunca devolve 0. */
export function grauCtcae(termo: string, valor: number | null, rs: SalaoCtcae): ResultadoGrau {
  const base = {
    termo,
    estado: "PENDENTE" as const,
    confirmadoPeloMedico: false as const,
    decisao: rs.decisaoGrau,
    rulesetVersao: rs.versao,
  };
  const tabela = rs.termos[termo];
  if (tabela === undefined) {
    return { ...base, grau: null, motivo: `termo ${termo} ausente no ruleset; grau não vira 0 (${rs.decisaoGrau})` };
  }
  if (valor === null) {
    return { ...base, grau: null, motivo: `${termo} ausente; grau não vira 0 (${rs.decisaoGrau})` };
  }
  if (!Number.isInteger(valor)) {
    return { ...base, grau: null, motivo: `${termo} não é inteiro; grau não vira 0 (${rs.decisaoGrau})` };
  }
  let escolhida: FaixaCtcae | null = null;
  for (const faixa of tabela.faixas) {
    if (!contem(valor, faixa)) continue;
    if (escolhida !== null && escolhida.grau === faixa.grau) {
      throw new Error(`faixas sobrepostas em ${termo} grau ${faixa.grau}`);
    }
    if (escolhida === null || faixa.grau > escolhida.grau) escolhida = faixa;
  }
  if (escolhida === null) {
    return { ...base, grau: null, motivo: `${termo} ${valor} ${tabela.unidade} fora das faixas; grau não vira 0 (${rs.decisaoGrau})` };
  }
  return {
    ...base,
    grau: escolhida.grau,
    motivo: `${termo} ${valor} ${tabela.unidade} candidato G${escolhida.grau}; médico confirma (${rs.decisaoGrau})`,
  };
}
