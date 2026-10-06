# Modelo 06 · Laudo médico — solicitação de oxigenoterapia domiciliar

> Fonte: Dr. Silas, 2026-10-06 (DECISAO_MEDICA). Texto fixo mantido; caso usado como exemplo (sem identificação).

## Molde
```
LAUDO MÉDICO — SOLICITAÇÃO DE OXIGENOTERAPIA DOMICILIAR

Declaro, para os devidos fins, que {{o(a) paciente}} encontra-se em acompanhamento em Oncologia Clínica por {{diagnostico_com_grau_e_sitios_metastaticos}}, {{tratamentos_previos}}.

Apresenta {{comprometimento_pulmonar_descrito}}.          ← achados de imagem/pleura/derrame/pleurodese; outros sítios relevantes (ex.: SNC)

Em decorrência do comprometimento pulmonar neoplásico avançado, apresenta insuficiência respiratória/hipoxemia com necessidade de suplementação contínua prolongada de oxigênio, sendo indicada OXIGENOTERAPIA DOMICILIAR PROLONGADA, conforme prescrição abaixo:

PRESCRIÇÃO:
Oxigênio medicinal por {{interface}}          ← cateter nasal (default)
Fluxo: {{fluxo}} litros/minuto
Tempo de utilização: {{horas}} horas por dia
Uso domiciliar contínuo/prolongado, com reavaliação clínica periódica e ajuste conforme saturação periférica, sintomas e evolução da doença.

A oxigenoterapia é necessária para suporte respiratório, controle sintomático e manutenção de oxigenação adequada diante do comprometimento pulmonar decorrente da doença oncológica metastática.

Diagnóstico: {{diagnostico_resumo}}.
Finalidade: suporte respiratório e tratamento da hipoxemia associada à doença pulmonar metastática.

{{medico_nome}}
{{medico_crm}}
{{medico_especialidade}}
```

## Exemplo do Dr. Silas (valores)
Condrossarcoma de membro inferior grau 3, metástases pulmonares/pleurais bilaterais e SNC; amputação prévia, QT e RT; massa peri-hilar esquerda, nódulos bilaterais, derrame com pleurodese. Cateter nasal, **5 L/min, 18 h/dia**.

## Regras e pendências
- Fluxo e horas são **decisão do médico** (campos obrigatórios; vazio = PENDENTE). A IA não sugere fluxo.
- `[VERIFICAR]` com o Dr. Silas/regulação local: programas estaduais/municipais de O2 domiciliar costumam exigir **SpO2 em ar ambiente e/ou gasometria arterial** (PaO2/SatO2) com data. Proposta: campo opcional "SpO2 ar ambiente: __% em __/__/__ · gasometria: PaO2 __ mmHg" exibido se o destino exigir.
- Fluxo alto (≥5 L/min) pode exigir concentrador de maior capacidade ou cilindro: campo "equipamento" `[VERIFICAR]`.
