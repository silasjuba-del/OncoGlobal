# PEDIDOS · LUNA 2

## Contrato provisório para saída externa

Solicito ao tech lead um contrato canônico para a evidência de egress, substituindo o tipo local `// PROVISORIO-W10` em `src/kernel/gateway/gateway.ts`. A forma necessária precisa representar:

- payload final exato (ou referência imutável que o executor não possa resolver novamente);
- destino canônico resolvido no servidor;
- id/versão/hash do artefato e escopo paciente/encontro;
- autorização persistida e vigente no ledger, incluindo contato/consentimento ou validação de emissão APAC;
- `SanitizationReport` com hash do payload e hash do destino, além de risco residual e versão do sanitizador.

O gateway recalcula os hashes e executa somente o payload validado. O callback do servidor é obrigatório em runtime para `ENVIAR_WHATSAPP`, `ENVIAR_EMAIL`, `AGENDAR` e `EXPORTAR_APAC`; sua ausência, erro ou evidência incompleta nega a saída. Impressão do sistema e backup local permanecem ações locais.

## Integração L1

L1 deve injetar `validarSaida` ao compor `/acao`, consultando ledger e autorização persistida por chamada, inclusive replay; não usar aprovação booleana ou destino vindo do corpo. Para a rota de leitura APAC, chamar `dataCivilDoServico(instante, fusoConfigurado)` antes de `apacPrazo` (FN-12). `PENDENTE` deve permanecer pendente; nunca substituir data ausente/inválida por hoje.

Não há dependência nova solicitada.
