# RED · limpeza P5 sobre 700f3ee

Reataque pós-limpeza: 14 testes, 10 FAIL/4 PASS; log `_w5-locks/logs/20261005-230952-RED.log`, exit 1. Mantidos os 10 negativos ADV006 (4), ADV007 (2), ADV008 (1), ADV013 (3), fixture HTTP e runner F5.

| Removido | Equivalente regular lido (assertion preservada) |
|---|---|
| F02 ADV009 (3) | tests/rules/adv-009-ambiguidade.test.ts: candidatos=2, nome não liga, identificadores em conflito |
| F03 ADV002/003/004 (5) | tests/server/bundle.test.ts: rota+hash e BUNDLE_NAO_EXIBIDO; adv003-json.test.ts:400; adv004-content-type.test.ts:tipo+401 |
| F04 ADV005 (4) | tests/kernel/adv005-phi.test.ts: mesmas formas de nascimento/residual |
| F06 ADV016 (6) | tests/rules/adv-016-bordas.test.ts: mesmos cortes e emergência |
| F06 ADV010 (4) | tests/rules/adv-010-delta.test.ts: mesmas 3 preservações; tests/projections/delta.test.ts: linha de base não inventa delta (null→itens vazios) |
| F07 ADV015 (3) | tests/modules/adv015-template.test.ts: mesmos 3 templates/origens proibidas |
| F08 ADV014 (3) | tests/modules/adv014-vencida.test.ts: mesmas 3 exclusões |
| F08 duplicata ADV008 (1) | tests/modules/lote.test.ts: borda id repetido não elege; q36-lote-cob.test.ts: duplicatas excluídas |
| F09 hash ADV012 (1) | tests/server/adv012-hash.test.ts + tests/modules/adv012-hash.test.ts: fonte única SHA canônico |
| F10 ADV011 (3) | tests/projections/adv011-determinismo.test.ts: mesmos 3 replays |
| F11 ADV012/010/002 (3) | testes regulares acima: mesma função e producer HTTP bundle |
| F01 replay memória (1) | tests/ledger/adv001-idempotencia.test.ts: mesmo processo REPLAY/chamadas=1 |
| F01 HTTP replay+payload (2) | tests/ledger/adv001-idempotencia.test.ts: /acao SQLite após reinício REPLAY e payload distinto409/efeitos=1 |

**4 verdes mantidos até promoção confirmada:** 3 controles LIMITE da store em memória; 1 HTTP OUTCOME_UNKNOWN após reabertura. KERNEL recebeu pedido e está promovendo para `tests/kernel/adv-resistiu-idempotencia.test.ts` e `tests/server/adv001-http-incerto.test.ts`. Não remover antecipadamente.

Sem edição de implementação, contratos, expectativas ou documentos WIP do ORQ. A limpeza não fecha ADV006/007/008/013.
