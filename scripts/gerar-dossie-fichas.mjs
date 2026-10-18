// F1-B2 · Gera a apresentação legível para revisão médica a partir do ARTEFATO (corpus/fichas/**)
// e do manifesto de evidências (b2-fichas.v1.json) — única fonte manual é o próprio gerador.
// Uso: node scripts/gerar-dossie-fichas.mjs  → docs/ondas/F1-B2-QUADROS.md (gerado; não editar à mão)
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const m = JSON.parse(readFileSync(join(RAIZ, "corpus/manifesto/b2-fichas.v1.json"), "utf8"));

const linhas = [];
linhas.push("# F1-B2 · Quadros de revisão das fichas B2 (GERADO — não editar à mão)", "",
  "> Gerado por `scripts/gerar-dossie-fichas.mjs` a partir de `corpus/fichas/**` + `corpus/manifesto/b2-fichas.v1.json` (D-F1-49).",
  "> Toda ficha está em **RASCUNHO**: nada aqui está ativo clinicamente; aprovação é item a item (versão/hash).",
  `> Fontes externas com URL/versão/SHA-256 em b2-fichas.v1.json; evidências em bytes: pastas de 2026-10-14 (f1-b2-fontes-externas).`,
  "");

const porTumor = new Map();
for (const f of m.fichasNovas) {
  const tumor = f.templateId.split(".")[1];
  if (!porTumor.has(tumor)) porTumor.set(tumor, []);
  porTumor.get(tumor).push(f);
}
for (const [tumor, fichas] of porTumor) {
  linhas.push(`## ${tumor.toUpperCase()}`, "");
  for (const f of fichas) {
    const json = JSON.parse(readFileSync(join(RAIZ, f.arquivo), "utf8"));
    linhas.push(`### ${json.nome} — ${json.cenario}`, "",
      `- **templateId:** \`${json.templateId}\` · **versão:** ${json.versao} · **hash:** ver 'corpus/manifesto/b2-fichas.v1.json' (chave templateId) · **status:** ${json.status}${json.codigoInstitucional ? ` · **código:** ${json.codigoInstitucional}` : ""}`,
      `- **Intervalo:** ${json.intervaloDias ?? "— [VERIFICAR]"} d · **Ciclos:** ${json.ciclos ?? "—"}`,
      `- **Identidade clínica:** ${f.identidadeClinica}`,
      `- **Fonte da ficha:** ${json.fonte.replace(/\s+/g, " ").slice(0, 600)}${json.fonte.length > 600 ? " …" : ""}`,
      "",
      "| # | Item | Classe | Dose | Unid. | Base | Via | Diluente | Vol. | Tempo | Dias | Situação | Fontes |",
      "|---|------|--------|------|-------|------|------|----------|------|-------|------|----------|--------|");
    const porCampo = new Map(f.campos.map((c) => [c.campo, c]));
    for (const i of json.itens) {
      const chave = `itens[drug=${i.drug};classe=${i.classe};days=${i.days.join(",")}].standardDose`;
      const c = porCampo.get(chave);
      if (!c) throw new Error(`CAMPO_SEM_EVIDENCIA:${f.templateId}:${chave}`);
      const sit = c?.situacao === "NAO_LOCALIZADO" ? "**NAO_LOCALIZADO**" : c?.situacao === "DOCUMENTADO_POR_DECISAO_LOCAL" ? `DECISÃO LOCAL (${c.decisaoLocal})` : c?.situacao === "DOCUMENTADO" ? "documentado" : "padrão local";
      const fontes = c?.sourceIds?.length ? c.sourceIds.map((s) => `\`${s}\``).join(" ") : "—";
      linhas.push(`| ${i.sequence} | ${i.drug} | ${i.classe} | ${i.standardDose ?? "**null**"} | ${i.unit} | ${i.doseBasis} | ${i.route} | ${i.diluent ?? "—"} | ${i.finalVolumeMl ?? "—"} | ${i.infusionTime ?? "—"} | ${i.days.join(", ")} | ${sit} | ${fontes} |`);
    }
    linhas.push("");
    const sequencias = [...new Set(json.itens.map(i => i.sequenciamentoPendente).filter(Boolean))];
    if (sequencias.length) linhas.push("**Sequenciamento pendente (impede emissão automática):**", ...sequencias.map(s => `- ${s}`), "");
    if (f.divergencias.length) linhas.push(`**Divergências registradas:**`, ...f.divergencias.map((d) => `- ${d}`), "");
    if (f.lacunas.length) linhas.push(`**Lacunas (impedem ativação):**`, ...f.lacunas.map((d) => `- ${d}`), "");
    if (json.itens.some((i) => i.observacao?.includes("[VERIFICAR]"))) linhas.push("> ⚠️ Itens com `[VERIFICAR]` nesta ficha permanecem pendentes — a ficha é dossiê de curadoria até decisão.", "");
  }
}
linhas.push("## Fichas alteradas (fontes acrescentadas, doses intactas)", "");
for (const a of m.fichasAlteradas) linhas.push(`- \`${a.templateId}\` (${a.caminho}) — ${a.motivo}; fontes: ${a.fontesAcrescentadas.join(", ")}`);
linhas.push("", "## Destinação dos códigos legados", "");
for (const [cod, dest] of Object.entries(m.destinacaoCodigosLegado)) linhas.push(`- **${cod}:** ${dest}`);
linhas.push("", "---", `Gerado em ${new Date().toISOString()} · aprovacaoClinica: **null** (todas as fichas) — D-F1-49.`);
writeFileSync(join(RAIZ, "docs/ondas/F1-B2-QUADROS.md"), linhas.join("\n") + "\n", "utf8");
console.log(`docs/ondas/F1-B2-QUADROS.md gerado (${m.fichasNovas.length} fichas novas, ${m.fichasAlteradas.length} alteradas).`);
