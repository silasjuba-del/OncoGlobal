> **Material de referência — revisar antes de uso clínico. Fontes consultadas em 2026-10-06.**

# CTCAE v6.0 — 50 termos selecionados para oncologia clínica (QT, imunoterapia, terapia-alvo)

## 1. Versão utilizada e verificação

- **Versão usada: CTCAE v6.0 (MedDRA 28.0)** — a v6.0 EXISTE e está oficialmente publicada pelo NCI/CTEP. Não foi necessário recorrer à v5.0.
- **Data de publicação:** 22 de julho de 2025 (capa do *CTCAE v6.0 Quick Reference*, PDF oficial). A página de Adverse Events do CTEP informa: *"The current Common Terminology Criteria for Adverse Events (CTCAE) v6.0 was released in 2025."*
- **Como foi verificado:** a URL indicada (`https://ctep.cancer.gov/protocoldevelopment/electronic_applications/ctc.htm`) hoje redireciona para `https://dctd.cancer.gov/research/ctep-trials/trial-development`, que lista "CTCAE v6 (2025) (Excel)". A página `https://dctd.cancer.gov/research/ctep-trials/for-sites/adverse-events` lista "CTCAE v6.0 (2025, MedDRA 28.0) (Excel) — includes a tracked changes document and mapping to v5.0", o Quick Reference em PDF e um FAQ.
- **Arquivo-fonte baixado:** `https://dctd.cancer.gov/research/ctep-trials/trial-development/ctcae-v6.0.xlsx` (HTTP Last-Modified: 21/01/2026; metadados do arquivo: criado em 12/03/2025, modificado em 20/01/2026). SHA-256 do arquivo baixado: `4d7b4fcfdcb25c45a23b02c07fcb20eab7f284b23862e4e4e64bb8823c2f440b`. Cópia local: `/workspace/onco-ref/src/ctcae-v6.0.xlsx`.
- **Errata:** a aba *Errata* do Excel lista correções datadas de 20/01/2026 (p. ex., Creatinine increased G2/G3, Thrombocytopenia G4, Vomiting G2, Pneumonia [definição]). Os textos abaixo vêm da aba *CTCAE v6.0 Clean Copy*, que já contém as versões corrigidas (conferido para Creatinine increased e Thrombocytopenia).
- **Implementação (FAQ NCI, 09/09/2025):** a v6.0 pode ser usada de imediato em qualquer estudo, exceto estudos NCI CTEP/DCP; estudos CTEP/DCP em andamento continuam na v5.0. A v6.0 será obrigatória para novos estudos CTEP/DCP cujo *build* no Rave comece após o Rave ALS 7.2 (previsto provisoriamente para julho de 2026). A página do CTEP cita como meta de implementação 1º de janeiro de 2026 para estudos novos. O CTCAE v7.0 está previsto para 2027–2030.

## 2. Como ler este arquivo

- **Termo em inglês, SOC e textos dos graus em inglês** = cópia exata do Excel oficial (no CSV, colunas `*_en`).
- **Tradução PT-BR** = tradução fiel feita para este material (**não existe tradução oficial do NCI para o português**). Valores numéricos foram mantidos exatamente como no original (ponto decimal, `>=`, `<=`, `x 10^9/L`). O nome do SOC em português é tradução livre, não a tradução oficial MedDRA.
- Abreviações: AVD = atividades de vida diária (*instrumental* = preparar refeições, fazer compras, usar telefone, gerir dinheiro; *autocuidado* = banhar-se, vestir-se, alimentar-se, usar o banheiro, tomar medicações); LIN/LSN = limite inferior/superior da normalidade (LLN/ULN); NPT = nutrição parenteral total (TPN); SC = superfície corporal (BSA); CAN = contagem absoluta de neutrófilos (ANC).
- No CTCAE, o ponto e vírgula (;) significa "ou"; o traço (-) significa grau não disponível.
- **"Fármacos típicos associados" NÃO faz parte do CTCAE**: é curadoria clínica geral (associações classicamente descritas). Confirmar na bula específica antes de usar.
- Lista: **50 termos principais** + **5 termos complementares** (Heart failure, Acute kidney injury, Diabetes mellitus, Weight gain, Insomnia), mantidos à parte porque, no CTCAE, são termos distintos daqueles escolhidos para os itens IC/FEVE, creatinina/LRA e hiperglicemia, ou ficaram fora do corte de 50.

## 3. Mudanças da v6.0 que afetam termos de uso diário em oncologia (fonte: aba "CTCAE v5.0 to v6.0 Mapping")

| Termo v5.0 | Situação na v6.0 | Termo v6.0 a usar |
|---|---|---|
| Rash acneiform | Excluído (Deletion) | Rash maculo-papular (mapeamento oficial de todos os graus; nota de navegação sugere considerar também *Pustular drug eruption*) |
| Platelet count decreased | Excluído | Thrombocytopenia (SOC Blood and lymphatic system disorders) |
| Thromboembolic event | Excluído | Venous thromboembolism (arterial: Arterial thromboembolism) |
| Ejection fraction decreased | Excluído | Left ventricular dysfunction (G4 da v5 mapeado para G3 da v6) |
| Edema limbs | Excluído | Peripheral edema |
| Lung infection | Excluído | Pneumonia |
| Hypertension | Grau 1 excluído; G2–G4 redefinidos | Hypertension (começa no G2) |
| Hyperglycemia | Grau 5 excluído | Hyperglycemia (G5 → 'Metabolism and nutrition disorders - Other, specify'); considerar Diabetes mellitus (termo novo) |

## 4. Índice dos termos

| # | Lista | Termo (EN, exato) | Tradução PT-BR | SOC (EN) | Código LLT MedDRA |
|---|---|---|---|---|---|
| 1 | principal | Nausea | Náusea | Gastrointestinal disorders | 10028813 |
| 2 | principal | Vomiting | Vômito | Gastrointestinal disorders | 10047700 |
| 3 | principal | Diarrhea | Diarreia | Gastrointestinal disorders | 10012727 |
| 4 | principal | Constipation | Constipação | Gastrointestinal disorders | 10010774 |
| 5 | principal | Mucositis oral | Mucosite oral | Gastrointestinal disorders | 10028130 |
| 6 | principal | Anorexia | Anorexia (perda de apetite) | Metabolism and nutrition disorders | 10002646 |
| 7 | principal | Fatigue | Fadiga | General disorders and administration site conditions | 10016256 |
| 8 | principal | Alopecia | Alopecia | Skin and subcutaneous tissue disorders | 10001760 |
| 9 | principal | Peripheral sensory neuropathy | Neuropatia sensitiva periférica | Nervous system disorders | 10034620 |
| 10 | principal | Palmar-plantar erythrodysesthesia syndrome | Síndrome de eritrodisestesia palmoplantar (síndrome mão-pé) | Skin and subcutaneous tissue disorders | 10054524 |
| 11 | principal | Rash maculo-papular | Erupção (rash) maculopapular [substitui 'Rash acneiform' da v5.0] | Skin and subcutaneous tissue disorders | 10037868 |
| 12 | principal | Pruritus | Prurido | Skin and subcutaneous tissue disorders | 10037087 |
| 13 | principal | Neutrophil count decreased | Contagem de neutrófilos diminuída (neutropenia) | Investigations | 10029366 |
| 14 | principal | Anemia | Anemia | Blood and lymphatic system disorders | 10002272 |
| 15 | principal | Thrombocytopenia | Trombocitopenia (plaquetopenia) [substitui 'Platelet count decreased' da v5.0] | Blood and lymphatic system disorders | 10043554 |
| 16 | principal | Febrile neutropenia | Neutropenia febril | Blood and lymphatic system disorders | 10016288 |
| 17 | principal | Hypomagnesemia | Hipomagnesemia | Metabolism and nutrition disorders | 10021028 |
| 18 | principal | Hypokalemia | Hipocalemia | Metabolism and nutrition disorders | 10021018 |
| 19 | principal | Hyponatremia | Hiponatremia | Metabolism and nutrition disorders | 10021038 |
| 20 | principal | Creatinine increased | Creatinina aumentada | Investigations | 10011368 |
| 21 | principal | Alanine aminotransferase increased | Alanina aminotransferase (ALT/TGP) aumentada | Investigations | 10001551 |
| 22 | principal | Aspartate aminotransferase increased | Aspartato aminotransferase (AST/TGO) aumentada | Investigations | 10003481 |
| 23 | principal | Blood bilirubin increased | Bilirrubina sanguínea aumentada | Investigations | 10005364 |
| 24 | principal | Hypertension | Hipertensão arterial | Vascular disorders | 10020772 |
| 25 | principal | Venous thromboembolism | Tromboembolismo venoso [substitui 'Thromboembolic event' da v5.0] | Vascular disorders | 10066899 |
| 26 | principal | Left ventricular dysfunction | Disfunção ventricular esquerda [absorve 'Ejection fraction decreased' da v5.0] | Cardiac disorders | 10049694 |
| 27 | principal | Electrocardiogram QT corrected interval prolonged | Intervalo QT corrigido prolongado no eletrocardiograma | Investigations | 10014383 |
| 28 | principal | Pneumonitis | Pneumonite | Respiratory, thoracic and mediastinal disorders | 10035742 |
| 29 | principal | Colitis | Colite | Gastrointestinal disorders | 10009887 |
| 30 | principal | Hypothyroidism | Hipotireoidismo | Endocrine disorders | 10021114 |
| 31 | principal | Hyperthyroidism | Hipertireoidismo | Endocrine disorders | 10020850 |
| 32 | principal | Adrenal insufficiency | Insuficiência adrenal | Endocrine disorders | 10001367 |
| 33 | principal | Hypophysitis | Hipofisite | Endocrine disorders | 10062767 |
| 34 | principal | Hyperglycemia | Hiperglicemia | Metabolism and nutrition disorders | 10020639 |
| 35 | principal | Arthralgia | Artralgia | Musculoskeletal and connective tissue disorders | 10003239 |
| 36 | principal | Myalgia | Mialgia | Musculoskeletal and connective tissue disorders | 10028411 |
| 37 | principal | Tinnitus | Zumbido | Ear and labyrinth disorders | 10043882 |
| 38 | principal | Hearing impaired | Perda auditiva (audição comprometida) | Ear and labyrinth disorders | 10019245 |
| 39 | principal | Dysgeusia | Disgeusia | Nervous system disorders | 10013911 |
| 40 | principal | Epistaxis | Epistaxe | Respiratory, thoracic and mediastinal disorders | 10015090 |
| 41 | principal | Infusion related reaction | Reação relacionada à infusão | Injury, poisoning and procedural complications | 10051792 |
| 42 | principal | Allergic reaction | Reação alérgica (hipersensibilidade) | Immune system disorders | 10001718 |
| 43 | principal | Peripheral edema | Edema periférico [substitui 'Edema limbs' da v5.0] | General disorders and administration site conditions | 10034570 |
| 44 | principal | Headache | Cefaleia | Nervous system disorders | 10019211 |
| 45 | principal | Dizziness | Tontura | Nervous system disorders | 10013573 |
| 46 | principal | Fever | Febre | General disorders and administration site conditions | 10016558 |
| 47 | principal | Sepsis | Sepse [proxy para 'infecção' — o CTCAE não tem termo genérico 'Infection'] | Infections and infestations | 10040047 |
| 48 | principal | Infusion site extravasation | Extravasamento no local de infusão | General disorders and administration site conditions | 10064774 |
| 49 | principal | Photosensitivity | Fotossensibilidade | Skin and subcutaneous tissue disorders | 10034966 |
| 50 | principal | Paronychia | Paroníquia | Infections and infestations | 10034016 |
| 51 | complementar | Heart failure | Insuficiência cardíaca | Cardiac disorders | 10019279 |
| 52 | complementar | Acute kidney injury | Lesão renal aguda | Renal and urinary disorders | 10069339 |
| 53 | complementar | Diabetes mellitus | Diabetes mellitus | Metabolism and nutrition disorders | 10012601 |
| 54 | complementar | Weight gain | Ganho de peso | Investigations | 10047896 |
| 55 | complementar | Insomnia | Insônia | Psychiatric disorders | 10022437 |

## 5. Termos com graus 1–5 (texto oficial em inglês + tradução fiel)

### 1. Nausea — Náusea

- **SOC:** Gastrointestinal disorders (Distúrbios gastrointestinais) · **LLT MedDRA:** 10028813 · **Mudança v6.0:** Addition: Navigational Note; Clarification: Grade 2
- **Definição (EN):** A disorder characterized by a queasy sensation and/or the urge to vomit.
- **Definição (PT):** Distúrbio caracterizado por sensação de enjoo e/ou vontade de vomitar.
- **Nota de navegação:** Consider Gastrointestinal disorders: Enterocolitis, Gastritis and/or Endocrine disorders: Adrenal insufficiency, Hypophysitis. — *Considerar Distúrbios gastrointestinais: Enterocolite, Gastrite e/ou Distúrbios endócrinos: Insuficiência adrenal, Hipofisite.*
- **Fármacos típicos associados (curadoria, não CTCAE):** Cisplatina, carboplatina, antraciclinas, ciclofosfamida, irinotecano; iPARP (olaparibe, niraparibe); trastuzumabe deruxtecana

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | Loss of appetite without alteration in eating habits | Perda de apetite sem alteração dos hábitos alimentares |
| 2 | Oral intake decreased without significant weight loss, dehydration or malnutrition; IV intervention indicated | Ingestão oral diminuída sem perda de peso significativa, desidratação ou desnutrição; intervenção IV indicada |
| 3 | Inadequate oral caloric or fluid intake; tube feeding, TPN, or hospitalization indicated | Ingestão oral calórica ou hídrica inadequada; alimentação por sonda, NPT ou hospitalização indicada |
| 4 | - | - |
| 5 | - | - |

### 2. Vomiting — Vômito

- **SOC:** Gastrointestinal disorders (Distúrbios gastrointestinais) · **LLT MedDRA:** 10047700 · **Mudança v6.0:** Addition: Navigational Note; Clarification: Grade 2, 3
- **Definição (EN):** A disorder characterized by the reflexive act of ejecting the contents of the stomach through the mouth.
- **Definição (PT):** Distúrbio caracterizado pelo ato reflexo de expelir o conteúdo do estômago pela boca.
- **Nota de navegação:** Consider Gastrointestinal disorders: Enterocolitis, Gastritis and/or Endocrine disorders: Adrenal insufficiency, Hypophysitis. — *Considerar Distúrbios gastrointestinais: Enterocolite, Gastrite e/ou Distúrbios endócrinos: Insuficiência adrenal, Hipofisite.*
- **Fármacos típicos associados (curadoria, não CTCAE):** Cisplatina, carboplatina, antraciclinas, ciclofosfamida, irinotecano; iPARP

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | Intervention not indicated | Intervenção não indicada |
| 2 | Initiation of outpatient IV hydration; medical intervention indicated | Início de hidratação IV ambulatorial; intervenção médica indicada |
| 3 | Initiation of tube feeding, or TPN; hospitalization indicated | Início de alimentação por sonda ou NPT; hospitalização indicada |
| 4 | Life-threatening consequences | Consequências com risco à vida |
| 5 | Death | Óbito |

### 3. Diarrhea — Diarreia

- **SOC:** Gastrointestinal disorders (Distúrbios gastrointestinais) · **LLT MedDRA:** 10012727 · **Mudança v6.0:** Addition: Navigational Note; Clarification: Grade 1, 2, 3
- **Definição (EN):** A disorder characterized by an increase in frequency and/or loose or watery bowel movements.
- **Definição (PT):** Distúrbio caracterizado por aumento da frequência e/ou evacuações amolecidas ou aquosas.
- **Nota de navegação:** Consider Gastrointestinal disorders: Colitis, Enterocolitis. — *Considerar Distúrbios gastrointestinais: Colite, Enterocolite.*
- **Fármacos típicos associados (curadoria, não CTCAE):** Irinotecano, 5-FU/capecitabina; TKIs anti-HER/EGFR (lapatinibe, neratinibe, afatinibe); abemaciclibe; ICI (avaliar colite)

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | Change in consistency or frequency | Alteração na consistência ou frequência |
| 2 | Increase of 4 - 6 stools per day over baseline; moderate increase in ostomy output compared to baseline; limiting instrumental ADL or mild/moderate impact on age-appropriate normal daily activity (pediatric); change in consistency or frequency AND limiting instrumental ADL or mild/moderate impact on age-appropriate normal daily activity (pediatric) | Aumento de 4 - 6 evacuações por dia em relação ao basal; aumento moderado do débito da ostomia em relação ao basal; limitando AVD instrumental ou impacto leve/moderado na atividade diária normal apropriada para a idade (pediátrico); alteração na consistência ou frequência E limitando AVD instrumental ou impacto leve/moderado na atividade diária normal apropriada para a idade (pediátrico) |
| 3 | Increase of >=7 stools per day over baseline; hospitalization indicated; severe increase in ostomy output compared to baseline; requires IV intervention; limiting self-care ADL or severe impact on age-appropriate normal daily activity (pediatric) | Aumento de >=7 evacuações por dia em relação ao basal; hospitalização indicada; aumento grave do débito da ostomia em relação ao basal; requer intervenção IV; limitando AVD de autocuidado ou impacto grave na atividade diária normal apropriada para a idade (pediátrico) |
| 4 | Life-threatening consequences; urgent intervention indicated | Consequências com risco à vida; intervenção urgente indicada |
| 5 | Death | Óbito |

### 4. Constipation — Constipação

- **SOC:** Gastrointestinal disorders (Distúrbios gastrointestinais) · **LLT MedDRA:** 10010774 · **Mudança v6.0:** Clarification: Grade 2, 3
- **Definição (EN):** A disorder characterized by irregular and infrequent or difficult evacuation of the bowels.
- **Definição (PT):** Distúrbio caracterizado por evacuação intestinal irregular e infrequente ou difícil.
- **Fármacos típicos associados (curadoria, não CTCAE):** Alcaloides da vinca (vinorelbina, vincristina); medicações de suporte (antagonistas 5-HT3, opioides)

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | Occasional or intermittent symptoms; occasional use of stool softeners, laxatives, dietary modification, or enema | Sintomas ocasionais ou intermitentes; uso ocasional de emolientes fecais, laxantes, modificação dietética ou enema |
| 2 | Persistent symptoms with regular use of laxatives or enemas; limiting instrumental ADL or mild/moderate impact on age-appropriate normal daily activity (pediatric) | Sintomas persistentes com uso regular de laxantes ou enemas; limitando AVD instrumental ou impacto leve/moderado na atividade diária normal apropriada para a idade (pediátrico) |
| 3 | Obstipation with manual evacuation indicated; limiting self-care ADL or severe impact on age-appropriate normal daily activity (pediatric) | Obstipação com indicação de evacuação manual; limitando AVD de autocuidado ou impacto grave na atividade diária normal apropriada para a idade (pediátrico) |
| 4 | Life-threatening consequences; urgent intervention indicated | Consequências com risco à vida; intervenção urgente indicada |
| 5 | Death | Óbito |

### 5. Mucositis oral — Mucosite oral

- **SOC:** Gastrointestinal disorders (Distúrbios gastrointestinais) · **LLT MedDRA:** 10028130 · **Mudança v6.0:** No Change
- **Definição (EN):** A disorder characterized by ulceration or inflammation of the oral mucosal.
- **Definição (PT):** Distúrbio caracterizado por ulceração ou inflamação da mucosa oral.
- **Fármacos típicos associados (curadoria, não CTCAE):** 5-FU (bolus), capecitabina, antraciclinas, docetaxel, metotrexato; everolimo (estomatite); afatinibe

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | Asymptomatic or mild symptoms; intervention not indicated | Assintomático ou sintomas leves; intervenção não indicada |
| 2 | Moderate pain or ulcer that does not interfere with oral intake; modified diet indicated | Dor moderada ou úlcera que não interfere na ingestão oral; dieta modificada indicada |
| 3 | Severe pain; interfering with oral intake | Dor intensa; interferindo na ingestão oral |
| 4 | Life-threatening consequences; urgent intervention indicated | Consequências com risco à vida; intervenção urgente indicada |
| 5 | Death | Óbito |

### 6. Anorexia — Anorexia (perda de apetite)

- **SOC:** Metabolism and nutrition disorders (Distúrbios do metabolismo e da nutrição) · **LLT MedDRA:** 10002646 · **Mudança v6.0:** No Change
- **Definição (EN):** A disorder characterized by a loss of appetite.
- **Definição (PT):** Distúrbio caracterizado por perda de apetite.
- **Fármacos típicos associados (curadoria, não CTCAE):** Cisplatina; TKIs multialvo (sunitinibe, cabozantinibe, lenvatinibe); ICI (descartar insuficiência adrenal/hipofisite)

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | Loss of appetite without alteration in eating habits | Perda de apetite sem alteração dos hábitos alimentares |
| 2 | Oral intake altered without significant weight loss or malnutrition; oral nutritional supplements indicated | Ingestão oral alterada sem perda de peso significativa ou desnutrição; suplementos nutricionais orais indicados |
| 3 | Associated with significant weight loss or malnutrition (e.g., inadequate oral caloric and/or fluid intake); tube feeding or TPN indicated | Associada a perda de peso significativa ou desnutrição (p. ex., ingestão oral calórica e/ou hídrica inadequada); alimentação por sonda ou NPT indicada |
| 4 | Life-threatening consequences; urgent intervention indicated | Consequências com risco à vida; intervenção urgente indicada |
| 5 | Death | Óbito |

### 7. Fatigue — Fadiga

- **SOC:** General disorders and administration site conditions (Distúrbios gerais e condições no local de administração) · **LLT MedDRA:** 10016256 · **Mudança v6.0:** Addition: Navigational Note; Clarification: Grade 2, 3
- **Definição (EN):** A disorder characterized by a state of generalized weakness with a pronounced inability to summon sufficient energy to accomplish daily activities.
- **Definição (PT):** Distúrbio caracterizado por um estado de fraqueza generalizada com acentuada incapacidade de reunir energia suficiente para realizar as atividades diárias.
- **Nota de navegação:** Record final diagnosis/cause once determined. — *Registrar o diagnóstico/causa final quando determinado.*
- **Fármacos típicos associados (curadoria, não CTCAE):** Quimioterapia citotóxica em geral; TKIs anti-VEGFR; ICI; abiraterona, enzalutamida

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | Fatigue relieved by rest | Fadiga aliviada pelo repouso |
| 2 | Fatigue not relieved by rest; limiting instrumental ADL or mild/moderate impact on age-appropriate normal daily activity (pediatric) | Fadiga não aliviada pelo repouso; limitando AVD instrumental ou impacto leve/moderado na atividade diária normal apropriada para a idade (pediátrico) |
| 3 | Fatigue not relieved by rest, limiting self-care ADL or severe impact on age-appropriate normal daily activity (pediatric) | Fadiga não aliviada pelo repouso, limitando AVD de autocuidado ou impacto grave na atividade diária normal apropriada para a idade (pediátrico) |
| 4 | - | - |
| 5 | - | - |

### 8. Alopecia — Alopecia

- **SOC:** Skin and subcutaneous tissue disorders (Distúrbios da pele e do tecido subcutâneo) · **LLT MedDRA:** 10001760 · **Mudança v6.0:** No Change
- **Definição (EN):** A disorder characterized by a decrease in density of hair compared to normal for a given individual at a given age and body location.
- **Definição (PT):** Distúrbio caracterizado por diminuição da densidade de cabelos/pelos em comparação ao normal para um dado indivíduo em determinada idade e localização corporal.
- **Fármacos típicos associados (curadoria, não CTCAE):** Taxanos (paclitaxel, docetaxel), antraciclinas, ciclofosfamida, irinotecano, etoposídeo

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | Hair loss of <50% of normal for that individual that is not obvious from a distance but only on close inspection; a different hair style may be required to cover the hair loss but it does not require a wig or hair piece to camouflage | Perda de cabelo/pelos <50% do normal para o indivíduo, que não é evidente à distância, apenas à inspeção próxima; pode ser necessário um penteado diferente para disfarçar a perda, mas não requer peruca ou aplique para camuflá-la |
| 2 | Hair loss of >=50% normal for that individual that is readily apparent to others; a wig or hair piece is necessary if the patient desires to completely camouflage the hair loss; associated with psychosocial impact | Perda de cabelo/pelos >=50% do normal para o indivíduo, facilmente perceptível por outros; peruca ou aplique é necessário se o paciente desejar camuflar completamente a perda; associada a impacto psicossocial |
| 3 | - | - |
| 4 | - | - |
| 5 | - | - |

### 9. Peripheral sensory neuropathy — Neuropatia sensitiva periférica

- **SOC:** Nervous system disorders (Distúrbios do sistema nervoso) · **LLT MedDRA:** 10034620 · **Mudança v6.0:** Clarification: Grade 1, 2, 3
- **Definição (EN):** A disorder characterized by damage or dysfunction of the peripheral sensory nerves.
- **Definição (PT):** Distúrbio caracterizado por dano ou disfunção dos nervos sensitivos periféricos.
- **Fármacos típicos associados (curadoria, não CTCAE):** Oxaliplatina, cisplatina, paclitaxel, nab-paclitaxel, docetaxel, eribulina, vinorelbina; enfortumabe vedotina

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | Mild symptoms | Sintomas leves |
| 2 | Moderate symptoms; limiting instrumental ADL or mild/moderate impact on age-appropriate normal daily activity (pediatric) | Sintomas moderados; limitando AVD instrumental ou impacto leve/moderado na atividade diária normal apropriada para a idade (pediátrico) |
| 3 | Severe symptoms; limiting self-care ADL or severe impact on age-appropriate normal daily activity (pediatric) | Sintomas graves; limitando AVD de autocuidado ou impacto grave na atividade diária normal apropriada para a idade (pediátrico) |
| 4 | Life-threatening consequences; urgent intervention indicated | Consequências com risco à vida; intervenção urgente indicada |
| 5 | - | - |

### 10. Palmar-plantar erythrodysesthesia syndrome — Síndrome de eritrodisestesia palmoplantar (síndrome mão-pé)

- **SOC:** Skin and subcutaneous tissue disorders (Distúrbios da pele e do tecido subcutâneo) · **LLT MedDRA:** 10054524 · **Mudança v6.0:** Clarification: Grade 2, 3
- **Definição (EN):** A disorder characterized by redness, marked discomfort, swelling, and tingling in the palms of the hands or the soles of the feet. Also known as Hand-Foot Syndrome.
- **Definição (PT):** Distúrbio caracterizado por vermelhidão, desconforto acentuado, inchaço e formigamento nas palmas das mãos ou plantas dos pés. Também conhecida como síndrome mão-pé.
- **Fármacos típicos associados (curadoria, não CTCAE):** Capecitabina, 5-FU infusional, doxorrubicina lipossomal; TKIs multialvo (sorafenibe, regorafenibe, sunitinibe, cabozantinibe — reação mão-pé)

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | Minimal skin changes or dermatitis (e.g., erythema, edema, or hyperkeratosis) without pain | Alterações cutâneas mínimas ou dermatite (p. ex., eritema, edema ou hiperceratose) sem dor |
| 2 | Skin changes (e.g., peeling, blisters, bleeding, fissures, edema, or hyperkeratosis) with pain; limiting instrumental ADL or mild/moderate impact on age-appropriate normal daily activity (pediatric) | Alterações cutâneas (p. ex., descamação, bolhas, sangramento, fissuras, edema ou hiperceratose) com dor; limitando AVD instrumental ou impacto leve/moderado na atividade diária normal apropriada para a idade (pediátrico) |
| 3 | Severe skin changes (e.g., peeling, blisters, bleeding, fissures, edema, or hyperkeratosis) with pain; limiting self-care ADL or severe impact on age-appropriate normal daily activity (pediatric) | Alterações cutâneas graves (p. ex., descamação, bolhas, sangramento, fissuras, edema ou hiperceratose) com dor; limitando AVD de autocuidado ou impacto grave na atividade diária normal apropriada para a idade (pediátrico) |
| 4 | - | - |
| 5 | - | - |

### 11. Rash maculo-papular — Erupção (rash) maculopapular [substitui 'Rash acneiform' da v5.0]

- **SOC:** Skin and subcutaneous tissue disorders (Distúrbios da pele e do tecido subcutâneo) · **LLT MedDRA:** 10037868 · **Mudança v6.0:** Addition: Grade 4, 5, Navigational Note; Clarification: Grade 1, 2, 3, Definition
- **Definição (EN):** A disorder characterized by the presence of macules (flat) and papules (elevated). Also known as morbilliform rash, it is one of the most common cutaneous adverse events, frequently affecting the upper trunk, spreading centripetally and associated with pruritis.
- **Definição (PT):** Distúrbio caracterizado pela presença de máculas (planas) e pápulas (elevadas). Também conhecida como erupção morbiliforme, é um dos eventos adversos cutâneos mais comuns, afetando frequentemente a parte superior do tronco, com disseminação centrípeta, e associada a prurido.
- **Nota de navegação:** Consider Skin and subcutaneous tissue disorders: Pustular drug eruption. — *Considerar Distúrbios da pele e do tecido subcutâneo: Erupção pustulosa por fármaco (Pustular drug eruption).*
- **Fármacos típicos associados (curadoria, não CTCAE):** ICI; anti-EGFR (cetuximabe, panitumumabe) e TKIs EGFR (erlotinibe, gefitinibe, afatinibe, osimertinibe) — o termo v5.0 'Rash acneiform' foi excluído e mapeado oficialmente para este termo

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | Asymptomatic | Assintomático |
| 2 | Mild symptoms | Sintomas leves |
| 3 | Macules/papules covering >50% BSA; moderate or severe symptoms | Máculas/pápulas cobrindo >50% da SC; sintomas moderados ou graves |
| 4 | Life-threatening consequences; urgent intervention indicated | Consequências com risco à vida; intervenção urgente indicada |
| 5 | Death | Óbito |

### 12. Pruritus — Prurido

- **SOC:** Skin and subcutaneous tissue disorders (Distúrbios da pele e do tecido subcutâneo) · **LLT MedDRA:** 10037087 · **Mudança v6.0:** Clarification: Grade 2, 3
- **Definição (EN):** A disorder characterized by an intense itching sensation.
- **Definição (PT):** Distúrbio caracterizado por sensação intensa de coceira.
- **Fármacos típicos associados (curadoria, não CTCAE):** ICI; anti-EGFR; TKIs EGFR

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | Mild or localized; topical intervention indicated | Leve ou localizado; intervenção tópica indicada |
| 2 | Widespread and intermittent; skin changes from scratching (e.g., edema, papulation, excoriations, lichenification, oozing/crusts); oral intervention indicated; limiting instrumental ADL or mild/moderate impact on age-appropriate normal daily activity (pediatric) | Disseminado e intermitente; alterações cutâneas por coçadura (p. ex., edema, papulação, escoriações, liquenificação, exsudação/crostas); intervenção oral indicada; limitando AVD instrumental ou impacto leve/moderado na atividade diária normal apropriada para a idade (pediátrico) |
| 3 | Widespread and constant; systemic corticosteroid or immunosuppressive therapy indicated; limiting sleep or self-care ADL or severe impact on age-appropriate normal daily activity (pediatric) | Disseminado e constante; corticosteroide sistêmico ou terapia imunossupressora indicados; limitando o sono ou AVD de autocuidado ou impacto grave na atividade diária normal apropriada para a idade (pediátrico) |
| 4 | - | - |
| 5 | - | - |

### 13. Neutrophil count decreased — Contagem de neutrófilos diminuída (neutropenia)

- **SOC:** Investigations (Investigações (exames)) · **LLT MedDRA:** 10029366 · **Mudança v6.0:** Clarification: Grade 1, 2, 3, 4, Definition
- **Definição (EN):** A finding based on laboratory test results that indicate a decrease in number of neutrophils (ANC) in a blood specimen.
- **Definição (PT):** Achado baseado em resultados laboratoriais que indicam diminuição do número de neutrófilos (CAN) em uma amostra de sangue.
- **Fármacos típicos associados (curadoria, não CTCAE):** Docetaxel, paclitaxel, antraciclinas, ciclofosfamida, irinotecano, topotecano, gencitabina, carboplatina; inibidores de CDK4/6 (palbociclibe, ribociclibe)

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | <1500 - 1000/mm3; <1.5 - 1.0 x 10^9/L | <1500 - 1000/mm3; <1.5 - 1.0 x 10^9/L |
| 2 | <1000 - 500/mm3; <1.0 - 0.5 x 10^9/L | <1000 - 500/mm3; <1.0 - 0.5 x 10^9/L |
| 3 | <500 - 100/mm3; <0.5 - 0.1 x 10^9/L | <500 - 100/mm3; <0.5 - 0.1 x 10^9/L |
| 4 | <100/mm3; <0.1 x 10^9/L | <100/mm3; <0.1 x 10^9/L |
| 5 | - | - |

### 14. Anemia — Anemia

- **SOC:** Blood and lymphatic system disorders (Distúrbios do sangue e do sistema linfático) · **LLT MedDRA:** 10002272 · **Mudança v6.0:** Clarification: Grade 2
- **Definição (EN):** A disorder characterized by a reduction in the amount of hemoglobin in 100 ml of blood. Signs and symptoms of anemia may include pallor of the skin and mucous membranes, shortness of breath, palpitations of the heart, soft systolic murmurs, lethargy, and fatigability.
- **Definição (PT):** Distúrbio caracterizado por redução da quantidade de hemoglobina em 100 ml de sangue. Sinais e sintomas de anemia podem incluir palidez da pele e das mucosas, falta de ar, palpitações, sopros sistólicos suaves, letargia e fatigabilidade.
- **Fármacos típicos associados (curadoria, não CTCAE):** Platinas, gencitabina; iPARP (olaparibe, niraparibe); quimioterapia citotóxica em geral

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | Hemoglobin (Hgb) <LLN - 10.0 g/dL; <LLN - 6.2 mmol/L; <LLN - 100 g/L | Hemoglobina (Hb) <LIN - 10.0 g/dL; <LIN - 6.2 mmol/L; <LIN - 100 g/L |
| 2 | Hgb <10.0 - 8.0 g/dL; <6.2 - 4.9 mmol/L; <100 - 80 g/L | Hb <10.0 - 8.0 g/dL; <6.2 - 4.9 mmol/L; <100 - 80 g/L |
| 3 | Hgb <8.0 g/dL; <4.9 mmol/L; <80 g/L; transfusion indicated | Hb <8.0 g/dL; <4.9 mmol/L; <80 g/L; transfusão indicada |
| 4 | Life-threatening consequences; urgent intervention indicated | Consequências com risco à vida; intervenção urgente indicada |
| 5 | Death | Óbito |

### 15. Thrombocytopenia — Trombocitopenia (plaquetopenia) [substitui 'Platelet count decreased' da v5.0]

- **SOC:** Blood and lymphatic system disorders (Distúrbios do sangue e do sistema linfático) · **LLT MedDRA:** 10043554 · **Mudança v6.0:** Addition: Term
- **Definição (EN):** A disorder characterized by a decrease in number of platelets in a blood specimen.
- **Definição (PT):** Distúrbio caracterizado por diminuição do número de plaquetas em uma amostra de sangue.
- **Fármacos típicos associados (curadoria, não CTCAE):** Carboplatina, gencitabina; niraparibe; trastuzumabe entansina; temozolomida

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | <LLN - 75,000/mm3; <LLN - 75.0 x 10^9/L | <LIN - 75,000/mm3; <LIN - 75.0 x 10^9/L |
| 2 | <75,000 - 50,000/mm3; <75.0 - 50.0 x 10^9/L | <75,000 - 50,000/mm3; <75.0 - 50.0 x 10^9/L |
| 3 | <50,000 - 10,000/mm3; <50.0 - 10.0 x 10^9/L; transfusion indicated | <50,000 - 10,000/mm3; <50.0 - 10.0 x 10^9/L; transfusão indicada |
| 4 | <10,000/mm3; <10.0 x 10^9/L; life-threatening consequences; urgent intervention indicated | <10,000/mm3; <10.0 x 10^9/L; consequências com risco à vida; intervenção urgente indicada |
| 5 | Death | Óbito |

### 16. Febrile neutropenia — Neutropenia febril

- **SOC:** Blood and lymphatic system disorders (Distúrbios do sangue e do sistema linfático) · **LLT MedDRA:** 10016288 · **Mudança v6.0:** Clarification: Definition
- **Definição (EN):** A disorder characterized by an ANC <1000/mm3 and a single temperature of >38.3 degrees C (101 degrees F) or a sustained temperature of >=38 degrees C (100.4 degrees F) for more than one hour.
- **Definição (PT):** Distúrbio caracterizado por CAN <1000/mm3 e temperatura única >38.3 graus C (101 graus F) ou temperatura sustentada >=38 graus C (100.4 graus F) por mais de uma hora.
- **Fármacos típicos associados (curadoria, não CTCAE):** Docetaxel; esquemas com antraciclina + taxano (p. ex., TAC); FOLFIRINOX; topotecano

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | - | - |
| 2 | - | - |
| 3 | ANC <1000/mm3 with a single temperature of >38.3 degrees C (101 degrees F) or a sustained temperature of >=38 degrees C (100.4 degrees F) for more than one hour | CAN <1000/mm3 com temperatura única >38.3 graus C (101 graus F) ou temperatura sustentada >=38 graus C (100.4 graus F) por mais de uma hora |
| 4 | Life-threatening consequences; urgent intervention indicated | Consequências com risco à vida; intervenção urgente indicada |
| 5 | Death | Óbito |

### 17. Hypomagnesemia — Hipomagnesemia

- **SOC:** Metabolism and nutrition disorders (Distúrbios do metabolismo e da nutrição) · **LLT MedDRA:** 10021028 · **Mudança v6.0:** No Change
- **Definição (EN):** A disorder characterized by laboratory test results that indicate a low concentration of magnesium in the blood.
- **Definição (PT):** Distúrbio caracterizado por resultados laboratoriais que indicam baixa concentração de magnésio no sangue.
- **Fármacos típicos associados (curadoria, não CTCAE):** Cetuximabe, panitumumabe; cisplatina

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | <LLN - 1.2 mg/dL; <LLN - 0.5 mmol/L | <LIN - 1.2 mg/dL; <LIN - 0.5 mmol/L |
| 2 | <1.2 - 0.9 mg/dL; <0.5 - 0.4 mmol/L | <1.2 - 0.9 mg/dL; <0.5 - 0.4 mmol/L |
| 3 | <0.9 - 0.7 mg/dL; <0.4 - 0.3 mmol/L | <0.9 - 0.7 mg/dL; <0.4 - 0.3 mmol/L |
| 4 | <0.7 mg/dL; <0.3 mmol/L; life-threatening consequences | <0.7 mg/dL; <0.3 mmol/L; consequências com risco à vida |
| 5 | Death | Óbito |

### 18. Hypokalemia — Hipocalemia

- **SOC:** Metabolism and nutrition disorders (Distúrbios do metabolismo e da nutrição) · **LLT MedDRA:** 10021018 · **Mudança v6.0:** No Change
- **Definição (EN):** A disorder characterized by laboratory test results that indicate a low concentration of potassium in the blood.
- **Definição (PT):** Distúrbio caracterizado por resultados laboratoriais que indicam baixa concentração de potássio no sangue.
- **Fármacos típicos associados (curadoria, não CTCAE):** Cisplatina (perda tubular); diarreia por irinotecano/fluoropirimidinas; abiraterona (excesso mineralocorticoide)

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | <LLN - 3.0 mmol/L | <LIN - 3.0 mmol/L |
| 2 | Symptomatic with <LLN - 3.0 mmol/L; intervention indicated | Sintomático com <LIN - 3.0 mmol/L; intervenção indicada |
| 3 | <3.0 - 2.5 mmol/L; hospitalization indicated | <3.0 - 2.5 mmol/L; hospitalização indicada |
| 4 | <2.5 mmol/L; life-threatening consequences | <2.5 mmol/L; consequências com risco à vida |
| 5 | Death | Óbito |

### 19. Hyponatremia — Hiponatremia

- **SOC:** Metabolism and nutrition disorders (Distúrbios do metabolismo e da nutrição) · **LLT MedDRA:** 10021038 · **Mudança v6.0:** Clarification: Grade 2, 3
- **Definição (EN):** A disorder characterized by laboratory test results that indicate a low concentration of sodium in the blood.
- **Definição (PT):** Distúrbio caracterizado por resultados laboratoriais que indicam baixa concentração de sódio no sangue.
- **Fármacos típicos associados (curadoria, não CTCAE):** Cisplatina; ciclofosfamida e alcaloides da vinca (SIADH); ICI (insuficiência adrenal/hipofisite)

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | <LLN - 130 mmol/L | <LIN - 130 mmol/L |
| 2 | 125 - <130 mmol/L and asymptomatic | 125 - <130 mmol/L e assintomático |
| 3 | 125 - <130 mmol/L symptomatic; 120 - <125 mmol/L regardless of symptoms | 125 - <130 mmol/L sintomático; 120 - <125 mmol/L independentemente dos sintomas |
| 4 | <120 mmol/L; life-threatening consequences | <120 mmol/L; consequências com risco à vida |
| 5 | Death | Óbito |

### 20. Creatinine increased — Creatinina aumentada

- **SOC:** Investigations (Investigações (exames)) · **LLT MedDRA:** 10011368 · **Mudança v6.0:** Clarification: Grade 2, 3, Navigational Note
- **Definição (EN):** A finding based on laboratory test results that indicate increased levels of creatinine in a biological specimen.
- **Definição (PT):** Achado baseado em resultados laboratoriais que indicam níveis aumentados de creatinina em uma amostra biológica.
- **Nota de navegação:** Consider Renal and urinary disorders: Acute kidney injury, Glomerulonephritis, Tubulointerstitial nephritis. — *Considerar Distúrbios renais e urinários: Lesão renal aguda, Glomerulonefrite, Nefrite tubulointersticial.*
- **Fármacos típicos associados (curadoria, não CTCAE):** Cisplatina, pemetrexede, ifosfamida, metotrexato em alta dose; ICI (nefrite); ácido zoledrônico

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | >ULN - 1.5 x ULN | >LSN - 1.5 x LSN |
| 2 | >1.5 - 3.0 x baseline if baseline is below LLN; >1.5 - 3.0 x ULN | >1.5 - 3.0 x o basal se o basal estiver abaixo do LIN; >1.5 - 3.0 x LSN |
| 3 | >3.0 x baseline if baseline is below LLN; >3.0 - 6.0 x ULN | >3.0 x o basal se o basal estiver abaixo do LIN; >3.0 - 6.0 x LSN |
| 4 | >6.0 x ULN | >6.0 x LSN |
| 5 | - | - |

### 21. Alanine aminotransferase increased — Alanina aminotransferase (ALT/TGP) aumentada

- **SOC:** Investigations (Investigações (exames)) · **LLT MedDRA:** 10001551 · **Mudança v6.0:** Clarification: Grade 1, 2, 3, 4, Navigational Note
- **Definição (EN):** A finding based on laboratory test results that indicate an increase in the level of alanine aminotransferase (ALT or SGPT) in the blood specimen.
- **Definição (PT):** Achado baseado em resultados laboratoriais que indicam aumento do nível de alanina aminotransferase (ALT ou TGP) na amostra de sangue.
- **Nota de navegação:** Consider Hepatobiliary disorders: Hepatic failure. Report Autoimmune hepatitis under Hepatobiliary disorders: Other, specify. — *Considerar Distúrbios hepatobiliares: Insuficiência hepática. Notificar hepatite autoimune em Distúrbios hepatobiliares: Outro, especificar.*
- **Fármacos típicos associados (curadoria, não CTCAE):** ICI (hepatite imunomediada); pazopanibe, lapatinibe, regorafenibe; trastuzumabe entansina

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | >ULN - 3.0 x ULN if baseline was normal or less than normal; 1.0 - 1.5 x baseline if baseline was >ULN | >LSN - 3.0 x LSN se o basal era normal ou abaixo do normal; 1.0 - 1.5 x o basal se o basal era >LSN |
| 2 | >3.0 - 5.0 x ULN if baseline was normal or less than normal; >1.5 - 2.0 x baseline if baseline was >ULN | >3.0 - 5.0 x LSN se o basal era normal ou abaixo do normal; >1.5 - 2.0 x o basal se o basal era >LSN |
| 3 | >5.0 - 20.0 x ULN if baseline was normal or less than normal; >2.0 - 4.0 x baseline if baseline was >ULN up to 5 x ULN | >5.0 - 20.0 x LSN se o basal era normal ou abaixo do normal; >2.0 - 4.0 x o basal se o basal era >LSN, até 5 x LSN |
| 4 | >20.0 x ULN if baseline was normal or less than normal; >4.0 x baseline if baseline was >ULN | >20.0 x LSN se o basal era normal ou abaixo do normal; >4.0 x o basal se o basal era >LSN |
| 5 | - | - |

### 22. Aspartate aminotransferase increased — Aspartato aminotransferase (AST/TGO) aumentada

- **SOC:** Investigations (Investigações (exames)) · **LLT MedDRA:** 10003481 · **Mudança v6.0:** Clarification: Grade 1, 2, 3, 4, Navigational Note
- **Definição (EN):** A finding based on laboratory test results that indicate an increase in the level of aspartate aminotransferase (AST or SGOT) in a blood specimen.
- **Definição (PT):** Achado baseado em resultados laboratoriais que indicam aumento do nível de aspartato aminotransferase (AST ou TGO) em uma amostra de sangue.
- **Nota de navegação:** Consider Hepatobiliary disorders: Hepatic failure. Report Autoimmune hepatitis under Hepatobiliary disorders: Other, specify. — *Considerar Distúrbios hepatobiliares: Insuficiência hepática. Notificar hepatite autoimune em Distúrbios hepatobiliares: Outro, especificar.*
- **Fármacos típicos associados (curadoria, não CTCAE):** ICI (hepatite imunomediada); pazopanibe, lapatinibe, regorafenibe; trastuzumabe entansina

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | >ULN - 3.0 x ULN if baseline was normal or less than normal; 1.0 - 1.5 x baseline if baseline was >ULN | >LSN - 3.0 x LSN se o basal era normal ou abaixo do normal; 1.0 - 1.5 x o basal se o basal era >LSN |
| 2 | >3.0 - 5.0 x ULN if baseline was normal or less than normal; >1.5 - 2.0 x baseline if baseline was >ULN | >3.0 - 5.0 x LSN se o basal era normal ou abaixo do normal; >1.5 - 2.0 x o basal se o basal era >LSN |
| 3 | >5.0 - 20.0 x ULN if baseline was normal or less than normal; >2.0 - 4.0 x baseline if baseline was >ULN up to 5 x ULN | >5.0 - 20.0 x LSN se o basal era normal ou abaixo do normal; >2.0 - 4.0 x o basal se o basal era >LSN, até 5 x LSN |
| 4 | >20.0 x ULN if baseline was normal or less than normal; >4.0 x baseline if baseline was >ULN | >20.0 x LSN se o basal era normal ou abaixo do normal; >4.0 x o basal se o basal era >LSN |
| 5 | - | - |

### 23. Blood bilirubin increased — Bilirrubina sanguínea aumentada

- **SOC:** Investigations (Investigações (exames)) · **LLT MedDRA:** 10005364 · **Mudança v6.0:** Clarification: Grade 1, 2, 3, 4, Definition, Navigational Note
- **Definição (EN):** A finding based on laboratory test results that indicate an abnormally high level of total bilirubin in the blood. Excess bilirubin is associated with jaundice.
- **Definição (PT):** Achado baseado em resultados laboratoriais que indicam nível anormalmente elevado de bilirrubina total no sangue. O excesso de bilirrubina está associado a icterícia.
- **Nota de navegação:** Consider Hepatobiliary disorders: Hepatic failure. Report Autoimmune hepatitis under Hepatobiliary disorders: Other, specify. — *Considerar Distúrbios hepatobiliares: Insuficiência hepática. Notificar hepatite autoimune em Distúrbios hepatobiliares: Outro, especificar.*
- **Fármacos típicos associados (curadoria, não CTCAE):** Pazopanibe, regorafenibe; ICI (hepatite imunomediada)

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | >ULN - 1.5 x ULN if baseline was normal or less than normal; 1.0 - 1.5 x baseline if baseline was >ULN | >LSN - 1.5 x LSN se o basal era normal ou abaixo do normal; 1.0 - 1.5 x o basal se o basal era >LSN |
| 2 | >1.5 - 3.0 x ULN if baseline was normal or less than normal; >1.5 - 2.5 x baseline if baseline was >ULN | >1.5 - 3.0 x LSN se o basal era normal ou abaixo do normal; >1.5 - 2.5 x o basal se o basal era >LSN |
| 3 | >3.0 - 10.0 x ULN if baseline was normal or less than normal; >2.5 - 10.0 x baseline if baseline was >ULN | >3.0 - 10.0 x LSN se o basal era normal ou abaixo do normal; >2.5 - 10.0 x o basal se o basal era >LSN |
| 4 | >10.0 x ULN if baseline was normal or less than normal; >10.0 x baseline if baseline was >ULN | >10.0 x LSN se o basal era normal ou abaixo do normal; >10.0 x o basal se o basal era >LSN |
| 5 | - | - |

### 24. Hypertension — Hipertensão arterial

- **SOC:** Vascular disorders (Distúrbios vasculares) · **LLT MedDRA:** 10020772 · **Mudança v6.0:** Clarification: Grade 2, 3, 4; Deletion: Grade 1
- **Definição (EN):** A disorder characterized by a pathological increase in blood pressure.
- **Definição (PT):** Distúrbio caracterizado por aumento patológico da pressão arterial.
- **Fármacos típicos associados (curadoria, não CTCAE):** Bevacizumabe, ramucirumabe; TKIs anti-VEGFR (sunitinibe, pazopanibe, sorafenibe, regorafenibe, cabozantinibe, lenvatinibe, axitinibe); abiraterona

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | - | - |
| 2 | Adult: Systolic BP 140 - 159 mmHg or diastolic BP 90 - 99 mmHg; recurrent or persistent;  Pediatric and adolescent: Recurrent or persistent (>=24 hrs) BP >ULN; monotherapy indicated; systolic and /or diastolic BP between the 95th percentile and 5 mmHg above the 99th percentile;  Adolescent: Systolic between 130 - 139 or diastolic between 80 - 89 even if <95th percentile | Adulto: PA sistólica 140 - 159 mmHg ou PA diastólica 90 - 99 mmHg; recorrente ou persistente; Pediátrico e adolescente: PA >LSN recorrente ou persistente (>=24 h); monoterapia indicada; PA sistólica e/ou diastólica entre o percentil 95 e 5 mmHg acima do percentil 99; Adolescente: sistólica entre 130 - 139 ou diastólica entre 80 - 89 mesmo se <percentil 95 |
| 3 | Adult: Systolic BP 160 - 179 mmHg or diastolic BP 100 - 109 mmHg persisting over 1 hour; SBP >140 and plus either increase in SBP >20 mmHg or increase MAP >15 mmHg from baseline;  Pediatric and adolescent: Systolic and/or diastolic >5 mmHg above the 99th percentile | Adulto: PA sistólica 160 - 179 mmHg ou PA diastólica 100 - 109 mmHg persistindo por mais de 1 hora; PAS >140 e mais aumento da PAS >20 mmHg ou aumento da PAM >15 mmHg em relação ao basal; Pediátrico e adolescente: sistólica e/ou diastólica >5 mmHg acima do percentil 99 |
| 4 | Adult and Pediatric: SBP≥180 or DBP ≥110 mmHg persisting over 1 hour; BP associated with acute hypertension mediated organ damage; life-threatening consequences (e.g., malignant hypertension, transient or permanent neurologic deficit, hypertensive crisis); urgent intervention indicated | Adulto e pediátrico: PAS >=180 ou PAD >=110 mmHg persistindo por mais de 1 hora; PA associada a lesão aguda de órgão-alvo mediada por hipertensão; consequências com risco à vida (p. ex., hipertensão maligna, déficit neurológico transitório ou permanente, crise hipertensiva); intervenção urgente indicada |
| 5 | Death | Óbito |

### 25. Venous thromboembolism — Tromboembolismo venoso [substitui 'Thromboembolic event' da v5.0]

- **SOC:** Vascular disorders (Distúrbios vasculares) · **LLT MedDRA:** 10066899 · **Mudança v6.0:** Addition: Term
- **Definição (EN):** A disorder characterized by occlusion of a vessel by a thrombus that has migrated from a distal site via the blood stream (for example, deep vein thrombosis (DVT), pulmonary embolism (PE), etc.).
- **Definição (PT):** Distúrbio caracterizado por oclusão de um vaso por um trombo que migrou de um local distal através da corrente sanguínea (por exemplo, trombose venosa profunda (TVP), embolia pulmonar (EP) etc.).
- **Nota de navegação:** Consider Nervous system disorders: Stroke, Transient ischemic attacks for CNS-related events. Use Vascular disorders: Arterial thromboembolism for arterial thrombi. Use Injury, poisoning and procedural complications: Vascular access complication if related to a catheter. — *Considerar Distúrbios do sistema nervoso: AVC, Ataques isquêmicos transitórios para eventos relacionados ao SNC. Usar Distúrbios vasculares: Tromboembolismo arterial para trombos arteriais. Usar Lesões, intoxicações e complicações de procedimentos: Complicação de acesso vascular se relacionado a cateter.*
- **Fármacos típicos associados (curadoria, não CTCAE):** Cisplatina; tamoxifeno; bevacizumabe; (risco basal elevado pelo próprio câncer)

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | Medical intervention not indicated (e.g., superficial thrombosis) | Intervenção médica não indicada (p. ex., trombose superficial) |
| 2 | Medical intervention indicated | Intervenção médica indicada |
| 3 | Urgent medical intervention indicated | Intervenção médica urgente indicada |
| 4 | Life-threatening consequences with hemodynamic or neurologic instability | Consequências com risco à vida com instabilidade hemodinâmica ou neurológica |
| 5 | Death | Óbito |

### 26. Left ventricular dysfunction — Disfunção ventricular esquerda [absorve 'Ejection fraction decreased' da v5.0]

- **SOC:** Cardiac disorders (Distúrbios cardíacos) · **LLT MedDRA:** 10049694 · **Mudança v6.0:** Addition: Term
- **Definição (EN):** A disorder characterized by an ASYMPTOMATIC abnormality of cardiac function.
- **Definição (PT):** Distúrbio caracterizado por anormalidade ASSINTOMÁTICA da função cardíaca.
- **Nota de navegação:** If symptomatic, consider Cardiac disorders: Heart failure. — *Se sintomático, considerar Distúrbios cardíacos: Insuficiência cardíaca.*
- **Fármacos típicos associados (curadoria, não CTCAE):** Antraciclinas (doxorrubicina, epirrubicina); trastuzumabe, pertuzumabe, trastuzumabe entansina, trastuzumabe deruxtecana

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | Left ventricular ejection fraction (LVEF) ≥50% AND one or more of the following: 1) New relative decline in Global Longitudinal Strain (GLS) >15% from baseline 2) New rise in cardiac biomarkers | Fração de ejeção do ventrículo esquerdo (FEVE) >=50% E um ou mais dos seguintes: 1) Nova queda relativa do strain longitudinal global (SLG/GLS) >15% em relação ao basal; 2) Nova elevação de biomarcadores cardíacos |
| 2 | LVEF 40 - 49% AND one or more of the following: 1) LVEF reduction by ≥10% 2) New relative decline in GLS >15% from baseline 3) New rise in cardiac biomarkers | FEVE 40 - 49% E um ou mais dos seguintes: 1) Redução da FEVE >=10%; 2) Nova queda relativa do SLG >15% em relação ao basal; 3) Nova elevação de biomarcadores cardíacos |
| 3 | New LVEF reduction to <40% | Nova redução da FEVE para <40% |
| 4 | - | - |
| 5 | - | - |

### 27. Electrocardiogram QT corrected interval prolonged — Intervalo QT corrigido prolongado no eletrocardiograma

- **SOC:** Investigations (Investigações (exames)) · **LLT MedDRA:** 10014383 · **Mudança v6.0:** Addition: Navigational Note; Clarification: Grade 3, 4
- **Definição (EN):** A finding of a cardiac dysrhythmia characterized by an abnormally long corrected QT interval.
- **Definição (PT):** Achado de disritmia cardíaca caracterizada por intervalo QT corrigido anormalmente longo.
- **Nota de navegação:** Consider Cardiac disorders: Ventricular arrhythmia, Ventricular fibrillation, Ventricular tachycardia. — *Considerar Distúrbios cardíacos: Arritmia ventricular, Fibrilação ventricular, Taquicardia ventricular.*
- **Fármacos típicos associados (curadoria, não CTCAE):** Ribociclibe, vandetanibe, osimertinibe, pazopanibe, sunitinibe, lapatinibe; suporte: antagonistas 5-HT3 (ondansetrona)

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | Average QTc 450 - 480 ms | QTc médio 450 - 480 ms |
| 2 | Average QTc 481 - 500 ms | QTc médio 481 - 500 ms |
| 3 | Average QTc >500 ms; >60 ms change from baseline | QTc médio >500 ms; alteração >60 ms em relação ao basal |
| 4 | Life-threatening consequences; Torsade de pointes; polymorphic ventricular tachycardia | Consequências com risco à vida; torsade de pointes; taquicardia ventricular polimórfica |
| 5 | - | - |

### 28. Pneumonitis — Pneumonite

- **SOC:** Respiratory, thoracic and mediastinal disorders (Distúrbios respiratórios, torácicos e do mediastino) · **LLT MedDRA:** 10035742 · **Mudança v6.0:** Clarification: Grade 2, 3
- **Definição (EN):** A disorder characterized by inflammation focally or diffusely affecting the lung parenchyma.
- **Definição (PT):** Distúrbio caracterizado por inflamação que afeta focal ou difusamente o parênquima pulmonar.
- **Fármacos típicos associados (curadoria, não CTCAE):** ICI; trastuzumabe deruxtecana (DPI/pneumonite); TKIs EGFR (osimertinibe etc.); everolimo; gencitabina; bleomicina

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | Asymptomatic; clinical or diagnostic observations only; intervention not indicated | Assintomático; apenas observações clínicas ou diagnósticas; intervenção não indicada |
| 2 | Symptomatic; medical intervention indicated; limiting instrumental ADL or mild/moderate impact on age-appropriate normal daily activity (pediatric) | Sintomático; intervenção médica indicada; limitando AVD instrumental ou impacto leve/moderado na atividade diária normal apropriada para a idade (pediátrico) |
| 3 | Severe symptoms; oxygen indicated; limiting self-care ADL or severe impact on age-appropriate normal daily activity (pediatric) | Sintomas graves; oxigênio indicado; limitando AVD de autocuidado ou impacto grave na atividade diária normal apropriada para a idade (pediátrico) |
| 4 | Life-threatening respiratory compromise; urgent intervention indicated (e.g., tracheotomy or intubation) | Comprometimento respiratório com risco à vida; intervenção urgente indicada (p. ex., traqueostomia ou intubação) |
| 5 | Death | Óbito |

### 29. Colitis — Colite

- **SOC:** Gastrointestinal disorders (Distúrbios gastrointestinais) · **LLT MedDRA:** 10009887 · **Mudança v6.0:** No Change
- **Definição (EN):** A disorder characterized by inflammation of the colon.
- **Definição (PT):** Distúrbio caracterizado por inflamação do cólon.
- **Fármacos típicos associados (curadoria, não CTCAE):** ICI (anti-CTLA-4 > anti-PD-1/PD-L1)

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | Asymptomatic; clinical or diagnostic observations only; intervention not indicated | Assintomático; apenas observações clínicas ou diagnósticas; intervenção não indicada |
| 2 | Abdominal pain; mucus or blood in stool | Dor abdominal; muco ou sangue nas fezes |
| 3 | Severe abdominal pain; peritoneal signs | Dor abdominal intensa; sinais peritoneais |
| 4 | Life-threatening consequences; urgent intervention indicated | Consequências com risco à vida; intervenção urgente indicada |
| 5 | Death | Óbito |

### 30. Hypothyroidism — Hipotireoidismo

- **SOC:** Endocrine disorders (Distúrbios endócrinos) · **LLT MedDRA:** 10021114 · **Mudança v6.0:** Addition: Navigational Note; Clarification: Grade 2, 3
- **Definição (EN):** A disorder characterized by a decrease in production of thyroid hormone by the thyroid gland.
- **Definição (PT):** Distúrbio caracterizado por diminuição da produção de hormônio tireoidiano pela glândula tireoide.
- **Nota de navegação:** Consider Endocrine disorders: Hypophysitis. — *Considerar Distúrbios endócrinos: Hipofisite.*
- **Fármacos típicos associados (curadoria, não CTCAE):** ICI; TKIs anti-VEGFR (sunitinibe, lenvatinibe, cabozantinibe, axitinibe)

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | Asymptomatic; clinical or diagnostic observations only; intervention not indicated | Assintomático; apenas observações clínicas ou diagnósticas; intervenção não indicada |
| 2 | Symptomatic; thyroid replacement initiated; increase in current thyroid replacement therapy; limiting instrumental ADL or mild/moderate impact on age-appropriate normal daily activity (pediatric) | Sintomático; reposição de hormônio tireoidiano iniciada; aumento da terapia de reposição tireoidiana em curso; limitando AVD instrumental ou impacto leve/moderado na atividade diária normal apropriada para a idade (pediátrico) |
| 3 | Severe symptoms; hospitalization indicated; limiting self-care ADL or severe impact on age-appropriate normal daily activity (pediatric) | Sintomas graves; hospitalização indicada; limitando AVD de autocuidado ou impacto grave na atividade diária normal apropriada para a idade (pediátrico) |
| 4 | Life-threatening consequences; urgent intervention indicated | Consequências com risco à vida; intervenção urgente indicada |
| 5 | Death | Óbito |

### 31. Hyperthyroidism — Hipertireoidismo

- **SOC:** Endocrine disorders (Distúrbios endócrinos) · **LLT MedDRA:** 10020850 · **Mudança v6.0:** Clarification: Grade 2, 3
- **Definição (EN):** A disorder characterized by excessive levels of thyroid hormone in the body. Common causes include an overactive thyroid gland or thyroid hormone overdose.
- **Definição (PT):** Distúrbio caracterizado por níveis excessivos de hormônio tireoidiano no organismo. Causas comuns incluem glândula tireoide hiperativa ou superdosagem de hormônio tireoidiano.
- **Fármacos típicos associados (curadoria, não CTCAE):** ICI (fase tireotóxica de tireoidite)

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | Asymptomatic; clinical or diagnostic observations only; intervention not indicated | Assintomático; apenas observações clínicas ou diagnósticas; intervenção não indicada |
| 2 | Symptomatic; thyroid suppression therapy indicated; limiting instrumental ADL or mild/moderate impact on age-appropriate normal daily activity (pediatric) | Sintomático; terapia supressora da tireoide indicada; limitando AVD instrumental ou impacto leve/moderado na atividade diária normal apropriada para a idade (pediátrico) |
| 3 | Severe symptoms; hospitalization indicated; limiting self-care ADL or severe impact on age-appropriate normal daily activity (pediatric) | Sintomas graves; hospitalização indicada; limitando AVD de autocuidado ou impacto grave na atividade diária normal apropriada para a idade (pediátrico) |
| 4 | Life-threatening consequences; urgent intervention indicated | Consequências com risco à vida; intervenção urgente indicada |
| 5 | Death | Óbito |

### 32. Adrenal insufficiency — Insuficiência adrenal

- **SOC:** Endocrine disorders (Distúrbios endócrinos) · **LLT MedDRA:** 10001367 · **Mudança v6.0:** No Change
- **Definição (EN):** A disorder characterized by the adrenal cortex not producing enough of the hormone cortisol and in some cases, the hormone aldosterone. It may be due to a disorder of the adrenal cortex as in Addison's disease or primary adrenal insufficiency.
- **Definição (PT):** Distúrbio caracterizado pela produção insuficiente do hormônio cortisol e, em alguns casos, do hormônio aldosterona pelo córtex adrenal. Pode ser decorrente de um distúrbio do córtex adrenal, como na doença de Addison ou insuficiência adrenal primária.
- **Fármacos típicos associados (curadoria, não CTCAE):** ICI; suspensão abrupta de corticoterapia prolongada

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | Asymptomatic; clinical or diagnostic observations only; intervention not indicated | Assintomático; apenas observações clínicas ou diagnósticas; intervenção não indicada |
| 2 | Moderate symptoms; medical intervention indicated | Sintomas moderados; intervenção médica indicada |
| 3 | Severe symptoms; hospitalization indicated | Sintomas graves; hospitalização indicada |
| 4 | Life-threatening consequences; urgent intervention indicated | Consequências com risco à vida; intervenção urgente indicada |
| 5 | Death | Óbito |

### 33. Hypophysitis — Hipofisite

- **SOC:** Endocrine disorders (Distúrbios endócrinos) · **LLT MedDRA:** 10062767 · **Mudança v6.0:** Clarification: Grade 2, 3
- **Definição (EN):** A disorder characterized by inflammation and cellular infiltration of the pituitary gland.
- **Definição (PT):** Distúrbio caracterizado por inflamação e infiltração celular da hipófise.
- **Fármacos típicos associados (curadoria, não CTCAE):** Ipilimumabe (anti-CTLA-4) > anti-PD-1/PD-L1

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | Asymptomatic or mild symptoms; clinical or diagnostic observations only; intervention not indicated | Assintomático ou sintomas leves; apenas observações clínicas ou diagnósticas; intervenção não indicada |
| 2 | Moderate; minimal, local or noninvasive intervention indicated; limiting instrumental ADL or mild/moderate impact on age-appropriate normal daily activity (pediatric) | Moderado; intervenção mínima, local ou não invasiva indicada; limitando AVD instrumental ou impacto leve/moderado na atividade diária normal apropriada para a idade (pediátrico) |
| 3 | Severe or medically significant but not immediately life-threatening; hospitalization or prolongation of existing hospitalization indicated; limiting self-care ADL or severe impact on age-appropriate normal daily activity (pediatric) | Grave ou clinicamente significativo, mas sem risco imediato à vida; hospitalização ou prolongamento de hospitalização existente indicado; limitando AVD de autocuidado ou impacto grave na atividade diária normal apropriada para a idade (pediátrico) |
| 4 | Life-threatening consequences; urgent intervention indicated | Consequências com risco à vida; intervenção urgente indicada |
| 5 | Death | Óbito |

### 34. Hyperglycemia — Hiperglicemia

- **SOC:** Metabolism and nutrition disorders (Distúrbios do metabolismo e da nutrição) · **LLT MedDRA:** 10020639 · **Mudança v6.0:** Addition: Navigational Note; Deletion: Grade 5; Clarification: Grade 1, 2, 3, 4, Definition
- **Definição (EN):** A condition characterized by laboratory test results that indicate a confirmed, short lasting and unexpected elevation in the concentration of blood sugar (glycemia).
- **Definição (PT):** Condição caracterizada por resultados laboratoriais que indicam elevação confirmada, de curta duração e inesperada da concentração de açúcar no sangue (glicemia).
- **Nota de navegação:** Consider Metabolism and nutrition disorders: Diabetes mellitus. — *Considerar Distúrbios do metabolismo e da nutrição: Diabetes mellitus.*
- **Fármacos típicos associados (curadoria, não CTCAE):** Corticosteroides; alpelisibe, capivasertibe; everolimo; ICI (diabetes autoimune — ver 'Diabetes mellitus')

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | Fasting glucose value >ULN - 160 mg/dL; Fasting glucose value >ULN - 8.9 mmol/L | Glicemia de jejum >LSN - 160 mg/dL; glicemia de jejum >LSN - 8.9 mmol/L |
| 2 | Fasting glucose value >160 - 250 mg/dL; Fasting glucose value >8.9 - 13.9 mmol/L | Glicemia de jejum >160 - 250 mg/dL; glicemia de jejum >8.9 - 13.9 mmol/L |
| 3 | >250 - 500 mg/dL; >13.9 - 27.8 mmol/L; hospitalization indicated | >250 - 500 mg/dL; >13.9 - 27.8 mmol/L; hospitalização indicada |
| 4 | >500 mg/dL; >27.8 mmol/L; life-threatening consequences | >500 mg/dL; >27.8 mmol/L; consequências com risco à vida |
| 5 | - | - |

### 35. Arthralgia — Artralgia

- **SOC:** Musculoskeletal and connective tissue disorders (Distúrbios musculoesqueléticos e do tecido conjuntivo) · **LLT MedDRA:** 10003239 · **Mudança v6.0:** Addition: Navigational Note; Clarification: Grade 2, 3
- **Definição (EN):** A disorder characterized by a sensation of marked discomfort in a joint.
- **Definição (PT):** Distúrbio caracterizado por sensação de desconforto acentuado em uma articulação.
- **Nota de navegação:** Report Inflammatory arthritis as Musculoskeletal and connective tissue disorder - Other, specify (Inflammatory arthritis). — *Notificar artrite inflamatória como Distúrbio musculoesquelético e do tecido conjuntivo - Outro, especificar (Artrite inflamatória).*
- **Fármacos típicos associados (curadoria, não CTCAE):** Inibidores de aromatase; taxanos; ICI; G-CSF (suporte)

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | Mild pain | Dor leve |
| 2 | Moderate pain; limiting instrumental ADL or mild/moderate impact on age-appropriate normal daily activity (pediatric) | Dor moderada; limitando AVD instrumental ou impacto leve/moderado na atividade diária normal apropriada para a idade (pediátrico) |
| 3 | Severe pain; limiting self-care ADL or severe impact on age-appropriate normal daily activity (pediatric) | Dor intensa; limitando AVD de autocuidado ou impacto grave na atividade diária normal apropriada para a idade (pediátrico) |
| 4 | - | - |
| 5 | - | - |

### 36. Myalgia — Mialgia

- **SOC:** Musculoskeletal and connective tissue disorders (Distúrbios musculoesqueléticos e do tecido conjuntivo) · **LLT MedDRA:** 10028411 · **Mudança v6.0:** Addition: Navigational Note; Clarification: Grade 2, 3
- **Definição (EN):** A disorder characterized by marked discomfort sensation originating from a muscle or group of muscles.
- **Definição (PT):** Distúrbio caracterizado por sensação de desconforto acentuado originada de um músculo ou grupo de músculos.
- **Nota de navegação:** Record final diagnosis/cause once determined. — *Registrar o diagnóstico/causa final quando determinado.*
- **Fármacos típicos associados (curadoria, não CTCAE):** Paclitaxel/taxanos; ICI (considerar miosite); G-CSF (suporte)

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | Mild pain | Dor leve |
| 2 | Moderate pain; limiting instrumental ADL or mild/moderate impact on age-appropriate normal daily activity (pediatric) | Dor moderada; limitando AVD instrumental ou impacto leve/moderado na atividade diária normal apropriada para a idade (pediátrico) |
| 3 | Severe pain; limiting self-care ADL or severe impact on age-appropriate normal daily activity (pediatric) | Dor intensa; limitando AVD de autocuidado ou impacto grave na atividade diária normal apropriada para a idade (pediátrico) |
| 4 | - | - |
| 5 | - | - |

### 37. Tinnitus — Zumbido

- **SOC:** Ear and labyrinth disorders (Distúrbios do ouvido e do labirinto) · **LLT MedDRA:** 10043882 · **Mudança v6.0:** Clarification: Grade 2, 3
- **Definição (EN):** A disorder characterized by noise in the ears, such as ringing, buzzing, roaring or clicking.
- **Definição (PT):** Distúrbio caracterizado por ruído nos ouvidos, como zumbido, chiado, rugido ou estalido.
- **Fármacos típicos associados (curadoria, não CTCAE):** Cisplatina

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | Mild symptoms; intervention not indicated | Sintomas leves; intervenção não indicada |
| 2 | Moderate symptoms; limiting instrumental ADL or mild/moderate impact on age-appropriate normal daily activity (pediatric) | Sintomas moderados; limitando AVD instrumental ou impacto leve/moderado na atividade diária normal apropriada para a idade (pediátrico) |
| 3 | Severe symptoms; limiting self-care ADL or severe impact on age-appropriate normal daily activity (pediatric) | Sintomas graves; limitando AVD de autocuidado ou impacto grave na atividade diária normal apropriada para a idade (pediátrico) |
| 4 | - | - |
| 5 | - | - |

### 38. Hearing impaired — Perda auditiva (audição comprometida)

- **SOC:** Ear and labyrinth disorders (Distúrbios do ouvido e do labirinto) · **LLT MedDRA:** 10019245 · **Mudança v6.0:** Clarification: Grade 1, 2, 3, 4
- **Definição (EN):** A disorder characterized by partial or complete loss of the ability to detect or understand sounds resulting from damage to ear structures.
- **Definição (PT):** Distúrbio caracterizado por perda parcial ou completa da capacidade de detectar ou compreender sons, resultante de dano às estruturas da orelha.
- **Fármacos típicos associados (curadoria, não CTCAE):** Cisplatina (dose-cumulativa); carboplatina em menor grau

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | Adult: Subjective change in hearing in the absence of documented hearing loss; threshold shift of 15 - 25 dB averaged at 2 contiguous test frequencies in at least one ear (on a 1, 2, 4, 3, 6, and 8 kHz audiogram);  Pediatric (on a 1, 2, 3, 4, 6, and 8 kHz audiogram): Threshold shift >20 dB hearing loss (HL) (i.e., 25 dB HL or greater); sensorineural hearing loss (SNHL) above 4 kHz (i.e., 6 or 8 kHz) in at least one ear | Adulto: alteração subjetiva da audição na ausência de perda auditiva documentada; mudança de limiar de 15 - 25 dB na média de 2 frequências de teste contíguas em pelo menos uma orelha (em audiograma de 1, 2, 4, 3, 6 e 8 kHz [ordem conforme o original]); Pediátrico (em audiograma de 1, 2, 3, 4, 6 e 8 kHz): mudança de limiar >20 dB de perda auditiva (HL) (i.e., 25 dB HL ou mais); perda auditiva neurossensorial (PANS) acima de 4 kHz (i.e., 6 ou 8 kHz) em pelo menos uma orelha |
| 2 | Adult: Hearing loss not requiring hearing aid; intervention not indicated; limiting instrumental ADL; threshold shift of >25 dB averaged at 2 contiguous test frequencies in at least one ear (on a 1, 2, 3, 4, 6, and 8 kHz audiogram);  Pediatric (on a 1, 2, 3, 4, 6, and 8 kHz audiogram): Threshold shift >20 dB at 4 kHz in at least one ear; mild/moderate impact on age-appropriate normal daily activity | Adulto: perda auditiva que não requer aparelho auditivo; intervenção não indicada; limitando AVD instrumental; mudança de limiar >25 dB na média de 2 frequências de teste contíguas em pelo menos uma orelha (em audiograma de 1, 2, 3, 4, 6 e 8 kHz); Pediátrico (em audiograma de 1, 2, 3, 4, 6 e 8 kHz): mudança de limiar >20 dB em 4 kHz em pelo menos uma orelha; impacto leve/moderado na atividade diária normal apropriada para a idade |
| 3 | Adult: Hearing loss requiring hearing aid; intervention indicated; limiting self-care ADL; threshold shift of >25 dB averaged at 3 contiguous test frequencies in at least one ear(on a 1, 2, 3, 4, 6, and 8 kHz audiogram);  Pediatric (on a 1, 2, 3, 4, 6, and 8 kHz audiogram): Hearing loss sufficient to indicate therapeutic intervention, including hearing aids; threshold shift >20 dB at 2 to <4 kHz in at least one ear; severe impact on age-appropriate normal daily activity | Adulto: perda auditiva que requer aparelho auditivo; intervenção indicada; limitando AVD de autocuidado; mudança de limiar >25 dB na média de 3 frequências de teste contíguas em pelo menos uma orelha (em audiograma de 1, 2, 3, 4, 6 e 8 kHz); Pediátrico (em audiograma de 1, 2, 3, 4, 6 e 8 kHz): perda auditiva suficiente para indicar intervenção terapêutica, incluindo aparelhos auditivos; mudança de limiar >20 dB de 2 a <4 kHz em pelo menos uma orelha; impacto grave na atividade diária normal apropriada para a idade |
| 4 | Adult: Nonservicable hearing; decrease in hearing to profound bilateral loss (absolute threshold >80 dB HL at 2 kHz and above);  Pediatric: Audiologic indication for cochlear implant; >40 dB HL (i.e., 45 dB HL or more); SNHL at 2 kHz and above | Adulto: audição não funcional (nonserviceable); diminuição da audição até perda bilateral profunda (limiar absoluto >80 dB HL em 2 kHz e acima); Pediátrico: indicação audiológica de implante coclear; >40 dB HL (i.e., 45 dB HL ou mais); PANS em 2 kHz e acima |
| 5 | - | - |

### 39. Dysgeusia — Disgeusia

- **SOC:** Nervous system disorders (Distúrbios do sistema nervoso) · **LLT MedDRA:** 10013911 · **Mudança v6.0:** No Change
- **Definição (EN):** A disorder characterized by abnormal sensual experience with the taste of foodstuffs; it can be related to a decrease in the sense of smell.
- **Definição (PT):** Distúrbio caracterizado por experiência sensorial anormal com o sabor dos alimentos; pode estar relacionada a diminuição do olfato.
- **Fármacos típicos associados (curadoria, não CTCAE):** Quimioterapia citotóxica (platinas, taxanos); TKIs (sunitinibe, cabozantinibe); inibidores de Hedgehog (vismodegibe)

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | Altered taste but no change in diet | Paladar alterado, mas sem mudança na dieta |
| 2 | Altered taste with change in diet (e.g., oral supplements); noxious or unpleasant taste; loss of taste | Paladar alterado com mudança na dieta (p. ex., suplementos orais); gosto nocivo ou desagradável; perda do paladar |
| 3 | - | - |
| 4 | - | - |
| 5 | - | - |

### 40. Epistaxis — Epistaxe

- **SOC:** Respiratory, thoracic and mediastinal disorders (Distúrbios respiratórios, torácicos e do mediastino) · **LLT MedDRA:** 10015090 · **Mudança v6.0:** No Change
- **Definição (EN):** A disorder characterized by bleeding from the nose.
- **Definição (PT):** Distúrbio caracterizado por sangramento nasal.
- **Fármacos típicos associados (curadoria, não CTCAE):** Bevacizumabe, ramucirumabe, TKIs anti-VEGFR; plaquetopenia

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | Mild symptoms; intervention not indicated | Sintomas leves; intervenção não indicada |
| 2 | Moderate symptoms; medical intervention indicated (e.g., nasal packing, cauterization; topical vasoconstrictors) | Sintomas moderados; intervenção médica indicada (p. ex., tamponamento nasal, cauterização; vasoconstritores tópicos) |
| 3 | Transfusion; invasive intervention indicated (e.g., hemostasis of bleeding site) | Transfusão; intervenção invasiva indicada (p. ex., hemostasia do local de sangramento) |
| 4 | Life-threatening consequences; urgent intervention indicated | Consequências com risco à vida; intervenção urgente indicada |
| 5 | Death | Óbito |

### 41. Infusion related reaction — Reação relacionada à infusão

- **SOC:** Injury, poisoning and procedural complications (Lesões, intoxicações e complicações de procedimentos) · **LLT MedDRA:** 10051792 · **Mudança v6.0:** Addition: Navigational Note
- **Definição (EN):** A disorder characterized by adverse reaction to the infusion of pharmacological or biological substances.
- **Definição (PT):** Distúrbio caracterizado por reação adversa à infusão de substâncias farmacológicas ou biológicas.
- **Nota de navegação:** If the reaction is an allergic reaction related to an agent, consider reporting as Immune system disorders: Allergic reaction. Do not report both. — *Se a reação for uma reação alérgica relacionada a um agente, considerar notificar como Distúrbios do sistema imune: Reação alérgica. Não notificar ambos.*
- **Fármacos típicos associados (curadoria, não CTCAE):** Paclitaxel, docetaxel; oxaliplatina; cetuximabe; trastuzumabe; amivantamabe

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | Mild transient reaction; infusion interruption not indicated; intervention not indicated | Reação transitória leve; interrupção da infusão não indicada; intervenção não indicada |
| 2 | Therapy or infusion interruption indicated but responds promptly to symptomatic treatment (e.g., antihistamines, NSAIDS, narcotics, IV fluids); prophylactic medications indicated for <=24 hrs | Interrupção da terapia ou da infusão indicada, mas com resposta rápida ao tratamento sintomático (p. ex., anti-histamínicos, AINEs, narcóticos, fluidos IV); medicações profiláticas indicadas por <=24 h |
| 3 | Prolonged (e.g., not rapidly responsive to symptomatic medication and/or brief interruption of infusion); recurrence of symptoms following initial improvement; hospitalization indicated for clinical sequelae | Prolongada (p. ex., sem resposta rápida à medicação sintomática e/ou à breve interrupção da infusão); recorrência dos sintomas após melhora inicial; hospitalização indicada para sequelas clínicas |
| 4 | Life-threatening consequences; urgent intervention indicated | Consequências com risco à vida; intervenção urgente indicada |
| 5 | Death | Óbito |

### 42. Allergic reaction — Reação alérgica (hipersensibilidade)

- **SOC:** Immune system disorders (Distúrbios do sistema imune) · **LLT MedDRA:** 10001718 · **Mudança v6.0:** Clarification: Grade 3, Definition, Navigational Note
- **Definição (EN):** A disorder characterized by an adverse general response from exposure to an allergen.
- **Definição (PT):** Distúrbio caracterizado por resposta geral adversa decorrente da exposição a um alérgeno.
- **Nota de navegação:** If related to infusion, consider Injury, poisoning and procedural complications: Infusion related reaction. If related to immunization, consider Injury, poisoning and procedural complications: Systemic post-immunization reaction. Do not report both. — *Se relacionada à infusão, considerar Lesões, intoxicações e complicações de procedimentos: Reação relacionada à infusão. Se relacionada a imunização, considerar Lesões, intoxicações e complicações de procedimentos: Reação sistêmica pós-imunização. Não notificar ambos.*
- **Fármacos típicos associados (curadoria, não CTCAE):** Carboplatina (após múltiplos ciclos), oxaliplatina, taxanos

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | Systemic intervention not indicated | Intervenção sistêmica não indicada |
| 2 | Oral intervention indicated | Intervenção oral indicada |
| 3 | Bronchospasm; hospitalization indicated for clinical sequelae; IV intervention indicated | Broncoespasmo; hospitalização indicada para sequelas clínicas; intervenção IV indicada |
| 4 | Life-threatening consequences; urgent intervention indicated | Consequências com risco à vida; intervenção urgente indicada |
| 5 | Death | Óbito |

### 43. Peripheral edema — Edema periférico [substitui 'Edema limbs' da v5.0]

- **SOC:** General disorders and administration site conditions (Distúrbios gerais e condições no local de administração) · **LLT MedDRA:** 10034570 · **Mudança v6.0:** Addition: Term
- **Definição (EN):** A disorder characterized by swelling due to excessive fluid accumulation in the body periphery.
- **Definição (PT):** Distúrbio caracterizado por inchaço devido a acúmulo excessivo de líquido na periferia do corpo.
- **Nota de navegação:** Consider Cardiac disorders: Heart failure; Record final diagnosis/cause once determined. — *Considerar Distúrbios cardíacos: Insuficiência cardíaca; registrar o diagnóstico/causa final quando determinado.*
- **Fármacos típicos associados (curadoria, não CTCAE):** Docetaxel (retenção hídrica); inibidores de MET (capmatinibe, tepotinibe); corticosteroides

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | Swelling or obscuration of anatomic architecture on close inspection | Inchaço ou apagamento da arquitetura anatômica à inspeção próxima |
| 2 | Readily apparent obscuration of anatomic architecture; obliteration of skin folds; readily apparent deviation from normal anatomic contour; limiting instrumental ADL or mild/moderate impact on age-appropriate normal daily activity (pediatric) | Apagamento da arquitetura anatômica facilmente perceptível; obliteração das pregas cutâneas; desvio do contorno anatômico normal facilmente perceptível; limitando AVD instrumental ou impacto leve/moderado na atividade diária normal apropriada para a idade (pediátrico) |
| 3 | Gross deviation from normal anatomic contour; limiting self-care ADL or severe impact on age-appropriate normal daily activity (pediatric) | Desvio grosseiro do contorno anatômico normal; limitando AVD de autocuidado ou impacto grave na atividade diária normal apropriada para a idade (pediátrico) |
| 4 | - | - |
| 5 | - | - |

### 44. Headache — Cefaleia

- **SOC:** Nervous system disorders (Distúrbios do sistema nervoso) · **LLT MedDRA:** 10019211 · **Mudança v6.0:** Clarification: Grade 2, 3
- **Definição (EN):** A disorder characterized by a sensation of marked discomfort in various parts of the head, not confined to the area of distribution of any nerve.
- **Definição (PT):** Distúrbio caracterizado por sensação de desconforto acentuado em várias partes da cabeça, não restrita à área de distribuição de qualquer nervo.
- **Fármacos típicos associados (curadoria, não CTCAE):** Antagonistas 5-HT3 (suporte); TKIs; ICI (descartar hipofisite)

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | Mild pain | Dor leve |
| 2 | Moderate pain; limiting instrumental ADL or mild/moderate impact on age-appropriate normal daily activity (pediatric) | Dor moderada; limitando AVD instrumental ou impacto leve/moderado na atividade diária normal apropriada para a idade (pediátrico) |
| 3 | Severe pain; limiting self-care ADL or severe impact on age-appropriate normal daily activity (pediatric) | Dor intensa; limitando AVD de autocuidado ou impacto grave na atividade diária normal apropriada para a idade (pediátrico) |
| 4 | - | - |
| 5 | - | - |

### 45. Dizziness — Tontura

- **SOC:** Nervous system disorders (Distúrbios do sistema nervoso) · **LLT MedDRA:** 10013573 · **Mudança v6.0:** Addition: Navigational Note; Clarification: Grade 2, 3
- **Definição (EN):** A disorder characterized by a disturbing sensation of lightheadedness, unsteadiness, giddiness, spinning or rocking.
- **Definição (PT):** Distúrbio caracterizado por sensação perturbadora de cabeça leve, instabilidade, atordoamento, giro ou balanço.
- **Nota de navegação:** Record final diagnosis/cause once determined. — *Registrar o diagnóstico/causa final quando determinado.*
- **Fármacos típicos associados (curadoria, não CTCAE):** Antiandrogênicos de nova geração (enzalutamida, apalutamida — quedas); medicações de suporte

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | Mild unsteadiness or sensation of movement | Instabilidade leve ou sensação de movimento |
| 2 | Moderate unsteadiness or sensation of movement; limiting instrumental ADL or mild/moderate impact on age-appropriate normal daily activity (pediatric) | Instabilidade moderada ou sensação de movimento; limitando AVD instrumental ou impacto leve/moderado na atividade diária normal apropriada para a idade (pediátrico) |
| 3 | Severe unsteadiness or sensation of movement; limiting self-care ADL or severe impact on age-appropriate normal daily activity (pediatric) | Instabilidade grave ou sensação de movimento; limitando AVD de autocuidado ou impacto grave na atividade diária normal apropriada para a idade (pediátrico) |
| 4 | - | - |
| 5 | - | - |

### 46. Fever — Febre

- **SOC:** General disorders and administration site conditions (Distúrbios gerais e condições no local de administração) · **LLT MedDRA:** 10016558 · **Mudança v6.0:** Addition: Navigational Note
- **Definição (EN):** A disorder characterized by elevation of the body's temperature above the upper limit of normal.
- **Definição (PT):** Distúrbio caracterizado por elevação da temperatura corporal acima do limite superior da normalidade.
- **Nota de navegação:** Consider Injury, poisoning and procedural complications: Infusion related reaction. — *Considerar Lesões, intoxicações e complicações de procedimentos: Reação relacionada à infusão.*
- **Fármacos típicos associados (curadoria, não CTCAE):** Gencitabina; ICI; bleomicina; infecção/neutropenia febril (considerar)

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | 38.0 - 39.0 degrees C (100.4 - 102.2 degrees F) | 38.0 - 39.0 graus C (100.4 - 102.2 graus F) |
| 2 | >39.0 - 40.0 degrees C (102.3 - 104.0 degrees F) | >39.0 - 40.0 graus C (102.3 - 104.0 graus F) |
| 3 | >40.0 degrees C (>104.0 degrees F) for <=24 hrs | >40.0 graus C (>104.0 graus F) por <=24 h |
| 4 | >40.0 degrees C (>104.0 degrees F) for >24 hrs | >40.0 graus C (>104.0 graus F) por >24 h |
| 5 | Death | Óbito |

### 47. Sepsis — Sepse [proxy para 'infecção' — o CTCAE não tem termo genérico 'Infection']

- **SOC:** Infections and infestations (Infecções e infestações) · **LLT MedDRA:** 10040047 · **Mudança v6.0:** Clarification: Grade 3, 4, Definition, Navigational Note
- **Definição (EN):** A disorder characterized by the presence of pathogenic microorganisms in the blood stream that cause varying degrees of organ dysfunction due to a dysregulated host response to infection.
- **Definição (PT):** Distúrbio caracterizado pela presença de microrganismos patogênicos na corrente sanguínea que causam graus variados de disfunção orgânica devido a uma resposta desregulada do hospedeiro à infecção.
- **Nota de navegação:** Consider Infections and infestations: Bacteremia (Grade 2). — *Considerar Infecções e infestações: Bacteremia (Grau 2).*
- **Fármacos típicos associados (curadoria, não CTCAE):** Qualquer quimioterapia mielossupressora (associada a neutropenia)

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | - | - |
| 2 | - | - |
| 3 | IV intervention indicated | Intervenção IV indicada |
| 4 | Life-threatening consequences | Consequências com risco à vida |
| 5 | Death | Óbito |

### 48. Infusion site extravasation — Extravasamento no local de infusão

- **SOC:** General disorders and administration site conditions (Distúrbios gerais e condições no local de administração) · **LLT MedDRA:** 10064774 · **Mudança v6.0:** No Change
- **Definição (EN):** A disorder characterized by leakage of the infusion into the surrounding tissue. Signs and symptoms may include induration, erythema, swelling, burning sensation and marked discomfort at the infusion site.
- **Definição (PT):** Distúrbio caracterizado por extravasamento da infusão para o tecido circundante. Sinais e sintomas podem incluir induração, eritema, inchaço, sensação de queimação e desconforto acentuado no local da infusão.
- **Fármacos típicos associados (curadoria, não CTCAE):** Vesicantes: antraciclinas (doxorrubicina, epirrubicina), alcaloides da vinca, mitomicina; também taxanos e oxaliplatina

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | Painless edema | Edema indolor |
| 2 | Erythema with associated symptoms (e.g., edema, pain, induration, phlebitis) | Eritema com sintomas associados (p. ex., edema, dor, induração, flebite) |
| 3 | Ulceration or necrosis; severe tissue damage; operative intervention indicated | Ulceração ou necrose; dano tecidual grave; intervenção cirúrgica indicada |
| 4 | Life-threatening consequences; urgent intervention indicated | Consequências com risco à vida; intervenção urgente indicada |
| 5 | Death | Óbito |

### 49. Photosensitivity — Fotossensibilidade

- **SOC:** Skin and subcutaneous tissue disorders (Distúrbios da pele e do tecido subcutâneo) · **LLT MedDRA:** 10034966 · **Mudança v6.0:** Clarification: Grade 1, 2, 3
- **Definição (EN):** A disorder characterized by an increase in sensitivity of the skin to light.
- **Definição (PT):** Distúrbio caracterizado por aumento da sensibilidade da pele à luz.
- **Fármacos típicos associados (curadoria, não CTCAE):** Vemurafenibe; 5-FU/capecitabina; vandetanibe; metotrexato

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | Painless erythema | Eritema indolor |
| 2 | Tender erythema | Eritema doloroso ao toque |
| 3 | Erythema with blistering; oral corticosteroid therapy indicated; pain control indicated (e.g., narcotics or NSAIDs) | Eritema com bolhas; corticoterapia oral indicada; controle da dor indicado (p. ex., narcóticos ou AINEs) |
| 4 | Life-threatening consequences; urgent intervention indicated | Consequências com risco à vida; intervenção urgente indicada |
| 5 | Death | Óbito |

### 50. Paronychia — Paroníquia

- **SOC:** Infections and infestations (Infecções e infestações) · **LLT MedDRA:** 10034016 · **Mudança v6.0:** Clarification: Grade 2, 3
- **Definição (EN):** A disorder characterized by an infectious process involving the soft tissues around the nail.
- **Definição (PT):** Distúrbio caracterizado por processo infeccioso envolvendo os tecidos moles ao redor da unha.
- **Fármacos típicos associados (curadoria, não CTCAE):** Anti-EGFR (cetuximabe, panitumumabe); TKIs EGFR (erlotinibe, gefitinibe, afatinibe, osimertinibe); docetaxel

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | Nail fold edema or erythema; disruption of the cuticle | Edema ou eritema da prega ungueal; ruptura da cutícula |
| 2 | Local intervention indicated; oral intervention indicated (e.g., antibiotic, antifungal, antiviral); nail fold edema or erythema with pain; associated with discharge or nail plate separation; limiting instrumental ADL or mild/moderate impact on age-appropriate normal daily activity (pediatric) | Intervenção local indicada; intervenção oral indicada (p. ex., antibiótico, antifúngico, antiviral); edema ou eritema da prega ungueal com dor; associada a secreção ou descolamento da lâmina ungueal; limitando AVD instrumental ou impacto leve/moderado na atividade diária normal apropriada para a idade (pediátrico) |
| 3 | Operative intervention indicated; IV antibiotics indicated; limiting self-care ADL or severe impact on age-appropriate normal daily activity (pediatric) | Intervenção cirúrgica indicada; antibióticos IV indicados; limitando AVD de autocuidado ou impacto grave na atividade diária normal apropriada para a idade (pediátrico) |
| 4 | - | - |
| 5 | - | - |

---

## 6. Termos complementares (fora dos 50)

### 51. Heart failure — Insuficiência cardíaca

- **SOC:** Cardiac disorders (Distúrbios cardíacos) · **LLT MedDRA:** 10019279 · **Mudança v6.0:** Clarification: Grade 1, 2, 3, 4, Navigational Note
- **Definição (EN):** A disorder characterized by the inability of the heart to pump blood at an adequate volume to meet tissue metabolic requirements, or, the ability to do so only at an elevation in the filling pressure.
- **Definição (PT):** Distúrbio caracterizado pela incapacidade do coração de bombear sangue em volume adequado para atender às necessidades metabólicas dos tecidos ou pela capacidade de fazê-lo apenas com elevação da pressão de enchimento.
- **Nota de navegação:** If asymptomatic, consider Cardiac disorders: Left ventricular dysfunction. — *Se assintomático, considerar Distúrbios cardíacos: Disfunção ventricular esquerda.*
- **Fármacos típicos associados (curadoria, não CTCAE):** Antraciclinas; trastuzumabe e outros anti-HER2; ICI (miocardite); TKIs anti-VEGFR (sunitinibe)

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | Mild symptoms; no initiation or intensification of treatment | Sintomas leves; sem início ou intensificação de tratamento |
| 2 | Outpatient initiation or intensification of treatment | Início ou intensificação de tratamento em regime ambulatorial |
| 3 | Hospitalization indicated | Hospitalização indicada |
| 4 | Requiring inotropic support, mechanical circulatory support, or consideration of cardiac transplantation | Necessidade de suporte inotrópico, suporte circulatório mecânico ou consideração de transplante cardíaco |
| 5 | Death | Óbito |

### 52. Acute kidney injury — Lesão renal aguda

- **SOC:** Renal and urinary disorders (Distúrbios renais e urinários) · **LLT MedDRA:** 10069339 · **Mudança v6.0:** Clarification: Definition, Navigational Note
- **Definição (EN):** A disorder characterized by the acute loss of renal function (within 2 weeks).
- **Definição (PT):** Distúrbio caracterizado pela perda aguda da função renal (em até 2 semanas).
- **Nota de navegação:** Consider Investigations: Creatinine increased; Renal and urinary disorders: Tubulointerstitial nephritis. — *Considerar Investigações: Creatinina aumentada; Distúrbios renais e urinários: Nefrite tubulointersticial.*
- **Fármacos típicos associados (curadoria, não CTCAE):** Cisplatina, ifosfamida, pemetrexede, metotrexato em alta dose; ICI (nefrite)

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | - | - |
| 2 | - | - |
| 3 | Hospitalization indicated | Hospitalização indicada |
| 4 | Life-threatening consequences; dialysis indicated | Consequências com risco à vida; diálise indicada |
| 5 | Death | Óbito |

### 53. Diabetes mellitus — Diabetes mellitus

- **SOC:** Metabolism and nutrition disorders (Distúrbios do metabolismo e da nutrição) · **LLT MedDRA:** 10012601 · **Mudança v6.0:** Addition: Term
- **Definição (EN):** A disorder characterized by increased Hgb A1C that may result in organ damage.
- **Definição (PT):** Distúrbio caracterizado por HbA1c aumentada que pode resultar em dano a órgãos.
- **Nota de navegação:** Consider Metabolism and nutrition disorders: Hyperglycemia. — *Considerar Distúrbios do metabolismo e da nutrição: Hiperglicemia.*
- **Fármacos típicos associados (curadoria, não CTCAE):** ICI (diabetes autoimune); corticosteroides; alpelisibe

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | Abnormal glucose above baseline; diet changes only; no change in baseline diabetic management | Glicose anormal acima do basal; apenas mudanças dietéticas; sem mudança no manejo basal do diabetes |
| 2 | Oral antiglycemic agent initiated; insulin sliding scale initiated | Antiglicemiante oral iniciado; escala móvel de insulina iniciada |
| 3 | Insulin therapy initiated or increased; hospitalization indicated | Insulinoterapia iniciada ou aumentada; hospitalização indicada |
| 4 | Life-threatening consequences; urgent intervention indicated; diabetic ketoacidosis | Consequências com risco à vida; intervenção urgente indicada; cetoacidose diabética |
| 5 | Death | Óbito |

### 54. Weight gain — Ganho de peso

- **SOC:** Investigations (Investigações (exames)) · **LLT MedDRA:** 10047896 · **Mudança v6.0:** Clarification: Definition; Deletion: Navigational Note
- **Definição (EN):** A finding characterized by an unexpected or abnormal increase in overall body weight; for pediatrics, percentages represent the absolute increase above that expected from the baseline growth curve (not change in growth percentiles).
- **Definição (PT):** Achado caracterizado por aumento inesperado ou anormal do peso corporal total; em pediatria, os percentuais representam o aumento absoluto acima do esperado pela curva de crescimento basal (não a mudança de percentis de crescimento).
- **Fármacos típicos associados (curadoria, não CTCAE):** Corticosteroides; acetato de megestrol

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | 5 - <10% from baseline | 5 - <10% em relação ao basal |
| 2 | 10 - <20% from baseline | 10 - <20% em relação ao basal |
| 3 | >=20% from baseline | >=20% em relação ao basal |
| 4 | - | - |
| 5 | - | - |

### 55. Insomnia — Insônia

- **SOC:** Psychiatric disorders (Distúrbios psiquiátricos) · **LLT MedDRA:** 10022437 · **Mudança v6.0:** No Change
- **Definição (EN):** A disorder characterized by difficulty in falling asleep and/or remaining asleep.
- **Definição (PT):** Distúrbio caracterizado por dificuldade em adormecer e/ou permanecer dormindo.
- **Fármacos típicos associados (curadoria, não CTCAE):** Corticosteroides (dexametasona como antiemético/pré-medicação)

| Grau | Texto oficial (EN) | Tradução PT-BR |
|---|---|---|
| 1 | Mild difficulty falling asleep, staying asleep or waking up early | Dificuldade leve para adormecer, manter o sono ou despertar precoce |
| 2 | Moderate difficulty falling asleep, staying asleep or waking up early | Dificuldade moderada para adormecer, manter o sono ou despertar precoce |
| 3 | Severe difficulty in falling asleep, staying asleep or waking up early | Dificuldade grave para adormecer, manter o sono ou despertar precoce |
| 4 | - | - |
| 5 | - | - |

## 7. Itens não verificados / limitações

- **Traduções:** não há tradução oficial do CTCAE v6.0 para PT-BR publicada pelo NCI; as traduções aqui são fiéis, porém não oficiais. Para notificação formal/estudos, usar o texto em inglês.
- **Nomes de SOC em português:** tradução livre — NÃO_VERIFICADO contra a tradução oficial MedDRA PT-BR (acesso à terminologia MedDRA traduzida exige licença).
- **"Infecção"**: o CTCAE não possui um termo genérico "Infection"; infecções são registradas por sítio (p. ex., Pneumonia, Urinary tract infection, Skin infection) ou como Sepsis/Bacteremia. Usou-se **Sepsis** como representante; Paronychia também é do SOC Infections and infestations.
- **"Hipersensibilidade"**: não há termo "Hypersensitivity" isolado no CTCAE v6.0; usou-se **Allergic reaction** (há também *Anaphylaxis* no SOC Immune system disorders, não incluído).
- **Hearing impaired, Grau 1 (adulto):** o original traz a sequência de frequências "1, 2, 4, 3, 6, and 8 kHz" (provável erro tipográfico do original, mantido como está).
- **Rash maculo-papular:** a definição original usa a grafia "pruritis" (sic).
- **Coluna de fármacos típicos:** curadoria geral; não verificada item a item contra bulas neste arquivo.

## 8. Fontes (consultadas em 2026-10-06)

1. NCI/CTEP — Trial Development (antiga URL ctc.htm redireciona para cá): https://dctd.cancer.gov/research/ctep-trials/trial-development
2. NCI/CTEP — Adverse Events / CTCAE: https://dctd.cancer.gov/research/ctep-trials/for-sites/adverse-events
3. CTCAE v6.0 (Excel, MedDRA 28.0; abas Publication Notes, Clean Copy, Tracked Changes, v5.0→v6.0 Mapping, Errata): https://dctd.cancer.gov/research/ctep-trials/trial-development/ctcae-v6.0.xlsx
4. CTCAE v6.0 Quick Reference (PDF; "Published July 22, 2025"): https://dctd.cancer.gov/research/ctep-trials/for-sites/adverse-events/ctcae-v6.pdf
5. CTCAE v6.0 Implementation FAQs (PDF, 09/09/2025): https://dctd.cancer.gov/research/ctep-trials/for-sites/adverse-events/ctcae-v6-faq.pdf
