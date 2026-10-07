# W10-FUGU · 12 FATIAS · Pipeline de extração multimodal + caixa única + caixa de revisão + timeline longitudinal

> Leia primeiro `docs/ondas/W10-COMUM.md` (inteiro) e depois `docs/specs/PIPELINE-EXTRACAO-MULTIMODAL.md` (é a sua especificação principal, incluindo o Anexo A "árvore do paciente").
> EXECUTOR = `FUGU`. Worktree `C:\Users\silas\Projects\OncoGlobal-wt\w10-fugu` · branch `f0/w10-fugu`.
> **Faixa:** `src/kernel/extracao/**` (novo), `src/kernel/projections/**`, `src/orchestration/**`, `src/leitura/**`, `tests/{kernel/extracao,projections,orchestration,leitura}/**`, `tests/w10-fugu/**`, `docs/progresso/W10-FUGU.md`, `docs/w10/PEDIDOS-FUGU.md`.
> **Missão:** tudo que entra no app (texto colado, PDF digital, Word, foto/laudo já transcrito, transcrição Plaud desidentificada, prescrição fotografada já transcrita) vira **fatos atômicos com proveniência**, reconciliados por regras, guardados como evidência imutável, projetados numa **timeline longitudinal do paciente**, e só as **exceções** vão para o médico. Lema: `IA EXTRAI TUDO. CÓDIGO RECONCILIA. MÉDICO SÓ RESOLVE EXCEÇÕES.`
> **LLM continua desligada nesta onda.** O "extrator" é uma **porta** (interface) com um **dublê determinístico** (regex/heurística sobre os sintéticos) atrás. Quando a LLM for ligada (D-W9-15), só a implementação da porta muda — nada no resto do pipeline.

## Princípios que você implementa em código (reprovam a fatia se violados)
1. **Ausência ≠ negativo.** Biomarcador ausente = `null`/NOT_FOUND, nunca "negativo".
2. **Inferência não vira fato.** "linfonodo 24 mm" ≠ N2; "dormência + oxaliplatina" ≠ "neuropatia G2"; "PSA baixo" ≠ remissão. Isso vira `DERIVED`/`INFERRED` com regra nomeada, e o grau CTCAE fica vazio.
3. **Frase original sempre preservada:** `rawEvidence`, `sourceId`, página/timestamp. O médico clica e vê a origem.
4. **Número falado exige confirmação** (dose, creatinina, Hb, PSA, CEA, dimensão, data, ciclo): vindo de Plaud ⇒ `confidence < 0,7` e `requiresConfirmation = true`.
5. **Fármaco foneticamente incerto:** guarda `raw` + `normalized` + `INFERRED` + confidence; nunca normaliza em silêncio.
6. **Validação temporal:** evento que exige diagnóstico antes da data do diagnóstico ⇒ `TEMPORAL_CONFLICT`.
7. **TNM é histórico imutável:** `stageHistory[]` (clínico, patológico, pós-tratamento); `historicalMetastaticDisease = true` nunca volta a false.
8. **Junção de paciente nunca automática** (D-W9-34a): o score do PatientResolver só **ordena candidatos**; todo segmento entra na **caixa de revisão** e só se liga ao paciente com clique.
9. **Hierarquia de evidência por domínio** (spec §4) — conflito entre fontes vira `CONFLICT` visível, nunca escolha silenciosa.
10. **Plaud não é fonte primária** de histologia, TNM, dose, IHQ, nome exato de fármaco, medida radiológica (spec §6).

## FUGU-01 · Tipos e esqueleto do pipeline
`src/kernel/extracao/tipos.ts`: `EncounterSegment`, `ClinicalFact` (domínios e `sourceType` da spec §3; `evidence: EXPLICIT|DERIVED|INFERRED|UNCERTAIN`; `rawEvidence`, `sourceId`, `page|timestampMs`, `confidence`, `requiresConfirmation`), `PatientCandidate`, `ReconciledField<T>` (`candidates[]`, `resolved`, `conflict`), `Exception` (o que vai ao médico). Mapeamento para a proveniência existente do projeto: EXPLICIT→EXTRACTED; confirmado pelo médico→DOCUMENT_CONFIRMED; DERIVED/INFERRED→INFERRED (com `regra`); UNCERTAIN→UNCERTAIN; ausente→NOT_FOUND. Use `src/contracts/w10/` quando publicado; antes disso, tipos locais marcados `PROVISORIO-W10`. Esqueleto `src/orchestration/pipeline-extracao.ts` com as 9 etapas como funções puras encadeadas (cada etapa recebe e devolve dados; sem I/O). Teste: pipeline vazio roda ponta a ponta com entrada mínima.

## FUGU-02 · Caixa única: conversão local (`src/leitura/`)
Entradas: texto colado; **PDF digital** (extração de texto local); **.docx** (zip+XML com `node:zlib`, sem dependência nova; se impossível sem dependência, `BLOQUEADO_DEPENDENCIA` + pedido); imagem/PDF escaneado ⇒ **PENDENTE** (D-W9-09: nunca pede foto nova, nunca envia a serviço externo). Saída: `DocumentoBruto {id, tipo, paginas[{n, texto}], hash SHA-256, recebidoEm}` imutável. Detecção de rasura/trecho riscado reaproveita `src/rules/w8/rasura.ts` (chame; não edite). Teste com `tests/fixtures/caso07/*.txt` e um .docx sintético gerado no teste.

## FUGU-03 · Segmentação (Segmenter)
Uma gravação/documento ≠ um paciente. Fronteira nova por combinação de sinais (novo nome chamado, mudança de idade/sexo, mudança de tumor, saudação de nova consulta, troca de acompanhante, novo conjunto de exames, silêncio longo + chamada). `boundaryConfidence`; **fronteira duvidosa não faz merge**. Teste: transcrição sintética de "maratona" com 3 Pacientes Teste vira 3 segmentos; um caso ambíguo vira segmento marcado `REVISAR_FRONTEIRA`.

## FUGU-04 · PatientResolver (só ordena, nunca junta)
Score da spec §2 (nome 0,35 · idade 0,10 · sexo 0,05 · tumor 0,15 · lateralidade 0,10 · protocolo 0,10 · marcador 0,05 · datas 0,10) → devolve **ranking de candidatos** + motivo por componente. Nenhum `AUTO_MERGE`: tudo vai para a caixa de revisão (FUGU-09). Com transcrição desidentificada (A8) o nome pesa 0 e o score usa o resto + a consulta aberta. Identidade forte vem do cadastro (CNS/Matrícula, mãe, nascimento — Modelo 08); "Dona Maria + taxano" nunca identifica. Teste: homônimos sintéticos com mães diferentes ficam como candidatos distintos.

## FUGU-05 · ClinicalFactExtractor (porta + dublê)
Porta `Extrator { extrair(segmento): ClinicalFact[] }`. Dublê determinístico para os sintéticos: diagnóstico/histologia, TNM literal com prefixo (c/p/yp) e fonte, biomarcadores com método e valor literal (HER2 0/1+/2+/3+, RE/RP %, Ki-67, PD-L1 com **escore + anticorpo + valor**, sem anticorpo = PENDENTE), fármacos/regime/ciclo de prescrição, sintomas, labs com unidade, imagem com sítio/lateralidade/medida/data, plano verbalizado. Negação ("sem sinais de", "não há") nunca gera achado positivo. Teste com PT07–PT10 e os laudos `docs/referencias/modelos/laudos-sinteticos/`.

## FUGU-06 · Normalização
Unidades (mg/dL, g/dL, mm³, ×10³/µL; °C com `tempDecimos`), datas para civil −03:00 (D-W5-01), lateralidade (DIREITO/ESQUERDO; cólon DIREITO/TRANSVERSO/ESQUERDO — D-W9-05), sítio anatômico canônico, nomes de fármaco (dicionário local; incerto ⇒ INFERRED), TNM por sistema e edição (AJCC 8/9 por sítio e data; orofaringe HPV = AJCC 9 desde 01/01/2026). Nada inventado: o que não normaliza fica com `raw` + PENDENTE.

## FUGU-07 · ReconciliationEngine
Cada campo vira `ReconciledField` com candidatos por fonte; hierarquia **por domínio** (spec §4): histologia AP > IHQ > evolução > Plaud > enfermagem; dose/protocolo/ciclo prescrição > administração > evolução > Plaud; sintoma fala ≈ enfermagem específica > evolução genérica; estadiamento AP+imagem > evolução estruturada > CID; tratamento realizado administração > prescrição > plano > fala. Tratamento separado em **proposto → prescrito → administrado → suspenso/adiado → concluído** ("retiro carbo" × prescrição com carboplatina ⇒ `CONFLICT planned_regimen != ordered_regimen`). Conflitos clínicos detectados: M0 × metástase documentada; lateralidade/sítio divergente (chama o gate G-07 do harness via interface; não edite `gates.ts`); TNM incompatível; CID × primário; dose/data incoerente; cronologia impossível.

## FUGU-08 · Validação anti-alucinação (SafetyValidator)
Os 7 invariantes acima como checagens de código sobre o resultado da reconciliação. Qualquer tentativa de promover `INFERRED/UNCERTAIN` a confirmado sem regra documental **ou** clique médico é rejeitada com motivo. Teste adversarial em `tests/w10-fugu/`: cada invariante tem um caso que tenta violar e falha.

## FUGU-09 · Caixa de revisão + exceções
Estrutura `CaixaRevisao` (itens: segmento sem paciente, fronteira duvidosa, número falado, fármaco incerto, conflito, temporal, campo obrigatório ausente) e a saída-resumo ao médico no formato da spec §10: `✓ N fatos reconciliados automaticamente · ⚠ K precisam confirmação` com lista curta. Ação do médico (confirmar/corrigir/descartar/ligar ao paciente) vira evento no ledger (via interface existente de `src/kernel/ledger`; se precisar de evento novo, PEDIDOS). Nada some: descartado fica com motivo.

## FUGU-10 · Timeline longitudinal (projeção)
Em `src/kernel/projections/`: projeção do **Anexo A** (PATIENT → ONCOLOGY · TREATMENT_TIMELINE · CURRENT_ENCOUNTER · SOURCE_EVIDENCE · RECONCILIATION) a partir dos eventos/fatos confirmados. `stageHistory` imutável; `TREATMENT_TIMELINE.status ∈ proposed|ordered|administered|held|stopped` (+ concluído); `CTCAE_if_confirmed`; `ECOG explicit|inferred`; `missingRequiredData[]` alimentado pelo **Biomarker Requirement Engine** (FUGU-11). Alinhar tipos com `src/modules` (snapshot) — se o alinhamento exigir mudar `src/modules` (faixa do Grok), escreva o patch em PEDIDOS.

## FUGU-11 · Radiologia longitudinal + Biomarker Requirement Engine
(a) Mesmo sítio anatômico entre exames seriados: aparecimento, crescimento, redução, estabilidade, desaparecimento, com medidas e datas; **INTERVAL_PROGRESSION** (D-W9-43: mesmo sítio + mesmo método + aumento ⇒ eleva suspeição, nunca metástase automática) — a regra em si é do Grok (`src/rules`); você **chama** pela interface e guarda o resultado na timeline. "Sem M1 visceral nos exames apresentados" ≠ M0. (b) `requiredBiomarkers({tumor, histologia, estadio})` como **tabela de dados** (não LLM) lida de arquivo; conteúdo inicial só para CPNPC adeno IV (spec §9: PD-L1, EGFR, ALK, ROS1, BRAF, KRAS G12C, MET éx14, RET, NTRK, HER2) e mama (RE, RP, HER2, Ki-67, BRCA/PALB2 quando indicado) com fonte; demais tumores `[VERIFICAR]` em PEDIDOS.

## FUGU-12 · Fechamento + teste ponta a ponta
Teste E2E em `tests/w10-fugu/`: colar o texto sintético do Modelo 10 (PT10) → segmentos → fatos → reconciliação → caixa de revisão com as exceções esperadas (INTERVAL_PROGRESSION L5, NÃO SEI de histologia/TNM/RE-RP-HER2) → timeline. Outro: transcrição "maratona" de 3 pacientes com "creatinina quatorze" ⇒ requiresConfirmation. Relatório `docs/progresso/W10-FUGU.md` conforme W10-COMUM, com lista de PEDIDOS (contratos, eventos de ledger, patches para `src/modules`).
