# RED · P5 final (encerramento da terceira rodada)

Baseline de limpeza: integrado `09fe4bb`, com correções ADV017 (`909d02c`), ADV018 (`4a3a082`), ADV019 (`30d4240`) e promoção `4f2fc0b`. ORQ confirmou verify real: **82 arquivos / 452 testes PASS**, exit0, log `_w5-locks/logs/20261005-232218-ORQ.log`.

| Prova retirada de tests/adv | Equivalente regular conferido | Expectativa preservada |
|---|---|---|
| f01-idempotencia.adv.test.ts (3 LIMITE) | tests/kernel/adv-resistiu-idempotencia.test.ts | memória nova EXECUTADA/2 efeitos fake; limite explicitamente preservado |
| f01-http-sqlite.adv.test.ts (1 incerto) | tests/server/adv001-http-incerto.test.ts | reabrir SQLite conserva OUTCOME_UNKNOWN/1 chamada |
| f11-preconsulta.adv.test.ts (3) | tests/modules/adv017-preconsulta.test.ts | omissão PERSISTE/PENDENTE; mesmo fato persiste; novo fato MUDOU sem direção |
| f10-historico-tempo.adv.test.ts (6) | tests/projections/adv018-historico.test.ts + adv019-tempo.test.ts | histórico igual antes/depois correção futura; offsets equivalentes incluídos; controles positivos |
| f10-fuso-qt.adv.test.ts (3) | tests/rules/adv020-fuso-qt.test.ts + adv020-data-civil.test.ts | mesmo instante→civil05/30VERDE; offset-06→civil06/29VERMELHO; offset obrigatório injetado |

Os cinco arquivos foram retirados somente depois de integração GREEN e leitura das assertions regulares. ADV020 foi provado em `9db145d` (3 FAIL, log232213-RED) e corrigido/promovido por REGRAS `d357b96`, integrado em `c29cc8b`. ORQ confirmou84arquivos/476testesPASS log233104-ORQ; RED conferiu as3mesmas expectativas em tests/rules/adv020-fuso-qt.test.ts, mais 21 testes de conversão/bordas em adv020-data-civil.test.ts, e retirou f10-fuso-qt somente após esse GREEN. Nenhum teste foi relaxado, nenhum contrato alterado pelo RED, nenhum valor clínico criado.

**Escopo preservado:** negativos ADV006 (4), ADV007 (2), ADV008 (1), ADV013 (3); infra HTTP e runner F5. Estes 10 negativos são bloqueados/ambiguidades e não podem ser apagados para tornar ataque verde.

**Limites:** mapa P1 registra 52 G/INV (7 COBERTO, 40 PARCIAL, 4 SEM_TESTE, 1 FORA_DO_F0). Mutações F5 detectadas nos 9 unitários, sem comprovação de integração de todos consumers. Contagem mínima acumulada de 3 ataques por família não estabelece execução completa de todos vetores da família. Backup novo, HD físico, restauração em outra máquina, impressão física e uso clínico: NOT_RUN.

Reataque final após ADV020 integrado e limpeza: **3 arquivos / 10 FAIL / 0 PASS**, somente os negativos preservados; log `_w5-locks/logs/20261005-233747-RED.log`, exit1. Complemento F5: `_F05-IMPLICITOS-FINAL.md`, 7 bypasses adicionais detectados, bytes/SHA restaurados e detached removido. Verify regular final serial (typecheck + fronteiras + corpus + Vitest): **84 arquivos / 476 testes PASS**, fronteiras80/corpus20, exit0; log `_w5-locks/logs/20261005-233947-RED.log`, duração126.21s. Auditoria9 incluída na suíte completa; ORQ executará isolada no integrado após merge final. Fonte ativa REDe981456 não contém mudanças de implementação em relação ao integrado c29cc8b; contratos/package/tsconfig/scanner/auditoria congelados sem diff.
