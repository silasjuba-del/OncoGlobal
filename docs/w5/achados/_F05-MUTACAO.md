# F5 · prova por mutação · RED-R2

Base detached: `f0/w5-red` @ `5e1093dd78c4b170b509aa8abee5abc40454ce91`, worktree **real** `C:\Users\silas\Projects\OncoGlobal-wt\w5-mut` (sem branch, sem junção). `npm ci --no-audit --no-fund`: exit 0, 97 pacotes. Antes de cada mutação, `git status --porcelain` vazio. Mutação isolada: substituir **somente o corpo** da função `gNN` em `src/kernel/harness/gates.ts` da detached por `return passa("G-NN");`. Runner: `tests/adv/f05-mutate-gates.ps1`. Cada chamada Vitest passou por `vitest-lock.ps1`, `--no-file-parallelism`, sem paralelismo. `finally` restaurou os bytes originais; SHA-256 do arquivo e Git limpo conferidos após **cada** gate.

Baseline sem mutação: `tests/kernel/kernel.test.ts` **23 PASS**, exit 0, log `_w5-locks/logs/20261005-222235-RED.log`.

| Gate | Mutação | Teste que ficou vermelho | Exit | Log real | Natureza da detecção |
|---|---|---|---:|---|---|
| G-02 | sempre PASSA | `tests/kernel/kernel.test.ts > Gates > G-02 PHI egress` | 1 | `20261005-222242-RED.log` | unitário, 1 FAIL / 22 filtrados |
| G-03 | sempre PASSA | `... > G-03 assinatura` | 1 | `20261005-222245-RED.log` | unitário, 1 FAIL / 22 filtrados |
| G-05 | sempre PASSA | `... > G-05 verde honesto` | 1 | `20261005-222247-RED.log` | unitário, 1 FAIL / 22 filtrados |
| G-10 | sempre PASSA | `... > G-10 dose pura (K-13)` | 1 | `20261005-222250-RED.log` | unitário, 1 FAIL / 22 filtrados |
| G-13 | sempre PASSA | `... > G-13 letra` | 1 | `20261005-222253-RED.log` | unitário, 1 FAIL / 22 filtrados |
| G-14 | sempre PASSA | `... > G-14 interpolação` | 1 | `20261005-222256-RED.log` | unitário, 1 FAIL / 22 filtrados |
| G-23 | sempre PASSA | `... > G-23 comando curto Deepgram (N21)` | 1 | `20261005-222259-RED.log` | unitário, 1 FAIL / 22 filtrados |
| G-25 | sempre PASSA | `... > G-25 escopo da assinatura (N23)` | 1 | `20261005-222302-RED.log` | unitário, 1 FAIL / 22 filtrados |
| G-26 | sempre PASSA | `... > G-26 visão sem autoridade (N24)` | 1 | `20261005-222307-RED.log` | unitário, 1 FAIL / 22 filtrados |

**Controle de consumer:** ainda com G-25 mutado, `npx vitest run tests/server/server.test.ts --no-file-parallelism -t G-25` terminou **1 PASS / 5 filtrados**, exit 0 (log `20261005-222304-RED.log`). Logo o teste HTTP existente **não detectou** a mutação, apesar do teste unitário detectar. Não inferir que a rota aceite assinatura indevida: o roteador tem outras verificações. Os outros 8 gates não têm consumer por símbolo em `src/**` na base RED (busca de P1); teste unitário vermelho não prova integração.

**Veredito F5:** 9/9 mutações detectadas por teste unitário direcionado, portanto **nenhum S1 pelo critério literal "gate removível sem teste quebrar"**. Prova de integração dos oito gates sem consumer: **NOT_RUN/não demonstrada**; G-25 HTTP direcionado resistiu à mutação, embora o unitário a tenha detectado. Suíte regular completa por mutação: **NOT_RUN**, pois a instrução F5 manda rodá-la apenas se o teste direto não ficar vermelho.

**Limpeza:** detached `git status --porcelain` vazio, `rev-parse --abbrev-ref HEAD = HEAD`, raiz canônica conferida em `C:\Users\silas\Projects\OncoGlobal-wt\w5-mut`, diretório real (não link). `git worktree remove C:\Users\silas\Projects\OncoGlobal-wt\w5-mut` **sem `--force`** concluiu; `REMOVIDA=True`. Nenhuma mutação ficou no RED ou nos worktrees ativos.
