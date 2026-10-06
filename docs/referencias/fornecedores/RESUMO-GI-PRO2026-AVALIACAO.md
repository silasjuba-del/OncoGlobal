# Avaliação crítica: Resumo GI PRO 2026 (Módulo 2)

**Objeto:** `Resumo_Diagnostico_Estadiamento_Tratamento_GI.pdf` (37 p., ReportLab, gerado em 06/10/2026 09:59) + versão `.md` homônima.
Origem: `~/.aside/.../slides-pro-2026/Módulo 2 - Tumores Gastrointestinais/output/`
**Revisor:** Claude (revisão de oncologista clínico, só leitura). **Data:** 06/10/2026.
**Método:** leitura integral do PDF (pdftotext com marcação de página e inspeção visual das páginas 3, 4, 11 e 20) e do .md. Confronto de cerca de 45 trials com `docs/referencias/evidencias/desfechos-gi-gu.csv` e checagem na web de 9 trials sem correspondência ou com atualização recente. As páginas citadas são as do PDF.

---

## 0. Veredito rápido

| Uso | Nota | Comentário |
|---|---|---|
| Material de estudo (prova/revisão) | **7,5/10** | Bem estruturado e prudente. Números corretos em mais de 90% das linhas conferidas. Perde pontos por um bug de renderização (≥, ≤, → e α somem do corpo do texto), por 4–5 números errados e por não incorporar desfechos de 2025–2026 que mudam a leitura (CheckMate 577, MATTERHORN, EMERALD-1, LEAP-012). |
| Fonte de RAG clínica | **5/10** | Funciona como texto de apoio, mas não como fonte primária. As tabelas de trials saem embaralhadas na extração de texto (colunas desalinhadas: a linha de um trial recebe o resultado de outro). Os limiares (≥) somem do corpo, não há PMID/DOI por linha (só os códigos A0x/Rx) e as URLs das referências não aparecem no texto. Para RAG, usar o `.md` e não o PDF, depois de aplicar as correções abaixo. |

---

## 1. Estrutura e completude

**Cobertura por sítio** (20 aulas, A02–A21): esôfago, gástrico/TEG, pâncreas, vias biliares, CHC, cólon, reto, canal anal, apêndice, NET/NEC, adrenocortical e PPGL.

- **GIST: ausente.** Não há aula de GIST no módulo (A02–A21) e o resumo não menciona imatinibe, KIT/PDGFRA D842V, avapritinibe, ripretinibe ou risco de Miettinen/Joensuu. Se o curso trata GIST em outro módulo, isso deve estar explícito; se não, é lacuna para o Dr. Silas (GIST é frequente em ambulatório do SUS e o imatinibe está disponível via APAC).
- ACC e PPGL (p16–17) não são GI. Estão no resumo por fidelidade às aulas, o que é aceitável.
- **Equilíbrio:** colorretal (p10–12 + 3 páginas de tabela) e CHC estão bem servidos. Esôfago (1 página) e canal anal (1 página) estão enxutos. Apêndice está bom para um tema raro.

**Checklist de temas pedidos:**

| Tema | Status | Onde | Observação |
|---|---|---|---|
| MSI/dMMR (todos os sítios) | Presente | p3, p5, p10–12 | Bom: MMR universal no CCR, dMMR gástrico perioperatório com ressalva. Faltam dados de IO neoadjuvante no gástrico dMMR (NEONIPIGA, INFINITY) além de "promissoras". |
| HER2 gástrico | Presente | p5–6 | KEYNOTE-811 CPS≥1, DESTINY-Gastric04 corretos. |
| CLDN18.2 | Presente | p5–6, p21 | Limiar ≥75% correto; nota boa sobre CLDN18.2 + PD-L1. |
| FGFR2 / IDH1 | Presente | p8, p24 | Correto. Falta FIGHT-302 (1ª linha pemigatinibe, SLP 8,3 vs 6,8 m; SG semelhante). |
| KRAS G12C (CCR) | Presente | p11, p30 | Só pós-QT. Não menciona dados de 1ª linha. |
| BRAF V600E | Presente | p11, p29 | BREAKWATER com SG 30,3 vs 15,1 m e aprovação regular FDA 02/2026. Correto. |
| HER2 colorretal | Presente | p11, p30 | MOUNTAINEER e DESTINY-CRC02. Não fala de teste por IHQ/ISH (critérios HERACLES). |
| IO perioperatória (gástrico/esôfago) | Presente | p4–5, p20 | MATTERHORN e KEYNOTE-585 presentes, sem a SG final de nenhum dos dois (ver §3). |
| TNT no reto | Presente | p12, p31 | PRODIGE-23, RAPIDO, OPRA, PROSPECT. Bom. |
| Watch-and-wait | Presente | p12, p34 | Bem formulado. |
| dMMR neoadjuvante no reto (dostarlimabe) | Presente | p12, p31 | 49/49 cCR (NEJM 2025). Correto. AZUR-1/AZUR-2 não são citados. |
| AJCC 8 vs 9 | **Insuficiente** | p4, p13 | Diz "TNM utilizado nas aulas" e "registrar a versão aplicada" (canal anal), mas não informa qual edição. O AJCC versão 9 já existe para canal anal e apêndice (e para outros sítios em atualização). Também não explica que, no esôfago (AJCC 8), os grupos prognósticos diferem por histologia e por c/p/yp. |
| BCLC 2022 | **Implícito** | p9 | Descreve as categorias 0/A/B/C/D, mas não cita BCLC 2022 nem os conceitos-chave: subgrupos do B (transplante ou TACE vs sistêmico conforme carga), "treatment stage migration", critérios de Milão/expandidos e downstaging. |
| TACE / sistêmico no CHC | Presente, **desatualizado** | p9, p27 | EMERALD-1/LEAP-012 tratados como "SG não definitiva". Ambos têm desfecho de SG negativo (§3). |
| Esôfago CEC: QRT definitiva + IO | **Ausente** | — | KEYNOTE-975 (pembrolizumabe + QRT definitiva) não melhorou SLE (comunicado Merck, 30/04/2026). Faltam também JCOG1109 NExT (DCF neoadjuvante; SG 3a 72,1% vs 62,6%) e Neo-AEGIS. |
| Pâncreas: PREOPANC-2 / APACT | **Ausentes** | p22 | PREOPANC-2 (2025): SG 21,9 vs 21,3 m, HR 0,88, NS. Reforça a mensagem do texto contra neoadjuvância universal. APACT: gem/nab adjuvante não atingiu o desfecho primário. |

---

## 2. Exatidão

### 2.1 Bug de renderização (o problema mais grave do PDF)

A fonte Calibri/WinAnsi do corpo do texto **não tem os glifos ≥, ≤, → e α, e o ReportLab os omitiu**. Nas tabelas eles saem corretamente. No `.md` eles existem, exceto na p4/linha 61, onde já faltavam na origem. Exemplos de leitura clinicamente errada no PDF:

| Página | Texto no PDF | Correto (.md) |
|---|---|---|
| p4 | "CPS 10, TPS 1% e TAP 10%"; "N3 a pelo menos 7" | CPS ≥10, TPS ≥1%, TAP ≥10% (falta também no .md) |
| p5 (texto) / p37 R4 | "CPS1" | CPS ≥1 |
| p7 | "T1 2 cm, T2 >2 a 4 cm … N2: 4" | T1 ≤2 cm; T2 >2 a ≤4 cm; N2 ≥4 |
| p9 | "ramucirumabe se AFP 400 ng/mL" | AFP ≥400 |
| p10 | "N2, 4" | N2 ≥4 |
| p12 | "mFOLFIRINOX  QRT  cirurgia"; "RT curta  QT  cirurgia" | setas → perdidas |
| p13 | "T1 2 cm; T2 >2 a 5 cm" | T1 ≤2; T2 >2 a ≤5 |
| p16 | "ENSAT I 5 cm"; "R0 e Ki-67 10%" (ADIUVO) | ≤5 cm; Ki-67 ≤10% (o leitor entende "=10%") |
| p17 | "inibidor HIF-2, … adultos e 12 anos" | HIF-2α; ≥12 anos |

**Correção:** regenerar o PDF com fonte que tenha esses glifos (DejaVu Sans, Noto Sans) ou substituí-los por texto ("≥" → ">=").

### 2.2 Conferência contra `desfechos-gi-gu.csv` (repo OncoGlobal)

Conferi cerca de 45 trials. Os que batem com o CSV (sem erro): CROSS (48,6 vs 24,0; pCR 29%), ESOPEC (SG 3a 57,4 vs 50,7%; HR 0,70), CheckMate-577 (SLD 22,4 vs 11,0; HR 0,69), RTOG 85-01, KEYNOTE-590 (12,4 vs 9,8; CEC CPS≥10 13,9 vs 8,8), CheckMate-648 (13,2/12,7 vs 10,7), RATIONALE-306, ATTRACTION-3, KEYNOTE-181, RATIONALE-302, FLOT4 (50 vs 35; HR 0,77), CheckMate-649 (CPS≥5 14,4 vs 11,1; HR 0,71), MATTERHORN (SLE HR 0,71; pCR 19,2 vs 7,2%), CONKO-001, ESPAC-4 (28,0 vs 25,5), PRODIGE-24 (53,5 vs 35,5; 5a 43,2 vs 31,4%), PREOPANC (5a 20,5 vs 6,5%), PRODIGE-4, MPACT, NAPOLI-3 (11,1 vs 9,2), NAPOLI-1, POLO (SLP 7,4 vs 3,8; SG final 19,0 vs 19,2), RASolute-302 (13,2 vs 6,7; HR 0,40), SHARP, REFLECT, IMbrave150 (19,2 vs 13,4), HIMALAYA (16,4 vs 13,8), CheckMate-9DW (23,7 vs 20,6; HR 0,79), LEAP-002, RESORCE, CELESTIAL, REACH-2, EMERALD-1 (SLP 15,0 vs 8,2), LEAP-012 (SLP 14,6 vs 10,0), IMbrave050 (HR 0,72 → 0,90), BILCAP (51,1 vs 36,4; p=0,097), ASCOT (SG 3a 77,1 vs 67,6%), PRODIGE-12, SWOG-0809, ABC-02, KEYNOTE-966, ABC-06, ClarIDHy, FIGHT-202, HERIZON-BTC-01 (41,3%).

**Divergências encontradas:**

| # | Página | Trial | No resumo | Correto / fonte | Gravidade |
|---|---|---|---|---|---|
| 1 | p24 | FOENIX-CCA2 | SLP 8,9 m | 9,0 m (NEJM 2023, PMID 36652354) | Mínima |
| 2 | p26 | CARES-310 | SG 22,1 vs 15,2 m (interina) | Final: 23,8 vs 15,2 m; HR 0,64 (Lancet Oncol 2025, PMID 41308676) | Baixa (desatualizado) |
| 3 | p24 | TOPAZ-1 "(2022; atualização)" | Só a SG inicial 12,8 vs 11,5; HR 0,80 | 3 anos: 12,9 vs 11,3 m; HR 0,74; SG 36m 14,6 vs 6,9% (J Hepatol 2025, PMID 40381735) | Baixa |
| 4 | p19 / p4 | CheckMate-577 | Só SLD | **SG final NS:** 51,7 vs 35,3 m; HR 0,85 (0,70–1,04); p=0,106 (ASCO 2025, JCO 43:16_suppl 4000) | **Alta**: muda o aconselhamento |
| 5 | p20 / p5 | MATTERHORN | Só SLE/pCR | **SG final positiva:** HR 0,78 (0,63–0,96); p=0,021 (Lancet 2026, PMID 42716074) | Média: fortalece a recomendação |
| 6 | p26 | CheckMate-9DW | Sem ressalva | Excesso de óbitos precoces nos primeiros 6 meses (HR 1,65; 1,12–2,43) | Média: seleção de pacientes |
| 7 | p26 | HIMALAYA | 16,4 vs 13,8 m | Omite SG 5a 19,6% vs 9,4%; HR 0,76 (J Hepatol 2025) | Baixa |

### 2.3 Checagem em fonte primária (trials fora do CSV)

| # | Página | Trial | No resumo | Fonte primária | Veredito |
|---|---|---|---|---|---|
| 8 | p20 | **TOPGEAR** | pCR 12% vs 6% | **pCR 17% vs 8%** (Leong, NEJM 2024; PMID 39282905). SG 46,4 vs 49,4 m está correta | **Erro** |
| 9 | p29 | **TRIBE** | TRO 65% vs 51% | **65% vs 53%** (Loupakis, NEJM 2014; PMID 25337750). SG 29,8 vs 25,8 m correta (Lancet Oncol 2015) | **Erro** |
| 10 | p20 | **INT-0116** | SG 35 vs 27 m | **36 vs 27 m** (Macdonald, NEJM 2001; PMID 11547741) | Erro menor |
| 11 | p21 | KEYNOTE-859 | CPS≥10: 15,8 vs 11,8 m | A publicação (Rha, Lancet Oncol 2023; PMID 37875143) reporta 15,7 vs 11,8 m. Não consegui confirmar o abstract nesta sessão | Provável erro de arredondamento |
| 12 | p28 | ATOMIC | SLD 3a 86,3 vs 76,2%; HR 0,50 | Confere (Sinicrope, NEJM 2025/2026) | OK |
| 13 | p31 | OPRA | TME-free 54 vs 39%; SLD 69 vs 71% | Confere (Verheij, JCO 2024; PMID 37883738) | OK |
| 14 | p20 | KEYNOTE-585 | "SLE não cruzou limiar" | Confere. A SG final também foi NS: 71,8 vs 55,7 m; HR 0,86 (JCO 2025; PMID 40829093). Vale citar | OK, incompleto |
| 15 | p27 | **LEAP-012** | "SG não definitiva na análise" | **Estudo encerrado em 29/10/2025 por baixa probabilidade de atingir SG** (comunicado Merck/Eisai) | **Desatualizado** |
| 16 | p27 | **EMERALD-1** | "Não implica ganho de SG demonstrado" | **SG final negativa:** durva+beva+TACE vs TACE 29,9 vs 33,3 m; HR 1,10 (0,87–1,39); G3–4 47,4% vs 25,0% (ESMO GI 2026) | **Desatualizado; sinal desfavorável** |
| 17 | p7 / p23 | RASolute-302 / FDA 26/08/2026 | n=500; 13,2 vs 6,7 m | Confirmado (FDA, AACR, Dana-Farber, 26–27/08/2026) | OK |

**Outros pontos verificados sem erro (de memória da literatura, não rechecados um a um):** MOSAIC, IDEA, DYNAMIC, CHALLENGE, ALASCCA, NICHE-2, PARADIGM, CALGB 80405, CAIRO-3, PANAMA, KEYNOTE-177, CheckMate-8HW, BEACON, BREAKWATER, SUNLIGHT, CORRECT, FRESCO-2, CodeBreaK-300, MOUNTAINEER, DESTINY-CRC02, New EPOC, EORTC 40983, PRODIGE-23, RAPIDO, PROSPECT, ACT-II, RTOG 8704, InterAACT, POD1UM-303, PROMID, CLARINET, RADIANT-3/4, NETTER-1/2, CABINET, TOPIC-NEC, FIRM-ACT, ADIUVO, FIRSTMAPPP, ToGA, SPOTLIGHT, GLOW, DESTINY-Gastric01/04, RAINBOW, TAGS, CLASSIC, ACTS-GC, ARTIST-2, CRITICS, ATTRACTION-5, VESTIGE.

**Não verificáveis (o próprio resumo marca como congresso/aula):** KEYNOTE-937 (ASCO GI 2026: SLR 46,7 vs 45,5; HR 1,06), CARES-009 (ESMO 2025), GASTFOX ("nas aulas"). Antes de entrar em RAG, devem ser marcados como "dado de congresso".

### 2.4 Problemas de forma

- **p1 (Conteúdo):** "1-2", "15-15 134 trials", "16-19" são números de seção, mas parecem páginas. As tabelas ocupam as p18–33.
- **p18:** página quase vazia (só a legenda), desperdício na impressão.
- **p36:** os links das aulas são relativos (`../02 - Aula 02…pdf`) e quebram fora da pasta original.

---

## 3. Atualidade até 10/2026

| Resultado | Estado em 10/2026 | O resumo reflete? |
|---|---|---|
| CheckMate 577: SG final | NS (HR 0,85) | **Não**: só a SLD |
| MATTERHORN | SLE + SG final positivas; FDA 25/11/2025 | **Parcial**: falta a SG |
| KEYNOTE-585 | SLE NS; SG final NS | Sim (SG não citada) |
| ESOPEC | FLOT > CROSS em SG (adenocarcinoma) | Sim, com boa ressalva sobre nivolumabe pós-CROSS |
| DESTINY-Gastric04 | T-DXd > ram/pacli em SG | Sim |
| NAPOLI-3 | NALIRIFOX > gem/nab | Sim, com ressalva correta (não comparado com FOLFIRINOX) |
| TOPAZ-1 / KEYNOTE-966 | Ganho de SG mantido em 3 anos | Sim, sem a atualização |
| EMERALD-1 / LEAP-012 | **SG negativas** / LEAP-012 encerrado | **Não**: "SG imatura/não definitiva" |
| HIMALAYA 5 anos | SG 5a 19,6 vs 9,4% | **Não** |
| BREAKWATER | SG 30,3 vs 15,1; aprovação regular FDA 02/2026 | Sim |
| CheckMate 8HW | Nivo/ipi > QT e > nivo | Sim |
| ATOMIC | SLD 3a 86,3 vs 76,2% | Sim |
| AZUR-1 / AZUR-2 | Dostarlimabe dMMR (reto / cólon) | **Ausente**. Não verifiquei se há resultado publicado; ao menos citar como estudos em andamento |
| PROSPECT | NI de FOLFOX com RT seletiva | Sim |
| NETTER-2 | SLP 22,8 vs 8,5 | Sim |
| RASolute-302 / daraxonrasibe | FDA 26/08/2026 | Sim (atual) |
| IMbrave050 | Benefício não sustentado (HR 0,90) | Sim (atual) |
| KEYNOTE-975 (esôfago) | Negativo (SLE), 04/2026 | **Ausente** |
| PREOPANC-2 | Negativo (2025) | **Ausente** |

**Conclusão:** o resumo está atualizado até cerca de meados de 2025 nos desfechos de SG e até 08/2026 nas aprovações FDA. As aprovações estão em dia; as atualizações de SG (577, MATTERHORN, EMERALD-1, LEAP-012, HIMALAYA 5a) não estão.

---

## 4. Tom e aplicabilidade ao SUS

**Tom.** O texto é, em geral, **mais cauteloso que a média** dos resumos de curso: abundam "não extrapolar", "não generalizar" e "sem comparação direta". Poucas condutas aparecem como verdade absoluta. Pontos a calibrar:

- p4: "FLOT perioperatório ganhou prioridade nos candidatos aptos". Faltam o Neo-AEGIS (SG equivalente a CROSS) e o contexto de JEG Siewert I e de adenocarcinoma de esôfago com alto volume nodal, em que a QRT ainda é escolha frequente.
- p4: "nivolumabe adjuvante por até um ano, conforme CheckMate 577" é apresentado como conduta sem ressalva. Com a SG final NS, o texto deveria dizer "benefício em SLD, sem ganho de SG".
- p9: os três regimes de IO no CHC aparecem como equivalentes. O 9DW tem excesso de mortes precoces (relevante para pacientes com doença agressiva ou alto risco).
- p5: "Durvalumabe + FLOT … sustentou aprovação FDA" sem dizer que a SG também foi positiva. Aqui o tom é cauteloso demais.
- O texto repete "não extrapolar" e afins dezenas de vezes. Para estudo isso dilui a mensagem; para RAG gera respostas evasivas.

**SUS.** O resumo declara (p1, p35) que **não auditou Anvisa, SUS nem saúde suplementar**. É honesto, mas para um oncologista do SUS é a maior lacuna prática. Faltam um rótulo de "acesso SUS" e um "plano B SUS" por cenário. Sugestão de marcação (confirmar na CONITEC e na tabela APAC vigente):

- **Em geral viáveis via APAC** (valor fixo por procedimento, a critério do CACON/UNACON): CROSS, FLOT, FOLFOX/CAPOX, FOLFIRI, FOLFIRINOX/mFOLFIRINOX, gem/cis, gemcitabina, capecitabina, carbo/paclitaxel, 5-FU/MMC + RT, cis/etoposídeo, CAPTEM, octreotida LAR, mitotano. Imatinibe (GIST) tem financiamento específico.
- **Raramente viáveis no SUS** (custo incompatível com a APAC ou sem incorporação; confirmar caso a caso): todos os anti-PD-1/PD-L1 e anti-CTLA-4 citados (nivolumabe, pembrolizumabe, tislelizumabe, durvalumabe, atezolizumabe, retifanlimabe, dostarlimabe), zolbetuximabe, T-DXd, trastuzumabe no gástrico, ramucirumabe, nal-IRI, nab-paclitaxel, olaparibe, inibidores de FGFR/IDH1, zanidatamabe, encorafenibe, adagrasibe/sotorasibe, tucatinibe, fruquintinibe, TAS-102 ± bevacizumabe, regorafenibe, cabozantinibe, lenvatinibe, belzutifano, PRRT (oferta muito limitada), daraxonrasibe (sem registro Anvisa até onde se sabe).
- **Variáveis:** bevacizumabe e cetuximabe/panitumumabe no CCR metastático e sorafenibe no CHC dependem do serviço e do valor da APAC.

Consequência: as condutas "padrão" de p5 (HER2+/CPS, CLDN18.2), p8 (gem/cis + IO), p9 (atezo/beva, STRIDE), p11 (8HW, BREAKWATER) e p12 (dostarlimabe) **não são o padrão exequível no SUS**. O resumo precisa de uma coluna ou nota "alternativa SUS" (por exemplo: CHC no SUS = sorafenibe ou lenvatinibe quando disponíveis, senão suporte; vias biliares = gem/cis; gástrico HER2+ = QT ± trastuzumabe só se o serviço fornecer; CCR dMMR = QT ± biológico disponível, com IO por judicialização ou pesquisa clínica).

---

## 5. Referências R1–R31

Observação: **o PDF tem os hiperlinks** (31 anotações clicáveis na p37 e 20 no corpo), mas a URL não aparece no texto impresso nem na extração para RAG. As linhas das tabelas (p19–33) não têm link algum. O `.md` contém todas as URLs. Abaixo, R1–R31 resolvidas: URL do próprio documento e, quando disponível, o PMID da publicação principal (do CSV do repo ou de verificação nesta sessão).

| Ref | Conteúdo | URL / PMID |
|---|---|---|
| R1 | ESOPEC, NEJM 2025 | doi:10.1056/NEJMoa2409408 · PMID 39842010 |
| R2 | Citologia peritoneal + no gástrico | https://pmc.ncbi.nlm.nih.gov/articles/PMC3373003/ |
| R3 | FDA durvalumabe/FLOT (MATTERHORN), 25/11/2025 | fda.gov/…/fda-approves-durvalumab-resectable-gastric-or-gastroesophageal-junction-adenocarcinoma · trial: PMID 40454643 (NEJM 2025); SG final PMID 42716074 |
| R4 | FDA pembrolizumabe HER2+ CPS≥1 (KEYNOTE-811) | fda.gov/…/fda-approves-pembrolizumab-her2-positive-gastric-or-gastroesophageal-junction-adenocarcinoma |
| R5 | FDA zolbetuximabe (Vyloy) snapshot | fda.gov/drugs/drug-approvals-and-databases/drug-trials-snapshots-vyloy |
| R6 | DESTINY-Gastric04 | PMID 40454632 |
| R7 | FDA daraxonrasibe (RASolute-302), 26/08/2026 | fda.gov/…/fda-approves-daraxonrasib-metastatic-pancreatic-adenocarcinoma · trial PMID 42223072 (NEJM 2026) |
| R8 | IMbrave050 atualizado, J Hepatol 2026 | PMID 41580093 |
| R9 | FDA nivo/ipi CHC (CheckMate-9DW) | fda.gov/…/fda-approves-nivolumab-ipilimumab-unresectable-or-metastatic-hepatocellular-carcinoma · trial PMID 40349714 |
| R10 | ATOMIC | PMID 41880612 |
| R11 | DYNAMIC-III | PMID 41115959 |
| R12 | FDA nivo/ipi CCR MSI-H (CheckMate-8HW) | fda.gov/…/fda-approves-nivolumab-ipilimumab-unresectable-or-metastatic-msi-h-or-dmmr-colorectal-cancer |
| R13 | FDA encorafenibe aprovação regular (BREAKWATER), 24/02/2026 | fda.gov/…/fda-grants-traditional-approval-encorafenib-metastatic-colorectal-cancer-braf-v600e-mutation |
| R14 | STELLAR-303 | PMID 41130252 |
| R15 | RAPIDO, seguimento locorregional | https://pmc.ncbi.nlm.nih.gov/articles/PMC10481913/ |
| R16 | Dostarlimabe, manejo não operatório dMMR (NEJM 2025) | https://pmc.ncbi.nlm.nih.gov/articles/PMC12661660/ |
| R17 | FDA retifanlimabe CEC anal, 15/05/2025 | fda.gov/…/fda-approves-retifanlimab-dlwr-carboplatin-and-paclitaxel-and-single-agent-squamous-cell-carcinoma |
| R18 | QT no apêndice mucinoso de baixo grau (crossover) | PMID 37261831 |
| R19 | FDA cabozantinibe NET (CABINET) | fda.gov/…/fda-approves-cabozantinib-adults-and-pediatric-patients-12-years-age-and-older-pnet-and-epnet |
| R20 | FDA belzutifano PPGL (LITESPARK-015) | fda.gov/…/fda-approves-belzutifan-pheochromocytoma-or-paraganglioma |
| R21 | PARADIGM | PMID 37071094 |
| R22 | MOUNTAINEER, análise final | https://pmc.ncbi.nlm.nih.gov/articles/PMC12852713/ |
| R23 | RADIANT-4 | https://pmc.ncbi.nlm.nih.gov/articles/PMC6063317/ (Lancet 2016) |
| R24 | E2211 (Kunz) | PMID 36260828 |
| R25 | PRODIGE-24, 5 anos | PMID 36048453 |
| R26 | POLO, SG final | PMID 35834777 |
| R27 | NORPACT-1 | Abstract ASCO 2023 LBA4005 (doi:10.1200/JCO.2023.41.17_suppl.LBA4005). **Preferir a publicação plena** (Lancet Gastroenterol Hepatol 2024; PMID a confirmar) |
| R28 | ESPAC-4 | Abstract ASCO 2016 LBA4006. **Preferir a publicação plena:** Lancet 2017, PMID 28129987 |
| R29 | HERIZON-BTC-01, análise final | https://pmc.ncbi.nlm.nih.gov/articles/PMC12635922/ · PMID 41264278 (JAMA Oncol 2026) |
| R30 | KEYNOTE-177 | PMID 33264544 |
| R31 | ABC-02 | doi:10.1056/NEJMoa0908721 · PMID 20375404 |

As URLs de R1–R31 foram tiradas do próprio `.md`. Os PMIDs secundários vêm do CSV do repo. Não abri cada link nesta sessão, salvo FDA/daraxonrasibe.

---

## 6. Top 10 correções prioritárias

1. **Regerar o PDF com fonte que tenha ≥, ≤, → e α** (p4, 5, 7, 9, 10, 12, 13, 16, 17, 37). Hoje "Ki-67 10%", "AFP 400", "T1 2 cm" e "CPS 10" leem errado. Corrigir também a p4 no `.md` ("CPS ≥10, TPS ≥1%, TAP ≥10%").
2. **CheckMate 577 (p4, p19):** acrescentar "SG final NS: 51,7 vs 35,3 m; HR 0,85; p=0,106 (ASCO 2025)" e ajustar o tom da recomendação.
3. **EMERALD-1 e LEAP-012 (p9, p27):** EMERALD-1 com SG final negativa (HR 1,10; ESMO GI 2026); LEAP-012 encerrado por futilidade de SG (10/2025). Trocar "relevantes" por "ganho de SLP sem ganho de SG; não usar fora de estudo".
4. **MATTERHORN (p5, p20):** incluir a SG final positiva (HR 0,78; p=0,021; Lancet 2026).
5. **TOPGEAR (p20):** pCR 17% vs 8% (não 12 vs 6%).
6. **TRIBE (p29):** TRO 65% vs 53% (não 51%). **INT-0116 (p20):** SG 36 vs 27 m. **KEYNOTE-859 (p21):** CPS≥10 15,7 m. **FOENIX (p24):** SLP 9,0 m.
7. **CHC (p9, p26):** citar BCLC 2022 explicitamente (subgrupos do B, migração terapêutica, critérios de transplante). Acrescentar a ressalva de mortes precoces do 9DW, HIMALAYA 5a (19,6 vs 9,4%) e CARES-310 final (23,8 vs 15,2).
8. **Lacunas de evidência:** KEYNOTE-975 (negativo) e JCOG1109/Neo-AEGIS no esôfago; PREOPANC-2 e APACT no pâncreas; FIGHT-302 nas vias biliares; AZUR-1/2 no reto e cólon dMMR; atualização do TOPAZ-1 em 3 anos; SG final do KEYNOTE-585. Declarar a ausência de GIST no módulo ou adicionar uma seção curta.
9. **Camada SUS:** adicionar coluna ou nota "acesso SUS / alternativa exequível" em cada tabela de conduta (p5, 8, 9, 11, 12, 13, 15). Sem isso, o material é um resumo de padrão FDA e não de prática SUS.
10. **Preparação para RAG:** usar o `.md` como fonte, não o PDF. Pôr PMID/DOI por linha nas tabelas de trials. Marcar "congresso/não publicado" (KEYNOTE-937, CARES-009, GASTFOX, EMERALD-1 SG) e "data da evidência". Declarar a edição do AJCC por sítio. Corrigir o sumário (seções vs páginas) e os links relativos da p36.

---

### Fontes web consultadas nesta avaliação
- [TOPGEAR, EORTC](https://www.eortc.org/blog/2024/09/24/topgear-trial-results/) · [scimex](https://www.scimex.org/newsfeed/global-trial-ends-20-year-debate-over-gastro-esophageal-cancer-treatment)
- [TRIBE, medicalresearch.com](https://medicalresearch.com/metastatic_colon_cancer_survival_improved_with_folfoxiri_plus_bevacizumab/)
- [ATOMIC, ASCO Post 03/2026](https://ascopost.com/news/march-2026/adjuvant-atezolizumab-and-mfolfox6-in-stage-iii-mismatch-repair-deficient-colon-cancer/)
- [KEYNOTE-859, ASCO Post](https://ascopost.com/news/february-2023/keynote-859-interim-analysis-overall-survival-benefit-for-first-line-pembrolizumab-in-advanced-gastric-cancer)
- [OPRA long-term, ASCO Post](https://ascopost.com/news/november-2023/long-term-organ-preservation-with-total-neoadjuvant-therapy-in-rectal-adenocarcinoma/)
- [LEAP-012 encerrado, OncLive](https://www.onclive.com/view/leap-012-trial-of-pembrolizumab-lenvatinib-tace-to-close-following-missed-os-end-point-in-unresectable-hcc)
- [KEYNOTE-585 final, ASCO Post](https://ascopost.com/news/august-2025/pembrolizumab-plus-chemotherapy-vs-chemotherapy-in-advanced-gastric-cancers-final-survival-analysis-from-keynote-585)
- [EMERALD-1 SG final, ESMO GI 2026 Daily Reporter](https://dailyreporter.esmo.org/esmo-gastrointestinal-cancers-congress-2026/news/the-place-for-tace-combinations-in-hepatocellular-carcinoma-is-still-uncertain)
- [Daraxonrasibe FDA, Dana-Farber](https://www.dana-farber.org/newsroom/news-releases/2026/fda-approves-daraxonrasib-for-metastatic-pancreatic-cancer-following-landmark-clinical-trial-led-by-dana-farber)
- [INT-0116, CancerNetwork](https://cancernetwork.com/view/intergroup-study-finds-post-op-chemoradiation-should-be-standard-care-most-gastric-cancers)
