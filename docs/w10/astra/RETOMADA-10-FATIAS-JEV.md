# Retomada das dez fatias + Jev no OncoAssist

Data: 2026-10-07. Autorização: Dr. Silas neste chat — instalar para uso pelo OncoAssist e avançar dez fatias do OncoGlobal com Fugu.
Base observada: `846be32d0777ef89559a5325fd352367e4bf781b`, branch `codex/w10-entrega-integrada`, worktree `w10-astra`.
WIP inicial preservado: instalação `@typesafe-ai/sdk@0.6.0` em package.json/package-lock.json.
O repositório canônico está ocupado pelo tech lead; seus arquivos não serão editados ou copiados em bloco. Fontes em planejamento permanecem íntegras.

## Territórios desta execução

| Dono | Escrita exclusiva |
|---|---|
| Codex / Jev | src/kernel/llm/jev/**, src/app/oncoassist.ts, tests/oncoassist-jev/** |
| Codex / servidor | src/server/rotas.ts, src/server/sessao.ts, src/app/revisaoExtracao.ts, tests/w10-eixo-servidor/** |
| Codex / temporal | src/kernel/projections/**, src/estatistica/**, src/rules/recist/**, tests/w10-eixo-temporal/** |
| Fugu CLI + cinco codificadores | novos tests/w10-fugu-eixo/** e docs/progresso/W10-FUGU-ADV-EIXO.md |
| Supervisor | este plano, integração serial, UI/consumidores após contrato publicado, correções após devolução do território |

Todos preservam WIP concorrente. Testes serializados pelo wrapper docs/w10/astra/validar.ps1. Sem push, deploy ou integração no repositório ocupado do tech lead.

## Dez fatias existentes — critérios desta retomada

| Fatia | Trabalho / critério |
|---|---|
| F01 Extração | Reatacar identidade, conflito, fonte, negação e ambiguidade; corrigir defeitos reproduzidos dentro do owner existente. |
| F02 Revisão/persistência | Nenhum FATO confirmado sem prova de conteúdo exibido na sessão, com escopo e hash; preservar rascunho e replay. |
| F03 Gateway | Regressão de autorização, PHI e falha; Jev com segredo backend, opt-in, entrada desidentificada e retorno validado. |
| F04 Sessão/temporalidade | Escopo consistente; data isolada não produz VERDE; ausência e conflito preservados. |
| F05 Brain/OncoAssist | Jev consumível pelo OncoAssist por rota autenticada e interface, como proposta documental tipada. |
| F06 Grafo/vetores | Revalidar recuperação atual com fontes e limites explícitos; não alegar índice vetorial inexistente. |
| F07 Longitudinal/RECIST | Reusar motor e manter avaliação proposta, sem inferir TNM ou progressão a partir de prosa. |
| F08 Estatística | Período clínico opcional, denominadores e exclusões, sem IDs no agregado. |
| F09 Caso integrado | Percurso sintético extração, exibição, confirmação, reabertura; OncoAssist com transporte simulado. |
| F10 Verificação | Gates focais, reataque independente, diffs e relatório com PASS/FAIL/PARCIAL/NOT_RUN. |

O documento de eixo atual identifica A1/G-25 e lab verde por data como bloqueios concretos. Eles têm prioridade sobre novas capacidades. A presença do SDK não demonstra acesso real ao Jev; chave ausente impede ensaio de rede, não implementação local.

Extensão de território do supervisor durante integração: src/ui/api/**, PainelOncoassist/TelaConsulta e entrada main-oncoassist; bootstrap src/app/oncoassistLocal.ts, sua configuração Vite e script; leitura de lote em src/server/leituras.ts; correções causais em extrator/segmenter/pipeline/ORK. A entrada real é oncoassist.html. Resultados finais em docs/progresso/W10-RETOMADA-JEV-FUGU.md.

## Evidência de Fugu

Invocação real CLI em 2026-10-07: modelo fugu, provider sakana, wire_api responses e image_generation desabilitada pelo wrapper existente. Resposta: FUGU_OK, ferramenta de subagentes disponível. Isso comprova resposta do provider, não execução das fatias.
