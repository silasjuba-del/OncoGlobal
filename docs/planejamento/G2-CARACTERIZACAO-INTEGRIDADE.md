# G2 — CARACTERIZAÇÃO DE INTEGRIDADE, REPLAY, HASHES, CONTEXTO E PÓS-PROCESSAMENTO HTTP

## 1. Metadados do Lote G2

- **Programa:** `ONCOGLOBAL — ESTABILIZAÇÃO, REFATORAÇÃO E INTEGRAÇÃO GLOBAL v3.0`
- **Comandos de autorização:** `CX-005` (escrita) e `CX-006` (`G2_TESTES_INICIADOS` / execução verificada)
- **Agente escritor:** Gemini Argon (`9876d03b-4eb0-4814-800a-db211d895da4`)
- **Worktree:** `C:\Users\silas\Projects\OncoGlobal-wt\codex-argon-estabilizacao-v30`
- **Branch / Base SHA:** `codex/estabilizacao-g01-reconciliacao` @ `52b8f7a04c2e467c5c3b3cb93bc38a7673cc4c93`
- **Escopo (`WRITE_SET` exclusivo de G2):**
  1. `tests/fixtures/g2-integridade.ts`
  2. `tests/ledger/g2-replay-identidade.test.ts`
  3. `tests/ledger/g2-hashes-legados.test.ts`
  4. `tests/server/g2-contratos-contexto-http.test.ts`
  5. `tests/server/g2-processamento-http.test.ts`
  6. `docs/planejamento/G2-CARACTERIZACAO-INTEGRIDADE.md`
- **Alterações em código de produto (`src/**`):** **ZERO** (proibido em G2).

---

## 2. Matriz dos 8 Cenários Obrigatórios de G2 (`CX-005` / `CX-006`)

| Cenário | Descrição Obrigatória | Arquivo de Teste | Asserções / Provas Principais |
|---|---|---|---|
| **Cenário 1** | Replay com relógio avançado sem duplicar eventos | `tests/ledger/g2-replay-identidade.test.ts`<br>`tests/server/g2-contratos-contexto-http.test.ts` | Prova que `writerClinico.persistir`, `confirmarBloco` (`/consulta/confirmar`) e `estadoDoenca` retornam `REPLAY` com relógio avançado sem duplicar linhas em `clinical_event`, enquanto chamada direta a `writeRouter.confirmar` sem pinar `operation.criadoEm` gera `OPERATION_HASH_CONFLICT` (`OG-001` / `D-03`). |
| **Cenário 2** | Mesma chave com payload divergente → `OPERATION_HASH_CONFLICT` | `tests/ledger/g2-replay-identidade.test.ts` | Prova que reutilizar `operationId` com valor clínico ou `reviewDecisionId` alterado retorna `{ estado: "NEGADA", resultRef: null, motivo: "OPERATION_HASH_CONFLICT" }`, preserva o evento original intacto e grava `AuditEvent` com `motivoCodigo: "OPERATION_HASH_CONFLICT"`. |
| **Cenário 3** | Divergência de ator, `patientId`, `encounterId` e `tumorLotId` no replay e na escrita | `tests/ledger/g2-replay-identidade.test.ts`<br>`tests/server/g2-contratos-contexto-http.test.ts` | Prova recusa no replay quando `sessao.medicoId`, `patientId`, `encounterId` ou `tumorLotId` mudam; contrasta `executarConfirmacao` (`DRAFT_ENCONTRO_DIVERGENTE` / `DRAFT_LOTE_DIVERGENTE`) com `writerClinico.persistir` (que checa `draft.patientId`, mas hoje não checa `encounterId`/`tumorLotId` internos do draft — `D-01`/`D-04`). |
| **Cenário 4** | Sessão expirada / não iniciada no instante da tentativa vs instante original | `tests/ledger/g2-replay-identidade.test.ts`<br>`tests/server/g2-contratos-contexto-http.test.ts` | Prova que escrita nova com sessão expirada/futura é negada (`SESSAO_EXPIRADA` / `SESSAO_NAO_INICIADA`), que `writerClinico` e `GerenciadorSessao` barram sessão expirada antes do kernel, mas que `writeRouter.confirmar` direto avalia `resultadoExistente` (`L77`) antes de `motivoInvarianteEscrita` (`L80`) (`OG-001`). |
| **Cenário 5** | Operação persistida com hash legado reconhecida sem quebrar replay | `tests/fixtures/g2-integridade.ts`<br>`tests/ledger/g2-hashes-legados.test.ts` | Insere operação/evento legado com JSON literal de chaves não ordenadas (`zCampoOrdemLegada` antes de `aCampoOrdemLegada`) e digest SHA-256 hexadecimal literal independente (`42a1bb87e2375d3d3b7be7fd1bc882f5dc72f9a3be8ea5d1044e10ecd83413ae`), provando leitura íntegra, replay idempotente e a diferença entre `hashPayload`, `hashCanonico` (`rules/conteudoCanonico.ts`) e `hashCanonico` (`kernel/projections/retrato/index.ts`). |
| **Cenário 6** | Matriz de contexto HTTP (`válido`, `ausente/undefined`, `null`, `inválido`, `divergente`) | `tests/server/g2-contratos-contexto-http.test.ts` | Exercita `GerenciadorSessao` (incluindo o ramo `contexto.tumorLotId === undefined` em `sessao.ts:102-103`), `/consulta/contexto/selecionar`, `/consulta/bundle`, `/consulta/confirmar`, `/consulta/estado-doenca/*` (`TUMOR_LOT_OBRIGATORIO`), `/consulta/salao/triagem`, `/consulta/salao/liberar`, `/consulta/salao/contingencia/gerar` e `/consulta/canal/vincular`. |
| **Cenário 7** | Disparos de pós-processamento por rota HTTP (`ROTAS_HTTP` / `grava`) | `tests/server/g2-processamento-http.test.ts` | **Distinção explícita de cobertura (`CX-006`):** O Cenário 7 **inspeciona estaticamente todas as 89 entradas do catálogo (`ROTAS_HTTP`: 21 `grava: false` e 68 `grava: true`)**, mas **executa via HTTP uma amostra representativa de endpoints** (`/consulta/agenda`, `/consulta/lotes` e `/consulta/estatistica` com `grava: false`; `/consulta/oncoassist/status` e `/consulta/carregar` como leituras com `grava: true`; `/consulta/extrair` `201` válido; e `/consulta/extrair` `400` / `/consulta/carregar` `401` como falhas `4xx`), e **não** todas as 89 rotas via HTTP. |
| **Cenário 8** | Conclusão e drenagem de pendências em voo no `server.close()` | `tests/server/g2-processamento-http.test.ts` | Segura `motorF1.processar()` em voo com uma barreira assíncrona após `POST /consulta/extrair` (`201`), verifica que `server.close()` aguarda a drenagem de `pendentes` (`http.ts:76`), que requisições concorrentes durante o fechamento recebem `503 SERVIDOR_ENCERRANDO`, e que o banco SQLite permanece aberto até o término do trabalho em voo. |

---

## 3. Classificação Técnica: Invariantes, Defeitos Conhecidos e Hipóteses

### 3.1. (A) Invariantes Preservadas (Contrato Permanente — Não Podem Regredir em G3–G9)
1. **Atomicidade e imutabilidade de `operation` e `clinical_event`:** Nenhuma falha, conflito de revisão (`EXPECTED_REVISION_CONFLICT`) ou conflito de hash (`OPERATION_HASH_CONFLICT`) altera ou duplica eventos já persistidos (`writeRouter.ts:86-103`, `schema.ts:86-97`).
2. **Acoplamento estrito `operationId` ↔ conteúdo materializado:** Reutilizar a mesma chave de operação com valor clínico, `reviewDecisionId`, `patientId`, `encounterId`, `tumorLotId` ou `medicoId` diferente resulta em `NEGADA` (`OPERATION_HASH_CONFLICT`) + registro em `audit_event`.
3. **Exibição prévia obrigatória por contexto na sessão (`G-25` / `A13`):** `selecionarConsulta` limpa `bundle` e `alertas` quando `(patientId, encounterId, tumorLotId ?? null)` muda (`sessao.ts:110-112`), impedindo assinatura de documentos exibidos em contexto anterior.
4. **Drenagem determinística no encerramento HTTP (`http.ts:71-82`):** `server.close()` recusa novas entradas com `503 SERVIDOR_ENCERRANDO` e aguarda `Promise.allSettled([...pendentes])` antes de encerrar o socket HTTP e permitir o fechamento do SQLite.
5. **Compatibilidade com operações legadas já gravadas:** Operações persistidas em `operation` continuam reconhecidas em replay pelo `payloadHash` armazenado.

### 3.2. (B) Defeitos Conhecidos Demonstrados (Alvos de Correção em G3 e G5)
1. **`OG-001` / `D-03` — Pinagem manual de `criadoEm` dispersa em 6 chamadores e replay antes da validação de sessão no `writeRouter`:**
   - Em `src/kernel/ledger/writeRouter.ts:71-80`, `ClinicalEvent` recebe `criadoEm: req.em` antes de calcular `hashPayload(eventos)`, e `resultadoExistente(db, op)` (`L77`) executa antes de `motivoInvarianteEscrita(req)` (`L80`).
   - Consequência demonstrada no **Cenário 1** e **Cenário 4**: quem chama `confirmar` sem ler `SELECT criadoEm FROM operation WHERE operationId=?` recebe `OPERATION_HASH_CONFLICT` num retry legítimo com relógio avançado; e quem chama `confirmar` direto no kernel com o mesmo `em` e sessão expirada recebe `REPLAY`. (Alvo de **G3a / R-01**).
2. **`OG-002` / `D-02` / `OG-010` — Três implementações de hash com semânticas distintas (mais hash de texto sem aspas em `admitirConteudo`):**
   - `hashPayload` (`src/kernel/ledger/ledger.ts:10`) usa `JSON.stringify` sensível à ordem das chaves;
   - `hashCanonico` (`src/rules/conteudoCanonico.ts:6`, reexportado por `modules/tipos.ts`, `modules/hash.ts` e `hashConteudoExibido` em `server/sessao.ts:10`) ordena chaves, converte `undefined` em `"null"`, aceita `BigInt` e serializa `Date` para ISO UTC;
   - `hashCanonico` (`src/kernel/projections/retrato/index.ts:22`) ordena chaves para JSON plano, mas lança `CONTEUDO_NAO_CANONICO` para `undefined`, `Date` e `BigInt`.
   - Adicionalmente, `admitirConteudo` em `src/modules/canal/ingresso.ts:343,442` calcula `sha256Texto(texto)` sobre os bytes UTF-8 crus da string (sem aspas), enquanto `vincularCanal` em `src/server/rotas/salaoCanal.ts:215` calcula `contentHash: hashConteudoExibido(m.texto)` (que serializa a string com aspas JSON).
   - Consequência demonstrada no **Cenário 5**: o mesmo objeto com chaves reordenadas tem o mesmo `hashCanonico`, mas falha com `OPERATION_HASH_CONFLICT` em `hashPayload`. (Alvo de **G3b / R-02**).
3. **`D-01` / `D-04` — Assimetria de validação de contexto do draft entre `executarConfirmacao` e `writerClinico` / `estadoDoenca`:**
   - `executarConfirmacao` (`src/kernel/comandos/index.ts:17-21`) valida `encounterId` e `tumorLotId` do `draft.payload.contexto`;
   - `writerClinico.persistir` (`src/kernel/gateway/writerClinico.ts:148-150`) valida apenas `draft.patientId !== pedido.contexto.patientId`, aceitando um draft cujo `payload.contexto` interno tenha outro `encounterId` ou `tumorLotId` (**Cenário 3**);
   - `rotearEstadoDoenca` (`src/server/estadoDoenca.ts:66`) chama `writeRouter.confirmar` diretamente em vez de passar por `executarConfirmacao` (`OG-006`). (Alvo de **G3c / G3e / R-04**).
4. **Ramo `contexto.tumorLotId === undefined` em `sessao.bundleExibido` (`src/server/sessao.ts:102-103`):**
   - Demonstrado no **Cenário 6A**: se o chamador omitir a propriedade `tumorLotId` (`undefined`) ao consultar `bundleExibido`, a função ignora o `tumorLotId` gravado no bundle da sessão, ao passo que `tumorLotId: null` compara estritamente. (Alvo de **G3e**).
5. **Casos `A CONFERIR` da política contextual E1 (`salaoCanal.ts` e `salaoContingencia.ts`):**
   - Demonstrados no **Cenário 6C**: `salvarTriagemSalao`, `liberarSalao` e `gerarContingenciaSalao` comparam `patientId + encounterId` sem comparar `tumorLotId` da sessão (gravando `tumorLotId: null` em `liberarSalao`), e `vincularCanal` compara `patientId` na sessão e usa o `encounterId`/`tumorLotId` selecionado na sessão. (Documentado para decisão explícita em **G3e**).
6. **`OG-003` / `OG-004` — Pós-processamento global em rotas de leitura marcadas com `grava: true`:**
   - Demonstrado no **Cenário 7**: 68 das 89 rotas em `ROTAS_HTTP` têm `grava: true`, incluindo leituras como `/consulta/carregar`, `/consulta/apac`, `/consulta/canal`, `/consulta/salao`, `/consulta/chat`, `/consulta/oncoassist/status`, `/consulta/oncoassist/fontes`, `/consulta/investigacao`, `/consulta/revisao-clinica` e `/consulta/receita/propor-dose`, disparando `processarPendenciasClinicasCanal` + `motorF1.processar()` após cada resposta `2xx`. (Alvo de **G5 / R-03**).

### 3.3. (C) Hipóteses Não Reproduzidas / Fora do Escopo de Defeito Confirmado
- **`OG-013` (Deleção de `action_idempotency` em `FALHOU` sob corrida multiprocesso):** Dentro do mesmo processo Node, o mapa `emAndamento` em `src/kernel/gateway/gateway.ts:371,454-459` serializa chamadas concorrentes na mesma chave; a janela teórica restringe-se a múltiplos processos escrevendo simultaneamente na mesma chave após falha certa.

---

## 4. Prova de Não-Tautologia da Fixture Legada (Regra `CX-005`)

Em `tests/fixtures/g2-integridade.ts`, o vetor `VETOR_OPERACAO_LEGADA_G2` define:
- `eventosJsonLiteral`: string JSON literal congelada contendo `"zCampoOrdemLegada":2,"aCampoOrdemLegada":1` na ordem original não canônica;
- `payloadHashLiteralEsperado`: `"42a1bb87e2375d3d3b7be7fd1bc882f5dc72f9a3be8ea5d1044e10ecd83413ae"` (constante literal pré-computada fora do código sob teste);
- `eventoCanonicoSha256Esperado`: `"b6c27ed4bb290b12d7a6cc7756df91e6041e02a58c614f1f5735f5e1b063f303"`;
- `arrayCanonicoSha256Esperado`: `"ea8dfdd4551a01e816593b7b610236d80698d6a11fd76555a4f457743c88816e"`.

Nenhuma função sob teste (`hashPayload`, `hashCanonico`, `confirmar`, `gravarOperacao`) é chamada para construir o valor esperado na fixture.

---

## 5. Hashes SHA-256 Finais dos Arquivos de G2 e Evidências de Execução (`CX-006`)

### 5.1. Hashes SHA-256 dos 5 Arquivos de Teste/Fixture

| Caminho na Worktree `codex-argon-estabilizacao-v30` | SHA-256 |
|---|---|
| `tests/fixtures/g2-integridade.ts` | `72c044a9894391cf39743c19765fc55e2bfba1c72ac9fac1d5f4a7fac5772a63` |
| `tests/ledger/g2-replay-identidade.test.ts` | `bb0c3f7e89a5f235eacd272173da9057b4736b8623466350a2b2a68122b19ea6` |
| `tests/ledger/g2-hashes-legados.test.ts` | `f0ad18588e63fe982158a2c8204cb7e79c3c415a33c1762d7e808c2e139c0a8d` |
| `tests/server/g2-contratos-contexto-http.test.ts` | `9b53d765281ec9b51d8c91edccd5ebab54a1cf91684b8067886d1b58f459f047` |
| `tests/server/g2-processamento-http.test.ts` | `0b0492953d0560cda4518dbcd14344a5997a973e8343961e3c35203ada9a8eff` |

Hashes da versão entregue por Argon em CR-006. Correção posterior na PR #49 (revisão do Codex): `g2-contratos-contexto-http.test.ts` usava o telefone `+55` não declarado como sintético, recusado pelas varreduras de PHI; passou a usar o sintético declarado `+55-00-0000-0000`, sem mudar asserções. Hash atual desse arquivo: `3424577af30401c2d323d3ae7ea2f5e2b0d18798e666082f7545f4e059406d6e`.

### 5.2. Resultados da Execução Isolada (`G2_TESTES_INICIADOS` → `G2_TESTES_ENCERRADOS`)

- **Ambiente:** Windows nativo (`win32 10.0.26300`), Node `v24.15.0`, `TEMP`/`TMP` isolados em `C:\Users\silas\AppData\Local\Temp\oncoglobal-g2-argon-run\tmp`, portas TCP efêmeras `127.0.0.1:0`.

| Comando | Início (ISO-8601) | Fim (ISO-8601) | Exit Code | Contagem / Resultado | Arquivo de Log Persistido |
|---|---|---|---:|---|---|
| `npx vitest run tests/ledger/g2-replay-identidade.test.ts tests/ledger/g2-hashes-legados.test.ts tests/server/g2-contratos-contexto-http.test.ts tests/server/g2-processamento-http.test.ts` | `2026-10-23T22:05:52.912-03:00` | `2026-10-23T22:06:21.246-03:00` | `0` | `4 passed (4)` arquivos · `17 passed (17)`, `0 failed`, `0 skipped` (25.41s) | `C:\Users\silas\AppData\Local\Temp\oncoglobal-g2-argon-run\logs\g2-vitest.log` |
| `npm run typecheck` | `2026-10-23T22:06:21.251-03:00` | `2026-10-23T22:06:29.671-03:00` | `0` | `tsc --noEmit` PASS (0 erros) | `C:\Users\silas\AppData\Local\Temp\oncoglobal-g2-argon-run\logs\g2-typecheck.log` |
| `npm run check:boundaries` | `2026-10-23T22:06:29.679-03:00` | `2026-10-23T22:06:31.191-03:00` | `0` | `fronteiras ok (566 arquivos; 0 exceções)` | `C:\Users\silas\AppData\Local\Temp\oncoglobal-g2-argon-run\logs\g2-boundaries.log` |
