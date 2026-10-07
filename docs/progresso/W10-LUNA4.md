# W10 — Luna 4 (RECIST e estatística)

Base inicial: `04b53db31598fb80ff78192d4cd3eafde36428fd` (`f0/w10-luna4`). Worktree exclusivo da Luna 4.

| Fatia | Estado | Entrega |
|---|---|---|
| F07 · `W10-LUNA4-01` | Código e testes escritos; execução aguardando wrapper/slot serial da raiz | Cálculo longitudinal puro de alvos, baseline/nadir somente até cada data, proveniência, eixo explícito, deltas e categorias RECIST candidatas sob entradas completas. Categorias nascem `PROPOSTO`; incompletude e denominadores zero preservam pendência. |
| F08 · `W10-LUNA4-02` | Código e testes escritos; execução aguardando wrapper/slot serial da raiz | Projeção regenerável pelo ledger real; dedupe por paciente/evento, supersessão, `TreatmentAdministration` e `SignatureReference`; saída de categorias fixas sem identificadores ou payloads. Categorias clínicas gerais seguem pendentes por falta de esquema tipado e produtor seguro. |

## APIs de integração

- `avaliarSerieRecist(input: RecistSerieInput): RecistSerieResultado` em `src/rules/recist/index.ts`.
- `projetarEstatisticaLedger(db)` e `projetarEstatistica(eventos)` em `src/estatistica/index.ts`.

## Validação

- Testes novos: `tests/w10-luna4/recist-estatistica.test.ts`.
- Ainda não executados: `tsc`, boundaries, corpus, Vitest W10-Luna4 e regressão W3. A raiz pediu aguardar seu wrapper e janela serializada.
- Sem commits até autorização da raiz após validação. Revisão clínica permanece humana; testes não equivalem a validação clínica.

Ver pedidos de contrato e limites em `docs/w10/PEDIDOS-LUNA4.md`.

## Evidencia da raiz — 2026-10-07

Primeiro typecheck falhou por alargamento de RecistPendencia para string; helper passou a preservar o tipo generico. Primeiro Vitest: 3 falhas detectaram perda do motivo especifico de baseline invalido no seguimento; correcao preserva motivos junto com BASELINE_INVALIDO, sem alterar expectativas.

Reexecucao `LUNA4-F07-F08-R3`: typecheck exit 0; fronteiras ok (176 arquivos); corpus ok (91 arquivos); **3 arquivos / 35 testes PASS**, exit 0, incluindo regressao W3. Testes separados por fatia em `tests/w10-luna4/recist.test.ts` (21) e `estatistica.test.ts` (5); W3 (9). Nenhum teste preexistente alterado. Pool forks, um worker, sem paralelismo de arquivos, timeout 30 s.

Log real: `C:\Users\silas\Projects\OncoGlobal-wt\_w10-astra\logs\20261007-031018-856-LUNA4-F07-F08-R3.log` e arquivos de saida associados. Consumidor L1 e revisao adversarial Astra ainda pendentes nesta evidencia.
