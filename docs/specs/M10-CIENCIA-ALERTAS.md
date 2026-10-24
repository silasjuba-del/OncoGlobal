# M10 — Assinatura exige ciência de todo alerta vermelho exibido

Estado: **IMPLEMENTADO** (PR em rascunho, sem merge). Decisões do Dr. Silas em 24/10/2026: Q1 = só alertas vermelhos; Q2 = recusar vermelho novo não exibido. Não é aprovação clínica nem integração.

## Complemento autorizado em 24/10/2026 — replay e prescrição executável

Base da correção: `10408bf1b823541f33a4e9ec56d573456853fc78`, PR #66. Execução pelo Codex em worktree isolada, branch `codex/pr66-replay-ciencia`.

- Objetivo: recuperar assinatura já concluída apesar de alertas posteriores e aplicar a mesma ciência à prescrição executável, incluindo a interface e a recuperação de pedidos pendentes.
- Regra clínica preservada: somente vermelhos vigentes ainda não reconhecidos exigem ciência; vermelho não exibido recusa escrita nova. Ciência não autoriza conduta. Não alterar corpus, doses, limiares, demo congelada ou fluxo de APAC em rascunho.
- Replay continua sujeito à sessão válida, contexto e identidade do pedido. A lista de ciência integra a identidade da operação. Não grava ciência novamente nem reconhece alertas posteriores.
- Prescrição: `reconhecerAlertas` opcional para compatibilidade com pedidos anteriores; omissão equivale a nenhuma ciência, jamais a reconhecimento automático. O recibo de exibição pertence à sessão/contexto. A ciência é persistida na transação da assinatura; falha desfaz assinatura e auxiliares.
- UI: o botão de assinatura da prescrição aguarda ciência explícita; a preparação permanece disponível. O pedido enviado e guardado para recuperação inclui os IDs reconhecidos.
- WRITE_SET: `src/server/alertasConsulta.ts`, `src/server/rotas/confirmacao.ts`, `src/server/prescricaoExecutavel.ts`, `src/contracts/api/operacaoPrescricaoExecutavel.ts`, `src/ui/consulta/{ConsultaPersistida,EditorPrescricaoExecutavel}.tsx`, os testes M10/HTTP de prescrição e este documento.
- Aceite: replay sem novos efeitos; pedido adulterado recusado; ausência/ciência parcial/duplicada/não exibida recusadas; vermelho posterior e isolamento de sessão; exceções para não vermelhos e já reconhecidos; atomicidade sob falha de persistência; jornada UI/HTTP/SQLite. Typecheck, fronteiras, corpus e CI no head final.
- Reprodução inicial: 2 falhas esperadas e 68 testes passando. Replay devolveu 409 em vez de 200; prescrição sem ciência devolveu 200 em vez de 409. A jornada UI também demonstrou botão liberado indevidamente.
- Verificação local: typecheck, fronteiras (572 arquivos) e corpus (241 arquivos) passaram; prescrição executável isolada passou 70/70. Uma execução Windows abortou worker com `0xC0000409`; não foi contada como validação concluída. Regressão ampliada e CI final ainda em andamento.
- Revisão independente: favorável após corrigir a orientação de recuperação da intenção pendente; sem achados restantes nem decisão clínica nova identificada. Merge condicionado aos checks finais no head exato, conforme autorização do Dr. Silas.

## Situação atual (lida no código)

- A tela registra os alertas exibidos por sessão e contexto: `src/server/rotas.ts:410` → `sessao.ts:89-92`.
- Na confirmação, `src/server/rotas/confirmacao.ts:178-180` só recusa (409 `ALERTA_NAO_EXIBIDO_OU_ALTERADO`) id duplicado, não exibido ou não vigente. **Lista vazia passa**, mesmo com alerta vermelho na tela.
- A ciência é gravada em `alerta_reconhecimento` (append-only) após a gravação: `confirmacao.ts:243`.
- Alerta "vermelho" = `presentationOverride: true` (E1, K-14 do plano: "havendo vermelho, a tela lista os alertas exibidos e o clique registra ciente, sem autorização clínica implícita").
- UI: `BarraFechamento.tsx:43` já envia todos os vermelhos exibidos. `ConsultaPersistida.tsx:318,475` envia só os marcados pelo médico; a caixa só aparece para vermelho ainda não reconhecido. `TelaConsulta.tsx:274` (demo congelada por D2) também envia só os marcados.
- Nenhum teste cobre hoje a recusa por alerta (`ALERTA_NAO_EXIBIDO_OU_ALTERADO` não aparece em `tests/`).

## Regra proposta

Ao confirmar, calcular `obrigatorios` = alertas que estão **exibidos nesta sessão e contexto** E **vigentes** E **vermelhos** (`presentationOverride`) E **ainda não reconhecidos** (`reconhecidoEm === null`).

1. Se algum `obrigatorio` faltar em `reconhecerAlertas` → **409 `CIENCIA_ALERTA_OBRIGATORIA`**, antes de qualquer gravação (nem evento, nem ciência, nem auditoria de assinatura).
2. **Q2:** vermelho vigente ainda sem ciência que **não foi exibido** nesta sessão → **409 `ALERTA_NOVO_NAO_EXIBIDO`**, antes de qualquer gravação.
3. Regra atual mantida: id duplicado, não exibido ou não vigente → 409 `ALERTA_NAO_EXIBIDO_OU_ALTERADO`.
4. Sem `obrigatorios`, lista vazia continua válida.
5. A ciência continua sendo só "ciente": não autoriza conduta, não muda o alerta, não vira evolução.

## Arquivos a alterar (na implementação, depois da aprovação)

| Arquivo | Mudança |
|---|---|
| `src/server/rotas/confirmacao.ts` | calcular `obrigatorios` e recusar com o código novo |
| `src/contracts/api/saidasHttp.ts` | **sem mudança**: respostas de erro não são validadas por esquema (`respostaHttpValida`, linha 134) |
| `src/ui/consulta/ConsultaPersistida.tsx` | desabilitar "Assinar" enquanto faltar ciência de vermelho exibido; mensagem clara para o 409 |
| `src/ui/consulta/BarraFechamento.tsx` | sem mudança esperada (já envia todos); confirmar por teste |
| `src/ui/telas/TelaConsulta.tsx` | **não tocar** (demo congelada, D2); verificar se a demo usa servidor real e se algum teste dela quebra |

## Testes (escritos antes do código)

`tests/server/m10-ciencia-alertas.test.ts`, HTTP real com fixture sintética:

| ID | Caso | Hoje (7d7ae2d) | Depois |
|---|---|---|---|
| M10-01 | vermelho exibido + `[]` → 409 `CIENCIA_ALERTA_OBRIGATORIA`, nada gravado | **falha** (passa 200) | passa |
| M10-02 | dois vermelhos, ciência de um → 409 | **falha** | passa |
| M10-03 | ciência de todos → 200, 2 ciências | passa | passa |
| M10-04 | sem vermelho, `[]` → 200 | passa | passa |
| M10-05 | vermelho com ciência já registrada (`registrarCienciaAlertas`), assinatura com `[]` → 200 | passa | passa |
| M10-06 | id não exibido continua 409 `ALERTA_NAO_EXIBIDO_OU_ALTERADO` | passa | passa |
| M10-07 | [Q1] alerta não vermelho exibido, `[]` → 200 | — | passa |
| M10-08 | [Q2] vermelho novo não exibido → 409 `ALERTA_NOVO_NAO_EXIBIDO`, nada gravado | — | passa |

Mais, na implementação: teste de UI em `tests/ui/` para o botão "Assinar" bloqueado até marcar todos os vermelhos; rodar `tests/server/auditoria-main-alertas.test.ts` e `tests/ui/fechamento.test.tsx` (consumidores atuais). CI completo no head.

## Perguntas ao Dr. Silas

- **Q1.** "Todos os alertas exibidos" inclui os **não vermelhos**? Hoje a tela só oferece "ciente" para os vermelhos (E1). Proposta: **só vermelhos**; exigir os demais bloquearia a assinatura sem a tela permitir dar ciência.
- **Q2.** Se um alerta vermelho **novo** surgir depois que a tela foi carregada (vigente, mas não exibido), a assinatura deve ser recusada até a tela ser recarregada e o médico vê-lo? Proposta: **sim**, recusar com `ALERTA_NOVO_NAO_EXIBIDO`.

## Riscos

- Testes existentes que assinam com `reconhecerAlertas: []` havendo vermelho exibido vão falhar: é o efeito desejado; ajustar cada um explicitamente, sem afrouxar a regra.
- A demo congelada pode ter fluxo que assina sem ciência; não alterar a demo, registrar.

Nota de fixture: uma segunda assinatura no mesmo encontro é recusada na preparação (409), por isso M10-05 grava a ciência anterior pelo mesmo mecanismo da rota em vez de assinar duas vezes.

## Verificação da implementação (24/10/2026)

- `tests/server/m10-ciencia-alertas.test.ts` (8) e `tests/ui/m10-ciencia-assinatura.test.tsx` (1): 9/9 passam.
- Regressão dirigida: 43 arquivos que usam a confirmação ou a ciência; 41 passam, 2 pulados por `skipIf` preexistente; 412/415 testes passam, 3 pulados, 0 falhas.
- `typecheck`, `check:boundaries` (572 arquivos, 0 exceções) e `check:corpus` (241 arquivos) verdes.
- A demo congelada (`TelaConsulta.tsx`, D2) não foi alterada.
