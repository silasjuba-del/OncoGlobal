# Fonte M-I · PLN-006 · 2026-10-07 · texto íntegro do Dr. Silas

> Cópia literal (sem PHI). Segunda parte da mesma mensagem de M-H (resposta ao pedido "Definir os clusters universais"). Não editar.

* CLUSTERS UNIVERSAIS — RETORNO EM TRATAMENTO
0. Entrada comum
Todo retorno parte deste contexto fixo:

```
TIPO_CONSULTA = EM_TRATAMENTO

Tumor Fingerprint
+ tratamento atual
+ ciclo/linha
+ última aplicação
+ último reestadiamento
+ ECOG prévio
+ comorbidades
+ MUC
```

Os clusters são independentes, mas convergem no final.

```
RETORNO
├── 1. TOXICIDADE
├── 2. EFICÁCIA / DOENÇA
├── 3. INTERCORRÊNCIA / INTERNAÇÃO
├── 4. INTERAÇÃO / MUC
├── 5. FUNÇÃO ORGÂNICA
├── 6. ELEGIBILIDADE PRÓXIMO CICLO
└── 7. SUPORTE / SINTOMÁTICOS
            ↓
         CRUZAMENTO
            ↓
      CONDUTA SUGERIDA
```

1. CLUSTER TOXICIDADE
Dados de entrada

```
sintomas desde último ciclo
início
duração
intensidade
frequência
persistência
impacto funcional
necessidade de intervenção
CTCAE prévio
tratamento atual
dose/ciclo
```

Exemplos:

```
náusea
vômitos
diarreia
mucosite
neuropatia
fadiga
rash
mão-pé
dispneia
febre
dor
```

Perguntas Whisper
Roteiro flexível:

```
"Como passou depois da última aplicação?"

"Teve náusea ou vômito?"
"Quantas vezes?"
"Quantos dias durou?"

"Teve diarreia?"
"Quantas evacuações além do habitual?"

"Teve aftas?"
"Conseguiu comer?"

"Formigamento ou dormência?"
"Atrapalhou andar, vestir-se ou usar as mãos?"

"Precisou procurar atendimento?"
```

Whisper não precisa fazer todas as perguntas: preenche conforme a conversa.
Regras de cruzamento

```
EVENTO
×
CTCAE
×
TEMPO EM RELAÇÃO AO TRATAMENTO
×
PROTOCOLO
×
FUNÇÃO ORGÂNICA
×
IMPACTO FUNCIONAL
```

Separar:

```
EVENTO
≠
GRAU
≠
CAUSALIDADE
```

Exemplo:

```
VÔMITO detectado
→ dados permitem sugerir CTCAE?
→ sim/não
→ relacionado temporalmente à QT?
→ possibilidade, não confirmação
```

Saídas sugeridas

```
□ tratamento sintomático
□ intensificar profilaxia
□ labs
□ hidratação
□ orientação
□ sinais de alarme
□ antecipar retorno
□ avaliar adiamento
□ avaliar ajuste de dose
□ avaliar suspensão de componente
⊕ OUTROS
```

2. CLUSTER EFICÁCIA / ESTADO DA DOENÇA
Dados de entrada

```
sintomas relacionados à doença
exame clínico
marcadores tumorais
último valor + tendência
últimos RADS
RECIST/iRECIST quando aplicável
data do último restaging
tratamento atual
tempo de tratamento
```

Perguntas Whisper

```
"Aquela dor melhorou, piorou ou está igual?"

"Tem algum sintoma novo?"

"Perdeu peso?"

"Aquela massa/nódulo mudou?"

"Trouxe a tomografia?"

"Tem marcador recente?"

"Quando foi o último exame de imagem?"
```

Regras de cruzamento
Três eixos principais:

```
CLÍNICA
+
LAB / MARCADOR
+
RADIOLOGIA
```

Classificar apenas a concordância:

```
CONCORDANTE FAVORÁVEL

CONCORDANTE DESFAVORÁVEL

DISCORDANTE
```

Exemplos:

```
clínica melhora
+ marcador cai
+ imagem melhora
→ padrão favorável

clínica melhora
+ marcador melhora
+ nova lesão radiológica
→ DISCORDÂNCIA

PSA sobe
+ clínica melhora
+ imagem estável
→ DISCORDÂNCIA
```

A IA sinaliza:

```
⚠ EIXOS DISCORDANTES
```

Não conclui automaticamente progressão.
Saídas sugeridas

```
□ manter avaliação programada
□ antecipar RADS
□ repetir marcador
□ solicitar exame dirigido
□ revisar imagem
□ considerar biópsia
□ considerar discussão de mudança terapêutica
□ retorno antecipado
⊕ OUTROS
```

3. CLUSTER INTERCORRÊNCIA / INTERNAÇÃO
Dados de entrada

```
PS desde último ciclo?
internação?
motivo
datas
diagnóstico
procedimentos
antibióticos
transfusão
UTI
cirurgia
alta
estado atual
```

Perguntas Whisper

```
"Precisou ir ao pronto-socorro?"

"Foi internado?"

"Por quê?"

"Quantos dias?"

"Recebeu antibiótico?"

"Recebeu sangue?"

"Fez algum procedimento?"

"Já recebeu alta?"
```

Regras de cruzamento

```
INTERCORRÊNCIA
×
TRATAMENTO ATUAL
×
TEMPO DESDE ÚLTIMA DOSE
×
RECUPERAÇÃO
×
FUNÇÃO ORGÂNICA
×
ECOG ATUAL
```

Exemplo:

```
internação por sepse
+
alta recente
+
ECOG pior
+
QT programada hoje
→ cluster elegibilidade obrigatoriamente reaberto
```

Saídas sugeridas

```
□ adiar tratamento para revisão
□ solicitar documentos da internação
□ repetir labs
□ reavaliar ECOG
□ revisar dose/protocolo
□ encaminhamento
□ retorno precoce
⊕ OUTROS
```

4. CLUSTER INTERAÇÃO / MUC
Dados de entrada

```
medicações em uso
nova medicação
medicações suspensas
fitoterápicos
anticoagulantes
anticonvulsivantes
antibióticos
corticoides
OTC
tratamento oncológico atual
```

Perguntas Whisper

```
"Começou algum remédio novo?"

"Algum médico mudou suas medicações?"

"Está tomando tudo igual?"

"Usou antibiótico?"

"Usou anti-inflamatório?"

"Está tomando algum remédio por conta própria?"
```

Regras de cruzamento

```
MUC
×
PROTOCOLO
×
METABOLISMO / TRANSPORTADORES
×
QTc
×
RISCO HEMORRÁGICO
×
FUNÇÃO RENAL/HEPÁTICA
```

Classificação útil:

```
SEM INTERAÇÃO RELEVANTE
ATENÇÃO
INTERAÇÃO IMPORTANTE
CONTRAINDICAÇÃO / REVISÃO OBRIGATÓRIA
```

Saídas sugeridas

```
□ alertar interação
□ monitorar exame
□ discutir troca de medicação
□ ajustar horário/administração
□ revisar anticoagulação
□ ECG
□ labs específicos
⊕ OUTROS
```

5. CLUSTER FUNÇÃO ORGÂNICA
Dados de entrada
Hematológica

```
Hb
ANC
plaquetas
```

Renal

```
creatinina
eGFR/ClCr
ureia
Na/K/Mg
```

Hepática

```
AST/TGO
ALT/TGP
BT/BD
FA
GGT
albumina
INR
```

Cardíaca

```
FEVE
ECG/QTc
sintomas
```

Outras conforme protocolo.
Perguntas Whisper
Geralmente não precisam ser interrogatório explícito se labs já disponíveis.
Voz serve para contextualizar:

```
"Creatinina aumentou desde a última consulta."

"Ela está urinando menos."

"Está com edema."

"Está com falta de ar."

"Teve sangramento."
```

Regras de cruzamento

```
FUNÇÃO ORGÂNICA ATUAL
×
BASELINE
×
TENDÊNCIA
×
TRATAMENTO
×
DOSE
×
TOXICIDADE
```

O sistema deve mostrar:

```
valor atual
valor anterior
delta
limite relevante do protocolo
```

Exemplo:

```
ClCr atual: 28
prévio: 52
↓ 46%

PROTOCOLO CONTÉM:
capecitabina
```

A IA pode sinalizar incompatibilidade potencial; decisão final é médica.
Saídas sugeridas

```
□ repetir lab
□ hidratação
□ corrigir eletrólitos
□ avaliação especializada
□ revisar dose
□ adiar
□ suspender componente
□ alterar via/medicação
⊕ OUTROS
```

6. CLUSTER ELEGIBILIDADE PARA O PRÓXIMO CICLO
Este é o cluster de síntese.
Dados de entrada
Importa os demais:

```
ECOG atual
CTCAE
labs
função renal
função hepática
intercorrências
infecção
internação
interações
tratamento atual
dose anterior
dias desde última aplicação
```

Perguntas Whisper
Pergunta macro:

```
"Hoje ele está em condição de receber o tratamento?"
```

Mas o sistema preenche automaticamente com os outros clusters.
Checklist:

```
□ desempenho funcional
□ toxicidades recuperadas?
□ labs adequados?
□ intercorrência resolvida?
□ interação crítica?
□ função orgânica adequada?
```

Regras de cruzamento

```
PROTOCOLO
×
ECOG
×
CTCAE
×
FUNÇÃO ORGÂNICA
×
INTERCORRÊNCIAS
×
INTERAÇÕES
```

Saída não executiva:

```
ELEGIBILIDADE:
🟢 sem impedimento identificado
🟡 requer revisão
🔴 há critério incompatível / crítico
```

Nunca:

```
"APROVADO PARA QT"
```

sem ação médica.
Saídas sugeridas

```
□ manter esquema/dose
□ adiar ciclo
□ postergar X dias
□ reduzir dose
□ retirar componente
□ suspender tratamento
□ mudar esquema
□ solicitar novos exames
□ retorno precoce
⊕ OUTROS
```

7. CLUSTER SUPORTE / SINTOMÁTICOS
Dados de entrada

```
sintomáticos prescritos
aderência
resposta
falha
efeitos adversos
necessidade atual
```

Perguntas Whisper

```
"Tomou o remédio para náusea?"

"Funcionou?"

"Precisou tomar algo além?"

"A dor melhorou com a medicação?"

"Está conseguindo comer?"

"Está conseguindo beber líquidos?"
```

Regras de cruzamento

```
SINTOMA
×
TRATAMENTO SINTOMÁTICO PRÉVIO
×
ADESÃO
×
RESPOSTA
×
TOXICIDADE
```

Classificação operacional:

```
ADEQUADO
PARCIAL
FALHA
NÃO UTILIZOU
```

Saídas sugeridas

```
□ manter sintomático
□ aumentar/intensificar
□ acrescentar medicamento
□ substituir
□ dieta
□ hidratação
□ nutrição
□ sinais de alarme
⊕ OUTROS
```

8. CLUSTER NOVO PROBLEMA
Esse cluster deve existir sempre porque nem tudo durante a consulta será toxicidade ou câncer.
Dados de entrada

```
sinal/sintoma novo
tempo
intensidade
progressão
sítio
```

Whisper

```
"Tem alguma coisa nova desde a última consulta?"

"Quando começou?"

"Está piorando?"


```

Cruzamento

```
NOVO PROBLEMA
→ doença?
→ toxicidade?
→ comorbidade?
→ causa independente?
→ urgência?
```

Saídas

```
□ investigação LAB
□ RAD
□ ENDO
□ PATH
□ sintomáticos
□ encaminhamento
□ PS
□ novo cluster manual
⊕ OUTROS
```

9. MERGE FINAL DO RETORNO
Todos os clusters convergem:

```
TOXICIDADE
+
EFICÁCIA
+
INTERCORRÊNCIA
+
INTERAÇÃO
+
FUNÇÃO ORGÂNICA
+
SUPORTE
+
NOVO PROBLEMA
        ↓
ELEGIBILIDADE PRÓXIMO CICLO
        ↓
CONDUTA MÉDICA
```

UI final:

```
RETORNO EM TRATAMENTO

DOENÇA
✓ sem mudança clínica relevante
⚠ imagem pendente

TOXICIDADE
⚠ neuropatia G2 persistente

INTERCORRÊNCIAS
✓ nenhuma internação

INTERAÇÕES
⚠ nova varfarina

FUNÇÃO ORGÂNICA
🔴 ClCr 28

SINTOMÁTICOS
⚠ antiemese parcialmente eficaz

PRÓXIMO CICLO
⚠ REQUER REVISÃO

SUGESTÕES
□ adiar
□ revisar dose
□ solicitar creatinina/ClCr
□ revisar componente responsável
⊕ OUTROS
```

10. REGRA UNIVERSAL DA VOZ

```
DESCRIÇÃO
→ preenche variável

EXEMPLO:
"vomitou seis vezes por dia"
→ frequência = 6/dia

INTERPRETAÇÃO
→ sistema pode sugerir classificação

EXEMPLO:
→ CTCAE provável / pendente

ORDEM EXPLÍCITA
→ seleciona ação

EXEMPLO:
"vou pedir creatinina e potássio"
→ ☑ creatinina
→ ☑ K

AÇÃO FINAL
→ exige médico
```

11. CONTRATO FINAL

```
RETORNO_EM_TRATAMENTO
        ↓
7+1 CLUSTERS

1 TOXICIDADE
2 EFICÁCIA
3 INTERCORRÊNCIA
4 INTERAÇÃO/MUC
5 FUNÇÃO ORGÂNICA
6 ELEGIBILIDADE
7 SUPORTE/SINTOMÁTICOS
8 NOVO PROBLEMA

        ↓
CRUZAMENTO
        ↓
SUGESTÕES
        ↓
OUTROS [+]
        ↓
MÉDICO
        ↓
DRAFTS
```

Regra congelada: nenhum cluster decide isoladamente. A decisão de continuidade resulta do cruzamento dos clusters, com prioridade clínica e julgamento médico acima de qualquer regra automática.
Eu colocaria o `CLUSTER 8 — NOVO PROBLEMA` mesmo que pareça redundante: ele é o mecanismo de escape que impede o sistema de interpretar toda queixa de quem está em tratamento como toxicidade ou progressão.
