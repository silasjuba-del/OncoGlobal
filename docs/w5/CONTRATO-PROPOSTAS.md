# W5 · Propostas de contrato — não implementadas

## CP-001 · Autorização server-side de saída externa (ADV-006, S0)

**Prova observada:** `tests/adv/f07-saida.adv.test.ts` atravessa HTTP `/acao` → `criarGateway` → executor **fake** com referências sintéticas sem registro assinado/validado no ledger; quatro casos obtiveram 200/`EXECUTADA` onde se esperava negação. A cópia KERNEL foi preservada como `tests/server/adv006-saida.evidence.ts`, WIP não commitado fora da descoberta regular. Não houve impressora, e-mail ou exportação real.

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

## Lacunas normativas confirmadas pela leitura P1

A MATRIZ contém 13 SEM_TESTE, derivados de leitura funcional: G-07/G-08/G-09/G-27, K-26, FN-16, N17/N19 e T-34/T-49/T-50/T-51/T-56. Os IDs correlatos não são treze causas clínicas novas nem testes que foram executados e falharam. Há ausência de comportamento/prova e ela impede o aceite W5 (especialmente G/INV/N).

- G-07/G-08/G-09: revisão de lateralidade, anatomia×sexo e proibição de pTNM de biópsia exigem consumidores com proveniência explícita e pares positivo/negativo; campos tipados ou palavras em prompts não constituem esses gates. Fonte insuficiente deve permanecer pendente; nenhuma decisão de estádio será inferida. Se os contratos congelados não representarem a fonte necessária, o tech lead precisa definir o vínculo antes de implementação.
- G-27: sanitização de metadados/pixels de artefato destinado a serviço externo não existe como consumidor. N25 tem escopo posterior citado no mapa KERNEL; esse adiamento não autoriza declarar o gate já implementado. Manter a capacidade externa sem habilitação até prova específica.
- FN-16/T-34: o corpus de interações tem estrutura, porém a função semaforoInteracoes e sua prova semântica não foram localizadas. Não ativar sementes clínicas ou thresholds sem fonte/decisão.
- K-26/N17: biblioteca versionada de fichas aprovadas inteiras ainda inexistente; templates genéricos não provam carregamento sem mistura de versões. A W5 proíbe fabricar o conteúdo das cerca de 50 fichas.
- N19/T-56: manifesto/claims/owner declarado não provam rejeição executável de um diff fora do dono nem de escrita por agente indevido. Definir o controle efetivo de admissão do diff, com negativo real e positivo, preservando hashes/base e arquivos congelados.

Outras parcelas continuam PARCIAL na MATRIZ: adaptador de produção projeção→pré-consulta (W4-07), reconhecimento de alertas persistido, app composto com E1/tema, job diário de backup e D85 após boot, fontes com localização/edição e demais consumers dos gates. As correções de ADV-017…020 não equivalem à implementação desses fluxos. O relatório final registra o estado terminal com bloqueios e não concede aprovação técnica, clínica ou de produção.
