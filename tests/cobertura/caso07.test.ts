// KIMI-17 · regressão do CASO 07 contra o que existe hoje (identidade, vínculo, radAlerts).
// Fonte normativa: docs/referencias/CASO-REAL-01-LICOES.md §2 e §4 + fixtures sintéticas
// tests/fixtures/caso07/**. Tudo aqui é PROVA POSITIVA/NEGATIVA contra código existente;
// a deduplicação (D1/D2) permanece fora desta fatia; a conversão local e a extração
// de conteúdo riscado são verificadas por comportamento (R1).
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolverIdentidade, type IdentificadoresEntrada } from "../../src/rules/identidade.js";
import { resolverVinculo, type CadastroVinculo, type ContatoVinculo } from "../../src/modules/canal/vinculo.js";
import { avaliarRadAlerts } from "../../src/rules/radAlerts.js";
import type { Paciente } from "../../src/contracts/clinico.js";
import type { RadRuleset } from "../../src/rules/tipos-w3.js";
import { converterEntradaLocal } from "../../src/leitura/caixa-unica.js";
import { extratorDeterministico } from "../../src/kernel/extracao/extrator.js";
import { segmentarTranscricao } from "../../src/kernel/extracao/segmenter.js";

const FIX = fileURLToPath(new URL("../fixtures/caso07", import.meta.url));
const ler = (nome: string) => readFileSync(join(FIX, nome), "utf8");

const CPF_SINTETICO = "12345678901";       // 11 dígitos, DV inválido de propósito
const CNS_SINTETICO = "704202600001234";   // 15 dígitos, estrutura válida

const cadastroPaciente: Paciente = {
  patientId: "paciente-teste-07",
  identificadores: [{ tipo: "CPF", valor: CPF_SINTETICO }, { tipo: "CNS", valor: CNS_SINTETICO }],
  nome: "Paciente Teste 07",
  nascimento: "1958-03-12",
  sexoCadastral: "M",
  divergencia: false,
};

describe("KIMI-17 · caso 07 · I1/I2 — rótulo 'Cartão SUS' não liga CPF como CNS", () => {
  it("CPF de 11 dígitos declarado como CNS NÃO liga ao cadastro (nunca ligação silenciosa)", () => {
    const entrada: IdentificadoresEntrada = { identificadores: [{ tipo: "CNS", valor: CPF_SINTETICO }] };
    const r = resolverIdentidade(entrada, [cadastroPaciente]);
    expect(r).toBeNull(); // não é o CNS do paciente; o rótulo do documento não prova o tipo
  });

  it("o MESMO valor classificado como CPF (pelo valor, não pelo rótulo) liga ao paciente", () => {
    const entrada: IdentificadoresEntrada = { identificadores: [{ tipo: "CPF", valor: CPF_SINTETICO }] };
    expect(resolverIdentidade(entrada, [cadastroPaciente])).toEqual({ patientId: "paciente-teste-07" });
  });

  it("o CNS verdadeiro de 15 dígitos ('Matrícula') liga quando informado como CNS", () => {
    const entrada: IdentificadoresEntrada = { identificadores: [{ tipo: "CNS", valor: CNS_SINTETICO }] };
    expect(resolverIdentidade(entrada, [cadastroPaciente])).toEqual({ patientId: "paciente-teste-07" });
  });

  it("identificador presente mas não casado + nome igual NÃO liga por nome (Q13: nome nunca liga)", () => {
    const entrada: IdentificadoresEntrada = {
      identificadores: [{ tipo: "CNS", valor: CPF_SINTETICO }], nome: "Paciente Teste 07" };
    expect(resolverIdentidade(entrada, [cadastroPaciente])).toBeNull();
  });

  it("vínculo: contato com valor de 11 dígitos como CNS vai à FILA (nunca VINCULO)", () => {
    const contato: ContatoVinculo = { contatoId: "c1", tipo: "CNS", endereco: CPF_SINTETICO,
      nomeInformado: "Paciente Teste 07", chaveDemografica: null, consentimentoRegistrado: true };
    const cadastro: CadastroVinculo = { patientId: "paciente-teste-07",
      identificadores: [{ tipo: "CNS", valor: CNS_SINTETICO }], chaveDemografica: null, nome: "Paciente Teste 07" };
    const r = resolverVinculo(contato, [cadastro]);
    expect(r.classe).toBe("FILA");
    expect(r.patientId).toBeNull();
  });

  it("vínculo: CNS exato de 15 dígitos liga (controle positivo do mesmo caminho)", () => {
    const contato: ContatoVinculo = { contatoId: "c2", tipo: "CNS", endereco: CNS_SINTETICO,
      nomeInformado: "Paciente Teste 07", chaveDemografica: null, consentimentoRegistrado: true };
    const cadastro: CadastroVinculo = { patientId: "paciente-teste-07",
      identificadores: [{ tipo: "CNS", valor: CNS_SINTETICO }], chaveDemografica: null, nome: "Paciente Teste 07" };
    expect(resolverVinculo(contato, [cadastro]).classe).toBe("VINCULO");
  });
});

describe("KIMI-17 · caso 07 · I3 — comprovante de terceiro não vincula", () => {
  it("nome de terceiro ('Familiar Teste 07') + identificador desconhecido ⇒ FILA, nunca VINCULO", () => {
    const contato: ContatoVinculo = { contatoId: "c3", tipo: "EMAIL", endereco: "desconhecido@teste.ts",
      nomeInformado: "Familiar Teste 07", chaveDemografica: null, consentimentoRegistrado: false };
    const cadastro: CadastroVinculo = { patientId: "paciente-teste-07",
      identificadores: [{ tipo: "CNS", valor: CNS_SINTETICO }], chaveDemografica: null, nome: "Paciente Teste 07" };
    const r = resolverVinculo(contato, [cadastro]);
    expect(r.classe).toBe("FILA");
    expect(r.patientId).toBeNull();
    expect(r.motivo).toContain("nome não vincula");
  });
});

describe("KIMI-17 · caso 07 · S2 — captação articular degenerativa ≠ metástase (radAlerts)", () => {
  // Ruleset sintético ATIVO com termos do catálogo BASE §18 (FN-20) — a prova é sobre o
  // comportamento do motor, não sobre o ruleset do corpus (que está 100% inativo por curadoria).
  const rs: RadRuleset = { id: "rad-emergencia", versao: "teste-kimi17", ativo: true,
    termosEmergencia: [
      { codigo: "compressao-medular", termo: "Compressão medular", regraId: "t1" },
      { codigo: "vcs", termo: "Síndrome da veia cava superior", regraId: "t2" },
      { codigo: "fratura-patologica", termo: "Fratura patológica", regraId: "t3" },
    ] };
  const corpo = (nome: string) => ler(nome).split(/={5,}/).slice(2, -1).join("\n");

  it("cintilografia do caso 07 (captação articular, metástase negada) gera ZERO alertas", () => {
    const r = avaliarRadAlerts({ tipoFonte: "TRANSCRIPTION", texto: corpo("07-cintilografia-ossea-pagina-1.txt"),
      data: "2026-07-22" }, rs);
    expect(r.alerts).toHaveLength(0); // "hiperfixação articular" isolada não é emergência
  });

  it("emergência afirmativa gera RED_RAD_ALERT (controle positivo do motor)", () => {
    const r = avaliarRadAlerts({ tipoFonte: "TRANSCRIPTION",
      texto: "Achado novo: Compressão medular ao nível de T12.", data: "2026-07-22" }, rs);
    expect(r.alerts).toHaveLength(1);
    expect(r.alerts[0]!.tipo).toBe("RED_RAD_ALERT");
  });

  it("emergência em negação ('ausência de compressão medular') NÃO gera alerta", () => {
    const r = avaliarRadAlerts({ tipoFonte: "TRANSCRIPTION",
      texto: "Observa-se ausência de compressão medular.", data: "2026-07-22" }, rs);
    expect(r.alerts).toHaveLength(0);
  });

  it("termo em suspeita ('suspeita de fratura patológica') gera REVISAO_URGENTE, não RED", () => {
    const r = avaliarRadAlerts({ tipoFonte: "TRANSCRIPTION",
      texto: "Área lítica com suspeita de fratura patológica do colo femoral.", data: "2026-07-22" }, rs);
    expect(r.alerts).toHaveLength(1);
    expect(r.alerts[0]!.tipo).toBe("REVISAO_URGENTE");
  });

  it("fonte não textual (imagem bruta) nunca gera alerta — só PENDENTE", () => {
    const r = avaliarRadAlerts({ tipoFonte: "IMAGE_RAW",
      texto: "Compressão medular", data: "2026-07-22" }, rs);
    expect(r.alerts).toHaveLength(0);
    expect(r.achados.some((a) => a.estado === "PENDENTE")).toBe(true);
  });
});

describe("KIMI-17 · caso 07 · S1 — TNM nunca preenchido por regra", () => {
  it("nenhum arquivo de src/rules produz/decide TNM (varredura real do diretório)", () => {
    const dir = fileURLToPath(new URL("../../src/rules", import.meta.url));
    const arquivos = readdirSync(dir).filter((f) => f.endsWith(".ts"));
    for (const arquivo of arquivos) {
      const codigo = readFileSync(join(dir, arquivo), "utf8");
      expect(codigo, `${arquivo} menciona TNM — regra não pode fechar estádio (S1)`).not.toMatch(/\bTNM\b/);
    }
    expect(arquivos.length).toBeGreaterThan(10); // a varredura cobre o diretório inteiro
  });

  it("RM do caso 07 marca extensão com fonte, mas o esperado.json mantém TNM PENDENTE (médico)", () => {
    const esperado = JSON.parse(ler("esperado.json")) as { tnm: { estado: string } };
    expect(esperado.tnm.estado).toContain("PENDENTE");
    expect(ler("06-rm-prostata.txt")).toContain("estadiamento formal é do médico");
  });
});

describe("KIMI-17 · caso 07 · R1 — âncora dos trechos riscados (regressão para a leitura W7)", () => {
  it("preserva fixture e hash como PENDENTE e não promove os trechos riscados", () => {
    const rm = ler("06-rm-prostata.txt");
    expect(rm.match(/\[RISCADO\][\s\S]*?\[\/RISCADO\]/g)).toHaveLength(2);
    const bytes = Buffer.from(rm, "utf8");
    const convertido = converterEntradaLocal({ id: "caso07-rm", tipo: "TEXT", conteudo: bytes,
      recebidoEm: "2026-10-07T09:00:00-03:00" });
    expect(convertido.status).toBe("PENDENTE");
    expect(convertido.documento.hash).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(convertido.documento.paginas[0]?.texto).toBe(rm);

    const segmento = segmentarTranscricao({ recordingId: "caso07-rm", sourceId: "fonte-caso07",
      sourceType: "imaging_report", turns: rm.split(/\r?\n/).map((text) => ({ text, startMs: null, endMs: null })) })[0]!;
    const fatos = extratorDeterministico.extrair(segmento);
    expect(fatos.some((f) => /RISCADO|volume prostático de 42 mL|realce precoce difuso/iu.test(f.rawEvidence)))
      .toBe(false);
  });
});
