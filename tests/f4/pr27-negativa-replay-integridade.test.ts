import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, expect, it } from "vitest";
import { Apac } from "../../src/contracts/operacao.js";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { garantirSchemaF4, listarNegativasRetrogradasF4, registrarNegativaRetrogradaNoBancoF4 } from "../../src/server/f4Acesso.js";
import { criarGerenciadorSessao } from "../../src/server/sessao.js";

const EM = "2026-10-19T18:01:00.000Z", DEPOIS = "2026-10-19T18:02:00.000Z";
type Entrada = Parameters<typeof registrarNegativaRetrogradaNoBancoF4>[2];
const bancos: DatabaseSync[] = [], pastas: string[] = [];
function ambiente() {
  const pasta = mkdtempSync(join(tmpdir(), "pr27-negativa-replay-")); pastas.push(pasta);
  const caminho = join(pasta, "ledger.sqlite"), db = abrirLedger(caminho); bancos.push(db);
  const sessoes = criarGerenciadorSessao({ medicoId: "medico-sintetico", crm: "CRM-SINTETICO", senha: "senha-sintetica-integridade", duracaoMs: 3600000, agora: () => EM });
  const acesso = { sessoes, token: sessoes.login("senha-sintetica-integridade")!.token, agora: EM };
  const entrada: Entrada = { patientId: "paciente-sintetico", codigoNegativa: "ESTADIO_AUSENTE", motivoTexto: "Motivo externo sintetico", comprovanteRef: "comprovante-sintetico",
    apacExistente: Apac.parse({ apacId: "apac-sintetica", tumorLotId: "lote-sintetico", prescricaoAssinadaRef: { documentId: "prescricao-sintetica", documentVersion: 1 },
      dataGeracaoApp: "2026-10-01", competencia: "2026-10", campos: { cidPrincipal: "C509", quantidade: 1, fonte: { documento: "fonte-sintetica", versao: "1" } },
      estado: "RASCUNHO", resultadoExterno: null, versao: 1, substituiApacId: null }) };
  const ler = () => db.prepare("SELECT * FROM f4_apac_retrograda").all();
  return { db, caminho, acesso, entrada, ler };
}
afterEach(() => {
  for (const db of bancos.splice(0)) { try { db.close(); } catch { /* ja fechado */ } }
  for (const pasta of pastas.splice(0)) rmSync(pasta, { recursive: true, force: true });
});

it("replay completo tolera apenas novo horario de tentativa e ordem das chaves; mantem primeiro recebimento apos reabertura", () => {
  const a = ambiente();
  const primeiro = registrarNegativaRetrogradaNoBancoF4(a.db, a.acesso, a.entrada);
  expect(primeiro.ok).toBe(true);
  const antes = a.ler();
  const igual = structuredClone(a.entrada);
  igual.apacExistente.campos = { fonte: { versao: "1", documento: "fonte-sintetica" }, quantidade: 1, cidPrincipal: "C509" };
  a.db.close(); const db = abrirLedger(a.caminho); bancos.push(db);
  const replay = registrarNegativaRetrogradaNoBancoF4(db, { ...a.acesso, agora: DEPOIS }, igual);
  expect(replay).toEqual({ ...primeiro, replay: true });
  expect(db.prepare("SELECT * FROM f4_apac_retrograda").all()).toEqual(antes);
  expect(replay).toMatchObject({ apacNegadaPreservada: { resultadoExterno: { recebidoEm: EM } } });
  expect(primeiro.ok && listarNegativasRetrogradasF4(db, a.entrada.patientId)).toEqual(primeiro.ok && [{ apacNegadaPreservada: primeiro.apacNegadaPreservada, pendenciaRetrograda: primeiro.pendenciaRetrograda }]);
});

const divergencias: [string, (e: Entrada) => void][] = [
  ["paciente", e => { e.patientId = "outro-paciente"; }],
  ["lote", e => { e.apacExistente.tumorLotId = "outro-lote"; }],
  ["versao APAC", e => { e.apacExistente.versao = 2; }],
  ["prescricao fonte", e => { e.apacExistente.prescricaoAssinadaRef.documentId = "outra-fonte"; }],
  ["versao prescricao", e => { e.apacExistente.prescricaoAssinadaRef.documentVersion = 2; }],
  ["data geracao", e => { e.apacExistente.dataGeracaoApp = "2026-10-02"; }],
  ["competencia", e => { e.apacExistente.competencia = "2026-11"; }],
  ["substitui APAC", e => { e.apacExistente.substituiApacId = "anterior-sintetica"; }],
  ["conteudo clinico", e => { e.apacExistente.campos.cidPrincipal = "C189"; }],
  ["tipo campo numero vs texto", e => { e.apacExistente.campos.quantidade = "1"; }],
  ["campo aditivo", e => { e.apacExistente.campos.observacao = "Novo dado"; }],
  ["campo removido", e => { delete e.apacExistente.campos.quantidade; }],
  ["versao fonte no campo", e => { e.apacExistente.campos.fonte = { documento: "fonte-sintetica", versao: "2" }; }],
  ["estado de origem", e => { e.apacExistente.estado = "EMITIDA"; }],
  ["motivo", e => { e.motivoTexto = "Outro motivo"; }],
  ["codigo negativa", e => { e.codigoNegativa = "CID_AUSENTE"; }],
  ["comprovante", e => { e.comprovanteRef = "outro-comprovante"; }],
];
it.each(divergencias)("mesmo apacId com divergencia em %s retorna conflito e preserva original", (_, alterar) => {
  const a = ambiente(); expect(registrarNegativaRetrogradaNoBancoF4(a.db, a.acesso, a.entrada).ok).toBe(true);
  const antes = a.ler(), diferente = structuredClone(a.entrada); alterar(diferente);
  expect(registrarNegativaRetrogradaNoBancoF4(a.db, { ...a.acesso, agora: DEPOIS }, diferente)).toEqual({ ok: false, codigo: "CONFLITO_NEGATIVA_EXISTENTE" });
  expect(a.ler()).toEqual(antes);
});

it.each(["recebidoEm", "valor", "comprovanteRef", "motivo"] as const)("resultado externo da APAC de origem continua comparado integralmente: %s", campo => {
  const a = ambiente();
  a.entrada.apacExistente.resultadoExterno = { valor: "AUTORIZADA", recebidoEm: "2026-10-19T17:00:00.000Z", comprovanteRef: "fonte-externa-original", motivo: "Motivo anterior" };
  expect(registrarNegativaRetrogradaNoBancoF4(a.db, a.acesso, a.entrada).ok).toBe(true);
  const antes = a.ler(), diferente = structuredClone(a.entrada);
  const resultado = diferente.apacExistente.resultadoExterno!;
  if (campo === "recebidoEm") resultado.recebidoEm = "2026-10-19T17:30:00.000Z";
  if (campo === "valor") resultado.valor = "NEGADA";
  if (campo === "comprovanteRef") resultado.comprovanteRef = "outra-fonte-externa";
  if (campo === "motivo") resultado.motivo = "Outro motivo anterior";
  expect(registrarNegativaRetrogradaNoBancoF4(a.db, { ...a.acesso, agora: DEPOIS }, diferente)).toEqual({ ok: false, codigo: "CONFLITO_NEGATIVA_EXISTENTE" });
  expect(a.ler()).toEqual(antes);
});

it("resultado externo novo nao desaparece por ser sobrescrito na negativa gerada", () => {
  const a = ambiente(); expect(registrarNegativaRetrogradaNoBancoF4(a.db, a.acesso, a.entrada).ok).toBe(true);
  const antes = a.ler(), diferente = structuredClone(a.entrada);
  diferente.apacExistente.resultadoExterno = { valor: "NEGADA", recebidoEm: EM, motivo: "Nova evidencia", comprovanteRef: "novo-comprovante-externo" };
  expect(registrarNegativaRetrogradaNoBancoF4(a.db, a.acesso, diferente)).toEqual({ ok: false, codigo: "CONFLITO_NEGATIVA_EXISTENTE" });
  expect(a.ler()).toEqual(antes);
});

it("tipo invalido de versao nao e convertido em replay", () => {
  const a = ambiente(); expect(registrarNegativaRetrogradaNoBancoF4(a.db, a.acesso, a.entrada).ok).toBe(true);
  const antes = a.ler();
  const invalida = { ...a.entrada, apacExistente: { ...a.entrada.apacExistente, versao: "1" } } as unknown as Entrada;
  expect(registrarNegativaRetrogradaNoBancoF4(a.db, a.acesso, invalida)).toEqual({ ok: false, codigo: "NEGATIVA_INVALIDA" });
  expect(a.ler()).toEqual(antes);
});

it("legado sem prova da entrada original retorna conflito sem atualizar ou apagar historico", () => {
  const a = ambiente(); expect(registrarNegativaRetrogradaNoBancoF4(a.db, a.acesso, a.entrada).ok).toBe(true);
  const row = a.ler()[0]!;
  const { entradaNegativaSha256: _, ...pendenciaLegada } = JSON.parse(String(row.pendenciaJson));
  const db = abrirLedger(":memory:"); bancos.push(db); garantirSchemaF4(db);
  db.prepare("INSERT INTO f4_apac_retrograda VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(String(row.apacId), String(row.patientId), String(row.tumorLotId), String(row.comprovanteRef), String(row.codigoNegativa), row.campoOrigem!, String(row.apacNegadaJson), JSON.stringify(pendenciaLegada), String(row.registradoEm));
  const antes = db.prepare("SELECT * FROM f4_apac_retrograda").all();
  expect(registrarNegativaRetrogradaNoBancoF4(db, a.acesso, a.entrada)).toEqual({ ok: false, codigo: "CONFLITO_NEGATIVA_EXISTENTE" });
  expect(db.prepare("SELECT * FROM f4_apac_retrograda").all()).toEqual(antes);
  expect(listarNegativasRetrogradasF4(db, a.entrada.patientId)).toHaveLength(1);
});

it.each([undefined, Number.NaN, Number.POSITIVE_INFINITY])("campo nao serializavel %s nao colide com null em replay", valor => {
  const a = ambiente(); a.entrada.apacExistente.campos.quantidade = null;
  expect(registrarNegativaRetrogradaNoBancoF4(a.db, a.acesso, a.entrada).ok).toBe(true);
  const antes = a.ler(), invalida = structuredClone(a.entrada);
  invalida.apacExistente.campos.quantidade = valor;
  expect(registrarNegativaRetrogradaNoBancoF4(a.db, a.acesso, invalida)).toEqual({ ok: false, codigo: "NEGATIVA_INVALIDA" });
  expect(a.ler()).toEqual(antes);
});
