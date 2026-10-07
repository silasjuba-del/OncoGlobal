# Reauditoria de 23937b2 — correções e novas detecções

Data: 2026-10-07. Base: `23937b2c2aa7716a21b26a72f83502b00b619a40`.
Checkout verificado: `C:\Users\silas\Projects\OncoGlobal-wt\w10-astra`, branch `codex/w10-entrega-integrada`, remote `silasjuba-del/OncoGlobal`.
A pasta inicial `_w10-astra` contém artefatos e não é repositório Git. Os diretórios não rastreados `.playwright-cli/` e `output/` foram preservados. Nenhum push, merge ou deploy nesta rodada.

## Correções

| Achado | Alteração e prova |
|---|---|
| P1: bundle vazio permite confirmar fato não exibido | Todos os registros precisam de referência exibida, seleção e hash servidor, ligados ao draft de origem. Fatos genéricos recebem referência de exibição e continuam confirmáveis após revisão, sem assinatura documental. Regressões HTTP conferem ausência de eventos, operação e incremento de revisão nas negativas. |
| P1: nomes inéditos saem pelo Jev | O texto livre fica local. Após desidentificação e verificação residual, o serviço constrói somente rótulos fixos de presença de marcadores documentais, em ordem fixa, sem nomes, valores, datas, trechos, IDs, contagens ou caminhos. A prova percorre HTTP → serviço real → transporte injetado. Fontes sem marcadores ficam PENDENTE sem chamada externa. |
| P2: período depende da grafia do offset | Início da administração convertido por `dataCivilDoServico` para -03:00. Bordas de meia-noite em Z e -03 dão resultado idêntico. Versão da projeção alterada para `W10-REAUDITORIA-03`. |
| Ausência de consumidor da revisão | Tela local `/oncoassist.html` monta `RevisaoExtracaoLocal`, lista fontes já vinculadas, mostra o original, permite seleção, prepara o resumo e só confirma no segundo clique. Alterar seleção elimina a prova; troca de contexto descarta estado/respostas; duplo clique não duplica operação. Funciona sem Jev habilitado. |

## Detecções adicionais corrigidas

1. Confirmação aceitava fato/documento oculto junto de documento exibido, documento desmarcado e registro repetido. Os sete ataques HTTP originais retornaram 200 antes da correção; passam a retornar 409 atomicamente.
2. Comprovante podia ser reaproveitado para outro lote, ou outro draft com o mesmo documentId/versão/conteúdo. A prova agora inclui contexto completo e identidade do draft.
3. Duas representações do mesmo instante criavam conflito fictício da mesma administração. A chave comparativa normaliza início/fim para instante; divergências reais permanecem conflito.
4. O resumo preparado já afirmava revisão médica e era agregado à evolução antes de confirmar. A redação agora descreve seleção para revisão; o leitor distingue `somentePreparada` e `revisaoRegistrada` pelo ledger, preserva o draft e não inclui preparações abandonadas no resumo agregado. Evidência adicional no teste UI → HTTP → SQLite.
5. Expiração durante Jev retornava erro de contexto, sem acionar o tratamento de sessão expirada do cliente. A rota revalida a sessão após aguardar o provedor e retorna 401.

## Verificação executada

Somente fixtures sintéticos, transporte Jev offline e testes serializados. Nenhuma chamada real ao provedor.

| Comando | Resultado |
|---|---|
| `npm.cmd run typecheck` | PASS |
| `npm.cmd run check:boundaries` | PASS — 250 arquivos |
| `npm.cmd run check:corpus` | PASS — 116 arquivos; pendências `[VERIFICAR]` continuam declaradas |
| `npm.cmd run ui:build` | PASS — advertência de externalização de `node:crypto` em `src/modules/tipos.ts`; não é prova de funcionamento de todos os módulos da demonstração |
| `node node_modules/vitest/vitest.mjs run tests/server tests/oncoassist-jev tests/oncoassist-local tests/w10-eixo-servidor tests/w10-eixo-temporal tests/w10-entrega tests/w10-luna4 tests/w10-luna2 tests/w3/auditoria-regressao.test.ts --no-file-parallelism` | PASS — 37 arquivos, 243 testes |
| `node node_modules/vitest/vitest.mjs run --config tests/redteam/vitest.config.ts --no-file-parallelism` | FAIL — 216 PASS / 10 FAIL, 28 arquivos |
| `git diff --check` | PASS |

Os testes positivos antigos de bundle passaram a informar lote explícito; os dois testes de servidor que fabricavam comprovante em memória agora usam exibição HTTP real. O positivo de fatos deixou de aceitar bundle vazio: exibe ambos os fatos antes de confirmar e conserva as verificações de GRAVADA, REPLAY e ausência de impressão implícita. Nenhuma expectativa negativa foi removida.

## Residual do reataque W10

As dez provas vermelhas continuam abertas; não foram alteradas para obter PASS:

| Arquivo | Provas vermelhas |
|---|---|
| `tests/redteam/rt01-troca-laudo.adv.ts` | 3: consumidor ReviewAction, confronto nome × identificador, deduplicação no contrato esperado pelo teste |
| `tests/redteam/rt03-injecao-prompt.adv.ts` | 1: detector esperado para fármaco com homóglifo/texto invisível |
| `tests/redteam/rt05-rads-cadeias.adv.ts` | 2: avaliador de cadeias e conexão do ruleset RADS |
| `tests/redteam/rt07-labs-salao.adv.ts` | 2: unidade/plausibilidade de Hb |
| `tests/redteam/rt12-harness-gateway.adv.ts` | 1: contrato/gate READ versus WORLD_EFFECT |
| `tests/redteam/rt15-caso-completo.adv.ts` | 1: conflito de regime planejado × prescrito no contrato esperado pelo teste |

Parte dessas provas exige símbolos específicos e não demonstra por si só ausência de toda implementação equivalente. O estado informado é o resultado executado; a reclassificação exige rastrear cada consumidor atual. Não constituem dez novas falhas desta correção.

## Limites

- A nova tela revisa fontes já vinculadas no servidor; não entrega interface completa de importação, vínculo de paciente ou toda a consulta de demonstração.
- Evidência de UI: React em jsdom consumindo HTTP real e SQLite em memória. Não houve inspeção visual em navegador nesta rodada.
- Jev recebe representação documental reduzida, não documento integral. Acurácia/calibração dessa representação com o provedor real: NOT_RUN. Continua apenas proposta de organização, sem autoridade clínica.
- Preparar/exibir via HTTP registra conteúdo servido; não prova leitura humana. A UI fornece o consumidor com ação explícita, e os testes demonstram esse percurso.
- **MERGE_COM_RISCO permanece. Não recomendar merge enquanto as provas residuais e os limites aplicáveis não forem resolvidos.**
