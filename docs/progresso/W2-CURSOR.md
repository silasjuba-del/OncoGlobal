# W2 · CURSOR · progresso

Executor: CURSOR. Branch: `f0/w2-cursor`. Papel: UI mostra e coleta; regra em `src/rules`; contrato em `src/contracts`.

## Fatias

| Fatia | Estado | Commit | Verify | Pendências |
|---|---|---|---|---|
| CUR-01 Scaffold Vite + React | FEITA | 469a324 | typecheck ok; fronteiras ok (9 arquivos); vitest 2 files, 25 tests; `ui:build` ok | `[VERIFICAR]` `tsconfig.json` ganhou `"jsx": "react-jsx"` |
| CUR-02 Tema | FEITA | 927b931 | fronteiras ok (11 arquivos); vitest 3 files, 27 tests | |
| CUR-03 Cabeçalho | FEITA | bbec1b5 | fronteiras ok (13 arquivos); vitest 4 files, 30 tests | |
| CUR-04 Banner E1 | FEITA | (este commit) | fronteiras ok (14 arquivos); vitest 5 files, 31 tests | |
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

## CUR-02 · saída real

`npm run verify`: fronteiras ok (11 arquivos); Test Files 3 passed; Tests 27 passed.

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
- `src/ui/tema/tokens.css`
- `src/ui/tema/temas.ts`
- `src/ui/tema/ThemeProvider.tsx`
- `tests/ui/tema.test.tsx`
- `src/ui/consulta/viewmodels.ts`
- `src/ui/consulta/CabecalhoPaciente.tsx`
- `tests/ui/cabecalho.test.tsx`
- `vite.config.ts` (`maxWorkers: 1` — jsdom em paralelo esgotou a memória)
- `src/ui/consulta/BannerE1.tsx`
- `tests/ui/banner-e1.test.tsx`

## Perguntas ao tech lead

- Confirmar `"jsx": "react-jsx"` no `tsconfig.json`.
