# F0 — painel de fechamento

Missão: `docs/ondas/F0-FECHAMENTO-ASTRA.md`, D-W9-80. Writer único do integrado: Codex nesta missão. Merge na main reservado ao Dr. Silas.

## Base

- Checkout: `C:/Users/silas/Projects/OncoGlobal`, `f0/w1-integrado`.
- HEAD inicial: `f42b15fcd9fa87c73109c5b0e0133192712c8680`; checkout limpo antes dos registros desta missão; fetch executado.
- A1 PASS. Evidência serial em `evidencias/A1-base/`; comandos e contagens reais em `resultados.json`.
- TypeScript PASS; fronteiras 290; corpus 125. Regulares: 2.169 testes / 296 arquivos; W10 redteam: 226 / 28; W8: 41 / 9. Todos PASS, sem skips reportados.
- Limite desta sessão: três executoras simultâneas além da orquestradora; cinco Lunas serão escalonadas em lotes após portão A. Testes sempre exclusivos, um worker.

## Inventário

A2 PASS: lista integral em `INVENTARIO-A2.md` e `inventario-A2.json`. Astra 44 commits; GLM 2; Kimi 1; planejamento 1. Ramos closure serão cobertos por A3. Nenhum worktree preexistente será limpo ou removido.

## Fase A

A0 PASS: missão, contexto, fechamento, decisões D-W9-56…80, parecer e resultado das dez fatias lidos. Resultado das dez fatias consultado no ramo `codex/w10-entrega-integrada`, pois ainda não existe no integrado.
A1–A2 PASS; A3 EM EXECUÇÃO; A4–A6 PENDENTES.

## Fase B

PENDENTE do portão A. Nenhuma Luna despachada.

## Fase C

PENDENTE.

## Fase D

PENDENTE. Auditoria cruzada e CI ainda não executados.

## Para o Dr. Silas

- D2: WIP do Cursor preservado e fora da integração até ordem própria.
- D4: limpeza será apenas proposta.
- D5: CANONICA receberá apenas proposta de patch no repositório.
- Merge na main: exclusivo do Dr. Silas após entrega comprovada.

## Riscos

- Memória física livre muito baixa na abertura; verificações em série e um worker.
- Contagens históricas não substituem a linha de base A1.
- Documentos anteriores contêm atribuições de writer e nomes superados; D-W9-80 governa esta execução.
