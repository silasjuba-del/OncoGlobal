# F1 — estado de entrega e rota de continuidade

Atualizado em 2026-10-14. **Fechamento em verificação; ainda não declarar a fase encerrada.**
Base integrada: `main` em `b12a6b6`. Lote B1: [PR #17](https://github.com/silasjuba-del/OncoGlobal/pull/17), base de retomada `8633ebb`.
Correções Codex: [PR #18](https://github.com/silasjuba-del/OncoGlobal/pull/18), ramo `codex/f1-finalizacao`, encadeado no #17.
Os PRs não foram mesclados nesta retomada.

## Correções comprovadas nesta retomada

| Problema | Correção e prova |
|---|---|
| Peso com mais de 30 dias desaparecia da triagem nutricional | `9e58adb`: medida documentada com data/fonte e pedido de conferir atualidade; peso continua indisponível para dose. `tests/f1/b1/triagemNutricional-consulta.test.ts`. |
| Duas versões de um lote eram escolhidas pela ordem | `9e58adb`: pendência explícita; nenhuma eleição de tumor. IMC independente continua podendo sustentar sugestão. Mesma prova HTTP, nas duas ordens. |
| Sete projeções incorporavam fatos ou retificações posteriores ao encontro | `ae5389d`: limite do encontro antes da resolução de versões, em contexto, histórico cirúrgico, cumulativos, condicionais, instrumentos, interações e intervalo. `tests/f1/s12/horizonte-projecoes.test.ts` e `tests/f0c/intervalo-ciclo.test.ts`. |
| Servidor enviava respostas de sucesso sem contrato | `305f44f`: 54 rotas vinculadas a schemas, compartilhados com a UI quando já existentes. Resposta inválida retorna `RESPOSTA_FORA_CONTRATO`, sem conteúdo no log. `tests/server/contratos-saida.test.ts`. Campos de conteúdo extensível continuam JSON; isto não substitui validação clínica. |
| Pacote declarado público aceitava identificadores estruturais | `c9ad160`: nome rotulado, endereço e nascimento recusados antes de persistir. `tests/f1/s3/biblioteca.test.ts`. Links bibliográficos são permitidos; aprovação continua item a item. |

As regressões foram executadas em vermelho antes das respectivas correções. A bateria HTTP/dutos/biblioteca passou com 101 testes em 21 arquivos; a bateria temporal, com 56 testes em seis arquivos, seguida da regressão adicional de intervalo. Typecheck passou. Verificação integral e adversariais do HEAD final ainda devem ser concluídas e registradas abaixo. Execução interrompida sem totais não é PASS.

## Organização documental

403 arquivos históricos já incorporados em `main` foram movidos, sem exclusão, para [o arquivo](_arquivo/INDICE.md). O relatório S12 anterior foi preservado [separadamente](_arquivo/RELATORIO-F1-S12-ANTERIOR.md), totalizando 404 documentos e evidências arquivados.
Os 13 arquivos com consumidores conhecidos permanecem nos caminhos originais. O [mapa de movimentações](_arquivo/MOVIMENTOS.json) identifica origem, destino e consumidores. Referências foram atualizadas; gates, testes e corpus não foram arquivados.
As 18 famílias de duplicatas foram inventariadas. As duas fachadas CNS já compartilhavam a implementação de `src/rules/cns.ts`; não há justificativa para remover compatibilidade pública apenas por serem idênticas.

## Trabalho ainda necessário para o aceite integral A–P

| Eixo | Estado verificável |
|---|---|
| A / B1 | Correções originais preservadas e dois novos achados corrigidos no #18. Revisão final e integração pendentes. |
| B / O | Inventário de duplicatas feito; fachadas públicas preservadas. Varredura completa de código morto e simplificação ainda não concluídas. |
| C | Contratos de sucesso nas 54 rotas e testes das três rotas lacunares adicionados. A matriz positivo/negativo/borda de todas as rotas e gates não foi completada. |
| D / E | Sete falhas temporais corrigidas. Testes anteriores de Maestro/ORK e sete setores existem; reexecução integral e E2E do HEAD final pendentes. |
| F / G / H / I / J / L | B1 e consumidores existentes preservados. A auditoria completa das relações ficha/pack/exames e das jornadas ainda não equivale a encerramento. B2 continua dependente da fonte SISAC. |
| K | Agregado de três cores preservado. Contrato versionado por critério ainda não implementado. |
| M | Novas regressões e testes HTTP executados. Duas execuções completas finais e demonstração de navegador pendentes. |
| N | Importação/curadoria local existente endurecida. Exportador do pacote integral da biblioteca ainda não implementado. |
| P | Documentos históricos arquivados com índice. Worktrees e branches concorrentes preservadas; inventário/destinação final ainda pendentes. |

## Dependências externas e limites mantidos

- D-F1-48: a planilha SISAC é necessária para F1-B2. Não criar doses ou packs sem a fonte; o caminho local foi solicitado ao Dr. Silas.
- Conflitos de decisões clínicas permanecem para decisão médica. Correção técnica não promove rascunho a regra aprovada.
- Merge e liberação clínica exigem o aceite do Dr. Silas e os gates do repositório. Não contornar proteção.
- Provider ao vivo foi dispensado anteriormente pelo Dr. Silas; não marcar PASS por teste injetado. Extração só local (D-F1-40), Jev mantido (D-F1-45), voz e operação multiusuária fora da F1.
- Relação de aceites anteriores: [matriz F1](MATRIZ-RASTREABILIDADE-F1.md), [caso-guia](ondas/F1-CASO-GUIA.md), [S12 histórico](ondas/F1-S12-RELATORIO.md). Números históricos não valem como execução do HEAD atual.
