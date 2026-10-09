# Apoio Claude / Cursor — estado recebido e pontos atuais

Recebida a passagem local `2026-10-09_1900_claude-para-codex_apoio-f0.md`, sessão origem `f2c2cfd3-8a4e-4ebf-8b44-319ae5959031`. Dr. Silas confirmou no chat Codex que Claude está em campo para auxiliar. Astra continua writer único de `f0/w1-integrado`; apoio em ramos próprios, sem bateria concorrente.

## Respostas objetivas ao pedido de apoio

| Ponto | Referência atual |
|---|---|
| Scanner original L5 | `f0/f0f-luna5@8001655`: `docs/f0-fecha/C2-L5-PHI.md`, `PHI-TRIAGEM.json`, `evidencias/c2-l5/phi-repo-test-final.log`. Esse snapshot ainda tinha 35 candidatos e 1 WEBP pendente. |
| Triagem concluída na preparação Astra | `f0/f0f-astra-c2@5e84ac4`, após `2fe2345`. `C2-PHI-ASTRA.md` explica cada reclassificação; `C2-phi-revisado-17.log` registra 5/5 PASS, sem findings/unscanned/pending nessa preparação. Dr. Silas confirmou o WEBP como fictício, e a inspeção foi vinculada ao hash. Não refazer a triagem antiga de 180 candidatos/14 opacos. |
| Matriz que vale | `f0/f0f-luna1@8543c33` (anterior `221def6`): 290 IDs principais, 25 itens de checklist; somente Q50 vermelho por auditoria/PR/demo pendentes. Prova: 2/3 PASS estruturais, gate zero vermelho FAIL esperado. `docs/f0-fecha/C2-L1.md` registra limites e normas F0/F1. Não usar as 107 pendências antigas. |
| Duas correções de escopo | **`f0/w1-integrado@1b56427`**. Ler `AUDITORIA-CLAUDE-PRELIMINAR.md` e `CORRECOES-AUDITORIA-ESCOPO.md`. Novos ataques em `tests/f0-fecha/auditoria-escopo.test.ts`; 87/87 no bloco focal + 1/1 E2E, TypeScript e fronteiras PASS. Reauditoria independente solicitada sobre esse commit. |
| Revisão L1/L5 | Sim: conferir o mapeamento por fase e as disposições individuais, não só contagens. L5 precisa ser avaliada junto das correções Astra acima. As mudanças de escopo F0 estão ancoradas no PLANO: kernel/adapter fake; UI/provider real/SIGTAP completo são fases futuras, salvo ampliações explícitas E6b/Flash desta missão. |

## Prioridade do apoio

1. Reatacar M1 (lote × paciente proprietário, incluindo sessão antiga) e M2 (draft sem contexto, inclusive recibo antigo), em leitura, reportando achados verificáveis por arquivo/linha. Código corrigido em `1b56427`.
2. Cobrir os pontos que ficaram fora da auditoria preliminar: preservação de rotas/provas A3; `autorizarSaida`/gateway; OncoAssist, provider desligado e desidentificação; matriz e scanner. A auditoria via CLI Anthropic foi real, mas parcial e não fecha D1 sozinha.
3. Revisar se L1 distingue corretamente núcleo testado, curadoria médica pendente e integração F1+, e se L5 mantém exceções específicas por ocorrência/hash. Relatórios podem ficar na faixa `docs/f0-fecha/CLAUDE-*.md` de seu ramo.

Não há atualmente linha SEM PROVA de produto à espera de teste do Cursor: Q50 depende de atos de aceite. Se a revisão Claude identificar uma lacuna concreta, o teste novo do Cursor fica em `tests/f0-matriz/**`, no novo ramo/worktree previsto, em série e com slot de teste combinado. O antigo WIP `w10-cursor` continua intocado.

## Integração e limites

Astra continua preparando demo e integração L1 → L5. A base de trabalho de L1 contém commits auxiliares de L5; sua entrega será importada **só pela faixa da matriz** em ramo a partir do integrado, para não antecipar a ordem. Todos os ramos/checkpoints originais serão preservados. O scanner será repetido no integrado depois de incorporar os artefatos finais.

Nenhum merge na main, tag, limpeza de worktrees ou aplicação em CANONICA foi autorizado por esta coordenação. O merge final continua reservado ao Dr. Silas.
