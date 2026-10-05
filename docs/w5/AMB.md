# W5 · Registro de ambiguidades (§5.3)

Formato: `AMB-NNN · Fonte A diz · Fonte B diz · Código faz · Opções · Escolha conservadora provisória · Decisão clínica?`
Regra: a escolha provisória nunca esconde dado, nunca libera, nunca assina; ausente = PENDENTE. Valor clínico não decidido = `[VERIFICAR]` e vai para `PERGUNTAS-DR.md`.

## Decisões de processo do orquestrador (não clínicas)
- **AMB-P01 · Quem marca o achado como CORRIGIDO.** §3 dá `docs/w5/achados/**` ao RED e `docs/w5/**` ao orquestrador; §4-P4 manda o agente corretor "marcar CORRIGIDO". Corretores não escrevem em `docs/w5/`. **Escolha:** o corretor informa hash + teste regular na mensagem de entrega e no corpo do commit; o orquestrador atualiza o achado em `f0/w5-integrado` depois do merge. O RED só cria achados novos (nunca edita os já triados), o que evita conflito de merge.
- **AMB-P02 · Vitest "um por vez" com worktrees separados.** O `ESTADO.md` de cada worktree é uma cópia diferente; um lock só funciona se for único. **Escolha:** lock atômico fora do repo + linha "Agente ativo no Vitest" atualizada no `ESTADO.md` do orquestrador pelo próprio script.
- **AMB-P03 · `tests/adv/` x suíte regular.** O `vite.config.ts` atual não tem `include/exclude`; `tests/adv/*.adv.test.ts` entraria em `npm test` e deixaria o `verify` vermelho. **Escolha:** E2E-UI (dono do `vite.config.ts`) exclui `tests/adv/**` da execução padrão e o mantém executável por `npx vitest run tests/adv --no-file-parallelism` (comando literal do §4-P2). `tsc` continua cobrindo `tests/adv` (testes do RED precisam compilar; falham em tempo de execução).
- **AMB-P04 · Arquivos sem dono no §3.** `tests/w3/fixtures.ts` (importado por `auditoria-regressao`), `tests/contracts/**`, `scripts/sigtap-import.d.mts`, `docs/ondas/**`, `docs/progresso/**`, `README.md`. **Escolha:** tratados como congelados nesta onda; necessidade vira pedido ao tech lead.
- **AMB-P05 · Quem fecha `SEM_TESTE` de ID já implementado corretamente.** O §4 não diz. **Escolha:** enquanto o RED ataca, cada corretor escreve testes de **cobertura** (positivo + negativo, INV-19) para IDs da própria trilha, um commit por ID (`W5-<AGENTE>-COB-<ID>`). Teste de cobertura que revela defeito **não** vira correção direta: é retirado e reportado como suspeita; o RED escreve a prova adversarial e o fluxo P3→P4 segue. Testes que provam por mutação (F5) continuam sendo do RED.
- **AMB-P06 · Custo do `verify` (~3 min por execução, serializado entre 6 usuários do lock).** **Escolha:** por achado, o corretor roda `tsc` + os arquivos de teste afetados + `auditoria-regressao`; o `npm run verify` completo roda obrigatoriamente antes de cada entrega ao orquestrador, e o orquestrador roda o `verify` completo depois de **cada** merge em `f0/w5-integrado` (§4-P5). A ponta de cada branch entregue está sempre verde.

## Ambiguidades de especificação × código
(nenhuma ainda)
