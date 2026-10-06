# W5 · ESTADO (retomada do FUGU ULTRA)

> Se a sessão cair: leia este arquivo, depois `docs/w5/ACHADOS.md`, `docs/w5/CLAIMS.md` e `docs/w5/AMB.md`. Continue do primeiro passo não FEITO da tabela "Fases". Nunca refaça o que está FEITO.

- **Fase atual:** P1 leitura semântica concluída; P5/P6 em fechamento. ADV-017/018/019 integrados e verdes; ADV-020 fuso em correção REGRAS; complemento F5 em isolamento pelo RED. W5 ainda sem declaração de pronto.
- **Rodada:** 3 de 3; quatro causas adicionais ADV-017…020, sem reabrir decisões.
- **Agente ativo no Vitest:** nenhum (lock livre; ultimo: ORQ as 23:47:50, exit 0)
- **Base:** `f0/w5-integrado` @ `a99d8b4` (worktree `C:\Users\silas\Projects\OncoGlobal-wt\w5-orq`); WIP KERNEL `tests/server/adv006-saida.evidence.ts` preservado fora da suíte regular; sem push/deploy.
- **Fuso do serviço:** −03:00 (D-W5-01) · aviso APAC adiantado ≤ 1 dia aceitável, atrasado não (D-W5-02)

## Fases
| Fase | Estado | Evidência |
|---|---|---|
| P0 linha de base | FEITO 19:08 | `npm run verify` exit 0 · 53 arquivos / 345 testes · fronteiras ok (79) · corpus ok (20) · log `_w5-locks\logs\20261005-190530-ORQ.log` |
| P0 worktrees + `npm ci` (um por vez) | FEITO 19:12 | 5 worktrees de `6b96702`; `npm ci` serial, 12–13 s cada, exit 0 |
| P1 matriz de rastreabilidade | FEITO leitura / PARCIAL cobertura | `docs/w5/MATRIZ.md`: 195 IDs; 65 COBERTO/111 PARCIAL/13 SEM_TESTE/6 FORA_DO_F0; zero A_AUDITAR textual residual; mapas de cinco trilhas |
| P2 ataque (rodadas 1/2) | PARCIAL | RED-R1 31 testes 22 FAIL/9 PASS; RED-R2 F5 9/9 mutações detectadas no unitário, F9/F11/F7/F8 novos ataques e F6 6 PASS; integrado rodada 2 50 testes 31 FAIL/19 PASS antes das últimas correções |
| P3 triagem (rodadas 1/2) | FEITO para 16 causas atuais | `docs/w5/ACHADOS.md`: 0 ABERTO, 10 CORRIGIDO, 2 BLOQUEADO, 2 AMB, 2 RESISTIU; CP-001/002 e AMB-001/002 |
| P4 correção (rodadas 1/2) | FEITO para achados autorizados | 10 achados corrigidos/reatacados, inclusive ADV-011/012; ADV-006/013 bloqueados por contrato/escopo |
| P5 integração + reataque | VERDE regular / FAIL adversarial documentado | `700f3ee`: verify 77 arquivos/435 testes PASS, log `_w5-locks/logs/20261005-230022-ORQ.log`; reataque 53 testes, 10 FAIL/43 PASS, log `_w5-locks/logs/20261005-230124-ORQ.log`. W3 reexecutado na retomada: 9/9 PASS, log `_w5-locks/logs/20261005-230909-ORQ.log` |
| P6 relatório | RASCUNHO | `docs/w5/RELATORIO-W5.md` deve ser atualizado após desbloqueio, último verify e regressão W3 |

## Agentes (§3)
| Agente | Worktree | Branch | Estado | Tarefa atual |
|---|---|---|---|---|
| RED | `w5-red` | `f0/w5-red` | R2 @`48920a9` + patch `585c113` integrados | F5 9/9 mutações unitárias; reataque R2 restrito |
| KERNEL | `w5-kernel` | `f0/w5-kernel` | ADV-001/002/003/004/005/011/012 integrados | leitura K/N; ADV-006 bloqueado por CP-001 |
| REGRAS | `w5-regras` | `f0/w5-regras` | ADV-010 integrado | delta reatacado 4/4; sem WIP |
| DOMINIO | `w5-dominio` | `f0/w5-dominio` | ADV-012/014/015 integrados/reatacados | leitura módulos/corpus; ADV-007/008 AMB |
| E2E-UI | `w5-e2e` | `f0/w5-e2e` | INFRA-01 + fixture E2E corrigida | sem WIP conhecido |

## Achados por estado
| ABERTO | CORRIGIDO | RESISTIU | BLOQUEADO_CONTRATO | AMB |
|---|---|---|---|---|
| 0 | 10 | 2 | 2 | 2 |

## Mecânica de coordenação (decisão do orquestrador, registrada)
- **Vitest um por vez (§6.4):** todo `npm run verify`, `npx tsc` ou `npx vitest` passa por `docs/w5/ferramentas/vitest-lock.ps1` (lock atômico fora do repo, em `C:\Users\silas\Projects\OncoGlobal-wt\_w5-locks\vitest.lock`; logs em `_w5-locks\logs`). O script escreve o nome do agente na linha "Agente ativo no Vitest" acima e a limpa ao terminar.
- **CLAIMS (§6.1):** reservas via `docs/w5/ferramentas/claim.ps1`, que grava em `docs/w5/CLAIMS.md` **deste** worktree (fonte única) e recusa arquivo fora da trilha do agente.
- **`tests/adv/` fora da suíte regular:** INFRA-01 integrada, com filtro explícito do reataque e fixture E2E excluída da raiz; o typecheck continua incluindo `tests/adv/**`.

## Últimas ações
| Hora (−03:00) | Ação |
|---|---|
| 2026-10-05 23:09 | Codex assume retomada solicitada por Dr. Silas; agentes RED `/root/red`, KERNEL `/root/kernel` e DOMINIO `/root/dominio` nas trilhas existentes; REGRAS/E2E-UI serão executados em sequência por limite de três agentes simultâneos. W3 9/9 PASS. |
| 2026-10-05 23:01 | Reataque antes da limpeza: 10 FAIL/43 PASS; somente ADV-006 (4), ADV-007 (2), ADV-008 (1) e ADV-013 (3). ADV-011/012 corrigidos e integrados. |
| 2026-10-05 19:00 | Leitura integral de W5-FUGU-ULTRA, W2-CABECALHO-COMUM, PLANO v1.1, DECISOES, contratos, auditoria-regressao, W4-FUGU. |
| 2026-10-05 19:04 | Criados `docs/w5/` (ESTADO, CLAIMS, AMB, ACHADOS) e as ferramentas de lock/claims/varredura. |
| 2026-10-05 19:08 | P0 VERDE (saída abaixo). Varredura automática de IDs: 82 IDs sem referência (bate com a do tech lead ±1 em T). |
| 2026-10-05 19:12 | 5 worktrees criados + `npm ci` serial. Briefing comum (`docs/w5/BRIEFING-AGENTES.md`) commitado em `17f0501`. |
| 2026-10-05 19:20 | 5 agentes lançados (RED, KERNEL, REGRAS, DOMINIO, E2E-UI). |
| 2026-10-05 21:21 | Auditoria-regressão no integrado: 1 arquivo/9 testes PASS, exit 0; log `_w5-locks/logs/20261005-212110-ORQ.log`. |
| 2026-10-05 21:29 | RED lote 1 commitado: 31 testes (22 FAIL/9 PASS); achados ADV-001…011 triados, duas ambiguidades de lote. |
| 2026-10-05 21:31 | P4 atribuído a KERNEL/REGRAS; integração P5 e relatório P6 ainda PENDENTES. |
| 2026-10-05 22:35 | ADV-001/005/010 integrados e reatacados; RED-R2 trouxe F5 9/9 mutações unitárias, F9/F11 e mais achados. |
| 2026-10-05 22:39 | ADV-002 bundle HTTP integrado e reatacado 3/3 (com 5 filtrados); verify `68/397` verde. |
| 2026-10-05 22:40 | Merge ADV-014/015 feito; verify **FAIL no typecheck** em testes RED/E2E, log `_w5-locks/logs/20261005-224000-ORQ.log`; esperar correção dos donos. |
| 2026-10-05 22:44 | Patches RED/E2E integrados; verify 70/405 PASS; ADV-014/015 reataque 6/6. |
| 2026-10-05 22:46 | ADV-003/004 integrados; verify 72/412 PASS; F3 RED 5/5 PASS. |
| 2026-10-05 22:47 | Reataque amplo 53 testes, 15 FAIL/38 PASS; remanescentes somente ADV-006/007/008/011/012/013. |

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
