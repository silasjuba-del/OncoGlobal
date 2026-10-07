# W10 · Endurecimento pelo red team · quem conserta o quê (tech lead, 2026-10-07)

Red team integrado em `f0/w1-integrado`: 28 arquivos, 227 testes; **43 vermelhos** nos `.adv.ts` (2 já caíram com o trabalho interno). Rodar: `npx vitest run --config tests/redteam/vitest.config.ts --no-file-parallelism`. Achados detalhados: `docs/w10/REDTEAM-ACHADOS.md`.
**Regra:** cada dono deixa verdes os `.adv.ts` dos seus achados **sem mudar a expectativa**; ao terminar, avisa no progresso. Expectativa errada? Argumente em PEDIDOS — só o tech lead altera teste do red team.

| Dono | Achados | Onde |
|---|---|---|
| **FUGU** | RT-01a (executor de `ReviewAction`), RT-01c, RT-02a (homônimos sem chamada explícita ⇒ revisão de fronteira), RT-03a (homóglifo/zero-width ⇒ UNCERTAIN, nunca some), RT-04a–d (incerteza não vira fato; unidade preservada; milhar), RT-09b/c, RT-10a (produtor de `TEMPORAL_CONFLICT`), RT-10c (`stageHistory` na projeção), RT-13a (PDF digital com `pdfjs-dist`), RT-13b (encoding Latin-1/BOM), RT-15a–c (ReconciliationEngine: CONFLICT cisplatina × carboplatina, cN2 sem prova, posologia absurda) | FUGU-06 a FUGU-12 já cobrem quase todos — use os `.adv.ts` como critério de aceite |
| **GROK** | RT-01b, RT-05a (negador incompleto dispara no laudo NEGATIVO PT08 — `radAlerts.ts`), RT-05b, RT-06c, RT-07a (lab implausível/unidade), RT-09a (ownership em runtime) | GROK-05/06/10 e correção em `src/rules` |
| **Tech lead + equipe interna** | RT-05c, RT-06a/b/d, RT-08a–e, RT-10b (`historicalMetastaticDisease` não rebaixa), RT-11a–d (BRAIN_OS: trial negativo, dose de estudo, loader do grafo, fontes divergentes), RT-12a–c (desidentificador: nome compacto em URL/caminho; S0 antes de ligar LLM) | harness/llm, contratos, prescrição, corpus |

**Ordem de prioridade (top 10 do red team):** RT-12a · RT-10b · RT-15a · RT-08a/b · RT-10c · RT-05a · RT-04a/b · RT-02a · RT-10a · RT-13b/RT-01a.
