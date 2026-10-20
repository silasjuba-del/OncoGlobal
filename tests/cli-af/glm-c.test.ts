import { describe, it, expect } from "vitest";
import { avaliarRedFlagsCanal } from "../../src/rules/redFlagsCanal.js";
import type { CanalRuleset } from "../../src/rules/tipos-w3.js";

// FUGU-R2 / grupo C — hipotese, negacao coordenada, autoria e tempo por trecho.
// Fixtures sinteticas derivadas de fixtures-r2.json (grupo C). Nao usar clinicamente.
//
// RevisaoC fortaleceu as assercoes: cada caso verifica o CONJUNTO COMPLETO de
// flags (codigo->alvo), nao apenas `some(alvo)`. Assim, flags adicionais
// erradas falham o teste. Controles validos (C-R2-CONTROLES) e oraculos R2
// nao foram relaxados.

interface CasoC {
  id: string;
  text: string;
  // mapa completo codigo -> alvo esperado. `false` = nenhuma flag desse codigo.
  // Outros codigos do ruleset nao listados aqui tambem nao devem flag.
  targets: Record<string, false | "paciente" | "contato">;
  review?: boolean;
  why: string;
}

const casos: CasoC[] = [
  { id: "C-R2-01", text: "Não tenho febre nem vômitos.", targets: { FEBRE: false, VOMITO: false }, why: "Negação coordenada preserva os dois sintomas negados." },
  { id: "C-R2-02", text: "Sem febre ou falta de ar.", targets: { FEBRE: false, DISPNEIA: false }, why: "Negação coordenada com ou não afirma o segundo termo." },
  { id: "C-R2-03", text: "Nego febre e diarreia.", targets: { FEBRE: false, DIARREIA: false }, why: "Nego é negação explícita, inclusive na lista." },
  { id: "C-R2-04", text: "Tenho febre agora. Minha mãe perguntou sobre dieta.", targets: { FEBRE: "paciente" }, why: "Terceiro em trecho não relacionado não muda o sujeito da febre atual." },
  { id: "C-R2-05", text: "Minha mãe está sem febre, mas eu estou com febre agora.", targets: { FEBRE: "paciente" }, why: "A menção atual positiva do paciente não herda autoria da menção negada da mãe." },
  { id: "C-R2-06", text: "Meu pai tem diarreia. Estou com febre agora.", targets: { FEBRE: "paciente", DIARREIA: "contato" }, why: "Cada sintoma conserva o sujeito do seu trecho." },
  { id: "C-R2-07", text: "Eu estou com febre. Minha mãe está bem.", targets: { FEBRE: "paciente" }, why: "O sujeito não deve ser determinado por uma busca global de parentesco." },
  { id: "C-R2-08", text: "Sem febre ontem, hoje estou com febre.", targets: { FEBRE: "paciente" }, why: "Mudança temporal na mesma sentença preserva a afirmação atual." },
  { id: "C-R2-09", text: "Caso tenha febre, mando mensagem.", targets: { FEBRE: false }, review: true, why: "Condicional sem interrogação ainda é hipótese, não sintoma atual." },
  { id: "C-R2-10", text: "Estou com febre agora?", targets: { FEBRE: false }, review: true, why: "Pergunta sobre a existência do sintoma é incerta; não confundir com Estou com febre; o que faço?." },
  { id: "C-R2-11", text: "Estou com febre agora; posso ir ao pronto-socorro?", targets: { FEBRE: "paciente" }, why: "Afirmação atual permanece apesar de pergunta sobre a conduta." },
  { id: "C-R2-12", text: "Minha mãe está com febre agora; o que eu faço?", targets: { FEBRE: "contato" }, why: "Afirmação atual de terceiro não é sintoma do paciente." },
  { id: "C-R2-13", text: "Não só febre, mas também diarreia agora.", targets: { FEBRE: "paciente", DIARREIA: "paciente" }, why: "Não só ... mas também é afirmativo; evitar correção que negue qualquer não." },
  { id: "C-R2-14", text: "Não estou com febre. Estou com vômitos agora.", targets: { FEBRE: false, VOMITO: "paciente" }, why: "Negação de outra cláusula não se propaga à afirmação atual." },
  { id: "C-R2-15", text: "Febre ausente. Vômito negado.", targets: { FEBRE: false, VOMITO: false }, why: "Negação após o termo também é explícita." },

  // RevisaoC — contraprovas adicionais (C-R2-16..C-R2-23).
  // 1) sentencaIni ancorado ao final contaminava sentenca seguinte.
  { id: "C-R2-16", text: "Caso tenha febre, aviso. Estou com falta de ar.", targets: { FEBRE: false, DISPNEIA: "paciente" }, review: true, why: "Hipotese em sentenca anterior nao contamina afirmacao atual em sentenca seguinte; dispneia atual permanece, febre fica pendente." },
  // 2) negacao coordenada ignora novo predicado afirmativo.
  { id: "C-R2-17", text: "Sem febre e estou com falta de ar.", targets: { FEBRE: false, DISPNEIA: "paciente" }, why: "Novo predicado (estou com) apos conectivo encerra escopo da negacao; dispneia afirmada." },
  { id: "C-R2-18", text: "Sem febre e com vômitos.", targets: { FEBRE: false, VOMITO: "paciente" }, why: "Com apos conectivo introduz predicado afirmativo; vômito afirmado, nao herda negacao." },
  // 3) DIVISAO removia ontem/hoje/agora; afirmacao passada virava atual.
  { id: "C-R2-19", text: "Febre ontem.", targets: { FEBRE: false }, review: true, why: "Marcador temporal ontem visivel a passado(); afirmacao passada fica PENDENTE, nao flag atual." },
  // 4) eNaoSoMas consultava prefixo global; negava afirmacao em clausula posterior.
  { id: "C-R2-20", text: "Não só febre, mas também diarreia. Sem falta de ar.", targets: { FEBRE: "paciente", DIARREIA: "paciente", DISPNEIA: false }, why: "Nao so...mas tambem so consulta o trecho local; Sem falta de ar em clausula posterior continua negada." },
  // 5) Pergunta de conduta nao suprime afirmacao; existencia fica pendente.
  { id: "C-R2-21a", text: "Estou com febre, o que faço?", targets: { FEBRE: "paciente" }, why: "Pergunta de conduta em clausula posterior (apos virgula) nao suprime afirmacao atual do sintoma." },
  { id: "C-R2-21b", text: "Estou com febre;posso ir ao PS?", targets: { FEBRE: "paciente" }, why: "Pergunta de conduta apos ; (sem espaco) nao suprime afirmacao; distingue de Estou com febre agora?." },
  { id: "C-R2-21c", text: "Estou com febre agora?", targets: { FEBRE: false }, review: true, why: "Pergunta de existencia (sem divisor entre sintoma e ?) fica PENDENTE." },
  // 6) sujeito por trecho; primeira pessoa reafirma paciente; nao buscar parentesco em clausula posterior.
  { id: "C-R2-22", text: "Minha mãe hoje está com febre.", targets: { FEBRE: "contato" }, why: "Marcador temporal hoje nao apaga sujeito terceiro; febre atribuida ao contato." },
  { id: "C-R2-23", text: "Minha mãe está com febre e eu estou com falta de ar.", targets: { FEBRE: "contato", DISPNEIA: "paciente" }, why: "Cada clausula coordenada conserva seu sujeito; febre do contato, dispneia do paciente; nao buscar parentesco arbitrario em clausula posterior." },
  // Revisao Noether — contraprovas C-R2-24..C-R2-28 (sem reescrever interface
  // publica, oraculos legados ou escopo; preserva 6 correcoes anteriores e
  // 15 controles R2).
  // N1) RE_CONDICIONAL precisa admitir pronome entre conectivo e verbo.
  { id: "C-R2-24", text: "Se eu tiver febre, o que faço?", targets: { FEBRE: false }, review: true, why: "Condicional com pronome (se eu tiver) e hipotese; mesmo com clausula de conduta, febre fica PENDENTE, sem flag." },
  // N2) Nao estender condicional a sentenca inteira apos ; — so clausula local.
  { id: "C-R2-25", text: "Caso tenha febre, aviso; estou com falta de ar.", targets: { FEBRE: false, DISPNEIA: "paciente" }, review: true, why: "Condicional so vale para a clausula local; apos ; a oracao da dispneia e atual e permanece; febre fica PENDENTE." },
  // N3) Coordenacao sem novo sujeito/predicado herda autoria.
  { id: "C-R2-26", text: "Minha mãe está com febre e falta de ar.", targets: { FEBRE: "contato", DISPNEIA: "contato" }, why: "Sem novo sujeito ou predicado apos e, ambos herdam o sujeito terceiro (mae); ambos contato. Diferente de ...e eu estou... que troca autoria." },
  // N4) Coordenacao simples herda tempo; oracao nova com marcador proprio tem tempo proprio.
  { id: "C-R2-27", text: "Tive febre ontem e vômitos.", targets: { FEBRE: false, VOMITO: false }, review: true, why: "Coordenacao por e sem marcador proprio herda ontem; ambos PENDENTE temporal, sem flag." },
  // N5) e/ou entre sintomas nao e clausula de conduta; pergunta de existencia.
  { id: "C-R2-28", text: "Estou com febre e falta de ar?", targets: { FEBRE: false, DISPNEIA: false }, review: true, why: "e entre sintomas nao demonstra conduta; sem marcador explicito (o que faco/posso ir), pergunta e de existencia -> ambos PENDENTE." },
];

// Ruleset sintético espelha fixtures-r2.json (channel.sinais). Apenas termos
// canonicos; sem limiar numerico (grupo C nao depende de temperatura).
const ruleset: CanalRuleset = {
  id: "canal-r2-sintetico",
  versao: "r2-1",
  ativo: true,
  flags: [
    { codigo: "FEBRE", termos: ["febre"], regraId: "r2:FEBRE", templateId: "tpl:FEBRE" },
    { codigo: "VOMITO", termos: ["vômito", "vômitos"], regraId: "r2:VOMITO", templateId: "tpl:VOMITO" },
    { codigo: "DIARREIA", termos: ["diarreia"], regraId: "r2:DIARREIA", templateId: "tpl:DIARREIA" },
    { codigo: "DISPNEIA", termos: ["falta de ar"], regraId: "r2:DISPNEIA", templateId: "tpl:DISPNEIA" },
  ],
};

const msg = (texto: string) => ({
  texto,
  contatoId: "contato-syn-r2",
  patientId: "paciente-syn-r2",
  classificadorOk: true,
});

// Assercao exata: o CONJUNTO COMPLETO de flags (codigo->alvo) deve coincidir
// com targets. Flags adicionais erradas falham — inclusive para codigos do
// ruleset nao listados em targets (nao filtrar desconhecidos). Para casos
// review, todo codigo marcado false deve ter um achado PENDENTE para aquele
// codigo especifico (nao basta algum PENDENTE qualquer).
function assertConjuntoCompleto(r: ReturnType<typeof avaliarRedFlagsCanal>, c: CasoC) {
  const esperadas = new Set<string>();
  for (const [codigo, alvo] of Object.entries(c.targets)) {
    if (alvo !== false) esperadas.add(`${codigo}:${alvo}`);
  }
  const obtidas = new Set(r.flags.map((f) => `${f.codigo}:${f.alvo}`));
  // Toda flag esperada deve estar presente.
  for (const e of esperadas) {
    expect(obtidas.has(e), `${c.id} esperava flag ${e}; obtidas=${JSON.stringify([...obtidas])}`).toBe(true);
  }
  // NENHUMA flag alem das esperadas — comparacao exata do conjunto inteiro,
  // sem filtrar por codigos listados em targets (codigos desconhecidos do
  // ruleset tambem nao devem flag se nao estao em targets).
  expect(obtidas.size, `${c.id} flags extras; esperadas=${JSON.stringify([...esperadas])}; obtidas=${JSON.stringify([...obtidas])}`).toBe(esperadas.size);
  for (const o of obtidas) {
    expect(esperadas.has(o), `${c.id} flag nao esperada ${o}; obtidas=${JSON.stringify([...obtidas])}`).toBe(true);
  }
  // Codigos esperados como `false` nao devem ter flag.
  for (const [codigo, alvo] of Object.entries(c.targets)) {
    if (alvo === false) {
      expect(r.flags.filter((f) => f.codigo === codigo), `${c.id} ${codigo} nao deve flag`).toHaveLength(0);
    }
  }
  // Para casos review, todo codigo marcado false deve ter PENDENTE para
  // aquele codigo especifico — nao basta algum PENDENTE qualquer.
  if (c.review) {
    for (const [codigo, alvo] of Object.entries(c.targets)) {
      if (alvo === false) {
        expect(
          r.achados.some((a) => a.codigo === codigo && a.estado === "PENDENTE"),
          `${c.id} deve registrar PENDENTE para ${codigo}; achados=${JSON.stringify(r.achados.map((a) => ({ c: a.codigo, e: a.estado })))}`,
        ).toBe(true);
      }
    }
  }
}

describe("FUGU-R2 grupo C — glm-c", () => {
  it.each([
    {id:'C-CODEX-01',text:'Minha mãe está com febre e tenho falta de ar.',targets:{FEBRE:'contato',DISPNEIA:'paciente'},why:'novo predicado tem sujeito próprio'},
    {id:'C-CODEX-02',text:'Tive febre ontem e estou com falta de ar.',targets:{FEBRE:false,DISPNEIA:'paciente'},review:true,why:'novo predicado não herda passado'},
    {id:'C-CODEX-03',text:'Tive febre ontem e estou com falta de ar agora.',targets:{FEBRE:false,DISPNEIA:'paciente'},review:true,why:'agora não retroage sobre febre histórica'},
    {id:'C-CODEX-04',text:'Será que estou com febre e devo ir ao hospital?',targets:{FEBRE:false},review:true,why:'dúvida de existência persiste apesar de pergunta de conduta'},
    {id:'C-CODEX-05',text:'Minha mãe está com febre e está com falta de ar.',targets:{FEBRE:'contato',DISPNEIA:'contato'},why:'predicado repetido em terceira pessoa herda sujeito'},
  ] as CasoC[])('$id: $why',c=>assertConjuntoCompleto(avaliarRedFlagsCanal(msg(c.text),ruleset),c));
  for (const c of casos) {
    it(`${c.id}: ${c.why}`, () => {
      const m = msg(c.text);
      const antes = { ...m };
      const r = avaliarRedFlagsCanal(m, ruleset);
      // texto/identidade inalterados
      expect(m).toEqual(antes);
      assertConjuntoCompleto(r, c);
    });
  }

  it("controles validos preservados (C-R2-CONTROLES)", () => {
    // Afirmação atual simples continua paciente.
    const r1 = avaliarRedFlagsCanal(msg("Estou com febre agora."), ruleset);
    expect(r1.flags.filter((f) => f.codigo === "FEBRE").map((f) => f.alvo)).toContain("paciente");
    // Negação em outra cláusula não propaga para afirmação atual de outro sintoma.
    const r2 = avaliarRedFlagsCanal(msg("Sem diarreia. Tenho febre agora."), ruleset);
    expect(r2.flags.filter((f) => f.codigo === "FEBRE").map((f) => f.alvo)).toContain("paciente");
    expect(r2.flags.filter((f) => f.codigo === "DIARREIA")).toHaveLength(0);
    // Afirmação de terceiro sem menção atual do paciente vai para contato.
    const r3 = avaliarRedFlagsCanal(msg("Minha mãe está com febre agora."), ruleset);
    expect(r3.flags.filter((f) => f.codigo === "FEBRE").map((f) => f.alvo)).toContain("contato");
    // Passado puro fica PENDENTE.
    const r4 = avaliarRedFlagsCanal(msg("Tive febre ontem."), ruleset);
    expect(r4.achados.some((a) => a.estado === "PENDENTE")).toBe(true);
    expect(r4.flags).toHaveLength(0);
  });
});
