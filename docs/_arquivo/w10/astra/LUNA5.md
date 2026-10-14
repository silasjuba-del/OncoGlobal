# LUNA 5 — configurações locais e alterações versionadas

Execute F09/F10 em `C:\Users\silas\Projects\OncoGlobal-wt\w10-luna5`, branch `f0/w10-luna5`, base `04b53db31598fb80ff78192d4cd3eafde36428fd`, como gpt-6-luna. Você não está sozinho: preserve terceiros. Escrita somente `src/config/**`, testes novos `tests/w10-luna5/**`, relatório W10-LUNA5 e PEDIDOS-LUNA5 em docs. Leia DECISOES inteiro, W10-COMUM/W8-COMUM, raiz canônica, `CaixaNumerada`/`AlteracaoCaixa`, ledger/schema, persistência e sessão existentes. Não edite rotas/UI/corpus/contratos/schema canônico; L1 compõe e L3 fornece catálogo.

## F09 — W10-LUNA5-01: perfil e conexões

Crie serviço local persistente com leitura/edição do perfil médico e instituição separados, nome/CRM/RQE/telefone/CNS/hospital/CNES e preferências autorizadas por D-W9-16. D-W9-10 CNES 2605473 é exemplo editável, nunca instituição confirmada nem preenchimento automático de documento real. Ausente é null/PENDENTE. CNES/CNS são texto, preservando zeros; formato/DV não comprova identidade.

Conexões externas (sites, telefone, skills/plugins/MCP) nascem desativadas em criação, leitura e migração de dado ausente. Configurar endereço não executa conexão nem habilita provider. Campo habilitado enviado pelo cliente não contorna Action Gateway; nenhuma rede real/LLM. Preferência de impressora só registra seleção local, sem impressão silenciosa. Valide tipos de tema DIA/NOITE/PERSONALIZAR e entradas suportadas; não armazene segredo em logs/respostas.

Aceite: ler/salvar/reabrir, campos médicos separados da instituição, CNES exemplo sinalizado/editável, conexão sempre false por default inclusive carga antiga/malformada, input de habilitação não dispara executor. Serviço integrado será exposto pela L1, não por sua faixa.

## F10 — W10-LUNA5-02: edição por caixa e trilha imutável

Receba catálogo `CaixaNumerada` injetado (L3), número+dado e sessão médica fornecida pelo servidor; não aceite autoria do payload como autoridade. Valide existência, número único/chave única, tipo e editavelPor antes de gravar. Mudança tem revisão esperada, idempotência, antes/depois, autor, instante, motivo e evento `AlteracaoCaixa`. Snapshot e evento devem ser atômicos; replay não gera segunda versão, conflito de revisão não perde atualização. Regra clínica alterada recebe proveniência DECISAO_MEDICA somente quando alteração realmente foi autorizada pelo médico; não altere arquivos do corpus automaticamente.

Ponto canônico: `AlteracaoCaixa` não possui revision/operationId; o ledger clínico exige patientId/encounterId. Configuração global não é fato de paciente. Não invente paciente fictício/sentinela para encaixá-la. Use envelope local `PROVISORIO-W10` e porta de persistência/eventos compatível com autoridade e registre pedido ao tech lead; se necessário armazenamento operacional local dedicado dentro de sua faixa, documente claramente que ainda não é integração com o ledger clínico. Não declare esse ponto concluído sem prova e resolução do pedido. Preserve formato canônico AlteracaoCaixa sem campos extras embutidos.

Aceite: edição válida única, número desconhecido, SISTEMA, tipo inválido, duplicidade catálogo, sessão inválida, expectedRevision antigo, replay igual/divergente, rollback em falha, reabertura preservando histórico, antes/depois corretos e ordenação. Sem apagar histórico. Entregue interface concreta para L1 e catálogo solicitado para L3 cedo.

## Validação e entrega

Root executa npm ci offline. Todos os checks pelo wrapper W10 com lock externo: typecheck, boundaries, corpus, `npx.cmd vitest run tests/w10-luna5 --no-file-parallelism`, regressão W3 com --no-file-parallelism. Sem suite inteira, dependência nova, alteração de teste antigo, push, no-verify ou merge autônomo. Dois commits W10-LUNA5-01/02 com Co-Authored-By gpt-6-luna; relatório distingue serviço, persistência, consumidor, evento canônico e pendências com comandos reais.
