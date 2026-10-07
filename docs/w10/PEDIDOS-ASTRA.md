# W10 — pedidos e dependencias fora da cadeia Astra

Base verificada: `04b53db31598fb80ff78192d4cd3eafde36428fd`. Nao editar contratos/faixas alheias para esconder falhas. Sem alteracao de expectativas dos testes existentes.

## Falhas adversariais anteriores a estas dez fatias

Comando: `validar.ps1 -Rotulo BASELINE-ADVERSARIAL-W8 -SoTestes -ConfigVitest tests/adv-w8/vitest.config.ts -Testes tests/adv-w8`.
Resultado real: 9 arquivos, 41 testes, 36 PASS / 5 FAIL, todos `SEM_IMPLEMENTACAO`.

| Pedido | Teste / comportamento ausente | Dono segundo W10-COMUM | Contencao |
|---|---|---|---|
| EXT01 | caso07-dedupe: motor de deduplicacao de exames | Fugu, src/leitura | Nao declarar deduplicacao implantada. |
| EXT02 | fn16-t34: semaforo de interacoes | Grok, src/rules | Ausencia de motor nao significa ausencia de interacao. |
| EXT03 | k26-n17: carregar ficha aprovada inteira por id/versao/hash | Grok, src/modules, com curadoria medica | Rascunhos nao viram ficha aprovada. |
| EXT04 | n19: gate executavel de manifesto antes de merge | Grok, scripts/verificar-manifesto.mjs | Root revisa paths/diff; isto nao substitui o gate automatico do projeto. |
| EXT05 | t56-g16: ownership de escrita em runtime | Grok, src/kernel/harness/ownership.ts | Nao habilitar escrita arbitraria por agente. |

Os gates G-07/G-08/G-09/G-27 passaram no mesmo reataque focal. O PASS de gates isolados nao prova composicao nem fechamento dos cinco pedidos.

Logs completos em `C:\Users\silas\Projects\OncoGlobal-wt\_w10-astra\logs\20261007-025647-576-BASELINE-ADVERSARIAL-W8.log.vitest.txt`.
