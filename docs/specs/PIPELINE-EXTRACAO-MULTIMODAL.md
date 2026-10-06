# Pipeline de extração multimodal (oncoMed/OncoGlobal)

> Fonte: Dr. Silas, 2026-10-06 (DECISAO_MEDICA) — D-W9-33. Alvo: W10 (caixa única D-W9-18, extração → caixas, D-W9-19). Reconciliação com decisões vigentes no fim.

## Fluxo
```
ENTRADAS: texto médico · enfermagem · prescrição · AP/IHQ · imagem/laudo · Plaud
 1 SEGMENTAÇÃO → 2 IDENTIFICAÇÃO DO PACIENTE → 3 FATOS ATÔMICOS → 4 NORMALIZAÇÃO
 → 5 RECONCILIAÇÃO MULTIFONTE → 6 VALIDAÇÃO ANTI-ALUCINAÇÃO → 7 CONFLITOS/PENDÊNCIAS
 → 8 TIMELINE LONGITUDINAL → 9 CONFIRMAÇÃO MÉDICA SÓ DAS EXCEÇÕES
```
Módulos: **Segmenter · PatientResolver · ClinicalFactExtractor · ReconciliationEngine** + transversal **SafetyValidator** (impede promover INFERRED/UNCERTAIN a confirmado sem regra documental ou clique médico).
`IA EXTRAI TUDO. CÓDIGO RECONCILIA. MÉDICO SÓ RESOLVE EXCEÇÕES.`

## 1. Segmentação (gravação ≠ paciente)
`EncounterSegment {recordingId, startMs, endMs, speakers[], candidateNames[], rawTranscript, boundaryConfidence}`.
Nova fronteira pela combinação de: novo nome chamado; mudança de idade/sexo; mudança de tumor; saudação de nova consulta; troca de acompanhante; novo conjunto de exames; silêncio prolongado + chamada. **Fronteira duvidosa não faz merge automático.**

## 2. Reconhecimento do paciente
`score = nome·0,35 + idade·0,10 + sexo·0,05 + tumor·0,15 + lateralidade·0,10 + protocolo·0,10 + marcador·0,05 + datas/eventos·0,10`
≥0,90 AUTO_MERGE · 0,75–0,89 REVIEW · <0,75 NEW/UNKNOWN. Forte: "Maria Isabel" + TNBC + mama direita + carbo-taxol C4. Fraco: "Dona Maria" + taxano → não identifica.
Saída analítica: `patientKey: "P005"`, `displayName` abreviado.

## 3. Fatos atômicos (nunca "resuma o caso")
`ClinicalFact {patientCandidateId, domain (diagnosis|histology|stage|biomarker|metastasis|drug|regimen|cycle|symptom|toxicity|lab|imaging|procedure|plan), value, sourceType (pathology|imaging_report|prescription|medical_note|nursing|plaud), evidence (EXPLICIT|DERIVED|INFERRED|UNCERTAIN), date?, rawEvidence, confidence}`.
"dormência nas mãos e pés" → symptom EXPLICIT + toxicity "neuropatia periférica provável" DERIVED; **CTCAE vazio** (grau é do médico/código).

## 4. Hierarquia de evidência por domínio
- Histologia: AP > IHQ > evolução > Plaud > enfermagem
- Dose/protocolo/ciclo: prescrição > administração (enfermagem QT) > evolução > Plaud
- Sintoma: fala do paciente/Plaud ≈ enfermagem específica > evolução genérica
- Estadiamento: AP + imagem > evolução estruturada > CID
- Tratamento realizado: administração > prescrição > plano > fala
"retiro carbo" × prescrição com carboplatina → `CONFLICT planned_regimen != ordered_regimen`; nunca escolher em silêncio.

## 5. Invariantes anti-alucinação
1. Ausência ≠ negativo (HER2 ausente = null, nunca "negative").
2. Inferência não vira fato (linfonodo 24 mm ≠ N2; dor + oxaliplatina ≠ neuropatia G2; PSA baixo ≠ remissão).
3. Preservar a frase original: `rawEvidence`, `sourceId`, timestamp/página; o médico clica e vê a origem.
4. Número falado exige confirmação (dose, creatinina, Hb, PSA, CEA, dimensão, data, ciclo): "creatinina quatorze" = 14 ou 1,4 → `confidence < 0,7`, `requiresConfirmation = true`.
5. Medicamento foneticamente incerto: guardar `raw` + `normalized` + INFERRED + confidence (ex.: "letrum" → possível Lectrum, 0,72).
6. Validação temporal: evento que exige diagnóstico antes da data do diagnóstico → `TEMPORAL_CONFLICT` (ex.: PET 02/25 × diagnóstico 11/25).
7. TNM é histórico imutável: `stageHistory[]` (clínico, pós-tratamento…); `historicalMetastaticDisease = true` nunca volta a false.

## 6. Escopo do Plaud
Fonte boa para: sintomas, toxicidade percebida, adesão, ECOG funcional, barreiras, racional terapêutico, decisão compartilhada, plano verbalizado.
Não é fonte primária de: histologia, TNM, dose, IHQ, nome exato de fármaco, medidas radiológicas — salvo se não houver fonte documental.

## 7. Reconciliation Engine
Cada campo vira candidatos + resolvido + flag de conflito. Ex.: `stage {candidates:[T2N0M0 (nota), M1b óssea (RM)], resolved: metastatic, conflict: true}`; `therapy {proposed:[carbo, docetaxel], ordered:[docetaxel], administered:[docetaxel], status: ACTIVE}`.

## 8. Estrutura longitudinal
`Patient {demographics, diagnoses[], pathology[], biomarkers[], stageHistory[], metastaticSites[], treatments[]{regimen, intent, line, proposedAt, orderedAt, administeredAt, cycle, status}, encounters[]{symptoms[], toxicity[], labs[], imaging[], plan[]}, unresolvedConflicts[], missingRequiredData[]}`.

## 9. Biomarker Requirement Engine (código, não LLM)
`requiredBiomarkers({tumor, histology, stage})` → ex. CPNPC adenocarcinoma IV: PD-L1, EGFR, ALK, ROS1, BRAF, KRAS G12C, MET éxon 14, RET, NTRK, HER2. Tabela por doença versionada, curada pelo Dr. Silas.

## 10. Saída ao médico
"✓ 47 fatos reconciliados automaticamente · ⚠ 4 precisam confirmação: cisplatina × carboplatina; PET 02/25 × diagnóstico 11/25; cN2 sem comprovação; 'prednisona 10 mg por hora'".

---
## Reconciliação com decisões vigentes (tech lead)
| Ponto | Encaixe / `[VERIFICAR]` |
|---|---|
| AUTO_MERGE por score com nome 0,35 | Q13/D-W9-22c: identidade vem do cadastro, nunca só do nome. Proposta: AUTO_MERGE só liga fatos ao paciente **da consulta aberta** (cadastro já escolhido); fora disso o teto é REVIEW. `[VERIFICAR]` |
| Plaud com nomes | A8: a transcrição chega desidentificada; o matching usa idade/tumor/lateralidade/protocolo/datas + a consulta aberta. |
| `displayName` abreviado | Continua PHI: só local, nunca em payload de LLM (G-02). |
| EXPLICIT/DERIVED/INFERRED/UNCERTAIN | Mapeia na proveniência existente: EXPLICIT→EXTRACTED, confirmado pelo médico→DOCUMENT_CONFIRMED, DERIVED e INFERRED→INFERRED (com regra), UNCERTAIN→UNCERTAIN, ausente→NOT_FOUND. |
| CTCAE vazio na extração | = Q45/D-W9-22a: grau calculado por código a partir de sintoma+basal, confirmado pelo médico. |
| stageHistory imutável | = A3 (avaliações coexistem) e D-W9-07 (pTNM só com peça). |
| Lateralidade no score | = D-W9-05 (G-07). |
| Biomarker engine | Novo; tabela `[VERIFICAR]` por tumor (curadoria). |
| SafetyValidator | = invariantes "IA propõe, código calcula, médico decide" e G-05 (VERDE honesto). |

---
## Anexo A · Árvore do paciente (Dr. Silas, 2026-10-06) — modelo-alvo da projeção longitudinal
```
PATIENT
 ├─ identity_key / pseudonymous_id
 ├─ demographics
 ├─ ONCOLOGY
 │   ├─ primary_site + laterality + subsite
 │   ├─ histology + grade
 │   ├─ biomarkers[]
 │   ├─ stage_history[]  (clinical | pathological | post-treatment | metastatic_history)
 │   └─ metastases[]
 ├─ TREATMENT_TIMELINE[]
 │   ├─ intent · line · regimen · drugs[] · cycle/day
 │   └─ status: proposed | ordered | administered | held | stopped
 ├─ CURRENT_ENCOUNTER
 │   ├─ symptoms[] · toxicity[] + CTCAE_if_confirmed · ECOG: explicit | inferred
 │   ├─ labs[] · imaging[] · assessment
 │   └─ plan/actions[]
 ├─ SOURCE_EVIDENCE[]  (medical_note | nursing | pathology | imaging_document | prescription | plaud_transcript)
 └─ RECONCILIATION
     ├─ confirmed_facts[] · inferred_facts[] · conflicts[] · missing[]
     └─ clinician_confirmation_required[]
```
Notas do tech lead: `identity_key` aponta para o cadastro (Q13), `pseudonymous_id` é o que circula fora do cofre local (G-02). `status` do tratamento tem 5 valores — é estado de **entidade de tratamento**, não semáforo (o teto de 5 estados da UI continua). `CTCAE_if_confirmed` = grau só após confirmação médica (Q45). `ECOG inferred` nunca vira explicit sem clique (SafetyValidator). Mapeia na projeção atual em `src/kernel/projections` — alinhamento de tipos é a fatia GROK-08.
