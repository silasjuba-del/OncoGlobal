# W10 — Luna 4 (RECIST e estatística)

**Estado atual (raiz, 2026-10-07): correcoes ASTRA-01/02/03/08 integradas, reataque 42 testes PASS e consumidor HTTP RECIST/estatistica 2 testes PASS. F08 clinica ampliada permanece PARCIAL. Notas NOT_RUN abaixo sao historicas.**

Base inicial: `04b53db31598fb80ff78192d4cd3eafde36428fd` (`f0/w10-luna4`). Worktree exclusivo da Luna 4.

| Fatia | Estado | Entrega |
|---|---|---|
| F07 · `W10-LUNA4-01` | Correções ASTRA-01/02/03 escritas; reataque aguardando execução serial da raiz | RECIST longitudinal exige elegibilidade basal explícita, método/corte/qualidade e seleção de até 5 alvos / 2 por órgão. Soma transbordada e baseline inválido propagam pendência. Categoria global proposta pode existir sem percentagem de nadir quando o critério é independente dela; o contrato numérico permanece `null` quando não representável. |
| F08 · `W10-LUNA4-02` | Correção ASTRA-08 escrita; reataque aguardando execução serial da raiz | Projeção regenerável do ledger detecta administrações ativas conflitantes pelo mesmo `adminId`; exclui os status conflitantes de contagens/denominadores e expõe pendência e contador de conflitos. |

## APIs de integração

- `avaliarSerieRecist(input: RecistSerieInput): RecistSerieResultado` em `src/rules/recist/index.ts`.
- `projetarEstatisticaLedger(db)` e `projetarEstatistica(eventos)` em `src/estatistica/index.ts`.

## Validação

- Testes de regressão: `tests/w10-luna4/recist.test.ts` e `tests/w10-luna4/estatistica.test.ts`.
- Evidência anterior da raiz: `LUNA4-F07-F08-R3` passou typecheck/boundaries/corpus e 3 arquivos / 35 testes em 2026-10-07, antes dos achados ASTRA.
- Reataque das correções ASTRA-01/02/03/08 ainda NÃO_EXECUTADO. A raiz liberou a faixa para coleta dos arquivos; não rodei testes, typecheck, boundaries ou corpus nesta correção.
- Os commits originais F07/F08 existem; correções adversariais seguem WIP não commitado até validação serial da raiz. Revisão clínica permanece humana.

Referência primária consultada: [RECIST 1.1, diretriz EORTC](https://project.eortc.org/recist/wp-content/uploads/sites/4/2015/03/RECISTGuidelines.pdf), §§3.1–3.2, 4.3. A consulta da fonte não equivale a revisão clínica desta implementação.

Ver pedidos de contrato e limites em `docs/w10/PEDIDOS-LUNA4.md`.

## Evidencia da raiz — 2026-10-07

Primeiro typecheck falhou por alargamento de RecistPendencia para string; helper passou a preservar o tipo generico. Primeiro Vitest: 3 falhas detectaram perda do motivo especifico de baseline invalido no seguimento; correcao preserva motivos junto com BASELINE_INVALIDO, sem alterar expectativas.

Reexecucao `LUNA4-F07-F08-R3`: typecheck exit 0; fronteiras ok (176 arquivos); corpus ok (91 arquivos); **3 arquivos / 35 testes PASS**, exit 0, incluindo regressao W3. Testes separados por fatia em `tests/w10-luna4/recist.test.ts` (21) e `estatistica.test.ts` (5); W3 (9). Nenhum teste preexistente alterado. Pool forks, um worker, sem paralelismo de arquivos, timeout 30 s.

Log real: `C:\Users\silas\Projects\OncoGlobal-wt\_w10-astra\logs\20261007-031018-856-LUNA4-F07-F08-R3.log` e arquivos de saida associados. Consumidor L1 e revisao adversarial Astra ainda pendentes nesta evidencia.

## Reataque final ASTRA-01/02/03/08 - executado pela raiz

`LUNA4-ASTRA-REATAQUE`: typecheck exit 0; fronteiras ok (176 arquivos); corpus ok (91 arquivos); **3 arquivos / 42 testes PASS**, exit 0, incluindo W3. Novos casos exercitam selecao/mensurabilidade, fonte/qualidade/metodo, limites de alvos, RC mantida/nova lesao apos nadir zero sem fabricar percentuais, overflow basal, independencia de exame futuro e ramificacao de administracao pelo writer real.

Log: `C:\Users\silas\Projects\OncoGlobal-wt\_w10-astra\logs\20261007-032751-839-LUNA4-ASTRA-REATAQUE.log` e saidas associadas. Métodos sem criterio implementado permanecem PENDENTE; categorias clinicas amplas da estatistica continuam explicitamente parciais em PEDIDOS. Revisao medica permanece PROPOSTO, nenhum teste promove autoridade.
