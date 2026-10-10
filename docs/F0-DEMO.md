# Demo F0 — percurso sintético executado

Executada em 09/10/2026, entre 19:41 e 19:45 (America/Sao_Paulo), sobre `db1c550` mais a correção do formato de data no inicializador da demo. Chromium real controlado pelo Playwright CLI, Vite local, API HTTP real e SQLite temporário. Nenhum mock de resposta de rede. Paciente e médico exclusivamente sintéticos. Provider externo explicitamente desligado e conferido pela API de status.

## Reproduzir (roteiro de aproximadamente dez minutos)

1. `node node_modules/vite/bin/vite.js build --config scripts/vite-f0-demo.config.mjs`
2. Em um terminal, `node dist/f0-demo/demo-servidor.mjs`. Sempre cria banco temporário novo. Porta padrão da API: 4197. O terminal informa a senha de demonstração sintética.
3. Em outro terminal PowerShell: `$env:ONCOGLOBAL_API_PORT='4197'` e `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5197 --strictPort`.
4. Abrir `http://127.0.0.1:5197/oncoassist.html` e entrar com a senha sintética informada.

O inicializador cadastra somente Paciente Teste 92, encontro, lote, agenda e APAC incompleta; ingere três textos pela API real, ainda sem vínculo ou confirmação. Não representa upload de PDF pela interface. As ações seguintes foram efetuadas nos controles visíveis.

| Tempo sugerido | Ação e resultado observado | Prova automatizada |
|---|---|---|
| 0–1 min | Abrir Salão e salvar triagem vazia. Destino FILA_MEDICO, ausências e tontura desconhecida explícitas. | `tests/f0-fecha/flash-producao.test.tsx`; `tests/w10-luna2/` |
| 1–3 min | Selecionar Paciente Teste 92 na agenda e abrir Consulta. Conferir texto original e vincular explicitamente AP, laboratório e encaminhamento, um a um. | `tests/f0-fecha/consulta-completa.test.ts`; `tests/f0-fecha/auditoria-escopo.test.ts` |
| 3–4 min | Marcar as três fontes e confrontar. Creatinina 1,2 × 1,8 na mesma data aparece em conflito; nenhum candidato é eleito. | `tests/f0-fecha/consulta-completa.test.ts` |
| 4–5 min | Selecionar a fonte AP, marcar o achado, preparar e conferir o resumo, confirmar a revisão exibida. | `tests/f0-fecha/consulta-completa.test.ts` |
| 5–6 min | Reabrir histórico/consulta. Cartão mostra histologia literal com fonte e data; estágio e demais ausências continuam não informados. | `tests/f0-fecha/retrato-ledger.test.ts` |
| 6–7 min | Configurações Flash: pré-marcar laboratório e salvar modelo no servidor. Voltar à consulta, abrir Flash, informar retorno em 30 dias. | `tests/f0-fecha/flash-producao.test.tsx` |
| 7–8 min | Revisar documentos para assinatura. Ler os textos completos de evolução, pedido de laboratório e retorno; confirmar e assinar o conteúdo exibido. | `tests/f0-fecha/consulta-completa.test.ts`; `tests/f0-fecha/c2-consulta-local.test.tsx` |
| 8–9 min | Reabrir histórico; recarregar a página, entrar novamente e selecionar o paciente. Os mesmos três documentos assinados reaparecem. | `tests/f0-fecha/consulta-completa.test.ts` (inclui fechar/reabrir SQLite) |
| 9–10 min | Abrir APAC. Rascunho incompleto, achados de antiglosa com fontes, SIGTAP pendente e exportação bloqueada. | `tests/f0-fecha/c2-apac-local.test.tsx`; `tests/apac/` |

## Capturas reais

Todas as nove imagens abaixo foram abertas e inspecionadas pela Astra. São capturas locais do caso sintético desta demo; a disposição PHI é individual por arquivo e SHA-256 em `f0-fecha/PHI-TRIAGEM.json`.

1. [Salão e pendências](f0-fecha/demo/01-salao.png)
2. [Conflito com as duas fontes](f0-fecha/demo/02-conflito.png)
3. [Resumo exibido antes da confirmação](f0-fecha/demo/03-revisao.png)
4. [Histologia no cartão com proveniência](f0-fecha/demo/04-cartao.png)
5. [Modelo Flash gravado](f0-fecha/demo/05-modelo.png)
6. [Conteúdo completo antes da assinatura](f0-fecha/demo/06-exibicao.png)
7. [Histórico após assinatura](f0-fecha/demo/07-historico.png)
8. [APAC rascunho e antiglosa](f0-fecha/demo/08-apac.png)
9. [Histórico após recarga e nova sessão](f0-fecha/demo/09-reabertura.png)

## Medição e limites observados

O roteiro limpo acima contém 31 ações (incluindo preenchimento da senha e entrada) de formulário/navegação até APAC, contando seleção, marcação, preenchimento e clique como uma ação cada; recarga/login/seleção para a prova adicional de reabertura acrescentam quatro. É uma contagem do roteiro, não telemetria de tempo de atendimento. E6b imprime suas próprias métricas HTTP, ações equivalentes e correções nos logs da bateria. A execução interativa incluiu inspeções e repetição de seletores; não é benchmark de dez minutos.

Antes da rodada válida, os documentos do inicializador usavam data ISO, não reconhecida pelo extrator literal atual. A comparação recusou com DATA_CLINICA_PENDENTE (duas tentativas). Corrigiu-se apenas a fonte sintética para dia/mês/ano, reiniciando em banco novo. O parser não foi relaxado. Houve ainda um 404 de favicon e seletores de automação corrigidos; esses registros foram preservados localmente em `.git/f0-fecha-audit/playwright-demo-20261009/`.

A histologia foi o único fato promovido nesta demo; os valores laboratoriais conflitantes permaneceram nas fontes, sem promoção. O pedido de laboratório gerado contém itens PENDENTE e demonstra persistência/assinatura, não uma solicitação clínica completa. Não houve impressão, transmissão, prescrição de antineoplásico ou exportação APAC. A grade de poltronas exibida abaixo do salão é o componente ilustrativo já rotulado como sintético; não comprova agendamento persistido. A interface ainda tem apresentação básica, identificação duplicada no salão e textos de rascunho preservados no documento assinado: registrar para aprimoramento F1 sem confundir com validação clínica.
