# Reataque dos achados de escopo da auditoria

Fonte: `AUDITORIA-CLAUDE-PRELIMINAR.md`, Claude Sonnet 5.5, leitura independente de `f4c4cb0`. Não houve ALTO nessa leitura parcial; M1/M2 foram confirmados por inspeção e corrigidos pela Astra.

## M1 — lote pertence ao paciente

`/consulta/contexto/selecionar` invalida o contexto anterior e exige que lote não nulo pertença ao paciente no ledger. Lote inexistente ou de outra pessoa retorna `TUMOR_LOT_FORA_DO_PACIENTE`. As rotas de salvar/preparar Flash também recusam qualquer erro da leitura clínica; não substituem erro por resumo vazio. A prova cobre sessão forjada/antiga como defesa independente da seleção.

## M2 — origem do draft obrigatória

A exibição recusa draft sem encontro/lote explícitos (`DRAFT_CONTEXTO_AUSENTE`). A confirmação verifica novamente, inclusive se houver recibo antigo colocado na sessão pela fixture adversarial. Contexto pode ser o envelope estruturado ou os campos legados explícitos; ausência não é preenchida pelo pedido. A omissão do lote no pedido significa `null`, sem dispensar a comparação com a origem.

## Provas e adequação de fixtures

`tests/f0-fecha/auditoria-escopo.test.ts` acrescenta as duas provas negativas. A primeira execução preservada em `AUDITORIA-escopo-01.log` identificou fixtures positivas antigas sem origem declarada. As três fixtures de servidor e a jornada E2E agora fornecem encontro/lote explicitamente; nenhuma asserção de segurança foi removida ou afrouxada. A igualdade do payload genérico foi ampliada para exigir também o contexto. O cleanup de `server.test.ts` fecha o SQLite mesmo quando uma asserção falha, evitando que EPERM masque a falha original.

- `AUDITORIA-escopo-02.log`: 17 arquivos / 87 testes PASS (servidor, novos ataques, Flash, E6b e retomada).
- `AUDITORIA-escopo-e2e.log`: jornada E2E anterior 1/1 PASS.
- `AUDITORIA-typecheck.log`: TypeScript PASS.
- `AUDITORIA-fronteiras.log`: 299 arquivos PASS.

Falta o reataque independente no commit destas correções e a bateria final integrada. B1/B2/B3 da auditoria inicial permanecem como observações com os limites descritos pelo auditor; não foram convertidas em alegação de segurança universal.
