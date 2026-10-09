# C2 — reavaliação de candidatos do scanner

Base: entrega L5 `8001655`, 35 candidatos textuais e um WEBP protegido pendentes. A disposição é individual por tipo, linha, ordinal e SHA-256; os arquivos de origem não foram alterados para silenciar achados.

## Reavaliação de 23 ocorrências pela Astra

- Quatro matches de e-mail em `tests/app/executores.test.ts` são nomes de arquivo de impressão `documentId@versao.html`. A construção está em `src/app/executores/imprimir.ts:79`; os testes comparam caminho e recibo. Disposição técnica, não declaração fictícia de um endereço.
- Os dicionários DIC de RT12 e o contato não vinculado da porta fake foram rastreados às factories e cenários locais pela revisão somente leitura de L2. ADV006 usa domínio reservado `.invalid`, executor fake e exige zero efeitos.
- A Astra releu os testes de importação, cadastro e APAC: os tokens são vetores literais de máscara/igualdade/dígito verificador, incluindo pares válido/inválido e um caso p1 sem origem em cadastro externo. A disposição identifica precisamente cada vetor e sua finalidade; não conclui que validade de dígito comprova identidade e não estende a permissão a outros dados do arquivo.
- O candidato de telefone em STATUS é um identificador de execução de CI explicitamente rotulado no registro A6. O SHA dessa versão de STATUS mudou por documentação da missão e foi revisto antes de atualizar o vínculo no manifesto; os demais 22 itens exigiram igualdade com o hash já revisado por L5.

Resultado da alteração documental: 23 ocorrências reclassificadas; 12 candidatos textuais ainda pendentes. Scanner após essa alteração **NOT_RUN**; o integrado está com TEST_SLOT. O WEBP continua protegido, sem leitura ou aprovação presumida. A prova final precisará considerar também arquivos e evidências novos do candidato integrado.

## Segunda reavaliação: dez ocorrências documentais

A revisão somente leitura de L3 identificou dois códigos de falha de worker confundidos com telefone, uma matrícula explicitamente descrita como fixture inventada, dois setid de referências DailyMed e dois DOI (fonte e compilação iguais), além de dois telefones institucionais rotulados no expediente do manual. A Astra também verificou que `Triagem_QT_v20.html:213` inicializa `nome` com string vazia: o match capturava nomes de outros campos vazios na mesma linha do objeto JavaScript. A leitura conservadora inicial de nome preenchido foi corrigida com essa evidência literal.

Dez ocorrências receberam disposição individual, mantendo igualdade do hash. Restam dois candidatos textuais para conferir no contexto do PDF e o WEBP protegido; nenhuma varredura nova foi executada durante o TEST_SLOT do integrado.

## Releitura dos dois candidatos restantes

L3 repetiu a extração local das páginas com pdfplumber, preservando layout. No manual do paciente, o campo Nome da página 2 está vazio até o próximo rótulo; a extração plana havia unido campos. No outro manual, o e-mail da página 32 pertence ao bloco da Ouvidoria e coincide com o domínio institucional impresso. Disposições técnicas/editoriais registradas por página/ordinal/hash, sem reproduzir identificadores.

Os 35 candidatos do snapshot L5 têm agora justificativa individual. Isso não é ainda um scanner verde: o WEBP permanece protegido e a varredura do novo candidato, com seus arquivos/evidências adicionais, continua NOT_RUN até liberar o slot.
