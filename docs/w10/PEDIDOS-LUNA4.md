# Pedidos da Luna 4 — W10

## Pendente de contrato canônico

1. `RecistAvaliacao` em `src/contracts/w10/clinico-w10.ts` exige soma, baseline, nadir e deltas numéricos e não guarda proveniência por lesão, conjunto estável de alvos, eixo de medida, episódio ou estado dos não-alvos. Publicar envelope canônico que aceite `avaliacao: null` com pendências preservadas e identifique série, baseline, alvos, medidas, fontes, tri-state de novas lesões, estado dos não-alvos e proposta não confirmada. A implementação local propõe RC/RP/DE/PD somente quando todas essas entradas estão completas e os percentuais estão definidos; no baseline, dado ausente ou denominador zero, a categoria fica `null`.

2. D-W9-42/D-W9-44 autorizam estatística longitudinal por paciente e listam categorias clínicas (idade/sexo, tumor, histologia, lateralidade, TNM, sítios metastáticos, biomarcadores, tratamentos, fármacos, toxicidades, conflitos e alertas). O ledger atual aceita `tipo: string` e `payload: unknown`; `FATO` guarda dado livre. O único esquema clínico tipado confirmado encontrado é `TreatmentAdministration` (`droga` é texto livre); eventos de documento podem ser contados como assinados via `SignatureReference`. Para incluir categorias clínicas, publicar contratos tipados e produtores reais no ledger, valores allowlisted por campo e representação de ausência/conflito/supersessão. Não interpretar `FATO`, texto livre ou identificadores como categoria.

## Integração

- L1 pode consumir `avaliarSerieRecist` de `src/rules/recist/index.ts` e `projetarEstatisticaLedger` de `src/estatistica/index.ts` após integrar os commits desta faixa.
- A estatística entregue conta pacientes/eventos por classes operacionais fixas, documentos assinados reconhecidos pelo contrato e status de administração tipado; não representa ainda todas as categorias clínicas de D-W9-42.
- A projeção recalcula do ledger, ignora eventos supersedidos conforme `supersedesEventId` e não grava contador ou banco paralelo.
