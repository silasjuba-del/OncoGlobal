// RT-12 · Harness e gateway (S0) — FALHAS reais e lacunas.
// 1) Nome de paciente em URL/caminho sem espaço (ou base64) ESCAPA ao desidentificador:
//    o casamento de nomes exige separação por espaços — PHI sai do PC sem G-02 disparar.
// 2) G-27: sanitizador de artefato (metadado de PDF: autor/paciente) não existe.
// 3) READ × WORLD_EFFECT: o gateway não distingue leitura externa de efeito (CANONICA §7).
// Dono provável: kernel/llm/desidentificar.ts + kernel/harness (tech lead).
import { describe, expect, it } from "vitest";
import { contemPhiResidual } from "../../src/kernel/llm/desidentificar.js";

const DIC = { nomes: ["Maria Alves de Souza"], identificadores: ["700000000000001"] };

async function probe(mod: string, nomes: readonly string[]): Promise<unknown> {
  try {
    const m = (await import(mod)) as Record<string, unknown>;
    for (const nome of nomes) if (typeof m[nome] === "function") return m[nome];
  } catch {
    // módulo inexistente
  }
  return null;
}

describe("RT-12 · PHI em payload de saída (G-02)", () => {
  it("PROVA DE FALHA (S0): nome codificado em URL sem espaços não é detectado como PHI", () => {
    const url = "https://exemplo.local/pacientes/MariaAlvesDeSouza/laudos";
    expect(contemPhiResidual(url, DIC),
      "desidentificar() casa nomes apenas com janelas separadas por espaço: 'MariaAlvesDeSouza' " +
      "(path de URL, nome de arquivo, base64) não é detectado — contemPhiResidual=false e o G-02 " +
      "deixaria o payload sair com nome de paciente. RT-12 exige PHI em URL barrado.")
      .toBe(true);
  });

  it("PROVA DE FALHA (S0): nome em URL com %20 é detectado só por parte — confere a fronteira", () => {
    // "%20" quebra a janela, mas partes ≥3 letras são detectadas isoladamente: "Maria", "Alves"…
    const url = "https://exemplo.local/?paciente=Maria%20Alves%20de%20Souza";
    expect(contemPhiResidual(url, DIC)).toBe(true); // defesa parcial: partes isoladas pegam
    // Já a forma invertida de token único composto escapa:
    const compacta = "https://exemplo.local/?p=MariaAlvesdeSouza";
    expect(contemPhiResidual(compacta, DIC)).toBe(true);
  });

  it("SEM_IMPLEMENTACAO: G-27 — sanitizador de artefato para saída externa (metadado PDF/DICOM)", async () => {
    const gates = (await import("../../src/kernel/harness/gates.js")) as Record<string, unknown>;
    const llm = (await import("../../src/kernel/llm/desidentificar.js")) as Record<string, unknown>;
    const gate = gates["g27SaidaExternaLimpa"] ?? gates["g27"] ?? gates["saidaExternaLimpa"];
    const sanitizador = llm["sanitizarArtefato"] ?? llm["sanitizar"] ?? llm["limparMetadados"];
    expect(gate ?? sanitizador,
      "Kimi já registrou (tests/adv-w8/g27-saida-externa-limpa.adv.ts): SanitizationReport é só " +
      "schema; nenhum sanitizador remove metadado de autor/paciente de PDF/DICOM e nenhum gate " +
      "exige relatório de sanitização antes de saída externa. Mitigação atual: egress 100% fechado " +
      "(CANAL_EXTERNO_NAO_HABILITADO). Dono: kernel/llm + kernel/harness (tech lead).")
      .toBeTypeOf("function");
  });

  it("SEM_IMPLEMENTACAO: EFFECT GATE distingue READ de WORLD_EFFECT (CANONICA §7)", async () => {
    const fn = await probe("../../src/kernel/gateway/gateway.js", ["autorizarLeitura", "readGate", "executarLeitura"]);
    expect(fn,
      "CANONICA §7/D-W9-55: 'ler Drive ou PubMed não equivale a enviar WhatsApp'. O ActionIntent só " +
      "tem verbos de EFEITO (IMPRIMIR/ENVIAR_*/AGENDAR/EXPORTAR/BACKUP): leitura externa não é " +
      "representável nem autorizada — hoje não há como ler externamente (seguro por omissão), mas " +
      "também não há gate READ quando a leitura for ligada (D-W9-15). Dono: kernel/gateway (tech lead).")
      .toBeTypeOf("function");
  });

  it("leitura externa (READ) tratada como efeito: sem verbo de leitura, nada lê fora do PC", async () => {
    const { ActionIntent } = await import("../../src/contracts/operacao.js");
    const verboLeitura = ActionIntent.safeParse({
      verbo: "LER_EXTERNO", objeto: { tipo: "PAGINA", id: "pubmed-1", versao: 1 },
      escopo: { patientId: null, encounterId: null }, destino: "https://pubmed", idempotencyKey: "chave-leitura",
    });
    expect(verboLeitura.success).toBe(false); // não existe verbo de leitura (defesa por omissão)
  });
});
