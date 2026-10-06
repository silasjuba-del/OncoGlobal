# W8 · ANTIGRAVITY — Regras Puras do Caso Real

Worktree: `C:\Users\silas\Projects\OncoGlobal-wt\w8-antigravity` · Branch: `f0/w8-antigravity` · Base: `f0/w1-integrado` @ `243dcae`

## Fatias

| Fatia | Estado | Commit | Testes | Pendências / [VERIFICAR] |
|---|---|---|---|---|
| AG-01 · Identificador por valor (I1–I2) | FEITA | `6a81804` | 7 ok | Regra de validação pública do CNS [VERIFICAR fonte] |
| AG-02 · Vínculo de documento ao paciente (I3–I5) | FEITA | `68d6853` | 6 ok | — |
| AG-03 · Data clínica (T1–T2) | FEITA | `3280372` | 6 ok | — |
| AG-04 · Deduplicação de exame (D1–D3) | FEITA | `d440121` | 5 ok | — |
| AG-05 · Hierarquia de fonte (E1–E3) | FEITA | `5739a85` | 5 ok | — |
| AG-06 · Trecho riscado e baixa confiança (R1, C1) | FEITA | `660f784` | 4 ok | Limiar injetado de ruleset [VERIFICAR] |
| AG-07 · Patologia por sítio (P1–P3) | FEITA | `acf200e` | 6 ok | Tabela ISUP 2014/OMS [VERIFICAR edição], ruleset patologia-agregacao inativo [VERIFICAR] |
| AG-08 · Resumo de imagem em 2 níveis | FEITA | `b19aa30` | 4 ok | — |
| AG-09 · Interações sem fonte = PENDENTE (G-09) | FEITA | `c8b6afd` | 3 ok | interacoes.v1.json inativo aguarda literatura e Dr. Silas [VERIFICAR] |
| AG-10 · Índice e fechamento (Caso 07) | FEITA | `c2aba7f` | 9 ok | Caso 07 sintético ponta a ponta |

## Arquivos Criados / Modificados

- `src/rules/w8/tipos.ts`
- `src/rules/w8/identificadores.ts`
- `src/rules/w8/vinculoDocumento.ts`
- `src/rules/w8/dataClinica.ts`
- `src/rules/w8/dedupeExame.ts`
- `src/rules/w8/hierarquiaFonte.ts`
- `src/rules/w8/rasura.ts`
- `src/rules/w8/patologiaSitio.ts`
- `src/rules/w8/resumoImagem.ts`
- `src/rules/w8/interacoes.ts`
- `src/rules/w8/index.ts`
- `tests/rules-w8/identificadores.test.ts`
- `tests/rules-w8/vinculoDocumento.test.ts`
- `tests/rules-w8/dataClinica.test.ts`
- `tests/rules-w8/dedupeExame.test.ts`
- `tests/rules-w8/hierarquiaFonte.test.ts`
- `tests/rules-w8/rasura.test.ts`
- `tests/rules-w8/patologiaSitio.test.ts`
- `tests/rules-w8/resumoImagem.test.ts`
- `tests/rules-w8/interacoes.test.ts`
- `tests/rules-w8/caso07.test.ts`
- `docs/w8/PEDIDOS-ANTIGRAVITY.md`
- `docs/progresso/W8-ANTIGRAVITY.md`

## Saída real das verificações

- `npm run typecheck` (`tsc --noEmit`): 0 erros.
- `npm run check:boundaries`: `fronteiras ok (92 arquivos)`.
- `npm run check:corpus`: `corpus ok (20 arquivos)`.
- Suíte `tests/rules-w8/` + `tests/w3/auditoria-regressao.test.ts`:
  11 arquivos de teste, 64 testes aprovados (100% verde).

## Resumo das saídas reais e itens [VERIFICAR]

1. **CNS (AG-01)**: `[VERIFICAR fonte]` — algoritmo de soma ponderada 15..1 com resto módulo 11 implementado conforme documentação pública de validação do Cartão Nacional de Saúde (Portaria SAS/MS nº 711/2004).
2. **Confiança e Rasura (AG-06)**: `[VERIFICAR ruleset]` — limiar mínimo de confiança é parâmetro injetado via ruleset, nunca fixado no código.
3. **Correspondência Gleason / ISUP (AG-07)**: `[VERIFICAR edição]` — tabela canônica ISUP 2014 / OMS 2016 / OMS 2022.
4. **Agregação de Patologia (AG-07)**: `[VERIFICAR]` — `agregarCaso` permanece retornando `PENDENTE` enquanto o ruleset `patologia-agregacao` estiver inativo no corpus.
5. **Interações Medicamentosas (AG-09)**: `[VERIFICAR]` — todas as 4 regras semeadas em `corpus/rulesets/interacoes.v1.json` estão com `ativo: false` e aguardam literatura e curadoria do Dr. Silas. Conforme norma G-09, qualquer par avaliado sai estritamente como `PENDENTE` ("não verificado"), nunca como "sem interação".
6. **Caso 07 Sintético (AG-10)**: Provado ponta a ponta: 8 páginas de exame deduplicadas em 6 exames únicos; identificadores com conflito VERMELHO ou DV sintético inválido; trechos riscados PENDENTES com referência visual; PSA mencionado em receituário secundário mantido como PENDENTE ("mencionado sem laudo"); PIRADS sem número mantido como PENDENTE; metástase óssea não inferida a partir de captação articular degenerativa.

