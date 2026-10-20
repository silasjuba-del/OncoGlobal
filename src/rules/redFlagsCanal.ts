type SaidaInterna = Omit<CanalFlagResult, "inputs_used" | "inputs_missing">;
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

// Divisores de clausula: pontuacao forte e conectivos de contraste.
// Marcadores temporais (ontem/hoje/agora) NAO sao divisores: eles modificam
// a afirmacao dentro da mesma clausula e devem ser visiveis a passado() e
// a terceiraPessoaLocal(). C-R2-08 ("Sem febre ontem, hoje estou com febre")
// eh resolvido por negadoCoordenado + passado, nao por divisao temporal.
// Coordenação simples herda sujeito/tempo. Um novo predicado encerra ambos
// os escopos, nos dois lados da menção, impedindo propagação para trás.
const NOVA_ORACAO = /[.!?;\n]|\b(?:mas|porem|contudo)\b|(?:,\s*|\b(?:e|ou)\s+)(?=(?:(?:eu|ele|ela|minha\s+mae|meu\s+pai)\s+)?(?:(?:hoje|agora|atualmente|ontem)\s+)?(?:nao\s+)?(?:estou|esta|tenho|tem|tive|teve|sinto|sente|apresento|apresenta|com)\b)/;

// Divisores de escopo de sujeito: incluem conectivos coordenados (e|nem|ou)
// e virgula, pois uma nova clausula coordenada pode mudar o sujeito
// ("Minha mae esta com febre e eu estou com falta de ar" -> febre=contato,
// dispneia=paciente). Nao inclui marcadores temporais.
const DIVISAO_SUJEITO = /[.!?;,\n]|\b(?:mas|porem|contudo|e|nem|ou)\b/;

interface Ocorrencia {
  // trecho local (clausula) onde o termo aparece
  antes: string;
  depois: string;
  // sentenca completa que contem o termo (para deteccao de pergunta)
  sentenca: string;
  // trecho ate o inicio do texto (para heranca de negacao coordenada)
  prefixo: string;
  // escopo de sujeito: trecho da clausula atual ate o termo, dividido por
  // conectivos coordenados e virgula (para atribuicao de alvo).
  sujeitoAntes: string;
  // trecho do fim do termo ate o fim da sentenca (inclusive terminador),
  // para distinguir pergunta de existencia ("Estou com febre agora?") de
  // pergunta de conduta em clausula posterior ("Estou com febre, o que
  // faco?" ou "Estou com febre; posso ir ao PS?").
  aposNaSentenca: string;
  // indice do termo no texto normalizado
  inicio: number;
  fim: number;
}

function ocorrencias(texto: string, regra: CanalFlagRegra): Ocorrencia[] {
  const resultado: Ocorrencia[] = [];
  for (const termo of regra.termos) {
    const alvo = norm(termo).trim();
    if (!alvo) continue;
    let idx = texto.indexOf(alvo);
    while (idx >= 0) {
      const fim = idx + alvo.length;
      if (!/[\p{L}\p{N}_]/u.test(texto[idx - 1] ?? "") && !/[\p{L}\p{N}_]/u.test(texto[fim] ?? "")) {
        const antes = texto.slice(0, idx).split(NOVA_ORACAO).at(-1) ?? "";
        const depois = texto.slice(fim).split(NOVA_ORACAO)[0] ?? "";
        // Sentenca: estende do terminador forte (.!?) anterior ate o seguinte.
        // Importante: o inicio deve ser o ULTIMO .!? antes do termo, nao um
        // terminador ancorado ao fim do slice (caso contrario o prefixo de uma
        // sentenca hipotetica anterior contamina a sentenca do termo atual,
        // marcando como hipotetica uma afirmacao atual em sentenca seguinte).
        const fimSentenca = texto.slice(fim).search(/[.!?]/);
        const sentencaFim = fimSentenca < 0 ? texto.length : fim + fimSentenca + 1;
        let iniSentenca = 0;
        for (let i = idx - 1; i >= 0; i--) {
          if (/[.!?]/.test(texto[i] ?? "")) {
            iniSentenca = i + 1;
            break;
          }
        }
        resultado.push({
          antes,
          depois,
          sentenca: texto.slice(iniSentenca, sentencaFim),
          prefixo: texto.slice(0, idx),
          sujeitoAntes: texto.slice(0, idx).split(DIVISAO_SUJEITO).at(-1) ?? "",
          aposNaSentenca: texto.slice(fim, sentencaFim),
          inicio: idx,
          fim,
        });
      }
      idx = texto.indexOf(alvo, fim);
    }
  }
  return resultado;
}

// Negação direta imediatamente antes do termo.
const RE_NEGADO_ANTES = /\b(?:sem|nega|negou|nego|ausencia de|nao(?:\s+(?:estou|esta|estava|tenho|tem|tive|apresento|apresenta|apresentei)(?:\s+com)?))\s+(?:(?:qualquer|sinais?|evidencias?)\s+(?:de\s+)?)?$/;

// Negação imediatamente depois do termo.
const RE_NEGADO_DEPOIS = /^\s+(?:ausente|negada|negado|negados|negadas)\b/;

function negadoDireto(antes: string, depois: string): boolean {
  return RE_NEGADO_ANTES.test(antes) || RE_NEGADO_DEPOIS.test(depois);
}

// "Não só ... mas também" é construção AFIRMATIVA: a negacao incide sobre
// "só" (exclusividade), nao sobre o sintoma. So consultamos o trecho local
// (antes) — nunca o prefixo global — para nao estender a marcacao a
// clausulas posteriores ("Nao so febre... Sem falta de ar" nao nega a
// dispneia).
function eNaoSoMas(antes: string): boolean {
  return /\bnao\s+so\b/.test(antes);
}

// Negação coordenada: "sem febre ou falta de ar", "sem febre e vomito",
// "nao tenho febre nem vomitos", "nego febre e diarreia". O conectivo
// propaga a negacao do primeiro termo para os seguintes na mesma clausula.
const RE_NEGACAO_COORDENAVEL = /\b(?:sem|nao(?:\s+(?:estou|esta|tenho|tem|apresento|apresenta)(?:\s+com)?)?|nego|negou|nega)\b/;

function negadoCoordenado(oc: Ocorrencia, termosNorm: string[]): boolean {
  // Procura no trecho local (clausula) anterior uma negacao seguida de
  // outro sintoma ja listado, conectada por "e", "nem" ou "ou".
  const clausula = oc.antes;
  const m = clausula.match(RE_NEGACAO_COORDENAVEL);
  if (!m) return false;
  const posNega = clausula.lastIndexOf(m[0]);
  if (posNega < 0) return false;
  const entre = clausula.slice(posNega + m[0].length);
  // deve haver um conectivo coordenado (e|nem|ou) apos a negacao
  const connMatch = entre.match(/\b(?:e|nem|ou)\b/);
  if (!connMatch || connMatch.index === undefined) return false;
  // algum termo canonico (o termo anterior negado) deve aparecer antes do
  // conectivo (neg + termo + conn + ...).
  const antesConn = entre.slice(0, connMatch.index);
  if (!termosNorm.some((t) => t && antesConn.includes(t))) return false;
  // apos o conectivo, um predicado afirmativo novo (estou com, tenho, com,
  // apresenta, etc.) encerra o escopo da negacao — o termo atual eh
  // afirmado, nao herdando a negacao do primeiro termo.
  const aposConn = entre.slice(connMatch.index + connMatch[0].length);
  if (/\b(?:estou|esta|estava|tenho|tem|tive|apresento|apresenta|apresentei|com)\b/.test(aposConn)) return false;
  return true;
}

function passado(texto: string): boolean {
  return /\b(?:ontem|semana\s+passada|mes\s+passado|ha\s+\d+\s+dias|teve|tive|apresentei|tinha|havia)\b/.test(texto);
}

// Coordenação sem novo predicado conserva os marcadores da oração.
function tempoPassadoLocal(oc: Ocorrencia): boolean {
  // Marcadores de uma nova oração já foram separados. Se ambos os tempos
  // permanecem no mesmo trecho, não converter história em afirmação atual.
  return passado(`${oc.antes} ${oc.depois}`);
}

// Marcadores de hipotese/condicional: "caso tenha", "se tiver", "caso apresente",
// "se eu tiver", "caso ela tenha". Admite pronome opcional entre o conectivo e
// o verbo. Nao afirmam sintoma atual; ficam em revisao.
const RE_CONDICIONAL = /\b(?:caso|se)\s+(?:(?:eu|voce|ela|ele|nos|voces|elas|eles)\s+)?(?:tenha|tiver|apresente|apresentar|sinta|sentir|vier|ocorra|ocorrer)\b/;

// Pergunta sobre a existencia do proprio sintoma: o "?" encerra a sentenca e
// NAO ha clausula de conduta explicita ("o que faco", "posso ir...", "devo
// ir...", "o que fazer") apos o termo. A presenca de "e"/"ou" entre sintomas
// NAO caracteriza conduta ("Estou com febre e falta de ar?" eh existencia de
// ambos, nao conduta). Diferente de "Estou com febre; posso ir ao PS?" ou
// "Estou com febre, o que faco?", onde a clausula posterior e explicitamente
// de conduta e a afirmacao do sintoma permanece.
const RE_CONDUTA = /\b(?:o\s+que\s+(?:eu\s+)?fac[oa]|o\s+que\s+fazer|o\s+que\s+(?:eu\s+)?devo\s+fazer|posso\s+ir|devo\s+ir|posso\s+tomar|devo\s+tomar|posso\s+procurar|devo\s+procurar)\b/;

function ePerguntaExistencia(oc: Ocorrencia): boolean {
  if (/\b(?:sera que|talvez|nao sei se|duvida)\b/.test(oc.antes)) return true;
  const s = oc.sentenca.trim();
  if (!s.endsWith("?")) return false;
  // Trecho do fim do termo ate o fim da sentenca (inclusive "?").
  const apos = oc.aposNaSentenca;
  if (!apos.includes("?")) return false;
  // Se ha clausula de conduta explicita apos o termo, nao eh existencia —
  // a afirmacao do sintoma permanece (conduta em clausula posterior).
  if (RE_CONDUTA.test(apos)) return false;
  return true;
}

// Parentesco/terceira pessoa no escopo de sujeito do termo. A presenca de
// um pronome de primeira pessoa ("eu", "estou com", "tenho") no mesmo
// escopo reafirma o paciente como sujeito, mesmo que "minha mae" apareca
// em clausula anterior — "Minha mae esta com febre e eu estou com falta de
// ar" atribui febre ao contato e dispneia ao paciente.
const RE_TERCEIRA = /\b(?:minha\s+mae|meu\s+pai|minha\s+esposa|meu\s+esposo|minha\s+filha|meu\s+filho|meu\s+familiar|meu\s+conjuge|minha\s+conjuge|ela\s+(?:esta|tem|esta)|ele\s+(?:esta|tem|esta))\b/;
const RE_PRIMEIRA = /\b(?:estou|tenho|estava|tive|apresento|sinto)\b/;

function terceiraPessoaLocal(oc: Ocorrencia): boolean {
  // Caminha da clausula atual para tras, buscando marcador de sujeito.
  // Se a clausula local tem RE_PRIMEIRA -> paciente. Se tem RE_TERCEIRA ->
  // contato. Se nao tem nenhum (coordenacao simples "e falta de ar"), herda
  // da clausula anterior: "Minha mae esta com febre e falta de ar" atribui
  // ambos ao contato; "Minha mae esta com febre e eu estou com falta de ar"
  // tem RE_PRIMEIRA na clausula da dispneia -> paciente.
  // Um predicado repetido na terceira pessoa pode manter o sujeito anterior.
  // Autoria usa a oração coordenada inteira, limitada por pontuação forte;
  // tempo/negação continuam no escopo próprio de cada predicado.
  const trecho = oc.prefixo.split(/[.!?;\n]|\b(?:mas|porem|contudo)\b/).at(-1) ?? '';
  const clausulas = trecho.split(DIVISAO_SUJEITO);
  for (let i = clausulas.length - 1; i >= 0; i--) {
    const c = clausulas[i] ?? "";
    if (RE_PRIMEIRA.test(c)) return false;
    if (RE_TERCEIRA.test(c)) return true;
  }
  return false;
}

function pendenteRuleset(rs: CanalRuleset | null | undefined): SaidaInterna {
  const a = achado("CANAL_RULESET", "PENDENTE", RULESET_INATIVO, rs?.id ?? "canal-red-flags", rs?.versao ?? "MISSING", [], ["ruleset"]);
  return { rulesetVersao: rs?.versao ?? "MISSING", flags: [], achados: [a] };
}

/** FN-21: red flags de canal em texto ja desidentificado; resposta sempre fixa por templateId. */
function calcularredFlagsCanal(
  mensagem: CanalMensagemDesidentificada,
  rs: CanalRuleset | null | undefined,
): SaidaInterna {
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
  // Todos os termos canonicos do ruleset, para deteccao de negacao coordenada
  // entre sintomas diferentes ("sem febre ou falta de ar"): o termo anterior
  // negado pode pertencer a outra regra.
  const todosTermosNorm = rs.flags.flatMap((r) => r.termos.map((t) => norm(t).trim())).filter(Boolean);
  const flags: CanalFlag[] = [];
  const achados: Achado[] = [];

  for (const regra of rs.flags) {
    const mencoes = ocorrencias(texto, regra);
    if (!mencoes.length) continue;
    const afirmadas: Ocorrencia[] = [];
    for (const m of mencoes) {
      // "Nao so ... mas tambem" e afirmativo; nao conta como negado.
      const naoSoMas = eNaoSoMas(m.antes);
      const neg = !naoSoMas && (negadoDireto(m.antes, m.depois) || negadoCoordenado(m, todosTermosNorm));
      if (!neg) afirmadas.push(m);
    }
    if (!afirmadas.length) {
      achados.push(achado(regra.codigo, "VERDE", "red flag negada no texto", regra.regraId, rs.versao, ["texto"]));
      continue;
    }

    // Hipotese/condicional: revisao, nao flag. So consulta a clausula local
    // (m.antes) — nunca a sentenca inteira — para evitar que um condicional
    // em oracao anterior a ";" contamine uma afirmacao atual em oracao
    // posterior ("Caso tenha febre, aviso; estou com falta de ar." -> so
    // febre fica PENDENTE; dispneia atual permanece).
    const hipoteticas = afirmadas.filter((m) => RE_CONDICIONAL.test(m.antes));
    const atuais = afirmadas.filter((m) => !RE_CONDICIONAL.test(m.antes));

    // Pergunta sobre existencia do sintoma: revisao, nao flag.
    const perguntas = atuais.filter((m) => ePerguntaExistencia(m));
    const afirmativas = atuais.filter((m) => !ePerguntaExistencia(m));

    if (hipoteticas.length || perguntas.length) {
      achados.push(
        achado(
          regra.codigo,
          "PENDENTE",
          "mencao hipotetica ou pergunta sobre sintoma: requer revisao [VERIFICAR]",
          regra.regraId,
          rs.versao,
          ["texto"],
          ["sintoma_atual_confirmado"],
        ),
      );
      // se tambem ha afirmativas, elas continuam para flag abaixo.
    }

    if (!afirmativas.length) continue;

    // Passado: herda tempo de clausula coordenada anterior quando a clausula
    // local nao tem marcador proprio. "Tive febre ontem e vomitos" -> ambos
    // PENDENTE; "Sem febre ontem, hoje estou com febre" -> segunda febre
    // presente (hoje na propria clausula).
    const passadas = afirmativas.filter((m) => tempoPassadoLocal(m));
    const presentes = afirmativas.filter((m) => !tempoPassadoLocal(m));

    if (passadas.length && !presentes.length) {
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

    // Para cada afirmativa presente, determinar sujeito do trecho local.
    for (const m of presentes) {
      const alvo: CanalFlag["alvo"] = terceiraPessoaLocal(m) || !mensagem.patientId ? "contato" : "paciente";
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
  }

  return { rulesetVersao: rs.versao, flags, achados };
}

export function avaliarRedFlagsCanal(...args: Parameters<typeof calcularredFlagsCanal>): CanalFlagResult {
  const r = calcularredFlagsCanal(...args);
  const achados = r.achados;
  return { ...r, inputs_used: [...new Set(achados.flatMap((a) => a.inputs_used))], inputs_missing: [...new Set(achados.flatMap((a) => a.inputs_missing))] };
}
