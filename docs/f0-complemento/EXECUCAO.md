# F0-COMPLEMENTO — execução autorizada

Dr. Silas, 2026-10-10: **“PODE SEGUIR ATÉ FECHAMENTO DA F0.”**

Esta ordem amplia o início para conclusão do complemento. A tag histórica da F0 técnica permanece. Base de trabalho: bab0889, branch codex/f0c-inicio; nenhum reset do integrado ou de worktree alheio. Regras clínicas e Flash são as decisões diretas em INICIO-CODEX-2026-10-10.md. A auditoria de 18 fatias é o roteiro, com simplificações posteriores do médico prevalecendo.

## Quadro de sete blocos

1. Temas: corrigir bugs e costuras; núcleo mínimo offline; Flash essencial; APAC própria; evidência de fechamento.
2. Previsto/real: F05 implementada/testada; demais itens têm rastreabilidade na auditoria e serão fechados com evidência, não por afirmação.
3. Proposta: produtores clínicos → avaliação → visão → seleção médica → rascunhos → confirmação existente → reabertura. Não duplicar a consulta grande.
4. Código: funções puras e adaptadores; SC real; Calvert125; validade; três críticos; G2 alerta; HBV; identidade/tempo/fonte; sem cálculo por LLM.
5. Biblioteca: parâmetros e interações com fonte curada; conteúdo sem fonte permanece inativo com cobertura explícita.
6. Decisões: seis perguntas já respondidas. Não criar conduta/dose/limiares adicionais. Dados desconhecidos continuam pendentes.
7. Fixos: médico decide, assinatura vinculada ao exibido, L9/L10, não bloqueio do atendimento, preservação de dados e do histórico real de administração.

## Ownership da primeira rodada

- Codex `f0c_apac`: src/rules/prescricao/**; src/rules/f0c/clinica.ts; testes correspondentes. SC, CG, validade, críticos, G2, HBV. Não server/UI.
- Codex `flash_backend`: src/server/flash.ts e testes backend Flash. Rascunhos, pedidos completos, decisão médica QT, idempotência e retomada. Não rotas/leituras/porta.
- Codex `flash_ui`: ConsultaFlash, flashDaVisao, OverlayFlash, estilo próprio e testes UI Flash. Não TelaConsulta/porta/server.
- Codex raiz: integração (porta, leituras, rotas, corpus, TelaConsulta), fontes, contratos de interfaces, avaliação, ledger, registros e validação serial.

Planos são compatíveis com campos opcionais `solicitacoes:{laboratorio,imagem}` e `decisaoQt:{solicitarCiclo,data}`; QT é decisão médica, nunca administração automática. Rascunho inclui plano para reabrir. Campos da visão são opcionais quando não há dado; não preencher com caso demonstrativo.

Todos são escritores Codex. Sem testes concorrentes. Revisão de cada entrega pela raiz; revisão adversarial independente ao fim. Integração principal e merge seguem lei do repositório. Não declarar encerramento se houver falha material ou requisito sem prova.

## Gates

1. Revisão de diff/contratos por fatia; testes focais e typecheck.
2. Jornada sintética por HTTP/SQLite/UI, com persistência e reabertura, sem rede externa/LLM.
3. Suite regular, redteam, adv-w8, fronteiras, corpus e build serialmente, com mesmo HEAD candidato.
4. Relatório B1–B11/C1–C13/N1–N12 com PASS/PARTIAL/BLOCKED e limites; PR e checks quando entregável. Nunca confundir local, integrado, publicado e aprovado clinicamente.

## Rodada Cursor 2026-10-10 — continuação, sem fechamento

HEAD testado: `bab0889aa5875c140f76833da759d0969620d3d2`, branch `codex/f0c-inicio`, worktree suja (78 linhas em `git status --short`). Sem commit, push ou PR. Tag histórica da F0 preservada.

### O que o código faz nesta rodada

- Instrumentos KPS, Child-Pugh, ALBI, Khorana e G8 ficam fora da Flash, em `ConsultaPersistida` e na aba clínica de `TelaConsulta`. A chave paciente/consulta/lote zera o rascunho. `POST /consulta/instrumento/avaliar` devolve cálculo sem gravar nem assinar.
- `OncoassistLocal` passa `aoAbrirApac={() => setTela("apac")}` e monta configurações `somenteFlash` com `incluirServico`, carregando a caixa 18 autenticada. A tela demonstrativa completa, com CNES fixo, permanece atrás de `somenteFlash`.
- Assinatura usa o bundle já exibido. A impressão é outra ação do gateway: HTML local, sem prova de impressão física. Falha de impressão deixa botão de nova solicitação e não repete a assinatura.
- Carregar consulta e preparar documentos usam a mesma `opcoesLeituraConsulta` (modelo Flash, interações, FEVE, condicionais, instrumentos). A caixa 18 entra na linha manual de receita, não na montagem dos documentos da Flash.
- Cumulativo sem limite devolve subtotal conhecido e pendência de limite. Histórico incompleto não vira total definitivo. Não há sugestão de imagem por sintoma nem teto de dose acumulada inventado.
- `coletarFontesSalao` aplica D-F0C-07: 21 dias civis contados do instante da assinatura. O dia da assinatura entra; no 21º dia decorrido a prescrição sai de vigência. Assinatura sem data civil ou futura não vira prazo. Texto livre continua sem valor de contrato.

### Item F — decisão registrada

Dr. Silas, 2026-10-10: prazo do salão = 21 dias, contados da assinatura. Não há prazo próprio por droga.

### Prova desta rodada

Logs novos em `_f0c-evidencias/`, sem sobrescrever `regular-inicial.log`.

| Comando | Resultado |
|---|---|
| `tsc --noEmit` | PASS, exit 0 |
| `vitest run tests/f0c --no-file-parallelism` | PASS, 270/270, 24 arquivos, exit 0 |
| `check-boundaries.mjs` | PASS, 321 arquivos, exit 0 |
| `validate-corpus.mjs` | PASS, 129 arquivos, exit 0 |
| `vitest run --no-file-parallelism` | FAIL, 2724 passaram, 1 falhou, 365 arquivos, exit 1 |
| `vite build` | PASS, exit 0 |
| `vitest run tests/adv` | NOT_RUN útil: a pasta não tem teste Vitest (exit 1, nenhum arquivo) |

`tests/redteam` e `tests/adv-w8` entram na suíte regular; `vite.config.ts` só tira `tests/adv`. A única falha regular é `phi-repo.test.ts`: findings e arquivos não lidos zerados, ZIP SIGTAP disposto pelo hash pinado, e 65 `git_index_worktree_mismatch` porque o índice publicado ainda é o marco `bab0889` e o worktree está sujo. Não é timeout. Não houve commit para igualar o índice.

Jornada automatizada que passou nesta suíte: `tests/f0c/flash-jornada.test.tsx`, `tests/f0c/impressao-runtime.test.ts`, `tests/f0-fecha/c2-consulta-local.test.tsx` (SQLite sintético, HTTP local, exibir, assinar, reabrir, instrumento rascunho, falha de impressão sem segunda assinatura). Não houve browser. Não foi aberta a página completa `OncoassistLocal` contra o fixture `demo-servidor.ts`. Troca de paciente, capecitabina/varfarina, TOX, alergia e FEVE pertinente estão em testes de regra/UI focal, não numa única navegação visual.

### Matriz B/C/N desta rodada

| ID | Estado | Evidência |
|---|---|---|
| B1 | PARTIAL | `avaliacaoConsulta` + `tests/f0c/clinica.test.ts`; nem todo produtor foi revisto na tela |
| B2 | PARTIAL | suíte regular passou nos testes de elegibilidade; separação cobertura/exibição não reauditada linha a linha |
| B3 | PASS | `tests/f0c/interacoes-feve.test.ts` e `tests/w10-grok/grok-08-semaforo.test.ts` na suíte regular |
| B4 | PASS | catálogo de classes usado por esses testes |
| B5 | PASS | identidade sem substring em `interacoes-feve` |
| B6 | PASS | FEVE futura/inválida em `interacoes-feve` |
| B7 | PARTIAL | `tests/f0c/contexto-clinico.test.ts`; alergia na tela não vista no browser |
| B8 | PARTIAL | coberto só pela suíte regular, sem prova isolada nova |
| B9 | PARTIAL | `validate-corpus` passou; mapa de legado inativo não refeito |
| B10 | PARTIAL | Na/K/Ca total em `clinica.test.ts`; outras escalas não reauditadas |
| B11 | PARTIAL | suíte terminou em 434 s; a falha restante é índice sujo, não timeout |
| C1 | PARTIAL | Flash montada e não redesenhada; sem prova visual |
| C2 | PASS | `flash-jornada` e `config-flash-servico` |
| C3 | PARTIAL | sinais na avaliação; cobertura de produtores incompleta na UI |
| C4 | PARTIAL | plaquetas não isoladas nesta nota |
| C5 | PASS | `c2-consulta-local` e `impressao-runtime` (versão exibida) |
| C6 | PARTIAL | timeline de teste passou com fato explícito; cirurgia/RT não provadas de ponta a ponta |
| C7 | PASS | caixa 17/18 em `config-flash-servico` e `http-config-real` |
| C8 | PARTIAL | caixa 18 grava e reabre; receituário fora da Flash não percorrido |
| C9 | PARTIAL | callback APAC ligado e clicado em `c2-consulta-local`; página `OncoassistLocal` não aberta no browser |
| C10 | PARTIAL | projeção real no teste de timeline; linha compacta da Flash é outra superfície |
| C11 | PASS | D-F0C-07; `tests/f0c/salao-fontes.test.ts` 12/12 em 2026-10-10 |
| C12 | PASS | `tests/f0c/apac-aviso.test.ts` dentro dos 270 |
| C13 | PARTIAL | `sigtap-zip` e competência nos 270; não é o SIGTAP nacional inteiro |
| N1 | PASS | Mosteller sem piso/teto, Calvert 125, CG com peso real em `clinica.test.ts` |
| N2 | PASS | hemograma 72 h e bioquímica 7 dias em `clinica.test.ts` |
| N3 | PARTIAL | críticos novos testados; recálculo versus alerta não separados de novo |
| N4 | PARTIAL | `tests/f0c/intervalo-ciclo.test.ts` |
| N5 | PARTIAL | `lab-thresholds` mantém NA, K e CA inativos; `avaliarCriticos` alerta só Na <125 ou >145, K <3 ou >6 e Ca total <8 ou >12 |
| N6 | PASS | G2 só alerta em `clinica.test.ts` |
| N7 | PARTIAL | lembrete HBV testado; DPYD fora desta onda |
| N8 | PASS | `instrumentos-ui` e integração; resultado é rascunho |
| N9 | PASS | lista RAD fixa; sem imagem por sintoma |
| N10 | PARTIAL | conjunto essencial de impressão provado; demais documentos não |
| N11 | PARTIAL | pendências agrupadas no código; cliques não medidos |
| N12 | PARTIAL | jornada HTTP/SQLite passou; browser e demo `OncoassistLocal` não executados |

F0-COMPLEMENTO não está fechado: vários itens PARTIAL permanecem. O prazo do salão de 21 dias passou na prova focal `salao-fontes` (12/12).

### Rodada da recuperação de impressão — `d96cedf`

A recarga da mesma consulta não apaga mais a visão, então o botão “Solicitar impressão novamente” continua utilizável depois da falha. Trocar paciente/consulta descarta essa intenção. `tests/f0-fecha/c2-consulta-local.test.tsx` confere assinatura única (3 documentos), repetição com o mesmo id, versão e chave, e ausência do botão após a troca.

Checks do PR #6 nesse SHA, evento `pull_request`, run https://github.com/silasjuba-del/OncoGlobal/actions/runs/38081685911 : typecheck + fronteiras + testes SUCCESS; provas adversariais W10 e W8 SUCCESS. O evento `push` do mesmo SHA também passou: https://github.com/silasjuba-del/OncoGlobal/actions/runs/38081680941

Jornada no Edge, banco temporário novo, `OncoassistLocal` → `ConsultaPersistida`, LLM desligada pelo demo: agenda do Paciente Teste 92, Flash, HMG, TC de tórax, decisão de ciclo, retorno 30 dias, rascunho salvo, conteúdo exibido, três documentos no histórico. Recarga da página, novo login e reabertura mantiveram os três. A impressão do servidor de produção concluiu, então o botão de recuperação não apareceu nesse percurso. Alergia, TOX, capecitabina/varfarina e troca de paciente não entraram nessa navegação visual.

| ID | Estado nesta nota | Limite que permanece |
|---|---|---|
| C5 | PASS | recuperação de falha provada no teste; no browser a impressão concluiu |
| N12 | PARTIAL | percurso de produção sintético feito; faltam falha visual, troca de paciente, alergia, TOX e varfarina na mesma navegação |
| C11 | PASS | 21 dias desde a assinatura |

## D-F0C-08 — tetos e amarelo, 2026-10-10

Dr. Silas fechou os tetos: doxorrubicina 550 mg/m², epirrubicina 900 mg/m², mitoxantrona 140 mg/m², bleomicina 400 U e 200 U/m², cisplatina 300 mg/m², oxaliplatina 850 mg/m². Cada droga no próprio teto. Chegar no teto acende vermelho e não bloqueia. Item parcial acende alaranjado, separado do farol verde, vermelho e pendente. Dado ausente continua pendente. Lipossomal e o corte de 100 U ficam de fora.

Os itens que a matriz ainda marca PARTIAL permanecem amarelos: atenção, sem virar verde e sem segurar o teto. A regra está em `corpus/rulesets/cumulativo-tetos.v1.json`. Prova focal: `tests/f0c/tetos-cumulativos.test.ts`. Typecheck passou. A suíte inteira não foi reexecutada nesta gravação.

