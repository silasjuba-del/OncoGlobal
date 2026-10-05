# MANIFESTO DE ONDA — F0 · W1 (kernel)

**Base:** branch `f0/w0-contratos` (contratos e rulesets CONGELADOS nesta onda) · **Tech lead:** Claude · **Plano:** `docs/PLANO-FINAL-ONCOGLOBAL-v1.1.md` (Parte 0 normativa)
**Regra da onda (K-25):** um dono por ARQUIVO; ≤5 executores concorrentes; ninguém além do tech lead toca `src/contracts/**`, `corpus/rulesets/**`, `scripts/check-boundaries.mjs`. Precisa de algo fora do escopo → **para e reporta**. Alegação sem saída real de `npm run verify` não conta.

## Contratos congelados (hash do commit W0)
`src/contracts/{estados,base,clinico,operacao,agentes,index}.ts` · `corpus/rulesets/{salao-triagem,dose,prazos,apac}.v1.json`

## Fatias W1
| Fatia | Dono | Arquivos permitidos (exclusivos) | Entrega | DoD |
|---|---|---|---|---|
| S-F0-02 regras do salão + dose + prazos | **E3 Grok** | `src/rules/{triagem,destino,fila,dose,validade,peso,prazos,concomitancia,cicloComMedico}.ts` | FN-01…FN-09 puras, ruleset injetado | T-01…T-26 + N08 verdes; inteiros nas bordas; igual passa |
| S-F0-03 ledger + projeções | **E3 Grok** (2ª fatia, após S-F0-02) | `src/kernel/ledger/**`, `src/kernel/projections/**` | SQLite (node:sqlite, WAL), Operation+ClinicalEvent atômicos, DraftEnvelope, reconstrução | N04, N05, N06, N07, N10, N13, N14 + reconstrução byte a byte |
| S-F0-04a harness + gateway | **Claude** | `src/kernel/harness/**`, `src/kernel/gateway/**` | G-01…G-28 (os ativáveis em F0), gateway stub idempotente, AuditEvent | pares +/− por gate; N18, N19, N23 |
| S-F0-04b desidentificador + reconciliação | **Claude** | `src/kernel/llm/**`, `src/rules/{reconciliar,desidentificar}.ts` | FN-22, FN-24 (CPF/CNS por DV, dicionário do paciente, tokens), adapter LLM **fake** | T-40, T-42, N01, N22 |
| S-F0-05 fixtures + testes | **E5 Kimi** | `tests/rules/**`, `tests/fixtures/**` (dono único de fixtures) | fixtures sintéticas (nunca dado real) para S-F0-02/03 | cobertura das bordas da Parte 7 |
| S-F0-06 scaffolding CI | **E7 fast-worker** | `.github/workflows/**` | CI rodando `npm run verify` em PR | CI verde no PR |

**Auditoria W2 (depois da entrega, nunca o autor):** E1 Codex audita S-F0-02/03/05; Claude revisa tudo antes do merge.
**Proibido nesta onda:** tela, LLM real, rede, WhatsApp, Deepgram, SIGTAP real, estado novo, mudar contrato, importar código de ONCOMED/oncomind/consultorio-docs, fixture com dado real de paciente.
