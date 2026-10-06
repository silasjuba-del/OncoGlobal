# RED · entrada P1 para consolidação do orquestrador

Base lida em `f0/w5-red` @ `6b96702` (não substituir `docs/w5/MATRIZ.md`, que é do ORQ).

| ID / item | Função testada | Consumer em `src/**` | Evidência P2 rodada 1 | Estado restrito |
|---|---|---|---|---|
| G-02 | `g02PhiEgress` em `gates.ts:14` | busca por símbolo: só definição | `ADV-005` (sanitizador/gate) e `ADV-006` (HTTP→fake executor, sem PHI real) | unitário NÃO prova integração; rota de ação não chama gate |
| G-03 | `g03Assinatura` em `gates.ts:21` | só definição | `ADV-006`, impressão fake sem assinatura existente | rota de saída sem checagem de assinatura demonstrada |
| G-05/10/13/14/23/26 | funções em `gates.ts` | só definições na busca por símbolo | NOT_RUN como consumidores; F5 mutação NOT_RUN | suspeita, não falha afirmada |
| G-25 | `g25EscopoAssinatura` | `src/server/rotas.ts:8,49` | `ADV-002`: sem bundle HTTP, confirmar 409 RESISTIU | consumer presente; fluxo incompleto (W4-03) |
| G-20 / K-04 | `gateway.ts` reserva em store | `criarGateway` usa store injetado | `ADV-001`: recriação da memória duplica executor fake | fail W4-01 no cenário ensaiado |
| FN-14 / W4-05 | `src/rules/delta.ts` | função pura | `ADV-010`: conflito VERMELHO degradado | FAIL |
| W4-04 / D-W5-01 | `src/rules/apac.ts` aceita data civil injetada; não há conversor instante→civil exposto | não demonstrado em consumer | NOT_RUN: não passar instante fora do contrato `DataCivil` e chamá-lo bug | lacuna, precisa trilho real |
| F5 mutação | gates implementados | — | NOT_RUN: nenhuma alteração em fonte/worktree de mutação nesta entrega | prova separada, não inferir de busca |

Comando read-only usado: `rg -n 'g02PhiEgress|g03Assinatura|g05VerdeHonesto|g10DosePura|g13Letra|g14Interpolacao|g23ComandoDeepgram|g26VisaoSemAutoridade|g25EscopoAssinatura' src`.
F9/F11 amplos (IDs restantes do PLANO) ainda NOT_RUN; ausência de referência por símbolo não significa ausência de política implementada por outro caminho.
