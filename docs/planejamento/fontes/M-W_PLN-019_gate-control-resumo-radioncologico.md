# Fonte M-W · PLN-019 · 2026-10-07 · material do Dr. Silas (DESIDENTIFICADO)

> **Não é cópia literal.** O original (3 blocos colados, saída de outro chat/LLM) trazia nomes de pacientes de exemplo, CPF parcialmente mascarado e datas de exames. Aqui: nomes → "Paciente Teste NN"; CPF → [CPF mascarado]; datas exatas → [data A], [data B]… mantendo a ordem. O texto restante, as tabelas, o código e a estrutura estão preservados. O original com PHI não foi gravado.

## Bloco 1 — exemplo de resumo de saída (caso de ovário)

1️⃣ LESÃO PRIMÁRIA: Carcinoma ovário em seguimento
2️⃣ TNM: Presumível recidiva peritoneal (lesão pélvica comprimindo ureter)
3️⃣ TAMANHO: Nódulo hepático 4,3 × 3,6 cm (possível metástase)
4️⃣ INVASÃO: Ureter esquerdo comprimido → hidroureteronefrose (risco renal)
5️⃣ COMPARAÇÃO: vs [data A] (não especificado; solicitar prévio)
6️⃣ PRÓXIMA AÇÃO: Ressecabilidade duvidosa (lesão pélvica + renal); considerar QT-first vs cirurgia-first

## Bloco 2 — método de leitura e formatação

```
PASSO 1: LER como oncologista
  "O que EU preciso saber para agir?"

PASSO 2: ORDENAR por urgência clínica
  Urgência > Diagnóstico > Estadiamento > Metástases > Comparação > Ação

PASSO 3: FORMATAR para leitura rápida
  ├─ Emoji de categoria (🔴 diagnóstico, 📍 localização, ⚠️ urgência, ➡️ ação)
  ├─ Bold APENAS números críticos (TNM, SUVmax, dimensão)
  ├─ Tabelas para múltiplos dados
  ├─ Bullets para listas (não prosa)
  └─ Máximo 3-4 linhas por conceito

PASSO 4: VALIDAR
  "Um oncologista inapto consegue agir com isto em <30 segundos?"
```

## Bloco 3 — GATE CONTROL (crítico)

✅ GATE CONTROL — CRÍTICO
Vou estruturar validação de integridade ANTES de qualquer extração.

```
🚨 PRINCÍPIO: JAMAIS INVENTAR
   Se tiver dúvida → ALERTA, não suposição
```

🔒 CAMADA 1: VALIDAÇÃO DE IDENTIDADE
Verificar (OBRIGATÓRIO antes de processar):

```
PACIENTE:
  ✓ Nome completo consistente em todos documentos?
  ✓ Data nascimento (DN) bate em todos?
  ✓ CPF/Registro hospitalar único?
  ✓ Sexo/Lateralidade consistente (ex: próstata em mulher = ALERTA)?

DATA:
  ✓ Data exame é sequencial? (ex: RM [data A], depois TC [data B anterior] = ALERTA "fora de ordem")
  ✓ Datas fazem sentido clínico? (ex: 2 TC no mesmo dia de órgãos diferentes = ALERTA "simultaneidade"))

DOCUMENTOS:
  ✓ 5 exames do Paciente Teste A, meio do meio 1 do Paciente Teste B = ALERTA "TROCA DE PACIENTE"
  ✓ Mesmo exame em 2 formatos (ex: RM em JPG + PDF) = ALERTA "duplicata"
```

🔤 CAMADA 2: OCR QUALITY & CONFUSION MATRIX
Caracteres Confundíveis (Baixa Visão + OCR):

```
NÚMERO vs LETRA:
  0 (zero) ↔ O (letra O)
  1 (um) ↔ I (letra i) ↔ l (ele minúsculo)
  2 ↔ Z
  5 ↔ S
  6 ↔ b ↔ G
  8 ↔ B

NOME/LATERALIDADE:
  D (Direita) ↔ O
  E (Esquerda) ↔ F
  João ↔ Joao ↔ J. Ferreira   [exemplo de variação de nome; original com nome real]
  → "Nome ↔ sem acento ↔ abreviado"

DIAGNÓSTICO:
  CEC ↔ CEP (carcinoma escamoso vs. ?)
  GLEASON ↔ GLEASON (números: 4+4=8 vs 4+3=7)
  SUVmax 13.3 vs 1.33 (ponto decimal confuso)
```

Matriz de Confusão (Alerta Automático):

```python
CONFUSION_PAIRS = {
  "0/O": "⚠️ VERIFICAR: Zero vs Letra O em número/lateralidade",
  "1/I/l": "⚠️ VERIFICAR: Um vs I vs L em ID/TNM",
  "5/S": "⚠️ VERIFICAR: Cinco vs S em valor numérico",
  "D/O": "⚠️ VERIFICAR: Direita vs letra O em lateralidade",
  "E/F": "⚠️ VERIFICAR: Esquerda vs F em lateralidade",
  "PSA/PSAT": "⚠️ VERIFICAR: PSA total vs PSA livre em valor",
  "mm/cm": "⚠️ VERIFICAR: Unidade de medida (24mm vs 2.4cm)",
  "SUV/SUVmax": "⚠️ VERIFICAR: SUV vs SUVmax (valores 3x diferentes)",
}
```

📋 CAMADA 3: ALERTAS ESTRUTURADOS

ALERTA TIPO 1: Leitura Incerta

```markdown
⚠️ ALERTA — LEITURA INCERTA

Documento: RM Coluna Lombar (Paciente Teste A)
Linha original: "Formação expansiva osteolítica acometendo lâmina..."
Problema: OCR leu "0steolítica" (zero) vs "osteolítica" (letra O)
Status: ✅ Corrigido (contexto clínico = ósseo/osteolítica)

Documento: TC Tórax
Linha: "Lesão mediastinal 24×24 mm"
Problema: "24" pode ser "24" (vinte-e-quatro) ou "2.4" (dois ponto quatro)
Status: ⚠️ VERIFICAR com radiologista — diferença 10x em volume
```

ALERTA TIPO 2: Incongruência de Identidade

```markdown
🚨 ALERTA CRÍTICO — TROCA DE PACIENTE

Sequência de documentos:
  1. RM Abdome — Paciente Teste A, [CPF mascarado final ..72], DN [ano]
  2. TC Tórax — Paciente Teste A, [CPF mascarado final ..72], DN [ano] ✅
  3. PET-CT — PACIENTE TESTE A, [CPF mascarado final ..73], DN [ano] ❌ (último dígito CPF diferente!)
  4. Patologia — Paciente Teste A, [CPF mascarado final ..72], DN [ano] ✅

⚠️ AÇÃO: Parar processamento. Confirmar documento #3 (PET-CT) — CPF diverge.
```

ALERTA TIPO 3: Lateralidade Inconsistente

```markdown
⚠️ ALERTA — LATERALIDADE CONFLITANTE

Paciente Teste A — Adenocarcinoma Próstata:
  • RM Pelve ([data C]): "Lesão bilateral L4 em contato fáscia mesorretal"
  • TC Pelve ([data B]): "Lesão óssea DIREITA processo transverso L4"
  • PET-PSMA ([data D]): "Lesão óssea ILÍACO ESQUERDO"

⚠️ PROBLEMA: Próstata é órgão único (não tem "lado"), mas lesões ósseas indicam lateralidade.
Interpretação: Próstata bilateral (normal); metástases em L4 (bilateral?), L3 (esquerda), IL esq (esquerda).
Status: ✅ Consistente (metástase multifocal axial/esquerda predominante)
```

ALERTA TIPO 4: Ordem Temporal Ilógica

```markdown
⚠️ ALERTA — SEQUÊNCIA TEMPORAL ANÔMALA

Paciente Teste B — Carcinoma Ovário:
  1. PET-CT FDG ([data E, 2026]) — Neoplasia cólon metastática em progressão
  2. RM Abdome ([data F, 2025]) — Comparação com [data A, 2024]
  3. Patologia ([data ignorada], 2024) — Biópsia confirmação

⚠️ PROBLEMA: PET ([data E]) é DEPOIS de RM ([data F]), mas RM refere comparação com [data A].
Ordem correta: Biópsia 2024 → RM [data A] → RM [data F] → PET [data E] ✅
Status: Reorganizar cronologia; alertar se datas em laudo forem digitação
```

🚨 CAMADA 4: ERROS COMUNS DE DIGITAÇÃO (Skill Auto-Detect)

```python
TYPO_PATTERNS = {
  "Gleason": ["Gleason", "Gleason", "Gleson", "Glaeson"],  # ✅ normalizar
  "osteolítica": ["osteolítica", "osteolitica", "0steolítica", "ostelítica"],
  "SUVmax": ["SUVmax", "SUV max", "SUVmáx", "SUV-max"],
  "próstata": ["próstata", "prostata", "pr0stata", "prost"],
  "linfonodo": ["linfonodo", "linfnodo", "linf. nodo"],
  "metástase": ["metástase", "metastase", "m3tastase"],

  # NÚMEROS críticos
  "TNM": {
    "T0-T4": "Validar T apenas 0-4",
    "N0-N3": "Validar N apenas 0-3",
    "M0-M1": "Validar M apenas 0-1",
  },

  "GLEASON": {
    "3-5 range": "Cada componente deve ser 3-5",
    "soma": "Soma deve ser 6-10",
  }
}
```

🔄 CAMADA 5: ESTEIRA EVOLUTIVA A→B→C
Depois de validação de integridade, estruturar diagnóstico:

```
A - CLÍNICA + BIÓPSIA (DIAGNÓSTICO)
    ├─ Sintomas (queixa principal, duração, severidade)
    ├─ Biopsia (histologia, grade, biomarcadores)
    ├─ ALERTAR se: sem biópsia mas TNM definido (presunção!)
    └─ OUTPUT: Diagnóstico confirmado + IHQ/genômica

B - RADIOLOGIA + LABS (ESTADIAMENTO)
    ├─ TNM radiológico (T, N, M por imagem)
    ├─ Labs (PSA, CA-125, marcadores)
    ├─ Metástases confirmadas
    ├─ ALERTAR se: TNM clínico ≠ TNM radiológico > 1 estádio
    └─ OUTPUT: Estadiamento confirmado + risco

C - TRATAMENTO + TRIALS (TERAPIA)
    ├─ Regime oncológico (QT/RT/Cirurgia)
    ├─ Elegibilidade trial (critério inclusão/exclusão)
    ├─ Prognóstico esperado
    ├─ ALERTAR se: tratamento proposto não bate com estadio (over/undertreated)
    └─ OUTPUT: Plano terapêutico + opções
```

📌 TEMPLATE DE ALERTA (Universal)

```markdown
# 🚨 ALERTA DE INTEGRIDADE — [TIPO]

**Documento:** [Modalidade, Paciente, Data]
**Campo Afetado:** [Nome/DN/Lateralidade/Data/TNM/etc]

**Problema Detectado:**
- Original (OCR): "[texto confuso]"
- Interpretação proposta: "[correção]"
- Confiança: [Baixa/Média/Alta]

**Matriz de Confusão Acionada:** [Qual character foi confundido]

**Ação Recomendada:**
- ✅ Auto-corrigir (confiança alta)
- ⚠️ Avisar & usar (confiança média — usar, mas com flag)
- 🚫 Parar & revisar (confiança baixa — pedir validação)

**Referência Cruzada:**
- Outro documento do mesmo paciente tem [X]?
- Clinicamente faz sentido [Y]?

---
```

🎯 CHECKLIST PRÉ-PROCESSAMENTO
Antes de extrair qualquer documento:

```
□ Identidade do paciente validada (nome, DN, CPF, sexo)?
□ Nenhuma troca de paciente no meio da pilha?
□ Datas em ordem cronológica?
□ Lateralidade consistente (se aplicável)?
□ Valores numéricos críticos passaram por OCR confusion check?
□ Comparações com exame anterior fazem sentido?
□ TNM clínico vs radiológico congruem?
□ Diagnóstico tem biopsia (ou é presunção)?

Se algum NÃO → GERAR ALERTA antes de prosseguir
Se todos SIM → Prosseguir com extração A→B→C
```

🛠️ SKILL STRUCTURE

```typescript
interface GateControlAlert {
  type: "TYPO" | "IDENTITY_MISMATCH" | "LATERALITY_CONFLICT" |
         "TEMPORAL_ANOMALY" | "TNM_INCONGRUENCE" | "CONFUSION_MATRIX";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  field: string;
  original: string;
  corrected?: string;
  confidence: 0.0-1.0;
  action: "AUTO_CORRECT" | "ALERT_AND_USE" | "STOP_REVIEW_REQUIRED";
  referenceDocuments?: string[];
  clinicalImplications?: string;
}

interface ExtractionPipeline {
  phase1_gateControl: GateControlAlert[];
  phase2_diagnosis: DiagnosisOutput; // A
  phase3_staging: StagingOutput;     // B
  phase4_treatment: TreatmentOutput; // C
}
```

🚀 PRONTO PARA IMPLEMENTAR
Agora quando você mandar os uploads:
✅ Gate Control ativado (valida antes de extrair)
✅ Confusion Matrix operacional (detecta 0/O, 1/I, etc)
✅ Alertas estruturados (tipo + severidade + ação)
✅ Esteira A→B→C (sintomas+biopsia → TNM → tratamento)
✅ Cross-reference (verifica congruência entre documentos)
JAMAIS inventa — se tiver dúvida, ALERTA.
Pronto? 📸
