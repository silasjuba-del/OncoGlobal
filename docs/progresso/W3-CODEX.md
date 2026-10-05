# W3 - CODEX

Executor: CODEX  
Branch: f0/w3-codex  
Worktree: C:\Users\silas\Projects\OncoGlobal-wt\w3-codex

| Fatia | Estado | Commit | Verify | Pendencias |
|---|---|---|---|---|
| CDX-01 tipos-w3.ts | FEITA | d239c77 | PASS serial: typecheck; 52 arquivos; 20 files/183 tests | tipos locais W3; contratos congelados preservados |
| CDX-02 labAlerts.ts | FEITA | f57e2a7 | PASS serial: 52 arquivos; 20 files/183 tests; 23.91s | threshold inativo PENDENTE; numericos/conversoes invalidos rejeitados |
| CDX-03 radAlerts.ts | FEITA | adce743 | PASS serial: 20 files/183 tests; 16.17s | ocorrencias independentes; alerta nunca confirma fato; fonte integral preservada |
| CDX-04 redFlagsCanal.ts | FEITA | 58c6c87 | PASS serial: 20 files/183 tests; 19.35s | negacao e tempo por ocorrencia; alvo contato preservado |
| CDX-05 cumulativoAlerta.ts | FEITA | f9cc8bc | PASS serial: 20 files/183 tests; 13.40s | dedupe por adminId; divergencia vermelha; limite da mesma droga; escopo explicito |
| CDX-06 ctcaeGrau.ts | FEITA | fe123ee | PASS serial: 20 files/183 tests; 12.76s | basal obrigatorio; sem coercao; grau candidato e PENDENTE de revisao |
| CDX-07 recist.ts | FEITA | neste commit | PASS serial: 20 files/183 tests; 11.46s | decimais exatos na decisao; codigos conferidos; precedencia PR/PD [VERIFICAR] |
| CDX-08 escores.ts | PENDENTE | - | NOT_RUN | - |
| CDX-09 intervaloQt.ts | PENDENTE | - | NOT_RUN | - |
| CDX-10 tests/w3/** | PENDENTE | - | NOT_RUN | - |

## Retomada 2026-10-05

Base integrada com merge 07ccd74; WIP preservado. Git autorizado expressamente.
Primeira execucao serial: 182 PASS / 1 FAIL (CTCAE devolvia grau inferior apesar de basal obrigatorio ausente).
Reparo minimo no WIP de CDX-06 para restabelecer a verificacao; arquivo sera completado e commitado em sua fatia.
Reexecucao: typecheck PASS, fronteiras ok (52 arquivos), 20 files / 183 tests passed, Duration 21.23s.
Comando autorizado de retomada: `npm.cmd run typecheck`, `npm.cmd run check:boundaries`, `npx.cmd vitest run --no-file-parallelism`, em sequencia, interrompendo no primeiro erro.
O verify literal com workers paralelos nao foi repetido devido ao OOM documentado. Evidencias abaixo desta secao sao historicas.

## Saida historica do verify anterior a retomada

npm.cmd run verify falhou inicialmente porque o PowerShell bloqueou npm.ps1; usando npm.cmd, o vitest estourou heap nos workers com o limite padrao.

Reexecucao equivalente com memoria de Node ampliada:

```powershell
$env:NODE_OPTIONS='--max-old-space-size=4096'; npm.cmd run verify
```

## CDX-02 verify

`$env:NODE_OPTIONS='--max-old-space-size=4096'; npm.cmd run verify`:

- typecheck: PASS
- check:boundaries: PASS, `fronteiras ok (24 arquivos)`
- vitest paralelo: FALHOU por OOM/VirtualAlloc em workers, sem falha de assert.

Evidencia complementar equivalente para testes, limitando workers:

```powershell
$env:NODE_OPTIONS='--max-old-space-size=4096'; npx.cmd vitest run --maxWorkers=1
```

```text
Test Files  9 passed (9)
     Tests  122 passed (122)
  Duration  19.83s
```

Saida:

```text
> oncoglobal@0.0.1 verify
> npm run typecheck && npm run check:boundaries && npm test

> oncoglobal@0.0.1 typecheck
> tsc --noEmit

> oncoglobal@0.0.1 check:boundaries
> node scripts/check-boundaries.mjs

fronteiras ok (23 arquivos)

> oncoglobal@0.0.1 test
> vitest run

 RUN  v5.0.3 C:/Users/silas/Projects/OncoGlobal-wt/w3-codex

 Test Files  9 passed (9)
      Tests  122 passed (122)
   Start at  17:18:10
   Duration  1.68s (import 69%, transform 21%, tests 9%, worker 2%)
```






