# RED · P2 rodada 1 · entrega parcial (não é conclusão W5)

Base de ataque: `f0/w5-red` @ `6b96702d07ac4a3cfe7b6f02f154cd3edb6641e0` antes dos commits RED. Apenas `tests/adv/**` e `docs/w5/achados/**` alterados. Nenhum dado real; executores HTTP são fakes e o servidor escuta somente loopback.

## Saída observada

| Execução | Resultado |
|---|---|
| `npx tsc --noEmit` | PASS · exit 0 após edição dos testes |
| `npx vitest run tests/adv --no-file-parallelism`, via `vitest-lock.ps1` | **FAIL intencional** · 7 arquivos failed / 1 passed; 22 testes failed / 9 passed (31); exit 1; log `_w5-locks/logs/20261005-212449-RED.log` |
| `git diff --check` | PASS · exit 0 |
| `npm run verify` em branch RED | NOT_RUN: `vite.config.ts` do RED ainda não exclui `tests/adv`; rodá-lo aqui incorporaria vermelhos deliberados. O `verify` P0 do orquestrador foi verde na sua base, **não** prova os testes RED. |
| `npx vitest run tests/w3/auditoria-regressao.test.ts --no-file-parallelism`, via lock | PASS · 1 arquivo/9 testes, exit 0; log `_w5-locks/logs/20261005-212852-RED.log` |

## Achados e cobertura, não deduplicar por número de testes

| Família | Provas | Resultado | Achados por causa raiz |
|---|---:|---|---|
| F1 idempotência | 3 ataques + 1 controle | 3 FAIL / 1 PASS | ADV-001 S0 |
| F2 ambiguidade | 3 controles adversariais | 3 PASS | ADV-009 RESISTIU |
| F3 rotas | 3 ataques + 2 controles | 3 FAIL / 2 PASS | ADV-002 S2, ADV-003 S2, ADV-004 S2 |
| F4 PHI | 3 ataques + 1 controle | 3 FAIL / 1 PASS | ADV-005 S1 (egress real NÃO demonstrado) |
| F5 mutação | 0 | NOT_RUN | leitura de consumers em `_P1-MATRIZ-RED.md` não substitui mutação |
| F6 regras/delta | 3 ataques + 1 controle | 3 FAIL / 1 PASS | ADV-010 S1; demais cortes clínicos NÃO cobertos |
| F7 documentos/saída | 4 ataques HTTP com executor fake | 4 FAIL | ADV-006 S0 (ação externa não executada de fato) |
| F8 lotes | 3 ataques + 1 controle | 3 FAIL / 1 PASS | ADV-007 AMB, ADV-008 AMB; proibir multipaciente exige clarificação |
| F9 arquitetura estática | 0 | NOT_RUN | busca de consumers documentada é somente P1, não F9 completo |
| F10 replay/projeção | 3 ataques | 3 FAIL | ADV-011 S2; backup/WAL/restauração NÃO cobertos |
| F11 especificação × código | 0 | NOT_RUN | W4-04/D-W5-01 pede trilho real de instante→civil, não reproduzido sem inventar API |

Prioridade para triagem: ADV-006 (HTTP→fake executa referência inexistente), ADV-001 (reinício com store em memória), ADV-005 (sanitizador/gate deixam nascimento residual), ADV-010 (conflito rebaixado), ADV-002 (HTTP 404 mas confirmação sem bundle fica 409, portanto não atribuir assinatura indevida). ADV-007/008 dependem de decisão sobre o escopo de lote; não tratar expectativa provisória como decisão clínica.

Gates G-02/03/05/10/13/14/23/26 têm testes unitários existentes, mas a busca de referências em `src/**` encontrou somente as definições; G-25 tem consumer de confirmação. A prova concreta aqui é HTTP→gateway→executor fake para ADV-006 e HTTP 404/409 para ADV-002. O resto é suspeita de ausência de consumer, não afirmação de bug. F5 mutação será prova separada.
