# Auditoria L4 — correções verificáveis

Referência adicional solicitada pelo responsável: [formato de resumo Oncologia v6.0](../referencias/prompt-oncologia-v6/README.md). Incorporar entrada por diferenças (Hoje/Decisão/Saídas), recuperação antes de perguntas e pendências por documento aos próximos lotes. Inclusão documental não significa implementação da interface, execução da matriz de avaliação ou aprovação clínica.

Base: main `3010f0d0c803d6d2cddae774806421670a286b3f` (PR #66 integrada e CI verde). Autorização de 24/10/2026: continuar conferência e correção, orquestrando Luna. Codex é o único escritor; Luna pesquisa/revisa em modo somente leitura.

## Estado e sequência

1. PR #66: ciência dos vermelhos na confirmação e prescrição, replay e atomicidade concluídos. Não reimplementar.
2. Lote atual: isolamento da leitura de drafts e contexto/horizonte do RECIST (F4-10, F4-20/A-09). Preservar intake sem vínculo e fontes; não inferir identidade. WRITE_SET: rotas/extracao/rascunho.ts, rotas.ts, leituras.ts e testes dirigidos; este documento acompanha o estado.
3. Segurança operacional: relógio/sessão, revogação de contato, retomada sem processador e atribuição de relatos (F4-14/18/32/33/41). Reproduzir antes de alterar; falha de leitura não pode autorizar envio ou declarar processamento inexistente.
4. Proveniência/funil: F4-02/05/07/12/13 e A-01/A-03 exigem distinguir fontes documentais, registro manual e auxiliares. Não impor fonte documental a todo evento nem aplicar gates de anatomopatologia a fatos sem relação com o domínio.
5. Demais itens: F4-01/03/04/06/08/09/11/15/17/19/21/23–31/34–40/42 permanecem conforme conferência estática; não declarar corrigidos sem diff e testes. Órfãos não serão ativados, corpus não será aprovado por IA.

## Critérios do lote atual

- Draft vinculado: leitura só no paciente/encontro/lote selecionados, inclusive no fallback genérico. Campo de contexto ausente não vira autorização.
- RECIST: HTTP exige encontro/lote explícitos e consulta selecionada coincidente. Leitor não usa horizonte infinito na ausência de contexto; medições posteriores ao horizonte ficam fora da avaliação histórica. Categoria permanece proposta; leitura não escreve eventos.
- Provas: dois pacientes/contextos, tipos de draft fora de EXTRACAO_RASCUNHO, ausência de contexto, série temporal histórica, proveniência inválida e caminhos positivos legítimos. Atualização dos testes antigos apenas para fornecer contexto explícito, preservando suas expectativas clínicas.
- Typecheck, fronteiras, corpus, regressão dirigida, revisão independente e checks no head antes de merge. Dados sintéticos, sem skips ou expectativas afrouxadas.

## Decisões do médico no chat (24/10/2026)

- F4-22: manter fila global para vinculação manual, identificada como não pertencente à consulta. Preservar listagem e acrescentar essa identificação à RevisaoExtracaoLocal (incluída no WRITE_SET).
- F4-16: dois fluxos — Drive → app e LLM/skill → resumo → app. O app também pode usar LLM para transcrição não verificada antes da vinculação médica. Preservar contexto do upload/hash/rascunho inerte e ausência de escrita clínica; não exigir vínculo já confirmado como pré-condição dessa transcrição.

## Evidências em andamento

- Primeira reprodução RECIST: endpoint sem encontro retornou 404 em vez de recusa contextual; endpoint com contexto completo rejeitou o contrato (400). Sem código de produto alterado nessa reprodução.
- Ajuste da fixture do draft: tipo desconhecido era recusado por proteção distinta. Usar FLASH_RASCUNHO para exercitar o fallback real, sem confundir gates.
- CI inicial revelou dois consumidores legítimos de PrescricaoProposta@1, cujo contexto fica em correlacao. A leitura agora valida esse contrato estrito antes de extrair o contexto; discriminador declarado com payload inválido é recusado, sem fallback genérico. Os dois testes de regressão e o teste adversarial desse discriminador passaram (12/12 na bateria final). Typecheck passou.
- Regressões dirigidas anteriores: 32/32 (RECIST, fila, PDF e UI) e 20/20 (isolamento/extração/alertas). Revisão Luna independente encerrou os achados de draft sem paciente e identidade interna divergente. CI final necessário antes de merge.
- Revisão GitHub identificou descarte silencioso de data RECIST inválida pelo filtro temporal. Reproduzido com texto ilegível e data inexistente: estado indevido CALCULADO. Corrigido para excluir somente futuro comprovadamente válido e manter a incerteza no avaliador canônico (`DATA_INVALIDA/PENDENTE`). Bateria RECIST/isolamento 15/15 e typecheck passaram; Luna conferiu o ajuste.
