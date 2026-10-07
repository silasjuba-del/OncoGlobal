# Fonte M-H · PLN-006 · 2026-10-07 · texto íntegro do Dr. Silas

> Cópia literal (sem PHI). Não editar; correções viram nó novo no CHATPLAN.

Isso fecha o motor de continuidade terapêutica. Mas há uma correção clínica importante: “vomitou 6x/dia” não basta, hoje, para classificar automaticamente CTCAE G3. Tanto CTCAE v5 quanto v6 classificam vômito G3 pela necessidade de alimentação enteral/TPN ou hospitalização; G2 envolve hidratação IV ambulatorial/intervenção médica. Portanto o app deve extrair o número de episódios, mas pedir/completar os critérios necessários antes de fechar o grau. [Tratamento e Diagnóstico do Câncer](https://dctd.cancer.gov/research/ctep-trials/for-sites/adverse-events/ctcae-v5-8x11.pdf)
Fluxo canônico: VOZ/TEXTO → CTCAE → CRUZAMENTO → CONDUTA

```
"Paciente vomitou 6x/dia por 4 dias"
                ↓
EXTRAÇÃO
evento: VÔMITO
frequência: 6/dia
duração: 4 dias
                ↓
CLUSTER: VÔMITO
                ↓
CTCAE ENGINE
versão: v6.0
dados suficientes?
        │
        ├─ NÃO → perguntar/mostrar pendências
        └─ SIM → sugerir grau
                ↓
CRUZAMENTO CLÍNICO
                ↓
CONDUTA SUGERIDA
                ↓
MÉDICO SELECIONA
                ↓
DRAFTS / IMPRESSÃO
```

1. Cluster de toxicidade

```
CLUSTER: VÔMITO

DADOS EXTRAÍDOS
✓ 6 episódios/dia
✓ duração 4 dias

CTCAE v6
□ G1
□ G2
□ G3
□ G4

PENDENTE PARA CLASSIFICAÇÃO
□ precisou hidratação EV ambulatorial?
□ precisou internação?
□ alimentação enteral/TPN?
□ consequência ameaçadora à vida?

[ MÉDICO CONFIRMA GRAU ]
```

A IA pode mostrar “G2/G3 a esclarecer”, mas não inventar o critério ausente. A própria NCI separa gravidade do evento de atribuição causal; um AE pode estar relacionado ao tratamento, à doença, a comorbidades, medicamentos concomitantes ou outra causa. [Tratamento e Diagnóstico do Câncer](https://dctd.cancer.gov/research/ctep-trials/for-sites/adverse-events)
2. Depois do CTCAE vem o CRUZAMENTO
Este é o núcleo:

```
                TUMOR
                  ×
            TRATAMENTO ATUAL
                  ×
                ECOG
                  ×
                CTCAE
                  ×
            COMORBIDADES
                  ×
        MEDICAÇÕES EM USO
                  ×
             LABS / RADS
                  ×
        TEMPO DESDE ÚLTIMO TTO
                  ↓
           ESPAÇO DE CONDUTA
```

Exemplo:

```
CA CÓLON M1
+
FOLFOX C4
+
VÔMITO G2 confirmado
+
DRC
+
LOSARTANA
+
Cr 1,9 / K 3,1
+
D5 pós-QT
```

O sistema entende que não basta tratar o vômito.
Ele deve montar:

```
VÔMITO
├─ suporte/sintomático
├─ hidratação?
├─ eletrólitos/função renal?
├─ causa alternativa?
├─ tratamento atual tem risco emético?
├─ profilaxia foi adequada?
├─ houve falha de sintomáticos?
└─ próximo ciclo precisa revisão?
```

Para vômito de escape, ASCO recomenda justamente reavaliar risco emético, doença, comorbidades e medicamentos concomitantes antes de simplesmente acrescentar tratamento antiemético. [ACS Publications](https://ascopubs.org/doi/10.1200/JCO.20.01296?utm_source=chatgpt.com)
3. RETORNO EM TRATAMENTO = sete perguntas

```
1. PASSOU BEM OU MAL?
   └─ sintomas / toxicidades / intercorrências

2. FOI AO PS OU INTERNOU?
   └─ evento grave / descompensação

3. TOMOU OS SINTOMÁTICOS?
   └─ aderiu? funcionou? falhou?

4. COMO ESTÁ A DOENÇA?
   └─ clínica + marcador + RADS

5. COMO ESTÁ O PACIENTE?
   └─ ECOG + comorbidades + função orgânica

6. ELE PODE RECEBER O PRÓXIMO TRATAMENTO?
   └─ labs + toxicidade + interação + protocolo

7. O QUE FAZER AGORA?
   └─ manter | suporte | investigar | adiar |
      reduzir | suspender | trocar | encaminhar
```

Essas são as perguntas; não precisam aparecer como formulário rígido. Whisper/PLAUD/escrita vão preenchendo-as conforme a conversa acontece.
4. Motor de tratamento
Primeiro, a oncologia reduz o universo:

```
TIPO DE TUMOR
↓
HISTOLOGIA
↓
BIOMARCADORES
↓
TNM / ESTÁGIO
↓
FASE
NEO | ADJ | M1
↓
PROTOCOLOS POSSÍVEIS
```

Depois o paciente reduz novamente:

```
PROTOCOLOS POSSÍVEIS
        ↓
ECOG
COMORBIDADES
FUNÇÃO RENAL/HEPÁTICA/CARDÍACA
MUC / INTERAÇÕES
TOXICIDADE PRÉVIA
        ↓
PROTOCOLOS/DOSES REALMENTE POSSÍVEIS
```

Finalmente, o retorno decide continuidade:

```
TRATAMENTO EM CURSO
        ↓
EFICÁCIA
+
TOXICIDADE
+
TOLERÂNCIA
+
INTERCORRÊNCIAS
        ↓
PRÓXIMA AÇÃO
```

5. UI do cluster após o cruzamento

```
▼ VÔMITO — TRATAMENTO ATIVO

CTCAE
Grau: [ G2 ▼ ]          [ explicar ]

CONTEXTO
FOLFOX C4 | D5 pós-QT
ECOG 1
DRC conhecida

O QUE ACONTECEU
6 episódios/dia × 4 dias
Sintomático prévio: ondansetrona
Resposta: insuficiente

SUGESTÕES

SUPORTE
□ Rever esquema antiemético
□ Hidratação
□ Orientação alimentar
⊕ OUTROS

LAB
□ Na / K / Mg
□ Ureia / creatinina
⊕ OUTROS

INVESTIGAÇÃO
□ Avaliar causa não relacionada à QT
⊕ OUTROS

PRÓXIMO CICLO
□ Manter
□ Postergar
□ Reduzir
□ Suspender componente
⊕ OUTROS

DESTINO
□ Ambulatório
□ PS
⊕ OUTROS
```

Todos desmarcados, salvo ordem médica explícita.
6. Botão `EXPLICAR`
Muito importante.
Ao lado de qualquer sugestão:

```
[ ? EXPLICAR ]
```

Exemplo:
Por que está sugerindo função renal/eletrólitos?
Vômitos persistentes podem acompanhar perda volêmica e alterações eletrolíticas; o paciente possui DRC e está em tratamento sistêmico.
Não mostrar:

```
IA: 93% de chance
```

Mostrar:

```
SUGESTÃO BASEADA EM:
• vômitos persistentes
• duração 4 dias
• DRC
• tratamento sistêmico atual
```

Isso é auditável.
7. Botão `GERAR`
Depois que o médico seleciona:

```
☑ Hidratação
☑ Na/K/Mg
☑ Creatinina
☑ Rever antiemese
☑ Retorno 48h
```

o sistema oferece:

```
[ GERAR ]
```

e produz:

```
📄 RECEITA / MINUTA
📄 SOLICITAÇÃO LAB
📄 ORIENTAÇÕES
📄 SINAIS DE ALARME
📄 RETORNO
```

Tudo nasce como DRAFT.
8. A matriz final da continuidade

```
                    RETORNO EM TRATAMENTO

                         TRATAMENTO
                             │
           ┌─────────────────┼─────────────────┐
           ↓                 ↓                 ↓
        DOENÇA           TOXICIDADE        PACIENTE
           │                 │                 │
     Clínica/RADS         CTCAE           ECOG
     Marcadores           sintomas        Comorbidades
                                             MUC
                                             função órgãos
           └─────────────────┼─────────────────┘
                             ↓
                         CRUZAMENTO
                             ↓
                    CONTINUAR TRATAMENTO?
                             ↓
        ┌──────────┬─────────┼──────────┬──────────┐
        ↓          ↓         ↓          ↓          ↓
      MANTER    SUPORTE    ADIAR     AJUSTAR    SUSPENDER
                             ↓
                   INVESTIGAR / RADS?
                             ↓
                     RETORNO / DESTINO
```

Essa é a peça que faltava: `CTCAE` não é uma aba isolada. Ele entra no cruzamento longitudinal do tratamento junto com eficácia, ECOG, comorbidades, MUC e função orgânica.
→ Pergunta cirúrgica: você quer que o próximo passo seja congelar essa matriz de RETORNO EM TRATAMENTO com os clusters universais `toxicidade | eficácia | internação/intercorrência | interação | função orgânica | elegibilidade próximo ciclo`?
Aprofunde o motor de continuidade

* Especificar o fluxo do vômito
* Definir os clusters universais
