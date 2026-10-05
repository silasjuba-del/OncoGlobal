# W2-FUGU — progresso de execução

Worktree `w2-fugu`, branch `f0/w2-fugu`. Apenas fixtures sintéticas.

| Fatia | Estado | Commit | `npm run verify` | Pendências |
|---|---|---|---|---|
| 01 Ledger | FEITA | `5da2367` | 2 arquivos, 30 testes; typecheck e fronteiras OK | [VERIFICAR] Integração posterior com Action Gateway e assinaturas |
| 02 Projeções | FEITA | `634aa51` | 3 arquivos, 34 testes; typecheck e fronteiras OK | [VERIFICAR] Referências de ruleset exigidas no consumidor clínico |
| 03 Delta | FEITA | `16fce23` | 4 arquivos, 38 testes; typecheck e fronteiras OK | — |
| 04 Identidade | FEITA | `dcef444` | 5 arquivos, 42 testes; typecheck e fronteiras OK | — |
| 05 Caixa | FEITA | `a70dc31` | 6 arquivos, 45 testes; typecheck e fronteiras OK | — |
| 06 Maestro / ORK | FEITA | `6f00c6c` | 7 arquivos, 49 testes; typecheck e fronteiras OK | — |
| 07 Microprompts | FEITA | `9733bab` | 8 arquivos, 51 testes; typecheck e fronteiras OK (`GOMAXPROCS=2`) | [VERIFICAR] BASE integral §§15/17/20/24/47 não está neste repo |
| 08 APAC | FEITA | `f7c7319` | 9 arquivos, 56 testes; typecheck e fronteiras OK | [VERIFICAR] Nomenclatura oficial da finalidade APAC e SIGTAP |
| 09 Servidor | FEITA (concluída pelo Claude após queda do Fugu) | ver log | 19 arquivos, 159 testes; typecheck e fronteiras OK | Checador de fronteiras: `node:http` permitido só em src/server (entrada 127.0.0.1); saída continua proibida (prova negativa executada) |
| 10 Backup | FEITA | `190ed7a` | 10 arquivos, 57 testes; typecheck e fronteiras OK (`GOMAXPROCS=1`, heap 256 MB) | [VERIFICAR] HD externo físico e enumeração de anexos além de drafts |

## Saída real do último verify

```text
> oncoglobal@0.0.1 verify
> npm run typecheck && npm run check:boundaries && npm test
> oncoglobal@0.0.1 typecheck
> tsc --noEmit
> oncoglobal@0.0.1 check:boundaries
> node scripts/check-boundaries.mjs
fronteiras ok (25 arquivos)
> oncoglobal@0.0.1 test
> vitest run
Test Files  10 passed (10)
Tests  57 passed (57)
```
