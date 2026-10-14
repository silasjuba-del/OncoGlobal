# Correções da auditoria Muse

Data: 2026-10-07. Base: `37edd9d`, branch `codex/w10-entrega-integrada`, checkout `C:\Users\silas\Projects\OncoGlobal-wt\w10-astra`.
Fonte: relatório Muse fornecido pelo usuário, com ~60 arquivos integralmente lidos e ~230 mapeados de ~1077 autorais. A fonte não comprova revisão integral do repositório; esta rodada também não declara ausência global de bugs.

## Matriz dos achados

| Achado | Estado e ação |
|---|---|
| DUP-01: FN-01…09 espelhadas | CORRIGIDO. `rules/index.ts` passa a fachada dos módulos nomeados. Preservados exports e `funcoesF0`. Validade de hemograma e destino usados pela triagem também foram unificados. |
| DUP-02: seis implementações CNS | CORRIGIDO. Uma implementação em `rules/cns.ts`; APAC, módulo, W8, vínculo e LLM consomem essa autoridade. A testemunha de prefixo 3 é inválida em todas as camadas. O scrubbing mascara números de 15 dígitos reconhecidos mesmo com DV/prefixo inválido, pois validade cadastral não é condição para proteção de dado pessoal. CPF também ganhou uma única implementação compartilhada. Nenhum DV prova identidade. |
| DUP-03: RECIST/unidade | PARCIAL COM MITIGAÇÃO. Validador de unidade único em `rules/medidas.ts`, reexportado pelas APIs antigas. Série e leitor HTTP aceitam unidade/valor originais e exigem concordância com `diametroMm`. Unidade ausente explicitamente ou conversão divergente conserva PENDENTE. Campo legado `diametroMm` já é uma declaração de unidade normalizada; não foi reinterpretado como texto bruto. O motor flat foi preservado como API de compatibilidade, sem criar elegibilidade ou fontes para adaptá-lo artificialmente à série. |
| DUP-04: RADS sem consumidor | CORRIGIDO NO FLUXO DE EXTRAÇÃO. Corpus das 30 cadeias carregado e validado pelo servidor; `/consulta/extrair` retorna e preserva alertas com fonte/trecho. A tela de revisão local apresenta esses alertas. Não são fatos ou emergências confirmadas. Scanner legado permanece compatível com seus consumidores de testes. |
| DUP-05: headers em três normas | CORRIGIDO. Schema runtime único em `contracts/rulesetHeader.mjs`, reexportado pelo contrato TS e consumido diretamente pelo CLI. Salão/dose/prazos exigem esse header em runtime. Rejeita datas impossíveis, semver inválida, falta de fonte e trecho externo `[VERIFICAR]`. Rulesets sem header falham no CLI; outros envelopes de corpus conservam seus contratos próprios. |
| DUP-06: W8/index espelhado | CORRIGIDO. Barrel de compatibilidade reexporta os módulos nomeados. |
| DUP-07: dias civis ×3 | CORRIGIDO NO ESPELHO. API de regras e triagem compartilham `rules/datas.ts`. Helpers de domínio com retorno nullable/validação diferente foram preservados. |
| DUP-08: TriagemExtra provisória | CORRIGIDO. `SinaisExtraW10` é alias do contrato canônico `TriagemExtraW10`. |
| DUP-09: três rotas ausentes | PARCIAL. Rotas reconhecidas, autenticadas e com 501 `CAPACIDADE_PENDENTE`, sem evento/operação. Cliente converte a indisponibilidade em erro tipado. Não há falsa gravação nem 404 ambíguo. Persistência de triagem, liberação com corte e vínculo de canal continua não implementada nesta composição. |
| DUP-10: `/acao` sem executor no modo local | COMPORTAMENTO INTENCIONAL PRESERVADO. Essa entrada não autoriza impressão/envio. Não foram ativados executores nem efeitos externos. |
| DUP-11: loaders diferentes | PARCIAL/JUSTIFICÁVEL. Unificada a autoridade de headers e ligada a carga RADS. Loader de biblioteca com IO injetado, CLI e composição servidor têm responsabilidades diferentes; não foram excluídos por ausência de consumidor atual. |
| DUP-12: dose dupla | JUSTIFICÁVEL. Carry-forward/redução e cálculo por base não foram fundidos. |
| DUP-13: protótipo Deepgram externo | FORA DO CHECKOUT. Não se alteraram limiares clínicos de outro projeto para obter igualdade lexical. Precisa de análise do contexto e contrato antes de integrar. |
| CFG-01: builds colidindo | CORRIGIDO. UI escreve em `dist/ui`; SSR em `dist/oncoassist-local` e `dist/w7-estudio`. Executados os três builds em série; as quatro entradas permanecem após o último build. Nenhum artefato anterior foi apagado manualmente. |
| CFG-02: CRLF | POLÍTICA ADICIONADA. `.gitattributes` declara normalização e EOL para código/configuração; PowerShell conserva CRLF. Não houve renormalização global ou reescrita de outros worktrees. |
| CFG-03: prune no WSL | LIMITE OPERACIONAL PRESERVADO. Worktrees são administrados por Git do Windows; nenhum prune/reparo/remoção foi executado. |
| CFG-04: manifesto Grok/JS fora do tsc | PENDENTE DE AMPLIAÇÃO DE TOOLING. Não foi convertido em um manifesto universal nem adicionada execução de ferramenta específica de outro executor ao verify. |
| CFG-05: HTTP com casts sem validação | CORRIGIDO. Schemas para consulta, agenda, salão, canal, APAC, chat e bundle. Operações de escrita continuam indisponíveis, mas seus clientes também validam resposta. Salão sem fonte usa nullable real e não fabrica proveniência. HTTP 200 vazio não vira confirmação/execução fictícia. |
| CFG-06: Node crypto no browser | CORRIGIDO. Helpers browser-safe separados em `modules/base.ts`; hashing Node em `modules/hash.ts`; fachada antiga preservada. Consumidores puros não carregam o hash. Build UI sem advertência de externalização. Nenhum shim SHA-256 foi criado nem copiado do WIP Cursor. |
| CFG-07: backup de três stores | PENDENTE DE PROTOCOLO DE BACKUP/RESTORE. Nenhum acesso a bancos reais nem mudança de backup nesta rodada. |
| CFG-08/09/10 | Sem defeito novo reproduzido para os offsets/dependências/porta. Observabilidade de inicialização permanece limitada a códigos seguros. |
| CFG-11: adversariais fora do CI | CORRIGIDO. Novo job executa W10 e W8 com configs dedicadas, sem `continue-on-error`. O job W10 ficará vermelho enquanto as oito provas abertas falharem. Execução cloud: NOT_RUN, sem push. |
| Lacunas do check-boundaries | MITIGAÇÃO PARCIAL. Importações laterais e aliases usuais de workspace também são inspecionados. Exceções explícitas apenas para barrels e folhas puras compartilhadas. Scanner continua lexical, sem promessa de análise completa de imports dinâmicos/aliases arbitrários. |
| DOC-01/02/07/08 | CORRIGIDO. Título do teste de termos RADS deixa de prometer cadeia; duas provas adversariais usam a autoridade real de cadeias. Documentação Jev descreve marcadores e revisão local. Fake consome corpus real e aplica o mesmo portão de corte do servidor. Capability RADS aponta o corpus atual. |
| DOC-03/04/05/06 | CNS obsoleto removido do runtime. Histórico documental foi preservado. Entrega/integrado continuam divergentes e não houve merge. Maquinaria W5 legada foi preservada; CI agora executa os conjuntos adversariais reais. |

## Evidências executadas

Somente fixtures sintéticos, testes serializados, sem chamada ao Jev real e sem testes em bancos reais.

| Gate | Resultado |
|---|---|
| `npm.cmd run typecheck` | PASS |
| `node scripts/check-boundaries.mjs` | PASS — 256 arquivos |
| `node scripts/validate-corpus.mjs` | PASS — 116 arquivos |
| Bateria das áreas afetadas abaixo | PASS — 105 arquivos / 675 testes |
| W10, config `tests/redteam/vitest.config.ts` | FAIL — 218 PASS / 8 FAIL, 28 arquivos |
| W8, config `tests/adv-w8/vitest.config.ts` | PASS — 41 testes, 9 arquivos; não atribuído integralmente a este patch |
| Builds SSR OncoAssist, SSR Estúdio, UI | PASS; quatro entradas preservadas após build UI; sem warning `node:crypto` |
| `git diff --check` | PASS |

Comando da bateria final:

```powershell
node node_modules/vitest/vitest.mjs run tests/muse tests/rules tests/rules-w8 tests/rules-prescricao tests/kernel/kernel.test.ts tests/apac-w10 tests/modules tests/ui tests/ui-telas tests/server tests/oncoassist-local tests/oncoassist-jev tests/w10-luna4 tests/w10-grok/grok-05-rads.test.ts tests/w10-grok/grok-13-apac-snapshot.test.ts tests/w3/auditoria-regressao.test.ts --no-file-parallelism
```

Uma rodada intermediária apresentou timeout de 5s em um teste HTTP RECIST sob carga. Reexecução isolada com o timeout original PASS; bateria final completa acima PASS. Nenhum timeout de teste foi aumentado.

Os dois testes de prescrição que declaravam headers mínimos inválidos agora usam o header do fixture canônico; as asserções clínicas foram preservadas. As provas RADS deixaram de procurar nomes hipotéticos no scanner legado e testam o detector real, incluindo cadeia positiva, negada, 30 linhas, negações e referência de corpus. O novo teste HTTP prova o consumidor do corpus sem gravação clínica. Nenhuma prova vermelha foi excluída ou marcada skip.

## Residual e operação

Oito provas W10 abertas: RT-01 (3), RT-03 (1), RT-07 (2), RT-12 (1), RT-15 (1). Algumas verificam exports específicos; classificação causal detalhada permanece necessária. Não foram enfraquecidas para fechar a auditoria.

`MERGE_COM_RISCO` permanece. Não houve push, merge, deploy, ativação de efeito externo, limpeza de branches/worktrees/stashes ou exclusão de artefatos/WIP. `.playwright-cli/` e `output/` foram preservados. Outros worktrees não foram editados.

A UI buildada agora está em `dist/ui`; qualquer publicação futura precisa apontar para esse diretório. Não se configura nem realiza deploy nesta rodada. A política EOL não prova correção retroativa de todos os checkouts antigos. A presença de bibliotecas usadas somente em testes não autoriza removê-las sem confirmar sua finalidade.
