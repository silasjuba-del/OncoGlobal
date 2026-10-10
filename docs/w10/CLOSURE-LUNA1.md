# Closure Luna 1 — F02/F03, F04, F07 e F08

Data: 2026-10-08. Checkout autorizado: `w10-finish-luna1`, branch `closure/w10-luna1`, base `367825e4`. Dados usados apenas em fixtures sintéticas.

## F04 — revisão e identidade

`POST /consulta/rascunho/revisar` consome `AcaoRevisaoPedido` estrito para `LIGAR_PACIENTE`. O cliente informa exceção `UNLINKED_PATIENT`, source/draft, revisão esperada, paciente, encontro/lote e chave idempotente. O servidor confirma sessão e contexto selecionado, resolve `medicoId`/horário no servidor, confronta nome documental e CPF/CNS rotulados com o cadastro e preserva source, hash e trecho no `ReviewDecision`. Divergência retorna `409 CONFLITO_IDENTIDADE_DOCUMENTAL` sem alterar o draft nem criar operação. O evento registra só a decisão de vínculo; nenhum fato extraído é confirmado.

A tela local apresenta apenas o trecho do segmento selecionado antes de habilitar a associação explícita ao paciente. O `ReviewDecision` guarda `segmentId`, exceção, origem e decisão; fatos de outros segmentos são rejeitados na promoção. `confrontarNomeIdentificador` não escolhe paciente. A chamada legada com exatamente `draftId`, `expectedRevision` e `patientId` continua compatível como vínculo de identidade sem fatos; sem consulta selecionada, o escopo identity-only é resolvido por leitura do prontuário, sem abrir nem alterar a sessão. Uma gravação com mais de um segmento `UNLINKED_PATIENT` é recusada no caminho legado; o comando novo exige exceção explícita.

## F07 — salão

`GET /consulta/salao` inclui atendimentos de agenda como candidatos à triagem, sem criar cartões ou fatos. `POST /consulta/contexto/selecionar` aceita paciente cadastrado com encontro presente em evento clínico, triagem ou agenda ativa do dia. `POST /consulta/salao/triagem` grava os dados inseridos como `SALAO_TRIAGEM_RASCUNHO`, com fonte manual criada pelo servidor, hash e revisão esperada; não cria `Triagem` no ledger.

`POST /consulta/salao/liberar` exige sessão/contexto correspondentes, corte calculado pelo ruleset, motivo não vazio, revisão e chave idempotente. A decisão do médico é registrada por `WriteRouter` como `ReviewDecision`, vinculada ao draft e à revisão; replay é recuperado do ledger após reinício. Reutilizar a mesma chave com conteúdo diferente é negado. Uma nova chave não duplica uma decisão já registrada para a mesma revisão.

## F08 — canal

`POST /consulta/canal/vincular` exige seleção explícita de `patientId` e contexto de sessão compatível, contato e mensagem existentes, origem não revogada e sem ambiguidade. Grava `ClosureVinculoContato` como `ReviewDecision` pelo writer, com `sourceEventId` do Contato original, paciente/encontro/lote escolhidos e actor da sessão. O evento Contato original permanece imutável.

`lerCanal`, `lerConversas` e `lerConsulta` usam `projetarVinculosContato`. A decisão explícita pode projetar o destinatário, enquanto o evento original preserva seu paciente e encontro. Alvos conflitantes ou registros duplicados permanecem sem `patientIdResolvido`; a tela mostra conflito e não oferece botões de vínculo nesse estado. Fontes revogadas também não podem ser vinculadas.

## F02/F03 — proposta de reconciliação multifonte

`POST /consulta/rascunho/reconciliar` aceita somente IDs de drafts. Para cada origem, o servidor confere o paciente/encontro/lote selecionados, revisão, segmento vinculado e `ReviewDecision` persistida pelo writer com actor da sessão atual. As confirmações passadas ao pipeline são reconstruídas desses eventos, nunca do corpo HTTP. Gravações com IDs colidentes, fontes sem vínculo/decisão ou data clínica ausente, inválida ou divergente permanecem pendentes. A data vem de fatos explícitos com trecho que contém a mesma data normalizada; captura, cabeçalho ou data de importação não servem como substituto.

O pipeline recebe a gravação principal e `additionalSources` locais, com `recordingId` distintos. O resultado filtra segmentos, fatos, campos e conflitos ao(s) segmento(s) ligado(s); outros trechos da mesma gravação não são atribuídos nem enviados ao cliente por esta resposta. Dedupe e conflitos são propostas, mantêm todas as fontes/fatos e não criam operações, eventos ou fatos. A tela local permite selecionar várias fontes vinculadas e mostra conflitos, repetições e trechos preservados para revisão médica, sem ação de promoção ou exclusão.

Quando o ruleset ou a data civil do Salão não estiver disponível, `POST /consulta/salao` retorna `503` com envelope de pendência. A UI mostra erro acessível e opção de recarregar; não fabrica regras nem fonte.

## Cliente local

`/oncoassist.html` usa a porta HTTP real para consulta, salão e canal após login local. O salão preserva os valores digitados em falhas e só apresenta confirmação local após resposta HTTP válida. Liberação mantém a chave de idempotência durante as tentativas da janela de confirmação. A caixa do canal exibe o paciente ativo e o identificador no botão de escolha; erros de sessão, contexto, conflito e persistência aparecem na tela.

## Regressões e validação

Foram adicionados `tests/closure-luna1/f04-vinculo-paciente.test.ts`, `f07-salao-restart.test.ts` e `f03-reconciliar-fontes.test.ts`. Cobrem conflito nome × CNS válido via HTTP, vínculo legado identity-only, recusa de vínculo ambíguo, bloqueio de fatos de segmentos alheios, data comum e repetição preservada, ausência de efeitos, draft inerte, revisão stale, motivo obrigatório, reabertura do SQLite e replay. Os testes multifonte/segmento desta atualização estão `NOT_RUN` por lease serial do root; não houve build ou validação visual nesta atualização.

Limite de extração de identidade: o confronto usa nome e CPF/CNS quando aparecem com rótulo explícito no texto; ausentes continuam sem evidência e não são inferidos. O canal exige que o destino escolhido esteja no contexto da sessão ativa; incompatibilidade retorna erro sem vínculo.

## Commits locais

- Contratos compartilhados e projeção de vínculo: `c80c87f`.
- Rotas e leitores F04/F07/F08: `940141b`.
- Consumidor de revisão de identidade F04: `62ccf37`.
- Formulário e liberação do salão F07: `ca05867`.
- Interface do canal F08: `6e5f09b`.
- Integração das telas locais com HTTP: `535b91c`.
- Regressões sintéticas e relatório: `541b8b9`.

Commits posteriores de compatibilidade/integração nesta branch: Fugu F01 `51accf4`, F02 `9d90d09`, F03 `d6635e8`; typecheck `dc93671`; salão global sob lote selecionado `c2b500a`. O consumidor multifonte, os guards de segmento, o fallback legado e as regressões correspondentes seguem em commits posteriores.
