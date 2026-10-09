# Ordem da integração C2 preparada

Este arquivo registra dependências; não declara o portão concluído.

- O integrado recebeu L3 e a entrega original L4 `68143f9`; corrigiu catálogo e fronteiras numéricas em `90cacc5`. Runner com opção de processos separados em `8d17818`. Ainda aguarda rodada completa PASS.
- L2 original: `76c0c3b`. Suas provas precisam das correções de produto abaixo; preservar os seis critérios e os logs vermelhos.
- Correções L4 independentes: `ffeef6e` (E1), `3a32431` (projetor AP), `8b1f10` (G22/Q09). Podem entrar por cherry-pick após L2, como rodada curta C2. O código E1 recebe correção arquitetural em `04de94d`.
- Correções Astra: `2e0544c` (consulta HTTP, conteúdo exibido, APAC, fontes), `04de94d` (retomada durável/atomicidade e fronteira E1), `9e85538` (preparação da demo e pedido de auditoria), `9d57882` (API pública G22). O integrado já tem a compatibilidade Triagem de parte do primeiro patch; conservar sua prova original ao resolver eventual conflito.
- A worktree de L1 foi atualizada com os códigos preparados para poder mapear consumidores existentes. Essa base inclui a entrega original de L5. Portanto **não fazer merge cego de toda a ancestry de L1 antes da etapa L5**. Ao concluir a matriz, importar somente os arquivos de sua faixa em um ramo de entrega a partir do integrado, documentando o commit fonte e equivalência, e integrar essa entrega. Conservar todos os ramos originais e os checkpoints.
- L5 scanner contextual: `8001655`, descendente de `8053d15`. Permanece PARTIAL, com 35 candidatos e um WEBP protegido pendentes no snapshot de sua worktree. A preparação C2 pode incorporá-lo para triagem; no integrado manter a ordem L1 → L5.

Depois das correções causais associadas a cada entrega, executar a bateria completa em série antes do próximo portão/push do integrado. Nenhuma bateria focal ou teste isolado dispensa a completa. Na etapa final, repetir E6b três vezes no candidato estável, renovar o inventário Git e registrar auditoria, demo e CI.
