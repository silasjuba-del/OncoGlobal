# Fonte M-B · PLN-002 · 2026-10-07 · texto íntegro do Dr. Silas

> Cópia literal do material enviado pelo Dr. Silas (sem PHI). Não editar; correções viram nova mensagem na árvore do CHATPLAN.

Eu consolidaria este bloco como camada prática acima do X/Y/Z. Duas correções são necessárias: RECIST não pode sozinho ordenar troca terapêutica, e “pseudoprogressão” deve ser separada de flare de marcador/bone scan e de resposta mista. Em mCRPC, por exemplo, PSA isoladamente não deve definir progressão; clínica, laboratório e imagem precisam ser integrados. [ACS Publications](https://ascopubs.org/doi/10.1200/JCO-25-02693?utm_source=chatgpt.com)

FREEZE PRÁTICO — TIPO DE CONSULTA E ESTADO ONCOLÓGICO

0. GATE INICIAL — TIPO DE CONSULTA
Toda consulta oncológica começa obrigatoriamente por:

```
TIPO_CONSULTA
├── CASO_NOVO
├── RETORNO_EM_TRATAMENTO
└── SEGUIMENTO
```

A prioridade clínica corre paralelamente e pode sobrepor qualquer um dos três:

```
ELETIVO
PRIORITÁRIO
URGENTE
EMERGÊNCIA
```

Portanto:

```
TIPO DE CONSULTA
        +
PRIORIDADE
        ↓
DEFINE A ESTEIRA INICIAL
```

1. ASSINATURA ONCOLÓGICA DO PACIENTE
Todo paciente deve poder ser representado por:

```
ÓRGÃO
  ↓
HISTOLOGIA / TIPO TUMORAL
  ↓
BIOMARCADORES / GENÉTICA
  ↓
ESTADIAMENTO
  ↓
FASE DA JORNADA
  ↓
TRATAMENTO ATUAL / PLANEJADO
```

Complementado obrigatoriamente por:

```
IDADE
COMORBIDADES
MUC
ECOG / FUNCIONALIDADE
SINTOMAS
TOXICIDADES
GRAVIDADE
TEMPO DE EVOLUÇÃO
```

Forma compacta:

```
ONCOLOGIC_FINGERPRINT =

ÓRGÃO
+ HISTOLOGIA
+ BIOMARKER
+ ESTÁGIO
+ FASE
+ TRATAMENTO
+ PACIENTE
```

2. CASO NOVO
Pergunta central:
“O que é, onde está e qual o impacto disso neste paciente?”
Esteira:

```
SUSPEITA
   ↓
CONFIRMAÇÃO DIAGNÓSTICA
   ↓
HISTOLOGIA
   ↓
BIOMARCADORES / GENÉTICA
   ↓
ESTADIAMENTO
   ↓
FUNCIONALIDADE / COMORBIDADES
   ↓
PRIORIDADE
   ↓
OPÇÕES DE TRATAMENTO
```

2.1 Diagnóstico
Preferencialmente:

```
BIOPSIA / PATH
        ↓
TIPO HISTOLÓGICO
        ↓
DIAGNÓSTICO
```

Exemplo:

```
ESÔFAGO
→ biópsia
→ carcinoma escamoso
```

A biópsia não é simplesmente “mais um exame”.
Ela ocupa papel especial:

```
PATH
→ confirma natureza da doença
→ caracteriza histologia
→ permite IHQ/molecular
→ ancora o diagnóstico oncológico
```

3. BIOMARCADORES NÃO SÃO UM BLOCO GENÉRICO
Não criar:

```
TODO CASO NOVO
→ CEA
→ AFP
→ CA15-3
```

Criar:

```
ÓRGÃO + HISTOLOGIA
        ↓
BIOMARCADORES PERTINENTES
```

Eles podem vir de:

```
IHQ
BIOLOGIA MOLECULAR
GENÉTICA
NGS
ANÁLISES CLÍNICAS
```

E podem cumprir funções diferentes:

```
DIAGNÓSTICA
PROGNÓSTICA
PREDITIVA
MONITORIZAÇÃO
```

Exemplo:

```
PULMÃO
→ adenocarcinoma
→ EGFR mutado
→ estádio metastático
→ biomarcador modifica diretamente
  o espaço terapêutico
```

4. ESTADIAMENTO
Estrutura:

```
HISTOLOGIA
+
RADIOLOGIA
+
EVENTUAIS LABS/PATH
        ↓
TNM / FIGO / SISTEMA ESPECÍFICO
```

O estadiamento ajuda a definir:

```
EXTENSÃO
PROGNÓSTICO
INTENÇÃO
FASE TERAPÊUTICA
URGÊNCIA RELATIVA
ESPAÇO DE TRATAMENTO
```

Mas:
estágio sozinho não define tratamento.
Tratamento resulta de:

```
ÓRGÃO
× HISTOLOGIA
× BIOMARCADOR
× ESTÁGIO
× FASE
× PACIENTE
```

5. EXEMPLO — MAMA

```
ÓRGÃO
Mama

HISTOLOGIA
Carcinoma metaplásico

BIOMARCADOR
Triplo negativo

ESTÁGIO
T2 N1 M0

FASE
Neoadjuvância

TRATAMENTO
espaço terapêutico aplicável
```

A plataforma pode então relacionar:

```
PROTOCOLO
TRIAL
OPÇÕES TERAPÊUTICAS
CONTRAINDICAÇÕES
COMORBIDADES
INTERAÇÕES
```

Exemplo de evidência externa associada ao espaço de conhecimento:
`KEYNOTE-522`: pacientes com TNBC estádio II–III, pembrolizumabe + QT neoadjuvante seguido de pembrolizumabe adjuvante; benefício de sobrevida global confirmado no seguimento longo.
Isso pertence ao OncoSist/conhecimento, não à execução automática da conduta.

6. RETORNO EM TRATAMENTO
Aqui a pergunta muda completamente:
“O tratamento está funcionando, causando dano ou ambos?”
Esteira:

```
TRATAMENTO ATUAL
        ↓
4 EIXOS DE AVALIAÇÃO

1. CLÍNICO
2. LABORATORIAL / BIOMARCADOR
3. RADIOLÓGICO
4. TOXICIDADE / INTERAÇÃO
```

Resultado:

```
CONCORDANTE
ou
DISCORDANTE
```

7. MATRIZ DE RESPOSTA DURANTE TRATAMENTO
A. Concordância favorável

```
CLÍNICA melhora
LAB melhora
RAD melhora
```

→ provável benefício terapêutico.
B. Concordância desfavorável

```
CLÍNICA piora
LAB piora
RAD piora
```

→ forte sinal de progressão/falha.
C. Discordância
Esta é a zona que o sistema PRECISA destacar.
Exemplos:

```
LAB piora
+
CLÍNICA melhora
+
RAD melhora
```

ou:

```
CLÍNICA melhora
+
LAB melhora
+
NOVA LESÃO RADIOLÓGICA
```

ou:

```
ALGUMAS LESÕES diminuem
+
OUTRAS crescem
```

Nestes casos:

```
⚠ DISCORDÂNCIA ENTRE EIXOS
```

A IA não conclui progressão.
Ela sinaliza:

```
REVISAR
```

8. NÃO MISTURAR QUATRO FENÔMENOS
8.1 Progressão verdadeira
Evidências concordantes de crescimento/novas lesões/deterioração, conforme contexto tumoral e critérios aplicáveis.
8.2 Pseudoprogressão imunológica
Pode ocorrer com imunoterapia:

```
aumento aparente
ou
nova lesão
→ seguido de estabilização/regressão
```

O iRECIST introduziu `iUPD` e `iCPD` justamente para lidar com progressão inicialmente não confirmada em imunoterapia; o próprio guideline ressalta que foi desenvolvido principalmente para padronização em trials e que a decisão terapêutica permanece clínica.
8.3 Flare
Não chamar todo flare de pseudoprogressão.
Exemplo próstata:

```
PSA / imagem óssea
podem apresentar comportamento discordante
durante resposta terapêutica
```

Em doença óssea prostática, PCWG utiliza regras específicas justamente porque novas alterações osteoblásticas iniciais podem representar flare e não progressão definitiva.
8.4 Resposta mista

```
LESÃO A → responde
LESÃO B → estável
LESÃO C → progride
```

Possível expressão de heterogeneidade/clones com sensibilidades diferentes.
Cluster:

```
RESPOSTA_DISCORDANTE
→ revisar imagem
→ sítio de progressão
→ carga de doença
→ sintomas
→ possibilidade de progressão focal/oligoprogressão
→ decisão médica
```

9. REGRA IMPORTANTE — NÃO É “RAD DEFINE TROCA”
O correto é:

```
CLÍNICA
+
LAB / MARCADOR
+
IMAGEM
+
CONTEXTO BIOLÓGICO
+
TRATAMENTO
        ↓
DECISÃO
```

RECIST 1.1 fornece critérios padronizados de resposta de lesões mensuráveis, mas não representa sozinho toda a decisão clínica.
Portanto:

```
PROGRESSÃO RADIOGRÁFICA
≠
TROCA AUTOMÁTICA
```

10. SEGUIMENTO
Pergunta central:
“Existe evidência de recidiva, novo primário ou outra causa?”
Fluxo:

```
ASSINTOMÁTICO
→ seguimento programado
```

ou:

```
NOVO SINTOMA / SINAL
        ↓
RELACIONADO AO CÂNCER?
        ↓
RECIDIVA?
SEGUNDO PRIMÁRIO?
CAUSA NÃO ONCOLÓGICA?
        ↓
INVESTIGAÇÃO DIRECIONADA
```

11. SEGUIMENTO — RISCO MODIFICA O LIMIAR DE INVESTIGAÇÃO
Exemplo:

```
32 anos
+
TNBC
+
resposta incompleta
+
BRCA/PALB2
+
nova convulsão
```

A plataforma não escreve:

```
METÁSTASE SNC CONFIRMADA
```

Ela reconhece:

```
RISCO ONCOLÓGICO RELEVANTE
+
SINTOMA NEUROLÓGICO NOVO
```

e pode ofertar:

```
RAD
□ RM crânio com contraste
⊕ Outros
```

O limiar para investigação muda com o contexto.

12. SINAL/SINTOMA → ÓRGÃO → HIPÓTESE → AÇÃO
Regra prática:

```
SINAL / SINTOMA
        ↓
MORFOLOGIA / FUNÇÃO
        ↓
ÓRGÃO / SÍTIO
        ↓
HIPÓTESE
        ↓
INVESTIGAÇÃO
        ↓
DIAGNÓSTICO
        ↓
TRATAMENTO
```

Mas a interface permite saltos.
Se o diagnóstico já é conhecido:

```
SINTOMA
→ TRATAMENTO
```

Se existe risco imediato:

```
SINTOMA
→ EMERGÊNCIA
→ AÇÃO IMEDIATA
```

Não é necessário completar burocraticamente toda a árvore antes de agir.

13. EXEMPLO — PRÓSTATA + COMPRESSÃO MEDULAR
Contexto:

```
CA PRÓSTATA
GLEASON 9
M1 ÓSSEO
+
dor lombar EVA 9/10
+
fraqueza MMII
+
hipoestesia
+
perda controle esfincteriano
```

O sistema reconhece um padrão de alto risco neurológico, mas não precisa construir uma extensa investigação ambulatorial.
Fluxo:

```
SINTOMAS
        ↓
PRIORIDADE: EMERGÊNCIA
        ↓
CLUSTER:
SUSPEITA_COMPRESSAO_MEDULAR
        ↓
AÇÃO IMEDIATA
```

Plataforma ofertada:

```
DESTINO
□ Hospital / PS

SUPORTE IMEDIATO
□ Analgesia
□ Corticoide
⊕ Outros

INVESTIGAÇÃO
□ RM coluna
⊕ Outros

ENCAMINHAMENTO
□ Neurocirurgia / cirurgia de coluna
□ Radioterapia
⊕ Outros

SUPORTE FUNCIONAL
□ Imobilização / órtese quando pertinente
⊕ Outros
```

O médico seleciona; o sistema gera:

```
ENCAMINHAMENTO
+
RESUMO ONCOLÓGICO
+
MEDICAÇÃO DRAFT
+
PEDIDO DE EXAME
```

14. CLUSTER DE ÓRGÃO
A IA precisa possuir um mapa de órgão, não uma receita rígida.
Exemplo:

```
PULMÃO
│
├── HISTOLOGIAS
│
├── BIOMARCADORES
│
├── ESTADIAMENTO
│
├── SINTOMAS RELEVANTES
│
├── URGÊNCIAS / EMERGÊNCIAS
│
├── INVESTIGAÇÃO
│   ├── LAB
│   ├── RAD
│   ├── ENDO
│   └── PATH
│
├── TRATAMENTOS
│   ├── MED
│   ├── CX
│   └── RT
│
├── TOXICIDADES / INTERAÇÕES
│
└── OUTROS [+]
```

O mesmo contrato vale para:

```
MAMA
PRÓSTATA
CÓLON
RETO
PULMÃO
GÁSTRICO
OVÁRIO
COLO
CABEÇA/PESCOÇO
etc.
```

15. NOVA ESTRUTURA GLOBAL
O modelo completo passa a ser:

```
PACIENTE
   ↓
TIPO DE CONSULTA
   ├── CASO NOVO
   ├── EM TRATAMENTO
   └── SEGUIMENTO
   ↓
ASSINATURA ONCOLÓGICA

ÓRGÃO
× HISTOLOGIA
× BIOMARCADOR
× ESTÁGIO
× FASE
× TRATAMENTO
× CARACTERÍSTICAS DO PACIENTE

   ↓

MUDANÇA / PROBLEMA ATUAL

   ↓

X = MORFOLOGIA / FUNÇÃO / SÍTIO
Y = ESTADO / GRAVIDADE / PRIORIDADE
Z = AÇÃO

   ↓

CLUSTER

   ↓

INVESTIGAÇÃO
TRATAMENTO
ENCAMINHAMENTO
SUPORTE
RETORNO

   ↓

MÉDICO SELECIONA

   ↓

IA PRODUZ OS ARTEFATOS
```

16. PRINCÍPIO OPERACIONAL
A IA precisa saber o suficiente para montar a mesa de trabalho, não para substituir o oncologista.
Portanto:

```
IA CLASSIFICA CONTEXTO
IA MONTA VARIÁVEIS
IA MOSTRA ALTERNATIVAS
IA DETECTA DISCORDÂNCIAS
IA LEMBRA RISCOS
IA GERA DOCUMENTOS

MÉDICO INTERPRETA
MÉDICO PRIORIZA
MÉDICO DIAGNOSTICA
MÉDICO DEFINE CONDUTA
MÉDICO CONFIRMA
```

Regra final
O sistema precisa conhecer oncologia profundamente para saber o que colocar diante do médico — mas não precisa tomar a decisão que está colocando diante dele.
Isso cria uma arquitetura bem mais forte: TIPO DE CONSULTA → assinatura oncológica → mudança de estado → X/Y/Z → cluster. O próximo passo lógico é verticalizar CASO NOVO, EM TRATAMENTO e SEGUIMENTO separadamente, porque cada um possui um indagatório completamente diferente.
