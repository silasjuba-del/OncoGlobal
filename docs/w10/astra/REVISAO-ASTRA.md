# Revisão adversarial independente — Astra

Data: 2026-10-07. Escopo desta rodada: L2 integrado em `w10-astra` (referência informada pela raiz: `7a5ec6f`); L4 e L5 em seus worktrees, fontes congeladas para leitura. Nenhum código ou teste alterado pelo revisor. **Testes NOT_RUN nesta revisão**: as reproduções abaixo são determinadas pelo caminho de código, ainda exigem execução serial pela raiz. Saídas de suites anteriores são evidência da raiz, não reataque destes casos.

Arquivos-base lidos: plano de execução, ACHADOS-REVISAO, gateway/tempo, RECIST/estatística, configurações, testes novos, contratos Sessao/ClinicalEvent/RecistAvaliacao, projeção existente e pedidos/relatório L4. Linhas se referem à leitura anterior às correções solicitadas nesta rodada.

## Achados acionáveis

### ASTRA-01 — P1 — alvos sem elegibilidade geram categoria RECIST

- Dono: L4. Arquivo `C:\Users\silas\Projects\OncoGlobal-wt\w10-luna4\src\rules\recist\index.ts`, linhas 7–11, 128–132, 177–178, 234–239.
- O alvo declara só código/tipo/eixo. Não há órgão, método/condições de mensurabilidade nem verificação do tamanho basal, máximo de alvos ou máximo por órgão. Todas as medidas finitas >=0 passam. A saída usa o rótulo categoria global RECIST e PROPOSTO sem indicar que a seleção pode ser inválida.
- Reprodução mínima com factories de `recist.test.ts`: `recistInput([recistPoint('baseline','2026-01-01',[1]), recistPoint('atual','2026-02-01',[0])])`. Atual: RC/PROPOSTO. Também aceita alvo nodal basal de 9 mm, seis alvos ou três alvos do mesmo órgão (órgão nem representável). São casos diferentes de uma medição de seguimento legitimamente pequena.
- Fonte primária: [RECIST 1.1, documento do grupo EORTC](https://project.eortc.org/recist/wp-content/uploads/sites/4/2015/03/RECISTGuidelines.pdf), §3.1–3.2: critérios de mensurabilidade, seleção de até cinco alvos e até dois por órgão; limiar nodal no eixo curto. Conferência adicional: [artigo original](https://pubmed.ncbi.nlm.nih.gov/19097774/). Critérios foram consultados nesta rodada, não derivados de memória.
- Correção: estender tipo provisório com os dados/evidência de elegibilidade necessários e validar seleção basal. Elegibilidade ausente/inválida deve manter interpretação PENDENTE, sem impedir cálculo matemático identificável. Para critérios/método não implementados, registrar limitação expressa. Não exigir aprovação clínica humana para um teste computacional com dados completos; preservar PROPOSTO como estado de revisão.
- Reataque: positivos com baseline elegível e todos os negativos acima; testar também contexto/sourceId em branco para não tratar igualdade de strings vazias como identidade/proveniência suficiente.

### ASTRA-02 — P2 — nadir zero elimina resposta completa mantida e PD por nova lesão

- Dono: L4. Mesmo arquivo, linhas 211–219 e 229–254.
- Toda classificação depende de `deltaNadirPct !== null`. Depois de uma resposta com soma zero, o próximo nadir é zero e o percentual indefinido impede até critérios que independem desse percentual.
- Reprodução: série não nodal `[20] → [0] → [0]`, datas crescentes, fontes válidas, `novasLesoes:false`, `naoAlvos:'AUSENTE_DOCUMENTADO'`. O segundo ponto é RC; o terceiro retorna categoria null, apesar de persistirem as mesmas condições completas de RC. Variante `[20] → [0] → [10]` com `novasLesoes:true` no terceiro ponto também perde PD explícito.
- Fonte: [RECIST 1.1](https://project.eortc.org/recist/wp-content/uploads/sites/4/2015/03/RECISTGuidelines.pdf), §4.3 e tabela de resposta global; desaparecimento completo e nova lesão são critérios que não exigem divisão pelo nadir.
- Correção: separar validade do percentual da interpretação baseada em evidência completa independente. Não inventar delta percentual zero nem Infinity para satisfazer o contrato. Se `RecistAvaliacao` não comportar delta null, manter `avaliacao:null`, explicação/pedido canônico e categoria proposta em envelope próprio, deixando clara a diferença. Sem nova evidência classificável, PENDENTE continua correto.
- Reataque: RC mantida, PD por nova lesão após zero e situação incompleta após zero; nenhum NaN/Infinity na serialização.

### ASTRA-03 — P2 — overflow da soma basal derruba seguimento em vez de produzir pendência

- Dono: L4. Mesmo arquivo, linhas 195–209.
- A soma não finita gera `continue`, mas não seta `baselineInvalido`/motivos. O próximo ponto procura baseline em `validos`, recebe undefined e dereferencia `baseline.soma`.
- Reprodução: dois alvos não nodais L1/L2, baseline com `[Number.MAX_VALUE, Number.MAX_VALUE]` (cada número individual é finito), seguimento `[20,20]`. Esperado: ambos PENDENTE/MEDIDA_INVALIDA ou BASELINE_INVALIDO sem lançar. Caminho atual lança ao acessar baseline inexistente.
- Correção: toda rejeição do baseline, inclusive da soma, deve propagar estado/motivo aos seguimentos antes de buscar a referência. Validar a presença da referência sem non-null assertion.
- Reataque: `expect(() => avaliarSerieRecist(input)).not.toThrow()` e nenhum resultado clínico promovido para esse baseline.

### ASTRA-04 — P2 — destino canônico contorna HARD_FORBIDDEN

- Dono: L2. Arquivo `C:\Users\silas\Projects\OncoGlobal-wt\w10-astra\src\kernel\gateway\gateway.ts`, linhas 80–82, 140–157 e 193.
- A proibição consulta `intent.destino` antes da resolução do destino canônico. `intent.destino:null` é permitido quando callback fornece destino autorizado; a proibição não roda sobre esse destino efetivo.
- Reprodução: reutilizar fixture externa válida de `tests/w10-luna2/gateway-egress.test.ts`; definir `intent.destino=null`, `evidencia.destinoCanonico='production'`, recalcular SHA-256 desse destino em `sanitizationReport.destinoHash` e `autorizacao.destinoHash`; demais evidências permanecem válidas. Executor atual é chamado. Esperado NEGADA/HARD_FORBIDDEN:producao, zero chamadas. Variante destino `rede_social` com paciente também deve ser negada.
- Correção: aplicar a mesma política ao destino efetivamente validado/entregue ao executor, antes de reservar/executar. Não remover suporte ao destino nulo resolvido pelo servidor; não confiar em destino livre do cliente.
- Limite: conexões reais continuam desligadas; isto é um bypass reproduzível da política na API com executor fake, não evidência de envio real ocorrido.

### ASTRA-05 — P2 — caixa booleana registra null, mas passa a ler false

- Dono: L5. Arquivo `C:\Users\silas\Projects\OncoGlobal-wt\w10-luna5\src\config\settings.ts`, linhas 142, 308 e 370–376.
- `validarTipo` permite null para qualquer tipo. O setter de `config.preferencias.sincronizarTelefone` converte `value===true`, de modo que null vira false. O evento e o mapa de caixas, porém, recebem null; a leitura usa o perfil e mostra false.
- Reprodução com helpers atuais: serviço vazio e sessão válida; `changeBox({numero:11, valorNovo:null, expectedRevision:0, operationId:'boolean-null-001'}, SESSION)`. Atual: GRAVADA, evento valorNovo null; `readBox(11)` retorna false. No default, o evento declara mudança false→null que não existe no perfil. Iniciar de true torna a perda ainda mais visível.
- Correção: negar null para esse campo obrigatório ou representá-lo consistentemente em perfil/evento/leitura. O schema atual exige booleano, logo recusa explícita é correção estreita. Não gravar evento/revisão em rejeição.
- Reataque: default false e valor anterior true; verificar snapshot, evento, leitura e reabertura.

### ASTRA-06 — P2 — replay válido passa a falhar após mudança de estado

- Dono: L5. Mesmo arquivo, linhas 256–260 e 372–380.
- `changeBox` valida o perfil resultante no estado atual antes de consultar operação idempotente. Um pedido concluído pode se tornar inválido na situação atual, embora um replay devesse apenas recuperar o recibo original sem reaplicar.
- Reprodução exata com helpers: (a) caixa 9 layout=null, revisão 0, op `clear-layout-001`; (b) caixa 9 layout='compacto', revisão 1, op `set-layout-0001`; (c) caixa 8 tema='PERSONALIZAR', revisão 2, op `set-theme-00001`; (d) repetir exatamente (a). Atual: CONFIGURACAO_INCONSISTENTE em `perfilAtualizado`, antes de `apply`. Esperado: REPLAY da primeira operação, revisão atual segue 3, tema/layout permanecem PERSONALIZAR/compacto, histórico continua com três eventos.
- Correção: após autenticação e normalização mínima da identidade do pedido, resolver idempotência antes de derivar/validar nova transição contra o estado corrente. Mesmo operationId com payload/ator divergentes segue NEGADA. A verificação deve permanecer dentro da transação para nova gravação.
- Reataque: sequência acima, replay depois de reabrir e conflito por mesmo operationId com valor alterado.

### ASTRA-07 — P2 — sessão sem CRM utilizável pode atribuir DECISAO_MEDICA

- Dono: L5. Mesmo arquivo, linhas 241–245, 363 e 369–378; contrato `src/contracts/base.ts` usa `crm: z.string().min(1)`.
- `assertSession` valida o schema e expiração, mas CRM só com espaços passa pelo schema. A verificação não aplica a proteção de CRM não vazio que já existe no G-03. Uma sessão emitida no futuro também passa se ainda não expirada.
- Reprodução: copiar SESSION dos testes com `crm:'   '`; chamar `changeBox({numero:90, valorNovo:{regra:'sintetica'}, expectedRevision:0, operationId:'rule-blank-crm-01', autorizacaoMedica:true}, sessao)`. Caminho atual grava com proveniência DECISAO_MEDICA. Variante emitidaEm amanhã/expiraEm depois de amanhã também aceita.
- Correção: rejeitar CRM trim vazio e intervalos de sessão inválidos/futuros antes de qualquer leitura/escrita; usar o gate apropriado se a faixa permitir, sem mudar contrato congelado. Sessão continua derivada do servidor, nunca do corpo HTTP.
- Reataque: regras e perfil com CRM vazio, whitespace, expiração, emissão futura; sessão válida continua funcional e rejeição não muda revisão/histórico.

### ASTRA-08 — P2 — supersessão ramificada conta administrações incompatíveis como válidas

- Dono: L4. Arquivo `C:\Users\silas\Projects\OncoGlobal-wt\w10-luna4\src\estatistica\index.ts`, linhas 52–74 e 108–118.
- Valida alvo, contexto, data e ciclos, mas não detecta dois sucessores concorrentes do mesmo evento. Ambos permanecem vigentes e incrementam os status como fatos compatíveis.
- Reprodução com factories de `estatistica.test.ts`: evento A tipo TreatmentAdministration/adminId='admin-1'; dois eventos B e C do mesmo paciente/tumor, datas posteriores, ambos `supersedesEventId:'A'`; B contém `treatment('COMPLETA')`, C contém `treatment('OMITIDA')`. Ambos payloads são válidos e o ledger permite essa ramificação. Atual: COMPLETA=1 e OMITIDA=1 para a mesma administração, administracoesPendentes=0.
- Correção: identificar ramificação não resolvida e representá-la como conflito/pendência sem eleger vencedor nem incluir status incompatíveis nos totais válidos. Se o contrato da projeção não tiver contador próprio, retornar pendência explícita ou erro de conflito controlado; nunca decidir pela ordem de entrada.
- Reataque: ordem B/C invertida, cadeia linear A→B→C válida e ramificação com duas alternativas. Total de pacientes permanece deduplicado.

## Revisão dos achados anteriores e limites

- R01–R05: por leitura, códigos fixos, verbo fechado em log, recibo externo gerado internamente, snapshot clonado/congelado e auditoria prévia estão presentes. Caminho de recibo local preservado. **Correção observada no código; reataque executado pertence à raiz.** ASTRA-04 é uma borda adicional.
- R06: categorias completas agora são propostas; ASTRA-01/02/03 cobrem seleção/longitudinalidade/robustez ainda descobertas.
- R07/R08: fonte única de valor atual e validação do perfil completo estão presentes; ASTRA-05 é caso null remanescente, ASTRA-06 é consequência de validação anterior ao replay.
- Estatística: saída usa chaves fixas, não expõe identificadores ou texto livre e lê o ledger real. Entretanto F08 entrega categorias operacionais/status de administração; os campos clínicos de D-W9-42/44 permanecem explicitamente parciais em PEDIDOS-LUNA4. Essa limitação não foi classificada como bug novo nem deve desaparecer no relatório final.
- Configuração global usa SQLite operacional separado com envelope PROVISORIO-W10; não é integração canônica no clinical_event. Não usar paciente sentinela para esconder essa distinção.
- Contratos RECIST e configuração exigem pedidos ao tech lead, mas isso não impede testes computacionais nem correções locais na faixa autorizada.
- F01/F02 e corpus L3 não foram revisados nesta rodada. A integração HTTP→consumidor ainda precisa de revisão própria.

## Despacho

Raiz distribui ASTRA-01/02/03/08 à L4, ASTRA-04 à L2 e ASTRA-05/06/07 à L5. Acrescentar testes novos focalizados; não alterar expectativas antigas para ocultar falha. Corrigir um conjunto por dono, validar com wrapper/lock, revisar diff e executar reataque. Estes achados estão **ABERTOS / REPRODUCAO_ESTATICA** até a execução e correção documentadas.

## Rodada 2 — corpus L3 e correções L5

Data: 2026-10-07, após os despachos da rodada 1. Leitura das fontes congeladas de `w10-luna3` e `w10-luna5`; nenhuma execução de testes, mutação de produto ou revisão definitiva do WIP L1. Os oito achados anteriores ficam preservados como histórico. **Não identificado novo defeito bloqueante no corpus entregue ou na correção focal L5.** Esta conclusão é restrita à inspeção, não substitui o reataque serial nem prova composição HTTP pronta.

### Corpus: evidência observada

- `corpus/glossario/caixas.v1.json`: 47 entradas, separadas em 1–16 `config.*` e 101–131 `apac.*`. Os dezesseis campos de configuração coincidem com as chaves e tipos de CAMPOS_PERFIL da L5: textos, sincronização booleana, listas de skills/plugins/MCP. Todos são editáveis pelo médico. Ausência de `valorAtual` impede transformar corpus em armazenamento de cadastro.
- As 31 caixas APAC cobrem as 28 chaves de `CAMPOS_SOLICITACAO` em `src/apac/laudo.ts`, mais `finalidadeApac`, `modalidade` e `procedimentosSecundarios`. São metadados de glossário; não concedem validade ao conteúdo. L5 recusa `changeBox` para `apac.*`; composição deve manter esse contexto por paciente/laudo.
- `corpus/regulatorio/tabela-ativa.v1.json` contém `entradas:[]`, versão/fonte e nenhum `padrao`. O arquivo `pendencias.v1.json` não possui `entradas` e contém candidatos com tipo null, [VERIFICAR], consumivel false e carregavelNoClassificador false. Não há promoção implícita observada. A tabela vazia produz PENDENTE no classificador existente.
- `corpus/receitas/comuns.v1.json` contém 47 fichas/56 receitas, com envelope RASCUNHO, aprovadoMedico false e consumivel false nos níveis relevantes. O material de origem está preservado sob `fichaOriginal`/`receitaOriginal`; confiança original não foi promovida a revisão médica.
- Toxicidades têm envelope não consumível, fonte/cópia/hash, dezesseis referências de seção e divergência explícita difenidramina→D-W9-34c. Nenhum grau foi validado; CTCAE v6 permanece pendente. Não foi reavaliada a medicina das fontes nesta rodada: a revisão verifica preservação e estado de uso.
- Red flags têm 25 itens com fonte/localizador, texto final ainda não aprovado, orientação padrão de PS e comunicação/conduta desativadas. O limiar de febre permanece estritamente maior que 37,8 e a orientação de diarreia é atribuída à decisão médica.
- Busca textual focal por identificadores de paciente/CPF/CNS/telefone/email e sequências numéricas longas nos diretórios clínicos novos não apresentou ocorrência suspeita. Isso é inspeção limitada, não certificação geral de desidentificação. Glossário contém nomes de campos, sem valores de pacientes.

### L5: correções anteriores presentes no código

| Achado | Evidência de correção observada | Estado desta rodada |
|---|---|---|
| ASTRA-05 | `validarChaveConfiguracao` exige booleano real para sincronizarTelefone antes de construir o evento | CORRECAO_OBSERVADA; teste da raiz pendente de confirmação |
| ASTRA-06 | `replayIfRecorded` consulta operação por autor/hash antes de aplicar mudança contra perfil atual; `apply` repete a checagem transacional | CORRECAO_OBSERVADA; teste da raiz pendente de confirmação |
| ASTRA-07 | `assertSession` exige CRM/medicoId trim não vazio e emitidaEm <= agora < expiraEm, com instantes finitos | CORRECAO_OBSERVADA; teste da raiz pendente de confirmação |
| R07/R08 | Valor anterior vem do perfil, lista inicial usa [], PERSONALIZAR depende de layout e strings vazias normalizam para null | CORRECAO_OBSERVADA; teste da raiz pendente de confirmação |

Os testes foram separados pela raiz em `perfil.test.ts`/`caixas.test.ts`; a revisão não tratou essa separação como mudança funcional. O armazenamento global segue operacional e PROVISORIO-W10, conforme o pedido já registrado.

### Orientações para F02 ainda em implementação

Não classificadas como falhas do WIP nem novos requisitos:

1. Carregar somente `tabela-ativa.v1.json` para `classificarDocumento`; não varrer todo o diretório regulatório como uma lista de entradas. Manter receitas/redflags/toxicidades indisponíveis para emissão/envio/conduta enquanto o envelope for não consumível. Campos históricos internos `imprimivel:true` e `confianca:'alta'` são texto de origem, não autoridade do produto.
2. Injetar caixas `config.*` no serviço global e `apac.*` na antiglosa. `LISTA` é metadado amplo do glossário: L5 usa string[] para plugins/skills/MCP, enquanto APAC usa `ProcQtde[]` (`{codigo,qtde}`) em `lerSecundarios`. Não passar uma lista APAC pelo validador global de configurações nem converter objetos em strings.
3. CNES de exemplo é metadado editável, nunca valor confirmado do estabelecimento. A composição deve usar instituição realmente configurada e conservar PENDENTE quando ausente.
4. `W10-LUNA1.md` declara os consumidores prescrição/APAC/configuração/estatística/RECIST pendentes de integração. Só fechar F02 depois de provas desses consumidores; não inferir conclusão de F02 de testes de serviços isolados. Não criar exigência de aprovação clínica real para executar teste sintético com sessão e fonte válidas.

### Roteiro de reataque e aceitação da raiz

Executar somente pelo wrapper e lock já definidos, em grupos focais:

| Grupo | Prova mínima | Aceite |
|---|---|---|
| Corpus L3 | Testes novos após separação por fatia; corpus/boundaries/typecheck | Tabela ativa vazia mantém desconhecido PENDENTE; 47 caixas/25 sinais; hash e estados preservados |
| Configuração L5 | ASTRA-05/06/07 + casos R07/R08, com fechamento do DB em finally | Null booleano não grava; replay após PERSONALIZAR recupera recibo e não muda estado; sessão inválida não altera revisão/histórico |
| Integração L3→L5 | Catálogo real do arquivo, não somente PROFILE_BOXES fixture; editar os campos suportados, fechar/reabrir | Chaves/números/tipos/antes-depois consistentes; config alterada persiste; APAC não entra globalmente |
| Integração APAC | Catálogo real na antiglosa, propósito escolhido e procedimentos secundários tipados | Achado aponta número da caixa correta; ausência permanece pendente; autorização oficial segue em branco e exportação segue contida |
| Integração corpus→prescrição | Caminho real que seleciona conteúdo e classifica documento | Receita de envelope não consumível não vira ordem assinada; `imprimivel:true` histórico não contorna bloqueio; regulação ausente é PENDENTE |
| Fechamento | Regressão W3 e testes focais F01/F02 após integração serial | Saídas reais registradas, nenhum FAIL/NOT_RUN transformado em PASS, limites canônicos explícitos |

Nenhuma nova rodada ampla de arquitetura ou expansão de corpus é necessária para esta aceitação. O restante é correção/reataque dos achados já abertos e ligação dos consumidores planejados.

## Rodada 3 — composição HTTP L1

Revisão de `C:\Users\silas\Projects\OncoGlobal-wt\w10-luna1`, HEAD-base verificado `9eb91db3d0f5de9fe9ecb4864264939deeda29f6` mais WIP de servidor/testes. **Read-only; nenhum teste executado pelo Astra.** Linhas abaixo correspondem à leitura anterior às correções desta rodada. L1 está implementando testes: estes achados são despachos para correção/reataque, não alegação sobre uma entrega final já encerrada.

### ASTRA-09 — P1 — revisão de vínculo transfere rascunho já associado

- `src/server/rotas.ts:376–389`: a rota `/consulta/rascunho/revisar` verifica revisão e ausência de `patientLinkReview`, mas aceita qualquer kind e qualquer `draft.patientId` anterior.
- Prova mínima: selecionar paciente A, criar uma prescrição por `/consulta/prescricao/rascunho`, depois enviar o draftId para `/consulta/rascunho/revisar` com revisão 0 e paciente B. O envelope passa a B enquanto `payload.contexto.patientId` continua A. Documento genérico existente de A também pode ser reatribuído por esse caminho.
- Correção: limitar a operação de vínculo inicial a EXTRACAO_RASCUNHO ainda não vinculado; validar que o paciente destinatário existe; não reaproveitar essa porta para transferência de prescrições/documentos. Transferência futura, se requerida, precisará de operação explícita que preserve origem e coerência do conteúdo.
- Aceite: negativo HTTP mantém envelope/conteúdo/revisão originais para prescrição, documento e extração já vinculada; vínculo inicial válido continua permitido. Ajustar apenas a fixture nova de vínculo positivo para cadastrar antes o paciente-alvo.

### ASTRA-10 — P1 — confirmação direta promove envelope protegido pela tela

- `src/server/leituras.ts:102–105` exclui EXTRACAO_RASCUNHO/PRESCRICAO_RASCUNHO da lista de fechamento, mas `src/server/rotas.ts:114–143` não recusa esses kinds no comando.
- Prova mínima: documento elegível D e extração vinculada E do mesmo paciente; registrar bundle exibido somente para D; enviar `/consulta/confirmar` com `registros:[D,E]` e `documentosExibidos:[D]`. G-25/hashes de D passam e E vira FATO/CONFIRMADO. A mesma composição funciona com rascunho de prescrição.
- Impacto: a marcação de envelope para reconciliação específica não é aplicada na borda de gravação. Ocultar item do cliente não impede um comando direto.
- Correção: bloquear esses envelopes na confirmação genérica antes do writer, mantendo-os salvos como rascunho. A futura revisão clínica de fatos/ordens deve usar operação própria; não inventar promoção de todo envelope.
- Aceite: confirmação mista recusa atomicamente, sem assinar D nem promover E; documento convencional válido preserva o caminho existente. Fonte, negação e pendências do envelope permanecem recuperáveis.

### ASTRA-11 — P1 — contexto mutável da sessão escreve prescrição no paciente errado

- `src/server/rotas.ts:204–209,222–244,278–285`: a prescrição recebe só expression/templateId, sem contexto esperado; consultaSelecionada é um único valor mutável por token. Carregamento que falha não limpa seleção anterior.
- Prova mínima: com o mesmo token, carregar A; carregar B; repetir a ação de salvar linha da primeira tela. O servidor salva em B porque o pedido não identifica A. Variante: carregar A, tentar paciente inexistente, receber 404 e enviar linha; a seleção antiga A permanece utilizável.
- Correção: gravação de prescrição deve informar paciente/encontro esperado ou token versionado da seleção e validar a correspondência no servidor. Mudança/falha de seleção não pode redirecionar silenciosamente um comando. Preservar escopo antigo somente em operação explicitamente vinculada a ele; não inferir intenção pelo último clique global.
- Aceite: sequência A→B com comando esperado A é recusada sem criar draft em B; pedido com contexto vigente passa; falha de carga invalida a seleção implícita. Chat setor-only tem a mesma limitação de concorrência, mas o reataque obrigatório prioritário é a gravação clínica.

### ASTRA-12 — P1 — canal mistura identidade do payload com outro envelope

- `src/server/leituras.ts:155–165`: `lerCanal` descarta o event da mensagem ao montar saída. O contato é comparado com `value.patientId`, não com a identidade da mensagem no ledger; revogação do contato é ignorada. Em `lerConsulta:127–128`, contatos também são filtrados somente pelo patientId do payload.
- Prova mínima: cadastrar A/B e contato válido de B; gravar CanalMessage cujo evento pertence a A, mas payload declara B/contato de B. `/consulta/canal` devolve texto de A vinculado a B. Para cabeçalho, gravar Contato sob envelope A com payload.patientId=B: ele aparece nos contatos de B. Contato com `revogadoEm` preenchido continua apresentado como vínculo ativo.
- Correção: exigir concordância envelope/payload em cada salto de mensagem/contato/paciente; revogação não pode ser tratada como vínculo atual. Dado divergente deve ficar não vinculado/pendente ou ser omitido com motivo, sem eleger identidade silenciosamente.
- Aceite: fixtures discordantes não aparecem vinculadas a B e não contaminam seu cabeçalho; contato revogado fica desvinculado; caso positivo coerente permanece legível.

### ASTRA-13 — P2 — fila do salão ressuscita atendimentos históricos e duplica pessoa

- `src/server/leituras.ts:204–244`: lê todas as triagens vigentes sem delimitar dia/atendimento atual. Ordena todas e depois resolve cartão em Map por patientId, fazendo duas entradas da mesma pessoa apontarem para o último cartão.
- Evidência concreta da própria fixture nova: `tests/server/leituras-http.test.ts` usa agora 07/10/2026 e `triagemBase()` sem substituir chegadaEm; `tests/fixtures/triagem.ts` fixa chegada em 05/10/2026. O novo teste espera que essa triagem histórica apareça na fila atual.
- Prova mínima adicional: dois encontros sem supersessão, ontem e hoje, mesmo paciente. O resultado contém dois cartões montados a partir do mesmo último card, com possível mistura de chegada/estado. Paciente com apenas triagem de ontem também aparece hoje.
- Correção: delimitar explicitamente a sessão/dia operacional usando tempo civil do serviço e identidade de atendimento. Em múltiplos eventos realmente concorrentes no mesmo atendimento, preservar conflito/pendência em vez de duplicar ou escolher silenciosamente. Não apagar o histórico.
- Aceite: positivo novo usa chegadaEm de hoje; triagem de ontem não entra na fila corrente; duas versões/coexistências produzem resultado único coerente ou pendência, nunca dois cartões do último evento. Ajustar fixture nova, não expectativas dos testes congelados.

### ASTRA-14 — P2 — ordenação textual de instantes seleciona encontro incorreto

- `src/server/leituras.ts:56–62,86–88,97–100`: SQL ordena `criadoEm` como texto, e leitores usam `.at(-1)` como o evento/episódio/ciclo atual. O contrato Instante permite offsets diferentes.
- Prova mínima: evento do encontro antigo em `2026-10-07T12:00:00+03:00` (09:00Z) e evento mais novo em `2026-10-07T10:00:00Z`. A ordem lexical põe 12h+03 depois de 10hZ; consultaSelecionada recebe encontro antigo. Isso afeta também o contexto implícito de escrita.
- Correção: ordenar por instante interpretado, com desempate determinístico que não invente precedência clínica. Relação supersedes continua a autoridade de substituição.
- Aceite: seleção correta com offsets diferentes e igualdade de instantes; registros históricos não são removidos; valores não interpretáveis não ganham prioridade silenciosa.

### Dependências reais de integração — não contornar gates para fechar F02

1. **Assinatura pela UI ainda não demonstrada.** `src/ui/api/porta.ts` define PedidoBundle `{patientId,encounterId,tumorLotId}`; `src/ui/api/http.ts` envia esse objeto para `/consulta/bundle`, mas `ExibirBundle` em `rotas.ts:37–41` exige draftIds e proíbe tumorLotId. Esse contrato retorna 400. Além disso, `TelaConsulta.tsx` chama carregarConsulta e depois confirmar, sem chamar exibirBundle: no servidor atual o fluxo termina em BUNDLE_NAO_EXIBIDO. O problema antecede esta rodada, mas impede afirmar conclusão do fluxo de assinatura real. Dono da UI é Cursor/tech lead; servidor pode oferecer adaptação compatível quando acordada. **Não registrar hash como exibido no carregarConsulta se o conteúdo não foi efetivamente entregue/exibido.** Cabeçalho/título não é prova de revisão do documento. Registrar pedido e aceitação por porta real.
2. **G-07/G-08 são invocados sempre com `{}`** em `rotas.ts:349–350`. Isso conserva PENDENTE e não bloqueia salvar; não prova comparação clínica de fontes disponíveis. G-09 recebe apenas prefixo e espécie desconhecida. Como reconciliador/extração completos do Fugu ainda são skeletons, manter F02 como composição parcial nesse ponto. Não declarar gate funcionalmente integrado para divergência de lateralidade/anatomia sem teste com entradas realmente fornecidas ao gate. A revisão não propõe inferir campos ausentes.
3. **SafetyEngine real ainda não é consumidor da rota de prescrição.** O código monta manualmente NOT_EVALUABLE em `rotas.ts:218–221,235–238`; parser/classificador/instanciador são consumidos. Contenção é segura, mas não é prova das quatro camadas completas. Requisitos tipados e dados clínicos persistidos são dependência explícita; nunca trocar o marcador por PASS para satisfazer teste.
4. **RECIST:** request só aceita patientId e leitor compara identidade dos pontos/eventos; não recebe série arbitrária via HTTP. O envelope local ainda não é contrato canônico. Reataque precisa incluir ponto de outro paciente, referência ausente e fonte desconhecida; todos devem permanecer PENDENTE sem categoria. Não chamar isso de validação semântica das medidas apenas porque sourceId existe no conjunto de fontes do paciente.

### Confirmações desta rodada

- A busca de episódio global quando paciente não possui lote foi corrigida: `episodios` vira [] sem lote; episódios/ciclos são filtrados pelo paciente e lote. O teste novo verifica que A sem lote não recebe episódio de B.
- Corpus regulatório é carregado pelo arquivo ativo exato; receitas elegíveis exigem consumivel/aprovadoMedico nos envelopes. Não foi observado uso de imprimivel:true da fonte histórica como autoridade. Saídas externas e APAC SIA continuam contidas.
- Rotas de configuração repassam a sessão obtida do servidor, mantêm autoria fora do payload e mapeiam CONTEXTO_PACIENTE_OBRIGATORIO para 409; os reataques HTTP independentes da L5 devem confirmar.
- Antiglosa recebe CNES configurado, nunca o exemplo por fallback; SIGTAP vazio continua bloqueando exportação. Isso permite testar contenção sem inventar tabela regulatória clínica.

### Sequência de fechamento para L1/root

Corrigir primeiro ASTRA-09/10/11/12 (identidade/autoridade), depois ASTRA-13/14 (projeção temporal). Acrescentar os negativos ao teste HTTP focal com fixtures sintéticas e fechar servidor/SQLite em finally. Validar pelo wrapper: typecheck, boundaries, corpus, testes server/L1 e regressão W3; manter o teste HTTP independente L5. Registrar limites de bundle/UI, extração/gates e SafetyEngine como PARCIAL/PEDIDO, sem ampliar faixa ou reduzir gates. Esta rodada se encerra no despacho; não aguarda execução e não marca achados corrigidos sem nova evidência.
