# Fonte M-O · PLN-011 · 2026-10-07 · texto íntegro do Dr. Silas

> Cópia literal, com UMA redação para desidentificação: o nome próprio do paciente do exemplo foi trocado por "Paciente Teste" (regra: nada de nome). Pedido do Dr. Silas no topo: "CORROBORAR ESTE FLUXO". Não editar.

eixo universal não for doença, mas:
EVENTO CLÍNICO → PRIORIDADE → CERTEZA → AÇÃO → ARTEFATO
CATEGORIA	CLASSE	SEÇÃO	TÓPICO / EXEMPLO
PROBLEMA	Sinal / sintoma / dado	Novo · antigo · piora · estável	Dor lombar, anemia, PSA crescente
PRIORIDADE	Imediata · urgente · eletiva	PS · hospital · ambulatório	Encaminhar PS, avaliar hoje, retorno programado
INVESTIGAÇÃO	LAB · RAD · ENDO · PATH	Modalidade	PSA, FA, Ca · RM coluna · colonoscopia · biópsia
TRATAMENTO	Sintomático · específico	MED · CX · RT	Analgesia · antiandrogênico · estabilização · RT antálgica
MED	VO · EV · SC etc.	Família/opção	Enzalutamida, abiraterona, docetaxel etc.
SUPORTE	Orientação · dieta · sinais de alarme	Texto/seleção	Hidratação, nutrição, red flags
ENCAMINHAMENTO	Especialidade · serviço	Motivo	Radioterapia, ortopedia oncológica, PS
FECHAMENTO	Retorno · documento · impressão	Prazo/saída	21 dias, receita, pedido, encaminhamento


O fluxo universal:
SINAL / SINTOMA / ALTERAÇÃO
        ↓
NOVO? PIOROU? DADO NOVO?
        ↓
PRIORIDADE
[ ELETIVO ] [ URGENTE ] [ PS ]
        ↓
CAUSA CONHECIDA?
   ├─ NÃO → INVESTIGAÇÃO
   │        LAB | RAD | ENDO | PATH
   │
   └─ SIM / HIPÓTESE FORTE
            ↓
        TRATAMENTO
        ├─ SINTOMÁTICO
        │    MED / PROC / SUPORTE
        │
        └─ ESPECÍFICO
             MED | CX | RT
        ↓
ENCAMINHAMENTOS + ALERTAS + RETORNO
        ↓
FINALIZAR CONSULTA

No caso do Paciente Teste, o app poderia abrir automaticamente CLUSTER: DOR LOMBAR + PSA EM ASCENSÃO, mas sem concluir progressão. Dentro dele:
DOR LOMBAR / MUDANÇA DE ESTADO

PRIORIDADE
○ Eletivo
○ Urgente
○ PS
⊕ OUTROS [____________]

SINTOMÁTICOS
□ Analgesia
⊕ OUTROS [____________]

INVESTIGAÇÃO
LAB
□ PSA
□ Cálcio
□ Fosfatase alcalina
⊕ OUTROS [____________]

RAD
□ TC coluna lombar
□ RM coluna lombar
⊕ OUTROS [____________]

TRATAMENTO ESPECÍFICO
MED
□ Opções sistêmicas
⊕ OUTROS [____________]

RT
□ Encaminhamento radioterapia
⊕ OUTROS [____________]

CX / PROCEDIMENTO
□ Ortopedia oncológica
□ Avaliação de estabilização
⊕ OUTROS [____________]

SEGURANÇA
□ Sinais de alarme
⊕ OUTROS [____________]

[ GERAR PEDIDOS ] [ GERAR ENCAMINHAMENTOS ]
[ GERAR RECEITA ] [ IMPRIMIR ]

A elasticidade crítica é: qualquer nível aceita ⊕ OUTROS. O médico pode criar inclusive um CLUSTER B manual que o sistema jamais sugeriria: hemorragia → colonoscopia + PS + transfusão, sem quebrar o fluxo.
Eu congelaria uma regra arquitetural: IA reconhece o tema e monta a plataforma provável; médico define gravidade, causalidade, prioridade e decisão final.
