# W10-INT-GATES · progresso

| Fatia | Estado | Commit | Conteúdo |
|---|---|---|---|
| 01 | FEITA | W10-INT-GATES-01 | G-07 `g07Lateralidade` + `src/kernel/harness/gates-tabelas.ts` (tabelas D-W9-05/06/07 como dados) |
| 02 | FEITA | W10-INT-GATES-02 | G-08 `g08AnatomiaSexo`, G-09 `g09PtDeBiopsia`, G-27 `g27SaidaExternaLimpa` + `src/kernel/llm/sanitizador.ts` (reexportado por `desidentificar.ts`, que é onde o teste adversarial procura) |
| 03 | FEITA | W10-INT-GATES-03 | CODEX-07: PASSA silencioso em G-02/03/05/10/13/14/25/26 (testes em `tests/w10-int-gates/`, vermelhos antes) |

Decisões de implementação
- `Veredito.decisao` ganhou `"PENDENTE"` (ausente = PENDENTE, nunca PASSA). Só `gates.ts` consome o tipo.
- G-08: mama fora da tabela (D-W9-06); mama x M devolve PENDENTE ("conferir"), sem acusar incoerência, porque o teste adversarial exige não-PASSA.
- G-09: peça reconhecida por `specimen` tipado ou por laudo (identificação de peça + um de dimensões/peso/margens/linfonodos). `yp` segue a regra do `p`; `r`/`a` ficam PENDENTE (conferir).
- G-27: sem relatório, risco ALTO, versão ausente, destino ausente ou metadado de identificação presente = BLOQUEIA_SAIDA. Sanitizador só trata PDF (/Info + XMP, offsets preservados); /ObjStm, criptografia, IMAGEM, DICOM e pixel => risco ALTO com `[VERIFICAR]` (nada fingido).

## CODEX-07 · achados (arquivo `src/kernel/harness/gates.ts`)
| Gate | Antes | Depois |
|---|---|---|
| G-02 | payload não-string lançava / passava | BLOQUEIA_SAIDA |
| G-03 | CRM "   " assinava | BLOQUEIA_AUTORIDADE |
| G-05 | VERDE com pendências undefined/NaN passava | ALERTA |
| G-10 | origem ausente/desconhecida com dose passava | BLOQUEIA_AUTORIDADE (só FUNCAO_PURA é confiável) |
| G-13 | intenção vazia passava / lançava | PENDENTE |
| G-14 | campos não booleanos passavam | PENDENTE |
| G-25 | escopo vazio/ausente passava | BLOQUEIA_AUTORIDADE |
| G-26 | alvo vazio / origem desconhecida passava | PENDENTE / BLOQUEIA_AUTORIDADE |

## Pendências
- CODEX-06 (ligar gates em `src/app/**`) fora desta faixa: ver `docs/w10/PEDIDOS-INT-GATES.md`.
- Os 4 `.adv.ts` não foram movidos (a config adv só os enxerga em `tests/adv-w8`); mover é decisão do tech lead.
