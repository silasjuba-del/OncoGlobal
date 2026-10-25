# Fechamento integral L4

Pedido em 25/10/2026: concluir todos os 42 achados antes da rodada de acabamento UI/UX. Base `b3909b745bf655e4598af7b2bbbd2d4e076e92d4`. Codex é único escritor; Lunas fazem leitura, revisão independente e execução de testes. Preservar trabalho concorrente, corpus e demonstração congelada. Integração somente por PR/checks, sem bypass.

Critério por achado: reproduzir e corrigir com prova; ou demonstrar que não é defeito/foi superado por decisão explícita. Ausência de chamador não equivale a aprovação de segurança. Órfãos permanecem sem ativação. Aprovação clínica e encerramento técnico são estados distintos. Não declarar conclusão enquanto houver defeito reproduzível aberto ou decisão clínica necessária sem resposta.

## Sequência e fronteiras

1. Provas de exibição e intenção: F4-01/09/11/13/15. Sessão, contexto, finalidade, conteúdo/hash e revisão; nenhum recibo originado apenas de eco do cliente. Preservar replay legítimo e não acrescentar cliques desnecessários.
2. Recusas técnicas e integridade: F4-06/17/24/25/28/29/30/40 e residuais demonstrados. Sem alterar critérios clínicos ou promover regras RASCUNHO.
3. Domínios clínicos: F4-03/04/05/19/27/31/34/35/42. Usar regras existentes; decisões clínicas via perguntas clicáveis. Não inventar dados para satisfazer gate.
4. Consolidar os 42 IDs com evidência/testes/revisão e integração. Reexecutar jornadas afetadas e CI. Só então liberar acabamento UI/UX como próxima etapa.

WRITE_SET inicial: `src/server/sessao.ts`, helper de exibição, `rotas/salaoCanal.ts`, `rotas/extracao/{rascunho,revisar}.ts`, `canalResposta.ts`, consumidores de leitura/UI necessários e testes associados. Expansões por causa demonstrada devem ser registradas neste documento antes da integração. Arquivos compartilhados sempre sob responsabilidade de Codex.

## Estado inicial da revalidação (histórico; fechamento abaixo)

| IDs | Estado conhecido nesta base |
|---|---|
| 02,07,10,12,14,18,32,33,41 | Correções integradas em PRs anteriores; conferir cobertura na matriz final |
| 16,22 | Fluxos preservados por decisão explícita do médico |
| 08 | Duplicidade alegada não demonstra divergência funcional; comparador canônico reutilizado |
| 20 | RECIST corrigido; catálogo de lotes é deliberadamente por paciente |
| 23 | F6 parado por decisão explícita, sem ativação |
| 26 | Lista vazia atestada explicitamente na UI; não equivale à ausência silenciosa de dados |
| 01,03,04,05,06,09,11,13,15,17,19,21,24,25,27,28 | Abertos ou requerem qualificação adicional; auditoria estática não basta para encerrar |
| 29,30,31,34,35,36,37,38,39,40,42 | Revalidação independente em andamento |

As primeiras respostas de auditoria sobre F4-12 e F4-15 foram corrigidas após confronto com os caminhos reais: F4-12 foi corrigido em PR71/72; F4-15 refere confirmação de resposta externa, não leitura de mídia.

Decisões de Silas recebidas em 25/10: G07/G08 divergentes exigem ciência explícita e permitem confirmação após revisão médica, preservando a divergência; demais fatos seguem. Cumulativo indeterminado: aviso na tela a partir do quarto ciclo, repetido a cada ciclo, sem clique adicional; não converter essa ausência em liberação por inferência nem alterar as regras já existentes para limite comprovadamente excedido. Corpus de dose RASCUNHO pode propor, sempre com aviso literal CHECAR DOSE. Medicamentos exibidos: somente confirmados no encontro atual; não inferir suspensão clínica por ausência.

Limite da prova de exibição: o servidor comprova que entregou o conteúdo na sessão/contexto exigidos, não que o médico leu pixels. A interface e os testes de jornada completam a evidência sem prometer prova física de leitura.

## Matriz de tratamento dos 42 achados

A matriz abaixo registra o tratamento de cada ID. O estado inicial aguardava revisão/CI; os resultados da retomada estão na seção final deste documento. Nenhum arquivo em corpus foi alterado. A integração exige que os checks também aprovem o HEAD que contém o registro final.

| ID | Tratamento / prova |
|---|---|
| 01 | Recibo de sessão do corte, dados/fontes/versão exibidos, hash revalidado antes de liberar. `g2-contratos-contexto-http`, `l4-exibicao-sessao` e UI salão. |
| 02 | PR70 preserva fontes declaradas e replay histórico. `l4-proveniencia-confirmacao`. |
| 03 | Avaliação usa fatos normalizados e entradas documentadas; ausência é PENDENTE, não objeto vazio fingindo avaliação. `kernel/extracao/l4-gates`. |
| 04 | p/ypTNM exige espécime explicitamente rotulado e literal documentado; desconhecido/biópsia não promove FATO. `l4-gates-extracao`. |
| 05 | Preparação e porta comum reavaliam gates da extração; G07/G08 ALERTA exige ciência exata, preservada no recibo/fato; G09 não aprovado permanece candidato. Replays antigos não são migrados. `l4-gates-extracao`, `l4-proveniencia-extracao`. |
| 06 | Recusas e exceções de prescrição auditadas com códigos seguros; sessão/contexto não viram erro genérico. Falha da auditoria é explicitada sem mascarar a recusa. `l4-prescricao-auditoria`. |
| 07 | PR70 usa a porta comum em estado-doença. `fase2/estado-doenca`. |
| 08 | Não defeito: preparação de evidência local usa comparador canônico; duplicação de extração textual não prova divergência de regra. |
| 09 | Vínculo exige recibo da fonte entregue naquela sessão/contexto/revisão; UI seleciona e carrega a fonte antes do clique existente. `g3-vinculo-atomico`, `oncoassist-local/revisao-http`. |
| 10 | PR67 isola leitura dos drafts por paciente/encontro/lote. `auditoria-isolamento-fontes`. |
| 11 | REGRA_CLINICA exige autorizacaoMedica explícita no pedido; botões de salvar enviam a intenção, servidor não a fabrica. `http-config-real`, `flash-producao`. |
| 12 | PR71/72 restringem chat a anotação de evolução, sem atualização de campo clínico. `atendimento-v6`, `ui-telas/atendimento-v6-http`. |
| 13 | Dutos exigem recibos das fontes efetivamente entregues (consulta/chat/fila), além do hash de pedido. Repetição não duplica decisão. `l4-dutos-exibicao`, `http-dutos`. |
| 14 | PR68 valida emissão/expiração nos caminhos do gateway. `auditoria-sessao-canal`, testes S11. |
| 15 | Primeira autorização de resposta externa exige recibo da mesma sessão; eco do cliente não basta. Replay de autorização existente preserva autoria. `pr27-autorizacao-proveniencia`. |
| 16 | Decisão explícita: permitir transcrição LLM não verificada antes do vínculo; não é confirmação clínica. `documentoOriginal`, `transcricao-http`. |
| 17 | Ruleset de red flags indisponível deixa mensagem pendente, sem PROCESSADA. RASCUNHO legível continua distinto de indisponibilidade técnica. `reconciliacao-clinica`. |
| 18 | PR68 mantém pendência quando não há processador. `auditoria-sessao-canal`. |
| 19 | Ficha usa as mesmas opções de leitura de segurança da consulta e conserva os avisos na proposta. `l4-ficha-seguranca` demonstra FEVE/interação/teto com e sem entradas de regra, sem alterar corpus. |
| 20 | RECIST corrigido na PR67; listagem de lotes é catálogo do paciente, não leitura do encontro. `auditoria-isolamento-fontes`. |
| 21 | Mensagem global sem vínculo não devolve nomes de todo cadastro: candidatos restritos ao paciente selecionado, nenhum sem contexto. `l4-canal-candidatos`. |
| 22 | Decisão explícita preserva fila global, identificada como não vinculada à consulta. `drafts-sem-vinculo-carga`. |
| 23 | F6 permanece deliberadamente sem ativação para o serviço de um médico. Ausência de caller não é falha do login atual. |
| 24 | Contingência deriva E1 confirmado do servidor mesmo se cliente manda false; replay antigo sem banner diante de E1 atual é recusado sem reescrever folha. `m10-ciencia-alertas`. |
| 25 | Omissão de verificação determinística deixa revisão F5 bloqueada; lista explícita é distinta de omissão. `anamnese-voz-oncochief`. |
| 26 | Não é inferência de ausência: lista vazia exige atestação médica explícita na UI/rota. `medicamentos-ui`. |
| 27 | Lista de alergias contém somente itens positivos; negação/conflito/fontes são estados separados. `contexto-clinico`. |
| 28 | Leitura, autorização e impressão compartilham prova de assinatura com autor/hash/revisão coerentes. `impressao-runtime`, `cp001-autorizacao`. |
| 29 | Seleção legada de template recusa ID ambíguo; não elege versão silenciosamente. Curadoria continua exigida no cálculo, e fluxo de fichas mantém versão/hash. `l4-dominios-projecao`. |
| 30 | Decisão explícita permite proposta RASCUNHO com CHECAR DOSE visível, sem aprovação automática. `proposta-dose`. |
| 31 | Não defeito: intervalo sem fonte/ficha aplicável permanece PENDENTE, falha fechada. Não ativar regra sem curadoria. `intervalo-ciclo`. |
| 32 | PR68 bloqueia revogação indeterminada. `pr27-autorizacao-proveniencia`. |
| 33 | PR68 usa vínculo vigente, não vínculo histórico isolado. `infusao-vinculo`. |
| 34 | Decisão explícita: cumulativo indeterminado avisa desde ciclo4, repetido por ciclo sem clique; limites efetivamente excedidos preservam regra anterior. `l4-dominios-projecao`. |
| 35 | Indicação de imagem ausente fica PENDENTE; resumo não é usado como indicação. `integracao-flash`. |
| 36 | Helpers F3 legados sem caller não são ativados; liberação/contingência atuais têm rotas próprias. Classificado como inventário de integração, não defeito executável. |
| 37 | Helper legado de pré-consulta não é ativado por existir; fluxo atual de relatos usa projeção própria vinculada. Não declarar esse helper integrado. |
| 38 | Alertas arbitrários do chamador F5 ficam separados como relatos não verificados; não alimentam alertas calculados. Módulo continua sem ativação. `pr27-respostas-fontes`. |
| 39 | Removido override de autoria da assinatura F4; campo indevido é recusado, inclusive em replay. Módulo continua sem rota ativada. `pr27-assinatura-atomica`. |
| 40 | Não defeito: CONFIRMADO/DECISAO_MEDICA qualifica entrada explícita do médico; documentos produzidos continuam RASCUNHO até revisão/assinatura. `s9/consulta`, jornadas Flash. |
| 41 | PR68 bloqueia relógio inválido. `auditoria-sessao-canal`. |
| 42 | Lista visível só traz confirmação deste encontro. Referência interna conserva concorrência/linhagem sem mostrar a lista anterior; nova lista exige atestação. Ausência não suspende medicamentos por inferência. `l4-dominios-projecao`. |

WRITE_SET expandido conforme causas demonstradas: gates de extração/porta comum e contratos de revisão; autorização/resolver de documentos; configuração; projeções de alergias/medicamentos/cumulativo; origem de ficha; contingência; canal; helpers F4/F5 sem ativação; testes e fixtures dessas jornadas. Codex revisa e integra as contribuições de testes dos Lunas.

Decisão final de integração dos órfãos: Silas escolheu manter F3/F4/F5 inativos e documentar o limite de integração; F6 continua parado. Não há nova ativação autorizada neste lote.

CI inicial da PR73 identificou fixtures que não faziam leitura prévia e envelopes sintéticos de assinatura sem reviewDecisionId. Corrigir setups pela jornada real/contrato atual, preservando assertions e controles negativos. A revisão independente também encontrou ruído G08 sem anatomia e associação indevida de material atual com TNM histórico/indeterminado: corrigidos com aplicabilidade explícita e teste adversarial; múltiplos TNM sem material individualizado permanecem pendentes.

Revisão independente do delta: Luna validou G08/G09 e adiamento dos recibos até resposta HTTP 2xx concluída, incluindo contrato inválido e novo E1 em replay. Recibo comprova entrega HTTP do conteúdo, não percepção visual humana. Expiração no flush mantém falha fechada. Bateria dirigida atual: 20/20 (gates, dutos e E1), typecheck aprovado; suites de integração e CI ainda pendentes. Loader de ruleset em jornada jsdom corrigido por caminho nativo, sem curadoria/ativação de sinais.

Validação adicional histórica por Luna: 42/42 testes (seis jornadas de vínculo e três baterias administração/exposição/canal), F3 5/5 e erro UI canal 1/1. Bateria root de cinco arquivos: 34/35; fixture S03 corrigida por carregar ruleset real no lugar de null, rerun pendente naquela passagem. A bateria ampla sinalizou uma falha; esse registro histórico não indica processo ainda ativo.

## Retomada aprovada — lotes A–F, 25/10/2026

Plano apresentado no chat e aprovado explicitamente por Silas: executar A–F, integrar PR73 após todos os gates e disponibilizar versão sintética isolada para UI/UX. Base confirmada: main b3909b745bf655e4598af7b2bbbd2d4e076e92d4; branch codex/l4-fechamento, HEAD inicial fc91c33f0a26f38fdbbe63e7ff6854f8ce96c1a5. Codex escreve produto/documentação; Luna revisa independentemente e executa provas. Perguntar somente nova decisão clínica.

- A: preservar os três testes WIP; S9 deve recusar dose pendente mesmo diante de recibo de replay existente; A13 deve exigir conteúdo entregue, código exato de adulteração e nenhuma escrita clínica/operação. PR27 aguarda fila/contexto e botão habilitado. Investigar S8 e eRx sem aumentar timeout.
- B/C: revisão independente do diff de proveniência, recibos HTTP, contexto, gates e projeções; corrigir apenas causas demonstradas. F3/F4/F5/F6 permanecem inativos conforme decisões registradas.
- D: jornadas HTTP/UI, replay, persistência/reabertura, isolamento e respostas tardias; dados sintéticos e recursos isolados.
- E: matriz de 42 IDs com prova final, revisão independente do delta final, CI atual e merge normal sem bypass, preservando branches.
- F: build do commit integrado, nova demonstração sintética isolada; conferir processo, versão, dados, URL e reabertura antes de declarar disponibilidade para UI/UX.

WRITE_SET da retomada: três testes WIP; tests/f1/s8/revisao-atualiza-consulta.test.tsx (Luna responsável exclusivo por eventual correção de sincronização, Codex revisa), este documento; tests/server/prescricao-executavel-http.test.ts e módulos causais somente se houver defeito demonstrado. Demais arquivos de produto da PR73 permanecem sob Codex. Corpus, demonstração congelada e cinco documentos não rastreados da main preservados. Evidências históricas não substituem gates do HEAD final.

Estado na passagem inicial (histórico): lote A em execução; revisões B/C e preparação somente leitura de F em paralelo. CI inicial bloqueada por mocks sem res.once, sincronização PR27/S8 e gate agregado. Próxima prova naquela passagem: S9/A13/PR27 dirigidos, S8/eRx por Luna; depois baterias e CI finais.

Primeiro marco histórico da retomada: S9/A13/PR27 passaram 13/13 por HTTP real, incluindo replay legado recusado antes do gateway e adulteração com código exato/ledger preservado. Typecheck, fronteiras (585 arquivos, zero exceções) e corpus (241 arquivos) passaram. S8 passou 14/14 por Luna sem alteração; eRx e bateria B/C ainda estavam em execução. Estes resultados isolados não liberavam merge antes da revisão independente e CI final.

## Fechamento técnico da revisão e das provas — base 026c708 e correção residual G-09

No commit 026c708, o código de produto não divergia de fc91c33; esse commit incorporou deliberadamente os três testes WIP e o registro de continuidade. Depois dessa validação inicial, o reataque demonstrou o residual G-09, corrigido no delta descrito abaixo e sujeito a nova CI completa. Revisores independentes gpt-6-luna: agente mapa para produto B/C e delta G-09; agente fontes para testes S9/W3/PR27, bateria B/C e documentação; agente catalogo para S8/eRx/Chromium. Nenhum revisor escreveu produto ou aprovou clinicamente o sistema.

| Estado dos 42 IDs (sem duplicação) | IDs |
|---|---|
| Correção já integrada antes da PR73, regressão incluída na suíte completa | 02,07,10,12,14,18,20,32,33,41 |
| Implementação da PR73 revisada; validação inicial 026c708 complementada pelo RED/correção/revalidação G-09 (04/05); integração condicionada à nova CI do HEAD final | 01,03,04,05,06,09,11,13,15,17,19,21,24,25,27,28,29,35,42 |
| Não defeito conforme contrato documentado; controles preservados | 08,26,31,40 |
| Decisão médica recebida e comportamento preservado, sem nova aprovação clínica inferida | 16,22,30,34 |
| Módulo legado/inativo: correções internas e limites registrados, nenhuma ativação | 23,36,37,38,39 |

A relação acima contém exatamente 42 IDs únicos (10+19+4+4+5). As descrições e referências de prova por ID estão na matriz de tratamento. O relatório original integral da auditoria não foi localizado nesta retomada; o cotejo usa a matriz existente, os documentos auxiliares e o diff. Não foi inventado conteúdo do relatório ausente. As declarações de pendência nos documentos históricos L4-PROVENIENCIA-ESCRITA e AUDITORIA-L4-CORRECOES descrevem suas bases anteriores; esta seção e o resultado de integração da PR73 governam o estado atual.

### Evidências executadas

- Codex: S9/A13/PR27 13/13; typecheck; fronteiras 585 arquivos/zero exceções; corpus 241 arquivos.
- Luna: S8 14/14; prescrição eletrônica HTTP 70/70, incluindo recuperação após nova sessão/resposta perdida. Os dois arquivos não precisaram de alteração; a falha histórica não se reproduziu na execução dirigida.
- Luna: bateria de 11 arquivos B/C/D com 32/36 testes inicialmente; quatro falhas em M10 sob execução concorrente com navegador (dois timeouts e duas divergências de fixture). M10 isolado, após fim do navegador: 10/10, sem aumentar timeout. A variável global de ambiente nos helpers e a continuidade de promises após timeout são hipótese de contaminação da fixture, não causa comprovada. Preservar este limite; não reportar a primeira bateria como totalmente verde.
- Luna: Chromium local via npm run test:b2, exit 0, seis famílias, três propostas reabertas com trilha no mesmo SQLite, nenhuma assinatura indevida, jornadas eRx/canal/contingência e WebCrypto, zero egresso externo. Evidências persistidas fora do Git em C:/Users/silas/.codex/outputs/2026-10-25/l4-fechamento-execucao/026c708-browser-b2/.
- GitHub Actions, HEAD 026c708db8ac5cefbeaf7bcbaf34aa6441b4f4fe: runs [40194380123](https://github.com/silasjuba-del/OncoGlobal/actions/runs/40194380123) e [40194377432](https://github.com/silasjuba-del/OncoGlobal/actions/runs/40194377432), ambos concluídos com sucesso: quality, três shards, B2, adversariais W10/W8/F1 e gate agregado. O gate adversarial inclui verify:f1; verify isolado não o substitui.

Revisão independente dos testes 026c708: sem bloqueadores ou expectativas enfraquecidas. S9 demonstra que recibo legado seria REPLAY no gateway isolado, mas HTTP recusa antes dele; A13 valida conteúdo/hash entregue, adulteração e motivo exato com eventos/operações invariantes; PR27 conserva foco, paciente correto, decisão única e replay idempotente. Revisão de produto focada em recibos finish/close, gates, contexto/proveniência e projeções sem bloqueador confirmado. Limite: entrega HTTP não prova percepção humana.

### Integração e entrega sintética

Revisão residual G-09 (gate clínico, distinto do ID F4-09): Luna identificou trecho com "História oncológica" e qualificador ATUAL contraditório. Codex reproduziu antes da correção: o teste do gate recebeu PASSA em vez de PENDENTE. WRITE_SET ampliado por esta causa para src/kernel/extracao/gatesClinicos.ts, tests/kernel/extracao/l4-gates.test.ts e tests/server/l4-gates-extracao.test.ts. Corrigir a guarda de temporalidade da evidência, preservando controle positivo de ressecção atual, laboratório independente e replay; executar novamente provas e revisão do delta. Não inventar regra clínica nem associar automaticamente TNM histórico à peça atual.

Resultado do residual: guarda corrigida somente para a expressão específica "história oncológica", tratada como temporalidade insuficiente para associar o TNM à peça atual (PENDENTE); "história da doença atual" continua com controle positivo PASSA. RED do gate e da preparação HTTP observado antes da correção. Após correção, 21/21 testes em três arquivos (gate, jornada HTTP e proveniência) passaram: pTNM permanece candidato, laboratório independente persiste e replay não altera eventos. Luna mapa revisou o diff efetivo e não encontrou bloqueador. Não foi necessário obter nova decisão clínica; trata-se da consistência de proveniência já exigida por F4-04/05.

Lacunas adicionais separadas do fechamento: (1) prioridade de manutenção: helpers globais mutáveis da fixture M10 podem permitir contaminação após timeout; impacto observado apenas sob carga, causa não comprovada e rerun/CI aprovados; proposta futura de ambientes locais por teste, sem aumentar timeout. (2) limite semântico: regras lexicais não demonstram todas as relações entre peças e TNM em prosa arbitrária; preservar revisão médica e candidaturas pendentes, ampliando corpus sintético adversarial se novos casos forem demonstrados. Nenhum módulo ou roadmap adicional foi ativado por esses registros.

Autorizada por Silas após aprovação do plano A–F. Este commit documental ainda deve passar CI no próprio HEAD; só então PR73 sai de rascunho e recebe merge normal, sem admin/bypass/force e sem apagar branches. Conferir main e CI pós-merge, preservando os cinco arquivos não rastreados de terceiros.

A demonstração antiga não está em execução em 5197 e não será modificada. A entrega F usará checkout do commit integrado, diretório sintético novo fora do repositório, sem providers externos, e URL/processo/versão comprovados. O manifesto local de entrega registrará SHA integrado, diretório, comando de início/parada e evidência de persistência/reabertura. Disponibilidade UI/UX não significa disponibilização em produção nem aprovação clínica.
