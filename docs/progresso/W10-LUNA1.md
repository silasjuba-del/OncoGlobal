# W10-LUNA1 · progresso

Base recebida do root: `f0/w10-luna1` @ `7a5ec6f3efa9669decbc9c61529bf2741da3e551`. Nenhum teste, typecheck ou wrapper foi executado neste worktree; validação permanece `NOT_RUN` para o root serializar.

| Fatia | Estado local | Implementação / consumidor | Limite |
|---|---|---|---|
| F01 consulta | PARCIAL | `POST /consulta/carregar` recompõe paciente/lotes/episódio/ciclo de eventos tipados e drafts no patient scope; grava a seleção server-side na sessão para o chat. | Snapshot clínico e campos sem fonte persistida seguem PENDENTE. |
| F01 agenda | PARCIAL | `/consulta/agenda` lê `AgendaEntry` validado, cruza patient/encounter do evento e envelope, filtra data civil -03:00 e ordena horário. | Envelope operacional provisório; ausência da fonte sinalizada. |
| F01 salão | PARCIAL | `/consulta/salao` carrega `salao-triagem.v1.json`, valida `Triagem`, chama `avaliarTriagem`, `avaliarCorteSalao` e `ordenarFila`. | Pad/creatinina e prescrição vigente não vêm do contrato C-08, então ficam PENDENTE; reataque do corte atualizado ainda exige olhar do root. |
| F01 canal | PARCIAL | `/consulta/canal` lê `CanalMessage` + `Contato`; só exibe patientId se contato/evento concordarem. | Envelope de mensagem provisório; sem transporte externo ou autovínculo. |
| F01 APAC | PARCIAL | `/consulta/apac` lê APAC/TumorLot/Paciente por schemas, liga por paciente+lote, calcula D85/D90 com data civil -03:00 e chama antiglosa usando as 47 caixas reais. | Tabela SIGTAP não existe no corpus ativo; saída antiglosa fica bloqueada/pendente. Sem emissão/exportação. |
| F01 chat | PARCIAL | `/consulta/chat` exige seleção server-side feita por `/consulta/carregar` e filtra paciente, encontro e setor. | `ChatMessage` provisório; prescrição no chat ainda ausente. |
| F02 extração/revisão | PARCIAL | `/consulta/extrair` executa pipeline local e salva DraftEnvelope não vinculado; `/consulta/rascunho` lê; `/consulta/rascunho/revisar` registra vínculo explícito de sessão + expectedRevision sem criar fato. | Reconciliador/segurança/timeline no pipeline são skeletons; não há promoção automática para ledger. |
| F02 G-07/08/09 | PARCIAL | Alertas/pendências são salvos no draft e não bloqueiam salvar. | Ausência de lateralidade/anatomia/espécime não é inferida. |
| F02 prescrição/APAC | PARCIAL | `/consulta/prescricao/rascunho` consome parser, classificador documental, instanciador de protocolo e status de segurança explícito. `/consulta/apac` consome antiglosa com a fonte local. | Fichas em RASCUNHO não instanciam; sem requisitos de segurança tipados a verificação retorna NOT_EVALUABLE. SIGTAP ausente deixa antiglosa sem exportabilidade. |
| F02 L4 | PARCIAL | `/consulta/recist` chama `avaliarSerieRecist` sobre envelopes locais com IDs/fontes validados; `/consulta/estatistica` chama `projetarEstatisticaLedger`. | Sem série RECIST tipada, resposta PENDENTE; categoria é sempre proposta, jamais assinatura. |
| F02 settings L5 | PARCIAL | Endpoints de perfil, caixa e histórico consomem `createSettingsService` com catálogo corpus real (47 itens); perfil não ativa conexões. | Requer `configRootDir` injetado pelo host. Valores `apac.*` permanecem fora do perfil global. |
| F02 gateway/tempo | PARCIAL | `/acao` usa gateway server-side; prazos e leituras convertem com L2 em -03:00. | Saídas externas dependem de evidência persistida e seguem contidas. |

## Novas superfícies

- `POST /consulta/extrair` `{ recordingId, sourceId, sourceType, page?, rawTranscript }` → `draftId`, fatos candidatos, exceções, alertas e `requiresMedicalReview`.
- `POST /consulta/rascunho` `{ draftId }` → envelope persistido.
- `POST /consulta/rascunho/revisar` `{ draftId, expectedRevision, patientId }` → revisão explícita do vínculo, sem evento clínico.
- `POST /consulta/prescricao/rascunho` recebe somente `templateId` corpus ou linha textual manual; estado permanece RASCUNHO e NOT_EVALUABLE se requisitos não existem.
- `POST /consulta/recist { patientId }` → propostas tipadas, pendentes se escopo/proveniência não fechar; `/consulta/estatistica {}` deriva contagens do ledger sem PHI.
- `POST /config/perfil`, `/config/perfil/salvar`, `/config/caixa/ler`, `/config/caixa/alterar`, `/config/historico` usam `SettingsService` e a sessão server-side.
- Leitores PortaConsulta seguem os caminhos já existentes em `src/ui/api/http.ts`; sem prefixo `/api` novo.
- Eventos operacionais provisórios de leitura são `AgendaEntry`, `CanalMessage` e `ChatMessage`; ver schemas estritos e escopos em `src/server/leituras.ts`.

## Evidência

- Testes novos `tests/server/extracao-rascunho.test.ts` e `tests/server/leituras-http.test.ts`: cobrem HTTP autenticado, persistência/reabertura SQLite, alertas G-07 não bloqueantes, vínculo explícito, as seis leituras PortaConsulta, writer canônico, seleção server-side do chat e isolamento paciente A incompleto × paciente B completo. A leitura APAC sem CID/fontes deve continuar não exportável enquanto consulta retorna 200. **Aguardam wrapper serial do root.**
- Typecheck, boundaries, corpus e Vitest do escopo: `NOT_RUN` até a janela de validação serial solicitada pelo root. Não há alegação de PASS.
- Sem alteração de testes anteriores, UI, contratos, scripts ou dependências.

## Integrações aguardadas

Pendências canônicas e de integração estão em [PEDIDOS-LUNA1.md](../w10/PEDIDOS-LUNA1.md). Nenhuma pendência autoriza preencher prescrição, classificação, elegibilidade, SIGTAP ou campos clínicos ausentes.

## Evidencia final da raiz - 2026-10-07

Primeira validacao: typecheck identificou tres incompatibilidades de campos opcionais; foram normalizadas sem alterar contratos. Depois, a suite de20arquivos revelou payload de vinculo sem codigo e cleanup incompleto; corrigidos. Reataque ASTRA identificou selecao de episodio nula quando um evento operacional do mesmo encontro nao trazia tumorLotId; o contexto agora usa somente o unico lote do proprio patient/encounter, preservando PENDENTE quando ambiguo.

`LUNA1-CONTEXTO-FINAL`: typecheck exit0; fronteiras ok (180 arquivos); corpus ok (109 arquivos); **3 arquivos / 12 testes PASS**, incluindo W3. Os tres cenarios HTTP percorrem os seis leitores, persistencia/reabertura, identidade, drafts, contexto, fila e datas. Nenhum teste existente antes desta tarefa foi alterado. Log `C:\Users\silas\Projects\OncoGlobal-wt\_w10-astra\logs\20261007-035314-482-LUNA1-CONTEXTO-FINAL.log`.

Astra confirmou por leitura ASTRA09-14 corrigidos. Sete testes HTTP independentes de L2/L5 no checkout Astra e a regressao conjunta ainda serao executados pelo root apos merge. Fontes compartilhadas de F01/F02 entram no commit de composicao; segundo commit registra provas de extracao/revisao e os limites.

F02 permanece PARCIAL: chamar G-07/G-08 com entrada ausente nao prova comparacao de fontes; requisitos do SafetyEngine e reconciliacao completos dependem dos produtores. Assinatura pela UI depende de exibicao explicita por Cursor; G-25 nunca foi relaxado. O servidor oferece adaptacao de PedidoBundle, mas carregarConsulta nao simula documento exibido.
