# Parecer do Codex (skill ai-engineer) · 2026-10-09 · registro

> Trazido pelo Dr. Silas ao chat operacional. Parecer documental do Codex: não inspecionou a implementação, não rodou testes e não alterou arquivos. Nenhuma proposta abaixo virou decisão canônica. A triagem do tech lead está em `docs/FECHAMENTO-F0.md` §4b.

## Tese
Concentrar a construção em **provar uma consulta completa** antes de ampliar a orquestração de agentes. O risco apontado é acumular governança sem demonstrar redução do trabalho do médico. A referência citada é "Building effective agents" (Anthropic): fluxos simples primeiro e autonomia só com ganho demonstrável.

## Feedback por área
- **Arquitetura:** manter monólito modular, SQLite e contratos compartilhados. Nome de agente não exige processo separado.
- **Primeira entrega:** kit documental → revisão médica → evolução assinada → reabertura com histórico.
- **IA:** só para extração semântica, comparação e redação. Cada resposta traz valor, fonte, data, incerteza e conflitos. O vínculo com o paciente fica local.
- **Memória longitudinal:** documento original, extração proposta e fato confirmado ficam separados. Correção preserva o anterior e diz o que substitui. Planejado, prescrito e administrado continuam distinguíveis.
- **Experiência:** pendências e divergências primeiro, com acesso ao trecho-fonte. "Validar tudo" fica preso à versão exibida; editar exige nova revisão.
- **Falhas:** prever modelo indisponível, resposta inválida, interrupção e repetição. O médico continua manualmente, com o rascunho preservado e sem duplicar.
- **Custo:** medir tempo, custo e correções por tarefa. Usar o menor modelo suficiente, com limite de tentativas.

## Três pontos documentais
1. **Permissões dos agentes:** a GOVERNANÇA diz "sem ferramentas, memória ou chamadas"; a RAIZ admite LLM com ferramentas. Falta explicitar o que vale para extratores clínicos e o que vale para OncoAssist e orquestrador.
2. **Evidência × confirmação:** falta explicitar a área local de documentos recebidos e extrações não confirmadas, separada dos fatos confirmados, com retenção e rastreabilidade.
3. **Desidentificação verificável:** texto livre, OCR, nome de arquivo, metadados e logs. Falhou → revisão local/manual. Tem de funcionar antes de habilitar chamada externa.

## Critério de conclusão proposto
- caso sintético percorre a interface → evolução → confirmação e assinatura → reabre com histórico;
- documentos contraditórios ficam sinalizados até a decisão;
- negação, data, unidade e ausência preservadas;
- repetir após falha não duplica;
- trocar de paciente ou editar o conteúdo impede reaproveitar a confirmação;
- o fluxo funciona quando a IA falha.

Avaliar também fatos sem suporte, omissões relevantes, correções exigidas e tempo total até finalizar. Saída estruturada valida o formato, não o conteúdo. Roteador multi-modelo, proatividade e grafo ficam para quando a necessidade for comprovada.
