# W3-GROK — progresso de execução

Worktree `w3-grok`, branch `f0/w3-grok` (base `f0/w1-integrado`). Escopo: `src/modules/**`, `tests/modules/**`.
Executado por Claude Sonnet após queda do Grok (o código não commitado do Grok foi revisado, completado e aproveitado). Apenas fixtures sintéticas.

| Fatia | Estado | Commit | Verificação | Pendências |
|---|---|---|---|---|
| GRK-01 PRE-CONSULT PACK | FEITA | `884a995` | verde (ver abaixo) | [VERIFICAR] fonte dos prazos D85/D90 é injetada; tipos locais de snapshot a alinhar com a projeção real na integração |
| GRK-02 bundles | FEITA | `a9a20be` | verde | [VERIFICAR] conteúdo clínico dos 4 manifestos vem do pack (não embutido) |
| GRK-03 fechamento | FEITA | `f2bf855` | verde | — |
| GRK-04 render | FEITA | `65f3f9b` | verde | [VERIFICAR] hash é FNV-1a 64 local (não criptográfico); integrar ao hash do ledger se exigido |
| GRK-05 substituição de drafts | FEITA | `87b4ca0` | verde | — |
| GRK-06 farmácia D9 | FEITA | `b15b65c` | verde | [VERIFICAR] recusa do médico mantém CORRECAO_PEDIDA (teto de 5 estados; sem estado novo) |
| GRK-07 chip de estoque | FEITA | `f53dd10` | verde | [VERIFICAR] validade (dias) do dado de estoque injetada com fonte |
| GRK-08 ApacBatch | FEITA | `3a6c7d4` | verde | [VERIFICAR] nomenclatura oficial/SIGTAP da finalidade APAC |
| GRK-09 vínculo do canal | FEITA | `e512605` | verde | — |
| GRK-10 testes + pureza | FEITA | commit desta atualização (ver `git log`) | verde | — |

## Arquivos criados

src/modules: `tipos.ts`, `consulta/{preConsulta,bundles,fechamento}.ts`, `documentos/{render,substituicao}.ts`, `farmacia/estados.ts`, `estoque/chip.ts`, `apac/lote.ts`, `canal/vinculo.ts`.
tests/modules: `fixtures.ts`, `preConsulta`, `bundles`, `fechamento`, `render`, `substituicao`, `farmacia`, `chip`, `lote`, `vinculo`, `pureza` (`*.test.ts`).

## Verificação

`npm run typecheck && npm run check:boundaries && npx vitest run --no-file-parallelism` (sem paralelismo por falta de RAM): 29 arquivos, 199 testes passando; fronteiras ok (53 arquivos).
