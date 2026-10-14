# W10 · Respostas do tech lead aos PEDIDOS (2026-10-07)

> Antes de retomar: `git merge f0/w1-integrado` no seu worktree. Contratos novos em `src/contracts/w10/` (exportados por `src/contracts/index.ts`). Troque todo `PROVISORIO-W10` pelo contrato correspondente na sua próxima fatia.

## Contratos publicados
| Contrato | Arquivo | Substitui |
|---|---|---|
| `FactDomain`, `FactSourceType`, `FactEvidence`, `FactProvenance`, `EncounterSegment`, `ClinicalFact` (regra obrigatória em DERIVED/INFERRED; número falado do Plaud exige confirmação), `PatientCandidate` (`requiresReview: true` literal), `ReconciledField` (`resolvedFactId` + `hierarquia`), `ExceptionKind` (+ `INTERVAL_PROGRESSION`), `ReviewException`, `ReviewAction` | `w10/extracao.ts` | tipos de `src/kernel/extracao/tipos.ts` (Fugu) |
| `ClasseMedicacao` (PRE_QT · QT · POS_QT · NAO_ONCOLOGICA), `DoseBasis`, `AjustePercentual` (−20/−30/−40), `LimiaresBula`, `PrescriptionItem`, `ProtocolTemplate` (tumor+nome+cenário+versão+hash; status RASCUNHO/CONFERIDA_MEDICO/INATIVA), `ClinicalOrder`, `QuickLine`, `PrescriptionDocumentType`, `SafetyVerdict` (BLOCK_ARTEFATO, NOT_EVALUABLE) | `w10/prescricao.ts` | `ProtocoloCiclo`/`LabsCiclo` de `src/rules/portaCiclo.ts` (Grok) → use `LimiaresBula` |
| `TriagemExtraW10` (`pad`, `crCentesimos`, null = PENDENTE), `CaixaNumerada`, `AlteracaoCaixa`, `AchadoAntiglosa`, `VereditoAntiglosa`, `StageEntry`, `StatusTratamento`, `TreatmentEntry`, `RecistAvaliacao` (categoria nasce PROPOSTO), `PatientTimeline` | `w10/clinico-w10.ts` | `SinaisExtraW10` (Grok) |
Testes: `tests/contracts/w10.test.ts` (10 casos).

## FUGU
- **PDF digital: dependência aprovada `pdfjs-dist` ^6.4.299** (já em `package.json`; `npm ci` no seu worktree). Use o build legado para Node (`pdfjs-dist/legacy/build/pdf.mjs`) com **import estático** (import dinâmico reprova o check de fronteiras), sem worker remoto, sem fontes/CMaps buscados por rede (`disableFontFace`, dados locais do pacote). Escaneado/sem texto continua PENDENTE (D-W9-09). Destrave FUGU-02 e siga.
- Confirmação médica persistida: use `ReviewAction` → evento no ledger; o evento novo, se necessário, vai em PEDIDOS com o formato (o tech lead registra no contrato do ledger).

## GROK
1. **SinaisExtraW10 → `TriagemExtraW10`** (C-08 continua congelada; a extra entra como segundo parâmetro).
2. **R-08 liberado só para o barrel:** `src/rules/index.ts` agora pode importar arquivos de `src/rules/` (alteração em `scripts/check-boundaries.mjs`). **Apague as cópias duplicadas** de `index.ts` e reexporte de `triagem.ts`/`portaCiclo.ts`; mantenha o teste de paridade só se ainda fizer sentido.
3. **Versão do ruleset do salão: autorizado subir** `salao-triagem.v1.json` para `1.1.0` **junto** com a expectativa da suíte FN-01 (única mudança permitida nesse teste).
4. **`lab-thresholds.v1.json`: autorizado** (fora da sua faixa, só este arquivo) ativar CREAT com `limiarSuperior` 150 (centésimos de mg/dL), fonte D-W9-37.
5. **FC < 50:** a regra vigente é D-W9-37 (corta → FILA_MEDICO). **Autorizado** alinhar `avaliarTriagem` (FN-01) para incluir FC < 50 como corte **e** atualizar a expectativa congelada correspondente (comentário de `ResultadoTriagem` incluso); registre no progresso o antes/depois. PAS > 160 e FC > 120 seguem no corte do salão (Q21) — não fundir com a triagem do ciclo (D-W9-22g).
6. Ficha/limiares: `portaCiclo` lê `LimiaresBula` da `ProtocolTemplate`.

## CURSOR
- Chaves de copy e ícones pedidos: a equipe interna adiciona em `src/ui/copy/pt-BR.ts` e `src/ui/icones/` (vem no próximo merge). Até lá mantenha os literais.
- Testes de UI demoraram 452 s: use `--no-file-parallelism` só nas suas pastas e evite renderizar a casca inteira em cada teste (monte componentes isolados).

## Para todos
Retome **da primeira fatia não FEITA e vá até a última sem parar**, salvo `BLOQUEADO_*`. Relatório e PEDIDOS a cada fatia, como antes.
