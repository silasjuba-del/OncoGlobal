# Fonte M-X · PLN-020 · 2026-10-07 · material do Dr. Silas (DESIDENTIFICADO)

> **Não é cópia literal.** O original (2 blocos colados, saída de outro chat/LLM) trazia nomes de pacientes e de médico de exemplo no dashboard. Trocados por "Paciente Teste NN" e "Dr. Teste". Todo o resto (fases, tabelas, código, doses de exemplo) foi preservado. As doses, limiares e condutas abaixo são **conteúdo do material colado, não decisão nem verificação do planejamento**.

## Bloco 1 — fluxo em 6 fases (dois médicos)

```
FASE 1: DETECÇÃO (IA)
    ↓
FASE 2: ALERTA + SUGESTÃO (IA)
    ↓
FASE 3: VALIDAÇÃO (Médico A — responsável caso)
    ├─ ☑️ Valida alerta
    ├─ ☑️ Confirma sugestão IA
    └─ Assinatura + CRM
    ↓
FASE 4: PREPARAÇÃO DE MATERIAL (IA) ← NOVO
    ├─ Gera encaminhamento pronto
    ├─ Cria solicitação de exame
    ├─ Drafta internação (se necessário)
    ├─ Estrutura receita + conduta
    ├─ Tudo em formato assinável
    └─ "SUGERE-SE CONDUTA X, MAS FICA A CRITÉRIO..."
    ↓
FASE 5: EXECUÇÃO (Plantonista — autoridade final)
    ├─ Recebe material IA (pronto, mas não executável)
    ├─ [ ] ACEITA → Assina + Executa
    ├─ [ ] REJEITA → Justifica por quê
    ├─ [ ] MODIFICA → Altera conduta, depois assina
    └─ Quem decide: PLANTONISTA
    ↓
FASE 6: LOG RASTREÁVEL
    ├─ IA sugeriu X
    ├─ Médico A validou
    ├─ IA preparou Y
    ├─ Plantonista B executou Z
    └─ Histórico: A→B→Z com justificativas
```

## Bloco 2 — EMERGENCY_ALARM_GENERATION — CRÍTICO

PRINCÍPIO OURO: IA ALERTA + SUGERE | MÉDICO VALIDA + DECIDE

### Arquitetura do sistema

```
INPUT (Gate Control valida)
    ↓
TRIGGER (dados de risco eminente?)
    ↓
IA: Gera ALERTA + Sugere próxima ação
    ↓
MÉDICO: Valida alerta + Aceita/Rejeita sugestão + DECIDE
    ↓
OUTPUT: Conduta executada (apenas se médico autorizar)
    ↓
LOG: Rastreabilidade 100% (quem decidiu, quando, por quê)
```

### Camada 1 — trigger de emergência (valores críticos)

```python
EMERGENCY_TRIGGERS = {
  # ONCOLOGIA IMEDIATA
  "COMPRESSÃO_MEDULAR": {
    "radiologia": ["efeito massa raiz nervosa", "compressão medular",
                   "estenose canal >50%", "déficit sensitivo"],
    "urgência": "CRÍTICA (horas)",
    "risco": "Paraplegia irreversível"
  },

  "SÍNDROME_MEDIASTINAL": {
    "radiologia": ["massa mediastinal >50% diâmetro tórax",
                   "derrame pericárdio >1cm", "tamponamento cardíaco"],
    "urgência": "CRÍTICA (minutos-horas)",
    "risco": "Insuficiência cardiorrespiratória"
  },

  "METÁSTASE_CEREBRAL_COM_EDEMA": {
    "radiologia": ["lesão cerebral + edema vasogênico",
                   "efeito massa midline shift"],
    "urgência": "CRÍTICA (horas)",
    "risco": "Herniação cerebral, óbito"
  },

  "OBSTRUÇÃO_VIAS_AÉREAS": {
    "radiologia": ["tumor laringe/faringe >70% luz",
                   "estridor clínico"],
    "urgência": "CRÍTICA (minutos-horas)",
    "risco": "Asfixia"
  },

  # METABÓLICAS
  "HIPERCALCEMIA_SEVERA": {
    "lab": ["Ca >14 mg/dL", "Ca ionizado >7 mg/dL"],
    "urgência": "CRÍTICA (horas)",
    "risco": "Arritmia cardíaca, óbito"
  },

  "HIPONATREMIA_SEVERA": {
    "lab": ["Na <120 mEq/L"],
    "urgência": "CRÍTICA (minutos-horas)",
    "risco": "Convulsão, edema cerebral, óbito"
  },

  "LEUCOSTASE": {
    "lab": ["WBC >200K + sintomas SNC", "VIS >4"],
    "urgência": "CRÍTICA (horas)",
    "risco": "AVC hemorrágico"
  },

  # INFECTOLOGIA
  "SEPSE_ONCOLÓGICA": {
    "lab": ["Febre >38.5°C + Neutropenia <500 + Hemoinsufi"],
    "urgência": "CRÍTICA (horas)",
    "risco": "Choque séptico, óbito"
  },

  "NEUTROPENIA_FEBRIL": {
    "lab": ["Febre >38°C + ANC <500"],
    "urgência": "ALTA (horas)",
    "risco": "Progressão a sepse"
  },

  # TÓXICO-TERAPÊUTICA
  "SÍNDROME_LISE_TUMORAL": {
    "lab": ["K >6.5", "PO4 >10", "ácido úrico >13", "Cr dobrada"],
    "urgência": "CRÍTICA (horas)",
    "risco": "Arritmia, IRA irreversível"
  },

  "TROMBOSE_VENOSA": {
    "radiologia": ["TVP bilateral", "EP com RVP elevada"],
    "urgência": "CRÍTICA (horas-dias)",
    "risco": "Morte súbita"
  },

  # HEMATOLÓGICA
  "COAGULOPATIA_DIC": {
    "lab": ["Plaq <50K + TP/TT prolongado + Fibrinogênio <100"],
    "urgência": "CRÍTICA (horas)",
    "risco": "Hemorragia catastrófica"
  },

  "HEMORRAGIA_GI_SEVERA": {
    "clinica": ["hematemese + instabilidade hemodinâmica"],
    "urgência": "CRÍTICA (minutos-horas)",
    "risco": "Choque hipovolêmico, óbito"
  },
}
```

### Camada 2 — template de alerta emergencial

```markdown
# 🚨 ALERTA EMERGENCIAL — [SEVERIDADE]

**Paciente:** [Nome, DN, CPF]
**Data/Hora Detecção:** [ISO 8601]
**Documento Origem:** [Radiologia/Lab/Clínica + data]

---

## SITUAÇÃO CRÍTICA DETECTADA

**Achado:** [Descrição técnica exata do que IA leu]
**Trigger Acionado:** [Nome do trigger da matriz]
**Risco Imediato:** [Complicação esperada em horas/minutos]
**Prognóstico se NÃO intervir:** [Desfecho adverso esperado]

**Valores/Evidência:**
| Campo | Valor | Crítico? |
|-------|-------|----------|
| Achado 1 | 24 mm | ✅ YES |
| Achado 2 | >50% | ✅ YES |

---

## SUGESTÃO DE IA (NÃO-VINCULANTE)

**Próxima Ação Recomendada:**
1. Exame: [TC emergencial / Endoscopia / Punção / Lab urgente]
2. Prioridade: Hoje / Próximas 2-4h / Próximas 24h
3. Justificativa: [Por quê este exame, não outro]
4. Conduta Paralela: [Suporte enquanto aguarda — O2, hidratação, anticonvulsivante, etc]

**Alternativas Consideradas:**
- Opção A: [Exame], razão: [...]
- Opção B: [Conduta], razão: [...]

---

## ⚠️ VALIDAÇÃO MÉDICA (OBRIGATÓRIA)

**Médico Responsável:** [Nome, CRM, assinatura]
**Data/Hora Validação:** [ISO 8601]

**[ ] Concorda com alerta?**
  - [ ] SIM — Prosseguir sugestão IA
  - [ ] SIM — Mas com modificação: [detalhe]
  - [ ] NÃO — Por quê: [razão clínica]

**Conduta Final Decidida (por médico):**
- [ ] Aceita sugestão IA (exame X, urgência Y)
- [ ] Rejeita sugestão, fará: [outra conduta]
- [ ] Esperar/observar (clínica resolutiva?)
- [ ] Refer. especialista emergencial: [para onde, por quê]

---

## 📞 ESCALAÇÃO (se necessário)

**Se médico não valida em <30 min e risco CRÍTICO:**
- [ ] Notificar enfermagem
- [ ] Notificar diretor/coordenador oncologia
- [ ] Ativar protocolo emergência hospitalar
- [ ] Registrar recusa/atraso validação (rastreabilidade)

---

## 🔒 LOG & RASTREABILIDADE

**Quem:** IA (detectou) → Médico (validou) → [Executor da conduta]
**Quando:** [Timeline de eventos]
**Por quê:** [Racional de cada decisão]
**Resultado:** [Desfecho: exame feito / conduta aplicada / resultado]

**Cancelamento de Alerta:**
- [ ] Resolvido (qual foi a ação?)
- [ ] Falso positivo (por quê?)
- [ ] Mudança de status (paciente melhorou)

---
```

### Camada 3 — matriz de sugestões (IA propõe)

**Compressão medular:**

```
IA ALERTA: "Efeito massa L4 sobre raiz nervosa"

SUGESTÃO IA:
┌────────────────────────────────────┐
│ PRÓXIMO EXAME: MRI dinâmica pelve  │
│ URGÊNCIA: HOJE (próximas 2-4h)     │
│ RAZÃO: Definir grau compressão,    │
│        confirmar síndrome medular   │
│        antes de RT urgente         │
├────────────────────────────────────┤
│ CONDUTA PARALELA (enquanto aguarda)│
│ - O2 se necessário                 │
│ - Dexametasona 4 mg q6h            │
│ - Vigilância déficit motor         │
│ - Aviso RT (standby emergencial)   │
└────────────────────────────────────┘

ALTERNATIVAS:
  • CT espiral rápido (se MRI não disponível hoje)
  • Mielografia (se contraind. MRI, menos ideal)

MÉDICO VALIDA:
  ☑️ SIM → pedir MRI hoje, chamar neuro
  ☐ NÃO → "vou observar 24h, se piora vem"
  ☐ MODIFICAÇÃO → "MRI, mas amanhã (está estável)"
```

**Hipercalcemia severa (Ca 14.2):**

```
IA ALERTA: "Hipercalcemia CRÍTICA (14.2 mg/dL)"

SUGESTÃO IA:
┌────────────────────────────────────┐
│ PRÓXIMO EXAME: ECG + ecocardiografia
│ URGÊNCIA: AGORA (minutos-30min)    │
│ RAZÃO: Risco arritmia potencial    │
│        letal; ecocardia para       │
│        avaliar função cardíaca     │
├────────────────────────────────────┤
│ CONDUTA PARALELA (EMERGENCIAL)     │
│ - Hidratação agressiva (SF 0.9%)   │
│ - Monitorização cardíaca contínua  │
│ - Diurético (após hidratar)        │
│ - Análogo cálcitonina IV           │
│ - Acesso central para drogas       │
│ - Chamar Clínica Médica + ICU      │
└────────────────────────────────────┘

MÉDICO VALIDA:
  ☑️ SIM → ativa protocolo Ca alto, UTI
  ☐ NÃO → "vou manejar com FC, sem UTI"
  ☐ MODIFICAÇÃO → "hidrata, mas na enfermaria"
```

**Metástase cerebral + edema:**

```
IA ALERTA: "Lesão cerebral múltipla + edema vasogênico"

SUGESTÃO IA:
┌────────────────────────────────────┐
│ PRÓXIMO EXAME: RM crânio dinâmica  │
│ URGÊNCIA: HOJE (próximas 4-6h)     │
│ RAZÃO: Definir volume, edema,      │
│        localização para RT urgente │
├────────────────────────────────────┤
│ CONDUTA PARALELA (enquanto aguarda)│
│ - Dexametasona 4 mg q6h COMEÇAR JÁ│
│ - Anticonvulsivante (Levetiracetam)
│ - Vigilância neuroló contínua      │
│ - Aviso RT (standby emergencial)   │
│ - Considerar ICU se edema severo   │
└────────────────────────────────────┘

ALTERNATIVAS:
  • CT emergencial rápido (se RM indisponível)
  • Neurocirurgia se hidrocefalia obstrutiva

MÉDICO VALIDA:
  ☑️ SIM → RM hoje, começa dexametasona
  ☐ NÃO → "foi coincidência, não trato meta"
```

### Camada 4 — fluxo de validação

```
IA DETECTA TRIGGER
    ↓
[AUTOMÁTICO] Gera ALERTA + Propõe sugestão
    ↓
[AUTOMÁTICO] Notifica médico (SMS/App/Pop-up)
    ↓
MÉDICO VALIDA (checkbox obrigatório)
    ├─ ☑️ Aceita → Executa sugestão IA
    ├─ ☑️ Modifica → Executa outra coisa (autorizado por médico)
    └─ ☑️ Rejeita → Registra razão clínica (rastreabilidade)
    ↓
[AUTOMÁTICO] Sistema executa apenas o que médico autorizou
    ↓
[AUTOMÁTICO] Log: IA sugeriu X, médico fez Y, resultado Z
```

### Camada 5 — SLA

| Severidade | Validação exigida | Ação executada | Escalação |
|---|---|---|---|
| **CRÍTICA** | <30 min | Imediato | Se >30min sem validação, avisar coordenador |
| **ALTA** | <2 horas | Próximas 2-4h | Se >2h, reminder ao médico |
| **MÉDIA** | <24 horas | Próximas 24h | Registrar se não fez em 24h |
| **BAIXA** | <7 dias | Próximas 1-2 sem | Não há escalação |

### Camada 6 — governança e rastreabilidade

```typescript
interface EmergencyAlert {
  id: string; // UUID único
  patientId: string;
  createdAt: ISO8601;
  trigger: EmergencyTriggerType;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

  // IA Component
  aiDetection: {
    timestamp: ISO8601;
    document: string;
    evidence: string[];
    suggestedExam?: string;
    suggestedConducta?: string[];
    alternatives?: string[];
  };

  // Médico Validation
  medicalValidation: {
    doctorName: string;
    doctorCRM: string;
    validatedAt?: ISO8601;
    decision: "ACCEPT" | "REJECT" | "MODIFY";
    reasonIfReject?: string;
    modifiedConducta?: string;
    signature: string;
  };

  // Execution
  execution: {
    executedAt?: ISO8601;
    whatWasDone: string;
    executedBy: string;
    outcome?: string;
  };

  // Escalation (if needed)
  escalation?: {
    escalatedAt?: ISO8601;
    escalatedTo: string;
    reason: string;
  };

  // Closure
  closedAt?: ISO8601;
  closureReason: "RESOLVED" | "FALSE_POSITIVE" | "ABANDONED";
}
```

### Camada 7 — dashboard médico (DoctorOS)

```
🚨 ALERTAS EMERGENCIAIS (em tempo real)

┌─────────────────────────────────────────────────────┐
│ 🔴 CRÍTICA — Paciente Teste 01                      │
│    Compressão Medular L4 — 23 min atrás             │
│    IA sugere: MRI hoje + RT urgente                 │
│    [ VALIDAR ]  [ REJEITAR ]  [ MODIFICAR ]         │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ 🟠 ALTA — Paciente Teste 02                         │
│    Hipercalcemia 14.2 — 15 min atrás                │
│    IA sugere: Hidratação emergencial + ECG          │
│    ✅ Validado por Dr. Teste 10 min atrás           │
│    Status: Hidratação iniciada                      │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ 🟡 MÉDIA — Paciente Teste 03                        │
│    Nódulo Pulmonar 1.2 cm — 2h atrás                │
│    IA sugere: CT tórax em 7 dias                    │
│    [ VALIDAR ]  [ REJEITAR ]  [ MODIFICAR ]         │
└─────────────────────────────────────────────────────┘
```

### Regra de ouro

```
IA FAZ: Detecta + Alerta + Sugere
MÉDICO FAZ: Valida + Decide + Autoriza

NENHUMA AÇÃO AUTOMÁTICA SEM VALIDAÇÃO MÉDICA
```

### Checklist de implementação

```
□ Sistema detecta triggers (matriz completa)
□ Alerta gerado automaticamente com sugestão IA
□ Médico recebe notificação (SMS/App/Pop-up)
□ Médico valida (aceita/rejeita/modifica)
□ Sistema executa APENAS o autorizado
□ Log 100% rastreável (quem, quando, por quê)
□ SLA respeitado (escalação se >30min CRÍTICA)
□ Dashboard médico em tempo real
□ Nenhuma suposição de autorização
□ MÉDICO SEMPRE TEM PALAVRA FINAL
```
