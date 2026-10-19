import { executarConfirmacao } from '../../src/kernel/comandos/index.js';
import { salvarDraft } from '../../src/kernel/comandos/portas.js';
import { hashCanonico } from '../../src/rules/conteudoCanonico.js';
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { DoseRuleset, SalaoRuleset } from "../../src/contracts/regras.js";
import { g07Lateralidade, g09PtDeBiopsia, g13Letra } from "../../src/kernel/harness/gates.js";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { antiglosa } from "../../src/modules/apac/antiglosa.js";
import {
  avaliarDoseECicloSalao,
  calcularCumulativosEfetivosSalao,
  executarTriagemSalaoF3,
  organizarFilaSalaoF3,
} from "../../src/modules/salao/operacaoSalao.js";
import { semaforoInteracoes } from "../../src/rules/index.js";
import {
  gerarFolhaContingenciaSalaoF3,
  listarAdministracoesEfetivasSalaoF3,
  listarFolhasContingenciaSalaoF3,
  listarInterrupcoesSalaoF3,
  registrarAdministracaoEfetivaSalaoF3,
  registrarDesfechoPesoSalaoF3,
  registrarInterrupcaoSalaoF3,
  registrarLiberacaoComCorteSalaoF3,
} from "../../src/server/salaoF3.js";
import { criarGerenciadorSessao } from "../../src/server/sessao.js";
import { criarPortaFalsa } from "../../src/ui/api/fake.js";
import { TelaSalao } from "../../src/ui/telas/TelaSalao.js";
import { CalculadoraDose } from "../../src/ui/tratamento/CalculadoraDose.js";
import { ctxBase as contextoBase, fonteSintetica, triagemBase } from "../fixtures/triagem.js";

const SALAO_RS = SalaoRuleset.parse(
  JSON.parse(readFileSync(resolve(process.cwd(), "corpus/rulesets/salao-triagem.v1.json"), "utf8")),
);
const DOSE_RS = DoseRuleset.parse(
  JSON.parse(readFileSync(resolve(process.cwd(), "corpus/rulesets/dose.v1.json"), "utf8")),
);

const AGORA = "2026-10-18T10:00:00.000Z";
const HOJE = "2026-10-18";
const SENHA = "senha-sintetica-f3-salao";

const pastas: string[] = [];
const abertos: DatabaseSync[] = [];

function ledger(): { db: DatabaseSync; caminho: string } {
  const pasta = mkdtempSync(join(tmpdir(), "salao-f3-"));
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
    medicoId: "medico-f3-salao",
    crm: "CRM-PB-SINTETICO",
    senha: SENHA,
    duracaoMs: 300_000,
    agora: () => agora,
  });
  const login = sessoes.login(SENHA);
  if (!login) throw new Error("LOGIN_FALHOU");
  return { sessoes, token: login.token, agora };
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

describe("FASE F3 · Salão de Quimioterapia (S-F3-01 a S-F3-04 e casos clínicos C1–C14)", () => {
  it("S-F3-01 & C1–C3 · triagem com valores no limite (C1 -> SALAO), corte PAS 161 (C2 -> FILA_MEDICO), febre 37,9 + ANC 900 (C3 -> FILA_MEDICO + E1), hemograma > 7 dias e desconhecidos explícitos", () => {
    const ctx = contextoBase({ hoje: "2026-10-05" });

    // C1: todos no limite exato (PAS 160, PAS 90, FC 120, FC 50, SpO2 88, Temp 378 = 37,8°C, Hb 80 = 8,0 g/dL, ANC 1500, Plq 100000, hemograma de 7 dias) -> SALAO
    const c1 = executarTriagemSalaoF3(
      triagemBase({
        pas: { ...triagemBase().pas, valor: 160 },
        fc: { ...triagemBase().fc, valor: 120 },
        spo2: { ...triagemBase().spo2, valor: 88 },
        tempDecimos: { ...triagemBase().tempDecimos, valor: 378 },
        hbDgDl: { ...triagemBase().hbDgDl, valor: 80 },
        anc: { ...triagemBase().anc, valor: 1500 },
        plq: { ...triagemBase().plq, valor: 100000 },
        coletaHemograma: { ...triagemBase().coletaHemograma, valor: "2026-09-28" }, // 7 dias
      }),
      ctx,
      SALAO_RS,
    );
    expect(c1.destino).toBe("SALAO");
    expect(c1.cortes).toHaveLength(0);
    expect(c1.pendentes).toHaveLength(0);
    expect(c1.qtPodeIniciarSemMedico).toBe(true);
    expect(c1.exigeAvaliacaoMedica).toBe(false);

    // C2: PAS 161 -> FILA_MEDICO, sem parar o restante do salão
    const c2 = executarTriagemSalaoF3(
      triagemBase({ pas: { ...triagemBase().pas, valor: 161 } }),
      ctx,
      SALAO_RS,
    );
    expect(c2.destino).toBe("FILA_MEDICO");
    expect(c2.cortes.map((c) => c.codigo)).toContain("corte.pas.alta");
    expect(c2.qtPodeIniciarSemMedico).toBe(false);

    // C3: Temp 37,9 (379) + ANC 900 (< 1500) -> FILA_MEDICO + emergência E1 (corte + alerta urgente; diagnóstico é do médico)
    const c3 = executarTriagemSalaoF3(
      triagemBase({
        tempDecimos: { ...triagemBase().tempDecimos, valor: 379 },
        anc: { ...triagemBase().anc, valor: 900 },
      }),
      ctx,
      SALAO_RS,
    );
    expect(c3.destino).toBe("FILA_MEDICO");
    expect(c3.emergencia).toBe(true);

    // Hemograma com 8 dias (> 7 dias) -> PENDENTE -> FILA_MEDICO; dados desconhecidos explícitos (idadeAnos: null, tontura: null)
    const vencidoEDesconhecido = executarTriagemSalaoF3(
      triagemBase({
        coletaHemograma: { ...triagemBase().coletaHemograma, valor: "2026-09-27" }, // 8 dias
        idadeAnos: null,
        tontura: null,
      }),
      ctx,
      SALAO_RS,
    );
    expect(vencidoEDesconhecido.destino).toBe("FILA_MEDICO");
    expect(vencidoEDesconhecido.dadosDesconhecidosExplicitos).toEqual(
      expect.arrayContaining(["idadeAnos", "tontura", "pendente.coletaHemograma"]),
    );
  });

  it("S-F3-02 & C4–C5, C7 · fila ordenada (ECOG4 antes de ECOG3 em cadeira), frente exige zero corte/pendência, eventos de alergia/vômito, peso (-5,0 kg passa; -5,1 kg -> nutrição + QT adiada + consulta) e liberação médica justificada", () => {
    const { db } = ledger();
    const acesso = sessao();

    // C7: ECOG 4 (10h) antes de ECOG 3 em cadeira (9h); cama sem corte vai para FRENTE; cama com corte ou pendência vai para FILA_MEDICO
    const camaSemCorte = executarTriagemSalaoF3(
      triagemBase({ recurso: "CAMA" }),
      contextoBase(),
      SALAO_RS,
    );
    expect(camaSemCorte.destino).toBe("FRENTE");

    const camaComFebre = executarTriagemSalaoF3(
      triagemBase({ recurso: "CAMA", tempDecimos: { ...triagemBase().tempDecimos, valor: 382 } }),
      contextoBase(),
      SALAO_RS,
    );
    expect(camaComFebre.destino).toBe("FILA_MEDICO");

    const fila = organizarFilaSalaoF3([
      { patientId: "pt-ecog3-cadeira", ecog: 3, recurso: "CADEIRA", idadeAnos: 65, chegadaEm: "2026-10-18T09:00:00Z" },
      { patientId: "pt-ecog4-amb", ecog: 4, recurso: "AMBULATORIAL", idadeAnos: 55, chegadaEm: "2026-10-18T10:00:00Z", emergencia: true },
      { patientId: "pt-cama-ecog2", ecog: 2, recurso: "CAMA", idadeAnos: 60, chegadaEm: "2026-10-18T08:30:00Z" },
      { patientId: "pt-idoso-82", ecog: 1, recurso: "AMBULATORIAL", idadeAnos: 82, chegadaEm: "2026-10-18T08:00:00Z" },
    ], SALAO_RS);

    expect(fila.filaOrdenada.map((f) => f.patientId)).toEqual([
      "pt-ecog4-amb",
      "pt-ecog3-cadeira",
      "pt-cama-ecog2",
      "pt-idoso-82",
    ]);
    expect(fila.escalonamentoE1Ids).toEqual(["pt-ecog4-amb"]);

    // Eventos operacionais do salão: alergia para na hora; vômito difícil pausa e aguarda
    const evAlergia = registrarInterrupcaoSalaoF3(db, acesso, {
      patientId: "pt-salao-1",
      encounterId: "enc-salao-1",
      cicloId: "ciclo-2",
      tipo: "ALERGIA_INFUSIONAL",
      descricaoClinica: "Rush cutâneo e dispneia aos 10 minutos da infusão de paclitaxel.",
    });
    expect(evAlergia).toMatchObject({
      ok: true,
      evento: {
        acaoImediata: "PARAR_INFUSAO_NA_HORA",
        infusaoSuspensa: true,
        exigeAvaliacaoMedica: true,
        notificarSetorChat: "TRIAGEM",
      },
    });

    const evVomito = registrarInterrupcaoSalaoF3(db, acesso, {
      patientId: "pt-salao-2",
      encounterId: "enc-salao-2",
      cicloId: "ciclo-1",
      tipo: "VOMITO_DIFICIL",
      descricaoClinica: "Vômito de difícil controle durante pré-medicação.",
    });
    expect(evVomito).toMatchObject({
      ok: true,
      evento: {
        acaoImediata: "PAUSAR_E_AGUARDAR_ESTABILIZACAO",
        infusaoSuspensa: true,
      },
    });

    // C4: perda de exatamente 5,0 kg em 60 dias passa (VERDE)
    const c4Peso = registrarDesfechoPesoSalaoF3(db, acesso, {
      patientId: "pt-c4",
      encounterId: "enc-c4",
      hoje: HOJE,
      ruleset: SALAO_RS,
      pesagens: [
        { data: "2026-09-01", kg: 70.0, origem: "MEDIDO" },
        { data: HOJE, kg: 65.0, origem: "MEDIDO" },
      ],
    });
    expect(c4Peso).toMatchObject({
      ok: true,
      desfecho: {
        estadoPeso: "VERDE",
        perdaKg: 5.0,
        tarefaNutricaoCriada: false,
        qtAdiada: false,
        passaEmConsultaMedica: true,
      },
    });

    // C5: perda de 5,1 kg em 60 dias (medidas) -> VERMELHO + tarefa nutrição + QT adiada + consulta médica mantida
    const c5Peso = registrarDesfechoPesoSalaoF3(db, acesso, {
      patientId: "pt-c5",
      encounterId: "enc-c5",
      hoje: HOJE,
      ruleset: SALAO_RS,
      pesagens: [
        { data: "2026-09-01", kg: 70.0, origem: "MEDIDO" },
        { data: HOJE, kg: 64.9, origem: "MEDIDO" },
      ],
    });
    expect(c5Peso).toMatchObject({
      ok: true,
      desfecho: {
        estadoPeso: "VERMELHO",
        tarefaNutricaoCriada: true,
        qtAdiada: true,
        passaEmConsultaMedica: true,
      },
    });

    // A2: peso informado × medido divergente (> 5 kg) -> PENDENTE (diferença incerta, nunca dispara vermelho sozinho)
    const pesoInformadoDivergente = registrarDesfechoPesoSalaoF3(db, acesso, {
      patientId: "pt-a2",
      encounterId: "enc-a2",
      hoje: HOJE,
      ruleset: SALAO_RS,
      pesagens: [
        { data: "2026-09-01", kg: 72.0, origem: "MEDIDO" },
        { data: HOJE, kg: 64.0, origem: "INFORMADO_PACIENTE" },
      ],
    });
    expect(pesoInformadoDivergente).toMatchObject({
      ok: true,
      desfecho: {
        estadoPeso: "PENDENTE",
        tarefaNutricaoCriada: false,
        qtAdiada: false,
        passaEmConsultaMedica: true,
      },
    });

    // Liberação com corte exige justificativa e registra autor da sessão
    expect(registrarLiberacaoComCorteSalaoF3(db, acesso, {
      patientId: "pt-c2",
      encounterId: "enc-c2",
      triagemDraftId: "draft-t-1",
      triagemRevision: 0,
      motivoJustificado: "   ",
    })).toEqual({ ok: false, codigo: "MOTIVO_OBRIGATORIO" });

    const libOk = registrarLiberacaoComCorteSalaoF3(db, acesso, {
      patientId: "pt-c2",
      encounterId: "enc-c2",
      triagemDraftId: "draft-t-1",
      triagemRevision: 0,
      motivoJustificado: "PAS reavaliada em repouso no consultório (145/85 mmHg); liberado pelo oncologista.",
    });
    expect(libOk).toMatchObject({
      ok: true,
      replay: false,
      liberacao: {
        autorMedicoId: "medico-f3-salao",
        autorCrm: "CRM-PB-SINTETICO",
      },
    });
  });

  it("S-F3-03 & C6 · cálculo de dose Mosteller, redução -20/-30/-40% sobre dose ADMINISTRADA anterior, ciclo 1 peso informado, 2º ciclo sem peso VERMELHO, AC ciclo 3 e cumulativos só do administrado efetivo", () => {
    const { db } = ledger();
    const acesso = sessao();
    const triagemLimpa = executarTriagemSalaoF3(triagemBase(), contextoBase({ hoje: "2026-10-05" }), SALAO_RS);
    const triagemComCorte = executarTriagemSalaoF3(
      triagemBase({ pas: { ...triagemBase().pas, valor: 165 } }),
      contextoBase({ hoje: "2026-10-05" }),
      SALAO_RS,
    );

    // Base = dose EFETIVAMENTE ADMINISTRADA no ciclo anterior (280 mg), nunca a planejada (350 mg)
    // Redução de 20% sobre 280 mg = 224 mg; BSA Mosteller de 72 kg e 180 cm = sqrt(72*180/3600) = 1,90 m²
    // AC ciclo 3 sem corte e sem pendência -> podeSaltarMedicoCiclo3Ac = true
    const avCiclo3Limpo = avaliarDoseECicloSalao({
      patientId: "pt-dose-1",
      encounterId: "enc-dose-3",
      episodioId: "ep-ac-1",
      esquemaId: "AC",
      numeroCiclo: 3,
      pesoMedidoKg: 72,
      alturaCm: 180,
      ciclosSemPesoAnteriores: 0,
      dosePlanejadaProtocoloMg: 350,
      dosePrescritaAssinadaMg: 350,
      doseAdministradaCicloAnteriorMg: 280,
      reducaoPct: 20,
      resultadoTriagem: triagemLimpa,
      doseRuleset: DOSE_RS,
    });
    expect(avCiclo3Limpo).toMatchObject({
      bsaMostellerM2: 1.9,
      dosePlanejadaProtocoloMg: 350,
      dosePrescritaAssinadaMg: 350,
      doseAdministradaCicloAnteriorMg: 280,
      doseCalculadaPropostaMg: 224,
      estadoDose: "VERDE",
      exigeConsultaMedicaNoCiclo: false,
      podeSaltarMedicoCiclo3Ac: true,
      prescricaoAssinadaInalterada: true,
    });

    // AC ciclo 3 COM corte -> NÃO salta o médico
    const avCiclo3ComCorte = avaliarDoseECicloSalao({
      patientId: "pt-dose-1",
      encounterId: "enc-dose-3",
      episodioId: "ep-ac-1",
      esquemaId: "AC",
      numeroCiclo: 3,
      pesoMedidoKg: 72,
      alturaCm: 180,
      ciclosSemPesoAnteriores: 0,
      dosePlanejadaProtocoloMg: 350,
      dosePrescritaAssinadaMg: 350,
      doseAdministradaCicloAnteriorMg: 280,
      reducaoPct: 0,
      resultadoTriagem: triagemComCorte,
      doseRuleset: DOSE_RS,
    });
    expect(avCiclo3ComCorte.exigeConsultaMedicaNoCiclo).toBe(true);
    expect(avCiclo3ComCorte.podeSaltarMedicoCiclo3Ac).toBe(false);

    // C6: 1º ciclo seguido sem peso -> usa dose anterior com origemPeso = ANTERIOR (PENDENTE); 2º ciclo seguido sem peso -> VERMELHO
    const semPeso1 = avaliarDoseECicloSalao({
      patientId: "pt-dose-1",
      encounterId: "enc-dose-2",
      episodioId: "ep-ac-1",
      esquemaId: "AC",
      numeroCiclo: 2,
      pesoMedidoKg: null,
      alturaCm: 170,
      ciclosSemPesoAnteriores: 0,
      dosePlanejadaProtocoloMg: 300,
      dosePrescritaAssinadaMg: 300,
      doseAdministradaCicloAnteriorMg: 300,
      reducaoPct: 0,
      resultadoTriagem: triagemLimpa,
      doseRuleset: DOSE_RS,
    });
    expect(semPeso1).toMatchObject({
      origemPeso: "ANTERIOR",
      doseCalculadaPropostaMg: 300,
      estadoDose: "PENDENTE",
      ciclosSemPesoConsecutivos: 1,
    });

    const semPeso2 = avaliarDoseECicloSalao({
      patientId: "pt-dose-1",
      encounterId: "enc-dose-3",
      episodioId: "ep-ac-1",
      esquemaId: "AC",
      numeroCiclo: 3,
      pesoMedidoKg: null,
      alturaCm: 170,
      ciclosSemPesoAnteriores: 1,
      dosePlanejadaProtocoloMg: 300,
      dosePrescritaAssinadaMg: 300,
      doseAdministradaCicloAnteriorMg: 300,
      reducaoPct: 0,
      resultadoTriagem: triagemLimpa,
      doseRuleset: DOSE_RS,
    });
    expect(semPeso2).toMatchObject({
      estadoDose: "VERMELHO",
      ciclosSemPesoConsecutivos: 2,
    });

    // Cumulativos: só entra o que foi efetivamente administrado (OMITIDA = 0, PARCIAL = quantidadeEfetivaMg)
    const fonte = fonteSintetica("fonte-adm-f3");
    // A administração agora usa o duto canônico: prescrição realmente assinada e ciclo confirmado.
    function prepararContexto(n:number) {
      const contexto={patientId:'pt-dose-1',encounterId:`enc-dose-${n}`,tumorLotId:'lot-1'};
      acesso.sessoes.selecionarConsulta(acesso.token,contexto);
      const sessaoMedica=acesso.sessoes.obter(acesso.token)!;
      const doc={documentId:`rx-${n}`,documentVersion:1,tipoDocumento:'PRESCRICAO_QT',texto:'Prescrição sintética F3'};
      for(const [tipo,payload] of [['DOCUMENTO',{data:doc,signature:{documentId:doc.documentId,documentVersion:1,documentHash:hashCanonico(doc),reviewDecisionId:`rev-f3-${n}-DOCUMENTO`,serverActorId:sessaoMedica.medicoId}}],
        ['Ciclo',{cicloId:`ciclo-${n}`,episodioId:'ep-ac-1',numero:n,previstoEm:HOJE,pesoKg:{valor:70,estado:"VERDE",campo:"PRESENTE",motivo:"medida sintética",fontes:[fonte],revisao:"CONFIRMADO"},origemPeso:'MEDIDO',ciclosSemPesoConsecutivos:0,prescricaoRef:{documentId:doc.documentId,documentVersion:1},itens:[{item:1,droga:'doxorrubicina',doseMg:100,reducaoPct:0}],comMedico:true}]] as const){
        const id=`seed-f3-${n}-${tipo}`;
        salvarDraft(db,{draftId:id,patientId:contexto.patientId,sourceId:id,rawRef:id,payload:{contexto},diagnostics:[],revision:0,criadoEm:AGORA});
        expect(executarConfirmacao(db,{...contexto,operationId:id,reviewDecisionId:`rev-f3-${n}-${tipo}`,sessao:sessaoMedica,em:AGORA,
          registros:[{draftId:id,expectedRevision:0,eventId:id,tipo,payload,fontes:[fonte],revisao:tipo==='DOCUMENTO'?'ASSINADO':'CONFIRMADO'}]}).estado).toBe('GRAVADA');
      }
    }
    prepararContexto(1);
    const rAdm1 = registrarAdministracaoEfetivaSalaoF3(db, acesso, {
      patientId: "pt-dose-1",
      encounterId: "enc-dose-1",
      tumorLotId: "lot-1",
      prescricaoAssinadaRef: { documentId: "rx-1", documentVersion: 1 },
      fonte,
      administracao: {
        adminId: "adm-c1-doxo",
        cicloId: "ciclo-1",
        prescricaoRef: { documentId: "rx-1", documentVersion: 1 },
        item: 1,
        droga: "doxorrubicina",
        quantidadeEfetivaMg: 100,
        status: "COMPLETA",
        motivo: null,
        inicio: "2026-10-18T08:00:00.000Z",
        fim: "2026-10-18T09:00:00.000Z",
        fonte,
      },
    });
    prepararContexto(2);
    const rAdm2 = registrarAdministracaoEfetivaSalaoF3(db, acesso, {
      patientId: "pt-dose-1",
      encounterId: "enc-dose-2",
      tumorLotId: "lot-1",
      prescricaoAssinadaRef: { documentId: "rx-2", documentVersion: 1 },
      fonte,
      administracao: {
        adminId: "adm-c2-doxo-parcial",
        cicloId: "ciclo-2",
        prescricaoRef: { documentId: "rx-2", documentVersion: 1 },
        item: 1,
        droga: "doxorrubicina",
        quantidadeEfetivaMg: 60,
        status: "PARCIAL",
        motivo: "Interrupção parcial por reação leve",
        inicio: "2026-10-18T09:10:00.000Z",
        fim: "2026-10-18T09:40:00.000Z",
        fonte,
      },
    });
    prepararContexto(3);
    const rAdm3 = registrarAdministracaoEfetivaSalaoF3(db, acesso, {
      patientId: "pt-dose-1",
      encounterId: "enc-dose-3",
      tumorLotId: "lot-1",
      prescricaoAssinadaRef: { documentId: "rx-3", documentVersion: 1 },
      fonte,
      administracao: {
        adminId: "adm-c3-doxo-omitida",
        cicloId: "ciclo-3",
        prescricaoRef: { documentId: "rx-3", documentVersion: 1 },
        item: 1,
        droga: "doxorrubicina",
        quantidadeEfetivaMg: 0,
        status: "OMITIDA",
        motivo: "Adiada por neutropenia",
        inicio: null,
        fim: null,
        fonte,
      },
    });
    expect(rAdm1.ok && rAdm2.ok && rAdm3.ok).toBe(true);

    const adms = listarAdministracoesEfetivasSalaoF3(db, "pt-dose-1");
    const cum = calcularCumulativosEfetivosSalao(adms);
    expect(cum).toEqual([
      {
        droga: "doxorrubicina",
        quantidadeEfetivaTotalMg: 160, // 100 + 60 + 0
        adminIds: ["adm-c1-doxo", "adm-c2-doxo-parcial"],
        conflitoAdminIds: [],
        incluiApenasAdministracaoEfetiva: true,
      },
    ]);
  });

  it("S-F3-04 & C8–C14 · gates transversais C8–C14, folha de contingência impressa (com bloqueio G-06 sem destaque E1), UI real (TelaSalao + CalculadoraDose) e reabertura SQLite", async () => {
    const { db, caminho } = ledger();
    const acesso = sessao();

    // C8: biópsia incisional -> pT rejeitado (BLOQUEIA_ARTEFATO), só cT passa
    expect(g09PtDeBiopsia({ prefixo: "p", tnmExplicito: true, specimen: "INCISIONAL_BIOPSY" }).decisao).toBe("BLOQUEIA_ARTEFATO");
    expect(g09PtDeBiopsia({ prefixo: "c", tnmExplicito: true, specimen: "INCISIONAL_BIOPSY" }).decisao).toBe("PASSA");

    // C9: peça cirúrgica sem TNM explícito / sem margem -> PENDENTE
    expect(g09PtDeBiopsia({ prefixo: "p", tnmExplicito: false, specimen: "SURGICAL_RESECTION" }).decisao).toBe("PENDENTE");

    // C10: lateralidade divergente entre fontes -> ALERTA (WARN), tela segue sem bloquear
    expect(g07Lateralidade({ orgao: "mama", path: "DIREITO", rads: "ESQUERDO", procedimento: "DIREITO", diagnostico: "DIREITO" }).decisao).toBe("ALERTA");

    // C11: lista de medicamentos incompleta -> PENDENTE, nunca VERDE
    const c11 = semaforoInteracoes(
      { medicamentos: ["capecitabina"], checagemCompleta: false },
      { header: DOSE_RS.header, interacoes: [] },
    );
    expect(c11.estado).toBe("PENDENTE");

    // C12: folha operacional com emergência E1 ativa sem destaque E1 -> BLOQUEADO só o documento (G-06); com destaque E1 -> gera HTML imprimível
    expect(gerarFolhaContingenciaSalaoF3(db, acesso, {
      patientId: "pt-e1",
      nomePaciente: "Paciente Sintetico E1",
      encounterId: "enc-e1",
      dataImpressao: HOJE,
      destino: "FILA_MEDICO",
      emergenciaAtiva: true,
      alertasOperacionaisE1: [],
      resumoTriagem: { pas: "85 mmHg", temp: "38,5 °C", anc: "800 /µL" },
    })).toEqual({ ok: false, codigo: "G-06_E1_DESTAQUE_AUSENTE" });

    const folhaOk = gerarFolhaContingenciaSalaoF3(db, acesso, {
      folhaId: "folha-contingencia-e1-1",
      patientId: "pt-e1",
      nomePaciente: "Paciente Sintetico E1",
      encounterId: "enc-e1",
      dataImpressao: HOJE,
      destino: "FILA_MEDICO",
      emergenciaAtiva: true,
      alertasOperacionaisE1: ["E1: Febre 38,5 °C + ANC 800 /µL — avaliação médica imediata"],
      resumoTriagem: { pas: "85 mmHg", temp: "38,5 °C", anc: "800 /µL" },
    });
    expect(folhaOk.ok).toBe(true);
    if (!folhaOk.ok) return;
    expect(folhaOk.folha.htmlImprimivel).toContain("E1 — EMERGÊNCIA ATIVA");
    expect(folhaOk.folha.evolucaoClinicaContemAlerta).toBe(false);

    // C13: CID SISREG genérico (C80) em APAC -> antiglosa reprova (VERMELHO / BLOQUEIA_EMISSAO)
    const vereditoC13 = antiglosa(
      {
        apacId: "apac-c13",
        tumorLotId: "lot-c13",
        prescricaoAssinadaRef: { documentId: "rx-c13", documentVersion: 1 },
        dataGeracaoApp: HOJE,
        competencia: "2026-10",
        campos: { cidPrincipal: "C80", procedimentoPrincipal: "0304020010", finalidade: "PALIATIVA", cnes: "2605473" },
        estado: "RASCUNHO",
        resultadoExterno: null,
        versao: 1,
        substituiApacId: null,
      },
      { hoje: HOJE, sigtap: {}, caixas: [], cnesConfigurado: "2605473", apacsDoLote: [] },
    );
    expect(vereditoC13.exportavel).toBe(false);
    expect(vereditoC13.achados.some((a) => a.severidade === "BLOQUEIA_EXPORTACAO")).toBe(true);

    // C14: intenção como letra "B" é rejeitada por G-13; termo "ADJUVANTE" passa
    expect(g13Letra("B").decisao).toBe("BLOQUEIA_ARTEFATO");
    expect(g13Letra("ADJUVANTE").decisao).toBe("PASSA");

    // Demonstração na UI real: TelaSalao + CalculadoraDose
    const porta = criarPortaFalsa();
    render(<TelaSalao porta={porta} />);
    await screen.findByLabelText("Salão");
    expect(screen.getByLabelText("FRENTE")).toBeTruthy();
    expect(screen.getByLabelText("FILA DO MÉDICO")).toBeTruthy();
    expect(screen.getByLabelText("SALÃO")).toBeTruthy();

    render(
      <CalculadoraDose
        ruleset={DOSE_RS}
        base={{
          doseAdministradaAnteriorMg: 200,
          pesoKg: 70,
          origemPeso: "MEDIDO",
          ciclosSemPesoAnteriores: 0,
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "−20" }));
    expect(screen.getByLabelText("Calculadora de dose").textContent).toContain("Dose: 160 mg");

    // Fecha e reabre o SQLite: eventos de interrupção e folha de contingência permanecem íntegros
    registrarInterrupcaoSalaoF3(db, acesso, {
      eventoSalaoId: "ev-persist-1",
      patientId: "pt-e1",
      encounterId: "enc-e1",
      tipo: "ALERGIA_INFUSIONAL",
      descricaoClinica: "Reação infusional registrada antes do reinício.",
    });
    db.close();

    const dbReaberto = reabrir(caminho);
    expect(listarFolhasContingenciaSalaoF3(dbReaberto, "pt-e1")).toHaveLength(1);
    expect(listarInterrupcoesSalaoF3(dbReaberto, "pt-e1")).toEqual([
      expect.objectContaining({
        eventoSalaoId: "ev-persist-1",
        acaoImediata: "PARAR_INFUSAO_NA_HORA",
      }),
    ]);
  });
});
