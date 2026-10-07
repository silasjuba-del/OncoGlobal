# W10 — plano de execução Astra

Estratégia elaborada por `gpt-6-astra` sobre `f0/w10-astra` @ `04b53db31598fb80ff78192d4cd3eafde36428fd`. Root coordena ferramentas e integração; cinco executores `gpt-6-luna` implementam em worktrees separados. Esta versão é plano, não evidência de teste/integração. Nenhum teste executado pelo planejador.

## Dez fatias de implementação

As dez etapas de W10-CADEIA-ASTRA são etapas de orquestração. A entrega abaixo contém dez fatias concretas, duas por executor, acompanhadas ao longo daquelas etapas.

| Fatia | Dono/commit | Entrega verificável | Dependência/consumidor |
|---|---|---|---|
| F01 | L1-01 | Leituras reais autenticadas de consulta/agenda/salão/canal/APAC/chat | Ledger e DTOs existentes; UI atual |
| F02 | L1-02 | Composição extração/revisão/gates/prescrição/APAC, serviços auxiliares ligados | F03/04/05/07/08/09/10; app/HTTP |
| F03 | L2-01 | Gateway nega saída sem autorização+G-02+G-27; erros/recibos sem PHI | L1 fornece contexto confiável; saídas continuam desligadas |
| F04 | L2-02 | Tempo civil explícito -03:00 e prova de prazo APAC | F02 consome adaptador; regra APAC existente |
| F05 | L3-01 | Glossário de caixas e corpus regulatório verificável/inativo quando pendente | F10 recebe catálogo; F02 recebe tabela elegível |
| F06 | L3-02 | Receitas comuns/toxicidade em rascunho e 25 red flags com fonte | F02/consumidores futuros, sem ativação automática |
| F07 | L4-01 | Série RECIST com cálculo/proveniência e categoria PROPOSTO ou PENDENTE | Contrato W10 e fonte oficial para critérios adicionais; F02 |
| F08 | L4-02 | Registro estatístico único derivado ledger, dedupe e allowlist sem PHI | Ledger existente; F02 |
| F09 | L5-01 | Perfil local persistente e conexões desativadas | Sessão/configuração; F02 |
| F10 | L5-02 | Alteração por caixa versionada, atômica e auditável | F05, F09 e pedido canônico de evento global; F02 |

F01/F02 são mais amplas por serem composição; não reduzir aceite a módulos isolados verdes. Cada dependência indisponível fica explicitamente PARCIAL/BLOQUEADO_DEPENDENCIA. Mudança de plano deve atualizar esta matriz e manter dez fatias rastreáveis; correções podem ter commits adicionais vinculados à fatia original.

## Ordem tática e máquina

1. Root verifica base/branch/estado e cria worktrees w10-luna1..5 da mesma base; sem mexer no repo principal ou worktrees externos. Instalações offline em série. Não atualizar base móvel por merge autônomo, apesar do texto genérico W10-COMUM: root centraliza sincronização e resolve concorrência.
2. Disparar L2 e L4 independentes. Astra libera seu slot após os prompts; L5 entra. L3 entra no primeiro slot disponível; L1 por último para composição, podendo iniciar F01 sem depender das portas finais. No máximo quatro agentes totais e nunca mais de um validador pesado.
3. Cada Luna envia interface/arquivos/pedidos cedo. Root entrega interfaces e integra commits necessários serialmente; não pedir à Luna que leia ou edite WIP de outro worktree.
4. Root usa wrapper `docs/w10/astra/validar.ps1` para serializar checks com o MESMO lock externo `C:\Users\silas\Projects\OncoGlobal-wt\_w5-locks\vitest.lock`. Não executar wrapper W5 que altera estado de outro worktree. Todos usam --no-file-parallelism; nunca suíte inteira.
5. Integração sugerida L2 → L4 → L3 → L5 → L1 (ajustar apenas pela dependência real). Inspecionar diff, faixas e contratos antes de merge --no-ff. Root não substitui arquivo inteiro diante de conflito sem preservar trabalho concorrente.

## Critérios invariantes

IA propõe, código calcula, médico confirma/assina. Ausência PENDENTE; conflito preservado; sem auto-vínculo de paciente. Trabalho local e rascunho não ficam bloqueados por alerta; assinatura/artefato/saída podem ser negados. LLM e conexões externas seguem desligadas. Sem dado real, só Paciente Teste NN e identificadores sintéticos inválidos. Sem dependência nova, push, no-verify, alteração de teste congelado ou escrita fora de faixa. Dados de paciente não saem do PC.

## Achados de planejamento e pedidos canônicos

| Evidência da base | Tratamento exigido |
|---|---|
| W10-COMUM atribui app/server e glossário/regulatório à Astra e equipe interna | Isolamento de worktree, diff por caminho e revisão serial; não interpretar como permissão para editar checkout alheio |
| gateway.ts não chama G-02/G-27 e propaga r.erro | F03 corrige; F02 fornece autorização e material sanitizado obtidos do servidor |
| autorizarSaida nega canal externo e APAC por falta de evidência persistida | Preservar contenção; nenhum teste fake prova prontidão de envio/SIA |
| RecistAvaliacao obriga números e não carrega alvos/proveniência/contexto | Envelope local PROVISORIO-W10; ausência não vira zero; pedido de contrato, não edição canônica |
| Categoria RECIST global depende também de informações além da soma dos alvos | Não chamar soma de resposta clínica completa; pendência explícita se componente requerido faltar |
| AlteracaoCaixa não traz revisão; ledger clínico exige contexto de paciente | Envelope operacional/pedido ao tech lead; jamais paciente fictício para configuração global |
| classificarDocumento não possui estado de verificação na entrada | Corpus pendente separado da tabela consumível; sem padrão SIMPLE |
| Documento toxicidades ainda fala difenidramina e graduações v5 [VERIFICAR] | D-W9-34c e CTCAE v6 prevalecem; preservar fonte original/divergência; não inventar grau |
| Progressos INT-PRESCRICAO/INT-FICHAS descrevem limites/doses anteriores às D-W9-59/60 | Relatórios históricos não substituem código/decisão vigente; verificar consumo, pedir correção ao dono se defeito ainda existir, sem editar faixa alheia |
| Prompt longitudinal ainda contém conflito histórico sobre estatística | D-W9-44 autoriza estatística; aplicar decisão posterior, sem reabrir pergunta |

Pedidos devem ter fato, arquivo/linha, dano observável, decisão/contrato necessário, dono e contenção. Não transformar todo pedido em bloqueio geral: a fatia independente segue, mas o critério dependente permanece não concluído.

## Validação por fatia e integrada

Wrapper executa em série: `npx.cmd tsc --noEmit`; `npm.cmd run check:boundaries`; `npm.cmd run check:corpus`; Vitest só das pastas tocadas; `npx.cmd vitest run tests/w3/auditoria-regressao.test.ts --no-file-parallelism`. Os cinco prompts detalham seletores. Root confirma caminho real de cada pasta antes de montar comando. Saída truncada, erro de processo, OOM ou comando não iniciado nunca é PASS.

Invocação concreta (trocar dono/pastas, nunca ampliar para toda a suíte):

```powershell
& 'C:\Users\silas\Projects\OncoGlobal-wt\w10-astra\docs\w10\astra\validar.ps1' -Worktree 'C:\Users\silas\Projects\OncoGlobal-wt\w10-luna4' -Rotulo 'LUNA4-F07' -Testes @('tests/w10-luna4','tests/w3/auditoria-regressao.test.ts')
```

O wrapper usa os binários locais equivalentes, sem npx baixar pacotes. Saída `LOCK_OCUPADO`/exit 75 exige reagendamento; não remover lock de terceiro. Para configuração adversarial própria, root fornece `-ConfigVitest` e seletores precisos; `-SoTestes` apenas em reataque focal já coberto pelos checks estruturais pertinentes.

Depois da composição F02, executar testes HTTP/local→ledger→reabertura→leitura e os focais de gateway, regras consumidas, APAC, configurações/corpus e RECIST/estatística. Verificar explicitamente arquivos .adv.ts relevantes pela config própria; teste regular verde não prova ataque adversarial. Rodar em grupos pequenos conforme RAM e escopo, sem coletar toda suíte.

Astra revisa candidato integrado em segunda rodada: leitura de diff e testes adversariais novos nos territórios autorizados pelos donos. Ataques mínimos: bypass gateway direto/HTTP, PHI no erro/recibo/metadado, replay após revogação, assinatura de versão trocada, cross-patient, null→zero/VERDE, auto-merge, data/fuso D85/D90, RECIST alvo omitido/nadir futuro, duplicação de estatística/PHI em categoria, alteração de caixa sem sessão ou com revisão velha, corpus pendente ativado. Achado retorna à Luna dona; root valida correção e reataque focal.

## Fechamento

Root produz `docs/progresso/W10-ASTRA.md`: dez fatias FEITA/PARCIAL/BLOQUEADA, commits, arquivos e consumidores, comandos/exit codes/logs, achados corrigidos e reatacados, pedidos abertos e limites. Estado final distingue implementação, integração e execução dos testes. Nenhum deploy, push, integração em f0/w1-integrado ou aprovação clínica é alegado. A estratégia deverá ser revista pelo Astra após o código; este plano não substitui essa revisão.
