# EXECUÇÃO — ESTABILIZAÇÃO, REFATORAÇÃO E INTEGRAÇÃO GLOBAL v3.0

## Estado deste registro

- Programa: `ONCOGLOBAL — ESTABILIZAÇÃO, REFATORAÇÃO E INTEGRAÇÃO GLOBAL v3.0`.
- Lote: G0 — PREPARAÇÃO.
- Responsável e escritor deste registro: Codex.
- Base observada: `f34636cb0b16b5669165588e8cdbf5134816163c`.
- Data da revalidação: 2026-10-23.
- Estado: **G0 APROVADO após incorporação dos 12 complementos do parecer independente de Claude**.
- Parecer independente: Claude retornou `APROVADO COM COMPLEMENTOS` e emitiu `APROVAR G0` condicionado à incorporação e ao commit dos 12 adendos, cumpridos neste registro.
- Este registro não autoriza merge em `main`, push, deploy, exclusão, promoção clínica nem alteração fora dos WRITE_SETs.

## 1. Autoridade de autoria

Autorização literal do Dr. Silas, registrada em chat em 2026-10-23:

> "gemini argon sera escritor com permissao para essa task - codex integração final e supervisao e claude supervisao e corretor por fatias."

Esta frase constitui exceção pontual à regra de `AGENTS.md` segundo a qual somente Codex e Claude podem ser autores de código. A exceção vale apenas para esta tarefa; não altera a regra geral e não autoriza edição de `AGENTS.md`.

Alcance fechado: lotes G0–G10 e somente os WRITE_SETs deste documento. O alcance até G10 decorre também do comando explícito do Dr. Silas: `"MODO DA TASK: /goal completamento até merge na main no repo"`. Esse comando delimita o programa, mas não elimina os gates, a revisão independente nem a autorização humana de merge. Gemini Argon é o escritor principal; Codex supervisiona o conjunto, executa G0/G1 e integra; Claude revisa e só corrige caminhos formalmente transferidos. Um arquivo tem um único escritor por vez. `AGENTS.md` permanece inalterado.

## 2. Bases e PRs revalidadas

### Repositório canônico

- Caminho: `C:\Users\silas\Projects\OncoGlobal`.
- Branch: `feat/oncoassist-cognitivo-20261023`.
- HEAD: `f34636cb0b16b5669165588e8cdbf5134816163c`.
- `main`: `3dc6020ecf3a0a7dc4766c11ef58e75bf45af91c`.
- Status: somente `?? docs/planejamento/PROMPT-ESTABILIZACAO-REFATORACAO-v2.1.md`.
- Prompt preservado: 49.269 bytes; SHA-256 `81f32f80d399f5d865dc82ea10dc992a257d8f062758551bea618fd2673c6878`.
- Todos os comandos de inspeção Git no canônico e nas worktrees existentes usaram `GIT_OPTIONAL_LOCKS=0`.

### PRs históricas

| PR | SHA | Estado em 2026-10-23 | Mergeabilidade | Discussões atuais abertas |
|---|---|---|---|---|
| #45 | `4635d9b78bfd52180d9fa2c562a2dbececfb582b` | OPEN, não draft | MERGEABLE | 8 atuais; 7 antigas/outdated |
| #46 | `56ec76f865626971a2bea9bd4ed5faea067f955b` | OPEN, draft | CONFLICTING | 0 |
| #47 | `c2d3505b642047ec1f01b44281d378f1ebd9f3fd` | OPEN, não draft | MERGEABLE | 4 atuais; 4 antigas/outdated |
| #48 | `f34636cb0b16b5669165588e8cdbf5134816163c` | OPEN, draft | MERGEABLE | 0 |

Os quatro objetos existem localmente como commits. `git merge-base --is-ancestor 4635d9b... f34636c...` retornou 0: **#48 contém #45**.

Triagem verificada no código:

| PR | Thread | Estado | Evidência/dono |
|---|---:|---|---|
| #45 | 1–7 | corrigida | correções presentes no SHA `4635d9b` |
| #45 | 8 | corrigida | correção técnica presente; preservar nota sobre justificativa obrigatória de override |
| #45 | 9–12 | corrigida | correções presentes no SHA `4635d9b` |
| #45 | 13 | corrigida | caminho fecha em recusa |
| #45 | 14 | presente | writer protegido ainda sem chamador de produção; há 8 chamadas diretas a `confirmar` em `src/server`; dono G3 |
| #45 | 15 | presente | gates G-07/G-08/G-09 condicionais a entradas opcionais; dono G3 |
| #47 | 1–6 | corrigida | correções presentes no SHA `c2d3505` |
| #47 | 7 | presente | impressão omite conteúdo de `<details>` fechados `.oc21-details-card`; dono G1 |
| #47 | 8 | presente | `Escape` fecha o dropdown sem devolver foco ao botão gatilho; dono G1 |

“Corrigida” descreve o código revalidado; as threads ainda podem aparecer abertas no GitHub e só serão resolvidas com evidência. Os quatro itens `presente` têm lote e proprietário explícitos.

## 3. Worktrees

### Referências preservadas, somente leitura

| Worktree | HEAD | Branch | Status |
|---|---|---|---|
| codex-f1-acervo-f2-inicio | `db6226b` | `codex/f1-acervo-f2-inicio` | 21 alterações |
| codex-revisao-mencoes-20261020 | `cc26c2c` | `feat/revisao-mencoes-20261020` | 14 alterações |
| fugu-pr45-ci-20261021 | `4635d9b` | `fix/pr45-harness-ci-20261021` | limpa |
| fugu-prd-ui-20261021 | `c2d3505` | `feat/ui-clinica-estados-dialogos-20261021` | limpa |
| planejamento | `20b5a4d` | `f0/planejamento` | limpa |
| cursor-correcoes-backup-20261020 | `6cf6fc9` | `cursor/correcoes-backup-20261020` | 6 alterações |
| cursor-setor-jornadas | `03d74dd` | `cursor/setor-jornadas-b2` | 3 alterações |
| codex-pr19-gate | `c2d6407` | `codex/pr19-correcoes-merge` | 9 alterações |
| pre-f1-higiene | `fce5f42` | detached | 65 alterações |
| w10-astra | `c0c0762` | `codex/w10-entrega-integrada` | 19 alterações |
| w10-cursor | `9d83008` | `f0/w10-cursor` | 6 alterações |
| w10-deepseek-v41 | `367825e` | `deepseek/v41-conclusao` | 1 alteração |
| w5-kernel | `30d4240` | `f0/w5-kernel` | 1 alteração |
| w5-orq | `386ec3b` | `f0/w5-integrado` | 1 alteração |
| w7-codex | `5ddde70` | `f0/w7-codex` | 10 alterações |

Nenhuma referência foi limpa, resetada, guardada em stash, sobrescrita ou commitada.

### Worktrees v3.0 criadas

| Papel | Caminho | Branch | Base | Estado |
|---|---|---|---|---|
| integração/supervisão | `C:\Users\silas\Projects\OncoGlobal-wt\codex-estabilizacao-global-v30` | `codex/estabilizacao-global-v30` | `f34636c` | limpa antes deste registro; depois, somente este arquivo |
| escrita Argon | `C:\Users\silas\Projects\OncoGlobal-wt\codex-argon-estabilizacao-v30` | `codex/estabilizacao-g01-reconciliacao` | `f34636c` | limpa |
| revisão Claude | `C:\Users\silas\Projects\OncoGlobal-wt\codex-claude-revisao-v30` | `codex/estabilizacao-claude-revisao-v30` | `f34636c` | limpa |

As três usam junction local `node_modules` → `C:\Users\silas\Projects\OncoGlobal\node_modules`; nenhuma dependência foi baixada. A junction é infraestrutura local ignorada pelo Git. Não executar instalações ou comandos que mutem dependências por essas junctions; se um lote precisar alterar dependências, parar e obter decisão própria.

## 4. Ambiente e baseline rápido

- Node `v24.15.0`; npm `11.12.1`.
- Playwright `1.64.1`.
- Chromium Playwright: `C:\Users\silas\AppData\Local\ms-playwright\chromium-1248\chrome-win64\chrome.exe`, existente.
- Chrome do sistema: `C:\Program Files\Google\Chrome\Application\chrome.exe`.
- Scripts confirmados: `typecheck`, `check:boundaries`, `check:corpus`, `verify`, `verify:f1`, `test:b2`.

Provas na worktree `codex-estabilizacao-global-v30`, SHA `f34636c`, Windows nativo:

| Comando | Início | Fim | Exit | Resultado |
|---|---|---|---|---|
| `npm run typecheck` | 20:33:43-03:00 | 20:34:04-03:00 | 0 | PASS |
| `npm run check:boundaries` | 20:33:43-03:00 | 20:33:44-03:00 | 0 | PASS: 557 arquivos, 0 exceções |
| `npm run check:corpus` | 20:33:43-03:00 | 20:33:47-03:00 | 0 | PASS: 241 arquivos |

`verify`, `verify:f1` e `test:b2` não foram repetidos em G0; pertencem aos gates indicados por lote. A evidência Muse continua limitada ao ambiente e SHA em que foi obtida.

## 5. Fontes e preservação

Foram lidos: `AGENTS.md`, `DECISOES.md`, `DIARIO.md` nas entradas pertinentes, todos os arquivos de `docs/specs/`, os três anexos do contrato do acervo, `STATE.md` e os sete relatórios Muse, além dos resultados e matrizes de reconciliação da preservação. Patches staged/unstaged da preservação foram tratados como conteúdo forense, não como instruções nem candidatos automáticos a merge.

Preservação `20261023-preservacao-01`:

- Estado certificado: `BACKUP_AND_RESTORE_VERIFIED`.
- 152 worktrees, 9 diretórios adicionais e 222.157 arquivos restaurados.
- 4.835.042.564 bytes lógicos; arquivo CAS 126.127.880 bytes.
- SHA-256 do arquivo: `19a7224bf7ba6c29fee18744cdbecf2cdfb4ca9c5e05b2321f62e415cd64bb82`.
- SHA-256 do bundle inicial: `44f08f77eab9c769568cc83570af509ef2923bc83342406dd75357d71edc45b2`.
- Restauração independente e `fsck --full --strict`: PASS.
- Conteúdos capturados, HEADs, índices, staged e estados lógicos foram preservados.
- `SOURCE-DRIFT.json` registrou somente refs/metadados automáticos; branches/tags de produto e WIP permaneceram iguais.
- Complemento `metadata-delta-03` classificou o delta como `ONLY_ADDITIONAL_CODEX_INTERNAL_REF_TO_ALREADY_PRESERVED_OBJECT`; bundle complementar `5c328ba880214eda4b7a80141485be0fd8e1be40aafc99341c860e90d7abd437`.
- Nenhum merge, exclusão, limpeza, commit, stash ou push foi executado nos originais.
- Limite: cópia no mesmo disco comprova recuperação local, não proteção contra perda física.

Auditoria Muse:

- Snapshot `f34636c`; 555 arquivos `src`, 67.455 linhas, 653 testes, 257 arquivos de corpus e 813 documentos.
- Typecheck, boundaries e corpus verdes; shards agregados 5.376/5.379, com falhas operacionais/intermitentes registradas; `verify:f1` 949/951; Chromium não executado pela Muse.
- Achados OG-001–OG-015 e duplicidades D-01–D-07 mantidos com seus limites. “Nenhum P0/P1 confirmado” não significa ausência.

## 6. Inventário operacional

### Transações

O dono técnico da primitiva é `src/kernel/ledger/db.ts::transacao`: `BEGIN IMMEDIATE` para a transação externa; `SAVEPOINT/ROLLBACK TO/RELEASE` para aninhamento; `COMMIT` no sucesso e `ROLLBACK` na exceção. Foram encontrados 62 pontos lexicais de chamada em 32 arquivos.

Concentrações principais: `canalEntrada.ts` 10; `canalResposta.ts` 7; `salaoF3.ts` 4; `biblioteca.ts`, `oncoassistPropostas.ts`, `f4Acesso.ts` e `server/biblioteca.ts` 3 cada; `trialsServico.ts`, `f5AnamneseOncoChief.ts`, `f6MultiusuarioSetores.ts` e `estimulos/gravar.ts` 2 cada. Os demais têm um ponto.

Donos por domínio:

- Escrita clínica atômica: `writeRouter.confirmar`.
- Ledger/drafts/operação: `ledger.ts`, `drafts.ts`, `migracao.ts`.
- Canal de entrada/checkpoint/consentimento: `canalEntrada.ts`.
- Resposta/autorização/recibo: `canalResposta.ts`.
- Biblioteca: kernel `corpus/biblioteca.ts` e transporte `server/biblioteca.ts`.
- Jornadas clínicas: prescrição executável, APAC, Flash, salão, ações compostas, medicamentos, fichas, trials e confirmação.
- Projeções/orquestração/configuração: reconstrução, runtime, estímulos, settings e store.

G2 deve transformar este inventário lexical em tabela semântica: função dona, abertura/fechamento, tabelas alteradas, efeitos, awaits adjacentes, idempotência e teste. Uma transação só pode mudar de dono com caracterização antes/depois.

Lacuna confirmada: `src/server/rotas/extracaoRevisao.ts` não chama `transacao(`. No vínculo de paciente (`L512–657`) há três escritas separadas: `salvarDraft` em L613, `confirmar` em L623 e novo `salvarDraft` em L641. O fluxo pode responder 409 em L638–640 depois de já gravar o `ReviewDecision`. G5 deve envolver o vínculo completo em uma transação única e incluir teste de falha forçada entre L623 e L641, provando rollback integral.

### Revalidação de saída de canal

`revalidarAutorizacaoSaidaCanalNoLedger` é chamada nos três momentos distintos e todos devem permanecer:

1. antes do gateway, inclusive replay (`canalResposta.ts:754`);
2. depois do await/assíncrono (`canalResposta.ts:841`);
3. imediatamente antes do transporte no executor (`canalResposta.ts:895`).

Cada etapa revalida autorização persistida, revisão do contexto quando fornecida, texto enviado, sessão/vínculo e consentimento aplicáveis. Não fundir as três sem prova de equivalência temporal.

### Política de contexto E1

Quatro escopos devem ser tipos/políticas explícitos, não comparadores ad hoc:

1. **Paciente:** cadastro, identidade e vínculo que não dependem de um encontro.
2. **Encontro:** operação assistencial de um encontro em que lote é declarado irrelevante.
3. **Consulta com lote:** escrita clínica e leitura longitudinal com `patientId + encounterId + tumorLotId`, normalizando lote para `string | null`.
4. **Operação com revisão:** o contexto anterior mais `operationId`, `expectedRevision`, hash/versão exibida e fonte.

Casos A CONFERIR, sem decisão inventada:

- `liberarSalao` compara paciente + encontro e persiste `tumorLotId:null`.
- `salaoContingencia` compara paciente + encontro antes e dentro da transação.
- `canalResposta` compara paciente + encontro na autorização de saída; o rascunho/exibição também carrega lote e revisão de contexto.
- `salaoCanal.ts:196`, em `vincularCanal`, compara somente paciente; a gravação em L225 usa encontro e lote correntes.
- `sessao.ts:101–104` permite que `tumorLotId === undefined` ignore a comparação de lote pelo próprio tipo.
- `writerClinico.ts:148` confere somente o paciente do draft, sem conferir encontro e lote.

Até decisão do Dr. Silas, esses três percursos ficam classificados como “operação por encontro; lote possivelmente irrelevante”, sem mudança de comportamento. G3e deve obter decisão explícita e testar omitido, `null` e divergente.

Busca em `docs/specs/` não encontrou uma política contextual canônica chamada `D1` ou `D-01`. O único “D1” literal é a calibração histórica da spec de morfometria, já superada. Portanto:

- não foi inventada uma correspondência;
- D-01 da Muse continua significando “dois caminhos operacionais de confirmação”;
- a política E1 acima deriva das invariantes e do código atual e exige promoção contratual em G3e.

A regra geral aplicável é `D-F1-10`: o contexto inclui “lote tumoral quando aplicável”. `ActionIntent.escopo` não possui campo de lote; na resposta de canal o lote participa indiretamente pela `revisaoContexto` opcional verificada em `canalResposta.ts:660`. G3e deve tornar explícito quando essa ausência é deliberada e quando exige o contexto canônico completo.

### Tempo e replay E2

Há exatamente seis consultas copiadas `SELECT criadoEm FROM operation WHERE operationId=?`:

1. `kernel/gateway/writerClinico.ts:179`;
2. `server/rotas/confirmacao.ts:162`;
3. `server/rotas/extracaoRevisao.ts:589`;
4. `server/rotas/extracaoRevisao.ts:743`;
5. `server/rotas/salaoCanal.ts:149`;
6. `server/rotas/salaoCanal.ts:272`.

Elas pinam o instante original para replay, mas já divergem em fallback e materialização. G3a move a pinagem para o kernel, preserva hashes legados e revalida sessão no replay.

Desvios adicionais revalidados:

- `estadoDoenca.ts:58–61` não lê `operation.criadoEm`: consulta o replay no ledger por `operationId` e grava usando `deps.agora()`.
- `salaoCanal.ts:150–165` implementa replay por conteúdo com `JSON.parse` inline e emite `OPERATION_HASH_CONFLICT` fora do kernel em L163.
- `salaoCanal.ts:207–227` não pina carimbo e responde 409 `CHAVE_IDEMPOTENCIA_REUTILIZADA` quando o draft já existe.
- `extracaoRevisao.ts:746–747` usa `summaryDraft.criadoEm` como fallback.
- `confirmacao.ts:164–171` pula `REVISAO_FATOS_ALTERADA` quando a operação já existe.
- `extracaoRevisao.ts:498` usa `SELECT 1 FROM operation`, outro ramo local de decisão de replay.
- Causa raiz: em `writeRouter.ts:71,75`, `hashPayload` inclui `criadoEm`; o caminho de replay ocorre antes da checagem de sessão de L77–85.

### Domínios de hash para G3b

Há dois `hashCanonico` homônimos:

- `src/rules/conteudoCanonico.ts`: converte `undefined` para `"null"` e aceita objetos por enumeração; um `Date` sem chaves próprias colapsa para `{}`.
- `src/kernel/projections/retrato/index.ts:14–22`: aceita somente objeto plain, não representa `undefined` e lança `CONTEUDO_NAO_CANONICO` para `Date`.

Ambos divergem de `hashPayload` do ledger. G3b deve mapear os pares efetivamente comparados, nomear o domínio de cada hash e preservar leitura de hashes legados; não unificar funções homônimas sem teste explícito de `undefined`, `Date`, ordem de chaves e compatibilidade.

## 7. Métricas e método de reprodução

Medição lexical reproduzida no SHA `f34636c`, Windows nativo, lendo os arquivos em UTF-8:

| Arquivo | Linhas | Imports runtime/tipo | Decisões lexicais | useState/effect/ref | SQL prepare |
|---|---:|---:|---:|---:|---:|
| `server/rotas.ts` | 490 | 49/10 | 186 | 0/0/0 | 2 |
| `rotas/extracaoRevisao.ts` | 825 | 19/2 | 377 | 0/0/0 | 4 |
| `server/leituras.ts` | 794 | 46/6 | 315 | 0/0/0 | 0 |
| `server/canalEntrada.ts` | 1537 | 7/3 | 113 | 0/0/0 | 32 |
| `server/canalResposta.ts` | 1114 | 18/3 | 191 | 0/0/0 | 30 |
| `rotas/salaoCanal.ts` | 319 | 14/1 | 101 | 0/0/0 | 6 |
| `rotas/prescricaoFlash.ts` | 345 | 22/2 | 150 | 0/0/0 | 0 |
| `ui/OncoassistLocal.tsx` | 427 | 25/2 | 129 | 20/6/3 | 0 |
| `ui/consulta/ConsultaPersistida.tsx` | 527 | 21/7 | 182 | 10/5/8 | 0 |
| `ui/consulta/EditorPrescricaoExecutavel.tsx` | 680 | 5/4 | 154 | 2/4/5 | 0 |

Método lexical auxiliar: linhas por separação CRLF/LF; imports pela forma `import` e `import type`; decisões por `if/switch/case/catch/for/while/??/&&/||`; hooks por chamada; SQL por `.prepare(`. Esta contagem superestima decisões em expressões e não substitui AST.

Método AST canônico reproduzível: `rolldown/parseAst` 1.2.12 sobre os bytes obtidos por `git show f34636c:<caminho>`, sem ler WIP. Para cada função nomeada, o script calcula o intervalo `end.line - start.line + 1` e percorre os nós de decisão definidos pelo medidor; buscas globais também partem da árvore de `git ls-tree -r --name-only f34636c`.

Resultados exatos do plano:

- `rotearExtracaoERevisao`: 755 linhas / 376 pontos de decisão.
- `rotear`: 362 / 212.
- `rotearPrescricaoFlashConfig`: 319 / 130.
- `lerConsulta`: 321 / 96.
- `rotearSalaoECanal`: 295 / 87.
- `executarEnvioAutorizadoCanal`: 15 pontos de decisão.
- 555 arquivos `.ts`/`.tsx`.
- 48 ocorrências de `consultaSelecionada`.
- 10 arquivos com decisão própria de `REPLAY`.
- 20 componentes com contador de geração.
- Comparações de contexto: 109 linhas em 36 arquivos pela busca textual validada; 129 cadeias AST em 39 arquivos pelo medidor estrutural.

G2 deve conservar esse medidor e sua definição de nós para a comparação “depois”; números lexicais e AST não podem ser misturados.

## 8. Caracterização de G1

A medição correta da #46 é o diff de três pontos `git diff main...56ec76f`, cujo merge-base é `3b2b1d90c5167551c27913509e5a8d5b5ecf13d8`. Ele contém **59 arquivos**, não 85. `extracaoRevisao.ts`, `relatos-canal.css` e `triagemNutricional-consulta.test.ts` não são tocados pela #46.

Os nove caminhos realmente compartilhados entre #46 e #48 são:

- `src/contracts/api/porta.ts`
- `src/contracts/api/saidasHttp.ts`
- `src/kernel/ledger/writeRouter.ts`
- `src/server/rotas.ts`
- `src/server/rotas/catalogo.ts`
- `src/ui/OncoassistLocal.tsx`
- `src/ui/api/http.ts`
- `tests/server/contratos-saida.test.ts`
- `tests/server/fixtures/rotas-baseline.json`

Conflitos reproduzidos por `merge-tree`:

- #46 sobre #48: quatro blocos textuais distribuídos entre `saidasHttp.ts`, `rotas.ts` e `contratos-saida.test.ts`, incluindo a matriz de 89 rotas; há ainda conflito semântico de `listarEventos`/`dadosDoEvento` em `rotas.ts`.
- #47 sobre #48: um conflito em `src/ui/OncoassistLocal.tsx`.
- #46 contra #47: dois conflitos em `src/ui/OncoassistLocal.tsx`.

#47 sobre #48 compartilha somente `src/ui/OncoassistLocal.tsx`; seus outros seis caminhos são `RevisaoClinica.tsx`, `consulta-local.css`, `PainelCombinacoes21st.tsx`, `combinacoes21st.ts`, `dialogoAcessivel.ts` e `tests/ui/combinacoes-21st.test.tsx`.

Percursos afetados:

- #46: assinatura de documentos selecionados, recuperação segura de confirmações, sessão/contexto, funil de escrita, canal, APAC, prescrição, leituras e UI HTTP.
- #47: filtros de revisão, diálogos acessíveis, impressão, subseções, temas e foco por teclado.
- #48: harness/quatro pilares, extração cognitiva, conhecimento curado, voz e PubMed.

G1 preservará #48/#45 como base funcional, aplicará #47 e depois reconciliará #46 na arquitetura pré-refatoração. Mudança de intenção, não apenas conflito textual, para e exige decisão humana.

## 9. WRITE_SETs fechados G0–G10

Regras comuns: base do lote = ponta aprovada da candidata; um escritor por arquivo; expansão material exige Codex + decisão humana; testes nunca são enfraquecidos; recuperação por `git revert` do commit do lote, nunca reset/clean/stash.

### G0 — preparação

- Dono: Codex. Revisor: Claude.
- Escrita: somente este arquivo.
- Aceite: bases/worktrees/fontes/baseline registrados; parecer Claude; sem alteração no canônico/auditoria/preservação.
- Recuperação: remover/reverter somente este arquivo na branch G0; preservar as três worktrees.

### G1 — base candidata

- Dono: Codex; Gemini somente em fatias transferidas. Revisor: Claude.
- G1 aplica o **patch** da #46 por merge/cherry-pick a partir do merge-base `3b2b1d9`; nunca substitui arquivos pela árvore antiga da branch, pois `main`/#48 avançaram nesses caminhos.
- WRITE_SET nominal dos 59 caminhos da #46:
  - `demonstracao.html`
  - `docs/DECISOES.md`
  - `src/contracts/api/porta.ts`
  - `src/contracts/api/recuperacaoConfirmacao.ts`
  - `src/contracts/api/respostas.ts`
  - `src/contracts/api/saidasHttp.ts`
  - `src/kernel/comandos/portas.ts`
  - `src/kernel/ledger/cancelamentoConfirmacao.ts`
  - `src/kernel/ledger/schema.ts`
  - `src/kernel/ledger/writeRouter.ts`
  - `src/kernel/llm/openai/index.ts`
  - `src/kernel/orquestracao/runtime.ts`
  - `src/rules/conteudoCanonico.ts`
  - `src/server/alertasConsulta.ts`
  - `src/server/apacRascunho.ts`
  - `src/server/f0c/avaliacaoConsulta.ts`
  - `src/server/fichasPrescricao.ts`
  - `src/server/leituras.ts`
  - `src/server/medicamentos.ts`
  - `src/server/origemFichaPrescricao.ts`
  - `src/server/prescricaoExecutavel.ts`
  - `src/server/rotas.ts`
  - `src/server/rotas/catalogo.ts`
  - `src/ui/App.tsx`
  - `src/ui/DemonstracaoApp.tsx`
  - `src/ui/OncoassistLocal.tsx`
  - `src/ui/api/confirmacoesPendentes.ts`
  - `src/ui/api/http.ts`
  - `src/ui/consulta/ConsultaPersistida.tsx`
  - `src/ui/consulta/DitadoDeepgram.tsx`
  - `src/ui/consulta/ReconciliarMedicamentos.tsx`
  - `src/ui/consulta/RecuperarConfirmacoes.tsx`
  - `src/ui/copy/pt-BR.ts`
  - `src/ui/main-demonstracao.tsx`
  - `tests/f0c/avaliacao-adversarial.test.ts`
  - `tests/f1/s11/openai.test.ts`
  - `tests/f1/s12/browser-canal.js`
  - `tests/f1/s5b/medicamentos-http-ui.test.tsx`
  - `tests/f1/s5b/medicamentos-ui.test.tsx`
  - `tests/f1/s5b/medicamentos.test.ts`
  - `tests/f1/s5b/runtime.test.ts`
  - `tests/f1/s8/invalidacao-fatos.test.tsx`
  - `tests/ledger/ledger.test.ts`
  - `tests/server/adv012-hash.test.ts`
  - `tests/server/apac-rascunho-http.test.ts`
  - `tests/server/auditoria-main-alertas.test.ts`
  - `tests/server/contratos-saida.test.ts`
  - `tests/server/fixtures/rotas-baseline.json`
  - `tests/server/prescricao-executavel-http.test.ts`
  - `tests/ui/app.test.tsx`
  - `tests/ui/recuperacao-confirmacoes.test.tsx`
  - `tests/w10-cursor/config.test.tsx`
  - `tests/w10-cursor/header.test.tsx`
  - `tests/w10-cursor/layout.test.tsx`
  - `tests/w10-cursor/painel.test.tsx`
  - `tests/w10-cursor/percursos.test.tsx`
  - `tests/w10-cursor/salao-qt.test.tsx`
  - `tests/w12-f4/ui-flash-fechamento.test.tsx`
  - `vite.config.ts`
- Somam-se os sete caminhos da #47 já caracterizados e este documento de execução.
- Cruzamento com G3, a preservar e reavaliar após integração: tabelas `confirmation_cancel` e `confirmation_rules` em `src/kernel/ledger/schema.ts`, `src/kernel/ledger/cancelamentoConfirmacao.ts` e a semântica de `Date` em `src/rules/conteudoCanonico.ts`.
- Reservado: `AGENTS.md`, preservação, auditoria e WIP.
- Aceite: requisitos #45–#48 preservados; itens #47-7/#47-8 corrigidos; itens #45-14/#45-15 atribuídos a G3; `verify`, `verify:f1`, `test:b2`.
- Recuperação: commits de integração separados (#48, #47, #46) e reversíveis.

### G2 — caracterização

- Dono: Gemini Argon. Revisor: Claude. Gate: Codex.
- Escrita: `tests/server/contratos-saida.test.ts`, `tests/server/fixtures/rotas-baseline.json`, testes HTTP novos de pós-processamento, `tests/ledger/*` novos para ADV-01/02 e fixture legada, testes de canal estritamente necessários, este registro.
- Produto proibido.
- Aceite: testes caracterizam comportamento e falham sob mutação manual; inventários e métricas completos.
- Recuperação: revert dos commits `test(caracterizacao)`.

### G3 — integridade das operações

- Dono: Gemini Argon. Revisor/corretor: Claude. Gate: Codex.
- Escrita: `src/kernel/ledger/{writeRouter,ledger,idempotencia,db}.ts`, `src/kernel/gateway/{gateway,writerClinico}.ts`, `src/kernel/comandos/index.ts`, `src/server/{estadoDoenca,sessao}.ts`, `src/server/rotas/{confirmacao,extracaoRevisao,salaoCanal}.ts`, `src/contracts/f1/dutos.ts`, `src/modules/tipos.ts`, `src/rules/conteudoCanonico.ts`, chamadores de escrita clínica E1 (`prescricaoExecutavel.ts`, `apacRascunho.ts`) e testes correspondentes.
- Aceite: replay legítimo, conflito de hash, legado, contexto e concorrência provados.
- Recuperação: subcommits G3a/G3b/G3c/G3e/G3f; reverter a subentrega falha.

### G4 — jornadas assíncronas

- Dono transferido a Claude em paralelo com G3. Revisor do código de Claude: Codex.
- Escrita inicial: `tests/f1/s8/{revisao-atualiza-consulta,invalidacao-fatos}.test.tsx`, `tests/f1/s9/receita-ui-http.test.tsx`, `tests/ui-telas/{prescricao-executavel-http,relatos-navegacao}.test.tsx` e fixtures diretas. `tests/f0-fecha/phi-repo.test.ts`/scanner somente se medição CI exigir.
- Produto só após diagnóstico e adendo nominal de WRITE_SET.
- Aceite: 3 runs do shard oficial verdes; nenhuma asserção/timeout afrouxado.
- Recuperação: revert por ocorrência diagnosticada.

### G5 — servidor

- Dono: Gemini Argon. Revisor/corretor: Claude. Gate: Codex.
- Escrita existente: `src/server/{rotas,http,leituras}.ts`, `src/server/rotas/{catalogo,extracaoRevisao,salaoCanal,prescricaoFlash}.ts`, `src/contracts/api/saidasHttp.ts`; consumidores de `ServidorDeps`: `canalWebhookHttp.ts`, `estadoDoenca.ts`, `extracaoLlm.ts`, `oncoassistPropostas.ts`, `salaoContingencia.ts`, `skillsClinicas.ts`, `upload.ts`, `rotas/cognitivo.ts`, `rotas/confirmacao.ts`, `rotas/extracaoRevisao.ts`, `rotas/prescricaoFlash.ts`, `rotas/salaoCanal.ts`. `http.ts` já está no conjunto principal e não é contado novamente entre consumidores.
- Novos autorizados: `src/server/dependencias.ts`, `src/server/transporte/{json,resposta}.ts`, `src/server/rotas/{contextoConsulta,consulta,acoesExternas,leiturasOperacionais,configuracao}.ts`, `src/server/rotas/extracao/{reconciliar,fontes,extrair,rascunho,revisar}.ts`, `src/server/leituras/{consulta,operacionais}.ts`.
- A1: extrair de `prescricaoFlash.ts:194–237` as cinco rotas `lerPerfil`, `salvarPerfil`, `lerCaixa`, `alterarCaixa` e `historicoConfig` para `src/server/rotas/configuracao.ts`, preservando `autorizacaoMedica: true` de L231.
- Testes: contratos de saída, baseline, identidade, leitura, revisão e canal pertinentes.
- Aceite: catálogo único tipado; sem SQL de domínio em `rotas.ts`; vínculo de paciente de `extracaoRevisao.ts:512–657` em transação única, com teste de falha forçada entre a confirmação e o último draft; cinco rotas de configuração extraídas sem alterar autorização; fronteiras sem exceção nova.
- Recuperação: um arquivo-alvo por commit estrutural; quebra implica revert do commit.

### G6 — canal e recuperação

- Dono: Gemini Argon. Revisor/corretor: Claude. Gate: Codex.
- Escrita: `src/server/{canalEntrada,canalResposta,canalReconciliacao,canalOperacao,extracaoLlm}.ts`, `src/kernel/llm/openai/runtime.ts`, testes de canal/runtime/restart/persistência.
- Novos autorizados somente se a extração reduzir risco demonstrado: `src/server/canal/{schema,entradaWebhook,entradaImap,consentimento,consultas,persistenciaEntrada,respostaEstado,persistenciaResposta}.ts`.
- `executarEnvioAutorizadoCanal` e as três revalidações não podem ser divididos sem defeito demonstrado.
- Aceite: checkpoint, consentimento, autorização, destinatário, recibo e `OUTCOME_UNKNOWN` preservados.
- Recuperação: revert por extração; schema aditivo sem migração destrutiva.

### G7 — estado da consulta e prescrição UI

- Dono: Gemini Argon. Revisor/corretor: Claude. Gate: Codex.
- Escrita: `src/ui/OncoassistLocal.tsx`, `src/ui/consulta/{ConsultaPersistida,EditorPrescricaoExecutavel}.tsx`, `src/ui/api/porta.ts` se necessário, testes s8/prescrição/navegação.
- Novos autorizados: `src/ui/consulta/{useContextoConsulta,useConsultaPersistida,usePrescricaoExecutavel,useAcoesCompostas,modeloEditorPrescricao,estadoEditorPrescricao}.ts`.
- Aceite: chave de contexto + geração + AbortSignal únicos; resposta tardia descartada; prévia/assinatura coerentes.
- Recuperação: migração por componente, com fachada temporária removida ao final.

### G8 — revisão de menções

- Dono: Gemini Argon. Revisor/corretor: Claude. Integração: Codex.
- Fonte somente leitura: worktree `codex-revisao-mencoes-20261020`.
- Escrita: `src/contracts/api/revisaoMencaoCanal.ts`, `src/contracts/canalRevisaoCanonica.ts`, `src/contracts/w10/extracao.ts`, `src/kernel/extracao/{prepararRevisao,revisaoMencaoCanal}.ts`, `src/server/{upload,fonteRevisaoMencaoCanal}.ts`, módulos HTTP/persistência G5 estritamente necessários, `src/ui/consulta/{RevisaoMencaoCanal.tsx,revisao-mencao-canal.css}`, integração na tela principal e os 5 testes preservados do WIP.
- Aceite: fonte→revisão→confirmação→persistência→reabertura; contexto/fonte revogada recusados; relato não vira fato.
- Recuperação: porte seletivo por requisito; nunca snapshot integral.

### G9 — acervo documental

- Dono: Gemini Argon. Revisor/corretor de contrato: Claude. Integração: Codex.
- Fonte somente leitura: `codex-f1-acervo-f2-inicio` e três anexos.
- Escrita: `src/contracts/acervoBiblioteca.ts`, `src/kernel/corpus/{acervoPublicoPins,biblioteca}.ts`, `src/server/biblioteca.ts`, `src/contracts/api/biblioteca.ts`, `src/ui/api/biblioteca.ts`, `src/ui/biblioteca/{BibliotecaLocal.tsx,biblioteca.css}`, `scripts/{acervo-classificacao.json,converter-biblioteca.mjs,converter-biblioteca.d.mts}`, testes `tests/f1/s3/acervo-*.test.ts`, `converter-acervo-documental.test.ts`, `biblioteca-ui.test.tsx`, `tests/f1/s12/{browser-acervo.js,browser-b2.js}`, e integração mínima serial em `rotas/catalogo.ts`, `saidasHttp.ts`, `rotas-baseline.json`.
- Origem dos quatro ausentes: os três primeiros vêm do WIP `w098`; `tests/f1/s12/browser-acervo.js` é **A CRIAR**.
- Reservados: `corpus/**`, canal F2 antigo, harness, LLM, cognitivo, backup, dependências.
- Aceite: múltiplos pacotes, sem gzip, limites 24.000.000/8.000.000, N−1/N/N+1, pins por bytes sem aprovação, isolamento cognitivo e restore.
- Recuperação: ativação append-only/rollback; revert do lote sem apagar pacotes históricos.

### G10 — fechamento global

- Dono dos registros e integração: Codex; Gemini fornece relatório; Claude corrige documentação atribuída.
- Escrita: este registro, novo relatório final em `docs/planejamento/`, e README somente para OG-012 após aprovação específica. `AGENTS.md` não integra o WRITE_SET.
- Código adicional proibido sem novo requisito aprovado.
- Aceite: reconciliação por requisito, validação global no SHA candidato, métricas antes/depois, revisões independentes e pendências clínicas separadas.
- Recuperação: revert documental; candidato permanece preservado até decisão do Dr. Silas.

## 10. Gates e pendências

- **G0 aprovado:** Claude registrou `APROVADO COM COMPLEMENTOS` e `APROVAR G0`; os 12 complementos foram incorporados neste documento e seu commit fecha o lote.
- G1 começa com os itens presentes já atribuídos: #47-7/#47-8 pertencem a G1; #45-14/#45-15 pertencem a G3.
- G3e exige decisão humana sobre lote em salão/contingência/resposta de canal.
- G4 termina antes de G7; a transferência a Claude está registrada acima.
- `tests/f1/s8/revisao-atualiza-consulta.test.tsx` permanece sob acompanhamento explícito em G4 (diagnóstico/reprodução) e G7 (estado assíncrono da UI); não é tratado por aumento cego de timeout.
- G8 exige E1, E2, E3 e E5 aprovados.
- G9 exige E4 aprovado.
- Tela duplicada `TelaConsulta.tsx`: manter/congelar/aposentar continua decisão do Dr. Silas.
- C01–C07 permanecem `NAO_MAPEADO`.

## Parecer independente de Claude

**APROVADO COM COMPLEMENTOS — APROVAR G0.** Parecer independente recebido em 2026-10-23 sobre a base `f34636c` e este registro. Condição do parecer: incorporar e comitar os 12 adendos relativos a autoridade, diffs/conflitos G1, WRITE_SET nominal, triagem #45/#47, E1/E2/D1, transações, G5/A1, método AST, hashes e gates. Todos estão incorporados nesta versão. A revisão pertence a Claude; Codex apenas integrou os complementos e fecha G0 por commit.
