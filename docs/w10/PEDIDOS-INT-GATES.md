# PEDIDOS · INT-GATES

1. **Ligação dos gates (CODEX-06, `src/app/**`)**: chamar `g07Lateralidade`, `g08AnatomiaSexo`, `g09PtDeBiopsia` na extração/consolidação (resultado vira alerta/pendência na projeção, nunca trava salvar rascunho) e `g27SaidaExternaLimpa` (com `sanitizarArtefato` + `extrairMetadadosPdf` de `src/kernel/llm/sanitizador.ts`) no Action Gateway, junto com G-02. Fora da faixa de INT-GATES.
2. **Decisão**: `Veredito.decisao` ganhou `"PENDENTE"`; consumidores futuros devem tratá-lo como não-PASSA.
3. **Decisão**: mover os 4 `.adv.ts` para `tests/kernel/gates-w10/` (CODEX-10) tiraria-os da config adv; manter até o tech lead decidir.
