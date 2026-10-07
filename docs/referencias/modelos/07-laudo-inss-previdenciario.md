# Modelo 07 · Laudo médico para fins previdenciários — INSS

> Fonte: Dr. Silas, 2026-10-06 (DECISAO_MEDICA). Texto fixo mantido; identificação do caso **retirada**. Complementa o Modelo 04 (BPC/LOAS) e o relatório pericial do kit.

## Molde
```
LAUDO MÉDICO PARA FINS PREVIDENCIÁRIOS — INSS

Declaro, para fins de avaliação médico-pericial previdenciária, que {{o(a) paciente}} {{NOME}}, {{idade}} anos, encontra-se em acompanhamento oncológico por {{histologia}} {{sitio_com_lateralidade_e_quadrante}} — CID-10 {{cid}}, {{subtipo_e_biomarcadores}}, {{grau}}, {{ki67}}, estadiamento clínico {{tnm}} — estádio {{estadio}}.

{{O(A)}} paciente encontra-se em {{fase_tratamento}}, em protocolo {{esquema_descrito}}, com {{proximas_etapas}}. Trata-se de tratamento de alta intensidade, prolongado e potencialmente associado a {{toxicidades_do_esquema}} e comprometimento funcional durante sua realização.

[OPCIONAL] Apresenta adicionalmente {{comorbidade_relevante}}, condição que aumenta a complexidade e o risco do tratamento{{, particularmente diante de ...}}, demandando {{acompanhamento}}.

No momento, considero {{o(a)}} paciente incapaz para o exercício regular de suas atividades laborativas durante o tratamento oncológico, necessitando afastamento laboral e reavaliação médico-pericial conforme evolução clínica, resposta ao tratamento, cirurgia e terapias subsequentes.

[BLOCO PERMANENTE — escolher a variante]
(a) curativo / não metastático:
Quanto à aposentadoria por incapacidade permanente: o diagnóstico oncológico, isoladamente, não permite afirmar tecnicamente incapacidade laboral permanente neste momento, pois {{o(a)}} paciente apresenta doença não metastática e está em tratamento com intenção curativa. Recomendo ao INSS avaliação da incapacidade laboral atual e de sua duração, reservando a caracterização de incapacidade permanente para eventual persistência de limitações funcionais após tratamento e reabilitação.
(b) metastático / paliativo: `[VERIFICAR]` texto a escrever pelo Dr. Silas.

CID-10: {{cid}} — {{descricao_cid}}.

{{medico_nome}}
{{medico_crm}}
{{medico_especialidade}}
```

## Regras extraídas
- Incapacidade **temporária** durante o tratamento é afirmada pelo médico; **permanente** não é afirmada em doença não metastática com intenção curativa — fica para a perícia após tratamento e reabilitação.
- A escolha da variante (a)/(b) vem da intenção registrada (curativa × paliativa) e do histórico metastático (`historicalMetastaticDisease`, D-W9-33), sempre confirmada pelo médico.
- Comorbidade relevante entra só se documentada (ex.: FEVE por Simpson com data, valvopatia). Exemplo do caso: FEVE 49% com antraciclina programada.
- `profissão` do cadastro (Modelo 08) ajuda a perícia, mas o laudo não a cita por padrão.
- Ideia de alerta `[VERIFICAR]`: FEVE < 50% com antraciclina ou anti-HER2 programado → ALERTA (limiar de bula a confirmar), nunca bloqueio.
