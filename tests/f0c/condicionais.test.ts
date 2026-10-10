import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { avaliarCondicionais, registrarTermosComplementares } from "../../src/rules/f0c/condicionais.js";
import type { EntradaCondicionais, RegraCondicional, RegraTermoComplementar } from "../../src/contracts/f0c/condicionais.js";

const corpus = JSON.parse(readFileSync("corpus/f0c/condicionais.v1.json", "utf8")) as { regras: RegraCondicional[]; termos: RegraTermoComplementar[] };
const regra = (id: string) => corpus.regras.find((r) => r.id === id)!;
const entrada = (drug: string): EntradaCondicionais => ({ programados: [drug], hoje: "2026-10-10", agora: "2026-10-10T12:00:00-03:00" });
const avaliar = (id: string, e: EntradaCondicionais) => avaliarCondicionais(e, [regra(id)])[0]!;
const dado = <T>(valor: T | null) => ({ valor, fonte: "fonte sintética" });
const lab = (valor: number, limiteSuperiorNormal = 40, unidade = "U/L") => ({ ...dado(valor), unidade, limiteSuperiorNormal, coletadoEm: "2026-10-09T12:00:00-03:00" });
const hepaticos = () => ({ bilirrubina: lab(1, 1, "mg/dL"), ast: lab(40), alt: lab(40), fosfataseAlcalina: lab(100, 100), metastaseHepatica: dado(false) });

describe("N7: regras condicionadas e documentação explícita", () => {
  it("DPYD desconhecido fica pendente só com fluoropirimidina do elenco", () => {
    expect(avaliar("DPYD", entrada("capecitabina")).estado).toBe("PENDENTE");
    expect(avaliar("DPYD", { ...entrada("5-FU"), dpyd: dado("DESCONHECIDO") }).estado).toBe("PENDENTE");
    expect(avaliar("DPYD", { ...entrada("capecitabina"), dpyd: dado("DEFICIENCIA_COMPLETA") })).toMatchObject({ estado: "AVISO", ajustaDose: false, bloqueiaConsulta: false, autorizaCiclo: false });
    expect(avaliar("DPYD", { ...entrada("capecitabina"), dpyd: dado("SEM_DEFICIENCIA_IDENTIFICADA") }).estado).toBe("SEM_AVISO");
    expect(avaliar("DPYD", entrada("paclitaxel")).estado).toBe("NAO_APLICAVEL");
  });
  it("identidade exata: não interpreta dose/texto ou substring como medicamento", () => {
    expect(avaliar("DPYD", entrada("capecitabina 500 mg")).estado).toBe("NAO_APLICAVEL");
    expect(avaliar("DPYD", { ...entrada(""), programados: null }).estado).toBe("PENDENTE");
  });
  it("alergia à platina não contraindica todos os quimioterápicos", () => {
    const alergias = { lista: [{ agente: "carboplatina", presente: true, fonte: "fonte" }], historicoConferido: true, fonte: "histórico" };
    expect(avaliar("ALERGIA_OXALIPLATINA", { ...entrada("oxaliplatina"), alergias }).estado).toBe("AVISO");
    expect(avaliar("ALERGIA_OXALIPLATINA", { ...entrada("paclitaxel"), alergias }).estado).toBe("NAO_APLICAVEL");
    expect(avaliar("ALERGIA_DOCETAXEL", { ...entrada("docetaxel"), alergias }).estado).toBe("SEM_AVISO");
    expect(avaliar("ALERGIA_CISPLATINA", entrada("cisplatina")).estado).toBe("PENDENTE");
  });
  it("alergia documentada não desaparece por histórico incompleto; ausência sem fonte não vira negação", () => {
    const e = { ...entrada("docetaxel"), alergias: { lista: [{ agente: "docetaxel", presente: true, fonte: "fonte" }], historicoConferido: false, fonte: "fonte" } };
    expect(avaliar("ALERGIA_DOCETAXEL", e)).toMatchObject({ estado: "AVISO", pendencias: ["HISTORICO_ALERGIAS"] });
    expect(avaliar("ALERGIA_DOCETAXEL", { ...e, alergias: { lista: [], historicoConferido: true, fonte: null } }).estado).toBe("PENDENTE");
  });
  it("gestação só avaliada com aplicabilidade explícita, sem inferir por idade/sexo", () => {
    const e = entrada("paclitaxel");
    expect(avaliar("GESTACAO_PACLITAXEL", e).estado).toBe("PENDENTE");
    expect(avaliar("GESTACAO_PACLITAXEL", { ...e, gestacao: { aplicavel: false, resultado: dado(null) } }).estado).toBe("NAO_APLICAVEL");
    expect(avaliar("GESTACAO_PACLITAXEL", { ...e, gestacao: { aplicavel: true, resultado: dado(true) } }).estado).toBe("AVISO");
    expect(avaliar("GESTACAO_PACLITAXEL", { ...e, gestacao: { aplicavel: true, resultado: dado(null) } }).estado).toBe("PENDENTE");
  });
  it("docetaxel mantém limites estritos e combinação hepática, preservando dados faltantes", () => {
    const e = { ...entrada("docetaxel"), hepaticos: hepaticos() };
    expect(avaliar("DOCETAXEL_HEPATICO", e).estado).toBe("SEM_AVISO");
    expect(avaliar("DOCETAXEL_HEPATICO", { ...e, hepaticos: { ...e.hepaticos, ast: lab(60), alt: lab(60), fosfataseAlcalina: lab(250, 100) } }).estado).toBe("SEM_AVISO");
    const alto = avaliar("DOCETAXEL_HEPATICO", { ...e, hepaticos: { ...e.hepaticos, ast: lab(61), fosfataseAlcalina: lab(251, 100) } });
    expect(alto.estado).toBe("AVISO"); expect(alto.motivos.join()).toContain("conjuntamente");
    const incompleto = avaliar("DOCETAXEL_HEPATICO", { ...e, hepaticos: { ...e.hepaticos, bilirrubina: lab(2, 1, "mg/dL"), alt: { ...lab(40), fonte: null } } });
    expect(incompleto.estado).toBe("AVISO"); expect(incompleto.pendencias).toContain("ALT");
  });
  it("irinotecano usa contexto de metástase hepática e não cria dose", () => {
    const e = { ...entrada("irinotecano"), hepaticos: { ...hepaticos(), bilirrubina: lab(2, 1, "mg/dL"), ast: lab(160), alt: lab(40) } };
    expect(avaliar("IRINOTECANO_HEPATICO", e).estado).toBe("AVISO");
    expect(avaliar("IRINOTECANO_HEPATICO", { ...e, hepaticos: { ...e.hepaticos, metastaseHepatica: dado(true) } }).estado).toBe("SEM_AVISO");
    expect(avaliar("IRINOTECANO_HEPATICO", { ...e, hepaticos: { ...e.hepaticos, metastaseHepatica: dado(null) } }).estado).toBe("PENDENTE");
    expect(avaliar("IRINOTECANO_HEPATICO", { ...e, hepaticos: { ...e.hepaticos, bilirrubina: lab(2.01, 1, "mg/dL") } }).ajustaDose).toBe(false);
  });
  it("PA requer classificação médica; proteinúria exige g/24h e limiar inclusivo", () => {
    const e = entrada("bevacizumabe");
    expect(avaliar("BEVACIZUMABE_PA", e).estado).toBe("PENDENTE");
    expect(avaliar("BEVACIZUMABE_PA", { ...e, hipertensaoGraveNaoControlada: dado(true) }).estado).toBe("AVISO");
    expect(avaliar("BEVACIZUMABE_PROTEINURIA", { ...e, proteinuria: { ...dado(2), unidade: "g/24h", coletadoEm: "2026-10-09T12:00:00-03:00" }, sindromeNefrotica: dado(false) }).estado).toBe("AVISO");
    expect(avaliar("BEVACIZUMABE_PROTEINURIA", { ...e, proteinuria: { ...dado(1.9), unidade: "g/24h", coletadoEm: "2026-10-09T12:00:00-03:00" }, sindromeNefrotica: dado(false) }).estado).toBe("SEM_AVISO");
    expect(avaliar("BEVACIZUMABE_PROTEINURIA", { ...e, proteinuria: { ...dado(2), unidade: "mg/dL" }, sindromeNefrotica: dado(false) }).estado).toBe("PENDENTE");
  });
  it("janela pós-cirurgia 27/28 dias e cicatrização são verificadas separadamente", () => {
    const c = { historicoEAgendaConferidos: true, ultimaCirurgiaMaior: "2026-09-13", proximaCirurgiaEletiva: null, cicatrizacaoAdequada: true, fonte: "fonte" };
    expect(avaliar("BEVACIZUMABE_CIRURGIA", { ...entrada("bevacizumabe"), cirurgia: c }).estado).toBe("AVISO");
    expect(avaliar("BEVACIZUMABE_CIRURGIA", { ...entrada("bevacizumabe"), cirurgia: { ...c, ultimaCirurgiaMaior: "2026-09-12" } }).estado).toBe("SEM_AVISO");
    expect(avaliar("BEVACIZUMABE_CIRURGIA", { ...entrada("bevacizumabe"), cirurgia: { ...c, ultimaCirurgiaMaior: "2026-09-12", cicatrizacaoAdequada: false } }).estado).toBe("AVISO");
    expect(avaliar("BEVACIZUMABE_CIRURGIA", { ...entrada("bevacizumabe"), cirurgia: { ...c, ultimaCirurgiaMaior: "2026-02-30" } }).estado).toBe("PENDENTE");
  });
  it("cirurgia eletiva futura respeita janela e ausência de agenda não é negação", () => {
    const c = { historicoEAgendaConferidos: true, ultimaCirurgiaMaior: null, proximaCirurgiaEletiva: "2026-11-06", cicatrizacaoAdequada: null, fonte: "fonte" };
    expect(avaliar("BEVACIZUMABE_CIRURGIA", { ...entrada("bevacizumabe"), cirurgia: c }).estado).toBe("AVISO");
    expect(avaliar("BEVACIZUMABE_CIRURGIA", { ...entrada("bevacizumabe"), cirurgia: { ...c, proximaCirurgiaEletiva: "2026-11-07" } }).estado).toBe("SEM_AVISO");
    expect(avaliar("BEVACIZUMABE_CIRURGIA", entrada("bevacizumabe")).estado).toBe("PENDENTE");
  });
  it("fonte/regra inválida nunca ativa; parâmetro ausente fica pendente", () => {
    const r = regra("DOCETAXEL_HEPATICO"), e = { ...entrada("docetaxel"), hepaticos: hepaticos() };
    expect(avaliarCondicionais(e, [{ ...r, ativo: false }])[0]?.estado).toBe("PENDENTE");
    expect(avaliarCondicionais(e, [{ ...r, fonte: { ...r.fonte, trecho: "[VERIFICAR]" } }])[0]?.estado).toBe("PENDENTE");
    expect(avaliarCondicionais(e, [{ ...r, parametros: {} }])[0]?.estado).toBe("PENDENTE");
  });
  it("bioquímica usa coleta exata, vale7dias e não usa criação do fato", () => {
    const e = { ...entrada("bevacizumabe"), sindromeNefrotica: dado(false) };
    const p = { ...dado(1), unidade: "g/24h" };
    expect(avaliar("BEVACIZUMABE_PROTEINURIA", { ...e, proteinuria: { ...p, coletadoEm: "2026-10-03T12:00:00-03:00" } }).estado).toBe("SEM_AVISO");
    for (const coletadoEm of [null, "2026-10-09", "2026-10-09T12:00:00", "2026-02-30T12:00:00Z", "2026-10-11T12:00:00-03:00", "2026-10-03T11:59:59-03:00"]) {
      expect(avaliar("BEVACIZUMABE_PROTEINURIA", { ...e, proteinuria: { ...p, coletadoEm } }).estado).toBe("PENDENTE");
    }
    const { agora: _agora, ...semRelogio } = e;
    expect(avaliar("BEVACIZUMABE_PROTEINURIA", { ...semRelogio, proteinuria: { ...p, coletadoEm: "2026-10-09T12:00:00Z" } }).estado).toBe("PENDENTE");
    expect(avaliar("BEVACIZUMABE_PA", { ...semRelogio, hipertensaoGraveNaoControlada: dado(false) }).estado).toBe("SEM_AVISO");
  });
});

describe("N6: termos CTCAE novos com evidência, sem grau inferido", () => {
  it("mão-pé e reação infusional entram somente como termos documentados", () => {
    const r = registrarTermosComplementares([
      { termo: "MAO_PE", presente: true, evidencia: "Médico documentou mão-pé", fonte: "consulta", ctcaeVersao: "6.0" },
      { termo: "REACAO_INFUSIONAL", presente: true, evidencia: "Médico documentou reação infusional", fonte: "consulta", ctcaeVersao: "6.0" },
    ], corpus.termos);
    expect(r.every((v) => v.estado === "DOCUMENTADO" && v.grau === null && !v.ajustaDose)).toBe(true);
  });
  it("ausência, negação e versão divergente não viram grau0", () => {
    const e = { termo: "MAO_PE" as const, presente: true, evidencia: "texto", fonte: "consulta", ctcaeVersao: "6.0" };
    expect(registrarTermosComplementares([{ ...e, evidencia: null }], corpus.termos)[0]?.estado).toBe("PENDENTE");
    expect(registrarTermosComplementares([{ ...e, presente: false }], corpus.termos)[0]?.estado).toBe("NEGADO");
    expect(registrarTermosComplementares([{ ...e, ctcaeVersao: "5.0" }], corpus.termos)[0]?.estado).toBe("PENDENTE");
  });
});
