# W10 — entrega local da cadeia Astra e cinco Lunas

**ENTREGA LOCAL VALIDADA; W10 funcional ainda PARCIAL.** Planejamento, cinco frentes, correções e integração foram executados. F02 e F08 conservam dependências explícitas; testes aprovados não encerram essas dependências nem liberam produção clínica.

Data: 2026-10-07. Worktree: `C:\Users\silas\Projects\OncoGlobal-wt\w10-astra`. Branch: `f0/w10-astra`.
Base inicial: `04b53db31598fb80ff78192d4cd3eafde36428fd`. Base canônica de aceite congelada: `0d843027fa01aa965f5733ba7e816d84f4ac8d9c` (D-W9-61/62 e fichas recebidas do tech lead, preservadas).

## Resultado verificado

| Verificação | Evidência real |
|---|---|
| TypeScript | tsc --noEmit, exit 0 |
| Fronteiras | fronteiras ok (180 arquivos), exit 0 |
| Corpus | corpus ok (109 arquivos), exit 0 |
| Conjunto integrado das áreas tocadas | **47 arquivos / 362 testes PASS**, exit 0 |
| HTTP adicional RECIST/estatística | **1 arquivo / 2 testes PASS**, exit 0; mesmo código de produto |
| HTTP independente identidade/configuração | 7 testes PASS, já incluídos nos 362; não somar novamente |
| Adversarial W8 | 9 arquivos / 41 testes: **36 PASS e 5 FAIL preexistentes**, exatamente os mesmos da baseline |
| Revisão Astra | 14 achados ASTRA-01–14 corrigidos; inspeção independente e execução da raiz discriminadas no relatório de revisão |
| Escopo protegido | Nenhuma diferença autoral em contratos, package/lock, tsconfig, scripts, CI, decisões ou CANONICA contra a base de aceite |

Total distinto aprovado no fechamento técnico: **364**, em dois comandos (362 integrados + 2 HTTP adicionais). Outros totais históricos se sobrepõem. Nunca foi executada a suíte inteira: lock externo, forks, um worker, --no-file-parallelism e seletores explícitos. A primeira baseline com pool padrão excedeu timeout HTTP: INCOMPLETO; reexecução isolada passou sem alterar expectativas antigas.

## Dez fatias

| Fatia / executor | Entrega integrada | Estado e limite |
|---|---|---|
| F01 / Luna 1 | Seis leituras HTTP autenticadas: consulta, agenda, salão, canal, APAC e chat, derivadas do ledger | PASS do backend; dados/produtores ausentes continuam pendentes |
| F02 / Luna 1 | Extração/revisão persistida, contenção de rascunhos, prescrição proposta, antiglosa e consumidores auxiliares | **PARCIAL**: reconciliação/fontes tipadas, quatro camadas completas da prescrição e assinatura na UI dependem dos donos externos |
| F03 / Luna 2 | Egress exige autorização e G-02/G-27; evidência imutável, auditoria, recibo opaco e política no destino efetivo | PASS; conexões externas continuam desligadas |
| F04 / Luna 2 | Instantes/data civil -03:00 e limites D85/D90 consumidos pela APAC HTTP | PASS |
| F05 / Luna 3 | 47 caixas: 16 config e 31 APAC; regulação versionada | PASS estrutural; 12 candidatos pendentes fora da tabela ativa |
| F06 / Luna 3 | 47 fichas/56 modelos, toxicidades com fonte preservada e 25 sinais de alarme | PASS estrutural; RASCUNHO e textos não aprovados não viram conduta/envio |
| F07 / Luna 4 | RECIST longitudinal: elegibilidade, fontes, alvos, nadir, deltas e categorias PROPOSTO; HTTP real | PASS; métodos/dados não avaliáveis permanecem PENDENTE |
| F08 / Luna 4 | Estatística regenerável do ledger, dedupe, categorias operacionais/administração e conflitos | PASS tipado; **PARCIAL** para categorias clínicas amplas de D-W9-42/44 |
| F09 / Luna 5 | Perfil médico/instituição persistente e conexões desligadas, com HTTP | PASS, incluindo reabertura e catálogo real |
| F10 / Luna 5 | Caixas com autoria, antes/depois, revisão esperada, replay e histórico atômico | PASS operacional; envelope global PROVISORIO-W10 em SQLite próprio aguarda contrato canônico |

## Correções e pendências

Corrigidos: PHI em erro/log/recibo, evidência mutável, auditoria ausente, bypass de destino canônico; RECIST sem elegibilidade/nadir zero/overflow/futuro; administração estatística conflitante; configuração com valor anterior/normalização/replay/sessão inconsistentes; transferência de rascunho entre pacientes, confirmação genérica indevida, contexto de outra aba, vínculo revogado/discordante, fila histórica/duplicada e ordenação lexical de instantes.

As reproduções e a inspeção de fechamento estão em `docs/w10/astra/REVISAO-ASTRA.md`. A raiz executou os testes; Astra não declarou ter rodado comandos.

Dependências abertas, sem contornar controles:

1. **UI/Cursor:** exibir conteúdo/versões antes de confirmar. O servidor conserva BUNDLE_NAO_EXIBIDO; carregar cabeçalho não registra hash como se o documento tivesse sido exibido. PedidoBundle tem adaptação server-side, mas o fluxo da TelaConsulta não está concluído.
2. **Fugu/gates:** reconciliador/linha do tempo ainda incompletos; G-07/G-08 com entrada ausente retornam PENDENTE, sem comprovar confronto clínico. Necessário produtor tipado com fonte/escopo.
3. **Prescrição:** requisitos e medidas confirmadas para SafetyEngine/renderer. Sem eles, NOT_EVALUABLE; não promover ficha ou rascunho a ordem assinada.
4. **Contratos/estatística:** promover envelopes provisórios e definir categorias clínicas/denominadores com produtores seguros. Configuração global não usa paciente sentinela.
5. **SIGTAP/SIA/curadoria:** pacote por competência, layout e verificação individual ainda dependem dos donos. Nenhum PASS estrutural autoriza exportação ou conduta.

Cinco falhas antigas fora da cadeia: deduplicação (Fugu); interações, ficha inteira aprovada, manifesto de merge e ownership (Grok). Permanecem FAIL, não foram excluídas nem ajustadas. Pedidos rastreáveis em `docs/w10/PEDIDOS-ASTRA.md` e relatórios individuais.

## Execução e commits

Planejamento/revisão: **gpt-6-astra**. Implementação: **cinco gpt-6-luna**, em worktrees isolados w10-luna1…5. Root coordenou correções, checks e merges seriais. Máximo de três subagentes ativos; um validador pesado por vez.

| Dono | Commits principais |
|---|---|
| Luna 1 | afe9efe, aec59c4 |
| Luna 2 | 3aef417, 660718a, b1e0330 |
| Luna 3 | 0f874b3, 1de66bb |
| Luna 4 | 22a3582, 5bd3012, a15d3ca, 6c36c6d, 401fe5a |
| Luna 5 | 9eccdc7, f545123 |

F01/F02 e F09/F10 compartilham fontes: primeiro commit introduz a composição, segundo acrescenta provas específicas e limites. Testes HTTP independentes L2/L5 foram produzidos no checkout de integração com ownership explícita.

Código integrado testado em `9a4f4ff90c145b7455ca5794691974a74d2b2c3f`. A prova HTTP final entrou em `d81f925`, sem alterar produto. Fechamento posterior acrescenta testes/documentação/evidências ao mesmo produto validado.

## Evidências reproduzíveis

Saídas reais em `docs/w10/astra/evidencias/`:

- `20261007-035530-436-FINAL-INTEGRADO.log*`: 362 testes.
- `20261007-035444-068-INTEGRACAO-HTTP-INDEPENDENTE.log*`: 7 testes, incluídos acima.
- `20261007-040139-690-FINAL-HTTP-RECIST-ESTATISTICA.log*`: 2 adicionais.
- `20261007-035829-779-FINAL-ADVERSARIAL-W8.log*`: cinco falhas antigas.

Histórico: `C:\Users\silas\Projects\OncoGlobal-wt\_w10-astra\logs`. Typecheck silencioso é registrado por TYPECHECK_EXIT=0. Logs preservam espaços do terminal; whitespace de código exclui somente essas cópias brutas.

Reprodução pelo wrapper `docs/w10/astra/validar.ps1`, com seletores VITEST_ARGUMENTS dos transcripts. Usa binários locais e não baixa pacotes.

**Handoff:** worktrees/commits preservados para o tech lead. Sem push, deploy ou merge de volta na principal. Nenhuma decisão clínica ou contrato congelado foi alterado autoralmente pela cadeia.
