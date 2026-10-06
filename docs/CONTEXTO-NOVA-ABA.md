# CONTEXTO PARA NOVA ABA · OncoGlobal (WORK) · atualizado 2026-10-06

> Cole este arquivo inteiro na nova aba. Você assume o papel de **tech lead/orquestrador (Claude)**. O Dr. Silas é a autoridade clínica final.

## 1. Projeto
Motor longitudinal de contexto oncológico centrado na consulta paciente ↔ médico do **Dr. Silas** (oncologista, SUS). v1 monousuário, roda só no PC dele. Node 24 (`node:sqlite`, WAL), TypeScript strict, Zod 4, Vitest 5, React 19 + Vite. **Sem PHI para LLM; dados só no PC** (exceções: A8 transcrição Plaud já desidentificada, A9 comando de voz curto, A10 canal WhatsApp).
- **Repo:** `C:\Users\silas\Projects\OncoGlobal` (GitHub `silasjuba-del/OncoGlobal`, privado). Branch de integração **`f0/w1-integrado`** (espelhada em `f0/w0-contratos`, PR #1 rascunho). Último commit: `d014c51`.
- **Worktrees:** `C:\Users\silas\Projects\OncoGlobal-wt\<nome>` (um por executor). Prompts em `_prompts/` e em `docs/ondas/`.
- **CANONICA** (`...\Oncomind\ONCOGLOBAL\ONCOMIND\CANONICA`) só muda com ordem expressa do Dr. Silas.
- **Memória do Claude:** `C:\Users\silas\.claude\projects\C--Users-silas-iCloudDrive-Oncomind-ONCOGLOBAL-ONCOMIND-CANONICA\memory\` (índice `MEMORY.md`; status em `project_oncoglobal_decisoes_qa.md`).

## 2. Regras que nunca mudam
IA propõe, código calcula, **médico decide e assina**. Ausente = PENDENTE, nunca VERDE. Conflito nunca some. O app alerta e nunca bloqueia o clínico (bloqueia só artefato, saída externa de PHI e autoridade de IA). Efeito externo só pelo Action Gateway. Validar não imprime. Teto de 5 estados. Valor clínico/dose/SIGTAP/fonte não decididos = `[VERIFICAR]`. Só dados sintéticos ("Paciente Teste NN", CPF/CNS com DV inválido de propósito). Contratos `src/contracts/**` congelados.
**Decisões:** `docs/DECISOES.md` (Q01–Q59, A1–A11, D-W5-01…10, D-W8-01). Destaques: fuso −03:00; aviso APAC adiantado ≤1 dia ok (atrasar não); lote APAC diário com vários pacientes e **uma competência**; cabeçalho institucional configurável (Hospital do Bem só exemplo); impressora escolhida no sistema; kit de documentos do Dr. Silas = `DECISAO_MEDICA`.

## 3. Estado por onda
| Onda | Quem | Estado |
|---|---|---|
| W0–W3 | contratos, regras, kernel, módulos, UI base | **integradas** |
| W5 | Fugu Ultra + Codex (auditoria adversarial multiagente) | **integrada**; CP-001, CP-002, AMB-001/002 fechados pelo tech lead |
| W8 GLM | prompts 1.1, rulesets estruturais inativos, pack próstata, capabilities | **integrada** |
| W8 Antigravity | regras puras do caso real em `src/rules/w8` | **integrada** (10/10) |
| W8 Kimi | cobertura normativa e provas adversariais | **10/10 entregue, NÃO integrada** (branch `f0/w8-kimi`, último commit `e3cd6b2`) |
| W8 Muse | design, microcopy, ícones, protótipos | em andamento (4 commits) |
| W6 Cursor | telas (`src/ui/telas`, `src/ui/api`) | em andamento (11 commits) |
| W7 Codex | app de pé (`src/app`, `src/leitura`, `src/impressao`, sintéticos, latência) | em andamento (10 commits) |

**Verificação:** a suíte inteira estoura a memória (15,5 GB, ~1,7 GB livres). Rode **em blocos, em série**: `npx vitest run <pastas> --no-file-parallelism`. Sempre `npx tsc --noEmit`, `npm run check:boundaries`, `npm run check:corpus`. Estado verde conhecido: tsc ok, fronteiras 92 arquivos, corpus 23 arquivos, ~488+ testes.

## 4. Próxima ação imediata: integrar o Kimi
1. Conferir escopo: `git diff --name-only f0/w1-integrado...f0/w8-kimi` deve ficar em `tests/cobertura/**`, `tests/fixtures/caso07/**`, `tests/adv-w8/**`, `docs/progresso/W8-KIMI.md`, `docs/w8/ACHADOS-KIMI.md`.
2. `git merge --no-ff f0/w8-kimi`, rodar a verificação em blocos.
3. **Achados do Kimi** (`docs/w8/ACHADOS-KIMI.md`): 9 arquivos `.adv.ts`, 41 testes, **10 falhas = todas `SEM_IMPLEMENTACAO`** (rodar com `npx vitest run --config tests/adv-w8/vitest.config.ts --no-file-parallelism`; ficam fora da suíte regular de propósito). Lacunas reais, **nenhuma expectativa foi ajustada**:
   - **G-07/T-49** lateralidade PATH×RADS×procedimento×diagnóstico (S1)
   - **G-08/T-50** anatomia × sexo cadastral (S1)
   - **G-09/T-51** pTNM exige ressecção + TNM explícito (S1)
   - **G-27/N25** sanitizador + gate de saída externa limpa (S0 latente, contido porque todo egress está fechado)
   - **K-26/N17** biblioteca de fichas aprovadas (S2) · **N19**, **FN-16/T-34**, **T-56/G-16** (ver o arquivo)
   - dono provável: `src/kernel/harness` (gates) + `src/kernel/llm` (sanitizador), com curadoria clínica do Dr. Silas.
   - Há também `adv` de dedupe D1/D2 do caso real; as funções do Antigravity (`src/rules/w8`) já existem, falta ligá-las ao pipeline.
4. Decidir se vira uma onda de implementação dos gates G-07/G-08/G-09/G-27 (dono: kernel; prompt a escrever, estilo `docs/ondas/W5-FUGU-ULTRA.md`).

## 5. Pendências abertas
**Do Dr. Silas (clínicas/regulatórias):** critérios do "grau do caso" da biópsia (3 critérios, `patologia-agregacao`, inativo); fonte oficial do CNS (Portaria SAS/MS 711/2004 a confirmar); limiar de confiança para foto ilegível; curadoria das interações medicamentosas e das red flags/respostas fixas do canal; biblioteca de ~50 fichas de prescrição; layout oficial de exportação APAC para o SIA; SIGTAP; acentuação do texto do kit (veio sem acentos, mantido como está); acessos de impressora (impressão silenciosa `[VERIFICAR]`).
**Técnicas:** CP-001b (validação de emissão APAC persistida no ledger, hoje exportação APAC contida); envio WhatsApp/e-mail desligado até contato vinculado + consentimento; ligar `src/rules/w8` ao pipeline; alinhar tipos de snapshot de `src/modules` à projeção real; provider LLM (Q52 aberto); ativar rulesets `identificadores`, `dedupe-exame` quando houver consumidor; Antigravity pediu liberar import entre arquivos de `src/rules/w8` (não liberado).
**Integrações a fazer:** Muse, Cursor (W6), Codex (W7). Cada um tem relatório em `docs/progresso/W<n>-<EXEC>.md` (conferir escopo, mergear, verificar em blocos, push `f0/w1-integrado` e `f0/w1-integrado:f0/w0-contratos`). Codex pode não conseguir commitar (sandbox): procurar `COMMIT_PENDENTE_SANDBOX`.
- **Merge esperado:** Cursor pode gerar `docs/w6/APP-WIRING.patch` e Codex patches em `docs/w7/patches/` para o tech lead aplicar em arquivos fora da faixa deles.

## 6. Caso real 01 (sem PHI)
`docs/referencias/CASO-REAL-01-LICOES.md` guarda só as lições desidentificadas do kit de um paciente real (CPF rotulado "Cartão SUS", duplicatas, trechos riscados, fonte secundária, patologia por sítio). **O PDF original (`C:\Users\silas\OneDrive\PESSOAL\Exames-Cifrados\EDINALDO...pdf`) é dado real: não copiar, não citar nome, não enviar a executor.** Teste usa só o Paciente Teste 07 sintético.
Também em `docs/referencias/`: modelo visual da UI, kit de documentos 2026-05 (PDF+txt), laudo APAC oficial (PDF+campos).

## 7. Como orquestrar os executores
Papéis: **Fugu** (kernel, auditoria multiagente), **Cursor** (UI), **Codex** (app, leitura, impressão; modelo `gpt-5.5`, sandbox pode bloquear commit), **GLM** (corpus/prompts, estrutura sem conteúdo clínico), **Kimi** (testes/cobertura), **Antigravity** (regras puras; faz commits com o usuário do Dr. Silas), **Muse** (design). Cada um: worktree e branch próprios, **faixa de arquivos exclusiva**, prompt persistente com fatias numeradas e relatório de progresso para retomada. Ninguém faz push. Ninguém edita contratos, `package.json`, `check-boundaries.mjs`, DECISOES, PLANO, CANONICA. Pedidos fora da faixa viram patch/nota. Tech lead confere escopo, mergeia `--no-ff`, verifica em blocos, registra decisões em `docs/DECISOES.md` e faz push.
Commits do tech lead terminam com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (modelo da sessão atual).

## 8. Preferências do Dr. Silas
Respostas curtas e diretas, em português, sem jargão de TI; lidera com o resultado; ele decide as questões clínicas e quer ser consultado só quando bloqueia (usar AskUserQuestion com opções). Prefere prompts prontos para colar em cada executor. Critérios de design: menos cliques, consulta mais curta, máxima automação (comando → tela pronta → 1 clique validar), backend leve, médico no centro, administração mínima.
