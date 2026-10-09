# A3 — integração dos comportamentos W11/W12 e closure Astra

Base integrada: 6451274 (código f42b15f). Entrada: c0c0762.

- Rotas e tipos HTTP: união das jornadas de vínculo, reconciliação, salão e canal com Flash e projeções longitudinais.
- Triagem: plausibilidade do integrado preservada junto da pendência por conflito de Hb e verificação de origem/unidade.
- Extração: detector W11 continua exportado; extração F01 conserva literal suspeito mesmo ao lado de fármaco limpo; Gleason/ISUP e plano futuro preservados.
- Pipeline: deduplicação de conteúdo na mesma fonte preservada; confronto documental multifonte preserva fontes. A função deduplicarFatos aceita a chamada legada de um argumento e a chamada multifonte de dois argumentos com retornos tipados.
- Vínculo: confronto legado de nome mantém excecao; caminho com cadastro completo acrescenta liga e valida nome e identificadores, sem executar vínculo.
- Gateway: o merge textual criou duas funções autorizarLeitura. A autorização de pedido estruturado recebe o nome autorizarPedidoLeitura; a política de leitura externa desligada mantém autorizarLeitura. Transportes continuam somente injetados, nenhum conector externo foi ativado.
- RT01, RT03 e RT15 do integrado foram restaurados integralmente. As versões Astra entram em arquivos `*-astra-adicional.adv.ts`; nenhuma prova foi excluída.

## Ajuste explícito de prova por incompatibilidade de representação

Autorização técnica da orquestradora em A3: em `tests/kernel/extracao/homoglifo-regime.test.ts`, o teste H4 exigia a sugestão normalizada dentro do valor do extrator, enquanto F01 exige o literal bruto nesse mesmo valor. As representações eram incompatíveis. O teste H4 passa a exigir o literal exato na extração **e** a mesma sugestão CISPLATINA na etapa real de normalização, além da confirmação obrigatória. Nenhuma exigência clínica foi retirada; foram acrescentadas asserções. Os testes do red team não foram editados.

O primeiro reataque focal encontrou 146 PASS / 2 FAIL: a mensagem do conflito contextual não mostrava os dois fármacos (corrigida para conservar ambos), e F05 antigo exigia corte com Hb=9 dg/dL, contrário à faixa já publicada no ruleset W11/RT07 (30–250). A orquestradora autoriza corrigir o estímulo dessa prova para 70 dg/dL com origem 9 g/dL: conserva o corte válido e a discordância; acrescenta uma prova específica do estímulo original 9 dg/dL exigindo as duas pendências e nenhum corte inferido. Nenhuma faixa clínica foi alterada e RT07 permanece intacto.

## Regressões de interface após a bateria completa

A3 inicial: todos os blocos PASS salvo UI/Muse (120 PASS / 10 FAIL). Redteam ampliado 240/240; W8 41/41. O bloco closure adicionou 64 testes em 13 arquivos.

- Porta falsa do salão não publicava a revisão das triagens sintéticas que seus cartões representam. Passa a expor draft/revision e incrementar ao salvar; o gate real de revisão na TelaSalao permanece.
- Testes unitários de FormTriagem leem a saída antes da conclusão do novo onSalvar assíncrono. Alteração autorizada pela orquestradora: aguardar a mesma saída, conservando todas as asserções de corte, ausência e persistência.
- Teste do QuadroSalao precisa conferir também o novo argumento idempotencyKey; paciente e motivo continuam obrigatórios e a chave tem formato validado.
- Muse exigia 501/CAPACIDADE_PENDENTE para três rotas que F07/F08 implementaram. A prova passa a exigir 401 sem sessão e 400/PAYLOAD_INVALIDO com corpo inválido, sem operação nem evento clínico. Jornadas closure continuam provando a gravação autorizada. Não se reintroduz stub para silenciar a prova antiga.

Revalidação focal das correções de UI/Muse: 17/17 PASS. Repetição do bloco UI+closure UI: 130 PASS / 1 FAIL (Ctrl K em layout.test.tsx). O arquivo isolado passou 6/6: INSTÁVEL SOB CARGA, não verde por essa execução isolada. O teste disparava a tecla antes de aguardar o efeito que instala o listener após carregar a agenda; passa a aguardar act/render e as mesmas transições visuais, sem repetir a tecla nem retirar asserções. Reataque completo: 131/131 PASS em 49 arquivos, registrado em A3-ui-reataque.log. Não houve alteração de asserção em tests/ui-telas/percursos.test.tsx nem no redteam. O portão A6 repetirá a bateria inteira após as sobras e o planejamento.
