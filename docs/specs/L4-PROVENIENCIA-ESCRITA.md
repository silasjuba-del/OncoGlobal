# L4 — proveniência e porta comum de escrita

Base: main `64d03c93804af8982a7776c10794543cf4ed8933`, após PRs #66–69. Autorização em 25/10/2026: continuar as correções, começando por proveniência/funil; Luna revisa/testa, Codex é único escritor. Trabalho em worktree isolada.

## Decisão do responsável

Texto manual grava na evolução; documento externo registra entrada. Manter o mínimo de rastreabilidade, sem novos formulários desnecessários. O original pode ter destino Google Drive/pasta Pacientes conforme integração disponível. Este lote não envia documentos nem cria pastas; mantém a referência existente do original.

Não fabricar uma fonte DOCUMENT para uma declaração manual. Não transformar hash de transcrição em hash de PDF. Não reescrever eventos já assinados ou envelopes históricos para adequá-los a um novo validador.

## Lote técnico

1. F4-02/A-01: copiar para o envelope as fontes declaradas no rascunho exibido, validadas. Fonte inválida não vira array vazio. No replay, preservar as fontes históricas da operação imutável, sem atualizar retroativamente o evento.
2. Porta comum: validar consistência entre fontes declaradas e fontes entregues ao writer. Para extração documental tipada, reconstruir a revisão a partir do segmento e origem vinculados, conferir fonte/hash, seleção de fatos e recibo; recusar lote parcial, origem alterada ou fonte substituída antes de persistir.
3. F4-07/A-03: estado-doença e writer especializado passam pela porta `executarConfirmacao`; preservar a autorização, o replay e os contratos próprios. O writer especializado exige SHA-256 completo para proveniência que afirma verificar.
4. Regressões de assinatura/ciência, extração, estado-doença e gateway; provas de recusa sem evento/versão/operação parcial e replay histórico sem alteração.

WRITE_SET: `src/kernel/comandos/{index,proveniencia}.ts`, `src/kernel/gateway/writerClinico.ts`, `src/server/estadoDoenca.ts`, `src/server/rotas/confirmacao.ts`, testes dirigidos e estas especificações. Dependências verificadas: `rotas.ts` traduz o erro de proveniência em 409; `scripts/check-boundaries.mjs` proíbe importação direta do writer pelo servidor; `rotas/extracao/{rascunho,revisar}.ts` importam o mesmo predicado de rascunho inerte diretamente do contrato, permitindo remover a última dependência do servidor no writer baixo.

## Limites

G-07/G-08/G-09 não são aplicados indiscriminadamente a evolução, tarefas, administração ou todo FATO. A fonte e os dados de domínio precisam ser demonstrados. F4-05 e os gates semânticos não ficam declarados resolvidos apenas por unificar a porta técnica.

O schema de leitura Fonte permanece compatível com o ledger legado; SHA-256 estrito aplica-se às novas fontes declaradas/verificadas deste lote. Não atualizar hash legado para silenciar recusa.

Chat/F4-12/13: aguarda definição do responsável sobre anotação na evolução versus atualização estruturada de campos escolhidos. Enquanto isso, não inventar uma allowlist clínica nem ampliar autoridade do chat.

## Aceite e estado

Reproduzir antes de corrigir; fixtures sintéticas; fontes e texto manual preservados; entradas documentais rastreáveis; sessão/contexto/schema/idempotência mantidos; sem bypass de revisão/exibição; typecheck, fronteiras, corpus, regressão e CI no head; revisão independente.

Implementado localmente: fontes do Flash preservadas; hashes novos completos sem invalidar replay histórico; revisão documental reconstituída e lote exato, incluindo identidade da revisão; estado-doença e gateway pela porta comum. Validação e gravação usam a mesma transação BEGIN IMMEDIATE, com savepoints para chamadas compostas.

Provas locais: RED observado para fontes perdidas, hashes inválidos, alias FATO@1, referência divergente de revisão e erros HTTP de estado-doença. Os controles positivos verificam gravação real e replay. A fixture documental foi corrigida para incluir as exceções reais do segmento e comparar seu payload integral ao resumo preparado; os testes negativos foram repetidos com esse controle.

Luna: revisão independente sem bloqueadores após correções; 25/25 regressões de extração/transcrição e 32/32 testes adicionais de replay, gateway, confirmação e fronteiras. Codex: 16/16 testes de revisão documental/estado-doença; typecheck, fronteiras (577 arquivos, zero exceções) e corpus (241 arquivos) passaram. CI e integração ainda pendentes. Uma queda nativa anterior de worker Windows não foi contada como sucesso; os arquivos afetados passaram em execução isolada posterior.

Continuidade: concluir CI/revisão do head e merge normal do lote técnico; depois tratar F4-12/13 conforme resposta sobre o chat e revalidar F4-05 por domínio. Não declarar a auditoria L4 inteira encerrada. Conferência adicional do reviewDecisionId interno do recibo de vínculo foi sugerida pela revisão como endurecimento futuro, sem bypass HTTP atual demonstrado.

CI inicial da PR #70 revelou fixtures incompatíveis com a nova integridade: S9 usava literal curto como hash; W10 alterava a origem depois do vínculo para montar cenário INFERRED/UNCERTAIN. Ajustadas apenas essas fixtures: SHA-256 de conteúdo sintético e preparação da origem antes do vínculo. Nenhuma expectativa de assinatura, persistência, impressão ou ausência de promoção foi removida. Luna revisou esse delta; S9 passou 26/26 e W10 11/11, typecheck passou. Total dirigido local: 127 testes. Novo CI necessário. WRITE_SET ampliado para essas duas fixtures por falhas demonstradas no CI.

Próximo lote técnico mapeado por Luna: F4-01 e F4-09 ainda não têm recibo server-side de exibição. Reaproveitar carregamento/seleção já existentes, com hash, revisão, sessão e contexto, antes da liberação com corte/vínculo documental; manter clique médico, motivo e regras de identidade atuais. Não emitir recibos de todas as fontes na listagem global. Ainda não implementado.
