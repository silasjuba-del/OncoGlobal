// GRK-02 · Bundles são manifestos do pack. O módulo não preenche documento clínico.
import { fonteInformada } from "../base.js";
import type { Semaforo } from "../base.js";

export const BUNDLES = [
  "FIM_PRIMEIRA_CONSULTA",
  "RETORNO_QT",
  "AVALIACAO_RESPOSTA",
  "RENOVACAO_APAC",
] as const;

export type BundleId = (typeof BUNDLES)[number];

export interface ItemBundle {
  documento: string;
  preMarcado: boolean;
}

export interface ManifestoBundle {
  bundleId: BundleId;
  itens: readonly ItemBundle[];
}

export interface PackConsulta {
  id: string;
  versao: string;
  fonte: string;
  bundles: readonly ManifestoBundle[];
}

export interface BundleMontado {
  bundleId: string;
  itens: ItemBundle[];
  estado: Semaforo;
  motivo: string;
}

export function montarBundle(pack: PackConsulta | null, bundleId: string): BundleMontado {
  if (pack === null) return vazio(bundleId, "PENDENTE", "pack ausente");
  if (!fonteInformada(pack.fonte)) return vazio(bundleId, "PENDENTE", "[VERIFICAR] pack sem fonte");
  if (!ehBundleId(bundleId)) return vazio(bundleId, "PENDENTE", "bundle desconhecido");

  const encontrados = pack.bundles.filter((bundle) => bundle.bundleId === bundleId);
  if (encontrados.length === 0) return vazio(bundleId, "PENDENTE", "bundle ausente no pack");
  if (encontrados.length > 1) return vazio(bundleId, "PENDENTE", "bundle repetido no pack; nada eleito");

  const manifesto = encontrados[0];
  if (manifesto === undefined) return vazio(bundleId, "PENDENTE", "bundle ausente no pack");
  return {
    bundleId,
    itens: manifesto.itens.map((item) => ({ documento: item.documento, preMarcado: item.preMarcado })),
    estado: "VERDE",
    motivo: "manifesto do pack",
  };
}

function vazio(bundleId: string, estado: Semaforo, motivo: string): BundleMontado {
  return { bundleId, itens: [], estado, motivo };
}

function ehBundleId(valor: string): valor is BundleId {
  return (BUNDLES as readonly string[]).includes(valor);
}
