# W8-GLM · RELATÓRIO DE PROGRESSO (EXECUTOR = GLM)

> Onda W8 · worktree `w8-glm` · branch `f0/w8-glm`. Retomada: continue da primeira fatia não FEITA abaixo.
> Papel da faixa: estrutura, versionamento e teste de microprompts/rulesets/packs — **nenhum conteúdo clínico novo**; valores não decididos = `[VERIFICAR]`.

## Tabela das 10 fatias
| Fatia | Estado | Commit | Verify (resumo real) | Pendências |
|---|---|---|---|---|
| GLM-11 · RADS@1.1.0 resumo em 2 níveis | FEITA | 34d1c4b | tsc ok · fronteiras ok (81) · corpus ok (20) · tests/prompts+corpus+w3 59/59 | — |
| GLM-12 · PATH@1.1.0 por sítio | FEITA | 6de515b | tsc ok · fronteiras ok (81) · corpus ok (20) · 65/65 | critérios de agregação = GLM-16 |
| GLM-13 · DOCID@1.0.0 | FEITA | edc6af5 | tsc ok · fronteiras ok (81) · corpus ok (20) · 70/70 | tokenização da entrada (ver perguntas) |
| GLM-14 · CAPTURA@1.0.0 | FEITA | a136e87 | tsc ok · fronteiras ok (81) · corpus ok (20) · 75/75 | idem GLM-13 |
| GLM-15 · ruleset identificadores.v1.json | FEITA | 54844ce | tsc ok · fronteiras ok (81) · corpus ok (21, 8 `[VERIFICAR]` no arquivo) · 80/80 | normas oficiais CPF/CNS `[VERIFICAR]`; algoritmo DV e início CNS `[VERIFICAR]` |
| GLM-16 · ruleset patologia-agregacao.v1.json | FEITA | ead32ad | tsc ok · fronteiras ok (81) · corpus ok (22, 8 `[VERIFICAR]`) · 84/84 | todo critério `[VERIFICAR]` (Dr. Silas) |
| GLM-17 · ruleset dedupe-exame.v1.json | FEITA | 1752ab4 | tsc ok · fronteiras ok (81) · corpus ok (23) · 89/89 | ativação + tipo de fonte DECISAO_TECNICA (ver perguntas) |
| GLM-18 · pack próstata v1.1.0 | FEITA | d21c2d1 | tsc ok · fronteiras ok (81) · corpus ok (23, 19 `[VERIFICAR]` no pack) · 94/94 | critérios clínicos dos 5 elementos + marcadores `[VERIFICAR]` |
| GLM-19 · capabilities v1.1.0 | FEITA | 3545cfd | tsc ok · fronteiras ok (81) · corpus ok (23) · 96/96 | wiring extractor `[VERIFICAR]` (tabela do Maestro); prompts AG-21/22/23 `[VERIFICAR]` |
| GLM-20 · fechamento | FEITA | (este commit) | tsc ok · fronteiras ok (81) · corpus ok (23 arquivos) · tests/prompts+corpus+w3-regressão 96/96 | ver perguntas abaixo |

## Arquivos criados/modificados (só a faixa W8-GLM)
**Prompts (`corpus/prompts/`)** — 1.0.0 intactos:
- `RADS@1.1.0.md` (novo) · `PATH@1.1.0.md` (novo) · `DOCID@1.0.0.md` (novo) · `CAPTURA@1.0.0.md` (novo)

**Rulesets (`corpus/rulesets/`)** — todos `ativo:false`:
- `identificadores.v1.json` (novo) · `patologia-agregacao.v1.json` (novo) · `dedupe-exame.v1.json` (novo)

**Packs/capabilities:**
- `corpus/packs/prostata.v1.json` → v1.1.0 (estrutura de estadiamento/marcadores, sem valores)
- `corpus/capabilities.v1.json` → v1.1.0 (prompts novos em `metadados.planejado`; AG-21/22/23 DISABLED)

**Testes (`tests/prompts/`, `tests/corpus/`):**
- Novos: `path-sitios.test.ts`, `docid.test.ts`, `captura.test.ts`, `identificadores.test.ts`, `patologia-agregacao.test.ts`, `dedupe-exame.test.ts`, `prostata-w8.test.ts`
- `prompts.test.ts` (G-04 ampliado para todo o diretório `corpus/prompts`) e `capabilities.test.ts` atualizados — nenhuma asserção enfraquecida; todas as provas anteriores seguem passando.

## Saída real do fechamento (GLM-20)
```
$ npx tsc --noEmit                        → (sem erros)
$ npm run check:boundaries                → fronteiras ok (81 arquivos)
$ npm run check:corpus                    → corpus ok (23 arquivos)
   novos: identificadores 8 [VERIFICAR] · patologia-agregacao 8 · dedupe-exame 0 ·
          prostata 19 · capabilities 41 — todos com 0 ativos
$ npx vitest run tests/prompts tests/corpus tests/w3/auditoria-regressao.test.ts --no-file-parallelism
   Test Files  20 passed (20)
        Tests  96 passed (96)
```
Nenhum `git push`; nenhum arquivo fora da faixa tocado; contratos, `package.json`, CANONICA etc. intocados.

## Invariantes respeitadas
Microprompts sem número de corte (G-04, teste varre o diretório todo); LLM nunca agrega grau do caso, nunca valida DV, nunca fecha TNM/RECIST; negação e `nao_descrito ≠ ausente` preservados; QR code nunca seguido; trecho riscado sem valor; rótulo nunca decide tipo de identificador; `phiAllowed` nunca true; só estrutura em rulesets (`ativo:false`).

## Perguntas ao tech lead
1. **`DECISAO_TECNICA` fora do enum congelado:** `RulesetHeader.fonte.tipo` (C-18/G-17) só aceita `DECISAO_MEDICA|DIRETRIZ|NORMA|LITERATURA`. No `dedupe-exame.v1.json` o **header** ficou `DECISAO_MEDICA` com referência explicando a origem técnica, e as **fontes por item** usam `DECISAO_TECNICA` (não validadas por enum, com `trecho` citando a lição). Quer adicionar `DECISAO_TECNICA` ao contrato (só o tech lead edita `src/contracts/**`) ou manter esse padrão híbrido?
2. **Ativação do `dedupe-exame.v1.json`:** a decisão técnica existe (caso real 01, D1–D3). Mantive `ativo:false` porque a faixa W8 manda "só estrutura" e não há consumidor ainda. Ativar é decisão sua.
3. **Entrada de DOCID/CAPTURA:** os prompts ficaram neutros quanto a receberem valor literal × token `⟨ID_n⟩` (a política depende do provedor, Q52 aberto, e da sanitização do pipeline). Ao definir o wiring, confirme o contrato de entrada; o texto atual suporta os dois.
4. **Wiring semântico:** atribuí `CAPTURA@1.0.0` ao AG-01 (intake) e `DOCID@1.0.0` ao AG-13 (document). Confirme na tabela do Maestro; trocar é um campo em `metadados.planejado`.
5. **`identificadores.v1.json`:** nome das normas oficiais de CPF/CNS pendente do que você confirmar (não inventei portaria); algoritmo de DV (CPF), regras de início e DV do CNS ficaram `[VERIFICAR]`.
6. **`patologia-agregacao.v1.json`:** os três critérios do "grau do caso" aguardam o Dr. Silas (P2).
