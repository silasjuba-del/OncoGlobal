# W9-CURSOR · FATIAS · telas dos gates (revisão obrigatória, pendência, saída bloqueada)

> Leia primeiro `docs/ondas/W9-COMUM.md` e `docs/ondas/W6-CURSOR.md` + `docs/progresso/W6-CURSOR.md` (continuação da W6; mesmos padrões de `src/ui/api` e `src/ui/telas`). EXECUTOR = `CURSOR`. Worktree `...\OncoGlobal-wt\w9-cursor` · branch `f0/w9-cursor` (a partir de `f0/w1-integrado`; traga o que a W6 já entregou só depois que o tech lead integrar, não faça merge sozinho).
> **Faixa:** `src/ui/api/**`, `src/ui/telas/**`, `tests/ui-telas/**`. Pedido de fiação fora da faixa vai em `docs/w6/APP-WIRING.patch` ou `docs/w9/PEDIDOS-CURSOR.md`.
> **Critérios de design (Dr. Silas):** menos cliques, consulta mais curta, comando → tela pronta → 1 clique validar, médico no centro, administração mínima. Alerta nunca bloqueia o clínico. Sem Tailwind novo/dependência nova. Textos em português, sem jargão de TI. Use o microcopy e ícones da Muse se já integrados; senão `[VERIFICAR]`.
> Os gates vêm do Codex (W9-CODEX): consuma por **tipos de `src/contracts`** e por `src/ui/api`; nunca importe de `src/kernel`. Enquanto a API real não existir, use dublê sintético ("Paciente Teste NN") atrás da mesma interface.

## CURSOR-01 · Modelo de visão dos vereditos
`src/ui/api/`: view model único para veredito de gate (PASSA / ALERTA / PENDENTE / bloqueio de artefato ou saída), teto de 5 estados, cor + texto + ícone (nunca só cor). Ausente = PENDENTE, nunca verde.

## CURSOR-02 · Lateralidade (G-07): revisão obrigatória em 1 clique
Card compacto com as 4 fontes lado a lado (PATH, RADS, procedimento, diagnóstico), divergência destacada, ação única "Revisei" que registra a decisão do médico. Lateralidade ausente = PENDENTE visível. Não bloqueia salvar nem avançar a consulta.

## CURSOR-03 · Anatomia × sexo (G-08)
Aviso de identidade/anatomia no cabeçalho do paciente quando houver incoerência (ex.: próstata × cadastro F): linguagem neutra, "conferir cadastro", nunca veto. Sexo não informado = PENDENTE.

## CURSOR-04 · pTNM (G-09)
Campo pT de biópsia aparece rejeitado com o motivo ("sem ressecção") e cT permanece editável; ressecção sem TNM explícito = PENDENTE. A tela nunca preenche TNM sozinha.

## CURSOR-05 · Saída externa bloqueada (G-27)
Quando uma saída for bloqueada por falta de sanitização: mensagem clara do que falta e que nada saiu do PC, sem expor PHI na mensagem. Rascunho e impressão local seguem livres. Canais externos continuam desligados (`CANAL_EXTERNO_NAO_HABILITADO` tratado com texto amigável).

## CURSOR-06 · Semáforo de interações (FN-16) e fichas (K-26)
Componentes prontos para o dublê: interação VERMELHO como achado (nunca bloqueio), "checagem incompleta" = PENDENTE; seletor de ficha inteira por versão (uma ficha, nunca mistura de versões). Sem conteúdo clínico real.

## CURSOR-07 · Painel de curadoria do Dr. Silas
Tela única que lista tudo que está `[VERIFICAR]` (tabelas de lateralidade, anatomia×sexo, fichas, interações, limiar de foto ilegível, fonte do CNS) lida de um arquivo de pendências; 1 clique marca "decidido" localmente. Administração mínima.

## CURSOR-08 · Fechamento
Testes `tests/ui-telas/` (estados, acessibilidade básica: foco, rótulos, contraste), `tsc`, boundaries, corpus, `tests/w3/auditoria-regressao.test.ts`. Relatório `docs/progresso/W9-CURSOR.md` com capturas se possível, pendências e patches de fiação.
