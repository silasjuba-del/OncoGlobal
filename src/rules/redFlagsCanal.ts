type Achado = import("./tipos-w3.js").Achado;
type CanalFlag = import("./tipos-w3.js").CanalFlag;
type CanalFlagRegra = import("./tipos-w3.js").CanalFlagRegra;
type CanalFlagResult = import("./tipos-w3.js").CanalFlagResult;
type CanalMensagemDesidentificada = import("./tipos-w3.js").CanalMensagemDesidentificada;
type CanalRuleset = import("./tipos-w3.js").CanalRuleset;

const RULESET_INATIVO = "regra não ativa [VERIFICAR]";

function achado(
  codigo: string,
  estado: Achado["estado"],
  motivo: string,
  regraId: string,
  rulesetVersao: string,
  inputs_used: string[],
  inputs_missing: string[] = [],
): Achado {
  return { codigo, estado, motivo, regraId, rulesetVersao, inputs_used, inputs_missing };
}

function norm(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function ocorrencias(texto: string, regra: CanalFlagRegra): { antes: string; depois: string }[] {
  const resultado: { antes: string; depois: string }[] = [];
  for (const termo of regra.termos) {
    const alvo = norm(termo).trim();
    if (!alvo) continue;
    let idx = texto.indexOf(alvo);
    while (idx >= 0) {
      const fim = idx + alvo.length;
      if (!/[\p{L}\p{N}_]/u.test(texto[idx - 1] ?? "") && !/[\p{L}\p{N}_]/u.test(texto[fim] ?? "")) {
        const divisao = /[.!?;\n]|\b(?:mas|porem|contudo|agora|atualmente)\b/;
        resultado.push({ antes: texto.slice(0, idx).split(divisao).at(-1) ?? "", depois: texto.slice(fim).split(divisao)[0] ?? "" });
      }
      idx = texto.indexOf(alvo, fim);
    }
  }
  return resultado;
}

function negado(antes: string, depois: string): boolean {
  return /\b(sem|nega|negou|ausencia de|nao (?:estou|esta|tenho|tem|apresento|apresenta)(?: com)?)\s+(?:(?:qualquer|sinais?|evidencias?)\s+(?:de\s+)?)?$/.test(antes) || /^\s+(ausente|negada)\b/.test(depois);
}

function passado(texto: string): boolean {
  return /\b(ontem|semana passada|mes passado|ha \d+ dias|teve|tive|apresentei)\b/.test(texto);
}

function terceiraPessoa(texto: string): boolean {
  return /\b(minha mae|meu pai|minha esposa|meu esposo|minha filha|meu filho|meu familiar|ela esta|ele esta)\b/.test(texto);
}

function pendenteRuleset(rs: CanalRuleset | null | undefined): CanalFlagResult {
  const a = achado("CANAL_RULESET", "PENDENTE", RULESET_INATIVO, rs?.id ?? "canal-red-flags", rs?.versao ?? "MISSING", [], ["ruleset"]);
  return { rulesetVersao: rs?.versao ?? "MISSING", flags: [], achados: [a] };
}

/** FN-21: red flags de canal em texto ja desidentificado; resposta sempre fixa por templateId. */
export function avaliarRedFlagsCanal(
  mensagem: CanalMensagemDesidentificada,
  rs: CanalRuleset | null | undefined,
): CanalFlagResult {
  if (!rs || !rs.ativo) return pendenteRuleset(rs);
  if (!rs.flags.length || rs.flags.some((r) => !r.termos.length || r.termos.some((t) => !t.trim()))) return pendenteRuleset(rs);
  if (!mensagem.texto.trim() || !mensagem.contatoId.trim()) {
    return { rulesetVersao: rs.versao, flags: [], achados: [achado("CANAL_ENTRADA", "PENDENTE", "mensagem ou contato ausente [VERIFICAR]", rs.id, rs.versao, [], [!mensagem.texto.trim() ? "texto" : "contatoId"])] };
  }

  if (!mensagem.classificadorOk) {
    const a = achado(
      "CANAL_CLASSIFICADOR",
      "PENDENTE",
      "falha do classificador: nao declarar sem flag",
      rs.id,
      rs.versao,
      ["classificadorOk"],
      ["classificacao_confiavel"],
    );
    return { rulesetVersao: rs.versao, flags: [], achados: [a] };
  }

  const texto = norm(mensagem.texto);
  const flags: CanalFlag[] = [];
  const achados: Achado[] = [];

  for (const regra of rs.flags) {
    const mencoes = ocorrencias(texto, regra);
    if (!mencoes.length) continue;
    const afirmadas = mencoes.filter((m) => !negado(m.antes, m.depois));
    if (!afirmadas.length) {
      achados.push(achado(regra.codigo, "VERDE", "red flag negada no texto", regra.regraId, rs.versao, ["texto"]));
      continue;
    }
    if (afirmadas.every((m) => passado(m.antes + " " + m.depois))) {
      achados.push(
        achado(
          regra.codigo,
          "PENDENTE",
          "red flag mencionada no passado: requer revisao temporal [VERIFICAR]",
          regra.regraId,
          rs.versao,
          ["texto"],
          ["tempo_clinico_atual"],
        ),
      );
      continue;
    }

    const alvo: CanalFlag["alvo"] = terceiraPessoa(texto) || !mensagem.patientId ? "contato" : "paciente";
    const a = achado(regra.codigo, "VERMELHO", "red flag ativa no canal", regra.regraId, rs.versao, ["texto"]);
    flags.push({
      codigo: regra.codigo,
      alvo,
      templateId: regra.templateId,
      respostaFixa: true,
      achado: a,
    });
    achados.push(a);
  }

  return { rulesetVersao: rs.versao, flags, achados };
}
