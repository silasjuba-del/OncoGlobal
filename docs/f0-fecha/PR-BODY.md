## Problema e resultado

As entregas W0–W12 estavam distribuídas em branches, e a consulta documental não tinha prova completa de revisão, assinatura e reabertura. Este PR integra os ramos aprovados e conecta o percurso local: vínculo explícito, conflito preservado, resumo revisado, cartão com proveniência, Flash exibida antes de assinar e histórico persistido.

Inclui contratos W12, configuração persistida da Flash, retomada idempotente, validação de paciente/encontro/lote nas rotas de confirmação, matriz normativa e scanner PHI por arquivo/hash. Todas as rotas preexistentes foram conservadas; provas adversariais adicionais coexistem com as originais.

## Evidência

PR inicialmente em rascunho para concluir Q50 e a verificação do candidato integrado. Não está liberado para merge enquanto os resultados finais abaixo estiverem pendentes.

| Verificação | Evidência atual |
|---|---|
| Bateria completa anterior C1-L2/C2 | 2.278 regulares, 240 redteam e 41 W8; todos PASS no snapshot indicado em STATUS |
| Correção de escopo da auditoria | 87 testes focalizados e E2E adicional PASS |
| Scanner PHI integrado | 8/8 PASS; superfície publicável Git, disposições individuais por SHA |
| Auditoria independente | Claude operacional aprovou M1/M2 e preservação, sem ALTO/MÉDIO; delta final em revisão |
| Demo real sintética | 9 capturas; SQLite/HTTP real, assinatura e reabertura após recarga |
| Bateria final/CI do candidato | PENDENTE |

[Matriz de rastreabilidade](https://github.com/silasjuba-del/OncoGlobal/blob/f0/w1-integrado/docs/MATRIZ-RASTREABILIDADE-F0.md) · [Roteiro e capturas da demo](https://github.com/silasjuba-del/OncoGlobal/blob/f0/w1-integrado/docs/F0-DEMO.md) · [STATUS e evidências](https://github.com/silasjuba-del/OncoGlobal/blob/f0/w1-integrado/docs/f0-fecha/STATUS.md) · [Auditoria Claude](https://github.com/silasjuba-del/OncoGlobal/blob/f0/w1-integrado/docs/f0-fecha/CLAUDE-REAUDITORIA-D1.md).

## Limites e riscos residuais

Execução monousuário local, dados sintéticos e provider externo desligado. Não atesta uso clínico real. A demo não imprime nem exporta APAC; pedido laboratorial ainda mostra itens pendentes e a grade ilustrativa do salão não prova agendamento persistido. Datas literais da demo usam dia/mês/ano. Há interrupções nativas intermitentes do runner Windows em baterias antigas; logs preservados e reataques isolados não substituem uma bateria integral verde.

Auditoria baixa: drafts legados sem contexto exigem revisão/revínculo; vincular a impressão local ao contexto selecionado fica para F1. UI básica e texto de rascunho nos documentos assinados também ficam explícitos.

## Próximas fases e decisões humanas

F1+: receitas na Flash, orientações do canal após curadoria, biomarcadores adicionais de pulmão, jornadas clínicas completas CTCAE/RECIST, roteador de modelos, capacidades proativas, grafo/vetores e custo por tarefa. Modelo padrão da Flash e prazo editável, antes adiados, foram incluídos pela missão de fechamento.

O Dr. Silas faz o merge na main após esta entrega estar pronta. WIP antigo do Cursor permanece preservado; limpeza de worktrees e alteração da CANONICA são somente propostas, não executadas. Tag somente após merge humano. PR #2 será encerrado como incorporado neste PR.
