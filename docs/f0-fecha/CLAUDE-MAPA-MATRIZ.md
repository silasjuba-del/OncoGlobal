# Verificação da matriz R-34 · Claude (auditor cruzado, só leitura) · 2026-10-09

Base: `f0/f0f-luna1` (HEAD `8543c33`), `docs/MATRIZ-RASTREABILIDADE-F0.md` (cabeçalho: 183 VERDE · 1 VERMELHO · 106 N-A).

## Resultado
- **As 205 referências de teste das 183 linhas VERDE existem.** Em todas, o arquivo está no ramo e o nome do caso aparece no arquivo. Zero quebradas. Verificação por script: cada `tests/…:nome` foi lido do ramo e o nome procurado no código.
- **A tarefa original ("mapear 107 linhas sem teste") ficou obsoleta.** A L1 já fez esse mapeamento na revisão C2-L1. **Não há lacuna de teste na F0 para o Cursor preencher.**
- **Único VERMELHO: Q50**, o portão de fase (PR revisado + demo). Ele fecha sozinho na Fase D, quando o PR e a demo existirem. Não é falta de teste.

## Defeitos de forma — CORRIGIDO na v2 da reauditoria: itens 1 e 2 NÃO são defeitos (checklist repetido de propósito; D-W9-75 já dividida)
1. **D-W9-80 aparece duas vezes.** A 2ª linha está truncada, com colunas faltando: só "conferir autoridade, writer e etapas…". Remover a duplicata.
2. **D-W9-75 está inteira como F1+ / N-A**, mas tem duas partes:
   - (a) "texto → grau CTCAE sugerido" **já está implementada e provada na F0**: `src/rules/index.ts:avaliarTextoCtcae`, teste `tests/w12-grok/grok-04-texto.test.ts`;
   - (b) a orientação do canal do paciente continua em RASCUNHO.
   Sugestão: dividir em D-W9-75a (F0, VERDE) e D-W9-75b (F2, N-A), como já foi feito com D-W9-22 e D-W9-34.
3. **Consumidor = arquivo de teste** em várias linhas (ex.: D-W9-73, D-W9-74, D-W9-76: "consumidor de teste F0"). Isso é aceito pela convenção da matriz, mas mostra que essas regras ainda não têm consumidor de produção ligado. É informativo, não reprova.

## O que isso muda no plano
- O **Cursor fica sem tarefa de matriz**. Se o Dr. Silas quiser usá-lo na F0, o único candidato concreto é marcar como sintéticos os CPF/CNS de DV válido nos testes (ver `CLAUDE-TRIAGEM-PHI.md`, "Recomendações"). Isso é só comentário em teste, e mexer em `tests/redteam/**` depende da Astra.
- A matriz pode ser integrada assim que a L1 corrigir os itens 1 e 2. Ela não bloqueia a F0.
