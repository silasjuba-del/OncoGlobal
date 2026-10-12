# F1: modelo de plano, fatias e etapas (proposta para aprovação)

Data: 2026-10-12. Autor: Claude. Orquestrador da execução: Codex-Fugu.
Estado: **PROPOSTA**. Nenhuma fatia começa sem o quadro de 7 blocos aprovado pelo Dr. Silas (§4). Este documento não inicia código.
Base: `f1/integrado` mais o PR do pré-F1 (`f1/pre-f1-higiene`).
Fontes: PLANO-FINAL v1.1 §F1, R-17, R-18 e R-22; D-F1-01 a D-F1-17; D-W9-82; F1-00-HIGIENE-E-TAREFA; F1-CORPUS-ENTREGA-FINAL.

---

## 0. Leis que valem em toda fatia

1. **O paciente é um só.** Existe um `patientId` e um retrato único. Cada setor lê esse retrato pelas portas e escreve só eventos no ledger. Nenhuma caixa guarda uma cópia própria da verdade.
2. **X + Y = Z** (D-F1-07). Fatos confirmados de domínios diferentes se cruzam por IDs e geram avaliações e propostas. A conduta é do médico.
3. **Longitudinal.** Todo fato tem data, validade, origem, negação e conflito. Ausência não é normalidade. Falta de cobertura da biblioteca não é ausência de risco.
4. **Avaliação sobre a prescrição PROPOSTA**, antes do ciclo 1, refeita a cada mudança relevante (D-F1-11 e D-F1-12). Um resultado calculado sobre uma revisão antiga nunca aparece como atual.
5. **O código aplica a regra; a LLM só faz cognição** (extração e prosa a partir de fatos confirmados). Escores e cálculos são determinísticos e funcionam offline.
6. **Nunca parar o serviço** (D-W9-82). Dado faltando vira pendência visível, não bloqueio.
7. **A Flash não tem semáforo** (D-F1-01). Ela mostra resumo e link ao fato. O farol fica só na página do tema.
8. **A biblioteca pode ser consultada, mas só alerta com aprovação** (D-F1-05). Item RASCUNHO aparece como "não curado" e nunca dispara alerta automático.
9. **Sem fonte, o valor é `null` e vira pendência.** Nunca inventar dose, corte, NCT ou lei.
10. **Planejado, prescrito e administrado são coisas distintas** (D-F1-13). Prescrição não é APAC. Chat não vira prontuário.
11. **PHI fica no PC.** Chamada externa leva só texto desidentificado e passa pelo gateway (G-02).

## 1. Backend: simples, mas completo

Um processo Node, SQLite com ledger append-only e projeções puras. Sem barramento, sem fila externa, sem microserviço (D-F1-10: usar o que existe).

```
HTTP (rotas finas) ─▶ COMANDO do kernel (1 por verbo) ─▶ envelope validado (tipo+versão) ─▶ ledger
                                                                                      │
             ┌────────────────────────────────────────────────────────────────────────┘
             ▼
     PROJEÇÕES PURAS: Retrato do paciente (revisão N) ── Motor de avaliação (regras aprovadas + biblioteca)
             │                                              │
             ▼                                              ▼
   Tela da consulta · Flash · pré-consulta        AvaliacaoPrescricao / Requisitos / Propostas
             │                                              │
             ▼                                              ▼
   DUTOS: pedidos/documentos · farmácia · salão(administração) · cumulativos · APAC · agenda/tarefas
```

| Camada | Responsabilidade | O que já existe | O que a F1 faz |
|---|---|---|---|
| Comandos | 1 verbo = 1 função do kernel; idempotência por `operationId`; autoria pela sessão | `confirmar()` espalhado em `rotas.ts` (l.248/430/510/1229/1373), 1.403 linhas | estrangular os 5 `confirmar()` em comandos; `rotas.ts` vira só tradução HTTP |
| Envelope | valida `tipo` e `versao` de cada evento antes de gravar e ao ler | Zod por contrato; leitura com integridade (pré-F1) | registro `tipo@versao → schema`; versão desconhecida vira pendência, não descarte |
| Retrato | projeção única do paciente com número de revisão | `retratoTransversal.ts`, `preConsulta.ts`, `snapshot`, `cumulativos` | unificar em `Retrato` (§2); todo consumidor lê daqui |
| Motor | carrega os 8 pilares, aplica as regras aprovadas e registra as dependências | loader de corpus (G-17), regras `src/rules` | `avaliar(retrato, prescricaoProposta, biblioteca)` → avaliação versionada |
| Dutos | cada setor tem estado próprio, responsável e correlação | módulos `farmacia`, `estoque`, `documentos`, `apac`, `canal` (não integrados) | ligar por portas tipadas (§3) |
| Gateway | impressão e envio externo; PHI só desidentificado | gateway com stub, FN-24 | sem mudança estrutural |

## 2. Retrato único do paciente ("o paciente é um só")

O `Retrato` é uma projeção pura e reconstruível do ledger. Ele carrega um `revisao` (hash ou sequência dos eventos de entrada).

- **Identidade**: `patientId`, identificadores exatos (Q13) e vínculos de contato (`modules/canal/vinculo.ts`).
- **Tumores**: `TumorLot[]`, cada um com histologia, estádio, biomarcadores, intenção, linha e tratamentos prévios. Dois tumores do mesmo paciente nunca se misturam.
- **Fatos com validade**: labs (série com `valorAtual` e validade do ruleset), imagem (3 camadas), patologia e CTCAE. Cada fato tem fonte, data, negação e conflito preservados.
- **Segurança**: medicamentos reconciliados, comorbidades estruturadas, alergias, função orgânica (com dado e data) e exposições cumulativas.
- **Tratamento**: esquema planejado, prescrição proposta, prescrição assinada, administrações efetivas. As quatro ficam separadas.
- **Operacional**: pedidos em andamento, tarefas, documentos emitidos, APAC (estado), contatos desde a última consulta e pendências de integridade.

Regra: nenhum setor calcula a sua própria versão desses campos. Quem precisa de creatinina, alergia ou ciclo lê do `Retrato`.

## 3. Portas entre domínios (quem consome, quem produz, o que invalida)

| Domínio | Consome do Retrato | Produz (evento) | Invalida |
|---|---|---|---|
| Tumor/pack | TumorLot, fatos | `RequisitosPack` (lista contextual) | requisitos ao mudar histologia, estádio, biomarcador ou linha |
| Exames | fatos, pedidos, requisitos | `PropostaPedido` com resumo do caso (D-F1-04) | ao chegar exame novo ou corrigido |
| Prescrição | esquema, segurança, função orgânica | `PrescricaoProposta` → `PrescricaoAssinada` | toda avaliação dependente quando muda dose, droga ou esquema |
| Motor de avaliação | Retrato + prescrição proposta + biblioteca aprovada | `AvaliacaoPrescricao {entradas@revisao, regras@versao, cobertura, achados, pendencias}` | ao mudar qualquer entrada registrada |
| Interações/contraindicações | meds reconciliados, comorbidades, alergias | achados dentro da avaliação | med novo, comorbidade nova |
| CTCAE-ação | toxicidade registrada | proposta de ação (nunca muda dose sozinha) | nova graduação |
| Cumulativos | administrações efetivas | exposição atual × teto | nova administração |
| Farmácia | prescrição assinada | `CONFERIDA` ou `CORRECAO_PEDIDA` (motivo) | nova versão da prescrição |
| Salão | prescrição vigente, triagem, labs válidos | `Administracao` (efetiva, parcial, evento) | — |
| Documentos | fatos CONFIRMADOS | receita, pedidos, retorno, evolução, laudos, encaminhamentos | reimpressão não cria encontro |
| APAC | conduta assinada + TumorLot (finalidade herdada) | APAC RASCUNHO (validação regulatória própria) | nova prescrição assinada |
| Agenda/tarefas | datas e tarefas confirmadas | `Tarefa` (D12, EV-T1…EV-T6) | conclusão ou cancelamento |
| Caixa/extração | documento novo | fatos CANDIDATOS → confirmação → fato | dispara reavaliação dependente |

## 4. Modelo de quadro de 7 blocos (obrigatório antes de cada fatia)

```
FATIA F1-Sx · <nome>
1. Temas abordados ............ o problema clínico-operacional, em 1 a 3 linhas
2. O que já está previsto ..... decisões e trechos do plano (com ID: D-F1-xx, R-xx, Q-xx)
3. O que o Claude indica ...... a proposta concreta, com portas de entrada e saída
4. O que vira código simples .. funções puras, comandos e projeções (arquivo, assinatura e teste)
5. O que vai para biblioteca .. dado versionado em corpus/ (estado de curadoria)
6. O Dr. Silas ainda decide ... perguntas fechadas (sim/não ou A/B/C), no máximo 5
7. Já decidido ................ lista de IDs que não se rediscutem
ACEITE: testes positivo + negativo + borda, nomeados; prova (vitest real); demo
FAIXA: arquivos que a fatia pode tocar; o que é proibido tocar
```

## 5. Fatias e etapas

Três ondas. Dentro de uma onda, as fatias têm faixas disjuntas e podem correr em paralelo (no máximo 5). Cada fatia roda em worktree e ramo próprios a partir de `f1/integrado`, com 1 PR por fatia.

### Onda 0: fundação (sem mudança clínica)

**F1-S1 · Comandos do kernel e envelope por tipo e versão**
- E1: registro `tipo@versao → schema`. Gravação e leitura passam por ele; versão desconhecida vira pendência de integridade.
- E2: comandos `confirmarBloco`, `registrarFato`, `proporPrescricao`, `assinarPrescricao`, `vincularContato` (este reutiliza `modules/canal/vinculo.ts`), `registrarAdministracao` e `registrarTarefa`. Cada um tem idempotência e autoria.
- E3: estrangular os 5 `confirmar()` de `rotas.ts`, um a um, com teste de equivalência antes e depois.
- E4: pagar as exceções `ledger.js/drafts.js` fora do kernel (`autorizacao.ts`, `flash.ts`, `oncoassistLocal.ts`).
- Aceite: replay não duplica; um comando com envelope inválido é recusado; `rotas.ts` sem `confirmar()` direto.

**F1-S2 · Retrato único do paciente**
- E1: contrato `Retrato` com `revisao`, consolidando `retratoTransversal`, `preConsulta`, `snapshot` e `cumulativos`, sem duplicar lógica.
- E2: fatos com validade (`valorAtual`), conflito e negação preservados; dois TumorLots isolados.
- E3: segurança (meds reconciliados, comorbidades, alergias, função orgânica) com `ausente ≠ normal`.
- E4: `lerConsulta` e a Flash passam a ler do Retrato (sem mudança visual).
- Aceite: reconstrução byte a byte; dois tumores do mesmo paciente não se misturam; uma revisão nova muda o `revisao`.

**F1-S3 · Loader dos 8 pilares e fronteiras zeradas**
- E1: loader único dos 8 pilares (D-F1-06), com manifesto, hashes, curadoria (`RASCUNHO`/aprovado/obsoleto), ativação atômica e retorno à última versão válida (D-F1-14).
- E2: índice de aplicabilidade por tumor, histologia, estádio, biomarcador e linha (o nome do tumor sozinho não basta).
- E3: consulta da biblioteca na página do tema (não curado visível); alerta só para itens aprovados.
- E4: zerar as 54 exceções de fronteira (prazo `F1-S3`); a bateria falha se sobrar alguma.
- Aceite: pacote inválido é rejeitado; versão anterior recuperada; offline funciona; zero exceções.

### Onda 1: motor clínico

**F1-S4 · Prescrição proposta tipada e avaliação antes do ciclo 1**
- E1: contrato `PrescricaoProposta` (itens, dose por base de cálculo, via, dia, ciclo, origem no protocolo versionado). Sem dose inventada: campo sem fonte vira `null` e pendência.
- E2: `avaliarPrescricaoProposta(retrato, proposta, biblioteca)` → interações, contraindicações, função orgânica, alergias, CTCAE-ação, cumulativos e requisitos específicos. Registra `entradas@revisao` e `regras@versao`.
- E3: saída com cobertura ("x de y itens avaliados; z sem regra aprovada"), achados e pendências. Não muda dose e não bloqueia.
- E4: exibição na página do tema (com farol) e na Flash (resumo e link, sem farol).
- Aceite: avaliação acontece antes de existir ciclo registrado; item sem regra aparece como "sem cobertura", não como "ok"; nenhuma dose é alterada.

**F1-S5 · Reavaliação por evento**
- E1: grafo de dependência da avaliação (IDs de entrada) → invalidação seletiva.
- E2: gatilhos: exame novo ou corrigido, med novo, comorbidade, toxicidade, dose, esquema, administração.
- E3: avaliação vencida aparece marcada "desatualizada" até ser recalculada; nunca como atual.
- E4: agrupamento de avisos repetidos (L10 anti-fadiga), sem esconder risco.
- Aceite: med novo reabre só a avaliação dependente; resposta da revisão N−1 não aparece como atual.

**F1-S6 · Caminho tumor → investigação**
- E1: requisitos do pack comparados com fatos e pedidos → `confirmado / ausente / solicitado / vencido / conflitante / não aplicável`.
- E2: propostas de pedido justificadas, com fonte e sem repetir pedido em andamento.
- E3: pedido de imagem sai com o resumo do caso gerado a partir de fatos (D-F1-04).
- Aceite: não duplica pedidos; laudos em conflito ficam preservados; tumor sem histologia não abre bateria universal.

### Onda 2: consulta e dutos assistenciais

**F1-S7 · Pré-consulta, tela da consulta e Flash**
- E1: pré-consulta na véspera: exames disponíveis, pedidos, faltas, conflitos, propostas, contatos.
- E2: tela R-17 consumindo o Retrato e a avaliação; bundles pré-marcados pelo pack; fechamento por bloco e "validar tudo".
- E3: Flash pontual (rapid review, ciclo, exames, libera), sem semáforo.
- Aceite: retorno de rotina em ≤5 cliques, medido; troca de paciente invalida o contexto.

**F1-S8 · Documentos**
- E1: receita, pedidos, retorno, evolução, laudos (INSS, afastamento, LOAS, transporte) e encaminhamentos a partir de fatos CONFIRMADOS.
- E2: o fixture canônico "Pantoprazol 40 mg pela manhã por 30 dias, hemograma e creatinina, retorno em 14 dias" gera receita, 2 pedidos, retorno e 1 tarefa, com campos não ditos vazios.
- Aceite: reimpressão não cria encontro; campo sem fato fica vazio.

**F1-S9 · Dutos: farmácia, salão, cumulativos, APAC e agenda**
- E1: prescrição assinada → farmácia (`CONFERIDA | CORRECAO_PEDIDA`, com motivo) → o médico aceita ou recusa com 1 clique. A farmácia nunca edita.
- E2: salão registra a administração efetiva ou parcial e os eventos → alimenta histórico e cumulativos. Liga a prescrição vigente à triagem (D3 da F1-00), com creatinina e PAD do Retrato.
- E3: APAC derivada da conduta assinada, com finalidade herdada do TumorLot. Aqui entra a decisão de contrato sobre `RASCUNHO` no `EstadoApac` (item 3 do pré-F1).
- E4: entidade `Tarefa` (D12) e agenda com responsável, estado, prazo e confirmação de recebimento.
- Aceite: planejado ≠ prescrito ≠ administrado; recebimento ≠ execução; nenhuma APAC sem assinatura.

**F1-S10 · Caixa universal e extratores**
- E1: caixa (texto, print, PDF) → AG-02 (desidentificado) → FN-25 roteia; documento de outro paciente → VERMELHO e fila de vínculo.
- E2: extratores LAB, RADS, PATH e SYMPTOM → fatos CANDIDATOS com fonte → confirmação 1 clique → fato → reavaliação (S5).
- Aceite: nenhum byte de PHI em chamada externa (G-02 em log); candidato nunca vira fato sem confirmação.

**F1-S11 · Voz (segunda onda, opcional na v1)**
- NOVA-3 com comando curto, Whisper local e Plaud diferido com merge por fato (FN-22); áudio apagado depois de validado (hash guardado).

**F1-S12 · Fechamento da F1**
- Red team A12–A19 (`F1-CORPUS-PROMPT-REDTEAM-GLM.md`), matriz F1 (como a matriz F0), PHI, latências CRIT-5 e demo gravada no app. Entrega do `RELATORIO-F1.md`.

### Dependências

```
S1 ─┬─▶ S2 ─┬─▶ S4 ─▶ S5 ─┬─▶ S7 ─▶ S12
    │       │             │
    │       └─▶ S6 ───────┤
    └─▶ S3 ──────▶ S4     ├─▶ S8
                          ├─▶ S9
                          └─▶ S10 ─▶ S11
```
Onda 0: S1 e S3 em paralelo; S2 depois do E1 de S1. Onda 1: S4, depois S5 e S6. Onda 2: S7, S8, S9 e S10 em paralelo (faixas disjuntas).

## 6. Protocolo do orquestrador (Codex-Fugu)

1. Para cada fatia: montar o quadro de 7 blocos (§4) → o Dr. Silas aprova → só então abrir a worktree e o ramo `f1/sX-<nome>`.
2. Dentro da fatia, 1 commit por etapa (E1, E2…). Para cada etapa: teste positivo + negativo + borda escritos antes, e prova com saída real do `vitest`.
3. Bateria mínima por PR: `tsc`, `check-boundaries`, `validate-corpus`, testes da fatia, matriz F0 sem regressão, scanner PHI, adversariais W8/W10 quando a faixa tocar regra ou servidor.
4. Faixas: nunca 2 escritores nos mesmos arquivos. `src/rules` e contratos congelados só mudam com decisão registrada.
5. Lei de autoria: não commitar trabalho de outro escritor sem autorização; não tocar o checkout principal sem conferir o `git status`.
6. Auditoria cruzada: o Claude revisa cada PR em modo leitura antes do merge. O Dr. Silas libera o merge.
7. Execução do Codex: o modelo padrão "fugu" falha com conta ChatGPT na CLI. Usar `-c model='"gpt-6-astra"'` ou o perfil configurado para o Fugu-orquestrador.

## 7. Perguntas para o Dr. Silas antes da Onda 0

1. A ordem das ondas (fundação → motor → consulta/dutos) está aprovada?
2. Voz (S11) fica para depois da v1 da F1?
3. O `Retrato` substitui `retratoTransversal`, `preConsulta` e `snapshot` como fonte única de leitura (os três viram derivados dele)?
4. O prazo das 54 exceções de fronteira fica no fim da S3?
5. A decisão sobre `RASCUNHO` no `EstadoApac` fica na S9?
