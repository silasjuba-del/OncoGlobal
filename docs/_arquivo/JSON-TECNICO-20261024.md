# JSON técnico histórico — enxugamento sem mudar conteúdo

Base: `3fb1b3824f690f518a68442ffbdd8e416538a9d0`. Em 24/10/2026, 23 JSONs de comandos, resultados de execução e mapa de movimentações tiveram removida somente a indentação. Nenhum dado, chave, valor, ordem de array ou caminho foi removido. Os 403 destinos do mapa continuam preservados.

Bytes desses arquivos: 188908 → 151638; redução bruta de 37270. O ganho líquido desconta este registro. Não implica redução de RAM ou bundle do produto.

Originais exatos e hashes por arquivo: `C:\Users\silas\Projects\OncoGlobal-archives\20261024-nao-clinico-3fb1b38\lote02-json-tecnico`, em `originais/` e `inventario.json`. Mesma raiz de preservação da PR #60, em subpasta independente; nada do lote anterior foi sobrescrito. A versão original também permanece no histórico Git da base.

Dois candidatos foram preservados sem mudar bytes: C1-L1/resultados.json, vinculado à triagem de PHI, e D2-final-reataque/resultados.json, vinculado ao recibo Q50. Não há mudança em PHI-TRIAGEM.json, Q50-ACEITE.json, corpus, produto, dependências ou testes existentes.

| Caminho em docs/_arquivo | Antes | Depois |
|---|---:|---:|
| MOVIMENTOS.json | 113715 | 95660 |
| f0-fecha/evidencias/A1-base/comandos.json | 3333 | 2362 |
| f0-fecha/evidencias/A1-base/resultados.json | 2380 | 1829 |
| f0-fecha/evidencias/A3-integracao/comandos.json | 3664 | 2601 |
| f0-fecha/evidencias/A3-integracao/resultados.json | 6300 | 5497 |
| f0-fecha/evidencias/A6-portao/comandos.json | 3664 | 2601 |
| f0-fecha/evidencias/A6-portao/resultados.json | 2634 | 2025 |
| f0-fecha/evidencias/C1-L1/comandos.json | 3887 | 2754 |
| f0-fecha/evidencias/C1-L2-C2/comandos.json | 3887 | 2754 |
| f0-fecha/evidencias/C1-L2-C2/resultados.json | 2649 | 2042 |
| f0-fecha/evidencias/C1-L3-repeticao/comandos.json | 3664 | 2601 |
| f0-fecha/evidencias/C1-L3-repeticao/resultados.json | 2645 | 2036 |
| f0-fecha/evidencias/C1-L3/comandos.json | 3664 | 2601 |
| f0-fecha/evidencias/C1-L3/resultados.json | 2348 | 1793 |
| f0-fecha/evidencias/C1-L4-corrigido/comandos.json | 3689 | 2619 |
| f0-fecha/evidencias/C1-L4-corrigido/resultados.json | 2489 | 1908 |
| f0-fecha/evidencias/C1-L4-forks/comandos.json | 3887 | 2754 |
| f0-fecha/evidencias/C1-L4-forks/resultados.json | 2636 | 2029 |
| f0-fecha/evidencias/C1-L4/comandos.json | 3689 | 2619 |
| f0-fecha/evidencias/C1-L4/resultados.json | 3261 | 2631 |
| f0-fecha/evidencias/D2-final-reataque/comandos.json | 3887 | 2754 |
| f0-fecha/evidencias/D2-final/comandos.json | 3887 | 2754 |
| f0-fecha/evidencias/D2-final/resultados.json | 3049 | 2414 |

Provas: igualdade profunda de JSON.parse(original) e JSON.parse(novo) em todos os arquivos; hashes e bytes das cópias originais conferidos antes da escrita; teste documental existente, matriz F0, scanner PHI e gates do projeto. A suíte completa permanece no CI. Não há exclusão ou movimentação neste lote. Sem merge.
