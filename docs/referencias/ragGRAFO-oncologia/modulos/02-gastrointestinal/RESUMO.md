# Módulo 02 · Tumores gastrointestinais · grafo extraído (PRO 2026)

Fonte: 20 aulas (A02–A21) do Módulo 2 – `slides-pro-2026/Módulo 2 - Tumores Gastrointestinais`. Extração por `pdftotext -layout`, com apoio do resumo `output/Resumo_Diagnostico_Estadiamento_Tratamento_GI.md` e correções de `RESUMO-GI-PRO2026-AVALIACAO.md`. Todo nó tem `fonte` = aula + página e `status = NAO_VERIFICADO` (material de estudo, não evidência primária). Doses só quando literais na aula (`dose_literal`). Como `status` do nó é reservado a `NAO_VERIFICADO`, o status do trial (positivo/negativo/NS) está em `status_trial`; valores corrigidos guardam a lâmina em `aula_literal`; atualizações pós-aula em `atualizacao_externa`.

## Contagens

| tipo de nó | n |
|---|---|
| tumor | 12 |
| cenario | 69 |
| diagnostico | 56 |
| estadiamento | 37 |
| biomarcador | 23 |
| regime | 179 |
| farmaco | 73 |
| trial | 229 |
| fonte | 20 |
| **total** | **698** |

| relação | n |
|---|---|
| TEM_CENARIO | 69 |
| DIAGNOSTICA_POR | 56 |
| ESTADIA_POR | 37 |
| EXIGE_BIOMARCADOR | 46 |
| TRATA_COM | 173 |
| USA_FARMACO | 466 |
| SUSTENTADO_POR | 238 |
| TESTOU | 238 |
| FONTE | 678 |
| **total** | **2001** |

Validação: 698 nós e 2001 arestas, uma linha JSON por registro, todas parseáveis; 0 arestas órfãs; todo nó tem `fonte` (aula/página) e aresta `FONTE`; erros = 0.

## Tumor × cenário × regime × trial

| tumor | cenário | linha | regime | condição/biomarcador | trials | fonte |
|---|---|---|---|---|---|---|
| Câncer de esôfago | Doença superficial (Tis/T1a) | – | (sem regime sistêmico) | – | – | A02 p12 |
| Câncer de esôfago | CEC ressecável (neoadjuvante) | neoadjuvante | CROSS: carboplatina + paclitaxel + RT neoadjuvante | – | CROSS | A03 p8 |
| Câncer de esôfago | CEC ressecável (neoadjuvante) | neoadjuvante | DCF neoadjuvante | – | JCOG 1109 | A03 p11 |
| Câncer de esôfago | Adenocarcinoma ressecável (perioperatório) | neoadjuvante (alternativa) | CROSS: carboplatina + paclitaxel + RT neoadjuvante | – | CROSS | A03 p8 |
| Câncer de esôfago | Adenocarcinoma ressecável (perioperatório) | perioperatório | FLOT perioperatório | – | ESOPEC | A03 p19 |
| Câncer de esôfago | Adjuvante após QRT neoadjuvante + R0 com doença residual | adjuvante | Nivolumabe adjuvante 1 ano | – | CheckMate 577 | A03 p13 |
| Câncer de esôfago | Irressecável/inoperável ou cervical: QRT definitiva | definitiva | Cisplatina + 5-FU + RT definitiva | – | RTOG 8501 | A03 p16 |
| Câncer de esôfago | CEC avançado – 1ª linha | 1ª linha | Cisplatina + 5-FU + pembrolizumabe | PD-L1 CPS ≥10 | KEYNOTE 590 | A03 p24 |
| Câncer de esôfago | CEC avançado – 1ª linha | 1ª linha | Cisplatina + 5-FU + nivolumabe | PD-L1 TPS ≥1% | CheckMate 648 | A03 p26 |
| Câncer de esôfago | CEC avançado – 1ª linha | 1ª linha | Nivolumabe + ipilimumabe | PD-L1 TPS ≥1% | CheckMate 648 | A03 p26 |
| Câncer de esôfago | CEC avançado – 1ª linha | 1ª linha | Platina + fluoropirimidina (ou paclitaxel) + tislelizumabe | PD-L1 TAP ≥10% | RATIONALE 306 | A03 p28 |
| Câncer de esôfago | CEC avançado – 1ª linha | 1ª linha | Platina + fluoropirimidina (± taxano em casos selecionados) | PD-L1 negativo | – | A03 p23 |
| Câncer de esôfago | CEC avançado – 2ª linha | 2ª linha | Nivolumabe monoterapia (2ª linha) | se não usou imunoterapia | ATTRACTION-3 | A03 p30 |
| Câncer de esôfago | CEC avançado – 2ª linha | 2ª linha | Pembrolizumabe monoterapia (2ª linha) | PD-L1 CPS ≥10; se não usou imunoterapia | KEYNOTE 181 | A03 p30 |
| Câncer de esôfago | CEC avançado – 2ª linha | 2ª linha | Tislelizumabe monoterapia (2ª linha) | se não usou imunoterapia | RATIONALE 302 | A03 p30 |
| Câncer de esôfago | CEC avançado – 2ª linha | 2ª linha em diante | QT não utilizada (platina, fluoropirimidina, taxanos, irinotecano) | – | – | A03 p31 |
| Câncer de esôfago | Adenocarcinoma avançado – 1ª linha | 1ª linha | Cisplatina + 5-FU + pembrolizumabe | PD-L1 CPS ≥10 | KEYNOTE 590 | A03 p24 |
| Câncer de esôfago | Adenocarcinoma avançado – 1ª linha | 1ª linha | FOLFOX/CAPOX + nivolumabe | PD-L1 CPS ≥5 | CheckMate 649 | A03 p32 |
| Câncer de esôfago | Adenocarcinoma avançado – 1ª linha | 1ª linha | Platina + fluoropirimidina (± taxano em casos selecionados) | PD-L1 negativo / CPS <5 | – | A03 p23 |
| Câncer de esôfago | Adenocarcinoma avançado – 2ª linha | 2ª linha | Pembrolizumabe monoterapia (2ª linha) | PD-L1 CPS ≥10; se não usou imunoterapia | KEYNOTE 181 | A03 p30 |
| Câncer de esôfago | Adenocarcinoma avançado – 2ª linha | 2ª linha em diante | QT não utilizada (platina, fluoropirimidina, taxanos, irinotecano) | – | – | A03 p31 |
| Câncer gástrico e da junção esofagogástrica (TEG) | Doença inicial (ressecção endoscópica) | – | (sem regime sistêmico) | – | – | A05 p6 |
| Câncer gástrico e da junção esofagogástrica | Localizado ≥cT2 e/ou N+ – QT perioperatória | perioperatório | FLOT perioperatório | – | FLOT4 | A05 p11 |
| Câncer gástrico e da junção esofagogástrica | Localizado ≥cT2 e/ou N+ – QT perioperatória | perioperatório | FLOT + durvalumabe perioperatório → durvalumabe | – | MATTERHORN | A05 p17 |
| Câncer gástrico e da junção esofagogástrica | Localizado ≥cT2 e/ou N+ – QT perioperatória | perioperatório | ECF/ECX perioperatório (braço controle) | – | FLOT4 | A05 p11 |
| Câncer gástrico e da junção esofagogástrica | Operado sem tratamento prévio – adjuvante | adjuvante | CAPOX adjuvante 6 meses | – | CLASSIC | A05 p9 |
| Câncer gástrico e da junção esofagogástrica | Operado sem tratamento prévio – adjuvante | adjuvante | S-1 adjuvante 1 ano | – | ACTS-GC | A05 p9 |
| Câncer gástrico e da junção esofagogástrica | Operado sem tratamento prévio – adjuvante | adjuvante | S-1 + docetaxel adjuvante | – | JACCRO GC-07 | A05 p9 |
| Câncer gástrico e da junção esofagogástrica | Operado sem tratamento prévio – adjuvante | adjuvante | QRT adjuvante 5-FU/leucovorin + RT 45 Gy | – | INT 0116 | A05 p7 |
| Câncer gástrico e da junção esofagogástrica | Avançado – 1ª linha | 1ª linha | Imunoterapia ± QT (nivolumabe/pembrolizumabe ± FOLFOX/CAPOX) em dMMR/MSI-H | dMMR/MSI-H | CheckMate 649 | A05 p23 |
| Câncer gástrico e da junção esofagogástrica | Avançado – 1ª linha | 1ª linha | Trastuzumabe + pembrolizumabe + cisplatina/5-FU ou CAPOX | HER2+ e CPS ≥1 | KEYNOTE 811 | A05 p30 |
| Câncer gástrico e da junção esofagogástrica | Avançado – 1ª linha | 1ª linha | Trastuzumabe + cisplatina/5-FU ou FOLFOX | HER2+ e CPS <1 | ToGA | A05 p29 |
| Câncer gástrico e da junção esofagogástrica | Avançado – 1ª linha | 1ª linha | Platina + fluoropirimidina + nivolumabe (FOLFOX/CAPOX) | HER2− e CPS ≥5 | CheckMate 649 | A05 p25 |
| Câncer gástrico e da junção esofagogástrica | Avançado – 1ª linha | 1ª linha | Platina + fluoropirimidina + pembrolizumabe | HER2− e CPS ≥1 (preferência em CPS 1-5) | KEYNOTE 859 | A05 p25 |
| Câncer gástrico e da junção esofagogástrica | Avançado – 1ª linha | 1ª linha | Zolbetuximabe + FOLFOX/CAPOX | HER2−, CPS <1, CLDN18.2+ | SPOTLIGHT, GLOW | A05 p34 |
| Câncer gástrico e da junção esofagogástrica | Avançado – 1ª linha | 1ª linha | Platina + fluoropirimidina (+ taxano em casos selecionados) | HER2−, CPS <1, CLDN18.2 negativo | – | A05 p23 |
| Câncer gástrico e da junção esofagogástrica | Avançado – 1ª linha | 1ª linha | Tripla QT (DCF, mDCF, TFOX) | – | V325, GASTFOX-PRODIGE 51 | A05 p36 |
| Câncer gástrico e da junção esofagogástrica | Avançado – 2ª linha | 2ª linha | Paclitaxel + ramucirumabe | – | RAINBOW | A05 p41 |
| Câncer gástrico e da junção esofagogástrica | Avançado – 2ª linha | 2ª linha | FOLFIRI/irinotecano + ramucirumabe | – | RAMIRIS | A05 p41 |
| Câncer gástrico e da junção esofagogástrica | Avançado – 2ª linha | 2ª linha em diante | Trastuzumabe deruxtecana | HER2+ | DESTINY-Gastric04, DESTINY-Gastric01 | A05 p31 |
| Câncer gástrico e da junção esofagogástrica | Avançado – 2ª linha | 2ª linha | QT monoterapia (paclitaxel, irinotecano, docetaxel) | – | WJOG 4007, COUGAR-02 | A05 p43 |
| Câncer gástrico e da junção esofagogástrica | Avançado – 3ª linha em diante | 3ª linha em diante | Trastuzumabe deruxtecana | HER2+ se não usou em 2ª linha | DESTINY-Gastric04, DESTINY-Gastric01 | A05 p31 |
| Câncer gástrico e da junção esofagogástrica | Avançado – 3ª linha em diante | 2ª linha | QT monoterapia (paclitaxel, irinotecano, docetaxel) | – | WJOG 4007, COUGAR-02 | A05 p43 |
| Câncer gástrico e da junção esofagogástrica | Avançado – 3ª linha em diante | 2ª linha em diante | Ramucirumabe monoterapia | ramucirumabe se não utilizado | REGARD | A05 p43 |
| Câncer gástrico e da junção esofagogástrica | Avançado – 3ª linha em diante | 3ª linha em diante | Trifluridina/tipiracila (TAS-102) | – | TAGS | A05 p43 |
| Câncer gástrico e da junção esofagogástrica | Avançado – 3ª linha em diante | 3ª linha em diante | Nivolumabe ou pembrolizumabe monoterapia | se não usou imunoterapia | ATTRACTION-2, KEYNOTE 059 | A05 p43 |
| Adenocarcinoma de pâncreas | Ressecável sem fatores de risco – cirurgia + adjuvante | adjuvante | mFOLFIRINOX adjuvante | – | PRODIGE 24 | A07 p7 |
| Adenocarcinoma de pâncreas | Ressecável sem fatores de risco – cirurgia + adjuvante | adjuvante | Gemcitabina + capecitabina adjuvante | – | ESPAC-4 | A07 p7 |
| Adenocarcinoma de pâncreas | Ressecável sem fatores de risco – cirurgia + adjuvante | adjuvante | Gemcitabina adjuvante | – | CONKO-001, ESPAC-3 | A07 p7 |
| Adenocarcinoma de pâncreas | Ressecável sem fatores de risco – cirurgia + adjuvante | adjuvante | S-1 adjuvante | – | JASPAC 01 | A07 p7 |
| Adenocarcinoma de pâncreas | Ressecável sem fatores de risco – cirurgia + adjuvante | adjuvante | 5-FU/leucovorin adjuvante | – | ESPAC-1, ESPAC-3 | A07 p7 |
| Adenocarcinoma de pâncreas | Borderline ou ressecável com fatores de risco – tratamento sistêmico 'neoadjuvante'/conversão | 1ª linha (conversão) | mFOLFIRINOX pré-operatório (conversão) | – | ESPAC-5F, Alliance A021501, PREOPANC-2, CASSANDRA | A07 p13 |
| Adenocarcinoma de pâncreas | Borderline ou ressecável com fatores de risco – tratamento sistêmico 'neoadjuvante'/conversão | neoadjuvante | QRT com gemcitabina pré-operatória | – | PREOPANC, PREOPANC-2 | A07 p13 |
| Adenocarcinoma de pâncreas | Localmente avançado | 1ª linha | (m)FOLFIRINOX | – | PRODIGE 4/ACCORD 11, JCOG 1611 | A07 p23 |
| Adenocarcinoma de pâncreas | Localmente avançado | 1ª linha | Gemcitabina + nab-paclitaxel | – | MPACT, JCOG 1611, NEOLAP | A07 p23 |
| Adenocarcinoma de pâncreas | Localmente avançado | 1ª linha | Gemcitabina + nab-paclitaxel + Tumor Treating Fields | – | Tumor Treating Fields + gem/nab | A07 p19 |
| Adenocarcinoma de pâncreas | Metastático – 1ª linha | 1ª linha | (m)FOLFIRINOX | – | PRODIGE 4/ACCORD 11, JCOG 1611 | A07 p23 |
| Adenocarcinoma de pâncreas | Metastático – 1ª linha | 1ª linha | Gemcitabina + nab-paclitaxel | – | MPACT, JCOG 1611, NEOLAP | A07 p23 |
| Adenocarcinoma de pâncreas | Metastático – 1ª linha | 1ª linha | NALIRIFOX | – | NAPOLI 3 | A07 p23 |
| Adenocarcinoma de pâncreas | Metastático – 1ª linha | 1ª linha | Gemcitabina monoterapia | – | Burris 1997 | A07 p23 |
| Adenocarcinoma de pâncreas | Avançado – 2ª linha | 2ª linha | Gemcitabina + nab-paclitaxel | após FOLFIRINOX | MPACT, JCOG 1611, NEOLAP | A07 p23 |
| Adenocarcinoma de pâncreas | Avançado – 2ª linha | 2ª linha | OFF (oxaliplatina + 5-FU/LV) | – | CONKO 003 | A07 p25 |
| Adenocarcinoma de pâncreas | Avançado – 2ª linha | 2ª linha | Irinotecano lipossomal + 5-FU/LV | – | NAPOLI 1 | A07 p25 |
| Adenocarcinoma de pâncreas | Manutenção após platina em BRCA germinativo | manutenção | Olaparibe manutenção | BRCA1/2 germinativo | POLO | A07 p26 |
| Adenocarcinoma de pâncreas | Avançado refratário com alvo molecular | linhas posteriores | Sotorasibe | KRAS G12C | CodeBreaK 100 | A07 p27 |
| Adenocarcinoma de pâncreas | Avançado refratário com alvo molecular | linhas posteriores | Zenocutuzumabe | fusão NRG1 | eNRGy | A07 p28 |
| Câncer de vias biliares (colangiocarcinoma e vesícula biliar) | Vesícula biliar incidental pós-colecistectomia | – | (sem regime sistêmico) | – | – | A08 p16 |
| Câncer de vias biliares | Ressecado (R0/R1) – adjuvante | adjuvante | Capecitabina adjuvante 6 meses | – | BILCAP | A09 p6 |
| Câncer de vias biliares | Ressecado (R0/R1) – adjuvante | adjuvante | S-1 adjuvante 6 meses | – | ASCOT | A09 p6 |
| Câncer de vias biliares | Ressecado (R0/R1) – adjuvante | adjuvante | Gemcitabina + capecitabina → QRT com capecitabina | R1 / alto risco | SWOG 0809 | A09 p6 |
| Câncer de vias biliares | Avançado – 1ª linha | 1ª linha | Gemcitabina + cisplatina + durvalumabe | – | TOPAZ-1 | A09 p13 |
| Câncer de vias biliares | Avançado – 1ª linha | 1ª linha | Gemcitabina + cisplatina + pembrolizumabe | – | KEYNOTE 966 | A09 p13 |
| Câncer de vias biliares | Avançado – 2ª linha | 2ª linha | Pemigatinibe | fusão/rearranjo FGFR2 | FIGHT-202 | A09 p16 |
| Câncer de vias biliares | Avançado – 2ª linha | 2ª linha | Futibatinibe | fusão/rearranjo FGFR2 | FOENIX-CCA2 | A09 p16 |
| Câncer de vias biliares | Avançado – 2ª linha | 2ª linha | Ivosidenibe | IDH1 mutado | ClarIDHy | A09 p17 |
| Câncer de vias biliares | Avançado – 2ª linha | 2ª linha | Trastuzumabe + pertuzumabe | HER2 hiperexpresso | MyPathway | A09 p18 |
| Câncer de vias biliares | Avançado – 2ª linha | 2ª linha | Zanidatamabe | HER2 hiperexpresso (3+) | HERIZON-BTC-01 | A09 p18 |
| Câncer de vias biliares | Avançado – 2ª linha | 2ª linha | Trastuzumabe deruxtecana | HER2 IHQ 3+ | DESTINY-PanTumor02 | A09 p18 |
| Câncer de vias biliares | Avançado – 2ª linha | 2ª linha | Dabrafenibe + trametinibe | BRAF V600E | ROAR | A09 p18 |
| Câncer de vias biliares | Avançado – 2ª linha | 2ª linha | FOLFOX | sem alteração acionável | ABC-06 | A09 p19 |
| Câncer de vias biliares | Avançado – 2ª linha | linhas posteriores | Irinotecano lipossomal + 5-FU/LV (ou FOLFIRI/irinotecano) | QT não utilizada | NIFTY, NALIRICC | A09 p19 |
| Carcinoma hepatocelular (CHC) | Após ressecção/ablação curativa (adjuvância) | – | (sem regime sistêmico) | – | – | A11 p10 |
| Carcinoma hepatocelular | Ressecável de alto risco – perioperatório | perioperatório | Camrelizumabe + rivoceranibe perioperatório | – | CARES 009 | A11 p11 |
| Carcinoma hepatocelular | Intermediário (BCLC B) – TACE/TARE ± sistêmico | alternativa à TACE | Atezolizumabe + bevacizumabe | – | IMbrave150, IKF-035/ABC-HCC, Atezolizumabe + bevacizumabe e conversão cirúrgica | A11 p27 |
| Carcinoma hepatocelular | Avançado – 1ª linha | 1ª linha | Atezolizumabe + bevacizumabe | – | IMbrave150, IKF-035/ABC-HCC, Atezolizumabe + bevacizumabe e conversão cirúrgica | A11 p27 |
| Carcinoma hepatocelular | Avançado – 1ª linha | 1ª linha | STRIDE: durvalumabe + tremelimumabe | – | HIMALAYA | A11 p27 |
| Carcinoma hepatocelular | Avançado – 1ª linha | 1ª linha | Durvalumabe monoterapia | – | HIMALAYA | A11 p27 |
| Carcinoma hepatocelular | Avançado – 1ª linha | 1ª linha | Nivolumabe + ipilimumabe | – | CheckMate 9DW, CheckMate 040 | A11 p27 |
| Carcinoma hepatocelular | Avançado – 1ª linha | 1ª linha | Camrelizumabe + rivoceranibe | – | CARES-310 | A11 p27 |
| Carcinoma hepatocelular | Avançado – 1ª linha | 1ª linha | Sorafenibe | – | SHARP | A11 p29 |
| Carcinoma hepatocelular | Avançado – 1ª linha | 1ª linha | Lenvatinibe | – | REFLECT | A11 p29 |
| Carcinoma hepatocelular | Avançado – 2ª linha em diante | 2ª linha | Nivolumabe + ipilimumabe | – | CheckMate 9DW, CheckMate 040 | A11 p27 |
| Carcinoma hepatocelular | Avançado – 2ª linha em diante | 2ª linha | Pembrolizumabe (2ª linha) | – | KEYNOTE 394, KEYNOTE 240 | A11 p31 |
| Carcinoma hepatocelular | Avançado – 2ª linha em diante | 2ª linha em diante | Cabozantinibe | – | CELESTIAL | A11 p31 |
| Carcinoma hepatocelular | Avançado – 2ª linha em diante | 2ª linha | Regorafenibe | tolerante ao sorafenibe | RESORCE | A11 p31 |
| Carcinoma hepatocelular | Avançado – 2ª linha em diante | 2ª linha | Ramucirumabe | AFP ≥400 ng/mL | REACH-2 | A11 p31 |
| Câncer de cólon (colorretal) | Estádio I (pT1-2 N0) | – | (sem regime sistêmico) | – | – | A13 p5 |
| Câncer de cólon | Estádio II – adjuvância conforme risco/proteção | adjuvante | Fluoropirimidina adjuvante 6 meses (5-FU/LV ou capecitabina) | EC II com fatores de risco, pMMR | QUASAR, X-ACT, Análise agrupada dMMR | A13 p7 |
| Câncer de cólon | Estádio II – adjuvância conforme risco/proteção | adjuvante | FOLFOX/CAPOX adjuvante (3 ou 6 meses) | EC II alto risco/ctDNA positivo | MOSAIC, NSABP C-07, XELOXA, IDEA, DYNAMIC, DYNAMIC-III | A13 p12 |
| Câncer de cólon | Estádio III – adjuvante | adjuvante | FOLFOX/CAPOX adjuvante (3 ou 6 meses) | baixo risco: CAPOX 3 meses; alto risco pT4/pN2: 6 meses | MOSAIC, NSABP C-07, XELOXA, IDEA, DYNAMIC, DYNAMIC-III | A13 p12 |
| Câncer de cólon | Estádio III dMMR – adjuvante | adjuvante | mFOLFOX6 6 meses + atezolizumabe 1 ano | dMMR | ATOMIC | A13 p17 |
| Câncer de cólon | Localmente avançado dMMR – imunoterapia neoadjuvante (?) | neoadjuvante | Nivolumabe + ipilimumabe neoadjuvante | dMMR | NICHE-2 | A13 p37 |
| Câncer de cólon | Pós-adjuvância: atividade física e AAS | adjuvante (suporte) | AAS 160 mg/d por 3 anos | alteração da via PI3K | ALASCCA | A13 p31 |
| Câncer de cólon | Metástases hepáticas ressecáveis / oligometastático | perioperatório | FOLFOX perioperatório/adjuvante em metástases hepáticas ressecáveis | – | EORTC 40983, JCOG 0603 | A15 p10 |
| Câncer de cólon | Metástases hepáticas irressecáveis – terapia de conversão | 1ª linha (conversão) | FOLFOXIRI + bevacizumabe (conversão) | – | CAIRO 5 | A15 p13 |
| Câncer de cólon | Metastático – 1ª linha | 1ª linha | Imunoterapia: ipilimumabe + nivolumabe, nivolumabe ou pembrolizumabe | dMMR/MSI-H | KEYNOTE 177, CheckMate 8HW | A15 p21 |
| Câncer de cólon | Metastático – 1ª linha | 1ª linha | Encorafenibe + cetuximabe + mFOLFOX6 | BRAF V600E, pMMR | BREAKWATER | A15 p26 |
| Câncer de cólon | Metastático – 1ª linha | 1ª linha | PoliQT (FOLFOX/FOLFIRI) + cetuximabe ou panitumumabe | pMMR, RAS/BRAF selvagem, cólon esquerdo | PARADIGM, FIRE-3, CALGB/SWOG 80405, CRYSTAL, PRIME | A14 p12 |
| Câncer de cólon | Metastático – 1ª linha | 1ª linha | PoliQT (FOLFOX/CAPOX/FOLFIRI) ± bevacizumabe | pMMR, RAS mutado ou cólon direito | AVF2107g, NO16966, E3200, ML18147, FIRE-3, CALGB/SWOG 80405 | A14 p9 |
| Câncer de cólon | Metastático – 1ª linha | 1ª linha | FOLFOXIRI + bevacizumabe (intensificação) | pacientes selecionados | TRIBE, TRIBE-2 | A14 p29 |
| Câncer de cólon | Metastático – 1ª linha | 1ª linha | Capecitabina + bevacizumabe (idosos) | ≥70 anos | AVEX | A14 p27 |
| Câncer de cólon | Metastático – manutenção/desintensificação | manutenção | Manutenção com fluoropirimidina (retirar oxaliplatina) | – | OPTIMOX1 | A14 p19 |
| Câncer de cólon | Metastático – manutenção/desintensificação | manutenção | Manutenção capecitabina + bevacizumabe | – | CAIRO 3 | A14 p23 |
| Câncer de cólon | Metastático – manutenção/desintensificação | manutenção | Manutenção 5-FU/LV + panitumumabe | RAS wt após FOLFOX + panitumumabe | PANAMA, VALENTINO, PANDA | A14 p25 |
| Câncer de cólon | Metastático – 2ª linha | 2ª linha em diante | Encorafenibe + cetuximabe (± binimetinibe) | BRAF V600E | BEACON | A15 p26 |
| Câncer de cólon | Metastático – 2ª linha | 2ª linha | PoliQT (FOLFOX/CAPOX/FOLFIRI) ± bevacizumabe | trocar QT, manter antiangiogênico | AVF2107g, NO16966, E3200, ML18147, FIRE-3, CALGB/SWOG 80405 | A14 p9 |
| Câncer de cólon | Metastático – 2ª linha | 2ª linha | FOLFIRI + aflibercepte | – | VELOUR | A14 p9 |
| Câncer de cólon | Metastático – 2ª linha | 2ª linha | FOLFIRI + ramucirumabe | – | RAISE | A14 p9 |
| Câncer de cólon | Metastático – linhas posteriores | linhas posteriores | Anti-EGFR ± irinotecano (linhas avançadas) | RAS wt sem anti-EGFR prévio | ASPECCT, BOND | A14 p10 |
| Câncer de cólon | Metastático – linhas posteriores | linhas posteriores | Regorafenibe | – | CORRECT | A14 p15 |
| Câncer de cólon | Metastático – linhas posteriores | linhas posteriores | Trifluridina/tipiracila + bevacizumabe | – | SUNLIGHT | A14 p15 |
| Câncer de cólon | Metastático – linhas posteriores | linhas posteriores | Trifluridina/tipiracila | – | RECOURSE | A14 p15 |
| Câncer de cólon | Metastático – linhas posteriores | linhas posteriores | Fruquintinibe | – | FRESCO-2 | A14 p15 |
| Câncer de cólon | Metastático – linhas posteriores | linhas posteriores | Trastuzumabe + lapatinibe | HER2+, RAS wt | HERACLES-A | A15 p30 |
| Câncer de cólon | Metastático – linhas posteriores | linhas posteriores | Trastuzumabe + pertuzumabe | HER2+ | MyPathway | A15 p30 |
| Câncer de cólon | Metastático – linhas posteriores | linhas posteriores | Trastuzumabe deruxtecana | HER2+ (IHQ 3+ ou 2+/ISH+) | DESTINY-CRC01, DESTINY-CRC02 | A15 p30 |
| Câncer de cólon | Metastático – linhas posteriores | linhas posteriores | Inibidor de KRAS G12C + anti-EGFR (sotorasibe + panitumumabe; adagrasibe + cetuximabe) | KRAS G12C | CodeBreaK 300, KRYSTAL-1 | A15 p31 |
| Câncer de reto | cT1N0 favorável – excisão local | – | (sem regime sistêmico) | – | – | A16 p18 |
| Câncer de reto | cT1-2N0 / cT3N0 selecionado – cirurgia (ETM) upfront ± QT adjuvante | adjuvante | FOLFOX adjuvante após QRT | – | ADORE | A16 p26 |
| Câncer de reto | Localmente avançado (cT3 N0, cT2-3 N1, cT4) – neoadjuvância (QT, RTsc ou QRT) | neoadjuvante | QRT com fluoropirimidina (5-FU ou capecitabina) | – | EORTC 22921, CAO/ARO/AIO-94, Trans-Tasman, PROSPECT | A16 p24 |
| Câncer de reto | Localmente avançado (cT3 N0, cT2-3 N1, cT4) – neoadjuvância (QT, RTsc ou QRT) | neoadjuvante | FOLFOX neoadjuvante com QRT seletiva | cT3N0 / cT2-3N1 selecionado | PROSPECT | A16 p28 |
| Câncer de reto | Alto risco (N2, FMR+, IVEM+, reto baixo, cT4) – terapia neoadjuvante total (TNT) | neoadjuvante (TNT) | TNT com consolidação: RT curta → FOLFOX/CAPOX → ETM | – | RAPIDO, OPRA | A16 p31 |
| Câncer de reto | Alto risco (N2, FMR+, IVEM+, reto baixo, cT4) – terapia neoadjuvante total (TNT) | neoadjuvante (TNT) | TNT com indução: mFOLFIRINOX → QRT → ETM → QT adjuvante | – | PRODIGE 23 | A16 p31 |
| Câncer de reto | Resposta clínica completa – manejo não operatório (watch and wait) | neoadjuvante (TNT) | QRT + QT de consolidação (FOLFOX/CAPOX) visando preservação de órgão | – | OPRA, NO-CUT | A16 p35 |
| Câncer de reto | dMMR/MSI-H – imunoterapia neoadjuvante | neoadjuvante | Dostarlimabe neoadjuvante 6 meses | dMMR/MSI-H | Dostarlimabe em reto dMMR | A16 p41 |
| Câncer de reto | Adjuvante após neoadjuvância | adjuvante | FOLFOX adjuvante após QRT | – | ADORE | A16 p26 |
| Câncer de canal anal | Locorregional – QRT definitiva | definitiva | QRT: RT 50,4 Gy + mitomicina + 5-FU | – | ACT I, RTOG 8704, ACT II | A17 p13 |
| Câncer de canal anal | Locorregional – QRT definitiva | definitiva | QRT: RT 50,4 Gy + cisplatina + 5-FU (indisponibilidade de MMC) | – | ACT II | A17 p13 |
| Câncer de canal anal | Recorrente/metastático – 1ª linha | 1ª linha | Carboplatina + paclitaxel + retifanlimabe | – | POD1UM-303/InterAACT 2 | A17 p19 |
| Câncer de canal anal | Recorrente/metastático – 1ª linha | 1ª linha | Carboplatina + paclitaxel | – | InterAACT | A17 p18 |
| Câncer de canal anal | Recorrente/metastático – 1ª linha | 1ª linha | Outras poliQT com platina (cisplatina + 5-FU, FOLFCIS, FOLFOX, mDCF) | – | InterAACT, Epitopes-HPV02 | A17 p20 |
| Câncer de canal anal | Avançado – 2ª linha | 2ª linha | Nivolumabe ou pembrolizumabe | – | NCI 9673, KEYNOTE 158 | A17 p20 |
| Câncer de canal anal | Avançado – 2ª linha | 2ª linha | Monoquimioterapia (5-FU, taxano, irinotecano, MMC, gemcitabina) | – | – | A17 p20 |
| Neoplasias do apêndice cecal | Doença localizada – apendicectomia ± colectomia direita | adjuvante | QT adjuvante aos moldes do CCR (FOLFOX/CAPOX) | adenocarcinoma após colectomia | Asare 2016 | A18 p27 |
| Neoplasias do apêndice cecal | Doença peritoneal – citorredução ± HIPEC ou sistêmico | locorregional | Citorredução + HIPEC com mitomicina C | – | Kusamura 2021, HIPEC oxaliplatina vs mitomicina C | A18 p37 |
| Neoplasias do apêndice cecal | Doença peritoneal – citorredução ± HIPEC ou sistêmico | locorregional | Citorredução + HIPEC com oxaliplatina | – | HIPEC oxaliplatina vs mitomicina C | A18 p39 |
| Neoplasias do apêndice cecal | Doença peritoneal – citorredução ± HIPEC ou sistêmico | perioperatório/sistêmico | QT sistêmica aos moldes do CCR (fluoropirimidina, oxaliplatina, irinotecano ± bevacizumabe) | – | Mohamedtaki 2014, Choe 2015 | A18 p31 |
| Neoplasias do apêndice cecal | Adenocarcinoma avançado – tratamento sistêmico (aos moldes do CCR) | 1ª linha | QT sistêmica aos moldes do CCR (fluoropirimidina, oxaliplatina, irinotecano ± bevacizumabe) | – | Mohamedtaki 2014, Choe 2015 | A18 p31 |
| Carcinoma adrenocortical (CAC) | Ressecado baixo risco (R0, Ki-67 ≤10%) – observação | – | (sem regime sistêmico) | – | – | A19 p20 |
| Carcinoma adrenocortical | Ressecado alto risco (Ki-67 >10%, R1, ruptura, >8 cm, invasão) – mitotano adjuvante | adjuvante | Mitotano adjuvante | – | Terzolo 2007, ADIUVO | A19 p19 |
| Carcinoma adrenocortical | Avançado/metastático | 1ª linha | EDP + mitotano | – | FIRM-ACT | A19 p22 |
| Carcinoma adrenocortical | Avançado/metastático | 1ª linha | Mitotano monoterapia | incapaz de QT e baixo volume | – | A19 p22 |
| Carcinoma adrenocortical | Avançado/metastático | linhas posteriores | Pembrolizumabe | – | Pembrolizumabe no CAC | A19 p22 |
| Carcinoma adrenocortical | Avançado/metastático | linhas posteriores | Cabozantinibe | – | Cabozantinibe no CAC | A19 p22 |
| Feocromocitoma e paraganglioma (PPGL) | Localizado – cirurgia com preparo alfa-bloqueador | – | (sem regime sistêmico) | – | – | A19 p30 |
| Feocromocitoma e paraganglioma | Avançado/metastático | 1ª linha | CVD (ciclofosfamida, vincristina, dacarbazina) | – | CVD em PPGL | A19 p31 |
| Feocromocitoma e paraganglioma | Avançado/metastático | sistêmico | Sunitinibe | – | FIRSTMAPPP | A19 p31 |
| Feocromocitoma e paraganglioma | Avançado/metastático | sistêmico | Cabozantinibe | – | NATALIE | A19 p31 |
| Feocromocitoma e paraganglioma | Avançado/metastático | sistêmico | I-131-MIBG | captação de MIBG | I-131-MIBG | A19 p31 |
| Feocromocitoma e paraganglioma | Avançado/metastático | sistêmico | Belzutifano | – | LITESPARK-015 | A19 p32 |
| Neoplasias neuroendócrinas (TNE bem diferenciado e carcinoma neuroendócrino) | Localizado – ressecção, sem adjuvância | – | (sem regime sistêmico) | – | – | A20 p20 |
| Neoplasias neuroendócrinas (TNE bem diferenciado e carcinoma neuroendócrino) | Avançado G1 não funcionante indolente – watch and wait | – | (sem regime sistêmico) | – | – | A21 p7 |
| Neoplasias neuroendócrinas | TNE pancreático avançado – 1ª linha | 1ª linha | Octreotida LAR | SSTR+, G1-2 | PROMID, RADIANT-2 | A21 p12 |
| Neoplasias neuroendócrinas | TNE pancreático avançado – 1ª linha | 1ª linha | Lanreotida | SSTR+, Ki-67 <10% | CLARINET | A21 p12 |
| Neoplasias neuroendócrinas | TNE pancreático avançado – 1ª linha | 1ª/2ª linha | Everolimo | – | RADIANT-3, RADIANT-4 | A21 p15 |
| Neoplasias neuroendócrinas | TNE pancreático avançado – 1ª linha | 1ª/2ª linha | Sunitinibe | TNE pancreático | Sunitinibe em TNE pancreático | A21 p17 |
| Neoplasias neuroendócrinas | TNE pancreático avançado – 1ª linha | 1ª/2ª linha | Capecitabina + temozolomida (CAPTEM) e outras QT (estreptozocina + 5-FU/doxorrubicina) | – | E2211 | A21 p23 |
| Neoplasias neuroendócrinas | TNE pancreático avançado – 1ª linha | 1ª/2ª linha | Lu-177-DOTATATE (PRRT) + octreotida | SSTR+ | NETTER-1, NETTER-2 | A21 p26 |
| Neoplasias neuroendócrinas | TNE não pancreático avançado – 1ª linha | 1ª linha | Octreotida LAR | SSTR+, G1-2 | PROMID, RADIANT-2 | A21 p12 |
| Neoplasias neuroendócrinas | TNE não pancreático avançado – 1ª linha | 1ª linha | Lanreotida | SSTR+, Ki-67 <10% | CLARINET | A21 p12 |
| Neoplasias neuroendócrinas | TNE não pancreático avançado – 1ª linha | 1ª/2ª linha | Everolimo | – | RADIANT-3, RADIANT-4 | A21 p15 |
| Neoplasias neuroendócrinas | TNE não pancreático avançado – 1ª linha | 1ª/2ª linha | Lu-177-DOTATATE (PRRT) + octreotida | SSTR+ | NETTER-1, NETTER-2 | A21 p26 |
| Neoplasias neuroendócrinas | TNE G2-G3 (Ki-67 20-55%) – 1ª linha | 1ª/2ª linha | Capecitabina + temozolomida (CAPTEM) e outras QT (estreptozocina + 5-FU/doxorrubicina) | – | E2211 | A21 p23 |
| Neoplasias neuroendócrinas | TNE G2-G3 (Ki-67 20-55%) – 1ª linha | 1ª/2ª linha | Lu-177-DOTATATE (PRRT) + octreotida | SSTR+ | NETTER-1, NETTER-2 | A21 p26 |
| Neoplasias neuroendócrinas | TNE avançado – 2ª linha em diante | 1ª/2ª linha | Everolimo | – | RADIANT-3, RADIANT-4 | A21 p15 |
| Neoplasias neuroendócrinas | TNE avançado – 2ª linha em diante | 2ª linha | Sunitinibe | TNE pancreático | Sunitinibe em TNE pancreático | A21 p17 |
| Neoplasias neuroendócrinas | TNE avançado – 2ª linha em diante | 2ª linha em diante | Cabozantinibe | – | CABINET | A21 p18 |
| Neoplasias neuroendócrinas | TNE avançado – 2ª linha em diante | 1ª/2ª linha | Capecitabina + temozolomida (CAPTEM) e outras QT (estreptozocina + 5-FU/doxorrubicina) | – | E2211 | A21 p23 |
| Neoplasias neuroendócrinas | TNE avançado – 2ª linha em diante | 1ª/2ª linha | Lu-177-DOTATATE (PRRT) + octreotida | SSTR+ | NETTER-1, NETTER-2 | A21 p26 |
| Neoplasias neuroendócrinas | TNE avançado – 2ª linha em diante | 2ª linha | QT de 2ª linha no CNE (dacarbazina, fluoropirimidinas, estreptozocina, temozolomida) | G3 / CNE | – | A21 p6 |
| Neoplasias neuroendócrinas | TNE G3 Ki-67 >55% / carcinoma neuroendócrino avançado | 1ª linha | Platina + etoposídeo | – | NORDIC NEC, TOPIC-NEC | A21 p40 |
| Neoplasias neuroendócrinas | TNE G3 Ki-67 >55% / carcinoma neuroendócrino avançado | 1ª linha | Cisplatina + irinotecano | – | TOPIC-NEC | A21 p40 |
| Neoplasias neuroendócrinas | Carcinoma neuroendócrino localizado | perioperatório | Platina + etoposídeo | – | NORDIC NEC, TOPIC-NEC | A21 p40 |

### Regimes testados mas não recomendados pela aula (sem TRATA_COM)

- QT perioperatória + pembrolizumabe — negativo para SLE; não recomendado pela aula (KEYNOTE 585; A05 p16)
- FLOT + atezolizumabe perioperatório — fase II, desfechos de sobrevida em andamento (DANTE; A05 p16)
- QRT pré-operatória (RT 45 Gy + fluoropirimidina) adicionada à QT perioperatória — aumentou RPC sem ganho de SG (TOPGEAR; A05 p14)
- XP/SOX com QRT adjuvante (ARTIST/CRITICS) — RT sem ganho quando D2 + QT adequadas (ARTIST 1, ARTIST 2, CRITICS; A05 p14)
- Nivolumabe + ipilimumabe adjuvante — inferior à QT adjuvante (VESTIGE; A05 p16)
- QT adjuvante + nivolumabe — sem benefício (ATTRACTION-5; A05 p16)
- Zanidatamabe + QT ± tislelizumabe — dados de congresso; fora do algoritmo da aula (HERIZON-GEA-01; A05 p32)
- FOLFOX + bemarituzumabe — benefício diluído; desenvolvimento interrompido (Bemarituzumabe + FOLFOX em FGFR2b; A05 p37)
- Gemcitabina + nab-paclitaxel adjuvante — desfecho primário não atingido (APACT; A07 p7)
- QT perioperatória/neoadjuvante no ressecável (mFOLFIRINOX, gem/nab, gem+S-1) — aula: não é padrão; se ressecável e operável, seguir com cirurgia (SWOG S1505, NEONAX, NORPACT-1, JSAP-05; A07 p8)
- PAXG (cisplatina, nab-paclitaxel, capecitabina, gemcitabina) — maior toxicidade; SG imatura (CASSANDRA; A07 p13)
- Gemcitabina + paclitaxel — após FOLFIRINOX; sem ganho de SG (GEMPAX; A07 p25)
- GEMOX adjuvante — sem benefício (PRODIGE 12; A09 p6)
- Gemcitabina adjuvante — sem benefício (BCAT; A09 p6)
- Gemcitabina + cisplatina adjuvante — sem benefício vs capecitabina (STAMP; A09 p6)
- Gemcitabina + cisplatina perioperatória — não é padrão (GAIN; A09 p7)
- Trastuzumabe + tucatinibe —  (SGNTUC-019; A09 p18)
- Atezolizumabe + bevacizumabe adjuvante — aula: sem benefício para adjuvância em CHC (IMbrave050; A11 p9)
- Pembrolizumabe adjuvante — negativo (KEYNOTE 937; A11 p10)
- TACE + durvalumabe + bevacizumabe — SLP sem ganho de SG; TACE com doxorrubicina/epirrubicina/cisplatina (EMERALD-1; A11 p23)
- TACE + pembrolizumabe + lenvatinibe — SLP sem ganho de SG; estudo encerrado (LEAP-012; A11 p23)
- Cabozantinibe + atezolizumabe — sem ganho de SG (COSMIC-312; A11 p27)
- Lenvatinibe + pembrolizumabe — não atingiu significância (LEAP-002; A11 p27)
- Nivolumabe monoterapia — NS (CheckMate 459; A11 p27)
- FOLFOX4 sistêmico —  (EACH; A11 p33)
- Doxorrubicina + sorafenibe — sem benefício (CALGB 80802; A11 p33)
- FOLFOX intra-arterial hepático (HAIC) — população asiática (FOHAIC-1; A11 p33)
- QT + cetuximabe perioperatório em metástases hepáticas ressecáveis — prejuízo de SG – não usar (New EPOC; A15 p10)
- mFOLFOXIRI + panitumumabe — não aumenta TRO/SLP (TRIPLETE; A14 p29)
- Reexposição/rechallenge anti-EGFR guiado por ctDNA — resultados limitados (FIRE-4, CITRIC; A15 p32)
- Zanzalintinibe + atezolizumabe —  (STELLAR-303; A15 p24)
- QT de indução cisplatina/5-FU → QRT — inferior; não usar (RTOG 9811; A17 p11)
- Everolimo + lanreotida — dado de congresso (Everolimo + lanreotida vs everolimo; A21 p21)

## Correções aplicadas (RESUMO-GI-PRO2026-AVALIACAO)

- **INT 0116 (Macdonald)**: gravado `SGm 36 vs 27 m; HR 1,32 (1,10-1,60) a favor da QRT`; literal da lâmina em `aula_literal` = SGm 35,0 vs 27,0 m (slide) (A05 p7).
- **TOPGEAR**: gravado `SGm 46,4 vs 49,4 m (NS); RPC 17% vs 8%; SG 5 anos 44,4% vs 45,7%`; literal da lâmina em `aula_literal` = RPC 12 x 6% (slide) (A05 p14).
- **FOENIX-CCA2 (Goyal, NEJM 2023)**: gravado `TRO 41,7%; DoR 9,5 m; SLPm 9,0 m; SGm 20,0 m`; literal da lâmina em `aula_literal` = SLPm 8,9 meses (slide) (A09 p16).
- **TRIBE**: gravado `SLP 12,1 vs 9,7 m; SG 29,8 vs 25,8 m; TRO 65% vs 53%`; literal da lâmina em `aula_literal` = TRO 65,1 x 51,1% (slide) (A14 p29-30).
- **RADIANT-4**: gravado `SLP 11,0 vs 3,9 m, HR 0,48`; literal da lâmina em `aula_literal` = SLP 14,0 x 5,5 m; HR 0,39 (slide) (A21 p15).

## Atualizações externas anotadas (`atualizacao_externa`)

- **CheckMate 577** (positivo (SLD); SG final NS): SG final NS: 51,7 vs 35,3 m; HR 0,85 (0,70-1,04); p=0,106 (ASCO 2025) – já exibida na aula p14; benefício em SLD sem ganho de SG
- **MATTERHORN** (positivo): SG final positiva: HR 0,78 (0,63-0,96); p=0,021 (Lancet 2026) – SG também exibida na aula p18 (ESMO 2025)
- **EMERALD-1** (positivo (SLP); SG final negativa): SG final negativa: durva+beva+TACE vs TACE 29,9 vs 33,3 m; HR 1,10 (0,87-1,39); G3-4 47,4% vs 25,0% (ESMO GI 2026) – não usar fora de estudo
- **LEAP-012** (positivo (SLP); encerrado sem ganho de SG): estudo encerrado em 29/10/2025 por baixa probabilidade de atingir SG (comunicado Merck/Eisai); ganho de SLP sem ganho de SG
- **CheckMate 9DW** (positivo): avaliação externa: excesso de óbitos precoces nos primeiros 6 meses (HR 1,65; 1,12-2,43)
- **CARES-310** (positivo): avaliação externa: SG final 23,8 vs 15,2 m; HR 0,64 (Lancet Oncol 2025)

## Lacunas

- **GIST**: não há aula no módulo (A02–A21); sem nós de GIST.
- **Trials do resumo ausentes das aulas (não incluídos)**: RASolute-302/daraxonrasibe (aula só cita 'ficar atento', A07 p29), MOUNTAINEER (tucatinibe no CCR), ABC-02, KEYNOTE-975, Neo-AEGIS, FIGHT-302, AZUR-1/2, NEONIPIGA/INFINITY, crossover de QT no apêndice mucinoso de baixo grau, dostarlimabe 49/49 (aula traz 42/42, ASCO 2024).
- **Tratamentos não farmacológicos** (cirurgia, RT isolada, RT curta 5x5, TACE/TARE, ablação, transplante, citorredução) ficaram como observação de cenário ou trial sem regime; o esquema só modela regimes com fármacos.
- **Tabelas embaralhadas na extração**: números ambíguos foram omitidos (ex.: HR de SLP do KEYNOTE-177, TRO do CheckMate 9DW/CARES-310, RPC do FLOT4, IC do KEYNOTE-966); RADIANT-2 mantido com literal não conferido; RADIANT-4 corrigido com `aula_literal`.
- **Dados de congresso** marcados em `observacao`: KEYNOTE-937, CARES-009, ABC-HCC, HERIZON-GEA-01, GASTFOX, FIRE-4, CITRIC, everolimo+lanreotida, conversão atezo/beva.
- **Sem camada SUS/Anvisa** (fora do escopo das aulas).
- **Trials sem regime ligado** (8; comparam estratégias não farmacológicas): SANO; Dutch D1D2 / JCOG 9501 (D2 vs D2+para-aórtica); CHALLENGE; COLLISION; TRANSMET; ORCHESTRA; Dutch TME; ASPEN.
