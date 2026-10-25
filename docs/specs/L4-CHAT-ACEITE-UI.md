# Chat — aceite visível para anotação na evolução

Base: main dbf4a9af (PR71). Pedido de Silas: conectar aceite à rota existente, somente evolução, com revisão/testes Luna e apresentação da UI antes do merge.

Codex é o único escritor. WRITE_SET: ChatAnotacao/AtendimentoV6 e CSS, porta/HTTP/resposta do chat, filtro de leitura por lote, proxy Vite, testes dirigidos e esta especificação. A correção farmacêutica antiga continua no seu próprio fluxo. Demonstração congelada não é alterada.

O host é a consulta real, junto à V6. Mensagem → Revisar para evolução → texto literal editável → Registrar na evolução. Contexto vem da consulta, autor/data vêm do servidor, saída fixa observacao; nenhum campo clínico é enviado. Repetição após resposta perdida reaproveita operationId. Confirmação atualiza a base sem descartar Hoje/Decisão. Resumo não recebe anotação; evolução recebe a seção rastreável. Leitura filtra o mesmo lote exigido pelo aceite; resposta de outro contexto não é exibida. Chamadas após troca de contexto não atualizam a nova tela.

Aceite: jornada UI→HTTP→SQLite→V6, retry sem duplicar, preservação do texto, isolamento de paciente/encontro/lote, regressão da correção farmacêutica, tipos/fronteiras/CI, revisão independente e captura de navegador com dados sintéticos. Capturas locais em output/playwright, excluídas do commit. PR permanece sem merge até apresentação e revisão da UI por Silas.

F4-13 (recibo servidor-side de exibição) permanece um lote separado; esta integração não declara esse achado encerrado. Próxima etapa após aprovação visual: merge normal com checks verdes; continuar recibos F4-01/09/13.

Revisão Luna sem bloqueadores. Risco de duplicação após remontar resolvido no servidor: mesma autoria, mensagem/origem, contexto e texto retorna a anotação vigente; nova redação explícita continua permitida. WRITE_SET ampliado para dutos.ts por essa evidência. Prova em navegador real OncoassistLocal com HTTP/SQLite produziu uma AnotacaoEvolucao e documento de evolução com seção rastreável, sem inserir a nota no resumo. Capturas antes/depois inspecionadas por Codex e Luna. Tipos e fronteiras passaram; CI e revisão visual do responsável ainda pendentes.
