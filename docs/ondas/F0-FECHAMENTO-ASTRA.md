# F0 · FECHAMENTO · Astra (Codex, orquestradora) + 5 Lunas · modalidade GOAL · 2026-10-09

> Ordem do Dr. Silas (09/10): **"Congela e pode publicar. Codex Astra orquestra + 5 agentes Luna (burros e determinísticos, com GOAL na execução + testes finais da fatia). Codex deve finalizar F0, incluindo os passos elencados: atualização de branches, revisão dos dados sem perda, push e commit completo. Dr. Silas apenas faz o merge na main."**
> Plano-base: `docs/FECHAMENTO-F0.md` (E0–E12 + E6b) · Parecer: `docs/w12/PARECER-CODEX-2026-10-09.md` · Decisões: `docs/DECISOES.md` (até D-W9-80).

---

## 1. Missão e definição de pronto

**Missão:** deixar a F0 **pronta para merge na `main`**, de modo que o Dr. Silas só precise clicar em "Merge" no PR `f0/w1-integrado → main`.

**Pronto (DoD)**, tudo verdadeiro ao mesmo tempo:
1. `f0/w1-integrado` contém **todo** o trabalho vivo, sem perda: ramo da Astra (`codex/w10-entrega-integrada@c0c0762`), sobras aprovadas e planejamento. A perda zero é provada por `git cherry`, que fica zerado ou com justificativa escrita.
2. A verificação completa em blocos está verde: tsc · fronteiras · corpus · todas as pastas de teste · red team (≥ 226, nenhuma prova apagada) · adv-w8 41/41 · backup/restore.
3. `docs/MATRIZ-RASTREABILIDADE-F0.md` existe, sem linha vazia nas decisões da F0 (R-34).
4. A **prova da consulta completa** (E6b) está verde num único arquivo, com métricas.
5. A auditoria cruzada não tem achado ALTO aberto.
6. O PR `f0/w1-integrado → main` está aberto, com CI verde, corpo completo (resumo, evidência, matriz, roteiro de demo) e **sem conflito com a main**.
7. Commit e push de tudo. `docs/f0-fecha/STATUS.md` está final. `CONTEXTO-NOVA-ABA.md` está atualizado.

**Fora do escopo:** fazer merge na `main` (é do Dr. Silas), criar a tag antes desse merge, editar a CANONICA (só com ordem expressa: prepare o patch, não aplique) e decidir clínica.

## 2. Autoridade e papéis

| Papel | Quem | Pode | Não pode |
|---|---|---|---|
| **Orquestradora e writer único** | **Astra (Codex)** | commit/merge/push em `f0/w1-integrado` e nos ramos `f0/f0f-*`; editar `src/contracts/**` (herda o papel de tech lead **só nesta missão**); abrir o PR; distribuir GOAL às Lunas | merge na `main`; tag antes do merge; CANONICA; decisão clínica; `--no-verify`; force-push em ramo compartilhado |
| **Executoras** | **Luna 1…5** (gpt-6-luna) | trabalhar só no próprio worktree/ramo, dentro da faixa; commitar no próprio ramo | push, merge, sair da faixa, mudar expectativa de teste existente, decidir clínica |
| Auditor cruzado (R-25 nível 3) | **Claude** (chat operacional, só leitura) ou Antigravity | revisar diff e emitir achados | escrever no integrado |
| Autoridade final | **Dr. Silas** | decide D2/D4/D5 e faz o merge na `main` | — |

**Congelamento (em vigor):** a partir do commit que publica este arquivo, **só a Astra** escreve em `f0/w1-integrado`. Claude, Grok, Cursor, Fugu e o chat de planejamento param. O planejamento continua em `f0/planejamento` e a Astra integra.

## 3. Modalidade GOAL (vale para as 5 Lunas)

Cada Luna recebe **um GOAL**, definido por três coisas: um **estado final verificável**, um **comando de prova** e uma **faixa de arquivos**. O ciclo é:

```
LER (só o necessário) → EXECUTAR o menor passo → RODAR a prova da fatia
  → verde?  sim → próximo critério do GOAL
            não → corrigir no lugar certo DENTRO da faixa → rodar de novo
  (máx. 5 voltas por critério; na 6ª: BLOQUEIO documentado e para)
→ GOAL completo → rodar a PROVA FINAL da fatia → commit único → RELATÓRIO
```

Comportamento de "agente burro e determinístico":
- Não interpreta a missão além do GOAL. Não melhora o que não foi pedido. Não renomeia, não refatora e não formata arquivo alheio.
- Diante de qualquer dúvida clínica ou de escopo, **para**, escreve `BLOQUEIO:` no relatório e devolve.
- Nada de aleatório nem de relógio no código de regra. Mesma entrada = mesma saída.
- O teste falhou: corrige o código, **nunca afrouxa o teste**. A prova está comprovadamente defeituosa: só a Astra autoriza corrigir a linha, mantendo a exigência.
- **Relatório final** obrigatório, em `docs/f0-fecha/LUNA-N.md`: GOAL, critérios ✓/✗, arquivos, **saídas reais copiadas** dos comandos, hash do commit e BLOQUEIOS.

## 4. Regras invariáveis (reprovam qualquer entrega)
IA propõe, código calcula, médico decide e assina · ausente = PENDENTE (nunca VERDE/0) · conflito nunca some · alerta nunca bloqueia o clínico · junção de paciente nunca automática · assinatura só do que foi exibido (A1/G-25) · IA nunca aparece em documento · semáforo VERDE/VERMELHO/PENDENTE, sem amarelo, sem "liberado/aprovado/apto" · CTCAE v6 pura (D-W9-73) · só dados sintéticos ("Paciente Teste NN") · LLM externa desligada · sem dependência nova · sem apagar teste nem prova do red team.

## 5. Máquina (15,5 GB de RAM, pouca livre)
**Nunca rode a suíte inteira de uma vez.** Sempre em blocos, em série, com `--no-file-parallelism`:
```
npx tsc --noEmit
node scripts/check-boundaries.mjs
node scripts/validate-corpus.mjs
npx vitest run tests/rules tests/modules tests/corpus tests/contracts --no-file-parallelism
npx vitest run tests/kernel tests/projections tests/orchestration tests/leitura --no-file-parallelism
npx vitest run tests/server tests/e2e tests/apac --no-file-parallelism
npx vitest run tests/ui tests/ui-telas tests/ui-copy tests/muse tests/w10-cursor --no-file-parallelism
npx vitest run tests/w10-grok tests/w10-luna2 tests/w10-luna3 tests/w10-luna4 tests/w10-luna5 tests/w12-grok --no-file-parallelism
npx vitest run tests/w11-adv tests/w12-f1 tests/w12-f2 tests/w12-f3 tests/w12-f4 tests/w3 --no-file-parallelism
npx vitest run --config tests/redteam/vitest.config.ts --no-file-parallelism
npx vitest run --config tests/adv-w8/vitest.config.ts --no-file-parallelism
```
- Pastas que não existirem são ignoradas.
- Pastas novas entram no bloco mais próximo. Liste com `ls tests` antes e garanta que **toda** pasta de `tests/` caiu em algum bloco.
- Falha que só aparece sob carga: rode isolada. Se passar isolada, anote "instável sob carga", não "verde".

---

## 6. ESTEIRA (cronológica; ‖ = paralelo)

### FASE A · Integração sem perda (serial, só a Astra) · portão A

**A0 · Leitura (≤ 30 min).** Ler `docs/CONTEXTO-NOVA-ABA.md`, `docs/FECHAMENTO-F0.md`, este arquivo, `docs/DECISOES.md` de D-W9-56 em diante, `docs/w12/PARECER-CODEX-2026-10-09.md` e o seu próprio `docs/w10/RESULTADO-10-FATIAS-20261008.md`.

**A1 · Linha de base medida.** No checkout `C:\Users\silas\Projects\OncoGlobal` (ramo `f0/w1-integrado`, HEAD esperado = commit que publicou este arquivo):
```
git fetch --all --prune
git status --short            # deve estar limpo
git log --oneline -1
```
Rodar a §5 inteira e salvar as contagens reais em `docs/f0-fecha/STATUS.md` (seção "Base"). É a referência de "não perder teste".

**A2 · Inventário sem perda.** Para cada ramo local e remoto (`git for-each-ref refs/heads refs/remotes`):
```
git cherry -v f0/w1-integrado <ramo> | grep '^+'
```
Montar a tabela em `STATUS.md` (seção "Inventário"): ramo · commits sem equivalente · destino (MERGE / CHERRY-PICK / OBSOLETO com motivo / DECISÃO DR. SILAS). O esperado, medido pelo tech lead em 09/10:

| Ramo | Esperado | Destino |
|---|---|---|
| `codex/w10-entrega-integrada` | 44 (`c0c0762`, já publicado) | MERGE em A3 |
| `closure/w10-{fugu,luna1,luna2,luna3}` | 0 em relação ao ramo da Astra | cobertos pela A3; conferir depois da A3 |
| `f0/w8-glm` | 2 (GLM-21 lote APAC/ORK, GLM-22 AG-19) | CHERRY-PICK em A4 se os testes passarem |
| `f0/w1-s05-testes-kimi` | 1 (triagem Q26) | conferir equivalência; OBSOLETO ou CHERRY-PICK |
| `f0/planejamento` | ≥ 1 (só `docs/planejamento/**`) | MERGE em A5 |
| `f0/w10-cursor` | 6 arquivos **sem commit** no worktree | **D2, Dr. Silas.** Backup já feito em `C:\Users\silas\handoff\backup-cursor-2026-10-09\` (patch + tar + BASE). Não tocar |
| demais `f0/w*` antigos | conferir | OBSOLETO, com o comando que prova a equivalência |

**A3 · Merge do ramo da Astra (risco maior).**
```
git checkout f0/w1-integrado
git merge --no-ff codex/w10-entrega-integrada
```
Conflitos esperados (10):
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

Regras de resolução:
- **`tests/redteam/**`:** vale a versão do integrado (226 verdes; RT-07 foi resolvido na W11-H2 com faixas no ruleset). As provas novas do seu reataque entram como **teste adicional** em `tests/redteam/` ou `tests/f0-fecha/`, nunca substituindo prova existente.
- **`src/server/**` e `src/ui/api/**`:** **somar**. Ficam as rotas da W12-F4 (`/consulta/flash/rascunho`, `/consulta/flash/preparar`, `FlashVisao`) **e** as suas jornadas F04/F07/F08 (vínculo explícito, triagem rascunho, liberação justificada, vínculo de contato). Nenhuma rota some.
- **`src/rules/triagem.ts`:** manter os comportamentos dos dois lados. Do integrado: W12-GROK corpo único, FC < 50 corta, CREAT > 1,5, tontura sem corte (D-W9-76), tontura `null` = PENDENTE. Do seu lado: diagnóstico de conflito de Hb e proveniência de unidade.
- **Extrator, pipeline e vínculo:** manter W11-H3/H4 (dedupe de laudo, detector de fármaco, `detectarConflitos`) **e** o seu F01–F03 (fármaco suspeito, reingestão, plano × prescrição).

Depois de resolver: §5 inteira. Critério: **nenhuma contagem abaixo da base da A1**, somada aos testes que vieram do seu ramo. Commit do merge e `git push origin f0/w1-integrado`.

**A4 · Sobras.** Para `f0/w8-glm`: `git cherry-pick -x <2 commits>` → testes de `tests/modules tests/orchestration` → push. Para `f0/w1-s05-testes-kimi`: provar que o teste Q26 já existe (grep do caso CADEIRA/CAMA → FRENTE). Se existir, OBSOLETO; senão, cherry-pick.

**A5 · Planejamento.** `git merge --no-ff f0/planejamento`. O escopo tem de ser só `docs/planejamento/**`; se for outro, pare e registre.

**A6 · Portão A.** Rodar a §5 inteira e `git cherry` dos ramos da A2, que tem de estar zerado ou justificado. Atualizar `STATUS.md`. Push. **Só então** criar os worktrees da Fase B a partir desse HEAD:
```
git worktree add -b f0/f0f-luna1 ..\OncoGlobal-wt\f0f-luna1 f0/w1-integrado
...  (luna1 a luna5)
New-Item -ItemType Junction -Path <wt>\node_modules -Target C:\Users\silas\Projects\OncoGlobal\node_modules
```

### FASE B · Cinco Lunas em paralelo ‖ (faixas disjuntas) · portão B
As Lunas trabalham ao mesmo tempo. **Por causa da RAM, rode as baterias de teste uma Luna de cada vez**; o código pode andar em paralelo. A Astra acompanha pelos relatórios e não edita os ramos delas.

| Luna | GOAL | Faixa exclusiva | Prova final |
|---|---|---|---|
| **L1** | Matriz R-34 | `docs/MATRIZ-RASTREABILIDADE-F0.md`, `scripts/matriz-f0.mjs` (novo, opcional), `tests/f0-fecha/matriz.test.ts` | teste que lê a matriz e falha se houver linha da F0 sem teste |
| **L2** | Prova da consulta completa (E6b) | `tests/f0-fecha/consulta-completa.test.ts`, `tests/f0-fecha/fixtures/**` | o arquivo verde com os 6 critérios + métricas |
| **L3** | Contratos pendentes da W12 | `src/contracts/w12/**`, `src/contracts/regras.ts`, `src/contracts/clinico.ts`, `corpus/rulesets/salao-triagem.v1.json`, os `src/rules/*.ts` que só trocam o tipo PROVISORIO pelo import, `tests/contracts/**` | tsc + regras + w12-grok verdes; zero `PROVISORIO-W12` no repo |
| **L4** | Flash em produção | `corpus/glossario/caixas.v1.json`, `src/config/**`, `src/ui/consulta/**`, `src/ui/telas/TelaConfiguracoes*`, `src/ui/salao/FormTriagem.tsx`, `tests/f0-fecha/flash-producao.test.ts` | caixa do modelo padrão lida pelo servidor sem dep de teste; prazo do retorno editável; tontura com "não sei" |
| **L5** | Estabilidade, PHI e paridade de CI | `tests/ui-telas/percursos.test.tsx` (só timeout/espera, nunca asserção), `tests/f0-fecha/phi-repo.test.ts`, `.gitattributes` (novo, só se faltar), `docs/f0-fecha/HIGIENE.md` | 3 rodadas seguidas verdes de `tests/ui-telas`; varredura PHI verde; `npm run verify` local = CI |

Se a Fase A mostrar que alguma faixa colide com o que entrou, a Astra ajusta a faixa **antes** de distribuir.

**Portão B:** os 5 relatórios entregues; cada GOAL ✓ ou com BLOQUEIO justificado.

### FASE C · Integração das Lunas e correções (serial, Astra) · portão C
**C1.** Merge `--no-ff` de **um ramo por vez**, na ordem **L3 → L4 → L2 → L1 → L5**: contratos primeiro, porque L2 e L4 dependem deles; a matriz por último, para refletir o estado final. Depois de cada merge, rodar a §5 inteira e dar push.
**C2 · Lacunas (E7).** Linhas vermelhas da matriz, critérios ✗ da E6b e BLOQUEIOs viram uma **rodada curta de GOAL** (até 5 Lunas, mesma modalidade) ou correção direta da Astra, se for pequena. Se for clínico, vira pergunta ao Dr. Silas em `STATUS.md` (seção "Para o Dr. Silas", com opções) e **não bloqueia** o resto.
**C3 · Portão C.** Matriz sem vermelho da F0; E6b verde; §5 verde; `git cherry` zerado.

### FASE D · Auditoria, PR e entrega (serial, Astra) · portão D
**D1 · Auditoria cruzada (R-25 nível 3).** Peça a revisão ao Claude (chat operacional, só leitura) por `docs/f0-fecha/PEDIDO-AUDITORIA.md`: diff `origin/main...f0/w1-integrado`, foco em perda de dado, assinatura sem exibição, PHI e conflito que some. Achado ALTO → corrigir → reataque → registrar.
**D2 · Reconciliar com a main.**
```
git fetch origin
git merge origin/main      # hoje só traz o merge do PR #3, sem conteúdo
```
Rodar a §5 inteira e dar push.
**D3 · Demo.** `docs/F0-DEMO.md`: roteiro de 10 minutos com dados sintéticos, com prints. Cobre agenda → salão → consulta → caixa de revisão → cartão transversal → Consulta Flash (Finalizar) → reabrir com histórico → APAC rascunho com antiglosa. Cada passo diz qual teste o prova.
**D4 · PR.**
```
gh pr create --base main --head f0/w1-integrado --title "F0 fechada: kernel, consulta e salão (W0–W12)" --body-file docs/f0-fecha/PR-BODY.md
```
O corpo traz:
- o que entrou;
- a tabela de evidência (contagens reais);
- o link da matriz;
- o link da demo;
- riscos residuais;
- o que fica para a F1 (lista do `FECHAMENTO-F0.md` §4 e §4b);
- os pedidos ao Dr. Silas.

O PR #2 (rascunho, `codex/w10-entrega-integrada`) é fechado com comentário "integrado em f0/w1-integrado".
**D5 · Registro final.**
- `docs/DECISOES.md`: entrada "F0 pronta para merge (data, HEAD, evidência)".
- `docs/CONTEXTO-NOVA-ABA.md`: atualizado.
- `docs/f0-fecha/STATUS.md`: FINAL.
- `docs/f0-fecha/CANONICA-PATCH.md`: **proposta, não aplicada**, para a E11. Cobre a permissão dos agentes (GOVERNANÇA × RAIZ), a área de evidência pendente e a regra de desidentificação antes de ligar a LLM.
- `docs/f0-fecha/LIMPEZA-WORKTREES.md`: lista do que pode ser removido; **não executar** (D4).

Push. CI verde no PR.
**Portão D = DoD da §1.** Avise o Dr. Silas: "PR #N pronto; só falta o merge".

### FASE E · Depois do merge do Dr. Silas
```
git fetch origin && git checkout main && git pull
git tag -a f0-fechada -m "F0 fechada" && git push origin f0-fechada
```
Conferir o CI verde na `main` e registrar em DECISOES.

---

## 7. Os 5 GOALs prontos (copie um para cada Luna)

**Cabeçalho comum de cada GOAL:**
```
MODALIDADE GOAL. Você é um agente executor burro e determinístico. Worktree: C:\Users\silas\Projects\OncoGlobal-wt\f0f-lunaN (ramo f0/f0f-lunaN). Só caminhos absolutos desse worktree.
Faixa exclusiva: <faixa>. Fora dela: só leitura.
Regras: §4 de docs/ondas/F0-FECHAMENTO-ASTRA.md. Máquina: §5 (blocos, --no-file-parallelism).
Ciclo: executar → provar → corrigir (máx. 5 voltas por critério) → prova final → commit único "F0F-LNN: <título>" + "Co-Authored-By: <seu modelo>" → relatório docs/f0-fecha/LUNA-N.md com saídas reais. Sem push, sem merge, sem --no-verify. Dúvida clínica/escopo = BLOQUEIO e para.
```

**L1 · Matriz R-34**
GOAL: `docs/MATRIZ-RASTREABILIDADE-F0.md` com uma linha por decisão que a F0 cobre: Q01–Q59, A1–A11, D-W5-*, D-W8-01, D-W9-01…80 e os G-xx/FN-xx/T-xx citados no PLANO §R-12/R-15/R-28. Colunas: Decisão · Resumo (≤ 12 palavras) · Contrato · Função/agente dono (arquivo:símbolo) · Consumidor (arquivo) · Teste observável (arquivo:nome) · Fase (F0 / F1+ / ORGANIZACIONAL) · Estado (VERDE com teste / VERMELHO sem teste / N-A com motivo).
Critérios: (a) todo item listado tem linha; (b) toda linha F0 VERDE aponta para arquivo e teste que existem (o teste confere por grep); (c) as VERMELHO formam a lista de lacunas no fim, com dono sugerido; (d) as ORGANIZACIONAL (Q02, Q03, Q51) usam checklist.
Prova final: `npx vitest run tests/f0-fecha/matriz.test.ts`. O teste falha se uma linha F0 VERDE apontar para arquivo ou teste inexistente.

**L2 · Prova da consulta completa (E6b)**
GOAL: `tests/f0-fecha/consulta-completa.test.ts`, com servidor HTTP real de teste e SQLite temporário (como `tests/e2e` e `tests/w12-f4`), percorrendo com "Paciente Teste 92":
kit documental sintético (laudo AP + laboratório + encaminhamento com um dado contraditório) → caixa de revisão → vínculo explícito do paciente → confirmação exibida → evolução → Consulta Flash (Finalizar) → **reabrir a consulta e ver o histórico**.
Critérios, um `it` cada:
1. o percurso completo gera evolução assinada e reabre com o histórico preservado;
2. o documento contraditório fica em CONFLITO até a decisão;
3. negação, data, unidade e ausência são preservadas;
4. repetir a operação após falha simulada não duplica evento nem documento;
5. trocar de paciente ou editar o conteúdo depois de exibido recusa a confirmação (`CONTEUDO_ALTERADO_APOS_EXIBICAO` / contexto);
6. com o caminho de IA indisponível, o fluxo completa manualmente.

Métricas: imprimir nº de chamadas/cliques equivalentes e nº de correções exigidas, e gravar no relatório.
Não criar rota nem regra. Se algo faltar no produto, é BLOQUEIO com a lacuna descrita.
Prova final: o arquivo verde 3 vezes seguidas.

**L3 · Contratos pendentes da W12**
GOAL:
- Publicar em `src/contracts/w12/` os tipos marcados `PROVISORIO-W12` e trocar os tipos locais pelo import: `ResultadoCtcaeClinico`, `EntradaRetornoToxicidade`, `ResultadoRetornoToxicidade`, `ResultadoIntervaloPosQt`, `ResultadoCanal`, `ResultadoValorAtual`, `EntradaVertigem`. Fonte: `docs/w12/PEDIDOS-GROK.md`.
- Renomear `SalaoRuleset.cortes.fcMinNaoCorta` → `fcMin`, com JSON e consumidores.
- Remover `ecog2ComTonturaCorta` do contrato e do JSON (D-W9-76).
- Acrescentar à `Triagem` `vertigemHistoricoAnterior` e `vertigemInicioNovo`, ambos `boolean | null` (ausente = PENDENTE, nunca "novo").
- Corrigir o comentário de `ResultadoTriagem.naoCortes`.

Critérios: zero `PROVISORIO-W12` (`grep -r`); nenhum teste com expectativa alterada, salvo os de schema que exigiam os nomes antigos (comente a decisão no teste).
Prova final: tsc + fronteiras + corpus + `tests/rules tests/modules tests/contracts tests/w12-grok tests/w10-grok tests/corpus`.

**L4 · Flash em produção**
GOAL:
- (a) Criar no glossário a caixa `config.flash.modeloPadrao`, com o próximo número livre, tipo suportado pelo validador de caixas (sem inventar tipo; se for preciso tipo novo, BLOQUEIO) e valor `{laboratorio, imagem}`. Torná-la editável na tela de Configurações. O servidor lê a caixa sem a dep de teste `numeroCaixaModeloFlash`.
- (b) Campo de prazo do retorno (dias) editável na Consulta Flash, que entra no plano. Ausente = PENDENTE.
- (c) No `FormTriagem`, tontura passa a tri-estado: sim / não / não sei. Não sei = `null`. Nasce em "não sei", nunca em "não".

Critérios: um teste para cada item; `tests/w12-f1 tests/w12-f3 tests/w12-f4` continuam verdes.
Prova final: `tests/f0-fecha/flash-producao.test.ts` + os blocos de UI e de servidor da §5.

**L5 · Estabilidade, PHI e paridade de CI**
GOAL:
- (a) `tests/ui-telas/percursos.test.tsx` estável sob carga: ajustar só esperas e timeouts, nunca asserção. Prova: 3 rodadas seguidas de `tests/ui-telas` junto com `tests/ui`.
- (b) `tests/f0-fecha/phi-repo.test.ts`: varredura do repositório inteiro (exceto `node_modules`/`.git`) por CPF, CNS, telefone, e-mail, **login/senha de portal** e nome próprio em cabeçalho de laudo. A allowlist é só de sintéticos já declarados; achado real = falha.
- (c) Conferir que `npm run verify` local faz o mesmo que o workflow do CI (`.github/workflows`, só leitura) e relatar a diferença.
- (d) `docs/f0-fecha/HIGIENE.md` com a lista de CRLF/LF e a proposta de `.gitattributes`. Aplicar só se não gerar diff em massa; se gerar, só a proposta.

Prova final: os 3 itens com saída real no relatório.

---

## 8. Comunicação e registro
- **Painel único:** `docs/f0-fecha/STATUS.md`, que a Astra atualiza ao fim de cada etapa. Seções: Base, Inventário, Fase A/B/C/D (✓/✗, hash, contagens), Para o Dr. Silas (perguntas com opções) e Riscos.
- **Claude (operacional):** recebe pedido de auditoria e perguntas técnicas por `docs/f0-fecha/PEDIDO-*.md` ou pelo Dr. Silas. Responde só lendo; não escreve no integrado durante o congelamento.
- **Planejamento:** registra o fechamento como PLN depois que o PR estiver aberto.
- Commits da Astra: `F0F-ASTRA-NN: <título>`, com `Co-Authored-By: <modelo da sessão>`.

## 9. Decisões que continuam com o Dr. Silas
- **D2 · Cursor:** 6 arquivos sem commit em `w10-cursor` (agenda/resumo lateral). Backup em `C:\Users\silas\handoff\backup-cursor-2026-10-09\`. A Astra **não** integra nem descarta sem ordem.
- **D4 · Limpeza dos worktrees:** a Astra só gera a lista.
- **D5 · CANONICA:** a Astra só gera o patch proposto.
- **Merge na `main`:** é do Dr. Silas.
