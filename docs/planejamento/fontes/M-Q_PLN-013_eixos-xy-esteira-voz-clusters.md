# Fonte M-Q · PLN-013 · 2026-10-07 · texto íntegro do Dr. Silas

> Cópia literal, com UMA redação para desidentificação: nomes próprios de pacientes dos exemplos ("Dona Maria", "Seu João") trocados por "Paciente Teste" (marcado [PT]). Não editar.

AGORA OS EIXOS: ATENÇÃO: PRIMEIRO PENSEI EM APENAS X E Y ( EM CRUZ ) = LONGITUDINAL x TRANSVERSAL:

VC TEM QUE ACOPLAR ISSO A VOZ TAMBEM.

FAREMOS ASSIM: ESTEIRA PRÁTICA DO FLUXO:

DIVISÃO POR CLUSTERS ( VERTICAL ) --> FATIAMENTO HORIZONTAL --> PERCURSO ( STEPS _ --> SAIDA = FINALIZA CONSULTA.
CONVERSA PAC- MED (VOZ)

             |

             |

             | ---> (IDENTIFICADO EIXO = PAC EM QT COM ANEMIA) / INICIO DO FLUXO PRATICO ANEMIA

             

QUEM TEM ANEMIA TERA QUE TER: DIETA ADEQUADA + NUTRICIONISTA ( SUGESTAO ALIMENTAR + ENCAMINHAMENTO ) + HMG E PERFIL DE FERRO, B12 + MED: B12, AC FOLICO, FERRO --> A ADMINISTRAÇÃO: VO E EV , LOGO : FERRO VO [ ] FERRO EV [ ] ---> SELECIONA CLICO
  |

  | --> IDENTIFICADO --> INICIA-SE FLUXO ( EX: NEUTROPENIA - CUIDADOS GERAIS + SINAIS DE ALRME +FILGRASTIM 

  |

  |                                  # CADA | = TEMATICA DA CONVERSA ( MEDICO SEGUE UM FLUXO COM ORDEM VOCAL EXPLICITA EX: - "[PT], VEJO AQUI QUE TEM ANEMIA, VAMOS TER QUE VER ISSO". O WHISPER RECONHECE ESTES COMANDO : "[PT] TA NA HORA DE FAZER UM EXAME DE IMAGEM, VOU PEDIR UMA TOMOGRAFIA DO PULMÃO".... ETC

  |

É isso. O eixo correto não é “menu médico”; é esteira de microfluxos clínicos disparados pela conversa.

```
VOZ PACIENTE ↔ MÉDICO
        ↓
WHISPER REALTIME
        ↓
DETECTOR DE INTENÇÃO / TEMA
        ↓
CRIA OU ATUALIZA UM CLUSTER VERTICAL
        ↓
FATIAMENTO HORIZONTAL DO CLUSTER
        ↓
DECISÃO → AÇÕES → DOCUMENTOS
        ↓
AGREGA TUDO
        ↓
FINALIZAR CONSULTA
```

Cada cluster vertical = um problema/necessidade ativa daquela consulta. Não é módulo fixo.

```
                         PERCURSO HORIZONTAL
                detectar → confirmar → avaliar → agir → saída

ANEMIA          | detectada | HMG/ferro/B12 | causa/grau | dieta + med + encaminh. | pedidos/receita
NEUTROPENIA     | detectada | ANC/CTCAE     | risco      | cuidados + G-CSF       | receita/alertas
IMAGEM          | indicada  | sítio/motivo   | modalidade | TC tórax               | solicitação
DIARREIA        | relatada  | grau/duração   | risco      | hidratação + fármacos   | receita/orientação
RETORNO         | necessário| intervalo      | condição   | 21 dias                 | agendamento
```

O ponto importante: cada fala pode abrir, alimentar ou fechar um cluster.

Exemplo real da voz:

“[PT], vejo aqui que a senhora está com anemia. Vamos ter que investigar isso.”

O sistema não imprime nada ainda. Ele cria:

```
CLUSTER: ANEMIA
status: ATIVO
origem: VOZ
evidência: "está com anemia"
pendências:
  □ confirmar Hb/data
  □ classificar gravidade
  □ avaliar ferro/ferritina/TSAT
  □ B12
  □ folato
```

Quando o médico continua:

“Vou pedir hemograma, ferritina, ferro, B12 e ácido fólico.”

O mesmo cluster avança:

```
ANEMIA
[✓] investigação
    Hemograma
    Ferritina
    Ferro / saturação transferrina
    Vitamina B12
    Folato
```

Depois:

“Vou colocar ferro. Vamos fazer endovenoso.”

A UI abre somente a decisão necessária:

```
TRATAMENTO DA ANEMIA

Ferro
○ VO
● EV

Preparação:
[ Ferricarboximaltose ▼ ]

□ Ácido fólico
□ Vitamina B12

[ GERAR MINUTA ]
```

Ou seja: voz navega sem navegar.

Outro cluster nasce durante a mesma conversa
“[PT], seus neutrófilos estão baixos. Precisa tomar alguns cuidados.”

Instantaneamente surge uma segunda linha vertical:

```
NEUTROPENIA
↓
ANC / tendência
↓
CTCAE
↓
Febre? infecção? estabilidade?
↓
Cuidados gerais
+ sinais de alarme
+ considerar filgrastim
↓
ORIENTAÇÃO + RECEITA + ALERTAS
```

Na tela:

```
▼ NEUTROPENIA — ATIVA

ANC 780/mm³        Grau 3

Cuidados
[✓] Higiene das mãos
[✓] Evitar contato com pessoas infectadas

Sinais de alarme
[✓] Febre ≥38 °C
[✓] Calafrios
[✓] Dispneia
[✓] Procurar urgência

Suporte
[ ] Filgrastim
    dose: ______
    duração: ____

[ GERAR ORIENTAÇÃO ] [ GERAR RECEITA ]
```

Imagem funciona igual
Fala:

“[PT], está na hora de fazer um exame de imagem. Vou pedir uma tomografia do pulmão.”

Não abre “módulo radiologia”.

Cria microfluxo:

```
IMAGEM
indicação detectada
     ↓
TC
     ↓
tórax
     ↓
motivo: resposta / estadiamento / seguimento
     ↓
contraste?
     ↓
creatinina/alergia relevante
     ↓
SOLICITAÇÃO DRAFT
```

O médico recebe algo quase pronto:

```
SOLICITO

1. TOMOGRAFIA DE TÓRAX COM CONTRASTE

Motivo:
[●] Avaliação de resposta
[ ] Estadiamento
[ ] Seguimento

Indicação clínica:
[gerada automaticamente]

[ REVISAR ]   [ IMPRIMIR ]
```

Isso muda também a arquitetura do carrossel
O carrossel não deve mostrar “Labs / RADS / Prescrição / Documentos”.

Ele mostra o percurso temporal da consulta:

```
←──────────────── CONSULTA ────────────────→

[ CONTEXTO ]
      →
[ TEMAS DETECTADOS ]
      →
[ DECISÕES ]
      →
[ AÇÕES GERADAS ]
      →
[ FINALIZAÇÃO ]
```

E no centro da tela ficam os clusters vivos:

```
CONSULTA ATUAL

▼ ANEMIA                         4 ações
  investigação → tratamento → dieta → nutrição

▼ NEUTROPENIA                    3 ações
  suporte → sinais de alarme → filgrastim

▼ REESTADIAMENTO                 2 ações
  TC tórax/abdome/pelve → retorno

▼ DOR                            resolvido
  analgesia → orientação
```

Quando o médico muda de assunto verbalmente, não troca de tela.
O cluster anterior recolhe em acordeão e o novo expande.

Isso é exatamente onde acordeão + modal fazem sentido.

FINAL DA CONSULTA
Aqui ocorre o merge de TODOS os clusters:

```
FINALIZAR CONSULTA

EVOLUÇÃO
✓ atualização automática

PEDIDOS
✓ Hemograma + perfil de ferro
✓ Vitamina B12 / folato
✓ TC tórax

PRESCRIÇÕES
✓ Ferro EV
✓ Filgrastim

ENCAMINHAMENTOS
✓ Nutrição

ORIENTAÇÕES
✓ Dieta para anemia
✓ Cuidados neutropenia
✓ Sinais de alarme

RETORNO
✓ 21 dias

DOCUMENTOS
7 itens prontos
[ REVISAR TUDO ]     [ ASSINAR ]     [ IMPRIMIR TUDO ]
```

A arquitetura central, portanto, deve ser:

VOZ → EVENTO → CLUSTER → MICROFLUXO HORIZONTAL → ARTEFATOS → MERGE FINAL DA CONSULTA.

E colocaria uma trava importante: Whisper identifica intenção e prepara ação; não executa decisão clínica silenciosamente. “Vou pedir uma TC” pode gerar REQUEST_EXAM_DRAFT; “ela está neutropênica” pode abrir o cluster, mas filgrastim só entra após seleção/confirmação médica. Isso mantém o princípio “IA faz burocrático; médico decide”.

→ Pergunta cirúrgica: no próximo passo você quer que eu desenhe a taxonomia dos clusters vocais — anemia, neutropenia, dor, náusea, diarreia, mucosite, imagem, labs, encaminhamento, retorno etc. — e para cada um definir frases-gatilho → etapas → opções → saída?
