# PROMPT PERSISTENTE — FUGU · ONDA W4 · 8 FATIAS (correções do backend pós-auditoria)

> Primeiro leia e obedeça `docs/ondas/W2-CABECALHO-COMUM.md` (vale integralmente; onde diz W2, leia W4). EXECUTOR = `FUGU`.
> **Worktree:** `C:\Users\silas\Projects\OncoGlobal-wt\w4-fugu` · **Branch:** `f0/w4-fugu` (base: `f0/w1-integrado` @ 30abd2a)
> **Progresso:** `docs/progresso/W4-FUGU.md`. Se a sessão cair, leia esse arquivo e continue da primeira fatia não FEITA.
> **Rodar testes sempre em série** (máquina com pouca RAM): `npx vitest run --no-file-parallelism`. O `npm run verify` final também precisa passar.

## Contexto (leia antes)
O tech lead corrigiu as 9 falhas da auditoria adversarial do Codex (commit `1352079`). Elas viraram gates permanentes em `tests/w3/auditoria-regressao.test.ts`. **Não enfraqueça nenhum desses testes.** As correções foram mínimas; esta onda fecha o que elas deixaram aberto:
- o gateway só tem store de idempotência **em memória**: reiniciar o app apaga a reserva OUTCOME_UNKNOWN e permite reimprimir;
- **não existe rota que registre o bundle exibido**: em produção toda confirmação cai em `409 BUNDLE_NAO_EXIBIDO`;
- o snapshot agora tem estado `PENDENTE` e campo `proposta`, e o cumulativo tem `conflitoAdminIds`, mas delta, reconstrução e as vistas de `src/modules` ainda não sabem disso;
- dois hashes diferentes no projeto (FNV-1a em `src/modules/tipos.ts`, SHA-256 no servidor);
- data civil calculada em UTC (`toISOString().slice(0,10)`): depois das 21h no Brasil o dia "vira" e o prazo APAC erra por 1 dia.

## Escopo de arquivos desta onda (só estes)
`src/kernel/ledger/**`, `src/kernel/projections/**`, `src/kernel/hash.ts` (NOVO), `src/server/**`, `src/rules/{delta,apac}.ts`, `src/modules/tipos.ts` (**só** a função `hashCanonico`, reatribuída a você nesta onda), `tests/{ledger,projections,server,apac,w4}/**`, `docs/progresso/W4-FUGU.md`.
**Proibido:** `src/contracts/**`, `src/kernel/gateway/gateway.ts` (dono: tech lead; você só implementa a interface `StoreIdempotencia` que ele já expõe), `src/rules/**` fora de delta/apac, `src/ui/**`, `package.json`.

---

## FUGU-W4-01 · Idempotência persistente em SQLite
**Arquivos:** `src/kernel/ledger/idempotencia.ts` (NOVO), `src/kernel/ledger/schema.ts`, `tests/ledger/idempotencia.test.ts`
**Objetivo:** `sqliteIdempotencia(db): StoreIdempotencia` (tipo importado de `src/kernel/gateway/gateway.ts`) com `get`, `set` e `delete`. Tabela `action_idempotency(chave PK, payloadHash, resultado JSON, atualizadoEm)`.
**Aceite:** (a) reserva OUTCOME_UNKNOWN gravada, fecha e reabre o banco em arquivo temporário: a mesma chave **não** reexecuta o efeito (devolve OUTCOME_UNKNOWN/REPLAY); (b) FALHOU libera a chave e permite nova tentativa; (c) payload diferente com a mesma chave é negado; (d) os testes A01/A02 de `auditoria-regressao` repetidos com o store SQLite também passam.

## FUGU-W4-02 · Hash canônico único (SHA-256)
**Arquivos:** `src/kernel/hash.ts` (NOVO), `src/server/sessao.ts`, `src/server/rotas.ts`, `src/modules/tipos.ts` (só `hashCanonico`), `tests/w4/hash.test.ts`
**Objetivo:** uma única função `hashCanonico(valor)`: JSON com chaves ordenadas → SHA-256 hex (64). `hashConteudoExibido` do servidor passa a reexportar/usar essa função. Em `src/modules/tipos.ts`, troque o FNV-1a por SHA-256 **mantendo a assinatura** `hashCanonico(valor: unknown): string`, usando `node:crypto` diretamente (módulos não podem importar `src/kernel`; o check de fronteiras vai acusar se você tentar).
**Aceite:** mesmo objeto com chaves em outra ordem → mesmo hash; o hash do render (`src/modules/documentos/render.ts`) e o hash do servidor coincidem para o mesmo conteúdo; todos os testes de `tests/modules` continuam verdes (se algum fixa o valor FNV literal, atualize **só** o literal e registre no progresso).

## FUGU-W4-03 · Rota de exibição do bundle (fecha o ciclo da A13)
**Arquivos:** `src/server/rotas.ts`, `src/server/sessao.ts`, `tests/server/bundle.test.ts`
**Objetivo:** `POST /consulta/bundle` com `{patientId, encounterId, draftIds[]}` (schema estrito local, sem `medicoId`). O servidor lê os drafts **do ledger local**, monta a lista de documentos (`documentId`, `documentVersion`, conteúdo), calcula `conteudoHash = hashCanonico(payload)` **no servidor** e chama `registrarBundleExibido`. Responde os documentos e seus hashes. Draft de outro paciente → 409. Sessão expirada → 401.
**Aceite:** percurso completo em teste HTTP real (127.0.0.1): login → bundle → confirmar = `GRAVADA`; bundle → draft alterado → confirmar = `409 CONTEUDO_ALTERADO_APOS_EXIBICAO`; bundle → confirmar documento que não estava no bundle = 409; nenhum conteúdo clínico no log (N18).

## FUGU-W4-04 · Data civil no fuso do serviço (sem UTC escondido)
**Arquivos:** `src/rules/apac.ts`, `src/kernel/projections/**` (se usar data civil), `tests/apac/fuso.test.ts`
**Objetivo:** toda conversão instante → data civil recebe o **offset do serviço injetado** (ex.: `"-03:00"`), nunca `toISOString().slice(0,10)`. Não fixe o valor no código: o offset real é `[VERIFICAR]` com o Dr. Silas; os testes usam `-03:00` como dado sintético. Validação de data civil (`AAAA-MM-DD` válida) separada da conversão.
**Aceite:** APAC gerada em `2026-10-05T23:30:00-03:00` conta o D85/D90 a partir de **2026-10-05** (não 06); o mesmo instante com offset `-04:00` também dá 05; N13 continua verde.

## FUGU-W4-05 · Delta entende PENDENTE e proposta
**Arquivos:** `src/rules/delta.ts`, `tests/projections/delta.test.ts`
**Objetivo:** campo do snapshot com `estado: "PENDENTE"` nunca vira RESOLVEU nem NOVO VERDE; `proposta` (sugestão CURRENT) **não entra no delta** como fato: aparece só como item marcado `proposta` sem classe NOVO/MUDOU, ou é ignorada (escolha a mais simples e documente). Conflito VERMELHO continua VERMELHO mesmo com proposta presente.
**Aceite:** três testes novos, um por regra acima; todos os testes antigos de delta verdes.

## FUGU-W4-06 · Reconstrução determinística com os campos novos
**Arquivos:** `src/kernel/projections/{snapshot,reconstruir}.ts`, `tests/projections/reconstruir.test.ts`
**Objetivo:** a saída do snapshot é serializada com **chaves ordenadas** (use `hashCanonico`/canon) para que a ordem de chegada dos eventos não mude os bytes. `reconstruir()` grava junto um `snapshotHash`.
**Aceite:** mesmos eventos inseridos em ordens diferentes → cache **byte a byte igual**; snapshot com PENDENTE, proposta e conflito de cumulativo reconstrói idêntico; N10 e N15 verdes.

## FUGU-W4-07 · Adaptador projeção → vistas da consulta
**Arquivos:** `src/kernel/projections/vistas.ts` (NOVO), `tests/projections/vistas.test.ts`
**Objetivo:** função pura que converte a saída real da projeção (snapshot, séries, cumulativos) nas vistas que `src/modules/consulta/preConsulta.ts` já consome (`CumulativoVista` e afins), **sem editar `src/modules`** (o kernel pode importar tipos de modules; o contrário não). Cumulativo com `conflitoAdminIds` não vira número: vira item PENDENTE/VERMELHO com o motivo "administração duplicada com quantidades diferentes". Campo PENDENTE nunca vira VERDE na vista. Se uma vista de `src/modules` não tiver como representar PENDENTE/conflito, **não mude o tipo**: registre `BLOQUEADO_ESCOPO` com o campo exato e siga.
**Aceite:** teste ponta a ponta: eventos sintéticos no ledger → projeção → vistas → `preConsulta` monta sem erro e mostra o conflito do cumulativo como pendência.

## FUGU-W4-08 · Fechamento e relatório
**Arquivos:** `docs/progresso/W4-FUGU.md`
**Objetivo:** `npm run verify` completo (typecheck + fronteiras + corpus + testes) verde; rode também `npx vitest run tests/w3/auditoria-regressao.test.ts --no-file-parallelism` e cole a saída. Relatório com: tabela das 8 fatias, arquivos criados/alterados, saída real do verify, lista de `[VERIFICAR]` (no mínimo: offset do serviço) e perguntas ao tech lead.

---

## Stop conditions desta onda
- Precisaria mudar `src/contracts/**` ou `gateway.ts` → pare a fatia, `BLOQUEADO_ESCOPO`, siga.
- Algum teste de `tests/w3/auditoria-regressao.test.ts` ficou vermelho → **pare tudo e reporte** (regressão de segurança).
- Nunca `git push`. Commit por fatia: `W4-FUGU-NN: <título>` + linha `Co-Authored-By: <seu modelo>`.
