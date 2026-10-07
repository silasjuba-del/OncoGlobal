# W10-CURSOR

Retomada: a primeira fatia não FEITA é a CURSOR-02.

| Fatia | Estado | Commit | Nota |
|---|---|---|---|
| CURSOR-01 | FEITA | W10-CURSOR-01 | Canvas 1680×1000, grade 58 · main · 396, topbar, DIA/NOITE |
| CURSOR-02 | — | | PatientHeader + cartão Modelo 08 |
| CURSOR-03 | — | | Timeline 2D |
| CURSOR-04 | — | | Abas e cards |
| CURSOR-05 | — | | Caixa única |
| CURSOR-06 | — | | Painel lateral |
| CURSOR-07 | — | | Visualizador + OncoAssist |
| CURSOR-08 | — | | Jornada 3D + Chart3D |
| CURSOR-09 | — | | Dock e overlays |
| CURSOR-10 | — | | Prescrição |
| CURSOR-11 | — | | Configurações |
| CURSOR-12 | — | | Triagem + agenda de QT |
| CURSOR-13 | — | | Acessibilidade |
| CURSOR-14 | — | | Percursos e fechamento |

## Testes criados
- `tests/w10-cursor/escala.test.ts`
- `tests/w10-cursor/layout.test.tsx`

## PEDIDOS
Ver `docs/w10/PEDIDOS-CURSOR.md`.

## Saídas reais · CURSOR-01

### `npx tsc --noEmit`
exit 0, sem diagnósticos.

### `npm run check:boundaries`
```
fronteiras ok (145 arquivos)
```

### `npm run check:corpus`
```
corpus ok (29 arquivos)
```

### `npx vitest run tests/ui tests/ui-telas tests/w10-cursor --no-file-parallelism`
```
 Test Files  24 passed (24)
      Tests  74 passed (74)
   Duration  452.60s
```

### `npx vitest run tests/w3/auditoria-regressao.test.ts --no-file-parallelism`
```
 Test Files  1 passed (1)
      Tests  9 passed (9)
   Duration  4.14s
```
