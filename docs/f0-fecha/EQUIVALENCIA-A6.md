# A6 — justificativas de git cherry

A2 levantou todas as referências locais/remotas após fetch. A6 repete os mesmos comandos (`git cherry -v f0/w1-integrado <ref>`); saída estruturada em `inventario-A6.json`.

| Commit ainda marcado + | Integração | Justificativa verificável |
|---|---|---|
| f3724b4 (GLM-21) | ad01bba, cherry-pick -x | O patch original parte de ORK sem AsyncLocalStorage. A resolução coloca a chamada única do agente dentro de emAgente.run, preserva o catch da rejeição tardia e a promessa na corrida. A correção de eleição de competência e os dois arquivos novos de teste foram incorporados. A4: 177/177 PASS. |
| ef6758f (Kimi Q26) | 1afc9b9, cherry-pick -x | A correção AMBULATORIAL/idade e o recurso da fixture já estavam parcialmente no integrado; foi acrescentado o teste que faltava de CADEIRA em qualquer idade, o título explicativo e comentário da fixture. Não se reaplicou mudança já presente. A4: 177/177 PASS. |

Esses hashes têm patch-id diferente por resolução de contexto; não representam trabalho perdido. O GLM-22 mantém equivalência de patch (-). Ramos closure estão incluídos pela ancestralidade do merge 06d404a; planejamento pelo merge 72ce726. Não se usou merge ours, reset, stash ou exclusão para zerar artificialmente o inventário.

WIP Cursor permanece intocado por D2; árvores locais não foram limpas. O artefato original de backup continua no caminho indicado pelo manifesto.
