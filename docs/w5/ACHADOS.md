# W5 · Índice de achados (consolidado pelo orquestrador)

Fonte de cada achado: `docs/w5/achados/ADV-NNN.md` (formato §5.1). Este índice é a visão de triagem (P3).

| ID | Família | Sev. | Dono | Estado | duplicadoDe | Commit de correção | Teste de prova / teste regular |
|---|---|---|---|---|---|---|---|
| ADV-001 | F1 | S0 | KERNEL | CORRIGIDO | — | `dd31789` (merge `314b2ef`) | `tests/adv/f01-http-sqlite.adv.test.ts` / `tests/ledger/adv001-idempotencia.test.ts` |
| ADV-002 | F3 | S2 | KERNEL | CORRIGIDO | — | `969092e` (merge `6e5a66a`) | `tests/adv/f03-rotas.adv.test.ts` / `tests/server/bundle.test.ts` |
| ADV-003 | F3 | S2 | KERNEL | CORRIGIDO | — | `ee9ddd5` (merge `61bca1c`) | `tests/adv/f03-rotas.adv.test.ts` / `tests/server/adv003-json.test.ts` |
| ADV-004 | F3 | S2 | KERNEL | CORRIGIDO | — | `c730321` (merge `61bca1c`) | `tests/adv/f03-rotas.adv.test.ts` / `tests/server/adv004-content-type.test.ts` |
| ADV-005 | F4 | S1 | KERNEL | CORRIGIDO | — | `560cfba` (merge `7d65942`) | `tests/adv/f04-phi.adv.test.ts` / `tests/kernel/adv005-phi.test.ts` |
| ADV-006 | F7 | S0 | KERNEL | BLOQUEADO_CONTRATO | — | — | `tests/adv/f07-saida.adv.test.ts` / CP-001 pendente |
| ADV-007 | F8 | S0 potencial | DOMINIO | AMB-001 | — | — | `tests/adv/f08-lotes.adv.test.ts` / aguardando contrato |
| ADV-008 | F8 | S1 potencial | DOMINIO | AMB-002 | — | — | `tests/adv/f08-lotes.adv.test.ts` / aguardando contrato |
| ADV-009 | F2 | S3 | REGRAS | RESISTIU | — | não se aplica | `tests/adv/f02-ambiguidade.adv.test.ts` / promoção pendente |
| ADV-010 | F6 | S1 | REGRAS | CORRIGIDO | — | `1c11a5f` (merge `3c0d45f`) | `tests/adv/f06-delta.adv.test.ts` / `tests/rules/adv-010-delta.test.ts` |
| ADV-011 | F10 | S2 | KERNEL | CORRIGIDO | — | `0846a30` (merge `61c1891`) | `tests/adv/f10-replay.adv.test.ts` / `tests/projections/adv011-determinismo.test.ts` |
| ADV-012 | F9/F11 | S2 | KERNEL + DOMINIO | CORRIGIDO | — | `53a2c59` + `b3d544b` (merges `c5f8681`/`700f3ee`) | `tests/adv/{f09-arquitetura,f11-especificacao}.adv.test.ts` / `tests/modules/adv012-hash.test.ts` + `tests/server/adv012-hash.test.ts` |
| ADV-013 | F9 | S1 | tech lead (arquivo congelado) | BLOQUEADO_CONTRATO | — | — | `tests/adv/f09-arquitetura.adv.test.ts` / CP-002 pendente |
| ADV-014 | F8 | S1 | DOMINIO | CORRIGIDO | — | `0616b06` (merge `48db259`) | `tests/adv/f08-vencida.adv.test.ts` / `tests/modules/adv014-vencida.test.ts` |
| ADV-015 | F7 | S1 | DOMINIO | CORRIGIDO | — | `6238615` (merge `48db259`) | `tests/adv/f07-template.adv.test.ts` / `tests/modules/adv015-template.test.ts` |
| ADV-016 | F6 | S3 | REGRAS | RESISTIU | — | não se aplica | `tests/adv/f06-bordas.adv.test.ts` / promoção pendente |

**Triagem atual:** **16 achados** — 0 ABERTO, 10 CORRIGIDO (001/002/003/004/005/010/011/012/014/015), 2 BLOQUEADO_CONTRATO/ESCOPO (006 S0, 013 S1), 2 AMB (007/008) e 2 RESISTIU (009/016). Reataque amplo no integrado antes da limpeza RED: **53 testes, 10 FAIL/43 PASS** em 14 arquivos, log `_w5-locks/logs/20261005-230124-ORQ.log`. As dez falhas remanescentes são exclusivamente ADV-006 (4), ADV-007 (2), ADV-008 (1), ADV-013 (3), não dez causas diferentes. Último verify 77 arquivos/435 testes, log `_w5-locks/logs/20261005-230022-ORQ.log`. `ADV-007/008` continuam ambiguidades, não autorização para mudar o contrato do lote.
