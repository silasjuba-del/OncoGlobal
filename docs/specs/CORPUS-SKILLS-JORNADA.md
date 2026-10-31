# Corpus e skills de jornada — entrega PR 86

## Objetivo e escopo autorizado

Silas autorizou em 30/10/2026 a conclusão integral, escrita exclusiva pelo Codex, testes e PR para revisão, sem merge. Base: PR 86, e2743316. Worktree isolada; main e trabalho concorrente preservados.

Entregar: correções das contas/integrações do Cursor; corpus pulmão versionado e validável; mesma porta de skills nativas para primeira consulta, retorno e follow-up; etapas explícitas de proveniência, urgência, extração, contexto, corpus, segurança, pedidos e revisão; persistência de rascunhos com replay, recuperação e invalidação por mudança das entradas. O conteúdo em revisão não autoriza tratamento, assinatura, mensagem ao paciente ou administração.

## Contratos e responsabilidades

- `src/rules`: cálculos determinísticos, parâmetros já autorizados e estados pendentes; sem importar outra regra nem acessar IO.
- `src/server/f0c`: seleção as-of dos exames basais, integração das avaliações e proveniência.
- `corpus/jornadas`: síntese de pulmão, fontes identificadas por documento/versão/hash e página, divergências e lacunas; sem PDFs, caminhos privados ou dados de pacientes.
- `src/contracts`: schema do corpus e extensões da skill; elegibilidade e segurança não convertem ausência em aprovação.
- `src/modules/documentos`: composição das jornadas e documentos não assinados.
- `src/server/skillsClinicas.ts`: autenticação, vínculo das fontes, corpus injetado, persistência/idempotência; só skills nativas, sem carregar pacotes externos.
- `src/ui/consulta`: seleção de kit/contexto, referências, execução e reabertura de rascunhos; isolamento de respostas atrasadas entre pacientes.

Um escritor: Codex, em todos os caminhos acima e respectivos testes/documentação. Nenhum subagente escritor.

## Aceite

1. Typecheck, fronteiras, corpus e baterias obrigatórias passam sem skips novos ou relaxamento de critérios clínicos.
2. FEVE basal existente chega à regra; exame futuro/inválido/conflitante não vira basal válido. Audiometria documentada resolve sua pendência, sem pedir exame duplicado.
3. Tetos cumulativos com unidades distintas preservam avaliação por unidade; soma incompleta não gera tranquilização.
4. Corpus preserva fontes, alternativas, momento e linhas. Rascunho nunca vira regra ativa por ser recuperado.
5. Primeira consulta, retorno e follow-up usam o mesmo fluxo de fontes vinculadas; urgência interrompe propostas eletivas e exige revisão.
6. Reabrir/reiniciar recupera saída idêntica. Mudanças de fonte, corpus ou contexto invalidam a atualidade; nenhuma assinatura ou evento clínico é criado pela skill.
7. Revisão final do diff, somente arquivos selecionados no commit e push sem força para o PR; não fazer merge.

## Sequência de execução

Corrigir regressões e integração clínica → incorporar corpus como referência em revisão → estender skill nativa e UI → testes unitários/integrados/adversariais → CI e entrega. Lacunas de fonte e limiares que exigem curadoria permanecem visíveis, sem inventar valores.

## Estado

Implementados: corpus pulmão (44 cartões, 19 ações, 13 divergências), contrato Zod estrito, catálogo nativo com primeira consulta/retorno/follow-up, seleção de referências, avaliação clínica integrada, triagem radiológica sobre fontes vinculadas, persistência/replay e reabertura pela interface. Retorno pode usar o prontuário sem novo laudo; primeira consulta exige kit vinculado. A recuperação compara cadastro, fontes, ledger, corpus e avaliação clínica.

Corrigidos: fronteira do equivalente; matriz de peso; tetos multiunidade; contagem dos sinais em rascunho; disposição PHI do divisor numérico do PRNG, após inspeção; FEVE basal ligada ao episódio e validada temporalmente; audiometria realizada que resolve pendência; referência de dose inválida que não pode cair na dose anterior; chaves React distintas nos dois formulários do salão. A precisão Mosteller de duas casas permanece alinhada ao prescritor.

Provas dirigidas: basais ausentes/futuros/conflitantes, equivalente histórico/unidade, dose, corpus órfão, HTTP/persistência/reinício, isolamento de contexto da UI e soma sem limite que recusa unidades incompatíveis. Chromium executa `CORPUS_SKILLS_HTTP_UI_SQLITE`: fonte vinculada → cartão PUL-26 + ações EX-08/EN-01 → rascunhos → reabertura idêntica, sem novo evento clínico. O PR registra os resultados da bateria completa e do CI vinculados ao SHA entregue; aprovação técnica não é aprovação clínica.

## Como usar

Na consulta, abrir **Jornada por skills**. Escolher primeira consulta, retorno ou follow-up; selecionar laudos vinculados e, se pertinente, cartões e ações de pulmão. **Preparar rascunhos da jornada** salva documentos locais não assinados. **Reabrir jornada** recupera a mesma versão e informa alterações nas entradas. Uma suspeita urgente interrompe propostas eletivas e mantém a fonte visível. A seleção de um cartão não confirma elegibilidade do paciente.

O catálogo e o executor são recursos nativos do aplicativo; não instalam nem carregam pacotes externos de skills. Nenhum mecanismo de admissão foi contornado. O original médico-legal dos packs e os documentos-fonte não foram fragmentados nem publicados nesta entrega.

## Dados basais

Fatos confirmados `feveBasal` usam `{episodioId, data, percentual, metodo}`; `audiometriaBasal` usa `{episodioId, data, estado: "REALIZADO", resultado}`. Fonte e revisão vêm do evento. Ausente, conflito, outro episódio, data impossível/futura ou exame apenas agendado não satisfazem a avaliação. `rtMediastino` confirmado conserva a presença/ausência documentada do agravante; ausência do registro não equivale a negativo. O equivalente usa as exposições normalizadas e validadas no horizonte do encontro, mantendo os tetos de cada droga.

## Limites clínicos preservados

O catálogo de pulmão está ativo para consulta com fontes. Fichas de prescrição e requisitos clínicos dos packs conservam curadoria por item/versão/hash; os originais permanecem íntegros. L4/L5 sem evidência estruturada, acesso NCCN/ONCO PRO, tabela TNM para cálculo, cortes não curados e cobertura farmacológica incompleta permanecem explícitos. Critérios de elegibilidade e segurança são separados; nenhum estado indeterminado autoriza tratamento. Não há emissão de pedido, assinatura, administração ou mensagem ao paciente pela skill.

## Auditoria final — 31/10/2026

Base examinada: `9610e099`, idêntica no local e no PR, árvore local limpa; `origin/main` é ancestral (nenhum commit da base faltando). Ambiente local: Windows, Node 24.15.0 e npm 11.12.1. CI remoto: Linux com Node 24, conforme workflow `verify`. Escrita exclusiva nesta worktree, sem merge e sem alterações no checkout principal.

As regressões sintéticas reproduziram 11 falhas em quatro arquivos antes das correções. Foram corrigidos:

- Opções de leitura divergentes entre consulta e skill: uso do mesmo `opcoesLeituraConsulta`, incluindo condicionais, instrumentos e configurações, com hash de política completo. Alertas e avisos da consulta são conservados nos rascunhos.
- Basal com valor positivo, mas evento negado, incerto ou de terceiro: conferência do envelope e do valor antes de aceitar FEVE/audiometria.
- Equivalente cumulativo incompleto: o subtotal validado é mantido como limite inferior, inclusive alertas já atingidos; não se declara baixo risco. Todos os caminhos de soma sem teto recusam mistura de unidades.
- Urgência: referências, divergências e critérios eletivos são retirados juntos; fonte documental original permanece. Falta de triagem/cobertura não aparece como avaliação concluída.
- Variantes de nomes dos medicamentos conservam pendências dos analitos; dose por referência identifica peso informado pelo paciente.
- Interface: resposta de contexto/ação incompatível é recusada, mudança da seleção retira a prévia antiga e falha ao recarregar histórico não transforma uma preparação bem-sucedida em falha de gravação.
- Metadados: classificação por chaves reservadas explícitas, sem remover índices clínicos ou Hashimoto por coincidência de substring; conteúdo integral dos packs preservado.
- Referências Q24/FN-06 na matriz corrigidas para o limiar vigente; Q25 conserva a ação na linha 47 e referencia também o limiar atual. A sugestão de mover a disposição PHI da linha 42 para 39 foi rejeitada: no arquivo e SHA examinados, o divisor sintético está na linha 42. As referências D-W9-75b/77d já apontavam para as linhas corretas.

Cobertura de aceite ampliada: primeira consulta, retorno e follow-up por HTTP e Chromium; persistência após reinício, replay, leitura histórica após mudança de política, isolamento entre pacientes, alerta condicional preservado, urgência e ausência de assinatura/envio/administração. As evidências finais e o SHA entregue são registrados na descrição do PR; aprovação técnica não é aprovação clínica.

## Integração operacional autorizada — 31/10/2026

Objetivo: conectar as capacidades existentes ao aplicativo e tornar o corpus utilizável no fluxo real. Base: PR #86 em 7e3a7b4c; contribuições do #87 em 2553eb3b reconciliadas seletivamente, preservando a auditoria mais recente. Escritor único: Codex; worktree isolada, sem merge em main.

Lote em execução:
1. Reconciliar #87, corrigir a D-F1-52 e alimentar a revisão/Evolução com dados confirmados do encontro.
2. Ligar segurança da prescrição, radiologia, canal e capacidades administrativas/anamnese ao servidor e às telas; identificar equivalentes já usados antes de duplicar rotas.
3. Ativar o corpus como referência operacional rastreável, separando disponibilidade do catálogo de aprovação médica de fichas/doses e assinatura de documentos. Lacunas e divergências continuam visíveis.
4. Eliminar leituras repetidas por requisição; carregamento de PDF/abas sob demanda e cache apenas de assets estáticos versionados.
5. Provar jornadas sintéticas de primeira consulta, retorno e follow-up, persistência, isolamento, segurança, fronteiras, build e compatibilidade remota.

Aceite: capacidades acionáveis pelo app, sem atalhos por importações só em testes; fontes e estados médicos preservados; ausência de falsa liberação; nenhum envio externo ou assinatura automática; mudanças revisáveis em PR sem merge. O progresso e as provas serão atualizados nesta seção.

### Estado da integração em execução

Implementado nesta branch, ainda em verificação: reconciliação seletiva do #87; função única D-F1-52 nas reduções e cálculos em mg (µg conserva sua regra dimensional); snapshot por requisição em agenda/canal/triagem/salão; telas/PDF sob demanda e cache de assets versionados; navegação operacional ampliada no modo médico; referência de pulmão ATIVO_PARA_CONSULTA 1.1.0; revisão alimentada pelo retrato confirmado; progressão intervalar conectada à regra/corpus; SafetyEngine na preparação/replay/confirmação da prescrição; mensuração 2D/volume disponível junto ao documento original; laudo de acesso F4 com HTTP, fontes, persistência, replay, assinatura explícita e histórico; anamnese F5 com roteiro conferido na interface e respostas oriundas do canal consentido; auditoria RBAC F6 ligada às novas rotas usando apenas a sessão médica autenticada.

Provas parciais: 150 testes em 14 arquivos e build UI passaram antes das últimas integrações; depois, 33 testes em 4 arquivos passaram, incluindo fluxo HTTP do laudo. Typecheck e fronteiras passaram após a ligação F5. Uma execução Windows do arquivo prescricao-executavel-http encerrou o worker com 0xC0000409; exige diagnóstico/verificação, não é aprovação.

Em andamento: testes novos de anamnese, revisão, mensuração, snapshot e navegação; bateria completa, browser e CI remoto; revisão dos hashes e da documentação D-F1-52; reconciliação da entrega em PR sem merge.

Distinções confirmadas: TelaConsulta/PrescricaoPainel/ImageViewerOncoAssist são usados por DemonstracaoApp, não pelo fluxo operacional ConsultaPersistida. Não conectar exemplos sintéticos ao prontuário. A estatística F6 histórica termina em PENDENTE_ISOLAMENTO_WORK_STUDY; preservar a estatística operacional já existente, sem trocar por esse stub. A autenticação atual é médica (CRM); não inventar contas de enfermagem/farmácia/secretaria ou ativar envio externo. ProtocolTemplate e TumorPack com aprovação clínica por item/hash não foram promovidos por simples troca de rótulo; a ativação de referência do corpus não fabrica essas aprovações.

### Provas e ligações adicionais

- PR #85: incorporados apenas os dois componentes e o teste do prazo de 20 s para abertura da consulta; nenhum merge e nenhum prompt de auditoria incorporado. PR #83 permanece separado (não foi integrado silenciosamente).
- Jornada → Flash: evolução, pedido de exames, encaminhamento e orientação podem ser adotados por ação médica, com execução/documento/hash/contexto e fontes revalidados. Receita da skill não entra por essa via; QT continua no editor estruturado. Testes das três jornadas passaram, preservando o original não assinado.
- M123 Chromium passou com Salão, Canal, APAC, Estatísticas, Estudos, Laudo e Anamnese disponíveis na navegação médica; abrir módulos não cria fatos; a jornada existente preservou fonte, cancelamento, recuperação e assinatura explícita.
- F4/F5 HTTP: preparo, recuperação, assinatura/hash/contexto do laudo e curadoria explícita de roteiro, conflito entre respostas, fonte literal, replay e revogação de consentimento da anamnese testados.
- Snapshot: teste confirmou uma leitura do ledger por agenda/salão com dez entradas, preservando E1.
- Inventário revisável em `CORPUS-INVENTARIO-OPERACIONAL.json`: 44 cartões de pulmão ativos para consulta, 35 packs consultáveis, 97 fichas válidas de prescrição, zero packs rejeitados pelo carregador. O estado RASCUNHO dos arquivos de ficha não determina a curadoria efetiva, que é registrada por item/versão/hash no banco local. Esse banco de produção não foi alterado.

### Fechamento técnico para revisão

As capacidades e os handoffs descritos acima estão implementados na branch de integração, sem merge em main. O SafetyEngine também recebe limites declarados na ficha conferida e laboratórios no horizonte do encontro: ausência, unidade não compatível, data futura ou horário insuficiente não viram resultado aprovado. A revisão usa os prazos já existentes (sem criar cortes clínicos). A progressão intervalar preserva alertas de exames datados diante de notas sem data e compara com o exame anterior pertinente, sem transformar pedido de RM em exame realizado.

A bateria exploratória completa revelou regressões de integração, expectativas anteriores de navegação/rotas e triagem de hashes; foram tratadas com provas focais. O inventário contém apenas metadados de corpus: suas 15 ocorrências detectadas como possíveis identificadores foram verificadas como trechos de SHA-256, com disposição vinculada ao arquivo e hash em PHI-TRIAGEM.json. Não foi relaxado o detector. Contagens finais, SHA e verificações remotas ficam na descrição do PR, evitando atribuir ao código uma aprovação clínica.
