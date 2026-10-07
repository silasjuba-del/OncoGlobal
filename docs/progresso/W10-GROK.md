# W10-GROK — progresso

Worktree `C:\Users\silas\Projects\OncoGlobal-wt\w10-grok`, branch `f0/w10-grok`. Base `f0/w1-integrado` @ `d2af9e7` (já era o HEAD; merge sem efeito).

| Fatia | Estado | Commit | Notas |
|---|---|---|---|
| GROK-01 corte do salão | FEITA | W10-GROK-01 | Portões nomeados no ruleset. FN-01 intacta. |
| GROK-02 limiar de bula × CTCAE | FEITA | W10-GROK-02 | Porta lê mínimo de bula. Grau CTCAE só candidata. |
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

## GROK-02

`portaCiclo(labs, protocolo, rs)` lê mínimos de bula declarados no protocolo (neutrófilos, plaquetas, clearance, FEVE). `grauCtcae` só candidata toxicidade: estado `PENDENTE`, `confirmadoPeloMedico` false. A tabela está em `corpus/rulesets/salao-ctcae.v1.json`. Igual ao limite de bula passa. Lab ausente ou limiares vazios ficam `PENDENTE`, nunca 0 e nunca soltam. `bloqueiaSalvar` é o literal `false`. O motivo cita D-W9-22a.

Adversarial: N 1200 com bula 1500 e porta "grau ≥ 2" não solta. Protocolo só com porta de grau não solta. Bula mínima 1000 com N 1200 solta, porque o número é o da ficha.

Fronteiras CTCAE v6: N 1000 = G1 e 999 = G2; Hb 80 dg/dL (8,0) = G2 e 79 = G3; PLQ 10000 = G3 e 9999 = G4. Grau ausente não vira 0. G1 de Hb e de plaquetas exige LIN e fica `null`.

O alerta de FEVE &lt; 50 com método, data e fármaco (D-W9-34b) fica na GROK-03.

`git merge f0/w1-integrado` no fechamento: `Already up to date` (base segue `d2af9e7`).

Testes novos: `tests/w10-grok/grok-02-bula-ctcae.test.ts` (11).

PEDIDOS: `docs/w10/PEDIDOS-GROK.md` (seção GROK-02).

### Saídas

`npx tsc --noEmit` — exit 0, sem diagnóstico.

`npm run check:boundaries`

```
fronteiras ok (137 arquivos)
```

`npm run check:corpus` — `corpus/rulesets/salao-ctcae.v1.json` header ok, `[VERIFICAR]` 0. Fecho: `corpus ok (30 arquivos)`.

`npx vitest run tests/w10-grok/grok-02-bula-ctcae.test.ts tests/corpus/loader.test.ts --no-file-parallelism`

```
Test Files  2 passed (2)
     Tests  18 passed (18)
```

11 da GROK-02 e 7 do loader.

`npx vitest run tests/w10-grok tests/rules tests/w3/auditoria-regressao.test.ts --no-file-parallelism`

```
Test Files  26 passed (26)
     Tests  229 passed (229)
```

O filtro `tests/rules` também casou `tests/rules-w8`. A série inclui GROK-01 (38), GROK-02 (11) e a auditoria (9).
