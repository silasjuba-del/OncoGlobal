# F1-B2 · Quadros de revisão das fichas B2 (GERADO — não editar à mão)

> Gerado por `scripts/gerar-dossie-fichas.mjs` a partir de `corpus/fichas/**` + `corpus/manifesto/b2-fichas.v1.json` (D-F1-49).
> Toda ficha está em **RASCUNHO**: nada aqui está ativo clinicamente; aprovação é item a item (versão/hash).
> Fontes externas com URL/versão/SHA-256 em b2-fichas.v1.json; evidências em bytes: pastas de 2026-10-14 (f1-b2-fontes-externas).

## NAO-INFORMADO-FICHA-INSTITUCIONAL

### Folinato + 5-FU semanal (P1577) — não especificado

- **templateId:** `FICHA.nao-informado-ficha-institucional.folinato-5-fu-semanal-p1577__nao-especificado@1.0.0` · **versão:** 1.0.0 · **hash:** `c33d53d3014628bd…` · **status:** RASCUNHO · **código:** P1577
- **Intervalo:** — [VERIFICAR] d · **Ciclos:** —
- **Identidade clínica:** Folinato 20 mg/m² + 5-FU semanal, D1–D36 (D-F1-26); tumor de origem não comprovado
- **Fonte da ficha:** D-F1-26 (identidade P1577: folinato 20 mg/m² + 5-FU semanal D1–D36, ficha própria, SEM vínculo com Roswell Park) e D-F1-49 (ficha institucional nova sem SISAC; mudança de fonte não aprova doses). Fontes externas F1-B2 (2026-10-14): EXT-LEG-001 (eviQ (Cancer Institute NSW), ID 1494 — Colorectal cancer adjuvant QUASAR weekly fluorouracil and folinic acid, v7, acesso 2026-10-14; sha256 integro em corpus/manifesto/b2-fichas.v1.json); EXT-LEG-002 (eviQ, ID 98 — Colorectal cancer metastatic QUASAR weekly fluorouracil and folinic acid, v6, acesso 2026-10-14; sha256 integro em corpus/manifesto/b2-fich …

| # | Item | Classe | Dose | Unid. | Base | Via | Diluente | Vol. | Tempo | Dias | Situação | Fontes |
|---|------|--------|------|-------|------|------|----------|------|-------|------|----------|--------|
| 1 | Soro fisiológico 0,9% 250 mL (lavagem de acesso) | PRE_QT | 1 | frasco | FIXED | EV | — | 250 | — | d1 | padrão local | — |
| 2 | Ondansetrona | PRE_QT | 8 | mg | FIXED | EV | — | — | 15 min | d1 | padrão local | — |
| 3 | Dexametasona | PRE_QT | 10 | mg | FIXED | EV | — | — | 15 min | d1 | padrão local | — |
| 4 | Prometazina | PRE_QT | 25 | mg | FIXED | VO | — | — | — | d1 | padrão local | — |
| 5 | Folinato de cálcio (leucovorina) | QT | 20 | mg/m² | MG_M2 | EV | — | — | — | d1, d8, d15, d22, d29, d36 | DECISÃO LOCAL (D-F1-26 (folinato 20 mg/m² semanal)) | — |
| 6 | Fluoruracila (5-FU) | QT | **null** | mg/m² | MG_M2 | EV | — | — | — | d1, d8, d15, d22, d29, d36 | **NAO_LOCALIZADO** | — |
| 7 | Soro fisiológico 0,9% 250 mL (lavagem pós-QT) | POS_QT | 1 | frasco | FIXED | EV | — | 250 | — | d1 | padrão local | — |

**Divergências registradas:**
- Nenhuma fonte externa vigente usa folinato 20 mg/m² no semanal: QUASAR (eviQ 1494/98) usa folinato 50 mg fixa + 5-FU 370 mg/m²; Roswell Park modificado (eviQ 1271/1275) usa folinato 50 mg fixa + 5-FU 500 mg/m² D1,8,15,22,29,36 em ciclo de 56 d; BC GIAVFL traz LV 20 mg/m² IV push apenas como opção (metastático)

**Lacunas (impedem ativação):**
- dose do 5-FU sem fonte aplicável à variante local (folinato 20): null [VERIFICAR]
- duração do ciclo não decidida localmente (Roswell mod.: 56 d) [VERIFICAR]

> ⚠️ Itens com `[VERIFICAR]` nesta ficha permanecem pendentes — a ficha é dossiê de curadoria até decisão.

### 5-FU + Folinato (FLOX — P1512) — não especificado

- **templateId:** `FICHA.nao-informado-ficha-institucional.5-fu-folinato-flox-p1512__nao-especificado@1.0.0` · **versão:** 1.0.0 · **hash:** `b6d5e6f62869877f…` · **status:** RASCUNHO · **código:** P1512
- **Intervalo:** — [VERIFICAR] d · **Ciclos:** —
- **Identidade clínica:** 5-FU + folinato em D1 e D2 (D-F1-27); sem oxaliplatina; tumor de origem não comprovado
- **Fonte da ficha:** D-F1-27 (FLOX/P1512: 5-FU + folinato em D1 E D2 — corrige o texto 5, que trazia só D1) e D-F1-49. Fontes externas F1-B2 (2026-10-14): EXT-LEG-006 (eviQ, ID 79 — Colorectal cancer adjuvant Mayo Clinic (DESCONTINUADO), v3 (descontinuado), acesso 2026-10-14; sha256 integro em corpus/manifesto/b2-fichas.v1.json); EXT-LEG-004 (eviQ, ID 1271 — Colorectal cancer adjuvant Roswell Park, v6, acesso 2026-10-14; sha256 integro em corpus/manifesto/b2-fichas.v1.json). A planilha oncoMed rotulava 'FLOX' sem oxaliplatina (FA 20 + 5-FU 500): traço institucional secundário com erros conhecidos — doses não adota …

| # | Item | Classe | Dose | Unid. | Base | Via | Diluente | Vol. | Tempo | Dias | Situação | Fontes |
|---|------|--------|------|-------|------|------|----------|------|-------|------|----------|--------|
| 1 | Soro fisiológico 0,9% 250 mL (lavagem de acesso) | PRE_QT | 1 | frasco | FIXED | EV | — | 250 | — | d1 | padrão local | — |
| 2 | Ondansetrona | PRE_QT | 8 | mg | FIXED | EV | — | — | 15 min | d1 | padrão local | — |
| 3 | Dexametasona | PRE_QT | 10 | mg | FIXED | EV | — | — | 15 min | d1 | padrão local | — |
| 4 | Prometazina | PRE_QT | 25 | mg | FIXED | VO | — | — | — | d1 | padrão local | — |
| 5 | Folinato de cálcio (leucovorina) | QT | **null** | mg/m² | MG_M2 | EV | — | — | — | d1, d2 | **NAO_LOCALIZADO** | — |
| 6 | Fluoruracila (5-FU) | QT | **null** | mg/m² | MG_M2 | EV | — | — | — | d1, d2 | **NAO_LOCALIZADO** | — |
| 7 | Soro fisiológico 0,9% 250 mL (lavagem pós-QT) | POS_QT | 1 | frasco | FIXED | EV | — | 250 | — | d1 | padrão local | — |

**Divergências registradas:**
- Regimes D1–D2 vigentes nas fontes são infusionais (de Gramont: LV 50 mg + 5-FU 400 bolus + 2.400 CIV 46 h q14d) — não bolus puro de 2 dias
- Mayo (D1–D5 bolus) DESCONTINUADO por toxicidade (eviQ 79 v3)

**Lacunas (impedem ativação):**
- doses de folinato e 5-FU não decididas localmente para o P1512 (D-F1-27 fixa só os dias D1 e D2): null [VERIFICAR]
- intervalo não decidido (de Gramont: 14 d) [VERIFICAR]

> ⚠️ Itens com `[VERIFICAR]` nesta ficha permanecem pendentes — a ficha é dossiê de curadoria até decisão.

## PRIMARIO-DESCONHECIDO-CUP

### Cisplatina + Docetaxel — não especificado

- **templateId:** `FICHA.primario-desconhecido-cup.cisplatina-docetaxel__nao-especificado@1.0.0` · **versão:** 1.0.0 · **hash:** `278fb176810989ec…` · **status:** RASCUNHO
- **Intervalo:** 21 d · **Ciclos:** —
- **Identidade clínica:** CUP metastático, 1ª linha (D-F1-36); variante preparada: Greco 2000 75/75 q3sem
- **Fonte da ficha:** D-F1-36 (lista de esquemas de CUP) e D-F1-49. Variante preparada: Greco 2000 (75/75 q3sem, máx 8 ciclos). Fontes: EXT-CUP-001 (Annals of Oncology (Minnie Pearl Network — Greco FA et al.), Carcinoma of unknown primary site: phase II trials with docetaxel plus cisplatin or carboplatin (Ann Oncol 2000;11(2):211-5), PMID 10761758, acesso 2026-10-14; sha256 integro em corpus/manifesto/b2-fichas.v1.json); EXT-CUP-003 (Am J Clin Oncol (Mukai H et al.), Safety and efficacy of docetaxel and cisplatin in unknown primary cancer (Am J Clin Oncol 2010;33(1):32-5), PMID 19786850, acesso 2026-10-14; sha256 i …

| # | Item | Classe | Dose | Unid. | Base | Via | Diluente | Vol. | Tempo | Dias | Situação | Fontes |
|---|------|--------|------|-------|------|------|----------|------|-------|------|----------|--------|
| 1 | Soro fisiológico 0,9% 250 mL (lavagem de acesso) | PRE_QT | 1 | frasco | FIXED | EV | — | 250 | — | d1 | padrão local | — |
| 2 | Ondansetrona | PRE_QT | 8 | mg | FIXED | EV | — | — | 15 min | d1 | padrão local | — |
| 3 | Dexametasona | PRE_QT | 10 | mg | FIXED | EV | — | — | 15 min | d1 | padrão local | — |
| 4 | Prometazina | PRE_QT | 25 | mg | FIXED | VO | — | — | — | d1 | padrão local | — |
| 5 | Cimetidina | PRE_QT | 300 | mg | FIXED | EV | — | — | 15 min | d1 | padrão local | — |
| 6 | Docetaxel | QT | 75 | mg/m² | MG_M2 | EV | SF 0,9% | 250 | 60 min | d1 | documentado | `EXT-CUP-001` |
| 7 | Soro fisiológico 0,9% 500 mL (pré-cisplatina) | PRE_QT | 1 | frasco | FIXED | EV | — | 500 | 20 min | d1 | padrão local | — |
| 8 | Sulfato de magnésio 10% 10 mL | PRE_QT | 10 | mL | FIXED | EV | — | — | — | d1 | padrão local | — |
| 9 | Cloreto de potássio 19,1% 4 mL | PRE_QT | 4 | mL | FIXED | EV | — | — | — | d1 | padrão local | — |
| 10 | Cisplatina | QT | 75 | mg/m² | MG_M2 | EV | — | — | 60 min | d1 | documentado | `EXT-CUP-001` |
| 11 | Manitol 20% frasco 250 mL | QT | 1 | frasco | FIXED | EV | — | 250 | 60 min | d1 | padrão local | — |
| 12 | Soro fisiológico 0,9% 500 mL (pós-cisplatina) | POS_QT | 1 | frasco | FIXED | EV | — | 500 | 20 min | d1 | padrão local | — |
| 13 | Cloreto de potássio 19,1% 4 mL | POS_QT | 4 | mL | FIXED | EV | — | — | — | d1 | padrão local | — |
| 14 | Soro fisiológico 0,9% 250 mL (lavagem pós-QT) | POS_QT | 1 | frasco | FIXED | EV | — | 250 | — | d1 | padrão local | — |

**Divergências registradas:**
- Greco 2000: docetaxel 75 + cisplatina 75 q3sem (n=26, máx 8 ciclos, toxicidade GI substancial)
- Mukai 2010: docetaxel 60 (1 h, antes) + cisplatina 80 (2 h) q3sem (n=45, ORR 65%)

**Lacunas (impedem ativação):**
- escolha de variante (75/75 × 60/80) pendente de decisão do Dr. Silas

### Carboplatina + Paclitaxel 21/21 dias — não especificado

- **templateId:** `FICHA.primario-desconhecido-cup.carboplatina-paclitaxel-21-21-dias__nao-especificado@1.0.0` · **versão:** 1.0.0 · **hash:** `0e9f34013d0b29b4…` · **status:** RASCUNHO
- **Intervalo:** 21 d · **Ciclos:** —
- **Identidade clínica:** CUP, 1ª linha (D-F1-36); variante preparada: BC PUCAT/HeCOG (paclitaxel 200 → carbo AUC 6)
- **Fonte da ficha:** D-F1-36 e D-F1-49. Variante preparada: PUCAT/HeCOG. Fontes: EXT-CUP-004 (BC Cancer, PUCAT — Primary Treatment of Cancer of Unknown Primary using CARBOplatin and PACLitaxel, rev 01/12/2024, acesso 2026-10-14; sha256 integro em corpus/manifesto/b2-fichas.v1.json); EXT-CUP-006 (J Clin Oncol (HeCOG — Briasoulis E et al.), Carboplatin plus paclitaxel in unknown primary carcinoma: phase II (JCO 2000;18(17):3101-7), PMID 10963638, acesso 2026-10-14; sha256 integro em corpus/manifesto/b2-fichas.v1.json). Variante local SOnHe (AUC 5 + 175) documentada em Protocolos SOnHe 2024, p. 379 (sha256 d201d11819 …

| # | Item | Classe | Dose | Unid. | Base | Via | Diluente | Vol. | Tempo | Dias | Situação | Fontes |
|---|------|--------|------|-------|------|------|----------|------|-------|------|----------|--------|
| 1 | Soro fisiológico 0,9% 250 mL (lavagem de acesso) | PRE_QT | 1 | frasco | FIXED | EV | — | 250 | — | d1 | padrão local | — |
| 2 | Ondansetrona | PRE_QT | 8 | mg | FIXED | EV | — | — | 15 min | d1 | padrão local | — |
| 3 | Dexametasona | PRE_QT | 10 | mg | FIXED | EV | — | — | 15 min | d1 | padrão local | — |
| 4 | Prometazina | PRE_QT | 25 | mg | FIXED | VO | — | — | — | d1 | padrão local | — |
| 5 | Cimetidina | PRE_QT | 300 | mg | FIXED | EV | — | — | 15 min | d1 | padrão local | — |
| 6 | Paclitaxel | QT | 200 | mg/m² | MG_M2 | EV | — | — | 3 h | d1 | documentado | `EXT-CUP-004` `EXT-CUP-006` |
| 7 | Carboplatina | QT | 6 | AUC | AUC | EV | — | — | 60 min | d1 | documentado | `EXT-CUP-004` `EXT-CUP-006` |
| 8 | Soro fisiológico 0,9% 250 mL (lavagem pós-QT) | POS_QT | 1 | frasco | FIXED | EV | — | 250 | — | d1 | padrão local | — |

**Divergências registradas:**
- BC PUCAT (rev 12/2024, único protocolo institucional específico de CUP): paclitaxel 200 mg/m² 3 h PRIMEIRO + carboplatina AUC 6
- HeCOG (JCO 2000): mesmas doses com G-CSF D5–12
- SOnHe p. 379 (material local): AUC 5 + 175 — variante alternativa [decisão pendente]

**Lacunas (impedem ativação):**
- escolha de variante (200/AUC6 × 175/AUC5) pendente de decisão do Dr. Silas

### Docetaxel + Gemcitabina — não especificado

- **templateId:** `FICHA.primario-desconhecido-cup.docetaxel-gemcitabina__nao-especificado@1.0.0` · **versão:** 1.0.0 · **hash:** `cb42a75da17db139…` · **status:** RASCUNHO
- **Intervalo:** 21 d · **Ciclos:** —
- **Identidade clínica:** CUP, 1ª linha (D-F1-36); variante preparada: Pouessel 2004 (gem D1/D8 + doc D8)
- **Fonte da ficha:** D-F1-36 e D-F1-49. Fonte: EXT-CUP-009 (Cancer (Pouessel D et al.), Gemcitabine and docetaxel as front-line chemotherapy in unknown primary (Cancer 2004;100(6):1257-61), PMID 15022294, acesso 2026-10-14; sha256 integro em corpus/manifesto/b2-fichas.v1.json). Correção de citação registrada: o estudo original de CUP é Pouessel 2004, não Hainsworth.

| # | Item | Classe | Dose | Unid. | Base | Via | Diluente | Vol. | Tempo | Dias | Situação | Fontes |
|---|------|--------|------|-------|------|------|----------|------|-------|------|----------|--------|
| 1 | Soro fisiológico 0,9% 250 mL (lavagem de acesso) | PRE_QT | 1 | frasco | FIXED | EV | — | 250 | — | d1, d8 | padrão local | — |
| 2 | Ondansetrona | PRE_QT | 8 | mg | FIXED | EV | — | — | 15 min | d1, d8 | padrão local | — |
| 3 | Dexametasona | PRE_QT | 10 | mg | FIXED | EV | — | — | 15 min | d1, d8 | padrão local | — |
| 4 | Prometazina | PRE_QT | 25 | mg | FIXED | VO | — | — | — | d1, d8 | padrão local | — |
| 5 | Cimetidina | PRE_QT | 300 | mg | FIXED | EV | — | — | 15 min | d8 | padrão local | — |
| 6 | Gemcitabina | QT | 1000 | mg/m² | MG_M2 | EV | — | — | 30 min | d1, d8 | documentado | `EXT-CUP-009` |
| 7 | Docetaxel | QT | 75 | mg/m² | MG_M2 | EV | SF 0,9% | 250 | 60 min | d8 | documentado | `EXT-CUP-009` |
| 8 | Soro fisiológico 0,9% 250 mL (lavagem pós-QT) | POS_QT | 1 | frasco | FIXED | EV | — | 250 | — | d1, d8 | padrão local | — |

**Divergências registradas:**
- Pouessel 2004 (Cancer): gemcitabina 1.000 mg/m² D1 e D8 (30 min) + docetaxel 75 mg/m² D8 (1 h); q3sem, máx 6 — corrige o mapa local (que estimava 75/900 ou 60/800 e atribuía a Hainsworth)

### Cisplatina + Vinorelbina — não especificado

- **templateId:** `FICHA.primario-desconhecido-cup.cisplatina-vinorelbina__nao-especificado@1.0.0` · **versão:** 1.0.0 · **hash:** `a650d0fe458b150e…` · **status:** RASCUNHO
- **Intervalo:** — [VERIFICAR] d · **Ciclos:** —
- **Identidade clínica:** CUP (D-F1-36); fonte direta da DUPLA não localizada — ficha-dossiê (todos os campos de dose NAO_LOCALIZADO)
- **Fonte da ficha:** D-F1-36 e D-F1-49. Dupla sem fonte direta após busca documentada (EXT-CUP-016 e registro de buscas no relatório F1-B2). Contexto/negação: EXT-CUP-012 (Cancer (Palmeri S et al.), Cisplatin and gemcitabine with either vinorelbine or paclitaxel in CUP — TRIPLA (contexto/negação da dupla), PMID 17109447, acesso 2026-10-14; sha256 integro em corpus/manifesto/b2-fichas.v1.json). Ficha existe como dossiê de curadoria — não entra no fluxo operacional enquanto a lacuna persistir.

| # | Item | Classe | Dose | Unid. | Base | Via | Diluente | Vol. | Tempo | Dias | Situação | Fontes |
|---|------|--------|------|-------|------|------|----------|------|-------|------|----------|--------|
| 1 | Soro fisiológico 0,9% 250 mL (lavagem de acesso) | PRE_QT | 1 | frasco | FIXED | EV | — | 250 | — | d1, d8 | padrão local | — |
| 2 | Ondansetrona | PRE_QT | 8 | mg | FIXED | EV | — | — | 15 min | d1, d8 | padrão local | — |
| 3 | Dexametasona | PRE_QT | 10 | mg | FIXED | EV | — | — | 15 min | d1, d8 | padrão local | — |
| 4 | Prometazina | PRE_QT | 25 | mg | FIXED | VO | — | — | — | d1, d8 | padrão local | — |
| 5 | Vinorelbina | QT | **null** | mg/m² | MG_M2 | EV | — | — | 10 min | d1, d8 | **NAO_LOCALIZADO** | — |
| 6 | Soro fisiológico 0,9% 500 mL (pré-cisplatina) | PRE_QT | 1 | frasco | FIXED | EV | — | 500 | 20 min | d1 | padrão local | — |
| 7 | Sulfato de magnésio 10% 10 mL | PRE_QT | 10 | mL | FIXED | EV | — | — | — | d1 | padrão local | — |
| 8 | Cloreto de potássio 19,1% 4 mL | PRE_QT | 4 | mL | FIXED | EV | — | — | — | d1 | padrão local | — |
| 9 | Cisplatina | QT | **null** | mg/m² | MG_M2 | EV | — | — | 60 min | d1 | **NAO_LOCALIZADO** | — |
| 10 | Manitol 20% frasco 250 mL | QT | 1 | frasco | FIXED | EV | — | 250 | 60 min | d1 | padrão local | — |
| 11 | Soro fisiológico 0,9% 500 mL (pós-cisplatina) | POS_QT | 1 | frasco | FIXED | EV | — | 500 | 20 min | d1 | padrão local | — |
| 12 | Cloreto de potássio 19,1% 4 mL | POS_QT | 4 | mL | FIXED | EV | — | — | — | d1 | padrão local | — |
| 13 | Soro fisiológico 0,9% 250 mL (lavagem pós-QT) | POS_QT | 1 | frasco | FIXED | EV | — | 250 | — | d1, d8 | padrão local | — |

**Divergências registradas:**
- A única combinação cisplatina+vinorelbina+gemcitabina em CUP é a TRIPLA de Palmeri 2006 — retirar a gemcitabina NÃO é transcrição (proibido por D-F1-49/instrução)

**Lacunas (impedem ativação):**
- dose de vinorelbina: NAO_LOCALIZADO (buscas PubMed/eviQ/BC/CCO/ClinicalTrials.gov documentadas em RELATORIO-CUP.md)
- dose de cisplatina: NAO_LOCALIZADO para a dupla em CUP
- dias e intervalo: não comprovados [VERIFICAR]

> ⚠️ Itens com `[VERIFICAR]` nesta ficha permanecem pendentes — a ficha é dossiê de curadoria até decisão.

### Cisplatina + 5-Fluorouracil (CUP escamoso) — escamoso metastático (primário oculto)

- **templateId:** `FICHA.primario-desconhecido-cup.cisplatina-5-fluorouracil-cup-escamoso__escamoso-metastatico-primario-oculto@1.0.0` · **versão:** 1.0.0 · **hash:** `fea3d48956b37f56…` · **status:** RASCUNHO
- **Intervalo:** 21 d · **Ciclos:** —
- **Identidade clínica:** CUP de histologia escamosa com investigação de cabeça e pescoço completa negativa (Khansur 1995)
- **Fonte da ficha:** D-F1-36 e D-F1-49. Fonte: EXT-CUP-010 (Cancer Invest (Khansur T et al.), Cisplatin and 5-fluorouracil for metastatic squamous cell carcinoma from unknown primary (1995;13(3):263-6), PMID 7743377, acesso 2026-10-14; sha256 integro em corpus/manifesto/b2-fichas.v1.json). Protocolo operacional análogo (população distinta — H&N): EXT-CUP-011 (eviQ, ID 288 — Head and neck SCC recurrent/metastatic ciSplatin and fluorouracil, v5, acesso 2026-10-14; sha256 integro em corpus/manifesto/b2-fichas.v1.json). População da variante preparada: escamosa, com investigação H&N completa negativa.

| # | Item | Classe | Dose | Unid. | Base | Via | Diluente | Vol. | Tempo | Dias | Situação | Fontes |
|---|------|--------|------|-------|------|------|----------|------|-------|------|----------|--------|
| 1 | Soro fisiológico 0,9% 250 mL (lavagem de acesso) | PRE_QT | 1 | frasco | FIXED | EV | — | 250 | — | d1 | padrão local | — |
| 2 | Ondansetrona | PRE_QT | 8 | mg | FIXED | EV | — | — | 15 min | d1 | padrão local | — |
| 3 | Dexametasona | PRE_QT | 10 | mg | FIXED | EV | — | — | 15 min | d1 | padrão local | — |
| 4 | Prometazina | PRE_QT | 25 | mg | FIXED | VO | — | — | — | d1 | padrão local | — |
| 5 | Soro fisiológico 0,9% 500 mL (pré-cisplatina) | PRE_QT | 1 | frasco | FIXED | EV | — | 500 | 20 min | d1 | padrão local | — |
| 6 | Sulfato de magnésio 10% 10 mL | PRE_QT | 10 | mL | FIXED | EV | — | — | — | d1 | padrão local | — |
| 7 | Cloreto de potássio 19,1% 4 mL | PRE_QT | 4 | mL | FIXED | EV | — | — | — | d1 | padrão local | — |
| 8 | Cisplatina | QT | 100 | mg/m² | MG_M2 | EV | — | — | 60 min | d1 | documentado | `EXT-CUP-010` |
| 9 | Manitol 20% frasco 250 mL | QT | 1 | frasco | FIXED | EV | — | 250 | 60 min | d1 | padrão local | — |
| 10 | Fluoruracila (5-FU) infusão contínua 24 h/dia | QT | 1000 | mg/m² | MG_M2 | EV | — | — | 24 h | d1-d4 | documentado | `EXT-CUP-010` |
| 11 | Soro fisiológico 0,9% 500 mL (pós-cisplatina) | POS_QT | 1 | frasco | FIXED | EV | — | 500 | 20 min | d1 | padrão local | — |
| 12 | Cloreto de potássio 19,1% 4 mL | POS_QT | 4 | mL | FIXED | EV | — | — | — | d1 | padrão local | — |
| 13 | Soro fisiológico 0,9% 250 mL (lavagem pós-QT) | POS_QT | 1 | frasco | FIXED | EV | — | 250 | — | d1 | padrão local | — |

**Divergências registradas:**
- Khansur 1995 (n=15): cisplatina 100 D1 + 5-FU 1.000 mg/m²/dia CI ×4 dias, q21d — população ESCAMOSA
- eviQ 288 (população H&N R/M, operacional): cisplatina 75 (100 no ensaio original, reduzida por consenso) + 5-FU 4.000 CIV 96 h

**Lacunas (impedem ativação):**
- aplicabilidade restrita: NÃO generalizar para CUP não-escamoso

## EWING

### Ewing VDC (ciclo A — alternado ao IE) — 1ª linha, dose-denso q14

- **templateId:** `FICHA.ewing.ewing-vdc-ciclo-a-alternado-ao-ie__1-linha-dose-denso-q14@1.0.0` · **versão:** 1.0.0 · **hash:** `3743c536c570f5a8…` · **status:** RASCUNHO
- **Intervalo:** 14 d · **Ciclos:** 7
- **Identidade clínica:** Ewing localizado/metastático, 1ª linha VDC/IE interval-compressed (SBOC 2026 ósseos p. 15; Womer 2012)
- **Fonte da ficha:** D-F1-34 e D-F1-49. Base do q2sem: Womer 2012 (AEWS0031) — EXT-SARC-022 (J Clin Oncol (Womer RB et al. — AEWS0031), Interval-compressed chemotherapy for Ewing sarcoma (JCO 2012;30(33):4148-54), PMID 23091096, acesso 2026-10-14; sha256 integro em corpus/manifesto/b2-fichas.v1.json) (correção: 'Whelan JCO 2018' é Euro-E.W.I.N.G. 99/BuMel, não VDC/IE dose-denso). Protocolos operacionais: EXT-SARC-001 (eviQ, ID 3464 — Ewing sarcoma VDC/IE overview, v2 (review due 31/12/2026), acesso 2026-10-14; sha256 integro em corpus/manifesto/b2-fichas.v1.json); EXT-SARC-002 (eviQ, ID 1916 — Ewing sarcoma VDC (p …

| # | Item | Classe | Dose | Unid. | Base | Via | Diluente | Vol. | Tempo | Dias | Situação | Fontes |
|---|------|--------|------|-------|------|------|----------|------|-------|------|----------|--------|
| 1 | Soro fisiológico 0,9% 250 mL (lavagem de acesso) | PRE_QT | 1 | frasco | FIXED | EV | — | 250 | — | d1 | padrão local | — |
| 2 | Ondansetrona | PRE_QT | 8 | mg | FIXED | EV | — | — | 15 min | d1 | padrão local | — |
| 3 | Dexametasona | PRE_QT | 10 | mg | FIXED | EV | — | — | 15 min | d1 | padrão local | — |
| 4 | Prometazina | PRE_QT | 25 | mg | FIXED | VO | — | — | — | d1 | padrão local | — |
| 5 | Vincristina | QT | 1.5 | mg/m² | MG_M2 | EV | — | — | 15 min | d1 | documentado | `EXT-SARC-002` `EXT-SARC-009` `EXT-SARC-022` |
| 6 | Doxorrubicina | QT | 37.5 | mg/m² | MG_M2 | EV | — | — | 15 min | d1, d2 | documentado | `EXT-SARC-002` |
| 7 | Ciclofosfamida | QT | 1200 | mg/m² | MG_M2 | EV | SF 0,9% | 100 | 15 min | d1 | documentado | `EXT-SARC-002` |
| 8 | Mesna (0 h) | QT | 400 | mg/m² | MG_M2 | EV | — | — | 15 min | d1 | documentado | `EXT-SARC-002` |
| 9 | Mesna (2 h, VO) | POS_QT | 800 | mg/m² | MG_M2 | VO | — | — | — | d1 | documentado | `EXT-SARC-002` |
| 10 | Mesna (6 h, VO) | POS_QT | 800 | mg/m² | MG_M2 | VO | — | — | — | d1 | documentado | `EXT-SARC-002` |
| 11 | Pegfilgrastim | POS_QT | 6 | mg | FIXED | SC | — | — | — | d3 | documentado | `EXT-SARC-002` |
| 12 | Soro fisiológico 0,9% 250 mL (lavagem pós-QT) | POS_QT | 1 | frasco | FIXED | EV | — | 250 | — | d1 | padrão local | — |

**Divergências registradas:**
- doxorrubicina: eviQ 37,5 mg/m² ×2 (D1–D2, 5–15 min) × BC SAALT2W 75 mg/m² IV push D1 (dose única) × Womer abstract 75 mg/m²
- vincristina: 1,5 mg/m² (cap 2 mg) no eviQ/BC × 2 mg/m² no abstract de Womer
- G-CSF: pegfilgrastim 6 mg D3 (eviQ) × filgrastim a partir do D8 (BC)
- antiesse local sem NK1 (D-F1-30) × esquema eviQ com netupitant/palonosetrona

**Lacunas (impedem ativação):**
- versão convencional q3sem (eviQ 'VDC or IE every 21 days') disponível como alternativa — variante não preparada aqui

### Ewing IE (ciclo B — alternado ao VDC) — 1ª linha, dose-denso q14

- **templateId:** `FICHA.ewing.ewing-ie-ciclo-b-alternado-ao-vdc__1-linha-dose-denso-q14@1.0.0` · **versão:** 1.0.0 · **hash:** `f94aaf552c0ccc68…` · **status:** RASCUNHO
- **Intervalo:** 14 d · **Ciclos:** 7
- **Identidade clínica:** Ewing, braço IE do VDC/IE interval-compressed (ifosfamida+etoposídeo D1–D5)
- **Fonte da ficha:** D-F1-34 e D-F1-49. Protocolo operacional: EXT-SARC-003 (eviQ, ID 3465 — Ewing sarcoma IE (part 2), v8 (PDF v5 conferido), acesso 2026-10-14; sha256 integro em corpus/manifesto/b2-fichas.v1.json); EXT-SARC-001 (eviQ, ID 3464 — Ewing sarcoma VDC/IE overview, v2 (review due 31/12/2026), acesso 2026-10-14; sha256 integro em corpus/manifesto/b2-fichas.v1.json). Elegibilidade SAALT2W <30 anos; cautelas eviQ (LVEF <45%, CrCl <60).

| # | Item | Classe | Dose | Unid. | Base | Via | Diluente | Vol. | Tempo | Dias | Situação | Fontes |
|---|------|--------|------|-------|------|------|----------|------|-------|------|----------|--------|
| 1 | Soro fisiológico 0,9% 250 mL (lavagem de acesso) | PRE_QT | 1 | frasco | FIXED | EV | — | 250 | — | d1-d5 | padrão local | — |
| 2 | Ondansetrona | PRE_QT | 8 | mg | FIXED | EV | — | — | 15 min | d1-d5 | padrão local | — |
| 3 | Dexametasona | PRE_QT | 10 | mg | FIXED | EV | — | — | 15 min | d1-d5 | padrão local | — |
| 4 | Prometazina | PRE_QT | 25 | mg | FIXED | VO | — | — | — | d1-d5 | padrão local | — |
| 5 | Etoposídeo | QT | 100 | mg/m² | MG_M2 | EV | SF 0,9% | 500 | 60 min | d1-d5 | documentado | `EXT-SARC-003` |
| 6 | Ifosfamida | QT | 1800 | mg/m² | MG_M2 | EV | SF 0,9% | — | 2 h | d1-d5 | documentado | `EXT-SARC-003` |
| 7 | Mesna (0 h) | QT | 600 | mg/m² | MG_M2 | EV | — | — | 15 min | d1-d5 | documentado | `EXT-SARC-003` |
| 8 | Mesna (4 h) | POS_QT | 600 | mg/m² | MG_M2 | EV | — | — | 15 min | d1-d5 | documentado | `EXT-SARC-003` |
| 9 | Mesna (8 h) | POS_QT | 600 | mg/m² | MG_M2 | EV | — | — | 15 min | d1-d5 | documentado | `EXT-SARC-003` |
| 10 | Pegfilgrastim | POS_QT | 6 | mg | FIXED | SC | — | — | — | d6 | documentado | `EXT-SARC-003` |
| 11 | Soro fisiológico 0,9% 250 mL (lavagem pós-QT) | POS_QT | 1 | frasco | FIXED | EV | — | 250 | — | d1-d5 | padrão local | — |

**Divergências registradas:**
- mesna IE eviQ: 600 IV carga + 600 IV 4 h e 8 h (alternativa VO às 2 h e 6 h após o fim, dose dobrada)
- teto cumulativo de ifosfamida usualmente ≤72 g/m² (BC)

## OSTEOSSARCOMA

### MAP (ciclos 1–4) — não especificado

- **templateId:** `FICHA.osteossarcoma.map-ciclos-1-4__nao-especificado@1.0.0` · **versão:** 1.0.0 · **hash:** `82b6e7a91beac5fe…` · **status:** RASCUNHO
- **Intervalo:** 35 d · **Ciclos:** 4
- **Identidade clínica:** Osteossarcoma de alto grau, neoadjuvante/adjuvante (SBOC p.12 ≤25 anos; corte externo das fontes é 40)
- **Fonte da ficha:** D-F1-34 e D-F1-49. Diretriz local: LOC-SBOC-OSSEOS (SBOC, Diretrizes SBOC 2026 — Sarcomas Ósseos v5 (VERSÃO PARA COLABORAÇÃO), p. 12 (MAP e AP); p. 14–15 (recidivas)) — MAP: cisplatina 60 D1–D2 + doxorrubicina 25 D1–D3 + MTX 12 g/m². Protocolo operacional: EXT-SARC-004 (eviQ, ID 1901 — Osteosarcoma MAP, v6 (PDF v5 conferido), acesso 2026-10-14; sha256 integro em corpus/manifesto/b2-fichas.v1.json); EXT-SARC-014 (BC Cancer, SANAHDMAP — Osteosarcoma high-dose MTX + DOXOrubicin + CISplatin, rev 01/06/2026, acesso 2026-10-14; sha256 integro em corpus/manifesto/b2-fichas.v1.json). Estrutura de cicl …

| # | Item | Classe | Dose | Unid. | Base | Via | Diluente | Vol. | Tempo | Dias | Situação | Fontes |
|---|------|--------|------|-------|------|------|----------|------|-------|------|----------|--------|
| 1 | Soro fisiológico 0,9% 250 mL (lavagem de acesso) | PRE_QT | 1 | frasco | FIXED | EV | — | 250 | — | d1-d2 | padrão local | — |
| 2 | Ondansetrona | PRE_QT | 8 | mg | FIXED | EV | — | — | 15 min | d1-d2 | padrão local | — |
| 3 | Dexametasona | PRE_QT | 10 | mg | FIXED | EV | — | — | 15 min | d1-d2 | padrão local | — |
| 4 | Prometazina | PRE_QT | 25 | mg | FIXED | VO | — | — | — | d1-d2 | padrão local | — |
| 5 | Doxorrubicina | QT | 25 | mg/m² | MG_M2 | EV | — | — | 15 min | d1, d2, d3 | documentado | `LOC-SBOC-OSSEOS` |
| 6 | Soro fisiológico 0,9% 500 mL (pré-cisplatina) | PRE_QT | 1 | frasco | FIXED | EV | — | 500 | 20 min | d1, d2 | padrão local | — |
| 7 | Sulfato de magnésio 10% 10 mL | PRE_QT | 10 | mL | FIXED | EV | — | — | — | d1, d2 | padrão local | — |
| 8 | Cloreto de potássio 19,1% 4 mL | PRE_QT | 4 | mL | FIXED | EV | — | — | — | d1, d2 | padrão local | — |
| 9 | Cisplatina | QT | 60 | mg/m² | MG_M2 | EV | — | — | 2 h | d1, d2 | documentado | `LOC-SBOC-OSSEOS` `EXT-SARC-004` |
| 10 | Manitol 20% frasco 250 mL | QT | 1 | frasco | FIXED | EV | — | 250 | 60 min | d1, d2 | padrão local | — |
| 11 | Metotrexato | QT | 12000 | mg/m² | MG_M2 | EV | SF 0,9% | 1000 | 4 h | d22, d29 | documentado | `EXT-SARC-004` |
| 12 | Folinato de cálcio (resgate do MTX) | QT | 15 | mg/m² | MG_M2 | EV | — | — | — | d23, d25, d30, d32 | documentado | `EXT-SARC-004` |
| 13 | Pegfilgrastim | POS_QT | 6 | mg | FIXED | SC | — | — | — | d3 | documentado | `EXT-SARC-004` `EXT-SARC-014` |
| 14 | Soro fisiológico 0,9% 500 mL (pós-cisplatina) | POS_QT | 1 | frasco | FIXED | EV | — | 500 | 20 min | d1, d2 | padrão local | — |
| 15 | Cloreto de potássio 19,1% 4 mL | POS_QT | 4 | mL | FIXED | EV | — | — | — | d1, d2 | padrão local | — |
| 16 | Soro fisiológico 0,9% 250 mL (lavagem pós-QT) | POS_QT | 1 | frasco | FIXED | EV | — | 250 | — | d1-d2 | padrão local | — |

**Divergências registradas:**
- cisplatina: SBOC 60 D1–D2 (= eviQ 1901 60×2 em 2 h) × BC SANAHDMAP 50×2 (60×2 excepcional) × ensaios 120/ciclo (contínua 72 h; D1)
- doxorrubicina: SBOC 25 D1–D3 (total 75) × eviQ/BC/EURAMOS 37,5×2 D1–D2 (mesmo total 75)
- folínico: eviQ 15 mg/m² q6h × BC 25 mg fixa q6h
- corte de idade: SBOC/SOnHe usam 25 anos; NENHUMA fonte externa usa 25 (eviQ nota >40; BC <40; EURAMOS ≤40) — divergência aberta
- cisplatina 80 mg/m² (SOnHe): NAO_LOCALIZADO nas fontes externas

**Lacunas (impedem ativação):**
- corte de idade 25 anos sem apoio externo — decisão do Dr. Silas pendente
- cisplatina 80 (SOnHe) sem fonte externa — não adotada

### MAP (ciclos 5–6 — sem cisplatina) — não especificado

- **templateId:** `FICHA.osteossarcoma.map-ciclos-5-6-sem-cisplatina__nao-especificado@1.0.0` · **versão:** 1.0.0 · **hash:** `8141b1d3d73bb150…` · **status:** RASCUNHO
- **Intervalo:** 28 d · **Ciclos:** 2
- **Identidade clínica:** Osteossarcoma, ciclos finais do MAP (eviQ 1901: sem cisplatina; MTX nas semanas 3 e 4)
- **Fonte da ficha:** D-F1-34 e D-F1-49. Estrutura eviQ 1901 (C5–6 de 28 d: doxo semana 1 + MTX semanas 3–4, SEM cisplatina): EXT-SARC-004 (eviQ, ID 1901 — Osteosarcoma MAP, v6 (PDF v5 conferido), acesso 2026-10-14; sha256 integro em corpus/manifesto/b2-fichas.v1.json); EXT-SARC-014 (BC Cancer, SANAHDMAP — Osteosarcoma high-dose MTX + DOXOrubicin + CISplatin, rev 01/06/2026, acesso 2026-10-14; sha256 integro em corpus/manifesto/b2-fichas.v1.json).

| # | Item | Classe | Dose | Unid. | Base | Via | Diluente | Vol. | Tempo | Dias | Situação | Fontes |
|---|------|--------|------|-------|------|------|----------|------|-------|------|----------|--------|
| 1 | Soro fisiológico 0,9% 250 mL (lavagem de acesso) | PRE_QT | 1 | frasco | FIXED | EV | — | 250 | — | d1 | padrão local | — |
| 2 | Ondansetrona | PRE_QT | 8 | mg | FIXED | EV | — | — | 15 min | d1 | padrão local | — |
| 3 | Dexametasona | PRE_QT | 10 | mg | FIXED | EV | — | — | 15 min | d1 | padrão local | — |
| 4 | Prometazina | PRE_QT | 25 | mg | FIXED | VO | — | — | — | d1 | padrão local | — |
| 5 | Doxorrubicina | QT | 25 | mg/m² | MG_M2 | EV | — | — | 15 min | d1, d2, d3 | documentado | `LOC-SBOC-OSSEOS` |
| 6 | Metotrexato | QT | 12000 | mg/m² | MG_M2 | EV | SF 0,9% | 1000 | 4 h | d15, d22 | documentado | `EXT-SARC-004` |
| 7 | Folinato de cálcio (resgate do MTX) | QT | 15 | mg/m² | MG_M2 | EV | — | — | — | d16, d18, d23, d25 | documentado | `EXT-SARC-004` |
| 8 | Pegfilgrastim | POS_QT | 6 | mg | FIXED | SC | — | — | — | d3 | documentado | `EXT-SARC-004` `EXT-SARC-014` |
| 9 | Soro fisiológico 0,9% 250 mL (lavagem pós-QT) | POS_QT | 1 | frasco | FIXED | EV | — | 250 | — | d1 | padrão local | — |

**Divergências registradas:**
- mesmas divergências de dose do MAP C1–4 (doxo/fracionamento; folínico)

**Lacunas (impedem ativação):**
- confirmação local da estrutura C5–6 sem cisplatina (SBOC descreve MAP sem separar) [VERIFICAR]

> ⚠️ Itens com `[VERIFICAR]` nesta ficha permanecem pendentes — a ficha é dossiê de curadoria até decisão.

### AP (doxorrubicina + cisplatina) — não especificado

- **templateId:** `FICHA.osteossarcoma.ap-doxorrubicina-cisplatina__nao-especificado@1.0.0` · **versão:** 1.0.0 · **hash:** `1b4381779582d00a…` · **status:** RASCUNHO
- **Intervalo:** 21 d · **Ciclos:** —
- **Identidade clínica:** Osteossarcoma sem MTX (SBOC p.12 usa AP >25 anos; SAAVAP cobre osteossarcoma avançado)
- **Fonte da ficha:** D-F1-34 e D-F1-49. Fonte operacional: EXT-SARC-015 (BC Cancer, SAAVAP — Advanced osteosarcoma DOXOrubicin + CISplatin, rev 01/03/2022, acesso 2026-10-14; sha256 integro em corpus/manifesto/b2-fichas.v1.json). Diretriz local: LOC-SBOC-OSSEOS (SBOC, Diretrizes SBOC 2026 — Sarcomas Ósseos v5 (VERSÃO PARA COLABORAÇÃO), p. 12 (MAP e AP); p. 14–15 (recidivas)) (AP para >25 anos — corte sem apoio externo). Nota eviQ 1901: considerar AP sem HDMTX acima de 40 anos.

| # | Item | Classe | Dose | Unid. | Base | Via | Diluente | Vol. | Tempo | Dias | Situação | Fontes |
|---|------|--------|------|-------|------|------|----------|------|-------|------|----------|--------|
| 1 | Soro fisiológico 0,9% 250 mL (lavagem de acesso) | PRE_QT | 1 | frasco | FIXED | EV | — | 250 | — | d1 | padrão local | — |
| 2 | Ondansetrona | PRE_QT | 8 | mg | FIXED | EV | — | — | 15 min | d1 | padrão local | — |
| 3 | Dexametasona | PRE_QT | 10 | mg | FIXED | EV | — | — | 15 min | d1 | padrão local | — |
| 4 | Prometazina | PRE_QT | 25 | mg | FIXED | VO | — | — | — | d1 | padrão local | — |
| 5 | Doxorrubicina | QT | 75 | mg/m² | MG_M2 | EV | — | — | 15 min | d1 | documentado | `EXT-SARC-015` `LOC-SBOC-OSSEOS` |
| 6 | Soro fisiológico 0,9% 500 mL (pré-cisplatina) | PRE_QT | 1 | frasco | FIXED | EV | — | 500 | 20 min | d1 | padrão local | — |
| 7 | Sulfato de magnésio 10% 10 mL | PRE_QT | 10 | mL | FIXED | EV | — | — | — | d1 | padrão local | — |
| 8 | Cloreto de potássio 19,1% 4 mL | PRE_QT | 4 | mL | FIXED | EV | — | — | — | d1 | padrão local | — |
| 9 | Cisplatina | QT | 100 | mg/m² | MG_M2 | EV | — | — | 2 h | d1 | documentado | `EXT-SARC-015` `LOC-SBOC-OSSEOS` |
| 10 | Manitol 20% frasco 250 mL | QT | 1 | frasco | FIXED | EV | — | 250 | 60 min | d1 | padrão local | — |
| 11 | Soro fisiológico 0,9% 500 mL (pós-cisplatina) | POS_QT | 1 | frasco | FIXED | EV | — | 500 | 20 min | d1 | padrão local | — |
| 12 | Cloreto de potássio 19,1% 4 mL | POS_QT | 4 | mL | FIXED | EV | — | — | — | d1 | padrão local | — |
| 13 | Soro fisiológico 0,9% 250 mL (lavagem pós-QT) | POS_QT | 1 | frasco | FIXED | EV | — | 250 | — | d1 | padrão local | — |

**Divergências registradas:**
- SAAVAP: doxo 75 IV push + cis 100 em 2 h q21d até progressão/toxicidade; considerar doxo 60 se >40 anos
- idade local >25 × corte externo >40 (mesma divergência do MAP)
- eviQ 1901 nota: '>40 anos: considerar AP sem HDMTX'

**Lacunas (impedem ativação):**
- AP adjuvante formal ≤25 anos sem protocolo dedicado (NAO_LOCALIZADO); idade-limite local pendente de decisão

## VULVA

### Cisplatina semanal + RxT (vulva) — concomitante à RT

- **templateId:** `FICHA.vulva.cisplatina-semanal-rxt-vulva__concomitante-a-rt@1.0.0` · **versão:** 1.0.0 · **hash:** `1457a3144a5ef8f6…` · **status:** RASCUNHO
- **Intervalo:** 7 d · **Ciclos:** —
- **Identidade clínica:** CEC de vulva localmente avançado (T3/T4 não ressecável por vulvectomia radical), previamente não tratado (eviQ 1529)
- **Fonte da ficha:** D-F1-35 e D-F1-49. Protocolo ESPECÍFICO de vulva: EXT-CNV-021 (eviQ, ID 1529 — Vulval SCC locally advanced ciPlatin (weekly) chemoradiation, v9 (11/02/2026; PDF v6 arquivado), acesso 2026-10-14; sha256 integro em corpus/manifesto/b2-fichas.v1.json). Protocolo BC que inclui vulva: EXT-CNV-023 (BC Cancer, GOCXCRT — Gynecologic locally advanced CISplatin weekly ×5 com RT (inclui vulva), rev 01/08/2026, acesso 2026-10-14; sha256 integro em corpus/manifesto/b2-fichas.v1.json). Material local: LOC-SONHE (SOnHe, Protocolos SOnHe 2024, p. 313–318 (sarcomas); p. 89–91 (vulva); p. 236–238 (CEC pele); p. …

| # | Item | Classe | Dose | Unid. | Base | Via | Diluente | Vol. | Tempo | Dias | Situação | Fontes |
|---|------|--------|------|-------|------|------|----------|------|-------|------|----------|--------|
| 1 | Soro fisiológico 0,9% 250 mL (lavagem de acesso) | PRE_QT | 1 | frasco | FIXED | EV | — | 250 | — | d1 | padrão local | — |
| 2 | Ondansetrona | PRE_QT | 8 | mg | FIXED | EV | — | — | 15 min | d1 | padrão local | — |
| 3 | Dexametasona | PRE_QT | 10 | mg | FIXED | EV | — | — | 15 min | d1 | padrão local | — |
| 4 | Prometazina | PRE_QT | 25 | mg | FIXED | VO | — | — | — | d1 | padrão local | — |
| 5 | Soro fisiológico 0,9% 500 mL (pré-cisplatina) | PRE_QT | 1 | frasco | FIXED | EV | — | 500 | 20 min | d1 | padrão local | — |
| 6 | Sulfato de magnésio 10% 10 mL | PRE_QT | 10 | mL | FIXED | EV | — | — | — | d1 | padrão local | — |
| 7 | Cloreto de potássio 19,1% 4 mL | PRE_QT | 4 | mL | FIXED | EV | — | — | — | d1 | padrão local | — |
| 8 | Cisplatina | QT | 40 | mg/m² | MG_M2 | EV | — | — | 60 min | d1 | documentado | `EXT-CNV-021` `EXT-CNV-023` |
| 9 | Manitol 20% frasco 250 mL | QT | 1 | frasco | FIXED | EV | — | 250 | 60 min | d1 | padrão local | — |
| 10 | Soro fisiológico 0,9% 500 mL (pós-cisplatina) | POS_QT | 1 | frasco | FIXED | EV | — | 500 | 20 min | d1 | padrão local | — |
| 11 | Cloreto de potássio 19,1% 4 mL | POS_QT | 4 | mL | FIXED | EV | — | — | — | d1 | padrão local | — |
| 12 | Soro fisiológico 0,9% 250 mL (lavagem pós-QT) | POS_QT | 1 | frasco | FIXED | EV | — | 250 | — | d1 | padrão local | — |

**Divergências registradas:**
- eviQ 1529 (v.9, específico de vulva): 40 mg/m² IV q7d, 5–6 ciclos conforme duração da RT, no dia de RT (antes dela)
- BC GOCXCRT (inclui vulva): 40 mg/m² em 500 mL NS + manitol 30 g + MgSO4 2 g em 60 min, semanal ×5, sem pós-hidratação
- estudo de referência GOG 205 = Moore DH, Gynecol Oncol 2012;124(3):529-33 (PMID 22079361) — o 'Gill 2015' do material local é atribuição incorreta

### Carboplatina + Paclitaxel 21/21 dias (vulva) — não especificado

- **templateId:** `FICHA.vulva.carboplatina-paclitaxel-21-21-dias-vulva__nao-especificado@1.0.0` · **versão:** 1.0.0 · **hash:** `1c6a174f264ff1d4…` · **status:** RASCUNHO
- **Intervalo:** 21 d · **Ciclos:** —
- **Identidade clínica:** CEC/adenocarcinoma de vulva recorrente ou avançado, inelegível a quimiorradioterapia (GOCXCAT inclui vulva)
- **Fonte da ficha:** D-F1-35 e D-F1-49. Protocolo BC que INCLUI vulva na elegibilidade: EXT-CNV-024 (BC Cancer, GOCXCAT — Gynecologic CARBOplatin + PACLitaxel (inclui vulva), rev 01/10/2025, acesso 2026-10-14; sha256 integro em corpus/manifesto/b2-fichas.v1.json). Material local: LOC-SONHE (SOnHe, Protocolos SOnHe 2024, p. 313–318 (sarcomas); p. 89–91 (vulva); p. 236–238 (CEC pele); p. 314/317 (Ewing institucional)) (p. 89–91, AUC 5 + 175).

| # | Item | Classe | Dose | Unid. | Base | Via | Diluente | Vol. | Tempo | Dias | Situação | Fontes |
|---|------|--------|------|-------|------|------|----------|------|-------|------|----------|--------|
| 1 | Soro fisiológico 0,9% 250 mL (lavagem de acesso) | PRE_QT | 1 | frasco | FIXED | EV | — | 250 | — | d1 | padrão local | — |
| 2 | Ondansetrona | PRE_QT | 8 | mg | FIXED | EV | — | — | 15 min | d1 | padrão local | — |
| 3 | Dexametasona | PRE_QT | 10 | mg | FIXED | EV | — | — | 15 min | d1 | padrão local | — |
| 4 | Prometazina | PRE_QT | 25 | mg | FIXED | VO | — | — | — | d1 | padrão local | — |
| 5 | Cimetidina | PRE_QT | 300 | mg | FIXED | EV | — | — | 15 min | d1 | padrão local | — |
| 6 | Paclitaxel | QT | 175 | mg/m² | MG_M2 | EV | — | — | 3 h | d1 | documentado | `EXT-CNV-024` |
| 7 | Carboplatina | QT | 6 | AUC | AUC | EV | — | — | 60 min | d1 | documentado | `EXT-CNV-024` |
| 8 | Soro fisiológico 0,9% 250 mL (lavagem pós-QT) | POS_QT | 1 | frasco | FIXED | EV | — | 250 | — | d1 | padrão local | — |

**Divergências registradas:**
- GOCXCAT: paclitaxel 175 em 3 h + AUC 6 (AUC 5 se RT prévia extensa); q21/28d, máx 6
- SOnHe p. 89/91 (local): AUC 5 + 175 — variante [decisão pendente]
- infusão do paclitaxel: 3 h em TODAS as fontes (24 h NAO_LOCALIZADO)

**Lacunas (impedem ativação):**
- variante de AUC (6 × 5) pendente de decisão local

## CEC-DE-PELE-CUTANEO

### Cemiplimabe — localmente avançado/metastático — inelegível a cirurgia/RT curativas

- **templateId:** `FICHA.cec-de-pele-cutaneo.cemiplimabe__localmente-avancado-metastatico-inelegivel-a-cirurgia-rt-curativas@1.0.0` · **versão:** 1.0.0 · **hash:** `3e1544d835b6013d…` · **status:** RASCUNHO
- **Intervalo:** 21 d · **Ciclos:** —
- **Identidade clínica:** CSCC metastático ou localmente avançado sem candidatura a cirurgia/RT curativas (eviQ 4151)
- **Fonte da ficha:** D-F1-34 e D-F1-49. Protocolo operacional: EXT-CNV-001 (eviQ, ID 4151 — Cemiplimab monotherapy, v5 (review due 31/12/2028), acesso 2026-10-14; sha256 integro em corpus/manifesto/b2-fichas.v1.json) (página viva v5, 02/09/2026; PDF capturado v1) + BC SMAVCEM (rev 08/2025) + DailyMed LIBTAYO SPL (setid 4347ae1f…). Sem pré-medicação de rotina (eviQ/BC).

| # | Item | Classe | Dose | Unid. | Base | Via | Diluente | Vol. | Tempo | Dias | Situação | Fontes |
|---|------|--------|------|-------|------|------|----------|------|-------|------|----------|--------|
| 1 | Cemiplimabe | QT | 350 | mg | FIXED | EV | SF 0,9% | 50 | 30 min | d1 | documentado | `EXT-CNV-001` |
| 2 | Soro fisiológico 0,9% 50 mL (flush pós-infusão) | POS_QT | 1 | frasco | FIXED | EV | — | 50 | — | d1 | padrão local | — |

**Divergências registradas:**
- estudos pivô: Migden NEJM 2018;379(4):341-351 e Lancet Oncol 2020;21(2):294-305 (o material local cita o fascículo 7 do Lancet — corrigido)

**Lacunas (impedem ativação):**
- dispensação/SUS: verificar

### Carboplatina + Paclitaxel 21/21 dias (CEC de pele) — não especificado

- **templateId:** `FICHA.cec-de-pele-cutaneo.carboplatina-paclitaxel-21-21-dias-cec-de-pele__nao-especificado@1.0.0` · **versão:** 1.0.0 · **hash:** `8ac2e185abc5c227…` · **status:** RASCUNHO
- **Intervalo:** 21 d · **Ciclos:** —
- **Identidade clínica:** CEC cutâneo avançado — EXTRAPOLAÇÃO explícita de CECP recorrente/metastático (eviQ 3579)
- **Fonte da ficha:** D-F1-34 e D-F1-49. Protocolo operacional (população CECP R/M — extrapolação explícita): EXT-CNV-008 (eviQ, ID 3579 — Head and neck SCC recurrent/metastatic CARBOplatin and PACLitaxel, acesso 2026-10-14, acesso 2026-10-14; sha256 integro em corpus/manifesto/b2-fichas.v1.json). Material local: LOC-SONHE (SOnHe, Protocolos SOnHe 2024, p. 313–318 (sarcomas); p. 89–91 (vulva); p. 236–238 (CEC pele); p. 314/317 (Ewing institucional)) (p. 236–238, opções incluem cemiplimabe preferencial).

| # | Item | Classe | Dose | Unid. | Base | Via | Diluente | Vol. | Tempo | Dias | Situação | Fontes |
|---|------|--------|------|-------|------|------|----------|------|-------|------|----------|--------|
| 1 | Soro fisiológico 0,9% 250 mL (lavagem de acesso) | PRE_QT | 1 | frasco | FIXED | EV | — | 250 | — | d1 | padrão local | — |
| 2 | Ondansetrona | PRE_QT | 8 | mg | FIXED | EV | — | — | 15 min | d1 | padrão local | — |
| 3 | Dexametasona | PRE_QT | 10 | mg | FIXED | EV | — | — | 15 min | d1 | padrão local | — |
| 4 | Prometazina | PRE_QT | 25 | mg | FIXED | VO | — | — | — | d1 | padrão local | — |
| 5 | Cimetidina | PRE_QT | 300 | mg | FIXED | EV | — | — | 15 min | d1 | padrão local | — |
| 6 | Paclitaxel | QT | 175 | mg/m² | MG_M2 | EV | SF 0,9% | 500 | 3 h | d1 | documentado | `EXT-CNV-008` |
| 7 | Carboplatina | QT | 5 | AUC | AUC | EV | SG 5% | 500 | 60 min | d1 | documentado | `EXT-CNV-008` |
| 8 | Soro fisiológico 0,9% 250 mL (lavagem pós-QT) | POS_QT | 1 | frasco | FIXED | EV | — | 250 | — | d1 | padrão local | — |

**Divergências registradas:**
- população do protocolo é CECP de cabeça e pescoço — extrapolação para CEC cutâneo declarada, não transcrição
- cisplatina 100 q21d monoterapia: NAO_LOCALIZADO como protocolo operacional (eviQ 288 reduz a 75 em combinação; BC HNAVP usa 25 ×2)

**Lacunas (impedem ativação):**
- extrapolação requer aceite explícito do Dr. Silas

### Cisplatina semanal + RxT (CEC de pele) — concomitante à RT

- **templateId:** `FICHA.cec-de-pele-cutaneo.cisplatina-semanal-rxt-cec-de-pele__concomitante-a-rt@1.0.0` · **versão:** 1.0.0 · **hash:** `da65e793f24a7a71…` · **status:** RASCUNHO
- **Intervalo:** 7 d · **Ciclos:** —
- **Identidade clínica:** CEC cutâneo localmente avançado — EXTRAPOLAÇÃO de CECP localmente avançado (eviQ 292)
- **Fonte da ficha:** D-F1-34 e D-F1-49. Protocolo operacional (CECP localmente avançado — extrapolação explícita): EXT-CNV-016 (eviQ, ID 292 — Head and neck locally advanced ciSplatin weekly with radiation therapy, v10 (PDF v8), acesso 2026-10-14; sha256 integro em corpus/manifesto/b2-fichas.v1.json).

| # | Item | Classe | Dose | Unid. | Base | Via | Diluente | Vol. | Tempo | Dias | Situação | Fontes |
|---|------|--------|------|-------|------|------|----------|------|-------|------|----------|--------|
| 1 | Soro fisiológico 0,9% 250 mL (lavagem de acesso) | PRE_QT | 1 | frasco | FIXED | EV | — | 250 | — | d1 | padrão local | — |
| 2 | Ondansetrona | PRE_QT | 8 | mg | FIXED | EV | — | — | 15 min | d1 | padrão local | — |
| 3 | Dexametasona | PRE_QT | 10 | mg | FIXED | EV | — | — | 15 min | d1 | padrão local | — |
| 4 | Prometazina | PRE_QT | 25 | mg | FIXED | VO | — | — | — | d1 | padrão local | — |
| 5 | Soro fisiológico 0,9% 500 mL (pré-cisplatina) | PRE_QT | 1 | frasco | FIXED | EV | — | 500 | 20 min | d1 | padrão local | — |
| 6 | Sulfato de magnésio 10% 10 mL | PRE_QT | 10 | mL | FIXED | EV | — | — | — | d1 | padrão local | — |
| 7 | Cloreto de potássio 19,1% 4 mL | PRE_QT | 4 | mL | FIXED | EV | — | — | — | d1 | padrão local | — |
| 8 | Cisplatina | QT | 40 | mg/m² | MG_M2 | EV | — | — | 60 min | d1 | documentado | `EXT-CNV-016` |
| 9 | Manitol 20% frasco 250 mL | QT | 1 | frasco | FIXED | EV | — | 250 | 60 min | d1 | padrão local | — |
| 10 | Soro fisiológico 0,9% 500 mL (pós-cisplatina) | POS_QT | 1 | frasco | FIXED | EV | — | 500 | 20 min | d1 | padrão local | — |
| 11 | Cloreto de potássio 19,1% 4 mL | POS_QT | 4 | mL | FIXED | EV | — | — | — | d1 | padrão local | — |
| 12 | Soro fisiológico 0,9% 250 mL (lavagem pós-QT) | POS_QT | 1 | frasco | FIXED | EV | — | 250 | — | d1 | padrão local | — |

**Divergências registradas:**
- população do protocolo é CECP — extrapolação declarada
- eviQ 292: 40 mg/m² em 1.000 mL SF em 60 min q7d contínuo com RT (~6 semanas); pré MgSO4 10 mmol em 1.000 mL; sem manitol na versão vigente (dose baixa)

**Lacunas (impedem ativação):**
- extrapolação requer aceite explícito do Dr. Silas

## NEOPLASIA-TROFOBLASTICA-GESTACIONAL

### Metotrexato + ácido folínico (baixo risco) — baixo risco (escore FIGO ≤6)

- **templateId:** `FICHA.neoplasia-trofoblastica-gestacional.metotrexato-acido-folinico-baixo-risco__baixo-risco-escore-figo-6@1.0.0` · **versão:** 1.0.0 · **hash:** `f4eff5b7005298b6…` · **status:** RASCUNHO
- **Intervalo:** 14 d · **Ciclos:** —
- **Identidade clínica:** NTG de baixo risco (escore ≤6 eviQ/Lok; BC usa 0–4), 1ª linha
- **Fonte da ficha:** D-F1-34 e D-F1-49. Protocolo operacional: EXT-CNV-026 (eviQ, ID 668 — Gestational trophoblastic neoplasia low risk methotrexate and folinic acid, v4 (PDF v3), acesso 2026-10-14; sha256 integro em corpus/manifesto/b2-fichas.v1.json). Diretriz original: EXT-CNV-031 (J Clin Oncol (Lok C et al. — EOTTD/ESGO/ISSTD/GCIG), Practical Guidelines for the Treatment of Gestational Trophoblastic Disease (JCO 2025;43(18); DOI 10.1200/JCO-24-02326) — Tabela A5 e Figura A4, 2025 (pós-print ORBi 2268/340461), acesso 2026-10-14; sha256 integro em corpus/manifesto/b2-fichas.v1.json) (Tabela A5 — 'MTX once every  …

| # | Item | Classe | Dose | Unid. | Base | Via | Diluente | Vol. | Tempo | Dias | Situação | Fontes |
|---|------|--------|------|-------|------|------|----------|------|-------|------|----------|--------|
| 1 | Metotrexato | QT | 50 | mg | FIXED | IM | — | — | — | d1, d3, d5, d7 | documentado | `EXT-CNV-026` `EXT-CNV-031` |
| 2 | Ácido folínico (resgate) | QT | 15 | mg | FIXED | VO | — | — | — | d2, d4, d6, d8 | documentado | `EXT-CNV-026` `EXT-CNV-031` |

**Divergências registradas:**
- eviQ 668: MTX 50 mg fixa IM D1,3,5,7 + folínico 15 mg VO D2,4,6,8 (24 h pós MTX)
- Lok A5: MTX 1 mg/kg IM D1,3,5,7 OU 50 mg fixa (variante Charing Cross usada na Aula 31)
- BC GOTDLRM: folínico 30 h após o MTX (não 24 h); alternativa 5 dias 0,4 mg/kg/dia IV sem folínico
- cortes de risco: eviQ/Lok ≤6 × BC 0–4

### Dactinomicina em pulso (baixo risco) — baixo risco (escore FIGO ≤6)

- **templateId:** `FICHA.neoplasia-trofoblastica-gestacional.dactinomicina-em-pulso-baixo-risco__baixo-risco-escore-figo-6@1.0.0` · **versão:** 1.0.0 · **hash:** `c236a064ff93ad5f…` · **status:** RASCUNHO
- **Intervalo:** 14 d · **Ciclos:** —
- **Identidade clínica:** NTG de baixo risco — alternativa ao MTX ou resistência/contraindicação a ele (eviQ 1018)
- **Fonte da ficha:** D-F1-34 e D-F1-49. Protocolo operacional: EXT-CNV-027 (eviQ, ID 1018 — GTN low risk dactinomycin, acesso 2026-10-14, acesso 2026-10-14; sha256 integro em corpus/manifesto/b2-fichas.v1.json). Diretriz: EXT-CNV-031 (J Clin Oncol (Lok C et al. — EOTTD/ESGO/ISSTD/GCIG), Practical Guidelines for the Treatment of Gestational Trophoblastic Disease (JCO 2025;43(18); DOI 10.1200/JCO-24-02326) — Tabela A5 e Figura A4, 2025 (pós-print ORBi 2268/340461), acesso 2026-10-14; sha256 integro em corpus/manifesto/b2-fichas.v1.json).

| # | Item | Classe | Dose | Unid. | Base | Via | Diluente | Vol. | Tempo | Dias | Situação | Fontes |
|---|------|--------|------|-------|------|------|----------|------|-------|------|----------|--------|
| 1 | Soro fisiológico 0,9% 250 mL (lavagem de acesso) | PRE_QT | 1 | frasco | FIXED | EV | — | 250 | — | d1 | padrão local | — |
| 2 | Ondansetrona | PRE_QT | 8 | mg | FIXED | EV | — | — | 15 min | d1 | padrão local | — |
| 3 | Dexametasona | PRE_QT | 10 | mg | FIXED | EV | — | — | 15 min | d1 | padrão local | — |
| 4 | Prometazina | PRE_QT | 25 | mg | FIXED | VO | — | — | — | d1 | padrão local | — |
| 5 | Dactinomicina | QT | 1.25 | mg/m² | MG_M2 | EV | — | — | 5 min | d1 | documentado | `EXT-CNV-027` `EXT-CNV-031` |
| 6 | Soro fisiológico 0,9% 250 mL (lavagem pós-QT) | POS_QT | 1 | frasco | FIXED | EV | — | 250 | — | d1 | padrão local | — |

**Divergências registradas:**
- eviQ 1018: 1,25 mg/m² IV (cap 2 mg) D1 q14d; consolidação 3 ciclos pós-β-hCG normal (BC: 2 ciclos)
- Lok A5: alternativa 0,5 mg IV/dia D1–5

### EMA-CO (alto risco) — alto risco (escore FIGO ≥7)

- **templateId:** `FICHA.neoplasia-trofoblastica-gestacional.ema-co-alto-risco__alto-risco-escore-figo-7@1.0.0` · **versão:** 1.0.0 · **hash:** `96985ecce02d8b79…` · **status:** RASCUNHO
- **Intervalo:** 14 d · **Ciclos:** —
- **Identidade clínica:** NTG de alto risco (escore ≥7) ou resistente a MTX/dactinomicina (eviQ 599)
- **Fonte da ficha:** D-F1-34 e D-F1-49. Protocolo operacional: EXT-CNV-028 (eviQ, ID 599 — GTN high risk EMA-CO, v8 (PDF v5), acesso 2026-10-14; sha256 integro em corpus/manifesto/b2-fichas.v1.json) (D1: ETO+MTX 12 h+dactino; D2: ETO+dactino+folínico 24 h pós-MTX; D8: VCR+CTX; filgrastim D3–5 e D9–11; q14d). Diretriz: EXT-CNV-031 (J Clin Oncol (Lok C et al. — EOTTD/ESGO/ISSTD/GCIG), Practical Guidelines for the Treatment of Gestational Trophoblastic Disease (JCO 2025;43(18); DOI 10.1200/JCO-24-02326) — Tabela A5 e Figura A4, 2025 (pós-print ORBi 2268/340461), acesso 2026-10-14; sha256 integro em corpus/manifesto/b …

| # | Item | Classe | Dose | Unid. | Base | Via | Diluente | Vol. | Tempo | Dias | Situação | Fontes |
|---|------|--------|------|-------|------|------|----------|------|-------|------|----------|--------|
| 1 | Soro fisiológico 0,9% 250 mL (lavagem de acesso) | PRE_QT | 1 | frasco | FIXED | EV | — | 250 | — | d1, d2, d8 | padrão local | — |
| 2 | Ondansetrona | PRE_QT | 8 | mg | FIXED | EV | — | — | 15 min | d1, d2, d8 | padrão local | — |
| 3 | Dexametasona | PRE_QT | 10 | mg | FIXED | EV | — | — | 15 min | d1, d2, d8 | padrão local | — |
| 4 | Prometazina | PRE_QT | 25 | mg | FIXED | VO | — | — | — | d1, d2, d8 | padrão local | — |
| 5 | Etoposídeo | QT | 100 | mg/m² | MG_M2 | EV | SF 0,9% | 500 | 60 min | d1, d2 | documentado | `EXT-CNV-028` |
| 6 | Metotrexato | QT | 300 | mg/m² | MG_M2 | EV | SF 0,9% | 1000 | 12 h | d1 | documentado | `EXT-CNV-028` |
| 7 | Dactinomicina | QT | 0.5 | mg | FIXED | EV | — | — | 5 min | d1, d2 | documentado | `EXT-CNV-028` |
| 8 | Folinato de cálcio (resgate do MTX) | QT | 15 | mg | FIXED | VO | — | — | — | d2 | documentado | `EXT-CNV-028` |
| 9 | Vincristina | QT | 1 | mg/m² | MG_M2 | EV | SF 0,9% | 50 | 10 min | d8 | documentado | `EXT-CNV-028` |
| 10 | Ciclofosfamida | QT | 600 | mg/m² | MG_M2 | EV | SF 0,9% | 500 | 60 min | d8 | documentado | `EXT-CNV-028` |
| 11 | Filgrastim | POS_QT | 5 | µg/kg | MG_KG | SC | — | — | — | d3-d5, d9-d11 | documentado | `EXT-CNV-028` |
| 12 | Soro fisiológico 0,9% 250 mL (lavagem pós-QT) | POS_QT | 1 | frasco | FIXED | EV | — | 250 | — | d1, d2, d8 | padrão local | — |

**Divergências registradas:**
- vincristina: eviQ 1 mg/m² (cap 2) × BC/Lok 0,8 mg/m² (cap 2)
- BC GOTDEMACO: sem filgrastim; pós-hidratação alcalina após MTX
- consolidação: 3 ciclos além do β-hCG normal (eviQ/BC)

### EMA/EP (resistência ao EMA-CO) — resistente ao EMA-CO

- **templateId:** `FICHA.neoplasia-trofoblastica-gestacional.ema-ep-resistencia-ao-ema-co__resistente-ao-ema-co@1.0.0` · **versão:** 1.0.0 · **hash:** `d7a1dfd02eb0cac4…` · **status:** RASCUNHO
- **Intervalo:** 14 d · **Ciclos:** —
- **Identidade clínica:** NTG com resistência ao EMA-CO — estrutura EXATA da Tabela A5 de Lok 2025 (D2 sem etoposídeo/dactinomicina)
- **Fonte da ficha:** D-F1-34 e D-F1-49. Diretriz ORIGINAL verificada (duas cópias independentes: ORBi + Radboud, dupla leitura visual + camada de texto): EXT-CNV-031 (J Clin Oncol (Lok C et al. — EOTTD/ESGO/ISSTD/GCIG), Practical Guidelines for the Treatment of Gestational Trophoblastic Disease (JCO 2025;43(18); DOI 10.1200/JCO-24-02326) — Tabela A5 e Figura A4, 2025 (pós-print ORBi 2268/340461), acesso 2026-10-14; sha256 integro em corpus/manifesto/b2-fichas.v1.json). Equivalente operacional: EXT-CNV-029 (eviQ, ID 1378 — GTN EP-EMA (equivalente operacional do EMA/EP), v8 (PDF v5), acesso 2026-10-14; sha256 integr …

| # | Item | Classe | Dose | Unid. | Base | Via | Diluente | Vol. | Tempo | Dias | Situação | Fontes |
|---|------|--------|------|-------|------|------|----------|------|-------|------|----------|--------|
| 1 | Soro fisiológico 0,9% 250 mL (lavagem de acesso) | PRE_QT | 1 | frasco | FIXED | EV | — | 250 | — | d1, d8 | padrão local | — |
| 2 | Ondansetrona | PRE_QT | 8 | mg | FIXED | EV | — | — | 15 min | d1, d8 | padrão local | — |
| 3 | Dexametasona | PRE_QT | 10 | mg | FIXED | EV | — | — | 15 min | d1, d8 | padrão local | — |
| 4 | Prometazina | PRE_QT | 25 | mg | FIXED | VO | — | — | — | d1, d8 | padrão local | — |
| 5 | Dactinomicina | QT | 0.5 | mg | FIXED | EV | — | — | 5 min | d1 | documentado | `EXT-CNV-031` |
| 6 | Etoposídeo | QT | 100 | mg/m² | MG_M2 | EV | SF 0,9% | 500 | 60 min | d1 | documentado | `EXT-CNV-031` `EXT-CNV-029` |
| 7 | Metotrexato | QT | 300 | mg/m² | MG_M2 | EV | SF 0,9% | 1000 | 12 h | d1 | documentado | `EXT-CNV-031` |
| 8 | Folinato de cálcio (resgate do MTX) | QT | 15 | mg | FIXED | VO | — | — | — | d2 | documentado | `EXT-CNV-031` |
| 9 | Etoposídeo (D8, 150 mg/m²) | QT | 150 | mg/m² | MG_M2 | EV | SF 0,9% | 500 | 60 min | d8 | documentado | `EXT-CNV-031` `EXT-CNV-029` |
| 10 | Soro fisiológico 0,9% 500 mL (pré-cisplatina) | PRE_QT | 1 | frasco | FIXED | EV | — | 500 | 20 min | d8 | padrão local | — |
| 11 | Sulfato de magnésio 10% 10 mL | PRE_QT | 10 | mL | FIXED | EV | — | — | — | d8 | padrão local | — |
| 12 | Cloreto de potássio 19,1% 4 mL | PRE_QT | 4 | mL | FIXED | EV | — | — | — | d8 | padrão local | — |
| 13 | Cisplatina | QT | 75 | mg/m² | MG_M2 | EV | — | — | 60 min | d8 | documentado | `EXT-CNV-031` `EXT-CNV-029` |
| 14 | Manitol 20% frasco 250 mL | QT | 1 | frasco | FIXED | EV | — | 250 | 60 min | d8 | padrão local | — |
| 15 | Soro fisiológico 0,9% 500 mL (pós-cisplatina) | POS_QT | 1 | frasco | FIXED | EV | — | 500 | 20 min | d8 | padrão local | — |
| 16 | Cloreto de potássio 19,1% 4 mL | POS_QT | 4 | mL | FIXED | EV | — | — | — | d8 | padrão local | — |
| 17 | Soro fisiológico 0,9% 250 mL (lavagem pós-QT) | POS_QT | 1 | frasco | FIXED | EV | — | 250 | — | d1, d8 | padrão local | — |

**Divergências registradas:**
- RESOLVIDO (ETAPA 3): EMA/EP NÃO tem etoposídeo/dactinomicina no D2 — D2 é SOMENTE leucovorina 15 mg 2×/dia ×4 (24 h pós-MTX). Confirmação dupla: Tabela A5 (p. 24) e Figura A4 ('EMA in EMA/EP, day 2 EA should be omitted') de Lok 2025; eviQ 1378 (EP-EMA, ordem invertida) também sem 2º dia de EA
- eviQ 1378 é EP-EMA (EP na 1ª semana) — equivalente operacional com ordem trocada

### EP de indução (escore ultra-alto) — escore alto/ultra-alto — indução

- **templateId:** `FICHA.neoplasia-trofoblastica-gestacional.ep-de-inducao-escore-ultra-alto__escore-alto-ultra-alto-inducao@1.0.0` · **versão:** 1.0.0 · **hash:** `f31cf10a8ced81c7…` · **status:** RASCUNHO
- **Intervalo:** 7 d · **Ciclos:** —
- **Identidade clínica:** NTG com doença extensa (tórax/fígado/SNC) e/ou hemorragia — indução antes do EMA-CO/EMA-EP (eviQ 1347)
- **Fonte da ficha:** D-F1-34 e D-F1-49. Protocolo operacional: EXT-CNV-030 (eviQ, ID 1347 — GTN low dose EP (indução, escore alto/ultra-alto), v5 (PDF v2), acesso 2026-10-14; sha256 integro em corpus/manifesto/b2-fichas.v1.json). Diretriz: EXT-CNV-031 (J Clin Oncol (Lok C et al. — EOTTD/ESGO/ISSTD/GCIG), Practical Guidelines for the Treatment of Gestational Trophoblastic Disease (JCO 2025;43(18); DOI 10.1200/JCO-24-02326) — Tabela A5 e Figura A4, 2025 (pós-print ORBi 2268/340461), acesso 2026-10-14; sha256 integro em corpus/manifesto/b2-fichas.v1.json) (Low-dose EP once weekly: etoposídeo 100 + cisplatina 20, D1–D …

| # | Item | Classe | Dose | Unid. | Base | Via | Diluente | Vol. | Tempo | Dias | Situação | Fontes |
|---|------|--------|------|-------|------|------|----------|------|-------|------|----------|--------|
| 1 | Soro fisiológico 0,9% 250 mL (lavagem de acesso) | PRE_QT | 1 | frasco | FIXED | EV | — | 250 | — | d1, d2 | padrão local | — |
| 2 | Ondansetrona | PRE_QT | 8 | mg | FIXED | EV | — | — | 15 min | d1, d2 | padrão local | — |
| 3 | Dexametasona | PRE_QT | 10 | mg | FIXED | EV | — | — | 15 min | d1, d2 | padrão local | — |
| 4 | Prometazina | PRE_QT | 25 | mg | FIXED | VO | — | — | — | d1, d2 | padrão local | — |
| 5 | Etoposídeo | QT | 100 | mg/m² | MG_M2 | EV | SF 0,9% | 500 | 60 min | d1, d2 | documentado | `EXT-CNV-030` `EXT-CNV-031` |
| 6 | Soro fisiológico 0,9% 500 mL (pré-cisplatina) | PRE_QT | 1 | frasco | FIXED | EV | — | 500 | 20 min | d1, d2 | padrão local | — |
| 7 | Sulfato de magnésio 10% 10 mL | PRE_QT | 10 | mL | FIXED | EV | — | — | — | d1, d2 | padrão local | — |
| 8 | Cloreto de potássio 19,1% 4 mL | PRE_QT | 4 | mL | FIXED | EV | — | — | — | d1, d2 | padrão local | — |
| 9 | Cisplatina | QT | 20 | mg/m² | MG_M2 | EV | — | — | 60 min | d1, d2 | documentado | `EXT-CNV-030` `EXT-CNV-031` |
| 10 | Manitol 20% frasco 250 mL | QT | 1 | frasco | FIXED | EV | — | 250 | 60 min | d1, d2 | padrão local | — |
| 11 | Soro fisiológico 0,9% 500 mL (pós-cisplatina) | POS_QT | 1 | frasco | FIXED | EV | — | 500 | 20 min | d1, d2 | padrão local | — |
| 12 | Cloreto de potássio 19,1% 4 mL | POS_QT | 4 | mL | FIXED | EV | — | — | — | d1, d2 | padrão local | — |
| 13 | Soro fisiológico 0,9% 250 mL (lavagem pós-QT) | POS_QT | 1 | frasco | FIXED | EV | — | 250 | — | d1, d2 | padrão local | — |

**Divergências registradas:**
- corte de indicação: eviQ 1347 usa escore FIGO ≥12; Lok 2025 define ultra-alto como ≥13 — divergência registrada
- frequência: eviQ 1347 'Frequency: 7 days' (=semanal, D1–D2 por semana); Lok: 'once weekly' 1–3 ciclos

**Lacunas (impedem ativação):**
- número de ciclos por paciente clínico (1–3) e transição para EMA-CO/EMA-EP: decisão clínica

## Fichas alteradas (fontes acrescentadas, doses intactas)

- `FICHA.cabeca-e-pescoco.carboplatina-paclitaxel-semanal__nao-especificado@1.0.0` (corpus/fichas/cabeca-e-pescoco/carboplatina-paclitaxel-semanal__nao-especificado.json) — acréscimo de fontes externas do paclitaxel semanal (D-F1-28/D-F1-49); doses e diluente local inalterados; fontes: EXT-LEG-008, EXT-LEG-009, EXT-LEG-012, EXT-LEG-013
- `FICHA.esofago.carboplatina-paclitaxel-semanal-cross-rxt__concomitante-a-rt@1.0.0` (corpus/fichas/esofago/carboplatina-paclitaxel-semanal-cross-rxt__concomitante-a-rt.json) — acréscimo de fontes externas do paclitaxel semanal (D-F1-28/D-F1-49); doses e diluente local inalterados; fontes: EXT-LEG-008, EXT-LEG-009, EXT-LEG-012, EXT-LEG-013
- `FICHA.mama.ac-ct-fase-ct-carboplatina-paclitaxel-semanal__neo-adjuvante@1.0.0` (corpus/fichas/mama/ac-ct-fase-ct-carboplatina-paclitaxel-semanal__neo-adjuvante.json) — acréscimo de fontes externas do paclitaxel semanal (D-F1-28/D-F1-49); doses e diluente local inalterados; fontes: EXT-LEG-008, EXT-LEG-009, EXT-LEG-012, EXT-LEG-013
- `FICHA.mama.ac-t-fase-t-paclitaxel-semanal__adjuvante@1.0.0` (corpus/fichas/mama/ac-t-fase-t-paclitaxel-semanal__adjuvante.json) — acréscimo de fontes externas do paclitaxel semanal (D-F1-28/D-F1-49); doses e diluente local inalterados; fontes: EXT-LEG-008, EXT-LEG-009, EXT-LEG-012, EXT-LEG-013
- `FICHA.mama.ac-th-fase-th-paclitaxel-semanal-trastuzumabe__neo-adjuvante@1.0.0` (corpus/fichas/mama/ac-th-fase-th-paclitaxel-semanal-trastuzumabe__neo-adjuvante.json) — acréscimo de fontes externas do paclitaxel semanal (D-F1-28/D-F1-49); doses e diluente local inalterados; fontes: EXT-LEG-008, EXT-LEG-009, EXT-LEG-012, EXT-LEG-013
- `FICHA.prostata.carboplatina-paclitaxel-semanal__nao-especificado@1.0.0` (corpus/fichas/prostata/carboplatina-paclitaxel-semanal__nao-especificado.json) — acréscimo de fontes externas do paclitaxel semanal (D-F1-28/D-F1-49); doses e diluente local inalterados; fontes: EXT-LEG-008, EXT-LEG-009, EXT-LEG-012, EXT-LEG-013

## Destinação dos códigos legados

- **P1577:** ficha nova criada com identidade própria (D-F1-26); código mantido como codigoInstitucional — identidade do código comprovada pela decisão local
- **P1512:** ficha nova criada (D-F1-27: D1 e D2); código mantido como codigoInstitucional — identidade comprovada pela decisão local
- **P1397:** mapeamento legado NÃO comprovado: as 6 fichas de paclitaxel semanal cobrem os contextos (D-F1-28/48); a qual delas o P1397 se refere permanece aberto — destino a decidir pelo Dr. Silas
- **051:** mapeamento legado NÃO comprovado (paclitaxel semanal por D-F1-28, contexto exato aberto); série 050–054 é numeração de modelos de receita INT-MED (D-F1-44)
- **P1399:** sem identidade de esquema conhecida; a regra 'dipirona e cimetidina se necessário' (D-F1-43) já vive na ficha P1426; bulas de referência obtidas (dipirona 500 mg VO 1–2 cp até 4×/dia, Medley/EMS; cimetidina oral) — criação de ficha própria aguarda definição do esquema de origem
- **053:** erro de duplicação da biblioteca INT-MED (D-F1-44) — a corrigir NAQUELA biblioteca (externa ao repositório); nenhuma ficha nova

---
Gerado em 2026-10-14T17:32:12.517Z · aprovacaoClinica: **null** (todas as fichas) — D-F1-49.
