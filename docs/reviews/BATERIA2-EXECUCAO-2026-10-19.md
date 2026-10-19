# Bateria 2 — execução adversarial e correções

Dados exclusivamente sintéticos. Escritor: Codex; revisão independente em contexto separado. Sem integração na main ou alteração nas worktrees do Cursor.

## Base e preservação

Worktree: `C:/Users/silas/Projects/OncoGlobal-wt/codex-bateria2-correcoes-20261019`.
Branch: `codex/bateria2-correcoes-20261019`.
Base integrada isoladamente: `af998a3` (merge de Cursor `0b00a40` e correções F2 `bb01d41`).
Main protegida: `6c1c6d3`. Backup dos nove arquivos WIP do Cursor e manifesto SHA-256: `C:/Users/silas/Projects/OncoGlobal-backups/bateria2-20261019-implementation`.
Nenhum reset, clean, stash, exclusão de branch ou reescrita do histórico.

## Resultado por caso

| Caso | Prova executada | Resultado e limites |
|---|---|---|
| 5A | Preparar/confirmar v1; preparar v2; tentar ambas; receber “ok”; tentar v2 novamente; inspecionar autorizações e executor sintético | Política vigente preservada: nova versão invalida o envio anterior e exige confirmação nova. Nenhum rascunho sai; v1 permanece no histórico. O aceite literal do anexo, reenviar v1, continua PENDENTE DE DECISÃO DO DR. SILAS. Não alterar automaticamente. Prévia real no aparelho não foi testada. |
| 5B | Dois médicos sintéticos; 40→80 e negação; tentativa sem confirmação; confirmação por B; transporte capturado e autorizações por versão | Texto enviado coincide com texto aprovado; versões e autores separados. Não houve envio real. |
| 6A | Relato, retratação, reabertura SQLite, desmontagem/remontagem da tela real via HTTP, decisão médica; correção de decisão anterior; novo relato | Relato e retratação visíveis no salão antes da triagem. Arquivamento/processamento não são decisão médica. Fonte/hash exatos exigidos; decisão anulada reabre; novo relato não herda revisão. Não se cria alergia confirmada, diagnóstico ou bloqueio de tratamento. |
| 6B | Cadastro com outra alergia e prescrição assinada, expressão coloquial | Pendência documental aparece independentemente do cadastro/prescrição. Agente causador fica não confirmado; não atribuímos oxaliplatina ao texto “remédio da veia”. |
| 7A | Contrato de exposição externa sem unidade; fármaco divergente; origem verbal e histórico incompleto | Unidade/fármaco ausentes ou divergentes recusados pelo contrato; origem verbal preservada e total completo permanece pendente. Não converter mg em mg/m² usando SC atual nem somar epirrubicina como doxorrubicina. Não foi construída nova tela de importação documental. |
| 7B | Registro canônico de 102, 102 e 45,9 mg; SC histórica 1,70 com fonte; SC posterior 1,62; projeção e componente real | Quantidades efetivas decimais preservadas; total local 147 mg/m². SC nova não recalcula o passado. Histórico externo separado; ausência de SC/proveniência deixa total pendente. Não inferir completude longitudinal nem alterar arredondamento/limites do protocolo. |
| 8A | IDs diferentes, duas doses 64 mg | Dois eventos canônicos; total 128 mg; aviso de múltiplas administrações do mesmo item/ciclo sem descartar bolsa. Baixa física de estoque não demonstrada: estoque atual é informativo. |
| 8B | Replay com novo horário de recebimento; mesmo ID/dose diferente; unidade ausente; mL sem concentração; conversão documentada | Replay devolve evento original; conteúdo divergente é conflito. Ausência de unidade gera pendência visível. mL exige concentração da solução final e fonte; divergência entre medida e mg recusada como dado inconsistente. Nenhuma faixa clínica foi inventada para dose “implausível”. |

## Falhas reproduzidas e correções

Primeira execução: 5 testes, 4 falhas e 1 aprovação. Falharam: referência de prescrição fabricada aceita; tabela F3 fora do ledger canônico; sucesso falso com mesmo ID e dose diferente; dose fracionária rejeitada. Replay com novo horário de recebimento já passava no helper antigo.

O wrapper F3 agora chama o mesmo duto da rota HTTP, com sessão, consulta selecionada, prescrição assinada e ciclo/item reais. A gravação é transacional no ledger existente. Fonte da administração acompanha a fonte técnica. A tabela F3 antiga fica preservada; registros ainda sem reconciliação geram aviso e não são promovidos silenciosamente.

Idempotência considera conteúdo clínico, incluindo horário real da infusão, fonte, unidade e SC. O horário de recebimento fica fora. Mesmo ID com conteúdo alterado não ganha sucesso. IDs distintos continuam distintos. Repetições históricas exatas contam uma vez; conflitos ficam pendentes.

A quantidade observada aceita decimais no contrato, avaliação F3, base do próximo ciclo e cumulativo. A soma do avaliador em mg usa representação decimal e mantém o comparador original `>` e todos os limites anteriores. Isso é correção aritmética, não mudança clínica.

A localização de relatos sobre infusão é uma seleção documental conservadora, não um diagnóstico ou classificador completo. Mostra texto e fonte para revisão humana. O ingresso IMAP sem identidade verificada continua na fila de vínculo; não foi associado ao paciente apenas por From. A prova de tela usou canal sintético com vínculo explícito.

## Revisão independente

Achados adicionais reproduzidos e corrigidos: legado sem fonte no envelope removido do subtotal; dupla soma de adminId histórico; campo F3 ainda inteiro; revisão substituída escondendo relato; overflow intermediário na conversão decimal. Regressões incluídas. Corpus e política de saída F2 preservados.

## Validação

- Bateria2 final: **22/22 testes, 5 arquivos**, incluindo tela real + HTTP + SQLite reaberto.
- Bateria2 + regressões aritméticas W3: **95/95**.
- Recorte bateria2/F3/dutos: **60/60** antes da ampliação final de regressões.
- Tipagem, fronteiras (478 arquivos, zero exceções), corpus (241 JSONs) e build da UI: aprovados.
- PHI final após stage explícito: **14/14**. A primeira execução geral detectou corretamente diferença entre índice e arquivos ainda em edição; o scanner foi repetido sobre os arquivos selecionados, sem afrouxar a checagem.
- Suíte geral: 496 arquivos, 4.063 testes aprovados; 3 falhas durante a edição (revisão substituída, índice PHI ainda não staged e contagem da nova rota). As três tiveram correção/reteste específico. Um worker Windows encerrou inesperadamente em `tests/server/bundle.test.ts`; o arquivo está sendo reexecutado isoladamente. A execução geral inicial não é apresentada como integralmente verde.
- Auditoria9–12 separada: **4 passaram, 3 falharam**; requisitos não implementados no escopo audit_only.
- Preservação: HEAD/status das quatro raízes verificadas e hashes dos nove arquivos WIP do Cursor idênticos ao manifesto inicial.

Logs locais ficam no diretório de backup, fora do repositório.

Comandos reproduzíveis:

- `npx vitest run tests/bateria2 --maxWorkers=1`
- `npx vitest run tests/f2 tests/f3 tests/f1/s10 tests/w3 --maxWorkers=2`
- `npm run typecheck`
- `npm run check:boundaries`
- `npm run check:corpus`
- `npx vitest run --maxWorkers=2`

## Limites clínicos e de entrega

Não há aprovação clínica, envio real a pacientes, instalação em produção ou merge na main. Limiar, conduta ou prazo novo exige validação médica. Caso5A mantém decisão pendente explícita; a falha da expectativa do anexo não foi escondida como aprovação.

O requisito de três colunas planejado/prescrito/administrado já existe na avaliação F3; esta fatia corrige o registro e a exposição efetiva. Não completa automaticamente toda a jornada operacional ou o estoque físico.

A auditoria9X–12X está em documento separado, com testes próprios deliberadamente vermelhos para requisitos ainda ausentes. Não foi usada para aprovar fechamento F3–F6.
