# Consolidação técnica e receita com dose pendente

Pedido do Dr. Silas em 2026-10-19: dose pendente permanece rascunho; propor e pré-preencher doses documentadas, aguardando validação médica; preservar o trabalho concorrente e consolidar a base para a próxima etapa. Esta entrega não aprova conteúdo clínico nem altera doses, limiares, a política 5A ou o corpus.

## Uma linha de integração

Escritor desta fatia: Codex. Worktree ativa: `codex-bateria2-correcoes-20261019`, branch `codex/bateria2-correcoes-20261019`.

Histórias preservadas por ancestralidade, sem rebase ou substituição: Cursor/Claude F2–F6 `0b00a40`, revisão F2 `c794fe8`, bateria adversarial `bb01d41`, bateria 2 `b628cb1`, correção C2 `903f2f9` (merge `aba60b8`) e main local `6c1c6d3`. As outras worktrees permanecem preservadas; não constituem escritores paralelos desta fatia. Os arquivos não commitados de `cursor-setor-jornadas` e `w10-cursor` não integram este PR e continuam sob responsabilidade de seus autores.

## Comportamento da receita

- É possível salvar e reabrir minuta com dose ausente ou marcada PENDENTE/VERIFICAR/SEM_FONTE. A assinatura, impressão e replay de saída recusam receita incompleta, inclusive documento legado e conjunto que contenha essa receita. Eventos históricos são preservados.
- O médico escolhe o medicamento. A consulta documental usa nome exato normalizado; uma fonte elegível preenche campos vazios. Alternativas exigem escolha da indicação. Não há escolha automática de fármaco, cálculo novo de dose ou liberação de tratamento.
- A proposta conserva valor, unidade, via, frequência, duração, indicação, nota, pendência, restrições, trecho, versão e hashes. Veto local de propor continua vigente; o estado RASCUNHO da fonte é exibido e permanece inalterado.
- Alterar medicamento desfaz os valores ligados à proposta anterior. Trocar proposta atualiza valores automáticos; edições médicas explícitas são preservadas com aviso. Resposta tardia não sobrescreve edição.
- Fonte retirada ou alterada não impede salvar minuta, mas exige revisão antes de promovê-la. A validação médica ocorre no botão já existente de confirmar e assinar o conteúdo exibido, ligado à versão e ao contexto. Não existe flag de aprovação enviada pelo cliente que substitua a assinatura.

## Correções de integração F2

Envio passa a ter chave durável por resposta/versão; revogação e novo aceite não reutilizam autorização antiga, mesmo com termo, versão e horário iguais. A autorização acompanha o evento imutável de consentimento; legados sem essa identidade precisam de nova confirmação. Regras apenas ATIVO não produzem alarme. A comparação longitudinal usa vínculo reconciliado e, em corrida, retorna o resultado realmente persistido.

## Próxima etapa e limites

Esta é uma base parcial consolidada, não o encerramento clínico ou técnico de F3–F6. Não declarar resolvidos por este PR:

1. I05 / 9X: decisão vigente de APAC, recurso e ordem temporal na interface.
2. I06 / 11X: autenticação por pessoa, permissão no servidor e autoria da assinatura em todos os caminhos reais.
3. I07 / 10X: proposta e confirmação de adiamento refletidas em agenda, recepção, farmácia e tarefa de nutrição atribuída.
4. 12X: isolamento WORK/STUDY em pesquisa, agenda, administração, farmácia e estatísticas.
5. I08/I09: ligação efetiva das jornadas F2/F5 e dos transportes reais. Nenhuma mensagem externa foi enviada nesta entrega.

Os testes vermelhos da auditoria 9X–12X permanecem separados e explícitos; não foram ignorados, invertidos ou tratados como aprovação. Antes do merge, os três threads remanescentes do PR27 exigem ligar o webhook autenticado à rota de produção, preparar/confirmar a resposta pela interface e conectar o transporte ao executor autorizado. Depois, a próxima fatia operacional deve tratar identidade/permissões e o salão, antes de declarar uso multiusuário. Um único escritor deve partir desta linha consolidada; as alterações locais do Cursor exigem revisão própria antes de integração. Atualizar o PR27 não equivale a atualizar main; os PRs28/29 só podem ser encerrados como incorporados após verificar a ancestralidade publicada.

## Evidência

Testes novos usam somente dados sintéticos e transporte simulado: dose pendente por HTTP; legado/replay; proposta com unidade separada; troca de fármaco e de proposta; fonte obsoleta; UI com servidor HTTP e persistência; regressões F2. Logs completos ficam fora do repositório. Os resultados finais e o SHA validado são registrados no PR; este inventário não substitui os checks nem a revisão independente.
