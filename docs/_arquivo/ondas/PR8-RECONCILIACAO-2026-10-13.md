# PR #8 — reconciliação e estado real de integração

Auditoria em 13/10/2026. Autor: Codex. Escopo: revisão do PR #8, propriedade serial e reconciliação com o desenvolvimento posterior. Não é aprovação médica nem fechamento da F1.

## Estado e integração

- PR #8: aberto, não draft, base `f1/integrado` em `fbecedb`. HEAD auditado: `11de5e2`; CI associado concluído com sucesso. Correção publicada no HEAD `9d4aca7`.
- `codex/f1-conclusao` auditado em `aa02ae3`: cinco commits à frente de `11de5e2`, zero atrás. Não havia necessidade de reintroduzir as entregas do PR.
- O desenvolvimento posterior inclui `451d80e`, `82f6b91`, `9c43e4e`, `990aeea` e `aa02ae3`. Todos são preservados na reconciliação.
- O commit de reconciliação usa `aa02ae3` como primeiro pai e `9d4aca7` como segundo pai. Assim, o HEAD corrigido do PR também é ancestral da F1, sem copiar a implementação antiga sobre a nova.
- Delta desta tarefa sobre a F1: plano de fatias, remoção de duas dispensas PHI obsoletas e este relatório. Nenhum código de produto, contrato clínico, ruleset, corpus clínico ou dependência foi modificado.
- `main` e `f1/integrado` não foram alterados. O PR #8 permanece aberto; não houve merge protegido, aprovação de PR ou auto-merge.

## Revisões: dez threads ainda formalmente abertas

O estado formal das threads é distinto do atendimento do conteúdo. Não foram encerradas por esta auditoria nem houve aprovação da própria alteração.

| Comentário de revisão | Evidência/estado do conteúdo |
| --- | --- |
| Recusar `--fechar-fase` vazio | Corrigido em `66ff4fa`: presença e valor separados; fixture negativa. Herdado pela F1. |
| Caminhos reais do cliente de consulta na S0 | Corrigidos em `66ff4fa`: HTTP, fake e consumidores incluídos. Herdados pela F1. |
| Aceite S0 limitado a seis grupos | Corrigido em `66ff4fa`: seis adversariais; ORK permanece na S6. Herdado pela F1. |
| Integração UI/API na faixa da S5b | Corrigida em `66ff4fa`: montagem e leitura da visão integrada. Herdada pela F1. |
| Fonte operacional do pack próstata | Corrigida em `66ff4fa`: `DECISAO_MEDICA`, D-F1-20; SBOC preservada em conflito. `11de5e2` remove a alegação de equivalência. Não alterada nesta tarefa. |
| Identidade de coautoria por provedor | Corrigida em `66ff4fa`; prompt refinado em `11de5e2`. Herdada pela F1. |
| `snapshot.ts` na faixa fechada da S0 | E3 já declarava o caminho, mas o WRITE_SET não. Esta tarefa o inclui explicitamente, limitado ao filtro de escopo. |
| Artefatos técnicos na S1 | Corrigidos em `11de5e2`: contrato, gancho, schema e persistência mínima. Implementados no checkpoint posterior. |
| Rota PDF na faixa da S5b | O texto já descrevia rota/adaptador, mas o WRITE_SET não. Esta tarefa inclui ambos, com restrições já previstas. |
| Cadeia serial do schema | Esta tarefa corrige §4.1: S1 (somente `estimulo_tecnico` e `execucao_tecnica`) → S6; alinha com S1-E6 e o prompt. |

## Dispensas PHI

Na F1, as entradas de `src/ui/api/fake.ts` e `tests/server/leituras-http.test.ts` mantinham hashes e dispensas para telefones já removidos em `990aeea`. Leitura dos diffs e `findTextCandidates` confirmaram ausência de candidatos nos dois arquivos. As duas entradas foram removidas, sem renovar hashes ou criar dispensas novas. A varredura completa passou após a remoção.

## Verificação executada

| Verificação | PR #8 corrigido | F1 reconciliada |
| --- | --- | --- |
| Typecheck | Passou | Passou |
| Fronteiras | Passou; 322 arquivos, 54 exceções pré-F1 datadas | Passou; 408 arquivos, zero exceções |
| Corpus | Passou; 209 arquivos | Passou; 210 arquivos |
| Bateria padrão `npm run verify` | 2.760/2.760; 368 arquivos | 3.049 aprovados, 9 falhas; 405 arquivos |
| W10 adversarial | 240/240 | 240/240 |
| W8 adversarial | 41/41 | 41/41 |
| `verify:f1` (inclui adversariais F1 e fechamento de fronteiras S3) | Não se aplica ao pré-F1 | 333/333; 46 arquivos; zero exceções |

Uma primeira execução do PR ocorreu enquanto seu índice era atualizado e foi recusada corretamente pela checagem `git_index_worktree_mismatch`. A execução repetida com árvore estável passou integralmente; nenhum teste ou detector foi afrouxado.

## Bloqueios remanescentes da F1

| Falhas | Arquivo | Observação comprovada |
| --- | --- | --- |
| 2 | `tests/f0-fecha/matriz.test.ts` | 22 referências de dono/consumidor inválidas após a realocação de implementação para kernel/modules. A matriz F0 não acompanhou os caminhos novos. |
| 1 | `tests/f0c/flash-jornada.test.tsx` | O percurso permanece em “carregando consulta”; o teste monta `TelaConsulta` sem encontro explícito, após a mudança de contrato da S0. Necessita verificar o percurso completo antes de ajustar a prova. |
| 1 | `tests/f0c/impressao-runtime.test.ts` | A prova espera uma frase sem dois-pontos; o documento entregue contém “Retorno: em 21 dias”. A divergência literal não foi mascarada. |
| 3 | `tests/w10-entrega/fluxo-http.test.ts` | As expectativas de cardinalidade divergem: dois eventos em vez de um e três em vez de dois. Exige classificar os eventos adicionais e provar revisão/replay/reabertura, antes de mudar a expectativa. |
| 1 | `tests/w10-fugu-eixo/revisao.test.ts` | Também espera um evento e recebe dois na operação de revisão. Mesma necessidade de auditar os tipos e a autoridade de cada evento. |
| 1 | `tests/w11-adv/seguranca-phi.test.ts` | Detector histórico aponta CPF literal na fixture negativa `tests/f1/s3/biblioteca.test.ts`. Não se adicionou dispensa para ocultar a falha. |

Essas falhas já existiam na execução anterior à remoção das dispensas PHI. A reconciliação documental não modificou suas implementações nem expectativas. Nenhuma delas foi convertida em skip ou sucesso presumido.

O fechamento S12 continua sem as entregas documentais exigidas: matriz F1, relatório final e caso-guia no caminho previsto. `990aeea` também registra exclusão do corpus clínico e de três testes associados do checkpoint remoto; esta tarefa não recupera conteúdo indisponível nem o considera entregue.

## Veredito

PR #8: correções documentais endereçadas e verificações locais verdes; CI do novo HEAD e encerramento formal das revisões devem ser conferidos antes da decisão de merge. A declaração anterior de prontidão não substitui aprovação médica.

F1: ramos reconciliados e entregas preservadas; **NO-GO para integração protegida/fechamento**, por nove falhas na bateria padrão e ausência de evidência completa da S12. Próximo passo: corrigir rastreabilidade e provar os percursos de revisão/assinatura sem enfraquecer contratos congelados.

Gate: AGENTS.md — “Não permitir que uma LLM aprove a própria alteração. A aprovação clínica pertence ao Dr. Silas.” Nenhum merge protegido foi executado.
