# M10 — Assinatura exige ciência de todo alerta vermelho exibido

Estado: **ESPECIFICAÇÃO + TESTES VERMELHOS** (rodado em 24/10/2026: 2 falham como esperado, 4 passam, 2 pendentes de decisão; ~10 s, um worker, TEMP próprio). Nada implementado. Base: main 7d7ae2d. Decisão do Dr. Silas em 24/10/2026: "assinar exige ciência de todos os alertas exibidos".

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
2. Regra atual mantida: id duplicado, não exibido ou não vigente → 409 `ALERTA_NAO_EXIBIDO_OU_ALTERADO`.
3. Sem `obrigatorios`, lista vazia continua válida.
4. A ciência continua sendo só "ciente": não autoriza conduta, não muda o alerta, não vira evolução.

## Arquivos a alterar (na implementação, depois da aprovação)

| Arquivo | Mudança |
|---|---|
| `src/server/rotas/confirmacao.ts` | calcular `obrigatorios` e recusar com o código novo |
| `src/contracts/api/saidasHttp.ts` | aceitar o código `CIENCIA_ALERTA_OBRIGATORIA` na rota `confirmar` |
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
| M10-07 | [Q1] alerta não vermelho | todo | conforme decisão |
| M10-08 | [Q2] vermelho novo, ainda não exibido | todo | conforme decisão |

Mais, na implementação: teste de UI em `tests/ui/` para o botão "Assinar" bloqueado até marcar todos os vermelhos; rodar `tests/server/auditoria-main-alertas.test.ts` e `tests/ui/fechamento.test.tsx` (consumidores atuais). CI completo no head.

## Perguntas ao Dr. Silas

- **Q1.** "Todos os alertas exibidos" inclui os **não vermelhos**? Hoje a tela só oferece "ciente" para os vermelhos (E1). Proposta: **só vermelhos**; exigir os demais bloquearia a assinatura sem a tela permitir dar ciência.
- **Q2.** Se um alerta vermelho **novo** surgir depois que a tela foi carregada (vigente, mas não exibido), a assinatura deve ser recusada até a tela ser recarregada e o médico vê-lo? Proposta: **sim**, recusar com `ALERTA_NOVO_NAO_EXIBIDO`.

## Riscos

- Testes existentes que assinam com `reconhecerAlertas: []` havendo vermelho exibido vão falhar: é o efeito desejado; ajustar cada um explicitamente, sem afrouxar a regra.
- A demo congelada pode ter fluxo que assina sem ciência; não alterar a demo, registrar.

Nota de fixture: uma segunda assinatura no mesmo encontro é recusada na preparação (409), por isso M10-05 grava a ciência anterior pelo mesmo mecanismo da rota em vez de assinar duas vezes.
