# F2 — Canal do Paciente: Limites Operacionais, Janela de Funcionamento e Contingência

## 1. Arquitetura Local-First e Janela de Funcionamento
- **Topologia v1 (Q57/Q59/INV-12)**: o servidor OncoGlobal opera exclusivamente no computador local do Dr. Silas (`127.0.0.1`), persistindo dados em SQLite local com `PRAGMA journal_mode = WAL` e `PRAGMA synchronous = FULL`.
- **Sem fila ou banco intermediário com PHI em nuvem**: nenhuma fila externa, DLQ em nuvem ou armazenamento intermediário retém mensagens identificáveis fora do PC local.
- **Janela de funcionamento**: o recebimento ativo ocorre enquanto o processo local está em execução e, no caso do webhook WhatsApp Business, enquanto o túnel autenticado aponta apenas para a rota de ingresso do webhook.

## 2. Limites dos Provedores de Transporte
- **WhatsApp Business Cloud API (Meta)**:
  - A confirmação HTTP (`2xx`) só é emitida pelo servidor local **após** o commit transacional da mensagem (`canal_mensagem`) e da sua pendência durável (`canal_pendencia`) no SQLite.
  - Em caso de indisponibilidade do PC, queda do túnel ou falha de armazenamento (`503 ARMAZENAMENTO_INDISPONIVEL`), o provedor realiza retentativas com backoff exponencial dentro da sua janela operacional (tipicamente até 7 dias na documentação da Meta; garantia exata depende da conta/provedor contratado).
  - Mensagens cuja janela de retentativa do provedor expire com o PC desligado **não são entregues posteriormente pelo webhook** e **nunca são inferidas ou inventadas** pelo sistema.
- **E-mail (IMAP)**:
  - O adaptador IMAP é separado do webhook e persiste checkpoints exclusivamente por `accountId + mailbox + UIDVALIDITY + lastUid` (`canal_imap_checkpoint`).
  - Nenhuma mensagem é apagada, expurgada ou marcada como processada antes do commit local no SQLite.
  - Enquanto as mensagens permanecerem na caixa postal do provedor de e-mail (dentro da política de retenção da caixa), o adaptador recupera o backlog por `UID > lastUid` ao religar o PC.
  - Se o servidor IMAP alterar `UIDVALIDITY`, o checkpoint entra em `RECONCILIACAO_UIDVALIDITY_NECESSARIA`, bloqueando avanço silencioso de UID até reconciliação explícita.

## 3. Recuperação Local e Registro de Períodos sem Cobertura
- **Queda pós-commit / pré-ACK**: como o registro já foi persistido com `(accountId, providerMessageId)`, a reentrega do provedor é reconhecida deterministamente como `REPLAY`, devolvendo o mesmo `reciboId` sem duplicar mensagem ou pendência.
- **Queda pós-ACK / pré-processamento**: como `canal_pendencia` é gravada na mesma transação do recebimento antes do ACK, `retomarPendenciasCanal` retoma todas as mensagens pendentes ao reiniciar o processo no mesmo SQLite.
- **Registro de janelas sem cobertura (`canal_janela_cobertura`)**: períodos em que o computador ou o transporte esteve desligado são registrados explicitamente com `inicioEm`, `fimEm`, `motivo` e `mensagensPerdidasInventadas = 0`. O sistema exibe a lacuna temporal de cobertura de forma transparente, sem fabricar conteúdo ou presumir ausência de intercorrências no período.

## 4. Contingência Clínica e Operacional
- O canal do paciente na F2 é assíncrono e **não substitui atendimento de emergência presencial**.
- Pacientes em tratamento recebem no consultório o documento físico/impresso de **Sinais de Alarme** (D-W5-05 / D-W9-28 / D-W9-38), que orienta procurar imediatamente o Pronto-Socorro em caso de febre > 37,8 °C ou sinais de gravidade, independentemente de disponibilidade de WhatsApp ou e-mail.
