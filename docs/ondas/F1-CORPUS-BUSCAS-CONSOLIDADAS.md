# F1 · Buscas consolidadas do corpus — versão final documental

**Edição final desta rodada: 11/10/2026 · NÃO CANÔNICA · aprovação clínica não presumida.**

**Veredicto: INDETERMINADO para promoção global ao corpus.** As correções médicas verificadas são candidatas à aprovação; trechos pendentes não podem originar prescrição, alerta ou regra automática. Os achados críticos anteriores foram tratados no texto, sem evidência de validação integral de todos os temas. Não bloqueia atendimento.

**Linhas de origem:** GLM → revisão Claude → reauditoria médica Codex → consolidação final Codex. A versão imediatamente anterior tem SHA-256 `be1ce004c595a3b8d3905c5cc72c80224c9ebb70234205826bcd02e2e568ca66`. Backup ORIGINAL preservado; nenhum arquivo duplicado foi criado.

**Escopo desta rodada:** medicina e farmacologia; laudos legais permanecem como histórico não liberado. As 50 receitas e os 190 fármacos foram finalizados em seus próprios arquivos, sem copiar seu conteúdo para este consolidado.

## 1. Métricas novas e verificáveis

| Métrica | Resultado |
|---|---|
| Achados médicos anteriores rastreados | 19/19 |
| Núcleo de interações/condicionais/CTCAE da revisão anterior | Preservado por comparação integral do trecho |
| Provas aritméticas dirigidas | 6/6, sem extrapolar para teste de software |
| Inventário dos documentos relacionados | 50 receitas e190 fármacos preservados |
| Alegações históricas de cobertura/buscas | Isoladas como histórico; não usadas como indicador de segurança |
| Novos arquivos/cópias | 0 |
| Promoção ao corpus/JSON/código | 0 |
| Veredicto clínico global | INDETERMINADO; pendências explícitas |

**As métricas abaixo medem integridade e tratamento das pendências, não eficácia clínica, cobertura do software ou liberação de uso.** Fonte estrangeira permanece identificada; percentuais históricos de buscas não medem segurança.

## 3. Resultados por frente (achados essenciais com fonte)

### 3.1 Frente 1 — Interações, contraindicações e CTCAE

**Inventário local declarado na pesquisa anterior, não recontado nesta rodada (exceto CSV 55):** 45 interações em `corpus/rulesets/interacoes.v1.json` (37 inativas a propor severidade/monitorização/conduta); 22 condicionais em `f0c/condicionais.v1.json`; CSV CTCAE v6 local com 55 termos.

**Interações — propostas de severidade com fonte:**

| Par | Severidade | Conduta essencial | Fonte |
|---|---|---|---|
| Tamoxifeno × CYP2D6 forte (paroxetina/fluoxetina) | Severidade GRAVE proposta, ainda não validada nesta rodada | Rever antidepressivo com prescritor; não trocar automaticamente para citalopram/venlafaxina sem indicação, risco de retirada e demais interações | Fonte brasileira/SmPC originalmente citada sem URL/versionamento suficiente; NÃO VERIFICÁVEL nesta rodada; [CORRIGIDO CODEX M1-1] |
| Capecitabina × varfarina | GRAVE proposta | INR frequente durante uso e após suspensão conforme evolução; há relatos até 1 mês após terminar capecitabina, não garantia de risco zero após esse prazo | [DailyMed Xeloda §§5.2 e 7.2](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=e702d84d-7162-4751-bf37-d724cc7e45a5); acesso 11/10/2026; [CORRIGIDO CODEX M5-5] |
| Pazopanibe × IBP/H2 (não extrapolar a todo TKI) | MODERADA proposta | Evitar supressores ácidos; se inevitável, considerar antiácido de curta ação separado por algumas horas | [DailyMed Votrient §7.4](https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=eeaaaf38-fb86-4d9f-a19d-0f61daac2fd7); acesso 11/10/2026; [CORRIGIDO CODEX M5-1] |
| Erlotinibe × IBP/H2/antiácido | MODERADA proposta | Evitar IBP; com H2: tomar erlotinibe 10 h após a dose anterior E ≥2 h antes da seguinte; com antiácido: separar por algumas horas | [DailyMed erlotinibe §§2 e 7](https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=2c4c7353-b81c-4651-8aac-6d15e88145af); não aplicar 2 h/10 h a antiácidos; acesso 11/10/2026; [CORRIGIDO CODEX M5-1] |
| Ribociclibe × QT (regra específica da molécula) | GRAVE proposta | Iniciar apenas se QTcF <450 ms; ECG basal, aproximadamente D14C1 e conforme indicação; K/Ca/P/Mg basal e início dos 6 primeiros ciclos; corrigir alterações. Manejo de QTcF >480/500 ms depende da indicação e recorrência, conforme tabela 4; evitar tamoxifeno e outros prolongadores de QT | [DailyMed Kisqali §§2.2, 5.3–5.4](https://www.dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=aaeaef94-f3f5-4367-8ea2-b181d7be2da8); acesso 11/10/2026; [CORRIGIDO CODEX M3-1] |
| Osimertinibe × QT | GRAVE/MODERADA proposta | ECG/eletrólitos periódicos nos grupos de risco; QTc >500 ms em ≥2 ECGs requer interrupção e manejo da bula; não importar o limiar inicial do ribociclibe. FEVE basal/serial nos pacientes com risco em monoterapia e em todos na combinação com pemetrexede/platina | [DailyMed Tagrisso §§2.5, 5.2–5.3](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=5e81b4a7-b971-45e1-9c31-29cea8c87ce7); intervalo fixo de ECG não estabelecido na fonte; acesso 11/10/2026; [CORRIGIDO CODEX M3-1] |
| Ondansetrona × QT | MODERADA proposta | Adultos, náuseas/vômitos por QT: dose única IV ≤16 mg, infundida em ≥15 min; corrigir hipocalemia/hipomagnesemia e avaliar risco de QT. Não é dose padrão de pós-operatório, dose oral, nem limite universal para todas as populações | [MHRA, Drug Safety Update agosto/2012](https://www.gov.uk/drug-safety-update/ondansetron-zofran-important-new-intravenous-dose-restriction); bula brasileira da apresentação pendente; acesso 11/10/2026; [CORRIGIDO CODEX M2-1] |
| Irinotecano × inibidores fortes CYP3A4/UGT1A1 ou indutores fortes CYP3A4 | GRAVE proposta | Distinguir inibição e indução; evitar associação salvo ausência de alternativa; bula orienta retirar inibidor forte CYP3A4 ≥1 semana antes e considerar substituição de indutor ≥2 semanas antes | [DailyMed irinotecano §§7.2–7.3](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=7a30d551-9ea7-47ea-9073-f541bff457a3); não confundir interação com genótipo UGT1A1; acesso 11/10/2026; [CORRIGIDO CODEX M5-2] |
| Cisplatina × aminoglicosídeos | GRAVE proposta | Risco nefro/ototóxico aditivo; revisar necessidade e monitorar função renal/audição conforme bula; não extrapolar a todas as platinas sem ficha própria | [DailyMed cisplatina §§5.1 e 5.5](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=76aea034-6d58-4390-a164-36aa09c1f101); acesso 11/10/2026; [CORRIGIDO CODEX M5-2] |
| Pemetrexede × ibuprofeno | MODERADA proposta | ClCr 45–79 mL/min: evitar ibuprofeno nos 2 dias anteriores, NO DIA e nos 2 dias posteriores; se inevitável, intensificar monitorização hematológica, renal e gastrointestinal. Outros AINEs exigem avaliação própria | [DailyMed pemetrexede §§2.5 e 7](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4cc1574b-3d2f-489b-9ad3-55695bb97200); acesso 11/10/2026; [CORRIGIDO CODEX M5-3] |
| Doxorrubicina × trastuzumabe | GRAVE proposta | Sequência importa: evitar antraciclina, se possível, por até 7 meses após suspender trastuzumabe; se utilizada, monitorar função cardíaca estreitamente. Não considerar qualquer uso sequencial automaticamente seguro | [DailyMed Herceptin §7](https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=492dbdb2-077e-4064-bff3-372d6af0a7a2); acesso 11/10/2026; [CORRIGIDO CODEX M5-4] |
| Tamoxifeno × varfarina / × anastrozol | GRAVE / MODERADA propostas | Anticoagulante cumarínico: contraindicação no cenário de redução de incidência/DCIS; tratamento de câncer invasivo requer análise de risco e monitorização do INR. Não associar tamoxifeno a anastrozol; outros IA exigem fonte específica | [DailyMed tamoxifeno, Contraindications / Drug Interactions](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=8d731e7e-3b04-49a2-a0f6-3779422174cc); acesso 11/10/2026; [CORRIGIDO CODEX M5-5] |
| Fluoropirimidinas × brivudina | GRAVE, potencialmente fatal | Não coadministrar, inclusive entre ciclos; aguardar ≥4 semanas APÓS terminar brivudina ANTES de iniciar fluoropirimidina. Não interpretar como intervalo genérico e bidirecional | [EMA DHPC brivudina, 2020](https://www.ema.europa.eu/en/documents/dhpc/direct-healthcare-professional-communication-dhpc-brivudine-potentially-fatal-toxicity-fluoropyrimidines-if-administered-shortly-or-same-time-brivudine-or-used-within-4-weeks-after-end-treatment_en.pdf); acesso 11/10/2026; [CORRIGIDO CODEX M5-6] |
| Erlotinibe × varfarina/cumarínicos | GRAVE proposta; sangramento potencialmente fatal | Monitorar TP/INR regularmente e revisar anticoagulação; não aplicar regra única a todos os TKI/anticoagulantes | [DailyMed erlotinibe §5.9](https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=2c4c7353-b81c-4651-8aac-6d15e88145af); trecho: “Severe and fatal hemorrhage”; acesso 11/10/2026; [ACRESCENTADO CODEX M5-1] |
| ICI × corticoide sistêmico basal | REVIEW_REQUIRED; severidade não validada como interação farmacológica uniforme | Registrar indicação e dose diária equivalente de prednisona; associação observacional com ≥10 mg/dia depende do contexto. Não impor desmame automático nem retirar reposição ou tratamento necessário de toxicidade imune | [Estudo de coorte De Giglio et al., Cancers 2020, DOI 10.3390/cancers12102827](https://pmc.ncbi.nlm.nih.gov/articles/PMC7599488/); associação não demonstra causalidade; acesso 11/10/2026; [CORRIGIDO CODEX M6-1] |
| Tratamento imunossupressor × vacinas vivas | GRAVE proposta | Adiar durante imunossupressão; após QT convencional, ≥3 meses E recuperação imunológica; anti-B e transplante têm regras distintas. Não liberar automaticamente pela passagem de 3 meses | [CDC Altered Immunocompetence](https://www.cdc.gov/vaccines/hcp/imz-best-practices/altered-immunocompetence.html); acesso 11/10/2026; [CORRIGIDO CODEX M6-1] |

**Verificação médica atualizada (Codex, 11/10/2026):** fontes e condutas revisadas estão na própria tabela, sem coexistência de regra antiga ativa. “GRAVE/MODERADA” continua proposta de curadoria do serviço, não tradução automática de bula. Capecitabina × varfarina, inclusive relatos até 1 mês após retirada, está documentada na fonte FDA; não substituir fonte ANVISA por equivalência presumida. Interações de moléculas nomeadas não se estendem a toda classe. Os pares citados foram avaliados individualmente; isso não certifica todas as combinações possíveis entre os medicamentos. [CORRIGIDO CODEX M1-1, M5-1 a M5-6]

**Contraindicações/condicionais — confirmação limitada à fonte, produto e contexto indicados:**

| Droga × condição | Corte | Fonte |
|---|---|---|
| Cisplatina × renal | ClCr <60 mL/min consta da ficha Pharmacia/CIMA mencionada anteriormente; NÃO VALIDADO nesta rodada como corte universal ou regra ANVISA. Verificar produto, protocolo e método renal | [DailyMed cisplatina](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=76aea034-6d58-4390-a164-36aa09c1f101); não converter automaticamente contraindicação de produto em mero alerta nem generalizar para toda cisplatina; [CORRIGIDO CODEX M1-1] |
| Pemetrexede × renal e segurança pré-ciclo | Não administrar se ClCr <45 mL/min; aferir ClCr antes de cada ciclo e hemograma D1/D8/D15 conforme bula. Não iniciar ciclo se ANC <1500/mm³ ou plaquetas <100.000/mm³. Esquema citado na bula: 500 mg/m² IV em 10 min D1 q21d, por indicação; exige ácido fólico/B12 e pré-medicação, não uma receita completa neste relatório | [DailyMed pemetrexede §§2.1–2.6](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4cc1574b-3d2f-489b-9ad3-55695bb97200); acesso 11/10/2026; [CORRIGIDO CODEX M3-2] |
| Capecitabina × renal | Brasil: contraindicação ClCr <30 mL/min previamente citada por espelho, ainda pendente de bula profissional aplicável. EUA: reduzir 25% se ClCr 30–50 mL/min por Cockcroft–Gault; abaixo de 30 não há dose estabelecida, com exceção individual descrita na seção 8.6. Não importar exceção FDA para o SUS | [DailyMed Xeloda §§2.7 e 8.6](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=e702d84d-7162-4751-bf37-d724cc7e45a5); acesso 11/10/2026; [CORRIGIDO CODEX M1-1] |
| Carboplatina × renal | Calvert: dose TOTAL em mg = AUC-alvo em mg·min/mL × [GFR em mL/min +25]; não mg/m². ClCr <60 sinaliza maior risco, não determina redução percentual adicional automática ao cálculo. Método renal, AUC e limites dependem do protocolo | [DailyMed carboplatina, Formula Dosing / Impaired Kidney Function](https://www.dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=f330f5a2-2cad-402f-bcbb-26245a753276); acesso 11/10/2026; [CORRIGIDO CODEX M2-2] |
| Doxorrubicina convencional × hepático | Bilirrubina total 1,2–3 mg/dL: REDUZIR 50% (administrar 50%); 3,1–5 mg/dL: REDUZIR 75% (administrar 25%); >5 mg/dL ou Child-Pugh C: não iniciar/descontinuar conforme bula. Não extrapolar à formulação lipossomal | [DailyMed doxorrubicina §2.2](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=971de64b-ff09-4370-afd9-6eb1093ad27d); cabeçalho da fonte: “Doxorubicin Dose reduction”; acesso 11/10/2026; [CORRIGIDO CODEX M2-3] |
| Trastuzumabe × FEVE | Bula: interromper por PELO MENOS 4 semanas se queda absoluta ≥16 pontos percentuais, ou FEVE abaixo do limite institucional E queda absoluta ≥10 pontos. Reavaliar critérios de retomada. ESC 2022: interrupção temporária na disfunção assintomática grave durante anti-HER2 (<40%), I-C; 40–49% assintomática admite continuidade considerada com vigilância, IIa-B. Não fundir bula e diretriz | [Herceptin §2.5](https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=492dbdb2-077e-4064-bff3-372d6af0a7a2) e [ESC 2022, tabela 25, p. 4286 / PDF 58](https://cardio-onco.fr/wp-content/uploads/2023/06/ehac244.pdf); acesso 11/10/2026; [CORRIGIDO CODEX M3-3] |
| Tamoxifeno × TEV prévio | Bula contraindica em redução de incidência/DCIS com TVP/TEP prévio; câncer invasivo exige avaliação individual de benefício/risco. Não universalizar contraindicação nem aplicar OR de estudo a todos | [DailyMed tamoxifeno, Contraindications / Warnings](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=8d731e7e-3b04-49a2-a0f6-3779422174cc); fonte primária obtida; diretriz formal antes solicitada permanece pendente; [CORRIGIDO CODEX M5-5] |
| Imunoterapia × autoimune/transplante | condicional (população excluída dos estudos; HSCT alogênico com complicações fatais) | Bula Keytruda DailyMed |
| Gestação e lactação | Não atribuir contraindicação idêntica a doxorrubicina, cisplatina, imatinibe, gemcitabina e ciclofosfamida sem produto/indicação/trimestre. QT selecionada para câncer de mama pode ser considerada após o primeiro trimestre; isso NÃO autoriza todas essas drogas. Lactação e contracepção têm regras próprias por bula | [NCI PDQ, Breast Cancer Treatment During Pregnancy](https://www.cancer.gov/types/breast/hp/pregnancy-breast-treatment-pdq); demais produtos/prazos permanecem INCERTOS; acesso 11/10/2026; [CORRIGIDO CODEX M6-2] |
| Capecitabina × deficiência DPD | Avaliar DPYD antes de iniciar, salvo necessidade imediata no rótulo FDA; evitar uso em deficiência completa conhecida; dose segura não estabelecida. Deficiência parcial exige individualização, não percentual inventado | [DailyMed Xeloda boxed warning e §§2.1, 5.1](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=e702d84d-7162-4751-bf37-d724cc7e45a5); regra brasileira/operacional ainda requer curadoria; [ACRESCENTADO CODEX M6-2] |

**Verificação médica atualizada (Codex, 11/10/2026):** doxorrubicina, pemetrexede e Calvert conferidos nas bulas vinculadas acima. **Percentual reduzido e percentual administrado são campos distintos.** FEVE de trastuzumabe usa diferença absoluta em pontos percentuais, não queda relativa. A interrupção da bula e a estratégia ESC devem permanecer identificadas separadamente. Tabelas ESC 7/8/25 efetivamente lidas no PDF primário republicado em cardio-onco.fr (páginas PDF 31, 32 e 58; SHA-256 ca71a46396f0f3159ffc83abe3a196af55a2fc8574ee6efcb88768caaa4e0f1a). A dúvida de classe/nível foi resolvida nos contextos descritos; imunoterapia em autoimunidade/transplante e bulas brasileiras ainda não obtidas permanecem INCERTAS. [CORRIGIDO CODEX M1-1, M2-2, M2-3, M3-3]

**CTCAE v6 — conferência independente (Codex, 11/10/2026):** [XLSX oficial NCI, Clean Copy e Mapping](https://dctd.cancer.gov/research/ctep-trials/trial-development/ctcae-v6.0.xlsx), MedDRA 28.0, SHA-256 4d7b4fcfdcb25c45a23b02c07fcb20eab7f284b23862e4e4e64bb8823c2f440b. CSV local parseado integralmente: **55 registros**; a cobertura “16/18” não foi demonstrada por lista nominal dos 18, portanto NÃO VERIFICÁVEL. CSV não foi alterado.

- Proteinuria foi excluído e mapeado para **Urinary protein increased** (10046553), ainda sem registro próprio no CSV. Adultos, urina de 24 h: G1 ≥LSN e <1,0 g; G2 1,0 a <3,5 g; G3 ≥3,5 g. Fita/P:C têm critérios próprios; pediatria difere. Coleta de 24 h prevalece sobre fita. Não confundir grau CTCAE com limiar de suspensão de uma droga.
- Rash acneiform foi excluído; Mapping aponta **Rash maculo-papular**, já presente no CSV, cuja nota manda considerar **Pustular drug eruption** (10082061), ausente no CSV. Mapeamento terminológico não autoriza conservar o grau v5 nem escolher automaticamente um fenótipo; rash v6: G1 assintomático, G2 sintomas leves, G3 inclui >50% de superfície corporal ou sintomas moderados/graves; consultar critérios completos para G4/G5.
- **Neutrophil count decreased:** v6 usa G1 1000 a <1500; G2 500 a <1000; G3 100 a <500; G4 <100 células/mm³. Esses cortes conferem no CSV. Não transplantar graus v5 para decisões v6 nem converter a tabela de uma bula histórica sem validação. [CORRIGIDO CODEX M4-1]

### 3.2 Frente 2 — Laudos sociais: histórico herdado, sem liberação jurídica nesta revisão médica

**Não utilizar as linhas abaixo como parecer jurídico ou modelo de benefício validado. As notas CORRIGIDO prevalecem sobre o histórico.**

| Laudo | Norma-base | Ementa/trecho essencial |
|---|---|---|
| INSS (incapacidade) | Lei 8.213/91 arts. 42, 59, 101; Decreto 3.048/99 art. 78 §2º | perícia obrigatória "sob pena de suspensão do benefício"; cessação pela recuperação; carência 12 contribuições (art. 25 I) |
| Afastamento | Resolução CFM 2.381/2024; CLT art. 473 IV | "Todos os documentos médicos devem conter minimamente: identificação do médico: nome e CRM/UF"; indica o tempo de afastamento |
| LOAS/BPC | Lei 8.742/93 arts. 20-21; Decreto 6.214/07 art. 16 §1º | "avaliação social e avaliação médica"; revisão a cada 2 anos |
| TFD | Base vigente e vigência futura: ver nota herdada abaixo; não usar a Lei 15.390/2026 como vigente antes da data nela registrada | PENDENTE de validação jurídica final; não alterar automaticamente modelos |
| Passe livre | Lei 8.899/94 (só PCD interestadual) | para oncológico sem deficiência: **depende de lei estadual/municipal** |
| Judicialização | CF art. 196; STF Tema 6 (RE 566.471) | "concessão judicial de medicamento registrado na ANVISA, mas não incorporado"; relatório com eficácia + ausência de alternativa + indicação médica expressa |
| Fraldas | Elenco PFPB inclui fralda geriátrica no Anexo II da Portaria GM/MS 12.091/2026, consultada em 11/10/2026 | [FP2026](https://bvsms.saude.gov.br/bvs/saudelegis/gm/2026/prt12091_24_09_2026_rep.html); requisitos de elegibilidade e modelo de laudo permanecem pendentes; não usar Portaria 3.073/2024 como fundamento de fraldas. [CORRIGIDO FINAL — FF02] |
| FGTS | Lei 8.036/90 art. 20 XI (incl. pela Lei 8.922/94) | "trabalhador ou qualquer de seus dependentes for acometido de neoplasia maligna"; renovação anual = prática Caixa, sem previsão literal |
| Isenção IR | Lei 7.713/88 art. 6º XIV (red. Lei 11.052/2004) | proventos isentos para neoplasia, "com base em conclusão da medicina especializada"; serviço gov.br exige laudo com CID e data |
| O2 domiciliar / dieta enteral | ODP: Portaria SAS 292/2012 (histórica) + critérios PaO2<55/SaO2<88%, ≥15 h/dia; Enteral: Port. Consolidação 2/2017 Anexo XXVIII (CEAF/LME-APAC, alt. GM 13/2020) | texto integral da 292/2012 e PCDT Conitec vigente: SEM_FONTE |

**Verificação da auditoria (2026-10-11, textos do Planalto):**
- TFD — ORIGINAL: "Portaria SAS/MS 55/1999 + Lei 15.390/2026 (NOVA) … ajuda de custo (transporte/alimentação/hospedagem + acompanhante)".
  - CORRIGIDO: a Lei 15.390, de 15/04/2026 (DOU 16/04/2026), acrescenta o art. 19-X à Lei 8.080, mas **só entra em vigor 1 ano após a publicação** (art. 2º), ou seja, em 16/04/2027. Até lá, a base vigente é a Portaria SAS 55/1999. Termos exatos da lei: "diárias para alimentação" e "diárias para pernoite"; acompanhante "se solicitado"; é vedada abaixo de 50 km ou dentro da mesma região metropolitana; exige indicação "feita por médico atuante nas unidades assistenciais vinculadas ao SUS". REVIEW_REQUIRED (vigência futura).
- Fraldas — ORIGINAL: "Portaria GM/MS 3.073/2024 (gratuidade Farmácia Popular, incontinência/diabetes)".
  - CORRIGIDO (CONTESTADA): a Portaria GM/MS 3.073, de 15/01/2024, inclui **absorventes higiênicos** (dignidade menstrual) no Farmácia Popular; não trata de fraldas. Fonte: CONASS, resumo da portaria, aberto em 2026-10-11. A página gov.br/Farmácia Popular lista a Portaria GM/MS 6.613/2025 (gratuidade de medicamentos para incontinência urinária) e as Portarias 8.407/2025 e 9.210/2025 (valor de referência da fralda geriátrica). A base vigente da gratuidade de fraldas fica INCERTA até a leitura do texto integral dessas portarias.
- FGTS (Lei 8.036/90 art. 20 XI): CONFIRMADA. "acometido de neoplasia maligna".
- Isenção de IR (Lei 7.713/88 art. 6º XIV): CONFIRMADA. "com base em conclusão da medicina especializada".
- Passe livre (Lei 8.899/94): CONFIRMADA. "pessoas portadoras de deficiência, comprovadamente carentes", só interestadual.
- INSS (Lei 8.213/91 art. 101): CONFIRMADA. "sob pena de suspensão do benefício".
- CFM 2.381/2024, Decreto 6.214/07, STF Tema 6, Decreto 3.048/99 e Portaria de Consolidação 2/2017: INCERTA (não abertos nesta auditoria).

### 3.3 Frente 4 — Orientações e encaminhamentos

- **Dieta geral:** INCA "Guia de nutrição para pacientes e cuidadores" 4ª ed. 2020 (ninho.inca.gov.br/…/12392) + **Consenso Nacional de Nutrição Oncológica 2ª ed. 2015 (vol. II 2016)** — URLs oficiais recuperadas no Loop 2 + ESPEN practical guideline (Arends 2021, DOI 10.1016/j.clnu.2021.02.005). **PENDENTE DE VALIDAÇÃO POR AFIRMAÇÃO:** referências/cronogramas deste bloco não inteiramente verificados nesta rodada; sem promoção automática a regra clínica. [CODEX M1-2]
- **Por tumor:** cabeça/pescoço (textura/fracionamento/suplemento, ASPEN via NutriTotal), esôfago/estômago (dumping: refeições pequenas, proteína primeiro — Oncoguia/Einstein), estomia (INCA "Cuidados com estomias" 2ª ed. 2018, cap. Alimentação — PDF arquivado), pâncreas (enzimas/esteatorreia — Oncoguia/GANEP/PanCAN). **PENDENTE DE VALIDAÇÃO POR AFIRMAÇÃO:** referências/cronogramas deste bloco não inteiramente verificados nesta rodada; sem promoção automática a regra clínica. [CODEX M1-2]
- **Por toxicidade:** náusea e mucosite (MSKCC PT + AC Camargo), diarreia/constipação (AC Camargo 2025 + cartilha INCA "Constipação intestinal no câncer avançado"), perda de peso (INCA sarcopenia 18160 + dietas restritivas 12782), **neutropenia/segurança alimentar** (INCA Guia 2020 "Queda de imunidade" + Cartilha TCTH INCA; carnes/ovos crus = unânime; restrição de cruas em geral controversa entre instituições). **PENDENTE DE VALIDAÇÃO POR AFIRMAÇÃO:** referências/cronogramas deste bloco não inteiramente verificados nesta rodada; sem promoção automática a regra clínica. [CODEX M1-2]
- **Atividade física:** ACSM/Patel 2019 (PMID 31626056) + Schmitz 2010 (PMID 20559064): 150 min/sem moderado + ≥2x força; metástase óssea = sem progressão de carga em membro acometido; cortes numéricos citáveis: plaquetas <20–50 mil (BMC PMC9420674; ACSM GETP é paywall); Hb<8 idem com ressalva. **PENDENTE DE VALIDAÇÃO POR AFIRMAÇÃO:** referências/cronogramas deste bloco não inteiramente verificados nesta rodada; sem promoção automática a regra clínica. [CODEX M1-2]
- **Sinais de alarme:** corte local D-W9-38 confirmado em `docs/DECISOES.md`: temperatura **estritamente >37,8 °C**, preservado. É gatilho operacional, não diagnóstico de neutropenia febril nem prova de maior sensibilidade clínica. A equivalência das listas externas com os 25 sinais locais não foi demonstrada por comparação item a item. Definição IDSA citada (≥38,3 °C única ou ≥38,0 °C por ≥1 h): fonte [ASCO/IDSA 2018](https://www.idsociety.org/globalassets/idsa/practice-guidelines/outpatient-management-of-fever-and-neutropenia.pdf) localizada, mas a extração disponível ficou ilegível; confirmação literal permanece pendente nesta rodada. [CORRIGIDO CODEX M3-5]
- **Encaminhamentos SUS:** Lei 12.732/2012 (60 dias; + Lei 13.896/2019: exames em 30 dias); [CONFIRMADO no Planalto em 2026-10-11: art. 2º "no prazo de até 60 (sessenta) dias"; Lei 13.896/2019 "realizados no prazo de 30 (trinta) dias"; Lei 14.238/2021 art. 4º, inciso V "prioridade" e §2º "Entende-se por direito à prioridade"] prioridade = **Lei 14.238/2021** (Estatuto da Pessoa com Câncer, art. 4º §2º) — ver correção §4; SISREG III/DRAC-MS (páginas oficiais gov.br).

### 3.4 Frente 5 — Packs de tumor e exames por tumor

- **Já existia localmente** (não duplicado): `06-tumor-packs-1-5.md` cobre gástrico (parcial, intervalos NÃO_VERIFICADOS), esôfago, pâncreas, CHC, vias biliares; `07-…6-10.md` cobre rim, bexiga, ovário, colo, C&P — com marcadores NÃO_VERIFICADOS.
- **Mama:** [ESMO Pocket Breast Cancer 2023, pp. 60–61](https://data.esmo.org/guidelines/pdf/publicassets/ESMO_2023_BreastCancer.pdf) sustenta seguimento conforme risco, mamografia anual e ausência de exames para procurar recidiva de rotina em assintomáticas; US/RM podem ser indicadas, portanto **“única imagem” não é regra absoluta**. Biomarcadores ER/PgR/HER2/Ki-67 constam do pocket. Concordância exata com NCCN 2026/SBOC 2025 ainda NÃO VERIFICADA. Eco basal antes de antraciclinas e anti-HER2: **ESC 2022 I-B confirmado**, tabelas 7/8 ([PDF, pp. 4259–4260](https://cardio-onco.fr/wp-content/uploads/2023/06/ehac244.pdf)); não é uma regra de eco antes de qualquer QT. [CORRIGIDO CODEX M1-2, M3-3]
- **Colorretal:** NCCN Colon v2.2026 (patients PDF): PE+CEA q3-6m a1-2→q6m até a5; TC TAP q6-12m×5 anos; colonoscopia ano 1 (3-6 m se incompleta no diagnóstico) → ano 3 → q5 anos (cadência via PMC12146933 que cita NCCN/ESMO). Reto: + TR/retoscopia q3-4m e RM pelve q6m×3 anos (NCCN Rectal 2026). Metastático: MMR+RAS+BRAF em todos (ESMO mCRC 2026, PMID 41990853); HER2 se RAS-wt. **PENDENTE DE VALIDAÇÃO POR AFIRMAÇÃO:** referências/cronogramas deste bloco não inteiramente verificados nesta rodada; sem promoção automática a regra clínica. [CODEX M1-2]
- **Próstata:** PCDT/Portaria SAS 498/2016: PSA 3-6-12 m → semestral até a3 → anual; definições de RB (PSA>0,2 pós-cirurgia; nadir+2 pós-RT). NCCN Prostate v5.2026: vigilância ativa (PSA 1-2x/ano, TR 1x/ano, RM 1-2 em 2 anos, biópsia 1-3 anos). INCA nota técnica vigente: **não rastrear populacionalmente com PSA** (decisão compartilhada se solicitado). **PENDENTE DE VALIDAÇÃO POR AFIRMAÇÃO:** referências/cronogramas deste bloco não inteiramente verificados nesta rodada; sem promoção automática a regra clínica. [CODEX M1-2]
- **Pulmão:** NCCN NSCLC 2026: pós-ressecção TC q6m×2-3 a→anual (baixa dose); painel obrigatório metastático: EGFR (comunidades raras), KRAS G12C, ALK, ROS1, BRAF, NTRK, MET ex14, RET, HER2, NRG1 + PD-L1; reavaliação TC q6-12 sem. ESMO mNSCLC 2023 (Hendriks; PMC11648200): EGFR/ALK [I,A]. **PENDENTE DE VALIDAÇÃO POR AFIRMAÇÃO:** referências/cronogramas deste bloco não inteiramente verificados nesta rodada; sem promoção automática a regra clínica. [CODEX M1-2]
- **Gástrico (novo):** ESMO Gastric 2022 (Lordick, PMID 35914639; PMC10937212) + living v1.1 2023: estadiamento EDA+biópsia+TC TAP [V,A]; PET não de rotina [III,C]; laparoscopia+citologia em ressecáveis [III,B]; biomarcadores: HER2 [I,A], PD-L1 CPS [I,A], MSI/dMMR [II,A], CLDN18.2 "if available" [I,A]. Vigilância: **NCCN Stomach 2026 (patients)**: exame q3-6m 1-2 a→q6-12m até 5; TC q6m×2 a→anual até 5; EDA alta pós-ER q6m a1→anual; **B12:** o calendário q3m/q6m descrito anteriormente não foi validado na NCCN citada e não é sustentado pelas recomendações ESPEN 21.8/21.9. [ESPEN 2024, recomendações 21.2, 21.8 e 21.9](https://www.espen.org/files/ESPEN-Guidelines/ESPEN-practical-short-micronutrient-guideline.pdf) trata avaliação ao menos anual, suplementação vitalícia na má absorção e via IM em situações como gastrectomia TOTAL; não universalizar a todo câncer gástrico ou ressecção parcial. Intervalos e via devem ser curados por situação. [CORRIGIDO CODEX M3-4] **PENDENTE DE VALIDAÇÃO POR AFIRMAÇÃO:** referências/cronogramas deste bloco não inteiramente verificados nesta rodada; sem promoção automática a regra clínica. [CODEX M1-2]
- **Transversais:** pedido de imagem — ACR Appropriateness Criteria + iRefer/RCR 9ª ed. (pergunta clínica + "Has it been done already?"); CBR SEM_FONTE (leads: Critérios de Adequação CBR, Parecer CFM 23/2019). Marcadores — ASCO/EGTM: não usar CEA/CA15-3/CA27-29 em rotina de mama assintomática; CEA sim no II-III colorretal. **PENDENTE DE VALIDAÇÃO POR AFIRMAÇÃO:** referências/cronogramas deste bloco não inteiramente verificados nesta rodada; sem promoção automática a regra clínica. [CODEX M1-2]

---

## 5. Pendências acumuladas — cinco originais e pendências clínicas adicionais

| # | Pendência | Frente |
|---|---|---|
| 1 | Diretriz formal (ESMO/NCCN/ASCO) verbatim sobre tamoxifeno × TEV prévio (bula primária obtida na revisão médica, com cenário delimitado; diretriz formal originalmente solicitada ainda pendente) | 1 |
| 2 | Texto integral/consolidação da Portaria SAS 292/2012 (ODP) + PCDT Conitec vigente | 2 |
| 3 | Resolução INSS da Avaliação Médica e Social do BPC (equivalentes oficiais: Decreto 6.214/07 + Port. Intermin. 1/2014) | 2 |
| 4 | PDFs AC Camargo 2025 (alimentação na QT) — atrás de Cloudflare; obter com o serviço de nutrição | 4 |
| 5 | Documento CBR sobre conteúdo obrigatório do pedido de imagem | 5 |

**Estado das pendências após reauditoria médica (11/10/2026):** conservadas as cinco pendências anteriores como histórico; a de tamoxifeno × TEV agora possui bula primária, embora a diretriz formal solicitada continue pendente. Classes/níveis ESC resolvidos somente nas situações verificadas acima. Persistem base legal de fraldas, bula profissional brasileira de capecitabina, fontes e escopos dos packs/nutrição/exercício. Não confundir disponibilidade de fonte com aprovação clínica.

## 6. Decisões clínicas ainda necessárias

1. A promoção será feita por afirmação/ficha aprovada, mantendo fora do corpus operacional os trechos pendentes?
2. O produto brasileiro, o protocolo e o método renal serão obrigatórios antes de transformar os cortes de cisplatina/capecitabina em regra?
3. Os cronogramas de seguimento e as orientações de exercício/nutrição aguardarão validação individual antes de gerar documentos ao paciente?

## 7. Uso permitido e limites

Este consolidado é insumo documental para revisão do Dr. Silas. Não houve alteração de JSON, CSV, cálculos, UI ou código, nem commit/push. Não se infere aprovação a partir da palavra FINAL. Mudança de fonte, versão de bula ou população exige nova validação do item afetado.

## 8. Registro acumulado dos 19 achados médicos

| ID | Estado documental nesta edição | Limite clínico remanescente |
|---|---|---|
| M1-1 | Correção/qualificação da rodada anterior preservada; comparada nesta rodada | Aprovação e pendências seguem o texto do item; não houve promoção silenciosa |
| M1-2 | Correção/qualificação da rodada anterior preservada; comparada nesta rodada | Aprovação e pendências seguem o texto do item; não houve promoção silenciosa |
| M2-1 | Correção/qualificação da rodada anterior preservada; comparada nesta rodada | Aprovação e pendências seguem o texto do item; não houve promoção silenciosa |
| M2-2 | Correção/qualificação da rodada anterior preservada; comparada nesta rodada | Aprovação e pendências seguem o texto do item; não houve promoção silenciosa |
| M2-3 | Correção/qualificação da rodada anterior preservada; comparada nesta rodada | Aprovação e pendências seguem o texto do item; não houve promoção silenciosa |
| M3-1 | Correção/qualificação da rodada anterior preservada; comparada nesta rodada | Aprovação e pendências seguem o texto do item; não houve promoção silenciosa |
| M3-2 | Correção/qualificação da rodada anterior preservada; comparada nesta rodada | Aprovação e pendências seguem o texto do item; não houve promoção silenciosa |
| M3-3 | Correção/qualificação da rodada anterior preservada; comparada nesta rodada | Aprovação e pendências seguem o texto do item; não houve promoção silenciosa |
| M3-4 | Correção/qualificação da rodada anterior preservada; comparada nesta rodada | Aprovação e pendências seguem o texto do item; não houve promoção silenciosa |
| M3-5 | Correção/qualificação da rodada anterior preservada; comparada nesta rodada | Aprovação e pendências seguem o texto do item; não houve promoção silenciosa |
| M4-1 | Correção/qualificação da rodada anterior preservada; comparada nesta rodada | Aprovação e pendências seguem o texto do item; não houve promoção silenciosa |
| M5-1 | Correção/qualificação da rodada anterior preservada; comparada nesta rodada | Aprovação e pendências seguem o texto do item; não houve promoção silenciosa |
| M5-2 | Correção/qualificação da rodada anterior preservada; comparada nesta rodada | Aprovação e pendências seguem o texto do item; não houve promoção silenciosa |
| M5-3 | Correção/qualificação da rodada anterior preservada; comparada nesta rodada | Aprovação e pendências seguem o texto do item; não houve promoção silenciosa |
| M5-4 | Correção/qualificação da rodada anterior preservada; comparada nesta rodada | Aprovação e pendências seguem o texto do item; não houve promoção silenciosa |
| M5-5 | Correção/qualificação da rodada anterior preservada; comparada nesta rodada | Aprovação e pendências seguem o texto do item; não houve promoção silenciosa |
| M5-6 | Correção/qualificação da rodada anterior preservada; comparada nesta rodada | Aprovação e pendências seguem o texto do item; não houve promoção silenciosa |
| M6-1 | Correção/qualificação da rodada anterior preservada; comparada nesta rodada | Aprovação e pendências seguem o texto do item; não houve promoção silenciosa |
| M6-2 | Correção/qualificação da rodada anterior preservada; comparada nesta rodada | Aprovação e pendências seguem o texto do item; não houve promoção silenciosa |

## 9. Histórico de busca e auditorias — não usar como regra ativa

<details>
<summary>Histórico preservado; contagens e alegações não revalidadas não constituem evidência clínica</summary>

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
  - ORIGINAL: Cobertura temática média das frentes: 96,5%.
  - CORRIGIDO: 96,6% (média de 96,2 + 90,0 + 100 + 100 = 96,55, arredondada). Recalculado da própria tabela, 2026-10-11.
- Cobertura consolidada: **61/63 temas** com pelo menos uma fonte real (96,8%).
- Densidade média de busca: **2,48 buscas/tema** (156 buscas ÷ 63 temas).
  - NÃO VERIFICADA: a conta 156 ÷ 63 = 2,48 está certa, mas 2 das 4 contagens de buscas são aproximadas ("~38", "~40") e não existe log de buscas para reproduzir (2026-10-11).
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
  - NÃO VERIFICADA: a soma 156 + 155 está certa, mas as parcelas são estimativas sem log reproduzível (2026-10-11).
- Total de lacunas resolvidas: **29/34** (25 plenas + 4 parciais/com ressalva).
- Total de pendências `SEM_FONTE` finais: **5** (taxa de resolubilidade global das lacunas: 85,3%).
- Referências coletadas com trecho citável: **~130** (estimativa consolidada dos achados dos 8 relatórios).
  - NÃO VERIFICADA: os 8 relatórios de origem não foram localizados no repositório e o documento lista bem menos de 130 referências (2026-10-11).
- Itens de corpus destravados para redação RASCUNHO (somatório): 42 interações (37 inativas + 5 novas), ~14 contraindicações/condicionais, 18 termos CTCAE (16 já no CSV local + 2 a acrescentar), 10 laudos com base legal, 20 temas de orientação + unificação dos 28 itens de sinais-alarme (2+1+25), 5 packs de tumor (4 revisões + 1 novo gástrico) + 2 transversais (pedido de imagem, política de marcadores) → **≈ 139 itens**.
- Ganho incremental do Loop 2: +14,3 pontos de cobertura absoluta sobre as lacunas; cobertura final global **~99,2%** dos 63 temas.
  - NÃO VERIFICADA: 99,2% de 63 temas equivale a 62,5 temas, valor impossível; o Loop 2 resolveu lacunas, não temas, e não diz quais dos 2 temas sem fonte foram cobertos (2026-10-11).

---

## 4. Correções factuais capturadas (evitam erro de entrar no corpus)

1. **Lei 14.451/2022 NÃO é de fraldas** — altera quóruns de sociedade limitada (Código Civil). Fonte: Planalto.
2. **Lei 12.802/2013 NÃO é atendimento preferencial** — é reconstrução mamária no SUS. A lei correta é **Lei 14.238/2021 (Estatuto da Pessoa com Câncer), art. 4º §2º**.
3. **"Lei 15.284/2025" verificada = mamografia**, não fraldas (candidato a lei de fraldas: PL 3.603/2023, aprovado na Câmara set/2025, sem sanção até out/2026).
4. **DPI/DPSC** (siglas de documentos INSS citadas na 1ª rodada) **não existem na IN 128/2022** — provável ruído; descartar do modelo de laudo INSS.
5. CtCAE: "rash acneiforme" não existe como termo próprio na v6 — mapeamento oficial para "Rash maculo-papular".

**Verificação da auditoria (2026-10-11):**
- (1) Lei 14.451/2022: CONFIRMADA. A ementa no Planalto "altera os quóruns de deliberação dos sócios da sociedade limitada".
- (2) Lei 12.802/2013 × 14.238/2021: CONFIRMADA. A 12.802 trata da "cirurgia plástica reparadora da mama"; a 14.238 traz prioridade no art. 4º, V e §2º.
- (3) Lei 15.284/2025 = mamografia: CONFIRMADA ("direito à realização do exame de mamografia"). PL 3.603/2023: INCERTA (não aberto).
- (4) DPI/DPSC na IN 128/2022: CONFIRMADA. Zero ocorrência no texto publicado no DOU (in.gov.br, 690 artigos varridos). Ressalva: as alterações posteriores (IN 167/2024, 170/2024) não foram varridas.
- (5) Rash acneiforme → rash maculo-papular: CONFIRMADA (XLSX oficial do NCI).
- (6, nova) Proteinúria → "Urinary protein increased" na v6: correção acrescentada por esta auditoria.
- (7, nova) Lei 15.390/2026 só vigora a partir de 16/04/2027: correção acrescentada.
- (8, nova) Portaria GM/MS 3.073/2024 trata de absorventes, não de fraldas: correção acrescentada.

## Registro histórico da auditoria anterior (Claude, 2026-10-11; contagens não equivalem à reauditoria médica Codex)

Auditoria do Claude a pedido do Dr. Silas (PEM v1.3). O original está preservado em `F1-CORPUS-BUSCAS-CONSOLIDADAS.ORIGINAL-2026-10-11.md`. Veredicto completo em `C:\Users\silas\handoff\2026-10-11_auditoria-corpus-buscas-f1.md`.

| Classificação | Linhas |
|---|---|
| Confirmadas (fonte primária aberta e anotada) | 22 |
| Corrigidas (CONTESTADA, com ORIGINAL/CORRIGIDO) | 6 (proteinúria v6; erlotinibe × antiácido; Lei 15.390 vigência; Portaria 3.073 ≠ fraldas; cobertura média 96,6%; perguntas 2–4 reescritas) |
| Rebaixadas a INCERTA | 5 (ESC classe I-C; ESC classe I-B; capecitabina × varfarina "1 mês"; base de fraldas; fontes não abertas listadas em bloco) |
| Métricas NÃO VERIFICADAS | 4 (densidade, total ~311, ~130 referências, cobertura final 99,2%) |
| Referências reprovadas | 1 (citação literal "should be avoided" da bula Votrient não existe; o sentido foi mantido com outro trecho) |

Nenhuma pendência anterior foi ocultada: as resolvidas têm fonte/contexto atualizados acima e as não resolvidas permanecem explícitas. As contagens históricas desta tabela não foram adotadas como métricas clínicas atuais. Reauditoria Codex: somente este documento foi editado; backup, CSV, JSON e código preservados. Sem commit/push. [11/10/2026]

</details>

## Arquivos relacionados — versões finais existentes

- [50 receitas](C:/Users/silas/.zcode/workspace/default/50-receitas-medicas-ambulatoriais.CORRIGIDO.md)
- [Fármacos por classe](C:/Users/silas/.zcode/workspace/default/farmacos-por-classe.CORRIGIDO.md)

O documento final não incorpora esses arquivos ao corpus; cada pendência e decisão médica permanece no arquivo correspondente.

---

# EXECUÇÃO DOCUMENTAL F1 — matriz de entrega (§20 do prompt mestre)

**Executor:** GLM, 11/10/2026, por ordem expressa do Dr. Silas: "EXECUTAR TODAS AS AÇÕES E APRESENTAR OS DOCUMENTOS. NÃO TOCAR NO CÓDIGO." Base: `f1/integrado` @ `a7295158a527ff6ac0651e188ab7f65ee5e8c8a3` (branch `f1/integrado`, conferida; worktree limpa antes do início). **Escopo:** somente documentos (`*.RASCUNHO.json` novos + este consolidado). Zero alterações em `src/**`, `scripts/**`, `tests/**`, corpus existente e arquivos externos imutáveis (provado: `git status` = 0 modificados, 8 pastas novas não rastreadas).

**Convenção de header aplicada aos 33 RASCUNHOs:** `header` legado exato (`RulesetHeader`: id, versao, vigenteDesde, fonte DECISAO_MEDICA→docs do projeto, curador, aprovadoEm=data de redação conforme BLOCO COMUM) + bloco `curadoria` de nível superior com a distinção exigida no §7: `estado:"RASCUNHO"`, `redigidoEm`, `redator`, `aprovacaoClinica:null`, `consultavel:true`, `alerta:false`, `pendencia`. A correção definitiva do contrato (consultavel/alerta no schema) permanece tarefa de código do Codex (D-F1-05).

## Matriz por pilar

| Pilar | Entregável (caminho) | Estado | Conteúdo | Fontes/curadoria | Pendências |
|---|---|---|---|---|---|
| 1 Exames | `1-exames/rads/pedido-imagem-resumo-caso.v1.RASCUNHO.json` | PARCIAL | modelo D-F1-04 com FATO×DECISÃO, ≤5 linhas, conferência 1 clique | D-F1-04; ACR/iRefer | CBR SEM_FONTE |
| 1 Exames | `1-exames/labs/labs-por-esquema.v1.RASCUNHO.json` | PARCIAL | 7 painéis por classe (pemetrexede D1/D8/D15; eco ESC I-B; QT/eletrólitos; ICI; cisplatina; sorologias; TAP) | bulas/DailyMed citadas | ICI e cisplatina SEM_FONTE; revisão lab-thresholds = motor (fora do escopo sem código) |
| 1 Exames | `1-exames/path/campos-laudo-path.v1.RASCUNHO.json` | ENTREGUE (rascunho) | campos AP/IHQ por tumor (5) + comuns + proibições | ESMO/NCCN/PCDT | nenhuma estrutural |
| 1 Exames | `1-exames/endoscopicos/campos-laudo-endoscopico.v1.RASCUNHO.json` | ENTREGUE (rascunho) | 5 procedimentos com campos + intervalos com fonte | NCCN 2026 | nenhuma estrutural |
| 2 Receitas | `2-receitas/especiais/receitas-especiais-estrutura.v1.RASCUNHO.json` | PARCIAL (estrutura) | 15 itens nas 4 famílias; posologias null | veredicto Codex (NO-GO externos) | TODAS as doses SEM_FONTE até o Dr. Silas corrigir os arquivos externos e re-auditar |
| 2 Receitas | `2-receitas/classes/classes-farmacologicas.v1.RASCUNHO.json` | PARCIAL | 11 classes + fatos regulatórios VERIFICADOS (tramadol A2, fenobarbital B1, zolpidem B1/2024, carbamazepina C1, MTX≠C1, ondansetrona IV 16 mg CINV, domperidona 30 mg/7 d) | RDC 1.036/2026; OMS ATC; EMA/MHRA | apresentação SUS por fármaco SEM_FONTE |
| 3 Laudos | `3-laudos/{inss,afastamento,loas,transporte,judicializacao-drogas,fraldas,fgts,nutricao,oxigenio,incapacidade}/laudo-*.v1.RASCUNHO.json` (10 arquivos) | ENTREGUE (rascunho) | base legal + requisitos FATO×DECISÃO + anexos + proibições por finalidade | §3.2 auditado | oxigênio: norma federal integral SEM_FONTE; fraldas: portarias 2025 a ler; CFM/Dec. 6.214/Tema 6 = VERIFICAÇÃO JURÍDICA pendente |
| 4 Interações | `4-interacoes-contraindicacoes/interacoes-complemento.v1.RASCUNHO.json` | PARCIAL | 31 propostas (17 com fonte, 14 SEM_FONTE, 1 REVIEW); 12 propostaAlerta; 4 fusões documentadas para o Codex | §3.1 Codex-verificado | tamoxifeno×CYP2D6 bula ANVISA; TKI×CYP3A4 por molécula |
| 4 Contraindicações | `4-interacoes-contraindicacoes/contraindicacoes-complemento.v1.RASCUNHO.json` | PARCIAL | 10 itens (6 fontados, 4 parciais/incertos) com classificação CI×precarição×ajuste | idem | bulas ANVISA profissionais |
| 5 CTCAE graus | `5-ctcae-acao/ctcae-graus.v1.RASCUNHO.json` | ENTREGUE (rascunho) | 18 tópicos; 17/17 presentes no CSV local mapeados por registro (R2–R42); Urinary protein increased a acrescentar; rash v6 com nota | NCI v6 XLSX + CSV local | extração de critérios literais na migração |
| 5 CTCAE-ação | `5-ctcae-acao/ctcae-acao.v1.RASCUNHO.json` | PARCIAL | 9 classes; 9 células com fonte (fluoropirimidina-DPYD, pemetrexede pré-ciclo, antraciclina hepático 50/25/não, anti-HER2 FEVE, TKI QT) × 7 nulas SEM_FONTE | bulas citadas | tabelas de modificação por molécula; ICI algoritmos (prioridade) |
| 6 Packs | `6-pack-tumor/{mama,colorretal,prostata,pulmao,gastrico}/*.v1.RASCUNHO.json` (5) | PARCIAL | esqueletos preenchidos: biomarcadores, exames por ID do catálogo (todos resolvem), fases com intervalos fonte, limites de aplicabilidade; gástrico NOVO completo | ESMO 2022/2023, NCCN 2026, PCDT 498/2016, ESPEN 2024 | [CODEX M1-2] validação por afirmação nos blocos marcados; edição AJCC |
| 7 Orientações | `7-orientacoes/dieta/{dieta-geral-qt,dieta-por-tumor,dieta-por-toxicidade}.v1.RASCUNHO.json` + `atividade-fisica.v1.RASCUNHO.json` | ENTREGUE (rascunho paciente) | textos ≤8ª série, fontes INCA/ESPEN/ACSM; precauções com cortes só quando citáveis | §3.3 | aprovação de texto ao paciente (D-WhatsApp); AC Camargo URLs |
| 7 Sinais-alarme | `7-orientacoes/sinais-alarme/sinais-alarme-consolidado.v1.RASCUNHO.json` | ENTREGUE (rascunho) | correspondência item a item: 25 sinais distintos + 4 extras do kit + parágrafo "na dúvida"; saídas SAMU/PS; febre D-W9-38 estrito | D-W9-28/38/41 + D-W5-05 | decidir saídas de contato/triagem (SA-10/13/17/18/21/24) |
| 8 Encaminhamentos | `8-encaminhamentos/{mastologia,cirurgia-oncologica,radioterapia}/*.v1.RASCUNHO.json` (3) | ENTREGUE (rascunho) | motivos em lista fechada, FATO×DECISÃO, urgência com critério, SISREG, prazos 60/30 dias, prioridade Lei 14.238 | §3.3 confirmado | nenhum fluxo municipal inventado (campo por serviço) |

## Métricas (§18, denominadores reproduzíveis)

- **M1 inventário (recontado agora):** corpus 164 JSONs (131 + 33 novos); catálogo 141 (132 VERIFICADO_SIGTAP + 9 SEM_CODIGO_SUS, contagem por script); interações 45 (8 ativas/37 inativas, severidade 0/45 — proposta feita aqui para 31, 16+ fontadas); condicionais 22 ativas preservadas; CSV CTCAE 55 registros parseados (17/18 tópicos presentes); comuns 47 fichas (0 consumíveis — intocado); packs 4 esqueletos + 1 novo; sinais-alarme 3 representações → 1 consolidado; loader ainda lê `ativo` (src/server/corpus.ts:69 — código, intocado por ordem).
- **M2 rastreabilidade:** 33 arquivos × itens: 60 afirmações clínicas com fonte com trecho no nível do item; itens sem fonte = null + pendência explícita (nenhum preenchido por plausibilidade).
- **M3 consistência:** percentual administrado × reduzido separados (antraciclina); ClCr×TFGe distinguidos; cálcio elementar×sal distinguidos; febre >37,8 estrito preservado.
- **M4 cobertura:** subtópicos do mestre com estado individual na matriz acima (não conta pasta/README como cobertura — nenhum README criado).
- **M5 regressão:** `git status` = 0 arquivos modificados; 141 IDs de exames preservados (nenhum JSON antigo tocado); 47 fichas/22 condicionais/45 interações intactos; IDs dos packs novos só referenciam IDs existentes do catálogo (verificado por script: 0 inválidos); 11 correções ATC do veredicto preservadas no rascunho de classes (9 confirmadas citadas); achados A01–A17/B01–B26/U01–U07/N01–N16/Q01–Q61 do veredicto Codex incorporados como estado (correções registradas em fraldas/classes/especiais; nada promovido a VERIFICADO por concordância); 0 aprovações fabricadas (aprovacaoClinica:null em todos).
- **M6 integração:** NÃO EXECUTADO — é código (loader/página do tema/Flash/pedido persistido), proibido por ordem expressa. Os RASCUNHOs estão no caminho final da árvore para o Codex conciliar (como previsto nos prompts por frente).

## Provas executadas

1. `node -e` parse de 33/33 RASCUNHOs: 0 erros de JSON.
2. Checagem de IDs: 56 referências de exames nos 5 packs → 0 inválidos contra o catálogo.
3. `node scripts/validate-corpus.mjs` (saída real): **`corpus ok (164 arquivos)`** — verde com os novos arquivos incluídos.
4. `git status`: 0 modificados; somente 8 pastas novas + 3 docs não rastreados (commit fica a critério do fluxo do repo).
5. Provas clínicas dirigidas aplicadas na redação: percentual administrado (doxorrubicina 50/25), pontos percentuais absolutos de FEVE (≥16/<40 ESC separado da bula), limite exclusivo de febre (37,8 não dispara), ClCr por Cockcroft (capecitabina EUA), unidade Calvert em mg. Aritmética correta não foi usada para validar indicação.

## Decisões médicas necessárias (perguntas em 1 frase)

1. Sinais-alarme: aprovar saída "contato/triagem" para os 6 sinais não-emergência (SA-10/13/17/18/21/24) ou mantê-los fora do par SAMU/PS?
2. Tamoxifeno×TEV e tamoxifeno×CYP2D6: manter GRAVE com as fontes atuais (bula DailyMed/Drugs.com) ou aguardar bula ANVISA?
3. Cisplatina ClCr<60: entra como alerta (não contraindicação universal) conforme classificação CI-01?
4. Fraldas: aprovar Anexo II da Portaria GM/MS 12.091/2026 como base provisória até a leitura das portarias 6.613/8.407/9.210 de 2025?
5. Rash: confirmar adoção do mapeamento oficial v6 (maculo-papular + nota pustular em EGFR-i)?
6. As 50 receitas externas: aguardar correção dos 6 HARD_STOPs pelo Dr. Silas antes da importação (veredicto Codex NO-GO mantido)?
7. Erlotinibe×acidez: confirmar a regra separada por classe (IBP evitar / H2 10h-2h / antiácido "algumas horas")?
8. Edições AJCC por pack (8ª?) e CPCP (pack próprio?) — confirmar na revisão.

## Limite do veredicto

FINAL DOCUMENTAL, NÃO CORPUS CLÍNICO APROVADO: tudo o que existe de novo está em RASCUNHO com `consultavel:true, alerta:false` e `aprovacaoClinica:null` (D-F1-05 — biblioteca consulta, marca "não curado", nenhum alerta ligado). Nenhuma dose, corte, intervalo ou artigo de lei foi preenchido sem fonte; onde a fonte não existia nesta rodada, o campo é null com pendência nomeada. A migração da árvore com `git mv`, a divisão `ativo→consultavel/alerta`, as 4 fusões de interações e a integração no app continuam tarefas do Codex (código). Sem commit/push nesta execução. [GLM, 11/10/2026]
