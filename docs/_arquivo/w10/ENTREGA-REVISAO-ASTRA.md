# Revisão Astra — candidato W10 em andamento

Data: 2026-10-07. Base informada: `55e6cc1` + WIP compartilhado. Escopo: diffs staged/unstaged e arquivos novos pertinentes; leitura estática, sem executar testes. Produção não foi editada. Luna5/HTTP ainda em implementação: não avaliada como entrega concluída. Os achados abaixo precisam de regressões executadas pelo orquestrador.

## Achados prioritários

### A1 · P1 · RISCADO multilinha deixa o interior entrar como fato explícito

- Local: `src/kernel/extracao/extrator.ts:42`; teste insuficiente: `tests/w10-entrega/extracao.test.ts:146`.
- Reprodução proposta: chamar o extrator com `sourceType: medical_note` ou `pathology` e texto `[RISCADO]\nDiagnóstico: adenocarcinoma\nHb 8 g/dL\n[/RISCADO]`.
- Resultado dedutível: somente as duas linhas que contêm tags são puladas. As linhas interiores passam pelas regras de diagnóstico/LAB, produzindo `evidence: EXPLICIT` e `requiresConfirmation: false`. O SafetyValidator não acompanha intervalos riscados. Isso não significa que houve assinatura automática, mas a marca de rasura e sua exigência específica de revisão se perdem antes da revisão médica.
- Esperado: preservar documento/trecho/fonte, carregar pendência da rasura e não apresentar o interior como afirmação documental limpa. Cobrir multiline, mesma linha e conteúdo válido antes/depois da região.
- Por que o teste passa indevidamente: só usa `[RISCADO]texto[/RISCADO]` em uma linha. O caso07 usa conteúdo particular e não prova comportamento para um marcador clínico reconhecido no interior multilinha.
- Dono: Luna1. Estado: **achado estático; reprodução NOT_RUN**.

### A2 · P1 · Data produzida pela extração não é aceita pela reconciliação temporal

- Local: `src/kernel/extracao/reconciliacao.ts:126-133`, produtor em `src/kernel/extracao/extrator.ts:59-60`; `normalizarFatos` conserva `fact.date` em `src/kernel/extracao/normalizacao.ts:290`.
- Reprodução proposta: pipeline real com `01/10/2026 Creatinina 1,1 mg/dL\n02/10/2026 Creatinina 1,4 mg/dL`, fonte documental única.
- Resultado dedutível: o extrator mantém datas DD/MM/YYYY; a nova reconciliação reconhece somente YYYY-MM-DD. As duas medidas entram em `lab:CREATININA:data:desconhecida`, conservando falso conflito em vez de série histórica.
- Esperado: normalizar com `normalizarDataCivil` existente, validar data civil exata e preservar o literal/proveniência. Não substituir pela data de captura/criação. Datas ausentes/invalidáveis continuam pendentes e não ganham ordem inventada.
- Por que o teste passa indevidamente: `tests/w10-entrega/longitudinal.test.ts:43` fabrica ClinicalFact com ISO, sem passar pelo produtor real. Acrescentar regressão extrair → normalizar → reconciliar com DD/MM/YYYY e controles de data inválida/ausente.
- Dono: Luna4, interface com Luna1. Estado: **achado estático; reprodução NOT_RUN**.

### A3 · P1 · Negação por cláusula corrigida só para LAB, ainda apaga RADS afirmativo

- Local: `src/kernel/extracao/extrator.ts:44` e condição `if (imaging && !negated)` em `src/kernel/extracao/extrator.ts:153` (confirmar número após edições concorrentes).
- Reprodução proposta: `sourceType: imaging_report`, texto `Sem lesões hepáticas; nódulo em pulmão 38 mm.`. Comparar com a mesma linha sem a primeira cláusula.
- Resultado dedutível: o LAB passou a testar negação delimitada por ponto e vírgula, mas imagem continua usando o booleano da linha inteira. O nódulo afirmativo é descartado porque a cláusula anterior contém `sem lesões`.
- Esperado: negar apenas a observação à qual a expressão se refere; preservar o nódulo, medida/unidade e trecho. Não transformar o nódulo em metástase. Repetir controle com negação efetivamente aplicada ao próprio nódulo.
- Lacuna de teste: o novo caso de negação usa exclusivamente `Nega dor; creatinina...`; não prova generalização para os demais domínios.
- Dono: Luna1. Estado: **achado estático; reprodução NOT_RUN**.

## Limites e encaminhamento

- Os três achados foram comunicados ao orquestrador antes deste fechamento; A1/A2 aceitos para correção prioritária. Nenhum resultado PASS/FAIL de execução é reivindicado nesta revisão.
- Conforme pedido do orquestrador, não revisar nem classificar como defeito final o fluxo HTTP/app ainda em produção pela Luna5. Interações com chaves de campo, incerteza e fonte/data devem ser reatacadas quando ela encerrar a entrega.
- O teste estatístico novo usa coorte vazia: demonstra a forma da resposta, não acurácia de denominador/exclusões em uma coorte real. O módulo declara honestamente `LEDGER_COMPLETO` e `periodoClinico: null`; isso não prova estatística filtrada por período.
- Busca lexical no novo consumidor declara vetor `NOT_IMPLEMENTED`; não confundir isso com embedding numérico ou índice funcional. A revisão não encontrou motivo concreto para reprovar a correção JSON/Map do gateway por leitura; sua eficácia depende dos testes do orquestrador.
- O orquestrador relatou adicionalmente erro TypeScript em import relativo de `node:fs` no teste Grok. Esse erro não foi executado pelo revisor e não entra como reprodução própria.

Resultado da contribuição: **revisão estática concluída, 3 achados prioritários, testes NOT_RUN**. Nenhum merge, push ou edição de produção.

## Segunda revisão — fluxo Luna5 estabilizado

Escopo adicional: `src/app/revisaoExtracao.ts`, diffs de `src/server/rotas.ts` e `src/server/leituras.ts`, `tests/w10-entrega/fluxo-http.test.ts`, além dos consumidores writer/snapshot necessários para seguir o comportamento. Somente leitura; nenhum teste executado. A1–A3 estavam em correção pela Luna1 nesta rodada e não foram reatestados aqui. Os três achados seguintes foram comunicados imediatamente ao orquestrador.

### B1 · P1 · Candidato explicitamente incerto é projetado VERDE depois da revisão

- Locais: `src/app/revisaoExtracao.ts:120-123` e `:148-160`, `src/server/rotas.ts:523`, consumidor `src/kernel/projections/snapshot.ts:126-128`.
- Reprodução proposta: importar Plaud textual `Creatinina 1,4 mg/dL`, confirmar vínculo e selecionar o fato para revisão pela nova rota. Recuperar os eventos e chamar o snapshot do encontro.
- Encadeamento observado por leitura: o resumo afirma que o candidato conserva incerteza e precisa de confirmação clínica adicional. Apesar disso, a rota marca todos os registros `CONFIRMADO`; o payload copia `evidence`, mas não preserva `requiresConfirmation` como condição consumida. O snapshot usa somente valor não nulo para retornar `VERDE`. Até o valor laboratorial com número nulo encapsulado em objeto pode resultar VERDE, pois o objeto em si não é nulo.
- Impacto: a tela textual e o estado longitudinal discordam sobre a certeza do mesmo dado. O clique de revisão é legítimo, mas a API não distingue aceitar a presença de uma hipótese de confirmar seu conteúdo; não pode simultaneamente dizer que requer confirmação adicional e projetar certeza.
- Correção solicitada: definir a semântica de confirmação sem inferir aprovação clínica adicional. Se a revisão só mantém candidato, preservar pendência nos consumidores e não promovê-lo ao conjunto de fatos confirmados; se há confirmação explícita do conteúdo pelo médico, registrar esse ato separado de aceitar o candidato, preservando a incerteza da fonte. Testar HTTP → ledger → snapshot, não apenas o texto da resposta.
- Lacuna do teste: o cenário Plaud de `fluxo-http.test.ts` termina na extração e nunca seleciona o candidato incerto para revisar/projetar.
- Estado: **reprodução NOT_RUN; candidato a bloqueador de entrega clínica**. Dono: Luna5, interface com projeção Luna4.

### B2 · P1 · Novo resumo entra em confirmação genérica sem validar encontro e lote

- Locais: inclusão no fechamento em `src/server/leituras.ts:128-131` e `:172-174`; filtro de tipos e validação em `src/server/rotas.ts:132-141`; gravação com contexto do cliente em `:167-169`.
- Reprodução HTTP proposta, sempre no mesmo paciente: (1) gerar resumo `EVOLUCAO_RASCUNHO` no encontro A/lote A; (2) chamar `/consulta/bundle` com `{ patientId, encounterId: "B", draftIds: [] }`; (3) chamar `/consulta/confirmar` com `encounterId: "B"`, outro tumorLotId, `registros: [{ id: summaryDraftIdA, expectedRevision: revisionAtual }]`, `documentosExibidos: []`, `reconhecerAlertas: []`, bloco EVOLUCAO e chave nova.
- Encadeamento observado por leitura: bundle vazio é registrado para B e G-25 admite confirmação sem documentos. `confirmarBloco` verifica apenas patientId e não recusa o novo kind EVOLUCAO_RASCUNHO. Não compara `payload.contexto` do draft com encontro/lote solicitados nem com a consulta selecionada. O writer valida revisão e paciente, recebendo B/lote B diretamente do comando; assim o resumo do encontro A pode ser gravado como FATO no contexto B.
- Impacto: isolamento por paciente não basta; material clínico migra entre encontros/neoplasias do mesmo paciente. Não implica assinatura automática de documento, mas produz evento clínico no contexto errado.
- Correção solicitada: validar encontro/lote de cada draft na confirmação, vincular ao contexto selecionado quando essa for a autoridade da rota, e definir se a evolução de revisão pode entrar no mecanismo genérico. Não relaxar G-25. Regressão deve provar 409 e nenhuma mudança em eventos, revisão do draft ou operação ao tentar trocar encontro/lote.
- Lacuna do teste: o teste novo verifica outro paciente, mas não outro encontro/lote do mesmo paciente nem o caminho `/consulta/confirmar` após gerar resumo.
- Estado: **reprodução NOT_RUN; candidato a bloqueador de integração**. Dono: Luna5.

### B3 · P1 · Chaves por factId escondem conflitos entre fontes não laboratoriais

- Locais: `src/app/revisaoExtracao.ts:156-157`; montagem de pendências em `:128-136`; concatenação de resumos em `src/server/leituras.ts:145-147`.
- Reprodução proposta: importar e revisar dois documentos independentes para o mesmo paciente/encontro, primeiro `Diagnóstico: adenocarcinoma\ncT2N0M0` e segundo `Diagnóstico: carcinoma escamoso\ncT2N0M1`, usando recordingId/sourceId/operações diferentes. Ambos são fontes documentais e mantêm os literais. Ler snapshot e evolução.
- Encadeamento observado por leitura: cada campo não-LAB vira `extracao.<domínio>:<fact.id>`. Como factId contém segmento/gravação, cada fonte recebe campo diferente. O snapshot não compara esses valores; ambos ficam VERDE isoladamente. As exceções usadas para o resumo vêm apenas do estado de extração do documento individual, sem reconciliação com o documento já persistido. A evolução simplesmente concatena os resumos. O histórico TNM novo também só procura `campo === TNM`, portanto não consome `extracao.stage:<id>`.
- Impacto: a evidência literal permanece disponível, mas o conflito multifonte e a pendência clínica desaparecem dos consumidores. Isso não equivale a cumprir merge das fontes ou histórico TNM.
- Correção solicitada: conectar os eventos revisados ao reconciliador/projeção canônicos, com chave clínica que preserve domínio, contexto temporal e identidade da observação. Manter factId como proveniência, não como único agrupador clínico. Não comparar estágios de épocas/sistemas diferentes como se fossem a mesma avaliação. Testar duas fontes discordantes contemporâneas e série histórica legítima separadamente.
- Lacuna do teste: o HTTP novo revisa um único laudo de imagem e múltiplos LABs; não confronta fontes não-LAB discordantes já persistidas nem verifica `stageHistory` a partir da rota.
- Estado: **reprodução NOT_RUN; candidato a bloqueador de longitudinalidade**. Dono: Luna5 + interface Luna4.

### Limites adicionais desta segunda leitura

A consulta de conhecimento tem consumidor HTTP efetivo e autenticação antes da execução; o modo continua explicitamente lexical. Não houve achado concreto novo de bypass de sessão nessa rota. O resumo é retornado por HTTP, mas uma busca textual por `resumoEvolucao`/`evolucoesRascunho` não encontrou consumidor UI; isso limita a alegação de demonstração visual. Persistir o novo summaryDraft antes de confirmar o writer deixa duas transações separadas; falta teste de falha/injeção de erro nessa fronteira, mas esta revisão não classificou uma reprodução não estabelecida como quarto achado.

Resultado da segunda revisão: **3 achados P1 estáticos, execução NOT_RUN**. Apenas este documento foi alterado.

## Re-review de fechamento — matriz de correções

Leitura posterior às correções, em 2026-10-07. Esta matriz substitui o estado inicial dos achados; os registros anteriores permanecem como histórico. Não houve execução de testes pelo revisor. `MITIGADO_POR_LEITURA` significa que o caminho identificado foi corrigido no código inspecionado, sem reivindicar PASS de runtime.

| Achado | Estado nesta leitura | Evidência e limite |
|---|---|---|
| A1 · RISCADO multilinha | MITIGADO_POR_LEITURA | Extrator agora acompanha regiões riscadas com estado entre linhas e extrai apenas trechos externos. O documento original continua na entrada. Teste do orquestrador ainda é a prova de execução. |
| A2 · datas DD/MM incompatíveis com reconciliação | MITIGADO_POR_LEITURA | Normalização agora converte a data do fato antes da reconciliação. A comparação permanece dependente de data clínica válida, sem usar captura. |
| A3 · negação da linha apaga RADS de outra cláusula | MITIGADO_POR_LEITURA | Extrator itera cláusulas separadas por ponto e vírgula; negação é avaliada dentro da cláusula para todos os domínios, incluindo imagem. |
| B1 · candidato incerto vira VERDE | MITIGADO_POR_LEITURA | `prepararRevisaoExtracao` gera `ReviewDecision` sem `campo`/`valor` para candidato não explícito ou que requer confirmação. A rota usa `registro.tipo`. Snapshot não encontra campo para projetar; conserva candidato no registro de revisão e resumo. |
| B2 · resumo confirmado em encontro/lote errado | MITIGADO_POR_LEITURA | `confirmarBloco` compara contexto do draft com encontro/lote e recusa `EVOLUCAO_RASCUNHO` também no mesmo contexto. O caminho de bundle vazio descrito em B2 deixa de promover esse resumo. |
| B3 · conflito entre fontes fica invisível | PARCIAL — residual P1 | O leitor agora reconstrói ClinicalFact e chama `reconciliarCampos`, exibindo candidatos e fontes no resumo. Porém usa `all.filter`, admitindo RAW e FATO supersedido. Detalhe abaixo. |

### B3-R1 · P1 · Reconciliação nova lê versões RAW e substituídas

- Local atual: `src/server/leituras.ts:162-164`. A coleção começa em `all.filter`, enquanto `patientEvents`, calculada antes com `eventosVigentes`, já representa os confirmados vigentes.
- Reprodução proposta 1: persistir FATO de extração A (diagnóstico adenocarcinoma) e correção B (carcinoma escamoso), ambos confirmados no mesmo paciente/encontro/lote, com B supersedendo A. Ao carregar consulta, os dois entram em `fatosRevisados` e são apresentados como conflito, apesar da correção explícita vigente.
- Reprodução proposta 2: manter A confirmado e acrescentar FATO RAW divergente com os mesmos campos/proveniência exigidos pelo parser. RAW também entra na comparação e contamina a lista de fatos revisados e o texto da evolução.
- Correção estreita solicitada: obter os candidatos de `eventosVigentes` antes de reconstruir ClinicalFact, preservando filtros de paciente/encontro/lote e demais validações. Não eliminar do ledger o histórico; removê-lo apenas do conjunto ativo reconciliado. Cobrir RAW excluído e supersessão confirmada substituindo a versão anterior, além do conflito entre duas versões realmente vigentes.
- Estado: **reprodução NOT_RUN; residual comunicado ao orquestrador**. Dono: Luna5.

O reparo do texto de conflito é uma mitigação funcional do leitor de consulta; não amplia, por si só, a garantia para todos os consumidores de snapshot/histórico TNM. Esta rodada foi restrita aos três achados B e não realizou nova auditoria geral.

## Fechamento após o patch final de B3

**B3 e B3-R1: MITIGADOS_POR_LEITURA no candidato atual.** A observação PARCIAL da matriz anterior é histórica e foi superada por esta conferência:

- `src/server/leituras.ts:162-165` usa `eventosVigentes` sobre eventos confirmados/assinados do paciente, encontro e lote antes de restringir a FATO. RAW e a versão supersedida dentro desse conjunto não entram mais nos candidatos ativos.
- `src/app/revisaoExtracao.ts:152-154` persiste estágio como `campo: TNM` e usa chaves estáveis por domínio nos demais fatos não laboratoriais; factId permanece como proveniência. Isso elimina o isolamento artificial de diagnóstico/histologia por gravação.
- O leitor aceita o campo TNM e reconstrói o domínio stage. O produtor grava data clínica quando conhecida, e `tnmHistory` já consome campo TNM com literal e fontes.
- B1 continua mitigado: candidato incerto produz ReviewDecision sem campo/valor projetável. B2 continua mitigado: comparação de contexto e recusa do resumo na confirmação genérica permanecem presentes.

Não identifiquei residual P1 dos seis achados originais neste último caminho inspecionado. Isso não é resultado de teste nem aprovação clínica global. **A1–A3/B1–B3 estão mitigados por leitura; execução final pertence ao orquestrador e continua não reivindicada neste documento.**

### Estados recomendados para as dez fatias na entrega

A coluna de estado considera os critérios originais inteiros, não apenas o patch produzido. O orquestrador deve atualizar a evidência com seus logs do candidato final. Não marcar uma fatia clínica FEITA enquanto sua prova exigida estiver faltando.

| Fatia | Estado recomendável neste ponto | O que sustenta o estado / falta para fechar |
|---|---|---|
| F01 · extração | PARCIAL, implementação revisada | Correções e regressões produzidas; A1–A3 mitigados por leitura. Pode virar FEITA quando o root confirmar os testes focais e adversariais pertinentes no candidato final. |
| F02 · revisão e persistência | PARCIAL | Percurso HTTP, decisões separadas, persistência/reabertura e mitigação B1–B3 implementados. Falta prova consolidada do candidato e demonstração UI consumindo a evolução. |
| F03 · gateway WRITE/READ | BLOQUEADA_CONTRATO para READ; WRITE parcial | Endurecimento JSON/Map entregue. READ externo continua NOT_IMPLEMENTED e seu contrato/allowlist/autorização são a dependência concreta; recusa não conta como implementação. |
| F04 · sessão e temporalidade | PARCIAL | Guardas de escopo adicionadas; resultados finais de regressões de sessão, replay, fuso e APAC devem vir dos logs do root. Não atribuir PASS novo a cobertura histórica. |
| F05 · Brain OS | PARCIAL | Consumidor HTTP autenticado chama busca lexical local com proveniência/status. Prova do cenário e reataque final em execução pelo root; curadoria clínica permanece separada. |
| F06 · avaliação de grafo/vetores | FEITA como inventário e avaliação | Grafo e busca lexical existem; relatório L3 separa esses recursos de embeddings/índice vetorial NOT_IMPLEMENTED. FEITA aqui não declara busca vetorial entregue. |
| F07 · longitudinal/RECIST | PARCIAL | Séries LAB, conflito, histórico TNM e motor RECIST conectados em código. O percurso textual do retorno não gera nem executa avaliação RECIST; precisa distinguir teste do motor de jornada integrada. |
| F08 · estatística | PARCIAL | Denominador/exclusões e escopo explícitos; API ainda lê ledger completo com periodoClinico null. Não satisfaz integralmente aceite de período clínico filtrado. |
| F09 · caso ponta a ponta | PARCIAL | HTTP e fixtures cobrem revisão, recuperação, isolamento e conflitos. Texto de diarreia G3 permanece bruto; não há CTCAE v6 estruturado/executado no percurso, nem comparação RECIST nele. Não chamar fluxo clínico completo de FEITO. |
| F10 · verificação/PR | PARCIAL | Sincronização e revisão realizadas; bateria final em execução pelo root. PR e evidência final ainda devem ser relatados pelo orquestrador. Nenhum merge em main/deploy autorizado. |

Os limites de F03/F07/F08/F09 são capacidades não concluídas, mesmo que todos os testes implementados passem. Os estados podem ser refinados pelos resultados efetivos do root, sem transformar ausência de funcionalidade em PASS.
