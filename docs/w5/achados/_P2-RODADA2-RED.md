# RED · P2 rodada 2 independente · bounded

Base de trabalho RED: `f0/w5-red` @ `5e1093dd78c4b170b509aa8abee5abc40454ce91` antes dos commits R2. `f0/w5-integrado` @ `43718e8` não foi reatacado aqui (etapa posterior às merges). Worktrees de corretores e fonte de produto ativa não foram editados. Sem push.

## Saídas reais

| Comando/escopo | Resultado |
|---|---|
| `npx tsc --noEmit` em RED | PASS, exit 0 após os testes R2 |
| `npx vitest run tests/adv/f07-template.adv.test.ts tests/adv/f08-vencida.adv.test.ts tests/adv/f09-arquitetura.adv.test.ts tests/adv/f11-especificacao.adv.test.ts --no-file-parallelism` (lock) | **FAIL intencional**, 4 arquivos/13 testes FAIL, exit 1; `_w5-locks/logs/20261005-222122-RED.log` |
| `npx vitest run tests/adv/f06-bordas.adv.test.ts --no-file-parallelism` (lock) | PASS, 1 arquivo/6 testes, exit 0; `_w5-locks/logs/20261005-222622-RED.log` |
| `npx vitest run tests/adv/f01-idempotencia.adv.test.ts tests/adv/f01-http-sqlite.adv.test.ts --no-file-parallelism` (lock, base RED antiga) | 3 FAIL HTTP esperados / 4 PASS limite memória, exit 1; `_w5-locks/logs/20261005-222942-RED.log`; **integrado NOT_RUN pelo RED** |
| `npx vitest run tests/w3/auditoria-regressao.test.ts --no-file-parallelism` (lock) | PASS, 1 arquivo/9 testes, exit 0; `_w5-locks/logs/20261005-222530-RED.log` |
| F5 nine mutations, baseline and G-25 HTTP control | `_F05-MUTACAO.md`: baseline 23 PASS; 9/9 targeted unit FAIL com cada gate PASSA; G-25 HTTP test 1 PASS sob mutação; todos os logs e restauração por gate registrados |
| `npm run verify` em RED | NOT_RUN: a configuração desta branch ainda inclui `tests/adv` vermelhos na suíte padrão; green do integrado reportado pelo usuário não é atribuído à branch RED |

## Causas raiz novas e dedupe

| ID | Famílias | Resultado observado | Dono |
|---|---|---|---|
| ADV-012 | F9/F11 | FNV-1a módulo ≠ SHA-256 servidor, 2 FAIL | KERNEL + coordenação DOMINIO |
| ADV-013 | F9 | scanner aceita 3 variantes sintéticas de rede fora da área permitida, 3 FAIL | arquivo congelado `scripts/check-boundaries.mjs`; orquestrador deve rotear |
| ADV-014 | F8 | `montarApacBatch` inclui `VENCIDA` em 3 cenários, 3 FAIL; **não** prova exportação | DOMINIO |
| ADV-015 | F7 | `renderizarDocumento` ignora `proibidoConter`/origem sintéticos em 3 cenários, 3 FAIL; **não** prova impressão | DOMINIO |
| ADV-016 | F6 | seis bordas decididas resistiram, 6 PASS; F6 geral ainda parcial | REGRAS |

F11 tem três ataques concretos no próprio arquivo: hash (`ADV-012`, novo), delta (`ADV-010`, mesma causa já aberta em R1) e rota bundle (`ADV-002`, mesma causa já aberta em R1). Não abrir achado duplicado para os dois últimos. F9 tem quatro ataques concretos: 1 hash e 3 probes de scanner. F5 detectou todos os nove gates **por unitário**; não transformar isso em prova de integração. Nenhum S1 F5 pelo critério "gate removível sem quebrar teste", mas consumer dos oito sem referência e resistência do teste HTTP G-25 à mutação permanecem limites explícitos.

F6 não introduziu novo valor clínico: usou cortes existentes em DECISOES/PLANO e `corpus/rulesets` já carregado nas fixtures. Ver `ADV-016`; demais bordas ficam NOT_RUN nesta entrega.

Detached de mutação `w5-mut` removida após validar raiz absoluta, Git limpo e HEAD detached; `git worktree remove` sem `--force`, `REMOVIDA=True`. Nenhuma mutação pendurada.

## Handoff ADV-001

O teste R1 que recriava `memoriaIdempotencia()` foi reclassificado como **LIMITE da memória volátil**, não como prova de falha da correção SQLite. O novo `f01-http-sqlite.adv.test.ts` conserva os três ataques de não duplicação por `/acao` e reabertura de SQLite. Detalhes, comando e log em `_ADV001-HTTP-REATACK.md`. `dd31789` já está ancestral do integrado @ `314b2ef`, mas o RED não executou o reataque lá; **NOT_RUN** até o usuário/orquestrador rodar após integrar os commits/testes RED. Nenhuma conclusão de green antecipada.
