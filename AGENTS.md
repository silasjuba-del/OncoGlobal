# Lei do repositório OncoGlobal

Estas regras se aplicam a todo trabalho neste repositório e prevalecem sobre instruções genéricas de agentes, prompts copiados e defaults de ferramentas.

## Repositório e conteúdo enviado ao GitHub

- Repositório canônico: C:\Users\silas\Projects\OncoGlobal; repositório remoto: silasjuba-del/OncoGlobal.
- O remoto recebe somente arquivos deliberadamente selecionados, revisados e incluídos em commits. Não enviar estado de trabalho incompleto, arquivos temporários, logs locais, saídas de build, caches, dependências, credenciais nem dados identificáveis de pacientes.
- Não executar git add -A nem git add . sem antes conferir os caminhos staged. Preferir adicionar os arquivos explicitamente atribuídos à tarefa.
- main é protegida no GitHub: toda alteração chega por pull request e passa pelas verificações exigidas; não fazer push direto, force push, apagar a branch nem contornar as proteções. Os administradores também obedecem às regras configuradas.
- O checkout ativo e os worktrees ficam em disco local. Usar commits e o remoto GitHub para compartilhar versões aprovadas; não sincronizar uma árvore .git ativa por OneDrive ou iCloud.

## Autoridade para escrever código

- Somente Codex e Claude podem ser autores de código de produto neste repositório. Um único escritor é designado por fatia, com base e caminhos de escrita explícitos.
- Outras LLMs são auxiliares. Podem pesquisar, planejar, revisar, inspecionar e executar testes sem alterar arquivos.
- Quando o Dr. Silas atribuir explicitamente uma tarefa somente de testes a outra LLM, ela pode criar ou alterar apenas os arquivos de teste e fixtures sintéticas listados na sua WRITE_SET. Não pode editar implementação, schemas, contratos, regras clínicas, configuração, dependências, documentação canônica ou expectativas fora da faixa de teste. Codex ou Claude revisa o diff e integra a contribuição.
- Uma tarefa de testes não autoriza corrigir a implementação, afrouxar critérios existentes, ocultar falhas, adicionar skips, alterar limiares clínicos ou transformar dados desconhecidos em aprovados.
- Claude ou Codex só escreve código quando o pedido atual delimita a tarefa. Planos e revisões não autorizam implementação, publicação ou integração.

## Revisão e execução

- Proteger alterações com pull request para main; verificar os checks de typecheck, fronteiras, testes e provas adversariais configurados antes do merge.
- Não permitir que uma LLM aprove a própria alteração. A aprovação clínica pertence ao Dr. Silas.
- Preservar branches, worktrees, commits e alterações concorrentes. Não resetar, limpar, substituir ou integrar trabalho alheio sem ordem explícita.
- Para material clínico: usar somente dados sintéticos; preservar fonte, trecho, data, negação, incerteza e conflitos. IA propõe, código calcula e o médico decide e assina.
- Uma proteção do GitHub controla branches e merges; ela não identifica qual modelo foi usado por uma pessoa autenticada. A limitação de autoria de LLM acima é uma regra obrigatória de operação do projeto e deve ser seguida em cada tarefa.
