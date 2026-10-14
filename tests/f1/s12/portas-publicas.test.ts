import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { carregarConfigMotor } from "../../../src/kernel/corpus/configMotor.js";
import { avaliarSetores } from "../../../src/modules/setores/index.js";
import { reconciliar } from "../../../src/modules/reconciliador/index.js";
import { maestro } from "../../../src/orchestration/maestro.js";
import { SetorClinico } from "../../../src/contracts/f1/achadosSetor.js";
import { TipoEstimulo } from "../../../src/contracts/f1/estimuloTecnico.js";
import type { Retrato } from "../../../src/contracts/f1/retrato.js";

/** A12/A17: mapa executável das portas públicas operacionais; não inventário do corpus privado. */
export const PORTAS_PUBLICAS = [
  { arquivo: "corpus/rulesets/lab-thresholds.v1.json", oferece: ["analitos.codigo", "analitos.unidadeCanonica", "analitos.limiarInferior", "analitos.limiarSuperior"], entrada: ["LabResult", "extracao.lab", "dataClinica"], consumidor: "avaliarLaboratorio", saida: "AchadosSetor@1", gatilhos: ["FATO_CONFIRMADO", "EXAME_CORRIGIDO", "FATO_VENCIDO"] },
  { arquivo: "corpus/rulesets/interacoes.v1.json", oferece: ["interacoes.drogaA", "interacoes.drogaBouClasse", "interacoes.avaliacaoCondicionada", "interacoes.fonte"], entrada: ["medicamentos", "interacoesContexto", "PrescricaoProposta@1"], consumidor: "avaliarInteracoes", saida: "AchadosSetor@1", gatilhos: ["MED_RECONCILIADO", "PRESCRICAO_PROPOSTA"] },
  { arquivo: "corpus/rulesets/salao-triagem.v1.json", oferece: ["hemogramaValidadeDias"], entrada: ["dataClinica", "hoje"], consumidor: "avaliarLaboratorio", saida: "lacunas de validade", gatilhos: ["FATO_VENCIDO"] },
  { arquivo: "corpus/rulesets/cumulativo-tetos.v1.json", oferece: ["limites.droga", "limites.unidade", "limites.maximo", "limites.fonte"], entrada: ["TreatmentAdministration", "completude", "unidade"], consumidor: "avaliarTratamento", saida: "AchadosSetor@1", gatilhos: ["ADMINISTRACAO_REGISTRADA"] },
  { arquivo: "corpus/f0c/classes-farmacos.v1.json", oferece: ["aliases", "classes"], entrada: ["medicamentos", "PrescricaoProposta@1"], consumidor: "avaliarInteracoes", saida: "identidade farmacológica", gatilhos: ["BIBLIOTECA_ATIVADA", "MED_RECONCILIADO"] },
] as const;
const config = carregarConfigMotor();
const base: Retrato = { schema: "Retrato@1", patientId: "p-software-portas", encounterId: "e-software-portas", tumorLotId: null,
  revisao: "r-software-portas", versaoProjecao: "1", geradoEm: "2026-10-12T12:00:00-03:00", regras: config.regras,
  biblioteca: config.biblioteca, fatos: [], integridade: [], delta: { encounterAnteriorId: null, novos: [], substituidos: [] }, resumo: [] };
const correlacao = { patientId: base.patientId, encounterId: base.encounterId, tumorLotId: base.tumorLotId,
  operationId: "op-software-portas", revisaoFatos: base.revisao, regras: base.regras, biblioteca: base.biblioteca, proposta: null };
function contemCaminho(valor: unknown, caminho: readonly string[]): boolean {
  if (!caminho.length) return true;
  if (Array.isArray(valor)) return valor.some(v => contemCaminho(v, caminho));
  return valor !== null && typeof valor === "object" && Object.hasOwn(valor, caminho[0]!)
    && contemCaminho((valor as Record<string, unknown>)[caminho[0]!], caminho.slice(1));
}

describe("S12 A12/A17: portas públicas chegam ao consumidor e à reconciliação", () => {
  it.each(PORTAS_PUBLICAS)("$arquivo oferece versão e hash realmente consumidos", porta => {
    const bytes = readFileSync(porta.arquivo, "utf8"), json = JSON.parse(bytes) as Record<string, any>;
    const header = json.header ?? json;
    for (const campo of porta.oferece) expect(contemCaminho(json, campo.split(".")), `${porta.arquivo}:${campo}`).toBe(true);
    const ref = config.regras.find(r => r.id === header.id && r.versao === header.versao);
    expect(ref).toEqual({ id: header.id, versao: header.versao, hash: createHash("sha256").update(bytes).digest("hex") });
    for (const gatilho of porta.gatilhos) expect(maestro(gatilho)?.passos.at(-1)?.id).toBe("RECONCILIADOR");
  });
  it("sete portas reais chegam à visão com faltas explícitas, sem saída órfã ou escrita", () => {
    const antes = JSON.stringify(base), saidas = avaliarSetores(base, correlacao, config.opcoes);
    expect(saidas.map(s => s.setor).sort()).toEqual([...SetorClinico.options].sort());
    const visao = reconciliar(saidas.map(s => ({ id: s.setor, resultado: "ok" as const, tentativas: 1, saida: s })), base, correlacao);
    expect(visao.cobertura.setoresAvaliados).toHaveLength(7);
    expect(visao.achados.some(a => a.estado === "VERDE")).toBe(false);
    expect(visao.lacunas.length).toBeGreaterThan(0); expect(JSON.stringify(base)).toBe(antes);
    console.info(JSON.stringify({ prova: "S12-A12-A17-PORTAS", escopo: "corpus público operacional", portas: PORTAS_PUBLICAS }));
  });
  it.each(TipoEstimulo.options)("$0 tem consumidor final determinístico e cobertura declarada", evento => {
    const plano = maestro(evento)!;
    expect(plano.passos.filter(p => p.id !== "RECONCILIADOR").map(p => p.id).sort()).toEqual([...SetorClinico.options].sort());
    expect([...(plano.passos.at(-1)?.dependsOn ?? [])].sort()).toEqual([...SetorClinico.options].sort());
    expect(maestro(`${evento}_NAO_REGISTRADO`)).toBeNull();
  });
  it("saída sem destino, de outra revisão ou com referência inventada não ganha achado na visão", () => {
    const s = avaliarSetores(base, correlacao, config.opcoes)[0]!;
    const adulterada = { ...s, correlacao: { ...correlacao, revisaoFatos: "antiga" }, achados: [{ id: "injetado", texto: "não deve aparecer",
      estado: "VERDE" as const, fatos: [{ eventId: "inexistente", revisao: "1" }], regras: [], setores: [s.setor] }] };
    const v = reconciliar([{ id: s.setor, resultado: "ok", tentativas: 1, saida: adulterada }], base, correlacao);
    expect(v.achados).toEqual([]); expect(v.lacunas.some(l => l.codigo === "DESATUALIZADO")).toBe(true);
  });
});
