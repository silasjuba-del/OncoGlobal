# F1: modelo de plano, fatias e etapas (v2, proposta para aprovação)

Data: 2026-10-12. Autor: Claude. Orquestrador da execução: Codex-Fugu.
Estado: **PROPOSTA v2**. Nenhuma fatia começa sem o quadro de 7 blocos aprovado pelo Dr. Silas (§6). Este documento não inicia código.
O que mudou da v1:
- incorpora a D-F1-18 (o paciente é um só, o software tem vários setores);
- aplica a revisão do Codex (`C:\Users\silas\handoff\2026-10-12_codex-revisao-pr7-plano-f1.md`);
- incorpora o relatório do Genspark (`docs/ondas/F1-GENSPARK-RELATORIO-2026-10-12.md`).

Fontes: PLANO-FINAL v1.1 (§F1 e R-17 a R-22); D-F1-01 a D-F1-18; D-W9-82; aceite da proposta F1 (`DECISOES.md:265`: voz fora, OCR local, 2 portões da LLM).

---

## 0. A lei central: paciente inteiro, software em setores (D-F1-18)

```
            SOFTWARE (setores profundos, separados)                      MÉDICO (uma unidade)
 ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
 │ Laboratório  │ │ Imagem       │ │ Patologia +  │ │ Comorbidades │
 │ série,valid. │ │ RADS,RECIST  │ │ biomarcadores│ │ estruturadas │      ┌──────────────────────────┐
 └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘      │  VISÃO INTEGRADA          │
 ┌──────┴───────┐ ┌──────┴───────┐ ┌──────┴───────┐        │              │  achado cruzado + cadeia  │
 │ Toxicidades  │ │ Interações e │ │ Tratamento   │        │   ───────▶   │  (exame + droga + comorb  │
 │ CTCAE-ação   │ │ contraindic. │ │ proposta/ciclo│       │              │   + toxicidade + tumor)   │
 └──────┬───────┘ └──────┬───────┘ └──────┬───────┘        │              │  lacunas visíveis         │
        └────────────────┴────────┬───────┴────────────────┘              │  conduta = médico         │
                                  ▼                                       └──────────────────────────┘
                     RECONCILIADOR CLÍNICO (mesmo paciente, mesma revisão de fatos)
```

- **Cada setor é profundo e especializado.** Tem contrato, regras, testes, biblioteca e responsável próprios. Um setor nunca lê o banco de outro: lê o Retrato (§2) e devolve `AchadosSetor`.
- **O Reconciliador cruza os setores** sobre o mesmo `patientId` e a mesma `revisao`. Ele produz `AchadoIntegrado` com a cadeia de causa. Exemplo de forma, sem regra inventada: "função renal [lab] + droga nefrotóxica proposta [tratamento] + AINE em uso [interações] + DRC [comorbidade]" sai como um achado só, com os 4 fatos citados.
- **O médico vê o paciente inteiro.** Achados integrados aparecem primeiro, depois o detalhe por setor (um clique, com link ao fato). Nunca mostrar listas soltas por setor para ele juntar de cabeça.
- **Lacuna é visível.** Setor sem dado, com dado vencido ou sem regra aprovada aparece como lacuna na visão integrada, nunca como "normal".

## 1. Leis que valem em toda fatia

1. **X + Y = Z** (D-F1-07): domínios se ligam por IDs; avaliação sobre a prescrição PROPOSTA, antes do ciclo 1, refeita a cada mudança relevante.
2. **Longitudinal**: todo fato tem data, validade, origem, negação e conflito. Ausência não é normalidade. Falta de cobertura não é ausência de risco.
3. **O código aplica a regra e a LLM só faz cognição** (extração e prosa a partir de fatos confirmados). Os 2 portões da LLM: CI gravado e log ao vivo.
4. **Continuidade do atendimento** (D-W9-82): dado faltando vira alerta e pendência, sem parar o serviço. **Isso não libera ato inválido.** Identidade, conteúdo exibido, assinatura e consentimento continuam sendo portões que travam.
5. **Flash sem semáforo** (D-F1-01). Biblioteca consultável, com alerta só para item aprovado (D-F1-05).
6. **Sem fonte, o valor é `null` e vira pendência.** Estados provisórios de D-F1-16 e D-F1-17 (bula FDA provisória etc.) são preservados.
7. **Planejado, prescrito e administrado são distintos.** Prescrição não é APAC. Chat não vira prontuário: decisão aceita no chat gera registro próprio, com autoria.
8. **PHI fica no PC.** Chamada externa só com texto desidentificado, pelo gateway (G-02). Nada de prontuário vai ao Genspark (D-F1-09).
9. **Snapshots confirmados e assinados são históricos.** A projeção atual nunca os substitui nem mistura proposta com fato confirmado.

## 2. Backend simples e completo

Um processo Node, SQLite com ledger append-only, projeções puras. Sem barramento e sem serviço paralelo (D-F1-10).

| Camada | Responsabilidade | Existe hoje | F1 faz |
|---|---|---|---|
| Comandos | 1 verbo = 1 função do kernel, com idempotência (`operationId`) e autoria pela sessão | 5 `confirmar()` em `rotas.ts` (1.403 l.) | estrangular em comandos; `rotas.ts` só traduz HTTP |
| Envelope | registro `tipo@versao → schema` na gravação e na leitura | Zod por contrato; leitura com integridade (pré-F1) | versão desconhecida vira pendência; `payload` deixa de ser `unknown` |
| Retrato | projeção única do paciente | `retratoTransversal`, `preConsulta`, `snapshot`, `cumulativos`, `timelinePaciente`, `series` | `Retrato` com `revisao`; os antigos viram derivados |
| Setores | 7 avaliadores puros (§0) | regras em `src/rules`, `server/f0c/contextoClinico.ts`, `documentos/resumoLongitudinal.ts` | `avaliarSetor(retrato, contexto) → AchadosSetor` |
| Reconciliador | cruza setores; achado integrado; lacunas | — | `reconciliar(achados[], retrato) → VisaoIntegrada` |
| Dutos | estado próprio por setor assistencial, responsável e correlação | `modules/farmacia`, `estoque`, `documentos`, `apac`, `canal` | ligar por portas (§3), em uso local monousuário |
| Gateway | impressão e envio externo | stub e FN-24 | sem mudança estrutural |

### Retrato (contrato mínimo)
- `patientId`, `revisao` (sequência ou hash dos eventos de entrada), `versaoProjecao`, `geradoEm`.
- **Escopo do paciente** (vale para todos os tumores): identidade, alergias, medicamentos reconciliados, comorbidades, função orgânica, exposições cumulativas, contatos.
- **Escopo do tumor**: `TumorLot[]` com histologia, estádio, biomarcadores, intenção, linha e tratamentos prévios. Dois tumores nunca se misturam.
- **Escopo do encontro/episódio**: `encounterId`, episódio de tratamento, ciclo.
- **Fatos** como referência ao evento original (`eventId@revisao`), com validade, origem, negação e conflito. Nunca cópia de valor.
- **Tratamento** em 4 camadas separadas: planejado, proposto, assinado, administrado.
- **Operacional**: pedidos em andamento, tarefas, documentos emitidos, APAC, pendências de integridade.

## 3. Portas e envelope de correlação (D-F1-10)

Toda troca entre setores carrega: `patientId`, `encounterId`, `tumorLotId` (quando aplicável), `operationId`, `revisao` dos fatos de entrada, `regras@versao` e `biblioteca@versao`. Autorização é checada no servidor; vínculo por ID não dá acesso. Recebimento é diferente de execução.

| Setor/duto | Dono | Contrato | Consome | Produz | Invalida quando |
|---|---|---|---|---|---|
| Laboratório | S4-A | `AchadosSetor@1` | séries, validade do ruleset | tendência, função orgânica, vencidos | exame novo ou corrigido; vencimento |
| Imagem | S4-A | `AchadosSetor@1` | ImagingStudy (3 camadas) | RAD_ONE_LINE, RECIST proposto | laudo novo; conflito |
| Patologia + biomarcadores | S4-B | `AchadosSetor@1` | PathologyFact, Biomarker | aplicabilidade do pack | laudo novo; correção |
| Comorbidades | S4-C | `AchadosSetor@1` | comorbidades estruturadas | risco comorbidade × droga | comorbidade nova |
| Interações e contraindicações | S4-C | `AchadosSetor@1` | meds reconciliados + proposta | achados de interação | **qualquer** med novo (inclusive o primeiro) |
| Toxicidades | S4-D | `AchadosSetor@1` | CTCAE registrado | proposta de ação (não muda dose) | nova graduação |
| Tratamento | S4-E | `PrescricaoProposta@1` | esquema, ciclo, cumulativos | itens propostos, requisitos | dose, droga, esquema, administração |
| Reconciliador | S5 | `VisaoIntegrada@1` | todos os `AchadosSetor` da mesma revisão | achados integrados, lacunas | qualquer entrada |
| Investigação | S7 | `RequisitosPack@1` | TumorLot, fatos, pedidos | propostas de pedido com resumo do caso | histologia, estádio, biomarcador, linha |
| Farmácia | S10 | `ConferenciaFarmacia@1` | prescrição assinada | `CONFERIDA` / `CORRECAO_PEDIDA` | nova versão da prescrição |
| Salão | S10 | `Administracao@1` | prescrição vigente, triagem | administração efetiva ou parcial | — |
| APAC | S10 | R-20 (`RASCUNHO` → …) | conduta assinada, TumorLot | APAC RASCUNHO | nova prescrição assinada |
| Agenda/tarefas | S1 (contrato) e S10 (duto) | `Tarefa@1` (D12) | datas confirmadas | tarefa com responsável e prazo | conclusão ou cancelamento |
| Chat | S10 | `MensagemChat@1` | thread por paciente/setor | discussão; decisão aceita vira `DecisaoRegistrada` | — |
| Biblioteca | S3 | pacote com manifesto e hashes | pacote exportado do Genspark (sincronização manual declarada) | versão ativa | troca de versão invalida as avaliações dependentes |

## 4. Fatias e etapas

Regra de faixa: cada fatia declara um `WRITE_SET` (arquivos que pode alterar). Arquivos comuns (`rotas.ts`, `leituras.ts`, `flash.ts`, `check-boundaries.mjs`) são **serializados**: só uma fatia por vez, na ordem abaixo. O integrador de cada onda é o Codex-Fugu.

### Onda 0: fundação (serial nos arquivos comuns)

**S1 · Comandos, envelope e contrato da Tarefa**
- WRITE_SET: `src/kernel/comandos/**` (novo), `src/contracts/envelope.ts`, `src/contracts/f1/tarefa.ts`, `src/server/rotas.ts`, `src/server/autorizacao.ts`, `src/server/flash.ts` (só o import do ledger), `src/app/oncoassistLocal.ts`, `tests/f1/s1/**`.
- E1: registro `tipo@versao → schema`.
- E2: comandos `confirmarBloco`, `registrarFato`, `proporPrescricao`, `assinarPrescricao` (confere a revisão de novo na assinatura), `vincularContato` (reusa `modules/canal/vinculo.ts`), `registrarAdministracao`, `registrarTarefa`.
- E3: estrangular os 5 `confirmar()`, com teste de equivalência por ponto.
- E4: contrato `Tarefa` (D12, EV-T1 a EV-T6), sem duto ainda.
- E5: pagar as exceções de ledger/drafts fora do kernel.
- Aceite: replay não duplica; envelope inválido é recusado; zero `confirmar()` direto em `rotas.ts`.

**S2 · Retrato** (depois da S1)
- WRITE_SET: `src/kernel/projections/retrato/**` (novo), `src/server/leituras.ts`, `src/server/retratoTransversal.ts`, `tests/f1/s2/**`.
- E1: contrato `Retrato` (§2), com os escopos paciente, tumor e encontro.
- E2: fatos por referência, com validade, conflito e negação.
- E3: snapshots assinados preservados; proposta ≠ confirmado.
- E4: `lerConsulta` e a Flash leem do Retrato (sem mudança visual).
- Aceite: reconstrução byte a byte; alergia aparece nos dois tumores; um fato do tumor A não vaza para o B; snapshot antigo não é reescrito.

**S3 · Biblioteca: loader, reconciliação e fronteiras zeradas** (o loader corre em paralelo à S1; o resto vem depois da S2)
- WRITE_SET: `src/kernel/corpus/**`, `corpus/manifesto/**` (novo), `scripts/check-boundaries.mjs`, os arquivos das exceções restantes, `tests/f1/s3/**`.
- E1: loader dos 8 pilares, com manifesto, hashes, curadoria, ativação atômica e volta à última versão válida (D-F1-14).
- E2: **reconciliação decisões × packs × fichas** antes de ativar. Gera a lista de divergências. Caso já conhecido: `corpus/fichas/colon-reto/folfiri__paliativo-metastatico.json:184` ainda tem a orientação revogada pela D-F1-16. A correção do conteúdo é feita pelo dono do corpus, não pelo loader.
- E3: duto de conhecimento: o pacote exportado do Genspark (sem API oficial, sincronização manual declarada) é validado, importado e entra em revisão. Nenhum dado de paciente sai. Trials não geram elegibilidade automática.
- E4: índice de aplicabilidade por tumor, histologia, estádio, biomarcador e linha.
- E5: zerar as exceções de fronteira. Prova: `npm run check:boundaries:fechar-f1-s3` verde.
- Aceite: pacote inválido é rejeitado; versão anterior recuperada; funciona offline; zero exceções.

### Onda 1: setores clínicos profundos (paralelo, no máximo 5, faixas disjuntas)
Cada setor: `src/modules/setores/<setor>/**` + `tests/f1/s4-<setor>/**` + a fatia correspondente da biblioteca. Saída comum: `AchadosSetor {setor, entradas@revisao, regras@versao, cobertura {avaliados, semRegraAprovada}, achados[], lacunas[]}`.

| Fatia | Setor | Etapas | Aceite mínimo |
|---|---|---|---|
| S4-A | Laboratório + Imagem | séries e validade; função orgânica com dado e data; tendência; RADS em 3 camadas; RECIST proposto | dado vencido vira lacuna; laudos em conflito são preservados |
| S4-B | Patologia + Biomarcadores | specimen-role; pT só de ressecção com TNM; biomarcador → aplicabilidade | biópsia não gera pT; biomarcador ausente ≠ negativo |
| S4-C | Comorbidades + Interações/contraindicações | comorbidade estruturada; comorbidade × droga; interação sobre meds reconciliados + proposta | o primeiro med novo dispara; item sem regra = "sem cobertura" |
| S4-D | Toxicidades | graduação CTCAE (versão declarada pelo Dr. Silas); CTCAE-ação como proposta | nunca muda dose; grau ausente ≠ grau 0 |
| S4-E | Tratamento | `PrescricaoProposta` tipada a partir do protocolo versionado; ciclo; cumulativos; 4 camadas | campo sem fonte = `null`; planejado ≠ assinado ≠ administrado |

### Onda 2: integração clínica (o coração do D-F1-18)

**S5 · Reconciliador clínico e visão integrada**
- WRITE_SET: `src/modules/reconciliador/**`, `src/contracts/f1/visaoIntegrada.ts`, `tests/f1/s5/**`.
- E1: junta os `AchadosSetor` da **mesma revisão**. Revisão divergente vira "desatualizado", nunca é misturada.
- E2: achados cruzados com a cadeia de causa (cada elo cita o fato e a regra aprovada). As combinações vêm da biblioteca aprovada, não do código.
- E3: avaliação da prescrição proposta antes do ciclo 1: interações, contraindicações, função orgânica, alergias, CTCAE-ação, cumulativos e requisitos. Com cobertura e lacunas; não muda dose.
- E4: priorização e agrupamento anti-fadiga (L10), sem esconder risco.
- Aceite: um achado de dois setores aparece uma vez, com os dois fatos; setor sem cobertura aparece como lacuna; resposta da revisão N−1 não aparece como atual.

**S6 · Reavaliação por evento**
- WRITE_SET: `src/modules/reconciliador/dependencias/**`, `tests/f1/s6/**`.
- E1: dependência por **domínio e contexto**, não só pelos IDs já consumidos. Assim o primeiro med novo e o fato antes ausente também disparam.
- E2: gatilhos: exame novo, corrigido ou retirado; med; comorbidade; toxicidade; dose; esquema; administração; troca de versão da biblioteca; vencimento temporal.
- E3: nova conferência de revisões no `assinarPrescricao`.
- Aceite: med novo reabre só o que depende; biblioteca nova invalida o que depende dela; exame vencido reabre a avaliação.

**S7 · Caminho tumor → investigação** (depois da S3 e da S5)
- WRITE_SET: `src/modules/investigacao/**`, `tests/f1/s7/**`.
- E1: requisitos do pack × fatos e pedidos → confirmado, ausente, solicitado, vencido, conflitante ou não aplicável.
- E2: propostas de pedido justificadas, com fonte, sem duplicar.
- E3: pedido de imagem com o resumo do caso feito a partir de fatos (D-F1-04).
- Aceite: não duplica pedidos; tumor sem histologia não abre uma bateria universal.

### Onda 3: consulta e dutos (paralelo, faixas disjuntas)

**S8 · Consulta integrada**
- WRITE_SET: `src/modules/consulta/**`, `src/ui/consulta/**`, `src/ui/telas/TelaConsulta.tsx`.
- E1: check-in (reusa `contracts/w11/cadastroCheckin.ts`).
- E2: pré-consulta na véspera, com delta desde a última consulta.
- E3: tela R-17 com a visão integrada no topo, setores em 1 clique, bundles e fechamento por bloco.
- E4: síntese OncoAssist "HOJE" com citações clicáveis, só de fatos confirmados, pelos 2 portões da LLM.
- E5: Flash pontual, sem semáforo.
- Aceite: retorno de rotina em ≤5 cliques, medido; troca de paciente invalida o contexto; nenhuma afirmação da síntese sem citação.

**S9 · Documentos**
- WRITE_SET: `src/modules/documentos/**`, `src/impressao/**`.
- Receita, pedidos, retorno, evolução, resumo-14, laudos (INSS, afastamento, LOAS, transporte), orientações e encaminhamentos. Os encaminhamentos sem material-base (lacunas 3 a 9 do Genspark) ficam como pendência.
- Impressão pelo gateway.
- Aceite: o fixture canônico "Pantoprazol 40 mg pela manhã por 30 dias, hemograma e creatinina, retorno em 14 dias" gera receita, 2 pedidos, retorno e 1 tarefa; reimpressão não cria encontro.

**S10 · Dutos locais (preparação contratual e uso monousuário)**
- WRITE_SET: `src/modules/{farmacia,estoque,apac,canal}/**`, `src/modules/salao/**`, `src/modules/chat/**`.
- Dutos: farmácia (`CONFERIDA` / `CORRECAO_PEDIDA`, nunca edita); salão registra a administração efetiva e alimenta os cumulativos; APAC derivada da conduta assinada (R-20, começando em `RASCUNHO`); agenda e tarefas; chat com passagem explícita para `DecisaoRegistrada`.
- **Não declara setores remotos, multiusuário, WhatsApp nem operação real liberados** (D-F1-13). O uso real de salão, farmácia e APAC segue F3 e F4, salvo decisão do Dr. Silas (§7, pergunta 1).
- Aceite: planejado ≠ prescrito ≠ administrado; recebimento ≠ execução; nenhuma APAC sem assinatura.

**S11 · Caixa universal, extratores e OCR**
- WRITE_SET: `src/modules/caixa/**`, `src/kernel/extracao/**`.
- Caixa (texto, print, PDF) → AG-02 desidentificado → FN-25. OCR local `tesseract.js`, com fallback D-W9-66 quando a confiança for baixa.
- Extratores LAB, RADS, PATH, CHEMO e SYMPTOM geram fatos CANDIDATOS → confirmação com 1 clique → disparo da S6.
- Aceite: zero byte de PHI em chamada externa (G-02 em log); candidato nunca vira fato sozinho; documento de outro paciente → VERMELHO e fila de vínculo.

**S12 · Fechamento da F1** (espera S1 a S11)
- Red team A12 a A19, matriz F1, PHI, latências CRIT-5, demo gravada no app e `RELATORIO-F1.md`.

**Fora da F1:** voz (NOVA-3 e Plaud), pelo aceite registrado em `DECISOES.md:265`.

### Dependências
```
S1 ─▶ S2 ─▶ S3(E2–E5)          S3(E1 loader) ∥ S1
          └─▶ Onda 1: S4-A ∥ S4-B ∥ S4-C ∥ S4-D ∥ S4-E   (precisam de S2 e S3-E1)
                        └─▶ S5 ─▶ S6
                             └─▶ S7 (precisa também de S3)
                                  └─▶ Onda 3: S8 ∥ S9 ∥ S10 ∥ S11 ─▶ S12
```

## 5. Protocolo do orquestrador (Codex-Fugu)

1. Por fatia: quadro de 7 blocos (§6) → aprovação do Dr. Silas → worktree e ramo `f1/sX-<nome>` a partir de `f1/integrado`.
2. Um commit por etapa. Antes de cada etapa, escrever os testes positivo, negativo e de borda. Prova com saída real do `vitest`.
3. Bateria por PR: `tsc`, `check-boundaries`, `validate-corpus`, testes da fatia, matriz F0 sem regressão, scanner PHI, adversariais W8/W10 quando tocar regra ou servidor.
4. Arquivos comuns são serializados. Dois escritores nunca trabalham no mesmo arquivo. `src/rules` e os contratos congelados só mudam com decisão registrada.
5. Lei de autoria: não commitar trabalho de outro escritor sem autorização; conferir o `git status` antes de mexer no checkout principal.
6. Auditoria cruzada: o Claude revisa cada PR em leitura. O Dr. Silas libera o merge.
7. CLI: o modelo padrão "fugu" falha com conta ChatGPT. Usar `-c model='"gpt-6-astra"'` ou o perfil configurado para o orquestrador.

## 6. Quadro de 7 blocos (obrigatório antes de cada fatia)
```
FATIA F1-Sx · <nome>
1. Temas abordados ............ problema clínico-operacional (1 a 3 linhas)
2. Já previsto ................ decisões e trechos do plano (IDs)
3. Indicação do Claude/Codex .. proposta concreta, com portas de entrada e saída
4. Código simples ............. funções puras, comandos e projeções (arquivo, assinatura, teste)
5. Biblioteca ................. dado versionado em corpus/ (estado de curadoria)
6. Dr. Silas decide ........... até 5 perguntas fechadas (sim/não ou A/B/C)
7. Já decidido ................ IDs que não se rediscutem
ACEITE: testes positivo, negativo e de borda, nomeados; prova; demo
WRITE_SET: arquivos permitidos · PROIBIDO: arquivos vedados
```

## 7. Perguntas ao Dr. Silas antes da Onda 0
1. **Escopo da S10:** manter salão, farmácia e APAC como preparação contratual com uso local monousuário (como está registrado) ou antecipar a operação real para a F1? Recomendação: manter.
2. **Pergunta 46** (pênis, conduta em cN1 apoiada no curso): fica provisória ou sai do pack?
3. **Pergunta 49** (alto risco no mHSPC): qual definição registrar?
4. **Versão do CTCAE na F1:** declarar a v6.0 (com o mapeamento v5→v6 como referência, `[VERIFICAR]` licença/fonte)?
5. **Ordem das ondas** (fundação → setores → reconciliador → consulta/dutos): aprovada?
