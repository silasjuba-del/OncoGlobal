# Fonte M-V · PLN-018 · 2026-10-07 · texto íntegro do Dr. Silas

> Cópia literal (sem PHI). Duas mensagens curtas enviadas em sequência logo após M-U (continuação do assunto "extração radioncológica"). Não editar.

## Mensagem 1

📋 ESTRUTURA DE SAÍDA:

```
├─ PATOLOGIA (biopsias, peças cirurgicas)
├─ RADIOLOGIA (TC, RM, RX)
├─ MEDICINA NUCLEAR (PET-CT, Cintilografia, PSMA-PET)
└─ RADIOPATOLOGIA (integração: achados radiológicos + confirmação histológica)
```

## Mensagem 2

```
SKILL 1: radiopath_skill_knowledge
├─ Input: Patologia + Radiologia + Medicina Nuclear (cruzamento)
├─ Output: Diagnóstico integrado (histologia + imagem)
└─ Uso: OncoAssist triagem, confirmação diagnóstica

SKILL 2: daybyday_oncologist_skill ⬅️ NOVA
├─ Input: Resumos de evolução, laudos periciais, encaminhamentos
├─ Output: Timeline clínica + decisões terapêuticas + formalidades
└─ Uso: Documentação diária do médico oncologista
```
