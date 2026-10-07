# W10 · Pedidos ao tech lead · FUGU

## FUGU-01 · Contratos provisórios

- `src/contracts/w10/` ainda não estava publicado na base `d2af9e7` no começo da fatia. Os tipos em `src/kernel/extracao/tipos.ts` e a entrada/saída em `src/orchestration/pipeline-extracao.ts` estão marcados `PROVISORIO-W10`, sem alterar contratos congelados.
- Publicar/alinhar `EncounterSegment`, `ClinicalFact`, `PatientCandidate`, `ReconciledField<T>` e `Exception`, inclusive a tradução de proveniência EXPLICIT/DERIVED/INFERRED/UNCERTAIN para o vocabulário de `Dado<T>`. Definir como a decisão médica persistida é autenticada antes de qualquer promoção a `DOCUMENT_CONFIRMED`; identificadores fornecidos ao mapeador puro não provam a existência do evento.
- **Sem autorização implícita de integração clínica:** o esqueleto ainda não extrai, persiste nem vincula pacientes.

## FUGU-02 · BLOQUEADO_DEPENDENCIA (PDF digital)

- A conversão de texto e DOCX está implementada localmente, sem pacote novo. Não há parser de PDF digital neste worktree/lockfile; `node:zlib` decodifica ZIP/deflate de DOCX, mas não resolve as fontes, ToUnicode/CMap e estrutura de páginas de PDF. `pdftotext`/`mutool` também não estão instalados. Solicito ao tech lead escolher e fornecer **parser local aprovado** e contrato para PDF digital com páginas (sem envio de PHI a serviço externo). Não instalar por conta própria.
- Enquanto faltar, PDF digital, PDF escaneado e imagem retornam `PENDENTE`, com SHA-256 e sem texto clínico. Isso é **parcial/bloqueado**, não FUGU-02 FEITA. DOCX com texto rasurado e fixture `.txt` com `[RISCADO]` também ficam PENDENTE para revisão. Não pedir foto nova (D-W9-09).
- O conversor DOCX cobre `word/document.xml` e texto de parágrafos em XML, **não valida CRC do ZIP**, paginação real, tabelas complexas, cabeçalho/rodapé ou assinaturas. Documento ilegível fica PENDENTE; não é parser clínico completo.

---

# W10 · Pedidos ao tech lead · FUGU (continuação de 2026-10-07, após RESPOSTAS-TECH-LEAD)

Retomada após `git merge f0/w1-integrado` (fast-forward `fe4f459 → 0d84302`), `npm ci --offline` (100 pacotes, 0 vulnerabilidades) e leitura de `docs/w10/RESPOSTAS-TECH-LEAD.md` §FUGU.

## FUGU-02R · Contratos W10 no lugar de `PROVISORIO-W10` (atendido)
- `src/kernel/extracao/tipos.ts` deixou de declarar tipos próprios: reexporta `ClinicalFact`, `EncounterSegment`, `FactDomain`, `FactEvidence`, `FactProvenance`, `FactSourceType`, `PatientCandidate`, `ReconciledField`, `ReviewAction`, `ReviewException` e `ExceptionKind` de `src/contracts/w10/extracao.js`. Não há mais nenhum `PROVISORIO-W10` na faixa do FUGU.
- `mapearProveniencia` passou a exigir **decisão persistida**: `PhysicianConfirmation = { acao: ReviewAction, decisionEventId }`, e a ação precisa ser `CONFIRMAR`. O identificador sozinho não prova o evento (D-W9-34a).
- **Pedido (contrato do ledger):** confirmar o `tipo` canônico do evento de decisão. Hoje o FUGU emite o rascunho `{ tipo: "ReviewDecision", payload: { reviewDecisionId, exceptionId, acao, medicoId, em, patientId?, motivo? } }` porque `gravarOperacao` exige `reviewDecisionId` no payload (`REVIEW_DECISION_REQUIRED`). Falta o tech lead registrar `tipo`/payload no contrato do ledger e, se houver evento dedicado, publicá-lo.

## FUGU-02 · PDF digital — **DESTRAVADO**
- `pdfjs-dist` ^6.4.299 instalado por `npm ci` no worktree. `src/leitura/pdf-digital.ts` usa o build legado para Node (`pdfjs-dist/legacy/build/pdf.mjs`) com **import estático**, `disableFontFace`, `useSystemFonts: false`, `useWorkerFetch: false`, `useWasm: false` e `verbosity: 0`; nenhum worker/fonte/CMap por rede.
- `converterEntradaLocalAsync` lê PDF digital por página e devolve `DocumentoBruto` imutável com SHA-256. PDF escaneado/sem texto e imagem continuam `PENDENTE` (D-W9-09); o caminho síncrono (`converterEntradaLocal`) segue cobrindo texto colado e DOCX e não lê PDF.
- **Nota técnica (não é pedido):** o parser precisa de um `Uint8Array` próprio; Buffers pequenos do Node compartilham o `ArrayBuffer` do pool e o `getDocument` falha com "Invalid PDF structure". `lerPdfDigital` copia os bytes antes de entregar ao parser.
- Continua valendo o que a fatia anterior pediu: o conversor DOCX cobre `word/document.xml` e parágrafos (sem CRC do ZIP, paginação real, tabelas complexas, cabeçalho/rodapé ou assinaturas). Não é parser clínico completo.

## FUGU-11a · INTERVAL_PROGRESSION — **BLOQUEADO_DEPENDENCIA parcial (não bloqueia a fatia)**
- A regra clínica é do Grok (`src/rules`, **GROK-06**, ainda `—` no `docs/progresso/W10-GROK.md`). O FUGU publicou só a **porta** `RegraProgressao` e um **dublê determinístico** (`regraProgressaoIntervalar`) que implementa D-W9-43: mesmo sítio + mesmo método + aumento ⇒ `ALERTA` + exame dirigido, **nunca** metástase automática.
- **Pedido:** quando GROK-06 publicar a regra canônica, o FUGU troca a ligação do dublê pela implementação de `src/rules` sem tocar no resto do pipeline (a porta já isola).
- Limitação registrada do dublê: ele opera sobre os padrões sintéticos que o extrator determinístico reconhece. Em prosa (ex.: "radiologista recomenda RM"), o método de imagem pode ser atribuído a uma linha que não é um exame; quando a porta LLM for ligada (D-W9-15) isso sai do caminho.

## FUGU-11b · Biomarker Requirement Engine — tabela de dados fora do corpus
- A tabela ficou em `src/kernel/extracao/dados/biomarcadoresRequeridos.ts` (dados congelados, sem lógica) porque `resolveJsonModule` está desligado e `corpus/**` não é faixa do FUGU.
- Conteúdo inicial **só** o que a spec §9 decidiu: CPNPC adenocarcinoma IV (PD-L1, EGFR, ALK, ROS1, BRAF, KRAS G12C, MET éxon 14, RET, NTRK, HER2) e mama (RE, RP, HER2, Ki-67 sempre; BRCA/PALB2 quando indicado), com `fonte` citando a spec/D-W9-33.
- **Pedido:** (a) mover a tabela para o corpus versionado quando houver consumidor (Grok/equipe interna), com o mesmo conteúdo e fonte; (b) curadoria do Dr. Silas para os demais tumores — hoje `requiredBiomarkers` devolve `[VERIFICAR]` em vez de inventar exigência. CPNPC exige `estadio` explícito no contexto local para casar o grupo "IV": **não** inferimos estágio do literal TNM (invariante 2).

## FUGU-10 · Alinhamento com `src/modules` (projeção/snapshot) — patch proposto, não aplicado
- `PatientTimeline` (contrato W10) e `src/kernel/projections/snapshot.ts` (`ValorProjetado`/`CaseSnapshot`) descrevem o mesmo paciente em vocabulários diferentes. O FUGU **não** editou `src/modules/**` (faixa do Grok).
- **Patch proposto (para o tech lead/Grok avaliarem):** expor em `src/modules` um consumidor que receba `PatientTimeline` e monte as `Secao<T>`/`Semaforo` das telas, sem duplicar `missingRequiredData` nem `unresolvedConflicts`. Enquanto isso, `projetarTimelinePaciente` devolve o contrato W10 validado por Zod e a conversão para `Secao<T>` fica fora da faixa do FUGU.
- `recist: []` é intencional: o RECIST é calculado por código em `src/rules/recist` (faixa Astra/Grok); o FUGU não recalcula nem inventa categoria.

## FUGU-08 · Invariante 6 e 7 — sem pedido novo
- `TEMPORAL_CONFLICT` é detectado na reconciliação e o invariante 6 rejeita evento anterior ao diagnóstico que chegue sem conflito marcado. `historicalMetastaticDisease` é monotônico e lê o componente M do literal TNM por código (`componenteM`), não por `\bM1\b` textual.

## Nada pendente de autorização de integração clínica
- O pipeline segue **esqueleto**: não extrai com LLM, não persiste, não vincula paciente, não assina e não projeta timeline sem `ReviewAction` persistida. Nenhum valor clínico novo foi decidido; nenhum `[VERIFICAR]` foi preenchido em silêncio.