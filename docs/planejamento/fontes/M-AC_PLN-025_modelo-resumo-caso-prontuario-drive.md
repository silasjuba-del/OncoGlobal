# Fonte M-AC · PLN-025 · 2026-10-07 · texto íntegro do Dr. Silas

> Cópia literal, com UMA redação: CRM-PB e RQEs do médico trocados por [CRM]/[RQE]. Sem dado de paciente (exemplos fictícios). Marcado pelo Dr. Silas como "importantíssimo — GRAVAR, MEMORIZAR, REGISTRAR, CAUTION, ATTENTION". Não editar.

## Instrução avulsa que veio junto

cursor coding = nao produzir documentos em pastas.

## MODELO DE RESUMO DE CASO

PROMPT — DRIVE · PRONTUÁRIO ONCOLÓGICO EM 3 SEÇÕES

Sempre que eu escrever:

PRONTUÁRIO DRIVE: [NOME COMPLETO DO PACIENTE]

você deve pesquisar no Google Drive conectado todos os arquivos relacionados ao paciente e gerar um prontuário oncológico estruturado, objetivo e pronto para revisão médica.

INSTITUIÇÃO:
Hospital do Bem — Unidade Oncológica
Complexo Hospitalar Regional Deputado Janduhy Carneiro
Patos-PB

MÉDICO:
Dr. Silas Negrão Serra Júnior
CRM-PB [CRM]
RQE Oncologia Clínica [RQE]
RQE Clínica Médica [RQE]

FRAMEWORK:
SUS — CONITEC / RENAME / PCDT / SBOC

REGRA CENTRAL:
Não inventar dados ausentes. Quando a informação não estiver descrita nos documentos, deixar o campo vazio após os dois pontos.

Exemplo:
Alergias:
Histórico familiar:
Vacinação:

Não escrever “não informado”, “não consta” ou “ausente”, salvo quando o documento declarar explicitamente que a informação é negativa.

==================================================
1. DADOS ANAGRÁFICOS
==================================================

Nome completo:
Data de nascimento:
Idade:
Sexo:
Nome da mãe:
Naturalidade:
Procedência:
Endereço:
Município:
Telefone:
CNS:
CPF:
RG:
Estado civil:
Profissão:

==================================================
2. DADOS CLÍNICOS
==================================================

Antecedentes:
Medicações em uso:
Alergias:
Cirurgias prévias:
Histórico familiar:
Vacinação:
Performance Status ECOG:

==================================================
3. DADOS ONCOLÓGICOS
==================================================

Antes dos exames, gerar obrigatoriamente um título diagnóstico em maiúsculas, negrito e fonte maior, no seguinte formato:

**TIPO DE NEOPLASIA — TNM — ESTÁDIO — SUBTIPO**

Exemplos:

**CARCINOMA DUCTAL INVASIVO DE MAMA DIREITA — CT3 N1 M0 — EC III — LUMINAL A**

**ADENOCARCINOMA DE PULMÃO DIREITO — CT2B N2 M0 — EC IIIA — EGFR MUTADO**

**ADENOCARCINOMA DE CÓLON SIGMOIDE — PT3 N1B M0 — EC IIIB — RAS SELVAGEM**

Se algum dado estiver ausente, manter o campo vazio no título, sem inventar.

Exemplo:
**CARCINOMA DE MAMA DIREITA —  —  — **

Depois do título diagnóstico, preencher:

Topografia:
Histologia:
CID-10:
Morfologia / CID-O:
Estadiamento TNM:
Estádio clínico:
Subtipo molecular:
Data do diagnóstico:
Linha de tratamento:
Finalidade terapêutica:
Tratamento atual ou proposto:
Protocolo:

--------------------------------------------------
EXAMES E LAUDOS
--------------------------------------------------

Para cada exame ou laudo, usar obrigatoriamente este formato:

**DATA — TIPO DO EXAME/LAUDO:** resumo oncológico objetivo.

Regras para resumo:
- Focar em achados oncológicos.
- Incluir apenas topografia, dimensões, invasão, linfonodos e metástases.
- Não fazer descrição técnica radiológica.
- Outros achados não oncológicos devem ser apenas citados ao final, sem detalhamento.

Exemplos:
**12/04/2026 — TOMOGRAFIA DE TÓRAX:** lesão em lobo inferior direito medindo 3,2 cm, associada a linfonodos mediastinais e hilares de até 1,4 cm. Outros achados: nefrolitíase.

**18/04/2026 — TOMOGRAFIA DE ABDOME:** ausência de metástases hepáticas ou peritoneais. Outros achados: colelitíase e hemangioma hepático.

**22/04/2026 — ANATOMOPATOLÓGICO:** carcinoma ductal invasivo de mama, grau histológico 2.

**25/04/2026 — IMUNO-HISTOQUÍMICA:** receptores hormonais positivos, HER2 negativo, Ki-67 baixo, compatível com subtipo luminal.

--------------------------------------------------
EXAMES LABORATORIAIS + CTCAE ( SE EM QT )
--------------------------------------------------

Hemograma:
Função renal:
Função hepática:
Marcadores tumorais:
Outros:

--------------------------------------------------
CONDUTA [VAZIA]
--------------------------------------------------

Campo livre para decisão médica.

Não preencher conduta definitiva.
Não sugerir prescrição.
Não inserir tratamento sem validação médica.

--------------------------------------------------
OBSERVAÇÕES DO CASO / PENDÊNCIAS
--------------------------------------------------

Listar:
- Dados ausentes relevantes.
- Divergências entre documentos.
- Pendências para APAC.
- Pendências de biomarcadores.
- Pendências de estadiamento.
- Pendências de confirmação diagnóstica.
- Pendências administrativas que possam gerar glosa.

--------------------------------------------------
ATUALIZAÇÕES CIENTÍFICAS / ESTUDO DIÁRIO
--------------------------------------------------

Objetivo:
Manter o médico atualizado, mesmo quando o tratamento não puder ser prescrito pelo SUS.

Selecionar estudos clínicos relevantes para o tipo de neoplasia, subtipo e cenário clínico da paciente.

Formato obrigatório:

**NOME DO ESTUDO:** braço experimental versus braço controle; desfecho principal; 1 frase curta com ganho em meses, redução percentual de mortalidade/progressão e hazard ratio, quando disponíveis.

Exemplos:
**monarchE:** abemaciclibe + terapia endócrina versus terapia endócrina isolada; sobrevida livre de doença invasiva; reduziu o risco de recorrência invasiva em aproximadamente 27%, com hazard ratio 0,73, em pacientes com câncer de mama receptor hormonal positivo/HER2 negativo de alto risco.

**FLAURA:** osimertinibe versus gefitinibe/erlotinibe; sobrevida livre de progressão; aumentou a mediana de sobrevida livre de progressão de 10,2 para 18,9 meses, com hazard ratio 0,46, em câncer de pulmão de células não pequenas EGFR mutado.

**CheckMate 649:** nivolumabe + quimioterapia versus quimioterapia; sobrevida global; aumentou a sobrevida global de 11,1 para 14,4 meses, com hazard ratio 0,71, em adenocarcinoma gástrico ou de junção esofagogástrica HER2 negativo com CPS ≥ 5.

REGRAS DOS ESTUDOS:
- Usar frase curta.
- Citar nome do estudo, braços e desfecho.
- Priorizar ganho em meses, redução percentual de risco e hazard ratio.
- Não transformar em recomendação terapêutica obrigatória.
- Quando não houver aplicabilidade direta, escrever: “atualização educacional, sem implicar disponibilidade no SUS”.
