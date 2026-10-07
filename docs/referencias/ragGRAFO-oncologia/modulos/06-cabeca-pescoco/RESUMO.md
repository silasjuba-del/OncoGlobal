# Módulo 6: Cabeça e pescoço (aulas 53 a 57, PRO 2026)

Extraído com `pdftotext -layout`. Os slides que são imagem foram lidos renderizados. Todos os nós estão com status **NAO_VERIFICADO**. Cada nó traz `fonte` {modulo, aula, pagina} e tem uma aresta `FONTE` para `src.06.<aula>`.

**Contagem:** 177 nós e 435 arestas. São 7 tumores, 18 cenários, 11 diagnósticos, 6 estadiamentos, 11 biomarcadores, 44 regimes, 39 trials, 36 fármacos e 5 fontes.

## Tumores
- `tum.cecp`: guarda-chuva para os cenários compartilhados de adjuvância, doença localmente avançada e R/M.
- `tum.cec-cavidade-oral`
- `tum.cec-orofaringe`: p16+ e p16-.
- `tum.cec-laringe`: inclui hipofaringe.
- `tum.nasofaringe`
- `tum.glandula-salivar`
- `tum.tireoide`

## Diagnóstico, estadiamento e biomarcadores
- **Workup inicial** (53 p7-8):
  - RM e TC de face/pescoço
  - TC de tórax ou PET-CT conforme cT/cN
  - p16 obrigatório na orofaringe
  - busca de segundo primário (EDA, nasofibroscopia, broncoscopia)
- **Orofaringe p16+ pela AJCC 8** (54 p22; questão de prova p29 pede AJCC 8, 2017):
  - estádio I: cT1-2 com cN0-1
  - estádio II: T3 ou cN2
  - estádio III: T4 ou cN3
  - O estadiamento exige IHQ p16.
  - **AJCC 9 não é abordado na aula** para orofaringe nem para outro sítio de cabeça e pescoço, por isso não há nó.
- **p16 vs HPV**: positivo com expressão forte e difusa em >70% das células. ~10% dos p16+ são HPV-negativos; ISH não é rotineira (54 p23).
- **PD-L1 CPS**:
  - R/M: <1, ≥1 e ≥20 orientam a 1ª linha
  - KN689: aprovado para CPS ≥1
  - TMB ≥10 também aparece no algoritmo ASCO
- **Nasofaringe**:
  - AJCC 8
  - DNA-EBV plasmático: sensibilidade 97,1%, especificidade 98,6%
  - corte de ≥4000 cópias/mL no EC II e de >20.000 cópias/mL como critério de alto risco
- **Glândula salivar**:
  - HER2 (IHQ 3+ e/ou amplificado) e receptor de andrógeno no carcinoma de ducto salivar
  - ETV6-NTRK3 no carcinoma secretório
- **Tireoide**:
  - risco ATA
  - BRAF V600E no anaplásico (todos os casos)
  - RET germinativo e somático no medular
  - estádios IVA/IVB/IVC do anaplásico

## Cenários e condutas (resumo)

### Cavidade oral cN0
- D'Cruz 2015: esvaziamento eletivo, SG em 3 anos 80% vs 67,5%, HR 0,64.
- Linfonodo sentinela (Garrel 2020): resultado oncológico equivalente com menos morbidade.

### Adjuvância
- **Fatores de risco** (EORTC 22931 / RTOG 9501): EEC e margem positiva → QRT.
- **Cisplatina 40 mg/m² semanal** é não inferior (Kiyota 2022).
- **NIVOPOST-OP**: independente de PD-L1.

### Localmente avançado ressecável
- KEYNOTE-689, pembrolizumabe perioperatório:
  - SLE com CPS ≥10: HR 0,66
  - SLE com CPS ≥1: HR 0,70

### Localmente avançado irressecável
- QRT com cisplatina como padrão (Pignon 2009).
- IO concomitante negativa: avelumabe (Lee 2021) e pembrolizumabe (Machiels 2024, HR 0,83).
- Inelegível a cisplatina: docetaxel + RT (Patil 2023).
- TPF de indução: Vermorken 2007, HR 0,73.

### Laringe
- **Preservação**:
  - QT de indução → RT (Wolf 1991): preservação de 64%, SG semelhante.
  - QRT (Forastiere 2003): preservação 84% vs 72% vs 67%.
- **T4a ou laringe não funcionante**: laringectomia total.

### Orofaringe HPV+
- QRT com cisplatina; a conduta não muda por HPV.
- Adjuvância pós-TORS segundo Holsinger 2025.
- Desintensificação (MC1675) ainda é experimental.
- Discutir vacina HPV para os filhos.

### R/M
- **EXTREME**: 10,1 vs 7,4 meses, HR 0,80.
- **Burtness 2019** (KEYNOTE-048):
  - pembrolizumabe com CPS ≥20: HR 0,61
  - pembrolizumabe + QT com CPS ≥1: HR 0,65
  - CPS <1: sem benefício
- **Progressão em menos de 6 meses após platina**: nivolumabe (Ferris 2016, HR 0,70) ou pembrolizumabe.
- **Amivantamabe SC** (OrigAMI-4): perspectiva.

### Nasofaringe
- **Inicial**: IMRT isolada no EC I; IMRT ± QT no EC II.
- **Localmente avançado**:
  - indução GP → QRT (Zhang 2019, HR 0,43)
  - capecitabina adjuvante
  - IO precoce: CONTINUUM, toripalimabe, DIAMOND
- **R/M**:
  - anti-PD-1 + cisplatina + gencitabina (JUPITER-02, CAPTAIN-1st, RATIONALE-309)
  - iza-bren após 2 linhas: HR 0,44

### Glândula salivar
- **Doença ressecável**: cirurgia ± RT; sem papel para QT adjuvante.
- **Adenoide cístico**: vigilância ou axitinibe.
- **Por alvo**:
  - HER2: trastuzumabe + pertuzumabe ou T-DXd
  - RA: bicalutamida + leuprorrelina
  - NTRK: larotrectinibe, TRO ~80%

### Tireoide
- **Diferenciado**: cirurgia, RIT seletiva, TSH suprimido.
- **Iodorrefratário**:
  - critérios: lesão sem captação, progressão em 12-16 meses ou ≥600 mCi
  - 1ª linha: lenvatinibe (SELECT, HR 0,21)
  - sorafenibe (DECISION, HR 0,59)
  - BRAF: dabrafenibe + trametinibe
- **Medular**: selpercatinibe ou pralsetinibe.
- **Anaplásico**: BRAF/MEK.

## Notas de extração
- **Campo `status_trial`**: o resultado do trial (positivo/negativo/NS) foi gravado em `status_trial`, porque o campo `status` é obrigatoriamente `NAO_VERIFICADO`.
- **Nomes de trial**: quando o slide não traz o nome do estudo (ex.: KEYNOTE-048, CheckMate 141, JAVELIN), o id usa o primeiro autor e o ano citados no slide. Os nomes que aparecem no slide foram mantidos: EXTREME, KEYNOTE-689, NIVOPOST-OP, EORTC 22931, RTOG 9501, JUPITER-02 e outros.
- **Fora do pedido, mas no módulo**: hipofaringe entra junto com laringe. As aulas 56 (glândula salivar) e 57 (tireoide) foram incluídas por fazerem parte do módulo.
- **Leitura de imagem**: valores de HR/IC lidos de gráficos podem ter erro de leitura. Conferir pela página registrada.
