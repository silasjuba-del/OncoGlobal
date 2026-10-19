import { DatabaseSync } from "node:sqlite";
import { afterEach, expect, it } from "vitest";
import { registrarConsentimentoCanal, revogarConsentimentoCanal } from "../../src/server/canalEntrada.js";
import { criarGerenciadorSessao } from "../../src/server/sessao.js";
import { lerResumoAnamneseGuiadaF5, registrarResumoAnamneseGuiadaF5, processarVozAnamneseComExpurgoAudioF5 } from "../../src/server/f5AnamneseOncoChief.js";

const agora = "2026-10-19T12:00:00.000Z";
const bancos: DatabaseSync[] = [];
const roteiro = {
  roteiroId: "roteiro-integridade", versao: "1", tumorPackId: "pack-sintetico",
  contextoClinico: "PRIMEIRA_CONSULTA", statusCuradoria: "CONFERIDA_MEDICO",
  aprovadoPor: "medico-sintetico", aprovadoEm: "2026-10-19", fonte: "fixture",
  passos: [{ passoId: "passo-1", ordem: 1, tipo: "PERGUNTA_SINTOMA", dominioClinico: "relato",
    perguntaCanonica: "Como esta?", obrigatorioParaResumo: true }], lembretesOrientacoes: [],
};
function ambiente() {
  const db = new DatabaseSync(":memory:"); bancos.push(db);
  const sessoes = criarGerenciadorSessao({ medicoId: "medico-sintetico", crm: "CRM-SINTETICO", senha: "senha-sintetica-teste", duracaoMs: 300_000, agora: () => agora });
  const login = sessoes.login("senha-sintetica-teste")!;
  const acesso = { sessoes, token: login.token, agora };
  function consentir(patientId: string | null = "paciente-a", contatoId = "contato-a", finalidade: ("COMUNICACAO_CLINICA" | "AVISO_RETORNO")[] = ["COMUNICACAO_CLINICA"]) {
    expect(registrarConsentimentoCanal(db, acesso, { patientId, contatoId, finalidade,
      referenciaTermo: "termo-sintetico", versaoTermo: "1", origem: "PRESENCIAL_CONSULTORIO" }).ok).toBe(true);
  }
  const resumo = { sessaoAnamneseId: "sessao-a", patientId: "paciente-a", contatoId: "contato-a", roteiroCandidato: roteiro, respostas: [] };
  const voz = { vozId: "voz-a", sessaoAnamneseId: "sessao-a", patientId: "paciente-a", contatoId: "contato-a",
    tecnologia: "TRANSCRICAO_LOCAL" as const, duracaoSegundos: 4,
    audioBufferTemporario: new Uint8Array([1, 2, 3]), transcricaoValidadaPeloMedico: "Primeiro relato persistido" };
  return { db, acesso, consentir, resumo, voz };
}
afterEach(() => { for (const db of bancos.splice(0)) db.close(); });

it.each(["outro-paciente", null, "somente-aviso"])("bloqueia resumo e voz com consentimento incompativel: %s", (caso) => {
  const { db, acesso, consentir, resumo, voz } = ambiente();
  consentir(caso === "somente-aviso" ? "paciente-a" : caso, "contato-a", caso === "somente-aviso" ? ["AVISO_RETORNO"] : ["COMUNICACAO_CLINICA"]);
  expect(registrarResumoAnamneseGuiadaF5(db, acesso, resumo)).toEqual({ ok: false, codigo: "CONSENTIMENTO_CANAL_AUSENTE_OU_REVOGADO" });
  expect(processarVozAnamneseComExpurgoAudioF5(db, acesso, voz)).toEqual({ ok: false, codigo: "CONSENTIMENTO_VOZ_AUSENTE_OU_REVOGADO" });
  expect(db.prepare("SELECT * FROM f5_anamnese_resumo").all()).toHaveLength(0);
  expect(db.prepare("SELECT * FROM f5_voz_anamnese").all()).toHaveLength(0);
});

it("resumo repetido retorna vencedor persistido, inclusive conteudo e data originais", () => {
  const { db, acesso, consentir, resumo } = ambiente(); consentir();
  const primeiro = registrarResumoAnamneseGuiadaF5(db, acesso, resumo);
  expect(primeiro.ok).toBe(true);
  const repetido = registrarResumoAnamneseGuiadaF5(db, { ...acesso, agora: "2026-10-19T12:00:01.000Z" }, { ...resumo, alertasRedFlag: ["novo relato nao persistido"] });
  expect(repetido).toEqual(primeiro);
  expect(primeiro.ok && lerResumoAnamneseGuiadaF5(db, resumo.sessaoAnamneseId)).toEqual(primeiro.ok && primeiro.resumo);
  expect(db.prepare("SELECT * FROM f5_anamnese_resumo").all()).toHaveLength(1);
});

it.each(["patientId", "contatoId", "roteiroId", "versao", "tumorPackId"])("resumo rejeita colisao em %s sem expor vencedor", (campo) => {
  const { db, acesso, consentir, resumo } = ambiente(); consentir();
  const primeiro = registrarResumoAnamneseGuiadaF5(db, acesso, resumo); expect(primeiro.ok).toBe(true);
  const entrada = { ...resumo, roteiroCandidato: { ...roteiro } };
  if (campo === "patientId") { entrada.patientId = "paciente-b"; consentir("paciente-b"); }
  else if (campo === "contatoId") { entrada.contatoId = "contato-b"; consentir("paciente-a", "contato-b"); }
  else entrada.roteiroCandidato = { ...roteiro, [campo]: "outro-contexto" };
  expect(registrarResumoAnamneseGuiadaF5(db, acesso, entrada)).toEqual({ ok: false, codigo: "IDENTIDADE_OU_CONTEXTO_CONFLITANTE" });
  expect(primeiro.ok && lerResumoAnamneseGuiadaF5(db, resumo.sessaoAnamneseId)).toEqual(primeiro.ok && primeiro.resumo);
});

it("voz repetida devolve texto/hash persistidos e expurga ambos os audios", () => {
  const { db, acesso, consentir, voz } = ambiente(); consentir();
  const primeiro = processarVozAnamneseComExpurgoAudioF5(db, acesso, voz); expect(primeiro.ok).toBe(true);
  const audio = new Uint8Array([8, 9, 10]);
  expect(processarVozAnamneseComExpurgoAudioF5(db, { ...acesso, agora: "2026-10-19T12:00:01.000Z" }, {
    ...voz, audioBufferTemporario: audio, transcricaoValidadaPeloMedico: "Segundo texto nao persistido",
  })).toEqual(primeiro);
  expect([...audio]).toEqual([0, 0, 0]); expect([...voz.audioBufferTemporario]).toEqual([0, 0, 0]);
  const rows = db.prepare("SELECT registroVozJson FROM f5_voz_anamnese").all() as { registroVozJson: string }[];
  expect(rows).toHaveLength(1);
  expect(primeiro.ok && JSON.parse(rows[0]!.registroVozJson)).toEqual(primeiro.ok && primeiro.registroVoz);
});

it.each(["patientId", "contatoId", "sessaoAnamneseId", "tecnologia"])("voz rejeita colisao em %s e preserva expurgo", (campo) => {
  const { db, acesso, consentir, voz } = ambiente(); consentir();
  const primeiro = processarVozAnamneseComExpurgoAudioF5(db, acesso, voz); expect(primeiro.ok).toBe(true);
  const audio = new Uint8Array([4, 5]);
  const entrada = { ...voz, audioBufferTemporario: audio };
  if (campo === "patientId") { entrada.patientId = "paciente-b"; consentir("paciente-b"); }
  else if (campo === "contatoId") { entrada.contatoId = "contato-b"; consentir("paciente-a", "contato-b"); }
  else if (campo === "sessaoAnamneseId") entrada.sessaoAnamneseId = "sessao-b";
  else entrada.tecnologia = "DEEPGRAM_COMANDO_CURTO" as typeof entrada.tecnologia;
  expect(processarVozAnamneseComExpurgoAudioF5(db, acesso, entrada)).toEqual({ ok: false, codigo: "IDENTIDADE_OU_CONTEXTO_CONFLITANTE" });
  expect([...audio]).toEqual([0, 0]);
  const row = db.prepare("SELECT registroVozJson FROM f5_voz_anamnese").get() as { registroVozJson: string };
  expect(primeiro.ok && JSON.parse(row.registroVozJson)).toEqual(primeiro.ok && primeiro.registroVoz);
});



it("revogacao impede replay de resumo e voz ja persistidos", () => {
  const { db, acesso, consentir, resumo, voz } = ambiente(); consentir();
  expect(registrarResumoAnamneseGuiadaF5(db, acesso, resumo).ok).toBe(true);
  expect(processarVozAnamneseComExpurgoAudioF5(db, acesso, voz).ok).toBe(true);
  expect(revogarConsentimentoCanal(db, acesso, { contatoId: "contato-a", patientId: "paciente-a", origem: "REVOGACAO_MEDICO" }).ok).toBe(true);
  expect(registrarResumoAnamneseGuiadaF5(db, acesso, resumo)).toEqual({ ok: false, codigo: "CONSENTIMENTO_CANAL_AUSENTE_OU_REVOGADO" });
  expect(processarVozAnamneseComExpurgoAudioF5(db, acesso, { ...voz, audioBufferTemporario: new Uint8Array([1]) })).toEqual({ ok: false, codigo: "CONSENTIMENTO_VOZ_AUSENTE_OU_REVOGADO" });
});

it("falha de persistencia da voz nao retorna sucesso e mantem audio expurgado", () => {
  const { db, acesso, consentir, voz } = ambiente(); consentir();
  // Cria o schema por uma tentativa recusada antes de instalar a falha sintetica.
  processarVozAnamneseComExpurgoAudioF5(db, acesso, { ...voz, transcricaoValidadaPeloMedico: "" });
  db.exec("CREATE TRIGGER falha_voz BEFORE INSERT ON f5_voz_anamnese BEGIN SELECT RAISE(ABORT, 'falha sintetica'); END");
  const audio = new Uint8Array([8, 9]);
  expect(() => processarVozAnamneseComExpurgoAudioF5(db, acesso, { ...voz, audioBufferTemporario: audio })).toThrow("falha sintetica");
  expect([...audio]).toEqual([0, 0]);
  expect(db.prepare("SELECT * FROM f5_voz_anamnese").all()).toHaveLength(0);
});
