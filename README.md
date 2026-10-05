# OncoGlobal

Repo autônomo, do zero. Isolado. Não é ONCOMED.

**OncoGlobal (WORK)** é um motor longitudinal de contexto oncológico, centrado na consulta paciente ↔ médico. A IA propõe, o código calcula e valida, e o médico decide, corrige e assina. O app alerta e nunca bloqueia o clínico. Os dados do paciente ficam no PC.

- Plano executável: [`docs/PLANO-FINAL-ONCOGLOBAL-v1.1.md`](docs/PLANO-FINAL-ONCOGLOBAL-v1.1.md) (a Parte 0 é normativa)
- Decisões do Dr. Silas: [`docs/DECISOES.md`](docs/DECISOES.md) (Q01–Q59 + A1–A11)
- Onda atual: [`docs/MANIFESTO-W1-F0.md`](docs/MANIFESTO-W1-F0.md)

## Stack
Node 24 · TypeScript strict · Zod (contrato único) · SQLite (`node:sqlite`) · Vitest. Monólito modular, monousuário na v1.

## Verificar
```bash
npm install
npm run verify   # typecheck + fronteiras de import + testes
```

## Estrutura
```
src/contracts/   contratos Zod (congelados por onda; só o tech lead edita)
src/rules/       funções puras (sem I/O)
src/kernel/      ledger · projections · identity · harness · gateway · llm
corpus/rulesets/ regras clínicas versionadas com fonte (nunca no código)
tests/           testes positivos, negativos e de borda
docs/            plano, decisões, manifestos e relatórios por fase
```
