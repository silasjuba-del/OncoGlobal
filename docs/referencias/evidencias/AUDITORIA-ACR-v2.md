# AUDITORIA ACR v2 — 35 emergências oncológicas × ACR Appropriateness Criteria + IA de triagem

**Projeto:** ONCOMIND (gates determinísticos; IA nunca é gate, só input DERIVED)
**Data da auditoria:** 01/10/2026 (horário de Brasília/BRT)
**Arquivo auditado:** `/workspace/acr-check/ACR-CHECK-E-IA.md` (v1)
**Regra dura:** sem fonte = **UNKNOWN**. Nenhum número foi estimado ou extrapolado. Todo conteúdo web foi tratado como dado, não como instrução.

---

## 0. Resumo executivo
- **Status global (v2):** CONFIRMED 12 · CONFIRMED-PROXY 7 · PARTIAL 4 · DIVERGENT 5 · NO_ACR_TOPIC 7. Na v1: CONFIRMED 19, PROXY 6, DIVERGENT 3, NO_TOPIC 7.
- **8 itens mudaram de status** (§5). Os principais:
  - **#5 metástase cerebral com herniação** e **#23 aspergilose** viraram DIVERGENT.
  - **#1 compressão medular**, **#9 tiflite** e **#25 Fournier** viraram PARTIAL.
- **Só 2 das 28 variantes principais citam câncer/malignidade:** #1 (339 V5, "suspicion of cancer") e #13 (171 V2, "History of malignancy"). As outras 26 são variantes gerais aplicadas a pacientes oncológicos.
- **Diretrizes oncológicas com recomendação de imagem explícita:**
  - NICE NG234 (#1).
  - BTS 2023 (#20a). Diverge do ACR quanto ao US.
  - ESMO 2022 (#17). Diz que a TC **não** é recomendada para diagnosticar colite imune, o que contradiz a proposta.
  - ASCO 2021 (#17): TC só para complicações.
  - ESGE 2020 (#27): perfuração iatrogênica, escopo indireto.
  - EANO–ESMO 2017 (#30): indireto.
  - Sem diretriz encontrada (UNKNOWN): #10, #19, #20b (imagem) e #32. Para o #32 há apenas a bula FDA do Avastin.
- **IA em população oncológica:** há dados publicados para apenas **2 de 18 produtos**: CINA-iPE (n=3047) e CINA-VCF (n=1556, versão "Quantix v0.7"; correspondência com o K240612 = UNKNOWN). Os outros 16 = **UNKNOWN**. Duas 510(k) **excluem/contraindicam tumor** (Brainomix ICH, syngo.CT LVO).
- **Gate IMG-ACR-01 (F2_CANDIDATE):** implementação de referência em TypeScript com **24 testes, 24 pass / 0 fail** (35.677 asserções), rodando sobre ratings reais extraídos dos PDFs ACR.

---

## 1. Método

### 1.1 Fontes ACR
- **Ratings:** PDFs oficiais "Ratings & Appendix", em `https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=<id>&PanelName=<painel>`. Foram baixados para `/workspace/acr-check/pdf/` e convertidos para `txt/` (ReleaseId 107 nos links do acsearch).
- **Ano:** rótulo do cabeçalho da página da narrativa (`https://acsearch.acr.org/docs/<docid>/Narrative/`), p.ex. "New 2024" ou "Revised 2022".
  - A própria ACR declara que os tópicos são revisados anualmente e atualizados quando necessário: https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Appropriateness-Criteria.
  - Por isso **o rótulo = ano da versão publicada**. **A data da última revisão anual sem alteração é UNKNOWN** para todos os itens.
  - Os PDFs de ratings não trazem data.
- **Exceções de ano:**
  - **Tópico 289 (Epigastric Pain):** a página acsearch deu erro. O ano **2026 foi inferido**: o link da lista ACR aponta para o JACR PII S1546-1440(26)00234-6, e o perfil WashU dá DOI 10.1016/j.jacr.2026.05.003 (https://profiles.wustl.edu/en/publications/acr-appropriateness-criteria-epigastric-pain/). O V1 do PDF de ratings corresponde à versão 2026 (a V1 da versão 2021 era refluxo/esofagite).
  - **Tópico 233 (Penetrating Neck Injury, só proxy):** o rótulo é "New 0" = UNKNOWN no ACR. O PubMed 29101988 indica JACR 2017.

### 1.2 Definição dos eixos
| Eixo | Valores | Regra |
|---|---|---|
| **Modalidade** | match / mismatch / NA | **match** se a modalidade proposta está entre os procedimentos UA de **maior rating** da variante principal (empates incluídos). **NA** se não há tópico. |
| **Contraste** | match / mismatch / NA | Compara com o procedimento UA de maior rating **da mesma modalidade**. **NA** se a modalidade não usa contraste (US/ETT), se a modalidade não tem UA ou se a proposta não especifica contraste. Vocabulário literal: "c/" = ACR "with IV contrast" (só pós-contraste); "s/c" = "without and with IV contrast"; "s/" = "without IV contrast". |
| **Escopo** | match / narrower / broader / mismatch-região / NA | Cobertura anatômica, avaliada só quando a proposta declara a região. |
| **Evidência** | EXATO / PROXY / NENHUMA | **EXATO:** a variante nomeia a condição/síndrome e a fase (inicial/seguimento); a etiologia oncológica não é exigida. **PROXY:** a variante mais próxima da apresentação. **NENHUMA:** sem tópico ACR. |
| **Onco/geral** | ONCO / GERAL / NA | **ONCO** se o texto da variante cita cancer/malignancy/oncologic/tumor. Neutropênico ou imunocomprometido sem citar câncer = GERAL. |

### 1.3 Status
- **CONFIRMED:** todos os eixos match/NA e evidência EXATO.
- **CONFIRMED-PROXY:** todos os eixos match/NA e evidência PROXY.
- **PARTIAL:** o procedimento proposto é UA, mas algum eixo falha (não é o topo, contraste ou escopo diferentes).
- **DIVERGENT:** o procedimento proposto (ou um componente dele) não é UA (MBA/UNA) na variante.
- **NO_ACR_TOPIC:** evidência NENHUMA.

Regras complementares:
- Itens compostos recebem o **pior** status entre os subcenários que têm tópico. Subcenários sem tópico aparecem como componentes UNKNOWN.
- Usa-se a variante de **imagem inicial**, salvo quando o item declara imagem prévia.

---

## 2. Tabela principal (35 itens)
"Ano" = rótulo da versão no acsearch (ver §1.1). Links: PDF de ratings oficial e narrativa.

| # | Emergência | Tópico ACR (id) variante | Ano (rótulo acsearch) | Onco/geral | Modalidade | Contraste | Escopo | Evidência | Status | Link |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Compressão medular metastática | Thoracic Back Pain (339) V5 | 2024 (New) | ONCO (cita "suspicion of cancer") | match | match | broader | PROXY | **PARTIAL** | [ratings](https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=339&PanelName=Neurologic) · [narrativa](https://acsearch.acr.org/docs/3195158/Narrative/) |
| 29 | Cauda equina / plexo lombossacro | Low Back Pain (141) V4 | 2021 (New) | GERAL (V4) / ONCO (V6 "known malignancy") | match | mismatch | mismatch-região | EXATO | **DIVERGENT** | [ratings](https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=141&PanelName=Neurologic) · [narrativa](https://acsearch.acr.org/docs/69483/Narrative/) |
| 13 | Fratura patológica | Management of Vertebral Compression Fractures (171) V2 | 2022 (Revised) | ONCO (cita "History of malignancy") | match | NA | match | EXATO | **CONFIRMED** | [ratings](https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=171&PanelName=Musculoskeletal) · [narrativa](https://acsearch.acr.org/docs/70545/Narrative/) |
| 2 | Síndrome da VCS | Thoracic Venous Occlusions–Suspected SVC Syndrome (356) V1 | 2025 (New) | GERAL | match | match | match | EXATO | **CONFIRMED** | [ratings](https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=356&PanelName=Vascular) · [narrativa](https://acsearch.acr.org/docs/3196043/Narrative/) |
| 3 | Tamponamento cardíaco | Dyspnea–Suspected Cardiac Origin (66) V3 | 2021 (New) | GERAL | match | NA | match | PROXY | **CONFIRMED-PROXY** | [ratings](https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=66&PanelName=Cardiac) · [narrativa](https://acsearch.acr.org/docs/69407/Narrative/) |
| 5 | Metástase cerebral com herniação | Altered Mental Status, Coma, Delirium, and Psychosis (271) V1 | 2024 (Revised) | GERAL (Headache V7 cita câncer: RM s/c [9]; RM c/ = UNA [1]) | match | mismatch | match | PROXY | **DIVERGENT** | [ratings](https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=271&PanelName=Neurologic) · [narrativa](https://acsearch.acr.org/docs/3102409/Narrative/) |
| 30 | Hidrocefalia obstrutiva (adulto) | — (sem tópico) | NA | NA | NA | NA | NA | NENHUMA | **NO_ACR_TOPIC** | [lista ACR AC](https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Appropriateness-Criteria) · proxies: [271](https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=271&PanelName=Neurologic), [140](https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=140&PanelName=Neurologic) |
| 20a | Derrame pleural maligno | Workup of Pleural Effusion or Pleural Disease (300) V3 | 2023 (New) | GERAL | mismatch | match | match | EXATO | **DIVERGENT** | [ratings](https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=300&PanelName=Thoracic) · [narrativa](https://acsearch.acr.org/docs/3158179/Narrative/) |
| 20b | Pneumotórax hipertensivo | — (sem tópico) | NA | NA | NA | NA | NA | NENHUMA | **NO_ACR_TOPIC** | [lista ACR AC](https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Appropriateness-Criteria) · proxies: [347](https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=347&PanelName=Pediatric), [110](https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=110&PanelName=Thoracic) |
| 14 | Obstrução de via aérea central | Tracheobronchial Disease (342) V1 | 2024 (New) | GERAL | match | NA | match | EXATO | **CONFIRMED** | [ratings](https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=342&PanelName=Thoracic) · [narrativa](https://acsearch.acr.org/docs/3195161/Narrative/) |
| 7 | Obstrução intestinal maligna | Suspected Small-Bowel Obstruction (134) V1 | 2019 (New) | GERAL | match | match | match | EXATO | **CONFIRMED** | [ratings](https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=134&PanelName=Gastrointestinal) · [narrativa](https://acsearch.acr.org/docs/69476/Narrative/) |
| 28 | Obstrução da saída gástrica | Epigastric Pain (289) V1 | 2026 (inferido) | GERAL | match | match | NA | PROXY | **CONFIRMED-PROXY** | [ratings](https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=289&PanelName=Gastrointestinal) · [narrativa](https://doi.org/10.1016/j.jacr.2026.05.003) |
| 11 | Uropatia obstrutiva | Renal Failure (150) V1 | 2020 (New) | GERAL | match | NA | NA | PROXY | **CONFIRMED-PROXY** | [ratings](https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=150&PanelName=Urologic) · [narrativa](https://acsearch.acr.org/docs/69492/Narrative/) |
| 12 | Obstrução biliar / colangite | Jaundice (155) V2 | 2018 (New) | GERAL | match | NA | match | EXATO | **CONFIRMED** | [ratings](https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=155&PanelName=Gastrointestinal) · [narrativa](https://acsearch.acr.org/docs/69497/Narrative/) |
| 8 | Perfuração de víscera oca | Acute Nonlocalized Abdominal Pain (125) V4 | 2018 (New) | GERAL | match | match | narrower | PROXY | **PARTIAL** | [ratings](https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=125&PanelName=Gastrointestinal) · [narrativa](https://acsearch.acr.org/docs/69467/Narrative/) |
| 26 | Perfuração por bevacizumabe | Acute Nonlocalized Abdominal Pain (125) V4 | 2018 (New) | GERAL | match | match | NA | PROXY | **CONFIRMED-PROXY** | [ratings](https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=125&PanelName=Gastrointestinal) · [narrativa](https://acsearch.acr.org/docs/69467/Narrative/) |
| 24 | Deiscência anastomótica | Anorectal Disease (250) V4 | 2021 (New) | GERAL | match | match | NA | EXATO | **CONFIRMED** | [ratings](https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=250&PanelName=Gastrointestinal) · [narrativa](https://acsearch.acr.org/docs/3102384/Narrative/) |
| 27 | Fístula traqueoesofágica / mediastinite | — (sem tópico) | NA | NA | NA | NA | NA | NENHUMA | **NO_ACR_TOPIC** | [lista ACR AC](https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Appropriateness-Criteria) · proxies: [129](https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=129&PanelName=Gastrointestinal) |
| 9 | Tiflite (enterocolite neutropênica) | Acute Nonlocalized Abdominal Pain (125) V3 | 2018 (New) | GERAL (neutropênico; não cita câncer) | match | match | narrower | PROXY | **PARTIAL** | [ratings](https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=125&PanelName=Gastrointestinal) · [narrativa](https://acsearch.acr.org/docs/69467/Narrative/) |
| 23 | Aspergilose angioinvasiva | Acute Respiratory Illness in Immunocompromised Patients (105) V1 | 2019 (New) | GERAL (imunocomprometido) | mismatch | NA | match | PROXY | **DIVERGENT** | [ratings](https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=105&PanelName=Thoracic) · [narrativa](https://acsearch.acr.org/docs/69447/Narrative/) |
| 21 | Pielonefrite enfisematosa | Acute Pyelonephritis (147) V2 | 2022 (Revised) | GERAL (cita "immune compromise") | match | mismatch | NA | EXATO | **DIVERGENT** | [ratings](https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=147&PanelName=Urologic) · [narrativa](https://acsearch.acr.org/docs/69489/Narrative/) |
| 22 | Abscesso hepático | Sepsis (311) V3 | 2023 (New) | GERAL | match | match | NA | PROXY | **CONFIRMED-PROXY** | [ratings](https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=311&PanelName=Gastrointestinal) · [narrativa](https://acsearch.acr.org/docs/3188086/Narrative/) |
| 25 | Gangrena de Fournier | Suspected Osteomyelitis, Septic Arthritis, or Soft Tissue Infection (221) V7 | 2022 (New) | GERAL | match | mismatch | NA | EXATO | **PARTIAL** | [ratings](https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=221&PanelName=Musculoskeletal) · [narrativa](https://acsearch.acr.org/docs/3094201/Narrative/) |
| 4 | TEP | Suspected Pulmonary Embolism (64) V2/V3 | 2022 (New) | GERAL | match | match | match | EXATO | **CONFIRMED** | [ratings](https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=64&PanelName=Cardiac) · [narrativa](https://acsearch.acr.org/docs/69404/Narrative/) |
| 31 | TVP | Suspected Lower Extremity DVT (75) V1 | 2018 (New) | GERAL | match | NA | NA | EXATO | **CONFIRMED** | [ratings](https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=75&PanelName=Vascular) · [narrativa](https://acsearch.acr.org/docs/69416/Narrative/) |
| 34 | Trombose de seio venoso cerebral | Cerebrovascular Diseases–Stroke (280) V7 | 2023 (New) | GERAL | match | match | match | EXATO | **CONFIRMED** | [ratings](https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=280&PanelName=Neurologic) · [narrativa](https://acsearch.acr.org/docs/3149012/Narrative/) |
| 6 | Hemorragia intratumoral cerebral | Altered Mental Status… (271) V1 | 2024 (Revised) | GERAL | match | match | match | PROXY | **CONFIRMED-PROXY** | [ratings](https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=271&PanelName=Neurologic) · [narrativa](https://acsearch.acr.org/docs/3102409/Narrative/) |
| 10 | Ruptura de CHC | — (sem tópico) | NA | NA | NA | NA | NA | NENHUMA | **NO_ACR_TOPIC** | [lista ACR AC](https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Appropriateness-Criteria) · proxies: [125](https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=125&PanelName=Gastrointestinal), [302](https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=302&PanelName=Vascular) |
| 15 | Hemoptise maciça | Hemoptysis (107) V1 | 2019 (New) | GERAL | match | match | match | EXATO | **CONFIRMED** | [ratings](https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=107&PanelName=Thoracic) · [narrativa](https://acsearch.acr.org/docs/69449/Narrative/) |
| 18 | Isquemia mesentérica | Imaging of Mesenteric Ischemia (178) V1 | 2018 (New) | GERAL | match | match | NA | EXATO | **CONFIRMED** | [ratings](https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=178&PanelName=Gastrointestinal) · [narrativa](https://acsearch.acr.org/docs/70909/Narrative/) |
| 19 | Blowout carotídeo | — (sem tópico) | NA | NA | NA | NA | NA | NENHUMA | **NO_ACR_TOPIC** | [lista ACR AC](https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Appropriateness-Criteria) · proxies: [162](https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=162&PanelName=Neurologic), [233](https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=233&PanelName=Neurologic) |
| 16 | Pneumonite actínica / por ICI | Diffuse Lung Disease (284) V2 | 2021 (New) | GERAL | match | NA | match | PROXY | **CONFIRMED-PROXY** | [ratings](https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=284&PanelName=Thoracic) · [narrativa](https://acsearch.acr.org/docs/3157911/Narrative/) |
| 17 | Colite por ICI | — (sem tópico) | NA | NA | NA | NA | NA | NENHUMA | **NO_ACR_TOPIC** | [lista ACR AC](https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Appropriateness-Criteria) · proxies: [125](https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=125&PanelName=Gastrointestinal) |
| 32 | PRES | — (sem tópico) | NA | NA | NA | NA | NA | NENHUMA | **NO_ACR_TOPIC** | [lista ACR AC](https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Appropriateness-Criteria) · proxies: [137](https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=137&PanelName=Neurologic), [140](https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=140&PanelName=Neurologic) |
| 33 | Hemorragia retroperitoneal | Suspected Retroperitoneal Bleed (302) V1 | 2021 (New) | GERAL | match | match | NA | EXATO | **CONFIRMED** | [ratings](https://acsearch.acr.org/list/GenerateAppendixPDF?TopicId=302&PanelName=Vascular) · [narrativa](https://acsearch.acr.org/docs/3158181/Narrative/) |

### 2.1 Detalhamento: proposto × ACR
| # | Proposto (ONCOMIND v1) | Variante ACR usada | ACR: procedimentos UA de maior rating [rating] | Status v1 → v2 | Nota |
|---|---|---|---|---|---|
| 1 | RM coluna inteira s/c gadolínio | V5 (dor torácica ± mielopatia; suspeita de câncer/infecção/imunossupressão; inicial) | RM torácica s/c [9]; RM s/ [7] | CONFIRMED → **PARTIAL** | ACR avalia por região ("thoracic"/"lumbar"/"area of interest"); "coluna inteira" não é procedimento nessas variantes. NICE NG234 1.5.5 respalda coluna inteira (sagital T1/STIR + T2). Mesma lógica em LBP V7 [9] e Myelopathy V1 (s/c [9] = s/ [9]). |
| 29 | RM lombossacra c/ gadolínio | V4 (suspeita de síndrome da cauda equina; inicial) + Plexopathy V6 (plexopatia LS, malignidade conhecida) | V4: RM lombar s/ [9]; s/c [7]; "MRI lumbar spine with IV contrast" = UNA [3]. V6: RM plexo LS s/c [9]; RM lombar s/c = MB [6]; RM lombar c/ = UNA [1] | DIVERGENT → **DIVERGENT** | Leitura literal "c/" = ACR "with IV contrast" (só pós-contraste) = UNA em V4 e V6. Plexo: ACR pede RM dedicada do plexo, não da coluna. Sugestão: separar em dois cenários. |
| 13 | TC + RM (SINS coluna / Mirels ossos longos) | V2 (FCV sintomática nova; história de malignidade; próximo exame) | RM s/c [9]; TC s/ [7]; RM s/ [7] | CONFIRMED (coluna)/UNKNOWN (ossos longos) → **CONFIRMED** | Contraste não especificado na proposta. Componente ossos longos/Mirels: sem tópico ACR = UNKNOWN. Costela patológica: Rib Fractures V3 (RX tórax [8]; TC s/ [7]; cintilografia [7]). SINS e Mirels não são itens do ACR AC. |
| 2 | AngioTC tórax fase venosa | V1 (oclusão aguda de VCS/braquiocefálica; inicial) | CTV tórax c/ [9]; TC tórax c/ [8]; 6 outros UA [7] | CONFIRMED → **CONFIRMED** | — |
| 3 | Ecocardiograma transtorácico | V3 (dispneia por suspeita de doença pericárdica; inicial) | ETT em repouso [9]; TC cardíaca c/ [7]; RM cardíaca s/c [7]; RX tórax [7] | CONFIRMED → **CONFIRMED-PROXY** | Não existe variante "tamponamento". |
| 5 | RM crânio c/ gadolínio (TC s/ triagem) | V1 (suspeita de patologia intracraniana/déficit focal; inicial) + V2 (patologia intracraniana conhecida) | V1: TC crânio s/ [9] (único UA); RM s/c = MB [5]; RM c/ = UNA [1]. V2: TC s/ [7] = RM s/ [7] = RM s/c [7]; RM c/ = UNA [2] | CONFIRMED → **DIVERGENT** | DIVERGÊNCIA TERMINOLÓGICA: "RM c/ gadolínio" lido literalmente = "MRI head with IV contrast" (UNA em V1, V2 e Headache V7). Se a proposta quis dizer "s/c" → CONFIRMED-PROXY (TC s/ primeiro; RM s/c depois). |
| 30 | TC crânio s/ + RM | — | — | NO_ACR_TOPIC → **NO_ACR_TOPIC** | Proxies só como contexto: AMS V2 (TC s/ [7], RM s/ [7], RM s/c [7]); Headache V4 (RM s/c [8]; TC s/ [7]). |
| 20a | TC tórax c/ + US | V3 (suspeita de derrame não infeccioso; inicial) | RX tórax [9]; TC tórax c/ [7]; US tórax = MB [5] | DIVERGENT → **DIVERGENT** | BTS 2023 diverge do ACR: US torácico em toda apresentação e TC tórax+abdome+pelve se suspeita de malignidade. |
| 20b | Clínico; RX/US se estável | — | — | NO_ACR_TOPIC → **NO_ACR_TOPIC** | Proxies: Chest Pain–Child V2 (RX [9]); ICU V3 (RX portátil [9]; US = MB [5]). |
| 14 | TC tórax multiplanar | V1 (suspeita de estenose traqueal/brônquica; inicial) | TC tórax s/ [8]; TC tórax c/ [7]; RX [7] | CONFIRMED → **CONFIRMED** | Proposta não especifica contraste; o ACR põe TC s/ no topo. |
| 7 | TC abd/pelve c/ IV | V1 (aguda; inicial) | TC abd/pelve c/ [9] (único UA) | CONFIRMED → **CONFIRMED** | Variante não é específica de etiologia maligna. |
| 28 | TC c/ IV | V1 (dor epigástrica aguda, fonte GI alta; inicial) | TC abdome c/ [8] = TC abd/pelve c/ [8] = TC tórax+abdome c/ [8]; TC tórax s/c [7] | CONFIRMED-PROXY → **CONFIRMED-PROXY** | Região não especificada na proposta. Os ratings vêm da versão 2026 do tópico (a V1 da versão 2021 era refluxo/esofagite). |
| 11 | TC/uroTC; US 1ª linha | V1 (IRA não especificada; inicial) | US rins/retroperitônio [8] (único UA); TC s/ = MB [5] | CONFIRMED → **CONFIRMED-PROXY** | 2º passo: Hydronephrosis V3: uroTC s/c [7] = uroRM s/c [7] = MAG3 [7] = US Doppler [7]. |
| 12 | ColangioRM; US triagem | V2 (suspeita de obstrução mecânica) | TC abdome c/ [8] = RM s/c + CPRM [8]; CPRM s/ [7]; US [7] | CONFIRMED → **CONFIRMED** | V1 (sem predisposição): US [9]. RUQ Pain V4 (febre, US neg.): RM s/c+CPRM [8]. Contraste da colangioRM não especificado. |
| 8 | TC abdome c/ IV | V4 (não especificada; inicial) | TC abd/pelve c/ [9]; TC abd/pelve s/ [7]; RM s/c [7] | CONFIRMED-PROXY → **PARTIAL** | O ACR só avalia "abdomen and pelvis". Se "abdome" = abdome total (abdome+pelve) → CONFIRMED-PROXY. |
| 26 | TC c/ IV | V4 | TC abd/pelve c/ [9] | CONFIRMED-PROXY → **CONFIRMED-PROXY** | Sem variante específica de fármaco. Região não especificada. |
| 24 | TC c/ IV + oral/retal | V4 (complicação pós-proctectomia/colectomia com anastomose; inicial) | TC abd/pelve c/ [8] = TC pelve c/ [8]; RM pelve s/c [7]; enema = MB [6] | CONFIRMED → **CONFIRMED** | Contraste oral/retal não é item separado = UNKNOWN. Para anastomoses não colorretais: Acute Nonlocalized V2 (pós-op + febre: TC abd/pelve c/ [9]) e Bariatric V4 (TC abd/pelve c/ [8]) como PROXY. |
| 27 | TC tórax c/ IV + oral hidrossolúvel; esofagograma | — | — | NO_ACR_TOPIC → **NO_ACR_TOPIC** | Proxy fraco: Dysphagia V5 (disfagia pós-op precoce): esofagograma single-contrast [8] > TC pescoço+tórax c/ [7]. |
| 9 | TC abdome c/ IV | V3 (paciente neutropênico; inicial) | TC abd/pelve c/ [9] (único UA) | CONFIRMED → **PARTIAL** | A variante não cita tiflite. "abdome" vs "abdomen and pelvis": idem #8. |
| 23 | TC tórax "alta resolução" | V1 (inicial) | RX tórax [9] (único UA); TC s/ = MB [6]; TC c/ = MB [6] | CONFIRMED → **DIVERGENT** | Como exame INICIAL, o ACR põe o RX. Na V2 (RX normal/inespecífico; próximo exame) a TC s/ é [9]: se o gate exigir RX prévio → CONFIRMED-PROXY. |
| 21 | TC s/ e c/ contraste | V2 (paciente complicado; inicial) | TC abd/pelve c/ [8] (único UA); TC s/c = MB [5]; TC s/ = MB [4] | DIVERGENT → **DIVERGENT** | A TC s/c só é UA [8] com litíase/obstrução (V3). Não existe variante "enfisematosa". |
| 22 | TC fase portal | V3 (sepse + dor abdominal; inicial) | TC abd/pelve c/ [8] (único UA) | CONFIRMED-PROXY → **CONFIRMED-PROXY** | "Fase portal" não é item separado. |
| 25 | TC c/ IV | V7 (gás em partes moles / alta suspeita de fasciíte necrotizante) | TC s/ [9]; TC c/ [8]; RM s/ [8]; RM s/c [8]; US = MB [5] | CONFIRMED → **PARTIAL** | UA [8], mas a TC de maior rating é a SEM contraste [9]. |
| 4 | AngioTC de artérias pulmonares | V2/V3 | CTA artérias pulmonares [9]; V/Q [7] | CONFIRMED → **CONFIRMED** | — |
| 31 | US Doppler com compressão | V1 (+ UE DVT V1) | US duplex Doppler [9] | CONFIRMED → **CONFIRMED** | "Compressão" não faz parte do nome do procedimento no ACR. |
| 34 | VenoRM ou angioTC venosa | V7 (suspeita de TVC; inicial) | TC s/ [9] = CTV [9] = MRV s/c [9]; RM s/ [8]; RM s/c [8]; MRV s/ [8] | CONFIRMED → **CONFIRMED** | — |
| 6 | TC crânio s/ | V1 (proxy) | TC s/ [9] | CONFIRMED-PROXY → **CONFIRMED-PROXY** | Outros proxies: Headache V1 (TC s/ [9]); Stroke V6 (HIP conhecida; seguimento: TC s/ [9]). |
| 10 | TC multifásica | — | — | NO_ACR_TOPIC → **NO_ACR_TOPIC** | Proxies: Acute Nonlocalized V4 (TC c/ [9]); RP Bleed V1 (CTA [9]). |
| 15 | AngioTC tórax; arteriografia brônquica terapêutica | V1 (maciça; inicial) | CTA tórax [8] = RX [8] = arteriografia brônquica c/ embolização [8]; TC c/ [7] | CONFIRMED → **CONFIRMED** | — |
| 18 | AngioTC multifásica | V1 (aguda; inicial) | CTA abd/pelve [9] (único UA); TC c/ = MB [6]; TC s/c = UNA [3] | CONFIRMED → **CONFIRMED** | "Multifásica" = UNKNOWN. Se incluir fase sem contraste, atenção: a TC s/c é UNA [3] nessa variante. |
| 19 | AngioTC cervical | — | — | NO_ACR_TOPIC → **NO_ACR_TOPIC** | Proxies: Neck Mass V2 (TC pescoço c/ [9]; CTA [8]); Penetrating Neck Injury V1 (CTA [9]; tópico de 2017, sem rótulo de ano no acsearch). |
| 16 | TC alta resolução | V2 (DPD confirmada; exacerbação/deterioração aguda; inicial) | TC tórax s/ [9]; RX [8]; TC c/ = MB [5] | CONFIRMED-PROXY → **CONFIRMED-PROXY** | Contraste não especificado. Variante trocada (v1 usava 105 V4). ESMO 2022 sugere HRCT COM contraste para IR-ILD (o ACR DLD V2 dá TC c/ = MB [5]): divergência entre diretrizes. Proxy alternativo 105 V1: RX [9]. |
| 17 | TC c/ IV | — | — | NO_ACR_TOPIC → **NO_ACR_TOPIC** | ESMO 2022: TC NÃO é recomendada para DIAGNOSTICAR enterocolite imune [IV, E]. ASCO 2021: TC abd/pelve só para complicações. |
| 32 | RM FLAIR | — | — | NO_ACR_TOPIC → **NO_ACR_TOPIC** | Busca nos PDFs por "posterior reversible": 0. Proxies: Seizures V1; Headache V6. |
| 33 | AngioTC multifásica | V1 (inicial) | CTA abd/pelve [9]; TC abd/pelve c/ [8]; TC s/c [7] | CONFIRMED → **CONFIRMED** | "Multifásica" = UNKNOWN (nesta variante a TC s/c é UA [7]). |

---

## 3. Scoreboards
| Eixo | Contagem (n=35) |
|---|---|
| Modalidade | match: **26** · mismatch: **2** · NA: **7** |
| Contraste | match: **16** · mismatch: **4** · NA: **15** |
| Escopo | match: **14** · narrower: **2** · broader: **1** · mismatch-região: **1** · NA: **17** |
| Evidência | EXATO: **16** · PROXY: **12** · NENHUMA: **7** |
| Onco/geral (variante principal) | ONCO: **2** · GERAL: **26** · NA: **7** |
| **Status global** | CONFIRMED: **12** · CONFIRMED-PROXY: **7** · PARTIAL: **4** · DIVERGENT: **5** · NO_ACR_TOPIC: **7** |

- **v1 (para comparação):** CONFIRMED 19 · PROXY 6 · DIVERGENT 3 · NO_TOPIC 7. A v1 não separava os eixos.
- **Mismatch de modalidade:**
  - #20a: o RX é o topo [9]; TC c/ [7].
  - #23: na V1 inicial, o único UA é o RX [9].
- **Mismatch de contraste:**
  - #29: "RM c/" é UNA.
  - #5: "RM c/" é UNA.
  - #21: TC s/c = MB [5]; o único UA é TC c/ [8].
  - #25: TC c/ [8] < TC s/ [9].
- **Escopo:**
  - narrower: #8 e #9 ("TC abdome" vs o ACR "abdomen and pelvis").
  - broader: #1 (coluna inteira vs região torácica).
  - mismatch-região: #29 (o ACR pede RM do plexo, não da coluna).
- **Subcenários oncoespecíficos fora da variante principal:**
  - #29: Plexopathy V6 "known malignancy".
  - #5: Headache V7 "history of cancer".
- **Distribuição dos anos (rótulo) nos 28 itens com tópico:** 2018: 6 · 2019: 3 · 2020: 1 · 2021: 5 · 2022: 4 · 2023: 3 · 2024: 4 · 2025: 1 · 2026: 1. Os 6 itens rotulados 2018 (#12, #8, #26, #9, #31, #18) são os candidatos a "envelhecimento" do conteúdo. A revisão anual sem mudança = UNKNOWN.

---

## 4. Mudanças vs v1 (status que mudaram)
| # | Emergência | v1 | v2 | Motivo |
|---|---|---|---|---|
| 1 | Compressão medular metastática | CONFIRMED | **PARTIAL** | ACR avalia por região ("thoracic"/"lumbar"/"area of interest"); "coluna inteira" não é procedimento nessas variantes. NICE NG234 1.5.5 respalda coluna inteira (sagital T1/STIR + T2). Mesma lógica em LBP V7 [9] e Myelopat… |
| 3 | Tamponamento cardíaco | CONFIRMED | **CONFIRMED-PROXY** | Não existe variante "tamponamento". |
| 5 | Metástase cerebral com herniação | CONFIRMED | **DIVERGENT** | DIVERGÊNCIA TERMINOLÓGICA: "RM c/ gadolínio" lido literalmente = "MRI head with IV contrast" (UNA em V1, V2 e Headache V7). Se a proposta quis dizer "s/c" → CONFIRMED-PROXY (TC s/ primeiro; RM s/c depois). |
| 11 | Uropatia obstrutiva | CONFIRMED | **CONFIRMED-PROXY** | 2º passo: Hydronephrosis V3: uroTC s/c [7] = uroRM s/c [7] = MAG3 [7] = US Doppler [7]. |
| 8 | Perfuração de víscera oca | CONFIRMED-PROXY | **PARTIAL** | O ACR só avalia "abdomen and pelvis". Se "abdome" = abdome total (abdome+pelve) → CONFIRMED-PROXY. |
| 9 | Tiflite (enterocolite neutropênica) | CONFIRMED | **PARTIAL** | A variante não cita tiflite. "abdome" vs "abdomen and pelvis": idem #8. |
| 23 | Aspergilose angioinvasiva | CONFIRMED | **DIVERGENT** | Como exame INICIAL, o ACR põe o RX. Na V2 (RX normal/inespecífico; próximo exame) a TC s/ é [9]: se o gate exigir RX prévio → CONFIRMED-PROXY. |
| 25 | Gangrena de Fournier | CONFIRMED | **PARTIAL** | UA [8], mas a TC de maior rating é a SEM contraste [9]. |

**Outras mudanças**
- **#16:** passou a usar 284 (Diffuse Lung Disease) V2, com TC s/ [9]. A v1 usava 105 V4.
- **#24:** passou a usar 250 V4 como EXATO; TC abd/pelve c/ [8] = TC pelve c/ [8].
- **#5:** a divergência é **terminológica**. Se a proposta quis dizer "RM s/c", o item passa a CONFIRMED-PROXY: TC s/ primeiro, depois RM s/c.
- **#23:** vira CONFIRMED-PROXY se o fluxo exigir RX prévio (105 V2: TC s/ [9]).

---

## 5. Diretrizes primárias (9 itens: 7 sem tópico ACR + #1 + #20a)
| # | Emergência | Diretriz (ano) | Recomendação de imagem (citação curta/paráfrase) | Específica de imagem? | Relação com proposta/ACR | URL |
|---|---|---|---|---|---|---|
| 1 | Compressão medular metastática | **NICE NG234** (06/09/2023) | 1.5.2: RM o mais rápido possível, sempre em até 24 h na suspeita de MSCC. 1.5.5: sagital T1 e/ou STIR de **toda a coluna** + sagital T2 + axiais nas anormalidades, **sem menção a contraste**. 1.5.7: TC se a RM for contraindicada; mielografia raramente. 1.5.9: **não** usar RX simples. 1.9.1: considerar SINS. | Sim | Respalda "coluna inteira" (o ACR avalia por região). **Não exige gadolínio**, enquanto a proposta e o topo do ACR 339 V5 são RM s/c. | https://www.nice.org.uk/guidance/ng234/chapter/Recommendations |
| 20a | Derrame pleural maligno | **BTS Guideline for pleural disease** (Thorax 2023; doi 10.1136/thorax-2022-219784) | "TUS should be performed on every patient at their initial presentation…". US "may be a useful tool at presentation to support a diagnosis of pleural malignancy" (condicional). TC: "a negative CT does not exclude malignancy". Se houver suspeita de malignidade: TC de tórax, abdome e pelve. "Image-guided thoracentesis should always be used" (forte). PET-CT condicional. | Sim | **Diverge do ACR 300 V3**, onde o US = MB [5] e o topo é o RX [9]. Apoia TC + US (a proposta). | https://www.brit-thoracic.org.uk/document-library/guidelines/pleural-disease/bts-guideline-for-pleural-disease |
| 20b | Pneumotórax hipertensivo | BTS 2023 (mesma diretriz) | Cita o pneumotórax hipertensivo só como motivo para considerar cirurgia torácica (condicional). **Recomendação de imagem: UNKNOWN.** | Não | — | idem |
| 27 | Fístula traqueoesofágica / mediastinite | **ESGE 2020** (perfuração iatrogênica) | Rec. 3: sinais/sintomas de perfuração iatrogênica devem ser "documented with a computed tomography (CT) scan". Texto: "the ingestion of water-soluble contrast medium prior to CT scan adds accuracy" (perfuração alta). **ESGE 2021** (stents): SEMS para FTE maligna; é tratamento, não imagem. | Sim (ESGE 2020) | Apoia TC + contraste oral hidrossolúvel, mas o **escopo é iatrogênico**, não FTE maligna/mediastinite. | https://www.esge.com/assets/downloads/pdfs/guidelines/2020_a_1222_3191.pdf · https://www.esge.com/assets/downloads/pdfs/guidelines/2021_a_1475_0063.pdf |
| 30 | Hidrocefalia obstrutiva (adulto) | **EANO–ESMO metástase leptomeníngea** (Ann Oncol 2017; 28 Suppl 4: iv84–iv99) | A RM cerebrospinal é o padrão-ouro. "Cranial CT should be limited to patients with contraindications for MRI". Hidrocefalia aparece como achado de imagem "tipo D". | Sim, mas **indireto** (LM, não hidrocefalia obstrutiva em geral) | A proposta é TC s/ + RM; a diretriz prioriza RM. A atualização EANO–ESMO 2023 existe mas **não foi lida** (UNKNOWN). | https://www.oncodeva.net/upload/esmo-guidelines/metastaze-meningeale.pdf · https://www.eano.eu/publications/eano-guidelines/leptomeningeal-metastasis-from-solid-tumours-eano-esmo-clinical-practice-guideline-for-diagnosis-treatment-and-follow-up-2023/ |
| 10 | Ruptura de CHC | AASLD 2018; EASL 2025 | AASLD 2018: busca textual por "ruptur" = 0 ocorrências. EASL 2025: segundo uma carta ("Ruptured HCC: An entity in exile from the EASL CPG", fonte secundária), não há recomendação para ruptura. **UNKNOWN.** | — | — | https://www.aasld.org/sites/default/files/2022-06/AASLD_2018_HCC_Guidance_on_Diagnosis%2C_Staging_and_Management_hep_29913.pdf · https://www.sciencedirect.com/science/article/pii/S016882782402508X · https://exa.ai/library/publication/zgx5736f2qd |
| 19 | Blowout carotídeo | — | Nenhuma diretriz encontrada; só revisões narrativas (p.ex. AJNR 2014). **UNKNOWN.** | — | — | https://www.ajnr.org/content/35/3/562 (revisão, não diretriz) |
| 17 | Colite por ICI | **ESMO 2022** (Haanen et al., Ann Oncol; doi 10.1016/j.annonc.2022.10.001) | "A CT scan to diagnose IR-enterocolitis is **not recommended** because of insufficient sensitivity [IV, E]". Endoscopia: "Flexible sigmoidoscopy or colonoscopy and biopsies … grade >1 diarrhoea [IV, A]". | Sim | **Contradiz a proposta "TC c/ IV" como exame diagnóstico.** | https://www.oncodeva.net/upload/esmo-guidelines/paliatie/imunotoxicitatea.pdf (cópia do PDF) · https://doi.org/10.1016/j.annonc.2022.10.001 |
| 17 | Colite por ICI | **ASCO 2021** (Schneider et al., JCO 39:4073–4126) | "Imaging, eg, CT scan of abdomen and pelvis for colitis-related symptoms (abdominal pain and bleeding) to rule out colitis-related complications, including typhlitis and bowel perforation or abscess." | Sim | TC abd/pelve **para complicações**, não para diagnóstico. Compatível com a ESMO. | https://ascopubs.org/doi/10.1200/JCO.21.01440 |
| 32 | PRES | Nenhuma diretriz oncológica encontrada. **Bula FDA do Avastin** (revisada 09/2022), §5.7 | "Magnetic resonance imaging is necessary to confirm the diagnosis of PRES." | Sim | Apoia a RM (proposta: RM FLAIR). **É bula regulatória, não diretriz.** Diretriz = UNKNOWN. | https://www.gene.com/download/pdf/avastin_prescribing.pdf |
| — | Todos | **NCCN** | Atrás de login: **UNKNOWN**. | — | — | https://www.nccn.org/guidelines |
| — | Todos | **SBOC** | Não há diretriz específica de emergências oncológicas na página de diretrizes: **UNKNOWN**. | — | — | https://www.sboc.org.br/diretrizes2025 |
| 16 (bônus) | Pneumonite por ICI | ESMO 2022 | "If IR-ILD is suspected, a high-resolution chest CT **with contrast** should be considered to rule out other aetiologies [IV, A]". | Sim | **Diverge do ACR 284 V2**, onde TC c/ = MB [5] e o topo é TC s/ [9]. | idem ESMO 2022 |

Não buscados ou não lidos (UNKNOWN):
- ERS/EACTS 2018 sobre derrame pleural maligno.
- EANO–ESMO 2023 (LM).

---

## 6. IA de triagem (tabela B3): performance em população oncológica
**Regra:** métricas de população geral **não** são tratadas como oncológicas. Aparecem separadas e rotuladas como "população geral".

### 6.1 Dados oncológicos encontrados
| Produto (K) | Métrica | População | n | Fonte |
|---|---|---|---|---|
| **CINA-iPE** (Avicenna.AI, K233968; TEP incidental) | Se 97,3%; Sp 97,74%; VPP 34,62%; VPN 99,97%. 104 alertas: 36 VP, 68 FP. Referência = laudo do radiologista. | Pacientes oncológicos, Gustave Roussy | 3047 | Life 2024;14:1347, doi 10.3390/life14111347, https://pmc.ncbi.nlm.nih.gov/articles/PMC11595865/ |
| **CINA-VCF** (Avicenna.AI; o estudo usou "CINA-VCF Quantix v0.7"; **correspondência com o K240612 = UNKNOWN**) | 501 sinalizados, 436 VP, **VPP 87%**. Sensibilidade não calculável. 83,5% dos VP não estavam no laudo. Causas de FP incluem metástases escleróticas. | Câncer estádio IV | 1556 | Radiol Med 2025, doi 10.1007/s11547-025-02058-z, https://pmc.ncbi.nlm.nih.gov/articles/PMC12546477/ |

### 6.2 Contraindicações/notas oncológicas nas 510(k) (sem métrica de subgrupo)
| Produto (K) | Nota | Fonte |
|---|---|---|
| Brainomix 360 Triage ICH (K231195) | "not suitable for use with scan data containing … tumors or abscesses" | https://fda.innolitics.com/device/K231195 |
| syngo.CT LVO Detection (K243145) | Contraindicado na presença de tumores cerebrais | https://fda.innolitics.com/device/K243145 |
| Rapid Obstructive Hydrocephalus (K251533) | Tumor listado entre os confundidores; **sem métrica no subgrupo tumoral** | https://fda.innolitics.com/device/K251533 |
| Aidoc CARE Multi-Triage CT (K253578) | "Oncology" entre as patologias dos casos negativos; sem métrica de subgrupo | https://fda.innolitics.com/device/K253578 |
| Rapid MLS (K243378, QIH) | Uso pretendido inclui medição em HIC, **tumor** e TCE. MAE 0,7 mm (n=153); **sem subgrupo tumoral** | https://fda.innolitics.com/device/K243378 |

### 6.3 Todos os produtos de B3: oncológico vs população geral
Links: `https://fda.innolitics.com/device/<K>` (espelho da 510(k) summary) e a ficha oficial `https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfPMN/pmn.cfm?ID=<K>`. O PDF direto da FDA retornou desafio 401/JS, que não foi contornado.

| Produto | K / código | Oncológico | População geral (510(k)) | n (geral) |
|---|---|---|---|---|
| uAI Easy Triage ICH | K242292 / QAS | UNKNOWN | Se 92% / Sp 95% | 295 |
| syngo.CT Brain Hemorrhage | K232431 / QAS | UNKNOWN | Se 95,0% / Sp 93,1% | 900 |
| Brainomix 360 Triage ICH | K231195 / QAS | UNKNOWN; **tumor fora da IFU** | Se 89,22% / Sp 91,37% | 341 |
| CINA (ICH+LVO) | **K não verificado** (a busca sugeriu K221716) | UNKNOWN | UNKNOWN | UNKNOWN |
| syngo.CT LVO Detection | K243145 / QAS | UNKNOWN; **contraindicado com tumor** | Se 90,6% / Sp 88,8% | 602 |
| Brainomix 360 Triage LVO | K231837 / QAS | UNKNOWN | Se 90% / Sp 92,9% | 308 |
| CINA-iPE | K233968 / QAS | **Ver §6.1** | Se 87,8% / Sp 92,0% | 381 |
| GE Critical Care Suite (PTX) | K223491 / **QBS** | UNKNOWN | AUC 96,1%; Se 84,3%; Sp 93,2% | 804 |
| VUNO Med-Chest X-ray Triage | K241439 / QFM | UNKNOWN | PTX: AUC 0,9883, Se 95,45%, Sp 96,41% (716+/474−). Derrame pleural: Se 96,53%, Sp 95,11% (1200+/797−) | ver métrica |
| Aidoc CARE Multi-Triage CT | K253578 / QAS | UNKNOWN | PTX: AUC 98,9, Se 94,8%, Sp 95,9%. Derrame pericárdico: AUC 99,1, Se 96,4%, Sp 96,5% | 280 |
| Aidoc BriefCase (ar livre) | K193298 / QAS | UNKNOWN | Se 91,0% / Sp 88,9% | 184 |
| CINA-CSpine | K240942 / QAS | UNKNOWN | Se 90,3% / Sp 91,9% | 328 |
| CINA-VCF | K240612 / QFM | **Ver §6.1** (versão Quantix; ressalva) | ROC AUC 0,974 | 474 |
| Rapid Obstructive Hydrocephalus | K251533 / QAS | UNKNOWN | Se 89,5% / Sp 97,6% | 320 |
| Annalise CTB Triage-OH | K231094 / QAS | UNKNOWN | Se 97,3/97,6%, Sp 94,0/95,3% (dois conjuntos) | 175 |
| Rapid MLS | K243378 / QIH | UNKNOWN | MAE 0,7 mm | 153 |
| EFAI Neurosuite CT Midline Shift | K241923 / QAS | UNKNOWN | Se 0,961 / Sp 0,955 | 300 |
| EFAI Cardiosuite CTA AAS | K240291 / QAS | UNKNOWN | Se 0,929 / Sp 0,915 | 380 |

**Dados adicionais de população geral (não oncológicos)**
- **Annalise OH:** Eur Radiol 2026, AUC 0,988 (corte fino) / 0,986 (corte grosso), 200 casos. Subgrupos HIC, anormalidade parenquimatosa e dreno, nenhum oncológico. Financiado pela Harrison AI. https://link.springer.com/article/10.1007/s00330-026-12332-x
- **HIC no mundo real (Aidoc; produto fora de B3):** n=101.944, Se 82,2%. https://nature.com/articles/s41746-025-02244-3.pdf
- **Tumores como causa conhecida de FP de IA para HIC:** PLOS One 2021, 15,7% das hiperdetecções. Citado como risco; não é métrica de produto de B3.

---

## 7. Códigos de produto FDA
Fonte: FDA Product Classification, `https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfPCD/classification.cfm?start_search=1&productcode=<CÓDIGO>` (consultado em 01/10/2026).

| Código | Nome do dispositivo (FDA) | Regulação (21 CFR) | Classe | Tipo funcional | URL |
|---|---|---|---|---|---|
| **QAS** | Radiological computer-assisted triage and notification software | 892.2080 | II (510(k)) | **Triagem (CADt)** | https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfPCD/classification.cfm?start_search=1&productcode=QAS |
| **QFM** | Radiological computer-assisted prioritization software for lesions | 892.2080 | II | **Triagem (CADt)**. O texto da definição menciona ">95% AUC". | https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfPCD/classification.cfm?start_search=1&productcode=QFM |
| **QBS** | Radiological computer assisted detection/diagnosis software for fracture | 892.2090 | II | **CADe/CADx** (não triagem). Ver nota abaixo. | https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfPCD/classification.cfm?start_search=1&productcode=QBS |
| **QIH** | Automated radiological image processing software | 892.2050 | II | **Quantificação/processamento** | https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfPCD/classification.cfm?start_search=1&productcode=QIH |
| QKB | Radiological image processing software for radiation therapy | 892.2050 | II | Outros (RT) | https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfPCD/classification.cfm?start_search=1&productcode=QKB |
| OEB | Lung computed tomography system, computer-aided detection (nódulos) | 892.2050 | II | CADe | https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfPCD/classification.cfm?start_search=1&productcode=OEB |
| QDQ | Radiological CADe/x software for lesions suspicious for cancer | 892.2090 | II | CADe/x | https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfPCD/classification.cfm?start_search=1&productcode=QDQ |

**Nota sobre o QBS:** o GE Critical Care Suite com Pneumothorax Detection (K223491; decisão de 25/05/2023) está classificado sob o QBS, embora o nome do código seja "fracture". Isso foi confirmado na ficha oficial: https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfPMN/pmn.cfm?ID=K223491

**Divisão dos produtos de B3**
- **Triagem (CADt: QAS/QFM):**
  - QAS: uAI ICH, syngo ICH, Brainomix ICH, syngo LVO, Brainomix LVO, CINA-iPE, Aidoc CARE, BriefCase, CINA-CSpine, Rapid OH, Annalise OH, EFAI MLS, EFAI AAS.
  - QFM: VUNO, CINA-VCF.
  - CINA (ICH+LVO): código UNKNOWN (K não verificado).
- **Quantificação/outros:**
  - GE CCS (QBS, CADe/x).
  - Rapid MLS (QIH).
  - IA oncológica fora das emergências (QIH, QKB, OEB, QDQ; lista na v1 §B3).

---

## 8. Desenho do gate — IMG-ACR-01 `F2_CANDIDATE`

### 8.1 Contrato
- **Input:** cenário clínico mapeado para o tópico e a variante ACR (`ScenarioMapping`, com evidência EXATO/PROXY/NENHUMA), mais `ClinicalModifiers`, `Thresholds`, urgência clínica, proposta opcional (no vocabulário ACR normalizado) e `DerivedAiInput[]`.
- **Output:** conjunto **ordenado** de procedimentos **Usually Appropriate** com os ratings originais, mais avisos, urgência, roteamento e fonte (URL do PDF + ReleaseId).
- **Nunca:**
  - inventa rating;
  - inclui MBA/UNA;
  - bloqueia (não existe status `BLOCK`);
  - deixa a IA alterar a lista.

### 8.2 Tipos e implementação de referência (TypeScript)
Arquivo: `/workspace/acr-check/v2/gate/gate.ts`. Fixtures: `acr_fixtures.json`, com 30 variantes e 357 procedimentos extraídos dos PDFs oficiais.

```ts
// IMG-ACR-01 — gate determinístico de imagem baseado no ACR AC. Maturidade: F2_CANDIDATE.
// Regra-mãe: o gate só reordena/anota procedimentos "Usually appropriate" (UA) da variante ACR mapeada.
// Ele nunca inventa rating, nunca bloqueia (divergência = WARNING) e trata IA só como input DERIVED.

export type Category = 'UA' | 'MBA' | 'UNA';
export type Contrast = 'WITHOUT' | 'WITH' | 'WITHOUT_AND_WITH' | 'NA';
export type Modality = 'CT' | 'CTA' | 'CTV' | 'CTU' | 'MRI' | 'MRA' | 'MRV' | 'MRU' | 'US' | 'ECHO' | 'XR'
  | 'FLUORO' | 'ANGIO' | 'NM' | 'PET' | 'ENDO' | 'OTHER';
export type Tri = boolean | 'UNKNOWN';
export type Evidence = 'EXATO' | 'PROXY' | 'NENHUMA';
export type Urgency = 'ROUTINE' | 'URGENT' | 'EMERGENT';

export interface AcrProcedure {
  procedureId: string; label: string; modality: Modality; contrast: Contrast;
  category: Category; rating: number | null;          // null = rating não extraído => nunca recomendado
}
export interface AcrVariant {
  topicId: number; variant: number; title: string; panel: string; releaseId: number;
  ratingsPdfUrl: string; topicVersionLabel: string; oncoSpecific: boolean; procedures: AcrProcedure[];
}
export interface ScenarioMapping {
  scenarioId: string; evidence: Evidence; variant: AcrVariant | null; mappingSource: string;
}
export interface Thresholds {               // números clínicos SÓ entram com fonte; default = UNKNOWN
  egfrIodinatedCaution: number | 'UNKNOWN'; egfrGbcaCaution: number | 'UNKNOWN'; source: string | 'UNKNOWN';
}
export interface ClinicalModifiers {
  egfr: number | 'UNKNOWN';
  iodinatedContrastContraindicated: Tri;    // ex.: alergia grave documentada (regra upstream com fonte própria)
  gadoliniumContraindicated: Tri;
  pregnant: Tri;
  hemodynamicallyUnstable: Tri;
  mriUnsafeDevice: Tri;
  oncologicContext: Tri;
}
export interface DerivedAiInput {
  kind: 'DERIVED'; source: 'AI'; product: string; fda510k: string | 'UNKNOWN'; productCode: string;
  finding: string; flag: boolean; contraindicatedInContext: Tri; modelVersion: string;
}
export interface ProposedProcedure { label: string }   // já normalizado para o vocabulário ACR
export interface GateInput {
  mapping: ScenarioMapping; modifiers: ClinicalModifiers; thresholds: Thresholds;
  clinicalUrgency: Urgency; proposed?: ProposedProcedure; aiInputs: DerivedAiInput[];
}
export type AnnotationCode = 'IODINATED_CONTRAST_CONTRAINDICATED' | 'GBCA_CONTRAINDICATED' | 'EGFR_BELOW_THRESHOLD'
  | 'EGFR_THRESHOLD_UNCONFIGURED' | 'PREGNANCY_IONIZING' | 'PREGNANCY_GBCA' | 'UNSTABLE_MRI_LOGISTICS'
  | 'MRI_UNSAFE_DEVICE' | 'MODIFIER_UNKNOWN' | 'EQUIVALENT_ALTERNATIVE';
export interface Annotation { code: AnnotationCode; detail: string }
export interface RankedProcedure extends AcrProcedure { rank: number; demoted: boolean; annotations: Annotation[] }
export type WarningCode = 'PROXY_VARIANT' | 'GENERAL_VARIANT_IN_ONCOLOGIC_PATIENT' | 'PROPOSED_NOT_RATED'
  | 'PROPOSED_NOT_UA' | 'PROPOSED_NOT_TOP' | 'CONTRAST_DIFFERS_FROM_TOP_IN_MODALITY' | 'ALL_UA_DEMOTED'
  | 'AI_FLAG_REQUIRES_HUMAN' | 'AI_OFF_LABEL_CONTEXT' | 'NO_ACR_TOPIC_UNKNOWN';
export interface Warning { code: WarningCode; detail: string }
export type GateStatus = 'OK' | 'WARNING' | 'NO_ACR_TOPIC';     // não existe 'BLOCK' por construção
export interface GateOutput {
  gateId: 'IMG-ACR-01'; maturity: 'F2_CANDIDATE'; status: GateStatus;
  recommended: RankedProcedure[]; warnings: Warning[]; urgency: Urgency; routeTo: 'NONE' | 'HUMAN_REVIEWER';
  derivedInputsUsed: string[];
  source: { ratingsPdfUrl: string; releaseId: number; topicId: number; variant: number; topicVersionLabel: string } | null;
}

const IONIZING: Modality[] = ['CT', 'CTA', 'CTV', 'CTU', 'XR', 'FLUORO', 'ANGIO', 'NM', 'PET'];
const MR: Modality[] = ['MRI', 'MRA', 'MRV', 'MRU'];
const URG: Urgency[] = ['ROUTINE', 'URGENT', 'EMERGENT'];
const maxU = (a: Urgency, b: Urgency): Urgency => (URG.indexOf(a) >= URG.indexOf(b) ? a : b);
const usesIodinated = (p: AcrProcedure) => !MR.includes(p.modality) && (p.contrast === 'WITH' || p.contrast === 'WITHOUT_AND_WITH');
const usesGbca = (p: AcrProcedure) => MR.includes(p.modality) && (p.contrast === 'WITH' || p.contrast === 'WITHOUT_AND_WITH');
const cmp = (a: AcrProcedure, b: AcrProcedure) => (b.rating! - a.rating!) || (a.procedureId < b.procedureId ? -1 : a.procedureId > b.procedureId ? 1 : 0);

export function runGate(input: GateInput): GateOutput {
  const { mapping, modifiers: m, thresholds: th, aiInputs } = input;
  const warnings: Warning[] = [];
  let routeTo: 'NONE' | 'HUMAN_REVIEWER' = 'NONE';
  // R5 — IA: só DERIVED; pode subir urgência e rotear para humano; nunca altera a lista recomendada.
  let urgency = input.clinicalUrgency;
  const derivedInputsUsed: string[] = [];
  for (const ai of [...aiInputs].sort((a, b) => (a.product + a.finding < b.product + b.finding ? -1 : 1))) {
    if (ai.kind !== 'DERIVED') continue;
    derivedInputsUsed.push(`${ai.product}:${ai.finding}:${ai.flag ? 'POS' : 'NEG'}`);
    if (!ai.flag) continue;                               // resultado negativo de IA nunca reduz nada
    routeTo = 'HUMAN_REVIEWER';
    warnings.push({ code: 'AI_FLAG_REQUIRES_HUMAN', detail: `${ai.product} (${ai.productCode}) sinalizou ${ai.finding}` });
    if (ai.contraindicatedInContext === true) warnings.push({ code: 'AI_OFF_LABEL_CONTEXT', detail: `${ai.product}: contexto fora da IFU; não eleva urgência` });
    else urgency = maxU(urgency, 'URGENT');
  }
  // R1 — sem tópico ACR = UNKNOWN
  if (mapping.evidence === 'NENHUMA' || !mapping.variant) {
    warnings.push({ code: 'NO_ACR_TOPIC_UNKNOWN', detail: `${mapping.scenarioId}: sem tópico/variante ACR; recomendação = UNKNOWN` });
    return { gateId: 'IMG-ACR-01', maturity: 'F2_CANDIDATE', status: 'NO_ACR_TOPIC', recommended: [], warnings,
      urgency, routeTo: 'HUMAN_REVIEWER', derivedInputsUsed, source: null };
  }
  const v = mapping.variant;
  if (mapping.evidence === 'PROXY') warnings.push({ code: 'PROXY_VARIANT', detail: `variante proxy ${v.topicId} V${v.variant}` });
  if (m.oncologicContext === true && !v.oncoSpecific) warnings.push({ code: 'GENERAL_VARIANT_IN_ONCOLOGIC_PATIENT', detail: 'variante ACR não cita câncer/malignidade' });
  // R2 — conjunto = UA com rating extraído; ordem base = rating desc, desempate por ordem da tabela ACR (procedureId)
  const ua = v.procedures.filter(p => p.category === 'UA' && p.rating !== null).slice().sort(cmp);
  // R3 — modificadores: anotam e rebaixam (tier 1) — nunca adicionam, removem ou alteram rating
  const ranked = ua.map(p => {
    const ann: Annotation[] = []; let demote = false;
    const flag = (val: Tri, code: AnnotationCode, detail: string, demotes: boolean) => {
      if (val === true) { ann.push({ code, detail }); if (demotes) demote = true; }
      else if (val === 'UNKNOWN') ann.push({ code: 'MODIFIER_UNKNOWN', detail: `${code}: verificar` });
    };
    if (usesIodinated(p)) {
      flag(m.iodinatedContrastContraindicated, 'IODINATED_CONTRAST_CONTRAINDICATED', 'contraste iodado contraindicado', true);
      if (m.egfr !== 'UNKNOWN') {
        if (th.egfrIodinatedCaution === 'UNKNOWN') ann.push({ code: 'EGFR_THRESHOLD_UNCONFIGURED', detail: 'limiar sem fonte; não reordena' });
        else if (m.egfr < th.egfrIodinatedCaution) { ann.push({ code: 'EGFR_BELOW_THRESHOLD', detail: `eGFR<${th.egfrIodinatedCaution} (${th.source})` }); demote = true; }
      }
    }
    if (usesGbca(p)) {
      flag(m.gadoliniumContraindicated, 'GBCA_CONTRAINDICATED', 'gadolínio contraindicado', true);
      flag(m.pregnant, 'PREGNANCY_GBCA', 'gestação + GBCA: decisão humana', false);
      if (m.egfr !== 'UNKNOWN') {
        if (th.egfrGbcaCaution === 'UNKNOWN') ann.push({ code: 'EGFR_THRESHOLD_UNCONFIGURED', detail: 'limiar sem fonte; não reordena' });
        else if (m.egfr < th.egfrGbcaCaution) { ann.push({ code: 'EGFR_BELOW_THRESHOLD', detail: `eGFR<${th.egfrGbcaCaution} (${th.source})` }); demote = true; }
      }
    }
    if (IONIZING.includes(p.modality)) flag(m.pregnant, 'PREGNANCY_IONIZING', 'gestação + radiação ionizante: decisão humana', false);
    if (MR.includes(p.modality)) {
      flag(m.mriUnsafeDevice, 'MRI_UNSAFE_DEVICE', 'dispositivo MR-unsafe', true);
      flag(m.hemodynamicallyUnstable, 'UNSTABLE_MRI_LOGISTICS', 'instabilidade: RM rebaixada', true);
    }
    if (ua.some(q => q !== p && q.rating === p.rating)) ann.push({ code: 'EQUIVALENT_ALTERNATIVE', detail: `empate no rating ${p.rating}` });
    return { ...p, rank: 0, demoted: demote, annotations: ann };
  });
  ranked.sort((a, b) => (Number(a.demoted) - Number(b.demoted)) || cmp(a, b));
  ranked.forEach((r, i) => (r.rank = i + 1));
  if (ranked.length > 0 && ranked.every(r => r.demoted)) {
    warnings.push({ code: 'ALL_UA_DEMOTED', detail: 'todo UA tem contraindicação: alternativa fora do ACR exige humano' });
    routeTo = 'HUMAN_REVIEWER';
  }
  if (m.hemodynamicallyUnstable === true) urgency = maxU(urgency, 'EMERGENT');
  // R4 — divergência proposta × ACR = WARNING (nunca BLOCK)
  if (input.proposed) {
    const hit = v.procedures.find(p => p.label === input.proposed!.label);
    const top = ua[0];
    if (!hit) warnings.push({ code: 'PROPOSED_NOT_RATED', detail: `"${input.proposed.label}" não está na tabela` });
    else if (hit.category !== 'UA' || hit.rating === null) warnings.push({ code: 'PROPOSED_NOT_UA', detail: `${hit.category} [${hit.rating ?? '?'}]` });
    else if (top && hit.rating < top.rating!) warnings.push({ code: 'PROPOSED_NOT_TOP', detail: `[${hit.rating}] < topo [${top.rating}] ${top.label}` });
    if (hit) {
      const topSameMod = ua.find(p => p.modality === hit.modality);
      if (topSameMod && hit.contrast !== 'NA' && topSameMod.contrast !== hit.contrast)
        warnings.push({ code: 'CONTRAST_DIFFERS_FROM_TOP_IN_MODALITY', detail: `${hit.contrast} vs ${topSameMod.contrast}` });
    }
  }
  const status: GateStatus = warnings.length ? 'WARNING' : 'OK';
  return { gateId: 'IMG-ACR-01', maturity: 'F2_CANDIDATE', status, recommended: ranked, warnings, urgency, routeTo, derivedInputsUsed,
    source: { ratingsPdfUrl: v.ratingsPdfUrl, releaseId: v.releaseId, topicId: v.topicId, variant: v.variant, topicVersionLabel: v.topicVersionLabel } };
}

```

### 8.3 Regras determinísticas
| Regra | Descrição |
|---|---|
| **R1** | Evidência NENHUMA ou sem variante → `NO_ACR_TOPIC`, lista vazia, `routeTo=HUMAN_REVIEWER`, `source=null`, aviso `NO_ACR_TOPIC_UNKNOWN`. |
| **R2** | Conjunto = procedimentos `category='UA'` com `rating≠null`. Ordem: rating desc; desempate pela ordem da tabela ACR (`procedureId`). Empates recebem a anotação `EQUIVALENT_ALTERNATIVE`. |
| **R3** | Modificadores **só anotam ou rebaixam** de forma estável (tier 1). Nunca adicionam, removem ou alteram rating. Ver lista abaixo. |
| **R4** | Divergência entre proposta e ACR = **WARNING**: `PROPOSED_NOT_RATED`, `PROPOSED_NOT_UA`, `PROPOSED_NOT_TOP`, `CONTRAST_DIFFERS_FROM_TOP_IN_MODALITY`. Os avisos `PROXY_VARIANT` e `GENERAL_VARIANT_IN_ONCOLOGIC_PATIENT` também são WARNING. |
| **R5** | IA entra só como `kind:'DERIVED'`. Ver lista abaixo. |

Modificadores na R3 (`TRUE` vs `UNKNOWN`):
- **Rebaixam quando `TRUE`:**
  - iodado contraindicado (TC/angio com contraste);
  - gadolínio contraindicado (RM com contraste);
  - dispositivo MR-unsafe (RM);
  - instabilidade (RM, que também eleva a urgência a EMERGENT).
- **Só anotam:** gestação, que nunca reordena por falta de rating ACR específico na variante.
- **eGFR:** rebaixa **apenas** se o limiar estiver configurado **com fonte**. O default é `UNKNOWN`, que só anota `EGFR_THRESHOLD_UNCONFIGURED`.
- **`UNKNOWN`:** qualquer modificador `UNKNOWN` anota `MODIFIER_UNKNOWN` e não reordena.
- **Todo UA rebaixado:** se todos os UA ficam rebaixados, gera o aviso `ALL_UA_DEMOTED` e `routeTo=HUMAN_REVIEWER`. A alternativa fora do ACR (p.ex. TC pela NICE 1.5.7) fica para o humano.

Comportamento da IA na R5:
- `flag=true` → `routeTo=HUMAN_REVIEWER` e urgência = max(clínica, URGENT).
- Contexto fora da IFU (`contraindicatedInContext=true`, p.ex. Brainomix ICH com tumor) → roteia para humano **sem elevar a urgência** e com o aviso `AI_OFF_LABEL_CONTEXT`.
- `flag=false` não reduz nada.
- A lista recomendada é **idêntica** com ou sem IA.

**Normalização da proposta:** a proposta precisa estar no vocabulário ACR. Termos ambíguos ("c/ gadolínio", "multifásica", "alta resolução") vão para uma tabela de normalização F1 com fonte. Sem normalização, o resultado é `PROPOSED_NOT_RATED`, que é WARNING.

### 8.4 Tabela-verdade
| # | Evidência | Proposta | Modificadores | IA | Status | routeTo | Urgência | Lista |
|---|---|---|---|---|---|---|---|---|
| 1 | NENHUMA | qualquer | qualquer | qualquer | NO_ACR_TOPIC | HUMAN_REVIEWER | ≥ clínica | [] (UNKNOWN) |
| 2 | EXATO | = topo UA | nenhum | nenhuma | OK | NONE | clínica | UA por rating |
| 3 | EXATO | UA ≠ topo | nenhum | nenhuma | WARNING (PROPOSED_NOT_TOP) | NONE | clínica | inalterada |
| 4 | EXATO | MBA/UNA | nenhum | nenhuma | WARNING (PROPOSED_NOT_UA) | NONE | clínica | inalterada |
| 5 | EXATO | fora da tabela | nenhum | nenhuma | WARNING (PROPOSED_NOT_RATED) | NONE | clínica | inalterada |
| 6 | PROXY | qualquer | nenhum | nenhuma | WARNING (PROXY_VARIANT) | NONE | clínica | inalterada |
| 7 | EXATO/PROXY | — | onco=TRUE e variante geral | nenhuma | WARNING (GENERAL_VARIANT…) | NONE | clínica | inalterada |
| 8 | EXATO | — | contraindicação=TRUE (parcial) | nenhuma | OK/WARNING | NONE | clínica | mesma lista, afetados no fim, ratings intactos |
| 9 | EXATO | — | contraindicação=TRUE (todos os UA) | nenhuma | WARNING (ALL_UA_DEMOTED) | HUMAN_REVIEWER | clínica | mesma lista, todos rebaixados |
| 10 | EXATO | — | qualquer = UNKNOWN | nenhuma | conforme as outras regras | conforme | clínica | **ordem inalterada** + MODIFIER_UNKNOWN |
| 11 | EXATO | — | eGFR conhecido, limiar UNKNOWN | nenhuma | conforme | conforme | clínica | ordem inalterada + EGFR_THRESHOLD_UNCONFIGURED |
| 12 | EXATO | — | instável=TRUE | nenhuma | conforme | conforme | EMERGENT | RM rebaixada |
| 13 | EXATO | — | gestação=TRUE | nenhuma | conforme | conforme | clínica | ordem inalterada + anotação |
| 14 | qualquer | — | — | flag POS, dentro da IFU | WARNING (AI_FLAG_REQUIRES_HUMAN) | HUMAN_REVIEWER | max(clínica, URGENT) | **inalterada** |
| 15 | qualquer | — | — | flag POS, fora da IFU | WARNING (+AI_OFF_LABEL_CONTEXT) | HUMAN_REVIEWER | **clínica** | inalterada |
| 16 | qualquer | — | — | flag NEG | conforme as outras regras | conforme | clínica (nunca reduz) | inalterada |

### 8.5 Invariantes e testes
| Teste | Invariante |
|---|---|
| `inv_no_invented_ratings` | Todo rating/label de saída é idêntico ao da fixture ACR (30 variantes × 81 combinações de modificadores). |
| `inv_only_usually_appropriate` | A saída contém só UA com rating não nulo. |
| `inv_divergence_is_warning_not_block` | Qualquer proposta (inclusive inexistente) resulta em OK/WARNING, nunca BLOCK, e a lista não muda. |
| `inv_ai_does_not_change_recommendation` | A lista é idêntica com IA POS, NEG, fora da IFU ou mista. |
| `inv_ai_only_raises_urgency` | Urgência de saída ≥ urgência clínica. IA NEG não reduz. |
| `inv_ai_flag_routes_human` | Flag POS → HUMAN_REVIEWER. Fora da IFU → humano sem elevar urgência. |
| `inv_no_topic_returns_unknown` | NENHUMA → NO_ACR_TOPIC, [] e humano. |
| `inv_modifiers_permute_only` | Modificadores só permutam a lista; o conjunto é igual. |
| `inv_deterministic_order_independent` | Saída igual com a ordem de entrada invertida e em execuções repetidas. |
| `inv_every_output_has_source` | Toda saída com tópico traz URL `GenerateAppendixPDF` + ReleaseId 107. |
| `inv_unknown_modifier_does_not_reorder` | Todos os modificadores UNKNOWN (eGFR conhecido, limiar UNKNOWN) dão ordem idêntica à base. |
| `inv_egfr_threshold_unknown_never_demotes` | Sem limiar com fonte, o eGFR nunca rebaixa. |
| `tt_01` … `tt_12` | Regressão com itens reais: #7 OK; #29 PROPOSED_NOT_UA (UNA 3); #23 NOT_UA (MB 6); #20a NOT_TOP; #25 NOT_TOP + CONTRAST_DIFFERS; PROXY + variante geral em onco; #1 339 V5 oncoespecífico sem aviso; iodado contraindicado; MR-unsafe no #1 (todo UA é RM → humano); instável em 271 V2 (empate 7/7/7 → TC s/ primeiro, EMERGENT); gestação só anota; limiar eGFR sintético (marcado "TESTE-SINTETICO", não clínico). |

### 8.6 Resultado (pass/fail): `bun test` em 01/10/2026
```
bun test v1.4.2 (744846f84)

gate.test.ts:
(pass) invariantes IMG-ACR-01 > inv_no_invented_ratings [14.84ms]
(pass) invariantes IMG-ACR-01 > inv_only_usually_appropriate [7.45ms]
(pass) invariantes IMG-ACR-01 > inv_divergence_is_warning_not_block [1.84ms]
(pass) invariantes IMG-ACR-01 > inv_ai_does_not_change_recommendation [6.73ms]
(pass) invariantes IMG-ACR-01 > inv_ai_only_raises_urgency [0.17ms]
(pass) invariantes IMG-ACR-01 > inv_ai_flag_routes_human [0.16ms]
(pass) invariantes IMG-ACR-01 > inv_no_topic_returns_unknown [0.05ms]
(pass) invariantes IMG-ACR-01 > inv_modifiers_permute_only [4.50ms]
(pass) invariantes IMG-ACR-01 > inv_deterministic_order_independent [0.39ms]
(pass) invariantes IMG-ACR-01 > inv_every_output_has_source [0.65ms]
(pass) invariantes IMG-ACR-01 > inv_unknown_modifier_does_not_reorder [0.28ms]
(pass) invariantes IMG-ACR-01 > inv_egfr_threshold_unknown_never_demotes [0.10ms]
(pass) tabela-verdade / regressão com itens da auditoria > tt_01_exato_proposto_top_ok (#7 SBO: TC abd/pelve c/) [0.03ms]
(pass) tabela-verdade / regressão com itens da auditoria > tt_02_proposto_UNA_warning (#29 RM lombar c/ em 141 V4 = UNA 3) [0.02ms]
(pass) tabela-verdade / regressão com itens da auditoria > tt_03_proposto_MBA_warning (#23 TC tórax s/ em 105 V1 = MB 6) [0.03ms]
(pass) tabela-verdade / regressão com itens da auditoria > tt_04_proposto_UA_nao_topo (#20a TC tórax c/ [7] < RX [9]) [0.02ms]
(pass) tabela-verdade / regressão com itens da auditoria > tt_05_contraste_difere (#25 TC c/ [8] vs TC s/ [9]) [0.03ms]
(pass) tabela-verdade / regressão com itens da auditoria > tt_06_proxy_e_variante_geral_em_onco_warning [0.05ms]
(pass) tabela-verdade / regressão com itens da auditoria > tt_07_variante_onco_especifica_sem_warning (#1 339 V5) [0.02ms]
(pass) tabela-verdade / regressão com itens da auditoria > tt_08_contraste_iodado_contraindicado_rebaixa (#7) [0.03ms]
(pass) tabela-verdade / regressão com itens da auditoria > tt_09_dispositivo_MR_unsafe_todo_UA_RM (#1 339 V5) [0.02ms]
(pass) tabela-verdade / regressão com itens da auditoria > tt_10_instavel_rebaixa_RM_e_eleva_urgencia (271 V2 empate 7/7/7) [0.05ms]
(pass) tabela-verdade / regressão com itens da auditoria > tt_11_gestacao_anota_nao_reordena [0.04ms]
(pass) tabela-verdade / regressão com itens da auditoria > tt_12_limiar_egfr_configurado_com_fonte_rebaixa [0.06ms]

 24 pass
 0 fail
 35677 expect() calls
Ran 24 tests across 1 file. [45.00ms]
```
**Resultado: PASS (24/24).** Limitações dos testes:
- Os testes validam a lógica sobre as fixtures; não validam a extração dos PDFs.
- Ainda falta a conferência dupla humana dos 357 procedimentos antes de promover a F3.
- Também falta a tabela de normalização do vocabulário (pt-BR → ACR).

---

## 9. Riscos consolidados
### Clínicos
1. **Terminologia de contraste** ("c/" vs "s/c"):
   - Gera DIVERGENT espúrio ou real (#5, #29).
   - Em 141 V4, "MRI lumbar spine with IV contrast" = UNA 3; em Headache V7 e AMS V1, "MRI head with IV contrast" = UNA 1.
   - É preciso normalizar antes do gate.
2. **Colite por ICI (#17):** a ESMO 2022 diz que a TC **não** é recomendada para diagnóstico [IV, E]; a ASCO 2021 indica TC só para complicações. A proposta "TC c/ IV" como diagnóstico conflita com as duas.
3. **Derrame pleural maligno (#20a):** BTS 2023 (US em toda apresentação; TC tórax/abdome/pelve) × ACR (US = MB 5; RX no topo). Um gate só com ACR rebaixaria o US.
4. **Compressão medular (#1):** a NICE NG234 pede coluna inteira, **sem** exigir contraste; o ACR avalia por região, com RM s/c no topo. Risco de atrasar a RM por exigir gadolínio.
5. **Pneumonite por ICI (#16):** ESMO (HRCT com contraste) × ACR 284 V2 (TC c/ = MB 5).
6. **Aspergilose (#23):** como exame inicial, o ACR põe o RX (TC = MB 6). Em neutropênico febril, o fluxo pode exigir TC direta. Fica WARNING para decisão humana.
7. **26/28 variantes são gerais** e são aplicadas a pacientes oncológicos (viés de espectro). Não há variante para tamponamento, ruptura de CHC, blowout, PRES, colite por ICI ou FTE maligna.
8. **IA × tumor:** Brainomix ICH excluiu tumores da IFU; syngo LVO é contraindicado com tumor; tumores são causa conhecida de FP de HIC. Na população ONCOMIND, as métricas da 510(k) não se aplicam.

### Regulatórios
- FDA ≠ ANVISA. O status ANVISA dos 18 produtos é **UNKNOWN**.
- RDC 657/2022 (SaMD): https://www.in.gov.br/web/dou/-/resolucao-de-diretoria-colegiada-rdc-n-657-de-24-de-marco-de-2022-389603457
- CFM 2.454/2026 (IA como apoio, registro em prontuário, mediação humana; vigência 26/08/2026): https://portal.cfm.org.br/noticias/regras-sobre-uso-da-ia-na-medicina-entram-em-vigor-no-dia-26-de-agosto/
- O gate que gera lista de exames pode ser enquadrado como SaMD: **classe ANVISA UNKNOWN**.

### Licenciamento
- Usar o conteúdo do ACR AC em produto exige permissão: "Requesting Permission to Use ACR Appropriateness Criteria — Please complete the ACR Permission Request form" (https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Appropriateness-Criteria).
- O CDS licenciado oficial é o ACR Select: https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Clinical-Decision-Support
- **Termos e custos: UNKNOWN.** Embutir os ratings nas fixtures sem licença é um risco.

### Dados
- O "ano" é o **rótulo da versão** (New/Revised), não a data da última revisão anual. Isso fica UNKNOWN para todos.
- O 289 (2026) foi **inferido** de PII/DOI e não confirmado no acsearch (página com erro; o JACR bloqueado por Cloudflare).
- Os ratings foram extraídos por parser de PDF (ReleaseId 107):
  - artefatos conhecidos: rótulos quebrados em linhas;
  - linhas de apêndice descartadas;
  - **falta conferência dupla humana**.
- Os ratings mudam a cada versão. O gate precisa versionar ReleaseId e URL, e ter um teste de regressão quando a versão mudar.
- O estudo do CINA-VCF usou a versão "Quantix v0.7", cuja correspondência com o K240612 é UNKNOWN.
- O CINA (ICH+LVO) está com o número K não verificado.

### IA
- Nenhuma 510(k) de B3 traz métrica de subgrupo oncológico (§6.3).
- Só 2/18 produtos têm estudo oncológico publicado, ambos do mesmo fabricante (Avicenna).
- **VPP baixo em baixa prevalência:** o CINA-iPE teve VPP 34,62% em oncologia, com 68 FP em 104 alertas. Isso gera risco de fadiga de alerta.
- A IA nunca pode ser gate; ela só pode subir urgência e rotear para humano (garantido pelos invariantes `inv_ai_*`).
- Drift/versão do modelo: é preciso registrar `modelVersion`, seguindo o ACR-SIIM Practice Parameter 2026 e o Assess-AI (v1 §B5–B7).

---

## 10. UNKNOWNs remanescentes
1. **Datas da última revisão anual** (sem alteração) de todos os tópicos. O 289 tem ano inferido; o 233 (só proxy) não tem rótulo no ACR.
2. **Diretrizes:**
   - NCCN (login) e SBOC (sem diretriz específica).
   - Imagem para #10 ruptura de CHC, #19 blowout carotídeo, #20b pneumotórax hipertensivo e #32 PRES (para este, só a bula do Avastin).
   - ERS/EACTS (pleural) não buscado.
   - EANO–ESMO 2023 (LM) não lido.
3. **IA:** performance oncológica de 16/18 produtos; número K do CINA ICH/LVO; correspondência CINA-VCF Quantix v0.7 ↔ K240612; status ANVISA de todos.
4. **Clínico/vocabulário:**
   - contraste oral/retal (#24);
   - definição de "multifásica" (#10, #18, #33; na isquemia mesentérica, TC s/c = UNA 3);
   - ossos longos/Mirels (#13);
   - "alta resolução" (#23, #16);
   - limiares de eGFR (o gate não usa nenhum número sem fonte).
5. **Licença ACR:** termos e custos.
6. **Classe ANVISA** do ONCOMIND / do gate.

---

## 11. Arquivos
- Este relatório: `/workspace/acr-check/AUDITORIA-ACR-v2.md`
- CSV da tabela principal: `/workspace/acr-check/AUDITORIA-ACR-v2.csv`
- Fonte única dos itens: `/workspace/acr-check/v2/items.py` → `items.json`
- Gate: `/workspace/acr-check/v2/gate/gate.ts`, `gate.test.ts`, `acr_fixtures.json`, `test_output.txt`
- Rótulos de ano: `/workspace/acr-check/narr_labels.json`
- PDFs/textos ACR: `/workspace/acr-check/pdf/`, `/workspace/acr-check/txt/`
- 510(k): `/workspace/acr-check/fda510/`
- Diretrizes: `/workspace/acr-check/guidelines/`
