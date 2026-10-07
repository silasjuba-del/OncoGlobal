# Modelo 09 · Solicitação de exame (folha impressa)

> Fonte: HTML gerado anteriormente (Dr. Silas, 2026-10-06). **Nome da paciente retirado.** Original em `Downloads\06_Desenvolvimento_Web_e_Prompts_UI\`.

## Layout
- Cabeçalho azul-marinho `#1B365D`: instituição (configurável, D-W5-03/D-W9-10) + linha secundária.
- Título com sublinhado dourado `#B8860B`; corpo em serifada (Georgia), bloco com borda esquerda dourada.
- Linha de assinatura centralizada: nome · CRM · RQE (perfil do médico).
- Rodapé: instituição/cidade · data e hora de emissão. Botão "Imprimir / Salvar PDF" oculto na impressão (`@media print`).

## Corpo
```
Paciente: {{NOME}}
Solicito: {{exame}}
Indicação: {{indicacao}}          ← padrão: "controle/estadiamento oncológico conforme diagnóstico e conduta médica"
Código SUS: {{sigtap}}            ← do SIGTAP da competência (D-W9-11); sem código = "conferir no faturamento"
```
Regras: texto acentuado (o original saiu sem acentos); código SIGTAP nunca inventado; um exame por folha ou lista agrupada `[VERIFICAR]`.
