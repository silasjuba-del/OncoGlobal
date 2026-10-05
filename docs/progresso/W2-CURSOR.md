# W2 · CURSOR · progresso

Executor: CURSOR. Branch: `f0/w2-cursor`. Papel: UI mostra e coleta; regra em `src/rules`; contrato em `src/contracts`.

## Fatias

| Fatia | Estado | Commit | Verify | Pendências |
|---|---|---|---|---|
| CUR-01 Scaffold Vite + React | FEITA | (este commit) | typecheck ok; fronteiras ok (9 arquivos); vitest 2 files, 25 tests; `ui:build` ok (vite 8.3.2) | `[VERIFICAR]` `tsconfig.json` ganhou `"jsx": "react-jsx"` — fora da lista, senão o typecheck dos `.tsx` não existe. Tech lead confirma. |
| CUR-02 Tema | pendente | | | |
| CUR-03 Cabeçalho | pendente | | | |
| CUR-04 Banner E1 | pendente | | | |
| CUR-05 Delta | pendente | | | |
| CUR-06 Evidência | pendente | | | |
| CUR-07 Triagem | pendente | | | `src/rules/index.ts` ausente neste branch |
| CUR-08 Quadro | pendente | | | `ordenarFila` ausente neste branch |
| CUR-09 Fechamento | pendente | | | |
| CUR-10 Dose | pendente | | | `calcularDose` ausente neste branch |

## CUR-01 · saída real

`npm run ui:build`:

```
vite v8.3.2 building client environment for production...
✓ 16 modules transformed.
dist/index.html                  0.64 kB │ gzip:  0.43 kB
dist/assets/index-B1fnieAI.js  219.69 kB │ gzip: 68.65 kB
✓ built in 1.69s
```

`npm run verify`:

```
fronteiras ok (9 arquivos)
Test Files  2 passed (2)
     Tests  25 passed (25)
```

## Arquivos criados

- `package.json` (deps React; scripts `ui:dev`, `ui:build`)
- `package-lock.json`
- `vite.config.ts`
- `index.html`
- `src/ui/main.tsx`
- `src/ui/App.tsx`
- `tests/ui/app.test.tsx`
- `tsconfig.json` (só `"jsx": "react-jsx"`)
- `docs/progresso/W2-CURSOR.md`

## Perguntas ao tech lead

- Confirmar `"jsx": "react-jsx"` no `tsconfig.json`.
