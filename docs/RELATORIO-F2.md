# Relatório de Fechamento Técnico — Fase F2 (Canal do Paciente)

**Data:** 2026-10-19  
**Modalidade:** `GO_CODE ESCOPADO POR FASE` · **Fase:** `F2 — Canal do paciente` (`S-F2-01` a `S-F2-04`)  
**Repositório:** `C:\Users\silas\Projects\OncoGlobal` (`silasjuba-del/OncoGlobal`)  
**Worktree isolada de execução:** `C:\Users\silas\Projects\OncoGlobal-wt\claude-f2-canal-execucao` (`claude/f2-canal-paciente`)  
**Base inicial (`main`):** `6c1c6d3b679775825a72fd97df9b53ad7934bdf8` + integração preservando histórico de `f69ca50a08e6ff80f70259da93daa01b4b9f253e` (`grok/f2-canal-inicio`).

---

## 1. Escopo Entregue por Fatia

### S-F2-01 — Ingresso Seguro e Recuperável
- **Aproveitamento integral de `f69ca50` (`grok/f2-canal-inicio`)**: preservados `src/modules/canal/autenticarWebhook.ts`, `src/modules/canal/ingresso.ts`, `src/server/canalEntrada.ts` e os 21 testes originais em `tests/f2/grok/`.
- **WhatsApp Business (serviço)**:
  - Verificação inicial do webhook (`GET` challenge via `verificarDesafioWebhookWhatsApp` com `timingSafeEqual`) separada do recebimento de mensagens (`POST`).
  - Autenticação HMAC-SHA256 sobre os bytes crus antes de qualquer parse JSON.
  - Resolução de conta e canal pela configuração autenticada do servidor (`resolverContaWebhookConfigurada`), recusando conta incorreta (`CONTA_INCORRETA`).
  - Suporte a envelopes com múltiplos eventos (`receberEnvelopeWebhookCanal`), distinguindo `MENSAGEM`, `RECIBO_TECNICO` (`canal_recibo_tecnico`) e `OUTRO_EVENTO`, confirmando apenas após tratamento durável de todos os eventos admitidos.
- **E-mail (IMAP)**:
  - Adaptador separado do webhook (`src/modules/canal/imapIngresso.ts` + `ingerirLoteImapCanal`), com checkpoint por `accountId + mailbox + uidValidity + lastUid` (`canal_imap_checkpoint`).
  - Nenhuma marcação de processado no servidor IMAP ocorre antes do commit local no SQLite.
  - Mudança de `UIDVALIDITY` transiciona o checkpoint para `RECONCILIACAO_UIDVALIDITY_NECESSARIA` e bloqueia avanço silencioso até reconciliação explícita (`reconciliarUidValidityImapCanal`).
  - O *display name* declaratório no cabeçalho `From` é descartado da resolução de identidade (`extrairEnderecoEmailPuro`).
- **Persistência, Idempotência, Quarentena e Recuperação**:
  - Chave composta `UNIQUE(accountId, providerMessageId)`, separando `envelopeSha256` (bytes crus) de `eventoSha256` (`hashEstavelEventoCanal`).
  - Persistência atômica de `canal_mensagem` e `canal_pendencia` antes do ACK, com `PRAGMA journal_mode = WAL` e `PRAGMA synchronous = FULL`.
  - Conflitos de conteúdo são preservados de forma *append-only* em `canal_conflito_quarentena`, nunca descartados como replay.
  - Retomada de pendências após reinício (`retomarPendenciasCanal`) e registro de janelas sem cobertura (`canal_janela_cobertura`, com `mensagensPerdidasInventadas = 0`).
  - Consentimento (`canal_consentimento_evento`) estritamente separado do recebimento e do vínculo: o recebimento nunca gera `TERMO_ACEITO` automaticamente.

### S-F2-02 — Vínculo, Classificação e Reconciliação Clínica
- **Vínculo estrito**: reutiliza `resolverVinculo`; nome igual ou semelhante nunca vincula paciente; contato desconhecido, compartilhado ou ambíguo permanece em fila de revisão (`patientId: null`).
- **Classificação e preservação semântica**: preserva `autorRelato` (`PACIENTE`, `FAMILIAR`, `CUIDADOR`, `DESCONHECIDO`), `origemCanal`, `instanteMensagem` e `momentoClinicoRelatado` (`ATUAL`, `PASSADO`, `FUTURO_DUVIDA`, `NAO_INFORMADO`), além de negação direta e coordenada (`"sem X ou Y"`, `"não tenho X nem Y"`, `"nunca"`), hipótese/dúvida e conflitos entre relatos (`detectarConflitosRelatoCanal`).
- **Proteção de PHI e assimetria sobre LLM**: qualquer adaptador de classificação LLM recebe apenas texto desidentificado (`FN-24` + `G-02`), tem sua saída validada por contrato Zod estrito e nunca pode alucinar menções inexistentes no texto, converter negação/dúvida/passado determinísticos em sintoma afirmado atual ou promover familiar/cuidador/desconhecido a `PACIENTE`.
- **Regras de alarme conferidas vs. `RASCUNHO`**: regras em `RASCUNHO` (como no corpus padrão `corpus/rulesets/canal-redflags.v1.json`) permanecem em `PENDENTE_CURADORIA_MEDICA` (`alarmesAtivos: []`), nunca sendo ativadas automaticamente por testes verdes.

### S-F2-03 — Caixa Clínica, Pré-Consulta e Resposta Autorizada
- **Integração com Pré-Consulta e Cabeçalho**: `integrarCanalNaPreConsultaECabecalho` e `montarResumosContatoPreConsulta` integram `ContactSummary` ao `PreConsultPack` (`contatosCanal`), preservando histórico anterior, destacando o que ocorreu desde a última consulta confirmada, mantendo acesso às mensagens originais e recalculando somente quando a revisão de entrada muda.
- **Mídia não processada**: permanece `NAO_PROCESSADA` até comprovação local de leitura com tamanho e SHA-256 (`registrarLeituraLocalMidiaCanal`).
- **Autorização específica de resposta pelo Action Gateway**:
  - Exibe destinatário, conteúdo e contexto antes da confirmação (`prepararRascunhoRespostaCanal`).
  - Resposta livre exige confirmação médica (`confirmarRespostaCanalPeloMedico`).
  - Orientações gerais por cenário seguem `D-W9-75` (exigem `CONFERIDA_MEDICO`, proíbem dose, posologia, início de medicamento e diagnóstico com normalização de acentos, e exigem frase final literal `"Nada substitui a avaliação presencial do seu médico."`).
  - `autorizarSaida` e `executarEnvioAutorizadoCanal` revalidam no servidor (inclusive após operações assíncronas e em replays) operação, tipo de objeto (`MENSAGEM_CANAL`), vínculo, destinatário, consentimento vigente (`TERMO_ACEITO` do mesmo paciente e finalidade compatível), contexto (invalidando rascunhos e aprovações em mudanças de contexto e impedindo ressurreição) e versão.
  - Chamadas não aprovadas e `AGENDAR` continuam bloqueadas com `CANAL_EXTERNO_NAO_HABILITADO`.

### S-F2-04 — Prova Integral e Fechamento
- Bateria completa em `tests/f2/s04/prova-integral-canal.test.ts` exercitando autenticação inválida, conta incorreta, payloads malformados/excessivos/maliciosos, replay sequencial/concorrente em processos filhos/entre contas, conflito em quarentena, envelope diferente com evento equivalente, lotes com falha parcial (rollback atômico), falhas pré-commit/pós-commit/pós-ACK, banco em `query_only`, reinício no mesmo SQLite, reconexão IMAP e mudança de `UIDVALIDITY`, prompt injection inerte, revogação de consentimento, troca de contexto, zero PHI em logs/auditoria e benchmark de latência (`p50 = 1,07 ms`, `p95 = 3,17 ms < 200 ms`, `p99 = 6,03 ms` em `N = 200` mensagens de `128 B` a `4 KB`).

---

## 2. Limites Operacionais e Dependências Externas Pendentes
- Credenciais reais de produção da Meta (WhatsApp Business Cloud API), túnel HTTPS de produção e credenciais de caixa postal IMAP real do consultório não estão configurados no repositório (`PENDENTE_DE_DECISAO` / operação externa).
- Os 25 sinais de `corpus/rulesets/canal-redflags.v1.json` permanecem em `status: "RASCUNHO"` até curadoria médica item a item pelo Dr. Silas.
