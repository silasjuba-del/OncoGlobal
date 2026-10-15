# W10-INT-FICHAS · fichas de protocolo (RASCUNHO)

Executor: Claude Sonnet 5.5 (equipe interna). Worktree `w10-int-fichas`, branch `f0/w10-int-fichas`. Sem push.
Faixa: `corpus/fichas/**`, `tests/corpus-fichas/**`, este relatório.

## Fatias
| Fatia | Conteúdo | Estado |
|---|---|---|
| 01 | Próstata (4) | FEITA |
| 02 | Mama (14) | FEITA |
| 03 | Pulmão CPNPC (11) | FEITA |
| 04 | Pâncreas (3) | FEITA |
| 05 | Cólon/Reto (7) + Reto (1) | FEITA |
| 06 | Esôfago (7) | FEITA |
| 07 | Estômago/JEG (7) | FEITA |
| 08 | Cabeça e pescoço (6) | FEITA |
| 09 | P1477 (ficha real fora da planilha) (1) | FEITA |
| 10 | Testes (23) + gerador `tests/corpus-fichas/gerar-fichas.mjs` | FEITA |
| 11 | Este relatório | FEITA |

Total: **61 fichas** (60 da planilha + P1477). Todas `status: "RASCUNHO"`, `limiaresBula: null` (nenhuma fonte de bula no repositório), `versao: "1.0.0"`.
Hash = SHA-256 do JSON canônico (chaves ordenadas) **sem `hash` e sem `status`** (promover a CONFERIDA_MEDICO não muda o conteúdo). Regerar: `node tests/corpus-fichas/gerar-fichas.mjs`.
Dias: `d1`, `d8`…; intervalos como `d1-d14`; RxT como texto `dias de RxT (5 dias por semana)`.

## Decisões de interpretação (para o Dr. Silas conferir)
- **Bolus de 5-FU**: removido de todo esquema de bomba (FOLFOX/FOLFIRI/FOLFIRINOX/FOLFOXIRI/FLOT/LV5FU2: 1 item, "46 h", d1). **Mayo, Roswell Park e CMF** mantêm o bolus porque ele é o desenho do esquema (Mayo mantido por D-W9-23b). O teste lista essas três exceções explicitamente.
- **5-FU fora de bomba de 46 h** (declarados no teste): DCF modificado institucional (6 h/dia, mantido da planilha revisada, divergência com o mDCF do SOnHe registrada, não aplicada) e PF de cabeça e pescoço (24 h/dia em d1-d4).
- **FLOT**: dose do 5-FU = null (planilha 2.400 total em 8 h × SOnHe 2.600 em 24 h "validar"); infusão 46 h.
- **FOLFOXIRI**: 5-FU 3.200 e folinato 400 (SOnHe vence); total do ciclo mudou de 2.400 para 3.200, sinalizado.
- **Pré-medicação**: ondansetrona 8 + dexametasona 10 (doses da planilha; fichas reais usam 16/20 em alguns) + prometazina 25 mg VO em toda ficha EV (substitui a difenidramina da planilha); cimetidina 300 mg em todo taxano; sem NK1; olanzapina 5 mg só em observação no alto risco (cisplatina ≥50 e AC).
- **Cisplatina**: SF 500 + sulfato de Mg 10% 10 mL + KCl 19,1% 4 mL antes e SF 500 + KCl depois, em cada dia de cisplatina (D1 e D8 na P1477); manitol em Y. D-W9-34d fala em Mg/K "pré e pós"; as fichas reais só têm KCl no pós, então não pus Mg no pós (sinalizado).
- **Cenário**: a planilha não traz cenário. Usei o do SOnHe quando o esquema casa; ciclos em aberto + SOnHe com variante paliativa = "paliativo/metastático"; sem casamento = "não especificado". Revisar.
- **Códigos**: P1603 (AT; planilha doxo 50 × real 60, mantido 50), P1393 (AC-T fase T), P1426 (cisplatina + docetaxel), P1456 (carboplatina + docetaxel, em pulmão e em cabeça e pescoço), P1477 (cisplatina + gemcitabina D1/D8: sem equivalente na planilha; criada ficha extra com tumor "Não informado" e doses null).
- Erros do manual SOnHe **não entraram**: gem+cape 1.660 12/12 h (ficha usa 830), ifosfamida, topotecano, amivantamabe (nenhum esquema deles na planilha).
- **docetaxel sem dexametasona VO de 3 dias** (D-W9-22i): não inventei; sinalizado em observacao.

## Tabela de fichas
| # | Tumor | Nome | Cenário | Cód. | Divergências planilha × SOnHe / outras | Campos null |
|---|---|---|---|---|---|---|
| 1 | Próstata | Docetaxel quinzenal | paliativo/metastático | — | Docetaxel: planilha D1 e D15 em ciclo de 28 d; SOnHe D1 a cada 14 d (vale SOnHe). Prednisona: planilha contínuo; SOnHe D1-D14 12/12 h (vale SOnHe). | ciclos |
| 2 | Próstata | Docetaxel 21/21 dias | paliativo/metastático | — | Prednisona: planilha contínuo; SOnHe D1-D21 12/12 h (vale SOnHe). Ciclos: SOnHe até 6 (sensível à castração) ou até progressão (resistente): null. | ciclos |
| 3 | Próstata | Carboplatina + Paclitaxel semanal | não especificado | — | — | ciclos |
| 4 | Próstata | Carboplatina + Paclitaxel 21/21 dias | não especificado | — | — | ciclos |
| 5 | Mama | AC-T (fase AC) | neo/adjuvante | — | — | — |
| 6 | Mama | AC-T (fase T — paclitaxel semanal) | adjuvante | P1393 | Ficha real P1393 tem Dose Prot 0 (sem base mg/m²): vale a dose planilha/SOnHe 80 mg/m². | — |
| 7 | Mama | AC-CT (fase AC) | neo/adjuvante | — | — | — |
| 8 | Mama | AC-CT (fase CT — carboplatina + paclitaxel semanal) | neo/adjuvante | — | — | — |
| 9 | Mama | TC | neo/adjuvante | — | Ciclos: planilha 4; SOnHe 4 a 6 (mantido 4 da planilha). | — |
| 10 | Mama | CMF | não especificado | — | — | — |
| 11 | Mama | Doxorrubicina + Paclitaxel (AT) | não especificado | P1603 | Doxorrubicina: planilha 50 mg/m²; ficha real P1603 60 mg/m² (mantida a planilha; conferir). | — |
| 12 | Mama | Docetaxel monoterapia | paliativo/metastático | — | — | ciclos |
| 13 | Mama | Paclitaxel monoterapia 21/21 dias | não especificado | — | — | ciclos |
| 14 | Mama | Gemcitabina | paliativo/metastático | — | — | ciclos |
| 15 | Mama | Capecitabina monoterapia | paliativo/metastático | — | Capecitabina: planilha 1.250 mg/m²; SOnHe paliativo 1.000 (vale SOnHe; 1.250 é o adjuvante do SOnHe). | ciclos |
| 16 | Mama | Capecitabina + Docetaxel (XT) | paliativo/metastático | — | Capecitabina: planilha 1.250 mg/m²; SOnHe 1.000 (vale SOnHe). | ciclos |
| 17 | Mama | Carboplatina + Paclitaxel 21/21 dias | paliativo/metastático | — | Carboplatina: planilha AUC 5; SOnHe AUC 6 (vale SOnHe). | ciclos |
| 18 | Mama | Carboplatina + Gemcitabina | não especificado | — | — | ciclos |
| 19 | Pulmão (CPNPC) | Cisplatina + Gemcitabina | não especificado | — | Gemcitabina: planilha 1.250 mg/m²; SOnHe 1.000 (vale SOnHe). Cisplatina: planilha 75 mg/m²; SOnHe 80 (vale SOnHe). Ciclos: planilha 6; SOnHe 4 a 6 (mantido 6). | — |
| 20 | Pulmão (CPNPC) | Carboplatina + Gemcitabina | não especificado | — | — | — |
| 21 | Pulmão (CPNPC) | Cisplatina + Docetaxel | não especificado | P1426 | — | — |
| 22 | Pulmão (CPNPC) | Carboplatina + Docetaxel | não especificado | P1456 | — | — |
| 23 | Pulmão (CPNPC) | Cisplatina + Paclitaxel | não especificado | — | — | — |
| 24 | Pulmão (CPNPC) | Carboplatina + Paclitaxel 21/21 dias | paliativo/metastático | — | Carboplatina: planilha AUC 5; SOnHe AUC 6 (vale SOnHe). | — |
| 25 | Pulmão (CPNPC) | Cisplatina + Vinorelbina | não especificado | — | SOnHe só traz vinorelbina VO 80 mg/m² D1/D8 q21 ou EV 25 mg/m² D1,D8,D15,D22 com cisplatina 50 D1/D8 q28: nenhum casa com a planilha; mantida a planilha. | — |
| 26 | Pulmão (CPNPC) | Cisplatina + Pemetrexede (não escamoso) | paliativo/metastático | — | Cisplatina: planilha 75 mg/m²; SOnHe paliativo 80 (vale SOnHe; 75 é o adjuvante). | — |
| 27 | Pulmão (CPNPC) | Carboplatina + Pemetrexede (não escamoso) | paliativo/metastático | — | — | — |
| 28 | Pulmão (CPNPC) | Docetaxel monoterapia | paliativo/metastático | — | — | ciclos |
| 29 | Pulmão (CPNPC) | Gemcitabina monoterapia | não especificado | — | — | ciclos |
| 30 | Pâncreas | FOLFIRINOX | paliativo/metastático | — | Irinotecano: planilha 150 mg/m²; SOnHe 180 (vale SOnHe). 5-FU: planilha 1.200 mg/m² D1+D2 em 8 h sem bomba; ficha 2.400 mg/m² em bomba de 46 h sem bolus (D-W9-23a; SOnHe 2.400/48 h). Pré-medicação/lavagem: planilha D1,D2; ficha d1 (a bomba liga em d1 e desconecta em d3). | ciclos |
| 31 | Pâncreas | Gemcitabina monoterapia | adjuvante | — | — | — |
| 32 | Pâncreas | Gemcitabina + Capecitabina | não especificado | — | Capecitabina: planilha 830 mg/m² 12/12 h; o SOnHe grafa 1.660 mg/m² 12/12 h = erro do manual (1.660 é a dose diária): NÃO entra (D-W9-50). | — |
| 33 | Cólon/Reto | FOLFOXIRI | paliativo/metastático | — | Folinato: planilha 200 mg/m² (TRIBE); SOnHe 400 (vale SOnHe). 5-FU: planilha 2.400 mg/m² total (8 h, D1+D2); SOnHe 3.200 mg/m² em bomba (vale SOnHe); infusão 46 h sem bolus (D-W9-23a). Pré-medicação/lavagem: planilha D1,D2; ficha d1. | ciclos |
| 34 | Cólon/Reto | FOLFOX | paliativo/metastático | — | 5-FU: planilha 8 h D1+D2 sem bomba; ficha 2.400 mg/m² em 46 h sem bolus (o bolus 400 do SOnHe NÃO entra). | ciclos |
| 35 | Cólon/Reto | FOLFIRI | paliativo/metastático | — | 5-FU: planilha 8 h D1+D2 sem bomba; ficha 2.400 mg/m² em 46 h sem bolus (o SOnHe cita bolus apenas no FOLFOX/de Gramont). | ciclos |
| 36 | Cólon/Reto | CAPOX (XELOX) | adjuvante | — | — | — |
| 37 | Cólon/Reto | Irinotecano monoterapia | não especificado | — | — | ciclos |
| 38 | Cólon/Reto | 5-FU + Leucovorina (Mayo Clinic) | não especificado | — | Mayo mantido (D-W9-23b): o bolus de 5-FU é o desenho do esquema; o 5FU/LV D1-D5 425/20 do SOnHe coincide. | — |
| 39 | Cólon/Reto | 5-FU + Leucovorina (Roswell Park) | não especificado | — | Ciclos: planilha 4; SOnHe 3 (vale SOnHe). | — |
| 40 | Reto | Capecitabina + RxT (radiossensibilização) | concomitante à RT | — | — | ciclos |
| 41 | Esôfago | FLOT | não especificado | — | 5-FU: planilha 2.400 total em 8 h; SOnHe 2.600 em 24 h (manual pede validar); decisão local 46 h sem bolus. Dose do 5-FU null (ambígua). | ciclos; dose Fluoruracila (5-FU) infusão contínua |
| 42 | Esôfago | Carboplatina + Paclitaxel semanal (CROSS + RxT) | concomitante à RT | — | — | — |
| 43 | Esôfago | FOLFOX | não especificado | — | 5-FU: planilha 8 h D1+D2 sem bomba; ficha 2.400 mg/m² em 46 h sem bolus. | ciclos |
| 44 | Esôfago | Carboplatina + Paclitaxel 21/21 dias | não especificado | — | — | ciclos |
| 45 | Esôfago | Docetaxel monoterapia | não especificado | — | — | ciclos |
| 46 | Esôfago | 5-FU + Leucovorina (LV5FU2) | não especificado | — | 5-FU: planilha 8 h D1+D2; ficha 2.400 mg/m² em 46 h sem bolus (o de Gramont do SOnHe traz bolus 400, que NÃO entra). | ciclos |
| 47 | Esôfago | Irinotecano monoterapia | não especificado | — | — | ciclos |
| 48 | Estômago/JEG | FLOT | paliativo/metastático | — | 5-FU: planilha 2.400 total em 8 h; SOnHe 2.600 em 24 h (manual pede validar); decisão local 46 h sem bolus. Dose do 5-FU null (ambígua). | ciclos; dose Fluoruracila (5-FU) infusão contínua |
| 49 | Estômago/JEG | FOLFOX | paliativo/metastático | — | 5-FU: planilha 8 h D1+D2 sem bomba; ficha 2.400 mg/m² em 46 h sem bolus (o bolus 400 do SOnHe NÃO entra). | ciclos |
| 50 | Estômago/JEG | FOLFIRI | não especificado | — | 5-FU: planilha 8 h D1+D2 sem bomba; ficha 2.400 mg/m² em 46 h sem bolus. | ciclos |
| 51 | Estômago/JEG | XELOX (CAPOX) | adjuvante | — | — | — |
| 52 | Estômago/JEG | DCF modificado (institucional) | não especificado | — | MANTIDA a planilha (revisão institucional do Dr. Silas, LEIA-ME): docetaxel 40 D1, 5-FU 600 mg/m² 6 h/dia D1-D2, cisplatina 40 D2. SOnHe mDCF: cisplatina D3, folinato 400, 5-FU 2.000 mg/m² em 48 h (bolus 400 NÃO entra). Divergência registrada e não aplicada: o Dr. Silas decide. | ciclos |
| 53 | Estômago/JEG | Docetaxel monoterapia | paliativo/metastático | — | — | ciclos |
| 54 | Estômago/JEG | Irinotecano monoterapia | paliativo/metastático | — | Irinotecano: planilha 350 mg/m² q21; SOnHe 180 mg/m² q14 (vale SOnHe: dose e intervalo). | ciclos |
| 55 | Cabeça e pescoço | Cisplatina + RxT | concomitante à RT | — | — | — |
| 56 | Cabeça e pescoço | Carboplatina + Paclitaxel | não especificado | — | — | ciclos |
| 57 | Cabeça e pescoço | Carboplatina + Docetaxel | não especificado | P1456 | — | ciclos |
| 58 | Cabeça e pescoço | Cisplatina + 5-Fluorouracil (PF) | não especificado | — | — | ciclos |
| 59 | Cabeça e pescoço | Docetaxel monoterapia | paliativo/metastático | — | — | ciclos |
| 60 | Cabeça e pescoço | Metotrexato semanal | paliativo/metastático | — | — | ciclos |
| 61 | Não informado (ficha institucional) | Cisplatina + Gemcitabina (D1 e D8) | não especificado | P1477 | Fora da planilha: cisplatina em D1 e D8; doses ausentes na ficha real (Dose Prot 0): null (PENDENTE da base de cálculo). | ciclos; dose Gemcitabina; dose Cisplatina |

Campos null comuns a todas: `limiaresBula` (sem fonte), `calculatedDose`/`prescribedDose` (preenchidos só na prescrição, FN-04), `diluent`/`finalVolumeMl` onde a planilha não informa (preenchidos só nas fichas reais P1393, P1426, P1456, P1477, P1603), `ciclos` quando "até progressão" ou ausente.

## PEDIDOS
Nenhum (nada fora da faixa foi necessário; `validate-corpus` aceitou as fichas, que não têm `header`).

## Saídas reais (último ciclo)
```
$ npx tsc --noEmit
tsc exit=0

$ npm run check:corpus  (final)
corpus/templates/resumo-14.v1.json                                                                    | —          | 15          | 0     
corpus/templates/sinais-alarme.v1.json                                                                | —          | 1           | 0     

corpus ok (91 arquivos)

$ npx vitest run tests/corpus-fichas --no-file-parallelism
RUN  v5.0.3 C:/Users/silas/Projects/OncoGlobal-wt/w10-int-fichas
 Test Files  1 passed (1)
      Tests  23 passed (23)
   Start at  01:50:24
   Duration  7.72s (import 71%, transform 15%, tests 14%, worker 1%)
```

## INT-FICHAS-12 · esquemas novos (D-W9-61)
11 fichas RASCUNHO acrescentadas ao gerador (total 71): GEMOX (SOnHe GemOx p. 227: gem 1.000 D1/D8, oxali 130 D1); Carboplatina + Paclitaxel semanal de cabeça e pescoço (pacli 80, AUC 2; análogo SOnHe colo p. 51/mama p. 21); Ifosfamida + Mesna (colo p. 54: 1.200 mg/m² D1-D5, mesna 600 em 0 e 4 h); Ifosfamida + Gemcitabina e Ifosfamida + Topotecana (sem fonte: doses null); AC-TH fase AC (SOnHe p. 20, 60/600) e fase TH (SOnHe TH p. 21; trastuzumabe ataque 8 depois 6 mg/kg; SBOC 2026); FOLFIRI + Bevacizumabe (bev 5 mg/kg, SOnHe p. 104; 5-FU 46 h sem bolus); Temozolomida (gliomas p. 369, 200 mg/m² D1-D5 q28); Cisplatina semanal 40 + RxT (colo p. 51).
Null: mesna 8 h em todas as fichas com ifosfamida; ifosfamida, gemcitabina, topotecana e mesna 0/4 h nas duas combinações; infusão do trastuzumabe e bevacizumabe; ciclos em vários. Mayo 425 e carbo+pacli semanal AUC 2 inalterados. Regenerar também atualizou FLOT/AT (D-W9-59 vindos do merge).
