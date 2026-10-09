# LUNA 2 — E6b: consulta completa

## GOAL

Implementar uma prova de consulta ponta a ponta com HTTP real e SQLite temporário, no arquivo único `tests/f0-fecha/consulta-completa.test.ts`, cobrindo revisão documental, vínculo explícito, confirmação exibida, Flash, reabertura, preservação do conflito, dados ausentes, retry, troca de contexto, alteração após exibição e caminho manual sem IA.

## Estado

**PARCIAL / BLOQUEADA EM C2.** A prova e o fixture estão implementados. A primeira execução integral reproduziu a lacuna de reconciliação; os demais cinco casos concluíram após corrigir a expectativa do número de documentos Flash assinados. A prova final de três execuções verdes consecutivas está pendente da correção de produto para C2 e de novo `TEST_SLOT`.

## Critérios

| Critério | Estado | Evidência esperada no teste |
|---|---|---|
| 1. Percurso completo, evolução assinada e história após reabrir SQLite | PASS na primeira rodada integral | O teste extrai kit sintético, vincula cada fonte, confirma evolução exibida, finaliza a Flash, encerra HTTP/SQLite, abre o mesmo arquivo e lê evolução, histórico assinado e prazo do retorno. |
| 2. Contradição preservada até decisão clínica | **BLOQUEIO DE PRODUTO** | A prova compara a proposta multifonte antes e depois da confirmação de fatos e exige o campo laboratorial como conflito nos dois momentos. A reconciliação responde `decisaoClinicaTomada: false`; a leitura conserva os candidatos. Não foi encontrada operação que persista uma decisão clínica de resolução e mantenha as fontes históricas. Confirmar fatos individuais não é tratado como resolver o conflito. |
| 3. Negação, data, unidade e ausência preservadas | PASS na primeira rodada integral | Verifica evidência de creatinina com data/unidade, negação sem fato positivo, TSH sem fato inventado e texto original preservado no rascunho HTTP. |
| 4. Retry após falha sem duplicar | PASS na primeira rodada integral | Simula perda da resposta pelo cliente depois da gravação HTTP bem-sucedida; repete a mesma operação e exige `REPLAY`, um evento e uma revisão do documento. Não simula falha do servidor antes da persistência. |
| 5. Troca de paciente ou edição após exibição recusa confirmação | PASS na primeira rodada integral | Troca de contexto invalida a tentativa de revisão; alteração concorrente do documento Flash após exibição exige `CONTEUDO_ALTERADO_APOS_EXIBICAO` e zero assinatura. |
| 6. IA indisponível permite fluxo manual | PASS isolado | O servidor de teste usa gateway sem executores/IA; extração determinística, revisão humana e Flash manual concluem pelas rotas reais, com `FLASH_EVOLUCAO` e `FLASH_RETORNO` assinados. |

## Arquivos desta faixa

- `tests/f0-fecha/consulta-completa.test.ts`
- `tests/f0-fecha/fixtures/consulta-completa.ts`
- `docs/f0-fecha/LUNA-2.md`

Produção permaneceu somente leitura. Nenhuma dependência foi instalada. Nenhuma chamada a LLM foi habilitada. Nenhum teste existente ou asserção preexistente foi alterado.

## Comandos e saídas reais

- Base observada antes das alterações: `369db84732ab5a46283a2356bd85eb656916f009`, ramo `f0/f0f-luna2`, worktree limpo.
- `npx.cmd vitest run tests/f0-fecha/consulta-completa.test.ts --no-file-parallelism --maxWorkers=1`: `Test Files 1 failed`; `Tests 2 failed | 4 passed (6)`. As falhas iniciais eram C2 (campo de conflito ausente) e C6 (expectativa contava 1 documento, mas a Flash assinou evolução + retorno).
- `npx.cmd vitest run tests/f0-fecha/consulta-completa.test.ts --no-file-parallelism --maxWorkers=1 -t "mantém duas fontes contraditórias"`: `Test Files 1 failed`; reprodução do C2. Payload real: `decisaoClinicaTomada:false`, `conflitos:[]`; `campos` separou cada segmento (`gravacao-lab-conflito-a-92:0::lab:CREATININA:data:2026-10-09` e `...-b...`), com um candidato por campo e `conflict:false`. As únicas exceções observadas foram `REVISAR_FRONTEIRA` e `UNLINKED_PATIENT`.
- `npx.cmd vitest run tests/f0-fecha/consulta-completa.test.ts --no-file-parallelism --maxWorkers=1 -t "conclui revisão e Flash manualmente"`: `Test Files 1 passed`; `Tests 1 passed | 5 skipped (6)`. Passaram evolução e retorno assinados sem executor externo.
- TypeScript: `NOT_RUN — aguardando TEST_SLOT da Astra`.
- Prova final de três rodadas: `NOT_RUN — o caso C2 segue bloqueado por capacidade ausente`.
- Métricas de chamadas HTTP, ações equivalentes, correções e duração ponta a ponta estão emitidas pelo caso 1 via `[E6b-METRICAS]`, mas o reporter Vitest não mostrou o `console.info` dos casos que passaram. As contagens reais ainda precisam ser capturadas quando C2 permitir a execução completa.

## Bloqueios

1. **Decisão e conflito pré-confirmação ausentes.** Com vínculo explícito, mesma data/paciente/encontro e dois resultados de creatinina discordantes, `/consulta/rascunho/reconciliar` devolveu um campo por segmento sem combinar os candidatos. Não há operação de decisão clínica de resolução. A leitura pós-confirmação pode projetar conflito entre fatos, mas confirmação da fonte não é resolução. C2 fica BLOQUEADO; não alterei produção nem afrouxei a exigência.
2. A prova final de três rodadas e a captura das métricas permanecem pendentes. TSC não foi executado.

### Reprodução mínima de C2

1. Criar apenas o cadastro inicial sintético `Paciente Teste 92` e abrir `/consulta/carregar` para selecionar `encontro-teste-92`.
2. Criar duas fontes por `/consulta/extrair` como `medical_note`: `09/10/2026 creatinina 1,2 mg/dL` (`lab-conflito-a-92`) e `09/10/2026 creatinina 1,8 mg/dL` (`lab-conflito-b-92`).
3. Em cada draft, chamar `/consulta/rascunho/revisar` com sua exceção `UNLINKED_PATIENT`, `acao: LIGAR_PACIENTE`, `patientId: "Paciente Teste 92"`, `encounterId: "encontro-teste-92"`, `tumorLotId: null`, `sourceId` correspondente e chave de idempotência distinta. Ambos retornaram HTTP 200.
4. Chamar `/consulta/rascunho/reconciliar` com os dois `draftIds` recebidos. Resposta HTTP 200 observada: `decisaoClinicaTomada: false`, `conflitos: []`; dois campos independentes `...gravacao-lab-conflito-a-92:0::lab:CREATININA:data:2026-10-09` e `...-b...`, cada qual com um candidato e `conflict: false`. Não houve eleição cruzada porque os candidatos sequer foram agregados.

## Commit

Commit único criado como `F0F-L02: prova da consulta completa`, com coautoria `gpt-6-luna`, sem push ou merge. O SHA final acompanha o handoff para a Astra registrar no integrado.
