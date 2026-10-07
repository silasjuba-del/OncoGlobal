# Modelo 03 · Resumo de alta da radioterapia → prontuário

> Fonte: Dr. Silas, 2026-10-06 (DECISAO_MEDICA). Estrutura extraída de um caso real; **nome, idade, datas e hospital retirados**. Exemplo abaixo é sintético (Paciente Teste 09).

## Molde
```
{{data_registro}} — {{PACIENTE}} — {{sitio}}
{{idade}} anos | Fonte: resumo de alta da Radioterapia — {{servico_rt}}, {{data_documento}}

DIAGNÓSTICO / ESTADIAMENTO
* {{histologia}}, diagnóstico anatomopatológico em {{data_ap}}.
* Documento registra {{tnm_como_escrito}}.          ← literal da fonte; prefixo c/p só se a fonte disser (D-W9-07)
* {{exames_estadiamento}} utilizada(s) no estadiamento{{, sem M1 registrado | , com ...}}.
* CID-10 {{cid}}.

TRATAMENTO RADIOTERÁPICO
* Técnica: {{tecnica}} {{equipamento}}.
* Dose total: {{dose_total}} Gy, {{dose_fracao}} Gy/fração.
* Fases: {{fase_1}}; {{fase_2_boost}}.
* Período: {{inicio}} → {{fim}} {{(previsão de término registrada) se a data for prevista}}.
* Energia: {{energia}}.
* Tolerância: {{tolerancia}} {{interrupcoes}}.
* Na avaliação de {{data_avaliacao}}: {{sintomas_ao_termino}}.

SÍNTESE PARA PRONTUÁRIO
{{linha do tempo em 2–4 linhas: AP → estadiamento informado pelo serviço → RT (dose/frações, volumes, tolerância, estado ao término)}}
FALTA: {{lista de dados ausentes que mudam conduta}}. {{frase sobre o que NÃO pode ser inferido do documento}}.
```

## Regras extraídas
- Seção **FALTA** é obrigatória: lista o que muda conduta e não está no documento (no exemplo de próstata: Gleason/ISUP, PSA inicial, detalhes da cintilografia, ADT). Nada é inferido; ausente = PENDENTE.
- "Documento registra" = TNM literal da fonte; na síntese, o prefixo c é usado porque é estadiamento clínico informado pelo serviço de RT (sem peça cirúrgica).
- Frações = dose total ÷ dose por fração (74 ÷ 2 = 37), calculado por código e conferido com a fonte.
- Data de término "prevista" fica marcada como prevista, nunca como realizada.
- Ausência de M1 no relatório ≠ M0 confirmado: escrever "sem M1 registrado".

## Pendências por sítio (checklist do FALTA) `[VERIFICAR]` com o Dr. Silas
- Próstata: Gleason/ISUP, PSA inicial e nadir, grupo de risco, ADT (sim/não, duração), cintilografia/PSMA.
- Outros sítios: a definir.

## Exemplo sintético
```
01/01/2030 — PACIENTE TESTE 09 — PRÓSTATA
60 anos | Fonte: resumo de alta da Radioterapia — Serviço de RT Teste, 01/01/2030
DIAGNÓSTICO / ESTADIAMENTO
* Adenocarcinoma de próstata, diagnóstico anatomopatológico em 01/06/2029.
* Documento registra T3a N0 M0.
* Cintilografia óssea utilizada no estadiamento, sem M1 registrado no relatório.
* CID-10 C61.
TRATAMENTO RADIOTERÁPICO
* Técnica conformacional em acelerador linear.
* Dose total: 74 Gy, 2 Gy/fração.
* Fases: 50 Gy envolvendo vesículas seminais; boost até 74 Gy em próstata.
* Período: 01/11/2029 → 31/12/2029 (previsão de término registrada).
* Energia: 6 MV.
* Boa tolerância, sem interrupções por toxicidade.
* Na avaliação de 01/01/2030: nega queixas urinárias e intestinais.
SÍNTESE PARA PRONTUÁRIO
01/06/29 — AP: neoplasia de próstata. Estadiamento informado pelo serviço de RT: cT3a cN0 cM0.
01/11–31/12/29 — RT definitiva: 74 Gy/37 frações, vesículas seminais até 50 Gy e próstata até 74 Gy. Bem tolerada, sem interrupções. Ao término, assintomático urinário e intestinal.
FALTA: Gleason/ISUP, PSA inicial, detalhes da cintilografia e informação sobre ADT. Não é possível inferir pelo documento se recebeu bloqueio hormonal concomitante.
```
