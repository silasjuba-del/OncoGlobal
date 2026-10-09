# FECHAMENTO DA F0 · writer único · plano de etapas · 2026-10-09

> Autor: tech lead (chat operacional). Situação medida em 2026-10-09 com `git fetch --all`, `git cherry`, `git merge-tree` e `gh`. Nada foi mexido para levantar estes dados.

## 0. Resposta à pergunta "qual ramo é a base canônica?"
**A — `f0/w1-integrado`.** É o ramo de integração (README, "Ramo de trabalho"), está publicado e com CI verde (`verify` ok no `cdf897d`). A `main` está **1 commit atrás e 156 à frente** do integrado, e esse 1 commit é só o merge do PR #3, sem conteúdo novo. Por isso B (main) está atrás e C (ramo novo) só acrescentaria uma camada sem ganho.
**Writer único = Claude operacional (tech lead, R-25 nível 1).** Do início da etapa E1 até a tag, ninguém mais faz commit em `f0/w1-integrado`. Os executores entregam em ramo próprio e o tech lead integra.

## 1. Estado medido

| Item | Situação |
|---|---|
| `f0/w1-integrado` | `cdf897d`, publicado, CI verde. tsc ok · fronteiras 290 · corpus 125 · red team 226/226 · adv-w8 41/41 |
| `main` | PR #3 mergeado em 07/10; desde então, 156 commits atrás do integrado |
| **`codex/w10-entrega-integrada` (Astra)** | **44 commits fora do integrado; 49 só locais** (local `c0c0762` × remoto `846be32`). PR #2 em rascunho. Entrega F01–F10: vínculo explícito, triagem como rascunho, READ × WRITE, backup cifrado dos 3 stores, jornadas HTTP. Simulação de merge: **10 arquivos em conflito** |
| `closure/w10-{fugu,luna1,luna2,luna3}` | Todos os commits já estão no ramo da Astra (`git cherry` = 0). Não precisam de merge próprio |
| `f0/planejamento` | +1 (PLN-039 SpeakL); só docs |
| `f0/w10-cursor` | **6 arquivos sem commit** (App.tsx, tokens.css, Agenda.tsx, vite.config.ts, ResumoAgendaLateral.tsx, shims/) |
| `f0/w8-glm` | +2 sem equivalente (GLM-21 lote APAC/ORK, GLM-22 AG-19), com testes |
| `f0/w1-s05-testes-kimi` | +1 sem equivalente (triagem Q26), da W1; provavelmente superado |
| Worktrees | 82. Sujeira solta: `w10-astra` (saídas de Playwright), `w10-deepseek-v41` (missão .md), `w5-kernel` (evidência), `w5-orq` (ESTADO.md), `w7-codex` (Playwright) |
| Matriz de rastreabilidade (R-34) | **Não existe.** O plano diz: "Vazio = fase não fecha" |

Arquivos em conflito no merge da Astra:
- `src/kernel/extracao/extrator.ts`
- `src/orchestration/pipeline-extracao.ts`
- `src/rules/triagem.ts`
- `src/rules/w8/vinculoDocumento.ts`
- `src/server/leituras.ts`
- `src/server/rotas.ts`
- `src/ui/api/http.ts`
- `src/ui/api/porta.ts`
- `tests/redteam/rt01-troca-laudo.adv.ts`
- `tests/redteam/rt03-injecao-prompt.adv.ts`

## 2. O que a F0 exige para fechar (fonte normativa)
- **Q49 / R-28:** kernel = contratos, harness, gateway, ledger, LLM (desidentificador), regras FN-01…16, projeções, corpus + loader e T-01…T-61.
- **Q50:** testes positivos, negativos e de borda passando de verdade + **PR revisado** + **demo no app**.
- **R-34:** **matriz de rastreabilidade** (decisão → contrato → dono → consumidor → teste observável) antes do merge da fase.
- **R-25 nível 3:** auditoria cruzada por Codex ou Antigravity, nunca no arquivo de quem escreveu.
- **Q3:** a CANONICA é atualizada no fim, **só com ordem expressa** do Dr. Silas.
- **0.8:** perguntas abertas **não travam** a F0.

## 3. Etapas (em ordem; cada uma tem portão)

| # | Etapa | Dono | Pronto quando |
|---|---|---|---|
| **E0** | **Congelamento.** Aviso a Astra, Cursor, Grok, Fugu e planejamento: só o tech lead escreve no integrado | tech lead | Aviso enviado; Astra confirma que parou |
| **E1** | **Astra publica** `codex/w10-entrega-integrada` (`c0c0762`, 49 commits só locais) | Astra (a pedido do Dr. Silas) | `origin` = `c0c0762`; worktree limpo (`.playwright-cli/` e `output/` fora do git) |
| **E2** | **Merge da Astra** no integrado, `--no-ff`, com os 10 conflitos resolvidos. Regra: nos `tests/redteam/**` vale a versão do integrado (226 verdes, RT-07 já resolvido na W11-H2), e o reataque da Astra entra como teste novo, sem substituir prova; em `src/server` e `src/ui/api` somam-se as duas rotas/campos (F4 Flash + jornadas da Astra); em triagem e extrator, os dois comportamentos, com os testes dos dois lados verdes | tech lead | tsc · fronteiras · corpus · blocos (regras, kernel, servidor/e2e, UI, w11-adv, w12-*) · red team 226+ · adv-w8 41 · backup/restore, tudo verde |
| **E3** | **Sobras de ramos antigos.** `f0/w8-glm`: cherry-pick do GLM-21/22 se os testes passarem. `f0/w1-s05`: conferir se o teste Q26 já existe; se sim, arquivar | tech lead | `git cherry` zerado ou justificativa escrita |
| **E4** | **Cursor.** Os 6 arquivos sem commit em `w10-cursor` viram commit do próprio Cursor (e entram por merge) ou são descartados | Dr. Silas decide; Cursor executa | Worktree limpo |
| **E5** | **Planejamento.** Merge de `f0/planejamento` (PLN-039) | tech lead | Escopo só `docs/planejamento/**` |
| **E6** | **Matriz R-34.** `docs/MATRIZ-RASTREABILIDADE-F0.md`: cada Q/A/D-W relevante à F0 → contrato → função dono → consumidor → teste. Lacuna = vermelho, com dono | agente Sonnet gera; tech lead confere | Sem linha vazia nas decisões da F0; lacunas listadas como fatia |
| **E7** | **Bloqueantes da F0 que a matriz apontar** + pedidos de contrato da W12 (tipos PROVISORIO-W12, `fcMin`, retirar `ecog2ComTonturaCorta`, vertigem com histórico, tontura `null` no formulário) | tech lead + executores | Matriz sem vermelho da F0 |
| **E8** | **Auditoria cruzada (Codex).** Revisão só leitura do diff `main...f0/w1-integrado`, nunca no arquivo de quem escreveu. Achados → correção → reataque | Codex; tech lead corrige | Zero achado ALTO aberto |
| **E9** | **PR + demo.** PR `f0/w1-integrado → main` com resumo, evidência e matriz. Demo no app (salão, consulta, Flash, cartão transversal, APAC rascunho) com dados sintéticos | tech lead; Dr. Silas assiste | Dr. Silas aprova a demo e o merge |
| **E10** | **Merge na main + tag `f0-fechada`.** Atualizar `CONTEXTO-NOVA-ABA.md` e DECISOES ("F0 fechada") | tech lead | Tag publicada; CI verde na main |
| **E11** | **CANONICA** (Q3), só com ordem expressa: regras antigas marcadas SUPERADO | tech lead | Ordem do Dr. Silas registrada |
| **E12** | **Limpeza local.** Remover worktrees de ramos já mergeados (82 hoje); manter ramos remotos até a tag | tech lead, com OK do Dr. Silas | `git worktree list` só com o que está ativo |

## 4. Riscos
1. **O merge da Astra é o ponto de maior risco:** 44 commits, 10 conflitos, e ela trocou provas do red team. Mitigação: o integrado vence nas provas, nunca se apaga teste, e o resultado combinado tem de passar nas suítes dos dois lados.
2. **Trabalho só local:** os 49 commits da Astra e os 6 arquivos do Cursor não têm cópia no GitHub. Publicar antes de qualquer outra coisa (E1, E4).
3. **Pouca RAM:** a verificação é sempre em blocos. Uma falha só sob carga é confirmada isolada antes de virar achado.
4. **A matriz pode revelar lacunas de F0 escondidas** (E6 → E7). É esperado; nesse caso a data de fechamento anda.
5. **O que NÃO é F0 e não trava:** a caixa do modelo padrão da Flash, o prazo do retorno na tela, as receitas na Flash, as 25 orientações do canal e os biomarcadores extras de pulmão. Entram como abertura da F1.

## 5. Decisões do Dr. Silas
- **D1.** Autorizar E0/E1: congelar e pedir à Astra que publique o ramo dela.
- **D2.** Cursor (E4): commitar os 6 arquivos ou descartar?
- **D3.** Merge na `main` e tag (E9/E10) depois da demo.
- **D4.** Limpeza dos worktrees locais (E12).
- **D5.** Ordem para atualizar a CANONICA (E11).
