# C2-L4-CARTAO — projeção documental do RetratoTransversal

## Objetivo e contrato

`projetarRetratoTransversal` é uma função pura que recebe `patientId`, um `tumorLotId` confirmado pelo chamador, fatos já revisados/escopados ao par e uma extensão opcional. Sem lote retorna `null`; com lote, `tumorIndice` é `true` pelo contexto confirmado fornecido. A função não associa facts a paciente/lote.

`ClinicalFact` não possui `patientId`, `tumorLotId` ou campo tipado de negação. A projeção documenta como precondição que o chamador fornece facts já revisados e escopados; exclui `patientCandidateId` não nulo, aceita somente `sourceType=pathology`, `evidence=EXPLICIT` e `requiresConfirmation=false`, e rejeita `value.negated===true` se esse marcador estruturado existir. O extrator atual já descarta negações antes de produzir facts. A projeção não analisa `rawEvidence` para decidir negação; a prova do vínculo no consumidor fica com a Astra.

O contrato neste worktree ainda exige extensão não nula. A saída local usa o alias de compatibilidade `Omit<RetratoTransversal, "extensao"> & { extensao: ExtensaoTumor | null }`; a Astra confirmou a alteração integrada para extensão nullable. A função valida toda extensão fornecida com `ExtensaoTumor.safeParse`; ausência ou formato inválido resulta em `null` sem apagar o núcleo.

## Projeção

- Histologia copia o texto literal de facts de patologia, com `documentoId=sourceId`, data civil válida ou null, trecho literal `rawEvidence` e origem `LAUDO`.
- Discordâncias ficam `CONFLITO` com todos os candidatos. Valores iguais escolhem origem em ordem lexical estável e guardam todas as fontes no array `candidatos`; o campo `origem` de `VALOR` só comporta uma fonte, então esse é o limite representacional documentado.
- c/p/ypTNM só recebem cópia literal quando o texto começa com prefixo explícito `cT`, `pT` ou `ypT`. Sem prefixo reconhecido, o campo fica `NAO_INFORMADO`. Não há campo rTNM no núcleo atual; `rT` permanece ausente.
- Todos os outros campos do núcleo são inicializados pelo shape `NucleoAP` em `NAO_INFORMADO`; não há inferência de tumor, sítio, lateralidade, grau, estádio ou extensão.

## Saídas reais

| Comando | Saída | Estado |
|---|---|---|
| `npx tsc --noEmit` | Sem diagnósticos; exit code 0 | PASS |
| `npx vitest run tests/f0-fecha/retrato-ledger.test.ts tests/contracts/anatomo-patologico.test.ts tests/w12-f2/cartao-transversal.test.tsx tests/kernel/extracao/reconciliacao.test.ts --no-file-parallelism --maxWorkers=1` | `Test Files 4 passed (4)`; `Tests 46 passed (46)`; duração 17,10 s | PASS |

Os testes cobrem proveniência literal, fonte não AP/inferida/pendente/candidato não associado, conflito, fontes iguais e ordenação estável, ausência de lote, extensão inválida/validada e estágio sem prefixo. Não foi rodada a suíte completa.

## Limites

- `ClinicalFact` não prova associação com `patientId` ou lote; o chamador deve buscar fatos sob escopo confirmado e a Astra deve testar essa ligação na montagem real.
- O tipo `ClinicalFact` não representa negação. A projeção não tenta inferi-la por texto e depende do pipeline/revisão que fornece os facts.
- TSC e testes usaram o contrato do worktree, com alias nullable; a integração deve validar contra o contrato atualizado da Astra.

## Commit

Commit único desta fatia: `F0F-L04-CARTAO: projeção documental do retrato`, com `Co-Authored-By: gpt-6-luna`. O hash real é fornecido no handoff porque este relatório integra o próprio commit.
