// K-21 / INV-15 · G-16. Veredito de write por dono. O catálogo declara; esta função aplica.
// O registro em gates.ts fica com o harness (fora desta faixa). Ver docs/w10/PEDIDOS-GROK.md.

import { readFileSync } from "node:fs";
import type { AgentSpec } from "../../contracts/agentes.js";

export interface DonoDeclarado {
  id: AgentSpec["id"];
  ownerOf: AgentSpec["ownerOf"];
}

export interface CatalogoDonos {
  agentes: readonly DonoDeclarado[];
}

export interface VereditoG16 {
  gate: "G-16";
  decisao: "PASSA" | "BLOQUEIA_AUTORIDADE" | "PENDENTE";
  motivo: string;
}

type Bruto = Record<string, unknown>;

function objeto(valor: unknown, caminho: string): Bruto {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) throw new Error(`${caminho} ausente`);
  return valor as Bruto;
}

function idAgente(valor: unknown, caminho: string): string {
  if (typeof valor !== "string" || !/^AG-\d{2}$/.test(valor)) throw new Error(`${caminho} inválido`);
  return valor;
}

function listaDono(valor: unknown, caminho: string): string[] {
  if (!Array.isArray(valor) || valor.length === 0) throw new Error(`${caminho} ausente`);
  return valor.map((item, i) => {
    if (typeof item !== "string" || item.trim().length === 0) throw new Error(`${caminho}[${i}] inválido`);
    return item.trim();
  });
}

export function lerCatalogoDonos(json: unknown): CatalogoDonos {
  const raiz = objeto(json, "capabilities");
  const agentes = raiz.agentes;
  if (!Array.isArray(agentes) || agentes.length === 0) throw new Error("agentes ausente");
  return {
    agentes: agentes.map((item, i) => {
      const o = objeto(item, `agentes[${i}]`);
      return { id: idAgente(o.id, `agentes[${i}].id`), ownerOf: listaDono(o.ownerOf, `agentes[${i}].ownerOf`) };
    }),
  };
}

function catalogoPadrao(): CatalogoDonos {
  const url = new URL("../../../corpus/capabilities.v1.json", import.meta.url);
  return lerCatalogoDonos(JSON.parse(readFileSync(url, "utf8")));
}

function texto(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpo = valor.trim();
  return limpo.length === 0 ? null : limpo;
}

function mapa(catalogo: CatalogoDonos): Map<string, string[]> {
  const donos = new Map<string, string[]>();
  for (const agente of catalogo.agentes) {
    for (const objetoTipo of agente.ownerOf) {
      const lista = donos.get(objetoTipo) ?? [];
      if (!lista.includes(agente.id)) lista.push(agente.id);
      donos.set(objetoTipo, lista);
    }
  }
  return donos;
}

function veredito(decisao: VereditoG16["decisao"], motivo: string): VereditoG16 {
  return { gate: "G-16", decisao, motivo };
}

export function g16Owner(input: unknown, catalogo?: CatalogoDonos): VereditoG16 {
  const bruto = typeof input === "object" && input !== null && !Array.isArray(input) ? input as Bruto : null;
  const operacao = texto(bruto?.operacao)?.toLowerCase() ?? null;
  if (operacao === "read") return veredito("PASSA", "leitura não é write (K-21)");
  if (operacao !== "write") return veredito("PENDENTE", "operação ausente ou diferente de write (K-21)");

  const agenteId = texto(bruto?.agenteId);
  const objetoTipo = texto(bruto?.objetoTipo);
  if (agenteId === null || objetoTipo === null) {
    return veredito("PENDENTE", "agente ou objeto ausente no write (K-21)");
  }

  const donos = mapa(catalogo ?? catalogoPadrao()).get(objetoTipo) ?? [];
  if (donos.length === 0) return veredito("BLOQUEIA_AUTORIDADE", `${objetoTipo} sem dono declarado no catálogo (K-21)`);
  if (donos.length > 1) {
    return veredito("BLOQUEIA_AUTORIDADE", `${objetoTipo} tem mais de um dono declarado: ${donos.join(", ")} (K-21)`);
  }
  const dono = donos[0];
  if (dono === undefined) return veredito("BLOQUEIA_AUTORIDADE", `${objetoTipo} sem dono declarado no catálogo (K-21)`);
  if (dono === agenteId) return veredito("PASSA", `${agenteId} é o dono declarado de ${objetoTipo} (K-21)`);
  return veredito("BLOQUEIA_AUTORIDADE", `write de ${objetoTipo} por ${agenteId}: dono declarado ${dono} (K-21)`);
}
