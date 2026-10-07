// W10-INT-PRESC-06 · SafetyEngine (D-W9-24 §5, D-W9-22a/d). Função pura; sem LLM.
// - Cada protocolo/droga DECLARA o que exige (ValidationRequirement); nada de bloqueio universal.
// - Dado ausente/antigo/futuro ⇒ NOT_EVALUABLE (= PENDENTE), nunca PASS e nunca "contraindicação".
// - BLOCK_ARTEFATO bloqueia só o ARTEFATO (emitir/imprimir a ordem), NUNCA o médico nem a consulta,
//   e só por limiar de BULA declarado na ficha (LimiaresBula). Grau CTCAE não entra aqui.
// - Precedência do veredito: BLOCK_ARTEFATO > NOT_EVALUABLE > WARNING > PASS.
import type { LimiaresBula, PrescriptionItem, SafetyVerdict } from "../../contracts/w10/prescricao.js";

// PROVISORIO-W10: trocar por src/contracts/w10/... (ValidationRequirement ainda não é contrato; ver relatório)
export interface ValidationRequirement {
  /** nome do fármaco (sem acento/caixa) ou "*" para todos os itens */
  drug: string;
  requiresWeight?: boolean;
  requiresHeight?: boolean;
  requiresBSA?: boolean;
  renalRequirement?: boolean;
  hepaticRequirement?: boolean;
  hematologicRequirement?: boolean;
  cardiacRequirement?: boolean;
  maximumDataAgeDays?: number;
}

export interface Medida { valor: number | null; medidoEm: string | null }
export interface LabsEntrada {
  /** "hoje" é injetado (YYYY-MM-DD); função pura não lê relógio */
  hoje: string;
  peso?: Medida | null;
  altura?: Medida | null;
  bsa?: Medida | null;
  /** depuração de creatinina, mL/min */
  clcr?: Medida | null;
  /** neutrófilos /µL */
  neutrofilos?: Medida | null;
  /** plaquetas /µL */
  plaquetas?: Medida | null;
  /** FEVE, % */
  feve?: Medida | null;
  /** marcador hepático escolhido pelo serviço (ex.: bilirrubina); só presença/idade são avaliadas */
  hepatico?: Medida | null;
}

type Sev = "BLOCK_ARTEFATO" | "NOT_EVALUABLE" | "WARNING";
interface Motivo { sev: Sev; codigo: string; texto: string; fonte: string }

const norm = (t: string): string => t.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase();

function diasEntre(hoje: string, medido: string): number | null {
  const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(hoje);
  const b = /^(\d{4})-(\d{2})-(\d{2})/.exec(medido);
  if (!a || !b) return null;
  const ms = (m: RegExpExecArray): number => Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const da = ms(a), db = ms(b);
  if (Number.isNaN(da) || Number.isNaN(db)) return null;
  return Math.round((da - db) / 86_400_000);
}

type Leitura = { ok: true; valor: number } | { ok: false; motivo: Motivo };

/** idade só é exigida quando `maxIdade` foi declarado */
function ler(m: Medida | null | undefined, cod: string, rotulo: string, hoje: string, maxIdade: number | undefined, fonte: string): Leitura {
  const pend = (c: string, t: string): Leitura => ({ ok: false, motivo: { sev: "NOT_EVALUABLE", codigo: `${cod}_${c}`, texto: `${rotulo}: ${t}`, fonte } });
  if (!m || m.valor === null || !Number.isFinite(m.valor)) return pend("AUSENTE", "dado ausente (PENDENTE)");
  if (maxIdade !== undefined) {
    if (m.medidoEm === null) return pend("SEM_DATA", "data da medida ausente (PENDENTE)");
    const d = diasEntre(hoje, m.medidoEm);
    if (d === null) return pend("SEM_DATA", "data da medida ilegível (PENDENTE)");
    if (d < 0) return pend("DATA_FUTURA", "data da medida no futuro (PENDENTE)");
    if (d > maxIdade) return pend("ANTIGO", `dado de ${d} dia(s); máximo declarado ${maxIdade} (PENDENTE)`);
  }
  return { ok: true, valor: m.valor };
}

export function safetyEngine(
  itens: readonly PrescriptionItem[],
  requisitos: readonly ValidationRequirement[],
  labs: LabsEntrada,
  limiares?: LimiaresBula | null,
): SafetyVerdict {
  const motivos: Motivo[] = [];
  const add = (m: Motivo): void => { if (!motivos.some((x) => x.codigo === m.codigo && x.texto === m.texto)) motivos.push(m); };

  if (itens.length === 0)
    add({ sev: "NOT_EVALUABLE", codigo: "SEM_ITENS", texto: "ordem sem itens: nada a avaliar", fonte: "ordem" });

  // 1) itens
  for (const it of itens) {
    const rot = `${it.drug} (seq ${it.sequence})`;
    if (it.prescribedDose === null)
      add({ sev: "NOT_EVALUABLE", codigo: "DOSE_PENDENTE", texto: `${rot}: dose prescrita ausente (PENDENTE)`, fonte: "ordem" });
    if (it.source === "MANUAL" && it.classe === "QT")
      add({ sev: "WARNING", codigo: "QT_FORA_DO_PROTOCOLO", texto: `${rot}: antineoplásico fora do protocolo (alerta; decisão do médico)`, fonte: "ordem" });
    if (it.prescribedDose !== null && it.calculatedDose !== null && it.adjustmentPercent === null && it.prescribedDose !== it.calculatedDose)
      add({ sev: "WARNING", codigo: "DOSE_DIVERGE_CALCULADA", texto: `${rot}: dose prescrita ${it.prescribedDose} difere da calculada ${it.calculatedDose} sem ajuste −20/−30/−40 (alerta)`, fonte: "ordem" });
  }

  // 2) requisitos declarados, só para os fármacos a que se aplicam
  const aplicaveis = (it: PrescriptionItem): ValidationRequirement[] =>
    requisitos.filter((r) => r.drug === "*" || norm(r.drug) === norm(it.drug));
  const exigencias: Array<[keyof ValidationRequirement, string, string, keyof LabsEntrada]> = [
    ["requiresWeight", "PESO", "peso", "peso"],
    ["requiresHeight", "ALTURA", "altura", "altura"],
    ["requiresBSA", "BSA", "superfície corporal", "bsa"],
    ["renalRequirement", "RENAL", "função renal (clcr)", "clcr"],
    ["hepaticRequirement", "HEPATICO", "função hepática", "hepatico"],
    ["cardiacRequirement", "CARDIACO", "função cardíaca (FEVE)", "feve"],
  ];
  for (const it of itens) {
    for (const r of aplicaveis(it)) {
      const fonte = `requisito declarado: ${r.drug}`;
      for (const [flag, cod, rot, chave] of exigencias) {
        if (r[flag] !== true) continue;
        const l = ler(labs[chave] as Medida | null | undefined, cod, rot, labs.hoje, r.maximumDataAgeDays, fonte);
        if (!l.ok) add(l.motivo);
      }
      if (r.hematologicRequirement === true) {
        for (const [cod, rot, chave] of [["NEUTROFILOS", "neutrófilos", "neutrofilos"], ["PLAQUETAS", "plaquetas", "plaquetas"]] as const) {
          const l = ler(labs[chave], cod, rot, labs.hoje, r.maximumDataAgeDays, fonte);
          if (!l.ok) add(l.motivo);
        }
      }
    }
  }

  // 3) limiares de BULA da ficha: única fonte de BLOCK_ARTEFATO (D-W9-22a); só com itens QT
  const qt = itens.filter((i) => i.classe === "QT");
  if (limiares && qt.length > 0) {
    const idades = qt.flatMap(aplicaveis).map((r) => r.maximumDataAgeDays).filter((n): n is number => n !== undefined);
    const maxIdade = idades.length ? Math.min(...idades) : undefined;
    const regras: Array<[number | null, "NEUTROFILOS" | "PLAQUETAS" | "CLCR" | "FEVE", string, keyof LabsEntrada, string]> = [
      [limiares.neutrofilosMin, "NEUTROFILOS", "neutrófilos", "neutrofilos", "/µL"],
      [limiares.plaquetasMin, "PLAQUETAS", "plaquetas", "plaquetas", "/µL"],
      [limiares.clcrMinMlMin, "CLCR", "clearance de creatinina", "clcr", " mL/min"],
      [limiares.fevePctMin, "FEVE", "FEVE", "feve", "%"],
    ];
    for (const [min, cod, rot, chave, un] of regras) {
      if (min === null) continue;
      const l = ler(labs[chave] as Medida | null | undefined, cod, rot, labs.hoje, maxIdade, limiares.fonte);
      if (!l.ok) { add(l.motivo); continue; }
      if (l.valor < min) // igual ao limiar passa (inteiros nas bordas, K-10)
        add({ sev: "BLOCK_ARTEFATO", codigo: `${cod}_ABAIXO_BULA`, texto: `${rot} ${l.valor}${un} abaixo do limiar de bula ${min}${un}: ordem não é emitida; o médico decide`, fonte: limiares.fonte });
    }
  }

  const tem = (s: Sev): boolean => motivos.some((m) => m.sev === s);
  const resultado: SafetyVerdict["resultado"] = tem("BLOCK_ARTEFATO") ? "BLOCK_ARTEFATO"
    : tem("NOT_EVALUABLE") ? "NOT_EVALUABLE" : tem("WARNING") ? "WARNING" : "PASS";
  return { resultado, motivos: motivos.map(({ codigo, texto, fonte }) => ({ codigo, texto, fonte })) };
}
