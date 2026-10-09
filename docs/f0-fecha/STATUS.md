# F0 — painel de fechamento

**Estado atual: verificação final em andamento. PR #4 em rascunho.** Não está liberado para merge. Missão: `docs/ondas/F0-FECHAMENTO-ASTRA.md`, D-W9-80. Astra é writer único de `f0/w1-integrado`; merge na main exclusivo do Dr. Silas.

## Evidência e portões

| Etapa | Resultado verificado |
|---|---|
| Base A1 | PASS: 2.169 regulares/296 arquivos, 226 redteam/28, 41 W8/9; TypeScript, fronteiras 290, corpus 125 |
| Integração A6 | PASS em 72ce726: 2.240 regulares/311, 240 redteam/31, 41 W8/9; fronteiras 293, corpus 125 |
| L3 | PASS integral na repetição no mesmo HEAD d342b54: 2.244 regulares/312; 240 redteam; 41 W8 |
| L4 | PASS integral em 8d17818: 2.248 regulares/313; 240 redteam; 41 W8 |
| L2 e correções C2 | PASS integral em f5bd4a3: 2.278 regulares/323; 240 redteam; 41 W8; fronteiras 299, corpus 125 |
| Auditoria de escopo | M1/M2 corrigidos em 1b56427; 87 testes focais + E2E adicional PASS; Claude operacional aprovou reataque |
| L1 | Importada por seis arquivos de 8543c33, entrega f3b4343. Bateria C1-L1 PARTIAL: Q50 legitimamente pendente, falha nativa de worker no bloco 08; isolado 3/3 PASS não substitui bateria completa |
| L5 | Integrada; scanner focal 8/8 PASS em PHI-integrado-03.log. Auditoria complementar encontrou lacunas de cobertura em revisão pela Luna 5 |
| D1 | Claude operacional: sem ALTO/MÉDIO no código clínico auditado; delta final de higiene com três MÉDIOS, em correção |
| D2 | origin/main reconciliada por merge 7936820, sem mudança de conteúdo e sem conflito |
| D3 | PASS: demo real HTTP/SQLite e navegador, nove capturas, assinatura e reabertura após recarga; ver ../F0-DEMO.md |
| D4 | PR #4 aberto em rascunho; bateria final/CI pendentes |

## Integração sem perda

Astra c0c0762 integrada por 06d404a, GLM-21 por ad01bba, GLM-22 por b15bb0d, Kimi Q26 por 1afc9b9, planejamento por 72ce726. Nenhuma rota sumiu. As três provas redteam originais permanecem; as versões adicionais Astra estão em arquivos próprios. EQUIVALENCIA-A6.md explica os dois patches não equivalentes no inventário inicial.

Cinco Lunas entregaram seus relatórios; a correção C2 preservou os commits originais e seus logs vermelhos. L1 foi importada por faixa para não antecipar a ancestry da L5. Os demais deltas foram integrados por merge/cherry-pick com origem registrada. Inventário final e justificativas acompanham a entrega.

## Riscos e limites

- Interrupções nativas esporádicas de Node/Vitest ocorreram com threads e forks. Causa não estabelecida; as baterias vermelhas estão preservadas. Rodada isolada verde não é fechamento.
- F0 local monousuário, provider externo desligado. Corpus não curado permanece RASCUNHO. Não há autorização clínica automática.
- Demo: ingestão inicial por HTTP, não upload PDF no navegador; pedido laboratorial com itens PENDENTE, sem impressão ou exportação. Grade de poltronas ilustrativa não comprova agendamento. Datas documentais da demo usam dia/mês/ano.
- Baixos da auditoria: drafts legados sem contexto exigem revínculo; vinculação da impressão ao contexto selecionado e melhoria da apresentação/textos ficam para F1.
- Scanner é uma verificação limitada da superfície Git; revisão de binários e hash não equivalem a anonimização universal nem prova de todo histórico Git.

## Próximas fases / decisões humanas

F1+: receitas na Flash, orientações do canal curadas, biomarcadores extras, jornadas clínicas completas CTCAE/RECIST, roteador de modelos, capacidades proativas, grafo/vetores e medição de custo. Modelo Flash e prazo editável foram incluídos por esta missão, apesar do adiamento original.

D2: os seis arquivos antigos do Cursor continuam preservados, fora desta integração. D4: LIMPEZA-WORKTREES.md é somente proposta. D5: CANONICA-PATCH.md é somente proposta. Nenhum worktree removido e nenhum documento da CANONICA real alterado. Main e tag aguardam o Dr. Silas.

Histórico integral deste painel antes da consolidação: commit 7936820; evidências brutas em `evidencias/`, relatórios LUNA-N.md, C2-*.md e auditorias. Este painel não substitui os logs.
