import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { MinutaLaudoAcessoJudicial } from "../../src/contracts/f4/acessoEJudicializacao.js";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { assinarMinutaLaudoAcessoJudicialF4, garantirSchemaF4, lerMinutaLaudoAcessoJudicialF4 } from "../../src/server/f4Acesso.js";
import { criarGerenciadorSessao } from "../../src/server/sessao.js";

const agora = "2026-10-19T12:00:00.000Z";
const pedido = { minutaId: "minuta-atomica-sintetica", versao: 1 };
const bancos: DatabaseSync[] = [];
const pastas: string[] = [];
function acesso(id: string, em = agora) {
  const sessoes = criarGerenciadorSessao({ medicoId: id, crm: `CRM-${id}`, senha: "senha-sintetica-atomica", duracaoMs: 300000, agora: () => em });
  return { sessoes, token: sessoes.login("senha-sintetica-atomica")!.token, agora: em };
}
function conectar(caminho: string) {
  const db = abrirLedger(caminho); bancos.push(db);
  db.exec("PRAGMA busy_timeout = 0");
  return db;
}
function ambiente() {
  const pasta = mkdtempSync(join(tmpdir(), "pr27-assinatura-atomica-")); pastas.push(pasta);
  const caminho = join(pasta, "ledger.sqlite");
  const a = conectar(caminho); garantirSchemaF4(a);
  const minuta = MinutaLaudoAcessoJudicial.parse({
    schema: "MinutaLaudoAcessoJudicial@1", ...pedido, patientId: "paciente-sintetico", encounterId: "encontro-sintetico", tumorLotId: "lote-sintetico",
    prescricaoAssinadaRef: { documentId: "prescricao-sintetica", documentVersion: 1 },
    medicamentoSolicitado: { nome: "Medicamento sintetico", posologiaPlanejada: "Descricao sintetica", duracaoPrevista: "Conforme registro sintetico" },
    separacaoEixosAcesso: { indicacaoClinicaMedica: "Indicacao sintetica documentada", registroRegulatorio: "NAO_VERIFICADO", coberturaPadrao: "NAO_VERIFICADO",
      disponibilidadeLocal: { estado: "DESCONHECIDO", origem: null, dataLeitura: null }, presumeDireitoIndividualAutomatico: false, presumeElegibilidadeAutomatica: false },
    citacoesVerificadas: [{ citacaoId: "fonte-sintetica", tipoFonte: "FATO_CLINICO_CONFIRMADO", referenciaId: "documento-sintetico", tituloOuDescricao: "Fonte sintetica",
      dataFonte: "2026-10-18", consultadoEm: "2026-10-19", trechoSustentador: "Trecho sintetico preservado", desfechosDocumentados: null }],
    afirmacoes: [{ afirmacaoId: "afirmacao-sintetica", secao: "JUSTIFICATIVA_CLINICA", texto: "Afirmacao sintetica", citacoesIds: ["fonte-sintetica"] }],
    textoMinutaConsolidado: "Minuta sintetica", contemAlertaOuCorrecaoIa: false, revisao: "REVISAR",
    assinadoPorMedicoId: null, assinadoPorCrm: null, assinadoEm: null, criadoEm: agora,
  });
  a.prepare("INSERT INTO f4_minuta_laudo_judicial VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
    minuta.minutaId, minuta.versao, minuta.patientId, minuta.encounterId, minuta.tumorLotId, minuta.revisao, JSON.stringify(minuta), agora);
  return { a, b: conectar(caminho), caminho, minuta };
}
afterEach(() => {
  vi.restoreAllMocks();
  for (const db of bancos.splice(0)) { try { db.close(); } catch { /* ja fechado */ } }
  for (const pasta of pastas.splice(0)) rmSync(pasta, { recursive: true, force: true });
});

it("leitura de assinatura ocorre sob BEGIN IMMEDIATE e exclui escritor de outra conexao", () => {
  const { a, b, caminho, minuta } = ambiente();
  const acessoA = acesso("medico-a"), acessoB = acesso("medico-b", "2026-10-19T12:00:01.000Z");
  const preparar = a.prepare.bind(a);
  const leiturasEmTransacao: boolean[] = [];
  let primeiraLeitura = true;
  const execucoes: string[] = [];
  const executar = a.exec.bind(a);
  vi.spyOn(a, "exec").mockImplementation(sql => { execucoes.push(sql); return executar(sql); });
  let assinaturaConcorrente: ReturnType<typeof assinarMinutaLaudoAcessoJudicialF4> | undefined;
  const spy = vi.spyOn(a, "prepare").mockImplementation(sql => {
    const stmt = preparar(sql);
    if (sql.includes("SELECT minutaJson FROM f4_minuta_laudo_judicial")) {
      const obter = stmt.get.bind(stmt);
      vi.spyOn(stmt, "get").mockImplementation((...args) => {
        const row = obter(...args);
        leiturasEmTransacao.push(a.isTransaction);
        if (primeiraLeitura) {
          primeiraLeitura = false;
          if (a.isTransaction) {
            // WAL permite leitores, mas o lock IMMEDIATE impede outro escritor.
            expect(() => b.exec("BEGIN IMMEDIATE")).toThrow(/locked|busy/i);
          } else {
            // Intercalacao deterministica que reproduz o bug antigo: B assina
            // depois do SELECT de A, antes de A atualizar a copia obsoleta.
            assinaturaConcorrente = assinarMinutaLaudoAcessoJudicialF4(b, acessoB, pedido);
          }
        }
        return row;
      });
    }
    return stmt;
  });
  const primeira = assinarMinutaLaudoAcessoJudicialF4(a, acessoA, pedido);
  spy.mockRestore();
  expect(leiturasEmTransacao.length).toBeGreaterThan(0);
  expect(leiturasEmTransacao.every(Boolean)).toBe(true); // RED na implementacao anterior.
  expect(execucoes).toContain("BEGIN IMMEDIATE");
  expect(assinaturaConcorrente).toBeUndefined();
  expect(primeira).toMatchObject({ ok: true, minutaAssinada: { revisao: "ASSINADO", assinadoPorMedicoId: "medico-a", assinadoPorCrm: "CRM-medico-a", assinadoEm: agora } });
  const replay = assinarMinutaLaudoAcessoJudicialF4(b, acessoB, pedido);
  expect(replay).toEqual(primeira);
  expect(primeira.ok && primeira.minutaAssinada).toEqual({ ...minuta, revisao: "ASSINADO", assinadoPorMedicoId: "medico-a", assinadoPorCrm: "CRM-medico-a", assinadoEm: agora });
  const row = b.prepare("SELECT minutaJson, atualizadoEm FROM f4_minuta_laudo_judicial").get() as { minutaJson: string; atualizadoEm: string };
  expect(row.atualizadoEm).toBe(agora);
  expect(primeira.ok && JSON.parse(row.minutaJson)).toEqual(primeira.ok && primeira.minutaAssinada);
  a.close(); b.close();
  expect(lerMinutaLaudoAcessoJudicialF4(conectar(caminho), pedido.minutaId)).toEqual(primeira.ok && primeira.minutaAssinada);
});

it("assinatura guardada exige REVISAR no UPDATE; replay nao tenta atualizar autoria", () => {
  const { a, b } = ambiente();
  const preparar = a.prepare.bind(a);
  const updates: string[] = [];
  vi.spyOn(a, "prepare").mockImplementation(sql => { if (/UPDATE f4_minuta_laudo_judicial/.test(sql)) updates.push(sql); return preparar(sql); });
  const primeira = assinarMinutaLaudoAcessoJudicialF4(a, acesso("medico-b"), pedido);
  expect(primeira.ok).toBe(true);
  expect(updates).toHaveLength(1);
  expect(updates[0]).toMatch(/AND revisao = 'REVISAR'/);
  b.exec("CREATE TRIGGER impedir_resignatura BEFORE UPDATE ON f4_minuta_laudo_judicial BEGIN SELECT RAISE(ABORT, 'assinatura imutavel'); END");
  expect(assinarMinutaLaudoAcessoJudicialF4(b, acesso("medico-a"), pedido)).toEqual(primeira);
});

it("G03 e sessao continuam obrigatorios, inclusive em replay de documento assinado", () => {
  const { a, b, minuta } = ambiente();
  const ac = acesso("medico-a");
  for (const tipo of ["AGENTE", "SISTEMA", "EXECUTOR", "SESSAO"] as const) {
    const forjado={...pedido,atorOverrideParaTesteAdversarial:{tipo,crm:'CRM-FORJADO'}};
    expect(assinarMinutaLaudoAcessoJudicialF4(a, ac, forjado)).toEqual({ ok: false, codigo: "G03_ASSINATURA_NEGADA" });
  }
  expect(lerMinutaLaudoAcessoJudicialF4(b, pedido.minutaId)).toEqual(minuta);
  expect(assinarMinutaLaudoAcessoJudicialF4(a, ac, { ...pedido, minutaId: "ausente" })).toEqual({ ok: false, codigo: "MINUTA_AUSENTE" });
  expect(assinarMinutaLaudoAcessoJudicialF4(a, ac, pedido).ok).toBe(true);
  expect(assinarMinutaLaudoAcessoJudicialF4(b, { ...ac, token: "invalido" }, pedido)).toEqual({ ok: false, codigo: "SESSAO_INVALIDA" });
  const replayForjado={...pedido,atorOverrideParaTesteAdversarial:{tipo:'AGENTE'}};
  expect(assinarMinutaLaudoAcessoJudicialF4(b, ac, replayForjado)).toEqual({ ok: false, codigo: "G03_ASSINATURA_NEGADA" });
});
