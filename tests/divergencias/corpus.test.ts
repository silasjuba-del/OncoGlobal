import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CorpusDivergencias } from "../../src/contracts/divergencia.js";
import { carregarDivergenciasMama } from "../../src/kernel/corpus/divergencias.js";
import { avaliarDivergencias } from "../../src/rules/divergencia.js";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { lerDraft, salvarDraft, listarDrafts } from "../../src/kernel/comandos/portas.js";
import { hashCanonico } from "../../src/modules/hash.js";

let remover: (() => void) | undefined;
afterEach(() => { remover?.(); remover = undefined; });
describe("F2 corpus documental", () => {
  it("registra as 30 entradas abertas, IDs estáveis e nenhuma decisão clínica", () => {
    const { corpus, corpusHash } = carregarDivergenciasMama();
    expect(corpus.divergencias).toHaveLength(30);
    expect(new Set(corpus.divergencias.map(d => d.id)).size).toBe(30);
    expect(corpus.divergencias.every(d => d.estado === "ABERTA" && d.decisao === null)).toBe(true);
    expect(corpus.divergencias.every(d => d.polos.length >= 2)).toBe(true);
    expect(corpusHash).toMatch(/^[a-f0-9]{64}$/);
    expect(corpus.fontes.every(f => f.estado === "NAO_VERIFICADO")).toBe(true);
  });
  it("cartões históricos e de aula continuam rascunhos, sem dose de RT aprovada", () => {
    const { corpus } = carregarDivergenciasMama();
    expect(corpus.cartoes).toHaveLength(10);
    expect(corpus.cartoes.every(c => c.estado === "RASCUNHO" && c.dosesRtAprovadas === false)).toBe(true);
    const loco = corpus.cartoes.find(c => c.id === "MAMA-LOCORREGIONAL")!;
    expect(loco.fontes).toContain("LIVRO-2018");
    expect(JSON.stringify(loco.conteudo)).toContain("NAO_EXTRAIDO");
    const gestacao = corpus.cartoes.find(c => c.id === "MAMA-GESTACAO-LACTACAO")!;
    expect(gestacao.fontes).toEqual(["AULA-41"]);
    expect(gestacao.limites.join(" ")).toContain("PROP");
    expect(gestacao.conteudo.originaisConferidos).toBe(false);
    expect(JSON.stringify(gestacao.conteudo)).toContain("POSITIVE");
    expect(corpus.divergencias.find(d => d.id === "DIV-GESTACAO-14SEM")!.cartaoIds).toContain(gestacao.id);
  });
  it("recusa transcrição NCCN inclusive por ID de fonte sem prefixo NCCN", () => {
    const { corpus } = carregarDivergenciasMama();
    const fonte = corpus.fontes.find(f => f.tipo === "NCCN")!;
    const original = fonte.id; fonte.id = "ALIAS-EXTERNO";
    for (const d of corpus.divergencias) for (const p of d.polos) if (p.fonteId === original) p.fonteId = fonte.id;
    for (const c of corpus.cartoes) c.fontes = c.fontes.map(id => id === original ? fonte.id : id);
    expect(CorpusDivergencias.safeParse(corpus).success).toBe(true);
    corpus.divergencias[0]!.polos.find(p => p.fonteId === fonte.id)!.natureza = "TRANSCRICAO";
    expect(CorpusDivergencias.safeParse(corpus).success).toBe(false);
  });
  it("fonte órfã e localizador vazio são erros; NAO_VERIFICADO permanece explícito", () => {
    const { corpus } = carregarDivergenciasMama();
    corpus.divergencias[0]!.polos[0]!.fonteId = "inexistente";
    expect(CorpusDivergencias.safeParse(corpus).success).toBe(false);
    const c = carregarDivergenciasMama().corpus;
    c.divergencias[0]!.polos[0]!.localizador = "";
    expect(CorpusDivergencias.safeParse(c).success).toBe(false);
    expect(c.divergencias.some(d => d.polos.some(p => p.localizador === "NAO_VERIFICADO"))).toBe(true);
  });
  it("persistência existente conserva snapshots de avaliação e decisão sem reescrever o anterior", () => {
    const dir = mkdtempSync(join(tmpdir(), "onco-divergencias-")), arquivo = join(dir, "sintetico.sqlite");
    let db = abrirLedger(arquivo);
    remover = () => { db.close(); rmSync(dir, { recursive: true, force: true }); };
    const { corpus, corpusHash } = carregarDivergenciasMama();
    const contexto = { patientId: "SINTETICO-A", encounterId: "ENCONTRO-A", tumorLotId: null };
    const d = corpus.divergencias.find(d => d.id === "DIV-ABEMA")!;
    const ctx = { cartaoId: "MAMA-I-III-LUMINAL", contexto, dadosDecisivosDisponiveis: true, itensComDose: [] };
    const avaliacaoAnterior = avaliarDivergencias([d], ctx);
    const salvar = (id: string, payload: unknown) => salvarDraft(db, { draftId: id, patientId: contexto.patientId, sourceId: d.id,
      rawRef: corpusHash, payload, revision: 0, criadoEm: "2026-11-01T12:00:00Z", diagnostics: [] });
    salvar("avaliacao-sintetica-v1", { corpusHash, avaliacao: avaliacaoAnterior });
    const primeiro = lerDraft(db, "avaliacao-sintetica-v1")!;
    const decidida = { ...d, estado: "DECIDIDA" as const, decisao: { poloEscolhido: d.polos[0]!.id, decididoPor: "MEDICO-SINTETICO", crm: "CRM-SINTETICO",
      data: "2026-11-01T12:01:00Z", motivo: "Motivo exclusivamente sintético", contexto,
      assinatura: { documentId: "DOC-SINTETICO", documentVersion: 1, eventId: "EV-SINTETICO", revisao: "ASSINADO" as const } } };
    const hashNovo = hashCanonico({ ...corpus, divergencias: corpus.divergencias.map(x => x.id === d.id ? decidida : x) });
    expect(hashNovo).not.toBe(corpusHash);
    salvar("decisao-sintetica-v2", { corpusHash: hashNovo, avaliacao: avaliarDivergencias([decidida], ctx) });
    db.close(); db = abrirLedger(arquivo);
    expect(lerDraft(db, "avaliacao-sintetica-v1")).toEqual(primeiro);
    expect((lerDraft(db, "decisao-sintetica-v2")!.payload as { corpusHash: string }).corpusHash).toBe(hashNovo);
    expect(listarDrafts(db, contexto.patientId)).toHaveLength(2);
    const outro = avaliarDivergencias([decidida], { ...ctx, contexto: { ...contexto, patientId: "SINTETICO-B" } });
    expect(outro[0]!.poloAplicado).toBeNull();
  });
});
