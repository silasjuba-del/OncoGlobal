# Modelo 02 · Resumo de ensaio clínico (uma frase)

> Fonte: Dr. Silas, 2026-10-06 (DECISAO_MEDICA). Exemplo canônico abaixo, conferido aritmeticamente.

## Exemplo do Dr. Silas
KEYNOTE-522 — O estudo comparou pembrolizumabe associado à quimioterapia versus quimioterapia isolada, demonstrando superioridade com aumento absoluto de pCR de 13,6%, melhora da EFS em 5 anos (ganho absoluto de 9%; HR 0,65) e ganho de OS em 5 anos (ganho absoluto de 4,9%; HR ≈ 0,66).

## Molde
`{{TRIAL}} — O estudo comparou {{braco_experimental}} versus {{braco_controle}}, demonstrando {{resultado}} com {{desfecho_1}}, {{desfecho_2}} e {{desfecho_3}}.`

- `resultado` ∈ superioridade | não inferioridade | ausência de benefício (negativo) — vem do desfecho primário.
- Cada desfecho: `{{verbo}} de {{SIGLA}}[ em {{N}} anos] (ganho absoluto de {{X}}%; HR {{Y}})`.
  - Taxa (pCR, ORR): só ganho absoluto em pontos percentuais.
  - Tempo-evento (EFS, DFS, PFS, OS): landmark em anos + ganho absoluto + HR.
  - `≈` quando o HR é aproximado ou lido de gráfico/fonte secundária.
- Ordem: desfecho primário primeiro, depois secundários relevantes (OS por último).
- Siglas em inglês como o Dr. Silas usa (pCR, EFS, OS, PFS, DFS).
- Desfecho não significativo: escrever "sem diferença significativa" e nunca "ganho".
- Números vêm só da tabela de desfechos validada (`desfechos*.csv`); faltando número = `[VERIFICAR]`, nunca estimado. A IA monta a frase; não escolhe conduta a partir dela.

## Conferência do exemplo
pCR 64,8% × 51,2% = +13,6 · EFS 5 a 81,2% × 72,2% = +9,0 (HR 0,65) · OS 5 a 86,6% × 81,7% = +4,9 (HR 0,66).
