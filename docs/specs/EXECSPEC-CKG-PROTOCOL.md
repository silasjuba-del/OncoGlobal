# ExecSpec CKG Protocol v1 (proposta) · e o encaixe no OncoGlobal

> Fonte: texto colado pelo Dr. Silas (2026-10-07), de outra LLM. Registrado como D-W9-64 (proposta, não implementado). CKG = grafo canônico de conhecimento: **snapshot canônico + patch auditável + views derivadas**.

## Correções estruturais propostas
1. `Knowledge` texto livre → átomo **Claim** reificada (sujeito–predicado–objeto, escopo, tempo, autoridade, evidências).
2. "Toda informação existe uma vez" → **uma identidade semântica canônica por entidade/claim, com muitas evidências rastreáveis**.
3. Tipos exclusivos → `kind` primário único + `facets` não canônicas.
4. Determinismo vem de schema, ontologia versionada, ordenação canônica, regras de reconciliação e reconciliador determinístico — **não da LLM**.

## Contrato de execução
`protocol: execspec-ckg/v1` · `mode: BUILD | PATCH | AUDIT | PROJECT` · `ontology_version` · `base_snapshot_hash` (obrigatório exceto BUILD) · `source_policy` (fontes aceitas, proveniência obrigatória, classificação PUBLIC/INSTITUTIONAL/IDENTIFIED/PHI) · `scope` (domínio, fronteiras, operações proibidas) · `requested_views`. Entrada inválida = `BLOCKED_INPUT_CONTRACT`; nenhum agente preenche escopo, inventa fonte, infere autoridade ou assume versão-base.

## Seis nós primários
`SourceArtifact` (origem) · `EvidenceSpan` (trecho literal imutável e localizável, com hash) · `Entity` (pessoa, sistema, conceito, componente, caso, evento) · **`Claim`** (afirmação atômica; relações DEPENDS_ON/BLOCKS/SUPERSEDES também são claims com evidência) · `Action` (owner, critério, estado) · `Issue` (contradição, lacuna, risco, violação, bloqueio).
`ClaimKind`: DECISION, RULE, STANDARD, COMPONENT, PROBLEM, SOLUTION, QUESTION, PENDING, CONTRADICTION, ACTION. `ClaimStatus`: CANDIDATE, CONFIRMED, HYPOTHESIS, CONFLICTING, DEPRECATED, RETRACTED, UNKNOWN. Claim = {id, kind, subjectEntityId?, predicate, object, status, scope{domain, validFrom/Until, classification}, authority{assertedBy, confirmationRequiredBy?, confirmedBy?}, evidenceIds ≥1, facets[], revision, contentHash}.

## Pipeline
SOURCE → EVIDENCE_EXTRACTION → CANDIDATE_CLAIMS → IDENTITY_RESOLUTION → DETERMINISTIC_RECONCILIATION → VALIDATION → SNAPSHOT_COMMIT → DERIVED_VIEWS → AUDIT_REPORT → PATCH. **LLM só em extração de evidência, claims candidatas e sugestão de links.** Promoção, dedupe, ordenação, merge e invalidação = regras determinísticas.

## Estados e autoridade
EvidenceSpan: CAPTURED → HASHED → IMMUTABLE. Claim: CANDIDATE → REVIEWED → CONFIRMED | HYPOTHESIS | CONFLICTING | RETRACTED. Action: PROPOSED → ACCEPTED → IN_PROGRESS → VERIFIED → DONE (| BLOCKED). **LLM cria CANDIDATE; nunca CONFIRMED; só a autoridade do contrato promove.**

## Regras ES-001…015
Evidência aponta para fonte existente; toda claim tem ≥1 evidência, kind, status, escopo, classificação e autoridade; CONFIRMED exige `confirmedBy` compatível; HYPOTHESIS nunca satisfaz pré-condição de Action crítica; merge de entidade só com evidência de identidade ou decisão humana; contradição nunca resolvida por proximidade semântica; views só sobre snapshot imutável; toda Action referencia Claim/Issue e tem owner, prioridade, critério e estado; ciclos proibidos só em relações acíclicas (DEPENDS_ON, SUPERSEDES); patch declara base_snapshot_hash e precondições; sem DELETE físico (RETRACT/ARCHIVE); PHI não projeta em view de clearance inferior; snapshot canônico só com hash, ontologia e política explícitos.

## Patch
Ops: ADD · UPDATE (com `beforeHash`, fim do last-write-wins) · MERGE · SPLIT · RELINK · RECLASSIFY · RETRACT (com evidência do motivo) · ARCHIVE. Patch = {protocol, baseSnapshotHash, operations ≥1, expectedResultHash?}.

## Quality gates
TRACEABILITY · INTEGRITY · CONSISTENCY · AUTHORITY · COVERAGE · READINESS · PRIVACY → READY (todos críticos PASS) / PARTIAL (só WARNING) / BLOCKED (qualquer FAIL crítico ou contrato incompleto).

## Views (consultas, não narrativa livre)
TIMELINE · DECISION · ACTION · AUDIT · ROADMAP (DAG DEPENDS_ON) · NARRATIVE (só claims confirmadas; hipóteses rotuladas); toda view registra `view_id`, `snapshot_hash`, `query_version`, `generated_at`.

## Saída
`{protocol, mode, baseSnapshotHash, result:{snapshotHash, patch, requestedViews, issues, qualityGates, readiness{state, reasons}}}`. Veredito do autor: `Evidence → Entity → Claim → Action → View`; o CKG é o artefato soberano, documentos/RAG/agentes viram projeções regeneráveis.

---
## Encaixe no que já existe (tech lead) — evitar modelo paralelo (Regra de ouro 1: uma fonte de verdade por conceito)
| CKG | OncoGlobal hoje |
|---|---|
| SourceArtifact | `DocumentoBruto` (caixa única, SHA-256) / `Fonte` (C-02) |
| EvidenceSpan | `ClinicalFact.rawEvidence` + `sourceId` + `page/timestampMs` (sem hash próprio do trecho — lacuna) |
| Claim (clínica) | `ClinicalFact` (domínio, valor, evidence EXPLICIT/DERIVED/INFERRED/UNCERTAIN, regra) |
| Claim CANDIDATE → CONFIRMED | `Revisao` RAW → INFERIDO → REVISAR → CONFIRMADO → ASSINADO; promoção só por `ReviewAction`/médico |
| CONFLICTING / Issue | `ReviewException` (CONFLICT, TEMPORAL_CONFLICT, …) e `Dado.candidatos` |
| Entity merge (ES-006) | D-W9-34a: junção de paciente nunca automática |
| Patch com beforeHash | ledger append-only + `expectedRevision` + idempotência (já existe) |
| RETRACT/ARCHIVE | `supersedesEventId` (sem delete) |
| Views | projeções recomputáveis (`src/kernel/projections`) |
| Claim de conhecimento (BRAIN_OS) | nós do ragGRAFO (status NAO_VERIFICADO/DIRETRIZ_FINAL) — **onde o CKG mais acrescenta** |
| Claim de projeto (DECISION/RULE/ACTION) | `docs/DECISOES.md` (texto) + prompts de onda — **candidato natural a virar CKG** |
Proposta: (1) usar o CKG como **formato do BRAIN_OS e da governança do projeto** (decisões D-xx, regras, ações das ondas); (2) no domínio clínico, `ClinicalFact` vira uma especialização de Claim (acrescentar `EvidenceSpan` com hash e `scope.classification = PHI`), sem segundo modelo paralelo.
