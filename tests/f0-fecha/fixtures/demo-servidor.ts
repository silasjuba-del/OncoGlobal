/** Demo F0 exclusivamente sintética. Sempre cria diretório temporário novo; nunca recebe banco existente. */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { abrirLedger } from "../../../src/kernel/ledger/db.js";
import { salvarDraft } from "../../../src/kernel/ledger/drafts.js";
import { confirmar } from "../../../src/kernel/ledger/writeRouter.js";
import { iniciarOncoassistLocal } from "../../../src/app/oncoassistLocal.js";
import { dataCivilDoServico } from "../../../src/kernel/gateway/tempo.js";
import type { Sessao } from "../../../src/contracts/base.js";

const patientId = "Paciente Teste 92", encounterId = "encontro-demo-f0-92", tumorLotId = "lote-demo-f0-92";
const senha = "demo-f0-exclusivamente-sintetica";
const port = Number(process.env.ONCOGLOBAL_API_PORT ?? "4197");
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORTA_DEMO_INVALIDA");
const dataDir = mkdtempSync(join(tmpdir(), "oncoglobal-f0-demo-sintetica-"));
const agora = new Date().toISOString();
const civil = dataCivilDoServico(agora, "-03:00");
if (civil.estado !== "OK") throw new Error("DATA_DEMO_INVALIDA");
const hoje = civil.dataCivil;
const db = abrirLedger(join(dataDir, "ledger.sqlite"));
const sessao: Sessao = { medicoId: "medico-demo-sintetico", crm: "CRM-TESTE-F0", emitidaEm: agora,
  expiraEm: new Date(Date.now() + 60 * 60_000).toISOString() };
let n = 0;
function inicial(tipo: string, payload: unknown, lote: string | null) {
  n++;
  const draftId = `demo-inicial-${n}`;
  salvarDraft(db, { draftId, patientId, sourceId: "cadastro-inicial-sintetico", rawRef: "demo-sintetica",
    payload: {}, diagnostics: [], revision: 0, criadoEm: agora });
  const resultado = confirmar(db, { operationId: `demo-inicial-op-${n}`, patientId, encounterId, tumorLotId: lote,
    reviewDecisionId: `demo-inicial-review-${n}`, sessao, em: agora,
    registros: [{ draftId, expectedRevision: 0, eventId: `demo-inicial-event-${n}`, tipo, payload,
      fontes: [], revisao: "CONFIRMADO" }] });
  if (resultado.estado !== "GRAVADA") throw new Error("DEMO_INICIAL_NAO_GRAVADA");
}
const ausente = { valor: null, estado: "PENDENTE", campo: "AUSENTE", motivo: "não informado na demo",
  fontes: [], revisao: "RAW" };
inicial("Paciente", { patientId, nome: patientId, identificadores: [], nascimento: null,
  sexoCadastral: "NAO_INFORMADO", divergencia: false }, null);
inicial("TumorLot", { patientId, tumorLotId, cid: ausente, topografia: ausente, histologia: ausente,
  estadiamentos: [], finalidadeApac: ausente, marcos: [] }, tumorLotId);
inicial("AgendaEntry", { patientId, encounterId, horario: "09:00", data: hoje }, tumorLotId);
// APAC incompleta preexistente para demonstrar a leitura/antiglosa; a referência sintética não autoriza exportação.
inicial("APAC", { apacId: "apac-demo-incompleta-92", tumorLotId,
  prescricaoAssinadaRef: { documentId: "referencia-sintetica-a-conferir", documentVersion: 1 },
  dataGeracaoApp: hoje, competencia: hoje.slice(0, 7), campos: {}, estado: "RASCUNHO",
  resultadoExterno: null, versao: 1, substituiApacId: null }, tumorLotId);
db.close();
const servidor = await iniciarOncoassistLocal({ dataDir, senha, medicoId: sessao.medicoId, crm: sessao.crm, port });
async function post(rota: string, payload: unknown, token?: string) {
  const resposta = await fetch(`http://127.0.0.1:${port}${rota}`, { method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(payload) });
  if (!resposta.ok) throw new Error(`DEMO_HTTP_${resposta.status}`);
  return resposta.json() as Promise<Record<string, unknown>>;
}
const login = await post("/login", { senha });
if (typeof login.token !== "string") throw new Error("LOGIN_DEMO_INVALIDO");
// Ingestão real HTTP, sem vínculo ou confirmação automática. A revisão será feita na interface.
for (const fonte of [
  { sourceId: "ap-demo-sintetico", sourceType: "pathology", texto: `${hoje} Histologia: carcinoma ductal invasivo sintético.` },
  { sourceId: "lab-demo-sintetico", sourceType: "medical_note", texto: `${hoje} Creatinina 1,2 mg/dL. Sem proteinúria. TSH não consta.` },
  { sourceId: "encaminhamento-demo-sintetico", sourceType: "nursing", texto: `${hoje} Creatinina 1,8 mg/dL. Documento sintético divergente.` },
]) {
  await post("/consulta/extrair", { recordingId: `gravacao-${fonte.sourceId}`, sourceId: fonte.sourceId,
    sourceType: fonte.sourceType, rawTranscript: `Paciente: ${patientId}\n${fonte.texto}` }, login.token);
}
console.log(JSON.stringify({ tipo: "DEMONSTRACAO_EXCLUSIVAMENTE_SINTETICA", api: `http://127.0.0.1:${port}`,
  dataDir, senhaSintetica: senha, patientId, encounterId, tumorLotId, fontesPendentes: 3, llmExterna: "DESLIGADA" }));
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => { void servidor.encerrar().then(() => process.exit(0)); });
