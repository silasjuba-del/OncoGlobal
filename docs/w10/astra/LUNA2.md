# LUNA 2 — gateway, privacidade e tempo

Execute duas fatias no worktree `C:\Users\silas\Projects\OncoGlobal-wt\w10-luna2`, branch `f0/w10-luna2`, base `04b53db31598fb80ff78192d4cd3eafde36428fd`. Modelo executor: `gpt-6-luna`; estratégia/revisão: Astra. Você não está sozinho: preserve mudanças alheias e não toque em outro worktree.

## Escopo e leitura

Escrita de produto só em `src/kernel/gateway/**`; testes novos só em `tests/w10-luna2/**`. Relatório próprio `docs/progresso/W10-LUNA2.md` e pedidos `docs/w10/PEDIDOS-LUNA2.md`. Leia DECISOES inteiro, W10-COMUM, W8-COMUM, raiz canônica, contratos W10, `gateway.ts`, `src/server/autorizacao.ts`, `src/server/rotas.ts`, `src/kernel/harness/gates.ts`, `src/kernel/llm/sanitizador.ts`, `src/rules/apac.ts`, `src/apac/datas.ts` e testes atuais de gateway. Não edite nenhum desses arquivos fora da sua faixa.

## F03 — W10-LUNA2-01: saída externa governada

O gateway atual aceita executor sem chamar G-02/G-27; a autorização de artefato está na borda HTTP. Além disso, `r.erro` do executor vira `motivoCodigo` e auditoria sem sanitização. Corrija dentro do gateway e ofereça à L1 uma porta injetada de contexto/autorização obtida pelo servidor, nunca um booleano de confiança vindo do corpo HTTP. Preserve a compatibilidade dos fluxos locais existentes e dos testes congelados. Classifique explicitamente saída externa versus ação local; verbo ou destino desconhecido não constitui autorização.

Antes de efeito externo, exija autorização vigente vinculada a paciente/encontro/artefato/versão/hash/destino conforme o ledger e resultados PASSA de G-02 e G-27. Contexto ausente, sanitizer incompleto, não-PASSA, PHI textual/metadados/pixel, consentimento ausente ou versão trocada devem impedir o executor. Não invente relatório limpo. Revalide antes de replay quando houver mudança de autorização ou conteúdo. Preserve reserva atômica, deduplicação concorrente e OUTCOME_UNKNOWN sem reenvio.

Não propague texto livre do executor em erro, auditoria ou recibo externo: use códigos fixos permitidos e recibo opaco validado. Não habilite conexão real nem LLM. Envie à raiz e à L1 o contrato concreto da porta tão logo esteja definido.

Aceite: chamadas diretas ao gateway e composição HTTP não contornam a política; executor fake permanece com zero chamadas nos negativos; payload não-string, PHI no erro/recibo, metadado sem versão, G-27 PENDENTE, artefato trocado, revogação após execução, replay e concorrência cobertos. Testes antigos não podem ter expectativas alteradas.

## F04 — W10-LUNA2-02: tempo civil explícito

Implemente adaptador reutilizável dentro da faixa para instante → data civil do serviço (`-03:00` injetado), sem dependência do fuso do processo. Valide datas e offsets antes de calcular; ausente/inválido retorna pendência, nunca zero ou data atual por fallback. Integre no que realmente consome tempo no gateway e entregue à L1 a interface para rotas APAC; não copie nem edite regra de APAC do Grok. Prazo é D85, D90 bloqueia emissão e consulta segue; aviso até um dia cedo é tolerado, nunca atrasado. A mera criação de helper sem consumidor não conclui F04: documente a ligação pendente para L1/root.

Aceite: equivalência entre offsets do mesmo instante, bordas 02:59:59Z/03:00:00Z, mudança de mês/ano, bissexto, D84/D85/D89/D90; datas malformadas e futuras não produzem liberação.

## Validação e entrega

Não instale dependências por conta própria; root executa `npm ci --offline` serial. Não rode testes/tsc diretamente: use exclusivamente o wrapper W10 com lock externo fornecido pela raiz. Comandos internos solicitados ao wrapper, em série: `npx.cmd tsc --noEmit`, `npm.cmd run check:boundaries`, `npm.cmd run check:corpus`, `npx.cmd vitest run tests/w10-luna2 tests/gateway --no-file-parallelism` (confirme o caminho dos testes existentes), `npx.cmd vitest run tests/w3/auditoria-regressao.test.ts --no-file-parallelism`. Nunca suíte inteira. Reporte FAIL/NOT_RUN como tais.

Um commit por fatia `W10-LUNA2-01: ...` / `W10-LUNA2-02: ...`, com `Co-Authored-By: gpt-6-luna`; sem push, no-verify, contratos, package*, checker ou merge autônomo de base móvel. Root controla atualização e integração serial. Falha em caminho congelado = pedido rastreável, sem contorno.
