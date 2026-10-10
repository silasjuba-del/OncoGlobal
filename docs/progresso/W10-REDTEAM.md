# W10-REDTEAM (GLM) · Progresso

> Executor: **GLM** · worktree `C:\Users\silas\Projects\OncoGlobal-wt\w10-redteam` · branch `f0/w10-redteam`.
> Faixa exclusiva respeitada: `tests/redteam/**`, `tests/fixtures/redteam/**`, `docs/w10/REDTEAM-ACHADOS.md`, `docs/progresso/W10-REDTEAM.md`.
> Nenhuma edição em `src/`, `corpus/`, `scripts/`, contratos ou testes existentes. Sem `git push`, sem `--no-verify`.
> Retomada: continue da primeira fatia não FEITA. Rodar tudo:
> `npx vitest run --config tests/redteam/vitest.config.ts --no-file-parallelism`

## Fatias

| Fatia | Arquivos | Estado | Resumo |
|---|---|---|---|
| RT-01 | `rt01-troca-laudo.test.ts` (8 ✓) · `rt01-troca-laudo.adv.ts` (3 ✗ / 3 guardados) | FEITA | Defesas: score nunca vincula, CNS×nome ordena sem ligar, dedupe não junta pacientes. Achados RT-01a/b/c (sem executor de ReviewAction, sem confronto nome×identificador, sem dedupe no pipeline). |
| RT-02 | `rt02-homonimos.test.ts` (13 ✓) · `rt02-homonimos.adv.ts` (1 ✗ / 1 guardado) | FEITA | Segmenter separa com chamada explícita; PatientResolver só ordena; rótulo "Cartão SUS" classificado por valor. Achado RT-02a (homônimos sem "chamo" fundem segmento). |
| RT-03 | `rt03-injecao-prompt.test.ts` (5 ✓) · `rt03-injecao-prompt.adv.ts` (1 ✗ / 2 guardados) | FEITA | Injeção não promove nada; ledger recusa sem revisão humana; script vira dado. Achado RT-03a (homóglifo/zero-width some em silêncio). |
| RT-04 | `rt04-negacao-unidades.test.ts` (11 ✓) · `rt04-negacao-unidades.adv.ts` (5 ✗) | FEITA | Negação da lista e "NÃO SEI" suprimem; Plaud exige confirmação. Achados RT-04a/b/c/d (incerteza vira fato; unidade some; milhar sem sinal). |
| RT-05 | `rt05-rads-cadeias.test.ts` (6 ✓) · `rt05-rads-cadeias.adv.ts` (4 ✗ / 2 guardados) | FEITA | Termo ativo com trecho-fonte; negação/antecedente anulam; PT08 como caso canônico. Achados RT-05a/b/c (negador incompleto dispara no PT08 NEGATIVO; sem cadeia; corpus não consumível; G-07 ausente). |
| RT-06 | `rt06-recist.test.ts` (12 ✓) · `rt06-recist-morfometria.adv.ts` (4 ✗ / 7 guardados) | FEITA | RECIST: PD exige 20%+5 mm; divergência/confirmação/nadir recusam; categoria candidata. Achados RT-06a/b/c/d (sem lesão nova, linfonodo, unidade/corte, morfometria v4 ausente). |
| RT-07 | `rt07-labs-salao.test.ts` (18 ✓) · `rt07-labs-salao.adv.ts` (2 ✗) | FEITA | Todas as fronteiras exatas; ausente=PENDENTE; portões distintos; porta é bula; fuso −03:00. Achado RT-07a (lab absurdo sem sinal de plausibilidade/unidade). |
| RT-08 | `rt08-prescricao.test.ts` (13 ✓) · `rt08-prescricao-dose.adv.ts` (6 ✗ / 5 guardados) | FEITA | −25% recusado; arredondamento único; sem peso PENDENTE→VERMELHO; contratos recusam ajuste sem motivo. Achados RT-08a…e (sem biblioteca de fichas, sem enforcement de status, sem AUC/mg/m², sem validador de infusão/antiemese, sem idade do dado). |
| RT-09 | `rt09-agentes-ork.test.ts` (23 ✓) · `rt09-agentes-ork.adv.ts` (3 ✗ / 2 guardados) | FEITA | Maestro null em desconhecido; ORK rejeita plano inválido/cíclico; G-10/G-13 bloqueiam dublê e letra. Achados RT-09a/b/c (ownership sem enforcement; agente→agente; contrato não usado no pipeline). |
| RT-10 | `rt10-memory-os.test.ts` (12 ✓) · `rt10-memory-os.adv.ts` (evidência histórica; reataque em WIP, NOT_RUN) | PARCIAL | Ledger append-only; hash conflitante NEGADO; conflito nunca some; proposta não substitui; determinístico. Reataque atualiza RT-10a para `conflitoCronologia(ClinicalFact[])` e RT-10c para `CaseSnapshot.stageHistory`; prova refeita, sem execução nesta entrega. RT-10b mantém avaliação própria. |
| RT-11 | `rt11-brain-os.test.ts` (6 ✓) · `rt11-brain-os.adv.ts` (4 ✗ / 1 ✓ base real) | FEITA | Ruleset inativo ⇒ PENDENTE; ragGRAFO com status explícito e sem aresta órfã no dado. Achados RT-11a/b/c/d (trial, dose-de-estudo, loader do grafo, fontes divergentes). |
| RT-12 | `rt12-harness-gateway.test.ts` (7 ✓) · `rt12-harness-gateway.adv.ts` (4 ✗ / 1 ✓) | FEITA | G-02 barra PHI textual; /acao autoriza por artefato assinado; replay 1×; 401/403 corretos; Origin externo recusado. Achados RT-12a/b/c (nome compacto em URL escapa; G-27; READ×WORLD_EFFECT). |
| RT-13 | `rt13-caixa-unica.test.ts` (14 ✓) · `rt13-caixa-unica.adv.ts` (2 ✗) | FEITA | PDF/imagem PENDENTE sem pedir foto; bomba/corrupção/macro inertes; vazio PENDENTE. Achados RT-13a/b (PDF digital sem conversor apesar do pdfjs-dist; Latin-1 vira PRONTO com mojibake). |
| RT-14 | `rt14-bombardeio.test.ts` (6 ✓) | FEITA | Volume controlado com orçamento declarado (2 s/200 MB) — tudo dentro (medições abaixo). Nenhuma falha. |
| RT-15 | `rt15-caso-completo.adv.ts` (3 ✗ / 3 ✓) | FEITA | Caso PT10 ponta a ponta: nenhuma conclusão silenciosa (✓); achados RT-15a/b/c (sem CONFLICT cisplatina×carboplatina; cN2 some; prednisona some). |
| RT-16 | `docs/w10/REDTEAM-ACHADOS.md` + este arquivo | FEITA | Tabela de 42 achados × severidade × dono; top 10; saídas reais abaixo. |

**Totais: 28 arquivos · 227 testes · 182 verdes · 45 vermelhos (todos em `.adv.ts`, todos achados intencionais).**
Nenhum teste de defesa (`.test.ts`) falhou; nenhuma expectativa foi ajustada para casar com o código.

## Saídas reais dos comandos de fechamento (copiadas)

### 1. `npx tsc --noEmit`
```
tests/redteam-w10/dose-prescricao-voz/prescricao-contratos.test.ts(80,12): error TS2532: Object is possibly 'undefined'.
```
Único erro restante está em `tests/redteam-w10/` — pasta **não rastreada** encontrada no worktree, **fora da minha faixa** (não editada, não commitada). Em `tests/redteam/` e `tests/fixtures/redteam/`: **0 erros**.

### 2. `npm run check:boundaries`
```
fronteiras ok (156 arquivos)
```

### 3. `npm run check:corpus`
```
corpus ok (30 arquivos)
```

### 4. `npx vitest run --config tests/redteam/vitest.config.ts --no-file-parallelism`
```
 Test Files  14 failed | 14 passed (28)
      Tests  45 failed | 182 passed (227)
```
Os 14 arquivos com falha são exatamente os `.adv.ts` (achados); os 14 `.test.ts` passam integralmente.

### 5. `npx vitest run tests/w3/auditoria-regressao.test.ts --no-file-parallelism`
```
 Test Files  1 passed (1)
      Tests  9 passed (9)
```

### 6. RT-14 · medições do bombardeio (orçamento declarado no próprio teste: 2 s / 200 MB)
```
✓ 20 operações × 50 eventos gravados, listados e projetados dentro do orçamento   834 ms
✓ segmentação de 200 pacientes numa gravação dentro do orçamento                   66 ms
✓ 500 eventos conflitantes no mesmo campo ⇒ VERMELHO estável, hash idêntico        55 ms
✓ documento de 5 MB lido e hasheado dentro do orçamento                           117 ms
✓ 10.000 caixas de revisão geradas e validadas dentro do orçamento                583 ms
✓ 8 requisições concorrentes ⇒ 1 EXECUTADA + 7 REPLAY (uma execução)               54 ms
Tests  6 passed (6)
```

## Observações para o tech lead

1. **`tests/redteam-w10/`** — pasta não rastreada no worktree com 1 arquivo com erro de TS (fora da minha faixa; não toquei). Se não for de outro executor, apagar ou reclamar a faixa.
2. **Divergência de forma (igual ao registro do Kimi)**: o prompt sugere rodar `tests/redteam/<arquivo>` direto; o Vitest raiz só inclui `*.{test,spec}.ts`, então a config dedicada `tests/redteam/vitest.config.ts` (dentro da minha faixa) inclui `*.test.ts` **e** `*.adv.ts`.
3. **Descoberta de sutileza do Vitest usada nas sondas**: `expect(undefined).not.toBeNull()` passa (undefined ≠ null) — todas as sondas SEM_IMPLEMENTACAO usam `toBeTypeOf("function")` para não dar falso "implementado".
4. `[VERIFICAR]` restantes: nenhum novo criado por mim (não é da faixa criar); os achados apontam `[VERIFICAR]` já existentes no corpus (rad-emergencia, interações) quando relevantes.
5. PEDIDOS: nenhum — nada fora da faixa foi necessário (não há `docs/w10/PEDIDOS-GLM.md` a criar; a pasta `tests/redteam-w10/` é o único ponto de atenção, item 1).
