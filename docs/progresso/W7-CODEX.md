# W7-CODEX — extensão UI/Pesquisa

Data: 05/10/2026, America/Sao_Paulo. Base: 12b5dcd4ced28ca87f004c550c6bf7b68977ae30.
Branch: f0/w7-codex. Raiz: C:/Users/silas/Projects/OncoGlobal-wt/w7-codex.

Entrega local em dez fatias, com três agentes GPT-6 Luna em paralelo e revisão/validação pelo orquestrador. IA real e integração canônica permanecem explicitamente pendentes. Entrada executável: node scripts/iniciar.mjs.

| Fatia do pedido | Estado | Evidência / limites |
|---|---|---|
| 01 Cockpit/navegação | FEITA | Hospital/paciente/ferramentas, acordeões, modais, navegador responsivo |
| 02 Oncoboard | FEITA | Três personas corretas, 24 instruções específicas cada; provider DISABLED |
| 03 Incorporação | FEITA | TXT/MD/JSON, SHA-256, texto integral e anexos locais; OCR NOT_RUN |
| 04 Resumo/critérios | BLOQUEADO_DEPENDENCIA para IA | Extração local e revisão versionada FEITAS; gate DLP/provedor ausentes |
| 05 Cruzamento | FEITA | Paciente/fonte/versão, AND/OR, unidades, datas, conflitos; somente POSSIBLE_MATCH/PENDENTE/SEM_MATCH |
| 06 Seguimento | FEITA | Alocação documentada, CTCAE v6 manual, imagem, evento e resposta informada |
| 07 Persistência | FEITA | SQLite WAL, revisão, RAW, conflitos; reinício e leitura por outro processo |
| 08 Kit | FEITA | Cinco templates literais, páginas físicas 1–5, itens e grade; acentuação VERIFICAR |
| 09 APAC/impressora | FEITA no âmbito local | Prévia, Gateway/idempotência/preferência; assinatura/driver/homologação NOT_RUN |
| 10 Composição/validação | FEITA | HTTP loopback autenticado, testes, build, navegador e handoff; sem push |

Não se declara a conclusão das dez CDX originais de infraestrutura W7. CDX-05/06 receberam as extensões aplicáveis. Agenda/salão/leitura canônica, integração Cursor e assinatura continuam dependências.

## Commits locais

Ordem de dependência do código; UI consolidada no último commit. Validação conjunta após trabalho paralelo, sem alegar homologação individual dos snapshots intermediários.

| Commit | SHA | Conteúdo |
|---|---|---|
| 01 | cb87389 | base e plano das dez fatias |
| 02 | 8b5d673 | tres personas detalhadas com rascunhos e citacoes verificadas |
| 03 | f222ab2 | ingestao documental local com fontes e hashes |
| 04 | d93baa9 | revisao medica versionada dos criterios de estudo |
| 05 | bc5583b | cruzamento conservador de criterios e dados do paciente |
| 06 | f1ef7a5 | seguimento por estudo paciente e braco |
| 07 | cd2acaa | workspace SQLite com conflitos e historico preservados |
| 08 | 4c7a723 | kit medico literal e laudo APAC rastreavel |
| 09 | 9038c14 | impressao local idempotente e preferencia do medico |
| 10 | HEAD — W7-CODEX-10 | Composição, UI, testes de sistema e documentação |

Arquivos apenas nas faixas W7/adendo. Package, contratos, componentes existentes e faixas Fugu/Cursor intactos. Patch opcional de comando verificado e não aplicado.

## Artefatos

- docs/w7/COMO-EXECUTAR.md — execução e fluxos.
- docs/w7/VALIDACAO-UI-PESQUISA.md — evidências e limites.
- docs/w7/VERIFY-FINAL.txt — saída real integral.
- docs/w7/exemplo-estudo.json — fixture sintética, sem estudo real inventado.
- docs/w7/fluxo-browser.js — 12 verificações de navegador.
- docs/w7/kit-preview — fonte APAC rasterizada e HTML conferido visualmente.

## Saída real do último verify

```text

> oncoglobal@0.0.1 verify
> npm run typecheck && npm run check:boundaries && npm run check:corpus && npm test -- --no-file-parallelism


> oncoglobal@0.0.1 typecheck
> tsc --noEmit


> oncoglobal@0.0.1 check:boundaries
> node scripts/check-boundaries.mjs

fronteiras ok (101 arquivos)

> oncoglobal@0.0.1 check:corpus
> node scripts/validate-corpus.mjs

ARQUIVO                                               | HEADER     | [VERIFICAR] | ATIVOS
--------------------------------------------------------------------------------------------
corpus/capabilities.v1.json                           | ok         | 32          | 0     
corpus/packs/colorretal.v1.json                       | ok         | 6           | 0     
corpus/packs/mama.v1.json                             | ok         | 6           | 0     
corpus/packs/prostata.v1.json                         | ok         | 6           | 0     
corpus/packs/pulmao.v1.json                           | ok         | 6           | 0     
corpus/rulesets/apac.v1.json                          | ok         | 2           | 0     
corpus/rulesets/canal-redflags.v1.json                | ok         | 7           | 0     
corpus/rulesets/dose.v1.json                          | ok         | 0           | 0     
corpus/rulesets/interacoes.v1.json                    | ok         | 5           | 0     
corpus/rulesets/lab-thresholds.v1.json                | ok         | 19          | 3     
corpus/rulesets/prazos.v1.json                        | ok         | 1           | 0     
corpus/rulesets/rad-emergencia.v1.json                | ok         | 22          | 0     
corpus/rulesets/salao-triagem.v1.json                 | ok         | 0           | 0     
corpus/templates/evolucao.v1.json                     | —          | 0           | 0     
corpus/templates/folha-operacional-salao.v1.json      | —          | 0           | 0     
corpus/templates/kit/apac-laudo.v1.json               | ok         | 9           | 0     
corpus/templates/kit/orientacao-nutricional.v1.json   | ok         | 0           | 0     
corpus/templates/kit/receita-sintomaticos.v1.json     | ok         | 0           | 0     
corpus/templates/kit/relatorio-pericial.v1.json       | ok         | 0           | 0     
corpus/templates/kit/requisicao-exames-ciclos.v1.json | ok         | 0           | 0     
corpus/templates/kit/sinais-alarme.v1.json            | ok         | 0           | 0     
corpus/templates/laudo-judicial.v1.json               | —          | 0           | 0     
corpus/templates/pedido-exame.v1.json                 | —          | 0           | 0     
corpus/templates/receita.v1.json                      | —          | 0           | 0     
corpus/templates/resumo-14.v1.json                    | —          | 15          | 0     
corpus/templates/sinais-alarme.v1.json                | —          | 1           | 0     

corpus ok (26 arquivos)

> oncoglobal@0.0.1 test
> vitest run --no-file-parallelism


 RUN  v5.0.3 C:/Users/silas/Projects/OncoGlobal-wt/w7-codex


 Test Files  64 passed (64)
      Tests  397 passed (397)
   Start at  22:30:13
   Duration  69.71s (environment 45%, import 30%, tests 18%, transform 5%, worker 2%)

     Import  160 modules were evaluated 468 times · 15.35s total, 30% of tracked time
             ~10.10s faster with isolate: false — shared modules are evaluated once per worker instead of once per file
             learn more: https://vitest.dev/guide/improving-performance#test-isolation
```

Build Vite SSR aprovado: 29 módulos. A regressão anterior está incluída no conjunto verde.

## Pendências

LLM/OCR, importação automática de fatos do ledger, shell/API Cursor, assinatura clínica real, exportação oficial SIA, driver e homologação institucional do APAC. Nenhuma mensagem enviada, inclusão em estudo real, push ou deploy. Perfil institucional/profissional começa como PENDENTE/exemplo.
