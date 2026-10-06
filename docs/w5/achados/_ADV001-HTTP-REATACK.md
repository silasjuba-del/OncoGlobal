# ADV-001 · handoff de reataque HTTP após integração

**Escopo RED:** `tests/adv/f01-http-sqlite.adv.test.ts` acrescenta três casos de ponta a ponta no `/acao` com executor fake, banco SQLite **em arquivo**, fechamento/reabertura do servidor e do banco entre as chamadas:

1. mesma chave/payload → `REPLAY`, **uma** execução fake;
2. resultado incerto → `OUTCOME_UNKNOWN`, sem reenviar;
3. mesma chave/payload diferente → HTTP 409/`NEGADA`, **uma** execução fake.

`tests/adv/f01-idempotencia.adv.test.ts` mantém os três casos originais como **LIMITE da store `memoriaIdempotencia()` isolada**: nova instância é volátil por definição; os testes agora afirmam explicitamente que ela não persiste. Isso **não** substitui nem reduz as três expectativas acima no caminho HTTP canônico. O KERNEL preservou teste regular de igual força em `tests/ledger/adv001-idempotencia.test.ts` no commit `dd31789` (observado por `git show`; resultado desse teste no integrado não foi executado pelo RED nesta entrega).

**Evidência na base RED antiga**, `f0/w5-red` antes de integrar `dd31789`: `npx vitest run tests/adv/f01-idempotencia.adv.test.ts tests/adv/f01-http-sqlite.adv.test.ts --no-file-parallelism`, **via lock**, exit 1, **3 FAIL no HTTP + 4 PASS de memória**, log `_w5-locks/logs/20261005-222942-RED.log`. São FAIL esperados nessa base, não refutação da correção KERNEL.

**Integrado:** o commit KERNEL `dd31789` foi visto como ancestral de `f0/w5-integrado` @ `314b2ef353200b63f035e93014827f5bb5fcb46d`, mas **RED não rodou o reataque nesse SHA**. O usuário/orquestrador fará a execução depois da integração dos commits RED. Estado **NOT_RUN no integrado**, sem alegar green ou correção demonstrada.

Uma detached `w5-red-reatack` foi criada no SHA `314b2ef` antes da orientação para não rodar; nenhum teste nem `npm ci` foi executado nela. Após conferir raiz, HEAD detached, diretório real e `git status` vazio, removida via `git worktree remove` **sem `--force`**, `REMOVIDA=True`. Nenhum arquivo de fonte ou teste do integrado ativo foi editado.
