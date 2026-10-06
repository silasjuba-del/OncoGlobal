# W5 · Matriz de rastreabilidade — linha de base P1

**Escopo:** todos os IDs G, INV, K, FN, N e T do plano v1.1. Colunas de referências são apenas busca textual nos arquivos atuais; referência por ID não prova comportamento, positivo/negativo, borda nem integração. Classificação conservadora até leitura e teste: PARCIAL se existe ao menos uma referência em teste; A_AUDITAR se não há referência em teste. A_AUDITAR é estado transitório de P1, não equivale a SEM_TESTE e não pode constar da matriz final. Nenhum COBERTO é reivindicado por varredura textual. FORA_DO_F0 não é inferido: o plano em §F0 declara G-01…G-22 e T-01…T-61 no aceite; cada exceção exige citação individual.

| ID | Implementação / referência | Teste / referência | Estado inicial | Evidência necessária para promover |
|---|---|---|---|---|
| G-01 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| G-02 | src/kernel/harness/gates.ts, src/kernel/llm/desidentificar.ts | tests/kernel/kernel.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| G-03 | src/contracts/operacao.ts, src/kernel/harness/gates.ts | tests/kernel/kernel.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| G-04 | — | tests/prompts/prompts.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| G-05 | src/kernel/harness/gates.ts | tests/kernel/kernel.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| G-06 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| G-07 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| G-08 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| G-09 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| G-10 | src/kernel/harness/gates.ts | tests/kernel/kernel.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| G-11 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| G-12 | — | tests/apac/apac.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| G-13 | src/contracts/clinico.ts, src/kernel/harness/gates.ts | tests/kernel/kernel.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| G-14 | src/kernel/harness/gates.ts | tests/kernel/kernel.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| G-15 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| G-16 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| G-17 | src/contracts/agentes.ts, src/kernel/corpus/loader.ts, scripts/validate-corpus.mjs | tests/contracts/contratos.test.ts, tests/corpus/canal-redflags.test.ts, tests/corpus/capabilities.test.ts, tests/corpus/interacoes.test.ts, tests/corpus/lab-thresholds.test.ts, tests/corpus/loader.test.ts, tests/corpus/packs.test.ts, tests/corpus/rad-emergencia.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| G-18 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| G-19 | src/kernel/gateway/gateway.ts | tests/kernel/kernel.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| G-20 | src/kernel/gateway/gateway.ts | tests/kernel/kernel.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| G-21 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| G-22 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| G-23 | src/contracts/agentes.ts, src/kernel/harness/gates.ts | tests/kernel/kernel.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| G-24 | src/kernel/llm/desidentificar.ts | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| G-25 | src/contracts/operacao.ts, src/kernel/harness/gates.ts, src/modules/consulta/fechamento.ts | tests/kernel/kernel.test.ts, tests/server/server.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| G-26 | src/contracts/agentes.ts, src/kernel/harness/gates.ts | tests/kernel/kernel.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| G-27 | src/contracts/agentes.ts | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| G-28 | — | tests/ui/tema.test.tsx | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| INV-01 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| INV-02 | src/contracts/base.ts | tests/contracts/contratos.test.ts, tests/fixtures/triagem.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| INV-03 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| INV-04 | src/contracts/base.ts, src/contracts/operacao.ts | tests/contracts/contratos.test.ts, tests/server/server.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| INV-05 | src/kernel/gateway/gateway.ts, scripts/check-boundaries.mjs | tests/kernel/kernel.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| INV-06 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| INV-07 | src/kernel/projections/cumulativos.ts, src/rules/reconciliar.ts | tests/kernel/kernel.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| INV-08 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| INV-09 | src/contracts/operacao.ts, src/modules/documentos/render.ts, corpus/templates/folha-operacional-salao.v1.json | tests/contracts/contratos.test.ts, tests/corpus/templates.test.ts, tests/modules/render.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| INV-10 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| INV-11 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| INV-12 | src/contracts/agentes.ts, src/kernel/llm/desidentificar.ts, corpus/capabilities.v1.json | tests/corpus/capabilities.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| INV-13 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| INV-14 | src/rules/tipos-w3.ts | tests/w3/integracao.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| INV-15 | src/contracts/agentes.ts | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| INV-16 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| INV-17 | — | tests/contracts/contratos.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| INV-18 | src/contracts/estados.ts | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| INV-19 | — | tests/contracts/contratos.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| INV-20 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| INV-21 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| INV-22 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| INV-23 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| INV-24 | src/contracts/estados.ts | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| K-01 | src/contracts/base.ts | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| K-02 | src/contracts/base.ts, src/contracts/estados.ts | tests/contracts/contratos.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| K-03 | src/contracts/operacao.ts, corpus/rulesets/apac.v1.json | tests/contracts/contratos.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| K-04 | src/contracts/operacao.ts | tests/contracts/contratos.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| K-05 | src/contracts/operacao.ts | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| K-06 | src/contracts/clinico.ts, src/contracts/regras.ts, src/rules/dose.ts, corpus/rulesets/dose.v1.json | tests/contracts/contratos.test.ts, tests/rules/dose.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| K-07 | src/contracts/clinico.ts | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| K-08 | src/contracts/clinico.ts, src/contracts/operacao.ts | tests/contracts/contratos.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| K-09 | src/contracts/agentes.ts | tests/prompts/prompts.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| K-10 | src/contracts/clinico.ts, src/contracts/regras.ts, src/rules/datas.ts, corpus/rulesets/lab-thresholds.v1.json, corpus/rulesets/salao-triagem.v1.json | tests/rules/triagem.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| K-11 | src/rules/destino.ts, corpus/rulesets/salao-triagem.v1.json | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| K-12 | src/contracts/operacao.ts, corpus/templates/folha-operacional-salao.v1.json | tests/corpus/templates.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| K-13 | src/kernel/harness/gates.ts | tests/kernel/kernel.test.ts, tests/prompts/prompts.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| K-14 | src/contracts/operacao.ts, src/modules/consulta/fechamento.ts | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| K-15 | src/modules/consulta/fechamento.ts | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| K-16 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| K-17 | src/contracts/estados.ts, src/modules/consulta/preConsulta.ts, src/ui/consulta/PainelDelta.tsx | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| K-18 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| K-19 | src/contracts/estados.ts | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| K-20 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| K-21 | src/contracts/agentes.ts, corpus/capabilities.v1.json | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| K-22 | src/contracts/base.ts, src/contracts/operacao.ts, src/kernel/llm/desidentificar.ts | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| K-23 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| K-24 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| K-25 | src/contracts/index.ts | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| K-26 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| K-27 | src/contracts/agentes.ts, src/kernel/corpus/loader.ts, scripts/validate-corpus.mjs, corpus/rulesets/interacoes.v1.json | tests/contracts/contratos.test.ts, tests/corpus/interacoes.test.ts, tests/corpus/loader.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| K-28 | src/rules/triagem.ts | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| K-29 | src/contracts/agentes.ts | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| K-30 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| FN-01 | src/contracts/regras.ts, src/rules/index.ts, src/rules/triagem.ts | tests/corpus/capabilities.test.ts, tests/rules/ciclo.test.ts, tests/rules/triagem.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| FN-02 | src/contracts/regras.ts, src/rules/destino.ts | tests/rules/triagem.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| FN-03 | src/contracts/regras.ts, src/rules/fila.ts | tests/rules/fila.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| FN-04 | src/contracts/regras.ts, src/kernel/harness/gates.ts, src/rules/dose.ts | tests/corpus/packs.test.ts, tests/rules/dose.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| FN-05 | src/contracts/regras.ts, src/rules/validade.ts | tests/rules/validade.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| FN-06 | src/contracts/regras.ts, src/rules/peso.ts | tests/rules/peso.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| FN-07 | src/contracts/regras.ts, src/rules/prazos.ts | tests/rules/prazos.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| FN-08 | src/contracts/regras.ts, src/rules/concomitancia.ts | tests/rules/prazos.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| FN-09 | src/contracts/regras.ts, src/rules/cicloComMedico.ts | tests/rules/ciclo.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| FN-10 | src/rules/apac.ts | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| FN-11 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| FN-12 | src/rules/apac.ts | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| FN-13 | src/rules/apac.ts | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| FN-14 | src/rules/delta.ts | tests/projections/delta.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| FN-15 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| FN-16 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| FN-17 | src/rules/ctcaeGrau.ts | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| FN-18 | src/rules/recist.ts | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| FN-19 | src/rules/labAlerts.ts | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| FN-20 | src/rules/radAlerts.ts, corpus/rulesets/rad-emergencia.v1.json | tests/corpus/rad-emergencia.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| FN-21 | src/rules/redFlagsCanal.ts, corpus/rulesets/canal-redflags.v1.json | tests/corpus/canal-redflags.test.ts, tests/ui/banner-e1.test.tsx, tests/ui/fechamento.test.tsx | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| FN-22 | src/rules/reconciliar.ts | tests/kernel/kernel.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| FN-23 | src/rules/identidade.ts | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| FN-24 | src/kernel/llm/desidentificar.ts | tests/kernel/kernel.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| FN-25 | src/rules/caixa.ts | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| FN-26 | src/rules/cumulativoAlerta.ts | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| N01 | — | tests/contracts/contratos.test.ts, tests/kernel/kernel.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| N02 | — | tests/contracts/contratos.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| N03 | — | tests/apac/apac.test.ts, tests/contracts/contratos.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| N04 | — | tests/contracts/contratos.test.ts, tests/ledger/ledger.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| N05 | — | tests/ledger/ledger.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| N06 | src/kernel/gateway/gateway.ts | tests/kernel/kernel.test.ts, tests/ledger/ledger.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| N07 | — | tests/ledger/ledger.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| N08 | — | tests/rules/triagem.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| N09 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| N10 | — | tests/projections/projections.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| N11 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| N12 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| N13 | — | tests/apac/apac.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| N14 | — | tests/contracts/contratos.test.ts, tests/projections/projections.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| N15 | — | tests/projections/projections.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| N16 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| N17 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| N18 | — | tests/kernel/kernel.test.ts, tests/server/server.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| N19 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| N20 | — | tests/backup/backup.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| N21 | — | tests/kernel/kernel.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| N22 | — | tests/kernel/kernel.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| N23 | — | tests/kernel/kernel.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| N24 | — | tests/kernel/kernel.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| N25 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| N26 | — | tests/ui/tema.test.tsx | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| T-01 | — | tests/rules/triagem.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| T-02 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-03 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-04 | corpus/rulesets/lab-thresholds.v1.json | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-05 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-06 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-07 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-08 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-09 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-10 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-11 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-12 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-13 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-14 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-15 | — | tests/rules/triagem.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| T-16 | — | tests/rules/fila.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| T-17 | — | tests/rules/fila.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| T-18 | — | tests/rules/dose.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| T-19 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-20 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-21 | — | tests/rules/dose.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| T-22 | — | tests/rules/validade.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| T-23 | — | tests/rules/peso.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| T-24 | — | tests/rules/prazos.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| T-25 | — | tests/rules/prazos.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| T-26 | — | tests/rules/ciclo.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| T-27 | — | tests/apac/apac.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| T-28 | — | tests/apac/apac.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| T-29 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-30 | — | tests/apac/apac.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| T-31 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-32 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-33 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-34 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-35 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-36 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-37 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-38 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-39 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-40 | — | tests/kernel/kernel.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| T-41 | — | tests/identity/identidade.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| T-42 | — | tests/kernel/kernel.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| T-43 | — | tests/identity/caixa.test.ts | PARCIAL | leitura semântica + teste positivo/negativo/borda |
| T-44 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-45 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-46 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-47 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-48 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-49 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-50 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-51 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-52 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-53 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-54 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-55 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-56 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-57 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-58 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-59 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-60 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |
| T-61 | — | — | A_AUDITAR | leitura semântica + teste positivo/negativo/borda |

**Resumo inicial provisório:** 195 IDs; PARCIAL 85; A_AUDITAR 110; SEM_TESTE 0 confirmados; COBERTO 0 comprovado por esta varredura; FORA_DO_F0 0 comprovado. Todos os A_AUDITAR requerem inspeção manual antes de afirmar lacuna real.

## Leitura manual focal (P1)

- `src/kernel/harness/gates.ts` implementa funções nomeadas G-02, G-03, G-05, G-10, G-13, G-14, G-23, G-25 e G-26. `tests/kernel/kernel.test.ts` tem caso positivo e negativo direto para as nove funções; isso **não** prova a aplicação do gate em um fluxo real.
- Uma busca de referências em `src/**` fora de `gates.ts` encontrou consumidor apenas de `g25EscopoAssinatura`, em `src/server/rotas.ts` (importação e checagem durante `/consulta/confirmar`). As outras oito exigem rastreio de fluxo/prova adversarial antes de `COBERTO`.
- `docs/PLANO-FINAL-ONCOGLOBAL-v1.1.md`, §F0, exige G-01…G-22 no harness e T-01…T-61 verdes. A coluna `FORA_DO_F0` não é atalho para os IDs desse aceite. Ausência do literal do ID, por si, tampouco é prova de ausência de comportamento.
- `src/server/rotas.ts` na base só roteia `/login`, `/consulta/confirmar` e `/acao`; a rota `/consulta/bundle` da W4-03 requer teste HTTP adversarial e correção por KERNEL. A confirmação consulta `bundleExibido` e não deve ser enfraquecida para contornar essa lacuna.

## F5 · Mutações dos gates
PENDENTE: mutação controlada dos gates implementados pelo RED; não inferir prova de uma suíte verde.
