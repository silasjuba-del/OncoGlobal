# W10 · CADEIA ASTRA (1 orquestrador `gpt-6-astra` + 5 executores `gpt-6-luna`) · 10 etapas

**Você é o ORQUESTRADOR (Astra).** Planeja, distribui, revisa e integra. Não coda o grosso: quem coda são 5 Lunas.
- Repo: `C:\Users\silas\Projects\OncoGlobal` (não mexa aqui). Sua base: worktree `C:\Users\silas\Projects\OncoGlobal-wt\w10-astra`, branch `f0/w10-astra` (crie a partir de `f0/w1-integrado`).
- Leia antes: `docs/ondas/W10-COMUM.md`, `docs/DECISOES.md` (D-W9-01…60), `docs/canonica/ONCOGLOBAL-RAIZ-CANONICA.md`, `src/contracts/w10/`.
- Regras que reprovam: IA propõe, código calcula, médico decide · ausente = PENDENTE · app alerta, nunca bloqueia o clínico · dado de paciente não sai do PC · só "Paciente Teste NN" · sem dependência nova · sem push · contratos só o tech lead (pedido em PEDIDOS).
- **Não toque** nas faixas de Grok, Fugu, Cursor, red team e equipe interna (tabela em `W10-COMUM.md`).

## As 5 Lunas (faixas exclusivas novas)
| Luna | Worktree / branch | Faixa | Entrega |
|---|---|---|---|
| L1 Servidor | `w10-luna1` / `f0/w10-luna1` | `src/server/**`, `src/app/**`, `tests/{server,app,sistema}/**` (novos) | Rotas de leitura reais hoje `[SERVIDOR_PENDENTE]` (agenda, salão, canal, APAC, chat, consulta); ligar no fluxo os gates G-07/08/09/27, o pipeline do Fugu, a prescrição e a APAC (pedidos em `docs/w10/PEDIDOS-INT-GATES.md`) |
| L2 Saída e tempo | `w10-luna2` | `src/kernel/gateway/**`, `tests/w10-luna2/**` | Prova por teste: todo caminho externo passa por G-02 + G-27 + autorização (inclui log e mensagem de erro sem PHI); fuso −03:00, aviso APAC ≤1 dia adiantado |
| L3 Corpus clínico | `w10-luna3` | `corpus/{glossario,regulatorio,receitas,redflags}/**`, `tests/w10-luna3/**` | Glossário de caixas numeradas (`CaixaNumerada`); tabela regulatória de receitas `[VERIFICAR]` (Portaria 344/98, RDC 471/2021); receitas não oncológicas a partir de `docs/referencias/ragGRAFO-prescricao/`; biblioteca dos 25 red flags (D-W9-28); prescrição por toxicidade (`docs/referencias/externos/PRESCRICAO-POR-TOXICIDADE.md`) como RASCUNHO |
| L4 RECIST e estatística | `w10-luna4` | `src/rules/recist/**`, `src/estatistica/**`, `tests/w10-luna4/**` | RECIST longitudinal (`RecistAvaliacao`: baseline, alvos, soma, nadir, Δ, PD = +20% **e** +5 mm, categoria nasce PROPOSTO); registro estatístico único, derivado do ledger, deduplicado por paciente, sem PHI (D-W9-44) |
| L5 Configurações | `w10-luna5` | `src/config/**`, `tests/w10-luna5/**` | Backend de Configurações (D-W9-16/17): perfil do médico e da instituição (CNES editável), registro de caixas, caixa de número → evento `AlteracaoCaixa` versionado; conexões externas nascem desligadas |
Cada Luna: `npm ci --offline` no seu worktree; commit por fatia `W10-LUNA<n>-NN: …`; relatório `docs/progresso/W10-LUNA<n>.md` com saídas reais.

## As 10 etapas
1. **Plano:** crie os 6 worktrees; escreva para cada Luna um prompt curto (faixa, entrega, critérios de aceite, testes) em `docs/w10/astra/LUNA<n>.md`.
2. **Disparo:** rode as 5 Lunas (`codex exec -m gpt-6-luna -C <worktree> "<prompt>"`), no máximo 2 rodando testes ao mesmo tempo (PC com ~1,7 GB livres).
3–6. **Acompanhamento:** a cada fatia entregue, leia o diff: escopo dentro da faixa, nenhuma expectativa de teste antigo alterada, nenhum `[VERIFICAR]` inventado como valor.
7. **Revisão adversarial:** você ataca cada entrega (dado ausente vira VERDE? PHI em log? efeito externo sem gateway? conduta escrita pela IA?). Achado vira fatia de correção para a Luna dona.
8. **Correções:** segunda rodada das Lunas.
9. **Integração em série** em `f0/w10-astra`: merge `--no-ff` de cada Luna, depois `npx tsc --noEmit` · `npm run check:boundaries` · `npm run check:corpus` · `npx vitest run <pastas tocadas> tests/w3 --no-file-parallelism` (nunca a suíte inteira).
10. **Relatório** `docs/progresso/W10-ASTRA.md`: o que cada Luna entregou, achados da revisão, saídas reais, PEDIDOS ao tech lead. Sem push: o tech lead integra em `f0/w1-integrado`.
