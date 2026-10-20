import { expect, it } from "vitest";
import type { SessaoProfissionalSetorF6 } from "../../src/contracts/f6/multiusuarioSetores.js";
import { consultarEstatisticaServicoF6, registrarAvisoMedicoSemPhiF6 } from "../../src/server/f6MultiusuarioSetores.js";
import { ambiente, EM } from "../bateria2/fixtures.js";

const sessao: SessaoProfissionalSetorF6 = { sessaoId: "sessao-sintetica-f6", profissionalId: "profissional-sintetico",
  papel: "MEDICO", setor: "MEDICO", registroConselho: "CRM-SINTETICO", territorio: "WORK",
  emitidaEm: EM, expiraEm: "2026-10-19T23:59:00Z" };

it("aviso exige operação específica e audita tentativas permitidas e negadas", () => {
  const a = ambiente();
  const entrada = { sessaoEmissora: sessao, urgencia: "EMERGENCIA_E1" as const,
    codigoEventoOpaco: "EMERGENCIA_E1_NO_SALAO" as const, identificadorInternoParaHashOpaco: "pt-f6-01:enc-f6-01",
    dicionarioVerificacaoPhi: { nomes: [], identificadores: [] }, agora: EM };
  try {
    expect(registrarAvisoMedicoSemPhiF6(a.db, entrada).ok).toBe(true);
    expect(registrarAvisoMedicoSemPhiF6(a.db, { ...entrada, sessaoEmissora: null })).toEqual({ ok: false, codigo: "SESSAO_AUSENTE_OU_INVALIDA" });
    const auditoria = a.db.prepare("SELECT decisao, motivoCodigo FROM audit_event WHERE acaoPedida = 'EMITIR_AVISO_MEDICO' ORDER BY auditId").all();
    expect(auditoria).toMatchObject([{ decisao: "PERMITIDA", motivoCodigo: "RBAC_PERMITIDA" },
      { decisao: "NEGADA", motivoCodigo: "SESSAO_AUSENTE_OU_INVALIDA" }]);
    expect(a.db.prepare("SELECT COUNT(*) AS n FROM f6_aviso_medico_sem_phi").get()!.n).toBe(1);
  } finally { a.db.close(); }
});

it("F6 não publica estatísticas enquanto isolamento persistente WORK/STUDY não é comprovado", () => {
  const a = ambiente();
  try {
    a.seed("FATO", { campo: "registro-sintetico", valor: "WORK", territorio: "WORK" });
    a.seed("FATO", { campo: "registro-sintetico", valor: "STUDY", territorio: "STUDY" });
    const resposta = consultarEstatisticaServicoF6(a.db, { sessao, agora: EM });
    expect(resposta).toEqual({ ok: false, codigo: "PENDENTE_ISOLAMENTO_WORK_STUDY" });
    expect("estatistica" in resposta).toBe(false);
    expect(a.db.prepare("SELECT COUNT(*) AS n FROM clinical_event").get()!.n).toBe(2);
  } finally { a.db.close(); }
});
