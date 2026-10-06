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
| AG-09 · Interações sem fonte = PENDENTE (G-09) | FEITA | pendente commit | 3 ok | interacoes.v1.json inativo aguarda literatura e Dr. Silas [VERIFICAR] |
| AG-10 · Índice e fechamento (Caso 07) | PENDENTE | — | — | Caso 07 sintético ponta a ponta |

## Arquivos Criados / Modificados

- `docs/progresso/W8-ANTIGRAVITY.md`
