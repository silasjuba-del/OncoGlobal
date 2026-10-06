# W8-KIMI · progresso (retomada)

> Onda W8 · executor KIMI · worktree `C:\Users\silas\Projects\OncoGlobal-wt\w8-kimi` · branch `f0/w8-kimi`.
> Base: `f0/w1-integrado` @ 243dcae. Faixa exclusiva: `tests/cobertura/**`, `tests/fixtures/caso07/**`, `tests/adv-w8/**`, `docs/progresso/W8-KIMI.md`, `docs/w8/ACHADOS-KIMI.md`.
> **Retomada:** continue da primeira fatia não FEITA. Nunca refaça fatia FEITA.

## Estado por fatia
| Fatia | Título | Estado | Commit | Verify (resumo) | Pendências |
|---|---|---|---|---|---|
| KIMI-11 | Mapa de lacunas executável | FEITA | f28a3c2 | tsc ok · fronteiras ok (81) · corpus ok (20) · mapa **vermelho por design** (13 SEM PROVA — checklist vivo) · regressão W3 9/9 | fecha verde em KIMI-20 ✔ (mapa verde no run final) |
| KIMI-12 | G-07 e G-08 | FEITA | c16a9a5 | tsc ok · fronteiras ok · corpus ok · adv g07/g08 falham SÓ em SEM_IMPLEMENTACAO · regressão W3 9/9 | implementação src/ (dono: harness) |
| KIMI-13 | G-09, G-27 (+ FN-16/T-34 nesta fatia) | FEITA | 1e856ca | tsc ok · fronteiras ok · corpus ok · adv g09/g27/fn16 falham SÓ em SEM_IMPLEMENTACAO · regressão W3 9/9 | implementação src/ |
| KIMI-14 | K-26/N17 e N19 | FEITA | 226e10a | tsc ok · fronteiras ok · corpus ok · adv k26/n19 falham SÓ em SEM_IMPLEMENTACAO · regressão W3 9/9 | implementação src/ |
| KIMI-15 | T-56/G-16 (+ mapa fecha verde na contagem de provas) | FEITA | 788abe3 | tsc ok · fronteiras ok · corpus ok · adv t56 falha SÓ em SEM_IMPLEMENTACAO · regressão W3 9/9 | implementação src/ |
| KIMI-16 | Fixtures Paciente Teste 07 | FEITA | 55bac21 | tsc ok · fronteiras ok · corpus ok · integridade dos fixtures 8 páginas→6 exames únicos ok · regressão W3 9/9 | — |
| KIMI-17 | Regressão do caso 07 | FEITA | d01c57c | tsc ok · fronteiras ok · corpus ok · cobertura 27/27 (3 arquivos) + adv dedupe (DEPENDE_W7) · regressão W3 9/9 | dedupe real depende W7 |
| KIMI-18 | Fuso horário D-W5-01/02 | FEITA | cfc3fab | tsc ok · fronteiras ok (81) · corpus ok (20) · fuso 13/13 · cobertura 40/40 (4 arquivos) · regressão W3 9/9 | — |
| KIMI-19 | Autorização de saída HTTP | FEITA | 5d8f18f | tsc ok · fronteiras ok · corpus ok · saída 7/7 · cobertura 47/47 (5 arquivos) · regressão W3 9/9 | — |
| KIMI-20 | Fechamento + ACHADOS | FEITA | (este commit) | ver "Verify final" abaixo | — |

## Verify final (KIMI-20, saída real colada)
```
npx tsc --noEmit                         → sem erros
npm run check:boundaries                 → fronteiras ok (81 arquivos)
npm run check:corpus                     → corpus ok (20 arquivos)
npx vitest run tests/cobertura --no-file-parallelism
  → Test Files 5 passed (5) · Tests 47 passed (47)
    (_mapa, caso07, fuso, saida + integridade-fixtures)
npx vitest run tests/w3/auditoria-regressao.test.ts --no-file-parallelism
  → Test Files 1 passed (1) · Tests 9 passed (9)
npx vitest run --config tests/adv-w8/vitest.config.ts --no-file-parallelism
  → Test Files 9 failed (9) · Tests 10 failed | 31 passed (41)
    As 10 falhas são EXATAMENTE as assertivas SEM_IMPLEMENTACAO
    (1 em cada arquivo; g27 tem 2: sanitizador + gate de saída).
```

## Notas de execução
- KIMI-11: `tests/cobertura/_mapa.test.ts` lê `docs/w5/MATRIZ.md`, reporta SEM_TESTE/PARCIAL reais e falha enquanto um dos 13 IDs não tiver prova (nome/conteúdo) em `tests/cobertura/**` ou `tests/adv-w8/**`. `it.todo` proibido. Saída do 1º run: 13 × "SEM PROVA AINDA". No run final: os 13 IDs têm prova e o mapa passa.
- KIMI-12..15: padrão adv fixado — import dinâmico + `Record<string, unknown>` para `tsc --noEmit` não quebrar ao procurar funções inexistentes; 1º teste `SEM_IMPLEMENTACAO` falha (prova da lacuna), demais guardados com `if (!fn) return` (especificação executável pronta).
- **[VERIFICAR] · divergência de comando:** o prompt da onda manda `npx vitest run tests/adv-w8/<arquivo>.adv.ts`, mas o Vitest raiz só inclui `*.{test,spec}.ts` (sem `vitest.config.ts` na raiz). Criei `tests/adv-w8/vitest.config.ts` (dentro da faixa) e rodei com `--config`. Se o tech lead preferir, o fix certo é um `vitest.config.ts` na raiz incluindo `**/*.adv.ts` — fora da minha faixa.
- **[VERIFICAR] · paths Windows:** em testes novos usei sempre `fileURLToPath(new URL(...))`; o padrão `.pathname.replace(/^\/([A-Za-z]:)/, "$1")` existente funciona, mas é frágil (o `_mapa.test.ts` da KIMI-11 o usa e passa).
- KIMI-16: fixtures 100% inventados (CNS `704202600001234` rotulado "Matrícula"; CPF `123.456.789-01` com DV inválido proposital, rotulado "CI"/"Cartão SUS"; biópsia 6 sítios; RM com 2 blocos `[RISCADO]...[/RISCADO]`; cintilografia ×2 idênticas; IHQ original+reimpressão com data de extração diferente no topo; RTU; AP). `esperado.json` registra o resultado da §4 de CASO-REAL-01-LICOES.
- KIMI-17: regressões reais que PASSAM hoje — CPF-rotulado-CNS não liga como CNS; comprovante de terceiro não liga; captação articular ≠ metástase (radAlerts). A dedupe virou adv (DEPENDE_W7) porque o motor de leitura ainda não existe.
- KIMI-18: 13 provas — data civil com offset injetado, consumidores (APAC/hemograma/peso/intervalo QT) e varredura de 48 instantes provando que o aviso APAC pode adiantar ≤1 dia com offset errado, mas NUNCA atrasar (offset futuro é a única direção proibida e fica evidente).
- KIMI-19: 7 provas HTTP reais em loopback (127.0.0.1, ledger `:memory:`). Destaque: replay com a mesma idempotencyKey devolve decisão REPLAY sem novo efeito (a reserva vive no SQLite do ledger via `sqliteIdempotencia`, não na memória volátil). BACKUP_LOCAL é autorizado mas negado `VERBO_SEM_EXECUTOR` — porta F0 desconectada, registrado como observação (não é achado de segurança).
- KIMI-20: ACHADOS em `docs/w8/ACHADOS-KIMI.md` — 9 blocos (ID, severidade S0–S3, causa provável, dono provável, arquivo). Proposta de severidade: G-07/T-49, G-08/T-50, G-09/T-51 e FN-16/T-34 = **S1**; G-27 = **S0 latente → S1** quando egress for habilitado (hoje toda saída externa é recusada — mitigação comprovada em KIMI-19); K-26/N17, N19, T-56/G-16 e dedupe caso 07 = **S2**.

## Honestidade sobre SEM_TESTE
Nenhum dos 13 IDs "saiu" de SEM_TESTE — `docs/w5/MATRIZ.md` está fora da minha faixa e continua SEM_TESTE. O que existe agora para cada ID: (a) prova adversarial executável em `tests/adv-w8/*.adv.ts` com a falha-canônica SEM_IMPLEMENTACAO vermelha e os demais casos guardados como especificação; (b) item em ACHADOS-KIMI.md com severidade e dono. Nenhum ID ficou sem prova nem sem dono provável.

## Perguntas ao tech lead
1. Posso propor (não executar — fora da faixa) um `vitest.config.ts` raiz incluindo `**/*.adv.ts`, para o comando literal do prompt funcionar? Ou mantemos o config dedicado em `tests/adv-w8/`?
2. G-27: a mitigação atual (todo egress fechado) justifica manter S0 latente, ou o tech lead prefere S1 já (risco ao primeiro canal habilitado)?
3. A dedupe do caso 07 (S2, DEPENDE_W7) deve ser reclamada à onda W7 agora ou fica registrada só no ACHADOS?
4. BACKUP_LOCAL sem executor (KIMI-19): é intencional em F0 (verbo reservado) ou esquecimento de wiring?

## Commits da onda (mais recente primeiro)
5d8f18f W8-KIMI-19 · cfc3fab W8-KIMI-18 · d01c57c W8-KIMI-17 · 55bac21 W8-KIMI-16 · 788abe3 W8-KIMI-15 · 226e10a W8-KIMI-14 · 1e856ca W8-KIMI-13 · c16a9a5 W8-KIMI-12 · f28a3c2 W8-KIMI-11
Sem push — aguarda revisão do tech lead.
