# Estado da SUITE_DOCTOR e próximos passos

**Atualizado em 16/09/2026.** Referência detalhada: [governança consolidada, seção 11](../SUITE_DOCTOR_GOVERNANCA_FINAL.md). Este arquivo resume evidências e propostas; não declara runtime integrado.

## Realizado ou documentado

- `consultorio-docs` foi definido como titular e laboratório da fase atual.
- Existe merge determinístico Plaud × Whisper com `KEEP_ONE / DUAL_SOURCE`, sem LLM.
- Whisper local em WASM e bloqueio de áudio em nuvem foram reportados no produto.
- Existe uma ponte local `/api/memory-os/*`, embora a autoridade final entre implementações de memória ainda precise ser escolhida.
- OncoAssist atual planeja intents e chips FLASH; o avatar conversacional permanece futuro.
- Score longitudinal off-label existe, sem diagnóstico e sem inferência de RECIST.
- A governança SUITE define territórios, proveniência, gates e promoção clínica humana.
- Foi produzido e testado um formatador sintético de notas com fontes distintas e divergências preservadas.
- MemoryOsPanel está importado e montado no App. Isso não prova integração do novo MemoryService, nem substituição da persistência em uso.
- O pipeline novo contém risco de identidade nominal rotulada EXACT e reconciliação por inclusão de tokens que pode perder negação. Achados estáticos; não foram executados testes nesta revisão.
- A V5 e uma revisão V3.1 foram localizadas, ambas sem prova de adoção humana. O mapa leve inclui SBOC, slides, Onco Pro, manuais e rotas web.
- Durante a auditoria surgiram commits externos a esta tarefa: b630be1 (governança, grafo e ledger) e b813b24 (manutenção e G1 de branches bloqueante). Código inspecionado; verificações não executadas aqui. Seus G1/G2 têm significado diferente dos gates da SUITE e precisam de correspondência explícita.

## Ainda não comprovado como operacional

- Importação Plaud ponta a ponta e fila multipaciente.
- Relógio de aproximadamente 60 minutos com política `NOT_AT_NIGHT` e deduplicação.
- Persistência longitudinal com um proprietário canônico único.
- Avatar conversacional do OncoAssist.
- Índice SBOC executável com pesquisa delimitada e cartões de trials.
- Integração clínica com oncoMed, Grok ou múltiplas LLMs.
- Uso real com pacientes, segurança operacional e prontidão clínica.

## Dez próximos passos — visão do Codex

1. Fixar uma referência de governança e os limites da Fase A.
2. Inventariar a persistência e escolher um único serviço escritor/adapter Memory.
3. Confirmar identidade e encontro, incluindo homônimos e dois encontros no mesmo dia.
4. Corrigir o reconciliador: preservar negação, números, tempo e informação complementar.
5. Demonstrar caixa → nota → Memory → reabertura, sem exigir Plaud.
6. Implementar fila Plaud durável, idempotência e notificações somente diurnas.
7. Entregar revisão formatada, comparação e opinião separada em três superfícies principais.
8. Ativar busca delimitada SBOC/trials e OncoAssist com direção e fontes.
9. Comprovar INTRA e round-trip sintético Codex ↔ Claude via CLI; só depois trânsito clínico INTER autorizado.
10. Fazer piloto supervisionado, medir tempo/correções/custo e decidir expansão estatística, Grok e oncoMed.

## Voto de sequência

**GO_CONDITIONAL para construir a Fase A.** Não é aprovação de uso clínico do novo pipeline. Condições e aceitação estão na seção 11 da governança; nenhum código, PR, migração ou integração foi executado por esta atualização documental.
