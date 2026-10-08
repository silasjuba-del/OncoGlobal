# W12-GROK — progresso

Worktree `C:\Users\silas\Projects\OncoGlobal-wt\w12-grok`, branch `f0/w12-grok`. Retomada desta tabela. Nada foi enviado ao remoto.

| Fatia | Estado | Commit | Notas |
|---|---|---|---|
| GROK-01 corte do salão 1.1.0 | FEITA | W12-GROK-01 | FC &lt; 50 corta na FN-01. CREAT 150 ativo. PAS &gt; 160 no corte do salão. |
| GROK-02 um corpo de triagem e porta | FEITA | W12-GROK-02 | Barrel reexporta a mesma função. Porta lê `LimiaresBula`. |
| GROK-03 CTCAE v6 no corpus | FEITA | W12-GROK-03 | Termos clínicos literais da v6 em `graus.termosClinicos`. Plaquetas G4 continua &lt; 10.000. |
| GROK-04 texto para grau | FEITA | W12-GROK-04 | Extração pura e sugestão só com frase literal da v6. Plaquetas 20.000 = G3, fila, sem E1. |
| GROK-05 retorno com toxicidade | FEITA | W12-GROK-05 | G3 + plaquetas 20.000 vão à fila. E1 alerta e não altera a fila. |
| GROK-06 tontura | FEITA | W12-GROK-06 | Tontura não corta. Vertigem nova sem histórico alerta SNC e não bloqueia. |
| GROK-07 intervalo de 30 dias | | | |
| GROK-08 red flags do canal | | | |
| GROK-09 valor atual | | | |
| GROK-10 fechamento | | | |

## GROK-01

`salao-triagem` foi de 1.0.0 para 1.1.0. Cada limiar do corte do salão traz fonte `D-W9-37`. Febre continua estritamente acima de 37,8 (`decisoes.temp` = D-W9-38). Igual ao limite passa.

Antes: FN-01 anotava FC 49 em `naoCortes` e o destino ficava SALAO. Depois (D-W9-58): FC 49 gera `corte.fc.baixa` e FILA_MEDICO. FC 50 passa. O campo do contrato continua `fcMinNaoCorta` (pedido de rename em `docs/w12/PEDIDOS-GROK.md`).

`corteSalao` ganhou `pasMax` 160. PAS 160 passa; 161 corta com `corteSalao.pas.alta`. FC &gt; 120 permanece só na FN-01, para não fundir com o teto 110 da triagem do ciclo.

CREAT em `lab-thresholds`: ativo, `limiarSuperior` 150 centésimos de mg/dL, fonte D-W9-37. 150 passa no corte; 151 corta.

Expectativas atualizadas, com a decisão no teste: `tests/rules/triagem.test.ts`, `tests/rules/adv-016-bordas.test.ts`, `tests/rules/peso.test.ts` (a versão do peso segue o header do salão), `tests/w10-grok/grok-01-portoes.test.ts`, `tests/corpus/lab-thresholds.test.ts`. Teste novo: `tests/w12-grok/grok-01-corte.test.ts`.

### Saídas

`npx tsc --noEmit` — exit 0, sem diagnóstico.

`npm run check:boundaries` — `fronteiras ok (280 arquivos)`.

`npm run check:corpus` — `corpus ok (124 arquivos)`. `lab-thresholds.v1.json` header ok, 18 `[VERIFICAR]`, coluna ATIVOS 5.

`npx vitest run tests/w12-grok tests/rules tests/modules --no-file-parallelism` — 52 files, 395 tests, exit 0.

`npx vitest run tests/w3/auditoria-regressao.test.ts` — 9 tests, exit 0.

## GROK-02

O barrel já era fachada (uma implementação em `triagem.ts`). Esta fatia reexporta `portaCiclo`, `grauCtcae`, `lerSalaoCtcae` e `limiaresDaBula` do mesmo módulo. Teste prova identidade de referência (`toBe`).

`portaCiclo` aceita `LimiaresBula` (`neutrofilosMin`, `plaquetasMin`, `clcrMinMlMin`, `fevePctMin`). Null não declara o limiar. Os quatro nulos viram PENDENTE, sem usar grau. O `ProtocoloCiclo` provisório continua no mesmo corpo, para a suíte e o red team que já chamam essa forma. `grauUsadoNaPorta` permanece false. `portaPorGrau` continua ignorado.

Triagem do ciclo e corte do salão seguem portões distintos: FC 49 só corta o salão; PAS 150 só corta o ciclo.

### Saídas

`npx tsc --noEmit` — exit 0, sem diagnóstico.

`npm run check:boundaries` — `fronteiras ok (280 arquivos)`.

`npm run check:corpus` — `corpus ok (124 arquivos)`.

`npx vitest run tests/w12-grok tests/rules tests/modules --no-file-parallelism` — 55 files, 428 tests, exit 0 (a corrida também incluiu `tests/w10-grok/grok-02-bula-ctcae.test.ts` e `tests/redteam/rt07-labs-salao.test.ts`).

`npx vitest run tests/w3/auditoria-regressao.test.ts` — 9 tests, exit 0.

## GROK-03

`salao-ctcae` foi de 1.0.0 para 1.1.0. Os sete termos clínicos ficam em `graus.termosClinicos`, fora de `graus.termos`, porque `lerSalaoCtcae` só aceita faixa numérica. Cada `grau.texto` é a célula EN literal de `docs/referencias/onco-referencia/02-ctcae-v6.md`, e o teste confere que o trecho é substring do arquivo. Grau com traço na tabela oficial não entra. Termo sem trecho ficaria `ativo:false` e `NAO_VERIFICADO`; os sete têm trecho.

Plaquetas numéricas não mudaram: G3 inclui 10.000 e exclui 50.000; G4 é `maxExclusivo` 10.000. 25.000 continua G3. O arquivo não contém 25000.

### Saídas

`npx tsc --noEmit` — exit 0, sem diagnóstico.

`npm run check:boundaries` — `fronteiras ok (280 arquivos)`.

`npm run check:corpus` — `corpus ok (124 arquivos)`. `salao-ctcae.v1.json` header ok, 0 `[VERIFICAR]`, ATIVOS 7.

`npx vitest run tests/w12-grok tests/rules tests/modules --no-file-parallelism` — 54 files, 402 tests, exit 0.

`npx vitest run tests/w3/auditoria-regressao.test.ts` — 9 tests, exit 0.

## GROK-04

`ctcaeTexto.ts` extrai quantidade, período, hidratação EV, hospitalização, AVD, laboratório e temperatura, com o trecho do texto. Negação imediata ("sem vômitos", "não tem febre") não gera critério. `ctcaeClinico.ts` não importa outra regra: o corpus entra por parâmetro. O barrel compõe os dois, porque a fronteira só permite esse reexport.

Grau sugerido só sai de frase literal da v6 ou da faixa numérica injetada. "6 episódios por 3 dias" mostra as duas leituras e não elege grau quando elas divergem. Observação hospitalar de vômito casa "hospitalization indicated" (G3) e as duas leituras da quantidade continuam visíveis, ambas sem grau, porque a v6 de vômito não tem corte por episódio. Diarreia 4–6 por dia acima do basal é G2; 7 ou mais é G3; hidratação EV na diarreia é G3. Febre lê os números do próprio texto do corpus: 38,0–39,0 inclusive é G1, acima de 39,0 até 40,0 é G2, acima de 40,0 sem duração fica PENDENTE, 24 h é G3 e 25 h é G4.

Plaquetas 20.000 e 10.000 são G3, destino FILA_MEDICO, E1 falso. 9.999 é G4 com E1, sem bloquear. Dois valores no mesmo texto não elegem nenhum. O resultado é sugestão: `confirmadoPeloMedico` falso e `bloqueiaSalvar` falso. Tipo local marcado PROVISORIO-W12 em `docs/w12/PEDIDOS-GROK.md`.

### Saídas

`npx tsc --noEmit` — exit 0, sem diagnóstico.

`npm run check:boundaries` — `fronteiras ok (284 arquivos)`.

`npm run check:corpus` — `corpus ok (124 arquivos)`.

`npx vitest run tests/w12-grok tests/rules tests/modules --no-file-parallelism` — 55 files, 416 tests, exit 0.

`npx vitest run tests/w3/auditoria-regressao.test.ts` — 9 tests, exit 0.

## GROK-05

A cadeia ficou em `retornoToxicidade.ts`, ao lado do agendador de `retorno.ts`, que não mudou. O módulo não importa outras regras. O barrel lê o corte do salão, o alerta de plaquetas e o suporte e entrega os três já calculados.

Paciente Teste 91 com grau 3 e plaquetas 20.000 vai a FILA_MEDICO com `corte.grau` e `corte.plq.baixa`. O alerta abaixo de 50.000 sai do `alertaClinico` do PLQ e não depende do CTCAE. 60.000 e 50.000 exato cortam o salão (abaixo de 100.000) e não disparam esse alerta. 100.000 passa os dois. 9.999 acrescenta `alerta.e1` pela faixa G4 e não cria motivo. G4 com as mesmas 20.000 mantém destino e motivos; o E1 tem `alteraFila` falso.

Diarreia acima de 24 h com HAS na lista não oncológica alerta "suspender anti-hipertensivo". 24 h exato não alerta. Vômito com diarreia alerta "PS para hidratação venosa". O sinônimo `has` entrou na classe anti-hipertensivo do suporte. Nenhum alerta bloqueia, altera a fila, define dose ou causalidade. Grau ou plaquetas ausentes ficam PENDENTE e vão à fila, sem virar corte. Sem motivo e sem pendência o destino é SEM_FILA. Tipos locais em `docs/w12/PEDIDOS-GROK.md`.

### Saídas

`npx tsc --noEmit` — exit 0, sem diagnóstico.

`npm run check:boundaries` — `fronteiras ok (285 arquivos)`.

`npm run check:corpus` — `corpus ok (124 arquivos)`.

`npx vitest run tests/w12-grok tests/rules tests/modules --no-file-parallelism` — 56 files, 425 tests, exit 0.

`npx vitest run tests/w3/auditoria-regressao.test.ts` — 9 tests, exit 0.

## GROK-06

D-W9-76 tirou o ramo "ECOG 2 + tontura" de `avaliarTriagem`. ECOG 2 com tontura fica no salão, sem corte e sem `naoCorte.ecog.tontura`. A chave `ecog2ComTonturaCorta` continua no JSON porque o schema a exige; o código não lê mais o booleano. O teste antigo da anotação foi atualizado com a decisão no comentário.

`tontura: null` gera `pendente.tontura` e FILA_MEDICO. Não vira ausência. Cada campo opcional da triagem, quando ausente, fica PENDENTE e o destino não traz VERDE. A saída não contém "liberado", "aprovado" ou "apto".

A exceção mora em `tontura.ts`. O texto "investigar SNC (metástase cerebral/cerebelar)" sai do bloco `vertigem` do ruleset. Só dispara com tontura registrada, início novo e histórico anterior falso. Histórico ou início ausente fica PENDENTE e a classificação não vira NOVO. O alerta não bloqueia. Tipos locais em `docs/w12/PEDIDOS-GROK.md`.

### Saídas

`npx tsc --noEmit` — exit 0, sem diagnóstico.

`npm run check:boundaries` — `fronteiras ok (286 arquivos)`.

`npm run check:corpus` — `corpus ok (124 arquivos)`.

`npx vitest run tests/w12-grok tests/rules tests/modules --no-file-parallelism` — 57 files, 442 tests, exit 0.

`npx vitest run tests/w3/auditoria-regressao.test.ts` — 9 tests, exit 0.
