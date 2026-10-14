import { Achado, AchadosSetor, SetorClinico, type Lacuna } from "../../contracts/f1/achadosSetor.js";
import type { Correlacao } from "../../contracts/f1/correlacao.js";
import type { Retrato } from "../../contracts/f1/retrato.js";
import { VisaoIntegrada } from "../../contracts/f1/visaoIntegrada.js";

/** Structural contract: the reconciler does not depend on the executor. */
export type ResultadoPasso =
  | { id: string; resultado: "ok"; saida: unknown; tentativas: number }
  | { id: string; resultado: "missing" | "error" | "unattempted" | "timeout"; motivo: string; tentativas: number };
export interface RegraCruzamento {
  aprovada: true;
  referencia: Correlacao["regras"][number];
  setores: readonly SetorClinico[];
  avaliar: (retrato: Readonly<Retrato>, achados: readonly Achado[]) => readonly Achado[];
}

const chaveVersao = (r: Correlacao["biblioteca"]) => JSON.stringify([r.id, r.versao, r.hash]);
const versoes = (rs: Correlacao["regras"]) => JSON.stringify(rs.map(chaveVersao).sort());
export function mesmaCorrelacao(a: Correlacao, b: Correlacao): boolean {
  return a.patientId === b.patientId && a.encounterId === b.encounterId && a.tumorLotId === b.tumorLotId
    && a.operationId === b.operationId && a.revisaoFatos === b.revisaoFatos
    && versoes(a.regras) === versoes(b.regras) && chaveVersao(a.biblioteca) === chaveVersao(b.biblioteca)
    && a.proposta?.id === b.proposta?.id && a.proposta?.revisao === b.proposta?.revisao;
}
const chaveFato = (r: { eventId: string; revisao: string }) => JSON.stringify([r.eventId, r.revisao]);
const unicos = <T>(xs: readonly T[], chave: (x: T) => string): T[] => [...new Map(xs.map(x => [chave(x), x])).values()];

export function reconciliar(
  resultados: readonly ResultadoPasso[], retrato: Retrato, correlacao: Correlacao,
  setoresEsperados: readonly SetorClinico[] = SetorClinico.options,
  regrasCruzamento: readonly RegraCruzamento[] = [],
): VisaoIntegrada {
  const esperados = [...new Set(setoresEsperados)];
  const lacunas: Lacuna[] = [];
  const achados: Achado[] = [];
  const avaliados = new Set<SetorClinico>();
  let quantidade = 0;
  let semRegraAprovada = 0;
  const lacuna = (codigo: string, texto: string, setor: SetorClinico) => lacunas.push({ codigo, texto, setor, fatos: [] });
  const regrasAtuais = new Set(correlacao.regras.map(chaveVersao));
  const refs = new Set(retrato.fatos.filter(f => f.patientId === correlacao.patientId
    && (f.escopo === "PACIENTE" || f.tumorLotId === correlacao.tumorLotId)).map(f => chaveFato(f.ref)));
  const referenciasValidas = (rs: readonly { eventId: string; revisao: string }[]) => rs.every(r => refs.has(chaveFato(r)));
  const achadoValido = (a: Achado) => a.fatos.length > 0 && referenciasValidas(a.fatos)
    && a.regras.length > 0 && a.regras.every(r => regrasAtuais.has(chaveVersao(r)));
  const retratoAtual = retrato.patientId === correlacao.patientId && retrato.encounterId === correlacao.encounterId
    && retrato.tumorLotId === correlacao.tumorLotId && retrato.revisao === correlacao.revisaoFatos
    && versoes(retrato.regras) === versoes(correlacao.regras) && chaveVersao(retrato.biblioteca) === chaveVersao(correlacao.biblioteca);
  if (!retratoAtual) {
    for (const setor of esperados) lacuna("DESATUALIZADO", "Retrato incompatível com a revisão solicitada.", setor);
    return VisaoIntegrada.parse({ schema: "VisaoIntegrada@1", correlacao, achados, lacunas,
      cobertura: { setoresEsperados: esperados, setoresAvaliados: [], avaliados: 0, semRegraAprovada: esperados.length } });
  }
  for (const resultado of resultados) {
    const setorId = SetorClinico.safeParse(resultado.id.toUpperCase());
    if (resultado.resultado !== "ok") {
      const afetados = setorId.success ? [setorId.data] : esperados;
      for (const setor of afetados) lacuna(`EXECUCAO_${resultado.resultado.toUpperCase()}`, `Etapa ${resultado.id} não concluída.`, setor);
      continue;
    }
    const parsed = AchadosSetor.safeParse(resultado.saida);
    if (!parsed.success) {
      for (const setor of setorId.success ? [setorId.data] : esperados) lacuna("SAIDA_INVALIDA", `Etapa ${resultado.id} sem contrato setorial válido.`, setor);
      continue;
    }
    const saida = parsed.data;
    if (!mesmaCorrelacao(saida.correlacao, correlacao)) {
      lacuna("DESATUALIZADO", "Resultado pertence a outro contexto ou revisão.", saida.setor);
      continue;
    }
    if (!referenciasValidas(saida.entradas) || saida.achados.some(a => !achadoValido(a))
      || saida.lacunas.some(l => !referenciasValidas(l.fatos) || l.setor !== saida.setor)
      || saida.achados.some(a => !a.setores.includes(saida.setor))) {
      lacuna("EVIDENCIA_INVALIDA", "Resultado referencia fatos ou regras fora do retrato vigente.", saida.setor);
      continue;
    }
    if (avaliados.has(saida.setor)) {
      // Preserve additional risks but do not count duplicate coverage twice.
      achados.push(...saida.achados); lacunas.push(...saida.lacunas); continue;
    }
    avaliados.add(saida.setor); quantidade += saida.cobertura.avaliados;
    semRegraAprovada += saida.cobertura.semRegraAprovada;
    achados.push(...saida.achados); lacunas.push(...saida.lacunas);
    if (saida.cobertura.semRegraAprovada > 0) lacuna("SEM_REGRA_APROVADA", "Há entradas sem regra aprovada; cobertura clínica incompleta.", saida.setor);
  }
  for (const setor of esperados) if (!avaliados.has(setor)) {
    lacuna("SETOR_AUSENTE", "Setor sem avaliação atual válida.", setor); semRegraAprovada++;
  }
  for (const regra of regrasCruzamento) {
    if (regra.aprovada !== true || !regrasAtuais.has(chaveVersao(regra.referencia))) {
      for (const setor of regra.setores) lacuna("SEM_REGRA_APROVADA", "Cruzamento sem regra aprovada na versão vigente.", setor);
      semRegraAprovada++; continue;
    }
    if (regra.setores.some(s => !avaliados.has(s))) continue;
    try {
      // A rule receives detached evidence and cannot mutate the snapshot or preceding risks.
      const cruzados = regra.avaliar(structuredClone(retrato), structuredClone(achados));
      for (const candidato of cruzados) {
        const a = Achado.safeParse(candidato);
        if (!a.success || !achadoValido(a.data) || !a.data.regras.some(r => chaveVersao(r) === chaveVersao(regra.referencia))
          || regra.setores.some(s => !a.data.setores.includes(s))) {
          for (const setor of regra.setores) lacuna("EVIDENCIA_INVALIDA", "Cruzamento sem cadeia de fatos e regra vigente.", setor);
        } else achados.push(a.data);
      }
    } catch {
      for (const setor of regra.setores) lacuna("CRUZAMENTO_FALHOU", "Regra de cruzamento não concluiu a avaliação.", setor);
    }
  }
  const agrupados = new Map<string, Achado>();
  for (const a of achados) {
    const chave = JSON.stringify([a.id, a.estado, a.texto, versoes(a.regras)]);
    const anterior = agrupados.get(chave);
    agrupados.set(chave, anterior ? { ...a, fatos: unicos([...anterior.fatos, ...a.fatos], chaveFato),
      setores: [...new Set([...anterior.setores, ...a.setores])] } : a);
  }
  return VisaoIntegrada.parse({ schema: "VisaoIntegrada@1", correlacao, achados: [...agrupados.values()],
    lacunas: unicos(lacunas, l => JSON.stringify([l.codigo, l.texto, l.setor, l.fatos.map(chaveFato).sort()])),
    cobertura: { setoresEsperados: esperados, setoresAvaliados: [...avaliados], avaliados: quantidade, semRegraAprovada } });
}
