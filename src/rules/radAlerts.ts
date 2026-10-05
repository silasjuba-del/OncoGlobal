type Achado = import("./tipos-w3.js").Achado;
type RadAlert = import("./tipos-w3.js").RadAlert;
type RadAlertResult = import("./tipos-w3.js").RadAlertResult;
type RadInput = import("./tipos-w3.js").RadInput;
type RadRuleset = import("./tipos-w3.js").RadRuleset;
type RadTermo = import("./tipos-w3.js").RadTermo;

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

function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function trecho(textoOriginal: string, inicio: number, fim: number): string {
  const margem = 48;
  return textoOriginal.slice(Math.max(0, inicio - margem), Math.min(textoOriginal.length, fim + margem)).trim();
}

function findTermo(textoNormalizado: string, termo: string): { inicio: number; fim: number }[] {
  const termoNormalizado = normalizarTexto(termo);
  if (!termoNormalizado.trim()) return [];
  const encontrados: { inicio: number; fim: number }[] = [];
  let inicio = textoNormalizado.indexOf(termoNormalizado);
  while (inicio >= 0) {
    const fim = inicio + termoNormalizado.length;
    if (!/[\p{L}\p{N}_]/u.test(textoNormalizado[inicio - 1] ?? "") &&
        !/[\p{L}\p{N}_]/u.test(textoNormalizado[fim] ?? "")) encontrados.push({ inicio, fim });
    inicio = textoNormalizado.indexOf(termoNormalizado, fim);
  }
  return encontrados;
}

function contextoAntes(textoNormalizado: string, inicio: number): string {
  return textoNormalizado.slice(0, inicio).split(/[.!?;\n]|\b(?:mas|porem|contudo|agora|atualmente)\b/).at(-1) ?? "";
}

function contextoApos(textoNormalizado: string, fim: number): string {
  return textoNormalizado.slice(fim, Math.min(textoNormalizado.length, fim + 24));
}

function negado(textoNormalizado: string, inicio: number, fim: number): boolean {
  const antes = contextoAntes(textoNormalizado, inicio);
  const apos = contextoApos(textoNormalizado, fim);
  // "nao se pode excluir" expressa incerteza, nao ausencia.
  if (/\b(nao (?:se pode |e possivel )?(?:excluir|descartar)|nao descartad[oa])\b/.test(antes + apos)) return false;
  return /\b(sem|nega|negativo para|ausencia de|ausente)\s+[\w\s,]{0,80}$/.test(antes) || /^\s+(ausente|negativo|descartad[oa]|excluid[oa])\b/.test(apos);
}

function suspeito(textoNormalizado: string, inicio: number): boolean {
  return /\b(suspeita de|suspeito de|sugestivo de|possivel|nao (?:se pode |e possivel )?(?:excluir|descartar))\s+[\w\s]{0,80}$/.test(contextoAntes(textoNormalizado, inicio));
}

function antecedente(textoNormalizado: string, inicio: number): boolean {
  return /\b(historia de|historico de|antecedente de|previo de)\s+[\w\s]{0,24}$/.test(contextoAntes(textoNormalizado, inicio));
}

function pendenteRuleset(rs: RadRuleset | null | undefined): RadAlertResult {
  const a = achado("RAD_RULESET", "PENDENTE", RULESET_INATIVO, rs?.id ?? "rad-alerts", rs?.versao ?? "MISSING", [], ["ruleset"]);
  return { rulesetVersao: rs?.versao ?? "MISSING", alerts: [], achados: [a] };
}

function montarAlert(regra: RadTermo, rs: RadRuleset, input: RadInput, source_text: string, revisaoUrgente: boolean): RadAlert {
  const tipo = revisaoUrgente ? "REVISAO_URGENTE" : "RED_RAD_ALERT";
  const a = achado(
    regra.codigo,
    "VERMELHO",
    revisaoUrgente ? "termo radiologico suspeito: revisao urgente" : "termo radiologico de emergencia",
    regra.regraId,
    rs.versao,
    ["tipoFonte", "texto", "data"],
  );
  return {
    codigo: regra.codigo,
    tipo,
    source_text,
    data: input.data,
    needs_physician_review: true,
    confirmado: false,
    achado: a,
  };
}

/** FN-20: alerta radiologico somente sobre TRANSCRIPTION, nunca sobre imagem bruta. */
export function avaliarRadAlerts(input: RadInput, rs: RadRuleset | null | undefined): RadAlertResult {
  if (!rs || !rs.ativo) return pendenteRuleset(rs);
  if (!rs.termosEmergencia.length || rs.termosEmergencia.some((r) => !r.termo.trim())) return pendenteRuleset(rs);
  if (!input.texto.trim() || !input.data.trim()) {
    return { rulesetVersao: rs.versao, alerts: [], achados: [achado("RAD_ENTRADA", "PENDENTE", "texto ou data ausente [VERIFICAR]", rs.id, rs.versao, [], [!input.texto.trim() ? "texto" : "data"])] };
  }
  if (input.tipoFonte !== "TRANSCRIPTION") {
    const a = achado("RAD_FONTE", "PENDENTE", "fonte nao textual: nunca inferir de imagem bruta", rs.id, rs.versao, ["tipoFonte"], ["TRANSCRIPTION"]);
    return { rulesetVersao: rs.versao, alerts: [], achados: [a] };
  }

  const textoNormalizado = normalizarTexto(input.texto);
  const alerts: RadAlert[] = [];
  const achados: Achado[] = [];

  for (const regra of rs.termosEmergencia) {
    for (const pos of findTermo(textoNormalizado, regra.termo)) {
    if (negado(textoNormalizado, pos.inicio, pos.fim) || antecedente(textoNormalizado, pos.inicio)) {
      achados.push(
        achado(
          regra.codigo,
          "VERDE",
          "termo encontrado apenas em negacao ou antecedente",
          regra.regraId,
          rs.versao,
          ["texto"],
        ),
      );
      continue;
    }
    const revisaoUrgente = suspeito(textoNormalizado, pos.inicio);
    // Preserve o original integral: normalizacao Unicode pode alterar offsets.
    const alert = montarAlert(regra, rs, input, input.texto, revisaoUrgente);
    alerts.push(alert);
    achados.push(alert.achado);
    }
  }

  return { rulesetVersao: rs.versao, alerts, achados };
}
