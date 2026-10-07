# Fonte M-J · PLN-007 · 2026-10-07 · texto íntegro do Dr. Silas

> Cópia literal (sem PHI). Não editar; correções viram nó novo no CHATPLAN.

Sim. E há um ajuste conceitual importante: Khorana/MASCC são scores; CPS/TPS são métodos de expressão de PD-L1; claudina/CLDN18.2 é biomarcador. O app deve tratar todos como instrumentos clínicos acionáveis, não tentar encaixá-los numa única categoria.
A arquitetura que eu congelaria é:

```
ONCOMED KNOWLEDGE / ASSISTANCE LAYER

1. CLASSIFICAÇÕES
   ├─ Diagnósticas
   ├─ Prognósticas
   ├─ Risco
   ├─ Gravidade
   ├─ Elegibilidade
   └─ Resposta

2. SCORES
   ├─ Khorana
   ├─ MASCC
   ├─ outros
   └─ OUTROS [+]

3. BIOMARCADORES / SCORING PATH
   ├─ CPS
   ├─ TPS
   ├─ CLDN18.2
   ├─ HER2
   ├─ MSI/MMR
   ├─ RAS/BRAF
   ├─ EGFR/ALK/ROS1...
   └─ OUTROS [+]

4. TRATAMENTO / EVIDÊNCIA
   ├─ protocolos
   ├─ trials
   ├─ interação
   ├─ contraindicação
   └─ alternativas

5. REALIDADE SUS
   ├─ disponível
   ├─ não disponível
   ├─ disponibilidade institucional
   ├─ biomarcador indisponível
   ├─ tratamento não acessível
   └─ alternativa disponível
```

Não codificaria todos os scores. O código precisa saber apenas quando chamar uma capacidade. O cálculo/interpretação pode ser delegado ao agente especializado ou OncoAssist.
Exemplo:

```
Paciente em QT
+ febre
+ neutropenia
        ↓
ORK reconhece contexto
        ↓
"Existe classificação de risco relevante?"
        ↓
SIM → MASCC
        ↓
ScoreAgent / OncoAssist
        ↓
retorna:
- dados encontrados
- dados faltantes
- score, se calculável
- interpretação
- fonte/versão
        ↓
MÉDICO REVISA
```

O mesmo vale para:

```
CA gástrico
→ PD-L1
→ solicitar interpretação CPS

CA pulmão
→ PD-L1
→ TPS

adenocarcinoma gástrico
→ CLDN18.2
→ verificar expressão/elegibilidade

QT + risco trombótico
→ Khorana
```

O ponto SUS deve ser primeira classe
O motor não pode assumir:

```
BIOMARCADOR EXISTE
→ FÁRMACO EXISTE
```

Precisa distinguir:

```
CLINICAMENTE INDICADO
        ≠
DISPONÍVEL NO SUS
        ≠
DISPONÍVEL NESTA INSTITUIÇÃO
```

A UI pode mostrar, por exemplo:

```
EGFR exon19+
Osimertinibe
[ evidência clínica ]

ACESSO
SUS nacional:       [status]
Instituição atual:  [status]
Alternativa local:  [opções]
```

Sem apagar a opção clinicamente correta apenas porque não está disponível.
Múltiplos agentes

```
                         ORK
                          │
        ┌─────────────────┼─────────────────┐
        ↓                 ↓                 ↓
   OncoAssist         ScoreAgent      BiomarkerAgent
        ↓                 ↓                 ↓
   conduta/KB          scores          IHQ/molecular
        │
        ├──────── ProtocolAgent
        ├──────── InteractionAgent
        ├──────── SUS/AccessAgent
        ├──────── LabAgent
        └──────── RadAgent
```

`LabAgent` e `RadAgent` podem buscar sistemas externos, mas entram por um contrato comum:

```
EXTERNAL_SOURCE
→ importar
→ normalizar
→ registrar origem/data
→ comparar longitudinalmente
→ NEEDS_REVIEW
→ médico confirma
```

Não copiar valor externo direto para estado `CONFIRMED`.
E o ORK deve operar aproximadamente assim:
Você é o ORK, orquestrador clínico da suíte oncológica.
Sua função NÃO é tomar a decisão clínica final.
Para cada contexto recebido:

1. Identifique:

* tipo de consulta;
* tumor fingerprint;
* tratamento atual;
* problema clínico atual;
* clusters ativos;
* dados disponíveis;
* dados ausentes.

2. Determine se existe capacidade especializada relevante:

* score diagnóstico;
* score prognóstico;
* classificação de risco;
* classificação de gravidade;
* classificação de resposta;
* biomarcador;
* interação medicamentosa;
* contraindicação;
* protocolo;
* evidência/trial;
* disponibilidade SUS;
* exame laboratorial externo;
* exame radiológico externo.

3. Encaminhe somente a tarefa necessária ao agente especializado ou OncoAssist.
4. O retorno do agente deve conter:

* resultado;
* variáveis utilizadas;
* variáveis ausentes;
* versão/classificação utilizada;
* interpretação curta;
* fonte/proveniência quando aplicável;
* incertezas;
* sugestões de próximos passos.

5. Nunca converta sugestão em ação final.
6. Nunca presuma que biomarcador, exame ou medicamento está disponível no SUS ou na instituição.
7. Diferencie sempre:
CLINICAMENTE INDICADO
vs
DISPONÍVEL NO SUS
vs
DISPONÍVEL LOCALMENTE.
8. Se faltarem dados:
não invente;
retorne NEEDS_DATA e informe exatamente o campo ausente.
9. Se houver conflito entre fontes:
preserve ambas;
marque CONFLICT;
solicite revisão médica.
10. Toda ação operacional deve terminar como:
SUGGESTION → DRAFT → MEDICAL_REVIEW → CONFIRMATION.

Princípio:
IA prepara o botão. Médico aperta.
Isso permite incorporar centenas de scores, classificações, biomarcadores e protocolos sem transformar o backend num cemitério de `if/else` clínicos. O código governa contratos e roteamento; o conhecimento fica versionado nos agentes/KB.
