# W2 · GLM — Relatório final

Worktree: `C:\Users\silas\Projects\OncoGlobal-wt\w2-glm` · Branch: `f0/w2-glm` · Base: `f0/w1-integrado` (merge efetuado em 2026-10-05, sem conflitos).

## Fatias

| Fatia | Estado | Commit | Verify | Pendências / [VERIFICAR] |
|---|---|---|---|---|
| GLM-01 · loader de corpus | FEITA | `107f4b6` | 129 ok | — |
| GLM-02 · lab-thresholds.v1 | FEITA | `6e3a660` | 134 ok | 19 analitos inativos aguardam limiar/unidade/fonte do Dr. Silas |
| GLM-03 · rad-emergencia.v1 | FEITA | `a5f5cc9` | 139 ok | naturezaAlerta dos 22 termos é **provisória/estrutural**; sinônimos vazios; tudo `ativo:false` até curadoria |
| GLM-04 · canal-redflags.v1 | FEITA | `1ac9f3a` | 143 ok | lista final e respostas fixas = Dr. Silas (pendência 0.8-3) |
| GLM-05 · interacoes.v1 | FEITA | `7211b13` | 147 ok | 4 sementes sem mecanismo/severidade/manejo (null) até fonte com trecho |
| GLM-06 · packs lote 1 | FEITA | `ace2f3c` | 151 ok | estadiamento/labs/imagem/biomarcadores/protocolos vazios; sigtap "[VERIFICAR]" |
| GLM-07 · templates (7) | FEITA | `b6d061a` | 155 ok | títulos dos 14 blocos do resumo-14 são "[VERIFICAR]" (BASE §42 não está no repo); lista de sinais de alarme pendente |
| GLM-08 · check:corpus | FEITA | `86cbb42` | 155 ok | prova negativa: arquivo temporário inválido → exit 1 (2 problemas detectados), removido em seguida; corpus atual roda limpo (20 arquivos) |
| GLM-09 · sigtap-import | FEITA | `af032a7` | 160 ok | formato oficial do CSV é parâmetro [VERIFICAR]; nenhum código real incluído; CLI testada com CSV sintético e artefato apagado |
| GLM-10 · capabilities.v1 | FEITA | `40fa9cf` | 165 ok | trigger e wiring (extractor/rulesetRef) de todos os agentes = "[VERIFICAR]"/null até a tabela do Maestro; dono = "[VERIFICAR]" |

## Arquivos criados

- `src/kernel/corpus/loader.ts` · `tests/corpus/loader.test.ts`
- `corpus/rulesets/{lab-thresholds,rad-emergencia,canal-redflags,interacoes}.v1.json` + testes correspondentes
- `corpus/packs/{pulmao,mama,colorretal,prostata}.v1.json` · `tests/corpus/packs.test.ts`
- `corpus/templates/{evolucao,receita,pedido-exame,resumo-14,sinais-alarme,laudo-judicial,folha-operacional-salao}.v1.json` · `tests/corpus/templates.test.ts`
- `scripts/validate-corpus.mjs` · script `check:corpus` no package.json
- `scripts/sigtap-import.mjs` (+ `sigtap-import.d.mts`) · `tests/corpus/sigtap-import.test.ts`
- `corpus/capabilities.v1.json` · `tests/corpus/capabilities.test.ts`

## Saída real do último `npm run verify`

```
> oncoglobal@0.0.1 verify
> npm run typecheck && npm run check:boundaries && npm test
fronteiras ok (23 arquivos)
 Test Files  18 passed (18)
      Tests  165 passed (165)
```

`npm run check:corpus` adicional: `corpus ok (20 arquivos)`.

## Pendências [VERIFICAR] consolidadas

1. **BASE §42 não está no repo** — os 14 blocos do resumo-14 estão com título "[VERIFICAR]". Preciso da lista do tech lead.
2. **naturezaAlerta do rad-emergencia** — classifiquei AMEACA_IMEDIATA/REVISAO_URGENTE de forma estrutural e provisória (tudo inativo). Dr. Silas deve confirmar.
3. Trigger dos agentes (chaves da tabela do Maestro), dono de cada capacidade e wiring extractor/rulesetRef.
4. Limiares/unidades dos 19 analitos inativos do lab-thresholds; mecanismo/severidade das interações; respostas fixas do canal; conteúdo dos packs; formato real do CSV SIGTAP.

## Perguntas ao tech lead

1. Item-level `fonte`: padronizei como objeto `{tipo, referencia, trecho, edicao}` (igual ao header) em lab-thresholds/interacoes/packs, mas rad-emergencia/canal-redflags usam string "[VERIFICAR]" conforme literal da fatia — quer unificar?
2. `check:corpus` não entra no pipeline `verify` (a fatia só autorizava adicionar o script). Quer que o CI (`.github/workflows/verify.yml`) o execute?
3. Templates sem header G-17 (shape da fatia não prevê) — o validate-corpus os trata como "não-ruleset" (coluna "—"). Confirma?
4. AG-15 marcado TESTED com base nos testes verdes pós-merge (FN-01/02/03/06/09); AG-07 ficou SPECIFIED pois FN-15/FN-26 não existem. Confirma o critério "agente inteiro testado"?
