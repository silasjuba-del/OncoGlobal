# W10 · Progresso FUGU

Worktree `w10-fugu`, branch `f0/w10-fugu`; base no início `d2af9e7`. Apenas dados sintéticos. Retomar da primeira fatia não FEITA; mesclar `f0/w1-integrado` antes de começar cada fatia.

Retomada de 2026-10-07: `git merge f0/w1-integrado` (fast-forward `fe4f459 → 0d84302`), `npm ci --offline` (100 pacotes, 0 vulnerabilidades) e leitura de `docs/w10/RESPOSTAS-TECH-LEAD.md`.

| Fatia | Estado | Commit | Evidência / pendência |
|---|---|---|---|
| FUGU-01 · Tipos e esqueleto | FEITA | `W10-FUGU-01` | Nove etapas puras, 5 testes novos; tipos provisórios trocados depois na FUGU-02R |
| FUGU-02 · Conversão local | **FEITA** | `W10-FUGU-02` + FUGU-02R | Texto/DOCX locais e **PDF digital por pdfjs-dist**; escaneado/imagem seguem PENDENTE (D-W9-09); 5 + 7 testes |
| FUGU-02R · Contratos W10 | FEITA | commit desta retomada | Zero `PROVISORIO-W10`; `PhysicianConfirmation` exige `ReviewAction` CONFIRMAR persistida |
| FUGU-03 · Segmentação | FEITA | `W10-FUGU-03` | 4 testes: maratona de 3 pacientes, fronteira incerta, pausa longa, acompanhante; sem vínculo automático |
| FUGU-04 · PatientResolver | FEITA | `W10-FUGU-04` | Ranking por pesos, razões, homônimos por cadastro e nome zerado em Plaud; 4 testes, nunca AUTO_MERGE |
| FUGU-05 · Extrator | FEITA (dublê sintético) | `W10-FUGU-05` | Porta síncrona + regex determinísticas, 7 testes; PT07–PT10, negação, números falados; sem LLM/autoridade clínica |
| FUGU-06 · Normalização | FEITA | commit desta retomada | Unidades/°C com `tempDecimos`, data civil −03:00, lateralidade D-W9-05, sítio canônico, fármaco fonético, TNM AJCC 8/9; 12 testes |
| FUGU-07 · Reconciliação | FEITA | commit desta retomada | `ReconciledField` por campo com hierarquia §4, conflito visível, tratamento em 5 estados, 8 detectores de conflito (G-07 chamado por interface); 13 testes |
| FUGU-08 · SafetyValidator | FEITA | commit desta retomada | 7 invariantes como código; promoção ilegal rejeitada com motivo; 9 testes adversariais |
| FUGU-09 · Caixa de revisão | FEITA | commit desta retomada | `CaixaRevisao` + resumo da spec §10 + `ReviewAction` → rascunho de evento do ledger; 8 testes |
| FUGU-10 · Timeline | FEITA | commit desta retomada | Projeção do Anexo A validada pelo contrato W10; `stageHistory` imutável, metastático monotônico; 5 testes |
| FUGU-11 · Radiologia e biomarcadores | FEITA (porta) | commit desta retomada | Séries por sítio + porta `RegraProgressao` (dublê de D-W9-43) + engine de biomarcadores em tabela de dados; 13 testes |
| FUGU-12 · E2E e fechamento | FEITA | commit desta retomada | PT10 ponta a ponta (INTERVAL_PROGRESSION L5 + NÃO SEI de histologia/TNM/RE-RP-HER2) e maratona com "creatinina quatorze"; 4 testes |
| FUGU-12B · Interfaces e reataque adversarial | FEITA | commit desta retomada | Evento de revisão gravado no ledger real (GRAVADA/REPLAY/NEGADA), timeline→seções da tela, 7 testes adversariais e correção de campo eleito sem valor; 23 arquivos / 138 testes |

**Granularidade de commit (desvio registrado):** as fatias FUGU-02R e FUGU-06 a FUGU-11 foram integradas em **um único commit**. Motivo: a troca dos contratos W10 muda o tipo de `Exception`→`ReviewException` e de `ReconciledField`, o que quebra `src/orchestration/pipeline-extracao.ts`; e o pipeline final chama os módulos das seis fatias. Commits intermediários por fatia não compilariam sem manter versões-stub do pipeline. FUGU-12 saiu em commit próprio.

## Saídas reais · FUGU-01 (comandos em série)

`npx tsc --noEmit` — exit 0, sem diagnósticos (após `npm ci --offline --ignore-scripts --no-audit --no-fund`; o primeiro `npx tsc` falhou porque ainda não havia `@types/node` neste worktree).

```text
> oncoglobal@0.0.1 check:boundaries
> node scripts/check-boundaries.mjs
fronteiras ok (138 arquivos)

> oncoglobal@0.0.1 check:corpus
> node scripts/validate-corpus.mjs
corpus ok (29 arquivos)

RUN  v5.0.3 C:/Users/silas/Projects/OncoGlobal-wt/w10-fugu
Test Files  7 passed (7)
Tests  30 passed (30)
```

## Saídas reais · FUGU-02 (comandos em série)

Primeira execução dos testes direcionados: **1 FAIL/34 PASS** por expectativa equivocada do teste sobre a fixture (rótulo `PACIENTE TESTE 07` em maiúsculas e rasuras). A lógica foi corrigida para deixar o documento com `[RISCADO]` em PENDENTE.

`npx tsc --noEmit` — exit 0. `check:boundaries` — `fronteiras ok (139 arquivos)`; `check:corpus` — `corpus ok (29 arquivos)`; suíte direcionada `8 passed (8) / 35 passed (35)`.

`npx vitest run --config tests/adv-w8/vitest.config.ts --no-file-parallelism`: **exit 1; 9 arquivos falharam; 10 testes FAIL/31 PASS** (`SEM_IMPLEMENTACAO`). Nenhum teste `.adv.ts` tornou-se verde. Não confundir suíte regular verde com adversarial aprovado.

## Saídas reais · FUGU-03 · FUGU-04 · FUGU-05

```text
FUGU-03: tsc exit 0 · fronteiras ok (140 arquivos) · corpus ok (29 arquivos)
         Test Files  9 passed (9) · Tests  39 passed (39)
FUGU-04: tsc exit 0 · fronteiras ok (141 arquivos) · corpus ok (29 arquivos)
         Test Files 10 passed (10) · Tests  43 passed (43)
FUGU-05: tsc exit 0 · fronteiras ok (142 arquivos) · corpus ok (29 arquivos)
         Test Files 11 passed (11) · Tests  50 passed (50)
```
Em todas: `npx vitest run tests/w3/auditoria-regressao.test.ts --no-file-parallelism` — `1 passed (1) / 9 passed (9)`.

## Saídas reais · FUGU-02R + FUGU-06 a FUGU-11 (retomada de 2026-10-07)

Retomada com `git merge f0/w1-integrado` (fast-forward; 53 commits, 176 arquivos) e `npm ci --offline` (`added 100 packages, and audited 101 packages in 2m` / `found 0 vulnerabilities`). `pdfjs-dist` 6.4.299 presente em `node_modules/pdfjs-dist/legacy/build/pdf.mjs`.

O que mudou de contrato:
- `src/kernel/extracao/tipos.ts` reexporta `src/contracts/w10/extracao.js`; `PhysicianConfirmation` agora é `{ acao: ReviewAction, decisionEventId }` e exige `CONFIRMAR`.
- `pipeline-extracao.ts` devolve `conflitos`, `rejeitados`, `violacoes`, `caixaRevisao`, `series`, `timelines` e `timeline` (projeção do primeiro paciente ligado por decisão persistida).

Falhas intermediárias corrigidas antes da rodada final (registradas para auditoria):
1. `TS2820` — alias de unidade `/mm³` apontando para valor fora de `UnidadeCanonica`.
2. `TS2353` — `isEvalSupported` não existe em `DocumentInitParameters` do pdfjs 6; trocado por `useWasm: false` (mesma intenção: nada de rede).
3. `TS2353` — teste da FUGU-01 ainda usava `{ medicoId, decisionEventId }`; atualizado para `ReviewAction`.
4. BOM UTF-8 acidental em 13 arquivos escritos no Windows; removido (o repo não usa BOM).
5. Testes do PDF falharam com "Invalid PDF structure": o `getDocument` do pdfjs não aceita o `ArrayBuffer` compartilhado do pool do Node; `lerPdfDigital` passou a copiar para um `Uint8Array` próprio.

```text
> oncoglobal@0.0.1 check:boundaries
> node scripts/check-boundaries.mjs
fronteiras ok (183 arquivos)

> oncoglobal@0.0.1 check:corpus
> node scripts/validate-corpus.mjs
corpus ok (102 arquivos)

npx tsc --noEmit — exit 0, sem diagnósticos

RUN  v5.0.3 C:/Users/silas/Projects/OncoGlobal-wt/w10-fugu
Test Files  20 passed (20)
Tests  121 passed (121)

RUN  v5.0.3 C:/Users/silas/Projects/OncoGlobal-wt/w10-fugu
Test Files  1 passed (1)
Tests  9 passed (9)
```

Comando: `npx vitest run tests/kernel/extracao tests/projections tests/orchestration tests/leitura tests/w10-fugu --no-file-parallelism`, seguido de `npx vitest run tests/w3/auditoria-regressao.test.ts --no-file-parallelism`.

## Testes criados nesta retomada (71 novos)

| Arquivo | Fatia | Testes |
|---|---|---|
| `tests/leitura/pdf-digital.test.ts` | FUGU-02 | 7 |
| `tests/kernel/extracao/normalizacao.test.ts` | FUGU-06 | 12 |
| `tests/kernel/extracao/reconciliacao.test.ts` | FUGU-07 | 13 |
| `tests/w10-fugu/safety-invariantes.test.ts` | FUGU-08 | 9 |
| `tests/w10-fugu/caixa-revisao.test.ts` | FUGU-09 | 8 |
| `tests/projections/timeline-paciente.test.ts` | FUGU-10 | 5 |
| `tests/projections/radiologia.test.ts` | FUGU-11a | 8 |
| `tests/kernel/extracao/biomarcadores.test.ts` | FUGU-11b | 5 |
| `tests/w10-fugu/e2e-pt10.test.ts` | FUGU-12 | 4 |

Nenhum teste existente foi enfraquecido. As duas únicas mudanças em teste preexistente: (a) `tests/w10-fugu/pipeline-esqueleto.test.ts` passou a usar `ReviewAction` no lugar do par `{ medicoId, decisionEventId }` — exigência direta da troca de contrato pedida pelo tech lead, com expectativa reforçada (agora também recusa ação diferente de `CONFIRMAR`); (b) nada mais.

## `.adv.ts` W8

Executados na continuação (FUGU-12B): **5 arquivos falharam / 4 passaram; 5 FAIL / 36 PASS**. Nenhum dos 5 vermelhos é da faixa do FUGU — ver a tabela e o alerta de "verde vacuoso" na seção FUGU-12B. A rodada da FUGU-02 (9 arquivos, 10 FAIL/31 PASS) fica como referência histórica; a diferença veio do merge de `f0/w1-integrado`, não desta fatia.

## `[VERIFICAR]` e pontos abertos

- **Nenhum valor clínico novo foi decidido** e nenhum `[VERIFICAR]` foi preenchido em silêncio.
- `[VERIFICAR]` herdados da tabela de biomarcadores: tumores fora de CPNPC adeno IV e mama (`requiredBiomarkers` devolve `[VERIFICAR]` em vez de exigência inventada) — curadoria do Dr. Silas.
- `[VERIFICAR]` de infraestrutura: `tipo` canônico do evento de decisão no ledger (`ReviewDecision` hoje é rascunho do FUGU) — ver `docs/w10/PEDIDOS-FUGU.md`.
- Regra canônica de `INTERVAL_PROGRESSION` (GROK-06) ainda ausente; o FUGU usa a porta + dublê determinístico.

## Limites declarados (não confundir com conclusão)

- O "extrator" continua sendo um **dublê determinístico** limitado aos padrões sintéticos testados; a LLM segue desligada (D-W9-15). Em prosa, o método de imagem pode ser atribuído a uma linha que não é um exame.
- A caixa de revisão, a timeline e a projeção de imagem são **esqueleto local**: não persistem, não assinam, não vinculam paciente sem `ReviewAction` e não liberam nenhuma saída externa.
- Suíte regular verde **não** é auditoria adversarial aprovada nem autorização de integração clínica.

## Saídas reais · FUGU-12B (reataque adversarial e fechamento de interfaces)

Continuidade pedida depois da FUGU-12: fechar do meu lado as duas interfaces que eu havia deixado só como PEDIDO, e **não confundir a linha de base verde com conclusão** (rodar o adversarial antes de dizer "pronto").

### Interfaces entregues na minha faixa

- `src/kernel/extracao/eventoRevisao.ts` — monta `Operation` + `ClinicalEvent` válidos para `gravarOperacao`, sem editar o ledger. O evento nasce com `revisao: "CONFIRMADO"`, `criadoPor.tipo = "SESSAO"` e `payload.reviewDecisionId` (o ledger exige; sem ele responde `REVIEW_DECISION_REQUIRED`). `DESCARTAR` sem motivo e `LIGAR_PACIENTE` sem `patientId` são recusados **antes** de tocar o banco.
- `src/kernel/projections/timelineSecoes.ts` — converte `PatientTimeline` (contrato W10) em `Secao<T>` do próprio `src/modules/tipos.ts`, **sem alterar `src/modules`**. Ausente = PENDENTE; conflito não resolvido = VERMELHO; `recist` vazio é PENDENTE (o cálculo é de `src/rules/recist`).

### Defeito real encontrado pelo reataque (corrigido)

`reconciliarCampo` elegia como resolvido um campo cujo único candidato não tem valor utilizável — por exemplo o laboratório falado ("creatinina quatorze", `value: null`, `normalizado: false`) ou um marcador sem valor. Isso contraria "ausente ≠ valor". Agora `valorNaoResolvivel` barra valor nulo, laboratório não normalizado, string vazia e TNM sem literal: o campo fica `resolvedFactId: null` (ausência), com o conflito preservado quando existe.

### Reataque adversarial W8 (executado, não presumido)

`npx vitest run --config tests/adv-w8/vitest.config.ts --no-file-parallelism` → **5 arquivos falharam / 4 passaram; 5 FAIL / 36 PASS** (a rodada da FUGU-02 tinha 9 arquivos falhando: parte foi fechada pelo merge de `f0/w1-integrado`, **não** por esta fatia). Nenhum dos 5 vermelhos é meu para fechar:

| Achado | Dono / decisão | Situação do FUGU |
|---|---|---|
| `caso07-dedupe` (motor de dedupe de exames em `src/leitura/`) | modules/leitura (W7/W6) + **curadoria clínica da chave** | `BLOQUEADO_DECISAO` — D-W8-01 mantém `dedupe-exame` `ativo:false` até haver consumidor (AG-04) e a chave (laboratório+nº exame+data de entrada) não é minha para decidir. Não implementei |
| `fn16-t34-semaforo-interacoes` (`semaforoInteracoes` em `src/rules`) | GROK | fora da faixa |
| `k26-n17-ficha-inteira` (biblioteca de fichas aprovadas) | equipe interna / `corpus/templates` | fora da faixa |
| `n19-manifesto-merge` (gate de merge por manifesto) | equipe interna / `scripts/` | fora da faixa |
| `t56-g16-owner-write` (`ownership` no harness) | GROK (`src/kernel/harness/ownership.ts`) | fora da faixa |

Os sub-testes "positivo/negativo" desses arquivos aparecem verdes porque retornam cedo quando o módulo não existe — **verde vacuoso não é aprovação**. Registrado para não inflar a contagem.

```text
npx tsc --noEmit — exit 0, sem diagnósticos

> oncoglobal@0.0.1 check:boundaries
> node scripts/check-boundaries.mjs
fronteiras ok (185 arquivos)

> oncoglobal@0.0.1 check:corpus
> node scripts/validate-corpus.mjs
corpus ok (102 arquivos)

RUN  v5.0.3 C:/Users/silas/Projects/OncoGlobal-wt/w10-fugu
Test Files  23 passed (23)
Tests  138 passed (138)

RUN  v5.0.3 C:/Users/silas/Projects/OncoGlobal-wt/w10-fugu
Test Files  1 passed (1)
Tests  9 passed (9)
```

### Testes novos desta continuação (17)

| Arquivo | Cobre | Testes |
|---|---|---|
| `tests/w10-fugu/evento-revisao-ledger.test.ts` | FUGU-09: grava no ledger **real** (GRAVADA/REPLAY), NEGADA sem `reviewDecisionId`, autoridade da sessão | 6 |
| `tests/projections/timeline-secoes.test.ts` | FUGU-10: `PatientTimeline` → `Secao<T>`, ausente nunca VERDE, conflito VERMELHO | 4 |
| `tests/w10-fugu/adv-extracao-pipeline.test.ts` | ADV: negação, linfonodo 24 mm, "sem M1" ≠ M0, número falado, confirmação forjada, campo sem valor | 7 |

Uma expectativa de teste da própria fatia foi **reforçada** (não enfraquecida) ao corrigir o defeito: o caso de fonte única da FUGU-07 agora usa um fato normalizado de verdade e ganhou dois casos negativos (marcador sem valor e laboratório falado não elegem).
