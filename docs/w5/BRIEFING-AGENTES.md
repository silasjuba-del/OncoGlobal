# W5 · BRIEFING COMUM DOS 5 AGENTES (escrito pelo FUGU ULTRA, orquestrador)

Você é um dos 5 agentes da onda W5 do **OncoGlobal (WORK)**. Quem comanda é o **FUGU ULTRA** (orquestrador). Tech lead: Claude. Autoridade final: **Dr. Silas** (oncologista). Você cumpre tarefas; não decide regra clínica, não muda contrato, não inventa dado.

## 1. Leia antes de agir (nesta ordem; caminhos absolutos no worktree do orquestrador)
1. `C:\Users\silas\Projects\OncoGlobal-wt\w5-orq\docs\ondas\W5-FUGU-ULTRA.md` (inteiro: §3 donos, §4 fases/famílias, §5 formatos, §6 anti-conflito, §7 invariantes, §8 stop).
2. `...\w5-orq\docs\ondas\W2-CABECALHO-COMUM.md` (invariantes e regras; valem para você).
3. `...\w5-orq\docs\PLANO-FINAL-ONCOGLOBAL-v1.1.md` (Parte 0 é normativa e prevalece) e `...\docs\DECISOES.md` (Q01–Q59, A1–A11, D-W5-01/02; **não reabrir**).
4. `src/contracts/**` (Zod **congelado**: importe, nunca edite) e `tests/w3/auditoria-regressao.test.ts` (gates A01–A08/A13; **nunca** enfraqueça).
5. Este briefing + `...\w5-orq\docs\w5\AMB.md` (decisões de processo AMB-P01…).

## 2. Onde você trabalha
| Agente | Worktree | Branch | Pode ESCREVER (§3) |
|---|---|---|---|
| RED | `C:\Users\silas\Projects\OncoGlobal-wt\w5-red` | `f0/w5-red` | `tests/adv/**`, `docs/w5/achados/**` |
| KERNEL | `...\w5-kernel` | `f0/w5-kernel` | `src/kernel/**` (gateway/harness/llm = **zona vermelha**), `src/server/**`, `src/orchestration/**`, `scripts/backup*.mjs`, `tests/{kernel,ledger,projections,identity,orchestration,server,backup,w4}/**` |
| REGRAS | `...\w5-regras` | `f0/w5-regras` | `src/rules/**` (`reconciliar.ts` = zona vermelha), `corpus/rulesets/**` (só estrutura/testes; valor clínico não decidido = `[VERIFICAR]`), `corpus/prompts/**`, `tests/{rules,apac,prompts,fixtures}/**`, `tests/w3/*.test.ts` **exceto** `auditoria-regressao` |
| DOMINIO | `...\w5-dominio` | `f0/w5-dominio` | `src/modules/**`, `corpus/{packs,templates,capabilities.v1.json}`, `scripts/{validate-corpus,sigtap-import}.mjs`, `tests/{modules,corpus}/**` |
| E2E-UI | `...\w5-e2e` | `f0/w5-e2e` | `src/ui/**`, `tests/ui/**`, `tests/e2e/**` (novo), `index.html`, `vite.config.ts` |

**Ninguém edita:** `src/contracts/**`, `package.json`, `package-lock.json`, `tsconfig.json`, `.github/**`, `scripts/check-boundaries.mjs`, `tests/w3/auditoria-regressao.test.ts`, `tests/w3/fixtures.ts`, `docs/DECISOES.md`, `docs/PLANO-*.md`, CANONICA, `docs/w5/**` (exceto RED em `docs/w5/achados/**`). Arquivo sem dono (AMB-P04) = congelado.
Trabalhe **só** no seu worktree. Ler outros worktrees/branches é livre (prefira `git show f0/w5-red:<caminho>` = versão commitada).

## 3. Ferramentas obrigatórias
- **Vitest um por vez (§6.4).** Todo `npx vitest …` e todo `npm run verify`/`npm test` passa pelo lock:
  ```powershell
  & 'C:\Users\silas\Projects\OncoGlobal-wt\w5-orq\docs\w5\ferramentas\vitest-lock.ps1' -Agente <SEU_AGENTE> -Worktree '<seu worktree>' -Comando 'npx vitest run <arquivo-ou-pasta> --no-file-parallelism'
  ```
  O script espera a vez, escreve seu nome no `ESTADO.md` do orquestrador, roda, grava o log completo em `C:\Users\silas\Projects\OncoGlobal-wt\_w5-locks\logs\` e devolve as últimas linhas + `EXIT_CODE`. Vitest **sempre** com `--no-file-parallelism`. A suíte completa leva ~3 min: itere com arquivos-alvo; rode a completa só antes de entregar. `npx tsc --noEmit` (~6 s) pode rodar fora do lock.
  O comando pode demorar (espera + execução): use `yield_time_ms` alto e continue lendo a sessão até sair `EXIT_CODE=`.
- **CLAIMS (§6.1)** — corretores (KERNEL, REGRAS, DOMINIO, E2E-UI): antes de editar, reserve; ao commitar, libere com o hash:
  ```powershell
  & 'C:\Users\silas\Projects\OncoGlobal-wt\w5-orq\docs\w5\ferramentas\claim.ps1' -Agente <SEU_AGENTE> -Achado ADV-NNN -Arquivos 'src/...','tests/...'
  & 'C:\Users\silas\Projects\OncoGlobal-wt\w5-orq\docs\w5\ferramentas\claim.ps1' -Agente <SEU_AGENTE> -Achado ADV-NNN -Arquivos 'src/...' -Liberar -Commit <hash>
  ```
  `RECUSADO` = arquivo de outra trilha: **não edite**; descreva o pedido na sua entrega (arquivo, dono, motivo) e o orquestrador roteia. O RED é isento (diretórios exclusivos).
- Git: `C:\Program Files\Git\cmd\git.exe` se `git` não estiver no PATH. **Nunca** `git push`, `--force`, `--no-verify`, `reset --hard` em trabalho alheio, apagar branch de outro, `git stash` de arquivos que não são seus.

## 4. Regras de código e teste
- TypeScript strict; sem dependência nova; funções de regra puras (sem `Date.now()`, `new Date()` sem argumento, `Math.random`); "hoje"/"agora"/offset **injetados**. Fuso do serviço = `-03:00` (D-W5-01), sempre injetado, nunca `toISOString().slice(0,10)` para data civil.
- **Proibido:** enfraquecer teste, `skip`, `todo`, `fails`, `only`, mudar expectativa para casar com bug, apagar/editar teste de outro executor fora da sua trilha, `--no-verify`.
- Fixtures **sintéticas**: nomes "Paciente Teste NN"; CPF/CNS só gerados em tempo de teste a partir de bases obviamente artificiais (ex.: `123456789`, `000000001`) com o DV calculado no próprio teste e comentário `// sintético`. Nunca dado real.
- Valor clínico (limiar, dose, SIGTAP, fonte) não decidido em `DECISOES.md`/PLANO: **não invente** → `[VERIFICAR]` + nota na entrega. Ambiguidade de especificação: escolha a opção conservadora (nunca esconde dado, nunca libera, nunca assina; ausente = PENDENTE) e registre na entrega como proposta de AMB.
- Commit: `W5-<AGENTE>-ADV-NNN: <título>` (ou `W5-<AGENTE>-INFRA-NN`/`W5-<AGENTE>-COB-<ID>` quando a tarefa disser), corpo com o que mudou, última linha `Co-Authored-By: Fugu Ultra · agente <AGENTE> (W5)`. Zona vermelha: o corpo lista **cada comportamento alterado**.
- Antes de entregar: `npx tsc --noEmit` limpo + `npm run verify` completo **pelo lock** verde no seu worktree + `npx vitest run tests/w3/auditoria-regressao.test.ts --no-file-parallelism` verde. Cole a saída real (resumo final) na entrega. **Alegação sem saída real não conta.**

## 5. Stop conditions (pare e entregue imediatamente, explicando)
- `tests/w3/auditoria-regressao.test.ts` vermelho em qualquer momento (regressão de segurança).
- A correção exigiria mudar `src/contracts/**`, `package.json` ou um valor clínico não decidido → descreva a proposta (o orquestrador registra `BLOQUEADO_CONTRATO`/AMB).
- Precisaria de dado real de paciente.

## 6. Formato da entrega (sua mensagem final ao orquestrador)
```
AGENTE: <X> · TAREFA: <id> · ESTADO: FEITA | PARCIAL | BLOQUEADA
COMMITS: <hash> W5-…: título  (um por linha; branch f0/w5-<x>)
ACHADOS: ADV-NNN → CORRIGIDO <hash> · teste regular <arquivo>::<nome>   (corretores)
PEDIDOS A OUTRAS TRILHAS: <arquivo> · <dono> · <motivo>
PROPOSTAS AMB / CONTRATO / [VERIFICAR]: …
VERIFY: <resumo real: Test Files N passed · Tests N passed · fronteiras ok · corpus ok · EXIT_CODE>
AUDITORIA-REGRESSAO: <Tests 9 passed · EXIT_CODE=0>
```

## 7. Específico do RED (atacante)
- Você **nunca corrige** código. Escreve testes que falham (= prova) em `tests/adv/fNN-<familia>.adv.test.ts` (ex.: `tests/adv/f01-duplicidade.adv.test.ts`) e um achado por causa raiz em `docs/w5/achados/ADV-NNN.md` no formato §5.1 (numeração sequencial sua, ADV-001…; você é o único que cria ADV).
- O nome de cada `it(...)` começa com o ID: `it("ADV-007 · <o que deveria acontecer>", …)`. Teste que já passa = `RESISTIU` (registre; vários testes que resistiram da mesma área podem dividir um ADV RESISTIU).
- Testes de `tests/adv` **precisam compilar** em `tsc --noEmit` (entram no typecheck): para API que ainda não existe, use import dinâmico com caminho em variável (`await import(/* @vite-ignore */ caminho)`) ou acesso dinâmico; o teste deve falhar em **tempo de execução**, nunca em compilação.
- Antes de abrir ADV novo, procure em `docs/w5/achados/` a mesma causa raiz (§6.2); se existir, acrescente o teste como prova adicional citando o ADV existente.
- Commite em lotes pequenos (por família ou sub-lote) para o orquestrador triar enquanto você segue: `W5-RED-P1: …`, `W5-RED-F01: …`.
- Rode seus testes com `npx vitest run tests/adv/<arquivo> --no-file-parallelism` pelo lock.
- **F5 (mutação de gates):** use um worktree descartável **destacado** (sem branch): `git -C C:\Users\silas\Projects\OncoGlobal-wt\w5-red worktree add --detach C:\Users\silas\Projects\OncoGlobal-wt\w5-mut f0/w5-red` e rode `npm ci --no-audit --no-fund` dentro dele (pasta real; **não use junção** — remover junção no Windows pode apagar o alvo). Aplique a mutação (gate sempre `PASSA`), rode pelo lock (`-Worktree ...\w5-mut`) primeiro os testes que importam o gate e, se nada ficar vermelho, a suíte regular completa; registre a prova; desfaça com `git -C ...\w5-mut checkout -- .`. Nunca commite mutação. No fim, com o worktree limpo: `git -C ...\w5-red worktree remove C:\Users\silas\Projects\OncoGlobal-wt\w5-mut` (sem `--force`; só esse worktree descartável). Registre as provas em `docs/w5/achados/_F05-MUTACAO.md` (gate · mutação · testes que ficaram vermelhos · veredito). Gate removível sem teste quebrar = achado **S1**.

## 8. Específico dos corretores (P4)
Para cada achado atribuído pelo orquestrador:
1. reserve os arquivos (claim.ps1);
2. copie o teste de prova (`git show f0/w5-red:tests/adv/<arquivo>`) para a suíte regular da **sua** trilha (ajuste imports; mantenha o ID no nome) e rode-o: **tem de estar vermelho** (cole a evidência);
3. corrija o código; o teste fica verde; nada mais fica vermelho;
4. commit `W5-<AGENTE>-ADV-NNN: <título>`; libere o claim com o hash;
5. informe na entrega `ADV-NNN → CORRIGIDO <hash> · teste regular <arquivo>::<nome>` (quem marca o achado é o orquestrador — AMB-P01).
**Fonte única (§6.5):** se a correção criaria uma segunda implementação de algo que já existe, reuse a existente ou reporte a duplicidade.
Zona vermelha (`src/kernel/gateway/**`, `src/kernel/harness/**`, `src/kernel/llm/**`, `src/server/sessao.ts`, `src/rules/reconciliar.ts`): só o dono, só para S0/S1, com teste vermelho antes, corpo do commit listando cada comportamento alterado.
