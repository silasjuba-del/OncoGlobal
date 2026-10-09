# L1 · Matriz R-34 — entrega parcial

## GOAL e estado

Faixa: matriz de rastreabilidade Q/A/D-W5/D-W8/D-W9/FN/G/T da F0, teste do verificador e evidências L1. Worktree `C:\Users\silas\Projects\OncoGlobal-wt\f0f-luna1`, ramo `f0/f0f-luna1`, base inicial `369db84732ab5a46283a2356bd85eb656916f009`. Remote observado: `origin https://github.com/silasjuba-del/OncoGlobal.git`.

**Estado: PARCIAL / GOAL de fechamento não concluído.** A matriz possui 273/273 IDs, mas ainda contém 107 linhas `VERMELHO — PENDENTE_DE_MAPEAMENTO`. A prova de consistência estrutural passou; ela não prova fechamento funcional da F0. Não reivindico que os 107 vermelhos sejam 107 ausências de produto: muitos são elos dono/consumidor/teste ainda não reconciliados e precisam revisão em C.

| Critério | Resultado |
|---|---|
| Cobertura e unicidade dos IDs normativos | PASS na execução registrada abaixo: 273/273 |
| Referências a arquivos e nomes de teste | PASS nas duas asserções executadas |
| Linhas F0 sem evidência não passam a verdes | PARCIAL: verificador conserva 107 vermelhos como pendências explícitas |
| Fechamento sem vermelho/pendência F0 | NOT_RUN: asserção adicionada após a execução; não alegar fechamento |
| GOAL de R-34 sem lacunas F0 | NÃO CONCLUÍDO |

## Prova e saídas reais

Geração da matriz: `node scripts/matriz-f0.mjs --write`

```text
Matriz gravada em docs/MATRIZ-RASTREABILIDADE-F0.md
```

Validação da matriz: `node scripts/matriz-f0.mjs`

```text
Linhas=273/273; VERDE=114; VERMELHO=107; N-A=52
```

Prova executada com TEST_SLOT: `npx vitest run tests/f0-fecha/matriz.test.ts --no-file-parallelism --maxWorkers=1`.

Primeira execução, antes da correção do parser de pipes escapados e da classificação de Q36:

```text
Test Files  1 failed (1)
Tests       2 failed (2)
Falhas: linhas Q06, Q08, Q11 e G-04 lidas incorretamente quando havia pipes escapados; Q36 foi classificado F0 embora a prova fosse consumidor de teste APAC F4.
```

Após corrigir o parser para não dividir pipes escapados e classificar Q36 como F4 com R-22, a segunda execução foi:

```text
Test Files  1 passed (1)
Tests       2 passed (2)
Duration    1.88s
```

Depois dessa execução, acrescentei uma terceira asserção, `só fecha R-34 quando não restar linha F0 vermelha ou pendente`, que exige `result.red === 0`. **NOT_RUN**: não rodei novamente o arquivo após acrescentá-la. A matriz reporta 107 linhas vermelhas; portanto esta entrega não passa pelo critério de fechamento. Os 2 PASS anteriores verificam somente estrutura, contagem, referências e a preservação de linhas vermelhas; não demonstram a asserção nova nem fechamento da F0.

## Lacunas causais para C

- **Q50 / E6b:** falta prova HTTP/SQLite real da jornada completa. A evidência recebida da L2 descreve que `/consulta/rascunho/reconciliar` mantém laboratórios de duas fontes em segmentos distintos e retorna `conflict:false`/`conflitos:[]` antes da confirmação; depois da confirmação a leitura mostra conflito. Não há resolução médica explícita que preserve o histórico. A correção C2 não está provada nesta worktree.
- **Q11:** há funções e testes separados de Maestro e ORK, mas não foi localizada chamada de produção que encaminhe `maestro(evento)` para `executarOrk(plano)`. A linha segue vermelha.
- **D-W9-78:** o manifesto de fechamento inclui Flash no F0; falta evidência integrada do modelo padrão do médico e do prazo visível do retorno. Não usei evidência futura de L4 como entregue.
- **G-06 / T-48:** mapeei `BannerE1` → `TelaConsulta` e a prova de UI `tests/ui/banner-e1.test.tsx`. Há também separação declarativa E1 da evolução no teste K-12. Isso é prova parcial/sintética; falta o positivo/negativo T-48 para bloqueio do documento e destaque na folha operacional em percurso real, sem impedir a tela.
- **Outros vermelhos:** mantidos como `PENDENTE_DE_MAPEAMENTO` até revisar imports, reexports, barrels e consumidores. O estado não declara ausência de funcionalidade. Itens de APAC/canal/cumulativos/interações têm que respeitar R-28: prova de núcleo F0 não significa integração F1–F4 entregue.

## Ajustes feitos

- Matriz cobre 273 IDs, preserva D-W9-23a/23c/34c como linhas próprias além dos pais, restringe ORGANIZACIONAL a Q01/Q02/Q03/Q51 e apresenta a lista completa de vermelhos.
- O parser do verificador ignora `|` escapado dentro das células Markdown, sem perder IDs/testes que documentam mais de uma evidência.
- Q36 passou a F4 por R-22 (ApacBatch operacional em lote); a evidência de teste modular não foi usada para alegar consumidor de runtime F0.
- G-06/T-48 aponta para o banner e seu consumidor reais, mantendo explícito o limite da evidência e a pendência do gate T-48.
- `scripts/matriz-f0.d.mts` é companion de tipos autorizado pela Astra para import TypeScript do verificador `.mjs`.

## Limites e próximo passo

Não rodei TSC, suíte ampla, nem qualquer teste além do arquivo L1. A contagem A6 herdada (2.240 testes regulares, 240 redteam, 41 W8) não prova as linhas desta matriz; é apenas contexto da base, com HEAD A6 ancestral ao HEAD L1. A matriz precisa ser atualizada sobre a integração em C, com novas provas L2/L3/L4, e a asserção de fechamento deve ser executada somente depois de não restarem vermelhos F0.

Commit único planejado: `F0F-L01: matriz de rastreabilidade R-34`. Hash será preenchido após o commit. Sem push/merge.
