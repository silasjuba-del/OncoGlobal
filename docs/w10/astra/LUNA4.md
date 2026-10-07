# LUNA 4 — RECIST longitudinal e estatística local

Execute F07 e F08 no worktree `C:\Users\silas\Projects\OncoGlobal-wt\w10-luna4`, branch `f0/w10-luna4`, base `04b53db31598fb80ff78192d4cd3eafde36428fd`, como `gpt-6-luna`. Astra define estratégia e revisa. Você não está sozinho: preserve terceiros e os outros worktrees.

## Escopo e leitura

Escreva só `src/rules/recist/**`, `src/estatistica/**`, `tests/w10-luna4/**`, relatório `docs/progresso/W10-LUNA4.md` e pedidos `docs/w10/PEDIDOS-LUNA4.md`. Leia DECISOES inteiro (D-W9-44, 52, 56, 57), raiz canônica §4, W10-COMUM/W8-COMUM, `src/contracts/w10/clinico-w10.ts`, contratos Evento, `src/kernel/ledger/{schema,ledger}.ts`, `docs/specs/PROMPT-ASSISTENTE-LONGITUDINAL.md`, `scripts/check-boundaries.mjs`. R-08: arquivo em rules só importa contratos, nem irmãos; mantenha núcleo puro autocontido, corpus por parâmetro. Não mude barrel nem checker.

## F07 — W10-LUNA4-01: RECIST verificável e proposto

Crie cálculo determinístico sobre séries explicitamente vinculadas ao mesmo paciente, episódio, baseline e conjunto estável de lesões-alvo, com fonte/data/unidade. Preserve lesão-alvo e procedência no envelope; soma, baseline, nadir, Δ absoluto e relativo são calculados. Nadir só usa pontos válidos anteriores/atuais da série, nunca futuro ou outro paciente; ordenação temporal não deve depender da ordem de entrada. Rejeite duplicidade/conflito temporal em vez de escolher silenciosamente.

PD por crescimento exige simultaneamente Δ nadir >=20% e >=5 mm; nenhuma comparação só por percentual. Novas lesões ausentes não significam false. Dados incompletos, não finitos, negativos, baseline/nadir zero sem porcentagem definida e alvo ausente exigem PENDENTE; não converta null em zero, não remova lesão silenciosamente. Contrato `RecistAvaliacao` obriga números: devolva envelope com `avaliacao:null` quando não calculável, usando tipo local `PROVISORIO-W10` e pedido canônico. Categoria nunca CONFIRMADO pelo cálculo. Não confunda resposta de alvos com resposta RECIST global: ausência de avaliação de não-alvos, novos achados ou qualidade necessária mantém categoria clínica pendente. Critérios adicionais RC/RP/DE devem ter fonte RECIST oficial verificável; se faltar, registre [VERIFICAR] e mantenha pendência, sem inventar regra. Medição de pixel/morfometria não é entrada automática para resposta.

Aceite: produto 20% com +4,9 mm não é PD; +5 mm com <20% não é PD; ambos iguais ao corte são PD proposta quando os outros dados necessários estão completos; baseline/nadir zero, NaN/Infinity, série embaralhada, futuro, outro paciente, novos achados null, alvo omitido/duplicado e não-alvos desconhecidos ficam explícitos. Mostre separadamente sucesso do cálculo e pendência da interpretação.

## F08 — W10-LUNA4-02: projeção estatística única

Crie derivação determinística a partir de eventos reais do ledger local (não dados paralelos, contadores incrementais ou mocks na aplicação). Adaptador pode receber o leitor de eventos/DB existente; não mude kernel/schema. Saída pública contém só contagens/categorias de vocabulário fechado; jamais patientId, nome, CNS/CPF, telefone, data de nascimento, trecho-fonte, texto clínico ou chave de categoria arbitrária controlada pelo payload.

Deduplicate internamente por paciente; múltiplos eventos, consultas e neoplasias não podem duplicar o total de pessoas. Defina explicitamente denominadores por categoria, preserve ausência como PENDENTE e conflitos como não resolvidos; não transforme proposta em diagnóstico confirmado. Reprocessamento e replay precisam produzir a mesma projeção sem incremento cumulativo duplicado. Supersessão/revogação usam semântica existente do ledger; se contrato insuficiente, não invente promoção: pedido e pendência. Registro cumulativo único pode ser projeção regenerável; não crie banco concorrente nem migração externa.

Aceite: integração em SQLite temporário com eventos sintéticos Paciente Teste NN; replay, ordem de eventos, dois pacientes, várias consultas do mesmo paciente, vários tumores, atualização/supersessão, conflito e payload malicioso com PHI nas categorias. Assert final por allowlist de chaves/valores e ausência de identificadores. Informe porta para L1/root consumir e limite de integração real.

## Validação e fechamento

Root instala dependências offline; nenhuma dependência nova. Todos os comandos somente pelo wrapper W10 serializado fornecido pela raiz: typecheck, boundaries, corpus, `npx.cmd vitest run tests/w10-luna4 --no-file-parallelism`, regressão `tests/w3/auditoria-regressao.test.ts --no-file-parallelism`. Sem suíte inteira, sem testes velhos alterados, sem push, sem no-verify, sem merge autônomo de base móvel.

Dois commits `W10-LUNA4-01: ...` e `W10-LUNA4-02: ...`, `Co-Authored-By: gpt-6-luna`. Relatório distingue cálculo pronto, consumidor integrado, pedidos, testes realmente executados e revisão clínica que permanece humana.
