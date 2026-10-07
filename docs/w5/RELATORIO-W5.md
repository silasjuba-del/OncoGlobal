# W5 · Relatório final da retomada Codex — COM BLOQUEIOS

Estado terminal da execução autorizada: TRABALHO_PRODUZIDO_COM_BLOQUEIOS. ENTREGA_W5_CONCLUIDA = NÃO. Três rodadas encerradas; 20 causas triadas, 14 corrigidas, 2 resistentes promovidas e quatro causas bloqueadas/ambíguas documentadas. A matriz tem lacunas reais. Não concede aprovação técnica, clínica ou de produção.

Branch f0/w5-integrado, worktree C:/Users/silas/Projects/OncoGlobal-wt/w5-orq. Base técnica validada: a877dcfe2e62acb5f09d637ef70dcfedbf3b0957. Retomada a partir de 700f3ee e WIP documental do Fugu, preservado no commit c002d54. Autoridade clínica final permanece com Dr. Silas. Fixtures, executores e revisão humana nos testes são sintéticos; não houve impressão, envio ou uso de paciente real. Sem push/deploy; contratos, decisões, plano, checker congelado e regressão W3 intocados.

## Correções adicionais da rodada 3

- ADV-017: pré-consulta deixou de inferir RESOLVEU/VERDE por omissão. Classificação delega à FN-14, ausência fica PERSISTE/PENDENTE e conflito confirmado permanece vermelho. Commit 909d02c, merge 3c65d73. A expectativa legada errada foi corrigida explicitamente contra K-17 após prova RED, preservando o negativo independente.
- ADV-018: seleção de contexto/horizonte precede supersedes; correção de consulta futura não apaga fatos, eventIds, rulesetRefs ou hash do snapshot antigo. Commit 4a3a082, integrado em 09fe4bb.
- ADV-019: máximo temporal e filtro comparam instantes, incluindo offsets/frações; representação lexical não decide inclusão. Commit 30d4240, integrado em 09fe4bb.
- ADV-020: data civil da última administração é calculada depois do deslocamento pelo offset do serviço. API ultimaAdministracaoQtEfetiva(eventos, offsetServico, modalidadesPorCiclo = {}) exige offset explícito; produção decidida -03:00. Ausente/inválido não presume UTC: retorna dado indisponível/PENDENTE. Versão da ponte A4-ponte-2; callers W3 atualizados sem alterar expectativas. Commit d357b96, merge c29cc8b. Provas de 29/30 dias preservam os limiares já decididos.

E2E e5977aa passou a obter o bundle documental pela rota HTTP real; callbacks usam documentos retornados pelo servidor. Permanecem junções fake explícitas de extração/classificação, fatos e adaptador snapshotParaPack; App não compõe esse pipeline em produção. Idempotência ganhou quatro controles regulares em 4f2fc0b. Nenhum desses positivos resolve CP-001 de autorização de saída.

## Achados por causa raiz

| ID | Família | Sev. | Dono | Estado | duplicadoDe | Commit de correção | Teste de prova / teste regular |
|---|---|---|---|---|---|---|---|
| ADV-001 | F1 | S0 | KERNEL | CORRIGIDO | — | `dd31789` (merge `314b2ef`) | `tests/adv/f01-http-sqlite.adv.test.ts` / `tests/ledger/adv001-idempotencia.test.ts` |
| ADV-002 | F3 | S2 | KERNEL | CORRIGIDO | — | `969092e` (merge `6e5a66a`) | `tests/adv/f03-rotas.adv.test.ts` / `tests/server/bundle.test.ts` |
| ADV-003 | F3 | S2 | KERNEL | CORRIGIDO | — | `ee9ddd5` (merge `61bca1c`) | `tests/adv/f03-rotas.adv.test.ts` / `tests/server/adv003-json.test.ts` |
| ADV-004 | F3 | S2 | KERNEL | CORRIGIDO | — | `c730321` (merge `61bca1c`) | `tests/adv/f03-rotas.adv.test.ts` / `tests/server/adv004-content-type.test.ts` |
| ADV-005 | F4 | S1 | KERNEL | CORRIGIDO | — | `560cfba` (merge `7d65942`) | `tests/adv/f04-phi.adv.test.ts` / `tests/kernel/adv005-phi.test.ts` |
| ADV-006 | F7 | S0 | KERNEL | BLOQUEADO_CONTRATO | — | — | `tests/adv/f07-saida.adv.test.ts` / CP-001 pendente |
| ADV-007 | F8 | S0 potencial | DOMINIO | AMB-001 | — | — | `tests/adv/f08-lotes.adv.test.ts` / aguardando contrato |
| ADV-008 | F8 | S1 potencial | DOMINIO | AMB-002 | — | — | `tests/adv/f08-lotes.adv.test.ts` / aguardando contrato |
| ADV-009 | F2 | S3 | REGRAS | RESISTIU | — | `f61cd81` (promoção) | `tests/rules/adv-009-ambiguidade.test.ts`; prova RED histórica preservada no Git |
| ADV-010 | F6 | S1 | REGRAS | CORRIGIDO | — | `1c11a5f` (merge `3c0d45f`) | `tests/adv/f06-delta.adv.test.ts` / `tests/rules/adv-010-delta.test.ts` |
| ADV-011 | F10 | S2 | KERNEL | CORRIGIDO | — | `0846a30` (merge `61c1891`) | `tests/adv/f10-replay.adv.test.ts` / `tests/projections/adv011-determinismo.test.ts` |
| ADV-012 | F9/F11 | S2 | KERNEL + DOMINIO | CORRIGIDO | — | `53a2c59` + `b3d544b` (merges `c5f8681`/`700f3ee`) | `tests/adv/{f09-arquitetura,f11-especificacao}.adv.test.ts` / `tests/modules/adv012-hash.test.ts` + `tests/server/adv012-hash.test.ts` |
| ADV-013 | F9 | S1 | tech lead (arquivo congelado) | BLOQUEADO_CONTRATO | — | — | `tests/adv/f09-arquitetura.adv.test.ts` / CP-002 pendente |
| ADV-014 | F8 | S1 | DOMINIO | CORRIGIDO | — | `0616b06` (merge `48db259`) | `tests/adv/f08-vencida.adv.test.ts` / `tests/modules/adv014-vencida.test.ts` |
| ADV-015 | F7 | S1 | DOMINIO | CORRIGIDO | — | `6238615` (merge `48db259`) | `tests/adv/f07-template.adv.test.ts` / `tests/modules/adv015-template.test.ts` |
| ADV-016 | F6 | S3 | REGRAS | RESISTIU | — | `cbeda2a` (promoção) | `tests/rules/adv-016-bordas.test.ts`; prova RED histórica preservada no Git |
| ADV-017 | F11/F6/F9 | S1 | DOMINIO | CORRIGIDO | — | `909d02c` (merge `3c65d73`) | `tests/modules/adv017-preconsulta.test.ts`; ausência mantém PERSISTE/PENDENTE |
| ADV-018 | F10/F11 | S1 | KERNEL | CORRIGIDO | — | `4a3a082` (merge `09fe4bb`) | `tests/projections/adv018-historico.test.ts`; supersedes futuro preserva histórico |
| ADV-019 | F10/F11 | S1 | KERNEL | CORRIGIDO | — | `30d4240` (merge `09fe4bb`) | `tests/projections/adv019-tempo.test.ts`; horizonte por instante com offsets |
| ADV-020 | F6/F10/F11 | S1 | REGRAS | CORRIGIDO | — | `d357b96` (merge `c29cc8b`) | `tests/rules/adv020-fuso-qt.test.ts` + `adv020-data-civil.test.ts`; offset explícito e consumer 29/30 |

As dez falhas adversariais finais representam quatro causas, não dez defeitos adicionais: ADV-006 (4 testes), ADV-007 (2), ADV-008 (1), ADV-013 (3). As expectativas das duas ambiguidades são políticas conservadoras provisórias; não constituem decisão de proibir lotes multipaciente/multicompetência. Provas promovidas foram retiradas da suíte RED somente após equivalência regular e GREEN integrado; histórico dos negativos originais continua no Git e nos logs.

## Matriz antes × depois

| Momento / natureza | Total | COBERTO | PARCIAL | SEM_TESTE | FORA_DO_F0 | A_AUDITAR |
|---|---:|---:|---:|---:|---:|---:|
| Base P1 por referência textual, não auditoria funcional | 195 | 0 | 85 | 0 confirmado | 0 confirmado | 110 |
| Última varredura textual do Fugu | 195 | 0 | 93 | 0 confirmado | 0 confirmado | 102 |
| Leitura semântica final, escopo do componente citado | 195 | 67 | 109 | 13 | 6 | 0 |

Não são medidas equivalentes de cobertura: a primeira contagem era somente textual. MATRIZ.md e os cinco mapas registram norma, implementação, assertion positiva/negativa/borda e parcela faltante. COBERTO não prova todos os consumers, provider real, hardware ou uso clínico.

SEM_TESTE: G-07/G-08/G-09/G-27, K-26, FN-16, N17/N19 e T-34/T-49/T-50/T-51/T-56. Grupos relacionados não são causas clínicas independentes. Lateralidade/anatomia/pTNM precisam prova de revisão/proveniência; interações não têm função runtime localizada; biblioteca de fichas inteiras aprovadas não existe; claims não são um harness de admissão de diff. Detalhes e menores decisões em CONTRATO-PROPOSTAS.md. T35/36 e outros FORA_DO_F0 têm citações individuais ao plano; essa categoria não foi usada para esconder obrigação do stub F0.

## F5 · provas por mutação

Nove funções gNN do harness detectaram bypass em R2: G02/G03/G05/G10/G13/G14/G23/G25/G26. Fonte achados/_F05-MUTACAO.md; baseline 23 PASS, nove execuções exit1 por AssertionError. O teste HTTP antigo G25 resistiu à mutação enquanto o unitário a detectou; não inferir integração universal.

Complemento R3: sete controles implícitos G01/G17/G19/G20/G11/G12/G18 detectaram bypass em implementações isoladas, com testes regulares intactos. Baseline 6 arquivos/45 testes PASS; logs 20261005-233435-RED e 233606…233659-RED. Fonte achados/_F05-IMPLICITOS-FINAL.md, runner tests/adv/f05-mutate-implicitos.ps1. Bytes/SHA restaurados após cada mutação e iguais à implementação ativa; detached limpo removido sem force.

Total: 16 controles ensaiados com detecção. G04 é o próprio teste/CI e não foi mutado; G06/G15/G28 não receberam bypass nesse complemento. Isso não é prova global dos 28 gates nem dos consumers ausentes. F5 é PASS no escopo ensaiado e PARCIAL no inventário normativo completo.

## Onze famílias — resultado e limite

| Família | Evidência produzida | Resultado / limite |
|---|---|---|
| F1 idempotência | SQLite, reinício/replay/incerto/payload divergente/concorrência; regulares ADV001 + quatro controles promovidos | PASS componentes; efeitos/executores fake, sem impressora real |
| F2 ambiguidade | identidade exata, homônimos, candidatos e conflito, ADV009 promovido | PARCIAL; não exauriu unidade, negação/falante e data ambígua em todos os consumers |
| F3 HTTP | login/bundle/confirmar/acao, A13, JSON malformado, content-type, sessão/logs | PARCIAL; matriz exaustiva rota×método×sessão e browser CSRF não demonstradas |
| F4 pipeline/PHI | nascimento/residual corrigido, ORK fake, ledger/delta/render/UI; bundle documental HTTP real | PARCIAL; provider e app composto não testados, junções declaradas |
| F5 gates | 9 harness + 7 implícitos por bypass detectado | PASS 16 controles; PARCIAL inventário/consumers globais |
| F6 bordas | thresholds decididos, conflito/ausência delta, correção civil/29/30 | PARCIAL catálogo completo; diferenças numéricas na vista e outras bordas da MATRIZ faltam |
| F7 documentos | política de origem/template corrigida e render; quatro negativos autorização de saída | BLOQUEADO CP001; biblioteca de fichas e consumer autorizado inexistentes |
| F8 lotes | vencida excluída, duplicata não eleita, tumorA/B isolados; três negativos de mistura | PARCIAL/AMB001-002; sem política confirmada por item/lote |
| F9 arquitetura | hash módulos/servidor unificado; três probes checker inerte, leitura de enums/relógio/fronteiras | BLOQUEADO CP002 e PARCIAL varredura; checker verde não prova todas as formas de rede |
| F10 persistência/tempo | determinismo, histórico v1 após v2, offsets, civil; backups regulares existentes | PARCIAL; novo reataque backup NOT_RUN e máquina clínica/HD/chave física não testados |
| F11 especificação×código | hash e ausência; quatro causas S1 adicionais com RED→GREEN, 195 IDs lidos | PARCIAL cobertura normativa; não decide contrato por palpite |

Há ataques novos na terceira rodada, sem abrir quarta. A cobertura de famílias é cumulativa; não foram produzidos três ataques novos em cada família na rodada 3. Nenhuma alegação de exaustão ou demo clínica.

## Bloqueios, decisões e VERIFICAR

- CP-001 / ADV-006 S0: definir fonte canônica server-side de artefato, paciente/encounter, versão/hash, assinatura/revisão humana, validação APAC e destino, com caminho positivo e negativos. A rota atual continua sem essa autorização comprovada; executores reais não devem ser habilitados. Não corrigido por negar tudo ou por fixture declarar assinatura.
- CP-002 / ADV-013 S1: atribuir dono/escopo do checker congelado para rejeitar fetch computado, WebSocket e import dinâmico, preservando positivos dos ports. A seção 3 do mandato W5 congela scripts/check-boundaries.mjs; corretores não contornaram essa fronteira.
- AMB-001/002 / ADV-007/008: definir se ApacBatch operacional pode incluir múltiplos pacientes/competências e qual autorização/validação individual deve preceder impressão/exportação em bloco. Escolha provisória escrita não foi convertida silenciosamente em regra do produto.
- Preencher lacunas SEM_TESTE e consumers PARCIAL em escopo aprovado. Incluem W4-07 adaptador de produção para conflito/PENDENTE, reconhecimento de alertas persistido, app com E1/tema, jobs D85/backup, biblioteca/fonte aprovada, ownership efetivo de escrita/diff.
- VERIFICAR: fontes/valores de SIGTAP e CTCAE pendentes; conteúdo/fonte/edição/curadoria das fichas; assinatura/regulatório antes de uso clínico; provider/voz, navegador, impressão/envio físico, HD e recuperação em máquina real. Fuso do serviço é decidido, não pergunta clínica reaberta.

## Cinco funções e preservação

RED /root/red em w5-red; KERNEL /root/kernel em w5-kernel; REGRAS /root/regras em w5-regras; DOMINIO /root/dominio em w5-dominio; E2E-UI /root/e2e_ui em w5-e2e. Executadas em lotes com até três simultâneas; sem sobreposição de escrita. Claims dos arquivos entregues encerrados com hashes; reserva histórica KERNEL do WIP ADV006 preservada, sem agente editando. Provas de gate em cópia descartável, nunca no código ativo. Integração local serial com verify depois de cada merge.

Único WIP anterior de código preservado: w5-kernel/tests/server/adv006-saida.evidence.ts, SHA256 FE777AB36BFBC4DDC9B3FB832AA087FDB984A6358A331FB8C847E4D8E7DBA291. Não entrou na suíte regular nem foi descartado. Demais cinco worktrees limpos ao entregar. Temporários F5 removidos após raiz/HEAD/status/SHA conferidos. Nenhuma branch W6/W7 ou repo principal foi integrada por esta retomada.

## Execução final real

Na reprodução Markdown foram retirados somente espaços finais de linhas; os logs originais permanecem íntegros nos caminhos indicados.

Base técnica a877dcfe2e62acb5f09d637ef70dcfedbf3b0957. Lock livre após as três execuções. Comandos seriais, sem paralelismo de arquivos (configuração fileParallelism=false no verify).

1. npm run verify — PASS typecheck/fronteiras80/corpus20 e 84 arquivos/476 testes, exit0. Log _w5-locks/logs/20261005-234852-ORQ.log. Saída completa real:

```text
# agente=ORQ worktree=C:\Users\silas\Projects\OncoGlobal-wt\w5-orq comando=npm run verify inicio=23:48:52 exit=0

> oncoglobal@0.0.1 verify
> npm run typecheck && npm run check:boundaries && npm run check:corpus && npm test


> oncoglobal@0.0.1 typecheck
> tsc --noEmit


> oncoglobal@0.0.1 check:boundaries
> node scripts/check-boundaries.mjs

fronteiras ok (80 arquivos)

> oncoglobal@0.0.1 check:corpus
> node scripts/validate-corpus.mjs

ARQUIVO                                          | HEADER     | [VERIFICAR] | ATIVOS
---------------------------------------------------------------------------------------
corpus/capabilities.v1.json                      | ok         | 32          | 0
corpus/packs/colorretal.v1.json                  | ok         | 6           | 0
corpus/packs/mama.v1.json                        | ok         | 6           | 0
corpus/packs/prostata.v1.json                    | ok         | 6           | 0
corpus/packs/pulmao.v1.json                      | ok         | 6           | 0
corpus/rulesets/apac.v1.json                     | ok         | 2           | 0
corpus/rulesets/canal-redflags.v1.json           | ok         | 7           | 0
corpus/rulesets/dose.v1.json                     | ok         | 0           | 0
corpus/rulesets/interacoes.v1.json               | ok         | 5           | 0
corpus/rulesets/lab-thresholds.v1.json           | ok         | 19          | 3
corpus/rulesets/prazos.v1.json                   | ok         | 1           | 0
corpus/rulesets/rad-emergencia.v1.json           | ok         | 22          | 0
corpus/rulesets/salao-triagem.v1.json            | ok         | 0           | 0
corpus/templates/evolucao.v1.json                | —          | 0           | 0
corpus/templates/folha-operacional-salao.v1.json | —          | 0           | 0
corpus/templates/laudo-judicial.v1.json          | —          | 0           | 0
corpus/templates/pedido-exame.v1.json            | —          | 0           | 0
corpus/templates/receita.v1.json                 | —          | 0           | 0
corpus/templates/resumo-14.v1.json               | —          | 15          | 0
corpus/templates/sinais-alarme.v1.json           | —          | 1           | 0

corpus ok (20 arquivos)

> oncoglobal@0.0.1 test
> vitest run


 RUN  v5.0.3 C:/Users/silas/Projects/OncoGlobal-wt/w5-orq


 Test Files  84 passed (84)
      Tests  476 passed (476)
   Start at  23:48:56
   Duration  102.01s (import 40%, environment 33%, tests 19%, transform 5%, worker 2%)

     Import  165 modules were evaluated 660 times · 27.29s total, 40% of tracked time
             ~20.47s faster with isolate: false — shared modules are evaluated once per worker instead of once per file
             learn more: https://vitest.dev/guide/improving-performance#test-isolation

```

2. npx vitest run tests/w3/auditoria-regressao.test.ts --no-file-parallelism — PASS9/9, exit0. Log _w5-locks/logs/20261005-235105-ORQ.log. Saída completa real:

```text
# agente=ORQ worktree=C:\Users\silas\Projects\OncoGlobal-wt\w5-orq comando=npx vitest run tests/w3/auditoria-regressao.test.ts --no-file-parallelism inicio=23:51:05 exit=0

 RUN  v5.0.3 C:/Users/silas/Projects/OncoGlobal-wt/w5-orq


 Test Files  1 passed (1)
      Tests  9 passed (9)
   Start at  23:51:10
   Duration  1.61s (transform 40%, import 34%, tests 25%, worker 1%)

```

3. npx vitest run tests/adv --no-file-parallelism — 3 arquivos/10 FAIL/0 PASS, exit1 esperado somente ADV006/007/008/013. Log _w5-locks/logs/20261005-235112-ORQ.log. Resumo real:

```text
# agente=ORQ worktree=C:\Users\silas\Projects\OncoGlobal-wt\w5-orq comando=npx vitest run tests/adv --no-file-parallelism inicio=23:51:12 exit=1
 ❯ tests/adv/f07-saida.adv.test.ts (4 tests | 4 failed) 713ms
 ❯ tests/adv/f09-arquitetura.adv.test.ts (3 tests | 3 failed) 706ms
 ❯ tests/adv/f08-lotes.adv.test.ts (3 tests | 3 failed) 30ms
⎯⎯⎯⎯⎯⎯ Failed Tests 10 ⎯⎯⎯⎯⎯⎯⎯
 Test Files  3 failed (3)
      Tests  10 failed (10)
   Duration  3.06s (tests 66%, import 17%, transform 16%, worker 2%)
```


## Critério de pronto W5

| Critério | Veredito |
|---|---|
| S0/S1 ABERTO zero exceto bloqueios/AMB escritos | PASS triagem; bloqueios continuam impedindo saída/liberação |
| Todo gate implementado com mutação | PASS 16 controles ensaiados / PARCIAL inventário completo, conforme limites F5 |
| MATRIZ sem SEM_TESTE em G/INV/N | FAIL: G07/G08/G09/G27 e N17/N19 têm lacunas reais |
| Verify integrado + W3 verde e saídas reais | PASS: 84/476 e W3 9/9, exit0 |
| tests/adv somente bloqueios/AMB | PASS organização / FAIL documentado: 3 arquivos, 10 negativos somente bloqueados/AMB |

Veredito final: W5 COM BLOQUEIOS; relatório e estado atualizados, sem AUDIT_APPROVED/REVIEW_APPROVED/PRODUCTION_READY/CLINICALLY_APPROVED. O estado terminal produzido não equivale ao aceite da onda.
