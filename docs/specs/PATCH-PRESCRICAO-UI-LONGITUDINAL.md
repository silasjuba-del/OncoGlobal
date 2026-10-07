# PATCH DO PROMPT MESTRE · Prescrição real + UI clínica longitudinal

> Fonte: Dr. Silas, 2026-10-06 (DECISAO_MEDICA). Registrado como D-W9-24. Alvo: onda W10 (contratos novos escritos pelo tech lead antes da onda).
> A seção final "Reconciliação" diz como cada ponto se encaixa nas decisões já tomadas. Onde houver conflito, a decisão anterior vale até o Dr. Silas dizer o contrário.

## Princípio-mestre
Três fontes governam o produto e não se confundem:
1. **Workflow real do médico** → ordem, atalhos, abreviações, defaults, componentes visíveis, nº de cliques.
2. **Requisitos clínicos e de segurança** → validações, dependências farmacológicas, alertas, cálculo, monitorização.
3. **Requisitos regulatórios/institucionais** → campos obrigatórios, modelos oficiais, assinatura, identificação, retenção, impressão.

`O MÉDICO DEFINE O WORKFLOW. A REGULAÇÃO DEFINE O DOCUMENTO. O PROTOCOLO DEFINE AS DEPENDÊNCIAS CLÍNICAS. A IA NÃO DEFINE A CONDUTA.`
Nunca remover requisito regulatório ou de segurança só porque não aparece nas notas do médico.

## 1. Quatro camadas (receita não é um formulário)
`ClinicalOrder → MedicationOrder[] → ValidationEngine → PrescriptionRenderer`

**ClinicalOrder** (o ato médico): patientId, encounterId, cancerEpisodeId?, orderType (`OUTPATIENT_ORAL | SUPPORTIVE | ANTINEOPLASTIC | INFUSION | HYDRATION | CONTROLLED`), indication?, protocolId?, protocolVersion?, cycle?, day?, authoredBy, authoredAt, status (`DRAFT | SIGNED | CANCELLED`). **Assinada é imutável**; correção = nova versão, nunca alteração silenciosa.

**MedicationOrder** (uma por medicamento): medicationId?, genericName, pharmaceuticalForm?, concentration?, route, dose {value?, unit?, **expression?**, basis? `FIXED | MG_KG | MG_M2 | AUC | OTHER`}, frequency?, schedule?, prn, prnIndication?, minimumInterval?, maximumDailyDose?, duration?, dispenseQuantity? {value, unit}, patientInstructions?, indication?.
`dose.expression` preserva a escrita real do médico (`1 CP VO 8/8H SE NÁUSEA`, `500 MG VO 12/12H POR 7 DIAS`, `8 MG VO 8/8H SE NÁUSEA — MÁX 24 MG/DIA`).

## 2. Modo rápido (default)
Entrada principal é uma linha: `ONDANSETRONA 8 MG VO 8/8H SE NÁUSEA` → parser: nome, dose, via, frequência, PRN, indicação. A estrutura aparece discreta; o médico corrige qualquer componente. **Texto rápido primeiro → estrutura automática depois.** Uma linha nunca vira oito cliques.

## 3. Tipo de documento pela classificação regulatória
`PrescriptionDocumentType = SIMPLE | ANTIMICROBIAL | SPECIAL_CONTROL | NOTIFICATION_A | NOTIFICATION_B | NOTIFICATION_B2 | RETINOID | THALIDOMIDE | INSTITUTIONAL`.
`Medication → RegulatoryClassifier → PrescriptionDocumentType → Renderer`. Classificação em **tabela regulatória versionada**, nunca dentro de componente React. Layout oficial obrigatório não é redesenhado.

## 4. Prescrição antineoplásica (entidade própria)
**AntineoplasticOrder**: patientId, cancerEpisodeId, protocolId, protocolVersion, intent (`NEOADJUVANT | ADJUVANT | CURATIVE | PALLIATIVE | MAINTENANCE | CONCURRENT`), line?, cycle, day, bodyMetrics {weightKg?, heightCm?, bsaM2?, measuredAt?, sourceEvidenceId?}, drugs[].
**AntineoplasticDrugOrder**: genericName, prescribedDose, calculation? {basis, sourceValue?, calculatedDose?}, doseAdjustment? {percent?, reason?}, route, diluent?, finalVolume?, infusionTime?, sequence?.
Não reutilizar o campo genérico de receita EV para QT.

## 5. Validação dependente da droga/protocolo
Proibido bloqueio universal "peso + renal + hepática + acesso" para toda EV. Cada protocolo/medicamento declara **ValidationRequirement**: requiresWeight, requiresHeight, requiresBSA, renal/hepatic/hematologic/cardiacRequirement?, maximumDataAgeDays?.
SafetyEngine avalia só o pertinente → `PASS | WARNING | BLOCK | NOT_EVALUABLE`. **NOT_EVALUABLE ≠ contraindicação**; ausência de dado não vira "não liberar".

## 6. Memória longitudinal antes de perguntar
Consultar o histórico antes de pedir de novo. Mostrar `Peso atual: 73 kg · Fonte: consulta 02/09/2026 · Idade do dado: 1 dia`, nunca só `Peso: 73 kg`.
**ClinicalValue** {value, measuredAt?, sourceType `DOCUMENT | PHOTO | PLAUD | CHAT | MANUAL`, sourceEvidenceId, confidence}. Dado antigo não é dado atual.

## 7. Protocolo ≠ prescrição
`ProtocolTemplate → (instantiate) TreatmentOrder → (revisão médica) SignedPrescription`. Template versionado; mudar o template não altera prescrição histórica.

## 8. Diluição, compatibilidade, infusão
Diluente, volume/concentração final, compatibilidade, estabilidade, sequência e velocidade vêm do ProtocolTemplate validado. Override: **ALTERAR PADRÃO → motivo obrigatório → usuário/data registrados** (audit trail).

## 9. Suporte / pós-QT (fluxo separado)
Atalhos: ANTIEMÉTICO, ANALGÉSICO, CONSTIPAÇÃO, DIARREIA, MUCOSITE, PROTEÇÃO GÁSTRICA, CORTICOIDE, FATOR DE CRESCIMENTO, OUTRO. São atalhos de UI, não sugestão clínica. A IA organiza a prescrição já decidida; **não insere medicamento novo** na receita assinável.

## 10. Limites da IA
Pode: extrair, estruturar, reconciliar, detectar duplicidade, recuperar dados prévios, calcular quando autorizado, verificar consistência, apontar pendências, gerar documento a partir da decisão médica.
Não pode: escolher protocolo, adicionar antineoplásico, alterar/remover dose ou medicamento, converter sugestão em ordem, assinar, promover `INFERRED` a `DOCUMENT_CONFIRMED`.
`MÉDICO DECIDE → SISTEMA ESTRUTURA → SAFETYENGINE VERIFICA → MÉDICO REVISA → SISTEMA GERA.`

## 11. UX
Nº de campos do banco ≠ nº de campos visíveis. O resto é parseado, herdado, recuperado, calculado, vindo do protocolo ou pedido só quando necessário.
`MÉDICO REVISA. IA FAZ O BUROCRÁTICO. MÉDICO DÁ POUCOS CLIQUES.`

---

## Reconciliação com as decisões (tech lead)
| Ponto do patch | Encaixe |
|---|---|
| SafetyEngine `BLOCK` | Vale como **bloqueio do artefato** (não emite/imprime a ordem), nunca do clínico nem da consulta (regra "app alerta, não bloqueia"; D-W9-22d). Para QT, BLOCK só nos limiares de **bula** declarados no protocolo (D-W9-22a). |
| `NOT_EVALUABLE` | = PENDENTE (Ausente = PENDENTE, nunca VERDE). |
| `calcular quando autorizado` | Cálculo de dose é **código** (FN-04, `calcularDose`), nunca LLM (G-10). |
| `doseAdjustment.percent` livre | Hoje a redução é pelos botões −20/−30/−40 sobre a dose anterior (Q29). Percentual livre = decisão pendente do Dr. Silas. |
| `intent` | É a intenção clínica; a **finalidade APAC** é campo separado escolhido pelo médico (D-W9-12). |
| ProtocolTemplate | = biblioteca de fichas (K-26) a partir de `docs/referencias/protocolos/` com D-W9-23 (5-FU 46 h, Mayo, antiemese local). Identidade = tumor + nome + cenário + versão (D-W9-22b). |
| Tabela regulatória (receita B, C, antimicrobiano…) | Nova, versionada, `[VERIFICAR]` (Portaria SVS/MS 344/98 e RDC 471/2021 a confirmar); fica no corpus, não no React. |
| ClinicalValue / idade do dado | Reaproveita proveniência existente (EXTRACTED, DOCUMENT_CONFIRMED, INFERRED, NOT_FOUND, UNCERTAIN) + `measuredAt`. "RAG-HBEM" = memória longitudinal local do paciente (não sai do PC). |
| Contratos | Entidades novas = contratos novos em `src/contracts` escritos pelo tech lead antes da W10 (congelamento mantido para o resto). |

---
## Adendo (Dr. Silas, 2026-10-06) · Prescrição nasce do protocolo versionado — D-W9-45
`Paciente → tumor → protocolo → ciclo/dia → template → dados atuais → cálculo → SafetyEngine → alterações do médico → prescrição.`
Ao escolher o protocolo (ex.: FOLFOX), o sistema já traz sequência, drogas, doses de referência, base (mg/m²…), diluentes, volumes, tempos, suporte e dependências laboratoriais. O médico confere **"o que mudou neste ciclo?"**.

```
PrescriptionItem {
  drug
  role              // PREMED | ANTINEOPLASTIC | HYDRATION | SUPPORT
  sequence
  standardDose
  doseBasis         // FIXED | MG_KG | MG_M2 | AUC
  calculatedDose
  prescribedDose
  adjustmentPercent // só −20 | −30 | −40 (D-W9-26)
  adjustmentReason
  route
  diluent
  finalVolume
  infusionTime
  source            // PROTOCOL | MANUAL
}
```
A UI não mostra todos os campos: destaca **só as exceções** (o que difere do protocolo ou do ciclo anterior).

**Três produtos distintos** (nada de "Receita EV" genérica para QT):
1. **Prescrição antineoplásica** — protocolizada, orientada a ciclo (layout do Modelo 05).
2. **Receita pós-QT/VO** — entrada rápida de uma linha (`ONDANSETRONA 8 MG VO 8/8H SN NÁUSEA`).
3. **Prescrição EV avulsa** — hidratação, eletrólitos, ferro etc.

**Foto da prescrição no sentido inverso:** `FOTO → identificar paciente (caixa de revisão, D-W9-34a) → identificar protocolo/ciclo → extrair linhas → reconciliar com o template → detectar alterações manuais → guardar no RAG-HBEM (memória longitudinal local)`. Prescrições antigas fotografadas ensinam o formato real; OCR/transcrição **nunca vira verdade clínica automaticamente** (evidência com proveniência, confirmação médica).

**Regra de UX no topo do ticket:** não perguntar de novo o que o protocolo ou o RAG-HBEM já sabe; mostrar principalmente o que mudou neste ciclo.

### Classes de medicação (Dr. Silas, 2026-10-06) — D-W9-47
| Classe | O que é | `role` |
|---|---|---|
| **PRÉ-QT** | pré-medicação e hidratação antes da QT (antiemético, corticoide, anti-H1/H2, SF com Mg/K) | `PRE_QT` |
| **QT** | medicações **oncológicas** (antineoplásicos, anti-HER2, imunoterapia, alvo, hormonioterapia) | `QT` |
| **PÓS-QT** | suporte após a QT (receita pós-QT/VO, hidratação pós, fator de crescimento) | `POS_QT` |
| **NÃO ONCOLÓGICAS** | uso contínuo de doenças de base (HAS, DM-2, DPOC…) | `NAO_ONCOLOGICA` |
Substitui PREMED/ANTINEOPLASTIC/HYDRATION/SUPPORT. Hidratação entra em PRÉ-QT ou PÓS-QT conforme o momento (Modelo 05: Intervalo PRE-QT/QT/POS-QT).
As **não oncológicas** formam a lista de medicamentos em uso do paciente: alimentam o semáforo de interações (FN-16; lista incompleta = PENDENTE), a regra "diarreia > 24 h → suspender anti-hipertensivo" (D-W9-28) e o alerta de hiperglicemia por corticoide em DM-2. O app não prescreve nem altera essas medicações sozinho.
