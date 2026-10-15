// F1-B1 · Verificações do lote clínico de 14/10 sobre o corpus. Puro: recebe a raiz do repositório e devolve problemas.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function* objetos(v) {
  if (Array.isArray(v)) { for (const x of v) yield* objetos(x); return; }
  if (v && typeof v === "object") { yield v; for (const x of Object.values(v)) yield* objetos(x); }
}

/**
 * Localizador por objeto (proveniência por OBJETO, não por arquivo).
 * Formato: "a.b[chave=valor].c"; "" aponta a raiz. Seletor por chave=valor deve casar exatamente UM elemento.
 * Índice numérico não é aceito: a ordem do array pode mudar sem mudar o objeto.
 * @returns {{ ok: true, valor: any } | { ok: false, erro: string }}
 */
export function resolverLocalizador(raiz, caminho) {
  if (typeof caminho !== "string") return { ok: false, erro: "localizador ausente" };
  const segmentos = [];
  let atual = "", colchete = false;
  for (const c of caminho) {
    if (c === "[") colchete = true;
    if (c === "]") colchete = false;
    if (c === "." && !colchete) { segmentos.push(atual); atual = ""; continue; }
    atual += c;
  }
  if (colchete) return { ok: false, erro: `localizador malformado (${caminho})` };
  if (atual !== "" || segmentos.length) segmentos.push(atual);
  let v = raiz;
  for (const seg of segmentos) {
    const m = /^([^[\]]+)(?:\[([^=\]]+)=([^\]]*)\])?$/.exec(seg);
    if (!m) return { ok: false, erro: `localizador malformado (${caminho})` };
    const [, chave, campoSel, valorSel] = m;
    if (!v || typeof v !== "object" || Array.isArray(v) || !Object.hasOwn(v, chave)) return { ok: false, erro: `localizador não encontrado (${caminho})` };
    v = v[chave];
    if (campoSel !== undefined) {
      if (!Array.isArray(v)) return { ok: false, erro: `localizador não aponta lista em ${chave} (${caminho})` };
      const achados = v.filter((x) => x && typeof x === "object" && String(x[campoSel]) === valorSel);
      if (achados.length !== 1) return { ok: false, erro: `localizador ${achados.length === 0 ? "não encontrado" : "ambíguo"} (${caminho})` };
      v = achados[0];
    }
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) return { ok: false, erro: `localizador não aponta objeto (${caminho})` };
  return { ok: true, valor: v };
}

/** @returns {string[]} problemas; vazio = ok */
export function verificarB1(raiz) {
  const problemas = [];
  const manifesto = join(raiz, "corpus/manifesto/b1-alteracoes.v1.json");
  if (!existsSync(manifesto)) return problemas; // fatia ainda não aplicada neste checkout
  let alteracoes;
  try { alteracoes = JSON.parse(readFileSync(manifesto, "utf8")).alteracoes; } catch (e) { return [`manifesto B1 inválido: ${e.message}`]; }
  if (!Array.isArray(alteracoes)) return ["manifesto B1 sem lista de alterações"];
  // 1. cada OBJETO alterado cita a decisão de origem no campo apontado (não basta o arquivo citar em outro lugar)
  const cache = new Map();
  for (const { arquivo, decisao, caminho, campo } of alteracoes) {
    if (!/^D-F1-\d+$/.test(String(decisao))) { problemas.push(`${arquivo}: decisão de origem inválida (${decisao})`); continue; }
    if (typeof caminho !== "string" || typeof campo !== "string" || !campo) { problemas.push(`${arquivo}: alteração ${decisao} sem localizador por objeto (caminho + campo)`); continue; }
    const disco = join(raiz, String(arquivo));
    if (!existsSync(disco)) { problemas.push(`${arquivo}: arquivo do manifesto não existe`); continue; }
    if (!cache.has(disco)) { try { cache.set(disco, JSON.parse(readFileSync(disco, "utf8"))); } catch { cache.set(disco, null); } }
    const json = cache.get(disco);
    if (json === null) { problemas.push(`${arquivo}: JSON inválido`); continue; }
    const alvo = resolverLocalizador(json, caminho);
    if (!alvo.ok) { problemas.push(`${arquivo}: ${alvo.erro}`); continue; }
    const valor = alvo.valor[campo];
    if (typeof valor !== "string" || !new RegExp(`\\b${decisao}\\b`).test(valor))
      problemas.push(`${arquivo}: objeto ${caminho || "(raiz)"} alterado sem citar a decisão de origem ${decisao} em ${campo}`);
  }
  // 2. regras estruturais sobre os arquivos do manifesto
  for (const arquivo of new Set(alteracoes.map((a) => a.arquivo))) {
    const caminho = join(raiz, String(arquivo));
    if (!existsSync(caminho)) continue;
    let json; try { json = JSON.parse(readFileSync(caminho, "utf8")); } catch { continue; }
    // fármacos indisponíveis no mercado declarados neste arquivo (D-F1-29)
    const indisponiveis = [...new Set([...objetos(json)]
      .filter((o) => typeof o.droga === "string" && o.disponibilidadeMercado?.estado === "INDISPONIVEL")
      .map((o) => o.droga.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()))];
    for (const o of objetos(json)) {
      // protocolo proposto não afirma fornecimento de fármaco indisponível (D-F1-29); citação literal de fonte (fonte*) é preservada
      if (Array.isArray(o.drogas) && indisponiveis.length) {
        const textos = [];
        const coletar = (v, chave) => {
          if (typeof chave === "string" && /^fonte/i.test(chave)) return;
          if (typeof v === "string") textos.push(v);
          else if (Array.isArray(v)) v.forEach((x) => coletar(x));
          else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) coletar(x, k);
        };
        coletar(o);
        for (const t of textos) {
          // por frase: "fornecimento pelo CACON" e "esquema sem mitotano" em frases distintas não são afirmação de fornecimento
          for (const frase of t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[.;]\s+/)) {
            const droga = indisponiveis.find((d) => frase.includes(d) && /forneci/.test(frase));
            if (droga) problemas.push(`${arquivo}: protocolo proposto ${o.id ?? "?"} afirma fornecimento de ${droga}, indisponível (D-F1-29)`);
          }
        }
      }
      // lembrete nunca gera pedido nem trava (D-F1-32)
      if (o.tipo === "LEMBRETE" && (o.gerarPedido !== false || o.bloqueia !== false))
        problemas.push(`${arquivo}: lembrete ${o.id ?? "?"} deve ter gerarPedido=false e bloqueia=false`);
      // indisponível no mercado nunca é proposto (D-F1-29)
      if (o.disponibilidadeMercado?.estado === "INDISPONIVEL" && Object.hasOwn(o, "propor") && o.propor !== false)
        problemas.push(`${arquivo}: item indisponível (${o.id ?? o.droga ?? "?"}) marcado para propor`);
      // política local: referência consultável nunca é proposta (D-F1-30)
      if (o.politicaLocal?.estado === "REFERENCIA_CONSULTAVEL" && o.politicaLocal.propor !== false)
        problemas.push(`${arquivo}: ${o.id ?? "?"} é referência consultável e não pode ser proposto`);
      // laudo: nada bloqueia a emissão e ausente não é impresso (D-F1-37/38)
      if (o.bloqueiaEmissao === true) problemas.push(`${arquivo}: laudo não pode bloquear a emissão (D-F1-37)`);
      if (o.dadoAusente && (o.dadoAusente.imprimir !== false || o.dadoAusente.citar !== false))
        problemas.push(`${arquivo}: dado ausente não pode ser impresso nem citado (D-F1-38)`);
    }
  }
  return problemas;
}
