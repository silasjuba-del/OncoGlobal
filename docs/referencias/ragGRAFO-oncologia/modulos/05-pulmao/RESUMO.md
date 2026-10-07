# Módulo 5: Câncer de pulmão (aulas 42 a 52, PRO 2026)

Extraído com `pdftotext -layout`. Os slides que são imagem (curvas, tabelas e desenhos de estudo) foram lidos renderizados. Todos os nós estão com status **NAO_VERIFICADO**: o material é resumo de aula, não evidência primária. Cada nó traz `fonte` {modulo, aula, pagina} e tem uma aresta `FONTE` para `src.05.<aula>`.

**Contagem:** 355 nós e 941 arestas. São 4 tumores, 30 cenários, 18 diagnósticos, 6 estadiamentos, 18 biomarcadores, 101 regimes, 101 trials, 66 fármacos e 11 fontes.

## Tumores
- `tum.cpnpc`: escamoso ~25% e adenocarcinoma ~40%. O tabagismo responde por 80 a 90% dos casos.
- `tum.cppc`: 12 a 15% dos casos.
- `tum.mesotelioma-pleural`: aula 51.
- `tum.timoma`: timoma e carcinoma tímico, aula 52.

## Diagnóstico e estadiamento (CPNPC)
- **IHQ** (42 p11):
  - escamoso: CK5/6, p40, p63
  - adenocarcinoma: TTF1, Napsina A, CK7
  - CPPC: cromogranina, CD56, sinaptofisina
- **Rastreamento** (42 p20-21):
  - NLST: RRR 20%
  - NELSON: HR 0,76
  - USPSTF / Consenso Brasileiro 2023: 50 a 80 anos e ≥20 maços-ano
- **Imagem e mediastino** (42 p24-26):
  - PET-CT para linfonodo mediastinal: sensibilidade 80%, especificidade 88%.
  - Avaliação invasiva do mediastino se tumor >3 cm, tumor central ou linfonodo suspeito. EBUS: especificidade 100%, sensibilidade 84%.
- **AJCC 9** (42 p28, p31):
  - T: T1a ≤1 cm até T4 >7 cm.
  - N2 passa a ser dividido em N2a e N2b; M1c em M1c1 e M1c2 (tema quente).
  - SG em 5 anos: IA1 92% a IVB 0% (p44).
- **Ressecabilidade** (44 p5, p26): N3, N2 bulky ou T4 com invasão de estruturas nobres = irressecável.

## Biomarcadores
- **PD-L1 TPS**: <1% / 1-49% / ≥50%. Clones 22C3, 28-8, SP263, SP142 e 73-10 (42 p35).
- **Quem testar**: NGS amplo para todo não escamoso e para escamoso não tabagista (46 p11). O PCR não identifica 49% dos casos achados pelo NGS (48 p45).
- **Testagem obrigatória**: EGFR e ALK na doença inicial (43 p20, p23); EGFR e PD-L1 no EC III (44 p19, p26).
- **Drivers no grafo**: EGFR (clássica, ex20ins e atípica), ALK, ROS1, RET, NTRK, NRG1, HER2 (mutação e IHQ 3+), MET ex14 e c-MET IHQ, BRAF V600E, KRAS G12C e G12D, co-mutações STK11/KEAP1, TROP2.
- **CPPC**: PD-L1 e AGAs não têm implicação clínica (50 p10).

## Cenários e condutas, CPNPC (resumo)

### EC IA inoperável
- SBRT. SABR não é inferior à VATS: SG em 3 anos 91% vs 91% (43 p28).

### Adjuvância
- **IMpower010**: HR 0,66 em II-IIIA com PD-L1 ≥1%; ITT sem significância.
- **KEYNOTE-091**: HR 0,76.
- **ADAURA**: SG em 5 anos 88% vs 78%, HR 0,49.
- **ALINA**: SLD HR 0,24.
- **LIBRETTO-432**: selpercatinibe, ainda "??" na aula.

### Neoadjuvância / perioperatório (driver-negativo)
- **CheckMate 816**: SG 65% vs 55%, HR 0,72. Com pCR: HR 0,11.
- **KEYNOTE-671**: SG 64,6% vs 53,6%, HR 0,74.
- Também no grafo: 77T, AEGEAN, NEOTORCH, RATIONALE-315.
- Meta-análise Sorin 2024: benefício em todos os níveis de PD-L1.

### EC III irressecável
- **PACIFIC**: SG 47,5 vs 29,1 meses.
- **LAURA**: SLP 39,1 vs 5,6 meses, HR 0,16.

### 1ª linha sem driver
- **IO isolada**: KN024 (HR 0,62), IMpower110 (0,59), EMPOWER-Lung 1 (0,57).
- **Análises FDA**: em PD-L1 ≥50%, SG HR 0,82 sem significância; em PD-L1 1-49%, SG HR 0,68.
- **PD-L1 <1%**:
  - KN189
  - CheckMate 9LA: HR 0,67
  - POSEIDON
  - meta-análise Federico: HR 0,85
  - Shiraishi 2024: negativo
- **Frágeis**: atezolizumabe (Lee 2023), HR 0,78.
- **Escamoso**: KN407 (HR 0,64), sem bevacizumabe, com taxano.
- **Ivonescimabe**: HARMONi-6 e Xiong 2025, como perspectiva.

### Terapia-alvo
- **ALK**: ALEX (SG 81,1 m), ALTA-1L, CROWN (SLP 5 anos 60%); toxicidades.
- **ROS1**: PROFILE 1001, TRIDENT-1.
- **RET**: LIBRETTO-431, HR 0,46.
- **NTRK**: larotrectinibe, TRO 75%.
- **NRG1**: eNRGy.
- **HER2**:
  - DESTINY-Lung01, 02 e 03
  - SOHO-01
  - Beamion LUNG-1
- **MET**: GEOMETRY, VISION.
- **BRAF**: dabrafenibe + trametinibe, PHAROS.
- **KRAS G12C**: CodeBreaK 200 (HR 0,66), KRYSTAL-12 (HR 0,58).
- **KRAS G12D**: setidegrasibe.
- **EGFR clássico**:
  - IPASS
  - FLAURA: SG HR 0,80
  - FLAURA2: SG 47,5 m, HR 0,77
  - MARIPOSA: SG HR 0,75
  - COCOON
- **EGFR pós-osimertinibe**:
  - MARIPOSA-2
  - KN789 e IMpower150: negativos
  - HARMONi-A
  - TROPION
  - OptiTROP-Lung04
- **EGFR ex20ins**: PAPILLON, WU-KONG1B, REZILIENT1.
- **EGFR atípicas**: LUX-Lung, UNICORN, CHRYSALIS-2.

### 2ª linha
- **Docetaxel + ramucirumabe**: padrão-ouro (Garon 2014, HR 0,86).
- **Nintedanibe**: benefício só no adenocarcinoma (Reck 2014).
- **EVOKE-01**: negativo.
- **TROPION-Lung01**: sem significância; escamoso com HR 1,32.
- **Outras opções**:
  - T-DXd para HER2 IHQ 3+, de forma agnóstica
  - telisotuzumabe vedotina, TRO 34%
  - SBRT na oligoprogressão: HR 0,41
  - reexposição a IO só em população selecionada

## CPPC
- **Estadiamento**: VALSG limitado vs extenso.
- **Doença limitada**:
  - QRT
  - ADRIATIC: SG 55,9 vs 33,4 meses, HR 0,73
  - PCI se resposta completa
- **Doença extensa**:
  - IMpower133: 12,3 vs 10,3 meses, HR 0,70
  - CASPIAN
  - IMforte: lurbinectedina + atezolizumabe, HR 0,73
- **PCI**: Slotman positivo vs Takahashi negativo. RT torácica (Slotman 2014).
- **2ª linha**: intervalo livre de platina (≤30 / ≤90 / >90 dias). DeLLphi-304: tarlatamabe, SG 13,6 vs 8,3 meses, HR 0,60.

## Mesotelioma
- **Diagnóstico**:
  - asbesto >80%; BAP1 germinativo em ~10%
  - IHQ: calretinina, WT1, CK5/6, D2-40
  - PET-CT se candidato cirúrgico
- **Cirurgia**: MARS-2 negativo; só em casos ultra selecionados.
- **CheckMate 743**: SG 18,1 vs 14,1 meses, HR 0,74. No não epitelioide: HR 0,46.
- **Chu 2023**: pembrolizumabe + QT, HR 0,57 no não epitelioide.
- **QT**: EMPHACIS e MAPS.
- **2ª linha**: CONFIRM (nivolumabe).
- **TTFields**: fase II.

## Timoma / carcinoma tímico
- **Diagnóstico e estadiamento**: Masaoka-Koga; WHO A a B3 e carcinoma; cirurgia sem biópsia se ressecável.
- **PORT** conforme estádio e margem.
- **Doença avançada**:
  - timoma: CAP
  - carcinoma tímico: carboplatina + paclitaxel, com MARBLE (atezolizumabe) e RELEVENT (ramucirumabe)
- **2ª linha**: lenvatinibe e sunitinibe; PECATI e CAVEATT. Evitar IO no timoma.

## Notas de extração
- **Campo `status_trial`**: o ESQUEMA prevê `status` tanto para o resultado do trial (positivo/negativo/NS) quanto como `NAO_VERIFICADO` obrigatório em todo nó. Para não sobrescrever o segundo, o resultado do trial foi gravado em `status_trial`.
- **Nomes de trial**: quando o slide não traz o nome do estudo, o trial leva o primeiro autor e o ano citados no slide (ex.: `tri.garon-2014-ramucirumabe`, `tri.lee-2023-atezo-frageis`).
- **Doses**: só aparecem em `dose_literal` quando estão escritas no slide.
- **Fármacos**: `far.<slug>` sem acento, no mesmo padrão do ragGRAFO/prescricao.
- **Leitura de imagem**: números de HR/IC tirados de gráficos estão sujeitos a erro de leitura. A página está registrada em cada nó para conferência.
