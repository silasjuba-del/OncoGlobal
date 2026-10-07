# LUNA 1 — composição e rotas locais reais

Execute F01 e F02 em `C:\Users\silas\Projects\OncoGlobal-wt\w10-luna1`, branch `f0/w10-luna1`, base `04b53db31598fb80ff78192d4cd3eafde36428fd`, como `gpt-6-luna`. Você não está sozinho: preserve edições alheias; root coordena merges e Astra revisa. Não toque nos worktrees da equipe interna apesar da sobreposição documental em app/server.

Escrita: `src/server/**`, `src/app/**`, testes novos `tests/server/**`, `tests/app/**`, `tests/sistema/**`, relatório `docs/progresso/W10-LUNA1.md`, pedidos `docs/w10/PEDIDOS-LUNA1.md`. Não altere expectativas dos testes existentes. Leia DECISOES inteiro, W10-COMUM/W8-COMUM, raiz canônica, contratos W10, `docs/w10/PEDIDOS-INT-GATES.md`, progressos INT, `src/server/{rotas,autorizacao,sessao,http}.ts`, `src/ui/api/{porta,http}.ts` se existentes, `src/leitura/**`, extração/projeções Fugu, `src/rules/prescricao/**`, `src/apac/**` e composição atual app. Use assinaturas reais encontradas; não invente endpoints incompatíveis com PortaUI.

## F01 — W10-LUNA1-01: leituras locais persistentes

Implemente as leituras que a UI marca SERVIDOR_PENDENTE para agenda, salão, canal, APAC, chat e consulta. O servidor usa ledger/projeções/portas reais, sem importar `src/ui/api/fake.ts` nem injetar exemplos na execução normal. Extraia DTOs localmente provisórios se contratos faltarem; não transforme UI no dono do domínio. Preserve API de bundle/confirmar/ação, autenticação, expiração, escopo e logs por códigos fixos. Não exponha dados de outro paciente/setor por IDs/query do cliente. Lista vazia real distingue ausência de fonte ou recurso não implementado; pendência permanece visível.

Aceite: testes HTTP em loopback com SQLite temporário; gravar pelo writer canônico, ler, fechar/reabrir DB e recuperar o mesmo dado; paciente incorreto, sessão ausente/expirada, consulta válida com parâmetros e retorno sem PHI em log. Rotas não devem escrever por GET nem converter prescrição em administração. Domínio ainda sem contrato/persistência suficiente fica PENDENTE documentado; não simule integração completa.

## F02 — W10-LUNA1-02: ligar fluxos governados

Componha extração Fugu com caixa de revisão e rascunho persistente; aplique G-07/08/09 na consolidação, expondo alerta/pendência sem impedir salvar rascunho ou seguir consulta. Todo vínculo exige confirmação médica, sem auto-merge por identificador/score. Fonte, negação, incerteza e conflito sobrevivem à ida/volta persistida. Não reimplemente gates, parser, safetyEngine ou antiglosa.

Consuma prescrição em quatro camadas e antiglosa APAC das APIs existentes; modelo RASCUNHO não vira CONFERIDA_MEDICO. Prescrição e APAC são documentos separados; validação de emissão não assina conduta nem autoriza SIA. Não habilite exportação APAC, WhatsApp, email, agenda externa ou LLM; impressão permanece janela local. Conecte a porta de L2 para autorização/sanitização obtida no servidor e tempo -03:00. L2 é dono de G-27 no gateway. Corpo HTTP nunca fornece sessão médica, autorização ou relatório sanitizado confiável.

Integre, após root disponibilizar commits/interfaces, os serviços de configuração L5, corpus L3 e estatística/RECIST L4 pelas portas de composição. Nenhum helper só exercitado em teste pode ser apresentado como fluxo pronto. Se depender de API ainda não entregue, comunique root e complete F01/partes independentes; root integra bases controladamente. Preservar suporte local sem import ausente.

Aceite: input → rascunho → revisão explícita → projeção/consulta; lateralidade ausente, anatomia divergente e pTNM de biópsia geram pendência/alerta sem travar rascunho; alteração de artefato depois da exibição impede assinatura/efeito; APAC pendente não impede consulta. Exercite D85/D90 via serviço temporal real, configuração persistida refletida na leitura e estatística derivada do ledger quando integradas. Separe NOT_RUN/BLOQUEADO_DEPENDENCIA de PASS.

## Comandos e entrega

Root instala offline. Use apenas wrapper W10 fornecido pela raiz para comandos serializados: typecheck; boundaries; corpus; `npx.cmd vitest run tests/server tests/app tests/sistema --no-file-parallelism`; `npx.cmd vitest run tests/w3/auditoria-regressao.test.ts --no-file-parallelism`. Root pode acrescentar testes focais de prescrição/APAC/gates após integração; nunca suíte inteira. Sem push, dependências, mudança de contratos/package/checker, merge autônomo ou alteração de testes congelados. Dois commits W10-LUNA1-01/02 com Co-Authored-By gpt-6-luna e relatório com saídas reais, caminhos, consumidores e pedidos pendentes.
