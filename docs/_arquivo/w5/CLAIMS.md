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
| 2026-10-05 22:10 | LIBERA | `vite.config.ts` | E2E-UI | INFRA-01 | 631e1b0 |
| 2026-10-05 22:10 | LIBERA | `tests/e2e/infra.test.ts` | E2E-UI | INFRA-01 | 631e1b0 |
| 2026-10-05 22:10 | LIBERA | `tests/e2e/fixtures/vite.config.ts` | E2E-UI | INFRA-01 | 631e1b0 |
| 2026-10-05 22:10 | LIBERA | `tests/e2e/fixtures/tests/adv/probe.test.ts` | E2E-UI | INFRA-01 | 631e1b0 |
| 2026-10-05 22:10 | LIBERA | `tests/e2e/pipeline.test.tsx` | E2E-UI | COB-F4 | ba76bbe |
| 2026-10-05 22:15 | RESERVA | `tests/server/adv006-saida.evidence.ts` | KERNEL | ADV-006 | |
| 2026-10-05 22:16 | LIBERA | `tests/server/adv006-saida.test.ts` | KERNEL | ADV-006 | EVIDENCIA_RENOMEADA_SEM_COMMIT |
| 2026-10-05 22:17 | RESERVA | `tests/ledger/adv001-idempotencia.test.ts` | KERNEL | ADV-001 | |
| 2026-10-05 22:18 | RESERVA | `vite.config.ts` | E2E-UI | INFRA-01 | |
| 2026-10-05 22:18 | RESERVA | `src/kernel/ledger/idempotencia.ts` | KERNEL | ADV-001 | |
| 2026-10-05 22:18 | RESERVA | `src/kernel/ledger/schema.ts` | KERNEL | ADV-001 | |
| 2026-10-05 22:18 | RESERVA | `src/kernel/gateway/gateway.ts` | KERNEL | ADV-001 | |
| 2026-10-05 22:18 | RESERVA | `src/server/rotas.ts` | KERNEL | ADV-001 | |
| 2026-10-05 22:19 | LIBERA | `src/rules/delta.ts` | REGRAS | ADV-010 | 1c11a5f |
| 2026-10-05 22:19 | LIBERA | `tests/rules/adv-010-delta.test.ts` | REGRAS | ADV-010 | 1c11a5f |
| 2026-10-05 22:21 | RESERVA | `tests/server/server.test.ts` | KERNEL | ADV-001 | |
| 2026-10-05 22:22 | LIBERA | `vite.config.ts` | E2E-UI | INFRA-01 | 129ad1a |
| 2026-10-05 22:26 | LIBERA | `src/kernel/ledger/idempotencia.ts` | KERNEL | ADV-001 | dd31789f186ea862baa67b10d0cb96aefa4110bc |
| 2026-10-05 22:26 | LIBERA | `src/kernel/ledger/schema.ts` | KERNEL | ADV-001 | dd31789f186ea862baa67b10d0cb96aefa4110bc |
| 2026-10-05 22:26 | LIBERA | `src/kernel/gateway/gateway.ts` | KERNEL | ADV-001 | dd31789f186ea862baa67b10d0cb96aefa4110bc |
| 2026-10-05 22:26 | LIBERA | `src/server/rotas.ts` | KERNEL | ADV-001 | dd31789f186ea862baa67b10d0cb96aefa4110bc |
| 2026-10-05 22:26 | LIBERA | `tests/ledger/adv001-idempotencia.test.ts` | KERNEL | ADV-001 | dd31789f186ea862baa67b10d0cb96aefa4110bc |
| 2026-10-05 22:26 | LIBERA | `tests/server/server.test.ts` | KERNEL | ADV-001 | dd31789f186ea862baa67b10d0cb96aefa4110bc |
| 2026-10-05 22:29 | RESERVA | `tests/kernel/adv005-phi.test.ts` | KERNEL | ADV-005 | |
| 2026-10-05 22:29 | RESERVA | `src/kernel/llm/desidentificar.ts` | KERNEL | ADV-005 | |
| 2026-10-05 22:30 | RESERVA | `tests/modules/adv014-vencida.test.ts` | DOMINIO | ADV-014 | |
| 2026-10-05 22:30 | RESERVA | `src/modules/apac/lote.ts` | DOMINIO | ADV-014 | |
| 2026-10-05 22:32 | LIBERA | `tests/kernel/adv005-phi.test.ts` | KERNEL | ADV-005 | 560cfbad7d61dfc05ffc2c3e98cc06a90b8fef1c |
| 2026-10-05 22:32 | LIBERA | `src/kernel/llm/desidentificar.ts` | KERNEL | ADV-005 | 560cfbad7d61dfc05ffc2c3e98cc06a90b8fef1c |
| 2026-10-05 22:33 | RESERVA | `tests/modules/render.test.ts` | DOMINIO | ADV-015 | |
| 2026-10-05 22:33 | RESERVA | `src/server/rotas.ts` | KERNEL | ADV-002 | |
| 2026-10-05 22:33 | RESERVA | `tests/server/bundle.test.ts` | KERNEL | ADV-002 | |
| 2026-10-05 22:33 | RESERVA | `tests/server/http-fixture.ts` | KERNEL | ADV-002 | |
| 2026-10-05 22:36 | LIBERA | `src/server/rotas.ts` | KERNEL | ADV-002 | 969092e5b528c1d5242f3df2d1e7ab2df158dac7 |
| 2026-10-05 22:36 | LIBERA | `tests/server/bundle.test.ts` | KERNEL | ADV-002 | 969092e5b528c1d5242f3df2d1e7ab2df158dac7 |
| 2026-10-05 22:36 | LIBERA | `tests/server/http-fixture.ts` | KERNEL | ADV-002 | 969092e5b528c1d5242f3df2d1e7ab2df158dac7 |
| 2026-10-05 22:37 | RESERVA | `src/server/rotas.ts` | KERNEL | ADV-003 | |
| 2026-10-05 22:37 | RESERVA | `tests/server/adv003-json.test.ts` | KERNEL | ADV-003 | |
| 2026-10-05 22:38 | LIBERA | `tests/modules/adv014-vencida.test.ts` | DOMINIO | ADV-014 | 0616b06 |
| 2026-10-05 22:38 | LIBERA | `src/modules/apac/lote.ts` | DOMINIO | ADV-014 | 0616b06 |
| 2026-10-05 22:40 | RESERVA | `tests/e2e/pipeline.test.tsx` | E2E-UI | ADV-015 | |
| 2026-10-05 22:41 | LIBERA | `src/server/rotas.ts` | KERNEL | ADV-003 | ee9ddd5a51dc37b28da1243bb419f53588530edf |
| 2026-10-05 22:41 | LIBERA | `tests/server/adv003-json.test.ts` | KERNEL | ADV-003 | ee9ddd5a51dc37b28da1243bb419f53588530edf |
| 2026-10-05 22:41 | RESERVA | `src/server/rotas.ts` | KERNEL | ADV-004 | |
| 2026-10-05 22:41 | RESERVA | `tests/server/adv004-content-type.test.ts` | KERNEL | ADV-004 | |
| 2026-10-05 22:43 | LIBERA | `tests/e2e/pipeline.test.tsx` | E2E-UI | ADV-015 | 450ee8f |
| 2026-10-05 22:44 | LIBERA | `src/server/rotas.ts` | KERNEL | ADV-004 | c7303217426e47e5e2dee62a6103feb6ca229bf4 |
| 2026-10-05 22:44 | LIBERA | `tests/server/adv004-content-type.test.ts` | KERNEL | ADV-004 | c7303217426e47e5e2dee62a6103feb6ca229bf4 |
| 2026-10-05 22:48 | RESERVA | `tests/modules/adv012-hash.test.ts` | DOMINIO | ADV-012 | |
| 2026-10-05 22:48 | RESERVA | `src/modules/tipos.ts` | DOMINIO | ADV-012 | |
| 2026-10-05 22:48 | RESERVA | `src/kernel/projections/snapshot.ts` | KERNEL | ADV-011 | |
| 2026-10-05 22:48 | RESERVA | `tests/projections/adv011-determinismo.test.ts` | KERNEL | ADV-011 | |
| 2026-10-05 22:51 | LIBERA | `src/kernel/projections/snapshot.ts` | KERNEL | ADV-011 | 0846a30092028f2015208bfb465e07741d04a30e |
| 2026-10-05 22:51 | LIBERA | `tests/projections/adv011-determinismo.test.ts` | KERNEL | ADV-011 | 0846a30092028f2015208bfb465e07741d04a30e |
| 2026-10-05 22:52 | LIBERA | `tests/modules/adv012-hash.test.ts` | DOMINIO | ADV-012 | 53a2c59 |
| 2026-10-05 22:52 | LIBERA | `src/modules/tipos.ts` | DOMINIO | ADV-012 | 53a2c59 |
| 2026-10-05 22:52 | LIBERA | `tests/modules/render.test.ts` | DOMINIO | ADV-012 | 53a2c59 |
| 2026-10-05 22:55 | RESERVA | `tests/rules/adv-009-ambiguidade.test.ts` | REGRAS | ADV-009 | |
| 2026-10-05 22:55 | RESERVA | `tests/rules/adv-016-bordas.test.ts` | REGRAS | ADV-016 | |
| 2026-10-05 22:55 | RESERVA | `src/server/sessao.ts` | KERNEL | ADV-012 | |
| 2026-10-05 22:55 | RESERVA | `tests/server/adv012-hash.test.ts` | KERNEL | ADV-012 | |
| 2026-10-05 22:57 | LIBERA | `tests/rules/adv-009-ambiguidade.test.ts` | REGRAS | ADV-009 | f61cd81 |
| 2026-10-05 22:57 | LIBERA | `tests/rules/adv-016-bordas.test.ts` | REGRAS | ADV-016 | cbeda2a |
| 2026-10-05 22:59 | LIBERA | `src/server/sessao.ts` | KERNEL | ADV-012 | b3d544b0780a286b7f6a33e15c6ecee5aa64fd2d |
| 2026-10-05 22:59 | LIBERA | `tests/server/adv012-hash.test.ts` | KERNEL | ADV-012 | b3d544b0780a286b7f6a33e15c6ecee5aa64fd2d |
| 2026-10-05 23:09 | RESERVA | `tests/kernel/adv-resistiu-idempotencia.test.ts` | KERNEL | COB-G20 | |
| 2026-10-05 23:09 | RESERVA | `tests/server/adv001-http-incerto.test.ts` | KERNEL | COB-G20 | |
| 2026-10-05 23:11 | RESERVA | `src/modules/consulta/preConsulta.ts` | DOMINIO | ADV-017 | |
| 2026-10-05 23:11 | RESERVA | `tests/modules/adv017-preconsulta.test.ts` | DOMINIO | ADV-017 | |
| 2026-10-05 23:11 | RESERVA | `tests/modules/preConsulta.test.ts` | DOMINIO | ADV-017 | |
| 2026-10-05 23:14 | LIBERA | `tests/kernel/adv-resistiu-idempotencia.test.ts` | KERNEL | COB-G20 | 4f2fc0bfa3c841d1bce93666d576d0e12319b795 |
| 2026-10-05 23:14 | LIBERA | `tests/server/adv001-http-incerto.test.ts` | KERNEL | COB-G20 | 4f2fc0bfa3c841d1bce93666d576d0e12319b795 |
| 2026-10-05 23:14 | RESERVA | `src/kernel/projections/snapshot.ts` | KERNEL | ADV-018 | |
| 2026-10-05 23:14 | RESERVA | `tests/projections/adv018-historico.test.ts` | KERNEL | ADV-018 | |
| 2026-10-05 23:14 | RESERVA | `tests/projections/adv019-tempo.test.ts` | KERNEL | ADV-019 | |
| 2026-10-05 23:17 | LIBERA | `src/modules/consulta/preConsulta.ts` | DOMINIO | ADV-017 | 909d02c |
| 2026-10-05 23:17 | LIBERA | `tests/modules/adv017-preconsulta.test.ts` | DOMINIO | ADV-017 | 909d02c |
| 2026-10-05 23:17 | LIBERA | `tests/modules/preConsulta.test.ts` | DOMINIO | ADV-017 | 909d02c |
| 2026-10-05 23:18 | LIBERA | `src/kernel/projections/snapshot.ts` | KERNEL | ADV-018 | 4a3a08236fc97c1e2799cc1f0341aceb52c5b95b |
| 2026-10-05 23:18 | LIBERA | `tests/projections/adv018-historico.test.ts` | KERNEL | ADV-018 | 4a3a08236fc97c1e2799cc1f0341aceb52c5b95b |
| 2026-10-05 23:18 | RESERVA | `src/kernel/projections/snapshot.ts` | KERNEL | ADV-019 | |
| 2026-10-05 23:18 | LIBERA | `src/kernel/projections/snapshot.ts` | KERNEL | ADV-019 | 30d42402885a93852808ed3df2eb1aa9bcadb6b4 |
| 2026-10-05 23:18 | LIBERA | `tests/projections/adv019-tempo.test.ts` | KERNEL | ADV-019 | 30d42402885a93852808ed3df2eb1aa9bcadb6b4 |
| 2026-10-05 23:19 | RESERVA | `tests/e2e/pipeline.test.tsx` | E2E-UI | COB-F4-HTTP | |
| 2026-10-05 23:22 | LIBERA | `tests/e2e/pipeline.test.tsx` | E2E-UI | COB-F4-HTTP | e5977aaa4b29c7e65f676829809340fa7061df7d |
| 2026-10-05 23:24 | RESERVA | `src/rules/intervaloQt.ts` | REGRAS | ADV-020 | |
| 2026-10-05 23:24 | RESERVA | `tests/rules/adv020-fuso-qt.test.ts` | REGRAS | ADV-020 | |
| 2026-10-05 23:24 | RESERVA | `tests/rules/adv020-data-civil.test.ts` | REGRAS | ADV-020 | |
| 2026-10-05 23:24 | RESERVA | `tests/w3/w3.test.ts` | REGRAS | ADV-020 | |
| 2026-10-05 23:24 | RESERVA | `tests/w3/bordas.test.ts` | REGRAS | ADV-020 | |
| 2026-10-05 23:24 | RESERVA | `tests/w3/integracao.test.ts` | REGRAS | ADV-020 | |
| 2026-10-05 23:31 | LIBERA | `src/rules/intervaloQt.ts` | REGRAS | ADV-020 | d357b96c4e8519b8264842478fd3f46465d0fb4e |
| 2026-10-05 23:31 | LIBERA | `tests/rules/adv020-fuso-qt.test.ts` | REGRAS | ADV-020 | d357b96c4e8519b8264842478fd3f46465d0fb4e |
| 2026-10-05 23:31 | LIBERA | `tests/rules/adv020-data-civil.test.ts` | REGRAS | ADV-020 | d357b96c4e8519b8264842478fd3f46465d0fb4e |
| 2026-10-05 23:31 | LIBERA | `tests/w3/w3.test.ts` | REGRAS | ADV-020 | d357b96c4e8519b8264842478fd3f46465d0fb4e |
| 2026-10-05 23:31 | LIBERA | `tests/w3/bordas.test.ts` | REGRAS | ADV-020 | d357b96c4e8519b8264842478fd3f46465d0fb4e |
| 2026-10-05 23:31 | LIBERA | `tests/w3/integracao.test.ts` | REGRAS | ADV-020 | d357b96c4e8519b8264842478fd3f46465d0fb4e |
