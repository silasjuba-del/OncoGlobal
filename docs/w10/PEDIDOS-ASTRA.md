# W10 — pedidos e dependencias fora da cadeia Astra

Base verificada: `04b53db31598fb80ff78192d4cd3eafde36428fd`. Nao editar contratos/faixas alheias para esconder falhas. Sem alteracao de expectativas dos testes existentes.

## Falhas adversariais anteriores a estas dez fatias

Comando: `validar.ps1 -Rotulo BASELINE-ADVERSARIAL-W8 -SoTestes -ConfigVitest tests/adv-w8/vitest.config.ts -Testes tests/adv-w8`.
Resultado real: 9 arquivos, 41 testes, 36 PASS / 5 FAIL, todos `SEM_IMPLEMENTACAO`.

| Pedido | Teste / comportamento ausente | Dono segundo W10-COMUM | Contencao |
|---|---|---|---|
| EXT01 | caso07-dedupe: motor de deduplicacao de exames | Fugu, src/leitura | Nao declarar deduplicacao implantada. |
| EXT02 | fn16-t34: semaforo de interacoes | Grok, src/rules | Ausencia de motor nao significa ausencia de interacao. |
| EXT03 | k26-n17: carregar ficha aprovada inteira por id/versao/hash | Grok, src/modules, com curadoria medica | Rascunhos nao viram ficha aprovada. |
| EXT04 | n19: gate executavel de manifesto antes de merge | Grok, scripts/verificar-manifesto.mjs | Root revisa paths/diff; isto nao substitui o gate automatico do projeto. |
| EXT05 | t56-g16: ownership de escrita em runtime | Grok, src/kernel/harness/ownership.ts | Nao habilitar escrita arbitraria por agente. |

Os gates G-07/G-08/G-09/G-27 passaram no mesmo reataque focal. O PASS de gates isolados nao prova composicao nem fechamento dos cinco pedidos.

Logs completos em `C:\Users\silas\Projects\OncoGlobal-wt\_w10-astra\logs\20261007-025647-576-BASELINE-ADVERSARIAL-W8.log.vitest.txt`.

## Dependencias verificadas durante a composicao HTTP

| Pedido | Evidencia e dono | Como destravar / contencao atual |
|---|---|---|
| EXT06 — assinatura real na UI | Cursor/tech lead: TelaConsulta chama carregarConsulta e confirmar, sem exibirBundle; PedidoBundle da porta e servidor tambem divergiam em draftIds/tumorLotId. | Exibir o conteudo real e suas referencias/versoes antes da confirmacao; adaptar chamada da porta ao contrato do servidor. Nunca registrar hashes como exibidos no simples carregamento de cabecalho. G-25 continua bloqueando BUNDLE_NAO_EXIBIDO. |
| EXT07 — reconciliacao e gates clinicos | Fugu/tech lead: pipeline atual conserva fields vazio/timeline null e nao fornece anatomia/lateralidades/specimen tipados suficientes a G-07/08/09. | Publicar produtor e contrato de entradas com fonte e escopo; L1 liga os dados reais aos gates. Entrada ausente permanece PENDENTE; chamadas com objeto vazio nao sao prova de comparacao clinica. |
| EXT08 — quatro camadas completas da prescricao | Equipe prescricao/tech lead: requisitos com fonte e medidas clinicas confirmadas ainda nao chegam a rota de rascunho. | Entregar ValidationRequirement e dados do ledger para o SafetyEngine, depois renderer/documento pela classificacao regulatoria. Parser/classificador/instanciador sao consumidos; seguranca continua NOT_EVALUABLE, sem promover rascunho/ficha nem assinatura. |
| EXT09 — evento global de configuracao | Tech lead: AlteracaoCaixa nao modela revisao/operacao global; clinical_event exige paciente/encontro. | Promover envelope operacional ao contrato canonico sem paciente sentinela. Servico atual tem SQLite local proprio, historico append-only, revisao esperada e idempotencia comprovados. |
| EXT10 — estatistica clinica ampliada | Tech lead/produtores: categorias amplas de D-W9-42/44 ainda nao tem produtor tipado e vocabulario fechado suficiente. | Publicar mapeamentos e denominadores por categoria com ausencia/conflito representaveis. Entrega atual conta pacientes/eventos/documentos/administracoes tipadas, sem interpretar texto livre como classificacao clinica. |

SIGTAP por competencia, layout SIA e curadoria individual de regulacao/receitas permanecem nos pedidos dos seus donos. Uma tabela vazia ou um rascunho nao e promovido por um teste estrutural PASS.
