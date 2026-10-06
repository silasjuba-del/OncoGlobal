# W8-MUSE · progresso (EXECUTOR = MUSE)

> Retomada: primeira fatia não FEITA. Base `f0/w1-integrado` @ 243dcae.
> Verify por fatia: `npx tsc --noEmit` + `npm run check:boundaries` +
> `npm run check:corpus` + `npx vitest run <minhas pastas>
> tests/w3/auditoria-regressao.test.ts --no-file-parallelism`. Nunca `git push`.

| Fatia | Estado | Commit | Verify (resumo) | Pendências |
|---|---|---|---|---|
| MU-01 · Sistema visual | FEITA | a8ef6a8 | tsc 0 · fronteiras 81 arq · corpus 20 arq · regressão 9/9 | – |
| MU-02 · Semântica de estado | FEITA | (neste commit) | tsc 0 · fronteiras 81 arq · corpus 20 arq · regressão 9/9 | – |
| MU-03 · Microcopy pt-BR | A_FAZER | – | – | – |
| MU-04 · Ícones SVG | A_FAZER | – | – | – |
| MU-05 · Protótipo: consulta pronta | A_FAZER | – | – | – |
| MU-06 · Protótipo: salão e agenda | A_FAZER | – | – | – |
| MU-07 · Protótipo: APAC em bloco e laudo | A_FAZER | – | – | – |
| MU-08 · Protótipo: centro de comando | A_FAZER | – | – | – |
| MU-09 · Impressos | A_FAZER | – | – | – |
| MU-10 · Acessibilidade e fechamento | A_FAZER | – | – | – |

## Arquivos criados

- `docs/design/SISTEMA.md` — princípios, paleta, contraste AA medido, tipografia,
  espaçamento, raio, sombra, movimento, vocabulário de componentes, mapeamento
  para `src/ui/tema/tokens.css`.
- `docs/design/tokens-oncomed.css` — variáveis CSS (+ tema contraste, foco,
  `prefers-reduced-motion`).
- `docs/design/ESTADOS.md` — como VERDE/VERMELHO/PENDENTE aparecem, conflito
  com candidatos, ausente × não descrito × não se aplica, rascunho ×
  confirmado × assinado, baixa confiança/riscado com recorte, E1, demais
  estados do contrato. Nenhum estado novo.

## [VERIFICAR]

(nenhum até MU-01)

## Perguntas ao tech lead

(nenhuma até MU-01)
