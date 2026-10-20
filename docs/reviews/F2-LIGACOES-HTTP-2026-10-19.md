# F2: webhook, confirmação médica e envio autorizado

Base: `83b9aeb26b1509637a0702411556416de352dd3f`, na worktree `codex-bateria2-correcoes-20261019`. Escritor desta fatia: Codex. Pedido do Dr. Silas: corrigir os três threads restantes do PR27, testar, revisar independentemente e integrar se os critérios técnicos passarem. Conteúdo clínico e limiares permanecem inalterados.

## Comportamento entregue

1. `GET /canal/webhook/:keyId` verifica exclusivamente o desafio do provedor. `POST` autentica HMAC dos bytes originais antes de interpretar JSON, resolve a conta no servidor, persiste mensagem e pendência antes do ACK e recusa conflitos ou falhas de armazenamento. O servidor permanece em loopback. O envelope Meta nativo suporta mensagens de texto, mídia ainda não processada e recibos técnicos; tipos não admitidos são recusados sem ACK de sucesso.
2. A caixa do canal lê o ingresso persistido. O médico seleciona um encontro real, escreve a resposta e pede sua revisão. A prévia devolvida pelo servidor mostra canal, destinatário, paciente, encontro, versão e texto. Edição invalida essa prévia. Somente a confirmação explícita produz autorização; o envio usa o identificador da resposta preparada.
3. `/acao` encaminha os verbos de canal ao executor autorizado existente. O servidor confere identidade, vínculo único atual, consentimento, conteúdo, versão, revisão do prontuário e sessão antes do envio e após espera assíncrona, inclusive em replay. Telefone posteriormente compartilhado impede usar a autorização anterior. Resultado incerto permanece sem reenvio automático, inclusive após reinício.
4. O recibo real do provedor é persistido junto ao sucesso da operação em uma transação SQLite; entrega e leitura se correlacionam por conta e identificador do provedor. Falha nessa transação deixa a reserva incerta. Recibo técnico não demonstra consulta realizada, toxicidade resolvida ou atendimento clínico concluído.

## Configuração operacional

O servidor lê `canal.local.json` no diretório fornecido por `--data-dir`. Esse arquivo é ignorado pelo Git e contém segredos locais; nenhum foi criado ou publicado nesta entrega. Sem configuração de saída, o envio é recusado. Configuração inválida impede iniciar o canal, sem inventar recibo ou usar um transporte simulado.

Estrutura documental, com valores que o operador precisa substituir:

```json
{
  "contasWebhook": [{
    "accountId": "SUBSTITUIR_PELO_PHONE_NUMBER_ID",
    "canal": "WHATSAPP_SERVICO",
    "keyId": "principal",
    "segredo": "SUBSTITUIR_PELO_APP_SECRET",
    "verifyToken": "SUBSTITUIR_PELO_TOKEN_DE_VERIFICACAO"
  }],
  "whatsappSaida": [{
    "accountId": "SUBSTITUIR_PELO_MESMO_PHONE_NUMBER_ID",
    "phoneNumberId": "SUBSTITUIR_PELO_PHONE_NUMBER_ID_NUMERICO",
    "apiVersion": "SUBSTITUIR_PELA_VERSAO_CONFIGURADA_NA_META",
    "accessToken": "SUBSTITUIR_PELO_TOKEN_DA_CONTA"
  }]
}
```

No envelope nativo, `accountId` corresponde a `metadata.phone_number_id`. A versão da API é explícita, no formato `vN.N`; não há atualização automática de versão ou escolha de conta por payload do navegador. O endpoint do provedor é fixo. Publicação HTTPS e credenciais reais são configuração do operador, não foram executadas pelos testes. E-mail recebido via IMAP continua sujeito à política 5A existente: `From` não comprova identidade e esta fatia não o libera para envio automático.

Referências técnicas primárias: [payload de webhook da Meta](https://www.postman.com/meta/whatsapp-business-platform/folder/tduohwq/webhook-payload-reference) e [mensagem de texto da Meta](https://www.postman.com/meta/whatsapp-business-platform/request/8gvd47s/send-text-message). Nenhuma dose ou recomendação clínica foi obtida dessas referências.

## Provas e revisão

- Testes HTTP/UI usam SQLite, servidor e porta HTTP reais, dados sintéticos e transporte simulado: HMAC, Unicode/espaços, desafio GET, deduplicação, conflito, banco indisponível, corpo excessivo, prévia/confirmar/enviar, adulterações, revisão/sessão/vínculo alterados durante espera, replay/reinício e resultado incerto.
- Recibo real, correlação de leitura e rollback atômico de recibo/sucesso têm testes específicos. Configuração e adaptador do provedor são exercitados sem rede externa.
- Chromium atravessa a página local de produção: ingresso HTTP assinado, seleção do contexto, edição invalidando prévia, confirmação médica e envio único. As seis jornadas B2 e a receita pendente continuam na mesma execução.
- Revisão independente encontrou vínculo global obsoleto e perda do recibo do provedor; ambos foram corrigidos e receberam provas. A janela entre sucesso do gateway e persistência do recibo foi eliminada pela transação conjunta. Uma queda antes de registrar um resultado remoto continua explicitamente incerta, sem reenvio às cegas.

Resultados finais e SHA estão no PR27. Logs sintéticos completos e fotografias de preservação ficam fora do repositório, em `OncoGlobal-backups/f2-integracao-20261019`.

## Limites da integração

Corrigir estas ligações não encerra F3–F6. APAC, tarefa de nutrição e isolamento WORK/STUDY continuam com falhas na auditoria separada 9X–12X; seus testes e relatórios são preservados. A integração desta base parcial não constitui aprovação clínica nem liberação dessas jornadas. Os arquivos não commitados e as demais worktrees do Cursor não são modificados por esta fatia.
