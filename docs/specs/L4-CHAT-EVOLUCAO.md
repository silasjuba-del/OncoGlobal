# L4 — decisão aceita do chat como anotação

Base: main f72fed47 (PR70 integrada). Decisão explícita de Silas em 25/10/2026: aceitar decisão do chat gera somente anotação rastreável na evolução; alergias, medicamentos e TNM ficam nos fluxos próprios.

Codex é o único escritor; Luna revisa e executa testes. WRITE_SET: contratos de anotação/envelope/base V6, módulo chat/decisao, servidor dutos/atendimentoV6, apresentação AtendimentoV6, testes desses fluxos e esta especificação.

Aceite: recusar campo clínico no endpoint; observacao aceita somente texto não vazio e limitado. Persistir evento AnotacaoEvolucao sem campo/valor clínico, com contexto, autor/data do servidor e referência/hash da mensagem original. Replay não duplica nem migra registros históricos. Confirmar contexto interno da mensagem, além do envelope. Recuperar anotações separadas de citações factuais e incluir seção literal somente na evolução, sem preencher conduta, inserir no resumo ou emitir prescrição. Nova anotação desatualiza o rascunho anterior, sem sobrescrevê-lo. Preservar seleção de contexto e autoria médica.

F4-12 é o alvo. F4-13, prova de exibição, não fica declarado resolvido por esta alteração. O endpoint atualmente não tem chamador visual de aceite; não conectar silenciosamente o botão de correção de prescrição do chat a esta operação. A UI V6 apresenta anotações já aceitas, sem novos cliques. Eventos históricos FATO não são reescritos.

Prova inicial RED: o módulo aceitava medicamentos como FATO. A regra nova recusa essa entrada e retorna AnotacaoEvolucao para observacao textual. Testes de jornada devem provar persistência/recuperação, zero novo FATO, contexto, autoria, referência, replay e rascunho desatualizado; revisão independente e CI antes de integrar. Estado: implementação e testes em andamento.

Continuidade: após este lote, corrigir recibos de exibição F4-01/09 e avaliar F4-13 nas operações próprias; preservar motivo/clique médico, aproveitar carregamentos atuais e não alterar regras clínicas.

Revisão Luna final sem bloqueadores. Testes já demonstraram persistência/recuperação, UI HTTP real, ausência em resumo/prescrição, replay e referência inválida como pendência somente da evolução. Ledger permanece append-only inclusive nos testes. A fixture de backup precisou retirar tumorLotId do payload ChatMessage (campo existe no envelope, mas não no contrato interno) e verificar autoria/referência da anotação restaurada em vez do antigo campo/valor. Sem enfraquecimento de expectativas. Tipos e fronteiras passaram; suíte dirigida final e CI em andamento.
