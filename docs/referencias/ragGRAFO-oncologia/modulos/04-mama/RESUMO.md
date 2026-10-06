# Módulo 04 – Câncer de Mama · grafo de conhecimento (aulas 33–41)

Fonte: slides PRO 2026 - Módulo 4 - Câncer de Mama (9 PDFs). Extração por `pdftotext -layout` + leitura visual das páginas-imagem (tabelas/curvas). Todos os nós com `status = NAO_VERIFICADO` (resumo de aula, não evidência primária).

## Contagens

| tipo de nó | n |
|---|---|
| tumor | 1 |
| cenario | 20 |
| diagnostico | 8 |
| estadiamento | 4 |
| biomarcador | 11 |
| regime | 86 |
| farmaco | 47 |
| trial | 92 |
| fonte | 9 |
| **total** | **278** |

| relação | n |
|---|---|
| TEM_CENARIO | 20 |
| DIAGNOSTICA_POR | 8 |
| ESTADIA_POR | 4 |
| EXIGE_BIOMARCADOR | 22 |
| TRATA_COM | 113 |
| USA_FARMACO | 190 |
| SUSTENTADO_POR | 88 |
| TESTOU | 108 |
| FONTE | 337 |
| **total** | **890** |

## Tumor × cenário × regime × trial

| tumor | cenário | linha | regime | condição biomarcador | trial(s) |
|---|---|---|---|---|---|
| Câncer de mama | Manejo locorregional (cirurgia, axila, RT) | adjuvante | Radioterapia adjuvante (mama/parede ± drenagens) | — | EBCTCG – metanálises de radioterapia; Scottish Breast Conservation Trial (30 anos) |
| Câncer de mama | Manejo locorregional (cirurgia, axila, RT) | cirurgia axilar | Omissão da BLS (≥50 a, GH1-2, RH+/HER2−, cN0) | — | SOUND; INSEMA |
| Câncer de mama | Manejo locorregional (cirurgia, axila, RT) | cirurgia axilar | BLS sem esvaziamento axilar (<3 LNS positivos) | — | ACOSOG Z0011; SENOMAC |
| Câncer de mama | RH+/HER2− localizado – adjuvância | (neo)adjuvante | AC-T (doxorrubicina + ciclofosfamida → paclitaxel), preferencialmente dose-densa | — | EBCTCG 2012 (antraciclinas e taxanos); EBCTCG 2019 (dose-densa); EBCTCG 2023 (taxano + antraciclina vs só taxano); ECOG 1199 |
| Câncer de mama | Triplo-negativo – adjuvância (cirurgia upfront) | (neo)adjuvante | AC-T (doxorrubicina + ciclofosfamida → paclitaxel), preferencialmente dose-densa | — | EBCTCG 2012 (antraciclinas e taxanos); EBCTCG 2019 (dose-densa); EBCTCG 2023 (taxano + antraciclina vs só taxano); ECOG 1199 |
| Câncer de mama | Triplo-negativo localizado – neoadjuvância | (neo)adjuvante | AC-T (doxorrubicina + ciclofosfamida → paclitaxel), preferencialmente dose-densa | — | EBCTCG 2012 (antraciclinas e taxanos); EBCTCG 2019 (dose-densa); EBCTCG 2023 (taxano + antraciclina vs só taxano); ECOG 1199 |
| Câncer de mama | RH+/HER2− localizado – adjuvância | (neo)adjuvante | TC (docetaxel + ciclofosfamida) ×4-6 | — | — |
| Câncer de mama | Triplo-negativo – adjuvância (cirurgia upfront) | (neo)adjuvante | TC (docetaxel + ciclofosfamida) ×4-6 | — | — |
| Câncer de mama | Triplo-negativo – adjuvância (cirurgia upfront) | (neo)adjuvante | Carboplatina + docetaxel | — | — |
| Câncer de mama | Triplo-negativo localizado – neoadjuvância | (neo)adjuvante | Carboplatina + docetaxel | — | — |
| Câncer de mama | RH+/HER2− localizado – adjuvância | adjuvante | Indicação de QT adjuvante em RH+/HER2− (risco genômico/clínico) | Oncotype RS / alto risco clínico | TAILORx; RxPONDER |
| Câncer de mama | RH+/HER2− localizado – adjuvância | adjuvante | Tamoxifeno adjuvante | — | — |
| Câncer de mama | Câncer de mama em homens | adjuvante | Tamoxifeno adjuvante | — | — |
| Câncer de mama | RH+/HER2− localizado – adjuvância | adjuvante | Inibidor de aromatase adjuvante (pós-menopausa) | — | — |
| Câncer de mama | RH+/HER2− localizado – adjuvância | adjuvante | Supressão ovariana + inibidor de aromatase (ou + tamoxifeno) – alto risco pré-menopausa | — | SOFT/TEXT |
| Câncer de mama | Câncer de mama em homens | adjuvante | Supressão ovariana + inibidor de aromatase (ou + tamoxifeno) – alto risco pré-menopausa | — | SOFT/TEXT |
| Câncer de mama | RH+/HER2− localizado – adjuvância | adjuvante | Abemaciclibe adjuvante ×2 anos + TE | Ki-67 ≥20% / G3 (critérios monarchE) | monarchE |
| Câncer de mama | RH+/HER2− localizado – adjuvância | adjuvante | Ribociclibe adjuvante ×3 anos + IA | Ki-67/grau/risco genômico (critérios NATALEE) | NATALEE |
| Câncer de mama | RH+/HER2− localizado – adjuvância | adjuvante | Giredestranto adjuvante | — | lidERA |
| Câncer de mama | RH+/HER2− localizado – adjuvância | adjuvante | Olaparibe adjuvante ×1 ano (gBRCA1/2) | gBRCA1/2 | OlympiA |
| Câncer de mama | Triplo-negativo – doença residual pós-neoadjuvância | adjuvante | Olaparibe adjuvante ×1 ano (gBRCA1/2) | gBRCA1/2 mutado | OlympiA |
| Câncer de mama | RH+/HER2− localizado – adjuvância | adjuvante | Ácido zoledrônico adjuvante | — | — |
| Câncer de mama | RH+/HER2− localizado – adjuvância | adjuvante | Interrupção temporária da TE adjuvante para gestação | — | POSITIVE |
| Câncer de mama | RH+/HER2− – terapia endócrina neoadjuvante | neoadjuvante | Inibidor de aromatase neoadjuvante | — | — |
| Câncer de mama | RH+/HER2− metastático – 1ª linha | 1ª linha | Letrozol + palbociclibe | — | PALOMA-2 |
| Câncer de mama | RH+/HER2− metastático – 1ª linha | 1ª linha | Letrozol (ou tamoxifeno ± LHRHa) + ribociclibe | — | MONALEESA-2; MONALEESA-7 |
| Câncer de mama | RH+/HER2− metastático – 1ª linha | 1ª linha | Letrozol + abemaciclibe | — | MONARCH-3 |
| Câncer de mama | RH+/HER2− metastático – 2ª linha (terapia endócrina ± alvo) | 2ª linha | Fulvestranto + palbociclibe | — | PALOMA-3 |
| Câncer de mama | RH+/HER2− metastático – 2ª linha (terapia endócrina ± alvo) | 2ª linha | Fulvestranto + abemaciclibe | — | MONARCH-2; postMONARCH |
| Câncer de mama | RH+/HER2− metastático – 1ª linha | 1ª/2ª linha | Fulvestranto + ribociclibe | — | MONALEESA-3 |
| Câncer de mama | RH+/HER2− metastático – 2ª linha (terapia endócrina ± alvo) | 1ª/2ª linha | Fulvestranto + ribociclibe | — | MONALEESA-3 |
| Câncer de mama | RH+/HER2− metastático – 1ª linha | 1ª linha | Fulvestranto + palbociclibe + inavolisibe | PIK3CA mutado | INAVO120 |
| Câncer de mama | RH+/HER2− metastático – 1ª linha | 1ª linha | Poliquimioterapia (crise visceral) | — | — |
| Câncer de mama | RH+/HER2− metastático – 2ª linha (terapia endócrina ± alvo) | 2ª linha | Fulvestranto + alpelisibe | PIK3CA mutado | SOLAR-1 |
| Câncer de mama | RH+/HER2− metastático – 2ª linha (terapia endócrina ± alvo) | 2ª linha | Fulvestranto + capivasertibe | PIK3CA, AKT1 ou PTEN alterado | CAPItello-291 |
| Câncer de mama | RH+/HER2− metastático – 2ª linha (terapia endócrina ± alvo) | 2ª linha | Exemestano + everolimo | — | BOLERO-2 |
| Câncer de mama | RH+/HER2− metastático – 2ª linha (terapia endócrina ± alvo) | 2ª linha | Elacestranto | ESR1 mutado | — |
| Câncer de mama | RH+/HER2− metastático – 2ª linha (terapia endócrina ± alvo) | 2ª linha | Imlunestranto ± abemaciclibe | — | EMBER-3 |
| Câncer de mama | RH+/HER2− metastático – 2ª linha (terapia endócrina ± alvo) | 2ª linha+ | Olaparibe (gBRCA1/2, metastático) | gBRCA1/2 mutado | OlympiAD |
| Câncer de mama | RH+/HER2− metastático – endócrino-resistente: QT/ADC | 2ª linha+ | Olaparibe (gBRCA1/2, metastático) | gBRCA1/2 mutado | OlympiAD |
| Câncer de mama | Triplo-negativo metastático – 1ª linha | 2ª linha+ | Olaparibe (gBRCA1/2, metastático) | gBRCAm e PD-L1 negativo | OlympiAD |
| Câncer de mama | Triplo-negativo metastático – 2ª linha em diante | 2ª linha+ | Olaparibe (gBRCA1/2, metastático) | gBRCA1/2 mutado | OlympiAD |
| Câncer de mama | RH+/HER2− metastático – 2ª linha (terapia endócrina ± alvo) | 2ª linha+ | Talazoparibe (gBRCA1/2, metastático) | gBRCA1/2 mutado | EMBRACA |
| Câncer de mama | RH+/HER2− metastático – endócrino-resistente: QT/ADC | 2ª linha+ | Talazoparibe (gBRCA1/2, metastático) | gBRCA1/2 mutado | EMBRACA |
| Câncer de mama | Triplo-negativo metastático – 1ª linha | 2ª linha+ | Talazoparibe (gBRCA1/2, metastático) | gBRCAm e PD-L1 negativo | EMBRACA |
| Câncer de mama | Triplo-negativo metastático – 2ª linha em diante | 2ª linha+ | Talazoparibe (gBRCA1/2, metastático) | gBRCA1/2 mutado | EMBRACA |
| Câncer de mama | RH+/HER2− metastático – endócrino-resistente: QT/ADC | 2ª linha+ | Trastuzumabe deruxtecana (HER2-low/ultralow) | HER2-low/ultralow | DESTINY-Breast04; DESTINY-Breast06 |
| Câncer de mama | Triplo-negativo metastático – 2ª linha em diante | 2ª linha+ | Trastuzumabe deruxtecana (HER2-low/ultralow) | HER2 1+ ou 2+/ISH− | DESTINY-Breast04; DESTINY-Breast06 |
| Câncer de mama | RH+/HER2− metastático – endócrino-resistente: QT/ADC | 3ª linha+ (2L+ QT) | Sacituzumabe govitecana (RH+/HER2−) | — | TROPiCS-02 |
| Câncer de mama | RH+/HER2− metastático – endócrino-resistente: QT/ADC | 2ª linha+ | Datopotamabe deruxtecana (RH+/HER2−) | — | TROPION-Breast01 |
| Câncer de mama | RH+/HER2− metastático – endócrino-resistente: QT/ADC | linhas subsequentes | Pembrolizumabe (TMB-h) | TMB-h | — |
| Câncer de mama | Câncer de mama em homens | adjuvante | IA + análogo de GnRH (homem) | — | — |
| Câncer de mama | RH+/HER2− metastático – endócrino-resistente: QT/ADC | 1ª linha+ | Paclitaxel semanal | — | Mauri et al. 2010 (taxano semanal vs q3w) |
| Câncer de mama | Triplo-negativo metastático – 1ª linha | 1ª linha+ | Paclitaxel semanal | PD-L1 negativo e gBRCA wt | Mauri et al. 2010 (taxano semanal vs q3w) |
| Câncer de mama | Triplo-negativo metastático – 2ª linha em diante | 1ª linha+ | Paclitaxel semanal | — | Mauri et al. 2010 (taxano semanal vs q3w) |
| Câncer de mama | RH+/HER2− metastático – endócrino-resistente: QT/ADC | 1ª linha+ | Docetaxel q3w | — | TAX 311 |
| Câncer de mama | Triplo-negativo metastático – 2ª linha em diante | 1ª linha+ | Docetaxel q3w | — | TAX 311 |
| Câncer de mama | RH+/HER2− metastático – endócrino-resistente: QT/ADC | 1ª linha+ | Doxorrubicina lipossomal (ou doxorrubicina) | — | CAELYX Breast Cancer Study (O'Brien 2004) |
| Câncer de mama | Triplo-negativo metastático – 1ª linha | 1ª linha+ | Doxorrubicina lipossomal (ou doxorrubicina) | PD-L1 negativo e gBRCA wt | CAELYX Breast Cancer Study (O'Brien 2004) |
| Câncer de mama | Triplo-negativo metastático – 2ª linha em diante | 1ª linha+ | Doxorrubicina lipossomal (ou doxorrubicina) | — | CAELYX Breast Cancer Study (O'Brien 2004) |
| Câncer de mama | RH+/HER2− metastático – endócrino-resistente: QT/ADC | 1ª linha+ | Capecitabina | — | Capecitabina fase II (Fumoleau 2004); Capecitabina vs CMF fase II (O'Shaughnessy 2001) |
| Câncer de mama | Triplo-negativo metastático – 2ª linha em diante | 1ª linha+ | Capecitabina | — | Capecitabina fase II (Fumoleau 2004); Capecitabina vs CMF fase II (O'Shaughnessy 2001) |
| Câncer de mama | RH+/HER2− metastático – endócrino-resistente: QT/ADC | 3ª linha+ | Eribulina | — | EMBRACE |
| Câncer de mama | Triplo-negativo metastático – 2ª linha em diante | 3ª linha+ | Eribulina | — | EMBRACE |
| Câncer de mama | Triplo-negativo metastático – 1ª linha | 1ª linha | Paclitaxel + bevacizumabe | PD-L1 negativo (opção) | E2100 (Miller 2007) |
| Câncer de mama | RH+/HER2− metastático – endócrino-resistente: QT/ADC | 1ª linha (PD rápida/crise visceral) | PoliQT combinada (ex.: AC, EC, CMF, docetaxel + capecitabina, gencitabina + paclitaxel/carboplatina/cisplatina) | — | Dear et al. Cochrane 2013 (poliQT vs QT sequencial) |
| Câncer de mama | Triplo-negativo metastático – 1ª linha | 1ª linha (PD rápida/crise visceral) | PoliQT combinada (ex.: AC, EC, CMF, docetaxel + capecitabina, gencitabina + paclitaxel/carboplatina/cisplatina) | — | Dear et al. Cochrane 2013 (poliQT vs QT sequencial) |
| Câncer de mama | HER2+ localizado – adjuvância (cirurgia upfront ou após pCR) | adjuvante / neoadjuvante | AC → paclitaxel + trastuzumabe (AC-TH) | — | NSABP B-31 / NCCTG N9831 (análise conjunta); NCCTG N9831 (sequencial vs concomitante); BCIRG-006 |
| Câncer de mama | HER2+ localizado – neoadjuvância | adjuvante / neoadjuvante | AC → paclitaxel + trastuzumabe (AC-TH) | — | NSABP B-31 / NCCTG N9831 (análise conjunta); NCCTG N9831 (sequencial vs concomitante); BCIRG-006 |
| Câncer de mama | HER2+ localizado – adjuvância (cirurgia upfront ou após pCR) | adjuvante | TCH (docetaxel + carboplatina + trastuzumabe) | — | BCIRG-006 |
| Câncer de mama | HER2+ localizado – adjuvância (cirurgia upfront ou após pCR) | adjuvante | Trastuzumabe por 12 meses (duração padrão) | — | HERA; PHARE; PERSEPHONE |
| Câncer de mama | HER2+ localizado – neoadjuvância | adjuvante | Trastuzumabe por 12 meses (duração padrão) | — | HERA; PHARE; PERSEPHONE |
| Câncer de mama | HER2+ localizado – adjuvância (cirurgia upfront ou após pCR) | adjuvante | Paclitaxel semanal + trastuzumabe ×12 sem → trastuzumabe até 1 ano (TH) | — | APT |
| Câncer de mama | HER2+ localizado – neoadjuvância | adjuvante | Paclitaxel semanal + trastuzumabe ×12 sem → trastuzumabe até 1 ano (TH) | opção para frágeis/baixo risco | APT |
| Câncer de mama | HER2+ localizado – adjuvância (cirurgia upfront ou após pCR) | adjuvante | QT + trastuzumabe + pertuzumabe adjuvante | N+ | APHINITY |
| Câncer de mama | HER2+ localizado – adjuvância (cirurgia upfront ou após pCR) | adjuvante estendida | Neratinibe adjuvante estendido ×1 ano | RH+ | ExteNET |
| Câncer de mama | HER2+ – doença residual invasiva pós-neoadjuvância | adjuvante estendida | Neratinibe adjuvante estendido ×1 ano | RH+ | ExteNET |
| Câncer de mama | HER2+ localizado – neoadjuvância | neoadjuvante | QT neoadjuvante (doxorrubicina + paclitaxel → paclitaxel → CMF) + trastuzumabe | — | NOAH |
| Câncer de mama | HER2+ localizado – neoadjuvância | neoadjuvante | TCHP (docetaxel + carboplatina + trastuzumabe + pertuzumabe) | — | TRYPHAENA; TRAIN-2; KRISTINE |
| Câncer de mama | HER2+ localizado – neoadjuvância | neoadjuvante | THP (taxano + trastuzumabe + pertuzumabe) neoadjuvante | — | NeoSphere |
| Câncer de mama | HER2+ localizado – neoadjuvância | neoadjuvante | T-DXd ×4 → THP ×4 neoadjuvante | — | DESTINY-Breast11 |
| Câncer de mama | HER2+ localizado – neoadjuvância | neoadjuvante | ddAC ×4 → THP ×4 | — | — |
| Câncer de mama | HER2+ localizado – adjuvância (cirurgia upfront ou após pCR) | adjuvante pós-neo | Completar 1 ano de anti-HER2 após pCR (cN0: trastuzumabe; cN+: trastuzumabe + pertuzumabe) | — | — |
| Câncer de mama | HER2+ – doença residual invasiva pós-neoadjuvância | adjuvante pós-neo | T-DM1 adjuvante ×14 ciclos (doença residual) | — | KATHERINE |
| Câncer de mama | HER2+ – doença residual invasiva pós-neoadjuvância | adjuvante pós-neo | T-DXd adjuvante ×14 ciclos (doença residual de alto risco) | — | DESTINY-Breast05 |
| Câncer de mama | HER2+ metastático – 1ª linha | 1ª linha | QT + trastuzumabe (1ª linha metastática) | — | Slamon 2001 (H0648g) |
| Câncer de mama | HER2+ metastático – 1ª linha | 1ª linha | THP (taxano + trastuzumabe + pertuzumabe) | — | CLEOPATRA |
| Câncer de mama | HER2+ metastático – 1ª linha | 1ª linha | Trastuzumabe + hormonioterapia (RH+/HER2+) | RH+ | SYSUCC-002 |
| Câncer de mama | HER2+ metastático – 1ª linha | 1ª linha (manutenção) | Palbociclibe + anti-HER2 + TE (manutenção pós-indução) | RH+ | PATINA (AFT-38) |
| Câncer de mama | HER2+ metastático – 1ª linha | 1ª linha (manutenção) | Tucatinibe + trastuzumabe + pertuzumabe (manutenção) | — | HER2CLIMB-05 |
| Câncer de mama | HER2+ metastático – 1ª linha | 1ª linha | T-DXd + pertuzumabe (1ª linha) | — | DESTINY-Breast09 |
| Câncer de mama | HER2+ metastático – 2ª linha | 2ª linha | Trastuzumabe deruxtecana (2ª linha HER2+) | — | DESTINY-Breast03; DESTINY-Breast02; DESTINY-Breast01 |
| Câncer de mama | HER2+ metastático – 3ª linha em diante | 2ª linha | Trastuzumabe deruxtecana (2ª linha HER2+) | se não utilizado previamente | DESTINY-Breast03; DESTINY-Breast02; DESTINY-Breast01 |
| Câncer de mama | HER2+ metastático – 2ª linha | 2ª linha / subsequentes | T-DM1 (metastático) | — | EMILIA; TH3RESA |
| Câncer de mama | HER2+ metastático – 3ª linha em diante | 2ª linha / subsequentes | T-DM1 (metastático) | — | EMILIA; TH3RESA |
| Câncer de mama | HER2+ metastático – 3ª linha em diante | subsequentes | Lapatinibe + capecitabina | — | Lapatinibe + capecitabina (Geyer 2006, EGF100151) |
| Câncer de mama | HER2+ metastático – 3ª linha em diante | 3ª linha+ | Tucatinibe + trastuzumabe + capecitabina | — | HER2CLIMB |
| Câncer de mama | HER2+ metastático – 3ª linha em diante | 3ª linha+ | Neratinibe + capecitabina | — | NALA |
| Câncer de mama | HER2+ metastático – 3ª linha em diante | subsequentes | Trastuzumabe + capecitabina / trastuzumabe + lapatinibe / trastuzumabe + outras QT | — | — |
| Câncer de mama | Triplo-negativo localizado – neoadjuvância | neoadjuvante → adjuvante | Carboplatina + paclitaxel + pembrolizumabe → AC/EC + pembrolizumabe → pembrolizumabe adjuvante | — | KEYNOTE-522 |
| Câncer de mama | Triplo-negativo – doença residual pós-neoadjuvância | neoadjuvante → adjuvante | Carboplatina + paclitaxel + pembrolizumabe → AC/EC + pembrolizumabe → pembrolizumabe adjuvante | pembrolizumabe adjuvante se usado na neoadjuvância | KEYNOTE-522 |
| Câncer de mama | Triplo-negativo localizado – neoadjuvância | neoadjuvante | QT neoadjuvante com platina (AC → T + carboplatina; carboplatina + paclitaxel) | — | Poggio et al. 2018 (platina neoadjuvante em TNBC) |
| Câncer de mama | Triplo-negativo – doença residual pós-neoadjuvância | adjuvante pós-neo | Capecitabina adjuvante ×6-8 ciclos (doença residual) | gBRCA wt | CREATE-X |
| Câncer de mama | Recidiva locorregional isolada ressecada | adjuvante | QT adjuvante após ressecção de recidiva locorregional | RE negativo | CALOR |
| Câncer de mama | Triplo-negativo metastático – 1ª linha | 1ª linha | Pembrolizumabe + QT (paclitaxel, nab-paclitaxel ou gencitabina + carboplatina) | PD-L1 CPS ≥10 (22C3) | KEYNOTE-355 |
| Câncer de mama | Triplo-negativo metastático – 1ª linha | 1ª linha | Atezolizumabe + nab-paclitaxel | CPS <10 e PD-L1 SP142 ≥1% | IMpassion130 |
| Câncer de mama | Triplo-negativo metastático – 1ª linha | 1ª linha | Sacituzumabe govitecana + pembrolizumabe (1ª linha) | PD-L1 CPS ≥10 | ASCENT-04/KEYNOTE-D19 |
| Câncer de mama | Triplo-negativo metastático – 1ª linha | 1ª linha | Sacituzumabe govitecana (1ª linha, não candidata a IO) | PD-L1 negativo (CPS <10) / não candidata a IO | ASCENT-03 |
| Câncer de mama | Triplo-negativo metastático – 1ª linha | 1ª linha | Datopotamabe deruxtecana (1ª linha, IO não opção) | PD-L1 negativo / IO não opção | TROPION-Breast02 |
| Câncer de mama | Triplo-negativo metastático – 1ª linha | 1ª linha | QT escolha do investigador (paclitaxel, nab-paclitaxel, capecitabina, eribulina, carboplatina, gencitabina) | CPS <10 e gBRCA wt | — |
| Câncer de mama | Triplo-negativo metastático – 1ª linha | 1ª linha | Carboplatina monodroga (gBRCAm) | gBRCA mutado | TNT trial |
| Câncer de mama | Triplo-negativo metastático – 2ª linha em diante | 2ª linha+ | Sacituzumabe govitecana (2ª/3ª linha) | — | ASCENT |
| Câncer de mama | Câncer de mama na gestação | (neo)adjuvante | QT na gestação a partir do 2º trimestre (AC, taxanos, platinas) | — | — |

## Divergências marcadas (valor da aula mantido; ver `trial.obs`)

- EMBER-3: aula imlunestranto + abemaciclibe vs imlunestranto PFS 9,4 vs 5,5 m (HR 0,57); NOVIDADES-2026 (atualização Ann Oncol 2026) traz 10,9 × 5,5 m (HR 0,59)
- PATINA: aula PFS 44,3 vs 29,1 m com HR 0,74 (0,58–0,94); NOVIDADES-2026 (NEJM 2026) traz HR 0,75

## Notas de extração

- Páginas = índice da página no PDF. Aulas 37 e 38 (HER2+) e partes das 34, 35 e 40 são slides-imagem: resultados lidos visualmente (render 90 dpi) – 67 páginas.
- Discrepância interna: OlympiAD e EMBRACA têm SG diferente entre aula 36 (p9) e aula 40 (p34/p36); ambos registrados em `resultado`/`obs`.
- Tabela de desfechos de referência (desfechos-gineco.csv) não cobre mama; comparação feita com NOVIDADES-2026.md/novidades.csv.
- Estudos citados apenas como desenho (PALLAS, PENELOPE-B, TAILORx, RxPONDER, SOUND, INSEMA, ACOSOG Z0011, SENOMAC) sem resultado na aula → campo `resultado` omitido.
- Definições ABC de resistência endócrina (aula 35 p4-8) com texto ilegível na extração; não registradas.
- Regimes sem fármaco (drogas = []) representam procedimentos/RT/decisões citados como conduta.
