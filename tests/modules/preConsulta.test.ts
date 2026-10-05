import { describe, expect, it } from "vitest";
import { montarPreConsulta } from "../../src/modules/consulta/preConsulta.js";
import { diferencaDiasCivis } from "../../src/modules/tipos.js";
import type { Semaforo as SemaforoContrato } from "../../src/contracts/estados.js";
import type { Semaforo as SemaforoLocal } from "../../src/modules/tipos.js";
import { HOJE, PRAZOS_D85, entrada, snapshot } from "./fixtures.js";

type SemaforoIgual = [SemaforoContrato] extends [SemaforoLocal]
  ? [SemaforoLocal] extends [SemaforoContrato] ? true : never
  : never;
const semaforoIgual: SemaforoIgual = true;

describe("GRK-01 pré-consulta", () => {
  it("mantém o semáforo do contrato", () => {
    expect(semaforoIgual).toBe(true);
  });

  it("positivo: compara snapshots confirmados e mostra D85, ciclo e contato", () => {
    const pack = montarPreConsulta(entrada(
      snapshot({
        snapshotId: "snap-2",
        patientId: "pac-teste-01",
        fatos: [{ campo: "ecog", valor: "2", revisao: "CONFIRMADO" }],
        pendencias: [{ codigo: "tc", texto: "TC pedida sem laudo" }],
        tratamento: {
          episodioId: "ep-1", modalidade: "QT", esquemaId: "pack-teste", linha: 1, cicloNumero: 3, cicloId: "c3",
        },
        cumulativos: [{ droga: "droga-teste", totalMg: 120, fonteId: "src-1" }],
        contatos: [{ contatoId: "ct-1", canal: "WHATSAPP_SERVICO", resumo: "2 mensagens", em: "2026-10-04" }],
        apac: { apacId: "apac-1", dataGeracaoApp: "2026-07-12", estado: "EMITIDA", competencia: "2026-07" },
        decisoes: [{ id: "d1", texto: "seguir esquema", em: HOJE }],
      }),
      snapshot({
        snapshotId: "snap-1",
        patientId: "pac-teste-01",
        fatos: [{ campo: "ecog", valor: "1", revisao: "ASSINADO" }],
      }),
      {
        direcoes: [{ campo: "ecog", de: "1", para: "2", direcao: "PIOR", fonte: "pack-teste" }],
      },
    ));

    expect(pack.oQueMudou.estado).toBe("VERDE");
    expect(pack.oQueMudou.itens).toEqual([
      { campo: "ecog", kind: "MUDOU", antes: "1", depois: "2", direcao: "PIOR" },
    ]);
    expect(pack.pendencias.itens).toHaveLength(1);
    expect(pack.tratamentoCiclo.itens[0]?.cicloNumero).toBe(3);
    expect(pack.cumulativos.itens[0]?.totalMg).toBe(120);
    expect(pack.contatosCanal.itens[0]?.contatoId).toBe("ct-1");
    expect(pack.apac.estado).toBe("VERMELHO");
    expect(pack.apac.itens[0]).toMatchObject({ diasDesdeGeracao: 85, aviso: true, vencida: false });
    expect(pack.decisoesDoDia.itens).toHaveLength(1);
  });

  it("negativo: sem snapshot anterior e sem seções, tudo que falta fica PENDENTE e vazio", () => {
    const pack = montarPreConsulta(entrada(
      snapshot({ snapshotId: "snap-1", patientId: "pac-teste-01" }),
      null,
      { prazosApac: null },
    ));
    expect(pack.oQueMudou).toMatchObject({ estado: "PENDENTE", itens: [], motivo: "sem snapshot anterior confirmado" });
    expect(pack.pendencias.estado).toBe("PENDENTE");
    expect(pack.tratamentoCiclo.motivo).toBe("tratamento ausente");
    expect(pack.cumulativos.itens).toEqual([]);
    expect(pack.contatosCanal.estado).toBe("PENDENTE");
    expect(pack.apac.motivo).toBe("APAC ausente");
    expect(pack.decisoesDoDia.estado).toBe("PENDENTE");
    expect(JSON.stringify(pack)).not.toContain("droga-teste");
  });

  it("negativo: pacientes diferentes não são comparados", () => {
    const pack = montarPreConsulta(entrada(
      snapshot({
        snapshotId: "a", patientId: "pac-teste-01",
        fatos: [{ campo: "ecog", valor: "1", revisao: "CONFIRMADO" }],
      }),
      snapshot({
        snapshotId: "b", patientId: "pac-teste-02",
        fatos: [{ campo: "ecog", valor: "3", revisao: "CONFIRMADO" }],
      }),
    ));
    expect(pack.oQueMudou.estado).toBe("PENDENTE");
    expect(pack.oQueMudou.itens).toEqual([]);
    expect(pack.oQueMudou.motivo).toContain("pacientes distintos");
  });

  it("borda: lista vazia é dado presente; null é ausência; decisão de outro dia fica de fora", () => {
    const pack = montarPreConsulta(entrada(
      snapshot({
        snapshotId: "snap-2",
        patientId: "pac-teste-01",
        fatos: [{ campo: "hb", valor: "12", revisao: "CONFIRMADO" }],
        pendencias: [],
        cumulativos: [],
        contatos: [],
        decisoes: [{ id: "d0", texto: "ontem", em: "2026-10-04" }],
      }),
      snapshot({
        snapshotId: "snap-1",
        patientId: "pac-teste-01",
        fatos: [{ campo: "hb", valor: "12", revisao: "CONFIRMADO" }],
      }),
    ));
    expect(pack.pendencias).toMatchObject({ estado: "VERDE", itens: [] });
    expect(pack.cumulativos.estado).toBe("VERDE");
    expect(pack.contatosCanal.estado).toBe("VERDE");
    expect(pack.oQueMudou.itens[0]?.kind).toBe("PERSISTE");
    expect(pack.oQueMudou.motivo).toContain("nenhuma mudança");
    expect(pack.decisoesDoDia.itens).toEqual([]);
  });

  it("borda: campo com dois valores confirmados não elege um deles", () => {
    const pack = montarPreConsulta(entrada(
      snapshot({
        snapshotId: "snap-2",
        patientId: "pac-teste-01",
        fatos: [
          { campo: "ecog", valor: "1", revisao: "CONFIRMADO" },
          { campo: "ecog", valor: "2", revisao: "ASSINADO" },
          { campo: "peso", valor: "70", revisao: "CONFIRMADO" },
        ],
      }),
      snapshot({
        snapshotId: "snap-1",
        patientId: "pac-teste-01",
        fatos: [{ campo: "peso", valor: "68", revisao: "CONFIRMADO" }],
      }),
    ));
    expect(pack.oQueMudou.estado).toBe("VERMELHO");
    expect(pack.oQueMudou.camposConflitantes).toEqual(["ecog"]);
    expect(pack.oQueMudou.itens.map((item) => item.campo)).toEqual(["peso"]);
    expect(pack.oQueMudou.itens[0]?.kind).toBe("MUDOU");
    expect(pack.oQueMudou.itens[0]?.direcao).toBeNull();
  });

  it("borda: direção sem fonte não é aplicada; regras discordantes também não", () => {
    const atual = snapshot({
      snapshotId: "snap-2", patientId: "pac-teste-01",
      fatos: [{ campo: "ecog", valor: "2", revisao: "CONFIRMADO" }],
    });
    const anterior = snapshot({
      snapshotId: "snap-1", patientId: "pac-teste-01",
      fatos: [{ campo: "ecog", valor: "1", revisao: "CONFIRMADO" }],
    });
    const semFonte = montarPreConsulta(entrada(atual, anterior, {
      direcoes: [{ campo: "ecog", de: "1", para: "2", direcao: "PIOR", fonte: "  " }],
    }));
    expect(semFonte.oQueMudou.itens[0]?.direcao).toBeNull();

    const conflito = montarPreConsulta(entrada(atual, anterior, {
      direcoes: [
        { campo: "ecog", de: "1", para: "2", direcao: "PIOR", fonte: "pack-a" },
        { campo: "ecog", de: "1", para: "2", direcao: "MELHOR", fonte: "pack-b" },
      ],
    }));
    expect(conflito.oQueMudou.itens[0]?.direcao).toBeNull();
  });

  it("borda D85: dia 84 segue, 85 avisa, 90 vence sem travar a consulta, prazo sem fonte fica PENDENTE", () => {
    expect(diferencaDiasCivis("2026-07-13", HOJE)).toBe(84);
    expect(diferencaDiasCivis("2026-07-12", HOJE)).toBe(85);
    expect(diferencaDiasCivis("2026-07-07", HOJE)).toBe(90);
    expect(diferencaDiasCivis("2024-02-28", "2024-03-01")).toBe(2);
    expect(diferencaDiasCivis("2025-02-28", "2025-03-01")).toBe(1);
    expect(diferencaDiasCivis("2025-02-29", HOJE)).toBeNull();

    const noDia = (data: string) => montarPreConsulta(entrada(
      snapshot({
        snapshotId: "s", patientId: "pac-teste-01",
        apac: { apacId: "apac-1", dataGeracaoApp: data, estado: "EMITIDA", competencia: null },
      }),
      null,
    )).apac;

    expect(noDia("2026-07-13").estado).toBe("VERDE");
    expect(noDia("2026-07-12").itens[0]).toMatchObject({ aviso: true, vencida: false });
    expect(noDia("2026-07-07").itens[0]).toMatchObject({ aviso: false, vencida: true });
    expect(noDia("2026-07-07").motivo).toContain("consulta segue");

    const semFonte = montarPreConsulta(entrada(
      snapshot({
        snapshotId: "s", patientId: "pac-teste-01",
        apac: { apacId: "apac-1", dataGeracaoApp: "2026-07-12", estado: "EMITIDA", competencia: null },
      }),
      null,
      { prazosApac: { avisoNoDia: 85, venceNoDia: 90, fonte: "" } },
    ));
    expect(semFonte.apac.estado).toBe("PENDENTE");
    expect(semFonte.apac.motivo).toContain("[VERIFICAR]");
    expect(semFonte.apac.itens).toEqual([]);
  });

  it("borda: NOVO e RESOLVEU saem da comparação, sem direção inventada", () => {
    const pack = montarPreConsulta(entrada(
      snapshot({
        snapshotId: "snap-2", patientId: "pac-teste-01",
        fatos: [{ campo: "sintoma", valor: "tosse", revisao: "CONFIRMADO" }],
      }),
      snapshot({
        snapshotId: "snap-1", patientId: "pac-teste-01",
        fatos: [{ campo: "queixa", valor: "dor", revisao: "CONFIRMADO" }],
      }),
    ));
    expect(pack.oQueMudou.itens).toEqual([
      { campo: "queixa", kind: "RESOLVEU", antes: "dor", depois: null, direcao: null },
      { campo: "sintoma", kind: "NOVO", antes: null, depois: "tosse", direcao: null },
    ]);
  });

  it("o valor literal CONFLITO não é tratado como colisão", () => {
    const pack = montarPreConsulta(entrada(
      snapshot({
        snapshotId: "snap-2", patientId: "pac-teste-01",
        fatos: [{ campo: "nota", valor: "CONFLITO", revisao: "CONFIRMADO" }],
      }),
      snapshot({
        snapshotId: "snap-1", patientId: "pac-teste-01",
        fatos: [{ campo: "nota", valor: "ok", revisao: "CONFIRMADO" }],
      }),
    ));
    expect(pack.oQueMudou.camposConflitantes).toEqual([]);
    expect(pack.oQueMudou.itens[0]).toMatchObject({ kind: "MUDOU", depois: "CONFLITO" });
  });

  it("prazos invertidos ficam PENDENTE", () => {
    const pack = montarPreConsulta(entrada(
      snapshot({
        snapshotId: "s", patientId: "pac-teste-01",
        apac: { apacId: "apac-1", dataGeracaoApp: "2026-07-12", estado: "EMITIDA", competencia: null },
      }),
      null,
      { prazosApac: { ...PRAZOS_D85, avisoNoDia: 90, venceNoDia: 85 } },
    ));
    expect(pack.apac.estado).toBe("PENDENTE");
    expect(pack.apac.motivo).toContain("[VERIFICAR]");
  });
});
