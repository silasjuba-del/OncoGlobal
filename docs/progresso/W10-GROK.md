# W10-GROK — progresso

Worktree `C:\Users\silas\Projects\OncoGlobal-wt\w10-grok`, branch `f0/w10-grok`. Base `f0/w1-integrado` @ `d2af9e7` (já era o HEAD; merge sem efeito).

| Fatia | Estado | Commit | Notas |
|---|---|---|---|
| GROK-01 corte do salão | FEITA | W10-GROK-01 | Portões nomeados no ruleset. FN-01 intacta. |
| GROK-02 limiar de bula × CTCAE | — | | |
| GROK-03 alerta FEVE | — | | |
| GROK-04 agenda de QT | — | | |
| GROK-05 RADS 30 emergências | — | | |
| GROK-06 INTERVAL_PROGRESSION | — | | |
| GROK-07 nódulo &lt; 1 cm e Mx | — | | |
| GROK-08 FN-16 semáforo | — | | |
| GROK-09 suporte não oncológico | — | | |
| GROK-10 ownership | — | | |
| GROK-11 manifesto | — | | |
| GROK-12 dedupe + fachada w8 | — | | |
| GROK-13 APAC no ledger | — | | |
| GROK-14 fichas + fechamento | — | | |

## GROK-01

Funções puras `avaliarCorteSalao`, `avaliarTriagemCiclo` e `avaliarPortoesW10` em `src/rules/triagem.ts` (espelho em `src/rules/index.ts`, R-08). Limiares só em `corpus/rulesets/salao-triagem.v1.json` → `portoes`. Igual ao limite passa. Destino `FILA_MEDICO` + motivo. `bloqueiaSalvar` é sempre `false`.

Creatinina em centésimos de mg/dL (150 = 1,50 passa; 151 corta). Idade ausente continua `pendente.idadeAnos` (D-W9-03).

`avaliarTriagem` não mudou de comportamento: FC &lt; 50 segue em `naoCortes`. O corte D-W9-37 está no portão separado.

Testes novos: `tests/w10-grok/grok-01-portoes.test.ts` (38).

PEDIDOS: `docs/w10/PEDIDOS-GROK.md`.

### Saídas

`npx tsc --noEmit` — exit 0, sem diagnóstico.

`npm run check:boundaries`

```
fronteiras ok (136 arquivos)
```

`npm run check:corpus` — `corpus/rulesets/salao-triagem.v1.json` header ok, `[VERIFICAR]` 0. Fecho: `corpus ok (29 arquivos)`.

`npx vitest run tests/w10-grok/grok-01-portoes.test.ts tests/rules --no-file-parallelism`

```
Test Files  24 passed (24)
     Tests  209 passed (209)
```

O filtro `tests/rules` também casou `tests/rules-w8`.

`npx vitest run tests/modules tests/w3/auditoria-regressao.test.ts --no-file-parallelism`

```
Test Files  18 passed (18)
     Tests  74 passed (74)
```
