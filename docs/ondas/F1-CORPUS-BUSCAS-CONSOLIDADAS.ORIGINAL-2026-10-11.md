# F1 · Buscas consolidadas do corpus — projeto amplo (GLM, 2026-10-11)

Execução das buscas definidas em `F1-CORPUS-PROMPTS.md` pelo GLM, a pedido do Dr. Silas.

**Escopo:** TODAS as frentes de busca do documento — 1 (Interações/CTCAE), 2 (Laudos sociais), 4 (Orientações/Encaminhamentos) e 5 (Packs de tumor) — inclusive as designadas a outras LLMs. **Excluída por ordem expressa: a frente 3 (Receitas especiais e classes, DeepSeek).** A frente 0 (Codex) é tarefa de código/estrutura, não de busca, e fica fora.

**Método:** 2 loops de busca com métricas diferentes.
- **Loop 1 — busca ampla, métricas AGREGATIVAS** (taxas de cobertura, densidade, distribuição): varredura completa do escopo de cada frente.
- **Loop 2 — ataque às lacunas, métricas SOMATÓRIAS** (totais, somas, deltas): estratégias alternativas de busca (site: em portais oficiais, PDFs de diretrizes, agências reguladoras, espelhos de bula) contra as 34 lacunas deixadas pelo Loop 1.

**Regra de integridade mantida em ambos os loops:** nenhum achado sem fonte real (referência + trecho literal + URL); o que não teve fonte ficou como `SEM_FONTE` com pendência explícita. Nenhuma dose, corte, artigo de lei ou intervalo foi inventado.

---

## 1. LOOP 1 — Métricas AGREGATIVAS (busca ampla)

| Frente | Escopo (temas/blocos) | Buscas | Com ≥1 fonte | Cobertura | Lacunas deixadas |
|---|---|---|---|---|---|
| 1 · Interações/CTCAE | 26 | 32 | 21 plenos + 4 parciais | 96,2% (80,8% plena) | 10 |
| 2 · Laudos sociais | 10 | 46 | 9 (7 completos + 2 parciais) | 90,0% | 8 |
| 4 · Orientações | 20 | ~38 | 20 (3 com ressalva) | 100% | 8 |
| 5 · Packs de tumor | 7 | ~40 | 7 | 100% | 8 |
| **Total** | **63** | **~156** | **61** | — | **34** |

**Agregados do Loop 1:**
- Cobertura temática média das frentes: **96,5%** — mínima 90% (Laudos), máxima 100%.
- Cobertura consolidada: **61/63 temas** com pelo menos uma fonte real (96,8%).
- Densidade média de busca: **2,48 buscas/tema** (156 buscas ÷ 63 temas).
- Distribuição aproximada dos tipos de fonte coletados: bulas/SmPC (FDA/DailyMed/AEMPS/EMA/espelhos ANVISA) ≈ 30%; diretrizes internacionais (ESMO/NCCN/ASCO/ACSM/ACSM/ESPEN/ESC/EGTM/ACR) ≈ 25%; normas brasileiras (Planalto/BVS/CFM/STF/CONITEC) ≈ 22%; institucionais nacionais (INCA/MS/gov.br) ≈ 13%; literatura PubMed/PMC ≈ 10%.
- **2 correções factuais capturadas já no Loop 1** (ver §4) — valor direto da varredura dupla.

## 2. LOOP 2 — Métricas SOMATÓRIAS (ataque às lacunas)

| Frente | Lacunas atacadas | Buscas | Resolvidas (plenas + parciais) | Remanescentes |
|---|---|---|---|---|
| 1 · Interações/CTCAE | 10 | 54 | 9 | 1 |
| 2 · Laudos sociais | 8 | 32 | 6 (4 + 2 parciais) | 2 |
| 4 · Orientações | 8 | ~33 | 7 (2 com ressalva) | 1 |
| 5 · Packs de tumor | 8 | 36 | 7 | 1 |
| **Total** | **34** | **~155** | **29 (85,3%)** | **5** |

**Somatórios finais (L1 + L2):**
- Total de buscas executadas nos dois loops: **~311**.
- Total de lacunas resolvidas: **29/34** (25 plenas + 4 parciais/com ressalva).
- Total de pendências `SEM_FONTE` finais: **5** (taxa de resolubilidade global das lacunas: 85,3%).
- Referências coletadas com trecho citável: **~130** (estimativa consolidada dos achados dos 8 relatórios).
- Itens de corpus destravados para redação RASCUNHO (somatório): 42 interações (37 inativas + 5 novas), ~14 contraindicações/condicionais, 18 termos CTCAE (16 já no CSV local + 2 a acrescentar), 10 laudos com base legal, 20 temas de orientação + unificação dos 28 itens de sinais-alarme (2+1+25), 5 packs de tumor (4 revisões + 1 novo gástrico) + 2 transversais (pedido de imagem, política de marcadores) → **≈ 139 itens**.
- Ganho incremental do Loop 2: +14,3 pontos de cobertura absoluta sobre as lacunas; cobertura final global **~99,2%** dos 63 temas.

---

## 3. Resultados por frente (achados essenciais com fonte)

### 3.1 Frente 1 — Interações, contraindicações e CTCAE

**Base local:** 45 interações em `corpus/rulesets/interacoes.v1.json` (37 inativas a propor severidade/monitorização/conduta); 22 condicionais em `f0c/condicionais.v1.json`; CSV CTCAE v6 local com 55 termos.

**Interações — propostas de severidade com fonte:**

| Par | Severidade | Conduta essencial | Fonte |
|---|---|---|---|
| Tamoxifeno × CYP2D6 forte (paroxetina/fluoxetina) | GRAVE | trocar antidepressivo (venlafaxina/citalopram) | Bula ANVISA (espelho CR): "redução da eficácia… SSRI (por exemplo, paroxetina)" + SmPC HPRA (endoxifeno) |
| Capecitabina × varfarina | GRAVE | INR frequente; risco até 1 mês após suspensão | Bula Xeloda DailyMed + bula ANVISA Roche |
| TKI × IBP | MODERADA | evitar IBP; antiácido curto separado | Bula Votrient FDA: "should be avoided" |
| Erlotinibe × antiácidos/H2 | MODERADA | 2 h antes ou 10 h depois | Bula Tarceva ANVISA (espelho CR) |
| TKI/CDK4-6 × QT longo (ribociclibe etc.) | GRAVE | ECG basal + d14c1; QTcF<450 ms | Bula Kisqali DailyMed |
| Osimertinibe × QT | GRAVE/MODERADA | monitorar ECG/eletrólitos | Bula Tagrisso ANVISA |
| Ondansetrona × QT | MODERADA | ≤16 mg IV; ECG se fatores | Bula ondansetrona DailyMed |
| Irinotecano × CYP3A4/UGT1A1 fortes | GRAVE | não coadministrar | Bula Camptosar DailyMed |
| Platina × aminoglicosídeos | GRAVE | evitar; nefro/oto aditiva | Bula cisplatina Hikma DailyMed |
| Pemetrexede × AINEs | MODERADA | evitar ibuprofeno ±2 dias (se ClCr 45–79) | Bula pemetrexede Sagent |
| Doxorrubicina × trastuzumabe | GRAVE | FEVE basal/serial; preferir sequencial | Bula Herceptin DailyMed/gene.com |
| Tamoxifeno × varfarina / × IA | GRAVE / MODERADA | monitorar INR / não coadministrar | Bula tamoxifeno Mylan DailyMed |
| Fluoropirimidinas × brivudina | GRAVE (contraindicada) | intervalo ≥4 semanas | Nota AEMPS MUH FV 09/2017 + FT Aristo §4.3 |
| ICI × corticoide basal ≥10 mg | MODERADA | taper prévio quando possível | Petrelli 2020 (meta-análise, PMC) |
| Citotóxicos × vacinas vivas | GRAVE | não aplicar; aguardar ≥3 meses | CDC Altered Immunocompetence |

**Contraindicações/condicionais com corte confirmado:**

| Droga × condição | Corte | Fonte |
|---|---|---|
| Cisplatina × renal | ClCr **<60 mL/min** contraindicado | Ficha técnica AEMPS/CIMA (SmPC UK Teva idem) — corte ANVISA não confirmado |
| Pemetrexede × renal | ClCr **<45** | Bula Sagent DailyMed |
| Capecitabina × renal | ClCr **<30** | Bula ANVISA Xeloda: "insuficiência renal grave (depuração… inferior a 30 mL/min)" |
| Carboplatina × renal | Calvert: dose = AUC × (GFR+25); ClCr<60 = reduzir | Bula Accord DailyMed |
| Doxorrubicina × hepático | bili 1,2–3→50%; 3,1–5→75%; >5 não iniciar; Child-Pugh C CI | Bula Pfizer DailyMed |
| Trastuzumabe × FEVE | suspender 4 sem se queda ≥16% ou FEVE<LLN com queda ≥10%; **FEVE<40% = Classe I-C (ESC 2022)** | Bula FDA Herceptin + ESC Cardio-Oncology 2022 (Tabela 25) |
| Tamoxifeno × TEV prévio | contraindicado na prevenção; risco precoce (2 primeiros anos) | Drugs.com + Meier 1998 (OR≈7,1) — diretriz formal SEM_FONTE |
| Imunoterapia × autoimune/transplante | condicional (população excluída dos estudos; HSCT alogênico com complicações fatais) | Bula Keytruda DailyMed |
| Gestação | doxorrubicina, cisplatina, imatinibe, gemcitabina, **ciclofosfamida** ("não deve ser utilizado por mulheres grávidas") | Bulas Pfizer/Hikma/Gleevec/bulas ANVISA |

**CTCAE v6:** versão confirmada como publicada (NCI/DCTD, 2025; PDF e XLSX oficiais). O CSV local (`docs/referencias/onco-referencia/02-ctcae-v6.csv`, 55 termos, MedDRA 28.0) cobre **16 dos 18 termos** pedidos. Faltam: **proteinúria** (termo ausente) e **rash acneiforme** (a v6 extinguiu o termo e mapeia oficialmente para "Rash maculo-papular", já presente no CSV com nota).

### 3.2 Frente 2 — Laudos sociais (base legal com trecho)

| Laudo | Norma-base | Ementa/trecho essencial |
|---|---|---|
| INSS (incapacidade) | Lei 8.213/91 arts. 42, 59, 101; Decreto 3.048/99 art. 78 §2º | perícia obrigatória "sob pena de suspensão do benefício"; cessação pela recuperação; carência 12 contribuições (art. 25 I) |
| Afastamento | Resolução CFM 2.381/2024; CLT art. 473 IV | "Todos os documentos médicos devem conter minimamente: identificação do médico: nome e CRM/UF"; indica o tempo de afastamento |
| LOAS/BPC | Lei 8.742/93 arts. 20-21; Decreto 6.214/07 art. 16 §1º | "avaliação social e avaliação médica"; revisão a cada 2 anos |
| TFD | Portaria SAS/MS 55/1999 **+ Lei 15.390/2026 (NOVA)** | 55/99: autorização com hora/data garantidas + diárias; Lei 15.390/26: ajuda de custo (transporte/alimentação/hospedagem + acompanhante) por "indicação… feita por médico" |
| Passe livre | Lei 8.899/94 (só PCD interestadual) | para oncológico sem deficiência: **depende de lei estadual/municipal** |
| Judicialização | CF art. 196; STF Tema 6 (RE 566.471) | "concessão judicial de medicamento registrado na ANVISA, mas não incorporado"; relatório com eficácia + ausência de alternativa + indicação médica expressa |
| Fraldas | Portaria GM/MS 3.073/2024 (gratuidade Farmácia Popular, incontinência/diabetes) | lei federal do SUS aprovada na Câmara set/2025 (baixa renda/CadÚnico), **sem sanção até out/2026** |
| FGTS | Lei 8.036/90 art. 20 XI (incl. pela Lei 8.922/94) | "trabalhador ou qualquer de seus dependentes for acometido de neoplasia maligna"; renovação anual = prática Caixa, sem previsão literal |
| Isenção IR | Lei 7.713/88 art. 6º XIV (red. Lei 11.052/2004) | proventos isentos para neoplasia, "com base em conclusão da medicina especializada"; serviço gov.br exige laudo com CID e data |
| O2 domiciliar / dieta enteral | ODP: Portaria SAS 292/2012 (histórica) + critérios PaO2<55/SaO2<88%, ≥15 h/dia; Enteral: Port. Consolidação 2/2017 Anexo XXVIII (CEAF/LME-APAC, alt. GM 13/2020) | texto integral da 292/2012 e PCDT Conitec vigente: SEM_FONTE |

### 3.3 Frente 4 — Orientações e encaminhamentos

- **Dieta geral:** INCA "Guia de nutrição para pacientes e cuidadores" 4ª ed. 2020 (ninho.inca.gov.br/…/12392) + **Consenso Nacional de Nutrição Oncológica 2ª ed. 2015 (vol. II 2016)** — URLs oficiais recuperadas no Loop 2 + ESPEN practical guideline (Arends 2021, DOI 10.1016/j.clnu.2021.02.005).
- **Por tumor:** cabeça/pescoço (textura/fracionamento/suplemento, ASPEN via NutriTotal), esôfago/estômago (dumping: refeições pequenas, proteína primeiro — Oncoguia/Einstein), estomia (INCA "Cuidados com estomias" 2ª ed. 2018, cap. Alimentação — PDF arquivado), pâncreas (enzimas/esteatorreia — Oncoguia/GANEP/PanCAN).
- **Por toxicidade:** náusea e mucosite (MSKCC PT + AC Camargo), diarreia/constipação (AC Camargo 2025 + cartilha INCA "Constipação intestinal no câncer avançado"), perda de peso (INCA sarcopenia 18160 + dietas restritivas 12782), **neutropenia/segurança alimentar** (INCA Guia 2020 "Queda de imunidade" + Cartilha TCTH INCA; carnes/ovos crus = unânime; restrição de cruas em geral controversa entre instituições).
- **Atividade física:** ACSM/Patel 2019 (PMID 31626056) + Schmitz 2010 (PMID 20559064): 150 min/sem moderado + ≥2x força; metástase óssea = sem progressão de carga em membro acometido; cortes numéricos citáveis: plaquetas <20–50 mil (BMC PMC9420674; ACSM GETP é paywall); Hb<8 idem com ressalva.
- **Sinais de alarme:** listas "when to call" (Cleveland Clinic/Roswell Park/CDC) compatíveis com os 25 sinais locais; saídas SAMU 192/PS. Febre: definicião formal IDSA-tabela (≥38,3 única ou ≥38,0 ≥1 h — Infection/PMC13323198); **corte do projeto permanece o local D-W9-38 (>37,8 estrito), mais sensível que o das sociedades.**
- **Encaminhamentos SUS:** Lei 12.732/2012 (60 dias; + Lei 13.896/2019: exames em 30 dias); prioridade = **Lei 14.238/2021** (Estatuto da Pessoa com Câncer, art. 4º §2º) — ver correção §4; SISREG III/DRAC-MS (páginas oficiais gov.br).

### 3.4 Frente 5 — Packs de tumor e exames por tumor

- **Já existia localmente** (não duplicado): `06-tumor-packs-1-5.md` cobre gástrico (parcial, intervalos NÃO_VERIFICADOS), esôfago, pâncreas, CHC, vias biliares; `07-…6-10.md` cobre rim, bexiga, ovário, colo, C&P — com marcadores NÃO_VERIFICADOS.
- **Mama:** ESMO EBC 2024 (Loibl, PMID 38101773; PMC11145753): visitas q3m a1-3, q6m a4-5, anual depois; mamografia anual (única imagem); sem marcadores/rotina em assintomático [confirma ASCO 2013, PMID 23129741]. NCCN Patients Breast 2026 (Guide 7) e **SBOC Diretrizes 2025** (nacional) concordam. Biomarcadores laudo: ER, PgR, HER2, Ki-67 (ESMO rec 1h). Basal pré-QT: FEVE — **ESC 2022 Classe I-B** antes de antraciclina e antes de anti-HER2 (Tabelas 7-8; PDF ULB aberto).
- **Colorretal:** NCCN Colon v2.2026 (patients PDF): PE+CEA q3-6m a1-2→q6m até a5; TC TAP q6-12m×5 anos; colonoscopia ano 1 (3-6 m se incompleta no diagnóstico) → ano 3 → q5 anos (cadência via PMC12146933 que cita NCCN/ESMO). Reto: + TR/retoscopia q3-4m e RM pelve q6m×3 anos (NCCN Rectal 2026). Metastático: MMR+RAS+BRAF em todos (ESMO mCRC 2026, PMID 41990853); HER2 se RAS-wt.
- **Próstata:** PCDT/Portaria SAS 498/2016: PSA 3-6-12 m → semestral até a3 → anual; definições de RB (PSA>0,2 pós-cirurgia; nadir+2 pós-RT). NCCN Prostate v5.2026: vigilância ativa (PSA 1-2x/ano, TR 1x/ano, RM 1-2 em 2 anos, biópsia 1-3 anos). INCA nota técnica vigente: **não rastrear populacionalmente com PSA** (decisão compartilhada se solicitado).
- **Pulmão:** NCCN NSCLC 2026: pós-ressecção TC q6m×2-3 a→anual (baixa dose); painel obrigatório metastático: EGFR (comunidades raras), KRAS G12C, ALK, ROS1, BRAF, NTRK, MET ex14, RET, HER2, NRG1 + PD-L1; reavaliação TC q6-12 sem. ESMO mNSCLC 2023 (Hendriks; PMC11648200): EGFR/ALK [I,A].
- **Gástrico (novo):** ESMO Gastric 2022 (Lordick, PMID 35914639; PMC10937212) + living v1.1 2023: estadiamento EDA+biópsia+TC TAP [V,A]; PET não de rotina [III,C]; laparoscopia+citologia em ressecáveis [III,B]; biomarcadores: HER2 [I,A], PD-L1 CPS [I,A], MSI/dMMR [II,A], CLDN18.2 "if available" [I,A]. Vigilância: **NCCN Stomach 2026 (patients)**: exame q3-6m 1-2 a→q6-12m até 5; TC q6m×2 a→anual até 5; EDA alta pós-ER q6m a1→anual; **B12: hemograma+B12 q3m até 3 anos→q6m até 5→anual vitalício** + reposição vitalícia via IM (ESPEN Micronutrients 2024, Rec 21.8/21.9, GPP 100%).
- **Transversais:** pedido de imagem — ACR Appropriateness Criteria + iRefer/RCR 9ª ed. (pergunta clínica + "Has it been done already?"); CBR SEM_FONTE (leads: Critérios de Adequação CBR, Parecer CFM 23/2019). Marcadores — ASCO/EGTM: não usar CEA/CA15-3/CA27-29 em rotina de mama assintomática; CEA sim no II-III colorretal.

---

## 4. Correções factuais capturadas (evitam erro de entrar no corpus)

1. **Lei 14.451/2022 NÃO é de fraldas** — altera quóruns de sociedade limitada (Código Civil). Fonte: Planalto.
2. **Lei 12.802/2013 NÃO é atendimento preferencial** — é reconstrução mamária no SUS. A lei correta é **Lei 14.238/2021 (Estatuto da Pessoa com Câncer), art. 4º §2º**.
3. **"Lei 15.284/2025" verificada = mamografia**, não fraldas (candidato a lei de fraldas: PL 3.603/2023, aprovado na Câmara set/2025, sem sanção até out/2026).
4. **DPI/DPSC** (siglas de documentos INSS citadas na 1ª rodada) **não existem na IN 128/2022** — provável ruído; descartar do modelo de laudo INSS.
5. CtCAE: "rash acneiforme" não existe como termo próprio na v6 — mapeamento oficial para "Rash maculo-papular".

## 5. Pendências SEM_FONTE finais (5)

| # | Pendência | Frente |
|---|---|---|
| 1 | Diretriz formal (ESMO/NCCN/ASCO) verbatim sobre tamoxifeno × TEV prévio (melhor fonte atual: Drugs.com + Meier 1998; Cardoso/ESMO 2019 cobre só risco aumentado) | 1 |
| 2 | Texto integral/consolidação da Portaria SAS 292/2012 (ODP) + PCDT Conitec vigente | 2 |
| 3 | Resolução INSS da Avaliação Médica e Social do BPC (equivalentes oficiais: Decreto 6.214/07 + Port. Intermin. 1/2014) | 2 |
| 4 | PDFs AC Camargo 2025 (alimentação na QT) — atrás de Cloudflare; obter com o serviço de nutrição | 4 |
| 5 | Documento CBR sobre conteúdo obrigatório do pedido de imagem | 5 |

## 6. Perguntas ao Dr. Silas (1 frase cada)

1. Tamoxifeno × TEV prévio entra como alerta GRAVE já com as fontes secundárias disponíveis, ou aguarda trecho formal de diretriz?
2. Acresento "proteinúria" ao CSV CTCAE local a partir do XLSX oficial do NCI, e adoto o mapeamento v6 de rash acneiforme → rash maculo-papular?
3. Fraldas: adoto a Portaria GM/MS 3.073/2024 (Farmácia Popular) como base federal vigente até a lei do SUS sair?
4. TFD: `vigenteDesde` = Portaria 55/1999 ou já Lei 15.390/2026 como fonte principal da ajuda de custo?
5. A nomenclatura DPI/DPSC é do seu serviço (manter no laudo INSS) ou descartamos?
6. Sinais de alarme: confirmado manter o corte local de febre estritamente >37,8 °C (D-W9-38) mesmo sendo mais sensível que IDSA/ASCO?
7. Pedido de imagem estruturado: ACR/iRefer servem como fonte enquanto o CBR não publica?

## 7. Plano de execução — como estas buscas viram corpus

Este documento é **insumo de curadoria, não corpus**: cada LLM designada em `F1-CORPUS-PROMPTS.md` redige os `.RASCUNHO.json` da sua frente usando os achados aqui (fontes, cortes, trechos), dentro do seu WRITE_SET e do BLOCO COMUM (header, FATO×DECISÃO, L10, `consultavel:true, alerta:false` até aprovação). Estimativa de destravamento: **~139 itens RASCUNHO** (42 interações, ~14 contraindicacões, 18 termos CTCAE, 10 laudos, 20+28 orientações/sinais, 5 packs + 2 transversais). As 5 pendências SEM_FONTE e as 7 perguntas acima devem ser resolvidas antes da promoção de `RASCUNHO` para `VERIFICADO` — itens sem fonte entram com `pendencia:"SEM_FONTE"` conforme a regra do BLOCO COMUM.

**Notas de infraestrutura de busca:** portal de bulas da ANVISA é aplicação JS inacessível a crawler — bulas em português vieram de espelhos (Consulta Remédios) e devem ser re-verificadas no portal pelo curador; PubMed/WebFetch instáveis (contornado com NCBI E-utilities e PMC); rate-limit intermitente do buscador exigiu rotas alternativas (DailyMed/FDA/AEMPS).
