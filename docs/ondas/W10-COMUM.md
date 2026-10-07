# W10 · CABEÇALHO COMUM (ampla) · Grok · Cursor · Fugu (+ equipe interna Claude)

> Substitui a W9 (que não começou). Base: `f0/w1-integrado` (último commit no momento da criação do worktree). Cada executor externo tem worktree e branch próprios em `C:\Users\silas\Projects\OncoGlobal-wt\w10-<nome>`, branch `f0/w10-<nome>`.
> **Retomada:** `docs/progresso/W10-<EXECUTOR>.md` (tabela de fatias FEITA/PARCIAL/BLOQUEADA, commit, saída real dos comandos). Caiu? Continue da primeira fatia não FEITA.

## Leitura obrigatória antes da 1ª fatia (nesta ordem)
1. `docs/DECISOES.md` inteiro — **D-W9-01 a D-W9-53 são decisões do Dr. Silas e valem como estão** (tabelas clínicas já decididas; não crie `[VERIFICAR]` para o que já foi decidido).
2. `docs/ondas/W8-COMUM.md` (regras de máquina e invariantes; onde diz W8, leia W10).
3. Specs: `docs/specs/PIPELINE-EXTRACAO-MULTIMODAL.md`, `docs/specs/PATCH-PRESCRICAO-UI-LONGITUDINAL.md`, `docs/specs/PROMPT-ASSISTENTE-LONGITUDINAL.md`, `docs/specs/PORTAS-DE-ENTRADA.md`, `docs/specs/SKILL-MORFOMETRIA-LESAO-RM.md`, `docs/ondas/W10-PLANO.md`.
4. Modelos de documento: `docs/referencias/modelos/01…10` (+ `laudos-sinteticos/`).
5. Design-alvo: `docs/design/oncochart/` (README + `DECISAO-UI-ALVO.md`).
6. Achados ainda vermelhos: `docs/w8/ACHADOS-KIMI.md` + `tests/adv-w8/*.adv.ts` (rodar: `npx vitest run --config tests/adv-w8/vitest.config.ts --no-file-parallelism`).

## Quem faz o quê (faixas EXCLUSIVAS — tocar fora = BLOQUEADO_ESCOPO + nota em `docs/w10/PEDIDOS-<EXECUTOR>.md`)
| Executor | Faixa |
|---|---|
| **FUGU** (externo) | `src/kernel/extracao/**` (novo), `src/kernel/projections/**`, `src/orchestration/**`, `src/leitura/**`, `tests/{kernel/extracao,projections,orchestration,leitura}/**`, `tests/w10-fugu/**` |
| **GROK** (externo) | `src/rules/**` **exceto** `src/rules/{prescricao,morfometria,recist}/**` e os arquivos já existentes de `src/rules/w8/*` (pode criar arquivos novos ao lado); `src/modules/**`; `src/kernel/harness/ownership.ts` (novo); `scripts/verificar-manifesto.mjs` (novo); `corpus/rulesets/{rads-*,salao-*,agenda-*,interacoes*}`; `tests/{rules,rules-w8,modules}/**`, `tests/w10-grok/**` |
| **CURSOR** (externo) | `src/ui/**` **exceto** `src/ui/copy/**` e `src/ui/icones/**`; `tests/{ui,ui-telas}/**`, `tests/w10-cursor/**` |
| Claude (tech lead) | `src/contracts/**` (contratos novos em `src/contracts/w10/`), integração, `docs/DECISOES.md`, `package.json` |
| **Cadeia Astra + 5 Lunas** (`docs/ondas/W10-CADEIA-ASTRA.md`) | `src/server/**`, `src/app/**`, `src/kernel/gateway/**`, `src/rules/recist/**`, `src/estatistica/**`, `src/config/**`, `corpus/{glossario,regulatorio,receitas,redflags}/**`, `tests/w10-luna*/**` |
| Equipe interna (Claude + 5 agentes + Codex CLI) | `src/kernel/harness/gates.ts`, `src/kernel/llm/**`, `src/app/**`, `src/server/**`, `src/apac/**` (novo), `src/rules/prescricao/**` (novo), `corpus/{templates,fichas,glossario,regulatorio}/**`, `src/ui/copy/**`, `src/ui/icones/**`, `docs/design/**`, `tests/adv-w10/**` |
**Ninguém** edita: `src/contracts/**` (só o tech lead), `package.json`, `package-lock.json`, `tsconfig.json`, `scripts/check-boundaries.mjs`, `.github/**`, `docs/DECISOES.md`, `docs/PLANO-*`, CANONICA.

## Contratos novos
O tech lead publica em `src/contracts/w10/` (prescrição em 4 camadas + PrescriptionItem com as 4 classes, caixa numerada + glossário, ClinicalFact + EncounterSegment + reconciliação, veredito de antiglosa, timeline do paciente). **Ao começar cada fatia: `git merge f0/w1-integrado`** para receber contratos e decisões novos. Contrato que falta: use tipo local provisório **dentro da sua faixa** marcado `// PROVISORIO-W10: trocar por src/contracts/w10/...` e registre em PEDIDOS — nunca edite `src/contracts`.

## Regras que reprovam a fatia
- IA propõe, **código calcula**, médico decide e assina. A IA nunca define conduta, dose, protocolo nem grau CTCAE.
- **Ausente = PENDENTE**, nunca VERDE nem 0. Conflito nunca some. NÃO_VERIFICADO nunca vira fato em silêncio.
- **App alerta e nunca bloqueia o clínico**; bloqueia só artefato, saída externa e autoridade de IA.
- **Junção de paciente nunca automática** (D-W9-34a): todo dado novo vai para a caixa de revisão.
- Dado de paciente **não sai do PC** (G-02/G-27). LLM continua desligada (provider decidido em D-W9-15, só liga após gates).
- **Só dados sintéticos** ("Paciente Teste NN"; CPF/CNS com DV inválido de propósito). Use os sintéticos PT07–PT10 já no repo.
- Sem dependência nova (pedir em PEDIDOS). Sem `--no-verify`, sem `git push`, sem enfraquecer teste, sem mudar expectativa de teste existente.
- Teto de 5 estados na UI; semáforo VERDE/VERMELHO/PENDENTE (sem amarelo como estado clínico).
- Fuso −03:00; febre **estritamente > 37,8**; corte do salão D-W9-37; ajuste de dose só −20/−30/−40.

## Máquina (pouca RAM: 15,5 GB, ~1,7 GB livres)
Nunca rode a suíte inteira. Feche cada fatia com, **em série**: `npx tsc --noEmit` · `npm run check:boundaries` · `npm run check:corpus` · `npx vitest run <suas pastas> --no-file-parallelism` · `npx vitest run tests/w3/auditoria-regressao.test.ts`.
Commit por fatia: `W10-<EXECUTOR>-NN: <título>` + `Co-Authored-By: <seu modelo>`. Sandbox bloqueou commit: deixe em `git add`, marque `COMMIT_PENDENTE_SANDBOX` e siga.

## Fechamento (última fatia de cada executor)
Relatório `docs/progresso/W10-<EXECUTOR>.md`: tabela de fatias, testes criados, `.adv.ts` que viraram verdes, PEDIDOS, `[VERIFICAR]` restantes, e as **saídas reais** (copiadas) do último `tsc`/boundaries/corpus/vitest.
