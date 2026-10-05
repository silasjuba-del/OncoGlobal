# W2 · CURSOR · progresso

Executor: CURSOR. Branch: `f0/w2-cursor`. Papel: UI mostra e coleta; regra em `src/rules`; contrato em `src/contracts`.

## Fatias

| Fatia | Estado | Commit | Verify | Pendências |
|---|---|---|---|---|
| CUR-01 Scaffold Vite + React | FEITA | 469a324 | typecheck ok; fronteiras ok (9 arquivos); vitest 2 files, 25 tests; `ui:build` ok | `[VERIFICAR]` `tsconfig.json` ganhou `"jsx": "react-jsx"` |
| CUR-02 Tema | FEITA | 927b931 | fronteiras ok (11 arquivos); vitest 3 files, 27 tests | |
| CUR-03 Cabeçalho | FEITA | bbec1b5 | fronteiras ok (13 arquivos); vitest 4 files, 30 tests | |
| CUR-04 Banner E1 | FEITA | 9bd72c7 | fronteiras ok (14 arquivos); vitest 5 files, 31 tests | |
| CUR-05 Delta | FEITA | d04d66d | fronteiras ok (15 arquivos); vitest 6 files, 34 tests | |
| CUR-06 Evidência | FEITA | 02b3d18 | fronteiras ok (17 arquivos); vitest 7 files, 38 tests | |
| CUR-07 Triagem | FEITA | 20ff506 | fronteiras ok (57 arquivos); vitest 27 files, 180 tests | idade vazia no contrato é `number`, não `dado` — a borda manda 0 `[VERIFICAR]` |
| CUR-08 Quadro | FEITA | 7f8d76b | fronteiras ok (59 arquivos); vitest 29 files, 186 tests | |
| CUR-09 Fechamento | FEITA | d0cf570 | fronteiras ok (19 arquivos); vitest 8 files, 41 tests | |
| CUR-10 Dose | FEITA | (este commit) | fronteiras ok (59 arquivos); vitest 29 files, 186 tests | |

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
- `src/ui/consulta/PainelDelta.tsx`
- `tests/ui/delta.test.tsx`
- `src/ui/evidencia/CardEvidencia.tsx`
- `src/ui/evidencia/GavetaFonte.tsx`
- `tests/ui/evidencia.test.tsx`
- `src/ui/consulta/Bundle.tsx`
- `src/ui/consulta/BarraFechamento.tsx`
- `tests/ui/fechamento.test.tsx`
- `src/ui/salao/FormTriagem.tsx`
- `src/ui/salao/ResultadoTriagem.tsx`
- `tests/ui/triagem.test.tsx`
- `src/ui/salao/QuadroSalao.tsx`
- `tests/ui/quadro.test.tsx`
- `src/ui/tratamento/CalculadoraDose.tsx`
- `tests/ui/dose.test.tsx`

Integração das regras: merge `1ffd053` (`f0/w1-integrado`) antes de CUR-07, CUR-08 e CUR-10.

## Último `npm run verify`

```
> oncoglobal@0.0.1 typecheck
> tsc --noEmit

> oncoglobal@0.0.1 check:boundaries
> node scripts/check-boundaries.mjs

fronteiras ok (59 arquivos)

> oncoglobal@0.0.1 test
> vitest run

 Test Files  29 passed (29)
      Tests  186 passed (186)
   Duration  53.13s
```

`npm run ui:build` (CUR-01): vite 8.3.2, ok.

## [VERIFICAR]

- `tsconfig.json` precisou de `"jsx": "react-jsx"` para o typecheck dos `.tsx`. Fora da lista da CUR-01; sem isso a fatia não fecha.
- Idade vazia na triagem: o contrato é `idadeAnos: number`, não `dado`. Campo vazio vai como `0` para o objeto existir. Não vira PENDENTE.
- A tela `App` continua só com o título e o aviso de dados sintéticos. As fatias seguintes não listavam `App.tsx`, então o cabeçalho, o banner, o delta, a evidência, o salão e a dose não foram montados num único layout.

## Perguntas ao tech lead

- Confirmar `"jsx": "react-jsx"` no `tsconfig.json`.
- Idade ausente deve continuar `0` ou o contrato precisa de um `dado` para a idade?
- Quer que a próxima fatia monte esses blocos dentro de `App` (consulta única, R-17)?
