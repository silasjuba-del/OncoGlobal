# W10 · Pedidos ao tech lead · FUGU

## FUGU-01 · Contratos provisórios

- `src/contracts/w10/` ainda não estava publicado na base `d2af9e7` no começo da fatia. Os tipos em `src/kernel/extracao/tipos.ts` e a entrada/saída em `src/orchestration/pipeline-extracao.ts` estão marcados `PROVISORIO-W10`, sem alterar contratos congelados.
- Publicar/alinhar `EncounterSegment`, `ClinicalFact`, `PatientCandidate`, `ReconciledField<T>` e `Exception`, inclusive a tradução de proveniência EXPLICIT/DERIVED/INFERRED/UNCERTAIN para o vocabulário de `Dado<T>`. Definir como a decisão médica persistida é autenticada antes de qualquer promoção a `DOCUMENT_CONFIRMED`; identificadores fornecidos ao mapeador puro não provam a existência do evento.
- **Sem autorização implícita de integração clínica:** o esqueleto ainda não extrai, persiste nem vincula pacientes.

## FUGU-02 · BLOQUEADO_DEPENDENCIA (PDF digital)

- A conversão de texto e DOCX está implementada localmente, sem pacote novo. Não há parser de PDF digital neste worktree/lockfile; `node:zlib` decodifica ZIP/deflate de DOCX, mas não resolve as fontes, ToUnicode/CMap e estrutura de páginas de PDF. `pdftotext`/`mutool` também não estão instalados. Solicito ao tech lead escolher e fornecer **parser local aprovado** e contrato para PDF digital com páginas (sem envio de PHI a serviço externo). Não instalar por conta própria.
- Enquanto faltar, PDF digital, PDF escaneado e imagem retornam `PENDENTE`, com SHA-256 e sem texto clínico. Isso é **parcial/bloqueado**, não FUGU-02 FEITA. DOCX com texto rasurado e fixture `.txt` com `[RISCADO]` também ficam PENDENTE para revisão. Não pedir foto nova (D-W9-09).
- O conversor DOCX cobre `word/document.xml` e texto de parágrafos em XML, **não valida CRC do ZIP**, paginação real, tabelas complexas, cabeçalho/rodapé ou assinaturas. Documento ilegível fica PENDENTE; não é parser clínico completo.
