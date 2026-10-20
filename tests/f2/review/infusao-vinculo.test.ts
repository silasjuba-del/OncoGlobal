import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { receberTransporteSintetico } from "../../../src/server/canalEntrada.js";
import { relatosInfusaoPendentes } from "../../../src/server/relatosInfusaoCanal.js";
import { lerEventosComIntegridade } from "../../../src/server/leituras.js";
import { rotearDutos } from "../../../src/server/dutos.js";
import { ambiente, ctx, EM } from "../../bateria2/fixtures.js";

it.each(["compartilhado", "revogado"])("vínculo atual leva relato ao salão e %s impede atribuição indevida", tipo => {
  const a = ambiente(), sender = "contato-sintetico-infusao", texto = "Tive coceira durante a infusão";
  try {
    a.seed("Paciente", { patientId: ctx.patientId, nome: "Paciente Sintetico", identificadores: [], nascimento: null,
      sexoCadastral: "NAO_INFORMADO", divergencia: false });
    const ack = receberTransporteSintetico(a.db, { accountId: "conta-sintetica", canal: "WHATSAPP_SERVICO",
      providerMessageId: "relato-sintetico-infusao", senderRef: sender, providerSentAt: EM, ingestedAt: EM,
      conteudo: { tipo: "TEXT", texto, contentSha256: createHash("sha256").update(texto).digest("hex") }, cadastros: [] });
    if (!ack.ok) throw Error("INGRESSO_SINTETICO");
    const ler = () => relatosInfusaoPendentes(a.db, lerEventosComIntegridade(a.db).itens, EM);
    expect(ler()).toEqual([]);
    const contato = { contatoId: "contato-infusao", canal: "WHATSAPP_SERVICO", endereco: sender,
      patientId: ctx.patientId, relacao: "DESCONHECIDO", vinculadoEm: EM, revogadoEm: null };
    const origem = a.seed("Contato", contato);
    expect(ler()).toMatchObject([{ patientId: ctx.patientId, mensagemId: ack.reciboId, texto }]);
    if (tipo === "revogado") a.seed("Contato", { ...contato, revogadoEm: EM }, "CONFIRMADO", ctx, origem);
    else {
      const outro = { ...ctx, patientId: "outro-paciente-sintetico" };
      a.seed("Paciente", { patientId: outro.patientId, nome: "Outro Sintetico", identificadores: [], nascimento: null,
        sexoCadastral: "NAO_INFORMADO", divergencia: false }, "CONFIRMADO", outro);
      a.seed("Contato", { ...contato, contatoId: "outro-contato-infusao", patientId: outro.patientId }, "CONFIRMADO", outro);
    }
    expect(ler()).toEqual([]);
    const negada = rotearDutos({ db: a.db, sessoes: a.acesso.sessoes, agora: () => EM }, a.acesso.token,
      "/salao/revisar-relato-canal", { contexto: { ...ctx, tumorLotId: null, operationId: "revisao-vinculo-alterado" },
        mensagemId: ack.reciboId, payloadSha256: ack.payloadSha256, decisao: "Tentativa sintética após alteração do vínculo." }, a.login.sessao);
    expect(negada?.status).toBe(409);
    expect(lerEventosComIntegridade(a.db).itens.filter(e => e.tipo === "ReviewDecision")).toHaveLength(0);
    expect(a.db.prepare("SELECT vinculoPatientId FROM canal_mensagem").get()!.vinculoPatientId).toBe(null);
  } finally { a.db.close(); }
});
