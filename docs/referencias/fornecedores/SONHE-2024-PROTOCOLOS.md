# SOnHe 2024: índice e comparação dos protocolos de QT

> **FONTE SECUNDÁRIA, SETOR PRIVADO, REFERÊNCIA A VALIDAR.** Este arquivo e o `SONHE-2024-PROTOCOLOS.csv` vêm de um manual institucional da saúde suplementar (Grupo SOnHe, "Manual de Protocolos Clínicos 2024"). **Não definem conduta no OncoGlobal (SUS).** A fonte primária local é `docs/referencias/protocolos/protocolos-citotoxicos-revisado-silas.csv`, junto com as decisões D-W9-23 e D-W9-34. Nada daqui vira ficha sem a conferência do Dr. Silas.

- **Origem (somente leitura, PDF não copiado):** `C:\Users\silas\OneDrive\EDUCAÇÃO\Material-Didatico\sboc\qt onco\Protocolos-SOnHe-2024-Modelo-7.pdf` (412 p.; a página do PDF coincide com o número impresso).
- **Data da extração:** 2026-10-06.
- **Método:** `pdftotext -layout -enc UTF-8` do PDF inteiro. Cada bloco "DOSES / PERIODICIDADE E CICLOS" foi convertido por script em uma linha por droga, e os casos irregulares foram corrigidos à mão: Amivantamabe (p. 278–279, sem cabeçalho DOSES), PROSPECT/TNT (p. 113–114), THP, MacDonald e CAV-IFO/EP.
- **CSV:** 837 linhas, uma por droga × protocolo × cenário. Quando o manual dá mais de um cenário no mesmo bloco (por exemplo, "Adjuvante: … / Paliativo: …"), cada cenário vira uma linha. A coluna `fonte` repete o selo de fonte secundária em todas as linhas. A coluna `observacoes` guarda o texto de periodicidade do manual e, quando há ambiguidade, o texto literal do item.
- **Campos sempre vazios no manual:** `diluente` e quase todo `tempo_infusao`. O manual **não informa diluente, volume nem tempo de infusão**, exceto as bombas de 5-FU (24/46/48/96 h), o paclitaxel em 24 h do TIP e o "bôlus" de 5-FU.
- **`cenario`:** vem do texto do manual (prefixos "Adjuvante:/Paliativo:/Neoadjuvante:/Perioperatório:/Definitivo:/Manutenção:", "(+RT)", "concomitante à RT", subtítulo "QT neo/adjuvante" ou "doença metastática" da mama). "paliativo/metastático" = periodicidade "até progressão de doença ou toxicidade limitante". O campo fica vazio quando o manual não diz o cenário.
- **`referencia_estudo`:** preenchida só quando o nome do esquema cita o estudo (CLEOPATRA, CM-9LA, PROSPECT, AVEX, CROSS, MacDonald, FLOT, TNT). Cada capítulo traz uma lista de REFERÊNCIAS, mas sem ligação explícita a cada esquema; por isso essas referências não foram atribuídas.

## 1. Estrutura do manual

- **Capa, autores (12 oncologistas, CRM/RQE), apresentação e sumário (p. 1–7).** O objetivo declarado é "normatizar o tratamento" nos serviços do grupo. O manual considera o rol da ANS (cobertura obrigatória da saúde suplementar).
- **Capítulos por tumor (p. 8–381).** Todos seguem o mesmo molde:
  1. Criado por / Responsável técnico.
  2. Exames para estadiamento.
  3. Exames para avaliação de resposta.
  4. **PROTOCOLOS**: árvore por cenário (estágio, biomarcador, linha), com "OPÇÃO PREFERENCIAL" e "ALTERNATIVA(S)". Drogas fora do rol da ANS vêm marcadas com "*" ou com a nota "depende de discussão em tumor board e com fonte pagadora".
  5. **DOSES-PADRÃO DAS MEDICAÇÕES UTILIZADAS**: blocos com nome do esquema, `DOSES` (droga, dose, via, dias) e `PERIODICIDADE E CICLOS`.
  6. Seguimento.
  7. Referências.
- **Suporte clínico (p. 385–412):** Controle de dor, **Náusea e vômito (p. 399–404)** e Neutropenia febril. Esses capítulos não entraram no CSV, porque não são protocolos de QT.
- O manual também traz hormonioterapia, terapia-alvo, imunoterapia, radiofármacos, G-CSF e terapia óssea. Tudo foi mantido no CSV e marcado em `observacoes` quando é suporte ou lista de opções (não combinação).

## 2. Protocolos por tumor

"Total" = blocos de esquema no CSV (inclui HT, alvo, IO e suporte). "Com citotóxico" = blocos com pelo menos uma droga citotóxica.

| Tumor (capítulo, páginas) | Total | Com citotóxico |
|---|---:|---:|
| Mama: localizada + metastática (p. 10–46) | 54 | 30 |
| Colo de útero (p. 47–56) | 11 | 10 |
| Endométrio (p. 57–68) | 16 | 9 |
| Ovário, incluindo germinativos (p. 69–80) | 17 | 13 |
| Vagina (p. 81–86) | 7 | 7 |
| Vulva (p. 87–95) | 6 | 6 |
| Cólon (p. 96–108) | 19 | 12 |
| Reto (p. 109–115) | 8 | 7 |
| Esôfago (p. 116–123) | 10 | 5 |
| Estômago (p. 124–137) | 19 | 14 |
| Fígado/CHC (p. 138–145) | 8 | 0 |
| Pâncreas (p. 146–152) | 6 | 6 |
| Canal anal (p. 153–159) | 7 | 7 |
| Vias biliares (p. 160–169) | 10 | 7 |
| Bexiga (p. 170–183) | 21 | 11 |
| Rim, células claras (p. 184–192) | 7 | 0 |
| Próstata (p. 193–207) | 15 | 6 |
| Pênis (p. 208–215) | 8 | 8 |
| Testículo (p. 216–233) | 7 | 7 |
| Pele não-melanoma (p. 234–240) | 11 | 8 |
| Melanoma (p. 241–253) | 16 | 2 |
| Pulmão CPNPC (p. 254–284) | 40 | 27 |
| Pulmão CPPC (p. 285–292) | 10 | 10 |
| Cabeça e pescoço (p. 293–302) | 13 | 10 |
| Nasofaringe (p. 303–311) | 10 | 10 |
| Sarcoma ósseo do adulto (p. 312–320) | 7 | 6 |
| Sarcoma de partes moles (p. 321–335) | 12 | 6 |
| GIST (p. 336–346) | 8 | 0 |
| Tireoide (p. 347–355) | 9 | 3 |
| TNE gastrointestinal/pancreático (p. 356–363) | 6 | 2 |
| Gliomas (p. 364–372) | 9 | 5 |
| Sítio primário oculto (p. 373–384) | 6 | 3 |
| **Total** | **413** | **257** |

## 3. Pré-medicação e antiemese: SOnHe × padrão local

**Padrão SOnHe** (capítulo "Náusea e vômito", Tabela 2, p. 403; doses de referência na p. 401–402):

| Risco emetogênico | Pré-QT (D1) | Pós-QT |
|---|---|---|
| Alto (antraciclina + ciclofosfamida, cisplatina, ciclofosfamida ≥ 1.500 mg/m², dacarbazina) | **Preferencial:** Akynzeo® (netupitanto 300 mg + palonosetrona 0,56 mg) 1 cp VO + dexametasona 20 mg EV. **Alternativa:** ondansetrona 16 mg EV (ou palonosetrona 0,25 mg) + **fosaprepitanto 150 mg EV** + dexametasona 20 mg EV | Dexametasona 4 mg VO 12/12 h D2–D4 |
| Moderado (carboplatina, oxaliplatina, irinotecano, doxorrubicina, ifosfamida…) | Ondansetrona 16 mg EV + dexametasona 20 mg EV | Dexametasona 4 mg VO 12/12 h D2–D4, principalmente com ciclofosfamida, doxorrubicina ou oxaliplatina; sem pós-QT nos demais |
| Baixo | Ondansetrona 8 mg EV | — |
| Mínimo | Nenhuma | — |

Nota do manual: em esquemas semanais, considerar dose reduzida, principalmente no risco moderado.

- **NK1: SIM.** O antagonista NK1 é o padrão do risco alto: Akynzeo, ou fosaprepitanto/aprepitanto na alternativa. O Akynzeo também vem escrito **dentro do próprio esquema** em ACdd, AC convencional, CDDP + Gencitabina e CDDP + Gencitabina + Trastuzumabe (Mama, p. 20 e 36–38). Nesses esquemas, o CSV leva o Akynzeo em `pre_medicacao`.
- **Olanzapina:** aparece só na lista de doses (2,5–5 mg VO 1x/dia ou 12/12 h, ou 10 mg VO D1–D4 pós-QT) e na classe dos neurolépticos. **Não faz parte da Tabela 2** (não é padrão profilático).
- **Prometazina:** citada só como anti-histamínico, com "melhor indicação" na náusea por obstrução intestinal. Não é pré-QT.
- **Taxanos:** o manual **não traz pré-medicação de hipersensibilidade** (sem cimetidina/ranitidina, anti-H1 ou corticoide específico para paclitaxel ou docetaxel).
- **Cisplatina:** **sem hidratação, sem magnésio/potássio e sem manitol** nos esquemas. G-CSF aparece como "Suporte G-CSF" ou com dose explícita (filgrastim 300 mcg SC, pegfilgrastim 6 mg SC).

**Comparação com o padrão local (D-W9-23c, alterado por D-W9-34c/d):**

| Item | Local (OncoGlobal/SUS) | SOnHe 2024 |
|---|---|---|
| 5-HT3 | Ondansetrona | Ondansetrona 8–16 mg (ou palonosetrona) |
| Corticoide | Dexametasona | Dexametasona 20 mg EV D1; 4 mg 12/12 h D2–D4 no risco alto |
| NK1 | **Não usa** (nem no risco alto) | **Usa** no risco alto (Akynzeo preferencial; fosaprepitanto na alternativa) |
| Olanzapina | 5 mg **opcional** no risco alto | Só na lista de doses (2,5–10 mg); não é profilaxia padrão |
| Anti-H1 | Prometazina VO na pré-medicação | Prometazina só como antiemético de resgate (obstrução) |
| Taxano | Cimetidina 300 mg em todo taxano | Nada |
| Cisplatina | Hidratação pré e pós com Mg e K, D1 e D8 | Nada (o manual não cobre hidratação) |

## 4. 5-FU em infusão: tempo da bomba

Padrão local: a planilha traz "D1 e D2, infusão 8 h, sem bomba" (1.200 + 1.200 mg/m²), mas **D-W9-23a decidiu infusão contínua de 46 h com bomba**. No SOnHe **não há infusão de 8 h** em nenhum esquema, e o próprio manual alterna entre 46 h e 48 h:

| Tempo no SOnHe | Esquemas (página) |
|---|---|
| **46 h** | FOLFOX e FOLFOX + Nivolumabe (Estômago, p. 130–131); FOLFOX + Trastuzumabe + Pembrolizumabe (p. 132); FOLFOX (Pâncreas, p. 150); FOLFOX (TNE, p. 361); FOLFOX (Sítio oculto, p. 380). Em todos: bolus de 400 mg/m² + 2.400 mg/m² em 46 h |
| **48 h** | deGramont, FOLFOX, FOLFIRI, FOLFOXIRI (3.200 mg/m², sem bolus) e 5FU/LV + Panitumumabe (Cólon, p. 102–105); FOLFOX (Reto, p. 113); mFOLFIRINOX (Pâncreas, p. 149, 2.400 mg/m² **sem bolus**); FOLFOX (Canal anal, p. 157); mDCF (Estômago, p. 132: 2.000 mg/m² + bolus 400; Canal anal, p. 158: 2.400 mg/m² sem bolus) |
| **24 h** | **FLOT (Estômago, p. 128): 2.600 mg/m² em 24 h**, sem bolus. Validar |
| **96 h** | CDDP + 5FU e variações (Vagina, Vulva, Esôfago, Estômago 5FU/CDDP, Canal anal, Pênis, Cabeça e pescoço): 3.000–4.000 mg/m² por ciclo |

## 5. Comparação com a planilha local (mesmo nome/esquema + tumor)

Legenda: **IGUAL** = mesmas drogas, doses e dias (diferenças só de cobertura de cenário não contam). **DIFERENTE** = campo e valores lado a lado (local → SOnHe). **SÓ NA LOCAL** = o SOnHe não tem esse esquema no capítulo do tumor. Pré-medicação e hidratação ficam fora desta tabela (ver a seção 3). Em **negrito** estão as diferenças de **dose**, de **dias** e de **tempo de 5-FU**.

### Próstata

| Local | SOnHe (p.) | Resultado |
|---|---|---|
| Docetaxel (D1 e D15) — 50 mg/m² D1,D15 q28 + prednisona 5 mg 12/12 h | Docetaxel quinzenal (p. 201) — 50 mg/m² D1 q14 + prednisona 5 mg 12/12 h D1–D14 | DIFERENTE só na escrita: **D1,D15 q28 × D1 q14** (mesma intensidade de dose) |
| Docetaxel (21/21) — 75 mg/m² + prednisona | Docetaxel q21d (p. 200) — 75 mg/m² + prednisona 5 mg 12/12 h D1–D21; até 6 ciclos (sensível à castração) | IGUAL |
| Carboplatina + Paclitaxel semanal | — (o SOnHe tem Carboplatina + Docetaxel e Carboplatina + Cabazitaxel) | SÓ NA LOCAL |
| Carboplatina + Paclitaxel (21/21) | — | SÓ NA LOCAL |

### Mama

| Local | SOnHe (p.) | Resultado |
|---|---|---|
| AC-T / AC-CT (fase AC) — doxorrubicina 60 + ciclofosfamida 600 q21 × 4 | Esquema AC convencional (p. 20) | IGUAL na dose. O SOnHe põe Akynzeo (NK1) no esquema e tem ainda o ACdd q14 + G-CSF como preferencial na neoadjuvância |
| AC-T (fase T) — paclitaxel 80 semanal × 12 | Esquema T (p. 20) | IGUAL |
| AC-CT (fase CT) — paclitaxel 80 + carboplatina **AUC 2** semanal × 12 | Esquema Carbotaxol semanal (p. 21) — carboplatina **AUC 1,5–2** | DIFERENTE: carboplatina AUC 2 × 1,5–2 (o valor local fica dentro da faixa) |
| TC — docetaxel 75 + ciclofosfamida 600 q21 × 4 | Esquema TC (p. 19) | DIFERENTE: n_ciclos 4 × 4 a 6 |
| CMF | — | SÓ NA LOCAL |
| Doxorrubicina + Paclitaxel (AT) | — | SÓ NA LOCAL |
| Docetaxel (monoterapia) 75 q21 | Docetaxel (p. 39) | IGUAL |
| Paclitaxel (monoterapia) 175 q21 | — (o SOnHe só tem paclitaxel semanal em combinação: 80 + HP ou 90 D1/D8/D15 + bevacizumabe) | SÓ NA LOCAL |
| Gemcitabina 1.000 D1,D8 q21 | Gencitabina (p. 40) | IGUAL |
| Capecitabina (monoterapia) **1.250** mg/m² 12/12 h D1–D14 | Capecitabina paliativa (p. 40) **1.000** mg/m²; a Capecitabina adjuvante (p. 24) é que usa 1.250 | DIFERENTE: **dose 1.250 × 1.000 no metastático** |
| Capecitabina + Docetaxel (XT) — capecitabina **1.250** + docetaxel 75 | Docetaxel + Capecitabina (p. 38) — capecitabina **1.000** | DIFERENTE: **dose de capecitabina 1.250 × 1.000** |
| Carboplatina + Paclitaxel (21/21) — paclitaxel 175 + carboplatina **AUC 5** | Carboplatina + Paclitaxel (p. 39) — paclitaxel 175 + carboplatina **AUC 6** | DIFERENTE: **carboplatina AUC 5 × 6** |
| Carboplatina + Gemcitabina | — (o SOnHe tem CDDP 70 + gencitabina 850 D1/D8 e Docetaxel + Gencitabina) | SÓ NA LOCAL |

### Pulmão não pequenas células

| Local | SOnHe (p.) | Resultado |
|---|---|---|
| Cisplatina + Gemcitabina — gencitabina **1.250** D1,D8 + cisplatina **75**, 6 ciclos | CDDP + Gencitabina (p. 270) — gencitabina **1.000** D1/D8 + cisplatina **80**, 4–6 ciclos | DIFERENTE: **gencitabina 1.250 × 1.000; cisplatina 75 × 80**; ciclos 6 × 4–6 |
| Carboplatina + Gemcitabina — AUC 5 + 1.000 D1,D8, 6 ciclos | Carboplatina + Gencitabina (p. 270) | DIFERENTE: n_ciclos 6 × 4–6 |
| Cisplatina + Docetaxel | — | SÓ NA LOCAL |
| Carboplatina + Docetaxel | — | SÓ NA LOCAL |
| Cisplatina + Paclitaxel | — | SÓ NA LOCAL |
| Carboplatina + Paclitaxel — paclitaxel 200 + carboplatina **AUC 5**, 6 ciclos | Carboplatina + Paclitaxel q21d (p. 269) — paclitaxel 200 + carboplatina **AUC 6**; adjuvante 4, paliativo 4–6 | DIFERENTE: **carboplatina AUC 5 × 6**; ciclos |
| Cisplatina + Vinorelbina — vinorelbina 25 D1,D8 + cisplatina **80** D1 q21 × 6 | CDDP + Vinorelbine EV adjuvante (p. 267) — cisplatina **50 D1/D8** + vinorelbina 25 **D1/D8/D15/D22 q28** × 4. CDDP + Vinorelbine VO (p. 267) — cisplatina 80 D1 + vinorelbina **80 mg/m² VO** D1/D8 q21 × 4 | DIFERENTE: **dias e intervalo** (EV) ou **via/dose** (VO); ciclos 6 × 4 |
| Cisplatina + Pemetrexede — cisplatina 75 + pemetrexede 500, 6 ciclos | CDDP + Pemetrexede adjuvante (p. 268) — 75 + 500 × 4. Paliativo — cisplatina **80** + 500 × 4–6 + manutenção | DIFERENTE: **cisplatina 75 × 80 no paliativo**; ciclos; manutenção com pemetrexede |
| Carboplatina + Pemetrexede — AUC 5 + 500, 6 ciclos | Carboplatina + Pemetrexede (p. 269) — 4–6 + manutenção | DIFERENTE: n_ciclos e manutenção |
| Docetaxel (monoterapia) 75 q21 | Docetaxel monoterapia (p. 271) | IGUAL |
| Gemcitabina (monoterapia) | — | SÓ NA LOCAL |

### Pâncreas

| Local | SOnHe (p.) | Resultado |
|---|---|---|
| FOLFIRINOX — irinotecano **150**, oxaliplatina 85, LV 400, 5-FU 1.200 + 1.200 **em 8 h D1–D2**, sem bolus (D-W9-23: 46 h) | Esquema mFOLFIRINOX (p. 149) — irinotecano **180**, oxaliplatina 85, LV 400, 5-FU 2.400 **em bomba de 48 h**, sem bolus | DIFERENTE: **irinotecano 150 × 180; 5-FU 8 h (planilha) / 46 h (D-W9-23) × 48 h** |
| Gemcitabina (monoterapia) 1.000 D1,D8,D15 q28 × 6 | Gencitabina monoterapia (p. 149): adjuvante 6, paliativo até progressão | IGUAL |
| Gemcitabina + Capecitabina — capecitabina **830** mg/m² 12/12 h D1–D21 | Gencitabina + Capecitabina (p. 149) — capecitabina **"1.660 mg/m² VO 12/12h"** D1–D21 | DIFERENTE: **830 × 1.660 mg/m² por tomada**. No ESPAC-4, 1.660 mg/m² é a dose **diária** (830 × 2). O texto do SOnHe parece erro tipográfico. **Validar** |
| (Mayo, só em Cólon/Reto na planilha) | 5FU/LV (Pâncreas, p. 150): 5-FU 425 + LV 20 D1–D5 q28 × 6 | Mesmas doses do Mayo local, mas em outro tumor |

### Cólon/Reto (a planilha junta C18/C20; o SOnHe tem capítulos separados)

| Local | SOnHe (p.) | Resultado |
|---|---|---|
| FOLFOXIRI — irinotecano 165, oxaliplatina 85, **LV 200**, 5-FU 1.200 + 1.200 **em 8 h** (total 2.400) | Esquema FOLFOXIRI (Cólon, p. 103) — 165 / 85 / **LV 400** / 5-FU **3.200 em 48 h** | DIFERENTE: **LV 200 × 400; 5-FU 2.400 × 3.200 mg/m²; 8 h × 48 h** |
| FOLFOX — oxaliplatina 85, LV 400, 5-FU 2.400 em 8 h D1–D2, **sem bolus** | Esquema FOLFOX (Cólon, p. 102; Reto, p. 113) — 85 / 400 / **bolus 400** + 2.400 **em 48 h** | DIFERENTE: **bolus de 5-FU 400 (só no SOnHe); 8 h × 48 h**. Adjuvante 6–12 ciclos (Cólon) ou 8–12 (Reto) |
| FOLFIRI — irinotecano 180, LV 400, 5-FU 2.400 em 8 h, sem bolus | Esquema FOLFIRI (Cólon, p. 103) — 180 / 400 / **bolus 400** + 2.400 **em 48 h** | DIFERENTE: **bolus; 8 h × 48 h** |
| CAPOX (XELOX) — oxaliplatina 130 + capecitabina 1.000 D1–D14, 8 ciclos | Esquema CapOx (Cólon, p. 102: adjuvante 4–8; Reto, p. 113: 6–8) | DIFERENTE: n_ciclos 8 × 4–8 / 6–8 |
| Capecitabina + RxT — 825 mg/m² nos dias de RT | Capecitabina (+ RT) (Reto, p. 112) — 825 mg/m² 12/12 h, 5 dias/semana durante a RT | IGUAL |
| Irinotecano (monoterapia) 350 q21 | — (no Cólon, irinotecano só aparece com cetuximabe, 180 q14) | SÓ NA LOCAL |
| 5-FU + Leucovorina (Mayo) — LV 20 + 5-FU 425 D1–D5 q28 × 6 | — no Cólon/Reto. O Reto tem 5FU/LV (+RT) 350 + 20 D1–D5; Pâncreas e Estômago (MacDonald) usam 425 + 20 | SÓ NA LOCAL (para Cólon/Reto) |
| 5-FU + Leucovorina (Roswell Park) — 500 + 500 semanal × 6, q56, **4 ciclos** | Esquema Roswell-Park (Cólon, p. 101) e 5FU/LV adjuvante (Reto, p. 112) — **3 ciclos** | DIFERENTE: **n_ciclos 4 × 3** |

### Esôfago

| Local | SOnHe (p.) | Resultado |
|---|---|---|
| Carboplatina + Paclitaxel semanal (CROSS + RxT) — AUC 2 + 50, 5 semanas | Esquema CROSS (p. 119) — AUC 2 + 50 semanal durante a RT | IGUAL (o SOnHe não fixa o nº de semanas) |
| FLOT | — no Esôfago. O SOnHe manda seguir o capítulo **Estômago** no adenocarcinoma (ver abaixo) | SÓ NA LOCAL (no capítulo) |
| FOLFOX | — (via capítulo Estômago) | SÓ NA LOCAL (no capítulo) |
| Carboplatina + Paclitaxel (21/21) | — | SÓ NA LOCAL |
| Docetaxel (monoterapia) | — (o SOnHe usa paclitaxel 80 semanal na 2ª linha) | SÓ NA LOCAL |
| 5-FU + Leucovorina (LV5FU2) | — | SÓ NA LOCAL |
| Irinotecano (monoterapia) | — (o SOnHe tem CDDP 30 + irinotecano 65 D1/D8) | SÓ NA LOCAL |

### Estômago/JEG

| Local | SOnHe (p.) | Resultado |
|---|---|---|
| FLOT — docetaxel 50, oxaliplatina 85, LV 200, 5-FU **1.200 + 1.200 em 8 h** | Esquema FLOT (p. 128) — 50 / 85 / 200 / 5-FU **2.600 em bomba de 24 h**; perioperatório 4 + 4 | DIFERENTE: **5-FU 2.400 × 2.600 mg/m²; 8 h D1–D2 (planilha) / 46 h (D-W9-23) × 24 h** |
| FOLFOX — 85 / 400 / 5-FU 2.400 em 8 h, sem bolus | Esquema FOLFOX (p. 131) — 85 / 400 / **bolus 400** + 2.400 **em 46 h** | DIFERENTE: **bolus**. O tempo do SOnHe (**46 h**) bate com D-W9-23, não com as 8 h da planilha |
| FOLFIRI | — (o SOnHe usa irinotecano monoterapia na 2ª linha) | SÓ NA LOCAL |
| XELOX (CAPOX) — 130 + 1.000 D1–D14 × 8 | Esquema CapOx (p. 129): adjuvante 8 | IGUAL |
| DCF modificado (institucional) — docetaxel 40 D1, 5-FU **600 em 6 h D1 e D2**, cisplatina 40 **D2**, q14 | Esquema mDCF (p. 132) — docetaxel 40 D1, cisplatina 40 **D3**, LV 400, 5-FU **bolus 400 + 2.000 em 48 h** | DIFERENTE: **dia da cisplatina D2 × D3; 5-FU 1.200 em 6 h/dia × 2.400 (bolus + 48 h); LV só no SOnHe** |
| Docetaxel (monoterapia) 75 q21 | Docetaxel monoterapia (p. 134) | IGUAL |
| Irinotecano (monoterapia) **350 q21** | Irinotecano monoterapia (p. 134) **180 q14** | DIFERENTE: **dose 350 × 180; intervalo 21 × 14** |

### Cabeça e pescoço

| Local | SOnHe (p.) | Resultado |
|---|---|---|
| Cisplatina + RxT — 100 mg/m² D1, D22, D43 | CDDP q21d (+RT) (p. 297) — 100 q21 × 3 | IGUAL |
| Carboplatina + Paclitaxel | — | SÓ NA LOCAL |
| Carboplatina + Docetaxel | — (o SOnHe tem Docetaxel 75 + Carboplatina AUC 6 + Cetuximabe + G-CSF) | SÓ NA LOCAL |
| Cisplatina + 5-FU (PF) — cisplatina 100 + 5-FU 1.000/dia D1–D4 (24 h/dia) | — (os 5-FU 96 h do SOnHe estão no TPF de indução e em Carboplatina + 5-FU + Pembrolizumabe) | SÓ NA LOCAL |
| Docetaxel (monoterapia) 75 q21 | Docetaxel monoterapia (p. 300) | IGUAL |
| Metotrexato semanal 40 mg/m² | Metotrexato monoterapia (p. 300) 30–60 mg/m² semanal | DIFERENTE: dose fixa 40 × faixa 30–60 (o valor local fica dentro da faixa) |

**Resumo da comparação (60 esquemas da planilha):** 14 IGUAL · 24 DIFERENTE · 22 SÓ NA LOCAL. As fases AC de AC-T e AC-CT contam como um esquema cada.

### SÓ NO SONHE: esquemas com citotóxico nos tumores da planilha

- **Mama (20):** ACdd + G-CSF; TH; TCH; TCHP; THP; Paclitaxel semanal + Carboplatina AUC 6 + HP; CLEOPATRA (docetaxel + HP); Ciclofosfamida oral + HP; Paclitaxel + HP; Gencitabina + Trastuzumabe; CDDP + Gencitabina ± Trastuzumabe; Lapatinibe + Capecitabina; Atezolizumabe + nab-Paclitaxel; Docetaxel + Gencitabina; Paclitaxel + Bevacizumabe; Carboplatina mono; Eribulina; DoxoPEG; Vinorelbina VO 60 mg/m².
- **Próstata (4):** Cabazitaxel + prednisona + filgrastim; Carboplatina + Docetaxel; Cisplatina + Etoposídeo; Carboplatina + Cabazitaxel.
- **Pulmão CPNPC (18):** CDDP + Etoposídeo (adjuvante/paliativo e +RT); Carboplatina + Paclitaxel semanal (+RT); Carboplatina + Paclitaxel + Bevacizumabe; Docetaxel + Nintedanibe; Docetaxel + Ramucirumabe; 5 combinações QT + atezolizumabe/pembrolizumabe; 4 perioperatórios com pembrolizumabe/nivolumabe; Durvalumabe + Tremelimumabe + QT; CM-9LA; Amivantamabe + Carboplatina + Pemetrexede.
- **Pâncreas (2):** Gencitabina + nab-Paclitaxel; FOLFOX (46 h).
- **Cólon/Reto (10 + PROSPECT):** Capecitabina mono; deGramont (48 h); Cetuximabe + Irinotecano; CapOx + Bevacizumabe; AVEX; 5FU/LV + Panitumumabe; Trifluridina/Tipiracila ± Bevacizumabe; 5FU/LV (+RT) 350/20; Capecitabina adjuvante (Reto); TNT; PROSPECT.
- **Esôfago (4):** CDDP + 5FU (96 h) ± Pembrolizumabe; CDDP + Irinotecano; Paclitaxel semanal.
- **Estômago (8):** MacDonald (QT + RT); CapOx + Nivolumabe (o título no manual repete "Esquema CapOx", p. 130); FOLFOX + Nivolumabe; XP; 5FU/CDDP (96 h); FOLFOX + Trastuzumabe + Pembrolizumabe; Ramucirumabe + Paclitaxel; Paclitaxel semanal.
- **Cabeça e pescoço (7):** CDDP semanal 40 (+RT); Carboplatina semanal AUC 1,5 (+RT); TPF de indução (5-FU 96 h + G-CSF); Carboplatina + 5-FU + Pembrolizumabe; TP + Cetuximabe; TP; Docetaxel + Carboplatina + Cetuximabe.
- **Tumores sem nenhum esquema na planilha** (todos SÓ NO SONHE): ginecológicos (colo, endométrio, ovário, vagina, vulva), canal anal, vias biliares, CHC, bexiga, rim, pênis, testículo, pele, melanoma, CPPC, nasofaringe, sarcomas, GIST, tireoide, TNE, gliomas e sítio primário oculto.

## 6. Achados para validar (erros ou inconsistências do próprio manual)

1. **Endométrio, p. 64:** "Ifosfamida 1.200 **g/m²**" (provável mg/m²); "Topotecano **1.200 mg/m2** D1–D5" (provável 1,2 mg/m²; o capítulo de colo usa 1,5 mg/m²); "Gencitabina **800 mg**" sem /m².
2. **Pâncreas, p. 149:** capecitabina "1.660 mg/m² VO 12/12h" (ver a seção 5).
3. **5-FU contínuo:** 46 h e 48 h convivem no manual para a mesma dose de 2.400 mg/m² (seção 4). O FLOT usa 2.600 mg/m² em 24 h.
4. **Títulos repetidos:** "Esquema CapOx" (Estômago, p. 129 e p. 130, o segundo com nivolumabe) e "Trifluridina/Tipiracila" (Cólon, p. 106, o segundo com bevacizumabe). O CSV mantém o nome do manual e explica em `observacoes`.
5. **Grafias:** "Duravlumabe" (p. 275), "Timetropima" (p. 370), "Gecncitabina" (p. 164), "Ondansentrona/Palonosentrona" (p. 401–403).
6. **Amivantamabe 2ª linha (p. 279):** "Mais que 80 kg: 2.400 mg EV D1" na fase a cada 3 semanas, contra 1.400 mg na fase semanal. Valor registrado como impresso. Validar.

## 7. Limites

- A conversão é por script com revisão manual dos casos irregulares. Os valores numéricos foram conferidos por amostragem, não linha a linha. **Toda linha é `NAO_VERIFICADO`** até a conferência humana contra o PDF (a coluna `pagina` aponta a página).
- O CSV não traz pré-medicação "padrão" inferida da Tabela 2. `pre_medicacao` só tem o que está escrito dentro do esquema (Akynzeo).
- O manual é da saúde suplementar: várias opções (IO, ADC, alvo) estão fora do rol SUS/APAC e não servem como referência de disponibilidade.
