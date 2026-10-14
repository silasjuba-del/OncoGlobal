/** Servidor exclusivamente sintético para prova S12 no navegador. Não é o launcher de produção. */
import { existsSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { createInterface } from "node:readline";
import { abrirAmbienteColon, cadastrarCasoColon, criarDiretorioColon, kitColon, AGORA, SENHA } from "../../../f0-fecha/fixtures/colon-e2e.js";
import { confirmar, salvarDraft } from "../../../../src/kernel/ledger/writeRouter.js";

export const PACIENTE_RETORNO = "paciente-s12-retorno-001";
export const ENCONTRO_RETORNO = "encontro-s12-retorno-001";
export const NOME_RETORNO = "Paciente Sintético Retorno S12";

const dir = realpathSync(process.argv[2] ?? criarDiretorioColon());
if (dirname(dir).toLowerCase() !== realpathSync(tmpdir()).toLowerCase() || !basename(dir).startsWith("e2e-colon-f1-"))
  throw new Error("DEMO_EXIGE_DIRETORIO_SINTETICO");
const novo = !existsSync(join(dir, "ledger.sqlite"));
const app = await abrirAmbienteColon(dir);
if (novo) {
  cadastrarCasoColon(app);
  const seed = (id: string, tipo: string, payload: unknown) => {
    salvarDraft(app.db, { draftId: id, patientId: PACIENTE_RETORNO, sourceId: id, rawRef: "cadastro-sintetico-s12",
      payload: {}, diagnostics: [], revision: 0, criadoEm: AGORA });
    const r = confirmar(app.db, { patientId: PACIENTE_RETORNO, encounterId: ENCONTRO_RETORNO, tumorLotId: null,
      operationId: `op-${id}`, reviewDecisionId: `review-${id}`, sessao: app.sessoes.obter(app.token)!, em: AGORA,
      registros: [{ draftId: id, expectedRevision: 0, eventId: id, tipo, payload, fontes: [], revisao: "CONFIRMADO" }] });
    if (r.estado !== "GRAVADA") throw new Error("CADASTRO_SINTETICO_NAO_GRAVADO");
  };
  seed("cadastro-s12-retorno", "Paciente", { patientId: PACIENTE_RETORNO, identificadores: [], nome: NOME_RETORNO,
    nascimento: null, sexoCadastral: "NAO_INFORMADO", divergencia: false });
  seed("agenda-s12-retorno", "AgendaEntry", { patientId: PACIENTE_RETORNO, encounterId: ENCONTRO_RETORNO,
    data: AGORA.slice(0, 10), horario: "11:00" });
}
mkdirSync(join(dir, "kit"), { recursive: true });
const kit = kitColon();
for (const fonte of kit) writeFileSync(join(dir, "kit", `${fonte.sourceId}.${fonte.tipo === "PDF" ? "pdf" : "png"}`), fonte.bytes);
const manifesto = { sintético: true, providerExterno: false, dir, baseUrl: app.baseUrl, agora: AGORA,
  senhaDemo: SENHA, retorno: { patientId: PACIENTE_RETORNO, encounterId: ENCONTRO_RETORNO, nome: NOME_RETORNO },
  kit: kit.map(f => ({ sourceId: f.sourceId, sha256: f.sha256 })) };
writeFileSync(join(dir, "manifesto-demo.json"), JSON.stringify(manifesto, null, 2));
console.log(JSON.stringify(manifesto));
const entrada = createInterface({ input: process.stdin });
entrada.on("line", async line => { if (line.trim() === "stop") { entrada.close(); await app.close(); process.exit(0); } });
