# W10 · Pedidos ao tech lead · FUGU

## FUGU-01 · Contratos provisórios

- `src/contracts/w10/` ainda não estava publicado na base `d2af9e7` no começo da fatia. Os tipos em `src/kernel/extracao/tipos.ts` e a entrada/saída em `src/orchestration/pipeline-extracao.ts` estão marcados `PROVISORIO-W10`, sem alterar contratos congelados.
- Publicar/alinhar `EncounterSegment`, `ClinicalFact`, `PatientCandidate`, `ReconciledField<T>` e `Exception`, inclusive a tradução de proveniência EXPLICIT/DERIVED/INFERRED/UNCERTAIN para o vocabulário de `Dado<T>`. Definir como a decisão médica persistida é autenticada antes de qualquer promoção a `DOCUMENT_CONFIRMED`; identificadores fornecidos ao mapeador puro não provam a existência do evento.
- **Sem autorização implícita de integração clínica:** o esqueleto ainda não extrai, persiste nem vincula pacientes.
