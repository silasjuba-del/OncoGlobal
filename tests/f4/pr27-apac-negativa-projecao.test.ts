import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, expect, it, vi } from "vitest";
import { Apac } from "../../src/contracts/operacao.js";
import { ApacResposta } from "../../src/contracts/api/respostas.js";
import { CAMPOS_OBRIGATORIOS_PADRAO } from "../../src/modules/apac/antiglosa.js";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { executarConfirmacao } from "../../src/kernel/comandos/index.js";
import { salvarDraft } from "../../src/kernel/comandos/portas.js";
import { registrarNegativaRetrogradaNoBancoF4 } from "../../src/server/f4Acesso.js";
import { lerApacs } from "../../src/server/leituras.js";
import { ambiente, ctx, EM } from "../bateria2/fixtures.js";

const NEGADA_EM = "2026-10-19T18:01:00.000Z";
const DEPOIS = "2026-10-19T18:02:00.000Z";
const config = { caixas: [], sigtap: {}, cnesConfigurado: "CNES-SINTETICO" };
const bancos: DatabaseSync[] = [], pastas: string[] = [];
function preparar() {
  const pasta = mkdtempSync(join(tmpdir(), "pr27-apac-projecao-")); pastas.push(pasta);
  const caminho = join(pasta, "ledger.sqlite"), a = ambiente(caminho); bancos.push(a.db);
  const ausente = () => ({ valor: null, estado: "PENDENTE", campo: "AUSENTE", motivo: "Nao consta", fontes: [], revisao: "RAW" });
  a.seed("Paciente", { patientId: ctx.patientId, nome: "Paciente Sintetico Projecao", identificadores: [], nascimento: null, sexoCadastral: "NAO_INFORMADO", divergencia: false });
  a.seed("TumorLot", { tumorLotId: ctx.tumorLotId, patientId: ctx.patientId, cid: ausente(), topografia: ausente(), histologia: ausente(), estadiamentos: [], finalidadeApac: ausente(), marcos: [] });
  const apac = Apac.parse({ apacId: "apac-projecao-sintetica", tumorLotId: ctx.tumorLotId,
    prescricaoAssinadaRef: { documentId: "prescricao-sintetica", documentVersion: 1 }, dataGeracaoApp: "2026-10-01", competencia: "2026-10",
    // Identificador inteiramente sintético, materializado somente na execução da fixture.
    campos: { cidPrincipal: "C509", pacienteCns: "1" + "23456789012345", procedimentoPrincipal: "PROC-SINTETICO-27" },
    estado: "RASCUNHO", resultadoExterno: null, versao: 1, substituiApacId: null });
  a.seed("APAC", apac);
  const acesso = { ...a.acesso, agora: NEGADA_EM };
  function negar(alteracoes: { patientId?: string; apacExistente?: Apac } = {}) {
    const r = registrarNegativaRetrogradaNoBancoF4(a.db, acesso, { patientId: ctx.patientId, apacExistente: apac,
      codigoNegativa: "ESTADIO_AUSENTE", motivoTexto: "Falta estadiamento no documento sintetico", comprovanteRef: "comprovante-negativa-sintetico", ...alteracoes });
    expect(r.ok).toBe(true); return r;
  }
  let seq = 0;
  function novaApac(valor: Apac, em = DEPOIS) {
    const id = `apac-posterior-${++seq}`;
    const draft = salvarDraft(a.db, { draftId: id, patientId: ctx.patientId, sourceId: id, rawRef: id, payload: {}, diagnostics: [], revision: 0, criadoEm: em });
    const r = executarConfirmacao(a.db, { ...ctx, operationId: id, reviewDecisionId: `review-${id}`, sessao: a.login.sessao, em,
      registros: [{ draftId: id, expectedRevision: draft.revision, eventId: id, tipo: "APAC", payload: valor, fontes: [], revisao: "CONFIRMADO" }] });
    expect(r.estado).toBe("GRAVADA");
  }
  return { ...a, caminho, apac, negar, novaApac };
}
afterEach(() => {
  vi.restoreAllMocks();
  for (const db of bancos.splice(0)) { try { db.close(); } catch { /* ja fechado */ } }
  for (const pasta of pastas.splice(0)) rmSync(pasta, { recursive: true, force: true });
});

it("negativa F4 projeta documento, motivo, comprovante e recebimento; contrato API e reabertura preservam metadata", () => {
  const a = preparar(), negativa = a.negar();
  const prepararSql = a.db.prepare.bind(a.db);
  let leiturasLedger = 0;
  const spy = vi.spyOn(a.db, "prepare").mockImplementation(sql => { if (sql === "SELECT * FROM clinical_event") leiturasLedger++; return prepararSql(sql); });
  const visao = lerApacs(a.db, DEPOIS, config);
  expect(leiturasLedger).toBe(1);
  spy.mockRestore();
  expect(visao.itens).toHaveLength(1);
  expect(visao.itens[0]).toMatchObject({ patientId: ctx.patientId, encounterId: ctx.encounterId, campoOrigem: "estadiamentos",
    motivoNegativa: "ESTADIO_AUSENTE: Falta estadiamento no documento sintetico",
    apac: { estado: "NEGADA", versao: 1, resultadoExterno: { valor: "NEGADA", comprovanteRef: "comprovante-negativa-sintetico", recebidoEm: NEGADA_EM } } });
  expect(ApacResposta.parse(visao).itens[0]?.apac).toEqual(negativa.ok && negativa.apacNegadaPreservada);
  const ledgerAntes = a.db.prepare("SELECT * FROM clinical_event").all();
  a.db.close(); const db = abrirLedger(a.caminho); bancos.push(db);
  expect(lerApacs(db, DEPOIS, config)).toEqual(visao);
  expect(db.prepare("SELECT * FROM clinical_event").all()).toEqual(ledgerAntes);
});

it.each(["patientId", "tumorLotId", "apacId", "versao", "prescricao", "campos", "competencia"])("decisao de contexto/conteudo divergente nao contamina projecao: %s", campo => {
  const a = preparar();
  if (campo === "patientId") a.negar({ patientId: "outro-paciente-sintetico" });
  else {
    const outra = { ...a.apac };
    if (campo === "tumorLotId") outra.tumorLotId = "outro-lote";
    if (campo === "apacId") outra.apacId = "outra-apac";
    if (campo === "versao") outra.versao = 2;
    if (campo === "prescricao") outra.prescricaoAssinadaRef = { documentId: "outra-prescricao", documentVersion: 2 };
    if (campo === "campos") outra.campos = { cidPrincipal: "C189" };
    if (campo === "competencia") outra.competencia = "2026-09";
    a.negar({ apacExistente: outra });
  }
  const item = lerApacs(a.db, DEPOIS, config).itens[0];
  expect(item).toMatchObject({ apac: { estado: "RASCUNHO", resultadoExterno: null }, campoOrigem: null, motivoNegativa: null });
});

it("negativa futura nao aparece antes do registro", () => {
  const a = preparar(); a.negar();
  expect(lerApacs(a.db, EM, config).itens[0]).toMatchObject({ apac: { estado: "RASCUNHO" }, campoOrigem: null, motivoNegativa: null });
});

it("versao posterior preserva negativa historica e nao recebe negativa antiga", () => {
  const a = preparar(); a.negar(); a.novaApac({ ...a.apac, versao: 2 });
  const itens = lerApacs(a.db, DEPOIS, config).itens;
  expect(itens.map(i => i.apac.estado)).toEqual(["NEGADA", "RASCUNHO"]);
  expect(itens[1]).toMatchObject({ apac: { versao: 2, resultadoExterno: null }, campoOrigem: null, motivoNegativa: null });
});

it("autorizacao posterior na mesma versao prevalece sem herdar pendencia da negativa historica", () => {
  const a = preparar(); a.negar();
  const autorizada: Apac = { ...a.apac, estado: "AUTORIZADA", resultadoExterno: { valor: "AUTORIZADA", motivo: null, comprovanteRef: "autorizacao-posterior", recebidoEm: DEPOIS } };
  a.novaApac(autorizada);
  const itens = lerApacs(a.db, DEPOIS, config).itens;
  expect(itens.map(i => i.apac.estado)).toEqual(["NEGADA", "AUTORIZADA"]);
  expect(itens[1]).toMatchObject({ apac: autorizada, campoOrigem: null, motivoNegativa: null });
});

it("nova gravacao ledger da mesma versao apos negativa nao e sobrescrita", () => {
  const a = preparar(); a.negar(); a.novaApac(a.apac);
  expect(lerApacs(a.db, DEPOIS, config).itens.map(i => i.apac.estado)).toEqual(["NEGADA", "RASCUNHO"]);
});

it("decisao externa recebida depois da negativa prevalece mesmo com data ledger anterior", () => {
  const a = preparar(); a.negar();
  a.novaApac({ ...a.apac, estado: "AUTORIZADA", resultadoExterno: { valor: "AUTORIZADA", motivo: null, comprovanteRef: "autorizacao-recente", recebidoEm: DEPOIS } }, "2026-10-19T18:00:30.000Z");
  expect(lerApacs(a.db, DEPOIS, config).itens.map(i => i.apac.estado)).toEqual(["NEGADA", "AUTORIZADA"]);
});

it("JSON F4 invalido nunca promove negativa nem vazamento de metadados", () => {
  const a = preparar(); a.negar();
  a.db.exec("DROP TRIGGER f4_apac_retrograda_no_update");
  a.db.prepare("UPDATE f4_apac_retrograda SET apacNegadaJson = ?").run('{"apacId":"outro-contexto"}');
  expect(lerApacs(a.db, DEPOIS, config).itens[0]).toMatchObject({ apac: { estado: "RASCUNHO" }, campoOrigem: null, motivoNegativa: null });
});

it("empate de recebimento nao substitui autorizacao por negativa F4", () => {
  const a = preparar(); a.negar();
  a.novaApac({ ...a.apac, estado: "AUTORIZADA", resultadoExterno: { valor: "AUTORIZADA", motivo: null,
    comprovanteRef: "autorizacao-mesmo-instante", recebidoEm: NEGADA_EM } }, NEGADA_EM);
  expect(lerApacs(a.db, DEPOIS, config).itens[1]).toMatchObject({ apac: { estado: "AUTORIZADA" }, campoOrigem: null, motivoNegativa: null });
});

it("AG-10 isola APACs por paciente e lote, mas mantém detecção de duplicata no mesmo lote", () => {
  const a = preparar();
  const ctxMesmoPacienteOutroLote = { ...ctx, tumorLotId: "lote-sintetico-a2" };
  const ctxOutraPessoa = { patientId: "paciente-sintetico-b", encounterId: "encontro-sintetico-b", tumorLotId: "lote-sintetico-b" };
  const ausente = { valor: null, estado: "PENDENTE", campo: "AUSENTE", motivo: "Nao consta", fontes: [], revisao: "RAW" };
  const lote = (patientId: string, tumorLotId: string) => ({ tumorLotId, patientId, cid: ausente,
    topografia: ausente, histologia: ausente, estadiamentos: [], finalidadeApac: ausente, marcos: [] });
  a.seed("TumorLot", lote(ctx.patientId, ctxMesmoPacienteOutroLote.tumorLotId), "CONFIRMADO", ctxMesmoPacienteOutroLote);
  a.seed("Paciente", { patientId: ctxOutraPessoa.patientId, nome: "Pessoa sintetica B", identificadores: [],
    nascimento: null, sexoCadastral: "NAO_INFORMADO", divergencia: false }, "CONFIRMADO", ctxOutraPessoa);
  a.seed("TumorLot", lote(ctxOutraPessoa.patientId, ctxOutraPessoa.tumorLotId), "CONFIRMADO", ctxOutraPessoa);
  a.seed("APAC", { ...a.apac, apacId: "apac-outra-pessoa-sintetica", tumorLotId: ctxOutraPessoa.tumorLotId },
    "CONFIRMADO", ctxOutraPessoa);
  a.seed("APAC", { ...a.apac, apacId: "apac-outro-lote-sintetico", tumorLotId: ctxMesmoPacienteOutroLote.tumorLotId },
    "CONFIRMADO", ctxMesmoPacienteOutroLote);

  const caixas = CAMPOS_OBRIGATORIOS_PADRAO.map((nome, i) => ({ numero: i + 1, chave: `apac.${nome}`, nome,
    significado: nome, ondeAparece: ["apac"], tipo: "TEXTO" as const, editavelPor: "MEDICO" as const }));
  const configComCaixas = { ...config, caixas };
  const antesDaDuplicata = lerApacs(a.db, DEPOIS, configComCaixas);
  const alvoAntes = antesDaDuplicata.itens.find(item => item.apac.apacId === a.apac.apacId);
  expect(alvoAntes?.patientId).toBe(ctx.patientId);
  expect(alvoAntes?.apac.tumorLotId).toBe(ctx.tumorLotId);
  expect(alvoAntes?.antiglosa).not.toBeNull();
  expect(alvoAntes?.antiglosa?.achados.some(achado => achado.regraId === "AG-10")).toBe(false);

  a.novaApac({ ...a.apac, apacId: "apac-duplicata-mesmo-lote-sintetica" });
  const depoisDaDuplicata = lerApacs(a.db, DEPOIS, configComCaixas);
  const alvoDepois = depoisDaDuplicata.itens.find(item => item.apac.apacId === a.apac.apacId);
  expect(alvoDepois?.antiglosa?.achados.some(achado => achado.regraId === "AG-10")).toBe(true);
});
