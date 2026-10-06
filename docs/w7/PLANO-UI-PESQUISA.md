# Extensão UI/Pesquisa — 10 fatias

Pedido do Dr. Silas em 05/10/2026: preservar o cockpit (tags do paciente, chips do hospital, ferramentas à direita), trocar o Oncoboard para oncologista clínico/cirurgião oncológico/radioterapeuta e incorporar estudos, critérios revisáveis, cruzamento local e seguimento longitudinal.

## Base e faixa

- Merge solicitado realizado inicialmente em `f0/w3-codex` e, para executar na pasta definida pelo W7, em `f0/w7-codex`; ambos fast-forward para `12b5dcd4ced28ca87f004c550c6bf7b68977ae30`.
- Raiz de implementação: `C:\Users\silas\Projects\OncoGlobal-wt\w7-codex`, inicialmente limpa.
- Três agentes Luna em paralelo, autorizados expressamente pelo médico; verificações seriadas pelo orquestrador. Nenhum push.
- Somente arquivos novos nas faixas W7 e adendo. Contratos, componentes existentes, pacote e faixas Cursor/Fugu preservados.
- A interface nova é uma composição de entrada local em `src/app/estudio/**`; não substitui `src/ui/App.tsx`. A ligação ao shell do Cursor será proposta como patch, nunca aplicada sobre trabalho concorrente.
- A solicitação atual estende a antiga exclusão temporal de Trials (Q48), preservando a restrição de não declarar elegibilidade automática. A extração por LLM continua uma capacidade injetável, desabilitada sem fornecedor habilitado. A extração textual local é identificada como tal.

## Fatias desta extensão

| ID | Entrega | Dono |
|---|---|---|
| UI-PESQ-01 | Cockpit e navegação hospital/paciente/ferramentas | Orquestrador |
| UI-PESQ-02 | Três personas e prompts detalhados de Oncoboard | Luna Oncoboard |
| UI-PESQ-03 | Importação local, documento integral e proveniência | Luna Pesquisa |
| UI-PESQ-04 | Resumo/candidato de estudo e revisão de critérios | Luna Pesquisa |
| UI-PESQ-05 | Cruzamento determinístico e matriz de pendências | Luna Pesquisa |
| UI-PESQ-06 | Seguimento por estudo/paciente/braço | Luna Pesquisa |
| UI-PESQ-07 | Persistência local versionada e conflitos | Luna Oncoboard |
| UI-PESQ-08 | Kit médico literal, campos e seleção de itens — CDX-05 | Luna Kit |
| UI-PESQ-09 | Laudo APAC e impressão/preferência — CDX-05/06 | Luna Kit + Luna Oncoboard |
| UI-PESQ-10 | Composição local, testes de integração e handoff | Orquestrador |

As dez fatias acima são do pedido de UI/Pesquisa, não uma declaração de conclusão das dez CDX originais de infraestrutura W7.

## Fronteiras clínicas

Ausência/conflito permanece PENDENTE. Critério em prosa sem expressão revisada não é executado. Candidato de estudo não é regra ativa. Confirmação exige fonte, versão e ator humano. Nenhum braço é atribuído por randomização automática. CTCAE/RECIST não são calculados pela IA; resposta é registro médico com fonte. Exportação/assinatura/integração ao ledger não são implícitas. As propostas de pesquisa vivem no workspace, separadas dos fatos clínicos canônicos.

PDF/DOCX/imagens sem extrator disponível são anexos locais, nunca OCR fictício. Nenhum provedor recebe PHI, nome de arquivo ou identificador de paciente. Nenhum arquivo real do protótipo anterior, que contém uma prescrição identificada, é copiado para o repo.
