# Módulo 03 – Tumores Ginecológicos · grafo de conhecimento (aulas 22–32)

Fonte: slides PRO 2026 - Módulo 3 - Tumores Ginecológicos (11 PDFs). Extração por `pdftotext -layout` + leitura visual das páginas-imagem (tabelas/curvas). Todos os nós com `status = NAO_VERIFICADO` (resumo de aula, não evidência primária).

## Contagens

| tipo de nó | n |
|---|---|
| tumor | 10 |
| cenario | 39 |
| diagnostico | 17 |
| estadiamento | 11 |
| biomarcador | 17 |
| regime | 95 |
| farmaco | 47 |
| trial | 58 |
| fonte | 11 |
| **total** | **305** |

| relação | n |
|---|---|
| TEM_CENARIO | 39 |
| DIAGNOSTICA_POR | 17 |
| ESTADIA_POR | 11 |
| EXIGE_BIOMARCADOR | 35 |
| TRATA_COM | 109 |
| USA_FARMACO | 197 |
| SUSTENTADO_POR | 57 |
| TESTOU | 83 |
| FONTE | 313 |
| **total** | **861** |

## Tumor × cenário × regime × trial

| tumor | cenário | linha | regime | condição biomarcador | trial(s) |
|---|---|---|---|---|---|
| Câncer epitelial de ovário (tuba/peritônio) | Doença precoce (estádios I-II) – adjuvância | adjuvante | Carboplatina + paclitaxel adjuvante | — | GOG 157 |
| Câncer epitelial de ovário (tuba/peritônio) | Doença avançada (III-IV) – tratamento de 1ª linha | 1ª linha (cirurgia) | Citorredução cirúrgica primária | — | LION; Meta-análise AGO (du Bois, Cancer 2009) |
| Câncer epitelial de ovário (tuba/peritônio) | Doença avançada (III-IV) – tratamento de 1ª linha | 1ª linha | Carboplatina + paclitaxel IV (1ª linha) | — | — |
| Câncer epitelial de ovário (tuba/peritônio) | Doença avançada (III-IV) – tratamento de 1ª linha | 1ª linha | Carboplatina + paclitaxel + bevacizumabe (1ª linha, alto risco) | — | GOG 218; ICON7 |
| Câncer epitelial de ovário (tuba/peritônio) | Doença avançada (III-IV) – tratamento de 1ª linha | 1ª linha (neoadjuvante) | QT neoadjuvante (platina + taxano ± bevacizumabe) → citorredução de intervalo | — | — |
| Câncer epitelial de ovário (tuba/peritônio) | Doença avançada (III-IV) – tratamento de 1ª linha | 1ª linha (intraoperatório) | HIPEC com cisplatina na citorredução de intervalo ótima | — | OVHIPEC-1 |
| Câncer epitelial de ovário (tuba/peritônio) | Manutenção após 1ª linha (III-IV) | manutenção 1ª linha | Olaparibe de manutenção (1ª linha) | BRCA1/2 mutado | SOLO-1 |
| Câncer epitelial de ovário (tuba/peritônio) | Manutenção após 1ª linha (III-IV) | manutenção 1ª linha | Bevacizumabe + olaparibe de manutenção (1ª linha) | HRD (BRCAwt) ou BRCA1/2 mutado | PAOLA-1 |
| Câncer epitelial de ovário (tuba/peritônio) | Manutenção após 1ª linha (III-IV) | manutenção 1ª linha | Niraparibe de manutenção (1ª linha) | opção nas colunas BRCAmut/HRD/HRP do slide | PRIMA |
| Câncer epitelial de ovário (tuba/peritônio) | Recidiva platinossensível (intervalo livre de platina ≥ 6 meses) | recidiva (cirurgia) | Citorredução secundária (recidiva platinossensível) | — | DESKTOP III |
| Câncer epitelial de ovário (tuba/peritônio) | Recidiva platinossensível (intervalo livre de platina ≥ 6 meses) | recidiva platinossensível | Dupla com carboplatina (+ PLD, paclitaxel ou gencitabina) | — | — |
| Câncer epitelial de ovário (tuba/peritônio) | Recidiva platinossensível (intervalo livre de platina ≥ 6 meses) | recidiva platinossensível | Dupla de platina + bevacizumabe (1ª recorrência) | — | OCEANS; GOG-0213; AGO-OVAR 2.21 |
| Câncer epitelial de ovário (tuba/peritônio) | Recidiva platinossensível (intervalo livre de platina ≥ 6 meses) | manutenção na recidiva | iPARP de manutenção após resposta à platina (olaparibe, niraparibe; EUA: rucaparibe) | g/sBRCA1/2 mutado | SOLO-2; NOVA; ARIEL3 |
| Câncer epitelial de ovário (tuba/peritônio) | Recidiva platinorresistente (intervalo livre de platina < 6 meses) | recidiva platinorresistente | Paclitaxel semanal ± pembrolizumabe ± bevacizumabe | pembrolizumabe se PD-L1 positivo | — |
| Câncer epitelial de ovário (tuba/peritônio) | Recidiva platinorresistente (intervalo livre de platina < 6 meses) | recidiva platinorresistente | QT monodroga + bevacizumabe | — | AURELIA |
| Câncer epitelial de ovário (tuba/peritônio) | Recidiva platinorresistente (intervalo livre de platina < 6 meses) | recidiva platinorresistente | QT monodroga convencional (PLD, gencitabina, topotecano, vinorelbina, ciclofosfamida oral) | — | — |
| Câncer epitelial de ovário (tuba/peritônio) | Recidiva platinorresistente (intervalo livre de platina < 6 meses) | recidiva platinorresistente | Trastuzumabe deruxtecana (HER2 3+) | HER2 3+ | DESTINY-PanTumor02 |
| Câncer epitelial de ovário (tuba/peritônio) | Recidiva platinorresistente (intervalo livre de platina < 6 meses) | recidiva platinorresistente | Pembrolizumabe (dMMR) | dMMR | — |
| Câncer epitelial de ovário (tuba/peritônio) | Recidiva platinorresistente (intervalo livre de platina < 6 meses) | recidiva platinorresistente | Mirvetuximabe soravtansina | FOLR1 2+/3+ em ≥75% | — |
| Câncer epitelial de ovário (tuba/peritônio) | Seroso de baixo grau (LGSOC) | adjuvante | QT adjuvante no LGSOC (estádio IC em diante) | — | — |
| Câncer epitelial de ovário (tuba/peritônio) | Seroso de baixo grau (LGSOC) | manutenção | Terapia endócrina de manutenção (LGSOC RE+) | RE+ | — |
| Câncer epitelial de ovário (tuba/peritônio) | Seroso de baixo grau (LGSOC) | recidiva | Trametinibe (iMEK) | KRAS/BRAF/NRAS mutado (maior ORR) | GOG 281/LOGS |
| Câncer epitelial de ovário (tuba/peritônio) | Seroso de baixo grau (LGSOC) | recidiva | Avutometinibe + defactinibe | KRAS mutado | ENGOT-OV60/GOG-3052/RAMP 201 |
| Câncer epitelial de ovário (tuba/peritônio) | Carcinoma mucinoso avançado/recidivado | 1ª linha/recidiva | FOLFOX ou CAPOX (mucinoso) | — | GOG 0241 |
| Câncer epitelial de ovário (tuba/peritônio) | Carcinoma mucinoso avançado/recidivado | 1ª linha/recidiva | Carboplatina + paclitaxel (mucinoso) | — | — |
| Câncer epitelial de ovário (tuba/peritônio) | Carcinoma de células claras recidivado | recidiva | Ipilimumabe + nivolumabe (células claras) | — | — |
| Câncer epitelial de ovário (tuba/peritônio) | Carcinoma de células claras recidivado | recidiva | Pembrolizumabe (células claras) | — | — |
| Tumores do estroma ovariano-cordão sexual | Granulosa – tratamento inicial/adjuvante | adjuvante/recidiva | Carboplatina + paclitaxel ×6 | — | GOG-264 |
| Tumores do estroma ovariano-cordão sexual | Granulosa – recidiva (≈10%, mediana 4-6 anos) | adjuvante/recidiva | Carboplatina + paclitaxel ×6 | — | GOG-264 |
| Tumores do estroma ovariano-cordão sexual | Granulosa – tratamento inicial/adjuvante | adjuvante/recidiva | BEP ×3 (EP se >40 anos) | — | — |
| Tumores do estroma ovariano-cordão sexual | Granulosa – recidiva (≈10%, mediana 4-6 anos) | adjuvante/recidiva | BEP ×3 (EP se >40 anos) | — | — |
| Tumores do estroma ovariano-cordão sexual | Granulosa – recidiva (≈10%, mediana 4-6 anos) | recidiva | Paclitaxel semanal, inibidores de aromatase, bevacizumabe, análogos de GnRH | — | — |
| Tumores germinativos do ovário | Doença localizada operada – adjuvância | adjuvante / resgate sem QT prévia | BEP ×3-4 | — | — |
| Tumores germinativos do ovário | Doença residual / recidiva | adjuvante / resgate sem QT prévia | BEP ×3-4 | — | — |
| Tumores germinativos do ovário | Doença residual / recidiva | resgate | TIP (paclitaxel + ifosfamida + cisplatina) | — | — |
| Tumores germinativos do ovário | Doença residual / recidiva | resgate | VeIP | — | — |
| Tumores germinativos do ovário | Doença residual / recidiva | resgate | VAC | — | — |
| Tumores germinativos do ovário | Doença residual / recidiva | resgate | QT em altas doses + resgate de células-tronco | — | — |
| Câncer de colo uterino | Doença precoce (IA a IIA) – cirurgia ± adjuvância | cirurgia primária | Histerectomia radical (laparotomia) + avaliação linfonodal | — | LACC; PHENIX; SHAPE |
| Câncer de colo uterino | Doença precoce (IA a IIA) – cirurgia ± adjuvância | adjuvante | RT pélvica adjuvante (critérios de Sedlis) | — | GOG 92 |
| Câncer de colo uterino | Doença precoce (IA a IIA) – cirurgia ± adjuvância | adjuvante | QRT adjuvante com cisplatina (critérios de Peters) | — | GOG 109 |
| Câncer de colo uterino | Doença localmente avançada (IB3 a IVA) | definitivo | Quimiorradioterapia com cisplatina semanal + braquiterapia | — | EMBRACE-I |
| Câncer de colo uterino | Doença localmente avançada (IB3 a IVA) | definitivo | QT de indução (carboplatina + paclitaxel semanal) → QRT | — | INTERLACE |
| Câncer de colo uterino | Doença localmente avançada (IB3 a IVA) | definitivo | QRT + pembrolizumabe concomitante e de manutenção | — | — |
| Câncer de colo uterino | Doença localmente avançada (IB3 a IVA) | consolidação | QT de consolidação pós-QRT | — | — |
| Câncer de colo uterino | Recidiva local ou oligometastática | recidiva | Cirurgia da recidiva central / exenteração pélvica | — | — |
| Câncer de colo uterino | Doença metastática/recorrente – 1ª linha | 1ª linha | Platina + paclitaxel ± bevacizumabe + pembrolizumabe (CPS ≥1) | pembrolizumabe se PD-L1 CPS ≥1 | GOG 240; KEYNOTE-826 |
| Câncer de colo uterino | Doença metastática/recorrente – 1ª linha | 1ª linha | Carboplatina + paclitaxel (alternativa) | — | — |
| Câncer de colo uterino | Doença metastática/recorrente – 1ª linha | 1ª linha | Atezolizumabe + bevacizumabe + platina/paclitaxel | — | BEATcc |
| Câncer de colo uterino | Doença metastática/recorrente – 1ª linha | 1ª linha | Cisplatina + gencitabina, vinorelbina ou topotecano | — | — |
| Câncer de colo uterino | Linhas subsequentes | 2ª linha+ | Cemiplimabe (sem imunoterapia prévia) | — | EMPOWER-Cervical 1 |
| Câncer de colo uterino | Linhas subsequentes | 2ª linha+ | Trastuzumabe deruxtecana (HER2 3+) | HER2 3+ (IHQ padrão gástrico) | DESTINY-PanTumor02 |
| Câncer de colo uterino | Linhas subsequentes | 2ª linha+ | Tisotumabe vedotina | — | innovaTV 301 |
| Câncer de colo uterino | Linhas subsequentes | 2ª linha+ | QT convencional monodroga | — | — |
| Câncer de colo uterino | Linhas subsequentes | 2ª linha+ | Pembrolizumabe (PD-L1 positivo) | PD-L1 positivo | — |
| Câncer de colo uterino | Câncer de colo na gestação | neoadjuvante | QT neoadjuvante na gestação (carboplatina + paclitaxel ou docetaxel) | — | — |
| Câncer de endométrio | Doença localizada operada – adjuvância por grupo de risco | adjuvante | Braquiterapia vaginal adjuvante | — | PORTEC-2 |
| Câncer de endométrio | Doença localizada operada – adjuvância por grupo de risco | adjuvante | EBRT pélvica adjuvante ± braquiterapia vaginal | — | GOG-99; PORTEC-1 |
| Câncer de endométrio | Doença localizada operada – adjuvância por grupo de risco | adjuvante | QRT (EBRT + cisplatina) → carboplatina + paclitaxel ×4 | — | PORTEC-3 |
| Câncer de endométrio | Doença localizada operada – adjuvância por grupo de risco | adjuvante | Carboplatina + paclitaxel ×6 adjuvante (QT isolada) | — | GOG-258 |
| Câncer de endométrio | Doença localizada operada – adjuvância por grupo de risco | adjuvante | Braquiterapia vaginal → carboplatina + paclitaxel ×3 | — | — |
| Câncer de endométrio | Doença localizada operada – adjuvância por grupo de risco | adjuvante | Carboplatina + paclitaxel + pembrolizumabe adjuvante (III-IV dMMR) | dMMR | KEYNOTE-B21 |
| Câncer de endométrio | Preservação de fertilidade | preservação de fertilidade | Ressecção histeroscópica + progestágenos (DIU ± orais) | — | — |
| Câncer de endométrio | Recidiva locorregional | recidiva | RT de resgate (EBRT ± braquiterapia) / cirurgia na recidiva locorregional | — | — |
| Câncer de endométrio | Doença avançada/metastática – 1ª linha | 1ª linha | Carboplatina + paclitaxel | — | GOG-209 |
| Câncer de endométrio | Doença avançada/metastática – 1ª linha | 1ª linha | Carboplatina + paclitaxel + pembrolizumabe (até 2 anos) | pMMR ou dMMR (maior benefício dMMR) | NRG-GY018 |
| Câncer de endométrio | Doença avançada/metastática – 1ª linha | 1ª linha | Carboplatina + paclitaxel + dostarlimabe (até 3 anos) | pMMR ou dMMR (maior benefício dMMR) | RUBY parte 1 |
| Câncer de endométrio | Doença avançada/metastática – 1ª linha | 1ª linha | Carboplatina + paclitaxel + durvalumabe (até progressão) | dMMR | DUO-E |
| Câncer de endométrio | Doença avançada/metastática – 1ª linha | 1ª linha | Carboplatina + paclitaxel + durvalumabe → durvalumabe + olaparibe | pMMR | DUO-E |
| Câncer de endométrio | Doença avançada/metastática – 1ª linha | 1ª linha | Carboplatina + paclitaxel + trastuzumabe (seroso HER2+) | seroso HER2+ | Fase 2 trastuzumabe em carcinoma seroso uterino HER2+ (Fader, Clin Cancer Res 2020) |
| Câncer de endométrio | Doença avançada/metastática – 1ª linha | 1ª linha / subsequentes | Terapia endócrina paliativa (medroxiprogesterona, megestrol, tamoxifeno alternando com progestágenos) | RH+ baixo grau | — |
| Câncer de endométrio | Linhas subsequentes | 1ª linha / subsequentes | Terapia endócrina paliativa (medroxiprogesterona, megestrol, tamoxifeno alternando com progestágenos) | RH+ baixo grau | — |
| Câncer de endométrio | Linhas subsequentes | 2ª linha | Pembrolizumabe + lenvatinibe | pMMR | KEYNOTE-775 / Study 309 |
| Câncer de endométrio | Linhas subsequentes | 2ª linha | Pembrolizumabe ou dostarlimabe monodroga (dMMR) | dMMR | — |
| Câncer de endométrio | Linhas subsequentes | 2ª linha+ | Trastuzumabe deruxtecana (HER2 3+ pós-QT/IO) | HER2 3+ | DESTINY-PanTumor02 |
| Câncer de endométrio | Linhas subsequentes | 2ª linha+ | Doxorrubicina ou paclitaxel | — | — |
| Carcinossarcoma uterino | Adjuvância pós-estadiamento cirúrgico | adjuvante / 1ª linha | Carboplatina + paclitaxel | — | GOG-0261 |
| Carcinossarcoma uterino | Doença metastática | adjuvante / 1ª linha | Carboplatina + paclitaxel | — | GOG-0261 |
| Carcinossarcoma uterino | Adjuvância pós-estadiamento cirúrgico | adjuvante | Cisplatina + ifosfamida ×3 | — | GOG-150 |
| Carcinossarcoma uterino | Doença metastática | 1ª linha | Ifosfamida + paclitaxel | — | — |
| Carcinossarcoma uterino | Doença metastática | 1ª linha | Carboplatina + paclitaxel + dostarlimabe | — | RUBY parte 1 |
| Carcinossarcoma uterino | Doença metastática | linhas subsequentes | Trastuzumabe deruxtecana (HER2+) | HER2+ | STATICE |
| Sarcomas uterinos | Leiomiossarcoma – doença localizada / extrauterina confinada ao peritônio | adjuvante | Docetaxel + gencitabina ×4 → doxorrubicina ×4 (adjuvante) | — | SARC 005 |
| Sarcomas uterinos | Sarcoma do estroma endometrial de alto grau | adjuvante | Docetaxel + gencitabina ×4 → doxorrubicina ×4 (adjuvante) | — | SARC 005 |
| Sarcomas uterinos | Leiomiossarcoma – doença metastática | 1ª linha | Doxorrubicina + trabectedina → manutenção com trabectedina | — | LMS04 |
| Sarcomas uterinos | Leiomiossarcoma – doença metastática | 1ª linha | Doxorrubicina | — | — |
| Sarcomas uterinos | Sarcoma do estroma endometrial de alto grau | 1ª linha | Doxorrubicina | — | — |
| Sarcomas uterinos | Leiomiossarcoma – doença metastática | 1ª linha | Gencitabina + docetaxel (com G-CSF profilático) | — | GeDDiS |
| Sarcomas uterinos | Sarcoma do estroma endometrial de alto grau | 1ª linha | Gencitabina + docetaxel (com G-CSF profilático) | — | GeDDiS |
| Sarcomas uterinos | Leiomiossarcoma – doença metastática | linhas subsequentes | Trabectedina | — | — |
| Sarcomas uterinos | Leiomiossarcoma – doença metastática | linhas subsequentes | Pazopanibe | — | PALETTE |
| Sarcomas uterinos | Sarcoma do estroma endometrial de baixo grau | adjuvante (II-IV operado) / metastático | Terapia endócrina (megestrol, medroxiprogesterona) | RE+/RP+ | — |
| Doença trofoblástica gestacional / neoplasia trofoblástica gestacional (NTG) | NTG de baixo risco (escore 0-6) | 1ª linha | Metotrexato (± ácido folínico) a cada 2 semanas | — | — |
| Doença trofoblástica gestacional / neoplasia trofoblástica gestacional (NTG) | NTG de baixo risco (escore 0-6) | 1ª linha / após resistência | Dactinomicina a cada 2 semanas | — | — |
| Doença trofoblástica gestacional / neoplasia trofoblástica gestacional (NTG) | NTG de baixo risco (escore 0-6) | 1ª linha (alto risco) / resistência | EMA/CO | resistência a monodroga | — |
| Doença trofoblástica gestacional / neoplasia trofoblástica gestacional (NTG) | NTG de alto risco (escore 7-12) | 1ª linha (alto risco) / resistência | EMA/CO | — | — |
| Doença trofoblástica gestacional / neoplasia trofoblástica gestacional (NTG) | NTG de ultra-alto risco (escore ≥13) | 1ª linha (alto risco) / resistência | EMA/CO | — | — |
| Doença trofoblástica gestacional / neoplasia trofoblástica gestacional (NTG) | Recorrência de NTG | 1ª linha (alto risco) / resistência | EMA/CO | — | — |
| Doença trofoblástica gestacional / neoplasia trofoblástica gestacional (NTG) | NTG de alto risco (escore 7-12) | 1ª linha / resgate | EMA/EP | — | — |
| Doença trofoblástica gestacional / neoplasia trofoblástica gestacional (NTG) | NTG de ultra-alto risco (escore ≥13) | 1ª linha / resgate | EMA/EP | — | — |
| Doença trofoblástica gestacional / neoplasia trofoblástica gestacional (NTG) | Tumor trofoblástico de sítio placentário / epitelioide | 1ª linha / resgate | EMA/EP | — | — |
| Doença trofoblástica gestacional / neoplasia trofoblástica gestacional (NTG) | Recorrência de NTG | 1ª linha / resgate | EMA/EP | — | — |
| Doença trofoblástica gestacional / neoplasia trofoblástica gestacional (NTG) | NTG de ultra-alto risco (escore ≥13) | indução | EP em dose baixa (indução) | — | — |
| Doença trofoblástica gestacional / neoplasia trofoblástica gestacional (NTG) | Tumor trofoblástico de sítio placentário / epitelioide | cirurgia | Histerectomia + salpingectomia (PSTT/ETT estádio I, intervalo <48 m) | — | — |
| Câncer de vulva | Doença precoce (IA, IB, II) | cirurgia primária | Excisão local radical + abordagem inguinofemoral (BLS ou linfadenectomia) ± RT adjuvante | — | — |
| Câncer de vulva | Doença localmente avançada | definitivo | Quimiorradioterapia com cisplatina semanal (IMRT) | — | — |
| Câncer de vulva | Doença metastática / recidiva | 1ª linha | Platina + paclitaxel ± bevacizumabe ± pembrolizumabe (opções NCCN) | — | — |
| Câncer de vagina | Estádios I-IVA | definitivo | EBRT + braquiterapia com QT concomitante (cisplatina e/ou 5-FU) | — | — |
| Câncer de vagina | Estádio IVB (metastático) | 1ª linha | Platina (cis/carbo) + paclitaxel ± pembrolizumabe | pembrolizumabe se PD-L1+ | — |

## Divergências marcadas (valor da aula mantido; ver `trial.obs`)

- ICON7: aula PFS mediana 19,0 vs 17,3 m; tabela traz média restrita 21,8 vs 20,3 m (HR 0,81) e mediana UNKNOWN
- PAOLA-1: aula PFS 37,2 vs 21,7 m; tabela traz HRD+ 37,2 vs 17,7 m (HR 0,33) e ITT 22,1 vs 16,6 m
- PRIMA: aula PFS 22,1 vs 10,9 m; tabela traz HRd 21,9 vs 10,4 m (HR 0,43) e geral 13,8 vs 8,2 m
- GOG 240: aula ORR 49% vs 36%; tabela traz TRO 48% vs 36% (OS 16,8 vs 13,3 m; HR 0,77 concordante)
- PORTEC-3: aula PFS 5 a 76,5% vs 69,1% (HR 0,70); tabela traz SLF 5 a (2018) 75,5% vs 68,6% e SG 10 a 74,4% vs 67,3% (HR 0,73)
- GOG-249: aula RFS HR 0,92 (IC95% 0,65–1,30) e OS HR 1,04 (IC95% 0,66–1,63); tabela traz IC 90%: RFS 0,69–1,23 e OS 0,71–1,52
- DUO-E: aula atribui OS HR 0,77 (0,56–1,07) ao subgrupo pMMR; tabela atribui esse valor à SG ITT (durva vs controle) e traz pMMR PFS 0,77 (durva) / 0,57 (durva+ola)
- KEYNOTE-775: aula ORR pMMR 30,3% vs 15,1%; tabela traz TRO final pMMR 32,4% vs 15,1% (todas 33,8% vs 14,7%)

## Notas de extração

- Páginas = índice da página no PDF (pdftotext com marcador de quebra de página).
- Páginas sem texto lidas como imagem: 23 p9 (OCEANS/GOG-0213/AGO-OVAR 2.21), 24 p6 (RAMP 201), 24 p16 (marcadores germinativos), 26 p5 (innovaTV 301), 29 p2 (recidiva locorregional), 29 p4 (NRG-GY018/RUBY/DUO-E), 29 p8 (KEYNOTE-775), 30 p12 (LMS04).
- Doses só aparecem em `dose_literal` quando escritas na aula.
- KEYNOTE-A18 não é nomeado na aula 25 (slide cita apenas pembrolizumabe concomitante FIGO 2014 III-IV); regime registrado sem trial.
- Regimes sem fármaco (drogas = []) representam procedimentos/RT citados como conduta.
- Divergências comparadas com desfechos-gineco.csv e NOVIDADES-2026.md (OncoGlobal/docs/referencias/evidencias); valor da aula preservado.
