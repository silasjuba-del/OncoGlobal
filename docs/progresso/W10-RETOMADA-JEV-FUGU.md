# Retomada das dez fatias + Jev / OncoAssist / Fugu

Data: 2026-10-07. Worktree `w10-astra`, branch `codex/w10-entrega-integrada`, base `846be32d0777ef89559a5325fd352367e4bf781b`.
Estado global: **COMPLETED_WITH_LIMITATIONS para esta rodada; W10 continua PARCIAL**. Não houve merge no ramo do tech lead, push, deploy ou liberação clínica.

Commits locais de implementação: `bbdb8c4` (extração, isolamento, temporalidade, ORK e estatística) e `239ed56` (Jev/OncoAssist, G25, rotas e provas Fugu). Os testes foram executados sobre o conteúdo de trabalho antes dos commits; não há alegação de CI remota. Artefatos temporários `.playwright-cli/` e `output/playwright/` foram preservados fora dos commits. Captura adicional em `C:\Users\silas\Projects\OncoGlobal-wt\_w10-astra\logs\RETOMADA-JEV-BROWSER-20261007\oncoassist-local.png`.

## Resultado das dez fatias

| Fatia | Resultado desta rodada / limite |
|---|---|
| F01 Extração | Corrigidas mistura de pacientes na reconciliação, validação temporal cruzada, agrupamento radiológico/requisitos entre segmentos, negação intrafrase e homônimos com fronteira duvidosa. Revisão e fonte preservadas. Ainda pendentes os probes RT01/RT03 e suas lacunas. |
| F02 Revisão/persistência | PASS no percurso HTTP testado: preparar conteúdo completo, registrar comprovante na sessão e confirmar somente a seleção/hash/fonte/contexto exibidos. Alteração de fonte, seleção, paciente, lote ou sessão é rejeitada. INFERRED/UNCERTAIN não vira FATO. |
| F03 Gateway | Regressão do gateway PASS; Jev usa SDK backend opt-in, endpoint fixo, desidentificação existente, timeout/cancelamento, sem retries/logs de conteúdo e validação runtime. READ externo geral permanece pendente (RT12). |
| F04 Sessão/temporalidade | PASS: troca de contexto invalida bundle; seleção de lote ocorre no servidor; laboratório datado ou LabResult não fica VERDE apenas por existir/data recente. Conflito histórico não resolvido continua visível. |
| F05 Brain/OncoAssist | SDK e serviço Jev conectados a rotas autenticadas, fonte local e painel. Entrada real `/oncoassist.html` usa login/agenda/consulta existentes. Execução real TypeSafe PENDENTE de chave e configuração; simulações offline não são validação de qualidade do modelo. |
| F06 Grafo/vetores | Recuperação/artefatos existentes revalidados no bloco Luna3. Não foi criado índice vetorial, embedding numérico ou segundo Brain OS. Capacidade vetorial segue NOT_IMPLEMENTED. |
| F07 Longitudinal/RECIST | Consumidor SQLite → lerRecist → avaliarSerieRecist → seção exercitado. Resultado PROPOSTO fica PENDENTE; nenhuma regra RECIST ou TNM inferida de prosa. |
| F08 Estatística | Filtro opcional por período clínico inclusivo, denominadores/exclusões e ausência de PHI testados. Supersessão e conflito avaliados antes do recorte; não usa captura como data clínica. Estatística clínica ampla continua parcial. |
| F09 Caso integrado | Prova HTTP com extração, exibição, confirmação e reabertura; browser real com login, paciente sintético de agenda e OncoAssist pendente. Não foram instalados Plaud/Nova-3 nem provedor real testado. |
| F10 Verificação | Gates e reataques executados, sem apagar ou suavizar testes adversariais antigos. Resultado W10 dedicado: **216 PASS / 10 FAIL**. |

## Evidência executada

Logs em `C:\Users\silas\Projects\OncoGlobal-wt\_w10-astra\logs`.

| Bloco | Resultado | Log |
|---|---|---|
| Gateway, corpus/conhecimento, configuração e W3 | 9 arquivos / 49 PASS | `20261007-171456-812-RETOMADA-F03-F06-CONFIG.log` |
| Integração backend, Jev, HTTP, projeções, ORK, Fugu e W3 | 42 arquivos / 271 PASS; tsc, fronteiras e corpus PASS | `20261007-172933-434-RETOMADA-INTEGRADA-NODE2419.log` |
| Interface, modo local, segmentação e cinco arquivos Fugu | 52 arquivos / 217 PASS; tsc, fronteiras 247 arquivos e corpus 116 arquivos PASS | `20261007-173531-735-RETOMADA-UI-SEGMENTER-FINAL.log` |
| Extração após a última correção de homônimos | 14 arquivos / 126 PASS | `20261007-174113-178-RETOMADA-EXTRACAO-FINAL.log` |
| W8 adversarial final | 9 arquivos / 41 PASS | `20261007-174156-071-RETOMADA-W8-FINAL.log` |
| W10 adversarial final | 28 arquivos / 216 PASS / 10 FAIL | `20261007-174043-042-RETOMADA-REDTEAM-FINAL.log` |

Os blocos se sobrepõem; não somar seus totais como testes distintos. A suíte inteira não foi executada. Builds Vite cliente multipágina e SSR local passaram. O aviso preexistente `node:crypto` permanece no bundle da demonstração; a entrada real do OncoAssist foi separada e verificada no navegador sem carregar esse módulo.

No Node 24.15, duas rodadas tiveram encerramento nativo de worker (`3221226505`); também ocorreu `UV_HANDLE_CLOSING` na CLI Playwright. Não foram tratadas como PASS. Reexecução com o Node 24.19 já fornecido pelo ambiente, via PATH somente do processo, concluiu os blocos acima. Nenhuma instalação ou troca global de Node foi feita.

## Fugu real, via CLI

Provider Sakana, modelo `fugu`, `responses`, image_generation desabilitada. Sessão `01a117fe-8352-76e0-9cb2-73cae5b45478`. Cinco codificadores reais produziram os arquivos `tests/w10-fugu-eixo/{extracao,revisao,temporal,orquestracao,phi}.test.ts`; IDs no relatório `W10-FUGU-ADV-EIXO.md`.

O sandbox da CLI impediu criar o lock externo. Codex executou as mesmas provas pelo wrapper compartilhado; surgiram cinco defeitos de produção em extração/projeções, corrigidos e reatacados com as expectativas Fugu intactas. Outro erro era fixture nova INFERRED sem regra obrigatória; foi corrigida a fixture, preservando a exigência de não promoção clínica. A orquestração teve revisão adicional de Codex sobre o isolamento e recebeu regressão causal.

## Dez falhas antigas que continuam abertas

| Grupo | Quantidade / dependência |
|---|---|
| RT01 | 3: probe da ação de vínculo, nome × identificador e deduplicação documental. A prova HTTP nova cobre vínculo/exibição, mas isso não autoriza declarar o probe antigo corrigido. |
| RT03 | 1: detector fonético/homóglifo acessível pela interface esperada. |
| RT05 | 2: cadeias RADS e corpus conectado; há WIP correspondente do tech lead no repositório canônico, preservado. |
| RT07 | 2: unidade/plausibilidade de laboratório; não foi inventada faixa clínica para tornar o teste verde. |
| RT12 | 1: contrato/gate de READ externo geral. |
| RT15 | 1: interface esperada para reconciliação planejado × prescrito. |

RT02 (homônimos) e RT09 (reentrada/composição pelo ORK) passaram nesta rodada. O guard do ORK restringe reentrada pelo próprio runtime; não é sandbox capaz de impedir uma função JavaScript arbitrária de chamar outra diretamente.

## Como usar e limites operacionais

Ver `docs/w10/ONCOASSIST-JEV.md`. O backend exige ledger existente e credenciais locais por ambiente; Jev exige `TYPESAFE_API_KEY` e `ONCOASSIST_JEV_ENABLED=true`. Não colocar chave em `VITE_*` nem no navegador. Não houve chamada real ao Jev ou envio de documento de paciente nesta rodada.

O smoke usou ledger temporário próprio com Paciente Teste 99. Login, agenda, seleção e painel de capacidade pendente foram observados no Playwright. Os servidores e o browser do smoke foram encerrados; não fica processo clínico em execução. O hash e mapa de identificação ficam locais, mas o detector atual não garante anonimização de nomes desconhecidos no cadastro.

As fontes prioritárias em `planejamento/docs/planejamento/fontes`, o pacote Banca oncológica, o resumo em Downloads e o WIP do tech lead foram preservados. Nenhuma skill nova foi instalada ou atualizada.
