# W8-KIMI · 10 FATIAS · cobertura normativa e regressão (testes)

> Leia primeiro `docs/ondas/W8-COMUM.md`. EXECUTOR = `KIMI`. Worktree `C:\Users\silas\Projects\OncoGlobal-wt\w8-kimi` · branch `f0/w8-kimi`.
> **Faixa:** só **testes novos**: `tests/cobertura/**`, `tests/fixtures/caso07/**`, `tests/adv-w8/**`, `docs/progresso/W8-KIMI.md`, `docs/w8/ACHADOS-KIMI.md`. **Você não edita `src/`.**
> **Regra de ouro:** teste que passa vai para `tests/cobertura/`. Teste que **falha** prova defeito ou lacuna: vai para `tests/adv-w8/` com extensão `*.adv.ts` (o Vitest regular só pega `*.test.ts`; rode com `npx vitest run tests/adv-w8/<arquivo>.adv.ts`) e vira item em `ACHADOS-KIMI.md` com causa provável e arquivo. Nunca ajuste a expectativa para casar com o código.
> Mapa de lacunas: `docs/w5/MATRIZ.md` e o relatório W5 (SEM_TESTE: G-07, G-08, G-09, G-27, K-26, FN-16, N17, N19, T-34, T-49, T-50, T-51, T-56).

## KIMI-11 · Mapa de lacunas executável
`tests/cobertura/_mapa.test.ts`: lê `docs/w5/MATRIZ.md`, lista os IDs SEM_TESTE/PARCIAL e falha se algum ID SEM_TESTE desta lista **não** tiver arquivo de teste com o ID no nome ou no título até o fim da onda (comece com `it.todo` é proibido; use a lista como checklist em `docs/progresso`). Aceite: o teste roda e reporta a lista real.

## KIMI-12 · G-07 e G-08
Leia o PLANO para o texto exato de G-07 (AG-11) e G-08 (AG-13, séries de resposta, ContactSummary, RAG só de conhecimento aprovado). Escreva provas positivas e negativas contra o código que existir. Se não existir implementação: prova `.adv.ts` + achado "SEM_IMPLEMENTACAO".

## KIMI-13 · G-09 e G-27
Mesmo método (G-09 = interação; G-27 conforme PLANO). Interações: `corpus/rulesets/interacoes.v1.json` está inativo → nenhuma interação pode virar VERMELHO sem fonte; ausência de checagem = PENDENTE, nunca "sem interação".

## KIMI-14 · N17, N19, K-26, FN-16
Provas pelo texto do PLANO. Cada teste cita o ID no título.

## KIMI-15 · T-34, T-49, T-50, T-51, T-56
Idem. Onde o T depender de UI ou app ainda em construção (W6/W7), marque `DEPENDE_W6/W7` no achado e teste o que existir.

## KIMI-16 · Fixtures do Paciente Teste 07 (documentos sintéticos)
`tests/fixtures/caso07/*.txt`: textos sintéticos das páginas descritas em `CASO-REAL-01-LICOES.md §4` (ficha, receituário secundário, comprovante de terceiro, biópsia 6 sítios, RM com 2 trechos marcados `[RISCADO]...[/RISCADO]`, cintilografia ×2, AP RTU, IHQ ×2 com cabeçalho de extração diferente). **Tudo inventado**, nenhum nome, número ou instituição real. + `esperado.json` com o resultado da §4.

## KIMI-17 · Regressão do caso 07 contra o que existe
`tests/cobertura/caso07.test.ts` (ou `.adv.ts` onde falhar): identidade (`src/rules/identidade.ts`, `src/modules/canal/vinculo.ts`): CPF rotulado "Cartão SUS" não liga como CNS; comprovante de terceiro não liga; dedupe (onde existir); TNM nunca preenchido por regra; captação articular ≠ metástase (`src/rules/radAlerts.ts`).

## KIMI-18 · Bordas de tempo e fuso (D-W5-01/02)
`tests/cobertura/fuso.test.ts`: 23:30 −03:00 em todos os consumidores de data civil que existirem (APAC, intervalo QT, validade de hemograma, peso 60 dias); aviso APAC pode adiantar até 1 dia, **nunca** atrasar.

## KIMI-19 · Autorização de saída (D-W5-08) ponta a ponta
`tests/cobertura/saida.test.ts` via HTTP real (use `tests/server/_artefatoAssinado.ts`): assinado imprime 1×; replay não reimprime; documento substituído (`supersedesEventId`) não imprime a versão antiga; WhatsApp/e-mail/APAC export recusados com o código certo.

## KIMI-20 · Fechamento
Relatório: tabela das fatias, lista de IDs que saíram de SEM_TESTE, `ACHADOS-KIMI.md` (cada `.adv.ts` com ID, severidade S0–S3, dono provável), saídas reais.
