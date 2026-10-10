# W10 Fugu — provas adversariais do eixo

> Verificação posterior pelo supervisor Codex: os cinco arquivos foram executados em série fora do sandbox bloqueado e passaram após correções causais de produção. O bloco final `20261007-173531-735-RETOMADA-UI-SEGMENTER-FINAL.log` contém 52 arquivos / 217 PASS, incluindo todos os cinco arquivos Fugu. O NOT_RUN abaixo descreve exclusivamente a tentativa original da CLI. Detalhes e limites em `W10-RETOMADA-JEV-FUGU.md`.

Data: 2026-10-07. MODE WRITE autorizado por `docs/w10/astra/MISSAO-FUGU-RETOMADA.txt`.

## Escopo e linha de base

| Item | Evidência |
|---|---|
| Worktree | `C:\Users\silas\Projects\OncoGlobal-wt\w10-astra` |
| Branch / HEAD inicial | `codex/w10-entrega-integrada` / `846be32d0777ef89559a5325fd352367e4bf781b` |
| Remote | `origin` = `https://github.com/silasjuba-del/OncoGlobal.git` |
| Escrita permitida | Somente cinco novos arquivos em `tests/w10-fugu-eixo/**` e este relatório |
| Outros writers | WIP concorrente em `package.json`, `package-lock.json`, servidor, projeções, orquestração, Jev, UI e outros testes; não tocar |
| Entrega | WIP local, sem commit, push ou integração; testes sintéticos, sem dados reais |

## Cinco codificadores reais, donos exclusivos

| Codificador | ID | Arquivo / finalidade | Estado |
|---|---|---|---|
| 01 Kepler | `01a117ff-302c-7621-8842-16ef60ff3347` | `extracao.test.ts:1–152`: dois pacientes, fonte/negação/conflito, sem auto-vínculo | Arquivo entregue; teste NOT_RUN |
| 02 Noether | `01a117ff-58b9-7371-a1bd-8d720b141af7` | `revisao.test.ts:1–265`: percurso HTTP, 409/zero FATO antes da exibição exata; hash, sessão, escopo, replay e edição concorrente | Arquivo entregue; teste NOT_RUN |
| 03 Gauss | `01a117ff-8074-7e20-8291-266eca351aff` | `temporal.test.ts:1–133`: lab datado não é VERDE só por data, ausência e conflito | Arquivo entregue; teste NOT_RUN |
| 04 Locke | `01a117ff-a1ce-7b92-ae3f-c5763f29e63d` | `orquestracao.test.ts:1–97`: Maestro desconhecido/prototype `null`; ORK não amplia plano nem aceita composição inválida | Arquivo entregue; teste NOT_RUN |
| 05 Parfit | `01a117ff-b404-7e51-9b4d-6968fcaa2b09` | `phi.test.ts:1–260`: falhas HTTP/gateway sem PHI/segredo em saídas de erro e logs observáveis | Arquivo entregue; teste NOT_RUN |

## Validação serial e resultado

Cinco arquivos novos presentes, sem `it.skip`, `.only` ou `.todo`, com imports relativos apontando para arquivos existentes (checagem estática local, **não** compilação). A revisão dos arquivos ocorreu em série. Nenhum codificador executou teste. Foi tentado **somente** o wrapper compartilhado, após as cinco entregas:

```powershell
& '.\docs\w10\astra\validar.ps1' -Worktree 'C:\Users\silas\Projects\OncoGlobal-wt\w10-astra' -Rotulo 'FUGU-RETOMADA-ADV' -Testes @('tests/w10-fugu-eixo') -SoTestes
```

**Bloqueio observado antes do Vitest:** o sandbox desta sessão permite escrita apenas dentro de `w10-astra`; o wrapper precisa criar `C:\Users\silas\Projects\OncoGlobal-wt\_w5-locks\vitest.lock` e logs em `...\_w10-astra\logs`, fora da raiz autorizada. A chamada produziu:

```text
Exception calling "Open" with "4" argument(s):
"Access to the path 'C:\Users\silas\Projects\OncoGlobal-wt\_w5-locks\vitest.lock' is denied."
```

Não havia lock alheio visível na checagem; **não foi um `LOCK_OCUPADO`**, e não se removeu lock nem interrompeu processo. O wrapper não chegou ao `VITEST_ARGUMENTS`, `VITEST_EXIT` ou `LOG`; o `WRAPPER_EXIT=` vazio do shell invocador foi `$LASTEXITCODE` nulo após a exceção, **não** exit 0 de teste. Nenhum comando alternativo de teste/typecheck foi usado para contornar o lock.

| Gate | Estado / evidência |
|---|---|
| Cinco codificadores reais e arquivos exclusivos | **PASS** para presença/escopo de escrita; IDs acima |
| Imports relativos, sem testes pulados/focados | **PASS** apenas para checagem estática; não garante compilação |
| Wrapper compartilhado | **BLOCKED_SANDBOX_LOCK** antes de adquirir lock |
| Vitest `tests/w10-fugu-eixo` | **NOT_RUN**; 0 PASS e 0 FAIL *verificados*, não uma suíte verde |
| Typecheck, boundaries, corpus | **NOT_RUN**; `-SoTestes` os excluiria mesmo sem bloqueio |
| Defeitos causais reproduzidos | **Nenhum verificado**, pois não houve execução; não atribuir FAIL a hipótese estática |

## Alvos adversariais e limites

- `extracao.test.ts:35–113` exige separação por paciente, fonte e negação sem vínculo nem reconciliação cruzada; `:115–151` mantém conflito TNM realmente multifonte no mesmo escopo. Hipóteses de negação intrafrase ou agrupamento cruzado **UNVERIFIED**.
- `revisao.test.ts:117–265` usa rota HTTP real para exigir entrega do conteúdo exato, comprovante da sessão, recusa 409/zero FATO antes dela, recusa por hash/escopo e replay. Prova entrega via HTTP, **não** renderização visual nem leitura efetiva pelo médico; depende do WIP concorrente do servidor.
- `temporal.test.ts:45–132` usa `labSeries` e `projetarSnapshot` para exigir pendência sem critério de validade além da data e conflito preservado. A possível promoção por data e divergência de expectativa antiga são **UNVERIFIED** até o wrapper rodar sobre o estado estabilizado.
- `orquestracao.test.ts:25–96` testa chaves de prototype e composição inválida. A API pública não impede, por si, chamada direta entre callbacks de agentes; a prova limita-se ao que o ORK interpreta/executa.
- `phi.test.ts:52–260` testa respostas de falha, log estruturado HTTP e auditoria do gateway com dados sintéticos. Sucesso de prontuário **local** pode conter dados clínicos; não há cobertura de stdout/stderr, coletor externo ou transporte externo.

**Próximo gate externo necessário:** quando houver permissão de escrita nos diretórios de lock/log compartilhados e os writers estabilizarem suas interfaces, executar **o mesmo comando acima em série**. Se retornar `LOCK_OCUPADO` (75), aguardar moderadamente e repetir, sem remover o lock. Registrar então saídas reais, PASS/FAIL por arquivo e falhas causais com arquivo/linha; não suavizar expectativas para obter verde.

## Entrega e autoridade

Apenas `tests/w10-fugu-eixo/{extracao,revisao,temporal,orquestracao,phi}.test.ts` e este relatório são WIP produzido nesta missão. Outros arquivos modificados são de writers concorrentes e foram preservados. **Sem commit, push ou integração**, sem mudanças em produção, sem dados reais ou chamada externa. Testes novos e checagem estática não autorizam `AUDIT_APPROVED`, `PRODUCTION_READY` ou `CLINICALLY_APPROVED`.
