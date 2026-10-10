# Inventário final — equivalências e preservação

Snapshot em `inventario-final.json`: 119 referências após fetch e publicação dos branches fonte; 89 worktrees em LIMPEZA-WORKTREES.md. O ramo integrado contém origin/main por 7936820. Nenhum reset, merge ours, limpeza ou exclusão foi usado para ocultar diferenças.

As referências antigas têm zero commits `git cherry +`, exceto GLM-21 e Kimi Q26, já justificadas individualmente em EQUIVALENCIA-A6.md. O ramo Astra original c0c0762 e os quatro closure estão cobertos. O WIP do Cursor permanece intacto e fora do commit, por D2.

| Diferença restante | Destino e prova |
|---|---|
| Preparação Astra f212803 | Mesmo catálogo/fontes/configuração/testes e logs de 90cacc5. STATUS foi resolvido segundo a cronologia própria de cada branch; não se copia painel obsoleto sobre o integrado. |
| Preparação Astra 2e0544c | Cherry-pick 0c59af7; a compatibilidade de Triagem já existia no integrado. Comparação apenas dos arquivos tocados pelo patch confirma o conteúdo da entrega. Deltas posteriores de retomada e escopo são commits causais explícitos. |
| Preparação Astra 55a233e | INTEGRACAO-C2-PREPARADA.md incorporado como registro histórico; a ordem descrita foi cumprida, não é estado final do painel. |
| L1: 74925dc, 9f8887c, 221def6, 8543c33 | Seis arquivos finais importados de 8543c33 em f3b4343. `git diff 8543c33 f3b4343 -- <seis arquivos>` vazio. Checkpoints originais conservados no ramo. Gerador/matriz depois atualizados pela Astra para aceite Q50 e duas observações editoriais Claude. |
| L1: 4c548f8 | Prova D41 já incorporada em f4c4cb0; equivalência por arquivo e prova focal D41-fonte.log. |
| Claude: a37ed8e, bbd4644, 67f34f2, 77febdb, f18870e | Quatro relatórios finais importados em 1cbd76e; `git diff f18870e HEAD -- docs/f0-fecha/CLAUDE-*` nos quatro arquivos é vazio. Revisões intermediárias permanecem no ramo; nenhuma mutação clínica veio da auditoria. |

Ramos remotos repetem as mesmas diferenças, não representam entregas adicionais. Luna 5 c97b8d6 foi incorporada em 4621038 por cherry-pick -x. Inventário renovado em dc2e78c; fontes das Lunas, entrega seletiva e Claude publicadas. Diferenças de patch justificadas não são ancestralidade Git, e não se declara `git cherry` literalmente zerado.

Nenhum `src` ou teste preexistente foi apagado. A revisão independente registrou conservação das rotas e provas adversariais. Logs vermelhos de diagnóstico permanecem ao lado das rodadas verdes; as contagens finais vêm da execução, não de soma de reataques.
