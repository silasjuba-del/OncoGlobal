# W10-LUNA5 · configurações e caixa numerada

Base `04b53db31598fb80ff78192d4cd3eafde36428fd` · branch `f0/w10-luna5` · implementação WIP entregue para validação serial do root.

| Fatia | Estado de implementação | Arquivos | Persistência/consumidor/evento |
|---|---|---|---|
| W10-LUNA5-01 / F09 | Implementada localmente; R07/R08 corrigidos em WIP, validação do root pendente | `src/config/settings.ts`, `tests/w10-luna5/settings.test.ts`, `tests/w10-luna5/helpers.ts` | Perfil médico e instituição separados dentro de snapshot SQLite local dedicado (`config-w10.sqlite`). A API está pronta para o consumidor L1; conexões sempre permanecem desativadas. |
| W10-LUNA5-02 / F10 | Implementada localmente; R07/R08 corrigidos em WIP, validação do root pendente | `src/config/settings.ts`, `tests/w10-luna5/settings.test.ts` | Snapshot, operação idempotente e envelope de eventos são gravados na mesma transação. `AlteracaoCaixa` é persistido sem extensão, dentro de envelope `PROVISORIO-W10`. Não escreve em `clinical_event`. |

## Interface para L1

```ts
createSettingsService({ rootDir, caixas, now? })
service.readProfile(sessaoDoServidor)
service.saveProfile({ operationId, expectedRevision, perfil, motivo? }, sessaoDoServidor)
service.changeBox({ numero, valorNovo, expectedRevision, operationId, motivo?, autorizacaoMedica? }, sessaoDoServidor)
service.readBox(numero, sessaoDoServidor)
service.readHistory(sessaoDoServidor)
service.close()
```

`sessaoDoServidor` é o tipo `Sessao` vindo do gerenciador server-side. O serviço obtém autoria de `medicoId`; o payload não fornece autor. O catálogo é injetado como `CaixaNumerada[]`, sem cópia local do corpus. Perfil salva nome/CRM/RQE/telefone/CNS sob médico e hospital/CNES sob instituição. CNES de exemplo `2605473` é apenas metadado editável e não preenche a instituição. CNES/CNS permanecem strings.

Campos de conexão aceitam configuração local, mas `habilitada` é descartado para toda carga ou gravação. A preferência `sincronizarTelefone` pode ser registrada, sem ligar sincronização. Tema é limitado a `DIA | NOITE | PERSONALIZAR`; personalizar exige layout. Seleção de impressora só é armazenada. Nenhuma conexão, impressão, skill, plugin, MCP, LLM ou rede é executada aqui.

## Estado canônico e pedido

O contrato atual `AlteracaoCaixa` contém número, antes/depois, `por`, instante e motivo, sem revisão/operação. O ledger clínico requer `patientId` e `encounterId`, portanto não representa configuração global. O serviço mantém SQLite operacional local separado, com envelope `PROVISORIO-W10` contendo `operationId`, revisão, autoria/proveniência e eventos canônicos estritos. Isso deixa o histórico local atômico e auditável, mas não prova integração canônica. Ver `docs/w10/PEDIDOS-LUNA5.md`.

## Revisão focal R07/R08

`readBox` e o campo `valorAnterior` usam o perfil como fonte canônica para as chaves `config.*` mapeadas, mesmo antes de existir entrada própria em `caixas`. `changeBox` normaliza texto vazio para `null`, normaliza listas antes de construir evento, aplica a mudança ao perfil e valida o perfil inteiro antes da persistência; transição para `PERSONALIZAR` sem layout é recusada sem evento. Chave `apac.*` é recusada com `CONTEXTO_PACIENTE_OBRIGATORIO`; regras clínicas globais em `config.*` permanecem editáveis com autorização explícita.

Na rodada seguinte, o baseline da lista `skills` foi corrigido para `[]` (valor inicial persistido/canônico), sem alterar o produto para corresponder a `null`. Também se exige boolean real em `config.preferencias.sincronizarTelefone` e sessão server-side com CRM não branco e janela temporal `emitidaEm <= agora < expiraEm`; CRM vazio ou emissão futura não cria `DECISAO_MEDICA`. Replays de caixa validam primeiro o request canônico e a sessão, conferem autor+hash antes de validações que dependem do perfil atual e continuam sujeitos à rechecagem dentro da transação para concorrência. Testes adicionais de recusa preservam revisão e histórico. Serviços de teste ficam registrados para fechamento no `afterEach`; conexões SQLite auxiliares usam `finally`.

## Validação e commits

R2 registrou `tsc`, boundaries (175), corpus (91) e 2 arquivos / 19 testes `PASS`. A rodada R07/R08 registrou `tsc`, boundaries, corpus `PASS` e 23 testes (22 PASS, 1 FAIL) porque o teste esperava `null` para a lista inicial, cujo valor correto é `[]`. A expectativa foi corrigida. R09 e as regressões ASTRA-06 acrescentam três testes focais (26 testes esperados); esta revisão ainda está `NOT_RUN`. Os novos resultados precisam substituir os anteriores antes dos commits W10-LUNA5-01 e W10-LUNA5-02.

## Reataque final da raiz - 2026-10-07

`LUNA5-ASTRA-REATAQUE`: typecheck exit 0; fronteiras ok (175 arquivos); corpus ok (91 arquivos); **3 arquivos / 26 testes PASS**, exit 0, incluindo W3 (9). Testes agora separados em perfil.test.ts e caixas.test.ts para commits por fatia, com helpers compartilhados. Nenhum teste anterior a esta tarefa foi alterado.

R07/R08 e ASTRA-05/06/07 cobertos: valor anterior coerente desde DIA/false/lista vazia; normalizacao de texto; PERSONALIZAR exige layout; null em booleano obrigatorio recusado; replay nao reaplica transicao ao estado atual; ator divergente rejeitado; CRM branco/emissao futura negados; conexoes SQLite fechadas mesmo quando uma assercao falha. O teste novo que esperava null para lista vazia foi corrigido para [] por coerencia com valor atual real, sem alterar produto para esconder o erro.

Log: `C:\Users\silas\Projects\OncoGlobal-wt\_w10-astra\logs\20261007-031720-534-LUNA5-ASTRA-REATAQUE.log` e saidas associadas. Consumidor L1 e promocao do envelope operacional ao contrato canonico continuam separados desta validacao. O servico compartilhado das duas fatias e implementado no primeiro commit; o segundo acrescenta a prova focal de edicao/historico e seus limites.
