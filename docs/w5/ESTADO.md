# W5 · ESTADO (retomada do FUGU ULTRA)

> Se a sessão cair: leia este arquivo, depois `docs/w5/ACHADOS.md`, `docs/w5/CLAIMS.md` e `docs/w5/AMB.md`. Continue do primeiro passo não FEITO da tabela "Fases". Nunca refaça o que está FEITO.

- **Fase atual:** P3 triagem da rodada 1 + P4 correções atribuídas; P2 ainda PARCIAL (F5/F9/F11 não executadas)
- **Rodada:** 1 de 3
- **Agente ativo no Vitest:** nenhum (lock livre; ultimo: REGRAS as 21:33:48, exit 0)
- **Base:** `f0/w5-integrado` @ `da75a0c` (worktree `C:\Users\silas\Projects\OncoGlobal-wt\w5-orq`); ramos RED/E2E-UI/REGRAS/KERNEL/DOMINIO ainda NÃO integrados
- **Fuso do serviço:** −03:00 (D-W5-01) · aviso APAC adiantado ≤ 1 dia aceitável, atrasado não (D-W5-02)

## Fases
| Fase | Estado | Evidência |
|---|---|---|
| P0 linha de base | FEITO 19:08 | `npm run verify` exit 0 · 53 arquivos / 345 testes · fronteiras ok (79) · corpus ok (20) · log `_w5-locks\logs\20261005-190530-ORQ.log` |
| P0 worktrees + `npm ci` (um por vez) | FEITO 19:12 | 5 worktrees de `6b96702`; `npm ci` serial, 12–13 s cada, exit 0 |
| P1 matriz de rastreabilidade | PARCIAL | `docs/w5/MATRIZ.md`: 195 IDs; 85 PARCIAL por refs, 110 A_AUDITAR; leitura semântica e mutação pendentes |
| P2 ataque (rodada 1) | PARCIAL | RED @`5e1093d`: 31 testes, 22 FAIL deliberados/9 PASS; 8 famílias ensaiadas, F5/F9/F11 NOT_RUN; log `_w5-locks/logs/20261005-212449-RED.log` |
| P3 triagem (rodada 1) | EM_CURSO | `docs/w5/ACHADOS.md`: 8 ABERTO, 2 AMB, 1 RESISTIU; AMB-001/002 em `AMB.md` |
| P4 correção (rodada 1) | EM_CURSO | REGRAS recebeu ADV-010; KERNEL recebeu ADV-006/001 e, se viável, ADV-005; testes vermelhos devem preceder correção |
| P5 integração + reataque (rodada 1) | PENDENTE | — |
| P6 relatório | PENDENTE | — |

## Agentes (§3)
| Agente | Worktree | Branch | Estado | Tarefa atual |
|---|---|---|---|---|
| RED | `w5-red` | `f0/w5-red` | lote 1 entregue @`5e1093d` | F5/F9/F11 e reataque ainda pendentes |
| KERNEL | `w5-kernel` | `f0/w5-kernel` | cobertura em curso; ADV-006/001 atribuídos | priorizar S0, depois ADV-005 S1; sem alterar contrato |
| REGRAS | `w5-regras` | `f0/w5-regras` | cobertura entregue (3 commits); ADV-010 atribuído | reproduzir teste vermelho → corrigir conflito delta |
| DOMINIO | `w5-dominio` | `f0/w5-dominio` | cobertura em curso | ADV-007/008 aguardam decisão do contrato de lote |
| E2E-UI | `w5-e2e` | `f0/w5-e2e` | INFRA-01/E2E em curso | excluir adversariais da suíte regular mas executar por filtro explícito |

## Achados por estado
| ABERTO | CORRIGIDO | RESISTIU | BLOQUEADO_CONTRATO | AMB |
|---|---|---|---|---|
| 8 | 0 | 1 | 0 | 2 |

## Mecânica de coordenação (decisão do orquestrador, registrada)
- **Vitest um por vez (§6.4):** todo `npm run verify`, `npx tsc` ou `npx vitest` passa por `docs/w5/ferramentas/vitest-lock.ps1` (lock atômico fora do repo, em `C:\Users\silas\Projects\OncoGlobal-wt\_w5-locks\vitest.lock`; logs em `_w5-locks\logs`). O script escreve o nome do agente na linha "Agente ativo no Vitest" acima e a limpa ao terminar.
- **CLAIMS (§6.1):** reservas via `docs/w5/ferramentas/claim.ps1`, que grava em `docs/w5/CLAIMS.md` **deste** worktree (fonte única) e recusa arquivo fora da trilha do agente.
- **`tests/adv/` fora da suíte regular:** exige exclusão no `vite.config.ts` (dono: E2E-UI). Até isso estar integrado, o ramo do RED não entra em `f0/w5-integrado`.

## Últimas ações
| Hora (−03:00) | Ação |
|---|---|
| 2026-10-05 19:00 | Leitura integral de W5-FUGU-ULTRA, W2-CABECALHO-COMUM, PLANO v1.1, DECISOES, contratos, auditoria-regressao, W4-FUGU. |
| 2026-10-05 19:04 | Criados `docs/w5/` (ESTADO, CLAIMS, AMB, ACHADOS) e as ferramentas de lock/claims/varredura. |
| 2026-10-05 19:08 | P0 VERDE (saída abaixo). Varredura automática de IDs: 82 IDs sem referência (bate com a do tech lead ±1 em T). |
| 2026-10-05 19:12 | 5 worktrees criados + `npm ci` serial. Briefing comum (`docs/w5/BRIEFING-AGENTES.md`) commitado em `17f0501`. |
| 2026-10-05 19:20 | 5 agentes lançados (RED, KERNEL, REGRAS, DOMINIO, E2E-UI). |
| 2026-10-05 21:21 | Auditoria-regressão no integrado: 1 arquivo/9 testes PASS, exit 0; log `_w5-locks/logs/20261005-212110-ORQ.log`. |
| 2026-10-05 21:29 | RED lote 1 commitado: 31 testes (22 FAIL/9 PASS); achados ADV-001…011 triados, duas ambiguidades de lote. |
| 2026-10-05 21:31 | P4 atribuído a KERNEL/REGRAS; integração P5 e relatório P6 ainda PENDENTES. |

## P0 · saída real de `npm run verify` em `f0/w5-integrado` @ `aa99b86` (19:05–19:08)
```
> oncoglobal@0.0.1 verify
> npm run typecheck && npm run check:boundaries && npm run check:corpus && npm test
> oncoglobal@0.0.1 typecheck
> tsc --noEmit
> oncoglobal@0.0.1 check:boundaries
> node scripts/check-boundaries.mjs
fronteiras ok (79 arquivos)
> oncoglobal@0.0.1 check:corpus
> node scripts/validate-corpus.mjs
(tabela de 20 arquivos: todos header ok ou "—" para templates; lab-thresholds com 3 ativos)
corpus ok (20 arquivos)
> oncoglobal@0.0.1 test
> vitest run
 RUN  v5.0.3 C:/Users/silas/Projects/OncoGlobal-wt/w5-orq
 Test Files  53 passed (53)
      Tests  345 passed (345)
   Start at  19:05:51
   Duration  167.42s (environment 53%, import 36%, tests 7%, transform 4%, worker 1%)
EXIT_CODE=0
```
