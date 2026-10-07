# W10 · entrega L2 (gateway)

## Resultado

**READ externo: `NOT_IMPLEMENTED` / `BLOQUEADO_CONTRATO`.** O gateway não implementa autorização de READ; `ActionIntent` continua sem verbo de leitura. O achado RT-12c deve continuar sinalizado pelo redteam como implementação ausente até que haja contrato e implementação reais. As conexões externas permanecem desligadas.

## Base contratual

- D-W9-55 registra READ externo como lacuna do gateway.
- D-W9-56 incorpora a distinção arquitetural READ × WORLD_EFFECT na CANONICA.
- A seção 7 da `docs/canonica/ONCOGLOBAL-RAIZ-CANONICA.md` distingue leitura de efeitos no mundo, mas não define autorização de READ.
- D-W9-66 autoriza envio de kit documental à LLM somente como efeito registrado pelo gateway e sob suas condições. Não define uma política geral de leitura externa.
- D-W9-15 mantém provider LLM e conexões externas desligados até que os gates estejam ligados.

Os contratos atuais (`ActionIntent` em `src/contracts/operacao.ts` e autorização de saída do servidor) representam efeitos e saída; não definem um contrato READ, allowlist canônica de destinos de leitura, sanitização de consultas, autoridade por escopo, nem registro/replay dessa operação. Por isso não há aprovação de leitura mesmo quando o destino parece confiável. A regra de destino existente para efeitos permanece intacta.

## Cobertura entregue

Durante a revisão do gateway, encontrei uma lacuna real de imutabilidade/inspeção: `structuredClone` preserva `Map`, `Object.freeze(Map)` não impede `Map.set`, e G-27 inspeciona metadados com `Object.entries`, que não vê entradas de `Map`. O gateway agora recusa evidência que não seja composta por dados JSON simples antes de rodar os gates ou chamar executor. `tests/w10-entrega/gateway.test.ts` cobre esse caso adversarial com metadado identificável num `Map` e espera zero chamadas ao executor.

### Adendo RT-05a · negação de termos radiológicos

`src/rules/radAlerts.ts` agora reconhece “não observamos”, “não há” e “não se observa(m)” na cláusula do termo. “Não se pode excluir” continua como `REVISAO_URGENTE`, e uma cláusula positiva posterior continua elegível a alerta. Os testes novos cobrem formas negadas, positivo, incerteza e a quebra de cláusula. O ruleset/corpus não foi ativado nem alterado: sua lista de negações não é parte do contrato tipado ativo `RadRuleset`.

### Adendo RT-09 / RT-02 · extração e fronteiras

O pipeline agora executa `validarFatosContraContrato` com `ClinicalFact.safeParse` antes da normalização; candidatos inválidos ficam fora de `facts`, com o objeto bruto e diagnósticos em `factContractRejections`. Falhas esperadas de validação não interrompem nem alteram `input.rawTranscript`. O segmenter mantém idade, sexo, tumor e acompanhante observados até o fim do segmento; sinal discordante abre segmento com revisão, e `patientId` continua nulo. Os testes novos cobrem entrada inválida preservada, execução do pipeline, sinais concordantes e discordantes em consultas com homônimo.

## Próximo contrato necessário

Para liberar READ, o tech lead precisa publicar contrato canônico que determine, no mínimo, como o servidor fornece a autorização e o escopo; como o destino canônico é resolvido e validado por allowlist; quais dados e consultas podem sair após sanitização; que trilha de auditoria e idempotência se aplica; e como respostas externas são limitadas e preservadas com proveniência. Até lá, a resposta permanece `BLOQUEADO_CONTRATO` e nenhum caminho de rede é executado.

## Verificação

Testes e typecheck: `NOT_RUN` nesta etapa; a execução foi reservada ao root para serialização. RT-12c permanece sem resolução e não deve ser relatado como PASS. Arquivos alterados nesta entrega: `src/kernel/gateway/gateway.ts`, `tests/w10-entrega/gateway.test.ts`, `src/rules/radAlerts.ts`, `tests/w10-entrega/rads.test.ts`, `src/orchestration/pipeline-extracao.ts`, `src/kernel/extracao/segmenter.ts`, `tests/w10-entrega/harness.test.ts` e este documento.
