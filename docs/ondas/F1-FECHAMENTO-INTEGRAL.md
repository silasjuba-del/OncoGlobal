# F1 — execução do fechamento integral

Data: 2026-10-14. Estado: EM EXECUÇÃO, sem declaração de fechamento.

Mandato do Dr. Silas neste chat: **“ORQUESTRE 5 LUNA PARA FECHAR F1 COMPLETA.”** O pedido autoriza a execução técnica do fechamento; não aprova automaticamente conteúdo clínico, envio de prontuário ao Genspark ou mudanças em checkouts concorrentes.

## Quadro da execução

1. **Temas:** integrar entregas F1, biblioteca de consulta, fontes, curadoria, jornada real, regressões e evidência final.
2. **Já previsto:** plano F1, D-F1-05/08/09/49/50, eixo N, Q50 e critérios registrados em `RELATORIO-F1.md`.
3. **Entrega:** corrigir defeitos demonstrados, disponibilizar a biblioteca na aplicação real, expandir mapeamento somente com evidência, validar exportação/conversão/importação e registrar limites.
4. **Implementação:** reutilizar kernel, SQLite, servidor, sessão e endpoints existentes; preservar Maestro/ORK e contratos clínicos.
5. **Biblioteca:** arquivos importados continuam RASCUNHO; consulta e alerta são distintos; Genspark é integração manual por pacote enquanto não houver outra capacidade comprovada.
6. **Autoridade:** mandato acima libera execução. Ativação clínica de regras/doses continua exigindo decisão humana identificada por item.
7. **Aceite:** checks completos no conteúdo estabilizado, prova sintética no navegador com persistência/reabertura, revisão independente e PR. Falha ou dependência externa permanece explícita.

## Base e propriedade

- Worktree: `C:\Users\silas\Projects\OncoGlobal-wt\codex-f1-fechamento-integral`.
- Branch: `codex/f1-fechamento-integral`, base `29c07e0` (inclui `9517c76` e os dois commits H2/H4 dos packs).
- Orquestrador/integrador: Codex principal; único responsável por Git, execução serial dos testes e integrações.
- Cinco agentes Codex Luna, com no máximo três auxiliares simultâneos. Trabalho em ondas.
- Checkouts Fugu `fugu-setor-eixon` e Cursor `cursor-setor-jornadas` preservados. WIP não é entrega integrada.

| Responsável | WRITE_SET / responsabilidade |
|---|---|
| Luna 1 | Leitura das bases, PRs, entregas paralelas e aceite; sem escrita inicial |
| Luna 2 | `docs/RELATORIO-F1.md` e reconciliação documental final, quando convocada |
| Luna 3 | `src/kernel/corpus/biblioteca.ts`, `src/server/biblioteca.ts`, schema BibliotecaEstado/leitura em `src/contracts/api/saidasHttp.ts`, `tests/f1/s3/biblioteca.test.ts`, `tests/f1/s3/http-biblioteca.test.ts` |
| Luna 4 | `src/ui/biblioteca/**`, `src/ui/api/biblioteca.ts`, `src/ui/OncoassistLocal.tsx`, `tests/f1/s3/biblioteca-ui.test.tsx` |
| Luna 5 | `scripts/converter-biblioteca-mapeamento.json`, `tests/f1/s3/mapeamento-biblioteca.test.ts` |
| Integrador | Este registro, integração de rotas se necessária, correções cruzadas demonstradas e artefatos de prova sintéticos fora do Git |

Não há sobreposição de arquivos entre os escritores. Nenhum agente faz commit, instala dependências ou executa baterias concorrentes. Ampliação de território é coordenada pelo integrador.

## Evidência inicial

- Fetch realizado: `origin/main` em `b12a6b6`; PRs #17, #18 e #19 abertos.
- CI do PR #19 verde em `9517c76`; isso não vale como teste dos commits posteriores.
- Backend de biblioteca existe; ponte converte arquivo em REFERENCIA, não REGRA executável.
- Mapeamento inicial: dois arquivos; exportação histórica de 224 arquivos não equivale a 224 itens importáveis.
- Packs H2/H4 preservam 28 protocolos SUS VERIFICAR, fontes e pendências; nenhum número é promovido para fechar estatística.

Resultados finais e comandos serão registrados após execução, sem substituir evidência por planejamento.

## Resultado da execução

Cinco Lunas entregaram: base/revisão independente, reconciliação documental, backend, UI real e mapeamento de fontes. Integração feita pelo Codex principal.

Ampliações coordenadas: Luna4 também escreveu `src/contracts/api/biblioteca.ts`, a porta opcional de biblioteca em `src/contracts/api/porta.ts` e seu transporte em `src/ui/api/http.ts`. O integrador acrescentou proxy `/biblioteca` em `vite.config.ts`, triagem exata de 14 hashes em `docs/f0-fecha/PHI-TRIAGEM.json` e regressões das duas falhas encontradas na revisão. Nenhuma dose ou aprovação clínica foi alterada.

CI completo em 4163e36: 3607/457; F1 786/94; W10 240/31; W8 41/9. Build local e cinco testes de UI aprovados. Windows integral sem resultado consolidado: interrompido, não PASS. Primeiras tentativas locais inválidas por descoberta de dependências via link temporário e índice documental diferente da árvore não contam como validação. Nenhum teste foi removido ou afrouxado; link antigo preservado sob `dist/node_modules/base-anterior`, excluído pelas regras originais de descoberta. Dependências reutilizadas do checkout com package-lock idêntico; manifestos de dependência não mudaram.

Snapshot253; pacote convertido2; exclusões251 com motivos. Prova visual/reinício documentada no relatório F1. PR20 criado e anexado ao chat; PR17/18/19 preservados. O encerramento integral permanece condicionado a revisão/integração, curadoria das lacunas e aceite humano, sem usar autorização técnica como aprovação clínica.

Entrega Cursor `03d74dd` incorporada como `8189f7e` (somente browser-b2.js e servidor-demo-b2.ts). Harness reexecutado no integrador: seis famílias, propostas, recusa RASCUNHO, hashes e zero chamadas externas; histórico assinado permanece zero. A saída `persistiu = qtd >= 0` não era prova de persistência: corrigida para `historicoConsultado`, com espera explícita da região. Evidência inicial desta reexecução `%TEMP%/s12-b2-evidence-UKyk5D`; não aprova fichas nem produz assinatura QT.
