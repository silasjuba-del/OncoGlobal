# LUNA 3 — contratos W12 e triagem desconhecida

## GOAL

Publicar os contratos pendentes W12, alinhar o ruleset e o consumidor de FC, representar histórico/início da vertigem sem inferir ausência e tornar a tontura triestado no FormTriagem, começando em `null`.

## Critérios

- [x] Tipos W12 publicados em `src/contracts/w12/regrasClinicas.ts` e exportados pelo barrel `src/contracts/w12/index.ts`; módulos de regra importam os tipos centrais e preservam reexports compatíveis.
- [x] `fcMinNaoCorta` renomeado para `fcMin` no schema, corpus e consumidor, sem alterar o valor ou o limiar.
- [x] `ecog2ComTonturaCorta` removido do contrato e do JSON; comentário de `naoCortes` corrigido. O teste de schema que esperava a chave antiga foi atualizado com autorização da Astra; as verificações clínicas do mesmo teste foram preservadas.
- [x] `Triagem` contém `vertigemHistoricoAnterior` e `vertigemInicioNovo` como `boolean | null`; fixtures e formulário mantêm ambos desconhecidos como `null`.
- [x] Formulário oferece Sim/Não/Não sei para tontura e inicia em Não sei (`null`). Cenário conhecido no teste existente informa Não explicitamente.
- [x] Nenhuma ocorrência de `PROVISORIO-W12` em `src/rules` e nos contratos/ruleset desta faixa. Ocorrências existentes no servidor são fora da faixa L3 e permanecem para L4.
- [x] Verificações concluídas com `TEST_SLOT` da Astra; sem instalação de dependências e sem alteração de regra clínica ou limiar.

## Provas executadas

- `npx tsc --noEmit` — exit 0; stdout vazio.
- `node scripts/check-boundaries.mjs` — `fronteiras ok (294 arquivos)`; exit 0.
- `node scripts/validate-corpus.mjs` — `corpus ok (125 arquivos)`; exit 0.
- `npx vitest run tests/rules tests/modules tests/contracts tests/w12-grok tests/w10-grok tests/corpus --no-file-parallelism --maxWorkers=1` — 97 arquivos e 759 testes passaram; exit 0; duração 90,11 s.
- `npx vitest run tests/ui/triagem.test.tsx --no-file-parallelism --maxWorkers=1` — 1 arquivo e 6 testes passaram; exit 0; duração 7,19 s.
- `git diff --check` — exit 0, sem saída.
- Primeira execução do teste de formulário: 1 falha no teste já existente de temperatura, pois o formulário passou a iniciar tontura como `null` e o cenário esperava destino SALAO. Corrigi somente o cenário conhecido no teste para selecionar explicitamente Não; a asserção clínica e os demais testes foram mantidos. A execução seguinte passou (resultado acima).

Logs em `docs/f0-fecha/evidencias/luna3/`.

## Arquivos

- Contratos: `src/contracts/w12/regrasClinicas.ts`, `src/contracts/w12/index.ts`, `src/contracts/regras.ts`, `src/contracts/clinico.ts`.
- Regras/corpus: `corpus/rulesets/salao-triagem.v1.json`, `src/rules/ctcaeClinico.ts`, `src/rules/retornoToxicidade.ts`, `src/rules/intervaloPosQt.ts`, `src/rules/canalRedflags.ts`, `src/rules/valorAtual.ts`, `src/rules/tontura.ts`, `src/rules/triagem.ts`.
- Formulário/fixtures/testes: `src/ui/salao/FormTriagem.tsx`, `tests/fixtures/triagem.ts`, `tests/contracts/w12-regras-clinicas.test.ts`, `tests/ui/triagem.test.tsx`.
- Ajuste fora da faixa original, autorizado pela Astra: `tests/w12-grok/grok-06-tontura.test.ts`, somente a asserção de schema obsoleta; nenhuma expectativa clínica foi relaxada.

## Dependência de integração

`src/server/rotas.ts` ainda omite `vertigemHistoricoAnterior` e `vertigemInicioNovo` do objeto que compõe `hashConteudoExibido`. A Astra registrou o ajuste como `C2-CONTRATO-01`; L4 incluirá os campos. Não bloqueia as provas isoladas de contrato e formulário desta faixa.

## BLOQUEIOS

Nenhum bloqueio local de L3. Commit único pendente; hash será comunicado à Astra para registro no relatório integrado após o commit.
