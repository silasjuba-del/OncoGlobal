import { afterEach, describe, expect, it } from "vitest";
// proveniência: dados sintéticos - não utilizar em produção
import { lerDraft, salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { listarEventos } from "../../src/kernel/ledger/ledger.js";
import {
  PACIENTE, abrirAmbiente, cadastrarPaciente, carregarConsulta, criarDiretorio,
  finalizarFlash, removerDiretorio,
} from "../f0-fecha/fixtures/consulta-completa.js";

const dirs: string[] = [];
const ambientes: Array<Awaited<ReturnType<typeof abrirAmbiente>>> = [];
afterEach(async () => {
  for (const a of ambientes.splice(0)) await a.close();
  for (const d of dirs.splice(0)) removerDiretorio(d);
});

describe("Flash: negativa de assinatura é auditada de forma durável, sem efeito clínico", () => {
  it("revisão divergente -> NEGADA, zero evento novo e audit_event NEGADA preservado após rollback", async () => {
    const dir = criarDiretorio(); dirs.push(dir);
    const ambiente = await abrirAmbiente(dir); ambientes.push(ambiente);
    cadastrarPaciente(ambiente);
    await carregarConsulta(ambiente);
    const { context, preparada } = await finalizarFlash(ambiente, "negativa-flash-sintetica");
    expect(preparada.status).toBe(200);
    const exibicao = await ambiente.request<Record<string, unknown>>("/consulta/bundle", context);
    expect(exibicao.status).toBe(200);
    // Outra aba salva o mesmo draft: a revisão esperada pela assinatura fica velha.
    const primeiro = preparada.data.registros[0]!;
    const draft = lerDraft(ambiente.db, primeiro.id)!;
    salvarDraft(ambiente.db, { ...draft, revision: draft.revision + 1 });
    const eventosAntes = listarEventos(ambiente.db, PACIENTE).length;
    const confirmado = await ambiente.request<Record<string, unknown>>("/consulta/confirmar", {
      ...context, bloco: "TUDO", registros: preparada.data.registros,
      documentosExibidos: preparada.data.documentos.map((d: { documentId: string; documentVersion: number }) =>
        ({ documentId: d.documentId, documentVersion: d.documentVersion })),
      reconhecerAlertas: [], idempotencyKey: "negativa-flash-confirmar",
    });
    expect(confirmado.status).toBe(409);
    expect(confirmado.data.codigo).toBe("NEGADA");
    expect(listarEventos(ambiente.db, PACIENTE)).toHaveLength(eventosAntes);
    const auditoria = ambiente.db.prepare(
      "SELECT decisao, motivoCodigo FROM audit_event WHERE decisao='NEGADA'").all() as Array<{ decisao: string; motivoCodigo: string }>;
    expect(auditoria.length).toBeGreaterThanOrEqual(1);
    expect(auditoria.some(a => a.motivoCodigo === "EXPECTED_REVISION_CONFLICT")).toBe(true);
  });
});
