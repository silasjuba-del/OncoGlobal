# KB ACR × emergências oncológicas · gate F2_CANDIDATE (D-W9-70)

> Espelho operacional da auditoria ACR v2. **Sem PHI.** Não substitui o PDF ACR nem a decisão do médico.

## Papel no fluxo
| Camada | O que faz | O que NÃO faz |
|---|---|---|
| **ACR (este KB)** | Sinaliza exame candidato (`F2_CANDIDATE`) a partir de variante/rating | Não fecha emergência no laudo; não bloqueia salvar |
| **RADS cadeias** (`rads-emergencias.v1.json`) | Alerta no texto do laudo (D-W9-51/68) | Não escolhe modalidade ACR |
| **Médico** | Confirma alerta + pede exame | — |

## Fonte canônica
- Tabela completa e status: [`AUDITORIA-ACR-v2.md`](./AUDITORIA-ACR-v2.md) + [`AUDITORIA-ACR-v2.csv`](./AUDITORIA-ACR-v2.csv)
- Ratings: PDFs ACR Appropriateness Criteria (links na auditoria)
- Regra dura da auditoria: sem fonte = **UNKNOWN**; nada estimado

## Resumo de status (v2)
- CONFIRMED 12 · CONFIRMED-PROXY 7 · PARTIAL 4 · DIVERGENT 5 · NO_ACR_TOPIC 7
- Só 2 variantes principais citam câncer/malignidade de forma explícita (#1 compressão; #13 fratura)
- Divergências relevantes para o consultório: metástase cerebral/herniação; derrame pleural maligno (US vs TC); aspergilose; cauda equina; outros na § tabela da auditoria

## Regras de implementação (F2_CANDIDATE)
1. Entrada = apresentação clínica / hipótese (não o laudo completo).
2. Saída = `{ statusAcr, topicId?, variante?, procedimentoUa?, candidato: boolean }` — `candidato=true` só se status ∈ {CONFIRMED, CONFIRMED-PROXY, PARTIAL} **e** modalidade proposta é UA na variante.
3. DIVERGENT / NO_ACR_TOPIC / UNKNOWN ⇒ `candidato=false` + motivo; UI mostra “sem apoio ACR fechado” (alerta, não bloqueio).
4. Semáforo de **laudo** continua só no detector RADS; ACR não vira semáforo de emergência no texto.

## Índice rápido (emergência local → item auditoria)
| Linha RADS (catálogo) | Item auditoria (aprox.) | Nota |
|---|---|---|
| 1 compressão medular | #1 | PARTIAL |
| 2 VCS | #2 | CONFIRMED |
| 3 herniação | #5 | DIVERGENT |
| 4 cauda equina | #29 | DIVERGENT |
| 7 uropatia | #11 | CONFIRMED-PROXY |
| 15 TEP | (tórax vascular) | ver CSV |
| 22 tiflite | #9 | PARTIAL |
| 27 fratura | #13 | CONFIRMED |
| 28 pneumonite imuno | (tórax) | ESMO: TC não diagnostica colite/imuno sozinha — exame ≠ diagnóstico |
| 30 derrame maligno | #20a | DIVERGENT |
| 31 pneumotórax hipertensivo | #20b | NO_ACR_TOPIC |

## Gate de aprovação
- Código que emite `F2_CANDIDATE` deve importar só status/ratings já auditados (CSV/MD), nunca scraped em runtime sem registro.
- Qualquer mudança de mapping = decisão D-W9 nova + teste adversarial (spoofing de status).
