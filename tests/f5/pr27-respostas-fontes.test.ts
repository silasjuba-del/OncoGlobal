import { DatabaseSync } from "node:sqlite";
import { expect, it } from "vitest";
import type { RespostaPassoAnamnese, RoteiroAnamneseTumor } from "../../src/contracts/f5/anamneseEOncoChief.js";
import { compilarResumoEstruturadoAnamnese } from "../../src/modules/canal/anamneseGuiada.js";
import { registrarResumoAnamneseGuiadaF5, lerResumoAnamneseGuiadaF5 } from "../../src/server/f5AnamneseOncoChief.js";
import { registrarConsentimentoCanal } from "../../src/server/canalEntrada.js";
import { criarGerenciadorSessao } from "../../src/server/sessao.js";
import { fonteSintetica } from "../fixtures/triagem.js";

const agora = "2026-10-19T12:00:00.000Z";
const roteiro: RoteiroAnamneseTumor = {
  roteiroId: "roteiro-fontes", versao: "1", tumorPackId: "pack-sintetico",
  contextoClinico: "PRIMEIRA_CONSULTA", statusCuradoria: "CONFERIDA_MEDICO",
  aprovadoPor: "medico-sintetico", aprovadoEm: "2026-10-19", fonte: "fixture",
  passos: [{ passoId: "passo-1", ordem: 1, tipo: "PERGUNTA_SINTOMA", dominioClinico: "relato",
    perguntaCanonica: "Como esta?", obrigatorioParaResumo: true }],
  lembretesOrientacoes: [{ orientacaoId: "orientacao-curada", titulo: "Lembrete", textoAprovado: "Texto sintetico",
    statusCuradoria: "CONFERIDA_MEDICO", fonte: "fixture" }],
};
function resposta(id: string, polaridade: RespostaPassoAnamnese["polaridade"], respostaLiteral: string): RespostaPassoAnamnese {
  return { passoId: "passo-1", mensagemIdOrigem: id, polaridade, respostaLiteral,
    documentoOuFotoRef: null, fonte: fonteSintetica(id), respondidoEm: agora };
}
const negada = resposta("fonte-negada", "NEGADO", "Nao tive sintoma.");
const afirmada = resposta("fonte-afirmada", "AFIRMADO", "Tive sintoma ontem.");
function compilar(respostas: RespostaPassoAnamnese[]) {
  return compilarResumoEstruturadoAnamnese({ sessaoAnamneseId: "sessao-fontes", patientId: "paciente-sintetico",
    contatoId: "contato-sintetico", roteiro, respostas, geradoEm: agora });
}

it.each([[negada, afirmada], [afirmada, negada]])("preserva os relatos e fontes em qualquer ordem: %j", (primeira, segunda) => {
  const resumo = compilar([primeira, segunda]);
  expect(resumo.itensColetados.map(i => [i.resumoItem, i.polaridade, i.fonte])).toEqual(
    [primeira, segunda].map(r => [r.respostaLiteral, r.polaridade, r.fonte]));
  expect(resumo.incertezasExplicitas).toContain('A CONFERIR: múltiplas respostas para o passo "passo-1"; nenhum relato substitui outro.');
  expect(resumo.negacoesPreservadas).toHaveLength(1);
  expect(resumo.revisao).toBe("REVISAR");
});

it("relatos iguais com fontes distintas nao sao deduplicados", () => {
  const outraFonte = resposta("outra-fonte", "NEGADO", negada.respostaLiteral);
  const resumo = compilar([negada, outraFonte]);
  expect(resumo.itensColetados).toHaveLength(2);
  expect(resumo.itensColetados.map(i => i.fonte)).toEqual([negada.fonte, outraFonte.fonte]);
});

it("NAO_RESPONDIDO repetido nao apaga relato anterior nem sua propria proveniencia", () => {
  const naoRespondida = resposta("fonte-sem-resposta", "NAO_RESPONDIDO", "Sem resposta registrada");
  const resumo = compilar([negada, naoRespondida]);
  expect(resumo.itensColetados[0]?.fonte).toEqual(negada.fonte);
  const partes = resumo.lacunasExplicitas.filter(l => l.startsWith("A CONFERIR: resposta NAO_RESPONDIDO"));
  const reconstruida = partes.map(p => p.slice(p.indexOf(": ", p.indexOf("parte ")) + 2)).join("");
  expect(JSON.parse(reconstruida)).toEqual(naoRespondida);
  expect(resumo.lacunasExplicitas.some(l => l.includes("não respondido"))).toBe(true);
});

it("curadoria nao prova entrega, inclusive sem respostas", () => {
  expect(compilar([]).orientacoesFixasEntreguesIds).toEqual([]);
  expect(compilar([negada]).orientacoesFixasEntreguesIds).toEqual([]);
  expect(compilar([negada]).incertezasExplicitas).toEqual([]);
  expect(compilar([]).lacunasExplicitas).toHaveLength(1);
});

it("servidor persiste e reabre ambos os relatos sem presumir entrega", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const sessoes = criarGerenciadorSessao({ medicoId: "medico-sintetico", crm: "CRM-SINTETICO", senha: "senha-sintetica-fontes", duracaoMs: 300000, agora: () => agora });
    const acesso = { sessoes, token: sessoes.login("senha-sintetica-fontes")!.token, agora };
    expect(registrarConsentimentoCanal(db, acesso, { contatoId: "contato-sintetico", patientId: "paciente-sintetico",
      referenciaTermo: "termo-sintetico", versaoTermo: "1", finalidade: ["COMUNICACAO_CLINICA"], origem: "PRESENCIAL_CONSULTORIO" }).ok).toBe(true);
    const salvo = registrarResumoAnamneseGuiadaF5(db, acesso, { sessaoAnamneseId: "sessao-fontes", patientId: "paciente-sintetico", contatoId: "contato-sintetico", roteiroCandidato: roteiro, respostas: [negada, afirmada] });
    expect(salvo.ok).toBe(true);
    const lido = lerResumoAnamneseGuiadaF5(db, "sessao-fontes");
    expect(lido).toEqual(compilar([negada, afirmada]));
    expect(lido?.itensColetados).toHaveLength(2);
    expect(lido?.orientacoesFixasEntreguesIds).toEqual([]);
  } finally { db.close(); }
});
