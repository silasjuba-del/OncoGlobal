# W5 · CLAIMS — semáforo de arquivos (§6.1)

Fonte única: este arquivo no worktree do orquestrador (`w5-orq`). Escreva **só** via `docs/w5/ferramentas/claim.ps1`.
Regra: antes de editar, RESERVA; ao commitar, LIBERA com o hash. Arquivo de outra trilha: **não edite**, peça ao orquestrador (seção "Pedidos").

## Registro
| Quando (−03:00) | Ação | Arquivo | Agente | Achado | Commit |
|---|---|---|---|---|---|

## Pedidos entre trilhas (roteados pelo orquestrador)
| Quando | Pedinte | Arquivo | Dono | Motivo | Destino |
|---|---|---|---|---|---|
| 2026-10-05 19:26 | RESERVA | `vite.config.ts` | E2E-UI | INFRA-01 | |
| 2026-10-05 21:19 | RESERVA | `tests/e2e/infra.test.ts` | E2E-UI | INFRA-01 | |
| 2026-10-05 21:19 | RESERVA | `tests/e2e/fixtures/tests/adv/probe.test.ts` | E2E-UI | INFRA-01 | |
| 2026-10-05 21:19 | RESERVA | `tests/e2e/pipeline.test.tsx` | E2E-UI | COB-F4 | |
| 2026-10-05 21:21 | RESERVA | `tests/apac/apac-prazo-cob.test.ts` | REGRAS | COB-FN-12 | |
| 2026-10-05 21:21 | RESERVA | `tests/apac/apac-retrograda-cob.test.ts` | REGRAS | COB-FN-13 | |
| 2026-10-05 21:21 | RESERVA | `tests/rules/delta-pendente-cob.test.ts` | REGRAS | COB-FN-14 | |
| 2026-10-05 21:21 | RESERVA | `tests/identity/g01-vinculo.test.ts` | KERNEL | COB-G-01 | |
| 2026-10-05 21:21 | RESERVA | `tests/projections/n10-ruleset-historico.test.ts` | KERNEL | COB-N10 | |
| 2026-10-05 21:21 | RESERVA | `tests/backup/k23-fronteiras.test.ts` | KERNEL | COB-K-23 | |
| 2026-10-05 21:21 | RESERVA | `tests/e2e/fixtures/vite.config.ts` | E2E-UI | INFRA-01 | |
| 2026-10-05 21:22 | RESERVA | `tests/modules/n16-substituicao-cob.test.ts` | DOMINIO | COB-N16 | |
| 2026-10-05 21:22 | RESERVA | `tests/corpus/k12-folha-operacional-cob.test.ts` | DOMINIO | COB-K-12 | |
| 2026-10-05 21:22 | RESERVA | `tests/corpus/g17-packs-cob.test.ts` | DOMINIO | COB-G-17 | |
| 2026-10-05 21:22 | RESERVA | `tests/modules/q36-lote-cob.test.ts` | DOMINIO | COB-Q36 | |
| 2026-10-05 21:25 | LIBERA | `tests/projections/n10-ruleset-historico.test.ts` | KERNEL | COB-N10 | SEM_EDICAO_AGUARDANDO_RED |
| 2026-10-05 21:25 | LIBERA | `tests/apac/apac-prazo-cob.test.ts` | REGRAS | COB-FN-12 | e639c55 |
| 2026-10-05 21:25 | LIBERA | `tests/apac/apac-retrograda-cob.test.ts` | REGRAS | COB-FN-13 | d2b01e1 |
| 2026-10-05 21:25 | LIBERA | `tests/rules/delta-pendente-cob.test.ts` | REGRAS | COB-FN-14 | 3c9cc85 |
| 2026-10-05 21:30 | RESERVA | `src/rules/delta.ts` | REGRAS | ADV-010 | |
| 2026-10-05 21:30 | RESERVA | `tests/rules/adv-010-delta.test.ts` | REGRAS | ADV-010 | |
| 2026-10-05 21:31 | LIBERA | `tests/identity/g01-vinculo.test.ts` | KERNEL | COB-G-01 | 820a0e6 |
| 2026-10-05 21:31 | LIBERA | `tests/backup/k23-fronteiras.test.ts` | KERNEL | COB-K-23 | 73c6661 |
| 2026-10-05 21:31 | LIBERA | `tests/modules/n16-substituicao-cob.test.ts` | DOMINIO | COB-N16 | a78aff6 |
| 2026-10-05 21:31 | LIBERA | `tests/corpus/k12-folha-operacional-cob.test.ts` | DOMINIO | COB-K-12 | 46809af |
| 2026-10-05 21:31 | LIBERA | `tests/corpus/g17-packs-cob.test.ts` | DOMINIO | COB-G-17 | d655ad7 |
| 2026-10-05 21:31 | LIBERA | `tests/modules/q36-lote-cob.test.ts` | DOMINIO | COB-Q36 | 7911f9c |
| 2026-10-05 21:32 | RESERVA | `tests/server/adv006-saida.test.ts` | KERNEL | ADV-006 | |
