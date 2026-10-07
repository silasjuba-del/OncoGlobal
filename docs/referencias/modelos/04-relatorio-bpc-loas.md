# Modelo 04 · Relatório médico para fins de BPC/LOAS

> Fonte: Dr. Silas, 2026-10-06 (DECISAO_MEDICA). Texto fixo mantido; caso real **retirado** (nome da paciente trocado por campo). Exemplo de preenchimento: mama HER2+ em neoadjuvância.

## Molde
```
RELATÓRIO MÉDICO PARA FINS DE BPC/LOAS

Declaro, para fins de avaliação médico-pericial e socioassistencial, que {{o(a) paciente}} {{NOME}} encontra-se em acompanhamento especializado em Oncologia Clínica por {{histologia}} {{sitio_com_lateralidade}} — CID-10 {{cid}}, {{caracteristicas_patologicas}}.          ← grau, invasão angiolinfática, biomarcadores, Ki-67

Apresenta doença {{inicialmente classificada como}} {{estadiamento}}, {{achados_relevantes}}{{, ressalva sobre achados indeterminados}}.          ← achado indeterminado nunca vira metástase confirmada

Encontra-se em {{fase_tratamento}}, tendo recebido {{tratamento_realizado}} ({{sigla_esquema}}), estando programada posteriormente {{proximas_etapas}} conforme planejamento multidisciplinar.

Trata-se, portanto, de paciente com neoplasia maligna ativa, ainda em tratamento antineoplásico e sem conclusão das etapas terapêuticas, sujeita a toxicidades relacionadas ao tratamento, incluindo {{toxicidades_esperadas_do_esquema}}, além da necessidade de comparecimentos frequentes ao serviço oncológico, exames{{, cirurgia}} e tratamento complementar.

Durante esse período, a doença e seu tratamento podem produzir limitação funcional e comprometimento relevante da capacidade para atividades laborais e da participação social, devendo tais repercussões ser avaliadas conjuntamente com as condições socioeconômicas {{do(a) paciente}}.

Emito o presente relatório para subsidiar a avaliação de elegibilidade ao Benefício de Prestação Continuada — BPC/LOAS. A caracterização de impedimento de longo prazo e o preenchimento dos demais critérios legais e socioeconômicos competem à avaliação médico-pericial e social do órgão responsável.

CID-10: {{cid}} — {{descricao_cid}}.

{{medico_nome}}
{{medico_crm}}
{{medico_especialidade}}
```

## Regras extraídas
- Parágrafos 4–6 são **fixos** (texto jurídico-pericial do Dr. Silas): o médico não declara impedimento de longo prazo; isso é da perícia (linguagem que protege o médico e o paciente).
- `toxicidades_esperadas_do_esquema` vem do protocolo (ficha) em uso, nunca inventado: ex. AC→TH = fadiga, astenia, mielossupressão, imunossupressão, náuseas, neuropatia, alopecia, potencial cardiotoxicidade.
- Achado indeterminado (ex.: nódulos pulmonares de 6–7 mm) aparece com a ressalva "não sendo adequado classificá-los isoladamente como doença metastática confirmada".
- Variantes previstas: paciente em tratamento paliativo (doença avançada), em seguimento pós-tratamento com sequelas. `[VERIFICAR]` texto das variantes com o Dr. Silas.
- Observação do tech lead `[VERIFICAR]`: "Mx" não existe no AJCC 8; o app sugere "cM0 com nódulos pulmonares indeterminados" ou mantém o texto do médico (decisão dele).
- Relaciona-se com o relatório pericial do kit (D-W5-05): BPC/LOAS é documento distinto.
