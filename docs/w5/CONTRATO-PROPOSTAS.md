# W5 · Propostas de contrato — não implementadas

## CP-001 · Autorização server-side de saída externa (ADV-006, S0)

**Prova observada:** `tests/adv/f07-saida.adv.test.ts` atravessa HTTP `/acao` → `criarGateway` → executor **fake** com referências sintéticas sem registro assinado/validado no ledger; quatro casos obtiveram 200/`EXECUTADA` onde se esperava negação. `tests/server/adv006-saida.test.ts` na worktree KERNEL reproduziu quatro falhas e permanece WIP não commitado. Não houve impressora, e-mail ou exportação real.

**Contrato existente:** `src/contracts/operacao.ts` define `ActionIntent` com verbo/objeto/escopo/destino/chave, mas nenhum desses campos enviado pelo cliente comprova autorização. `ClinicalEvent` e `SignatureReference` permitem registrar revisão e assinatura; `src/server/rotas.ts` encaminha a intenção ao gateway sem consultar a prova do artefato. A validação de emissão APAC, sua versão e o destino autorizado não têm vínculo persistido inequívoco no caminho observado. `src/contracts/**` está congelado nesta onda: não editar para "resolver".

**Proposta para decisão do tech lead e do Dr. Silas:**

1. Definir uma fonte canônica **persistida pelo servidor** para cada artefato liberável, com `patientId`, `encounterId`, tipo, ID, versão, hash exato, revisão/assinatura humana e decisão de validação específica (inclusive APAC), associada a evento/operationId imutável.
2. Fazer o servidor resolver a referência de `ActionIntent` nessa fonte, checar escopo da sessão, versão/hash não substituídos, tipo/verbo e destino autorizado **antes** de reservar/executar pelo gateway. Dados do cliente são pedidos, não prova. A autorização deve ser revalidada no replay e auditada sem PHI.
3. Definir o vínculo da APAC com a prescrição assinada e a validação administrativa vigente, e a política de destino por canal. Um documento de outro paciente ou minuta sem assinatura não pode gerar efeito; `OUTCOME_UNKNOWN` não deve ser reenviado cegamente.
4. Provar com negativos (artefato ausente, paciente divergente, versão substituída, APAC não validada, destino impróprio) **e** positivo real sintético (artefato validado/assinado pelo médico → executor fake uma vez), antes de habilitar qualquer executor não fake.

**Estado:** `BLOQUEADO_CONTRATO` para a correção de ADV-006, sem transformar o achado em `CORRIGIDO`. Negar todos os verbos indiscriminadamente seria contenção possível, mas não prova o fluxo positivo nem constitui correção completa. Até haver contrato/implementação e reataque, **não habilitar saída externa real por `/acao`**. Nenhum valor clínico ou dado de paciente real é necessário para essa decisão de arquitetura.

## CP-002 · Dono do verificador de fronteiras estático (ADV-013, S1)

RED produziu três probes sintéticos inertes em diretório temporário: o `scripts/check-boundaries.mjs` real, copiado sem alterações, retornou sucesso diante de `globalThis["fetch"](...)`, `new WebSocket(...)` e `import("node:https")` em `src/rules/`. Não houve execução de rede ou egress de PHI. Fonte: `tests/adv/f09-arquitetura.adv.test.ts`, log `_w5-locks/logs/20261005-222122-RED.log`.

`scripts/check-boundaries.mjs` está **congelado e sem dono editável na W5** (§3), logo não é legítimo pedir a um corretor que o modifique como se fosse sua trilha. Proposta: o tech lead atribui explicitamente um dono/escopo para um patch com testes de rejeição dessas três variantes, mantendo verificação positiva de usos permitidos em gateway/llm e sem trocar o check por uma lista de regexes não testada. Enquanto não houver aprovação e reataque, `ADV-013` permanece **BLOQUEADO_ESCOPO** (equivalente operacional a bloqueio de contrato desta onda), não corrigido. O checker atual passar **não** comprova proibição de toda rede fora dos ports.
