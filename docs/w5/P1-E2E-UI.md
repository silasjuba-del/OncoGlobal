# P1 E2E-UI — leitura semântica e fechamento da trilha

Inventário: `w5-e2e`, branch `f0/w5-e2e`, HEAD inicial `450ee8f86dba0fd3cb61516db6366fd3a5d5f934`, árvore limpa. Após confirmar ancestralidade, fast-forward para integrado `3c65d73`; nenhuma redefinição de branch ou descarte de WIP. Escopo escrito: somente `tests/e2e/pipeline.test.tsx`, com reserva `COB-F4-HTTP` via `claim.ps1`.

Leitura de W5, cabeçalho W2, Parte 0 normativa e consumidores. `PARCIAL` significa que há provas executáveis de partes do requisito, mas a ligação ou o comportamento completo descrito abaixo continua ausente. Não equivale a liberação clínica.

| ID | implementation | test | estado | evidencia |
|---|---|---|---|---|
| G-06 | `src/ui/consulta/BannerE1.tsx`, `src/modules/documentos/render.ts`, `corpus/templates/folha-operacional-salao.v1.json` | `tests/ui/banner-e1.test.tsx`, `tests/corpus/k12-folha-operacional-cob.test.ts`, `tests/modules/adv015-template.test.ts` | PARCIAL | Banner não dispensável é testado; folha operacional permite ALERTA, evolução o filtra. Não existe gate G-06 que obrigue destaque E1 na folha renderizada. App não compõe consulta com banner. K-12 altera a interpretação do G-06 da seção R-15: emergência na folha operacional, distinta da evolução. |
| G-28 | `src/ui/tema/ThemeProvider.tsx`, `src/ui/tema/tokens.css`, `src/ui/tema/temas.ts` | `tests/ui/tema.test.tsx` | PARCIAL | Teste compara texto/role/aria em dois temas e diferencia PENDENTE de VERDE. `SuperficieEstavel` é fixture de teste; não é consulta real composta com componentes de domínio. Não prova troca de layout/contexto no app. |
| INV-08 | `src/kernel/ledger/drafts.ts`, `src/ui/consulta/BarraFechamento.tsx` | `tests/ledger/ledger.test.ts` (N07, edição stale), `tests/ui/fechamento.test.tsx` | PARCIAL | Draft inerte recupera ao reabrir; edição stale cria draft conflitante sem perder versões. Validar continua disponível com alerta. Nenhuma tela de salvar/aplicar está montada em App; não há teste de salvar sob todos os gates ou contingência clínica. |
| INV-09 | `src/contracts/operacao.ts` (Alerta.destino CHAT), `src/modules/documentos/render.ts`, templates | `tests/contracts/contratos.test.ts`, `tests/modules/adv015-template.test.ts`, `tests/corpus/k12-folha-operacional-cob.test.ts` | PARCIAL | Contrato restringe destino; render filtra origem ALERTA/CORRECAO_IA nos documentos clínicos. Evidência se limita ao tipo, corpus e função; consumidor chat e percurso da evolução impressa não estão ligados ao App. |
| INV-17 | `src/contracts/operacao.ts` (authorityOverride literal false), `src/ui/consulta/BannerE1.tsx` | `tests/contracts/contratos.test.ts` (authorityOverride nunca true), `tests/ui/banner-e1.test.tsx` | PARCIAL | Override de autoridade é rejeitado pelo schema; presentationOverride mostra banner, reconhecer não o remove. Não há percurso composto E1 → confirmação/saída para provar toda a invariância de autoridade. |
| INV-18 | `src/kernel/harness/gates.ts`, `src/modules/documentos/render.ts`, `src/kernel/ledger/drafts.ts` | `tests/kernel/kernel.test.ts`, `tests/modules/adv015-template.test.ts`, `tests/ledger/ledger.test.ts` | PARCIAL | Gates distinguem saída/artefato/autoridade; render preserva resultado vazio com pendências; draft é independente da promoção. Não há consumidor global que demonstre falha de artefato preservando percurso do paciente. |
| K-12 | `src/ui/consulta/BannerE1.tsx`, `src/contracts/operacao.ts`, render e templates | `tests/ui/banner-e1.test.tsx`, `tests/corpus/k12-folha-operacional-cob.test.ts`, `tests/modules/adv015-template.test.ts` | PARCIAL | Separação declarativa e filtro de origem são testados; banner não fecha. Chat, folha operacional obrigatória com emergência ativa e impressão da evolução ainda não têm percurso composto. |
| K-14 | `src/ui/consulta/BarraFechamento.tsx`, `src/ui/consulta/BannerE1.tsx`, `src/modules/consulta/fechamento.ts`, `src/server/rotas.ts` | `tests/ui/fechamento.test.tsx`, `tests/ui/banner-e1.test.tsx`, `tests/modules/fechamento.test.ts` | PARCIAL | Validar habilitado com vermelho envia reconhecerAlertas, sem impressão; banner registra horário em state/callback e permanece. A rota confirmar recebe reconhecerAlertas mas não grava reconhecidoEm no ledger. Sem prova de persistência de ciente após reabrir. |
| K-16 | `src/modules/consulta/preConsulta.ts` (contatos recebidos no snapshot), `src/ui/consulta/PainelDelta.tsx` | `tests/modules/preConsulta.test.ts`, `tests/ui/delta.test.tsx` | PARCIAL | Seção contatos e render de delta têm provas; pré-consulta recebe contatos já montados. Não lê canal antes do snapshot; não há teste da ordem leitura canal → snapshot nem atualização seletiva por mensagem posterior. |
| K-22 | `src/server/http.ts`, `src/server/rotas.ts`, `src/contracts/base.ts` (rawRef), `src/orchestration/ork.ts` | `tests/server/server.test.ts` (N18), `tests/server/bundle.test.ts`, `tests/orchestration/ork.test.ts` | PARCIAL | Logs usam lista positiva rota/codigo/status, corpo/erro sintético não vaza; ORK ignora resultado após timeout. Isso não prova descarte ao trocar paciente. Cache patientId+lote+versão e nome opaco no armazenamento real não têm consumidor montado na UI. |
| N12 | `src/ui/consulta/BannerE1.tsx`, render e folha operacional | `tests/ui/banner-e1.test.tsx`, `tests/corpus/k12-folha-operacional-cob.test.ts`, `tests/modules/adv015-template.test.ts` | PARCIAL | Partes banner, política de folha operacional e exclusão de ALERTA na evolução possuem testes. Não existe ensaio único E1 ativo + render evolução/folha + saída; impressão física NOT_RUN. |
| N26 | `src/ui/tema/ThemeProvider.tsx`, temas e tokens | `tests/ui/tema.test.tsx` | PARCIAL | Mesma limitação G-28: equivalência semântica em fixture estática, sem consulta real ou troca de paciente/layout. |
| F4 | caixa/maestro/ORK, ledger/projeção, pré-consulta/bundle/render, `src/server/rotas.ts`, `src/ui/consulta/BarraFechamento.tsx`, gateway | `tests/e2e/pipeline.test.tsx`, `tests/orchestration/ork.test.ts` | PARCIAL | E2E sintético exercita revisão HTTP, ledger, delta, documentos devolvidos por /consulta/bundle, confirmar e gateway fake. App ainda é scaffold; classificador/extrator são injetados, snapshotParaPack é adaptador exclusivo de teste. Duas revisões de fatos sem documento preparam contexto via registrarBundleExibido direto: não substituem rota HTTP. Impressão usa executor fake e não resolve ADV-006/CP-001. |

## Alteração limitada da prova F4

Fase documental agora usa `/consulta/bundle` sobre draft de documento no ledger, confere documento/conteúdo/hash retornados pelo servidor e monta o escopo visível da `BarraFechamento` a partir dessa resposta. Confirmação registra assinatura do ator servidor; o clique validar mantém contador de impressão zero; clique imprimir executa fake uma vez e replay não repete. Sem mudança de servidor, contratos, app ou regras clínicas.

As junções de extração e `CaseSnapshot → SnapshotConfirmado` seguem exclusivas do teste. A fase de fatos sem documento continua com contexto vazio preparado diretamente, declarado em comentário. O enunciado F4 designa a família de ataque W5, não a fase F4 do roadmap.

## Reconciliação de claims históricos

Leitura do `CLAIMS.md` canônico no ORQ mostrou todas as reservas E2E-UI históricas já liberadas. Verificados objetos Git, ancestralidade até HEAD e igualdade de blobs no inventário pré-edição:

| Arquivo | Commit de liberação comprovado | Resultado |
|---|---|---|
| `tests/e2e/infra.test.ts` | `631e1b00a2402e6a0860117bad146c965b751348` | ancestral + blob igual |
| `tests/e2e/fixtures/vite.config.ts` | `631e1b00a2402e6a0860117bad146c965b751348` | ancestral + blob igual |
| `tests/e2e/fixtures/tests/adv/probe.test.ts` | `631e1b00a2402e6a0860117bad146c965b751348` | ancestral + blob igual |
| `vite.config.ts` | `129ad1a9c021484cbb8c3f6f66d16cc0ca59c241` | ancestral + blob igual; atualiza INFRA-01 anterior `631e1b0` |
| `tests/e2e/pipeline.test.tsx` | `450ee8f86dba0fd3cb61516db6366fd3a5d5f934` | ancestral + blob igual; evolui COB-F4 `ba76bbe8da459f824fc62c83407d6a4259b45cbb` |

Nenhum claim histórico E2E órfão; nenhuma liberação adicional era necessária. Reserva nova liberada via `claim.ps1` com commit comprovado `e5977aaa4b29c7e65f676829809340fa7061df7d`; árvore limpa após commit. Claim histórico não foi reaberto nem recebido como WIP vivo.

## Evidência desta retomada

- Targeted UI + pipeline: PASS, 11 arquivos/29 testes, exit 0, log `_w5-locks/logs/20261005-231947-E2E-UI.log`.
- Verify completo: PASS, typecheck + fronteiras (80 arquivos) + corpus (20 arquivos) + 78 arquivos/440 testes, exit 0, log `_w5-locks/logs/20261005-232118-E2E-UI.log`. Serial garantido por configuração Vitest `fileParallelism: false`, `maxWorkers: 1` e lock E2E-UI.
- Commit entregue: `e5977aaa4b29c7e65f676829809340fa7061df7d` (base `3c65d73f34b6d158da7a471424ec1b4b8051173f`). Arquivo único: `tests/e2e/pipeline.test.tsx` (+22/-8). Integração e verify no HEAD integrado dependem do ORQ; evidência acima é da trilha E2E-UI.
- Impressão física: NOT_RUN; ligação app/UI completa: não implementada; autoridade documental de impressão CP-001 continua pendente do dono canônico.
