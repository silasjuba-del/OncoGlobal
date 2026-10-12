# F1 · Decisões e pendências que ficam com o Dr. Silas (gerado em 2026-10-11)

Fonte: campos `conflitos` (com `decisaoNecessaria: true`) e `pendencias` (classes `DECISAO_CLINICA_DR_SILAS` e `DEPENDE_BULA_ANVISA`) dos packs v2 de oncologia clínica. Hematologia e radioterapia estão marcadas como aceno geral e ficaram fora desta lista, por decisão do Dr. Silas.

## adrenal

- **Conflito:** Teto de dose do mitotano — escolha de segurança registrada: Usar a faixa da SBOC (1-4 g/dia) como referência e titular por mitotanemia; doses acima só com nível sérico e decisão médica
- **DECISAO_CLINICA_DR_SILAS:** Mitotano adjuvante: SBOC não fixa dose; titulação do curso (INFERIDO) e bula FDA (Lysodren, doença inoperável: início 2-6 g/dia) divergem da faixa SBOC 1-4 g/dia. Titulação por mitotanemia = decisão médica.
- **DECISAO_CLINICA_DR_SILAS:** Teste com dexametasona mapeado para CORTISOL. Seguem sem id: ACTH, S-DHEA, androstenediona, 17-OH-progesterona, aldosterona, renina, metanefrinas e mitotanemia (códigos SIGTAP anotados nos itens).

## bexiga

- **Conflito:** Cisplatina fracionada no NIAGARA com ClCr 40-59 × critério de inelegibilidade ClCr < 60 — escolha de segurança registrada: Pelo critério de Galsky (SBOC p. 10), ClCr < 60 mL/min = inelegível. A dose fracionada da tabela (35 mg/m² D1, D8 se ClCr 40-59) fica como decisão médica individual, não como padrão do pack. Aula PRO p. 14 também cita split-dose em TFG 40-6
- **Conflito:** Alvo do erdafitinibe — escolha de segurança registrada: Alteração de FGFR3 (mutação ou fusão) atende às duas fontes; fusão isolada de FGFR2 só por decisão médica após conferir bula ANVISA.
- **Conflito:** Dose da BCG — escolha de segurança registrada: MOC: 81 mg por 6 semanas + manutenção. Não substitui a bula da cepa (NÃO VERIFICADA).
- **Conflito:** Via da gencitabina 2 g no NMIBC pós-BCG — escolha de segurança registrada: Via intravesical (o item está sob 'Tratamentos intravesicais' e a referência 13 é de gencitabina intravesical); 'IV' tratado como erro de grafia. Confirmar com o médico.
- **DECISAO_CLINICA_DR_SILAS:** Trato urinário superior (pelve renal/ureter) não coberto pela SBOC 2026: sem doses, sem protocolo; buscar diretriz específica (NCCN/EAU UTUC; POUT para adjuvância).
- **DEPENDE_BULA_ANVISA:** BCG: dose depende da cepa (SBOC 120 mg/40 mg EORTC × aula PRO Connaught 81 mg/Tice 50 mg); esquema de indução/manutenção sem fonte SBOC — conferir bula da cepa disponível no SUS.
- **DEPENDE_BULA_ANVISA:** PD-L1: corte e clone para pembrolizumabe 1ª linha não definidos na SBOC; conferir bula ANVISA (aula PRO: CPS ≥ 10 para pembrolizumabe).
- **DECISAO_CLINICA_DR_SILAS:** Seguimento pós-cistectomia, pós-trimodal e da doença avançada: periodicidade sem fonte na SBOC 2026.

## cabeca-pescoco

- **Conflito:** Capecitabina metronômica (nasofaringe) — escolha de segurança registrada: 625 mg/m² 2x/dia (menor dose, a do estudo citado)
- **DECISAO_CLINICA_DR_SILAS:** Catálogo v1.1 sem RM de face (usado RM_COLUNA_CERVICAL a conferir), sem hibridização in situ para HPV/EBV (EBER) e sem PD-L1 específico (usado IMUNOHISTOQUIMICA). Inclusão no catálogo depende de aprovação D-F1-02.

## canal-anal

- **DECISAO_CLINICA_DR_SILAS:** Adenocarcinoma de canal anal: confirmar com o médico se segue o pack colorretal.

## chc

- **DEPENDE_BULA_ANVISA:** Doses de atezolizumabe, bevacizumabe, durvalumabe, tremelimumabe, regorafenibe, cabozantinibe e ramucirumabe vindas de rótulo FDA (openFDA); bula ANVISA não consultada

## colo-utero

- **DECISAO_CLINICA_DR_SILAS:** SEM_FONTE: p16/HPV na SBOC colo 2026 — não incluído (não usar p16 como critério de estadiamento).
- **DECISAO_CLINICA_DR_SILAS:** KEYNOTE-A18: SG imatura na versão SBOC; atualização não incorporada.

## colorretal

- **Conflito:** FOLFOXIRI — bolus de 5-FU e dose de leucovorin — escolha de segurança registrada: Omitir o bolus no pack (menor exposição a 5-FU); LV e bolus para decisão do médico.
- **Conflito:** mFOLFOX6 e FOLFIRI — bolus de 5-FU 400 mg/m² — escolha de segurança registrada: Pack registra o esquema SBOC; fichas marcadas para revisão; prescrição pela ficha exige conferência manual do bolus.
- **Conflito:** Nivolumabe + ipilimumabe — intervalo — escolha de segurança registrada: Pack usa o esquema do CheckMate-8HW descrito na própria SBOC p.17 (indução de 4 doses e depois nivolumabe 480 mg q4s). O médico confirma.
- **DECISAO_CLINICA_DR_SILAS:** Edição AJCC: SBOC 2026 não declara; 8ª vem do curso (INFERIDO).
- **DECISAO_CLINICA_DR_SILAS:** Fichas institucionais FOLFOX e FOLFIRI paliativas sem bolus de 5-FU 400 mg/m²; ficha FOLFOXIRI com LV 400 — revisar fichas (fora do WRITE_SET).
- **DECISAO_CLINICA_DR_SILAS:** deGramont '1.200 mg/m² 46 h' da SBOC (p.12) omitido até esclarecimento.

## endometrio

- **DEPENDE_BULA_ANVISA:** Olaparibe + durvalumabe manutenção (DUO-E, pMMR): dose de olaparibe sem fonte para endométrio.
- **DECISAO_CLINICA_DR_SILAS:** IO + QT adjuvante em dMMR III/IV (ESGO 2025, KEYNOTE-B21 subgrupo) sem dose na SBOC — não criado protocolo.

## esofago

- **Conflito:** Dose de RT na QT/RT neoadjuvante — escolha de segurança registrada: 50,4 Gy fica restrito à QT/RT definitiva; CROSS neoadjuvante = 41,4 Gy. A tabela de doença localmente avançada (p.17) reaproveita os esquemas definitivos sem dose de RT: para cisplatina+5-FU e mFOLFOX4 neoadjuvantes, RT = null (SEM_FONTE). 
- **Conflito:** Nivolumabe + ipilimumabe: D28 — escolha de segurança registrada: Mantido como na SBOC; conferir se D28 deveria ser D29 (intervalo de 14 dias).
- **Conflito:** Ficha FLOT do serviço × SBOC (5-FU) — escolha de segurança registrada: Pack registra 2.600 mg/m² (SBOC); ficha não editada (fora do WRITE_SET). Médico decide qual vale no serviço.
- **Conflito:** Ficha irinotecano do serviço × SBOC — escolha de segurança registrada: Pack registra 150 mg/m² q14 (SBOC). Ficha 350 mg/m² q21 não tem respaldo nesta diretriz.
- **DECISAO_CLINICA_DR_SILAS:** FAIXA_NA_FONTE: tislelizumabe + QT (cisplatina 60–80; 5-FU 750–800) e paclitaxel 2ª linha (80–100 mg/m²)
- **DECISAO_CLINICA_DR_SILAS:** INFERIDO: doses de cisplatina+5-FU isolado (PD-L1 negativo) tomadas do backbone da tabela de 1ª linha
- **DECISAO_CLINICA_DR_SILAS:** Fichas do serviço divergentes (FLOT 5-FU 2.400; irinotecano 350 q21) — decisão do Dr. Silas

## gastrico

- **Conflito:** FLOT paliativo com 5-FU bolus — escolha de segurança registrada: Protocolo paliativo marcado CONFLITANTE (doseVerificada=false). O FLOT perioperatório não tem bolus; não transferir entre cenários — médico decide.
- **Conflito:** Fichas FLOT e irinotecano × SBOC — escolha de segurança registrada: Pack registra doses SBOC; fichas não editadas.
- **Conflito:** mDCF: dia da cisplatina e 5-FU (SBOC × MOC/Shah) — escolha de segurança registrada: Doses totais coincidem; diverge o dia da cisplatina (D2 × D3). Manter a SBOC até decisão.
- **DECISAO_CLINICA_DR_SILAS:** CONFLITANTE: FLOT paliativo com 5-FU bolus 400 mg/m² (só na tabela de doença avançada)
- **DECISAO_CLINICA_DR_SILAS:** FAIXA_NA_FONTE: cisplatina 75–100 mg/m² no CF perioperatório
- **DECISAO_CLINICA_DR_SILAS:** Fichas do serviço divergentes da SBOC (FLOT 5-FU 2.400; mDCF institucional; irinotecano 180 q14)
- **DECISAO_CLINICA_DR_SILAS:** Pembrolizumabe + QT e tislelizumabe + QT descritos com CAPOX como exemplo; a SBOC permite qualquer fluoropirimidina + platina

## gist

- **DECISAO_CLINICA_DR_SILAS:** Tabela de risco da SBOC com erros (gástrico × não gástrico; ≤ 5 cm × ≤ 2 cm) — exigir conferência médica antes de decidir adjuvância.
- **DECISAO_CLINICA_DR_SILAS:** SEM_FONTE: TC de tórax no estadiamento e EDA não citados pela SBOC.

## gliomas

- **Conflito:** Fracionamento da RT no astrocitoma IDH-mutado graus 3-4 — escolha de segurança registrada: Manter 59,4 Gy e deixar frações em aberto para o radio-oncologista; 33 frações (1,8 Gy/fr) é a forma clássica e menos intensa por fração
- **Conflito:** Temozolomida adjuvante no SUS — escolha de segurança registrada: Registrar como 'parcial': diretriz SUS de 2020 recomenda; incorporação centralizada negada em 2014. Médico confirma o enquadramento de APAC no serviço.
- **DECISAO_CLINICA_DR_SILAS:** MGMT (PCR metilação-específica) e TERT mapeados para MOLECULAR_PCR_MUTACAO (alt. SEQUENCIAMENTO_AMPLICON), faturamento a confirmar. Método exato e CDKN2A/B (deleção) seguem para definição com a patologia.
- **DECISAO_CLINICA_DR_SILAS:** PCV depende de importação de lomustina/procarbazina (SBOC p.15); substituição por carmustina é decisão do médico/serviço.
- **DECISAO_CLINICA_DR_SILAS:** Reirradiação (aceno de RT), TMZ em dose protraída 50 mg/m² (DDT 2020 p.17 e SBOC citam a dose sem dias/ciclo) e platina na recorrência ficam fora como protocolo.

## mama

- **DECISAO_CLINICA_DR_SILAS:** Aula PRO 41 (mama na gestação) não incorporada.
- **DEPENDE_BULA_ANVISA:** Doses dos protocolos metastáticos novos vêm de rótulo FDA/ensaio; conferir bula ANVISA das apresentações disponíveis.

## melanoma

- **Conflito:** Adjuvância nos estádios IIB/IIC — diretriz × SUS — escolha de segurança registrada: Registrar como opção da diretriz não coberta pela DDT do SUS; decisão médica caso a caso
- **DECISAO_CLINICA_DR_SILAS:** BRAF V600 mapeado para MOLECULAR_PCR_MUTACAO (alt. SEQUENCIAMENTO_AMPLICON), faturamento por indicação a confirmar. Método (PCR × NGS × IHQ VE1, que não detecta V600K) não definido pela SBOC — escolha com a patologia.
- **DECISAO_CLINICA_DR_SILAS:** USG de cadeia linfonodal de drenagem sem id no catálogo v1.1 (só USG_AXILAS). Inclusão depende de D-F1-02.

## neuroendocrinos

- **DECISAO_CLINICA_DR_SILAS:** pNET: indicação de sunitinibe/everolimo/CAPTEM apoiada no curso PRO + bulas (INFERIDO); validar com ENETS/NCCN.

## ovario

- **Conflito:** Dactinomicina no VAC (germinativo) — escolha de segurança registrada: Não registrar dose; protocolo VAC fora do pack até verificação em bula.
- **DECISAO_CLINICA_DR_SILAS:** GERMINATIVO VAC: SBOC p.10 grafa dactinomicina 300 mg/m² D1-D5 (provável erro de unidade) — protocolo NÃO criado; confirmar dose em bula/literatura antes de uso.
- **DECISAO_CLINICA_DR_SILAS:** GERMINATIVO EP (disgerminoma selecionado, 3 ciclos): doses não especificadas na SBOC — SEM_FONTE.
- **DECISAO_CLINICA_DR_SILAS:** Mucinoso: oxaliplatina + fluoropirimidina citada sem dose — SEM_FONTE.

## pancreas

- **Conflito:** Duração da infusão de 5-FU (48 h na SBOC pâncreas × 46 h na SBOC vias biliares) — escolha de segurança registrada: Mantido 48 h no pack de pâncreas conforme a fonte do tumor; registrar para padronização da ficha do serviço.
- **DEPENDE_BULA_ANVISA:** Olaparibe: dose de bula FDA (openFDA); bula ANVISA não consultada

## penis

- **DECISAO_CLINICA_DR_SILAS:** Doses de 5-FU tópico e imiquimode tópico (Ta/Tis) ausentes na SBOC — não incluídos como protocolo.
- **DECISAO_CLINICA_DR_SILAS:** Conduta específica para cN1 vem só da aula PRO (CURSO/INFERIDO); SBOC não detalha cN1 isoladamente.
- **DECISAO_CLINICA_DR_SILAS:** Tabela de seguimento (SBOC p.15) para pN+ tem leitura ambígua quanto à imagem no 3º–5º ano.

## prostata

- **Conflito:** Docetaxel quinzenal 50 mg/m² — escolha de segurança registrada: Pack só preenche o esquema 21/21 da SBOC; quinzenal fica com dose null (SEM_FONTE) até fonte SBOC/bula. Rodada 2: dose 50 mg/m² preenchida como CURSO/INFERIDO (aula PRO; esquema PROSTY NCT00255606) — validar antes do uso.
- **Conflito:** Prednisona com olaparibe + abiraterona (PROpel) — escolha de segurança registrada: Dose do pack mantida como na SBOC (verificada); a bula FDA e a abiraterona isolada usam 5 mg 2x/dia. Conferir bula ANVISA do Lynparza antes do uso.
- **DEPENDE_BULA_ANVISA:** Doses de agonistas/antagonistas LHRH tiradas de bula FDA (openFDA); confirmar com bula ANVISA das apresentações disponíveis no serviço. Indicação de bula = câncer de próstata avançado; uso com RT no localizado sustentado pela SBOC (classe e duração).
- **DEPENDE_BULA_ANVISA:** Olaparibe + abiraterona: SBOC p.16 traz prednisona 5 mg 1x/dia, enquanto abiraterona isolada no mCRPC usa 5 mg 2x/dia (p.15) — confirmar com bula ANVISA do Lynparza. Bula FDA: 5 mg 2x/dia — registrado em conflitos.
- **DECISAO_CLINICA_DR_SILAS:** Definição de alto risco mHSPC (SBOC p.10) impressa como 'Gleason > 8' e '3 lesões ósseas' — conferir com o PDF/LATITUDE (Gleason ≥ 8, ≥ 3 lesões). Texto extraído do PDF confirma a grafia da SBOC (p.10).

## pulmao

- **Conflito:** Nivolumabe neoadjuvante: número de ciclos e fase adjuvante — escolha de segurança registrada: São dois estudos (CheckMate 816: 3 ciclos sem adjuvante; CheckMate 77T: 4 ciclos + nivolumabe 480 mg/4 sem por 12 meses). Pack registra a tabela (4 ciclos) e o adjuvante em protocolo separado; médico escolhe o desenho e não mistura.
- **Conflito:** Pembrolizumabe adjuvante: duração e via — escolha de segurança registrada: "EC" lido como erro tipográfico de EV — opção 400 mg não convertida em linha até confirmação. 54 semanas atribuído ao adjuvante pós-QT; 13 ciclos ao adjuvante pós-neoadjuvância (inferência).
- **DECISAO_CLINICA_DR_SILAS:** Clone de PD-L1 (22C3/SP263/SP142/28-8) não especificado em nenhuma fonte SBOC lida: definir com patologia do serviço (SEM_FONTE).
- **DECISAO_CLINICA_DR_SILAS:** Opção 3 de cisplatina + vinorelbina (faixas 75-80/25-30) e doses em faixa (paclitaxel 175-200, carboplatina AUC 5-6) registradas pelo limite inferior com faixa em observação; médico decide.

## rim

- **DEPENDE_BULA_ANVISA:** Bula ANVISA não consultada; monitorização laboratorial por rótulo FDA (openFDA).
- **DECISAO_CLINICA_DR_SILAS:** Vigilância ativa localizada: DDT (semestral) × aula PRO (3-6 meses no 1º ano) — intervalo a confirmar pelo médico.

## sarcomas

- **Conflito:** Gencitabina + dacarbazina: dias × intervalo — escolha de segurança registrada: Não registrar protocolo (D1 e D15 com intervalo de 2 semanas é incoerente); conferir referência original
- **Conflito:** Doxorrubicina + dacarbazina: número de ciclos na linha paliativa — escolha de segurança registrada: Registrar 1ª linha com a menor dose (750 mg/m²) e 3 ciclos como na tabela; reavaliar com o curador
- **DEPENDE_BULA_ANVISA:** Mesna (proporção 20% × 3) e resgate com leucovorina preenchidos pela bula FDA. Falta só o protocolo de hidratação/alcalinização do MTX em alta dose (bula ANVISA ou protocolo institucional).
- **DECISAO_CLINICA_DR_SILAS:** Trabectedina entrou pela bula FDA. Gencitabina + dacarbazina segue fora: SBOC traz D1 e D15 com intervalo de 2 semanas (incoerente) e não há bula/ensaio aberto lido — curador decide se busca a referência original.
- **DECISAO_CLINICA_DR_SILAS:** Sem id no catálogo v1.1: USG de partes moles, RM de membro, RX de segmento ósseo, NGS/TMB e testes germinativos (códigos SIGTAP anotados nos itens). Inclusão depende de D-F1-02.

## testiculo

- **DECISAO_CLINICA_DR_SILAS:** Carboplatina AUC 7 × 2 ciclos: não citada na SBOC 2026 (só dose única) — não incluída
- **DECISAO_CLINICA_DR_SILAS:** BEP × 2 no não seminoma EC I: citado só no curso (aula 70 pág. 9); SBOC 2026 recomenda BEP × 1 — não incluído como protocolo
- **DECISAO_CLINICA_DR_SILAS:** Esquema de intensificação GETUG-13 (alto risco com declínio desfavorável): sem doses na SBOC — não incluído como protocolo
- **DECISAO_CLINICA_DR_SILAS:** USG de bolsa escrotal, orquiectomia inguinal, painel IHQ, i(12p) e DLCO só têm apoio do curso (INFERIDO); SBOC 2026 não os cita
- **DEPENDE_BULA_ANVISA:** Audiometria (cisplatina) e ajuste renal da bleomicina apoiados em rótulo FDA (openFDA); bula ANVISA não consultada
- **DECISAO_CLINICA_DR_SILAS:** Seguimento SBOC pág. 25 não estratifica por histologia nem por modalidade de tratamento (vigilância × QT)

## tireoide

- **DECISAO_CLINICA_DR_SILAS:** RET germinativo/somático mapeados para MOLECULAR_PCR_MUTACAO (alt. SEQUENCIAMENTO_AMPLICON). Seguem sem id: painel NGS amplo, painel germinativo multigene, metanefrinas e anti-Tg; USG de pescoço usa USG_TIREOIDE.

## vias-biliares

- **DECISAO_CLINICA_DR_SILAS:** FAIXA_NA_FONTE: oxaliplatina 85–100 mg/m² no GEMOX

