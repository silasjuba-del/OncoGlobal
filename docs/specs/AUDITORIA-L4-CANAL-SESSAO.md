# L4 — sessão temporal e segurança operacional do canal

Base: `3010f0d`. Lote independente de isolamento/RECIST (PR #67), em worktree própria. Autorização do responsável: corrigir código, Luna somente leitura/revisão e Codex único escritor. Merge computacional após revisão e CI; nenhuma alteração de regra clínica/corpus.

## Escopo e invariantes

- F4-14/41: login e autenticação recusam relógio inválido; sessão não autentica antes da emissão. Duração não finita é configuração inválida. Gateway de ação e leitura recusam emissão futura/incoerente antes de efeito externo. Preservar códigos de expiração existentes.
- F4-18: sem callback de processamento, a retomada não resolve pendências nem declara PROCESSADA; mensagem original continua no SQLite. Com callback, retorno e transação atuais permanecem.
- F4-32: revogação tem três estados: revogada, não revogada e indeterminada. Falha SQL, tabela ausente ou contato ilegível bloqueiam autorização/envio, sem inventar revogação. Projeção de pré-consulta mantém mensagem para revisão sem atribuí-la ao paciente quando a consulta de revogação é indeterminada.
- F4-33: relato de infusão só é atribuído pelo contato corrente único e válido. Remover fallback para vínculo antigo do ingresso. A mensagem original não é apagada.

WRITE_SET: `src/server/{sessao,canalEntrada,canalResposta,relatosInfusaoCanal}.ts`, `src/kernel/gateway/gateway.ts`, testes dirigidos de sessão/canal e este documento. Não ligar F6, não mudar processamento clínico de red flags, não alterar templates/doses ou credenciais.

Ampliação necessária pela regressão de CI: `src/server/rotas.ts` preserva 503 de relógio indisponível antes de autenticar; resposta contém somente diagnóstico, nunca dados clínicos. Fixtures positivas de `tests/bateria2/{canal,salao-ui-http}.test.*` passaram a registrar Contato corrente explícito; referências de cadastro no ingresso sozinhas não constituem vínculo corrente. Expectativas de preservação/revisão dos relatos mantidas.

Regressão das falhas do CI: 116/116 testes em quatro arquivos, typecheck verde. Prova adicional sem bearer/credenciais: 3/3 respostas 503 sem dados clínicos e sem efeitos. Revisão Luna do delta favorável; a política preexistente de revogação histórica não foi relaxada.

## Provas

Reprodução antes da correção: relógio inválido desbloqueava tentativas; NaN/Infinity eram aceitos como duração; gateway executava com emissão futura; retomada sem callback resolvia uma pendência; falha SQL de revogação retornava autorização válida; vínculo antigo atribuía relato sem contato atual. Um erro inicial de fixture foi corrigido para passar patientId ao listarEventos e a falha funcional foi então reproduzida.

Regressões: 50/50 na primeira bateria; 60/60 em provas integrais do canal, egress/PDF e revogação; 63/63 após endurecer sessão/relógio e ampliar vetores SQL/JSON/contrato/tabela ausente. Typecheck, fronteiras e corpus passaram. Revisão independente e CI final necessários antes de merge.

Os testes legados de retomada passam a fornecer callback explícito; suas expectativas de processamento real e persistência continuam. A nova prova sem callback exige pendência preservada. Nenhum skip ou expectativa afrouxada.

## Limites

Este lote não resolve F4-17 (diferença entre processamento técnico e cobertura clínica de regras), proveniência/funil dos fatos nem interpretação de alergias. Esses itens não estão declarados corrigidos.

A política preexistente de bloqueio por revogação histórica de contato/endereço foi preservada. Não autorizar reativação por novo cadastro ou supersessão sem especificar a decisão de reativação e consentimento. O novo estado INDETERMINADO refere-se exclusivamente à impossibilidade de conferir a leitura; não transforma essa falha em revogação.
