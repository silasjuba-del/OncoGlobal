import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { abrirLedger } from "../../../src/kernel/ledger/db.js";
import { criarGerenciadorSessao } from "../../../src/server/sessao.js";
import { classificarRelatoCanal, extrairMencoesClinicasCanal, avaliarAlarmesCanalConferidos, detectarConflitosRelatoCanal } from "../../../src/modules/canal/reconciliacaoClinica.js";
import { ingerirLoteImapCanal, receberTransporteSintetico, detalheMensagemCanal } from "../../../src/server/canalEntrada.js";
import { reconciliarMensagemCanalPersistida, lerReconciliacaoMensagemCanal } from "../../../src/server/canalReconciliacao.js";
import { prepararRascunhoRespostaCanal, integrarCanalNaPreConsultaECabecalho } from "../../../src/server/canalResposta.js";
import type { EntradaPreConsulta } from "../../../src/modules/consulta/preConsulta.js";

// Todos os textos e identificadores são sintéticos. As regras do corpus são somente lidas.
const AGORA = "2026-10-19T15:00:00.000Z";
const CORPUS = JSON.parse(readFileSync(new URL("../../../corpus/rulesets/salao-ctcae.v1.json", import.meta.url), "utf8"));
const REDFLAGS = JSON.parse(readFileSync(new URL("../../../corpus/rulesets/canal-redflags.v1.json", import.meta.url), "utf8"));
const regras = { rulesetId: REDFLAGS.header.id, rulesetVersao: REDFLAGS.header.versao,
  fraseFinal: REDFLAGS.fraseFinal, sinais: REDFLAGS.sinais };
const classificar = (textoOriginal: string, corpusCtcae: unknown = CORPUS) => {
  const entrada = { textoOriginal, origemCanal: "EMAIL" as const, providerSentAt: AGORA, ingestedAt: AGORA, vinculado: true, corpusCtcae };
  return classificarRelatoCanal(entrada);
};
const leitura = (textoOriginal: string, corpusCtcae: unknown = CORPUS) => {
  const r = classificar(textoOriginal, corpusCtcae).leituraComplementar;
  expect(r).toBeDefined();
  return r!;
};
const mencoes = (texto: string) => extrairMencoesClinicasCanal(texto);
const polaridade = (texto: string, termo: string) => mencoes(texto).filter(m => m.termo === termo).map(m => m.polaridade);

describe("C1 — mama, AC-T, D9/C2: temperatura e corticoide", () => {
  it.each([
    ["formal", "Estou no D9 do ciclo 2 de AC. Medi 38.5°C e uso dexametasona."],
    ["gíria", "Tô no nono dia da quimio, deu 38,5°C no termômetro; tomo dexa."],
    ["erro", "to com tempratura 38.5°C e dexametazona."],
  ])("%s: conserva medida e contexto, sem diagnóstico", (_, texto) => {
    expect(leitura(texto)).toMatchObject({ temperaturas: [expect.objectContaining({ valor: 38.5, celsiusDecimos: 385 })], contextos: expect.arrayContaining(["CORTICOIDE_DECLARADO"]) });
    expect(JSON.stringify(classificar(texto))).not.toContain("neutropenia febril confirmada");
  });
  it.each(["38.5", "38,5", "38.5°", "101.3"])("%s isolado não inventa unidade nem afebril", texto => {
    expect(leitura(texto)).toMatchObject({ temperaturas: [expect.objectContaining({ unidade: null, celsiusDecimos: null, estado: "UNIDADE_A_CONFIRMAR" })], pendencias: expect.arrayContaining(["TEMPERATURA_UNIDADE"]) });
    expect(JSON.stringify(classificar(texto))).not.toMatch(/afebril|sem febre/i);
  });
  it.each(["38.5°C", "38,5°C", "101.3°F", "trinta e oito e meio graus Celsius"])("normaliza %s com unidade conhecida", texto => {
    expect(leitura(texto)).toMatchObject({ temperaturas: [expect.objectContaining({ celsiusDecimos: 385, estado: "NORMALIZADA" })] });
  });
  it("temperatura por extenso sem unidade permanece visível e pendente", () => {
    expect(leitura("temperatura trinta e oito e meio")).toMatchObject({ temperaturas: [expect.objectContaining({ valor: 38.5, celsiusDecimos: null })] });
  });
  it("conserva as duas medidas e o intervalo, sem reduzir a série ao máximo", () => {
    expect(leitura("38.5°C e 37.9°C duas horas depois")).toMatchObject({ temperaturas: [
      expect.objectContaining({ celsiusDecimos: 385 }),
      expect.objectContaining({ celsiusDecimos: 379, intervaloRelativo: "duas horas depois" }),
    ] });
    expect(leitura("38.5 e 37.9 duas horas depois").temperaturas).toHaveLength(2);
  });
  it.each(["temperatura 380", "38.5°38.5°C", "temperatura 38.50.2°C"])("não corrige silenciosamente %s", texto => {
    expect(leitura(texto).pendencias).toContain("TEMPERATURA_VALOR_AMBIGUO");
    expect(leitura(texto).temperaturas.every((t: { celsiusDecimos: number | null }) => t.celsiusDecimos === null)).toBe(true);
  });
  it("NOVA: citação de ciclo anterior não se torna temperatura atual", () => {
    const texto = "Agora 36,6°C. Mensagem encaminhada do ciclo anterior: temperatura 38,5°C.";
    expect(leitura(texto)).toMatchObject({ temperaturas: [expect.objectContaining({ origem: "RELATO", celsiusDecimos: 366 }), expect.objectContaining({ origem: "CITACAO", celsiusDecimos: 385, temporalidade: "PASSADO" })] });
    expect(mencoes(texto).filter(m => m.temporalidade !== "PASSADO").every(m => m.temperaturaDecimos !== 385)).toBe(true);
  });
  it.each(["38 anos", "42 kg", "38 mg", "14:38", "380 ml"])("não transforma %s em temperatura", texto => {
    expect(leitura(texto).temperaturas).toEqual([]);
  });
  it("contexto térmico não captura número do ciclo", () => {
    expect(leitura("Temperatura 38.5°C no ciclo 2, D9; peso 42 kg.").temperaturas).toHaveLength(1);
  });
  it("conversão Fahrenheit preserva o comparador estrito do limiar existente", () => {
    const febre = regras.sinais.find((r: { id: string }) => r.id === "redflag-01-febre");
    // Aprovação apenas na fixture em memória, sem promover o corpus RASCUNHO.
    const fixture = { ...regras, sinais: [{ ...febre, status: "CONFERIDA_MEDICO", fonte: "fixture sintética de paridade" }] };
    const limiteF = febre.limiarDecimosExclusivo * 9 / 50 + 32;
    for (const [delta, dispara] of [[-0.01, false], [0, false], [0.01, true]] as const) {
      const texto = `Temperatura ${(limiteF + delta).toFixed(2)}°F agora.`;
      const r = avaliarAlarmesCanalConferidos({ textoOriginal: texto, mencoes: mencoes(texto), patientIdVinculado: null, autorRelato: "DESCONHECIDO", ruleset: fixture });
      expect(r.alarmesAtivos.length > 0).toBe(dispara);
    }
  });
  it("medidas equivalentes C/F conservam decisão também com mais casas decimais", () => {
    const limite = regras.sinais.find((r: { id: string }) => r.id === "redflag-01-febre").limiarDecimosExclusivo / 10;
    for (const delta of [-0.01, 0, 0.01, 0.04, 0.1]) {
      const c = limite + delta;
      const candidatos = [`${c.toFixed(2)}°C`, `${(c * 9 / 5 + 32).toFixed(3)}°F`].map(temp => {
        const texto = `Hoje medi ${temp}.`;
        return avaliarAlarmesCanalConferidos({ textoOriginal: texto, mencoes: mencoes(texto), patientIdVinculado: null, autorRelato: "DESCONHECIDO", ruleset: regras });
      });
      expect(candidatos[0]!.candidatosRascunhoNaoAtivados).toEqual(candidatos[1]!.candidatosRascunhoNaoAtivados);
      expect(candidatos[0]!.candidatosRascunhoNaoAtivados.includes("redflag-01-febre")).toBe(delta > 0);
      expect(candidatos.every(r => r.alarmesAtivos.length === 0)).toBe(true);
    }
  });
});

describe("C2 — pulmão, carbo/pemetrexede/pembrolizumabe, D12: polaridade", () => {
  it.each([
    ["sem febre, mas com falta de ar", "febre", "NEGADO", "falta de ar", "AFIRMADO"],
    ["não tenho febre, tenho falta de ar agora", "febre", "NEGADO", "falta de ar", "AFIRMADO"],
    ["Febre não tenho não, mas tô sem fôlego agora", "febre", "NEGADO", "falta de ar", "AFIRMADO"],
    ["n tenho febri, to c falta d ar agr", "febre", "NEGADO", "falta de ar", "AFIRMADO"],
    ["nego febre e tosse, porém cansaço ao subir escada", "tosse", "NEGADO", "cansaco aos esforcos", "AFIRMADO"],
    ["sem dor no peito nem falta de ar, só a tosse", "falta de ar", "NEGADO", "tosse", "AFIRMADO"],
    ["falta de ar não, mas febre sim", "falta de ar", "NEGADO", "febre", "AFIRMADO"],
  ])("%s", (texto, negado, pn, afirmado, pa) => {
    expect(polaridade(texto, negado)).toContain(pn);
    expect(polaridade(texto, afirmado)).toContain(pa);
    expect(polaridade(texto, afirmado)).not.toContain("NEGADO");
  });
  it("dupla negação não descarta dispneia", () => expect(polaridade("não é que não tenha falta de ar", "falta de ar")).toContain("AFIRMADO"));
  it("NOVA: pergunta citada não substitui a resposta do paciente", () => {
    const texto = "A enfermeira perguntou 'sem falta de ar?'. Respondi: 'não, falta até para falar'.";
    expect(polaridade(texto, "falta de ar")).toContain("AFIRMADO");
    expect(detectarConflitosRelatoCanal({ mensagemId: "citacao-sintetica", mencoes: mencoes(texto) }, [])).toEqual([]);
  });
  it("dispneia usa a regra existente sem concluir pneumonite nem ativar RASCUNHO", () => {
    const texto = "sem febre, mas com falta de ar";
    const avaliacao = avaliarAlarmesCanalConferidos({ textoOriginal: texto, mencoes: mencoes(texto), patientIdVinculado: null, autorRelato: "DESCONHECIDO", ruleset: regras });
    expect(avaliacao.alarmesAtivos).toEqual([]);
    expect(avaliacao.candidatosRascunhoNaoAtivados).toContain("redflag-02-falta-de-ar");
    expect(JSON.stringify(classificar(texto))).not.toContain("pneumonite confirmada");
  });
});

describe("Reataque independente — escopo de fonte, quantidade e tempo", () => {
  it.each([
    "Evacuei 10 vezes com fezes líquidas ao longo da semana. Meu habitual são 2 evacuações por dia.",
    "Hoje tive menos de 7 evacuações acima do meu normal.",
    "Hoje tive até 7 evacuações acima do meu normal.",
    "Hoje tive mais de 4 evacuações acima do meu normal.",
    "Hoje não tive 10 evacuações líquidas. Diarreia leve. Meu habitual são 2 evacuações por dia.",
    "Hoje não evacuei dez vezes, foram só duas com fezes líquidas. Meu habitual são duas evacuações por dia.",
    "Minha irmã teve 10 evacuações líquidas hoje. Meu habitual são 2 evacuações por dia.",
    "Meu filho teve 10 evacuações líquidas hoje. Meu habitual são 2 evacuações por dia.",
    "Hoje tive 10 evacuações líquidas. Meu habitual são 2 evacuações por dia. Corrigindo: foram 3 evacuações líquidas.",
    "Hoje tive 10,5 evacuações líquidas. Meu habitual são 2 evacuações por dia.",
    "Hoje tive <7 evacuações acima do meu normal.",
    "Hoje tive -10 evacuações líquidas. Meu habitual são 2 evacuações por dia.",
    "Hoje informo 10 evacuações líquidas nos últimos 3 dias. Meu habitual são 2 evacuações por dia.",
    "Hoje não cheguei a ter 10 evacuações líquidas. Diarreia leve. Meu habitual são 2 evacuações por dia.",
  ])("não elege grau com base insuficiente ou contraditória: %s", texto => {
    expect(() => classificar(texto)).not.toThrow();
    expect(leitura(texto).diarreia?.grauCandidato).toBeNull();
  });
  it.each([
    "Meu habitual são 2 evacuações por dia. Hoje tive 10 evacuações líquidas.",
    "Não tenho ileostomia. Hoje evacuei 10 vezes com fezes líquidas. Meu habitual são 2 evacuações por dia.",
  ])("não confunde basal com atual nem estomia negada: %s", texto => {
    expect(leitura(texto)).toMatchObject({ diarreia: { atual: 10, basal: 2, aumento: 8, grauCandidato: 3, ostomia: false } });
  });
  it.each(["trinta e oito vírgula cinco graus Celsius", "trinta e oito graus e meio", "38.5 Celsius", "101.3 Fahrenheit"])("preserva expressão térmica inteira: %s", texto => {
    expect(leitura(texto).temperaturas).toEqual([expect.objectContaining({ valor: texto.includes("101.3") ? 101.3 : 38.5, celsiusDecimos: 385 })]);
  });
  it.each(["Medi 38.5 agora", "O termômetro marcou 38.5 agora"])("valor sem unidade não desaparece: %s", texto => {
    expect(leitura(texto).temperaturas).toEqual([expect.objectContaining({ valor: 38.5, celsiusDecimos: null, estado: "UNIDADE_A_CONFIRMAR" })]);
  });
  it("valores extremos ou negativos não causam exceção nem inversão de sinal", () => {
    expect(() => classificar(`temperatura ${"9".repeat(400)}°C`)).not.toThrow();
    expect(leitura(`temperatura ${"9".repeat(400)}°C`).pendencias).toContain("TEMPERATURA_VALOR_AMBIGUO");
    expect(leitura("-38.5°C").temperaturas).not.toContainEqual(expect.objectContaining({ celsiusDecimos: 385 }));
  });
  it.each([
    "A mensagem anterior era sobre o retorno. Hoje estou com febre 39°C.",
    "> febre 38.5°C ontem\nHoje estou com febre 39°C.",
  ])("delimita citação sem ocultar o relato atual: %s", texto => {
    expect(leitura(texto).temperaturas).toContainEqual(expect.objectContaining({ origem: "RELATO", celsiusDecimos: 390, temporalidade: "ATUAL" }));
  });
  it("separa ontem de hoje na série de medidas", () => {
    expect(leitura("Ontem 39°C. Hoje 36.5°C").temperaturas).toMatchObject([{ temporalidade: "PASSADO" }, { temporalidade: "ATUAL" }]);
    expect(leitura("Ontem medi 38.5°C. Medi 36.5°C hoje.").temperaturas).toMatchObject([{ temporalidade: "PASSADO" }, { temporalidade: "ATUAL" }]);
  });
  it.each(["Hoje falta de ar não passa", "Hoje estou com falta de ar não melhorou"])("negação da melhora não nega presença: %s", texto => {
    expect(polaridade(texto, "falta de ar")).toEqual(["AFIRMADO"]);
  });
  it("negação de febre não apaga medição explícita contraditória", () => {
    const texto = "Febre não, temperatura 39°C agora";
    expect(mencoes(texto)).toContainEqual(expect.objectContaining({ polaridade: "AFIRMADO", temperaturaDecimos: 390 }));
    expect(polaridade(texto, "febre")).toContain("NEGADO");
    expect(mencoes("Não tenho febre: temperatura 39°C agora")).toContainEqual(expect.objectContaining({ polaridade: "AFIRMADO", temperaturaDecimos: 390 }));
  });
  it("água no nariz não é diarreia", () => expect(polaridade("Meu nariz está soltando água", "diarreia")).toEqual([]));
  it.each([
    "Hoje estou com dor. Mensagem encaminhada: meu pai estava com febre ontem.",
    "Hoje estou com dor. Mensagem encaminhada: se eu tiver febre, o que faço?",
    "Hoje estou com dor.\n> sou a cuidadora, meu pai estava com febre ontem.",
  ])("citação não altera autor nem momento atual: %s", texto => {
    expect(classificar(texto)).toMatchObject({ autorRelato: "DESCONHECIDO", momentoClinicoRelatado: { temporalidade: "ATUAL" } });
  });
  it("cabeçalho encaminhado abrange o corpo até retomada explícita", () => {
    const texto = "Agora estou sem febre. Mensagem encaminhada do ciclo anterior:\nTenho febre 39°C e falta de ar.";
    expect(leitura(texto).temperaturas).toEqual([expect.objectContaining({ origem: "CITACAO", temporalidade: "PASSADO" })]);
    expect(mencoes(texto).filter(m => m.temperaturaDecimos === 390 || m.termo === "falta de ar").every(m => m.temporalidade === "PASSADO")).toBe(true);
    expect(leitura(`${texto}\nRelato atual: agora medi 38.5°C.`).temperaturas).toContainEqual(expect.objectContaining({ origem: "RELATO", celsiusDecimos: 385, temporalidade: "ATUAL" }));
  });
  it("comparador simbólico de aumento preserva o limite", () => {
    expect(leitura("Hoje tive >7 evacuações acima do meu normal.")).toMatchObject({ diarreia: { aumento: 7, operador: "MAIOR_QUE", grauCandidato: 3 } });
  });
});

describe("C3 — CAPOX D8: quantidade, basal, negação e graduação candidata", () => {
  it.each([
    "Hoje evacuei dez vezes, com fezes líquidas. Meu habitual são duas evacuações por dia.",
    "hj evacuei 10 vezes, fezes liquidas. meu normal sao 2 evacuacoes por dia.",
  ])("calcula delta com as duas fontes: %s", texto => {
    expect(leitura(texto)).toMatchObject({ diarreia: { atual: 10, basal: 2, aumento: 8, operador: "IGUAL", janela: "DIA", grauCandidato: 3, confirmadoPeloMedico: false } });
    expect(leitura(texto).diarreia?.trechoOriginal).toBe(texto);
  });
  it.each(["tô soltando água, e à noite também", "to c diarrea sem para, fico tonta qdo levanto"])("reconhece relato sem grau inventado: %s", texto => {
    expect(polaridade(texto, "diarreia")).toContain("AFIRMADO");
    expect(leitura(texto).diarreia?.grauCandidato).toBeNull();
  });
  it("sete idas ao banheiro não comprovam evacuações, basal ou grau", () => {
    expect(leitura("fui 7 vezes ao banheiro hoje")).toMatchObject({ diarreia: { atual: null, basal: null, grauCandidato: null }, pendencias: expect.arrayContaining(["QUANTIDADE_A_ESCLARECER"]) });
    expect(polaridade("fui 7 vezes ao banheiro hoje", "diarreia")).not.toContain("AFIRMADO");
  });
  it("náusea não é vômito e não afirma diarreia", () => {
    expect(polaridade("tive náusea, mas sem diarreia", "nausea")).toContain("AFIRMADO");
    expect(polaridade("tive náusea, mas sem diarreia", "vomito")).toEqual([]);
    expect(polaridade("tive náusea, mas sem diarreia", "diarreia")).toEqual(["NEGADO"]);
  });
  it("não para nega a cessação, não o sintoma", () => {
    expect(polaridade("sem náusea, mas a diarreia não para", "nausea")).toEqual(["NEGADO"]);
    expect(polaridade("sem náusea, mas a diarreia não para", "diarreia")).toEqual(["AFIRMADO"]);
  });
  it("preserva comparador e exige janela; tontura não vira desidratação confirmada", () => {
    const semJanela = "mais de 7 evacuações acima do meu normal, tonta ao levantar";
    expect(leitura(semJanela)).toMatchObject({ diarreia: { aumento: 7, operador: "MAIOR_QUE", janela: "NAO_INFORMADA", grauCandidato: null }, contextos: expect.arrayContaining(["TONTURA_POSTURAL_DECLARADA"]) });
    expect(leitura(`Hoje tive ${semJanela}`)).toMatchObject({ diarreia: { aumento: 7, operador: "MAIOR_QUE", janela: "DIA", grauCandidato: 3 } });
  });
  it("NOVA: frequência de esvaziamento da ileostomia não é contagem de fezes", () => {
    expect(leitura("Tenho ileostomia. Esvaziei a bolsa sete vezes, como sempre, mas hoje saiu muito mais volume.")).toMatchObject({ diarreia: { ostomia: true, grauCandidato: null }, pendencias: expect.arrayContaining(["OSTOMIA_REQUER_AVALIACAO"]) });
  });
  it.each([null, { ...CORPUS, graus: { ...CORPUS.graus, termosClinicos: { ...CORPUS.graus.termosClinicos, diarreia: { ...CORPUS.graus.termosClinicos.diarreia, ativo: false, status: "RASCUNHO" } } } }])("sem regra válida não gradua", corpus => {
    expect(leitura("Hoje evacuei 10 vezes, com fezes líquidas. Meu habitual são 2 evacuações por dia.", corpus).diarreia?.grauCandidato).toBeNull();
  });
  it.each([
    "Ontem evacuei 10 vezes, fezes líquidas. Meu habitual são 2 evacuações por dia. Hoje tive diarreia uma vez.",
    "Hoje evacuei 10 vezes, fezes líquidas. Meu habitual são 2 evacuações por dia. Corrigindo: evacuei 3 vezes.",
    "Se eu evacuar 10 vezes hoje com fezes líquidas? Meu habitual são 2 evacuações por dia.",
  ])("não escolhe quantidade com temporalidade ou correção ambígua: %s", texto => {
    expect(leitura(texto).diarreia?.grauCandidato).toBeNull();
  });
});

const bancos: ReturnType<typeof abrirLedger>[] = [];
afterEach(() => { for (const db of bancos.splice(0)) db.close(); });
const banco = () => { const db = abrirLedger(":memory:"); bancos.push(db); return db; };
const acesso = () => { const sessoes = criarGerenciadorSessao({ medicoId: "medico-sintetico", crm: "CRM-SINTETICO", senha: "senha-sintetica-segura", agora: () => AGORA, duracaoMs: 60_000 }); return { sessoes, token: sessoes.login("senha-sintetica-segura")!.token, agora: AGORA }; };
const EMAIL = ["familia-sintetica", "example.test"].join("@");
const cadastros = [{ patientId: "pai-sintetico", nome: "Paciente Alfa Sintetico", chaveDemografica: null, identificadores: [{ tipo: "EMAIL" as const, valor: EMAIL }] }];
const conteudo = (texto: string) => ({ tipo: "TEXT" as const, texto, contentSha256: createHash("sha256").update(texto).digest("hex") });
const pre: EntradaPreConsulta = { hoje: "2026-10-19", anterior: null, prazosApac: null, direcoes: null, atual: { kind: "CONFIRMED", snapshotId: "snapshot-sintetico", patientId: "pai-sintetico", tumorLotId: null, encounterId: "encontro-sintetico", fatos: [], pendencias: null, tratamento: null, cumulativos: null, contatos: null, apac: null, decisoes: null } };

describe("C4 — cuidador, autoria, PHI e endereço compartilhado", () => {
  it.each([
    ["estou com muita dor e não consigo comer", "DESCONHECIDO"],
    ["Meu pai tá com uma dor danada e não tá conseguindo comer", "FAMILIAR"],
    ["sou a flha, meu pai ta c mta dor e n consegue come", "FAMILIAR"],
    ["meu pai está com muita dor", "FAMILIAR"],
  ])("%s: endereço vinculado não prova autoria", (texto, autor) => {
    expect(classificar(texto)).toMatchObject({ autorRelato: autor, leituraComplementar: { autoriaVerificada: false } });
  });
  it("três mensagens IMAP, casal e Reply-To não herdam paciente nem autorizam resposta", async () => {
    const db = banco(), a = acesso();
    const textos = ["meu pai está com muita dor", "sou a cuidadora, estou sem dor; responda no outro endereço"];
    const primeira = receberTransporteSintetico(db, { accountId: "imap-sintetico", canal: "EMAIL", providerMessageId: "primeira-vinculada-sintetica", senderRef: EMAIL, providerSentAt: AGORA, ingestedAt: AGORA, cadastros, conteudo: conteudo("Mensagem histórica com vínculo validado na fixture.") });
    expect(primeira.ok).toBe(true); if (!primeira.ok) return;
    expect(detalheMensagemCanal(db, a, primeira.reciboId)).toMatchObject({ ok: true, mensagem: { vinculo: { patientId: "pai-sintetico" } } });
    const recebidas = await ingerirLoteImapCanal(db, { accountId: "imap-sintetico", mailbox: "INBOX", uidValiditySessao: 1, ingestedAt: AGORA, cadastros: [...cadastros, { ...cadastros[0]!, patientId: "mae-sintetica" }], mensagens: textos.map((texto, i) => ({ uid: i + 1, uidValidity: 1, fromAddress: EMAIL, sentAt: AGORA, rawBytes: Buffer.from(`From: ${EMAIL}\r\nReply-To: destino-nao-validado\r\n\r\n${texto}`), conteudo: conteudo(texto) })) });
    expect(recebidas.ok).toBe(true); if (!recebidas.ok) return;
    for (const r of recebidas.resultados) {
      expect(detalheMensagemCanal(db, a, r.reciboId)).toMatchObject({ ok: true, mensagem: { vinculo: { patientId: null } } });
      let chamouLlm = false;
      const rec = await reconciliarMensagemCanalPersistida(db, a, { mensagemId: r.reciboId, cadastros, classificadorLlm: () => { chamouLlm = true; return {}; } });
      expect(chamouLlm).toBe(false);
      expect(rec).toMatchObject({ ok: true, reconciliacao: { vinculo: { patientId: null }, conflitosRelato: [], diagnostico: false, assinatura: false } });
      expect(prepararRascunhoRespostaCanal(db, a, { respostaId: `resposta-${r.uid}`, versao: 1, mensagemOrigemId: r.reciboId, contexto: { patientId: "pai-sintetico", encounterId: "encontro-sintetico", tumorLotId: null, revisaoContexto: "r1" }, tipoResposta: "RESPOSTA_LIVRE_MEDICA", texto: "Texto médico sintético." })).toMatchObject({ ok: false, codigo: "CONTATO_NAO_VINCULADO_AO_PACIENTE" });
    }
    const resumo = integrarCanalNaPreConsultaECabecalho(db, { entradaPreConsulta: pre, ultimaConsultaConfirmadaEm: null });
    expect(resumo.resumosDoPaciente).toEqual([]);
    expect(resumo.filaRevisao.flatMap(r => r.mensagensOriginaisIds)).toHaveLength(3);
    expect(detalheMensagemCanal(db, a, primeira.reciboId)).toMatchObject({ ok: true, mensagem: { vinculo: { patientId: "pai-sintetico" } } });
    expect(db.prepare("SELECT count(*) AS n FROM clinical_event").get()!.n).toBe(0);
  });
  it("semântica legada não reaparece por replay, getter ou comparação indireta", async () => {
    const db = banco(), a = acesso();
    const contato = "contato-wa-sintetico";
    const cadastroWa = [{ ...cadastros[0]!, identificadores: [{ tipo: "TELEFONE" as const, valor: contato }] }];
    const receber = (id: string, texto: string) => receberTransporteSintetico(db, { accountId: "wa-sintetico", canal: "WHATSAPP_SERVICO", providerMessageId: id, senderRef: contato, providerSentAt: AGORA, ingestedAt: AGORA, cadastros: cadastroWa, conteudo: conteudo(texto) });
    const primeiro = receber("atual", "Hoje tenho náusea."); expect(primeiro.ok).toBe(true); if (!primeiro.ok) return;
    const base = await reconciliarMensagemCanalPersistida(db, a, { mensagemId: primeiro.reciboId, cadastros: cadastroWa });
    expect(base.ok).toBe(true); if (!base.ok) return;
    const antigo = receber("legado", "Hoje tenho náusea."); expect(antigo.ok).toBe(true); if (!antigo.ok) return;
    const { leituraComplementar: _versaoAtual, ...classificacaoAntiga } = base.reconciliacao.classificacao;
    const legado = JSON.stringify({ ...base.reconciliacao, mensagemId: antigo.reciboId, classificacao: { ...classificacaoAntiga, mencoes: classificacaoAntiga.mencoes.map(m => ({ ...m, termo: "vomito" })) } });
    db.prepare("INSERT INTO canal_reconciliacao_clinica VALUES (?, ?, ?)").run(antigo.reciboId, legado, AGORA);
    expect(await reconciliarMensagemCanalPersistida(db, a, { mensagemId: antigo.reciboId, cadastros: cadastroWa })).toMatchObject({ ok: false, codigo: "RECONCILIACAO_REQUER_REPROCESSAMENTO" });
    expect(lerReconciliacaoMensagemCanal(db, antigo.reciboId)).toBeNull();
    const nova = receber("nova", "Hoje estou sem vômito."); expect(nova.ok).toBe(true); if (!nova.ok) return;
    expect(await reconciliarMensagemCanalPersistida(db, a, { mensagemId: nova.reciboId, cadastros: cadastroWa })).toMatchObject({ ok: true, reconciliacao: { conflitosRelato: [] } });
    expect(db.prepare("SELECT reconciliacaoJson FROM canal_reconciliacao_clinica WHERE mensagemId = ?").get(antigo.reciboId)!.reconciliacaoJson).toBe(legado);
  });
  it("graduação candidata atravessa IMAP, SQLite e replay sem promover relato ou redflags", async () => {
    const db = banco(), a = acesso();
    const texto = "Hoje evacuei 10 vezes, com fezes líquidas. Meu habitual são 2 evacuações por dia. Estou tonta ao levantar.";
    const recebido = await ingerirLoteImapCanal(db, { accountId: "imap-clinico", mailbox: "INBOX", uidValiditySessao: 2, ingestedAt: AGORA, cadastros, mensagens: [{ uid: 1, uidValidity: 2, fromAddress: EMAIL, sentAt: AGORA, rawBytes: Buffer.from(texto), conteudo: conteudo(texto) }] });
    expect(recebido.ok).toBe(true); if (!recebido.ok) return;
    const mensagemId = recebido.resultados[0]!.reciboId;
    const r = await reconciliarMensagemCanalPersistida(db, a, { mensagemId, cadastros });
    expect(r).toMatchObject({ ok: true, reconciliacao: { vinculo: { patientId: null }, classificacao: { leituraComplementar: { diarreia: { aumento: 8, grauCandidato: 3, confirmadoPeloMedico: false }, pendencias: expect.arrayContaining(["AVALIACAO_MEDICA_HIDRATACAO"]) } }, alarmes: { alarmesAtivos: [] }, diagnostico: false, prescricao: false } });
    expect(await reconciliarMensagemCanalPersistida(db, a, { mensagemId, cadastros })).toMatchObject({ ok: true, replay: true });
    expect(lerReconciliacaoMensagemCanal(db, mensagemId)?.classificacao.leituraComplementar?.diarreia?.grauCandidato).toBe(3);
    expect(db.prepare("SELECT count(*) AS n FROM clinical_event").get()!.n).toBe(0);
  });
  it("terceiros não saem para o classificador mesmo com vínculo sintético conhecido", async () => {
    const db = banco(), a = acesso();
    const ack = receberTransporteSintetico(db, { accountId: "conta-sintetica", canal: "EMAIL", providerMessageId: "terceiros", senderRef: EMAIL, providerSentAt: AGORA, ingestedAt: AGORA, cadastros, conteudo: conteudo("a vizinha Maria também faz QT com o Dr. Carlos; eu estou com diarreia") });
    expect(ack.ok).toBe(true); if (!ack.ok) return;
    const enviados: string[] = [];
    const rec = await reconciliarMensagemCanalPersistida(db, a, { mensagemId: ack.reciboId, cadastros, classificadorLlm: e => { enviados.push(e.textoDesidentificado); return {}; } });
    expect(rec.ok).toBe(true); expect(enviados).toHaveLength(1);
    expect(enviados.join(" ")).not.toMatch(/Maria|Carlos|vizinha|Dr\./i);
  });
});
