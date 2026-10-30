# Fidelidade longitudinal da timeline
Autorização: Silas, lote de estadiamento e associação de tratamentos. Base fd0425a0, branch isolada codex/flash-evolucao-prontuario / PR 79. Writer único Codex. Sem merge/deploy, corpus novo ou alteração de eventos históricos.

Aceite: sistema/edição/tipo ausentes não são inventados; prefixos literais preservados; data, fonte e ciclo não migram entre tratamentos, fontes, segmentos ou estados; observações históricas coexistem; ausência/ambiguidade permanece pendente. Prova do pipeline até reconciliação HTTP, releitura de drafts, contratos e seções consumidoras.

WRITE_SET: contratos W10 de timeline; normalização, reconciliação e projeção; seção de apresentação; testes de projeção, normalização e reconciliação HTTP; este registro.

Constatação: o fallback AJCC também existe antes da projeção, em normalizarTnm. O lote remove a escolha automática de edição por sítio/data/HPV, pois não é documentação da fonte; testes antigos que exigiam esse default serão substituídos por provas de ausência e edição explícita. Nenhuma diretriz clínica nova é introduzida.

Associação de ciclo: mesma fonte, segmento, tipo de fonte, data clínica normalizada e trecho original; fonte que contém mais de um ciclo ou mais de um tratamento no trecho não autoriza associação arbitrária. Sem vínculo demonstrável, cycle=null. Dados clínicos de intenção/linha permanecem desconhecidos quando não estruturados.

Consumidor: pipeline → estado de extração/draft → reconciliação HTTP. Não confundir esta projeção com a timeline multicamadas do ledger. A UI de reconciliação já exibe fatos/trechos; não será criada outra timeline paralela.

## Evidência e limites
- Testes cobrem fonte → pipeline → draft → vínculo médico → reconciliação HTTP → releitura → reinício do SQLite, com duas fontes e ciclos diferentes; a operação permanece proposta, sem novos eventos clínicos ou assinatura.
- Projeções: desconhecido, prefixos explícitos, edição documentada, divergência tipo/prefixo, idempotência da normalização, ciclos conflitantes, fonte/trecho/página/segmento divergentes, múltiplos tratamentos, observações em datas diferentes e esquemas nominais.
- Contrato StageEntry aceita null para tipo/sistema; snapshots antigos continuam válidos. Não se reescrevem eventos nem se fabricam edições para dados novos. Seção de estadiamento incompleta fica PENDENTE com o literal preservado.
- Intenção/linha não são inferidas. Um ciclo não associável permanece null; não é zero nem ausência de tratamento. Fontes independentes não são fundidas por semelhança de nome.
- A associação é indexada por fonte/segmento/tipo/data/trecho/página/instante, evitando varredura global por tratamento.
- A timeline multicamadas visual e os documentos assinados são consumidores distintos; esta alteração não cria outra tela nem afirma que uma proposta de extração já foi assinada. CI de navegador deve confirmar a preservação das jornadas existentes.
