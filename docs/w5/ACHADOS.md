# W5 · Índice de achados (consolidado pelo orquestrador)

Fonte de cada achado: `docs/w5/achados/ADV-NNN.md` (formato §5.1). Este índice é a visão de triagem (P3).

| ID | Família | Sev. | Dono | Estado | duplicadoDe | Commit de correção | Teste de prova / teste regular |
|---|---|---|---|---|---|---|---|
| ADV-001 | F1 | S0 | KERNEL | ABERTO | — | — | `tests/adv/f01-idempotencia.adv.test.ts` / pendente |
| ADV-002 | F3 | S2 | KERNEL | ABERTO | — | — | `tests/adv/f03-rotas.adv.test.ts` / pendente |
| ADV-003 | F3 | S2 | KERNEL | ABERTO | — | — | `tests/adv/f03-rotas.adv.test.ts` / pendente |
| ADV-004 | F3 | S2 | KERNEL | ABERTO | — | — | `tests/adv/f03-rotas.adv.test.ts` / pendente |
| ADV-005 | F4 | S1 | KERNEL | ABERTO | — | — | `tests/adv/f04-phi.adv.test.ts` / pendente |
| ADV-006 | F7 | S0 | KERNEL | ABERTO | — | — | `tests/adv/f07-saida.adv.test.ts` / pendente |
| ADV-007 | F8 | S0 potencial | DOMINIO | AMB-001 | — | — | `tests/adv/f08-lotes.adv.test.ts` / aguardando contrato |
| ADV-008 | F8 | S1 potencial | DOMINIO | AMB-002 | — | — | `tests/adv/f08-lotes.adv.test.ts` / aguardando contrato |
| ADV-009 | F2 | S3 | REGRAS | RESISTIU | — | não se aplica | `tests/adv/f02-ambiguidade.adv.test.ts` / promoção pendente |
| ADV-010 | F6 | S1 | REGRAS | ABERTO | — | — | `tests/adv/f06-delta.adv.test.ts` / atribuído |
| ADV-011 | F10 | S2 | KERNEL | ABERTO | — | — | `tests/adv/f10-replay.adv.test.ts` / pendente |

**Rodada 1 (antes da correção):** 8 ABERTO, 2 AMB e 1 RESISTIU. São 11 causas registradas, não 22 causas: a execução RED teve 22 FAIL deliberados e 9 PASS em 31 testes. `ADV-007/008` não autorizam, por si, mudar o contrato de lote. Fonte: commits RED `683c10d`…`5e1093d` e log `_w5-locks/logs/20261005-212449-RED.log`; integração em `f0/w5-integrado` ainda pendente nesta anotação.
