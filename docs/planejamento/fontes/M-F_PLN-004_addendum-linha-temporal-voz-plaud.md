# Fonte M-F · PLN-004 · 2026-10-07 · texto íntegro do Dr. Silas

> Cópia literal do material enviado pelo Dr. Silas (dados de exemplo sintéticos, sem PHI). Não editar; correções viram nova mensagem na árvore do CHATPLAN.

ADDENDUM FREEZE — LINHA TEMPORAL + TEXTO BRUTO + VOZ + PLAUD

1. QUATRO DATAS FIXAS NA UI
Sempre visíveis no cabeçalho clínico:

```
BIOPSIA           C1D1              ÚLTIMO ESTADIAMENTO       ÚLTIMA QT
12/03/26          28/04/26          10/09/26                  20/09/26
Diagnóstico       Início TTO        Resposta/estado atual     Última exposição
```

Campos canônicos:

```
biopsy_date
c1d1_date
last_staging_date
last_treatment_date
```

`last_staging_date` representa último estadiamento OU reestadiamento, com tipo identificado:

```
STAGING | RESTAGING
```

`last_treatment_date` deve aceitar QT, IO, terapia-alvo etc.; a UI pode mostrar Última QT quando esse for o tratamento vigente.

2. TRÊS FONTES DE ENTRADA DA CONSULTA

```
                 CONSULTA ATUAL

        ┌────────────┼─────────────┐
        ↓            ↓             ↓
     ESCRITA       WHISPER        PLAUD
   texto/manual    realtime      background
        └────────────┼─────────────┘
                     ↓
                   MERGE
                     ↓
             CONSULTA ESTRUTURADA
```

Nenhuma das três fontes substitui as demais.

3. CAIXA DE TEXTO BRUTO — OBRIGATÓRIA
Na Tela do Médico:

```
┌──────────────────────────────────────────────┐
│ COLAR / ESCREVER INFORMAÇÃO CLÍNICA         │
│                                              │
│ [ texto bruto................................]
│                                              │
│                         [ PROCESSAR TEXTO ]  │
└──────────────────────────────────────────────┘
```

Pode receber:

* evolução anterior;
* resumo produzido pelo ChatGPT;
* laudo;
* anotação médica;
* texto copiado de prontuário;
* resumo longitudinal;
* saída da Skill.

4. FLUXO SKILL → APP

```
TEXTO CLÍNICO BRUTO
        ↓
SKILL / LLM
        ↓
FORMATO CANÔNICO DE IMPORTAÇÃO
        ↓
COPIAR
        ↓
COLAR NO APP
        ↓
PARSER
        ↓
DISTRIBUIÇÃO AUTOMÁTICA NOS CAMPOS
        ↓
CHECKLIST DE REVISÃO
```

A Skill não deve gerar prosa livre diferente a cada execução.
Ela deve gerar sempre o mesmo contrato estrutural.

5. CONTRATO DE IMPORTAÇÃO
Exemplo simplificado:

```
CLINICAL_IMPORT_V1

[DIAGNOSTICO]
orgao: COLON
histologia: ADENOCARCINOMA
estagio: III
biomarcadores: MSS; RAS_WT; BRAF_WT

[DATAS]
biopsia: 12/03/2026
c1d1: 28/04/2026
ultimo_reestadiamento: 10/09/2026
ultima_qt: 20/09/2026

[TRATAMENTO_ATUAL]
regime: CAPOX
ciclo: 3/4

[ESTADO_ATUAL]
ecog: 1
sintomas: fadiga
toxicidades: neuropatia G2 persistente

[LABS]
hb: 11.2
anc: 1200
creatinina: 1.4
clcr: 28

[RADS]
ultimo_exame: TC TAP
data: 10/09/2026
resposta: doença estável

[PENDENCIAS]
- revisar função renal
- avaliar neuropatia

[TEXTO_LIVRE]
...
```

Regra:
campo ausente permanece vazio. A IA não inventa para completar o formulário.

6. DISTRIBUIÇÃO NA UI
Após colar:

```
CLINICAL_IMPORT_V1
        ↓
APP PARSEIA
        ↓
┌─ Diagnóstico
├─ Estadiamento
├─ Biomarcadores
├─ Linha temporal
├─ Tratamento
├─ Labs
├─ Rads
├─ Sintomas
├─ Toxicidades
├─ Pendências
└─ Texto livre
```

Cada campo importado recebe origem:

```
SOURCE: LLM_IMPORT
STATUS: NEEDS_REVIEW
```

Nada vira `CONFIRMED` apenas por ter sido importado.

7. O RESUMO VIRA O ROTEIRO DA CONSULTA
Depois da importação:

```
RESUMO ESTRUTURADO
        ↓
CHECKLIST
        ↓
ROTEIRO FLEXÍVEL DA CONSULTA
```

Exemplo:

```
CONSULTA — RETORNO EM TRATAMENTO

✓ Diagnóstico / estágio
✓ Tratamento atual
✓ Ciclo atual

□ Como passou desde último ciclo?
□ Sintomas novos?
□ Toxicidades?
□ MUC / novas medicações?
□ Labs
□ Imagem recente?
□ Resposta
□ Conduta
□ Pedidos
□ Retorno
```

Esse checklist orienta, mas não obriga sequência rígida.

8. WHISPER — TEMPO REAL
Durante a conversa:

```
PACIENTE ↔ MÉDICO
        ↓
WHISPER
        ↓
TRANSCRIÇÃO REALTIME
        ↓
INTENT / COMANDO
        ↓
ATUALIZA CHECKLIST / CLUSTER / DRAFT
```

Exemplo:
“Ela está com anemia.”

```
→ abre CLUSTER ANEMIA
→ nenhuma conduta selecionada
```

“Vou pedir ferritina, B12 e ácido fólico.”

```
→ marca os três exames
→ prepara REQUEST_LAB_DRAFT
```

9. PLAUD — SEGUNDO PLANO
Plaud não deve comandar a consulta em tempo real.
Função:

```
PLAUD
→ captura longitudinal passiva
→ transcrição posterior
→ complementa informações perdidas
→ reconcilia com Whisper + escrita
```

Fluxo:

```
WHISPER realtime
+
ESCRITA / TEXTO COLADO
        ↓
MERGE 1

PLAUD posteriormente
        ↓
MERGE 2 / FINAL
```

10. HIERARQUIA DO MERGE
Quando houver informações repetidas:

```
MÉDICO EDITADO/CONFIRMADO
        >
ORDEM VOCAL EXPLÍCITA
        >
TEXTO ESTRUTURADO IMPORTADO
        >
WHISPER EXTRAÍDO
        >
PLAUD EXTRAÍDO
```

Mas nenhuma fonte deve apagar silenciosamente outra.
Conflitos devem aparecer:

```
⚠ CONFLITO

Whisper: C1D1 = 28/04/2026
Texto importado: C1D1 = 30/04/2026

[ 28/04 ] [ 30/04 ] [ OUTRO ]
```

11. FLUXO COMPLETO

```
ANTES DA CONSULTA

texto bruto
    ↓
Skill / LLM
    ↓
CLINICAL_IMPORT_V1
    ↓
colar no app
    ↓
campos preenchidos
    ↓
checklist preparado


DURANTE A CONSULTA

PACIENTE ↔ MÉDICO
      ↓
WHISPER realtime
      ↓
comandos + temas
      ↓
clusters / campos / drafts


EM PARALELO

PLAUD
↓
captura integral


FINAL

IMPORTAÇÃO
+
WHISPER
+
ESCRITA MANUAL
+
PLAUD
      ↓
MERGE
      ↓
MÉDICO REVISA
      ↓
EVOLUÇÃO + PEDIDOS + RECEITAS
+ ENCAMINHAMENTOS + RETORNO
      ↓
FINALIZAR CONSULTA
```

REGRA CONGELADA
ESCRITA estrutura. Whisper opera. Plaud recupera. Médico valida.
E as 4 datas — biópsia, C1D1, último staging/restaging e último tratamento — permanecem visíveis durante toda a consulta.
Eu acrescentaria depois apenas um marcador visual importante: dias desde C1D1, dias desde último tratamento e dias desde último reestadiamento podem ser calculados automaticamente, porque são dados temporais objetivos e úteis sem adicionar decisão clínica.
