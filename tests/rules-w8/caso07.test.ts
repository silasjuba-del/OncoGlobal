import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  agregarCaso,
  avaliarHierarquiaFonte,
  avaliarInteracaoMedicamentosa,
  avaliarRasuraEConfianca,
  classificarIdentificador,
  deduplicarExames,
  escolherDataClinica,
  gerarResumoImagem,
  idadeNaData,
  validarSitioPatologia,
  vincularDocumentoAoPaciente,
  type EntradaExameDedupe,
  type EntradaSitioPatologia,
  type RulesetInteracoes,
} from "../../src/rules/w8/index.js";

// Fixture do Paciente Teste 07 sintético (sem nenhum dado real de paciente)
const CPF_SINTETICO_CASO07 = "12345678900"; // DV intencionalmente inválido
const CNS_SINTETICO_CASO07 = "700000000000005"; // 15 dígitos válido

const CADASTRO_PACIENTE_07 = {
  patientId: "pac-teste-07",
  identificadores: [
    { tipo: "CPF" as const, valor: CPF_SINTETICO_CASO07 },
    { tipo: "CNS" as const, valor: CNS_SINTETICO_CASO07 },
  ],
};

describe("AG-10 · Teste ponta a ponta do Paciente Teste 07 (sintético)", () => {
  it("I1/I2: classificação de identificadores apura conflitos com rótulos e DV inválido de propósito", () => {
    // 1. Ficha com CPF sintético rotulado 'CI'
    const idFicha = classificarIdentificador({
      rotulo: "CI",
      valor: CPF_SINTETICO_CASO07,
    });
    expect(idFicha.tipoPorValor).toBe("CPF");
    expect(idFicha.valido).toBe(false); // DV inválido do caso 07
    expect(idFicha.conflitoRotulo).toBe(true); // 'CI' com valor CPF

    // 2. Laudos com o mesmo CPF rotulado 'Cartão SUS'
    const idLaudo = classificarIdentificador({
      rotulo: "Cartão SUS",
      valor: CPF_SINTETICO_CASO07,
    });
    expect(idLaudo.tipoPorValor).toBe("CPF");
    expect(idLaudo.valido).toBe(false);
    expect(idLaudo.conflitoRotulo).toBe(true); // 'Cartão SUS' com valor CPF de 11 dígitos

    // 3. Documento com CNS sintético rotulado 'Matrícula'
    const idDocPessoal = classificarIdentificador({
      rotulo: "Matrícula",
      valor: CNS_SINTETICO_CASO07,
    });
    expect(idDocPessoal.tipoPorValor).toBe("CNS");
    expect(idDocPessoal.valido).toBe(true);
    expect(idDocPessoal.conflitoRotulo).toBe(true); // 'Matrícula' com valor CNS de 15 dígitos
  });

  it("I3/I4/I5: vínculo documental bloqueia comprovante de terceiro e acompanhante", () => {
    // I3: Comprovante de residência em nome de 'Familiar Teste 07'
    const vComprovante = vincularDocumentoAoPaciente({
      tipoDocumento: "COMPROVANTE_RESIDENCIA_TERCEIRO",
      papelPessoa: "FAMILIAR",
      identificador: { rotulo: "CPF", valor: CPF_SINTETICO_CASO07 },
      pacienteAlvo: CADASTRO_PACIENTE_07,
    });
    expect(vComprovante.liga).toBe(false);
    expect(vComprovante.motivo).toContain("comprovante de terceiro");

    // I4: Assinatura de acompanhante no rodapé
    const vAcompanhante = vincularDocumentoAoPaciente({
      tipoDocumento: "FICHA_ADMIN",
      papelPessoa: "ACOMPANHANTE",
      identificador: { rotulo: "CPF", valor: CPF_SINTETICO_CASO07 },
      pacienteAlvo: CADASTRO_PACIENTE_07,
    });
    expect(vAcompanhante.liga).toBe(false);
    expect(vAcompanhante.motivo).toContain("acompanhante");

    // I5: Médico solicitante
    const vMedico = vincularDocumentoAoPaciente({
      tipoDocumento: "LAUDO_PRIMARIO",
      papelPessoa: "MEDICO_SOLICITANTE",
      identificador: { rotulo: "CRM", valor: "54321" },
      pacienteAlvo: CADASTRO_PACIENTE_07,
    });
    expect(vMedico.liga).toBe(false);
  });

  it("T1/T2: datas clínicas separadas de emissão/extração e idade derivada", () => {
    // T1: Laudo com data de emissão e extração diferentes da data clínica
    const dataOk = escolherDataClinica({
      dataClinica: "2026-02-15",
      dataEmissao: "2026-02-28",
      dataAssinaturaDigital: "2026-03-01",
      dataExtracaoSistema: "2026-04-10",
    });
    expect(dataOk.data).toBe("2026-02-15");
    expect(dataOk.estado).toBe("VERDE");

    // T1: Laudo sem data clínica mas com data de extração SISREG
    const dataSisregSemClinica = escolherDataClinica({
      dataClinica: null,
      dataExtracaoSistema: "2026-04-10",
    });
    expect(dataSisregSemClinica.data).toBeNull();
    expect(dataSisregSemClinica.estado).toBe("PENDENTE");

    // T2: Idade derivada (nasc: 1958-08-20, dataRef clínica: 2026-02-15) -> 67 anos
    const calcIdade = idadeNaData("1958-08-20", "2026-02-15");
    expect(calcIdade.idadeAnos).toBe(67);
    expect(calcIdade.estado).toBe("VERDE");
  });

  it("D1–D3: deduplicação das 8 páginas de exame do Caso 07 resulta exatamente em 6 exames únicos", () => {
    const paginasCaso07: EntradaExameDedupe[] = [
      // 1. Biópsia - Frasco A (página 4)
      {
        id: "bx-frasco-a",
        tipo: "PATOLOGIA_IHQ",
        laboratorio: "LabPat-01",
        numeroExame: "AP-BX-77",
        dataEntrada: "2026-02-01",
        conteudoHash: "hash-bx-a",
        conclusao: "Adenocarcinoma de próstata em lobo direito",
        pagina: 4,
      },
      // 2. Biópsia - Frasco B (página 5)
      {
        id: "bx-frasco-b",
        tipo: "PATOLOGIA_IHQ",
        laboratorio: "LabPat-01",
        numeroExame: "AP-BX-78",
        dataEntrada: "2026-02-01",
        conteudoHash: "hash-bx-b",
        conclusao: "Adenocarcinoma de próstata em lobo esquerdo",
        pagina: 5,
      },
      // 3. RM de Próstata (página 6)
      {
        id: "rm-pros-06",
        tipo: "IMAGEM",
        servico: "ImagOnco",
        registro: "RM-9090",
        dataExame: "2026-02-20",
        conteudoHash: "hash-rm-pros",
        conclusao: "Lesão em zona periférica com extensão extraprostática",
        pagina: 6,
      },
      // 4. Cintilografia (página 7)
      {
        id: "cintilo-p7",
        tipo: "IMAGEM",
        servico: "MedNuc-Sul",
        registro: "MN-4411",
        dataExame: "2026-03-01",
        conteudoHash: "hash-cintilo-gêmea",
        conclusao: "Sem lesões neoplásicas secundárias; captação articular",
        pagina: 7,
      },
      // 5. Cintilografia (página 8, duplicada)
      {
        id: "cintilo-p8",
        tipo: "IMAGEM",
        servico: "MedNuc-Sul",
        registro: "MN-4411",
        dataExame: "2026-03-01",
        conteudoHash: "hash-cintilo-gêmea",
        conclusao: "Sem lesões neoplásicas secundárias; captação articular",
        pagina: 8,
      },
      // 6. AP de RTU de Próstata (página 9)
      {
        id: "rtu-p9",
        tipo: "PATOLOGIA_IHQ",
        laboratorio: "LabPat-01",
        numeroExame: "RTU-5522",
        dataEntrada: "2026-03-05",
        conteudoHash: "hash-rtu",
        conclusao: "Adenocarcinoma acinar",
        pagina: 9,
      },
      // 7. IHQ Original (página 10)
      {
        id: "ihq-p10",
        tipo: "PATOLOGIA_IHQ",
        laboratorio: "LabPat-01",
        numeroExame: "IHQ-1100",
        dataEntrada: "2026-03-06",
        conteudoHash: "hash-ihq-gêmea",
        conclusao: "Adenocarcinoma acinar",
        pagina: 10,
      },
      // 8. IHQ Reimpressão SISREG com cabeçalho diferente (página 11)
      {
        id: "ihq-p11",
        tipo: "PATOLOGIA_IHQ",
        laboratorio: "LabPat-01",
        numeroExame: "IHQ-1100",
        dataEntrada: "2026-03-06", // Mesma data clínica de entrada!
        conteudoHash: "hash-ihq-gêmea",
        conclusao: "Adenocarcinoma acinar",
        pagina: 11,
      },
    ];

    const dedupe = deduplicarExames(paginasCaso07);
    expect(dedupe.totalPaginasOuEntradas).toBe(8);
    expect(dedupe.totalExamesUnicos).toBe(6); // 8 páginas viram 6 exames únicos!
    expect(dedupe.duplicatasDetectadas).toHaveLength(2); // Cintilografia duplicada e IHQ duplicada
    expect(dedupe.conflitos).toHaveLength(0);

    // D3: RTU e IHQ apresentam chaves distintas com conclusões concordantes
    expect(dedupe.concordancias.length).toBeGreaterThanOrEqual(1);
  });

  it("E1–E3: receituário do especialista com PSA sem laudo e PIRADS sem número", () => {
    // E2: PSA mencionado em receituário sem laudo laboratorial
    const avalPsa = avaliarHierarquiaFonte(
      null,
      { natureza: "SECUNDARIA", valor: "PSA total: 22.4 ng/mL" },
    );
    expect(avalPsa.origem).toBe("MENCIONADO_SEM_LAUDO");
    expect(avalPsa.estado).toBe("PENDENTE");

    // E3: PIRADS mencionado sem o número
    const avalPirads = avaliarHierarquiaFonte(
      null,
      { natureza: "SECUNDARIA", categoria: "PIRADS", escore: null },
    );
    expect(avalPirads.origem).toBe("CATEGORIA_SEM_VALOR");
    expect(avalPirads.estado).toBe("PENDENTE");
  });

  it("R1/C1: trechos riscados na RM são anulados e expostos como PENDENTE com recorteRef", () => {
    // Trecho riscado 1: dimensões da próstata
    const rasuraDimensoes = avaliarRasuraEConfianca(
      {
        valor: "52 x 48 x 40 mm",
        riscado: true,
        recorteRef: "img://recortes/caso07/rm_dimensoes_riscado.png",
      },
      { limiarConfiancaMinima: 0.8 },
    );
    expect(rasuraDimensoes.estado).toBe("PENDENTE");
    expect(rasuraDimensoes.valor).toBeNull();
    expect(rasuraDimensoes.pendenteRevisao).toBe(true);
    expect(rasuraDimensoes.recorteRef).toBe("img://recortes/caso07/rm_dimensoes_riscado.png");

    // Trecho riscado 2: frase sobre glândula central
    const rasuraCentral = avaliarRasuraEConfianca(
      {
        valor: "Glândula central com nódulo de 12 mm",
        riscado: true,
        recorteRef: "img://recortes/caso07/rm_glandula_central_riscado.png",
      },
      { limiarConfiancaMinima: 0.8 },
    );
    expect(rasuraCentral.estado).toBe("PENDENTE");
    expect(rasuraCentral.valor).toBeNull();
  });

  it("P1/P2: biópsia com 6 sítios e cribriforme em 1 sítio; agregação do caso pendente", () => {
    const sitios: EntradaSitioPatologia[] = [
      { sitio: "LD Base", gleasonPrimario: 3, gleasonSecundario: 3, grupoGrauISUP: 1, padraoCribriforme: "ausente", percentuaisGleason: [100] },
      { sitio: "LD Médio", gleasonPrimario: 3, gleasonSecundario: 4, grupoGrauISUP: 2, padraoCribriforme: "ausente", percentuaisGleason: [70, 30] },
      { sitio: "LD Ápice", gleasonPrimario: 3, gleasonSecundario: 4, grupoGrauISUP: 2, padraoCribriforme: "presente", percentuaisGleason: [60, 40] },
      { sitio: "LE Base", gleasonPrimario: 3, gleasonSecundario: 3, grupoGrauISUP: 1, padraoCribriforme: "ausente", percentuaisGleason: [100] },
      { sitio: "LE Médio", gleasonPrimario: 3, gleasonSecundario: 3, grupoGrauISUP: 1, padraoCribriforme: "ausente", percentuaisGleason: [100] },
      { sitio: "LE Ápice", gleasonPrimario: 3, gleasonSecundario: 3, grupoGrauISUP: 1, padraoCribriforme: "ausente", percentuaisGleason: [100] },
    ];

    // Valida cada sítio
    for (const s of sitios) {
      const v = validarSitioPatologia(s);
      expect(v.valido).toBe(true);
      expect(v.estado).toBe("VERDE");
    }

    // Agregação do caso permanece PENDENTE enquanto ruleset patologia-agregacao estiver inativo
    const casoAgregado = agregarCaso(sitios, { ativo: false });
    expect(casoAgregado.estado).toBe("PENDENTE");
    expect(casoAgregado.grauDoCaso).toBeNull();
  });

  it("S2: cintilografia negativa com captação articular não gera lesão óssea metastática", () => {
    const resumoCintilo = gerarResumoImagem({
      sede: "Esqueleto total",
      textoLaudo: "Cintilografia óssea: discreta hiperfixação articular em joelhos de natureza degenerativa. Ausência de lesões osteolíticas ou osteoblásticas neoplásicas.",
      achados: {
        osso: "hiperfixacao articular",
        naoOncologicos: "degenerativo",
      },
    });

    expect(resumoCintilo.resumo2.osso).toBe("ausente");
    expect(resumoCintilo.resumo2.naoOncologicos).toBe("degenerativo");
  });

  it("G-09: interações com o ruleset oficial retornam PENDENTE sem inventar 'sem interação'", () => {
    const rulesetInteracoes: RulesetInteracoes = JSON.parse(
      readFileSync(join(process.cwd(), "corpus", "rulesets", "interacoes.v1.json"), "utf8"),
    );

    const res = avaliarInteracaoMedicamentosa(
      "capecitabina",
      "varfarina",
      rulesetInteracoes,
    );
    expect(res.estado).toBe("PENDENTE");
    expect(res.regraAtiva).toBe(false);
  });
});
