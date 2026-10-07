# W10-LUNA3 — corpus com fonte, versão e estado

- Executor/base: Luna3, worktree `w10-luna3`, branch `f0/w10-luna3`, base `04b53db31598fb80ff78192d4cd3eafde36428fd`.
- Estado: implementação local das F05/F06 pronta para wrapper serial e revisão de integração. Nenhum commit feito; aguarda evidência do wrapper antes de fechar `W10-LUNA3-01/02`.
- Escopo: somente `corpus/{glossario,regulatorio,receitas,redflags}/**`, `tests/w10-luna3/**`, este relatório e `docs/w10/PEDIDOS-LUNA3.md`.

| Fatia | Entrega | Contagem/estado |
|---|---|---|
| F05 · W10-LUNA3-01 | Glossário estrito `CaixaNumerada` | 47 caixas: números 1–16 (`config.*`) e 101–131 (`apac.*`); 47 registros de fonte externa por número; valores atuais ausentes do corpus |
| F05 · W10-LUNA3-01 | Regulação | 0 entradas ativas; nenhum `padrao`; 12 candidatos `[VERIFICAR]` em arquivo separado e sem forma compatível com `TabelaRegulatoria` |
| F06 · W10-LUNA3-02 | Receitas comuns | 47 fichas e 56 receitas do ragGRAFO; dados de origem preservados, confiança original mantida, versão da fonte marcada `NAO_INFORMADA`; todas `RASCUNHO`, não aprovadas e não consumíveis |
| F06 · W10-LUNA3-02 | Prescrição por toxicidade | 16 seções da fonte original copiadas byte a byte (SHA-256 registrado); todas RASCUNHO, CTCAE v6 ainda não verificado; diferença histórica difenidramina × D-W9-34c/prometazina explícita e preservada |
| F06 · W10-LUNA3-02 | Red flags | Exatamente 25 sinais, ids e trechos/localizadores; texto final pendente; nenhuma comunicação/conduta automática; febre estritamente `> 37,8 °C` |

## Fontes regulatórias verificadas em 2026-10-07

A página oficial da Anvisa “Lista de substâncias sujeitas a controle especial no Brasil” estava atualizada em 13/07/2026 e apontava a RDC nº 1.036/2026 como versão vigente naquele histórico. A página de normas consolidadas identifica a RDC 471/2021 e a IN específica de antimicrobianos; o texto oficial da RDC 471 delimita a aplicação a substâncias listadas em instrução normativa e seu escopo de prescrição/dispensação. Isso confirma o enquadramento regulatório geral, mas não a classificação individual dos 12 candidatos. Por isso, a tabela consumida pelo classificador permanece vazia; as pendências não podem ser carregadas como entradas.

- [Lista de substâncias sujeitas a controle especial — Anvisa](https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/controlados/lista-substancias)
- [Normas consolidadas: RDC 471/2021 e IN de antimicrobianos — Anvisa](https://www.gov.br/anvisa/pt-br/assuntos/noticias-anvisa/2021/anvisa-publica-normas-consolidadas)
- [Texto da RDC 471/2021 — BVS/MS](https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2020/rdc0471_23_02_2021.pdf)

## Verificação

- `NOT_RUN`: `npx.cmd tsc --noEmit`.
- `NOT_RUN`: `npm.cmd run check:boundaries`.
- `NOT_RUN`: `npm.cmd run check:corpus`.
- `NOT_RUN`: `npx.cmd vitest run tests/w10-luna3 --no-file-parallelism`.
- `NOT_RUN`: `npx.cmd vitest run tests/w3/auditoria-regressao.test.ts --no-file-parallelism`.
- Os testes Luna3 foram criados em `tests/w10-luna3/corpus.test.ts` para validar strictness e unicidade do glossário, separação de pendências regulatórias, ausência de promoção de receita, hash/cópia fiel da fonte e cobertura 25/25; não foram executados a pedido do coordenador, que fará a validação em série pelo wrapper W10.

## Limites e dependências

- `src/apac` ainda define `Apac.campos` como `Record<string, unknown>`; o glossário não pretende validar valores APAC. Ver P-01/P-02.
- A tabela regulatória pode classificar somente após revisão oficial individual e mapeamento de tipo documental. Desconhecido segue `PENDENTE`, sem `SIMPLE` padrão.
- D-W9-28 adota os 25 sinais como base, mas mantém os textos finais em aberto. Ação e cópia de origem ficam rastreáveis; biblioteca está desativada até revisão.
- A fonte de toxicidades tinha R1 com difenidramina; a decisão posterior D-W9-34c determina o padrão local com prometazina VO. A origem não foi alterada e o envelope aponta a divergência.
- Pedidos de integração/contexto estão em `docs/w10/PEDIDOS-LUNA3.md`.


## Evidencia executada pela raiz - 2026-10-07

Primeiro Vitest revelou parenteses incorretos em dois matchers novos; correcao manteve as contagens exigidas (16 config/31 APAC). Testes separados por fatia em catalogos.test.ts e receitas-redflags.test.ts, sem mudar expectativas.

Validacao `LUNA3-FATIAS-SEPARADAS`: typecheck exit 0; fronteiras ok (174 arquivos); corpus ok (98 arquivos); **3 arquivos / 13 testes PASS**, exit 0 (4 corpus + 9 W3). Nenhuma classificacao regulatoria ou receita foi promovida em funcao de PASS tecnico.

Log: `C:\Users\silas\Projects\OncoGlobal-wt\_w10-astra\logs\20261007-031811-870-LUNA3-FATIAS-SEPARADAS.log` e arquivos de saida associados. Root revisou escopo e separacao de pendencias antes dos commits.
