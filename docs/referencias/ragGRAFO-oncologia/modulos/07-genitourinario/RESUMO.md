# Módulo 7: Tumores Genitourinários (PRO 2026, aulas 58 a 71)

Extração feita conforme `oncologia/ESQUEMA.md`. **Todos os nós estão com status `NAO_VERIFICADO`**, porque são resumo de aula e não evidência primária. Os PDFs não foram copiados.

- **Fonte:** 14 PDFs, extraídos com `pdftotext -layout`. As tabelas em imagem foram conferidas com Read (pages): aula 59 p.5, aula 60 p.20, aula 65 p.12-13, aula 67 p.7, 12, 13 e 18.
- **Contagem:** 364 nós (5 tumores, 27 cenários, 16 diagnósticos, 14 estadiamentos, 12 biomarcadores, 103 regimes, 58 fármacos, 115 trials, 14 fontes) e 959 arestas.
- **Validação:** passou. O JSON é válido, os ids são únicos e seguem os prefixos, toda aresta aponta para um nó existente, todo nó tem `fonte.pagina` dentro do número de páginas do PDF e aresta `FONTE` para `src.07.<aula>`, e não há nó órfão.

## Desvio de esquema
O campo `status` do trial (positivo/negativo/NS) colidiria com o `status` do nó, que precisa ser `NAO_VERIFICADO`. Por isso o resultado do estudo foi gravado em **`status_estudo`**. As observações e divergências ficam em `obs`.

## Cobertura por tumor
| Tumor | Cenários | Destaques |
|---|---|---|
| Próstata (`tum.prostata`, aulas 58-62) | baixo risco/VA; intermediário; alto/muito alto; pós-PR; recidiva bioquímica; mCSPC; mCRPC 1ª linha; mCRPC 2ª linha ou mais | PSA, PI-RADS, PET-PSMA (proPSMA), ISUP, risco NCCN 2024, volume CHAARTED/LATITUDE, Phoenix. Biomarcadores BRCA2/HRR, MSI, PSMA-PET+, PTEN. Trials ProtecT, STAMPEDE (M0/M1/doce/RT), RADICALS/GETUG-17/RAVES/ARTISTIC, RTOG 9601, SPPORT, EMBARK, CHAARTED, LATITUDE, ARCHES, ENZAMET, TITAN, ARASENS, ARANOTE, TAX-327, PROSTY, TROPIC, CARD, PROfound, TRITON-3, PROpel, TALAPRO-2, MAGNITUDE, ALSYMPCA, VISION, PSMAfore, TheraP |
| Rim (`tum.rim`, aulas 63-65) | localizado; adjuvante; M1 1ª linha; 2ª linha ou mais; não células claras | Bosniak, AJCC 8, ISUP, IMDC/MSKCC, VHL/FH. Adjuvância KEYNOTE-564 contra TKIs e IO negativos. 1ª linha CM-214, KN-426, CM-9ER, CLEAR, JAVELIN-101, IMmotion151, COSMIC-313. Depois CM-025, METEOR, LITESPARK-005. CARMENA/SURTIME. nccRCC: PAPMET, KN-B61, bev+erlotinibe no HLRCC |
| Bexiga/urotélio (`tum.bexiga`, aulas 66-68) | NMIBC; BCG não responsivo; MIBC perioperatório; trato alto; M1 1ª linha; 2ª linha ou mais | Re-RTU, grupos de risco NMIBC, Galsky. Biomarcadores FGFR2/3, HER2, PD-L1, MSI, ERCC2. NIAGARA, VESPER, CheckMate 274, AMBASSADOR, POUT. **EV-302** (EV + pembro 31,5 vs 16,1 m; HR 0,47), CheckMate 901, JAVELIN B100, KN-052, IMvigor210, KN-045, EV-301, THOR, T-DXd |
| Testículo (`tum.testiculo`, aulas 69-70) | seminoma EC I; NSGCT EC I; EC II; EC III; resgate | TNMS, IGCCCG, IHQ, marcadores. BEP/EP/VIP/TIP com dose literal. TE19, SWENOTECA, Horwich, Hinton, T93BP, PET em massa residual de seminoma |
| Pênis (`tum.penis`, aula 71) | localizado; N+; avançado | TNM AJCC 8, p16/HPV, BLS, TIP/TPF, carbo + paclitaxel se ClCr <50, HERCULES, EPIC-A |

## Divergências com `OncoGlobal/docs/referencias/evidencias/desfechos-gi-gu.csv` (registradas em `trial.obs`)
- **LITESPARK-005:** a aula traz SLP 33,4 vs 17,1 m (HR 0,75), enquanto o CSV traz SLP 5,6 vs 5,6 m. Os números da aula parecem trocados. A SG concorda (HR 0,88).
- **TALAPRO-2:** a aula traz SG ITT "45,8 vs 27 m", enquanto o CSV traz 45,8 vs 37,0 m (HR 0,80).
- **KEYNOTE-564:** SG com HR 0,66 na aula (ASCO 2025) e 0,62 no CSV.
- **CheckMate 214:** SG com HR 0,66 na aula. O CSV final dá HR 0,69 (intermediário/desfavorável) e 0,71 (ITT).
- **KEYNOTE-426:** SG com HR 0,68 na aula e 0,84 no CSV (5 anos).
- **CheckMate 9ER:** SG 46,5 vs 36 m na aula e 46,5 vs 35,5 m (HR 0,79) no CSV.
- **COSMIC-313:** SG "imatura" na aula. O CSV final dá HR 1,02, sem ganho.
- **STAMPEDE:** docetaxel com SG 77 vs 67 m na aula e 81 vs 71 m no CSV. Abiraterona com HR 0,60 na aula e 0,63 no CSV.
- **TAX-327:** 19,2/17,8/16,3 m na aula e 18,9/17,4/16,5 m no CSV.
- **PREVAIL:** SG com HR 0,83 na aula e 0,71 no CSV.
- **CheckMate 274:** SG com HR 0,76 na aula. O CSV traz HR 0,83 em 5 anos, não significativo.
- **Divergências internas da aula:** EV-301 aparece com 12,8 m (p.17) e 12,6 m (p.14). Nadofaragene aparece com RC 53% (p.22) e ~60% (p.21).

## Lacunas
- **Slides só em imagem, não transcritos:** estadiamento TNM da próstata (aula 58 p.21/25), fluxogramas SBOC, tabelas de seguimento, algoritmos de testículo (aula 70 p.8, 10, 11, 13, 14, 16, 25, 27, 29) e estadiamento/seguimento do pênis.
- **Aula 61 ("CRPC M0"):** apesar do título, o texto não traz SPARTAN, PROSPER nem ARAMIS, então eles não foram incluídos.
- **POUT e STAMPEDE RT do primário:** a aula mostra só o desenho, sem resultado.
