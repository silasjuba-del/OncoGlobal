# Modelo 10 · Seguimento radiológico pós-tratamento + regra INTERVAL_PROGRESSION

> Fonte: Dr. Silas, 2026-10-06 (DECISAO_MEDICA). Caso real usado só para extrair o padrão; **identificação, idade e datas trocadas** (Paciente Teste 10).

## Molde
```
{{data_registro}} — {{PACIENTE}} — {{sitio_com_lateralidade}}
{{idade}} anos | {{antecedente_oncologico}} | {{cirurgia}} | seguimento radiológico {{periodo}}

FONTES ANALISADAS
* {{data}} — {{método}}: {{achados}}. {{classificação (BI-RADS/…)}}.        ← um item por exame, ordem cronológica

STATUS ONCOLÓGICO
{{por compartimento: local/contralateral · visceral (crânio/tórax/abdome/pelve) · ósseo}}
ÚNICA PENDÊNCIA ONCOLÓGICA RELEVANTE: {{achado}}      ← ou "nenhuma"
Não classificar como metástase neste momento:
`{{sítio}} = INDETERMINADO / SUSPEITO → {{exame dirigido}} recomendada`

SÍNTESE PARA PRONTUÁRIO
{{período}} — Seguimento: {{1 parágrafo}}

PADRÃO LONGITUDINAL
{{data anterior}} — {{sítio}}: {{achado prévio}} → {{data atual}} — mesmo {{sítio}}: {{mudança}} → FLAG: {{flag}} → {{exame dirigido}}

NÃO SEI: {{dados que os documentos não trazem}}. {{regra de identidade/merge}}.
```

## Regras extraídas
1. **INTERVAL_PROGRESSION (regra RADS de código):** mesmo sítio anatômico + mesmo método + aumento em exames seriados ⇒ **elevar suspeição** (ALERTA + exame dirigido), mesmo que cada laudo isolado admita etiologia benigna/degenerativa. Nunca vira "metástase confirmada" sozinho.
2. "Sem M1 visceral identificável nos exames apresentados" ≠ M0: escopo limitado aos exames listados.
3. Status por compartimento (local, contralateral, visceral, ósseo), cada um com fonte.
4. Achado indeterminado recebe exame dirigido (ex.: RM lombar) e entra em pendências.
5. **NÃO SEI** obrigatório: histologia, TNM, RE/RP/HER2, data da cirurgia, tratamento sistêmico — quando ausentes.
6. Sem merge com outro caso do mesmo tumor sem identidade concordante (D-W9-34a).

## Exemplo sintético (Paciente Teste 10)
```
01/01/2030 — PACIENTE TESTE 10 — MAMA DIREITA
60 anos | antecedente de neoplasia mamária direita | mastectomia direita | seguimento radiológico 07–08/2029
FONTES ANALISADAS
* 06/07/29 — MMG: mastectomia direita; mama esquerda sem nódulos/assimetrias, microcalcificações puntiformes benignas; linfonodos axilares de aspecto benigno. BI-RADS 2.
* 17/07/29 — USG mama/axilas: mastectomia direita; mama esquerda e axilas sem alterações suspeitas. BI-RADS 2.
* 15/08/29 — TC tórax: sem linfonodomegalias, sem derrame, sem nódulos suspeitos; alterações pleurais/fibroatelectásicas e degenerativas.
* 15/08/29 — TC abdome/pelve: sem lesões focais hepáticas, adenomegalias ou ascite.
* 15/08/29 — TC crânio: sem lesões expansivas ou realce anômalo; microangiopatia/atrofia.
* 19/08/29 — Cintilografia óssea: foco de hipercaptação em L5 à esquerda, aumentado em relação à CO de 14/05/28; pode ser degenerativo/inflamatório; radiologista recomenda RM. Demais captações degenerativas.
STATUS ONCOLÓGICO
Mama/axila contralateral: sem evidência de recidiva, BI-RADS 2.
TC crânio/tórax/abdome/pelve: sem M1 visceral identificável nos exames apresentados.
ÚNICA PENDÊNCIA ONCOLÓGICA RELEVANTE: foco ósseo em L5, com aumento cintilográfico longitudinal.
`L5 = INDETERMINADO / SUSPEITO → RM lombar recomendada`
PADRÃO LONGITUDINAL
14/05/28 — L5: foco prévio → 19/08/29 — mesmo L5: aumento da captação → FLAG: INTERVAL_PROGRESSION → RM dirigida
NÃO SEI: histologia original, TNM, RE/RP/HER2, data da mastectomia, tratamento sistêmico.
```
Expectativa de teste: FLAG INTERVAL_PROGRESSION em L5 (ALERTA); nenhum M1 gerado; lateralidade "à esquerda" em L5 preservada (D-W9-05); pendências NÃO SEI listadas.
