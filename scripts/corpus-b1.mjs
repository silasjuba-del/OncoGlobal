// F1-B1 · Verificações do lote clínico de 14/10 sobre o corpus. Puro: recebe a raiz do repositório e devolve problemas.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function* objetos(v) {
  if (Array.isArray(v)) { for (const x of v) yield* objetos(x); return; }
  if (v && typeof v === "object") { yield v; for (const x of Object.values(v)) yield* objetos(x); }
}

/** @returns {string[]} problemas; vazio = ok */
export function verificarB1(raiz) {
  const problemas = [];
  const manifesto = join(raiz, "corpus/manifesto/b1-alteracoes.v1.json");
  if (!existsSync(manifesto)) return problemas; // fatia ainda não aplicada neste checkout
  let alteracoes;
  try { alteracoes = JSON.parse(readFileSync(manifesto, "utf8")).alteracoes; } catch (e) { return [`manifesto B1 inválido: ${e.message}`]; }
  if (!Array.isArray(alteracoes)) return ["manifesto B1 sem lista de alterações"];
  // 1. cada item alterado cita a decisão de origem dentro do próprio arquivo
  for (const { arquivo, decisao } of alteracoes) {
    if (!/^D-F1-\d+$/.test(String(decisao))) { problemas.push(`${arquivo}: decisão de origem inválida (${decisao})`); continue; }
    const caminho = join(raiz, String(arquivo));
    if (!existsSync(caminho)) { problemas.push(`${arquivo}: arquivo do manifesto não existe`); continue; }
    if (!readFileSync(caminho, "utf8").includes(decisao)) problemas.push(`${arquivo}: alterado sem citar a decisão de origem ${decisao}`);
  }
  // 2. regras estruturais sobre os arquivos do manifesto
  for (const arquivo of new Set(alteracoes.map((a) => a.arquivo))) {
    const caminho = join(raiz, String(arquivo));
    if (!existsSync(caminho)) continue;
    let json; try { json = JSON.parse(readFileSync(caminho, "utf8")); } catch { continue; }
    for (const o of objetos(json)) {
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
