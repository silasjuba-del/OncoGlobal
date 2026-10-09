# F0F-L04 — Flash em produção

## GOAL e critérios

- **A — caixa de configuração:** ✓ `config.flash.modeloPadrao` foi adicionada ao glossário como caixa 132, tipo existente `REGRA_CLINICA`, editável pelo médico. `lerModeloFlash` aceita somente um objeto com exatamente `laboratorio` e `imagem`, ambos booleanos; formatos inválidos retornam `null`, portanto a visão informa sem modelo salvo e não pré-marca opções. Configurações lê e grava pela Porta HTTP autenticada e pelas rotas de caixa já existentes. O servidor resolve a caixa por chave no catálogo; não há mais número injetado de teste.
- **B — prazo do retorno:** ✓ a Consulta Flash permite editar de 1 a 3650 dias; valor vazio entra no plano como `null`/PENDENTE e valor inválido impede salvar/finalizar.
- **C — tontura triestado:** ✓ responsabilidade entregue a L3; FormTriagem não foi alterado. O hash do rascunho inclui `vertigemHistoricoAnterior` e `vertigemInicioNovo`, normalizando ausência legada para `null`.
- **Compatibilidade APAC causada pela caixa nova:** ✓ `lerApacs` valida a presença das caixas APAC necessárias usando `CAMPOS_OBRIGATORIOS_PADRAO`, passa apenas caixas `apac.*` à antiglosa e mantém PENDENTE quando faltar chave obrigatória. Isso elimina a antiga dependência da contagem total do catálogo (`=== 47`), que deixava a antiglosa como `null` após a caixa Flash elevar o catálogo a 48 entradas.

## Arquivos

- `corpus/glossario/caixas.v1.json`
- `src/config/flash.ts`
- `src/server/flash.ts`
- `src/server/rotas.ts`
- `src/server/leituras.ts`
- `src/ui/api/http.ts`
- `src/ui/api/porta.ts`
- `src/ui/consulta/ConsultaFlash.tsx`
- `src/ui/oncochart/Configuracoes.tsx`
- `tests/f0-fecha/flash-producao.test.tsx`
- `tests/w12-f4/servidor-flash.test.ts` — somente catálogo/setup, sem alteração de expectativas
- `docs/f0-fecha/evidencias/luna4/**`

## Evidência executada

Todos os comandos Vitest usaram `--no-file-parallelism --maxWorkers=1`; foram executados em sequência, sem suíte completa.

| Comando | Saída real | Estado |
|---|---|---|
| `npx tsc --noEmit` | Sem diagnósticos; `EXIT_CODE=0` | PASS |
| `npx vitest run tests/f0-fecha/flash-producao.test.tsx tests/w12-f1 tests/w12-f3 tests/w12-f4 --no-file-parallelism --maxWorkers=1` | `Test Files 6 passed (6)`; `Tests 52 passed (52)` — antes do ajuste focal APAC em `src/server/leituras.ts` | PASS |
| `npx vitest run tests/w10-cursor/config.test.tsx --no-file-parallelism --maxWorkers=1` | `Test Files 1 passed (1)`; `Tests 1 passed (1)` | PASS |
| `npx vitest run tests/ui tests/ui-telas tests/ui-copy tests/muse tests/w10-cursor --no-file-parallelism --maxWorkers=1` | `Test Files 48 passed (48)`; `Tests 131 passed (131)` | PASS |
| `node scripts/check-boundaries.mjs` | `fronteiras ok (295 arquivos)` | PASS |
| `node scripts/validate-corpus.mjs` | `corpus ok (125 arquivos)` | PASS |
| `npx vitest run tests/f0-fecha/flash-producao.test.tsx tests/server/leituras-http.test.ts tests/w12-f4/servidor-flash.test.ts --no-file-parallelism --maxWorkers=1` | `Test Files 3 passed (3)`; `Tests 26 passed (26)` | PASS |
| `npx vitest run tests/server tests/e2e tests/apac --no-file-parallelism --maxWorkers=1` | `Test Files 18 passed (18)`; `Tests 82 passed (82)` | PASS |

Saídas completas e códigos de saída ficam em `docs/f0-fecha/evidencias/luna4/`. A prova focal valida que uma caixa `config.*` adicional não entra no catálogo entregue à antiglosa e que a remoção de uma chave obrigatória resulta em `PENDENTE`. A rota HTTP existente também continuou verde com o catálogo Flash real e sem `numeroCaixaModeloFlash` injetado.

## Tentativas e correções registradas

- A primeira prova Flash/W12 teve 50/52. O teste de formato inesperado demonstrou que o store genérico deve continuar aceitando valores `REGRA_CLINICA` bem formados como objeto para que o consumidor Flash faça o fallback seguro; a regra estrita foi mantida em `lerModeloFlash`, não no serviço genérico. A outra falha era a leitura do catálogo via `import.meta.url` sob o ambiente jsdom; a prova passou a validar o arquivo do corpus com o schema `CaixaNumerada`.
- A primeira prova do bloco UI teve 130/131 porque o novo aviso Flash acrescentava um segundo elemento com role `status` à tela de Configurações. O aviso agora usa `aria-live="polite"` sem duplicar aquele role; o teste focado e o bloco UI completo passaram.
- A primeira prova do bloco servidor revelou a ligação indevida entre o total de caixas e a antiglosa. A reprodução isolada repetiu a falha (`antiglosa: null` no lugar de `{ exportavel: false }`); a correção semântica foi aplicada em `src/server/leituras.ts`, e a prova HTTP original permaneceu intacta e passou depois da correção.

## Limites

- **NOT_RUN:** suíte completa da missão e baterias não designadas a L4.
- O componente Configurações recebe a porta por prop. Montagem na porta local real fica para Astra/C2, conforme distribuição e `LACUNAS-C2.md`; não alterei `OncoassistLocal`, `App`, bootstrap ou `vite.config.ts`.
- A correção de montagem real de `TelaConsulta` não integra esta faixa. A Astra identificou que a timeline atualmente renderiza dados sintéticos incondicionalmente e tratará isso em C2.
- Sem decisão clínica, dependência nova, push ou merge.

## Commit

`F0F-L04: Flash em produção`, com trailer `Co-Authored-By: gpt-6-luna`. O hash final é informado no handoff; como este relatório faz parte do próprio commit, não pode conter uma auto-referência estável ao seu hash.
