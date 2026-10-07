# Fonte M-D · PLN-003 · 2026-10-07 · texto íntegro do Dr. Silas

> Cópia literal do material enviado pelo Dr. Silas (sem PHI). Não editar; correções viram nova mensagem na árvore do CHATPLAN.
> Observação: o texto se refere a "a sua tabela" (tabela tumoral original, ainda não recebida pelo planejamento → PENDENTE anexar).

A sua tabela deve entrar, mas como seed de conhecimento, não como regra executável. O principal ajuste é inserir SETTING/FASE e LINHA entre biomarcador e tratamento; a própria guideline viva de CPNPC já diferencia fortemente primeira linha de linhas subsequentes. [ACS Publications](https://ascopubs.org/doi/10.1200/JCO-25-02822?utm_source=chatgpt.com)

FREEZE v1.1 — CONHECIMENTO TUMORAL + EMERGÊNCIAS + LOOP MÉDICO-IA

1. TRÊS CAMADAS DISTINTAS

```
A. KNOWLEDGE_TUMOR
   conhecimento específico da neoplasia

B. EMERGENCY_ENGINE
   reconhecimento de padrões de risco

C. CLINICAL_WORKFLOW
   transformação da decisão médica em ações/documentos
```

Nunca misturar essas três camadas em uma tabela única executável.

2. KNOWLEDGE_TUMOR — MATRIZ ONCOLÓGICA
A cadeia canônica deixa de ser:

```
ÓRGÃO → HISTOLOGIA → BIOMARCADOR → TRATAMENTO
```

e passa a ser:

```
ÓRGÃO
 ↓
HISTOLOGIA
 ↓
SUBTIPO / BIOMARCADOR / GENÉTICA
 ↓
ESTÁGIO
 ↓
SETTING / FASE
 ↓
LINHA
 ↓
CARACTERÍSTICAS DO PACIENTE
 ↓
OPÇÕES TERAPÊUTICAS
```

Formalmente:

```
TUMOR_FINGERPRINT =
  organ
+ histology
+ molecular_profile
+ stage
+ treatment_setting
+ line
+ patient_context
```

SETTING / FASE

```
DIAGNÓSTICO
NEOADJUVÂNCIA
ADJUVÂNCIA
LOCALIZADO
LOCALMENTE_AVANÇADO
METASTÁTICO_1L
METASTÁTICO_2L+
MANUTENÇÃO
RECIDIVA
REFRATÁRIO
SEGUIMENTO
```

Isso corrige uma limitação importante da tabela enviada: por exemplo, `KRAS G12C → sotorasibe/adagrasibe` não significa automaticamente primeira linha; guidelines diferenciam explicitamente o contexto e a linha terapêutica.

3. EXAMES DE ESTADIAMENTO NÃO SÃO LISTA FIXA POR ÓRGÃO
Errado:

```
MAMA
→ USG + MMG + TC + CO + RM para todos
```

Correto:

```
ÓRGÃO
+
ESTÁGIO CLÍNICO SUSPEITO
+
RISCO
+
SINTOMAS
        ↓
EXAMES PERTINENTES
```

Por exemplo, em câncer de mama inicial, exames sistêmicos avançados não são indiscriminadamente necessários; PET-CT é contextual e pode ser considerado especialmente em situações de maior risco ou quando métodos convencionais são inconclusivos.
Portanto:

```
STAGING_EXAMS
  required[]
  suggested[]
  conditional[]
  not_routine[]
```

4. SINTOMAS NÃO PERTENCEM AO TUMOR COMO LISTA FECHADA
A relação correta é:

```
TUMOR
 ↕
SÍTIO
 ↕
MORFOLOGIA / FUNÇÃO
 ↕
SINAIS / SINTOMAS
```

Exemplo:

```
CA PULMÃO
→ massa central
→ árvore brônquica
→ hemoptise

CA PRÓSTATA M1
→ coluna
→ compressão neural
→ dor + paresia + alteração esfincteriana
```

O mesmo sintoma pode surgir em diversos tumores.

5. EMERGÊNCIAS ONCOLÓGICAS — CAMADA TRANSVERSAL
Emergência NÃO deve ficar repetida em cada linha de tumor.
Criar biblioteca transversal:

```
ONCO_EMERGENCY
├── NEUTROPENIA_FEBRIL
├── SEPSE
├── COMPRESSAO_MEDULAR
├── SVC
├── HIPERCALCEMIA
├── TEP_ALTO_RISCO
├── HEMOPTISE_MACICA
├── HEMORRAGIA
├── OBSTRUCAO_INTESTINAL
├── PERFURACAO
├── HIPERTENSAO_INTRACRANIANA
├── CRISE_EPILÉPTICA
├── SIADH_GRAVE
├── SINDROME_LISE_TUMORAL
└── OUTROS [+]
```

Tumores apenas mantêm associações com essas emergências.

6. CONTRATO DA EMERGÊNCIA

```
SINAIS/SINTOMAS/DADOS
        ↓
PADRÃO DE RISCO
        ↓
EMERGÊNCIA POSSÍVEL
        ↓
EVIDÊNCIAS PRESENTES
        ↓
EVIDÊNCIAS AUSENTES
        ↓
PRIORIDADE
        ↓
KIT OPERACIONAL
```

Não:

```
"94% NEUTROPENIA FEBRIL"
```

Preferir:

```
PADRÃO COMPATÍVEL: NEUTROPENIA FEBRIL
PRIORIDADE: 🔴 EMERGÊNCIA

EVIDÊNCIAS:
✓ temperatura 38,5 °C
✓ ANC 300/mm³
✓ quimioterapia recente

PENDÊNCIAS:
□ PA
□ perfusão
□ foco infeccioso
□ função renal
□ alergias
```

Score vetorial ou confiança do LLM não é probabilidade clínica.
Se existir score técnico:

```
extraction_confidence: 0.96
```

significa apenas confiança na extração da fala, nunca:

```
diagnosis_probability: 96%
```

7. EMERGÊNCIA → KIT, NÃO CONDUTA AUTÔNOMA
Exemplo:

```
CLUSTER: NEUTROPENIA FEBRIL

DESTINO
□ PS / Hospital

LAB
□ Hemograma
□ Hemoculturas
□ Função renal/hepática
□ Lactato, quando pertinente
⊕ Outros

MICROBIOLOGIA
□ culturas conforme foco
⊕ Outros

RAD
□ imagem conforme sintomas/foco
⊕ Outros

TRATAMENTO
□ Antibioticoterapia empírica
⊕ Outros

SUPORTE
□ hidratação
□ antitérmico
⊕ Outros
```

Em neutropenia febril, guideline ASCO/IDSA mantém como princípio a antibioticoterapia empírica inicial rapidamente — até 1 hora após triagem — mas escolha do esquema depende de risco, alergias, exposição prévia, função renal, foco e contexto local.
Portanto, cefepime não deve ser hard-coded como única consequência do cluster.

8. HIPERCALCEMIA — EXEMPLO DA NECESSIDADE DE KB VERSIONADA
A tabela original fixa:

```
SF
+
zoledronato
+
calcitonina
```

Mas guideline atual recomenda anti-reabsortivo e sugere denosumabe sobre bisfosfonato IV; para hipercalcemia grave >14 mg/dL, calcitonina combinada a denosumabe ou bisfosfonato IV é sugerida inicialmente.
Logo:

```
EMERGENCY_KNOWLEDGE
deve ser VERSIONADO
e não hard-coded na UI.
```

9. COMPRESSÃO MEDULAR — PADRÃO

```
CA conhecido
+
dor vertebral
+
déficit motor/sensitivo
+
disfunção esfincteriana
        ↓
PADRÃO ALTO RISCO
        ↓
SUSPEITA MSCC
        ↓
EMERGÊNCIA
```

UI:

```
🔴 SUSPEITA DE COMPRESSÃO MEDULAR

DESTINO
□ Hospital / PS

RAD
□ RM coluna urgente

MED
□ Corticoide
□ Analgesia

ENCAMINHAMENTO
□ Cirurgia coluna / neurocirurgia
□ Radioterapia

SUPORTE
□ estabilização / imobilização conforme situação
⊕ Outros
```

Guideline NICE recomenda RM tão rapidamente quanto possível e sempre dentro de 24 h quando há suspeita de compressão medular com sinais neurológicos.

10. MOTOR DE VOZ — SIMPLIFICADO
Não congelar arquitetura como:

```
Whisper + BERT + Embedding + RAG
```

Isso é implementação substituível.
Congelar o contrato:

```
ÁUDIO
 ↓
ASR / TRANSCRIÇÃO
 ↓
EXTRAÇÃO DE ENTIDADES
 ↓
INTENT / COMANDO
 ↓
REGRAS DETERMINÍSTICAS
 +
CONTEXTO CLÍNICO
 +
KNOWLEDGE RETRIEVAL
 ↓
CLUSTER
```

Implementação pode mudar sem alterar produto.

11. DOIS CAMINHOS DA VOZ
A. DESCRIÇÃO
“Está com febre de 38,5 e neutrófilos 300.”

```
→ reconhecer padrão
→ abrir emergência possível
→ mostrar variáveis
```

B. ORDEM
“Vou encaminhar para o PS e pedir hemoculturas.”

```
→ selecionar PS
→ selecionar hemoculturas
→ produzir DRAFT
```

Novamente:

```
RECONHECER ≠ DECIDIR
```

12. WORKFLOW OPERACIONAL CORRIGIDO

```
[CONVERSA / VOZ / DADOS]
          ↓
[EXTRAÇÃO]
          ↓
[CONTEXTO]
tipo consulta
tumor fingerprint
tratamento atual
sintomas
labs
rads
          ↓
[DETECTOR]
cluster comum
OU
cluster emergência
          ↓
[KNOWLEDGE]
regras
+
KB versionada
+
RAG documental
          ↓
[UI]
sugestões
+
evidências
+
pendências
+
OUTROS [+]
          ↓
[MÉDICO]
seleciona
remove
adiciona
edita
          ↓
[DRAFTS]
receita
pedido
encaminhamento
orientação
retorno
          ↓
[MÉDICO]
revisa
assina
imprime/envia
```

13. CORREÇÃO DO “LOOP FECHADO”
NÃO:

```
desfecho
→ atualiza vetor
→ sistema aprende automaticamente
→ muda próxima conduta
```

Isso cria aprendizado clínico não governado.
O correto:

```
DESFECHO
    ↓
EVENTO AUDITÁVEL
    ↓
DATASET DE AVALIAÇÃO
    ↓
ANÁLISE OFFLINE
    ↓
VALIDAÇÃO
    ↓
NOVA VERSÃO
    ↓
DEPLOY CONTROLADO
```

O sistema produtivo não se auto-modifica a partir do paciente seguinte.

14. ENVIO AUTOMÁTICO
Também corrigir:

```
MÉDICO VALIDOU
→ sistema envia automaticamente para tudo
```

para:

```
MÉDICO VALIDOU
        ↓
ARTEFATOS PRONTOS

[ IMPRIMIR ]
[ ASSINAR ]
[ ENVIAR ]
```

A última ação continua explícita.

15. MODELO FINAL

```
                     ┌── KNOWLEDGE_TUMOR
                     │
PACIENTE → CONSULTA ─┼── EMERGENCY_ENGINE
                     │
                     └── CLUSTER_ENGINE
                              ↓
                         UI OPERACIONAL
                              ↓
                           MÉDICO
                              ↓
                      DRAFTS / AÇÕES
                              ↓
                           PACIENTE
```

KNOWLEDGE_TUMOR

```
ÓRGÃO
→ HISTOLOGIA
→ MOLECULAR
→ ESTÁGIO
→ SETTING
→ LINHA
→ OPÇÕES
```

EMERGENCY_ENGINE

```
PADRÃO
→ RISCO
→ PRIORIDADE
→ KIT OPERACIONAL
```

CLUSTER_ENGINE

```
PROBLEMA
→ opções pertinentes
→ OUTROS [+]
→ médico seleciona
```

16. DECISÕES CONGELADAS v1.1

1. A tabela oncológica fornecida é seed da Knowledge Base, não código de decisão.
2. Tratamento exige `estágio + setting + linha + paciente`, não apenas histologia/biomarcador.
3. Exames de estadiamento são condicionais, não listas universais por órgão.
4. Emergências são biblioteca transversal.
5. Órgãos relacionam-se a emergências; não duplicam seus protocolos.
6. Emergência produz kit operacional, não prescrição autônoma.
7. Similaridade vetorial não é probabilidade diagnóstica.
8. IA deve mostrar as evidências que dispararam um alerta.
9. Voz descritiva abre cluster; ordem explícita pode preencher DRAFT.
10. Backend congela contratos clínicos, não nomes de modelos (`BERT`, embeddings etc.).
11. Knowledge Base é versionada.
12. Aprendizado por desfecho é offline, auditado e versionado.
13. Nenhum auto-learning clínico em produção.
14. Assinatura/envio final permanecem atos médicos explícitos.
15. `OUTROS [+]` permanece universal.
16. A arquitetura anterior `TIPO CONSULTA → FINGERPRINT → X/Y/Z → CLUSTER` permanece íntegra.

FREEZE v1.1 — COMPATÍVEL COM FREEZE v1.0.
O ponto que você encontrou agora é estrutural: não precisamos codificar “oncologia” inteira dentro de cada cluster. Precisamos de uma KB tumoral profunda consultada pelo `Tumor Fingerprint`, enquanto os clusters e emergências são mecanismos operacionais reutilizáveis. Isso reduz drasticamente duplicação e deriva clínica.
→ Pergunta cirúrgica: eu seguiria agora para definir o schema da `TUMOR_KNOWLEDGE` — exatamente quais campos cada órgão/histologia/biomarcador/estágio/setting/linha deve possuir, antes de alimentar mama, próstata, cólon e pulmão.
