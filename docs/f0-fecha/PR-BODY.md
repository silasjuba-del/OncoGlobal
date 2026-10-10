## Problema e resultado

As entregas W0–W12 estavam distribuídas em branches, e a consulta documental não tinha prova completa de revisão, assinatura e reabertura. Este PR integra os ramos aprovados e conecta o percurso local: vínculo explícito, conflito preservado, resumo revisado, cartão com proveniência, Flash exibida antes de assinar e histórico persistido.

Inclui contratos W12, configuração persistida da Flash, retomada idempotente, validação de paciente/encontro/lote nas rotas de confirmação, matriz normativa e scanner PHI por arquivo/hash. Todas as rotas preexistentes foram conservadas; provas adversariais adicionais coexistem com as originais.

## Evidência

Candidato de código dc2e78c: bateria integral local e CI verdes. Auditoria concluída e demo executada. A atualização documental final também passa pelo CI antes da entrega para merge humano.

| Verificação | Evidência atual |
|---|---|
| Bateria integral final | 2.298 regulares/327 arquivos, 240 redteam/31 e 41 W8/9; todos PASS em dc2e78c, mesma rodada serial |
| Correção de escopo da auditoria | 87 testes focalizados e E2E adicional PASS |
| Scanner PHI integrado | 13/13 PASS; índice/worktree e revisões hash-bound de PDFs/XLSX; conjunto com W11 59/59 PASS |
| Auditoria independente | Claude operacional e reataque final: nenhum ALTO/MÉDIO aberto; achados do scanner fechados |
| Demo real sintética | 9 capturas; SQLite/HTTP real, assinatura e reabertura após recarga |
| E6b | 6/6 em três rodadas consecutivas; 18 chamadas HTTP, 19 ações equivalentes, zero correções no caso sintético |
| TypeScript / fronteiras / corpus | PASS; 299 fontes e 125 arquivos de corpus |
| Matriz R-34 | 290 linhas; 184 VERDE; zero VERMELHO; 106 N-A justificados |
| CI do código | [run verde](https://github.com/silasjuba-del/OncoGlobal/actions/runs/38002770069): verify 2.452/341, redteam 240/31, W8 41/9 |

[Matriz de rastreabilidade](https://github.com/silasjuba-del/OncoGlobal/blob/f0/w1-integrado/docs/MATRIZ-RASTREABILIDADE-F0.md) · [Roteiro e capturas da demo](https://github.com/silasjuba-del/OncoGlobal/blob/f0/w1-integrado/docs/F0-DEMO.md) · [STATUS e evidências](https://github.com/silasjuba-del/OncoGlobal/blob/f0/w1-integrado/docs/f0-fecha/STATUS.md) · [Auditoria Claude](https://github.com/silasjuba-del/OncoGlobal/blob/f0/w1-integrado/docs/f0-fecha/CLAUDE-REAUDITORIA-D1.md).

## Limites e riscos residuais

Execução monousuário local, dados sintéticos e provider externo desligado. Não atesta uso clínico real. A demo não imprime nem exporta APAC; pedido laboratorial ainda mostra itens pendentes e a grade ilustrativa do salão não prova agendamento persistido. Datas literais da demo usam dia/mês/ano. Há interrupções nativas intermitentes do runner Windows em baterias antigas; logs preservados e reataques isolados não substituem uma bateria integral verde.

Paridade: o verify inclui 154 testes/14 arquivos do redteam, também contados na execução dedicada. A união local/CI é a mesma: 2.579 testes/367 arquivos; não somar testes sobrepostos.

Auditoria baixa: drafts legados sem contexto exigem revisão/revínculo; vincular a impressão local ao contexto selecionado fica para F1. UI básica e texto de rascunho nos documentos assinados também ficam explícitos.

## Próximas fases e decisões humanas

F1+: receitas na Flash, orientações do canal após curadoria, biomarcadores adicionais de pulmão, jornadas clínicas completas CTCAE/RECIST, roteador de modelos, capacidades proativas, grafo/vetores e custo por tarefa. Modelo padrão da Flash e prazo editável, antes adiados, foram incluídos pela missão de fechamento.

O Dr. Silas faz o merge na main após esta entrega estar pronta. WIP antigo do Cursor permanece preservado; limpeza de worktrees e alteração da CANONICA são somente propostas, não executadas. Tag somente após merge humano. PR #2 é substituído por esta entrega integrada; o branch original permanece preservado.
