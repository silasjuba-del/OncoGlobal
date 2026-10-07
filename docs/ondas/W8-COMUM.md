# W8 · CABEÇALHO COMUM (GLM, Kimi, Antigravity, Muse)

> Leia antes: `docs/ondas/W2-CABECALHO-COMUM.md` (vale integralmente; onde diz W2, leia W8), `docs/DECISOES.md` (até D-W5-10), `docs/referencias/CASO-REAL-01-LICOES.md`, `docs/PLANO-FINAL-ONCOGLOBAL-v1.1.md` (Parte 0 normativa).
> **Base:** `f0/w1-integrado` @ 243dcae (W1–W5 integradas, 488 testes). Cada executor tem worktree e branch próprios.
> **Retomada:** `docs/progresso/W8-<EXECUTOR>.md`. Se cair, continue da primeira fatia não FEITA.

## Ondas rodando em paralelo (não toque nas faixas delas)
| Onda | Executor | Faixa exclusiva |
|---|---|---|
| W6 | Cursor | `src/ui/api/**`, `src/ui/telas/**`, `tests/ui-telas/**` |
| W7 | Codex | `src/app/**`, `src/leitura/**`, `src/impressao/**`, `bench/**`, `corpus/templates/kit/**`, `tests/{app,leitura,impressao,sistema,corpus-kit}/**`, `scripts/{iniciar,gerar-sinteticos}.mjs` |
| W8 | GLM | ver W8-GLM.md |
| W8 | Kimi | ver W8-KIMI.md |
| W8 | Antigravity | ver W8-ANTIGRAVITY.md |
| W8 | Muse | ver W8-MUSE.md |
**Ninguém** edita: `src/contracts/**`, `package.json`, `package-lock.json`, `tsconfig.json`, `scripts/check-boundaries.mjs`, `.github/**`, `docs/DECISOES.md`, `docs/PLANO-*`, `tests/w3/auditoria-regressao.test.ts`, CANONICA. Precisa? `BLOQUEADO_ESCOPO` + nota em `docs/w8/PEDIDOS-<EXECUTOR>.md`.

## Regras de máquina
- **Pouca RAM:** nunca rode a suíte inteira de uma vez. Rode só as suas pastas: `npx vitest run <pastas> --no-file-parallelism`. Feche cada fatia com `npx tsc --noEmit`, `npm run check:boundaries`, `npm run check:corpus` e os testes das suas pastas + `tests/w3/auditoria-regressao.test.ts`.
- Commit por fatia: `W8-<EXECUTOR>-NN: <título>` + `Co-Authored-By: <seu modelo>`. **Nunca** `git push`, `--no-verify`, enfraquecer teste, dado real de paciente.
- Se o sandbox bloquear commit: deixe em `git add`, marque `COMMIT_PENDENTE_SANDBOX`, siga.

## Invariantes (reprovam a fatia)
IA propõe, código calcula, médico decide e assina. Ausente = PENDENTE (nunca VERDE). Conflito nunca some. Dado de paciente não sai do PC. App alerta, nunca bloqueia o clínico. Valor clínico, dose, SIGTAP, limiar ou fonte não decididos = `[VERIFICAR]`. Teto de 5 estados. Sem dependência nova. Só **Paciente Teste NN** sintético; CPF/CNS sintéticos com DV inválido de propósito.
