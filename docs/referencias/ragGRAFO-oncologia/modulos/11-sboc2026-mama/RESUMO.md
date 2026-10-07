# Módulo 11 · SBOC 2026 · Câncer de mama (diretrizes finais)

Fonte: 4 capítulos das *Diretrizes de tratamentos oncológicos SBOC 2026 – Tumores mamários* (Comitê de Tumores Mamários SBOC; colaboração GBECAM; sistema GRADE), lidos integralmente (pdftotext -layout + leitura visual das tabelas de dose e fluxogramas). PDFs não copiados; pasta `C:\Users\silas\OneDrive\EDUCAÇÃO\Material-Didatico\sboc\DIRETRIZES`.

| capítulo (`fonte.aula`) | arquivo | págs | publicação |
|---|---|---|---|
| Mama: doença localizada adjuvância | Diretrizes-SBOC-2026-Mama-doenca-localizada-adjuvancia-v7-VERSaO-FINAL.pdf | 33 | 20/05/2026 |
| Mama: doença localizada neoadjuvância | Diretrizes-SBOC-2026-Mama-neoadjuvante-v8-VERSaO-FINAL.pdf | 23 | 21/05/2026 |
| Mama: doença metastática | Diretrizes-SBOC-2026-Mama-doenca-metastatica-v6-VERSaO-FINAL.pdf | 36 | 21/05/2026 |
| Mama: rastreamento, estadiamento e cuidados adicionais ao diagnóstico | Diretrizes-SBOC-2026-Mama-estadiamento-v7-VERSaO-FINAL.pdf | 31 | 20/05/2026 |

**Ajustes ao ESQUEMA.md aplicados:** `status` de todo nó = `DIRETRIZ_FINAL_SBOC_2026`; resultado do trial (positivo/negativo/NS) em `status_resultado`; `fonte = {"modulo":"SBOC-2026","aula":"<capítulo>","pagina":N}` (página impressa = página do PDF); nós de recomendação (regime, diagnóstico, estadiamento, biomarcador) trazem `nivel_evidencia`/`forca_recomendacao` quando o PDF traz (e `referencia_grade` quando a SBOC cita o GRADE de ESMO/NCCN); a aresta TRATA_COM repete NE/FR. Extras de regime: `dose_literal`, `direcao_recomendacao` ("contra" = recomendação de NÃO usar), `recomendado_sboc` (false = citado na diretriz mas fora das recomendações, em geral sem aprovação Anvisa → sem aresta TRATA_COM).

## Contagens

| tipo | n |
|---|---|
| regime | 115 |
| trial | 104 |
| farmaco | 52 |
| cenario | 23 |
| estadiamento | 18 |
| biomarcador | 15 |
| diagnostico | 14 |
| fonte | 4 |
| tumor | 1 |
| **total nós** | **346** |

| relação | n |
|---|---|
| FONTE | 558 |
| USA_FARMACO | 328 |
| SUSTENTADO_POR | 119 |
| TESTOU | 119 |
| TRATA_COM | 103 |
| EXIGE_BIOMARCADOR | 43 |
| TEM_CENARIO | 23 |
| ESTADIA_POR | 18 |
| DIAGNOSTICA_POR | 14 |
| **total arestas** | **1325** |

Validação (script): JSON válido em todas as linhas; ids únicos e com prefixo do esquema (`tum.mama`, `cen.mama.<subtipo>.<cenario>`, `reg.mama.<subtipo>.<slug>`, `dx.mama.*`, `est.mama.*`, `bio.*`, `far.*`, `tri.*`, `src.sboc2026.*`); todas as arestas com origem/destino existentes e par de tipos coerente com o esquema; todo nó (exceto `src`) com ≥ 1 aresta FONTE; `fonte` com as 3 chaves exigidas e `pagina` dentro do nº de páginas do capítulo; status uniforme; **0 erros**. Nós só com FONTE (sem aresta semântica): tri.mindact, tri.tailorx, tri.rxponder, tri.metanalise-rpc-sabcs2018, tri.pet-ct-estadiamento-ecr (sustentam biomarcador/estadiamento — o esquema não tem relação bio→trial) e far.bevacizumabe (citado, sem recomendação).

## Tabela subtipo × cenário × linha × regime × NE/FR

Somente arestas TRATA_COM (recomendações formais). **contra** = recomendação de não usar. `—` = o PDF não atribui NE/FR. Dose literal completa no campo `dose_literal` do nó.

| subtipo | cenário | linha | regime | condição/biomarcador | NE/FR | dose? | fonte |
|---|---|---|---|---|---|---|---|
| todos | adjuvante-geral | durante tratamento | Exercício aeróbico e de resistência durante tratamento curativo |  | MODERADO/FORTE |  | adj p22 |
| todos | cuidados-diagnostico | durante QT (neo)adjuvante | Análogo de GnRH concomitante à QT (neo)adjuvante para proteção ovariana | pré-menopausa | MODERADO/FORTE (NCCN) |  | est p24 |
| rh | adjuvante | adjuvante | TC (docetaxel + ciclofosfamida) |  | ALTO/FORTE | sim | adj p13 |
| rh | adjuvante | adjuvante | ACdd seguido de paclitaxel semanal (ou Tdd) |  | ALTO/FORTE | sim | adj p13 |
| rh | adjuvante | adjuvante | AC seguido de paclitaxel semanal (ou docetaxel) |  | ALTO/FORTE | sim | adj p13 |
| rh | adjuvante | adjuvante | AC × 4 |  | MODERADO/FRACA | sim | adj p13 |
| rh | adjuvante | adjuvante | CMF clássico |  | MODERADO/FRACA | sim | adj p13 |
| rh | adjuvante | adjuvante | CMF EV |  | MODERADO/FRACA | sim | adj p13 |
| rh | adjuvante | adjuvante | 5-FU associado a AC ou EC – não recomendado |  | ALTO/FORTE **contra** |  | adj p13 |
| rh | adjuvante | adjuvante | Tamoxifeno 5 a 10 anos (pré-menopausa) | pré-menopausa | ALTO/FORTE | sim | adj p14 |
| rh | adjuvante | adjuvante | Supressão ovariana 2-5 anos + TMX ou IA por 5 anos (pré-menopausa) | pré-menopausa (alto risco) | ALTO/FORTE | sim | adj p14 |
| rh | adjuvante | adjuvante | Hormonioterapia na pós-menopausa (TMX, anastrozol, letrozol ou exemestano 5-10 anos; ou IA 2-3 anos → TMX) | pós-menopausa | ALTO/FORTE | sim | adj p14 |
| rh | adjuvante | adjuvante | Abemaciclibe 2 anos + IA ou TMX ± supressão ovariana | alto risco clínico: ≥ 4 LFN, ou 1-3 LFN com T ≥ 5 cm ou G3 ou Ki67 ≥ 20% | ALTO/FORTE | sim | adj p14 |
| rh | adjuvante | adjuvante | Ribociclibe 3 anos + IA ± supressão ovariana | alto risco clínico: N+ (qualquer), ou N0 com T ≥ 2 cm + G3, ou T ≥ 2 cm + Ki67 ≥ 20% / alto risco genômico | ALTO/FORTE | sim | adj p14 |
| rh | adjuvante | adjuvante | Olaparibe 1 ano (gBRCA1/2, RH+ alto risco) | variante patogênica germinativa BRCA1/2 + alto risco: doença residual com CPS-EG ≥ 3 após neoadjuvância, ou ≥ 4 LFN após QT adjuvante | ALTO/FORTE | sim | adj p14 |
| rh | adjuvante | adjuvante | Inibidores de osteólise adjuvantes (ácido zoledrônico ou denosumabe) | pós-menopausa (natural ou induzida) ou pré-menopausa em supressão ovariana | ALTO/FORTE | sim | adj p21 |
| rh | metastatico-1a-linha | 1ª linha | Fulvestranto + palbociclibe + inavolisibe | mutação PIK3CA + recidiva durante ou até 1 ano após término da HT adjuvante | ALTO/FORTE |  | met p8 |
| rh | metastatico-1a-linha | 1ª linha | IA + iCDK4/6 (palbociclibe, ribociclibe ou abemaciclibe) | sem critério para inavolisibe; fluxograma: sem HT prévia/só TMX, ou IA prévio com intervalo > 12 meses | ALTO/FORTE |  | met p8 |
| rh | metastatico-1a-linha | 1ª linha | Fulvestranto + iCDK4/6 – alternativa | alternativa; fluxograma: tratamento prévio com IA | ALTO/FORTE |  | met p8 |
| rh | metastatico-2a-linha | 2ª linha | Capivasertibe + fulvestranto | alteração da via PIK3CA/AKT1/PTEN; progressão após 12 meses com iCDK4/6 | ALTO/FORTE | sim | met p10 |
| rh | metastatico-2a-linha | 2ª linha | Alpelisibe + fulvestranto (se capivasertibe indisponível) | mutação PIK3CA | — |  | met p16 |
| rh | metastatico-2a-linha | 2ª linha | Everolimo + terapia endócrina (fulvestranto ou exemestano) | sem alterações da via PIK3CA/AKT1/PTEN; progressão após 12 meses com iCDK4/6 | ALTO/FORTE |  | met p10 |
| rh | metastatico-2a-linha | 2ª linha | Abemaciclibe ou ribociclibe + fulvestranto após palbociclibe + IA | progressão a palbociclibe + IA; fluxograma: HT + iCDK4/6 se não previamente usado | ALTO/FORTE |  | met p10 |
| rh | metastatico-2a-linha | 2ª linha ou posterior | Olaparibe ou talazoparibe (gBRCA1/2) | mutação germinativa BRCA1 ou BRCA2 | ALTO/FORTE |  | met p10 |
| rh | metastatico-2a-linha | 2ª linha ou posterior | Trastuzumabe deruxtecana (HER2-low ou ultralow) | resistente à HT, com indicação de citotóxico, HER2-low ou ultralow | ALTO/FORTE |  | met p10 |
| rh | metastatico-2a-linha | linhas subsequentes | Sacituzumabe govitecana (sem HER2-low, após ≥ 1 linha de QT) | resistente à HT, progressão a 1+ linhas de QT, sem HER2-low | ALTO/FORTE |  | met p10 |
| rh | metastatico-2a-linha | após T-DXd | QT com agente único ou combinação após T-DXd (HER2-low) | HER2-low com progressão após T-DXd | ALTO/FORTE |  | met p11 |
| rh | metastatico-2a-linha | após T-DXd | Sacituzumabe govitecana após T-DXd (HER2-low) | HER2-low com progressão após T-DXd | MODERADO/FRACA |  | met p11 |
| rh | metastatico-2a-linha | linhas subsequentes | Tamoxifeno, acetato de megestrol ou estradiol em baixa dose (linhas subsequentes) | sensibilidade endócrina persistente ou contraindicação formal à QT | ALTO/FRACA |  | met p16 |
| rh | metastatico-2a-linha | linhas subsequentes | Abemaciclibe em monoterapia (doença politratada) |  | — | sim | met p12 |
| rh | metastatico-endocrino-refratario | 1ª linha | QT sistêmica – 1ª linha (sem gBRCA; HER2 0+, 1+ ou 2+ ISH-) | sem mutação germinativa BRCA1/2 e HER2 0+, 1+ ou 2+ (ISH negativo) | ALTO/FORTE |  | met p22 |
| rh | metastatico-endocrino-refratario | 1ª linha | Trastuzumabe deruxtecana – 1ª linha (sem gBRCA; HER2 0+, 1+ ou 2+ ISH-) | sem mutação germinativa BRCA1/2 e HER2 0+, 1+ ou 2+ (ISH negativo) | ALTO/FORTE |  | met p22 |
| rh | metastatico-endocrino-refratario | 1ª linha | iPARP (olaparibe ou talazoparibe) – 1ª linha gBRCA | mutação germinativa BRCA1/2 | ALTO/FORTE |  | met p22 |
| rh | metastatico-endocrino-refratario | 2ª linha | Trastuzumabe deruxtecana – 2ª linha (HER2 1+ ou 2+ ISH-) | HER2 1+ ou 2+ (ISH negativo) | ALTO/FORTE |  | met p22 |
| rh | metastatico-endocrino-refratario | 2ª linha | Sacituzumabe govitecana – 2ª linha (preferencial sem HER2-low) | sem biomarcador; após 2 linhas de QT (ao menos 1 na doença metastática) | ALTO/FORTE |  | met p22 |
| rh | metastatico-endocrino-refratario | 2ª linha | QT sistêmica – 2ª linha (sem biomarcador) | sem biomarcador | ALTO/FORTE |  | met p22 |
| rh | metastatico-endocrino-refratario | 3ª linha em diante | Terapia alvo guiada por biomarcador – 3ª linha em diante | MSI-H, NTRK, RET, TMB-H | MODERADO/FORTE |  | met p22 |
| rh | metastatico-endocrino-refratario | 3ª linha em diante | QT sistêmica – 3ª linha em diante | qualquer biomarcador | MODERADO/FORTE |  | met p22 |
| rh | neoadjuvante | neoadjuvante | ACdd seguido de paclitaxel semanal (ou paclitaxel dose-densa) – preferencial |  | ALTO/FORTE | sim | neo p11 |
| rh | neoadjuvante | neoadjuvante | AC seguido de paclitaxel (ou docetaxel) |  | ALTO/FORTE | sim | neo p11 |
| rh | neoadjuvante | neoadjuvante | EC seguido de paclitaxel (ou docetaxel) |  | ALTO/FORTE | sim | neo p11 |
| rh | neoadjuvante | neoadjuvante | Esquemas com 5-fluorouracil (FEC/FAC) – não favorecidos |  | — **contra** |  | neo p11 |
| rh | neoadjuvante | neoadjuvante | Hormonioterapia neoadjuvante com inibidor de aromatase | pós-menopausa; grau 1-2, RE forte, RP+, Ki67 baixo, HER2- (luminal A-like) | — |  | neo p12 |
| tn | adjuvante | adjuvante | ACdd → paclitaxel semanal (ou Tdd) |  | ALTO/FORTE | sim | adj p18 |
| tn | adjuvante | adjuvante | AC → paclitaxel semanal (ou docetaxel) |  | ALTO/FORTE | sim | adj p18 |
| tn | adjuvante | adjuvante | Carboplatina + paclitaxel |  | ALTO/FORTE | sim | adj p18 |
| tn | adjuvante | adjuvante | AC × 4 |  | MODERADO/FRACA | sim | adj p18 |
| tn | adjuvante | adjuvante | TC |  | MODERADO/FORTE | sim | adj p18 |
| tn | adjuvante | adjuvante | CMF clássico |  | MODERADO/FRACA | sim | adj p18 |
| tn | adjuvante | adjuvante | CMF EV |  | MODERADO/FRACA | sim | adj p18 |
| tn | adjuvante | adjuvante | Olaparibe 1 ano (gBRCA1/2, TN de alto risco operado upfront) | gBRCA1/2 + tumor ≥ T2 ou N+ após QT adjuvante | ALTO/FORTE | sim | adj p18 |
| tn | doenca-residual | adjuvante pós-neoadjuvância | Capecitabina 8 ciclos (CREATE-X) – sem RPC | doença residual após neo com antracíclico e/ou taxano; independente de BRCA | ALTO/FORTE | sim | adj p18 |
| tn | doenca-residual | adjuvante pós-neoadjuvância | Pembrolizumabe adjuvante 9 ciclos (após KN522 na neo) | tratadas com pembrolizumabe na neoadjuvância, independentemente da resposta | ALTO/FORTE | sim | adj p18 |
| tn | doenca-residual | adjuvante pós-neoadjuvância | Olaparibe 1 ano (gBRCA1/2) – doença residual | gBRCA1/2 com doença residual após neoadjuvância | ALTO/FORTE | sim | adj p18 |
| tn | metastatico-1a-linha | 1ª linha | Pembrolizumabe + QT (paclitaxel, nab-paclitaxel ou carboplatina + gencitabina) | PD-L1 CPS ≥ 10 (22C3), independente de BRCA1/2 | ALTO/FORTE |  | met p23 |
| tn | metastatico-1a-linha | 1ª linha | Datopotamabe deruxtecana (preferencial) – CPS < 10 sem gBRCA | PD-L1 CPS < 10 sem mutação germinativa BRCA1/2 | ALTO/FORTE |  | met p23 |
| tn | metastatico-1a-linha | 1ª linha | QT sistêmica – CPS < 10 sem gBRCA | PD-L1 CPS < 10 sem mutação germinativa BRCA1/2 | ALTO/FORTE |  | met p23 |
| tn | metastatico-1a-linha | 1ª linha | iPARP (olaparibe ou talazoparibe) – CPS < 10 com gBRCA | PD-L1 CPS < 10 + mutação germinativa BRCA1/2 | ALTO/FORTE |  | met p23 |
| tn | metastatico-1a-linha | 1ª linha | Atezolizumabe + nab-paclitaxel (considerar) | CPS < 10 (22C3) e PD-L1 > 1 por Ventana SP142 | — |  | met p23 |
| tn | metastatico-2a-linha | 2ª linha | iPARP (olaparibe ou talazoparibe) – gBRCA | mutação germinativa BRCA1/2 | ALTO/FORTE |  | met p23 |
| tn | metastatico-2a-linha | 2ª linha | Sacituzumabe govitecana (preferencial) | qualquer biomarcador; progressão após ≥ 1 linha na doença metastática | ALTO/FORTE |  | met p23 |
| tn | metastatico-2a-linha | 2ª linha | QT sistêmica – 2ª linha | qualquer biomarcador | ALTO/FORTE |  | met p23 |
| tn | metastatico-2a-linha | 2ª linha | Trastuzumabe deruxtecana (HER2 1+ ou 2+ ISH-) | HER2 1+ ou 2+ (ISH negativo) | ALTO/FORTE |  | met p23 |
| tn | metastatico-3a-linha | 3ª linha em diante | Terapia alvo guiada por biomarcador | MSI-H/dMMR, NTRK, RET, TMB-H (≥ 10 mut/Mb) | MODERADO/FORTE |  | met p23 |
| tn | metastatico-3a-linha | 3ª linha em diante | QT sistêmica – 3ª linha em diante | qualquer biomarcador | MODERADO/FORTE |  | met p23 |
| tn | neoadjuvante-estadio-i | neoadjuvante | ACdd → paclitaxel (T ou Tdd) – preferencial | TN ou ER-low, T1c (1-2 cm) N0 | ALTO/FORTE | sim | neo p13 |
| tn | neoadjuvante-estadio-i | neoadjuvante | AC → paclitaxel (T ou Tdd) |  | ALTO/FORTE | sim | neo p13 |
| tn | neoadjuvante-estadio-i | neoadjuvante | AC → carboplatina + paclitaxel |  | MODERADO/FORTE | sim | neo p13 |
| tn | neoadjuvante-estadio-i | neoadjuvante | Carboplatina + paclitaxel |  | ALTO/FORTE | sim | neo p13 |
| tn | neoadjuvante-estadio-ii-iii | neoadjuvante | KEYNOTE-522: carboplatina + paclitaxel + pembrolizumabe → AC/EC + pembrolizumabe → pembrolizumabe adjuvante – preferencial | TN ou ER-low, > 2 cm ou N+ (estádios II-III) | ALTO/FORTE | sim | neo p13 |
| tn | neoadjuvante-estadio-ii-iii | neoadjuvante | AC → paclitaxel (T ou Tdd) – pembrolizumabe indisponível |  | ALTO/FORTE | sim | neo p13 |
| tn | neoadjuvante-estadio-ii-iii | neoadjuvante | AC → carboplatina + paclitaxel – pembrolizumabe indisponível |  | MODERADO/FORTE | sim | neo p13 |
| tn | neoadjuvante-estadio-ii-iii | neoadjuvante (após refratariedade) | RT neoadjuvante + capecitabina radiossensibilizante (refratário à QT ou irressecável) |  | MODERADO/FORTE |  | neo p13 |
| her2 | adjuvante | adjuvante estendida | Neratinibe 1 ano após 1 ano de trastuzumabe (HER2+/RH+) | HER2+/RH+ | ALTO/FRACA | sim | adj p19 |
| her2 | adjuvante | adjuvante | ACdd → TH |  | ALTO/FORTE | sim | adj p19 |
| her2 | adjuvante | adjuvante | AC → TH |  | ALTO/FORTE | sim | adj p19 |
| her2 | adjuvante | adjuvante | TCH (docetaxel + carboplatina + trastuzumabe) |  | ALTO/FORTE | sim | adj p19 |
| her2 | adjuvante | adjuvante | TH 12 semanas (paclitaxel + trastuzumabe) | tumores < 2 cm e N0 (regime de escolha) | MODERADO/FORTE | sim | adj p19 |
| her2 | adjuvante | adjuvante | Duração do trastuzumabe adjuvante: 1 ano (padrão) |  | ALTO/FORTE | sim | adj p20 |
| her2 | adjuvante | adjuvante | Adição de pertuzumabe em LFN positivo | LFN positivo | ALTO/FORTE | sim | adj p19 |
| her2 | doenca-residual | adjuvante pós-neoadjuvância | T-DM1 por 14 ciclos (doença residual invasiva) | doença residual invasiva após QT neo com bloqueio simples ou duplo | ALTO/FORTE | sim | neo p16 |
| her2 | doenca-residual | adjuvante estendida | Neratinibe 1 ano após 1 ano de trastuzumabe (HER2+/RH+) | HER2+/RH+, em especial com doença residual após neoadjuvância | ALTO/FRACA | sim | adj p19 |
| her2 | metastatico-1a-linha | 1ª linha | Trastuzumabe + pertuzumabe + taxano | sem tratamento prévio ou recidiva > 6 meses após término de trastuzumabe adjuvante | ALTO/FORTE |  | met p17 |
| her2 | metastatico-1a-linha | 1ª linha | Trastuzumabe + pertuzumabe + vinorelbina (contraindicação a taxano) |  | — |  | met p18 |
| her2 | metastatico-1a-linha | 1ª linha | T-DXd em 1ª linha se recidiva < 6 meses após trastuzumabe adjuvante | recidiva antes de 6 meses do término da adjuvância com trastuzumabe | — |  | met p18 |
| her2 | metastatico-1a-linha | 1ª linha (manutenção) | HER2+/RH+: anti-HER2 + QT até máxima resposta, depois anti-HER2 + HT | HER2+/RH+ | — |  | met p20 |
| her2 | metastatico-2a-linha | 2ª linha | Trastuzumabe deruxtecana | progressão após trastuzumabe + pertuzumabe | ALTO/FORTE |  | met p17 |
| her2 | metastatico-linhas-subsequentes | linhas subsequentes | T-DM1 |  | ALTO/FORTE |  | met p17 |
| her2 | metastatico-linhas-subsequentes | linhas subsequentes | T-DXd (se não utilizado previamente) |  | ALTO/FORTE |  | met p17 |
| her2 | metastatico-linhas-subsequentes | linhas subsequentes | Trastuzumabe + capecitabina |  | ALTO/FORTE |  | met p17 |
| her2 | metastatico-linhas-subsequentes | linhas subsequentes | Lapatinibe + capecitabina |  | ALTO/FORTE |  | met p17 |
| her2 | metastatico-linhas-subsequentes | linhas subsequentes | Trastuzumabe + lapatinibe |  | ALTO/FORTE |  | met p17 |
| her2 | metastatico-linhas-subsequentes | linhas subsequentes | Trastuzumabe + outras QT |  | MODERADO/FORTE |  | met p17 |
| her2 | neoadjuvante | neoadjuvante | TCHP (taxano + carboplatina + trastuzumabe + pertuzumabe) – preferencial | HER2+ > 2 cm ou localmente avançado | ALTO/FORTE | sim | neo p16 |
| her2 | neoadjuvante | neoadjuvante | THP (taxano + trastuzumabe + pertuzumabe) |  | MODERADO/FORTE | sim | neo p16 |
| her2 | neoadjuvante | neoadjuvante | AC → TH(P) |  | ALTO/FORTE | sim | neo p16 |
| her2 | neoadjuvante | neoadjuvante | TH (paclitaxel + trastuzumabe) – frágeis ou muito baixo risco |  | MODERADO/FORTE | sim | neo p16 |
| her2 | pos-neoadjuvante-rpc | adjuvante pós-neoadjuvância | Trastuzumabe até completar 1 ano (cN0 com RPC) | RPC; cN0 ao diagnóstico | ALTO/FORTE | sim | neo p16 |
| her2 | pos-neoadjuvante-rpc | adjuvante pós-neoadjuvância | Pertuzumabe + trastuzumabe até completar 1 ano (cN+ com RPC) | RPC; cN+ ao diagnóstico (comprometimento axilar) | ALTO/FORTE | sim | neo p16 |
| cdis | tratamento | local | Ressecção completa: conservadora + RT da mama total ou mastectomia |  | ALTO/FORTE |  | adj p21 |
| cdis | tratamento | adjuvante | Tamoxifeno ou anastrozol no CDIS RH+ | CDIS RH+ não submetido a mastectomia bilateral | ALTO/FORTE | sim | adj p21 |
| cdis | tratamento | adjuvante | Anti-HER2 no CDIS HER2+ – não oferecer |  | MODERADO/FRACA **contra** |  | adj p21 |
| homem | adjuvante | adjuvante | Tamoxifeno adjuvante (homem RH+) | RH+ | — |  | adj p5 |

## Regimes citados fora das recomendações (`recomendado_sboc: false`)

- `reg.mama.rh.adj-palbociclibe-contra` — Palbociclibe adjuvante – resultados negativos. PALLAS e PENELOPE-B negativos. [adj p15]
- `reg.mama.her2.neo-tdxd-thp-db11` — T-DXd × 4 → THP × 4 (DESTINY-Breast11) – fora das recomendações. Sem aprovação regulatória no Brasil para esta indicação na elaboração da diretriz. [neo p17]
- `reg.mama.her2.residual-tdxd-db05` — T-DXd na doença residual (DESTINY-Breast05) – fora das recomendações. Sem aprovação regulatória no Brasil para esta indicação. [adj p20]
- `reg.mama.her2.adj-tchp-dose` — TCHP adjuvante (dose listada na diretriz). Consta na tabela de doses; não listado entre os esquemas adjuvantes recomendados (p19). [adj p11]
- `reg.mama.rh.met-elacestranto` — Elacestranto (ESR1) – fora das recomendações. Sem aprovação Anvisa. [met p14]
- `reg.mama.rh.met-imlunestranto` — Imlunestranto ± abemaciclibe – fora das recomendações. Sem aprovação Anvisa. [met p15]
- `reg.mama.rh.met-dato-dxd` — Datopotamabe deruxtecana (RH+/HER2-, após ≥ 1 linha de QT). Recentemente aprovado pela agência regulatória brasileira; não consta das recomendações/fluxograma RH+ da diretriz. [met p16]
- `reg.mama.tn.met-qt-combinacoes` — Combinações de QT para doença metastática (situações específicas). Tabela p22: AC, EC, CMF, docetaxel + capecitabina, gencitabina + paclitaxel, carboplatina + gencitabina, cisplatina + gencitabina, carboplatina + paclitaxel; outros agentes únicos: docetaxel, ciclofosfamida, epirrubicina, carboplatina, cisplatina. Poli-QT indicada fortemente na crise visceral; bevacizumabe: ganho modesto de RO/SLP sem SG. [met p22]
- `reg.mama.tn.met-sacituzumabe-1l` — Sacituzumabe govitecana ± pembrolizumabe em 1ª linha – fora do fluxograma. Sem aprovação regulatória no Brasil para esta indicação. [met p26]
- `reg.mama.her2.met-tdxd-pertuzumabe-db09` — T-DXd + pertuzumabe 1ª linha (DESTINY-Breast09) – fora das recomendações. Sem aprovação regulatória no Brasil. [met p18]
- `reg.mama.her2.met-palbo-manutencao-patina` — Palbociclibe + HT + anti-HER2 na manutenção (PATINA) – fora das recomendações. Sem aprovação Anvisa para esta indicação. [met p18]
- `reg.mama.her2.met-tucatinibe-manutencao` — Tucatinibe + HP na manutenção (HER2CLIMB-05) – fora das recomendações. Tucatinibe sem aprovação Anvisa. [met p19]
- `reg.mama.her2.met-tucatinibe-h-cape` — Tucatinibe + trastuzumabe + capecitabina (HER2CLIMB) – fora das recomendações. Tucatinibe sem aprovação no Brasil. [met p19]

## Biomarcadores

| id | método | limiar (literal) | quando testar | NE/FR |
|---|---|---|---|---|
| `bio.re-rp` | IHQ (interpretar conforme recomendações internacionais ASCO/CAP) | positivo/negativo; discordância core × peça persistente após revisão: considerar o resultado positivo | todo carcinoma invasivo na biópsia (IHQ RE, RP, HER2, Ki67 imprescindível); repetir na peça se negativo na biópsia (NE BAIXO/FR FORTE, ESMO); considerar IHQ da lesão metastática | ALTO/FORTE |
| `bio.er-low` | IHQ | RE abaixo de 10% (neoadjuvância p13; metastática p25: 'entre 1 e 10%'); RE negativo com RP baixo também segue manejo de TN | HER2-negativo com RE baixo: manejar como triplo-negativo, inclusive testagem genética para câncer hereditário | — |
| `bio.her2` | IHQ; hibridização in situ (FISH/CISH/SISH) se IHQ 2+ | positivo = IHQ 3+ ou FISH positivo; IHQ 2+ (indeterminado) exige ISH (NE MODERADO/FR FORTE, NCCN); FISH indeterminado = HER2 negativo para estadiamento prognóstico | todo carcinoma invasivo ao diagnóstico; repetir na peça se negativo na biópsia | ALTO/FORTE |
| `bio.her2-low-ultralow` | IHQ | HER2-low = IHQ 1+ ou 2+ com ISH negativo; HER2-ultralow = IHQ 0 com coloração de membrana | doença metastática: pesquisar HER2-low/ultralow em tumores RE+ e HER2-low em triplo-negativos (elegibilidade a T-DXd) | — |
| `bio.ki-67` | IHQ | ≥ 20% associado a maior risco (critério de alto risco; usado em monarchE/NATALEE); 'Ki67 baixo' para HT neoadjuvante | todo carcinoma invasivo ao diagnóstico | ALTO/FORTE |
| `bio.brca` | teste germinativo (aconselhamento genético) | variante patogênica germinativa BRCA1/2 | metastático: pesquisa de mutação germinativa BRCA1/2 e PALB2; localizado de alto risco (elegibilidade a olaparibe); critérios de encaminhamento a aconselhamento genético no seguimento | — |
| `bio.palb2` | teste germinativo | mutação germinativa PALB2 | metastático (junto com BRCA1/2); olaparibe bastante ativo em PALB2 germinativo (TBCRC 048) | — |
| `bio.pik3ca` | sequenciamento no tumor (primário ou metastático) ou biópsia líquida (ctDNA) | mutação presente | RE+/HER2- metastático (1ª linha com resistência endócrina: inavolisibe; 2ª linha: capivasertibe/alpelisibe) | — |
| `bio.akt1-pten` | sequenciamento tumoral | alteração da via PIK3CA/AKT1/PTEN | RE+/HER2- metastático, 2ª linha (capivasertibe + fulvestranto) | — |
| `bio.esr1` | sequenciamento (tumor/ctDNA) | mutação somática ESR1 | contexto de SERDs orais (elacestranto, imlunestranto) — sem aprovação Anvisa, fora das recomendações formais | — |
| `bio.pd-l1` | IHQ 22C3 (CPS) ou Ventana SP142 | CPS ≥ 10 (22C3) para pembrolizumabe + QT; SP142 > 1 (atezolizumabe + nab-paclitaxel se CPS < 10) | triplo-negativo metastático antes da 1ª linha; NÃO testar na doença inicial (não influencia conduta) NE ALTO/FR FORTE | — |
| `bio.oncotype-rs` | assinatura genômica 21 genes | RS < 11; 11-15 (< 50 anos) e ≤ 25 (> 50 anos) sem benefício de QT; ≤ 50 anos RS 16-20 (~1,6%) e 21-25 (~6,5%) discutir QT; RS > 25 QT indicada; N1-3 pós-menopausa RS ≤ 25 sem benefício; pré-menopausa RS ≤ 25 benefício SLDi 5,2% | RH+/HER2- (N0 ou 1-3 LFN) para decidir QT adjuvante; não usar em HER2+ ou RH-; pode-se omitir em pós-menopausa G1-2, RP ≥ 20%, pN0 (sobretudo < 2 cm) | ALTO/FORTE |
| `bio.mammaprint` | assinatura genômica 70 genes | baixo × alto risco genômico | preferencialmente pós-menopausa, RH+, HER2-, N0, alto risco clínico (MINDACT); até 3 LFN com ressalvas; não usar isoladamente em jovens/pré-menopausa de alto risco clínico | ALTO/FORTE |
| `bio.tils` | avaliação anatomopatológica | não especificado | informação prognóstica/preditiva em triplo-negativo e HER2-positivo | ALTO/FORTE |
| `bio.tmb-msi-ntrk` | testes moleculares agnósticos | TMB ≥ 10 mutações/megabase; MSI-H/dMMR; fusão NTRK; RET | doença metastática a partir da 3ª linha (terapia alvo guiada por biomarcador; pembrolizumabe se MSI-H/dMMR/TMB-H; larotrectinibe se NTRK) | — |

## Diagnóstico e estadiamento

- `dx.mama.rastreamento` Rastreamento mamográfico — NE ALTO/FR FORTE [est p4]
- `dx.mama.avaliacao-clinica` Anamnese e exame físico [est p5]
- `dx.mama.imagem-locorregional` Estadiamento locorregional por imagem — NE ALTO/FR FORTE [est p5]
- `dx.mama.core-biopsy` Biópsia por agulha grossa (core biopsy) — NE BAIXO/FR FORTE [est p5]
- `dx.mama.ihq` IHQ RE, RP, HER2 e Ki67 — NE ALTO/FR FORTE [est p5]
- `dx.mama.axila-puncao` USG de axila e punção de linfonodo suspeito — NE MODERADO/FR FORTE [est p25]
- `dx.mama.rm-mamas` RM de mamas (casos selecionados) [est p6]
- `dx.mama.clipagem` Clipagem (marcador) da lesão antes da neoadjuvância — NE MUITO BAIXO/FR FORTE [est p25]
- `dx.mama.ecocardiograma` Avaliação de função cardíaca — NE ALTO/FR FORTE [est p25]
- `dx.mama.fertilidade-beta-hcg` Beta-HCG e aconselhamento de fertilidade — NE MODERADO/FR FORTE [est p24]
- `dx.mama.aconselhamento-genetico` Aconselhamento genético (câncer hereditário) — NE MODERADO/FR FORTE [est p24]
- `dx.mama.biopsia-metastase` Biópsia do sítio metastático [met p5]
- `dx.mama.seguimento` Seguimento pós-tratamento [adj p23]
- `dx.mama.densitometria` Densitometria óssea na terapia endócrina [adj p21]
- `est.mama.ajcc8-t` Tumor primário (T) [est p10]
- `est.mama.ajcc8-cn` Linfonodos clínicos (cN) [est p11]
- `est.mama.ajcc8-pn` Linfonodos patológicos (pN) [est p12]
- `est.mama.ajcc8-m` Metástases (M) [est p13]
- `est.mama.ajcc8-anatomico` Agrupamento anatômico TNM [est p14]
- `est.mama.ajcc8-prognostico-clinico` Estádio prognóstico clínico [est p15]
- `est.mama.ajcc8-prognostico-patologico` Estádio prognóstico patológico [est p18]
- `est.mama.oncotype-rs-menor-11` Perfil genômico no estadiamento prognóstico [est p23]
- `est.mama.grau-histologico` Grau histológico e grau nuclear (CDIS) [est p9]
- `est.mama.estadiamento-sistemico-inicial` Estadiamento sistêmico na doença inicial — NE BAIXO/FR FORTE [est p6]
- `est.mama.estadiamento-sistemico-avancado` Estadiamento sistêmico em estádios II-III ou neoadjuvância [est p7]
- `est.mama.pet-ct-fdg` PET/CT-FDG no estadiamento — NE MODERADO/FR MODERADA [est p7]
- `est.mama.pet-ct-fes` PET/CT-FES — NE FRACA/FR FRACA [est p7]
- `est.mama.metastatico-exames` Exames para estadiamento da doença metastática [met p5]
- `est.mama.risco-clinico-adjuvancia` Critérios de risco para indicação de QT adjuvante — NE ALTO/FR FORTE [adj p6]
- `est.mama.cts5` CTS5 (risco de recorrência tardia) — NE MODERADO/FR FORTE [adj p16]
- `est.mama.localmente-avancado-definicao` Definição de tumor localmente avançado [neo p6]
- `est.mama.resistencia-endocrina` Resistência endócrina (definições) [met p11]

## Trials

104 trials (`status_resultado`: positivo 87, negativo 6, NS 11). Resultado literal (HR, IC, medianas/landmarks) no campo `resultado` de cada nó.

Metanálise RPC × sobrevida (SABCS 2018), EBCTCG – metanálise dose-densa (Lancet 2019), Del Mastro et al. (5-FU + EC/dose-densa, fatorial 2×2), ACOSOG Z1031, IA × tamoxifeno neoadjuvante (Eiermann 2001; IMPACT), KEYNOTE-522, CALGB 40603, GeparSixto, NACATRINE (Brasil), BrighTNess, PEARLY, Estudo brasileiro fase II capecitabina + RT, NOAH, GeparQuinto, NeoSphere, TRYPHAENA, TRAIN-2, DESTINY-Breast11, APHINITY, KATHERINE, CREATE-X, OlympiA, MINDACT, RxPONDER (SWOG S1007), TAILORx, Vaz-Luis et al. (paclitaxel dose-densa sem pegfilgrastim), NSABP B-15, US Oncology 9735, NSABP B-28 / CALGB (AC → paclitaxel × AC), ABC trials e PlanB (TC × 6 vs antraciclina + taxano), Carboplatina + paclitaxel adjuvante em TN (Yu et al., população asiática), monarchE, NATALEE, PALLAS, PENELOPE-B, GIM4, ABCSG-16/SALSA, MA.17R, ATLAS, aTTom, NSABP (2001) – TMX além de 5 anos, EBCTCG 2005 (metanálise 71 estudos), PERSEPHONE, ExteNET, DESTINY-Breast05, TCH adjuvante (Slamon 2011, BCIRG 006), APT (paclitaxel + trastuzumabe, fase II), EBCTCG – metanálise de bifosfonatos, ABCSG-18, GnRHa durante QT (Lambertini 2018; POEMS – Moore 2015), RIGHT Choice, PALOMA-2, MONALEESA-2, MONARCH-3, MONALEESA-7, PARSIFAL, SONIA, INAVO120, MONARCH-2, MONALEESA-3, PALOMA-3, MONARCH-1, nextMONARCH, BOLERO-2, SOLAR-1, CAPItello-291, postMONARCH, MAINTAIN, OlympiAD, EMBRACA, TBCRC 048 (Olaparib Expanded), EMERALD, EMBER-3, DESTINY-Breast04, DESTINY-Breast06, TROPiCS-02, TROPION-Breast01, CLEOPATRA, PERUSE, VELVET, DESTINY-Breast09, PATINA, HER2CLIMB-05, DESTINY-Breast03, HER2CLIMB, TH3RESA, Lapatinibe + capecitabina (Geyer), GBG-26, Lapatinibe ± trastuzumabe (fase III, 296 pacientes), PHEREXA, PERTAIN, ALTERNATIVE, SYSUCC-002, KEYNOTE-355, IMpassion130, TNT, ASCENT, ASCENT-03, ASCENT-04 / KEYNOTE-D19, TROPION-Breast02, Doxorrubicina lipossomal peguilada × convencional (509 pacientes), EMBRACE, Eribulina × capecitabina (fase III), ECR PET/CT-FDG × estadiamento convencional.

## Pontos de atenção encontrados no PDF (registrados como dado, não corrigidos)

- Neoadjuvância p7: metanálise de RPC descrita como 'apresentada no SABCS 2018' com desfecho chamado 'SLP' (88% × 67%; HR 0,31; IC 0,24-0,39), mas a nota 2 cita Conforti et al., BMJ 2021 — ver CONFERENCIA-RESUMO-NEOADJ.md.
- Neoadjuvância p17: frase truncada sobre manutenção do duplo bloqueio ('...resposta completa após a neoadjuvância aqueles com comprometimento axilar'); o fluxograma p16 resolve: RPC cN0 → trastuzumabe; RPC cN+ → pertuzumabe + trastuzumabe (NE alto/FR forte).
- Docetaxel em sequência: 75 mg/m² na tabela da neoadjuvância (p8) × 100 mg/m² na tabela da adjuvância (p9). Filgrastim D2-D10 (neo p8) × D3-D10 (adj p9). Cada regime guarda o literal do seu capítulo.
- Paclitaxel dose-densa: neo p8 permite dispensar G-CSF se < 65 anos sem comorbidade/neutropenia; adj p9 indica G-CSF 'somente para pacientes acima de 65 anos e/ou com fatores de risco'.
- Triptorrelina: tabela adj p12 diz IM; texto adj p15 diz SC.
- ER-low: neo p13 define 'abaixo de 10%'; metastática p25 'entre 1 e 10%'.
- Neo p15: BrighTNess atribuído à nota 24 (que é Denkert/GeparSixto) — erro de citação do PDF.
- Adj p17 (tabela de duração da HT): linhas 'ABCSG 016, 2018' e 'ABCSG-16/Salsa, 2021' com o mesmo conteúdo; mantido só ABCSG-16/SALSA.
- Met p19: HER2CLIMB descrito como 'fase II'.
- OlympiA (adj p18): '89,8% × 86,4% em 4 anos (HR 0,68)' sem nomear o desfecho; o texto fala em 'ganho de SLP e SG'.
- Tabelas de estádio prognóstico clínico/patológico (estadiamento p15-22) não decompostas célula a célula (layout não confiável no texto extraído); registrados TNM, agrupamento anatômico e a regra Oncotype DX < 11 → IA.
