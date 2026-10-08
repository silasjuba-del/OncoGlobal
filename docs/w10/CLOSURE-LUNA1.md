# Closure Luna 1 — F04, F07 e F08

Data: 2026-10-08. Checkout autorizado: `w10-finish-luna1`, branch `closure/w10-luna1`, base `367825e4`. Dados usados apenas em fixtures sintéticas.

## F04 — revisão e identidade

`POST /consulta/rascunho/revisar` consome `AcaoRevisaoPedido` estrito para `LIGAR_PACIENTE`. O cliente informa exceção `UNLINKED_PATIENT`, source/draft, revisão esperada, paciente, encontro/lote e chave idempotente. O servidor confirma sessão e contexto selecionado, resolve `medicoId`/horário no servidor, confronta nome documental e CPF/CNS rotulados com o cadastro e preserva source, hash e trecho no `ReviewDecision`. Divergência retorna `409 CONFLITO_IDENTIDADE_DOCUMENTAL` sem alterar o draft nem criar operação. O evento registra só a decisão de vínculo; nenhum fato extraído é confirmado.

A tela local apresenta o texto original antes de habilitar a associação explícita ao paciente da consulta ativa. O vínculo só aparece como fonte revisável após a gravação da decisão e o aumento de revisão do draft. `confrontarNomeIdentificador` não escolhe paciente.

## F07 — salão

`GET /consulta/salao` inclui atendimentos de agenda como candidatos à triagem, sem criar cartões ou fatos. `POST /consulta/contexto/selecionar` aceita paciente cadastrado com encontro presente em evento clínico, triagem ou agenda ativa do dia. `POST /consulta/salao/triagem` grava os dados inseridos como `SALAO_TRIAGEM_RASCUNHO`, com fonte manual criada pelo servidor, hash e revisão esperada; não cria `Triagem` no ledger.

`POST /consulta/salao/liberar` exige sessão/contexto correspondentes, corte calculado pelo ruleset, motivo não vazio, revisão e chave idempotente. A decisão do médico é registrada por `WriteRouter` como `ReviewDecision`, vinculada ao draft e à revisão; replay é recuperado do ledger após reinício. Reutilizar a mesma chave com conteúdo diferente é negado. Uma nova chave não duplica uma decisão já registrada para a mesma revisão.

## F08 — canal

`POST /consulta/canal/vincular` exige seleção explícita de `patientId` e contexto de sessão compatível, contato e mensagem existentes, origem não revogada e sem ambiguidade. Grava `ClosureVinculoContato` como `ReviewDecision` pelo writer, com `sourceEventId` do Contato original, paciente/encontro/lote escolhidos e actor da sessão. O evento Contato original permanece imutável.

`lerCanal`, `lerConversas` e `lerConsulta` usam `projetarVinculosContato`. A decisão explícita pode projetar o destinatário, enquanto o evento original preserva seu paciente e encontro. Alvos conflitantes ou registros duplicados permanecem sem `patientIdResolvido`; a tela mostra conflito e não oferece botões de vínculo nesse estado. Fontes revogadas também não podem ser vinculadas.

## Cliente local

`/oncoassist.html` usa a porta HTTP real para consulta, salão e canal após login local. O salão preserva os valores digitados em falhas e só apresenta confirmação local após resposta HTTP válida. Liberação mantém a chave de idempotência durante as tentativas da janela de confirmação. A caixa do canal exibe o paciente ativo e o identificador no botão de escolha; erros de sessão, contexto, conflito e persistência aparecem na tela.

## Regressões e validação

Foram adicionados `tests/closure-luna1/f04-vinculo-paciente.test.ts` e `tests/closure-luna1/f07-salao-restart.test.ts`. Eles cobrem conflito documental sem efeitos, sessão/contexto, decisão auditável, replay, draft inerte, revisão stale, motivo obrigatório, reabertura do SQLite, mudança de conteúdo sob a mesma chave e ausência de duplicação. Os testes estão `NOT_RUN` até lease do root. Vitest, typecheck e builds também estão `NOT_RUN`; não houve validação visual em navegador nesta fatia.

Limite de extração de identidade: o confronto usa nome e CPF/CNS quando aparecem com rótulo explícito no texto; ausentes continuam sem evidência e não são inferidos. O canal exige que o destino escolhido esteja no contexto da sessão ativa; incompatibilidade retorna erro sem vínculo.

## Commits locais

- Contratos compartilhados e projeção de vínculo: `c80c87f`.
- Rotas e leitores F04/F07/F08: `940141b`.
- Consumidor de revisão de identidade F04: `62ccf37`.
- Formulário e liberação do salão F07: `ca05867`.
- Interface do canal F08: `6e5f09b`.
- Integração das telas locais com HTTP: `535b91c`.
- Testes sintéticos e este relatório: pendentes de commit final.
