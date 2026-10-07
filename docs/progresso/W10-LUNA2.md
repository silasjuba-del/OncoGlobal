# W10-LUNA2 · progresso

**Estado atual (raiz, 2026-10-07): F03/F04 integradas e validadas, inclusive destino canonico e consumidor temporal HTTP. Evidencia integrada: 47 arquivos/362 testes PASS; testes HTTP independentes incluidos. Notas NOT_RUN abaixo sao historicas.**

Base: `f0/w10-luna2` em `04b53db31598fb80ff78192d4cd3eafde36428fd`.

| Fatia | Estado | Entrega | Validação/commit |
|---|---|---|---|
| F03 · W10-LUNA2-01 | Implementada; aguardando wrapper serial da raiz | Action Gateway exige contexto server-side para verbos externos; valida G-02/G-27, autorização vinculada a artefato/versão/hash/destino, executa o payload validado, revalida antes de replay, mantém reserva/idempotência e reduz erros/recibos/logs a códigos opacos. Impressão e backup local preservam compatibilidade. | `NOT_RUN` até liberação da raiz. |
| F04 · W10-LUNA2-02 | Implementada parcialmente; integração de rota pendente | `dataCivilDoServico(instante, fuso = "-03:00")` valida offset/instante e retorna `PENDENTE` em vez de fallback. Teste compõe o adaptador com `apacPrazo` (FN-12), incluindo D84/D85/D89/D90 e cruzamentos de data. | `NOT_RUN` até liberação da raiz. L1 deve consumir o adaptador em uma rota de leitura APAC para concluir o fluxo real. |

## Porta para L1

`criarGateway` aceita `validarSaida(intent, sessao)`; o callback é opcional no tipo para manter compatibilidade de construção, mas sua ausência nega qualquer verbo de saída externa. A resposta aprovada contém `evidencia` server-side: `payload` exato a executar, destino canônico, artefato (id/versão/tipo/metadados), dicionário local de PHI, relatório de sanitização (risco, versão, hash do payload e hash do destino) e autorização vigente (paciente/encontro/artefato/versão/hash/destino). O gateway recalcula hashes e confirma vínculos antes de executar; replay exige callback e gates novamente. A rota deve montar esse callback com ledger e configuração local; campos booleanos ou destino livre do cliente não contam como prova.

APIs exportadas novas: `EvidenciaSaidaExterna`, `ResultadoValidacaoSaida`, `dataCivilDoServico` e `ResultadoDataCivilServico`. Tipos de evidência ainda `PROVISORIO-W10`; ver `docs/w10/PEDIDOS-LUNA2.md`.

## Limite conhecido

O callback de autorização e evidência ainda não está conectado à composição HTTP nesta faixa, pois L1 é dona das rotas. As rotas atuais mantêm sua contenção CP-001 e negam os canais/APAC não habilitados. A integração end-to-end só pode ser marcada após L1 compor o callback a partir do estado do servidor e usar `dataCivilDoServico` na leitura APAC.

## Evidencia da raiz — 2026-10-07

Primeira validacao: typecheck FAIL em `exactOptionalPropertyTypes` (metadados undefined). Correcao de integracao: ausencia normalizada para null, sem relaxar o contrato.

Reexecucao `LUNA2-F03-F04-R2`: typecheck exit 0; fronteiras ok (175 arquivos); corpus ok (91 arquivos); Vitest **15 arquivos / 88 testes PASS**, exit 0. Seletores: tests/w10-luna2, tests/kernel/kernel.test.ts, tests/kernel/adv-resistiu-idempotencia.test.ts, tests/server, tests/app/executores.test.ts, tests/sistema, tests/w3/auditoria-regressao.test.ts. Pool forks, um worker, sem paralelismo de arquivos, timeout 30 s. Nenhuma expectativa antiga alterada.

Log completo: `C:\Users\silas\Projects\OncoGlobal-wt\_w10-astra\logs\20261007-030015-165-LUNA2-F03-F04-R2.log` e arquivos `.typecheck.txt`, `.boundaries.txt`, `.corpus.txt`, `.vitest.txt` associados.

Reataques R02-R05 incluidos: recibo local preservado; recibo externo UUID interno, sem texto recebido; snapshot profundo imutavel da evidencia; auditoria previa obrigatoria para egress. Integracao L1 ainda pendente nesta evidencia.

## ASTRA-04 - destino canonico

Reproducao `ASTRA-GATEWAY-RED`: 2 FAIL / 7 PASS confirmaram que production e rede_social resolvidos internamente contornavam HARD_FORBIDDEN. Correcao reavalia politica no destino efetivo validado antes da reserva/execucao.

Reataque `ASTRA-GATEWAY-GREEN-R2`: typecheck/boundaries/corpus PASS; **12 arquivos / 76 testes PASS**, incluindo negativos novos, gateway legado, server e W3. Log `C:\Users\silas\Projects\OncoGlobal-wt\_w10-astra\logs\20261007-031910-273-ASTRA-GATEWAY-GREEN-R2.log`. Nenhuma saida real foi habilitada.
