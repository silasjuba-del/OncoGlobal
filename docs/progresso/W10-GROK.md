# W10-GROK — progresso

Worktree `C:\Users\silas\Projects\OncoGlobal-wt\w10-grok`, branch `f0/w10-grok`. Base `f0/w1-integrado` @ `d2af9e7` (já era o HEAD; merge sem efeito).

| Fatia | Estado | Commit | Notas |
|---|---|---|---|
| GROK-01 corte do salão | FEITA | W10-GROK-01 | Portões nomeados no ruleset. FN-01 intacta. |
| GROK-02 limiar de bula × CTCAE | FEITA | W10-GROK-02 | Porta lê mínimo de bula. Grau CTCAE só candidata. |
| GROK-03 alerta FEVE | FEITA | W10-GROK-03 | FEVE &lt; 50% com antraciclina ou anti-HER2 programado alerta. |
| GROK-04 agenda de QT | FEITA | W10-GROK-04 | Conflito alerta. Otimizar dia não reordena. |
| GROK-05 RADS 30 emergências | FEITA | W10-GROK-05 | PT08 abdome alerta linhas 7 e 27. Crânio não alerta. |
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

## GROK-03

`alertarFeve(entrada, rs)` em `src/rules/alertaFeve.ts`. O limite e as classes (antraciclina, anti-HER2) estão em `corpus/rulesets/salao-feve.v1.json`. FEVE abaixo do limite, com um desses fármacos na lista programada, devolve ALERTA com valor, método e data. Igual ao limite passa. FEVE ausente com esses fármacos fica PENDENTE e não vira 0. FEVE medida 0 alerta. Sem esses fármacos não há alerta. Método ou data ausentes permanecem como pendência dentro do alerta. `bloqueiaSalvar` é o literal `false`.

`git merge f0/w1-integrado` no início: fast-forward até `f62c2fe` (D-W9-55 a D-W9-57). Não alteram esta fatia.

Testes novos: `tests/w10-grok/grok-03-feve.test.ts` (7).

### Saídas

`npx tsc --noEmit` — exit 0, sem diagnóstico.

`npm run check:boundaries`

```
fronteiras ok (153 arquivos)
```

`npm run check:corpus` — `corpus/rulesets/salao-feve.v1.json` header ok, `[VERIFICAR]` 0. Fecho: `corpus ok (31 arquivos)`.

`npx vitest run tests/w10-grok tests/corpus/loader.test.ts --no-file-parallelism`

```
Test Files  4 passed (4)
     Tests  63 passed (63)
```

7 da GROK-03, 38 da GROK-01, 11 da GROK-02 e 7 do loader.

`npx vitest run tests/w3/auditoria-regressao.test.ts --no-file-parallelism`

```
Test Files  1 passed (1)
     Tests  9 passed (9)
```

## GROK-04

`validarAgenda(sessoes, rs)` e `gerarSessoes(pedido)` em `src/rules/agendaQt.ts`. Limites em `corpus/rulesets/agenda-qt.v1.json`: tratamento de 300 min ou mais só inicia até 12:00; no máximo 5 inícios em janela de 30 min; grade de 13 poltronas, 08:00–18:00. Igual ao limite passa. Conflito de poltrona ou de lotação é ALERTA. Poltrona ausente fica PENDENTE. `bloqueiaSalvar` é o literal `false`. `reorganizou` é o literal `false`: pedir Otimizar dia devolve o alerta e mantém ordem e horário.

A geração soma dias civis (1º dia + ciclos × intervalo) sem pular sábado, domingo ou feriado.

`git merge f0/w1-integrado` no fechamento trouxe `10bb8d4` (contratos `src/contracts/w10/`, barrel R-08, pdfjs-dist). Não há contrato de agenda; a fatia segue com tipo local. A série abaixo rodou depois desse merge.

Testes novos: `tests/w10-grok/grok-04-agenda.test.ts` (5).

### Saídas

`npx tsc --noEmit` — exit 0, sem diagnóstico.

`npm run check:boundaries`

```
fronteiras ok (158 arquivos)
```

`npm run check:corpus` — `corpus/rulesets/agenda-qt.v1.json` header ok, `[VERIFICAR]` 0. Fecho: `corpus ok (32 arquivos)`.

`npx vitest run tests/w10-grok tests/corpus/loader.test.ts --no-file-parallelism`

```
Test Files  5 passed (5)
     Tests  68 passed (68)
```

5 da GROK-04, mais GROK-01 (38), GROK-02 (11), GROK-03 (7) e o loader (7).

`npx vitest run tests/w3/auditoria-regressao.test.ts --no-file-parallelism`

```
Test Files  1 passed (1)
     Tests  9 passed (9)
```

## GROK-05

`detectarEmergencias(laudoTexto, rs)` em `src/rules/radsEmergencias.ts`. As 30 cadeias, os sinônimos, a proximidade e as negações estão em `corpus/rulesets/rads-emergencias.v1.json`. A cadeia só fecha com elos suficientes, na ordem do ruleset e dentro da proximidade. "sem sinais de", "não há" e "ausência de" anulam o elo até o fim da frase. A saída traz trecho, lateralidade e nível vertebral. `confirmadoPeloMedico` e `bloqueiaSalvar` são os literais `false`.

PT08 abdome: linha 7 uropatia à direita e linha 27 fratura em L5. PT08 crânio: nenhum alerta. `corpus/rulesets/rad-emergencia.v1.json` (FN-20, sinônimos vazios) não foi editado.

`git merge f0/w1-integrado` no início: `044d94f` (só `docs/ondas/W10-REDTEAM-GLM.md`).

Testes novos: `tests/w10-grok/grok-05-rads.test.ts` (6).

### Saídas

`npx tsc --noEmit` — exit 0, sem diagnóstico.

`npm run check:boundaries`

```
fronteiras ok (159 arquivos)
```

`npm run check:corpus` — `corpus/rulesets/rads-emergencias.v1.json` header ok, `[VERIFICAR]` 0. Fecho: `corpus ok (33 arquivos)`.

`npx vitest run tests/w10-grok tests/corpus/loader.test.ts --no-file-parallelism`

```
Test Files  6 passed (6)
     Tests  74 passed (74)
```

6 da GROK-05, mais GROK-01 (38), GROK-02 (11), GROK-03 (7), GROK-04 (5) e o loader (7).

`npx vitest run tests/w3/auditoria-regressao.test.ts --no-file-parallelism`

```
Test Files  1 passed (1)
     Tests  9 passed (9)
```
