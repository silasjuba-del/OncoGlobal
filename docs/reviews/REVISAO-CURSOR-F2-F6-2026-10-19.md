# Revisão independente do trabalho F2–F6 — 19/10/2026

## Escopo e preservação

- PR examinado: [#27](https://github.com/silasjuba-del/OncoGlobal/pull/27), branch `claude/f2-canal-paciente`.
- F2 publicado inicialmente examinado: `e05b09e98bd245363c537b2bc7fd473fd96c4d2b`.
- Snapshot F3–F6 examinado: `0b00a401eae9fd04deca0a23f86e8d330c49437a`, posteriormente observado também como HEAD remoto do PR.
- Correções em branch própria `codex/f2-canal-review-fixes-20261019`. Nenhuma escrita na worktree ativa do Cursor, em `main` ou nas outras worktrees com WIP.
- Revisores independentes trabalharam somente em leitura e com dados sintéticos. Revisão de código não constitui aprovação clínica nem prova de transporte externo em produção.

## Parecer

**O conjunto F2–F6 não está pronto para fechamento ou merge em main.** Há defeitos reproduzidos e integrações ausentes. O pacote corretivo trata o F2 em isolamento. As alterações concorrentes F3–F6 permanecem com seu escritor; os itens abaixo definem o que precisa ser corrigido e demonstrado antes da integração.

## Correções F2 e reprodução

| ID | Severidade | Reprodução e impacto | Correção |
|---|---|---|---|
| R01 | Alta | From IMAP igual ao cadastro vincula paciente mesmo sem autoria autenticada; risco de atribuição de relato e resposta ao contato incorreto. | From permanece pendente, inclusive nas projeções de registros legados. Replay antigo vinculado retorna `VINCULO_EMAIL_REQUER_REVISAO`; a leitura derivada retorna `null`. Originais são preservados. |
| R02 | Alta | Primeiro relato conhecido empresta seu vínculo a mensagens pendentes do mesmo endereço no resumo. | O conjunto só entra na pré-consulta do paciente quando todos os vínculos são exatos e coerentes. Cache de projeção versionado; inconsistências vão para revisão. |
| R03 | Alta | Nome de terceiro em texto livre é enviado à LLM, inclusive com dicionário vazio substituído por nome sintético. | Remove o nome fictício; desconhecidos e cadastros sem nome usam classificação local. Só sai projeção de vocabulário fechado, sem narrativa ou identificadores. |
| R04 | Alta | “Não tenho febre, tenho falta de ar agora” nega também o segundo sintoma. | Escopo por oração, incluindo “e com”, “apenas com” e “nego”; listas negativas continuam negadas. |
| R05 | Alta | Menção LLM com termo real, trecho inventado e temperatura inventada produz evidência inexistente. | Reconstrói trecho, polaridade e temporalidade na fonte local; não aceita temperatura fornecida pela LLM. Autoria, categoria e momento permanecem determinísticos. |
| R06 | Alta | Sintoma afirmado empresta sua polaridade a outro negado na mesma frase. | Alarme associado ao termo correspondente; alternativa por ocorrência literal na cláusula. Sem alteração de regras ou limiares clínicos. |
| R07 | Alta | Repreparar r1/v1 já confirmada com outro texto conserva autorização para conteúdo anterior. | Versão confirmada imutável; retry idêntico preserva confirmação; v2 revoga saída de v1 e exige nova confirmação. |
| R08 | Moderada | Conflito com `quarentenarConflito=false` e permissão de ACK retorna sucesso sem guardar divergência. | ACK exige quarentena efetivamente persistida; sem ela, transação é revertida. |
| R09 | Moderada | Mesmo segredo em contas diferentes permite trocar keyId externo à assinatura; buffers iguais também reproduzem. | Compara bytes dos segredos por digest e exige accountRef assinado quando o segredo é compartilhado. |
| R10 | Moderada | Envelope de 50 eventos válido no contrato excede guarda JSON anterior. | Orçamento limitado comporta 50 mídias completas; limites independentes de bytes/profundidade permanecem. |
| R11 | Moderada | Hash de mídia válido no contrato é rejeitado no parser ou confundido com comprovação local. | `providerSha256` opcional conserva a alegação; `contentSha256` local permanece nulo. Leitura local confere divergência com a alegação. |
| R12 | Moderada | Writer com checkpoint antigo desfaz bloqueio imposto por mudança de UIDVALIDITY. | Leitura, decisão e atualização sob a mesma transação. |
| R13 | Moderada | Falha de marcação IMAP depois do commit retorna falsamente “não persistida”; Promise pendente pode ser marcada confirmada. | Ingresso IMAP assíncrono, `await` fora da transação e pendência durável por conta/mailbox/UIDVALIDITY/UID; lote vazio retoma tentativas. |
| R14 | Moderada | ACK ou marcação remota após RELEASE de savepoint, antes de commit externo que pode sofrer rollback. | APIs de ingresso recusam transação externa aberta; banco fechado continua produzindo falha estruturada. |
| R15 | Moderada | “37.9” é dividido em duas cláusulas e muda a temperatura extraída. | Ponto decimal preservado, assim como vírgula decimal. |

Os testes novos estão em `tests/f2/review/seguranca-canal.test.ts`. A expectativa antiga de vínculo automático por From em S01 foi substituída por ausência de vínculo; nenhum limiar clínico, skip ou regra em RASCUNHO foi promovido.

### Impacto de contrato e operação

- `ingerirLoteImapCanal` agora retorna Promise e precisa de `await`. Todos os consumidores encontrados nesta base são testes e foram atualizados. O futuro adaptador deve aguardar o resultado e usar a sessão IMAP correspondente ao UIDVALIDITY recebido.
- A marcação remota tem estado próprio: `NAO_SOLICITADA`, `PENDENTE` ou `CONFIRMADA`. Falha remota não desfaz commit local. O callback de marcação deve ser idempotente.
- Uma conta IMAP autenticada não comprova autoria de cada mensagem. É necessário um fluxo de validação da mensagem/vínculo antes de permitir seu uso associado ao paciente e a saída correspondente. Esse fluxo ainda não está conectado à interface.
- Classificador opcional recebe JSON de sinais extraídos, não texto livre. A mudança reduz o escopo da assistência; decisões determinísticas e fonte original local permanecem disponíveis.
- A projeção conserva registros legados inseguros para auditoria, mas bloqueia seu reaproveitamento como vínculo confirmado. Não há migração destrutiva de histórico.

## Bloqueios F3–F6 no snapshot 0b00a40

As referências de linha desta seção pertencem ao snapshot fixo acima. Defeito de helper não significa que o caminho já esteja exposto por HTTP.

| ID | Prioridade | Achado e evidência | Próxima alteração / prova exigida |
|---|---|---|---|
| I01 | Alta | `http.ts:51` chama roteador estático (`rotas.ts:355–411`); os novos servidores F3–F6 não têm despacho real encontrado. Telas F3/F4 usam porta falsa nos testes (`tests/f3/salao-c1-c14-e-adversariais.test.tsx:563`, `tests/f4/apac-farmacia-estoque-laudo.test.tsx:679`). | Contratos, rotas, porta HTTP e telas reais. Caso sintético deve persistir, fechar e reabrir pela interface. |
| I02 | Alta | `src/server/salaoF3.ts:275–283` fabrica hash a partir de ID/versão e trata prescrição como ASSINADO. Helper aceitou paciente/ciclo/prescrição inexistentes em banco vazio. | Resolver prescrição e assinatura no ledger, validar identidade, ciclo e autorização antes da administração. |
| I03 | Alta | `salaoF3.ts:300` grava administração apenas em tabela própria. `baseAjusteAnterior.ts:26` e `kernel/projections/estatistica.ts:7` continuam sem esse evento; probe gravou 100 mg e encontrou zero administrações no ledger. | Emitir evento canônico de administração efetiva e usar sua projeção no próximo ciclo, cumulativos e estatísticas. Manter planejado/prescrito/administrado separados. |
| I04 | Alta | `salaoF3.ts:305–316`: mesmo administrationId, primeiro 100 e depois 150, retorna 150 enquanto o banco conserva 100. | Idempotência por identidade e conteúdo; replay retorna persistido, divergência retorna conflito. |
| I05 | Alta | `f4Acesso.ts:138` salva negativa de APAC em JSON próprio, mas `leituras.ts:616–626` mantém estado antigo. Probe: gravada NEGADA, lida RASCUNHO com motivo nulo. | Projeção canônica integral da decisão, motivo e data; provar `TelaApacLote` após reabertura. |
| I06 | Alta | Login real segue single-user médico (`sessao.ts:25,50`, `oncoassistLocal.ts:49`). RBAC novo recebe DTO candidato (`rbacSetorialF6.ts:96`); testes fabricam profissionais. Rotas de estatística/chat (`rotas.ts:1019,1258`) continuam antigas. | Autenticação real por profissional/setor e autorização no servidor em cada operação. Testar negação por HTTP e isolamento WORK/STUDY. Não foi demonstrado ataque por usuário não médico no login atual. |
| I07 | Moderada | Flags `infusaoSuspensa`, `tarefaNutricaoCriada`, `qtAdiada` em `operacaoSalao.ts:113,143` são salvas como DTO (`salaoF3.ts:130,175`), sem tarefa ou reprogramação correspondente encontrada. | Efeito operacional auditável, responsável e estado persistido; interface deve refletir o ocorrido. |
| I08 | Alta | F2 também tem lacunas de caller: pré-consulta helper em `canalResposta.ts:847` sem carregamento runtime; `leituras.ts:517` mantém `preConsultaPronta:false`. Preparação/confirmação de resposta e transportes não completam jornada HTTP/UI. | Conectar ingresso, vínculo validado, caixa, pré-consulta e confirmação específica. Credenciais externas, sozinhas, não resolvem essa integração. |
| I09 | Moderada | F5 tem helpers/testes diretos de anamnese/voz/revisão; não há prova da jornada real conectada no snapshot. | Caso sintético de roteiro por contexto, voz com consentimento e revisão sob demanda, com persistência e retomada. Não atribuir a F5 defeito clínico adicional apenas pela ausência de integração. |

## Ordem de continuidade

1. Revisar e integrar apenas este patch F2 na branch de trabalho, com autor e WRITE_SET únicos; repetir testes pertinentes no HEAD efetivamente integrado.
2. Fechar I08: relato recebido → vínculo validado → caixa → pré-consulta → confirmação médica → transporte simulado autorizado, pela interface e servidor reais.
3. F3: corrigir I02/I03/I04 e ligar triagem, fila, eventos e contingência. Provar C1–C14 pelo fluxo real e não apenas pelos helpers.
4. F4: corrigir I05; integrar decisão assinada, APAC, prazos/lotes e pedidos da farmácia. Estoque continua informativo, com data/origem, sem edição direta da prescrição.
5. F5: integrar roteiro de anamnese, voz consentida e revisão assistida sob demanda, preservando a fonte única.
6. F6: conectar autenticação/RBAC real, telas por setor, comunicação auditada, WORK/STUDY e denominadores das estatísticas.
7. Atualizar os relatórios de fase distinguindo implementado, integrado, validado tecnicamente e aprovado clinicamente. Só então revisar o PR de main sobre seu HEAD exato.

## Validação

- Primeiro red test: 17 falhas / 24 testes no F2 publicado, antes das correções.
- Rodada ampliada: 84/84 testes F2, incluindo 34 novos testes de regressão.
- Typecheck passou após a alteração assíncrona do IMAP.
- Três revisores independentes deram parecer técnico favorável ao segundo diff, sem novos P1/P2 reproduzíveis no recorte F2 corrigido.
- Build de UI e harness B2 Chromium passaram, incluindo reinício do servidor e reabertura do SQLite.
- Typecheck, fronteiras e corpus passaram na verificação geral. A primeira execução do scanner PHI identificou diferenças entre índice e worktree; após inclusão explícita dos arquivos revisados no índice, o reteste passou 14/14, sem alteração de critérios.
- O resultado integral da árvore de merge deve ser conferido nos checks do PR corretivo. Este relatório não substitui esses checks.
- Manifesto local de preservação confirmou os nove arquivos WIP antigos com os mesmos hashes e main intacta em `6c1c6d3b679775825a72fd97df9b53ad7934bdf8`.
- Testes não comprovaram fornecedor externo real, disponibilidade 24 horas, curadoria médica dos redflags ou fechamento das fases F3–F6.
