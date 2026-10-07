# W9 · CABEÇALHO COMUM (Codex-gates, Grok, Cursor)

> Leia antes: `docs/ondas/W8-COMUM.md` (vale integralmente; onde diz W8, leia W9; regras de máquina, invariantes e commits idem), `docs/DECISOES.md`, `docs/w8/ACHADOS-KIMI.md`, `docs/PLANO-FINAL-ONCOGLOBAL-v1.1.md` (Parte 0).
> **Base:** `f0/w1-integrado` @ 658bc0a (W5, GLM, Antigravity e Kimi integrados). Cada executor: worktree e branch próprios, em `C:\Users\silas\Projects\OncoGlobal-wt\w9-<nome>`, branch `f0/w9-<nome>`.
> **Retomada:** `docs/progresso/W9-<EXECUTOR>.md`. Se cair, continue da primeira fatia não FEITA.

## Origem do trabalho
Os 10 testes que falham de propósito em `tests/adv-w8/*.adv.ts` (rodar: `npx vitest run --config tests/adv-w8/vitest.config.ts --no-file-parallelism`). **Meta da onda: eles ficam verdes sem mudar nenhuma expectativa.** Cada `.adv.ts` já traz a especificação executável: o 1º teste afirma que a função existe; os demais ficam guardados por `if (!fn) return`.
- Importe os nomes/caminhos que o teste espera. Se o teste espera um caminho fora da sua faixa: `BLOQUEADO_ESCOPO` + patch em `docs/w9/PEDIDOS-<EXECUTOR>.md`.
- **Proibido** editar expectativa de teste para casar com o código. Mover `.adv.ts` para a suíte regular só por `git mv` + ajuste de import, na fatia de fechamento, e só quando verde.

## Faixas exclusivas
| Executor | Faixa |
|---|---|
| CODEX (gates) | `src/kernel/harness/gates.ts`, `src/kernel/llm/sanitizador*.ts`, `src/app/**` (só ligação dos gates), `tests/kernel/gates-w9/**`, `tests/w9-codex/**`, `docs/progresso/W9-CODEX.md`, `docs/w9/PEDIDOS-CODEX.md` |
| GROK | `src/rules/**` (exceto `src/rules/w8/*` existentes: só adicionar arquivos novos), `src/orchestration/**`, `src/modules/**`, `src/kernel/harness/ownership.ts` (novo), `scripts/verificar-manifesto.mjs` (novo), `tests/{rules,rules-w8,modules,orchestration}/**`, `tests/w9-grok/**`, `docs/progresso/W9-GROK.md`, `docs/w9/PEDIDOS-GROK.md` |
| CURSOR | `src/ui/api/**`, `src/ui/telas/**`, `tests/ui-telas/**`, `docs/progresso/W9-CURSOR.md`, `docs/w9/PEDIDOS-CURSOR.md` |
Ninguém edita `src/contracts/**` (congelados), `package.json`, `check-boundaries.mjs`, `docs/DECISOES.md`, `docs/PLANO-*`, `docs/w5/MATRIZ.md`, CANONICA, `src/rules/w8/*` existentes (pedido de import entre arquivos continua não liberado). Contrato faltando = `BLOQUEADO_ESCOPO`.

## Curadoria clínica (não invente)
Tabelas de lateralidade por órgão, anatomia×sexo, regra do pTNM, interações e fichas **dependem do Dr. Silas**. Implemente o **mecanismo** com a tabela lida de arquivo/constante marcada `[VERIFICAR]` (estrutura mínima só para o teste, sem conteúdo clínico inventado além do que o teste exige) e liste cada tabela em `docs/w9/PEDIDOS-<EXECUTOR>.md` para curadoria.

## Verificação por fatia (em série, nunca a suíte inteira)
`npx tsc --noEmit` · `npm run check:boundaries` · `npm run check:corpus` · testes das suas pastas · `tests/w3/auditoria-regressao.test.ts` · o `.adv.ts` da fatia.

## Atualização 2026-10-06 (tech lead) · tabelas clínicas já decididas
Antes de criar qualquer `[VERIFICAR]`, leia `docs/DECISOES.md` (D-W9-01…D-W9-49). Já decididas pelo Dr. Silas e devem ser usadas como estão:
- G-07 lateralidade = D-W9-05 · G-08 anatomia×sexo = D-W9-06 · G-09 pTNM = D-W9-07 · grau do caso = D-W9-08 · foto ilegível = D-W9-09.
- Finalidades APAC = D-W9-12 · CNS = D-W9-13 · nódulo < 1 cm = D-W9-31.
- Corte do salão = D-W9-37 (SpO₂ < 88, PAS < 90, FC < 50, Hb < 8, Cr > 1,5) · febre estritamente > 37,8 = D-W9-38 · agenda = D-W9-39.
- Interações (FN-16): base em `docs/referencias/onco-referencia/03-interacoes-qt.*` — continua **inativo** até aprovação item a item.
- Fichas (K-26): base em `docs/referencias/protocolos/` + D-W9-23/34 (5-FU 46 h, Mayo, pré-medicação ondansetrona + dexametasona + prometazina, cimetidina em taxano, hidratação de cisplatina D1 e D8) + Modelo 05.
- Junção de paciente nunca automática = D-W9-34a. Ajuste de dose só −20/−30/−40 = D-W9-26.
