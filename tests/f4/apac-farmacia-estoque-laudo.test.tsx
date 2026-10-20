// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import type { TumorLot } from "../../src/contracts/clinico.js";
import type { CaixaNumerada } from "../../src/contracts/w10/clinico-w10.js";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import {
  executarFluxoLinearApacF4,
  montarApacBatch,
} from "../../src/modules/apac/laudoAcessoJudicial.js";
import type { TabelasSigtap } from "../../src/modules/apac/sigtap.js";
import {
  assinarMinutaLaudoAcessoJudicialF4,
  avaliarFarmaciaEEstoqueF4,
  lerMinutaLaudoAcessoJudicialF4,
  listarNegativasRetrogradasF4,
  registrarNegativaRetrogradaNoBancoF4,
  salvarMinutaLaudoAcessoJudicialF4,
} from "../../src/server/f4Acesso.js";
import { criarGerenciadorSessao } from "../../src/server/sessao.js";
import { criarChaves } from "../../src/ui/api/chaves.js";
import { criarPortaFalsa } from "../../src/ui/api/fake.js";
import { TelaApacLote } from "../../src/ui/telas/apac/TelaApacLote.js";
import { ChipEstoque } from "../../src/ui/telas/chat/ChipEstoque.js";
import { fonteSintetica, presente } from "../fixtures/triagem.js";

const CAIXAS = (
  JSON.parse(readFileSync(resolve(process.cwd(), "corpus/glossario/caixas.v1.json"), "utf8")) as {
    caixas: CaixaNumerada[];
  }
).caixas;

const SIGTAP_2026_09 = JSON.parse(
  readFileSync(resolve(process.cwd(), "corpus/f0c/sigtap/2026-09.json"), "utf8"),
) as TabelasSigtap["string"];

const AGORA = "2026-10-18T11:00:00.000Z";
const HOJE = "2026-10-18";
const SENHA = "senha-sintetica-f4-apac";

const pastas: string[] = [];
const abertos: DatabaseSync[] = [];

function ledger(): { db: DatabaseSync; caminho: string } {
  const pasta = mkdtempSync(join(tmpdir(), "apac-f4-"));
  pastas.push(pasta);
  const caminho = join(pasta, "ledger.sqlite");
  const db = abrirLedger(caminho);
  abertos.push(db);
  return { db, caminho };
}

function reabrir(caminho: string): DatabaseSync {
  const db = abrirLedger(caminho);
  abertos.push(db);
  return db;
}

function sessao(agora = AGORA) {
  const sessoes = criarGerenciadorSessao({
    medicoId: "medico-f4-apac",
    crm: "CRM-PB-SINTETICO",
    senha: SENHA,
    duracaoMs: 300_000,
    agora: () => agora,
  });
  const login = sessoes.login(SENHA);
  if (!login) throw new Error("LOGIN_FALHOU");
  return { sessoes, token: login.token, agora };
}

function tumorLotBase(overrides: Partial<TumorLot> = {}): TumorLot {
  return {
    tumorLotId: "lot-f4-1",
    patientId: "pt-f4-1",
    cid: presente("C509"),
    topografia: presente("Mama"),
    histologia: presente("Carcinoma ductal invasivo"),
    estadiamentos: [
      {
        estadiamentoId: "est-f4-1",
        sistema: "AJCC",
        edicao: "8",
        prefixo: "c",
        T: "T2",
        N: "N1",
        M: "M0",
        grupo: "IIB",
        data: "2026-09-01",
        fontes: [fonteSintetica("fonte-est-f4")],
        usoAtivo: ["PROTOCOLO", "APAC"],
      },
    ],
    finalidadeApac: presente("ADJUVANTE"),
    marcos: [{ marco: "EM_TRATAMENTO", em: "2026-09-10" }],
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  for (const db of abertos.splice(0)) {
    try { db.close(); } catch { /* ja fechado */ }
  }
  for (const pasta of pastas.splice(0)) {
    rmSync(pasta, { recursive: true, force: true });
  }
});

describe("FASE F4 · APAC, Farmácia, Estoque e Documentação de Acesso/Judicialização (S-F4-01 a S-F4-05)", () => {
  it("S-F4-01 · APAC só nasce de prescrição ASSINADA, herda finalidade escolhida pelo médico (nunca converte intenção), valida SIGTAP e aplica D85/D90 sem travar a consulta", () => {
    const lot = tumorLotBase();

    // Prescrição não assinada é recusada por apacGerar
    expect(() =>
      executarFluxoLinearApacF4({
        prescricaoAssinada: {
          apacId: "apac-invalida",
          documentId: "rx-rascunho",
          documentVersion: 1,
          revisao: "CONFIRMADO" as unknown as "ASSINADO",
          competencia: "2026-09",
          campos: {},
        },
        tumorLot: lot,
        hoje: HOJE,
        ultimoAvisoEm: null,
        camposObrigatorios: ["cidPrincipal", "procedimentoPrincipal", "finalidadeApac"],
        sigtap: { "2026-09": SIGTAP_2026_09 },
        caixas: CAIXAS,
        cnesConfigurado: "2605473",
      }),
    ).toThrow("PRESCRICAO_NAO_ASSINADA");

    // Intenção clínica contrabandeada no payload da prescrição ("intencao") é ignorada; vale apenas a escolha humana do TumorLot (G-12)
    const d10 = executarFluxoLinearApacF4({
      prescricaoAssinada: {
        apacId: "apac-d10",
        documentId: "rx-assinada-1",
        documentVersion: 1,
        revisao: "ASSINADO",
        competencia: "2026-09",
        campos: {
          cidPrincipal: "C509",
          procedimentoPrincipal: "0304050067",
          intencao: "PALIATIVA", // deve ser descartado!
        },
      },
      tumorLot: lot,
      hoje: "2026-09-20", // 10 dias após geração se gerada em 2026-09-10
      ultimoAvisoEm: null,
      camposObrigatorios: ["cidPrincipal", "procedimentoPrincipal", "finalidadeApac"],
      sigtap: { "2026-09": SIGTAP_2026_09 },
      caixas: CAIXAS,
      cnesConfigurado: "2605473",
    });
    expect(d10.apac.campos).not.toHaveProperty("intencao");
    expect((d10.apac.campos.finalidadeApac as { valor: string }).valor).toBe("ADJUVANTE");
    expect(d10.validacaoEmissao.podeEmitir).toBe(true);
    expect(d10.tabelaSigtapPresente).toBe(true);

    // Prazo D85 (aviso 1x: ultimoAvisoEm === null -> aviso: true; ultimoAvisoEm !== null -> aviso: false)
    // e D90 (VENCIDA: faturamento não emite, podeExportarFaturamento: false, mas consultaSegue: true)
    // 2026-07-01 -> 2026-09-24 = 85 dias; 2026-07-01 -> 2026-09-29 = 90 dias
    const d85PrimeiraVez = executarFluxoLinearApacF4({
      prescricaoAssinada: {
        apacId: "apac-d85",
        documentId: "rx-assinada-1",
        documentVersion: 1,
        revisao: "ASSINADO",
        competencia: "2026-09",
        campos: { cidPrincipal: "C509", procedimentoPrincipal: "0304050067" },
      },
      tumorLot: lot,
      dataGeracaoApp: "2026-07-01",
      hoje: "2026-09-24",
      ultimoAvisoEm: null,
      camposObrigatorios: ["cidPrincipal"],
      sigtap: { "2026-09": SIGTAP_2026_09 },
      caixas: CAIXAS,
      cnesConfigurado: "2605473",
    });
    expect(d85PrimeiraVez.prazo.dias).toBe(85);
    expect(d85PrimeiraVez.prazo.aviso).toBe(true);
    expect(d85PrimeiraVez.prazo.faturamentoPodeEmitir).toBe(true);
    expect(d85PrimeiraVez.consultaClinicaSegueSempre).toBe(true);

    const d85Repetido = executarFluxoLinearApacF4({
      prescricaoAssinada: {
        apacId: "apac-d85",
        documentId: "rx-assinada-1",
        documentVersion: 1,
        revisao: "ASSINADO",
        competencia: "2026-09",
        campos: { cidPrincipal: "C509", procedimentoPrincipal: "0304050067" },
      },
      tumorLot: lot,
      dataGeracaoApp: "2026-07-01",
      hoje: "2026-09-24",
      ultimoAvisoEm: "2026-09-24T08:00:00.000Z",
      camposObrigatorios: ["cidPrincipal"],
      sigtap: { "2026-09": SIGTAP_2026_09 },
      caixas: CAIXAS,
      cnesConfigurado: "2605473",
    });
    expect(d85Repetido.prazo.aviso).toBe(false);

    const d90Vencida = executarFluxoLinearApacF4({
      prescricaoAssinada: {
        apacId: "apac-d90",
        documentId: "rx-assinada-1",
        documentVersion: 1,
        revisao: "ASSINADO",
        competencia: "2026-09",
        campos: { cidPrincipal: "C509", procedimentoPrincipal: "0304050067" },
      },
      tumorLot: lot,
      dataGeracaoApp: "2026-07-01",
      hoje: "2026-09-29",
      ultimoAvisoEm: "2026-09-24T08:00:00.000Z",
      camposObrigatorios: ["cidPrincipal"],
      sigtap: { "2026-09": SIGTAP_2026_09 },
      caixas: CAIXAS,
      cnesConfigurado: "2605473",
    });
    expect(d90Vencida.prazo.dias).toBe(90);
    expect(d90Vencida.prazo.estado).toBe("VENCIDA");
    expect(d90Vencida.prazo.faturamentoPodeEmitir).toBe(false);
    expect(d90Vencida.podeExportarFaturamento).toBe(false);
    expect(d90Vencida.consultaClinicaSegueSempre).toBe(true);
  });

  it("S-F4-02 · lotes ApacBatch por competência única (excluindo cirurgia/AIH, vencida e bloqueado sem travar os demais) e negativa retrógrada FN-13", () => {
    const { db, caminho } = ledger();
    const acesso = sessao();

    // Lote operacional: uma competência por lote; item BLOQUEADO, VENCIDA ou CIRURGIA sai com motivo sem travar os válidos
    const batch = montarApacBatch(
      "batch-2026-10",
      { competencia: null, cid: null, esquema: null, estado: null },
      [
        {
          apacId: "apac-ok-1",
          competencia: "2026-10",
          cid: "C509",
          esquema: "AC-T",
          estado: "RASCUNHO",
          artefato: "PRONTO",
          modalidade: "APAC",
          motivoBloqueio: null,
        },
        {
          apacId: "apac-ok-2",
          competencia: "2026-10",
          cid: "C61",
          esquema: "Docetaxel",
          estado: "RASCUNHO",
          artefato: "PRONTO",
          modalidade: "APAC",
          motivoBloqueio: null,
        },
        {
          apacId: "apac-outro-mes",
          competencia: "2026-09",
          cid: "C18",
          esquema: "FOLFOX",
          estado: "RASCUNHO",
          artefato: "PRONTO",
          modalidade: "APAC",
          motivoBloqueio: null,
        },
        {
          apacId: "apac-bloqueada",
          competencia: "2026-10",
          cid: "C34",
          esquema: "Cis+Pem",
          estado: "RASCUNHO",
          artefato: "BLOQUEADO",
          modalidade: "APAC",
          motivoBloqueio: "estádio ausente na emissão",
        },
        {
          apacId: "apac-vencida",
          competencia: "2026-10",
          cid: "C509",
          esquema: "AC",
          estado: "VENCIDA",
          artefato: "PRONTO",
          modalidade: "APAC",
          motivoBloqueio: null,
        },
        {
          apacId: "aih-cirurgia",
          competencia: "2026-10",
          cid: "C509",
          esquema: "Mastectomia",
          estado: "RASCUNHO",
          artefato: "PRONTO",
          modalidade: "CIRURGIA",
          motivoBloqueio: null,
        },
      ],
      AGORA,
    );

    expect(batch.trava).toBe(false);
    expect(batch.criterio.competencia).toBe("2026-10");
    expect(batch.itens).toEqual(["apac-ok-1", "apac-ok-2"]);
    expect(batch.excluidos.map((e) => e.apacId)).toEqual([
      "apac-outro-mes",
      "apac-bloqueada",
      "apac-vencida",
      "aih-cirurgia",
    ]);

    // Negativa retrógrada FN-13: preserva a APAC NEGADA com comprovante e aponta campoOrigem = "estadiamentos"
    const negada = registrarNegativaRetrogradaNoBancoF4(db, acesso, {
      patientId: "pt-f4-1",
      apacExistente: {
        apacId: "apac-neg-1",
        tumorLotId: "lot-f4-1",
        prescricaoAssinadaRef: { documentId: "rx-1", documentVersion: 1 },
        dataGeracaoApp: "2026-10-01",
        competencia: "2026-10",
        campos: { cidPrincipal: "C509" },
        estado: "EMITIDA",
        resultadoExterno: null,
        versao: 1,
        substituiApacId: null,
      },
      codigoNegativa: "ESTADIO_AUSENTE",
      motivoTexto: "Glosa externa por ausência de estadiamento TNM no laudo.",
      comprovanteRef: "comp-glosa-2026-10-001",
    });

    expect(negada).toMatchObject({
      ok: true,
      replay: false,
      apacNegadaPreservada: {
        apacId: "apac-neg-1",
        estado: "NEGADA",
        resultadoExterno: {
          valor: "NEGADA",
          comprovanteRef: "comp-glosa-2026-10-001",
        },
      },
      pendenciaRetrograda: {
        apacId: "apac-neg-1",
        campoOrigem: "estadiamentos",
        estado: "PENDENTE",
      },
    });

    // Segunda chamada com código conflitante para o mesmo apacId é recusada com CONFLITO_NEGATIVA_EXISTENTE
    expect(
      registrarNegativaRetrogradaNoBancoF4(db, acesso, {
        patientId: "pt-f4-1",
        apacExistente: {
          apacId: "apac-neg-1",
          tumorLotId: "lot-f4-1",
          prescricaoAssinadaRef: { documentId: "rx-1", documentVersion: 1 },
          dataGeracaoApp: "2026-10-01",
          competencia: "2026-10",
          campos: { cidPrincipal: "C509" },
          estado: "EMITIDA",
          resultadoExterno: null,
          versao: 1,
          substituiApacId: null,
        },
        codigoNegativa: "CID_AUSENTE",
        motivoTexto: "Conflito de código de negativa.",
        comprovanteRef: "comp-glosa-outro",
      }),
    ).toEqual({ ok: false, codigo: "CONFLITO_NEGATIVA_EXISTENTE" });

    db.close();
    const dbReaberto = reabrir(caminho);
    expect(listarNegativasRetrogradasF4(dbReaberto, "pt-f4-1")).toHaveLength(1);
  });

  it("S-F4-03 · farmácia nunca edita prescrição (D9: ENVIADA -> CORRECAO_PEDIDA -> ACEITA/RECUSAR) e chip de estoque exibe origem/data sem travar nem sugerir troca", () => {
    // 1. Tentativa de EDITAR pela farmácia é bloqueada com FARMACIA_NAO_EDITA
    const tentativaEditar = avaliarFarmaciaEEstoqueF4({
      conteudoPrescricaoId: "rx-assinada-99",
      pedidoFarmacia: { ator: "FARMACIA", acao: "EDITAR", campo: "dose" },
      leituraEstoque: { estado: "INDISPONIVEL", origem: "Almoxarifado Central", data: HOJE },
      hoje: HOJE,
      validadeEstoque: { dias: 7, fonte: "DECISAO_SERVICO" },
    });
    expect(tentativaEditar.resultadoFarmacia).toMatchObject({
      ok: false,
      bloqueiaMedico: false,
      erro: { codigo: "FARMACIA_NAO_EDITA" },
    });
    expect(tentativaEditar.chipEstoque).toEqual({
      estado: "INDISPONIVEL",
      origem: "Almoxarifado Central",
      data: HOJE,
      trava: false,
      sugereTroca: false,
      motivo: "estoque informado como indisponível",
    });

    // 2. Farmácia confere -> CONFERIDA; ou pede correção com motivo -> CORRECAO_PEDIDA; médico recusa ou aceita
    const conferidaDireto = avaliarFarmaciaEEstoqueF4({
      conteudoPrescricaoId: "rx-conferida-1",
      pedidoFarmacia: { ator: "FARMACIA", acao: "CONFERIR" },
      leituraEstoque: { estado: "DISPONIVEL", origem: "Farmácia Satélite QT", data: HOJE },
      hoje: HOJE,
      validadeEstoque: { dias: 7, fonte: "DECISAO_SERVICO" },
    });
    expect(conferidaDireto.registroFarmacia.estado).toBe("CONFERIDA");

    const pediuCorrecao = avaliarFarmaciaEEstoqueF4({
      conteudoPrescricaoId: "rx-assinada-99",
      pedidoFarmacia: {
        ator: "FARMACIA",
        acao: "PEDIR_CORRECAO",
        motivo: "Conferir volume de diluente SF 0,9% 500 mL.",
      },
      leituraEstoque: { estado: "DISPONIVEL", origem: "Farmácia Satélite QT", data: HOJE },
      hoje: HOJE,
      validadeEstoque: { dias: 7, fonte: "DECISAO_SERVICO" },
    });
    expect(pediuCorrecao.registroFarmacia.estado).toBe("CORRECAO_PEDIDA");

    const medicoRecusou = avaliarFarmaciaEEstoqueF4({
      registroAtual: pediuCorrecao.registroFarmacia,
      conteudoPrescricaoId: "rx-assinada-99",
      pedidoFarmacia: { ator: "MEDICO", acao: "RECUSAR" },
      leituraEstoque: { estado: "DISPONIVEL", origem: "Farmácia Satélite QT", data: HOJE },
      hoje: HOJE,
      validadeEstoque: { dias: 7, fonte: "DECISAO_SERVICO" },
    });
    expect(medicoRecusou.registroFarmacia.estado).toBe("CORRECAO_PEDIDA");
    expect(medicoRecusou.registroFarmacia.historico).toHaveLength(2);

    const medicoAceitou = avaliarFarmaciaEEstoqueF4({
      registroAtual: medicoRecusou.registroFarmacia,
      conteudoPrescricaoId: "rx-assinada-99",
      pedidoFarmacia: { ator: "MEDICO", acao: "ACEITAR" },
      leituraEstoque: { estado: "DISPONIVEL", origem: "Farmácia Satélite QT", data: HOJE },
      hoje: HOJE,
      validadeEstoque: { dias: 7, fonte: "DECISAO_SERVICO" },
    });
    expect(medicoAceitou.registroFarmacia.estado).toBe("ACEITA");
    expect(medicoAceitou.registroFarmacia.historico).toHaveLength(3);

    // Leitura de estoque vencida (> 7 dias) vira DESCONHECIDO sem travar
    const estoqueVelho = avaliarFarmaciaEEstoqueF4({
      conteudoPrescricaoId: "rx-assinada-99",
      leituraEstoque: { estado: "DISPONIVEL", origem: "Farmácia Satélite QT", data: "2026-10-01" },
      hoje: HOJE,
      validadeEstoque: { dias: 7, fonte: "DECISAO_SERVICO" },
    });
    expect(estoqueVelho.chipEstoque.estado).toBe("DESCONHECIDO");
    expect(estoqueVelho.chipEstoque.trava).toBe(false);
    expect(estoqueVelho.chipEstoque.sugereTroca).toBe(false);
  });

  it("S-F4-04 & S-F4-05 · minuta de laudo de acesso/judicialização exige grounding por fato/fonte datada, separa indicação/registro/cobertura/disponibilidade, recusa tese de direito adquirido, bloqueia assinatura por IA (G-03), impede sobrescrita pós-assinatura e renderiza UI APAC/Estoque", async () => {
    const { db, caminho } = ledger();
    const acesso = sessao();

    const citacoes = [
      {
        citacaoId: "cit-fato-1",
        tipoFonte: "FATO_CLINICO_CONFIRMADO" as const,
        referenciaId: "ev-patologia-1",
        tituloOuDescricao: "Biópsia e imuno-histoquímica confirmadas no prontuário",
        dataFonte: "2026-09-05",
        consultadoEm: HOJE,
        trechoSustentador: "Carcinoma mamário triplo-negativo estádio IIB com progressão após esquema padrão.",
        desfechosDocumentados: null,
      },
      {
        citacaoId: "cit-estudo-1",
        tipoFonte: "DIRETRIZ_OU_ESTUDO_PUBLICADO" as const,
        referenciaId: "estudo-keynote-522",
        tituloOuDescricao: "Diretriz SBOC Mama 2026 / Estudo Fase III",
        dataFonte: "2026-01-15",
        consultadoEm: HOJE,
        trechoSustentador: "Benefício documentado em sobrevida livre de eventos no cenário avaliado.",
        desfechosDocumentados: {
          sobrevidaGlobal: "Aumento documentado no estudo de referência",
          sobrevidaLivreProgressao: " Ganho estatisticamente significativo",
          hazardRatio: "HR 0,63",
        },
      },
    ];

    // 1. Afirmação sem citação existente falha por violação de grounding
    const semGrounding = salvarMinutaLaudoAcessoJudicialF4(db, acesso, {
      minutaId: "laudo-sem-grounding",
      patientId: "pt-f4-1",
      encounterId: "enc-f4-1",
      tumorLotId: "lot-f4-1",
      prescricaoAssinadaRef: { documentId: "rx-jud-1", documentVersion: 1 },
      medicamentoSolicitado: {
        nome: "Pembrolizumabe",
        posologiaPlanejada: "200 mg EV a cada 21 dias",
        duracaoPrevista: "Até 12 meses conforme tolerância e resposta",
      },
      indicacaoClinicaMedica: "Indicação clínica individualizada após revisão do caso.",
      registroRegulatorio: "REGISTRADO_ANVISA",
      coberturaPadrao: "NAO_INCORPORADO_SUS",
      chipEstoque: {
        estado: "INDISPONIVEL",
        origem: "Farmácia UNACON",
        data: HOJE,
        trava: false,
        sugereTroca: false,
        motivo: "estoque informado como indisponível",
      },
      citacoesVerificadas: citacoes,
      afirmacoes: [
        {
          afirmacaoId: "af-invalida",
          secao: "JUSTIFICATIVA_CLINICA",
          texto: "Afirmação sem fonte verificada.",
          citacoesIds: ["cit-inexistente"],
        },
      ],
    });
    expect(semGrounding).toMatchObject({ ok: false, codigo: "GROUNDING_CITACAO_INEXISTENTE" });

    // 2. Afirmação com expressão proibida ("direito adquirido" / "elegível automaticamente") é recusada
    const comTeseJuridicaProibida = salvarMinutaLaudoAcessoJudicialF4(db, acesso, {
      minutaId: "laudo-proibido",
      patientId: "pt-f4-1",
      encounterId: "enc-f4-1",
      tumorLotId: "lot-f4-1",
      prescricaoAssinadaRef: { documentId: "rx-jud-1", documentVersion: 1 },
      medicamentoSolicitado: {
        nome: "Pembrolizumabe",
        posologiaPlanejada: "200 mg EV a cada 21 dias",
        duracaoPrevista: "Até 12 meses",
      },
      indicacaoClinicaMedica: "Indicação clínica individualizada.",
      registroRegulatorio: "REGISTRADO_ANVISA",
      coberturaPadrao: "NAO_INCORPORADO_SUS",
      chipEstoque: {
        estado: "INDISPONIVEL",
        origem: "Farmácia UNACON",
        data: HOJE,
        trava: false,
        sugereTroca: false,
        motivo: "indisponível",
      },
      citacoesVerificadas: citacoes,
      afirmacoes: [
        {
          afirmacaoId: "af-proibida",
          secao: "JUSTIFICATIVA_CLINICA",
          texto: "O paciente possui direito adquirido e é elegível automaticamente ao fornecimento.",
          citacoesIds: ["cit-fato-1"],
        },
      ],
    });
    expect(comTeseJuridicaProibida).toMatchObject({ ok: false, codigo: "EXPRESSAO_PROIBIDA_NO_LAUDO" });

    // 3. Minuta válida nasce em REVISAR (sem assinatura automática), separando indicação, registro, cobertura e disponibilidade
    const entradaMinutaValida: Parameters<typeof salvarMinutaLaudoAcessoJudicialF4>[2] = {
      minutaId: "laudo-valido-1",
      patientId: "pt-f4-1",
      encounterId: "enc-f4-1",
      tumorLotId: "lot-f4-1",
      prescricaoAssinadaRef: { documentId: "rx-jud-1", documentVersion: 1 },
      medicamentoSolicitado: {
        nome: "Pembrolizumabe",
        posologiaPlanejada: "200 mg EV a cada 21 dias",
        duracaoPrevista: "Até 12 meses conforme avaliação clínica",
      },
      indicacaoClinicaMedica: "Indicação clínica fundamentada em falha/insuficiência da alternativa disponível no SUS para o cenário documentado.",
      registroRegulatorio: "REGISTRADO_ANVISA",
      coberturaPadrao: "NAO_INCORPORADO_SUS",
      chipEstoque: {
        estado: "INDISPONIVEL",
        origem: "Farmácia UNACON",
        data: HOJE,
        trava: false,
        sugereTroca: false,
        motivo: "estoque informado como indisponível",
      },
      citacoesVerificadas: citacoes,
      afirmacoes: [
        {
          afirmacaoId: "af-1",
          secao: "IDENTIFICACAO_DIAGNOSTICO",
          texto: "Diagnóstico histológico e estadiamento IIB confirmados em laudo anatomopatológico.",
          citacoesIds: ["cit-fato-1"],
        },
        {
          afirmacaoId: "af-2",
          secao: "JUSTIFICATIVA_CLINICA",
          texto: "Diretriz SBOC e estudo de fase III demonstram benefício em sobrevida livre de progressão (HR 0,63).",
          citacoesIds: ["cit-estudo-1"],
        },
      ],
    };
    const minutaValida = salvarMinutaLaudoAcessoJudicialF4(db, acesso, entradaMinutaValida);
    expect(minutaValida.ok).toBe(true);
    if (!minutaValida.ok) return;
    expect(minutaValida.minuta.revisao).toBe("REVISAR");
    expect(minutaValida.minuta.separacaoEixosAcesso).toMatchObject({
      registroRegulatorio: "REGISTRADO_ANVISA",
      coberturaPadrao: "NAO_INCORPORADO_SUS",
      disponibilidadeLocal: { estado: "INDISPONIVEL", origem: "Farmácia UNACON", dataLeitura: HOJE },
      presumeDireitoIndividualAutomatico: false,
      presumeElegibilidadeAutomatica: false,
    });

    // Reuso de identidade de minuta não pode trocar nenhum eixo do contexto.
    for (const campo of ["patientId", "encounterId", "tumorLotId"] as const) {
      expect(salvarMinutaLaudoAcessoJudicialF4(db, acesso, {
        ...entradaMinutaValida, [campo]: "outro-contexto-sintetico",
      })).toEqual({ ok: false, codigo: "CONTEXTO_MINUTA_DIVERGENTE" });
      expect(lerMinutaLaudoAcessoJudicialF4(db, "laudo-valido-1", 1)).toEqual(minutaValida.minuta);
    }

    // 4. Tentativa de assinatura por AGENTE/IA é bloqueada pelo gate G-03
    expect(assinarMinutaLaudoAcessoJudicialF4(db, acesso, {
      minutaId: "laudo-valido-1",
      versao: 1,
      atorOverrideParaTesteAdversarial: { tipo: "AGENTE", crm: null },
    })).toEqual({ ok: false, codigo: "G03_ASSINATURA_NEGADA" });

    // 5. Assinatura pelo médico autenticado na sessão (SESSAO + CRM) promove a ASSINADO e impede sobrescrita posterior na mesma versão
    const assinada = assinarMinutaLaudoAcessoJudicialF4(db, acesso, {
      minutaId: "laudo-valido-1",
      versao: 1,
    });
    expect(assinada).toMatchObject({
      ok: true,
      minutaAssinada: {
        revisao: "ASSINADO",
        assinadoPorMedicoId: "medico-f4-apac",
        assinadoPorCrm: "CRM-PB-SINTETICO",
      },
    });

    // Tentar sobrescrever versão 1 já ASSINADO retorna MINUTA_JA_ASSINADA_IMUTAVEL
    expect(
      salvarMinutaLaudoAcessoJudicialF4(db, acesso, {
        minutaId: "laudo-valido-1",
        versao: 1,
        patientId: "pt-f4-1",
        encounterId: "enc-f4-1",
        tumorLotId: "lot-f4-1",
        prescricaoAssinadaRef: { documentId: "rx-jud-1", documentVersion: 1 },
        medicamentoSolicitado: {
          nome: "Pembrolizumabe",
          posologiaPlanejada: "200 mg EV a cada 21 dias",
          duracaoPrevista: "Até 12 meses",
        },
        indicacaoClinicaMedica: "Tentativa de sobrescrever versão já assinada.",
        registroRegulatorio: "REGISTRADO_ANVISA",
        coberturaPadrao: "NAO_INCORPORADO_SUS",
        chipEstoque: {
          estado: "INDISPONIVEL",
          origem: "Farmácia UNACON",
          data: HOJE,
          trava: false,
          sugereTroca: false,
          motivo: "indisponível",
        },
        citacoesVerificadas: citacoes,
        afirmacoes: [
          {
            afirmacaoId: "af-1",
            secao: "IDENTIFICACAO_DIAGNOSTICO",
            texto: "Texto modificado.",
            citacoesIds: ["cit-fato-1"],
          },
        ],
      }),
    ).toEqual({ ok: false, codigo: "MINUTA_JA_ASSINADA_IMUTAVEL" });

    db.close();
    const dbReaberto = reabrir(caminho);
    expect(lerMinutaLaudoAcessoJudicialF4(dbReaberto, "laudo-valido-1", 1)?.revisao).toBe("ASSINADO");

    // 6. Demonstração na UI: TelaApacLote + ChipEstoque
    const porta = criarPortaFalsa();
    render(<TelaApacLote porta={porta} chaves={criarChaves()} />);
    await screen.findByLabelText("APAC por lote");

    render(
      <ChipEstoque
        chip={{
          estado: "INDISPONIVEL",
          origem: "Farmácia Central",
          data: HOJE,
          trava: false,
          sugereTroca: false,
          motivo: "estoque informado como indisponível",
        }}
      />,
    );
    expect(screen.getByText(/estoque: em falta/i)).toBeTruthy();
  });
});
