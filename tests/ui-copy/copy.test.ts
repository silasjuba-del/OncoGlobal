// W8-MUSE · MU-03 · o catálogo de microcopy não carrega decisão clínica:
// chaves únicas, texto sempre presente, nenhum número de corte clínico,
// avisos legais exatos, sem jargão de TI, sem nome de pessoa/instituição.
import { describe, expect, it } from "vitest";
import { COPY_PT_BR } from "../../src/ui/copy/pt-BR.js";

type Entrada = { caminho: string; texto: string };

function achatar(no: unknown, prefixo: string, saida: Entrada[]): void {
  if (typeof no === "string") {
    saida.push({ caminho: prefixo, texto: no });
    return;
  }
  if (typeof no === "object" && no !== null) {
    for (const [chave, valor] of Object.entries(no)) {
      achatar(valor, prefixo === "" ? chave : `${prefixo}.${chave}`, saida);
    }
  }
}

function entradas(): Entrada[] {
  const saida: Entrada[] = [];
  achatar(COPY_PT_BR, "", saida);
  return saida;
}

// Números NÃO clínicos com uso aprovado (timeout de produto, não corte).
const NUMEROS_PERMITIDOS = new Set([
  "Desligar toda a IA por 30 min",
  "Desligar toda a IA agora e operar manual por 30 min?",
  "Ver em 3D",
]);

// Padrões de corte clínico que nunca entram em microcopy (Q21–24, Q34–35,
// D-W5-02, kit do médico): temperatura, PA, peso, prazos, hemograma, ECOG.
const CORTES_CLINICOS = [
  /37[,.]\s?8/,
  /\b160\b/,
  /\b90\b/,
  /1500/,
  /\b85\b/,
  /\d+\s*(°C|mmHg|kg\b|mg\b|mL\b|dias?\b|meses?\b|semanas?\b)/i,
  /G[0-5]\b/,
  /ECOG\s*\d/i,
];

const JARGÃO_TI = [
  "deploy", "backend", "frontend", "endpoint", "payload", "toggle",
  "render", "browser", "fallback", "cache", "mock", "parse", "http", "url",
];

const NOMES_PROPRIOS = ["hospital do bem", "silas", "janduhy", "patos"];

describe("microcopy pt-BR (MU-03)", () => {
  it("tem chaves únicas em camelCase", () => {
    const lista = entradas();
    expect(lista.length).toBeGreaterThan(50);
    const caminhos = lista.map((e) => e.caminho);
    expect(new Set(caminhos).size).toBe(caminhos.length);
    for (const caminho of caminhos) {
      for (const parte of caminho.split(".")) {
        expect(parte).toMatch(/^[a-z][a-zA-Z0-9]*$/);
      }
    }
  });

  it("traz as chaves pedidas pelo Cursor (PEDIDOS 01-04)", () => {
    const mapa = new Map(entradas().map((e) => [e.caminho, e.texto]));
    const pedidas: Record<string, string> = {
      "navegacao.salao": "Salão",
      "navegacao.canal": "Canal",
      "navegacao.consulta": "Consulta",
      "app.diaNoite": "Dia / noite",
      "app.buscarOncoChart": "Buscar pacientes, exames, protocolos…",
      "app.alertasClinicos": "Alertas clínicos",
      "app.modoDia": "Modo dia",
      "app.modoNoite": "Modo noite",
      "app.usuario": "Usuário",
      "consulta.flash": "Consulta Flash",
      "consulta.alergiaPendente": "Alergia PENDENTE",
      "consulta.negaAlergias": "Nega alergias",
      "cadastro.titulo": "Cartão de cadastro",
      "timeline.titulo": "Linha do tempo oncológica",
      "timeline.ver3d": "Ver em 3D",
      "abas.visaoGeral": "Visão geral",
      "abas.quimioterapia": "Quimioterapia",
      "abas.dadosClinicos": "Dados clínicos",
      "abas.evolucao": "Evolução",
      "cards.protocolos": "Protocolos ativos",
      "cards.documentos": "Documentos recentes",
      "cards.estadiamento": "Estadiamento e avaliações",
      "cards.rascunho": "Rascunho de evolução",
      "cards.caixaUnica": "Soltar PDF/Word — caixa única",
    };
    for (const [chave, texto] of Object.entries(pedidas)) {
      expect(mapa.get(chave), chave).toBe(texto);
    }
  });

  it("não tem texto vazio", () => {
    for (const { caminho, texto } of entradas()) {
      expect(typeof texto).toBe("string");
      expect(texto.trim().length, caminho).toBeGreaterThan(0);
    }
  });

  it("não tem número de corte clínico", () => {
    for (const { caminho, texto } of entradas()) {
      for (const corte of CORTES_CLINICOS) {
        expect(texto, `${caminho} contém corte clínico`).not.toMatch(corte);
      }
      if (/\d/.test(texto)) {
        expect(NUMEROS_PERMITIDOS.has(texto), `${caminho}: número novo precisa de aprovação`).toBe(true);
      }
    }
  });

  it("traz os avisos legais exatos", () => {
    expect(COPY_PT_BR.avisosLegais.iaNaoSubstitui).toBe(
      "As respostas da IA não substituem o julgamento clínico",
    );
    expect(COPY_PT_BR.avisosLegais.cabecalhoExemplo.toLowerCase()).toContain(
      "cabeçalho de exemplo: altere",
    );
    expect(COPY_PT_BR.avisosLegais.capacidadeNaoHabilitada).toBe("Capacidade não habilitada");
    expect(COPY_PT_BR.avisosLegais.rascunhoNaoValido).toBe("RASCUNHO — NÃO VÁLIDO");
    expect(COPY_PT_BR.revisao.naoValido).toBe("RASCUNHO — NÃO VÁLIDO");
    expect(COPY_PT_BR.erros.comandoIncompleto.toLowerCase()).toContain("comando incompleto");
  });

  it("não tem jargão de TI nem nome de pessoa/instituição", () => {
    for (const { caminho, texto } of entradas()) {
      const baixo = texto.toLowerCase();
      for (const termo of JARGÃO_TI) {
        expect(baixo, `${caminho} tem jargão "${termo}"`).not.toContain(termo);
      }
      for (const nome of NOMES_PROPRIOS) {
        expect(baixo, `${caminho} tem nome próprio`).not.toContain(nome);
      }
    }
  });
});
