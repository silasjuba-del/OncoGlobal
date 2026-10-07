import { expect, it } from "vitest";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { autorizarSaida } from "../../src/server/autorizacao.js";
import { artefatoAssinado } from "./_artefatoAssinado.js";

const intent = (o: Partial<{ verbo: string; id: string; versao: number; patientId: string; encounterId: string; destino: string | null }> = {}) => ({
  verbo: (o.verbo ?? "IMPRIMIR") as "IMPRIMIR", objeto: { tipo: "DOCUMENTO", id: o.id ?? "doc-a", versao: o.versao ?? 1 },
  escopo: { patientId: o.patientId ?? "Paciente Teste 01", encounterId: o.encounterId ?? "e1" },
  destino: o.destino ?? null, idempotencyKey: "chave-cp001-teste",
});

it("CP-001 · positivo: artefato ASSINADO do mesmo paciente/encontro/versão autoriza IMPRIMIR", () => {
  const db = abrirLedger(":memory:");
  try {
    artefatoAssinado(db, { patientId: "Paciente Teste 01", encounterId: "e1", documentId: "doc-a" });
    expect(autorizarSaida(db, intent() as never)).toEqual({ ok: true });
  } finally { db.close(); }
});

it("CP-001 · negativos: ausente, outro paciente, outro encontro, outra versão, destino, canal, APAC", () => {
  const db = abrirLedger(":memory:");
  try {
    artefatoAssinado(db, { patientId: "Paciente Teste 01", encounterId: "e1", documentId: "doc-a" });
    const cod = (i: object) => { const r = autorizarSaida(db, i as never); return r.ok ? "OK" : r.codigo; };
    expect(cod(intent({ id: "doc-inexistente" }))).toBe("ARTEFATO_NAO_ASSINADO");
    expect(cod(intent({ patientId: "Paciente Teste 02" }))).toBe("ARTEFATO_NAO_ASSINADO");
    expect(cod(intent({ encounterId: "e2" }))).toBe("ARTEFATO_NAO_ASSINADO");
    expect(cod(intent({ versao: 2 }))).toBe("ARTEFATO_NAO_ASSINADO");
    expect(cod(intent({ destino: "impressora-externa" }))).toBe("DESTINO_NAO_PERMITIDO");
    expect(cod(intent({ verbo: "ENVIAR_WHATSAPP" }))).toBe("CANAL_EXTERNO_NAO_HABILITADO");
    expect(cod(intent({ verbo: "EXPORTAR_APAC" }))).toBe("VALIDACAO_APAC_NAO_PERSISTIDA");
  } finally { db.close(); }
});
