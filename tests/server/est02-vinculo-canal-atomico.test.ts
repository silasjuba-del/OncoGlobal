// EST-02 · vínculo operacional do canal: recusa do kernel não deixa rascunho órfão nem trava o retry.
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { receberTransporteSintetico } from "../../src/server/canalEntrada.js";
import {
  G2_CONTEXTO, G2_INSTANTE_BASE, abrirServidorHttpG2, semearPacienteELoteG2, sha256Independente,
} from "../fixtures/g2-integridade.js";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const TELEFONE = "+55-00-0000-0000"; // telefone sintético já declarado na varredura de PHI

describe("EST-02 · vínculo operacional do canal é atômico", () => {
  it("recusa do kernel é auditada sem rascunho órfão; retry com a mesma chave conclui", async () => {
    const srv = await abrirServidorHttpG2();
    try {
      semearPacienteELoteG2(srv.db, srv.sessao, srv.obterAgora(), G2_CONTEXTO);
      const texto = "Relato sintético para vínculo operacional EST-02.";
      expect(receberTransporteSintetico(srv.db, {
        accountId: "conta-est02", canal: "WHATSAPP_SERVICO", providerMessageId: "msg-est02-01", senderRef: TELEFONE,
        providerSentAt: G2_INSTANTE_BASE, ingestedAt: G2_INSTANTE_BASE,
        conteudo: { tipo: "TEXT", texto, contentSha256: sha256Independente(texto) }, cadastros: [],
      }).ok).toBe(true);
      srv.sessoes.selecionarConsulta(srv.token, { ...G2_CONTEXTO });

      const chave = "key-est02-vinculo-1";
      const operationId = `canal-operacional-link-${chave}`;
      const draftId = `canal-link-${sha(operationId)}`;
      // Operação divergente pré-existente com a mesma identidade força OPERATION_HASH_CONFLICT no kernel.
      srv.db.prepare("INSERT INTO operation (operationId,payloadHash,resultRef,criadoEm) VALUES (?,?,?,?)")
        .run(operationId, "f".repeat(64), null, srv.obterAgora());
      const conflitos = () => Number((srv.db.prepare(
        "SELECT COUNT(*) AS n FROM audit_event WHERE motivoCodigo='OPERATION_HASH_CONFLICT'").get() as { n: number }).n);
      const antes = conflitos();
      const pedido = { contatoId: TELEFONE, patientId: G2_CONTEXTO.patientId, idempotencyKey: chave };
      expect(await srv.post("/consulta/canal/vincular", pedido))
        .toEqual({ status: 409, data: { codigo: "OPERATION_HASH_CONFLICT" } });
      expect(conflitos()).toBe(antes + 1);
      expect(srv.db.prepare("SELECT COUNT(*) AS n FROM draft_envelope WHERE draftId=?").get(draftId)).toMatchObject({ n: 0 });

      // Removida a operação conflitante, o retry com a mesma chave grava o vínculo (antes: 409 CHAVE_IDEMPOTENCIA_REUTILIZADA).
      // Só a fixture remove a operação sintética; a proteção append-only é restaurada em seguida.
      srv.db.exec("DROP TRIGGER operation_no_delete");
      srv.db.prepare("DELETE FROM operation WHERE operationId=?").run(operationId);
      srv.db.exec(`CREATE TRIGGER operation_no_delete BEFORE DELETE ON operation
        BEGIN SELECT RAISE(ABORT, 'operation append-only'); END;`);
      const ok = await srv.post("/consulta/canal/vincular", pedido);
      expect(ok.status).toBe(200);
      expect(srv.eventosDoPaciente(G2_CONTEXTO.patientId).filter((e) => e.tipo === "Contato")).toHaveLength(1);
    } finally { await srv.fechar(); }
  });
});
