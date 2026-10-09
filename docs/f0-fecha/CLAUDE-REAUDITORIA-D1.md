# Reauditoria D1 + revisão de L1/L5 · Claude (auditor cruzado, só leitura) · 2026-10-09

Base lida: `f0/w1-integrado@1b56427` (correções M1/M2). Ramos: `f0/f0f-luna1@8543c33` e `f0/f0f-luna5@8001655`. Nenhum teste rodado pelo Claude (o TEST_SLOT é da Astra); a leitura foi de código, diffs e logs.

## 1. Correções de escopo (`1b56427`): **APROVADAS, sem achado ALTO ou MÉDIO**
- **M1, lote de outro paciente:**
  - `selecionarContexto` agora **zera o contexto antes** de validar. Se a seleção falha, não sobra contexto velho. Depois exige que o `tumorLotId` não nulo pertença ao paciente (`lerLotes`), senão `409 TUMOR_LOT_FORA_DO_PACIENTE`.
  - `carregarConsulta` já tinha a mesma checagem dentro de `lerConsulta` (`leituras.ts:169`).
  - As rotas da Flash agora devolvem o erro da leitura clínica em vez de seguir com resumo vazio.
- **M2, draft sem contexto:**
  - `exibirBundle` recusa draft sem origem (`DRAFT_CONTEXTO_AUSENTE`) e compara o lote normalizando `undefined → null`.
  - `confirmarBloco` recusa `!contexto` (`DRAFT_FORA_DO_ESCOPO`).
  - `contextoDraft` só devolve `string | null`, então a comparação é coerente nos dois pontos. O contrato `Confirmar.tumorLotId` é `nullable` e obrigatório.
- **Testes:** `tests/f0-fecha/auditoria-escopo.test.ts` tem provas negativas para M1 e M2, incluindo sessão forjada.
  - As 3 fixtures alteradas (`tests/e2e/pipeline.test.tsx`, `tests/server/bundle.test.ts` e uma de servidor) **só ganharam o campo `contexto`**. Nenhuma asserção foi removida ou afrouxada.
- **Observação BAIXA (não bloqueia):** draft criado **antes** desta regra e sem `contexto` passa a ser impossível de exibir ou confirmar. Na F0 só há dado sintético, então não tem efeito. Em produção, isso pede um caminho explícito de "religar ao encontro" pela caixa de revisão, nunca preenchimento automático (regra: junção nunca automática).

## 2. Luna 5 (`8053d15` + `8001655`): **pode integrar, com uma ordem**
- `tests/ui-telas/percursos.test.tsx` só ganhou `{ timeout: 5_000 }` nos `waitFor`. Nenhuma asserção mudou, e isso está dentro do GOAL da L5.
- `tests/f0-fecha/phi-repo.test.ts`: 5 casos, sem `skip`/`only`. O caso global **falha por desenho** enquanto houver PENDENTE.
- **Ordem:** aplique primeiro as disposições de `CLAUDE-TRIAGEM-PHI.json` ao `PHI-TRIAGEM.json`. São os 35 itens, mais o webp revisado pelo Dr. Silas ("SEM DADO DE PACIENTE"), com o sha256 calculado na aplicação. **Depois** faça o merge. Se inverter, a bateria e o CI ficam vermelhos.
- `git merge-tree` não mostrou conflito com o integrado.

## 3. Luna 1: **NÃO fazer merge do ramo inteiro. Integrar só o que é dela**
- `git cherry` mostra que o ramo da L1 carrega **versões não equivalentes** de commits da Astra que já estão no integrado com outro conteúdo: `f212803` (caixa Flash), `2e0544c` (consulta HTTP), `4c548f8` (prova D41), além de `8053d15` da L5.
- `git merge-tree` dá **conflito em `src/server/rotas.ts`** com a correção `1b56427`. Fazer o merge do ramo arrisca reintroduzir a versão antiga das rotas.
- **Integrar só os commits próprios da L1:** `74925dc`, `9f8887c`, `221def6` e `8543c33` (matriz, `scripts/matriz-f0.*`, `tests/f0-fecha/matriz.test.ts`, prova das classes medicamentosas). Use `git cherry-pick -x`, conferindo que cada um toca só `docs/MATRIZ-…`, `scripts/matriz-f0.*` e `tests/**`. O que tocar `src/**` fica de fora e volta para a L1.
- **Antes de integrar, corrigir na matriz** (ver `CLAUDE-MAPA-MATRIZ.md`): a linha D-W9-80 duplicada e a separação de D-W9-75 em 75a e 75b.

## Veredito
Nenhum achado ALTO aberto. Portão D1 (auditoria) liberado do lado do Claude. O que falta é execução da Astra:
1. Aplicar a triagem e integrar a L5.
2. Fazer o cherry-pick seletivo da L1.
3. Rodar a bateria integral.
4. Reconciliar com a `main`.
5. Abrir o PR.
