# F1-S12 — fechamento e evidências

Estado: **entrega técnica e auditoria S12 concluídas**, com integração pelo [PR #14](https://github.com/silasjuba-del/OncoGlobal/pull/14) condicionada aos checks do HEAD. Provas integrais confirmadas no commit `29cee755`; alterações seguintes de encerramento são documentais. Isso não encerra a curadoria S3c nem declara integração clínica dos 33 rascunhos inativos.

## Quadro de execução aprovado

1. **Temas:** integração final da consulta, revisão documental, rastreabilidade, privacidade, reimpressão e evidência do aplicativo.
2. **Já previsto:** S12 do plano F1 v5; CRIT-5; Q50; D-F1-01/05/07/19; A12–A19 do prompt de auditoria do corpus.
3. **Indicação:** reconciliar a entrega técnica com o PR #10, preservar os limites clínicos aprovados e aplicar melhorias de identificação, navegação e revisão. Validar o conjunto no servidor e navegador reais.
4. **Código simples:** preservar Maestro/ORK e o ledger; corrigir defeitos reproduzidos; medir endpoints e pintura da interface; mapear fontes/consumidores/testes sem criar outro backend.
5. **Biblioteca:** o corpus discutido permanece privado por decisão 1A. Consulta da biblioteca e geração de alerta continuam separadas; nenhuma aprovação coletiva de regras é concedida por esta fatia.
6. **Dr. Silas decidiu:** 1A corpus privado; 2A comportamento do caso de cólon aceito; 3A PR #10 integrado após revisão/checks. Mandato seguinte literal: “APROVADO, APROVEITE AS MELHORIAS, FECHE S12 E ENCERRE S12.” Ao ser informado da ausência de credencial para prova ao vivo do provider, decidiu “NAO PRECISA ESTE TOPICO”: a prova ao vivo sai do escopo desta entrega. Isso não transforma transporte simulado em prova real nem ativa o provider. A autorização vigente permite executar o fechamento, sem repetir essas perguntas.
7. **Não rediscutir:** Maestro/ORK permanece; CTCAE v6; ausência e conflito explícitos; proposto, assinado e administrado distintos; nenhum novo limite clínico retirado das propostas avaliadas; main fora da integração autorizada.

## Base e posse

- Base integrada: `3b7ec8f` (PR #10; correções P1 em `711062c`).
- Entrega complementar em reconciliação: `d3d378c` e `28bdb6d`, branch `codex/f1-entrega-tecnica`; trabalho original preservado. Projeção alinhada à versão v3 da reconciliação.
- Branch desta fatia: `codex/f1-s12-fechamento`.
- Um integrador; conjuntos de escrita distintos para UI, egresso/impressão e provas dos setores. Relatórios e matriz sob responsabilidade do integrador.
- Corpus privado, credenciais, bancos locais e artefatos brutos do navegador não integram a árvore publicável.

## Gates de encerramento

| Gate | Critério | Estado |
| --- | --- | --- |
| Dependências S0–S11 | Aceites técnicos mapeados ao código e provas; limites da cobertura explicitados na matriz | PASS TÉCNICO |
| A12–A19 | Portas, fórmulas, longitudinalidade, invalidação, proposta, dutos e conflitos | AUDITORIA REALIZADA; lacunas de catálogo registradas, sem PASS de integração clínica dos 33 |
| CRIT-5 | p95 determinístico ≤2 s; primeiro texto ≤4 s; tela completa ≤20 s; denominadores explícitos | PASS, no escopo HTTP e DOM/frames descrito |
| Caso-guia | Cólon aceito; demo final, reabertura e ausência de duplicação | PASS |
| Fixture documental | Pantoprazol literal + HMG/Cr + retorno14 + tarefa; campos não ditos pendentes; ≤5 cliques com contagem explícita | PASS |
| PHI | Scanner índice=árvore; saídas ordinárias e exceção D-W9-66 diferenciadas | PASS; zero findings/unscanned/pending na reexecução |
| Provider ao vivo | Não executado; dispensado expressamente por Silas neste fechamento. Gates de código/CI preservados; sem chamada real nem novas solicitações de credencial após a dispensa. | FORA DO ESCOPO POR DECISÃO HUMANA |
| Matriz e relatórios | Matriz F1, caso-guia, mapa dos 33 e RELATORIO-F1 | CONCLUÍDO |
| Integração | Revisão independente; árvore de produto validada; checks e histórico de merge no PR #14 | GATE FINAL NO PR; somente `codex/f1-conclusao` |

## Reconciliação

- Preservadas as correções de contexto, diagnóstico conflitante e assinatura tardia do PR #10.
- Removida uma declaração duplicada de helper introduzida pela combinação automática do projetor, sem retirar qualquer comportamento.
- Preservada a prova W10 mais forte de recibo, autoridade, hash, origem e replay; a simplificação remota das assertivas não foi adotada.
- Transporte simulado, JSON recebido e pintura do navegador são evidências diferentes. Nenhuma delas é chamada de prova ao vivo de provider sem execução real.

## Resultados finais

Resultados medidos nesta árvore de produto e na CI de `29cee755`, sem reutilizar contagens de entregas anteriores. A reconciliação de ancestralidade com `28bdb6d` não alterou a árvore: `b493305c3e42adeb843e0271fb445bcec1c9b578` antes e depois do merge.

### Provas observadas no aplicativo

- Cólon: três formatos reais (PDF digital, PNG, PDF bitmap) convertidos localmente; revisão/vinculação explícita; dois fatos confirmados (diagnóstico e Hb), texto literal selecionado para o restante; três documentos assinados e HTML gerado. Nenhuma chamada externa observada na página.
- Retorno canônico: Pantoprazol literal, cinco documentos (incluindo um pedido com HMG e Cr como duas solicitações), uma tarefa e campos via/quantidade pendentes. Cinco cliques após abertura do encontro e seis preenchimentos programáticos, sem alegar esforço total de digitação. A primeira prova por substrings foi fortalecida com contagem de documento e extração dos dois nomes de exame e reexecutada com sucesso.
- Reinício real: os mesmos oito documentos voltaram nos dois pacientes; reimpressão de ambos os conjuntos executada. As 25 linhas clínicas mantiveram SHA-256 `53840116ee855b42feb45ae35e9e7030f274cdd9d3f6455ce477cb33f7404f36`. Os dois HTML preservaram hashes `491eb22a523fd2b79fe50d0a594a2f871b5ae9441f27cf03fd76176216eebe6f` e `f14e8ff035baffc7c658f088d9352125a7b308864101b30c7857f42ef828a17f`. Reimpressão não criou registros clínicos.
- Layout inspecionado em Chrome: larguras 1440, 768 e 390 sem overflow da página; âncora de revisão abaixo da identificação fixa em todas. Fonte/revisão em colunas no desktop e empilhadas no celular. Não constitui auditoria completa de acessibilidade.
- CRIT-5 navegador final: 30 amostras, três aquecimentos, percentil nearest-rank. p95 primeiro texto 318,7 ms, p95 tela 359,8 ms; máximos incluindo primeira abertura 474,7 ms e 807,3 ms. Primeira abertura após login (não startup frio): 474,7/807,3 ms. O título do resumo é rolado ao viewport e aguardam-se dois frames; histórico/controles e estado networkidle completam a segunda medição. Sem streaming/provider; prova DOM/frames, não instante físico do monitor. Amostras preservadas no log privado `browser-latencias-final.log`.
- Builds: UI 279 módulos e fixture SSR 183 módulos, sem erro. Rebuild SSR inclui projeção v3 e correções finais dos setores.

### Revisão independente e correções

- Duas falhas foram reproduzidas antes da correção: lista atual curta suprimia interação temporal e listas alternativas eram unidas como coadministração. O reataque adicionou oito contraprovas vermelhas; 108 testes focados ficaram verdes. Revisor independente confirmou resolução por leitura do diff, sem se atribuir execução desses testes.
- Backend: resultado desconhecido após envio preservado; retry/restart pela mesma chave não retransmite; documento legado mantém HTML. Revisão independente sem novo defeito concreto nesse escopo.
- UI: receitas múltiplas, seleção individual, edição preservada e resultados tardios/contexto antigo cobertos. Script de latência foi explicitamente limitado a DOM/frames e passou a rolar o título ao viewport; não mede pixels físicos ou streaming.
- Primeira bateria local encontrou artefatos de navegador ainda no workspace e nomes de arquivos sintéticos parecidos com email. Os artefatos foram preservados fora da árvore publicável; o nome do arquivo de teste passou a derivar do ID/versão. Scanner não foi afrouxado.

### Gates finais

| Execução | Resultado |
| --- | --- |
| CI integral `npm run verify` | 3350/3350 testes, 444 arquivos; typecheck, fronteiras e corpus PASS |
| F1 regular + adversarial, Windows e CI | 620/620 testes, 84 arquivos; zero exceções de fronteira |
| CI W10 | 240/240 testes, 31 arquivos |
| CI W8 | 41/41 testes, 9 arquivos |
| Matriz F0 | 290/290 linhas, 184 verdes, zero vermelhos, 106 N-A normativos |
| Reataque local após duas falhas iniciais | 21/21 em quatro arquivos: PHI, receitas UI/HTTP, impressão legada e latência |
| CRIT-5 HTTP, sem concorrência local pesada | 30 amostras + 3 aquecimentos; p95 29,12 ms; máximo incluindo primeira requisição 177,01 ms; startup com seed/login 513,38 ms |
| CRIT-5 navegador | p95 texto 318,7 ms / tela 359,8 ms; máximos 474,7 / 807,3 ms |

Contagens das baterias se sobrepõem e não devem ser somadas. A primeira execução Windows completa terminou com 3348/3350; após saneamento dos artefatos/arquivo sintético e espera HTTP explícita no teste de receitas, o reataque passou e a CI integral passou com 3350/3350. O timeout de integração do teste não altera os limites CRIT-5.

CI verificável: [execução integral](https://github.com/silasjuba-del/OncoGlobal/actions/runs/38493445272). O PR exige novos checks após o commit documental final. A aprovação clínica continua humana, por item, e provider ao vivo permanece dispensado.
