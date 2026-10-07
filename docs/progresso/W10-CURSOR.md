# W10-CURSOR

Retomada: a primeira fatia não FEITA é a CURSOR-05.

| Fatia | Estado | Commit | Nota |
|---|---|---|---|
| CURSOR-01 | FEITA | W10-CURSOR-01 | Canvas 1680×1000, grade 58 · main · 396, topbar, DIA/NOITE |
| CURSOR-02 | FEITA | W10-CURSOR-02 | PatientHeader + cartão Modelo 08 |
| CURSOR-03 | FEITA | W10-CURSOR-02 | Timeline 2D + Ver em 3D (stub → 08) |
| CURSOR-04 | FEITA | W10-CURSOR-02 | Abas + cards Visão geral / caixa única stub |
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
- `tests/w10-cursor/cadastro.test.ts`
- `tests/w10-cursor/header.test.tsx`
- `tests/w10-cursor/timeline.test.ts`
- `tests/w10-cursor/timeline-ui.test.tsx`
- `tests/w10-cursor/abas.test.tsx`

## PEDIDOS
Ver `docs/w10/PEDIDOS-CURSOR.md`.

## Saídas reais · fatia longa CURSOR-02…04

### `npx tsc --noEmit`
exit 0.

### `npm run check:boundaries`
```
fronteiras ok (154 arquivos)
```

### `npm run check:corpus`
```
corpus ok (29 arquivos)
```

### `npx vitest run tests/w10-cursor --no-file-parallelism`
```
 Test Files  7 passed (7)
      Tests  20 passed (20)
   Duration  32.70s
```

### `npx vitest run tests/ui-telas/consulta.test.tsx tests/ui/cabecalho.test.tsx tests/ui/app.test.tsx tests/w3/auditoria-regressao.test.ts --no-file-parallelism`
```
 Test Files  4 passed (4)
      Tests  16 passed (16)
   Duration  26.08s
```
