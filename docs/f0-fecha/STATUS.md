# F0 — painel de fechamento

Missão: `docs/ondas/F0-FECHAMENTO-ASTRA.md`, D-W9-80. Writer único do integrado: Codex nesta missão. Merge na main reservado ao Dr. Silas.

## Base

- Checkout: `C:/Users/silas/Projects/OncoGlobal`, `f0/w1-integrado`.
- HEAD inicial: `f42b15fcd9fa87c73109c5b0e0133192712c8680`; checkout limpo antes dos registros desta missão; fetch executado.
- A1 PASS. Evidência serial em `evidencias/A1-base/`; comandos e contagens reais em `resultados.json`.
- TypeScript PASS; fronteiras 290; corpus 125. Regulares: 2.169 testes / 296 arquivos; W10 redteam: 226 / 28; W8: 41 / 9. Todos PASS, sem skips reportados.
- Limite desta sessão: três executoras simultâneas além da orquestradora; cinco Lunas serão escalonadas em lotes após portão A. Testes sempre exclusivos, um worker.

## Inventário

A2 PASS: lista integral em `INVENTARIO-A2.md` e `inventario-A2.json`. Astra 44 commits; GLM 2; Kimi 1; planejamento 1. Ramos closure serão cobertos por A3. Nenhum worktree preexistente será limpo ou removido.

## Fase A

A0 PASS: missão, contexto, fechamento, decisões D-W9-56…80, parecer e resultado das dez fatias lidos. Resultado das dez fatias consultado no ramo `codex/w10-entrega-integrada`, pois ainda não existe no integrado.
A1–A2 PASS; A3 PASS após correções documentadas em RESOLUCOES-A3.md. Bateria integral A3: blocos regulares 2.223 PASS / 10 FAIL (UI/Muse), depois reataque UI+closure UI 131/131; total regular reconciliado 2.233 testes / 309 arquivos. Redteam 240/240 (31 arquivos), W8 41/41. TypeScript, fronteiras 293 e corpus 125 PASS. Logs vermelhos preservados, correções e reataques separados.

Rotas dos dois ramos: nenhuma ausente no comparativo. RT01/03/15 integrados intactos, versões Astra em três arquivos adicionais. Merge A3 publicado: `06d404a`.

A4 PASS: GLM-21 `ad01bba`, GLM-22 `b15bb0d`, Kimi Q26 `1afc9b9`; 177/177 testes em 36 arquivos (A4-sobras.log). O conflito do ORK foi resolvido mantendo AsyncLocalStorage e o tratamento da rejeição tardia; nenhuma chamada duplicada de agente. Q26 acrescenta CADEIRA em qualquer idade e conserva as fronteiras já corrigidas de AMBULATORIAL.

A5 PASS: planejamento `1144eae`, três arquivos, todos em `docs/planejamento/**`, merge `72ce726`.

A6 PASS em `72ce726`: TypeScript; fronteiras 293; corpus 125; **2.240/2.240 regulares em 311 arquivos; 240/240 redteam em 31; 41/41 W8 em 9**. Saídas completas em `evidencias/A6-portao/`. Todos os blocos passaram na mesma rodada serial. `inventario-A6.json` confirma só duas diferenças de patch justificadas em `EQUIVALENCIA-A6.md`; demais ramos cobertos. CI do código publicado em `1afc9b9` também PASS (run 37968146686); o HEAD com planejamento/evidências será publicado agora.

## Fase B

Portão A aprovado e publicado em `369db84732ab5a46283a2356bd85eb656916f009`. Cinco worktrees `C:/Users/silas/Projects/OncoGlobal-wt/f0f-luna1…5`, ramos `f0/f0f-luna1…5`, criados desse HEAD, com junction para node_modules existente. Faixas disjuntas em DISTRIBUICAO-B.md.

L3 concluída em `3b1b67b`: tsc/fronteiras/corpus PASS, 759 + 6 testes PASS. L4 iniciou na worktree atualizada por fast-forward para esse commit (dependência de contratos); não houve merge no integrado.

L2 entregue em `76c0c3b`: C1/C3/C4/C5 PASS na primeira rodada; C6 PASS isolado; E6b-2 FAIL de produto preservado. Prova final três vezes verdes NOT_RUN até correção causal. Detalhes em LACUNAS-C2.md.

L1 (`/root/f0_luna1`) monta/revisa matriz sem testes ativos. L4 (`/root/f0_luna4`) tem TEST_SLOT exclusivo e verifica Flash. L5 (`/root/f0_luna5`) implementou scanner/higiene e aguarda turno de provas. L3 e L2 encerraram seus turnos, ramos limpos. Todas as Lunas têm modelo gpt-6-luna, sem push/merge por executora.

Portão B documental concluído: os cinco relatórios foram entregues. L1 `74925dc`: matriz parcial 273 linhas (114 VERDE, 107 pendências de mapeamento, 52 N-A), fechamento ainda vermelho/NOT_RUN. L4 `68143f9`: Flash e correção APAC por chaves, tsc/fronteiras/corpus/UI/servidor PASS. L5 `8053d15`: três rodadas UI 69/69 PASS; scanner bloqueado por 180 candidatos a triar e 14 opacos, sem alegação de PHI real confirmado. A F0 não está pronta; C/D seguem abertos.

## Fase C

**Portão C1-L4 PASS** em `8d1781894ec5880da432397f1600420fa8a1b548`, rodada `evidencias/C1-L4-forks/`: TypeScript, fronteiras 295 e corpus 125; **2.248 regulares/313 arquivos, 240 redteam/31 e 41 W8/9**, todos passaram na mesma bateria integral serial, um worker e `--pool=forks`. As rodadas anteriores com interrupções nativas continuam preservadas; mudar o pool funcionou nesta rodada, mas a causa nativa não foi estabelecida. Configuração padrão do CI não mudou.

Próxima integração: L2 e correções causais C2 já preparadas/testadas em worktree isolada (consulta HTTP, Flash com resumo revisado, retrato documental, antiglosa na tela, retomada persistente e gates). Uma nova bateria integral será exigida antes do próximo portão.

C1-L3 integrada em `d342b549a2c00645e86f7e36ecc4f3e643aea1b4`. A Astra acrescentou compatibilidade de eventos antigos: novos campos de vertigem ausentes são lidos como `null`, sem alterar fonte persistida. Primeira rodada: blocos 05 e 08 interrompidos com código nativo -1073740791, sem asserção diagnóstica; ambos passaram isolados. Isso foi registrado como instabilidade, não como bateria verde. Repetição **integral no mesmo HEAD**, `evidencias/C1-L3-repeticao/`: TypeScript PASS, fronteiras 294, corpus 125, **2.244 regulares/312 arquivos, 240 redteam/31, 41 W8/9**, todos os blocos PASS. Causa das interrupções anteriores ainda desconhecida; logs originais preservados em C1-L3.

Atualização de coordenação: os cinco relatórios B já foram recebidos. L4 executa agora a correção curta G-06/T-48 de destaque E1 na folha operacional, em faixa própria e com TEST_SLOT exclusivo. A preparação C2 da Astra reúne as provas L2/L5 e correções ainda não integradas; não é evidência de fechamento do integrado.

Integração no ramo principal PENDENTE do portão B. Preparação independente da Astra em `C:/Users/silas/Projects/OncoGlobal-wt/f0f-astra-c2`, ramo `f0/f0f-astra-c2`: base L4 `68143f9` (inclui L3), prova L2 `76c0c3b` incorporada sem alterar asserções. Dono único Astra. Nenhum teste/build será executado enquanto L5 detiver TEST_SLOT. Esta preparação não modifica os ramos das Lunas nem o código do integrado.

Faixa Astra C2: composição real da UI e bootstrap local, compatibilidade de Triagem, reconciliação/decisão persistida, contratos/portas estritamente necessários, projeções de leitura e testes de regressão em tests/f0-fecha. Sem novas dependências, sem LLM externa, sem dados clínicos reais. O worktree adicional eleva o inventário de 87 para 88; permanece ativo, não é candidato de limpeza.

## Fase D

Nota C1-L4: merge original em `cac5a0f`. Primeira bateria integral preservada em `evidencias/C1-L4/`: 06-bloco interrompido nativamente (-1073740791), 08-bloco encontrou duas expectativas históricas de catálogo 47/16 incompatíveis com a nova caixa. Revisão da causa encontrou também faixa numérica inadequada (132) e falta de proveniência no glossário. Correção Astra: nova caixa Flash passa a 17 (configuração <100), fontes registradas; 47 caixas preexistentes conservadas. As duas provas agora exigem 48 totais/17 configurações/31 APAC e verificam explicitamente a caixa Flash. Nenhum teste removido; portão L4 permanece PENDENTE de reataque completo. Relatório LUNA-4 é histórico da entrega original, não sobrescrito.

PENDENTE. Auditoria cruzada final ainda não executada. CI da base A6 `369db84`: PASS, run 37969265836. Proposta de CANONICA preparada em CANONICA-PATCH.md, não aplicada. Lista LIMPEZA-WORKTREES.md inventaria 87 árvores; nenhuma removida. PR final ainda não aberto; PR #2 permanece aberto até substituição comprovada.

## Para o Dr. Silas

- D2: WIP do Cursor preservado e fora da integração até ordem própria.
- D4: limpeza será apenas proposta.
- D5: CANONICA receberá apenas proposta de patch no repositório.
- Merge na main: exclusivo do Dr. Silas após entrega comprovada.

## Riscos

- C1-L4 corrigido em `90cacc5`: todas as asserções executadas passaram, mas 10-bloco terminou nativamente (-1073740791). A bateria não é PASS. O mesmo bloco isolado com `--pool=forks` passou 64/64; isso é diagnóstico, não dispensa a rodada integral. O runner agora aceita `-Pool forks` para verificar a hipótese de instabilidade do modo threads, sempre um worker/arquivo e mantendo todos os testes. Configuração padrão do produto/CI não foi alterada.

- Memória física livre muito baixa na abertura; verificações em série e um worker.
- Contagens históricas não substituem a linha de base A1.
- Documentos anteriores contêm atribuições de writer e nomes superados; D-W9-80 governa esta execução.
