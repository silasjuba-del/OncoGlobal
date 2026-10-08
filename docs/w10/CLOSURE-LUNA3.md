# F10 — jornadas de salão e canal

Base: `367825e4e0ae3f9a088256d24a745fd5b3705844`, branch `closure/w10-luna3`.

## Testes adicionados

`tests/closure-e2e/jornadas-salao-canal.test.ts` monta servidor HTTP local, sessão autenticada e SQLite temporário. Os casos cobrem triagem como draft consultável, liberação com corte e motivo médico, idempotência/replay, autor derivado da sessão, recusa sem alteração, seleção humana de vínculo e escopo de paciente/encontro. A liberação repete a requisição após reabrir o SQLite e espera `REPLAY` sem duplicar eventos.

Os testes exercitam endpoints e ledger reais; não simulam respostas de persistência. Os identificadores, fontes, razões e conteúdo são sintéticos. A sessão selecionada é instalada pelo gerenciador server-side no fixture.

## Estado de validação

`NOT_RUN` por instrução do coordenador: nenhum teste, typecheck ou build foi executado. Na base inspecionada, as três rotas retornam `501 CAPACIDADE_PENDENTE`, portanto os casos positivos ficam deliberadamente vermelhos até a integração da implementação de Luna1. Não há skip nem retorno antecipado.

## Contratos e pontos de integração

- A triagem recebe `{ triagem, expectedRevision }` e grava somente um draft. Contexto é selecionado por `/consulta/contexto/selecionar`; o fluxo de leitura deve expor draft, revisão e estado; triagem não deve produzir evento clínico confirmado.
- A liberação recebe `{ patientId, encounterId, expectedRevision, motivo, idempotencyKey }`; exige corte, justificativa e ator de sessão; replay não duplica evento.
- O vínculo recebe `{ contatoId, patientId, encounterId, idempotencyKey }`; exige seleção humana e contexto selecionado igual. Contato ambíguo permanece sem destino único até decisão explícita.
- Pedidos anônimos, contexto divergente, revisão obsoleta e motivo ausente devem ser recusados sem evento clínico ou avanço de revisão.

Fixtures usam eventos `Paciente`, `Triagem`, `Contato` e `CanalMessage` sintéticos escritos no ledger pelo `confirmar` real. Interop request enviado ao root/Luna1: confirmar envelopes e códigos de conflito finais. A rodada não conectou extração→revisão a essas jornadas porque os contratos descrevem triagem manual e vínculo humano como entradas independentes; a extração não é fonte causal para elas. Adicionar essa dependência sem contrato criaria um fluxo fictício.
