# QT H.BEM — Fase A da SUITE_DOCTOR

**Estado:** PROPOSTA EXECUTÁVEL / NÃO ATIVADA CLINICAMENTE  
**Titular da fase LAB:** `consultorio-docs`  
**Autoridade clínica e de promoção:** Dr. Silas  
**Condução principal:** ChatGPT / Work / Codex  
**Auditoria:** Claude, com comunicação governada por CLI  
**Auxiliar:** Grok, sob demanda

Esta pasta define o programa inicial do QT H.BEM dentro da SUITE_DOCTOR. A Fase A organiza o ciclo documental do encontro, a alocação de pacientes entre chats do ChatGPT Work e a revisão clínica. Ela não cria prescrição real, farmácia, infusão ou integração ativa com oncoMed.

## Regra de arquitetura

1. **INTRA-LLM primeiro:** coordenação entre chats do mesmo ambiente ChatGPT Work, com índice de alocação. Um chat por paciente é organização; cadastro, autorização e recorte de contexto é que sustentam isolamento.
2. **INTER-LLM depois:** cruzamento controlado entre ChatGPT, Codex, Claude e futuramente Grok, somente por envelopes versionados, sem compartilhar histórico inteiro ou PHI em argumentos de terminal.
3. **Divisão definida pelo Dr. Silas:** ChatGPT/Work organiza o trabalho e as minutas; Codex conduz arquitetura e implementação autorizada; Claude audita contratos, estatística, evidências e riscos; Grok auxilia com pesquisa e contrapontos sob demanda. Nenhum promove conteúdo clínico.

## Documentos

- [PROGRAMA_FASE_A.md](PROGRAMA_FASE_A.md): escopo, fluxo e critérios da primeira fase.
- [GOVERNANCA_VERTICAL_CHATS.md](GOVERNANCA_VERTICAL_CHATS.md): alocação dos pacientes no ChatGPT Work.
- [REVISAO_DAS_ABAS.md](REVISAO_DAS_ABAS.md): proposta de abas e limites de cada superfície.
- [ESTADO_SUITE_E_PROXIMOS_PASSOS.md](ESTADO_SUITE_E_PROXIMOS_PASSOS.md): realizado, não comprovado e dez próximos passos.
- [CONTRATO_CLI_CODEX_CLAUDE.md](CONTRATO_CLI_CODEX_CLAUDE.md): comunicação técnica entre os protagonistas.

## Limites clínicos

Atualização de 16/09/2026: [governança consolidada](../SUITE_DOCTOR_GOVERNANCA_FINAL.md), seção 11, contém auditoria V5, arquitetura mínima, proforma e mapa de fontes do Maestro. OncoAssist é território oncológico transversal, distinto do Maestro. Ambos são funções propostas; documentação não comprova agentes ativos.

Toda saída é **MINUTA PARA REVISÃO MÉDICA**. Sugestões do OncoAssist são opiniões rastreáveis e separadas da nota clínica. Números, esquemas, registro ANVISA, disponibilidade no SUS e resultados de trials só podem ser afirmados quando presentes em fonte identificada e vigente.
