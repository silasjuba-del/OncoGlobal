# W10-GROK — progresso

Worktree `C:\Users\silas\Projects\OncoGlobal-wt\w10-grok`, branch `f0/w10-grok`. Base `f0/w1-integrado` @ `d2af9e7` (já era o HEAD; merge sem efeito).

| Fatia | Estado | Commit | Notas |
|---|---|---|---|
| GROK-01 corte do salão | FEITA | W10-GROK-01 | Portões nomeados no ruleset. FN-01 intacta. |
| GROK-02 limiar de bula × CTCAE | FEITA | W10-GROK-02 | Porta lê mínimo de bula. Grau CTCAE só candidata. |
| GROK-03 alerta FEVE | FEITA | W10-GROK-03 | FEVE &lt; 50% com antraciclina ou anti-HER2 programado alerta. |
| GROK-04 agenda de QT | FEITA | W10-GROK-04 | Conflito alerta. Otimizar dia não reordena. |
| GROK-05 RADS 30 emergências | FEITA | W10-GROK-05 | PT08 abdome alerta linhas 7 e 27. Crânio não alerta. |
| GROK-06 INTERVAL_PROGRESSION | FEITA | W10-GROK-06 | L5 do PT10 alerta. Não gera M1. |
| GROK-07 nódulo &lt; 1 cm e Mx | FEITA | W10-GROK-07 | Abaixo de 1 cm fica INDETERMINADO. Mx não troca o texto. |
| GROK-08 FN-16 semáforo | FEITA | W10-GROK-08 | Adv FN-16 verde. Catálogo inativo. Sem bloqueio. |
| GROK-09 suporte não oncológico | FEITA | W10-GROK-09 | Alertas da biblioteca. Sem bloqueio. |
| GROK-10 ownership | FEITA | W10-GROK-10 | Veredito em ownership.ts. t56 ainda lê gates.ts. |
| GROK-11 manifesto | FEITA | W10-GROK-11 | Script nomeia arquivo fora da trilha. n19 procura outro nome. |
| GROK-12 dedupe + fachada w8 | FEITA | W10-GROK-12 | Caso 07 verde. Fachada no barrel. |
| GROK-13 APAC no ledger | FEITA | W10-GROK-13 | Emissão persistível no módulo. Snapshot alinhado sem contrato. |
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

## GROK-06

`intervalProgression(exameAnterior, exameAtual, rs, lacunas)` em `src/rules/intervalProgression.ts`. Frases de aumento, métodos equivalentes e a lista NÃO SEI estão em `corpus/rulesets/rads-interval.v1.json`. Mesmo sítio, mesmo método e aumento (medida estritamente maior, ou texto "aumentado em relação a") geram a flag `INTERVAL_PROGRESSION`. O exame dirigido entra como pendência. `geraM1` e `bloqueiaSalvar` são os literais `false`. Medida igual não aumenta. Medida ausente não vira 0. "Degenerativo" no laudo não apaga a flag. Lateralidade divergente fica pendente (D-W9-05) e não vira progressão.

PT10: CO de 2028-05-14 e cintilografia óssea de 2029-08-19 em L5, lateralidade "à esquerda", pendência "RM lombar", NÃO SEI de histologia, TNM, RE, RP, HER2, data da mastectomia e tratamento sistêmico.

`git merge f0/w1-integrado` no início: `5975dd2` (fichas, APAC, gates).

Testes novos: `tests/w10-grok/grok-06-interval.test.ts` (7).

### Saídas

`npx tsc --noEmit` — exit 0, sem diagnóstico.

`npm run check:boundaries`

```
fronteiras ok (171 arquivos)
```

`npm run check:corpus` — `corpus/rulesets/rads-interval.v1.json` header ok, `[VERIFICAR]` 0. Fecho: `corpus ok (95 arquivos)`.

`npx vitest run tests/w10-grok tests/corpus/loader.test.ts --no-file-parallelism`

```
Test Files  7 passed (7)
     Tests  81 passed (81)
```

7 da GROK-06, mais GROK-01 (38), GROK-02 (11), GROK-03 (7), GROK-04 (5), GROK-05 (6) e o loader (7).

`npx vitest run tests/w3/auditoria-regressao.test.ts --no-file-parallelism`

```
Test Files  1 passed (1)
     Tests  9 passed (9)
```

## GROK-07

`avaliarNodulo` e `sugerirMx` em `src/rules/noduloIndeterminado.ts`. O limite de 10 mm, a pendência e a sugestão estão em `corpus/rulesets/rads-nodulo.v1.json`. Nódulo abaixo de 1 cm (incluindo "6–7 mm" e "0,9 cm") fica `INDETERMINADO`, com pendência "TC em 4 meses comparando". Igual a 1 cm não entra. Faixa que cruza 1 cm fica PENDENTE. Medida ausente não vira 0. `geraM1` e `bloqueiaSalvar` são os literais `false`.

Texto com Mx (também cMx, pMx e cT2N0Mx) devolve a sugestão "cM0 com nódulos indeterminados" e o texto original intacto. "cM0" e "Máximo" não disparam.

`git merge f0/w1-integrado` no início: `6c3141a` (prescrição, morfometria, D-W9-59/60). `src/rules/prescricao/**` e `src/rules/morfometria/**` não foram editados.

Testes novos: `tests/w10-grok/grok-07-nodulo.test.ts` (5).

### Saídas

`npx tsc --noEmit` — exit 0, sem diagnóstico.

`npm run check:boundaries`

```
fronteiras ok (179 arquivos)
```

`npm run check:corpus` — `corpus/rulesets/rads-nodulo.v1.json` header ok, `[VERIFICAR]` 0. Fecho: `corpus ok (96 arquivos)`.

`npx vitest run tests/w10-grok tests/corpus/loader.test.ts --no-file-parallelism`

```
Test Files  8 passed (8)
     Tests  86 passed (86)
```

5 da GROK-07, mais GROK-01 (38), GROK-02 (11), GROK-03 (7), GROK-04 (5), GROK-05 (6), GROK-06 (7) e o loader (7).

`npx vitest run tests/w3/auditoria-regressao.test.ts --no-file-parallelism`

```
Test Files  1 passed (1)
     Tests  9 passed (9)
```

## GROK-08

`semaforoInteracoes(input, rs)` em `src/rules/semaforoInteracoes.ts`, reexportado por `src/rules/index.ts`. As 30 linhas de `03-interacoes-qt.csv` entraram em `corpus/rulesets/interacoes.v1.json` com `ativo: false`. `fonte.referencia` continua `[VERIFICAR]` (o teste de corpus exige isso nas 34 linhas). A citação fica em `fonte.trecho`. `gravidadeEditorial` não vira bloqueio. `bloqueiaSalvar` é o literal `false`.

Lista nula ou sem a classe NÃO ONCOLÓGICAS fica PENDENTE. "sem interação" só sai VERDE com `checagemCompleta: true`, ruleset com item ativo que tem trecho, e nenhum par casado. Par ativo com trecho fica VERMELHO, inclusive se a coluna editorial diz Contraindicada.

`git merge f0/w1-integrado` no início: já estava em `597b868`.

`src/rules/w8/interacoes.ts` não foi editado.

Testes novos: `tests/w10-grok/grok-08-semaforo.test.ts` (5). Adv FN-16: 5 testes verdes.

### Saídas

`npx tsc --noEmit` — exit 0, sem diagnóstico.

`npm run check:boundaries`

```
fronteiras ok (180 arquivos)
```

`npm run check:corpus` — `corpus/rulesets/interacoes.v1.json` header ok, `[VERIFICAR]` 36, ativos 0. Fecho: `corpus ok (96 arquivos)`.

`npx vitest run tests/w10-grok tests/corpus/loader.test.ts tests/corpus/interacoes.test.ts tests/rules-w8/interacoes.test.ts --no-file-parallelism`

```
Test Files  11 passed (11)
     Tests  97 passed (97)
```

5 da GROK-08, mais GROK-01 (38), GROK-02 (11), GROK-03 (7), GROK-04 (5), GROK-05 (6), GROK-06 (7), GROK-07 (5), loader (7), corpus de interações (3) e `rules-w8/interacoes` (3).

`npx vitest run tests/w3/auditoria-regressao.test.ts --no-file-parallelism`

```
Test Files  1 passed (1)
     Tests  9 passed (9)
```

`npx vitest run --config tests/adv-w8/vitest.config.ts tests/adv-w8/fn16-t34-semaforo-interacoes.adv.ts --no-file-parallelism`

```
Test Files  1 passed (1)
     Tests  5 passed (5)
```

## GROK-09

`alertarSuporte(entrada, rs)` em `src/rules/suporteNaoOncologico.ts`. Textos e sinônimos em `corpus/rulesets/salao-suporte.v1.json`. `bloqueiaSalvar` é o literal `false`. `canal-redflags.v1.json` não foi editado.

Diarreia estritamente acima de 24 h com anti-hipertensivo na lista alerta "suspender anti-hipertensivo". Lista nula fica PENDENTE. Vômito com diarreia (horas > 0) alerta "orientar PS para hidratação venosa". Vômito sozinho não alerta. Horas nulas com vômito ficam PENDENTE. Corticoide com DM-2 alerta hiperglicemia. Um dos dois sozinho não alerta. DM-2 ausente com corticoide fica PENDENTE. Febre em décimos estritamente acima de 378 alerta o texto da biblioteca (D-W9-38). 378 não dispara. Temperatura nula continua nula.

`git merge f0/w1-integrado` no início: já estava em `bd8a35e`.

Testes novos: `tests/w10-grok/grok-09-suporte.test.ts` (6).

### Saídas

`npx tsc --noEmit` — exit 0, sem diagnóstico.

`npm run check:boundaries`

```
fronteiras ok (181 arquivos)
```

`npm run check:corpus` — `corpus/rulesets/salao-suporte.v1.json` header ok, `[VERIFICAR]` 0, ativos 0. Fecho: `corpus ok (97 arquivos)`.

`npx vitest run tests/w10-grok tests/corpus/loader.test.ts tests/corpus/interacoes.test.ts tests/rules-w8/interacoes.test.ts --no-file-parallelism`

```
Test Files  12 passed (12)
     Tests  103 passed (103)
```

6 da GROK-09, mais GROK-01 (38), GROK-02 (11), GROK-03 (7), GROK-04 (5), GROK-05 (6), GROK-06 (7), GROK-07 (5), GROK-08 (5), loader (7), corpus de interações (3) e `rules-w8/interacoes` (3).

`npx vitest run tests/w3/auditoria-regressao.test.ts --no-file-parallelism`

```
Test Files  1 passed (1)
     Tests  9 passed (9)
```

## GROK-10

`g16Owner(input, catalogo?)` em `src/kernel/harness/ownership.ts`. O catálogo padrão é `corpus/capabilities.v1.json` (`ownerOf` de `AgentSpec`). Write do dono declarado passa. Write de outro agente é `BLOQUEIA_AUTORIDADE`, gate `G-16`, motivo com o dono declarado (K-21). Leitura passa. Operação ausente ou diferente de write fica PENDENTE. Objeto sem dono, ou com dois donos, bloqueia. `gates.ts` não foi editado.

`git merge f0/w1-integrado` no início: merge `f51e9ba` (integração em `9c8a113`).

Testes novos: `tests/w10-grok/grok-10-ownership.test.ts` (7).

O adv `t56-g16-owner-write.adv.ts` importa só `gates.js`. Resultado real: 1 falha (`SEM_IMPLEMENTACAO`, função null) e 4 passos. Os três casos de write/leitura devolvem cedo quando a função é null. O RT-09 acha `g16Owner` em `ownership.ts`: o teste de existência passa, e AG-04 escrevendo Conversation é `BLOQUEIA_AUTORIDADE` enquanto AG-14 passa.

### Saídas

`npx tsc --noEmit` — exit 0, sem diagnóstico.

`npm run check:boundaries`

```
fronteiras ok (189 arquivos)
```

`npm run check:corpus` — fecho: `corpus ok (108 arquivos)`.

`npx vitest run tests/w10-grok tests/corpus/loader.test.ts tests/corpus/interacoes.test.ts tests/rules-w8/interacoes.test.ts --no-file-parallelism`

```
Test Files  13 passed (13)
     Tests  110 passed (110)
```

7 da GROK-10, mais GROK-01 (38), GROK-02 (11), GROK-03 (7), GROK-04 (5), GROK-05 (6), GROK-06 (7), GROK-07 (5), GROK-08 (5), GROK-09 (6), loader (7), corpus de interações (3) e `rules-w8/interacoes` (3).

`npx vitest run tests/w3/auditoria-regressao.test.ts --no-file-parallelism`

```
Test Files  1 passed (1)
     Tests  9 passed (9)
```

`npx vitest run --config tests/adv-w8/vitest.config.ts tests/adv-w8/t56-g16-owner-write.adv.ts --no-file-parallelism` — exit 1.

```
Test Files  1 failed (1)
     Tests  1 failed | 4 passed (5)
```

## GROK-11

`scripts/verificar-manifesto.mjs` compara arquivos com a faixa GROK de `docs/ondas/W10-COMUM.md` e `docs/ondas/W10-GROK.md`. Fora da trilha sai `FORA_DA_TRILHA <arquivo>` e exit 1. Dentro sai `trilha ok`. Cada saída pina `BASE` e o sha256 de `src/contracts/**/*.ts`, `corpus/rulesets/*.json`, do manifesto e do W10-COMUM. Arquivo já existente em `src/rules/w8/` fica fora. Arquivo novo nesse diretório entra quando `--base` não o contém. `package.json` não foi editado.

`git merge f0/w1-integrado` no início: já estava em `07f0370`.

Testes novos: `tests/w10-grok/grok-11-manifesto.test.ts` (5). O diff `f0/w1-integrado...HEAD` cabe na trilha.

O adv `n19-manifesto-merge.adv.ts` procura `scripts/check-manifesto.mjs`, `scripts/check-claims.mjs`, `tests/w3/manifesto-merge.test.ts` ou `tests/manifesto.test.ts`. Resultado real: 1 falha (`SEM_IMPLEMENTACAO`) e 2 passos. O caso positivo devolve cedo quando o harness é null.

### Saídas

`npx tsc --noEmit` — exit 0, sem diagnóstico.

`npm run check:boundaries`

```
fronteiras ok (189 arquivos)
```

`npm run check:corpus` — fecho: `corpus ok (108 arquivos)`.

`npx vitest run tests/w10-grok tests/corpus/loader.test.ts tests/corpus/interacoes.test.ts tests/rules-w8/interacoes.test.ts --no-file-parallelism`

```
Test Files  14 passed (14)
     Tests  115 passed (115)
```

5 da GROK-11, mais GROK-01 (38), GROK-02 (11), GROK-03 (7), GROK-04 (5), GROK-05 (6), GROK-06 (7), GROK-07 (5), GROK-08 (5), GROK-09 (6), GROK-10 (7), loader (7), corpus de interações (3) e `rules-w8/interacoes` (3).

`npx vitest run tests/w3/auditoria-regressao.test.ts --no-file-parallelism`

```
Test Files  1 passed (1)
     Tests  9 passed (9)
```

`npx vitest run --config tests/adv-w8/vitest.config.ts tests/adv-w8/n19-manifesto-merge.adv.ts --no-file-parallelism` — exit 1.

```
Test Files  1 failed (1)
     Tests  1 failed | 2 passed (3)
```

## GROK-12

`deduplicarExames(paginas, campos?)` em `src/modules/documentos/dedupe.ts`. A chave padrão sai de `corpus/rulesets/dedupe-exame.v1.json`, item `patologia-ihq`: laboratório + nº do exame + data de entrada. Data impressa no topo e texto de conclusão ficam fora da chave. Campo ausente não junta páginas. `src/rules/w8/*` não foi editado. `src/leitura` não foi editado.

O adv `caso07-dedupe.adv.ts` acha a função no módulo e fica verde: 4 testes.

A fachada pedida em `src/rules/w8-fachada.ts` furaria a R-08. Os reexports estáveis estão em `src/rules/index.ts`, a partir dos arquivos folha de `w8`. O nome da função do w8 no barrel é `deduplicarExamesW8`, para não colidir com a do módulo.

`git merge f0/w1-integrado` no início: já estava em `d507e53`.

Testes novos: `tests/w10-grok/grok-12-dedupe.test.ts` (6).

### Saídas

`npx tsc --noEmit` — exit 0, sem diagnóstico.

`npm run check:boundaries`

```
fronteiras ok (190 arquivos)
```

`npm run check:corpus` — fecho: `corpus ok (108 arquivos)`.

`npx vitest run tests/w10-grok tests/corpus/loader.test.ts tests/corpus/interacoes.test.ts tests/rules-w8/interacoes.test.ts --no-file-parallelism`

```
Test Files  15 passed (15)
     Tests  121 passed (121)
```

6 da GROK-12, mais GROK-01 (38), GROK-02 (11), GROK-03 (7), GROK-04 (5), GROK-05 (6), GROK-06 (7), GROK-07 (5), GROK-08 (5), GROK-09 (6), GROK-10 (7), GROK-11 (5), loader (7), corpus de interações (3) e `rules-w8/interacoes` (3).

`npx vitest run tests/w3/auditoria-regressao.test.ts --no-file-parallelism`

```
Test Files  1 passed (1)
     Tests  9 passed (9)
```

`npx vitest run --config tests/adv-w8/vitest.config.ts tests/adv-w8/caso07-dedupe.adv.ts --no-file-parallelism`

```
Test Files  1 passed (1)
     Tests  4 passed (4)
```

## GROK-13

`validarEmissaoPersistida` em `src/modules/apac/emissao.ts`. O lote diário continua em `montarApacBatch`: vários pacientes, uma competência, exclusão nomeada, `trava: false`. O registro é persistível e `gravadoNoLedger` fica `false`. Não há escrita de sqlite, exportação SIA nem antiglosa.

O aviso usa data civil no offset injetado (produção −03:00, D-W5-01). Exatamente 1 dia adiantado avisa (D-W5-02). Zero não avisa. Acima de 1 dia não entra nesse aviso e bloqueia só o documento. Data ausente fica PENDENTE, sem virar dia 0. `consultaSegue` é `true` e `bloqueiaSalvar` é `false`.

Finalidade sai da lista D-W9-12 em `corpus/rulesets/agenda-apac-emissao.v1.json`. Intenção clínica não preenche a finalidade. `PREVIA` não vira `Prévia`. CNS é o algoritmo e-SUS em `src/modules/apac/cns.ts` (o módulo não importa `src/apac`); DV válido traz `DV_VALIDO_NAO_PROVA_IDENTIDADE`. CNES vem da configuração injetada. `2605473` no ruleset é exemplo, não trava.

`alinharSnapshotProjecao` em `src/modules/consulta/alinharSnapshot.ts` aceita um objeto no formato da projeção, sem importar `src/kernel`. `CURRENT` não vira snapshot confirmado. Proposta não vira fato. Valor ausente não vira VERDE nem string vazia. Conflito permanece. `SnapshotConfirmado` de `preConsulta.ts` não foi reescrito.

`git merge f0/w1-integrado` no início não era ancestral (`376b6e1`). Merge ort `589aaee`, sem conflito. A série abaixo é depois desse merge.

Testes novos: `tests/w10-grok/grok-13-apac-snapshot.test.ts` (16). Os testes de lote em `tests/modules` seguem verdes (11).

### Saídas

`npx tsc --noEmit` — exit 0, sem diagnóstico.

`npm run check:boundaries`

```
fronteiras ok (204 arquivos)
```

`npm run check:corpus` — fecho: `corpus ok (109 arquivos)`.

`npx vitest run tests/w10-grok tests/corpus/loader.test.ts tests/corpus/interacoes.test.ts tests/rules-w8/interacoes.test.ts --no-file-parallelism`

```
Test Files  16 passed (16)
     Tests  137 passed (137)
```

16 da GROK-13, mais GROK-01 (38), GROK-02 (11), GROK-03 (7), GROK-04 (5), GROK-05 (6), GROK-06 (7), GROK-07 (5), GROK-08 (5), GROK-09 (6), GROK-10 (7), GROK-11 (5), GROK-12 (6), loader (7), corpus de interações (3) e `rules-w8/interacoes` (3).

`npx vitest run tests/w3/auditoria-regressao.test.ts --no-file-parallelism`

```
Test Files  1 passed (1)
     Tests  9 passed (9)
```
