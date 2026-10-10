# Contexto para nova aba — OncoGlobal / OncoMind

Atualizado em 09/10/2026. A missão vigente é `docs/ondas/F0-FECHAMENTO-ASTRA.md`, autorizada por D-W9-80. Astra é a integradora e única writer de `f0/w1-integrado`. O Dr. Silas faz o merge na main.

Estado final: F0 pronta para merge humano no PR #4. Código dc2e78c passou a bateria integral, CI e E6b três vezes; entrega documental em RELATORIO-F0.md e f0-fecha/STATUS.md. Conferir o CI do último HEAD antes do merge.

## Raiz e estado vivo

- Repositório: `C:\Users\silas\Projects\OncoGlobal`, origin `silasjuba-del/OncoGlobal`, branch `f0/w1-integrado`.
- PR #4: https://github.com/silasjuba-del/OncoGlobal/pull/4 — consultar estado real e `docs/f0-fecha/STATUS.md` antes de afirmar prontidão.
- OncoGlobal é o guarda-chuva; OncoMind é este motor clínico local; OncoAssist é a identidade do agente. consultorio-docs é outro projeto. WORK/STUDY foi abolido neste projeto (D-W9-72).
- Cinco Lunas concluíram as fatias iniciais e reataques C2; não reintegrar cegamente ancestry de worktrees. L1 foi importada por faixa. Inventários/justificativas em `docs/f0-fecha/`.
- origin/main reconciliada em 7936820. Nenhum merge nesta missão foi feito PARA main. Nenhuma tag criada.

## O que foi incorporado

A entrega Astra c0c0762, sobras GLM/Kimi, planejamento aprovado, contratos W12, Flash com modelo persistido e prazo editável, revisão documental com vínculo explícito, reconciliação com conflito preservado, cartão transversal de fatos confirmados, assinatura presa ao conteúdo exibido, retomada durável e reabertura de histórico. Auditoria independente levou a correções de contexto paciente/encontro/lote e recibos antigos.

Leia a matriz normativa `docs/MATRIZ-RASTREABILIDADE-F0.md`, os relatórios Claude e `docs/F0-DEMO.md`. Há nove capturas reais de paciente/médico fictícios. A demonstração usa API HTTP/SQLite reais com provider desligado. Não comprova upload de PDF pelo navegador, impressão, exportação APAC nem jornada clínica de todas as funções. A grade de poltronas é ilustrativa.

## Regras permanentes

IA propõe, código calcula, médico decide e assina. Ausente é PENDENTE. Conflito preserva candidatos e fontes. Vínculo de paciente e promoção de fato exigem revisão explícita. Assinar apenas o conteúdo exibido, na versão e contexto corretos. Efeito externo somente pelo gateway. Não ativar modelo externo nem corpus RASCUNHO como parte do fechamento.

CTCAE v6; decisões clínicas literais e fontes estão em `docs/DECISOES.md` e nos rulesets. Não inferir doses, estadiamento ou conduta a partir deste resumo. As exceções expressas de PHI A8/A9/A10/D-W9-66 continuam subordinadas aos seus gates; não são ativação geral do provider.

## Evidência e continuidade

Baterias sempre em blocos seriais, um worker e `--no-file-parallelism`: `pwsh -NoProfile -File docs/f0-fecha/verificar-blocos.ps1 -Etapa <nome-unico> -Pool forks`. Instabilidade nativa já apareceu também com forks; preservar falhas e repetir integralmente quando necessário. Testes isolados não substituem bateria final.

A1: 2.169 regulares, 226 redteam, 41 W8. A6: 2.240, 240, 41. C1-L2/C2: 2.278, 240, 41. Esses são snapshots históricos; usar STATUS e logs finais para o candidato atual. Scanner deve ler superfície publicável e revisar exceções por bytes/hash; não copiar hash novo para silenciar alteração sem revisão.

## Limites e próximos passos humanos

O WIP de seis arquivos do Cursor em `OncoGlobal-wt/w10-cursor` foi preservado. Backup já existente em `C:\Users\silas\handoff\backup-cursor-2026-10-09\`. Não limpar worktrees. `CANONICA-PATCH.md` é proposta, não aplicar na CANONICA sem ordem própria. `LIMPEZA-WORKTREES.md` é inventário/proposta, não autorização de remoção.

Após gates e CI verdes, o Dr. Silas decide o merge do PR. Só depois cabem tag e verificação da main. F1+: receitas Flash, orientações curadas, biomarcadores adicionais, jornadas CTCAE/RECIST, modelos/proatividade/grafo/custos. Histórico anterior deste arquivo permanece em Git (7936820), sem restaurar as antigas atribuições de writer ou proibições de integração já superadas por D-W9-80.
