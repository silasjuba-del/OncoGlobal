// W10-INT-PRESC-04 · "o que mudou neste ciclo?" (D-W9-45): a UI mostra só as EXCEÇÕES. Função pura.
import type { ClinicalOrder, PrescriptionItem } from "../../contracts/w10/prescricao.js";

export type CampoComparado =
  | "classe" | "sequence" | "standardDose" | "doseBasis" | "calculatedDose" | "prescribedDose" | "unit"
  | "adjustmentPercent" | "adjustmentReason" | "route" | "diluent" | "finalVolumeMl" | "infusionTime"
  | "days" | "observacao" | "source" | "overrideMotivo";

const CAMPOS: readonly CampoComparado[] = [
  "classe", "sequence", "standardDose", "doseBasis", "calculatedDose", "prescribedDose", "unit",
  "adjustmentPercent", "adjustmentReason", "route", "diluent", "finalVolumeMl", "infusionTime",
  "days", "observacao", "source", "overrideMotivo",
];

export interface MudancaCampo { campo: CampoComparado; anterior: unknown; atual: unknown }
export type Excecao =
  | { tipo: "ADICIONADO"; drug: string; sequence: number }
  | { tipo: "REMOVIDO"; drug: string; sequence: number }
  | { tipo: "ALTERADO"; drug: string; sequence: number; mudancas: MudancaCampo[] };
export interface MudancaOrdem { campo: "templateId" | "templateVersao"; anterior: string | null; atual: string | null }

export interface DiffCiclo {
  /** false quando não há ordem anterior para comparar (primeiro ciclo): nada é "exceção" */
  temAnterior: boolean;
  /** versão/identidade do template mudou entre os ciclos */
  ordem: MudancaOrdem[];
  excecoes: Excecao[];
  houveMudanca: boolean;
}

const norm = (t: string): string => t.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase();

function chaves(itens: readonly PrescriptionItem[]): Map<string, PrescriptionItem> {
  const m = new Map<string, PrescriptionItem>();
  const n = new Map<string, number>();
  for (const i of itens) {
    const k = norm(i.drug);
    const c = n.get(k) ?? 0;
    n.set(k, c + 1);
    m.set(`${k}#${c}`, i); // mesmo fármaco repetido (ex.: SF) casa por ordem de ocorrência
  }
  return m;
}

const igual = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

export function diffCiclo(ordemAtual: ClinicalOrder, ordemAnterior: ClinicalOrder | null): DiffCiclo {
  if (ordemAnterior === null) return { temAnterior: false, ordem: [], excecoes: [], houveMudanca: false };
  const ordem: MudancaOrdem[] = [];
  if (ordemAtual.templateId !== ordemAnterior.templateId)
    ordem.push({ campo: "templateId", anterior: ordemAnterior.templateId, atual: ordemAtual.templateId });
  if (ordemAtual.templateVersao !== ordemAnterior.templateVersao)
    ordem.push({ campo: "templateVersao", anterior: ordemAnterior.templateVersao, atual: ordemAtual.templateVersao });

  const atual = chaves(ordemAtual.itens);
  const anterior = chaves(ordemAnterior.itens);
  const excecoes: Excecao[] = [];
  for (const [k, a] of atual) {
    const b = anterior.get(k);
    if (!b) { excecoes.push({ tipo: "ADICIONADO", drug: a.drug, sequence: a.sequence }); continue; }
    const mudancas: MudancaCampo[] = [];
    for (const campo of CAMPOS) if (!igual(a[campo], b[campo])) mudancas.push({ campo, anterior: b[campo], atual: a[campo] });
    if (mudancas.length) excecoes.push({ tipo: "ALTERADO", drug: a.drug, sequence: a.sequence, mudancas });
  }
  for (const [k, b] of anterior) if (!atual.has(k)) excecoes.push({ tipo: "REMOVIDO", drug: b.drug, sequence: b.sequence });
  return { temAnterior: true, ordem, excecoes, houveMudanca: ordem.length > 0 || excecoes.length > 0 };
}
