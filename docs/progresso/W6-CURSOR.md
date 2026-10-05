# W6 · CURSOR · progresso

Executor: CURSOR. Branch: `f0/w6-cursor`. Papel: telas da consulta. UI mostra e coleta. Arquivos novos só em `src/ui/api/**`, `src/ui/telas/**`, `tests/ui-telas/**`, `docs/w6/**` e este arquivo.

## Fatias

| Fatia | Estado | Commit | Verify | Pendências |
|---|---|---|---|---|
| CUR-11 Porta de dados | FEITA | b68e0b3 | fronteiras ok (83); corpus ok (20); 54 files, 353 tests | `[SERVIDOR_PENDENTE]` exibirBundle, carregarConsulta, agendaDoDia, filaSalao, salvarTriagem, liberarComCorte, caixaCanal, pedirVinculo, lotesApac, chatSetor |
| CUR-12 Consulta pronta | FEITA | (este commit) | fronteiras ok (84); corpus ok (20); 55 files, 356 tests | |
| CUR-13 Barra de comando |  |  |  |  |
| CUR-14 Agenda |  |  |  |  |
| CUR-15 Salão |  |  |  |  |
| CUR-16 Chat |  |  |  |  |
| CUR-17 Canal |  |  |  |  |
| CUR-18 APAC |  |  |  |  |
| CUR-19 Importar |  |  |  |  |
| CUR-20 Percursos |  |  |  |  |

## CUR-11 · saída real

`npm run verify` (2026-10-05):

```
fronteiras ok (83 arquivos)
corpus ok (20 arquivos)
Test Files  54 passed (54)
     Tests  353 passed (353)
```

## CUR-12 · saída real

`npm run verify`:

```
fronteiras ok (84 arquivos)
corpus ok (20 arquivos)
Test Files  55 passed (55)
     Tests  356 passed (356)
```

## Arquivos criados

- `src/ui/api/porta.ts`
- `src/ui/api/http.ts`
- `src/ui/api/fake.ts`
- `src/ui/api/chaves.ts`
- `tests/ui-telas/api.test.ts`
- `docs/progresso/W6-CURSOR.md`
- `src/ui/telas/TelaConsulta.tsx`
- `src/ui/telas/consulta.css`
- `tests/ui-telas/consulta.test.tsx`
