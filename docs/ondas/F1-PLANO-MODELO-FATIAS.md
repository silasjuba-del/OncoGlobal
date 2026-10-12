# F1: modelo de plano, fatias e etapas (v5, proposta para aprovação)

Data: 2026-10-12. Autor: Fable (planejamento). Orquestrador da execução: Codex-Fugu. Executores: agentes mecânicos com WRITE_SET fechado (D-F1-21).
Estado: **PROPOSTA v5**. Base: `f1/integrado` em `fbecedb` (PR #7 mergeado pelo Dr. Silas em 12/10). Nenhuma fatia começa sem o quadro de 7 blocos aprovado pelo Dr. Silas (§6). Este documento não inicia código.

O que mudou na v5 (3ª revisão do Codex, `handoff/2026-10-12_codex-revisao-plano-f1-v4.md`):
- S0 com faixa completa (`salao.ts`, cliente e contrato do `carregar`) e mapa explícito: 6 grupos de correção na S0, o 7º (ORK) na S6;
- S6 cobre a queda entre o commit clínico e o disparo técnico: enfileiramento durável na mesma transação e recuperação determinística no boot; `estimulo_tecnico` (estímulos) e `execucao_tecnica` (runs) harmonizados;
- S5-E1 compara paciente, encontro, lote, proposta e versões, com ataques de divergência por campo;
- S5b vira fatia vertical mínima com reúso comprovado e fixture inteiramente sintética;
- WRITE_SETs sem sobreposição: `leituras.ts` na S1; S3 enumera os arquivos pela relação aprovada; S3c sem `manifesto/` e `prompts/`; S4 não escreve corpus; S11 com a composição do gateway;
- §7 só com a pergunta do cenário da demo (o escopo assistencial já está fixado).
- Revisão 2 da v5 (Codex local sobre `fce5f42` + Codex GitHub no PR #8): S0 com `http.ts`, consumidores do `carregarConsulta` e o filtro de `snapshot.ts`; aceite da S0 com 6 adversariais; S1-E6 ponto transacional e `EstimuloTecnico@1` antes da S6; `PRONTO` com visão exigido só nos planos clínicos F1; S3 entrega os arquivos de exceção antes de S6; S5b com entrada do PDF e montagem na tela; S11 com os verbos novos em `ActionIntent`; síntese da S8 depois da S11.

O que mudou na v4:
- aplica os 9 ajustes da 2ª revisão do Codex (`handoff/2026-10-12_codex-revisao-plano-f1-v3.md`);
- incorpora a auditoria externa de 12/10, com 7 achados de código confirmados por leitura (registro em `DECISOES.md`): nasce a **S0**, antes de qualquer outra fatia;
- estímulos técnicos ganham canal próprio, fora de `clinical_event` (§2.4);
- o Reconciliador vira etapa final que sempre roda no ORK; resultado parcial mostra cobertura e lacunas; publicação tardia é barrada (S6);
- contratos comuns publicados antes da Onda 1 (S2-E5); WRITE_SETs completos e posse serial dos arquivos comuns (§4.1);
- curadoria do corpus com responsável e percurso (S3c); OCR e LLM com faixa completa (S11); aceite de PHI separado da exceção D-W9-66;
- um **caso-guia** vertical prova a transversalidade antes de abrir todos os setores (S5b);
- CTCAE v6 pura já decidida (Q45, D-W9-73): sai a pergunta, fica a conferência de fonte e licença;
- perguntas 46 e 49 respondidas (D-F1-20).

O que mudou na v3 (D-F1-19): Maestro e ORK mantidos de forma peremptória como cerne; setores como órgãos ligados por sangue e nervos; porta única, núcleo e satélites, mais domínio e menos agentes.
O que mudou na v2 (D-F1-18): o paciente é um só ao médico; o software tem setores profundos; reconciliador.

Fontes: PLANO-FINAL v1.1 (§F1 e R-17 a R-22); D-F1-01 a D-F1-21; D-W9-15, D-W9-66, D-W9-73, D-W9-82; aceite da proposta F1 (`DECISOES.md:265`).

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

- **Cada setor é profundo e especializado.** Contrato, regras, testes, biblioteca e responsável próprios. Um setor nunca lê o banco de outro: lê o Retrato (§2) e devolve `AchadosSetor`.
- **O Reconciliador cruza os setores** sobre o mesmo `patientId` e a mesma `revisao`, com a cadeia de causa citando cada fato e cada regra aprovada.
- **O médico vê o paciente inteiro.** Achados integrados primeiro; detalhe por setor em um clique, com link ao fato.
- **Lacuna é visível.** Setor sem dado, com dado vencido, sem regra aprovada ou **que falhou na execução** aparece como lacuna, nunca como "normal" nem como silêncio.

## 0.1 Anatomia do app: órgãos, sangue e nervos (D-F1-19)

| Corpo | App | Função | Onde está |
|---|---|---|---|
| **Órgãos** | 7 setores clínicos + setores assistenciais (farmácia, salão, APAC, agenda, documentos) | função e responsabilidade próprias; nunca faz o trabalho de outro | `src/modules/setores/**`, `src/modules/<duto>/**` |
| **Sangue** | ledger append-only + Retrato | leva o mesmo dado a todos os órgãos; ninguém guarda sangue próprio | `src/kernel/ledger`, `src/kernel/projections/retrato` |
| **Sistema nervoso central** | **Maestro**: tabela fixa de planos por evento (R-14, Q11), sem LLM | decide quais órgãos reagem e em que ordem | `src/orchestration/maestro.ts` |
| **Nervos motores e reflexos** | **ORK**: executa, supervisiona, repete, marca falha, barra reentrada e publicação tardia | nenhum órgão chama outro; texto nunca muda estado (G-15) | `src/orchestration/ork.ts` |
| **Vasos e nervos periféricos** | comandos do kernel, rotas, portas tipadas (§3) | caminho fixo e tipado de cada sinal, com envelope de correlação | `src/kernel/comandos`, contratos |
| **Sistema nervoso autônomo** | estímulos técnicos (§2.4) | vencimento, biblioteca ativada, execução: circulam sem virar fato clínico | `src/kernel/orquestracao/estimulos` |
| **Integração** | Reconciliador: etapa final de todo plano clínico | visão única; cobertura e lacunas mesmo com falhas | `src/modules/reconciliador` |
| **Decisão** | o médico | conduta e assinatura | sessão + AGE |

Maestro e ORK existem e estão provados (Q11, G-15, RT-09), mas fora do runtime. A F1 os liga na S6 sem mudar a natureza deles.

## 1. Leis que valem em toda fatia

1. **X + Y = Z** (D-F1-07): avaliação sobre a prescrição PROPOSTA, antes do ciclo 1, refeita a cada mudança relevante.
2. **Longitudinal**: todo fato tem **tempo clínico** (quando aconteceu) e **tempo de registro** (quando foi gravado), validade, origem, negação e conflito. Ausência não é normalidade.
3. **O código aplica a regra; a LLM só faz cognição.** Dois portões da LLM: CI gravado e log ao vivo. Provider conforme D-W9-15.
4. **Continuidade** (D-W9-82): dado faltando vira alerta e pendência, sem parar o serviço. **Não libera ato inválido**: identidade, conteúdo exibido, assinatura e consentimento continuam travando.
5. **Flash sem semáforo** (D-F1-01). Biblioteca consultável; alerta só com aprovação item a item (D-F1-05).
6. **Sem fonte, `null` e pendência.** Estados provisórios de D-F1-16, 17 e 20 preservados.
7. **Planejado, prescrito e administrado são distintos.** Prescrição não é APAC. Chat não vira prontuário.
8. **PHI fica no PC.** Saída ordinária só desidentificada, pelo gateway (G-02). A exceção documental D-W9-66 tem aceite próprio (S11) e não se estende ao Genspark.
9. **Snapshots confirmados e assinados são históricos.** A projeção atual nunca os reescreve.
10. **Fuso único do serviço**: America/Fortaleza, −03:00, injetado (D-W5-01). Nenhum cálculo de data civil deriva o fuso do instante.
11. **O encontro é explícito.** Nenhum comando ou leitura infere "encontro atual" pelo último evento gravado.
12. **Estímulo técnico não é fato clínico** (§2.4).

## 2. Backend simples e completo

Um processo Node, SQLite, ledger append-only, projeções puras. Sem barramento e sem serviço paralelo (D-F1-10).

| Camada | Responsabilidade | Existe hoje | F1 faz |
|---|---|---|---|
| Comandos | 1 verbo = 1 função do kernel; idempotência; autoria; `patientId`, `encounterId` e `tumorLotId` explícitos | 5 `confirmar()` em `rotas.ts` | estrangular em comandos |
| Envelope | registro `tipo@versao → schema do payload`, na gravação e na leitura | `payload: unknown`; só o envelope é validado | payload fora do schema vira pendência, nunca descarte |
| Retrato | projeção única, com `revisao` | `retratoTransversal`, `preConsulta`, `snapshot`, `cumulativos`, `series` | `Retrato`; os antigos viram derivados |
| Setores | 7 avaliadores puros | regras em `src/rules`, `contextoClinico.ts`, `resumoLongitudinal.ts` | `avaliarSetor(retrato, contexto) → AchadosSetor` |
| Reconciliador | etapa final; visão integrada; cobertura | — | `reconciliar(resultadosRun, retrato) → VisaoIntegrada` |
| Estímulos técnicos | vencimento, biblioteca, execução | — | tabela própria, fora de `clinical_event` |
| Dutos | estado próprio por setor assistencial | `modules/farmacia`, `estoque`, `documentos`, `apac`, `canal` | ligados por portas, uso local monousuário |
| Maestro/ORK | planos por evento; execução supervisionada | provados, fora do runtime | ligados ao runtime (S6) |
| Gateway | impressão e envio externo | stub e FN-24 | sem mudança estrutural |

### 2.1 Porta única de entrada (com a extração no lugar certo)
```
documento/texto/print/PDF ─▶ normalizador ─▶ Maestro(LAB_CHEGOU…) ─▶ ORK: extração (determinística, OCR local, LLM desidentificada)
      ─▶ CANDIDATOS em drafts (nunca fato) ─▶ confirmação humana (1 clique) ─▶ comando ─▶ ledger (fato)
      ─▶ Maestro(FATO_CONFIRMADO…) ─▶ ORK: setores ─▶ Reconciliador ─▶ UI e documentos
estímulo técnico (vencimento, biblioteca ativada) ─▶ tabela de estímulos ─▶ Maestro ─▶ ORK: reavaliação (sem gravar fato)
```
Nenhum adaptador tem regra clínica. Canal novo é um adaptador antes do normalizador. Voz e canal do paciente entram aqui quando forem liberados (fora da F1).

### 2.2 Núcleo e satélites
- **Núcleo:** contratos, ledger, envelope, comandos, regras, validação, assinatura, persistência, Maestro/ORK, estímulos técnicos, gateway.
- **Satélites:** consulta, setores clínicos, reconciliador, documentos, salão, farmácia, APAC, agenda, canal, impressão, caixa.
- **Fronteiras** (no `check-boundaries`, S3-E5): satélite importa só núcleo e contratos; satélite nunca importa satélite; só o núcleo toca o ledger; só o gateway fala com o exterior. Hoje a regra `modules` ainda permite módulo importar módulo: a S3-E5 fecha isso.

### 2.3 Mais domínio, menos agentes
Setores são funções puras, executadas pelo ORK como passos. A LLM fica em três usos, com microprompt versionado e os 2 portões: extração na ingestão (FN-24), síntese em prosa de fatos confirmados, reformulação sem PHI. Não se cria agente onde uma regra versionada resolve.

### 2.4 Estímulos técnicos (sistema nervoso autônomo)
O ledger clínico exige revisão humana e ator `SESSAO` (`ledger.ts:46-52`). Isso é regra, não falha. Então: vencimento de exame, ativação de versão da biblioteca, conclusão de uma execução e reabertura de avaliação circulam em `estimulo_tecnico` (tabela própria, append-only, ator `SISTEMA`, com `correlacao {patientId?, encounterId?, revisaoEntrada, regras@versao, biblioteca@versao}`). O Maestro os recebe como eventos. Eles **nunca** entram em `clinical_event`, nunca promovem candidato a fato e nunca aparecem como fato ao médico. Os runs do ORK são persistidos em `execucao_tecnica` (tabela irmã, também append-only), para retomada e auditoria; `estimulo_tecnico` guarda só os estímulos.

### 2.5 Retrato (contrato mínimo)
- `patientId`, `revisao` (hash do **conteúdo canônico**: eventos de entrada e versões; **`geradoEm` fica fora do hash**), `versaoProjecao`, `geradoEm`.
- **Escopo do paciente**, independente de tumor: identidade, alergias, medicamentos reconciliados, comorbidades, função orgânica, exposições, contatos.
- **Escopo do tumor**: `TumorLot[]`. Dois tumores nunca se misturam.
- **Escopo do encontro**: `encounterId` explícito, episódio, ciclo.
- **Fatos por referência** (`eventId@revisao`) com tempo clínico, tempo de registro, validade, origem, negação, conflito.
- **Tratamento** em 4 camadas: planejado, proposto, assinado, administrado.
- **Delta** entre a última consulta confirmada e agora, calculado, não fixo.
- **Operacional**: pedidos, tarefas, documentos, APAC, pendências de integridade.

## 3. Portas e envelope de correlação (D-F1-10)

Toda troca carrega `patientId`, `encounterId`, `tumorLotId` (quando aplicável), `operationId`, `revisao` dos fatos, `regras@versao`, `biblioteca@versao`, e, quando houver proposta, `propostaId@revisao`. Autorização no servidor; vínculo por ID não dá acesso. Recebimento ≠ execução.

| Setor/duto | Dono | Contrato | Consome | Produz | Invalida quando |
|---|---|---|---|---|---|
| Laboratório | S4-A | `AchadosSetor@1` | séries, validade | tendência, função orgânica, vencidos | exame novo/corrigido/retirado; vencimento |
| Imagem | S4-A | `AchadosSetor@1` | ImagingStudy | RAD_ONE_LINE, RECIST proposto | laudo novo; conflito |
| Patologia + biomarcadores | S4-B | `AchadosSetor@1` | PathologyFact, Biomarker | aplicabilidade do pack | laudo novo; correção |
| Comorbidades | S4-C | `AchadosSetor@1` | comorbidades | risco comorbidade × droga | comorbidade nova |
| Interações e contraindicações | S4-C | `AchadosSetor@1` | meds + proposta | achados de interação | qualquer med novo, inclusive o primeiro |
| Toxicidades | S4-D | `AchadosSetor@1` | CTCAE v6 | proposta de ação | nova graduação |
| Tratamento | S4-E | `AchadosSetor@1` (saída) sobre `PrescricaoProposta@1` (entrada) | esquema, ciclo, cumulativos, proposta | itens avaliados, requisitos, cumulativos | dose, droga, esquema, administração |
| Reconciliador | S5 | `VisaoIntegrada@1` | todos os `AchadosSetor` + falhas do run | achados integrados, cobertura, lacunas | qualquer entrada |
| Investigação | S7 | `RequisitosPack@1` | TumorLot, fatos, pedidos | propostas de pedido com resumo do caso | histologia, estádio, biomarcador, linha |
| Farmácia | S10 | `ConferenciaFarmacia@1` | prescrição assinada (versão) | `CONFERIDA` / `CORRECAO_PEDIDA` | nova versão assinada |
| Salão | S10 | `Administracao@1` | prescrição vigente, triagem | administração efetiva ou parcial | — |
| APAC | S10 | R-20 (`RASCUNHO` → …) | conduta assinada, TumorLot | APAC RASCUNHO; exportação só com validação persistida | nova prescrição assinada |
| Agenda/tarefas | S1 (contrato), S10 (duto) | `Tarefa@1` (D12) | datas confirmadas | tarefa com responsável, prazo, recebimento | conclusão ou cancelamento |
| Chat | S10 | `MensagemChat@1` | thread por paciente/setor | discussão; decisão aceita vira `DecisaoRegistrada` | — |
| Biblioteca | S3 | pacote com manifesto e hashes | pacote exportado (sincronização manual declarada) | versão ativa → estímulo `BIBLIOTECA_ATIVADA` | troca de versão |

## 4. Fatias e etapas

### 4.1 Regra de faixa
Cada fatia declara `WRITE_SET`. Os **arquivos comuns** têm posse serial, nesta ordem, e só um escritor por vez:
`src/server/rotas.ts` e `src/server/leituras.ts`: S0 → S1 → S2 → S3 (pagar exceções) → S6 → S5b (só `/consulta/extrair` e a rota de leitura) → S8 → S10 → S11 · `src/server/flash.ts`: S1 (import do ledger) → S2 · `scripts/check-boundaries.mjs`: S1 (só remover linhas de EXCECOES) → S3 · `src/app/oncoassistLocal.ts`: S0 (fuso) → S1 → **S3 (pagar exceções)** → S6 (composição) → S11 (executores) · `src/orchestration/pipeline-extracao.ts`: **S3 (pagar exceções)** → S6 · `src/ui/api/{porta,http,fake,respostas}.ts`: S0 → S5b → S8 → S11 · `src/kernel/ledger/schema.ts`: S6 · `src/contracts/operacao.ts`: S11 (só verbos novos, com decisão registrada) · `package.json`/lockfile: S11.
A S3 entrega cada arquivo de exceção paga **antes** do próximo escritor dele; o quadro de 7 blocos da S3 lista a ordem.
Remover uma exceção é permitido a quem corrige o import (a relação aprovada é teto e pertencimento; `scripts/fronteiras-excecoes-aprovadas.json`). O integrador de cada onda é o Codex-Fugu.

### Onda 0: fundação

**S0 · Contratos temporais e integridade da leitura** (os 7 achados confirmados da auditoria externa)
- WRITE_SET: `src/app/oncoassistLocal.ts` (só `agora`), `src/server/leituras.ts`, `src/server/f0c/contextoClinico.ts`, `src/server/f0c/salao.ts` (só receber o fuso injetado), `src/server/rotas.ts` (só `/consulta/carregar` e `lerApacs`), `src/contracts/f1/relogio.ts` (novo), `src/contracts/f1/consultaCarregar.ts` (novo: pedido com `encounterId`), `src/ui/api/porta.ts`, `src/ui/api/http.ts` e `src/ui/api/fake.ts` (só a assinatura de `carregarConsulta` com `encounterId`), `src/ui/consulta/ConsultaPersistida.tsx`, `src/ui/telas/TelaConsulta.tsx` e `src/ui/OncoassistLocal.tsx` (só o ponto de chamada de `carregarConsulta`), `tests/f1/s0/**`, `tests/adv/f1-s0-*.adv.ts`.
- Mapa dos 7 achados: **S0** corrige os grupos 1 (payload), 2 (encontro), 3 (lote), 4 (fuso), 5 (delta e pendências) e 6 (`lerApacs`); o grupo 7 (ORK: `PRONTO` com um `ok` e timeout sem cancelar) é corrigido na **S6-E2/E3**, e a S0 não o exige.
- E1: relógio do serviço: `agora()` devolve instante com `-03:00` (D-W5-01); `salao.ts` e `leituras.ts` passam a receber o mesmo fuso injetado. Adversarial: assinatura às 23:30 −03:00 mantém o dia civil e os 21 dias.
- E2: encontro explícito: `/consulta/carregar` recebe `encounterId` (ou abre um novo por comando); `current` deixa de ser `at(-1)`. Adversarial: correção de encontro antigo não muda a consulta ativa.
- E3: dados do paciente independentes do tumor: alergias, comorbidades e medicamentos saem do filtro de lote em `contextoClinico.ts` **e** no filtro de escopo de `src/kernel/projections/snapshot.ts` (entra na WRITE_SET só para esse filtro; o restante do snapshot é da S2). Projeção explícita: `escopo: "PACIENTE"` para esses três domínios e para função orgânica e exposições; `escopo: "TUMOR"` para o resto. Adversarial: alergia gravada no lote A aparece no lote B.
- E4: payload fora do schema do tipo vira pendência `PAYLOAD_FORA_DO_CONTRATO` com `eventoId`, `tipo` e `schema`, sem conteúdo; `porTipo` não descarta em silêncio. Ponte até o registro `tipo@versao` da S1.
- E5: `delta` calculado e pendências fixas removidas quando o campo já é projetado; `lerApacs` com `ultimoAvisoEm` real e rótulo da antiglosa fiel à configuração.
- Aceite: 6 testes adversariais, um por grupo corrigido na S0 (o 7º, do ORK, fica no aceite da S6); matriz F0 e adversariais W8/W10 sem regressão.

**S1 · Comandos, envelope e contrato da Tarefa** (depois da S0)
- WRITE_SET: `src/kernel/comandos/**` (novo), `src/contracts/envelope.ts`, `src/contracts/f1/tarefa.ts`, `src/server/rotas.ts`, `src/server/leituras.ts` (só os pontos de leitura chamados pelos comandos), `src/server/autorizacao.ts`, `src/server/flash.ts` (só import), `src/app/oncoassistLocal.ts`, `scripts/check-boundaries.mjs` (só remoção de exceções pagas), `tests/f1/s1/**`, `tests/adv/f1-s1-*.adv.ts`.
- E1: registro `tipo@versao → schema`; versão desconhecida vira pendência.
- E2: comandos `confirmarBloco`, `registrarFato`, `proporPrescricao`, `assinarPrescricao` (reconfere revisões), `vincularContato` (reusa `modules/canal/vinculo.ts`), `registrarAdministracao`, `registrarTarefa`. Todos exigem `patientId`, `encounterId` e, quando aplicável, `tumorLotId`.
- E3: estrangular os 5 `confirmar()`, com teste de equivalência por ponto.
- E4: contrato `Tarefa` (D12, EV-T1 a EV-T6).
- E5: pagar as exceções de ledger/drafts fora do kernel e remover as linhas correspondentes.
- E6: **ponto transacional de emissão**: o WriteRouter ganha o gancho `aoCommitar(fn)` que escreve, **na mesma transação** do `clinical_event`, as linhas técnicas que a S6 vai consumir (`execucao_tecnica` PENDENTE); e o contrato `EstimuloTecnico@1` (`src/contracts/f1/estimuloTecnico.ts`) é publicado aqui, para a S3-E1 emitir `BIBLIOTECA_ATIVADA` antes de existir a infraestrutura da S6. Até a S6, os estímulos ficam gravados e não disparam nada.
- Aceite: replay não duplica; envelope inválido recusado; zero `confirmar()` direto; adversarial de replay e de envelope forjado.

**S2 · Retrato e contratos comuns** (depois da S1)
- WRITE_SET: `src/kernel/projections/retrato/**` (novo), `src/server/leituras.ts`, `src/server/retratoTransversal.ts`, `src/server/flash.ts`, `src/contracts/f1/{retrato,achadosSetor,prescricaoProposta,visaoIntegrada,correlacao}.ts`, `tests/f1/s2/**`, `tests/adv/f1-s2-*.adv.ts`.
- E1: `Retrato` (§2.5), com tempo clínico e tempo de registro separados e `geradoEm` fora do hash.
- E2: fatos por referência; conflito e negação preservados; delta entre consultas confirmadas.
- E3: snapshots assinados preservados; proposta ≠ confirmado; resumo principal com referências aos fatos.
- E4: `lerConsulta` e Flash leem do Retrato (sem mudança visual).
- E5: **contratos comuns publicados**: `AchadosSetor@1`, `PrescricaoProposta@1`, `VisaoIntegrada@1`, `Correlacao@1`. A Onda 1 só abre depois deste commit.
- Aceite: reconstrução byte a byte do conteúdo canônico; alergia nos dois tumores; fato do tumor A não vaza para o B; snapshot antigo intacto; adversarial de hash estável com `geradoEm` diferente.

**S3 · Biblioteca: loader e fronteiras** (E1 em paralelo com S0/S1; E2 a E5 depois da S2)
- WRITE_SET: `src/kernel/corpus/**`, `corpus/manifesto/**` (novo), `scripts/check-boundaries.mjs`, `scripts/fronteiras-excecoes-aprovadas.json` (só leitura; nunca cresce), os arquivos do campo `arquivo` da relação aprovada que ainda constem em `EXCECOES` no início da S3 (o quadro de 7 blocos da S3 lista cada um pelo nome), `tests/f1/s3/**`, `tests/adv/f1-s3-*.adv.ts`.
- E1: loader dos 8 pilares, com manifesto, hashes, curadoria (`RASCUNHO`/aprovado/obsoleto), ativação atômica, volta à última versão válida (D-F1-14), e emissão do estímulo `BIBLIOTECA_ATIVADA` pelo contrato `EstimuloTecnico@1` da S1-E6 (§2.4); o estímulo fica gravado e só é consumido a partir da S6.
- E2: conferência de fonte e licença do CTCAE v6 (já decidido: v6 pura, Q45 e D-W9-73).
- E3: duto de conhecimento: pacote exportado do Genspark validado, importado e em revisão; nada de paciente sai; trials não geram elegibilidade.
- E4: índice de aplicabilidade por tumor, histologia, estádio, biomarcador e linha.
- E5: fronteiras: "satélite não importa satélite" no scanner; zerar exceções. Prova: `npm run check:boundaries:fechar-f1-s3`.
- Aceite: pacote inválido rejeitado; versão anterior recuperada; offline; zero exceções; adversarial: pacote com hash certo e conteúdo trocado é rejeitado.

**S3c · Curadoria do corpus** (contínua; responsável: Codex-Fugu redige, Dr. Silas revisa e aprova)
- WRITE_SET: `corpus/{1-exames,2-receitas,3-laudos,4-interacoes-contraindicacoes,5-ctcae-acao,6-pack-tumor,7-orientacoes,8-encaminhamentos}/**`, `corpus/fichas/**`, `corpus/rulesets/**`, `scripts/validate-corpus.mjs`, `docs/ondas/F1-CORPUS-DECISOES-PENDENTES.md`, `tests/corpus/**`. **Fora:** `corpus/manifesto/**` (S3) e `corpus/prompts/**` (S11). Registro em `DECISOES.md` só pelo Fable.
- Entrega serial ao corpus: os setores da Onda 1 **não escrevem** em `corpus/`; pedem a parcela ao S3c, que publica a versão, e consomem pela biblioteca ativa.
- Percurso obrigatório por item: divergência detectada (pelo validador ou pela reconciliação do S3-E2) → correção com fonte → revisão médica (registro D-F1-xx) → publicação versionada → ativação (`consultavel` e, só com aprovação item a item, `alerta`).
- Primeiro item: fichas FOLFOX e FOLFIRI paliativas com bolus de 5-FU (D-F1-16), hoje divergentes.
- Validador: migração `ativo` → `consultavel` / `alerta`, mantendo estados provisórios (D-F1-16, 17, 20).
- Aceite: zero divergência entre decisões e corpus na ativação; item sem aprovação nunca alerta.

### Onda 1: setores (depois de S2-E5 e S3-E1; faixas disjuntas, até 5 em paralelo)
Cada setor: `src/modules/setores/<setor>/**`, `tests/f1/s4-<setor>/**`, `tests/adv/f1-s4-<setor>-*.adv.ts`. Nenhum setor escreve em `corpus/`: a parcela de biblioteca de que precisa é pedida ao S3c e nomeada, arquivo por arquivo, no quadro de 7 blocos da fatia. Saída comum: `AchadosSetor@1 {setor, correlacao, entradas@revisao, regras@versao, cobertura {avaliados, semRegraAprovada}, achados[], lacunas[]}`.

Ordem clínica de prioridade: **S4-A (laboratório + imagem) e S4-C (comorbidades + interações) primeiro**, porque são os cruzamentos mais frequentes de segurança (função orgânica × droga × medicamento em uso × comorbidade) e sustentam o caso-guia (S5b). Depois S4-E, S4-D, S4-B.

| Fatia | Setor | Etapas | Aceite mínimo |
|---|---|---|---|
| S4-A | Laboratório + Imagem | séries e validade; função orgânica com dado e data; tendência; RADS 3 camadas; RECIST proposto | dado vencido vira lacuna; laudos em conflito preservados |
| S4-C | Comorbidades + Interações | comorbidade estruturada; comorbidade × droga; interação sobre meds + proposta | o primeiro med novo dispara; sem regra = "sem cobertura" |
| S4-E | Tratamento | `PrescricaoProposta@1` tipada do protocolo versionado; ciclo; cumulativos; 4 camadas | campo sem fonte = `null`; planejado ≠ assinado ≠ administrado |
| S4-D | Toxicidades | CTCAE v6; CTCAE-ação como proposta | nunca muda dose; grau ausente ≠ grau 0 |
| S4-B | Patologia + Biomarcadores | specimen-role; pT só de ressecção com TNM; biomarcador → aplicabilidade | biópsia não gera pT; ausente ≠ negativo |

### Onda 2: integração clínica

**S5 · Reconciliador e visão integrada**
- WRITE_SET: `src/modules/reconciliador/**`, `tests/f1/s5/**`, `tests/adv/f1-s5-*.adv.ts`.
- E1: junta os `AchadosSetor` **e as falhas do run** (`missing`, `error`, `unattempted`, timeout) como lacunas. Antes de juntar, confere em cada resultado o envelope de correlação completo: `patientId`, `encounterId`, `tumorLotId` aplicável, `propostaId@revisao`, `fatos@revisao`, `regras@versao`, `biblioteca@versao`. Qualquer campo divergente marca o resultado como "desatualizado" e o exclui da visão atual. Adversarial: um ataque por campo divergente.
- E2: achados cruzados com cadeia de causa; combinações vêm da biblioteca aprovada.
- E3: avaliação da prescrição proposta antes do ciclo 1, com cobertura e lacunas; não muda dose.
- E4: agrupamento anti-fadiga (L10) sem esconder risco.
- Aceite: achado de dois setores aparece uma vez com os dois fatos; setor que falhou aparece como lacuna; N−1 nunca aparece como atual.

**S6 · Sistema nervoso no runtime: Maestro/ORK, estímulos e reavaliação**
- WRITE_SET: `src/orchestration/**` (acrescentar e ligar; tabela fixa e executor supervisionado não mudam de natureza), `src/kernel/orquestracao/estimulos/**` (novo), `src/kernel/ledger/schema.ts` (só a tabela `estimulo_tecnico` e `execucao_tecnica`), `src/kernel/comandos/disparo.ts` (gancho pós-commit, serial com S1), `src/app/oncoassistLocal.ts` (composição), `src/server/rotas.ts` (entrega da `VisaoIntegrada` à consulta), `src/modules/reconciliador/dependencias/**`, `tests/f1/s6/**`, `tests/adv/f1-s6-*.adv.ts`.
- E0: tabela do Maestro com os eventos da F1 (`FATO_CONFIRMADO`, `PRESCRICAO_PROPOSTA`, `MED_RECONCILIADO`, `EXAME_CORRIGIDO`, `BIBLIOTECA_ATIVADA`, `FATO_VENCIDO`, `ADMINISTRACAO_REGISTRADA`) mapeados para setores e `RECONCILIADOR`. Planos atuais e testes Q11, G-15, RT-09 intactos.
- E1: ORK no runtime: a linha de `execucao_tecnica` (estado `PENDENTE`, com correlação e revisão de entrada) é gravada **na mesma transação** do commit clínico; o disparo lê essa fila. No boot e após queda, a recuperação é determinística: toda `PENDENTE` é processada em ordem. Replay do mesmo `operationId` não cria nova linha. Adversarial: queda simulada entre o commit e o disparo deixa a operação `PENDENTE` e ela é processada na retomada, uma única vez.
- E2: **etapa final**: o passo `RECONCILIADOR` recebe todos os resultados, inclusive falhas e timeouts, e sempre roda. **Só nos planos clínicos da F1** (os que terminam no passo `RECONCILIADOR`), `PRONTO` exige que a etapa final tenha produzido `VisaoIntegrada` com cobertura; resultado parcial é `PRONTO` com lacunas declaradas, nunca `PRONTO` silencioso. Os planos legados da tabela e os testes Q11, G-15 e RT-09 mantêm a semântica atual. Os 5 estados de run não mudam (teto Q9).
- E3: **publicação tardia barrada**: resultado de agente que chega depois do timeout é descartado e registrado; nunca entra na visão nem no ledger.
- E4: dependência por domínio e contexto (o primeiro med novo e o fato antes ausente também disparam).
- E5: gatilhos técnicos (§2.4): vencimento temporal e troca de versão da biblioteca entram como estímulos, não como fatos.
- E6: reconferência de revisões em `assinarPrescricao`.
- Aceite: `LAB=error` ainda produz visão com lacuna "laboratório indisponível"; resultado após timeout não aparece; evento fora da tabela não executa; `{"state": ...}` no texto não muda estado; replay não duplica execução; matriz F0 verde em Q11 e G-15.

**S5b · Caso-guia: fatia vertical mínima** (depois de S4-A, S4-C, S5 e S6; antes de abrir S4-B/D/E e a Onda 3)
- WRITE_SET: `tests/f1/s5b/**` (fixture sintética e percurso), `tests/adv/f1-s5b-*.adv.ts`, `src/ui/consulta/VisaoIntegradaMinima.tsx` (novo), `src/ui/consulta/ConsultaPersistida.tsx` (só a montagem do bloco), `src/ui/api/respostas.ts`, `src/ui/api/porta.ts`, `src/ui/api/http.ts` e `src/ui/api/fake.ts` (só o contrato e o cliente de leitura da `VisaoIntegrada`, rota entregue na S6), `docs/ondas/F1-CASO-GUIA.md`.
- **Reúso comprovado, sem adiantar a Onda 3:** agenda e check-in já existem (`contracts/w11/cadastroCheckin.ts`, leitura de agenda); a entrada do exame usa a extração determinística de PDF digital já existente (`src/leitura/caixa-unica.ts`) e os `drafts` do kernel; a visão integrada chega pela rota de leitura entregue na S6; o pedido assinado usa `modules/documentos` e a impressão pelo executor `IMPRIMIR` já composto em `oncoassistLocal.ts`. O que não existe (tela R-17 completa, caixa universal com OCR, dutos) fica na Onda 3; o caso-guia não os exige.
- Entrada do PDF: `converterEntradaLocalAsync` (`src/leitura/caixa-unica.ts`) existe mas não é chamado no runtime, e `/consulta/extrair` só recebe texto. A S5b liga o mínimo: `src/server/rotas.ts` (só `/consulta/extrair` aceitando PDF digital pelo conversor existente) e um botão de envio no bloco mínimo; esses arquivos passam depois à S8 e à S11. A prova é pelo percurso real na interface, não só por teste de unidade.
- Percurso: agenda → encontro explícito → PDF digital de laboratório na caixa → candidato → confirmação → Maestro/ORK → laboratório e interações → visão integrada → resumo com referências → pedido assinado → medicamento novo reconciliado → reabertura só do que depende → documento assinado preservado.
- **Fixture inteiramente sintética** (regra do repositório): paciente, datas e valores fictícios, modelados num retorno típico. Cenário proposto (a confirmar, §7): quimioterapia em curso com esquema que exige função renal (sem dose no fixture), creatinina nova acima da anterior, medicamento sintomático novo com interação de classe registrada na biblioteca aprovada, pedido de exames de controle, retorno marcado. Nenhum valor clínico inventado como regra: o fixture referencia só itens aprovados da biblioteca.
- Aceite: demo gravada; ≤5 cliques no retorno; nenhuma lista solta por setor; lacunas visíveis; nenhum byte de PHI fora; scanner PHI sem achado sobre a fixture.

**S7 · Caminho tumor → investigação** (depois de S3 e S5)
- WRITE_SET: `src/modules/investigacao/**`, `tests/f1/s7/**`, `tests/adv/f1-s7-*.adv.ts`.
- Requisitos do pack × fatos e pedidos → confirmado, ausente, solicitado, vencido, conflitante, não aplicável; propostas com fonte, sem duplicar; pedido de imagem com resumo do caso (D-F1-04).

### Onda 3: consulta e dutos (paralelo, faixas disjuntas; depois de S5b)

**S8 · Consulta integrada**
- WRITE_SET: `src/modules/consulta/**`, `src/ui/consulta/**`, `src/ui/telas/TelaConsulta.tsx`, `src/ui/api/**` (cliente HTTP da `VisaoIntegrada`), `src/server/rotas.ts` (só rota de leitura da visão), `tests/f1/s8/**`, `tests/adv/f1-s8-*.adv.ts`.
- Check-in (reusa `contracts/w11/cadastroCheckin.ts`, agora com `encounterId`); pré-consulta com delta; tela R-17 com visão integrada no topo; Flash sem semáforo. A **síntese OncoAssist** com citações (só de fatos confirmados, pelos 2 portões) **depende do adaptador e dos portões da S11**: entra como última etapa da S8, depois de S11 entregar `kernel/llm`.
- Aceite: ≤5 cliques; troca de paciente invalida contexto; síntese sem afirmação sem citação.

**S9 · Documentos**
- WRITE_SET: `src/modules/documentos/**`, `src/impressao/**`, `tests/f1/s9/**`.
- Receita, pedidos, retorno, evolução, resumo-14, laudos, orientações e encaminhamentos (os sem material-base ficam pendentes); impressão pelo gateway.
- Aceite: fixture canônico "Pantoprazol 40 mg pela manhã por 30 dias, hemograma e creatinina, retorno em 14 dias" → receita, 2 pedidos, retorno, 1 tarefa; reimpressão não cria encontro.

**S10 · Dutos locais (preparação contratual, uso monousuário)**
- WRITE_SET: `src/modules/{farmacia,estoque,apac,canal,salao,chat}/**`, `src/server/rotas.ts` (só rotas dos dutos, depois da S8), `tests/f1/s10/**`, `tests/adv/f1-s10-*.adv.ts`.
- Farmácia vinculada à **versão** assinada; salão registra administração e alimenta cumulativos; APAC derivada da conduta assinada com **validação persistida antes de habilitar exportação**; agenda e tarefas; chat → `DecisaoRegistrada`.
- Não declara setores remotos, multiusuário, WhatsApp nem operação real (D-F1-13).

**S11 · Caixa universal, OCR e LLM**
- WRITE_SET: `src/modules/caixa/**`, `src/leitura/**`, `src/kernel/extracao/**`, `src/kernel/llm/**` (adaptador D-W9-15 e os 2 portões), `src/contracts/operacao.ts` (só os verbos novos `OCR_LOCAL` e `LLM_EXTRACAO` em `ActionIntent`, com decisão D-F1-xx registrada antes; o registro do gateway é `Partial<Record<Verbo, Executor>>`, então sem o verbo não há porta), `src/kernel/gateway/**` (registro dos executores novos), `src/app/oncoassistLocal.ts` (só a composição desses executores; hoje só `IMPRIMIR` é injetado; depois da S6), `corpus/prompts/**` (microprompts versionados), `package.json` e lockfile (`tesseract.js`), `src/server/rotas.ts` (só upload, depois da S10), `tests/f1/s11/**`, `tests/adv/f1-s11-*.adv.ts`.
- Caixa → AG-02 → FN-25; OCR local; extratores LAB, RADS, PATH, CHEMO, SYMPTOM → candidatos → confirmação → disparo.
- **Dois aceites separados:** (a) saída ordinária: zero byte de PHI em chamada externa (G-02 em log); (b) exceção documental D-W9-66: só pelo gateway, provider com `store:false`, efeito registrado, texto de volta ao PC e à caixa de revisão; jamais para o Genspark.

**S12 · Fechamento da F1** (espera S0 a S11)
- Red team A12 a A19, matriz F1, PHI, latências CRIT-5, demo do caso-guia, `RELATORIO-F1.md`.

**Fora da F1:** voz (NOVA-3 e Plaud), pelo aceite em `DECISOES.md:265`.

### Dependências
```
S0 ─▶ S1 ─▶ S2(E1–E5) ─▶ Onda 1 (S4-A ∥ S4-C primeiro) ─▶ S5 ─▶ S6 ─▶ S5b ─▶ S4-E ∥ S4-D ∥ S4-B
S3(E1) ∥ S0/S1 ;  S3(E2–E5) depois de S2 ;  S3c contínua
S5b ─▶ Onda 3: S8 ∥ S9 ∥ S10 ∥ S11 ─▶ S12       S7 depois de S3 e S5
```

## 5. Protocolo do orquestrador (Codex-Fugu) e dos agentes (D-F1-21)
1. Por fatia: quadro de 7 blocos (§6) → aprovação do Dr. Silas → worktree e ramo `f1/sX-<nome>` a partir de `f1/integrado`.
2. Um commit por etapa. Testes positivo, negativo, de borda **e adversarial** escritos antes. Prova com saída real do `vitest`.
3. Agentes mecânicos recebem WRITE_SET fechado, spec literal e prova obrigatória; nunca decidem clínica, contrato ou escopo. O que o spec não cobre volta ao planejador.
4. Bateria por PR: `tsc`, `check-boundaries`, `validate-corpus`, testes da fatia, matriz F0, PHI, adversariais W8/W10 quando tocar regra ou servidor.
5. Arquivos comuns com posse serial (§4.1). `src/rules` e contratos congelados só mudam com decisão registrada.
6. Lei de autoria; `git status` antes de tocar o checkout principal.
7. Auditoria cruzada: Fable revisa cada PR em leitura. O Dr. Silas libera o merge.
8. CLI: `-c model='"gpt-6-astra"'` (o "fugu" padrão falha com conta ChatGPT).

## 6. Quadro de 7 blocos (obrigatório antes de cada fatia)
```
FATIA F1-Sx · <nome>
1. Temas abordados ............ problema clínico-operacional (1 a 3 linhas)
2. Já previsto ................ decisões e trechos do plano (IDs)
3. Indicação do planejador .... proposta concreta, portas de entrada e saída
4. Código simples ............. funções puras, comandos e projeções (arquivo, assinatura, teste)
5. Biblioteca ................. dado versionado em corpus/ (estado de curadoria)
6. Dr. Silas decide ........... até 5 perguntas fechadas
7. Já decidido ................ IDs que não se rediscutem
ACEITE: testes positivo, negativo, borda e adversarial, nomeados; prova; demo
WRITE_SET: arquivos permitidos (um a um) · PROIBIDO: arquivos vedados · POSSE SERIAL: ordem nos comuns
```

## 7. Pergunta ao Dr. Silas antes da Onda 0
1. **Cenário do caso-guia (S5b):** confirma o cenário proposto (quimioterapia em curso, creatinina nova, medicamento sintomático novo com interação registrada, pedido assinado, reabertura), a ser construído como fixture inteiramente sintética, ou prefere outro cenário típico? É a única pergunta aberta. O escopo assistencial (preparação monousuária) já está fixado e não se rediscute.
