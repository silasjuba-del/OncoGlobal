// PROVISORIO-W10: trocar por PrescriptionItem em src/contracts/w10 + dose via porta.

export type ClassePrescricao = "PRE_QT" | "QT" | "POS_QT" | "NAO_ONCO";

export type ProdutoPrescricao = "antineoplasica" | "posQtVo" | "evAvulsa";

export interface LinhaAntineo {
  id: string;
  farmaco: string;
  doseProt: string; // já calculada fora da UI
  dosePresc: string;
  diluente: string;
  via: string;
  fase: "PRE-QT" | "QT" | "POS-QT";
  tempo: string;
  dias: string;
  /** Só exceções do ciclo — true = destacar. */
  excecao: boolean;
  motivoExcecao?: string;
}

export interface PrescricaoVisao {
  produto: ProdutoPrescricao;
  protocolo: string;
  ciclo: string;
  classes: readonly ClassePrescricao[];
  linhas: readonly LinhaAntineo[];
  linhaVo: string;
  evAvulsa: { farmaco: string; dose: string; diluente: string; tempo: string };
}

export function prescricaoSintetica(): PrescricaoVisao {
  return {
    produto: "antineoplasica",
    protocolo: "AC-dd → paclitaxel (sintético)",
    ciclo: "C11",
    classes: ["PRE_QT", "QT", "POS_QT", "NAO_ONCO"],
    linhas: [
      {
        id: "l1",
        farmaco: "Dexametasona",
        doseProt: "20 mg",
        dosePresc: "10 mg",
        diluente: "SF 100 mL",
        via: "EV",
        fase: "PRE-QT",
        tempo: "15 min",
        dias: "D1",
        excecao: true,
        motivoExcecao: "hiperglicemia — ajuste prévio",
      },
      {
        id: "l2",
        farmaco: "Paclitaxel",
        doseProt: "144 mg",
        dosePresc: "144 mg",
        diluente: "SF 250 mL",
        via: "EV",
        fase: "QT",
        tempo: "1 h",
        dias: "D1",
        excecao: false,
      },
      {
        id: "l3",
        farmaco: "Ondansetrona",
        doseProt: "8 mg",
        dosePresc: "8 mg",
        diluente: "—",
        via: "VO",
        fase: "POS-QT",
        tempo: "—",
        dias: "D1–D3",
        excecao: false,
      },
    ],
    linhaVo: "ONDANSETRONA 8 MG VO 8/8H SN NÁUSEA",
    evAvulsa: {
      farmaco: "Cloreto de sódio 0,9%",
      dose: "500 mL",
      diluente: "—",
      tempo: "2 h",
    },
  };
}

export function aplicarAjustePercentual(
  dosePresc: string,
  pct: 20 | 30 | 40,
): string {
  const n = Number.parseFloat(dosePresc.replace(",", "."));
  if (!Number.isFinite(n)) return dosePresc;
  const unidade = dosePresc.replace(/^[\d.,\s]+/, "").trim() || "mg";
  const novo = Math.round(n * (1 - pct / 100) * 10) / 10;
  return `${novo} ${unidade}`.trim();
}

export function rotuloClasse(c: ClassePrescricao): string {
  if (c === "PRE_QT") return "PRÉ-QT";
  if (c === "QT") return "QT";
  if (c === "POS_QT") return "PÓS-QT";
  return "NÃO ONCOLÓGICAS";
}
