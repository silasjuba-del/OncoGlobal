# Pedidos da Luna 4 — W10

## Pendente de contrato canônico

1. `RecistAvaliacao` em `src/contracts/w10/clinico-w10.ts` exige soma, baseline, nadir e deltas numéricos e não guarda proveniência por lesão, conjunto estável/elegível de alvos, método/corte/qualidade de medida, episódio ou estado dos não-alvos. Publicar envelope canônico que aceite `avaliacao: null` com pendências preservadas e identifique série, baseline, elegibilidade, órgão, medidas, fontes, tri-state de novas lesões, estado dos não-alvos e proposta não confirmada. A implementação local exige dados explícitos de elegibilidade e qualidade; aplica RC/RP/DE/PD somente quando sustentados pelos componentes disponíveis. RC e PD por evidência explícita podem ter `categoriaGlobal: PROPOSTO` com `avaliacao: null` se o delta de nadir for indefinido; nunca inventar percentual. Baseline zero continua sem categoria.

2. D-W9-42/D-W9-44 autorizam estatística longitudinal por paciente e listam categorias clínicas (idade/sexo, tumor, histologia, lateralidade, TNM, sítios metastáticos, biomarcadores, tratamentos, fármacos, toxicidades, conflitos e alertas). O ledger atual aceita `tipo: string` e `payload: unknown`; `FATO` guarda dado livre. O único esquema clínico tipado confirmado encontrado é `TreatmentAdministration` (`droga` é texto livre); eventos de documento podem ser contados como assinados via `SignatureReference`. Para incluir categorias clínicas, publicar contratos tipados e produtores reais no ledger, valores allowlisted por campo e representação de ausência/conflito/supersessão. Não interpretar `FATO`, texto livre ou identificadores como categoria.

## Integração

- L1 pode consumir `avaliarSerieRecist` de `src/rules/recist/index.ts` e `projetarEstatisticaLedger` de `src/estatistica/index.ts` após integrar os commits desta faixa.
- A entrada RECIST requer `orgaoId`, `elegibilidadeBasal`, `fonteElegibilidadeIds` por alvo e `metodo`, `tecnicaId`, `espessuraCorteMm`, `qualidadeMedicao` por ponto. Categoria global proposta e `avaliacao` numérica são campos distintos.
- A estatística entregue conta pacientes/eventos por classes operacionais fixas, documentos assinados reconhecidos pelo contrato e status de administração tipado; não representa ainda todas as categorias clínicas de D-W9-42.
- Administrações ativas incompatíveis com o mesmo `adminId` são uma pendência conflitada; status e denominadores válidos excluem o grupo até resolução. `administracoesConflito` é contador de grupos conflitantes.
- A projeção recalcula do ledger, ignora eventos supersedidos conforme `supersedesEventId` e não grava contador ou banco paralelo.
