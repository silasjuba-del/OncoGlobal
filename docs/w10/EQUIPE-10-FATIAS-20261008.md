# Equipe de conclusão — 10 fatias

Autorização: Dr. Silas, 2026-10-08. Base `367825e`. Orquestrador/integrador: Codex. Modelos Luna: gpt-6-luna. Fugu por CLI Sakana, com `responses` e image_generation desabilitada, sem troca de provider global.

| Fatia | Dono | Entrega | Estado inicial |
|---|---|---|---|
| F01 | Fugu | Fármaco com homóglifo/invisível preserva literal e incerteza | DESPACHADA |
| F02 | Fugu | Deduplicação causal de fatos/laudos no pipeline | DESPACHADA |
| F03 | Fugu | Reconciliação de regime planejado × prescrito | DESPACHADA |
| F04 | Luna 1 | Revisão, vínculo médico e confronto nome × identificador | IMPLEMENTANDO |
| F05 | Luna 2 | Unidade/origem de LAB, sem faixa clínica inventada | CÓDIGO — NOT_RUN; plausibilidade sem fonte bloqueada |
| F06 | Luna 2 | READ separado de WRITE, mínimo payload e PHI gate | CÓDIGO — NOT_RUN |
| F07 | Luna 1 | Triagem draft-only e liberação com motivo/revisão | IMPLEMENTANDO |
| F08 | Luna 1 | Vínculo de contato por ReviewDecision, origem imutável | IMPLEMENTANDO |
| F09 | Luna 2 | Backup/restore consistente dos três stores e manifesto | CÓDIGO — NOT_RUN |
| F10 | Luna 3 + root | Jornadas HTTP/SQLite reais, contratos e integração | TESTES PRODUZIDOS — NOT_RUN |

## Território

- Fugu: checkout `w10-finish-fugu`, branch `closure/w10-fugu`; `src/kernel/extracao/**`, `src/orchestration/pipeline-extracao.ts`, `tests/closure-fugu/**`, relatório próprio.
- Luna 1: `w10-finish-luna1`, `closure/w10-luna1`; server/app/UI de jornada e `rules/w8/vinculoDocumento.ts`, `tests/closure-luna1/**`.
- Luna 2: `w10-finish-luna2`, `closure/w10-luna2`; triagem/gateway/backup/scripts de backup, `tests/closure-luna2/**`.
- Luna 3: `w10-finish-luna3`, `closure/w10-luna3`; somente `tests/closure-e2e/**` e relatório próprio.
- Root: contratos compartilhados, projeção de decisões de vínculo e integração na entrega. Nenhum agente altera contracts/writer fora de sua faixa.

Todos os checkouts partem da mesma base, com node_modules reutilizado por junction somente para dependências existentes. Nenhuma instalação/dependência nova. W11, outros worktrees e o checkout DeepSeek permanecem fora da faixa.

Testes da equipe serializados por lease: Fugu recebeu o primeiro lease; Lunas produziram testes com NOT_RUN. Root valida depois, sem Vitest concorrentes. Claims CÓDIGO/COMMIT não equivalem a PASS.

Sem push, merge em main/integrado, deploy, limpeza, leitura de bancos reais ou alteração de limiar/decisão médica para obter verde. A skill codex-fugu foi adaptada à ordem atual: Fugu tem uma parte própria, não cinco subordinados adicionais.
