# Fonte M-P · PLN-012 · 2026-10-07 · texto íntegro do Dr. Silas

> Cópia literal. A tabela original veio separada por tabulações (CATEGORIA · CLASSE · SEÇÃO · TÓPICO); aqui as linhas mantêm a ordem e cada coluna é separada por " | ". Linhas com CLASSE vazia na origem repetem a categoria anterior. Não editar.

Matriz universal canônica
A hierarquia deve ser fixa no backend:

```
CATEGORIA
  └── CLASSE
       └── SEÇÃO
            └── TÓPICO
                 └── OUTROS [+]
```

OUTROS existe em TODOS os níveis e nunca substitui o conteúdo canônico; apenas o estende.

CATEGORIA | CLASSE | SEÇÃO | TÓPICO — exemplos
--- | --- | --- | ---
**1. PROBLEMA / EVENTO** | Sinal/sintoma | Novo · antigo · piora · recorrente · estável | Dor lombar, dispneia, diarreia, sangramento
 | Alteração laboratorial | Nova · persistente · progressiva | Anemia, neutropenia, hipercalcemia
 | Alteração de imagem | Nova · progressão · incidental | Nova lesão óssea, derrame, massa
 | Biomarcador | Aumento · queda · estabilidade | PSA crescente, CEA elevado
 | Toxicidade | Clínica · hematológica · orgânica | Mucosite, neuropatia, neutropenia
 | OUTROS [+] | OUTROS [+] | [texto livre]
**2. PRIORIDADE** | Eletiva | Ambulatório | Investigar programadamente
 | Prioritária | Curto prazo | Exame/avaliação antecipada
 | Urgente | Mesmo dia / serviço de urgência | Avaliação rápida
 | Emergência | PS / hospital | Encaminhamento imediato
 | OUTROS [+] | OUTROS [+] | [texto livre]
**3. INVESTIGAÇÃO** | LAB | Hematologia · renal · hepática · metabólica · marcadores | HMG, ferritina, PSA, cálcio
 | RAD | RX · US · TC · RM · PET · cintilografia | RM coluna lombar
 | ENDO | Digestiva · respiratória · urinária etc. | Colonoscopia, EDA
 | PATH | Citologia · biópsia · AP · IHQ · molecular | Biópsia, HER2, NGS
 | PROC | Procedimento diagnóstico | Punção, toracocentese
 | OUTROS [+] | OUTROS [+] | [texto livre]
**4. TRATAMENTO** | Sintomático | MED · procedimento · suporte | Analgesia, antiemético, hidratação
 | Específico | MED · CX · RT · procedimento | Antineoplásico, cirurgia, RT
 | MED | VO · EV · SC · IM · tópico · SL | Enzalutamida, ferro EV
 | MED oncológico | QT · IO · alvo · hormonal · outros | Docetaxel, antiandrogênico
 | CX | Curativa · paliativa · estabilização · diagnóstica | Estabilização vertebral
 | RT | Curativa · adjuvante · paliativa · antálgica | RT antálgica óssea
 | OUTROS [+] | OUTROS [+] | [texto livre]
**5. ENCAMINHAMENTO** | Especialidade | Oncológica · clínica · cirúrgica · suporte | Ortopedia oncológica, nutrição
 | Serviço | Ambulatório · hospital · PS · unidade especializada | Radioterapia, emergência
 | Procedimento | Avaliação/intervenção específica | Vertebroplastia
 | Motivo | Diagnóstico · tratamento · urgência · segunda avaliação | Dor + suspeita de instabilidade
 | OUTROS [+] | OUTROS [+] | [texto livre]
**6. SUPORTE / SEGURANÇA** | Orientação | Geral · dieta · atividade · autocuidado | Hidratação, dieta
 | Sinais de alarme | Hematológico · infeccioso · neurológico etc. | Febre, déficit motor
 | Suporte multiprofissional | Nutrição · psicologia · fisio · social | Encaminhar nutricionista
 | OUTROS [+] | OUTROS [+] | [texto livre]
**7. RETORNO** | Programado | Dias · semanas · meses | 21 dias
 | Condicionado | Após exame · após tratamento · após intercorrência | Retorno com TC
 | Antecipado | Mudança clínica | Voltar se piora
 | Sem retorno definido | Seguimento externo / alta | —
 | OUTROS [+] | OUTROS [+] | [texto livre]
**8. SAÍDA / DOCUMENTO** | Solicitação | LAB · RAD · ENDO · PATH | Pedido de RM
 | Receita | Medicamentos · suporte | Receita pronta
 | Encaminhamento | Especialidade · serviço | Carta para RT
 | Orientação | Cuidados · dieta · sinais de alarme | Folha do paciente
 | Relatório | Resumo · laudo · declaração | Resumo clínico
 | OUTROS [+] | OUTROS [+] | [texto livre]

Regra do OUTROS
Em qualquer nível:

```
CATEGORIA
[ INVESTIGAÇÃO ▼ ]   [+ OUTROS]

CLASSE
[ RAD ▼ ]            [+ OUTROS]

SEÇÃO
[ RM ▼ ]             [+ OUTROS]

TÓPICO
□ RM coluna lombar
□ RM pelve
⊕ OUTROS
   □ [________________________________]
```

O valor manual deve poder ser:

```
[ ] texto livre
[ ] selecionar existente
[ ] adicionar novo item
[ ] duplicar item
[ ] remover item
```

E sempre seguir o mesmo contrato:

```
seleciona/preenche
      ↓
gera DRAFT
      ↓
médico revisa
      ↓
imprime / assina
```

Estrutura de um cluster real

```
CLUSTER: DOR LOMBAR

PROBLEMA
Dor lombar → nova → piorando

PRIORIDADE
□ Eletivo
□ Urgente
□ PS
⊕ Outros [__________]

INVESTIGAÇÃO
LAB
□ PSA
□ Cálcio
□ Fosfatase alcalina
⊕ Outros [__________]

RAD
□ TC coluna
□ RM coluna
⊕ Outros [__________]

TRATAMENTO
Sintomático
□ Analgesia
⊕ Outros [__________]

Específico
□ MED
□ CX
□ RT
⊕ Outros [__________]

ENCAMINHAMENTO
□ Radioterapia
□ Ortopedia oncológica
⊕ Outros [__________]

RETORNO
□ 7 dias
□ 21 dias
□ Após exames
⊕ Outros [__________]
```

A regra arquitetural principal é: a matriz define possibilidades; o cluster seleciona apenas o subconjunto pertinente; o médico pode sempre acrescentar algo fora da previsão do sistema.
