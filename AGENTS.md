# Lei do repositório OncoGlobal

Estas regras se aplicam a todo trabalho neste repositório e prevalecem sobre instruções genéricas de agentes, prompts copiados e defaults de ferramentas.

## Repositório e conteúdo enviado ao GitHub

- Repositório canônico: C:\Users\silas\Projects\OncoGlobal; repositório remoto: silasjuba-del/OncoGlobal.
- O remoto recebe somente arquivos deliberadamente selecionados, revisados e incluídos em commits. Não enviar estado de trabalho incompleto, arquivos temporários, logs locais, saídas de build, caches, dependências, credenciais nem dados identificáveis de pacientes.
- Não executar git add -A nem git add . sem antes conferir os caminhos staged. Preferir adicionar os arquivos explicitamente atribuídos à tarefa.
- Toda alteração em main deve chegar por pull request e passar pelas verificações exigidas; a proteção efetiva deve ser conferida no GitHub (em 30/10/2026, a API informou protected=false); não fazer push direto, force push, apagar a branch nem contornar as proteções. Os administradores também obedecem às regras configuradas.
- O checkout ativo e os worktrees ficam em disco local. Usar commits e o remoto GitHub para compartilhar versões aprovadas; não sincronizar uma árvore .git ativa por OneDrive ou iCloud.

## Autoridade para escrever código

- Qualquer LLM pode escrever código de produto com autorização do Dr. Silas, dentro do escopo atribuído. Um único escritor é designado por fatia, com base e caminhos de escrita explícitos.
- Sem autorização de escrita, as LLMs podem pesquisar, planejar, revisar, inspecionar e executar testes sem alterar arquivos.
- Quando o Dr. Silas atribuir explicitamente uma tarefa somente de testes a uma LLM, ela pode criar ou alterar apenas os arquivos de teste e fixtures sintéticas listados na sua WRITE_SET. Não pode editar implementação, schemas, contratos, regras clínicas, configuração, dependências, documentação canônica ou expectativas fora da faixa de teste. A revisão e a integração cabem aos responsáveis autorizados; não há autoaprovação.
- Uma tarefa de testes não autoriza corrigir a implementação, afrouxar critérios existentes, ocultar falhas, adicionar skips, alterar limiares clínicos ou transformar dados desconhecidos em aprovados.
- Qualquer LLM só escreve código quando o pedido atual delimita a tarefa. Planos e revisões não autorizam implementação, publicação ou integração.

## Revisão e execução

- Proteger alterações com pull request para main; verificar os checks de typecheck, fronteiras, testes e provas adversariais configurados antes do merge.
- Não permitir que uma LLM aprove a própria alteração. A aprovação clínica pertence ao Dr. Silas.
- Preservar branches, worktrees, commits e alterações concorrentes. Não resetar, limpar, substituir ou integrar trabalho alheio sem ordem explícita.
- Para material clínico: usar somente dados sintéticos; preservar fonte, trecho, data, negação, incerteza e conflitos. IA propõe, código calcula e o médico decide e assina.
- Uma proteção do GitHub controla branches e merges; ela não identifica qual modelo foi usado por uma pessoa autenticada. A exigência de autorização por escopo acima é uma regra obrigatória de operação do projeto e deve ser seguida em cada tarefa.

## Continuidade sem duplicação

- Antes de alterar, conferir SHA remoto, PRs, branch e WIP; identificar sobreposição de arquivos. Não presumir abandono por idade do registro.
- Usar a PR, inclusive draft, para tornar visível uma frente pronta para compartilhar: objetivo, escopo, evidências e pendências. Código, testes e docs selecionados podem ir ao remoto; dados sensíveis, cópias de preservação e WIP não triado não podem.
- No encerramento, informar commit/branch e o que permanece apenas local. Não impor push automático nem apagar trabalho sem examinar dependências e verificar preservação recuperável.
- Manter decisões em docs/DECISOES.md, orientação de entrada no README e specs vigentes no local existente. Não criar registro paralelo de sessão nem checkpoint documental para uma correção já autorizada.


<!-- ONCOGLOBAL-CONTEXTO-LLMS:BEGIN -->
## Leitura inicial obrigatória — contexto e continuidade

Antes de planejar, editar ou publicar, leia [CONTEXTO-LLMS.md](CONTEXTO-LLMS.md) por inteiro e confira o estado real do checkout. A leitura é obrigatória para qualquer LLM que atue neste repositório, respeitando as instruções superiores e o pedido atual de Silas.

O documento distingue OncoGlobal de oncoMed, implementação de proposta e entrega de merge; registra fontes, vetos, worktrees e estados com data/hora e assinatura técnica. Ao abrir um worktree ou concluir um lote, mantenha esse registro conforme seu escopo, preservando WIP e trabalho alheio. Não presuma que o snapshot está atualizado nem que arquivos locais sejam a main remota.

Não agir como se tivesse lido quando não houver acesso: informar a lacuna e obter o documento. Nenhuma regra deste bloco autoriza merge, deploy, alteração clínica ou escrita fora da tarefa. Ferramentas que não carregam instruções do repositório devem receber o mesmo documento como anexo.
<!-- ONCOGLOBAL-CONTEXTO-LLMS:END -->
