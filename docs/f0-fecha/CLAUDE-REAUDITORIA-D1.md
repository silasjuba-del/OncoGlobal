# Reauditoria D1 + revisão L1/L5 · Claude (auditor cruzado, só leitura) · 2026-10-09 · v2

Pedido: `docs/f0-fecha/COORDENACAO-APOIO.md` (Astra). Bases lidas:
- `f0/w1-integrado@1b56427`, com `47acfd5` só de documentação;
- `f0/f0f-luna1@8543c33`;
- `f0/f0f-astra-c2@5e84ac4`, com a triagem PHI atual.

Nenhum teste foi rodado pelo Claude (o TEST_SLOT é da Astra). A evidência é leitura de código e diffs, mais scripts de conferência só de leitura.

**Veredito: nenhum achado ALTO ou MÉDIO. D1 liberado do lado do Claude.** Há 2 observações BAIXAS (§1.3 e §2.2).

## 1. Prioridade 1 · reataque M1/M2 (`1b56427`)
1. **M1, lote × paciente dono:**
   - `selecionarContexto` zera o contexto da sessão **antes** de validar (`rotas.ts`, `deps.sessoes.selecionarConsulta(token, null)`). Uma seleção recusada não deixa contexto antigo.
   - Lote não nulo de outro paciente ou inexistente → `409 TUMOR_LOT_FORA_DO_PACIENTE`.
   - `carregarConsulta` tem a mesma checagem dentro de `lerConsulta` (`leituras.ts:169`).
   - As rotas Flash (rascunho/preparar) comparam o pedido com o contexto da sessão e agora devolvem o erro da leitura clínica em vez de resumo vazio.
   - **Sessão antiga ou forjada:** está coberta pela prova M1 em `tests/f0-fecha/auditoria-escopo.test.ts`.
2. **M2, draft sem contexto:**
   - `exibirBundle` → `DRAFT_CONTEXTO_AUSENTE`, com lote normalizado `undefined→null`.
   - `confirmarBloco` → `DRAFT_FORA_DO_ESCOPO` para `!contexto`. Isso cobre o **recibo antigo** colocado na sessão, que também está na prova M2.
   - `contextoDraft` só devolve `string|null`, então as duas comparações são coerentes.
   - As 3 fixtures alteradas **só ganharam `contexto`**. Nenhum `expect` foi removido.
3. **BAIXO:** um draft criado antes desta regra e sem `contexto` fica sem uso. Só pesa em produção com dado legado. O caminho correto é religar o draft pela caixa de revisão, nunca preencher automaticamente.

## 2. Prioridade 2 · pontos fora da auditoria preliminar
1. **Preservação A3 (rotas e provas):**
   - A6 (`369db84`) → HEAD: **0 testes apagados, 0 `src` apagados**; 33/33 rotas mantidas; red team com **194 casos `it/test` antes e depois, 0 `expect` removidos**.
   - Rotas do integrado pré-A3 (`cdf897d`, com Flash da W12-F4) e do ramo Astra: todas presentes. A única "ausente", `capacidadePendente` (stub 501), foi **substituída pelas rotas reais** `salvarTriagemSalao`, `liberarSalao` e `vincularCanal` (F04/F07/F08), nos mesmos endereços.
2. **`autorizarSaida` e gateway:**
   - Envio por WhatsApp, e-mail e agenda fica sempre negado (`CANAL_EXTERNO_NAO_HABILITADO`).
   - Destino livre é negado.
   - O artefato precisa estar ASSINADO, vigente (`eventosVigentes`) e casar com documento, versão e encontro.
   - `EXPORTAR_APAC` fica contido (`VALIDACAO_APAC_NAO_PERSISTIDA`).
   - Idempotência persistida no ledger antes do executor.
   - **BAIXO:** o `escopo` (paciente/encontro) do `/acao` vem do corpo do pedido e não é comparado ao contexto selecionado na sessão, ao contrário das rotas de consulta depois de M1/M2. O impacto é pequeno: exige sessão válida, só serve para artefato já assinado e o efeito é impressão local, num sistema monousuário. Sugestão para F1: amarrar o `escopo` a `sessoes.consultaSelecionada`.
3. **OncoAssist, provedor e desidentificação:** `criarOncoassistJev` só liga com `ONCOASSIST_JEV_ENABLED === "true"`. Antes de qualquer envio, aplica `desidentificar` e recusa com `PHI_RESIDUAL` se `contemPhiResidual` acusar. Isso está coerente com "LLM externa desligada" na F0.
4. **Matriz e scanner:** ver §3 e §4.

## 3. Luna 5 + triagem atual (`5e84ac4`)
- O manifesto `PHI-TRIAGEM.json` tem 80 arquivos e 211 ocorrências.
  - **0 pendentes**, **0 sem sha256**, **0 sem linha/ordinal**, **0 curingas de pasta**.
  - O WEBP tem disposição própria amarrada ao sha256, com a confirmação do Dr. Silas ("IMAGEM FICTICIA" no chat Codex; "SEM DADO DE PACIENTE" no chat Claude).
- **Concordância independente: as 35 disposições propostas pelo Claude (`CLAUDE-TRIAGEM-PHI.json`) são iguais às da Astra em 35/35.**
- `tests/ui-telas/percursos.test.tsx` (L5) só ganhou `timeout`. Nenhuma asserção mudou.
- Pendente, como a própria Astra registra: **rodar o scanner no integrado final**, depois de incorporar os artefatos novos.

## 4. Luna 1 (`8543c33`): fases e mapeamento
- **205/205 provas citadas nas linhas VERDE existem** (arquivo + nome do caso).
- **Correção do Claude sobre a v1 deste relatório:**
  - As "duplicatas" (D-W9-80 e outras 24) são a seção **"Checklist organizacional (N-A)"**, repetida de propósito. **Não é defeito.**
  - D-W9-75 **já está dividida** em 75a (F0) e 75b (F2).
- **Separação núcleo testado × integração F1+:** 20 linhas F1+ têm teste real (ex.: Q20 bundles, D-W9-60 limites de dose, T-35/T-36 CTCAE/RECIST). Todas trazem a justificativa normativa ("código/testes existentes não significam UI entregue"). Isso está **coerente com o PLANO**: N-A ≠ "não implementado".
- Sugestões de forma, BAIXAS:
  - A linha-pai D-W9-75 ainda cita `grok-04-texto` (que é da 75a) com fase F2. Melhor apontar para os filhos.
  - T-35 diz que a funcionalidade CTCAE "passa a F1, F0 conserva stub", mas D-W9-73 (v6 pura) está VERDE na F0 usando `avaliarCtcaeGrau`. Vale uma frase dizendo que as tabelas v6 estão provadas na F0 e a jornada clínica de CTCAE é F1.
- **Integração:** como já estava combinado na COORDENAÇÃO, entrar **só a faixa da matriz**, a partir do integrado. O ramo L1 tem versões não equivalentes de `f212803`/`2e0544c`/`4c548f8` e conflita em `src/server/rotas.ts` com `1b56427`.

## 5. Cursor
Nenhuma lacuna concreta de produto foi encontrada. **O Cursor continua sem tarefa na F0.**
