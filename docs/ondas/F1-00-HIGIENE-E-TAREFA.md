# PLANO PARA O CODEX · F1-00 higiene + F1-W0a Tarefa · 2026-10-10

> Autor: Claude (chat operacional), auditor cruzado em leitura. Base auditada: `origin/f0/w1-integrado@65427c7` ("F0 pronta para merge"). O PR #4 `f0/w1-integrado → main` está **OPEN, MERGEABLE, CI verde**.
> Entradas: (1) a revisão de terceiro sobre a auditoria do Kimi, com o prompt "F1-00 higiene"; (2) a auditoria adversarial da regra S2→S4 (tarefa SISTEMA de coleta de exames).
> Este arquivo ficou fora do repositório de propósito, porque o integrado está congelado (D-W9-80). Depois do merge, copiar para `docs/ondas/F1-00-HIGIENE-E-TAREFA.md`.

---

## 0. Ordem: não mexer no PR #4
Nenhum achado abaixo põe paciente em risco **hoje**: todos falham para o lado seguro ou estão latentes. Reabrir o PR #4 obrigaria a refazer toda a verificação da F0.
**Sequência:**
1. o Dr. Silas faz o merge do PR #4;
2. a Astra cria a tag `f0-fechada`;
3. a F1-00 abre num ramo novo a partir da `main` (`f1/00-higiene`);
4. a F1-W0a (Tarefa) roda em paralelo, em `f1/w0a-tarefa`. As faixas são disjuntas.

## 1. Conferência dos achados no código (`65427c7`)

| # | Achado | Veredito | Prova (arquivo:linha) | Produção hoje |
|---|---|---|---|---|
| C1 | AC ciclo 3 com prescrição vencida salta o médico | ✅ CONFIRMADO | `cicloComMedico.ts`: o ramo AC devolve `cortes‖pendentes` e não lê `qtPodeIniciarSemMedico`; `dose.v1.json:10` tem `ciclo3SaltaSe` com 2 condições × `salao-triagem.v1.json:42` com 3 (inclui `PRESCRICAO_VIGENTE`) | latente (`prescricaoVigente: null` em `leituras.ts:512`) |
| C2 | Neutropenia febril sem E1 no portão | ⚠️ PARCIAL: risco de contrato (ALTO), não falha de produção | `ResultadoPortao` (`triagem.ts:204`) não tem `emergencia`; produção usa `base.emergencia` de FN-01 (`leituras.ts:523`) | E1 acende |
| C3 | `requisitosAplicaveis: []` = passe livre | ✅ CONFIRMADO | `regras.ts:47` sem `.min(1)` | latente (lista fixa e completa em `leituras.ts:513`) |
| A3 | Aviso APAC some se ninguém abrir o app entre os dias 85 e 89 | ✅ CONFIRMADO e **vivo** | `apac.ts:78` `dias >= 85 && dias < 90`; `apacPrazo` é consumido por `leituras.ts` e `TelaApacLote.tsx` | **sim**, viola D-W5-02 ("atrasar o aviso não é aceitável") |
| A4 | Header de ruleset sem `fonte` obrigatória | ❌ **INCORRETO** | `rulesetHeader.mjs:7–17`: `fonte` é objeto `.strict()` obrigatório, `referencia.min(1)`, e K-27 exige trecho em fonte externa. O `.passthrough()` de `regras.ts:21–38` está nos **corpos**, não no header | — |
| — | Correção proposta "fonte: z.string().min(1)" | ❌ **REJEITAR** | Trocaria um objeto rico por string: perderia tipo, trecho e edição. Seria regressão | — |
| M1 | `tokenAC` por token solto | ✅ CONFIRMADO | `cicloComMedico.ts:4–6`: qualquer esquema com o pedaço "AC" vira AC | latente |
| M2 | `terceiraPessoa` incompleta | ✅ CONFIRMADO | `redFlagsCanal.ts:56–57`: faltam irmão/irmã, avô/avó, neto/neta, tio/tia, sobrinho, cunhado, genro/nora, marido/mulher, cuidador, vizinho | canal desligado |
| M4 | FN-05 duplicada | ✅ CONFIRMADO | `validadeHemograma` em `triagem.ts:12` **e** em `validade.ts:11` | as duas vivas |
| D1 | "`index.ts` com 722 linhas de cópias" | ❌ **DESATUALIZADO** | resolvido na W12-GROK-02: hoje são 106 linhas de re-export, mais 3 wrappers finos | — |
| D2 | Creatinina e PAD sempre nulos no salão | ✅ CONFIRMADO | `leituras.ts:517` `{ pad: null, crCentesimos: null }` → `compararLimite` (`triagem.ts:365`) cria `pendente.cr` → `leituras.ts:520` manda **todo** paciente para FILA_MEDICO | **sim**: salão inerte (lado seguro, fadiga de alarme) |
| D3 | Prescrição nunca chega à triagem | ✅ CONFIRMADO | `leituras.ts:512` `prescricaoVigente: null` → `qtPodeIniciarSemMedico` sempre `false` | **sim**: ninguém aplica sem médico (lado seguro) |
| T0 | Regra da tarefa SISTEMA escrita antes de existir a entidade | ✅ CONFIRMADO | não existe `Tarefa` em `src/contracts/**` nem ruleset `tarefas-coleta` | — |

## 2. F1-00 · Higiene de regras (ramo `f1/00-higiene`, a partir da `main` depois do merge)
O prompt de terceiro foi corrigido: entram 7 itens, cai a "duplicação do index" (já resolvida) e cai a troca de `fonte` por string (regressão).

**Prompt (Codex, modalidade GOAL, 1 Luna ou a própria Astra):**
```
Repo OncoGlobal, ramo f1/00-higiene a partir de main (pós-merge do PR #4). Fatia F1-00 · higiene de regras clínicas.
Faixa: src/rules/{cicloComMedico,triagem,validade,apac,redFlagsCanal}.ts, src/server/leituras.ts (só item 8), corpus/rulesets/salao-triagem.v1.json (validade da Cr), src/rules/index.ts (só re-export),
src/contracts/regras.ts, corpus/rulesets/dose.v1.json, tests/f1-00/**. Não tocar consulta/UI/servidor.

1. FN-05 fonte única: triagem.ts deixa de definir validadeHemograma e importa de validade.ts.
   Teste: index.validadeHemograma === validade.validadeHemograma (mesma referência).
2. FN-09 (C1): ramo AC fora de ciclosComMedico → return !r.qtPodeIniciarSemMedico.
   dose.v1.json: ciclo3SaltaSe ganha "PRESCRICAO_VIGENTE"; versão +minor.
   Teste: AC c3, sem corte, sem pendência, rx vencida → vai ao médico; rx vigente → salta.
3. M1: AC identificado por lista explícita no ruleset (AC.esquemas: ids exatos), não por token.
   Teste: "AC-T", "AC" → AC; "EC", "TAC", "FOLFOX" → não AC. Lista ausente → todos vão ao médico (lado seguro).
4. K-10 (C3): requisitosAplicaveis .min(1). Teste: lista vazia → parse rejeita.
5. D-W5-02 (A3): apac.ts aviso = dias >= 85 && ultimoAvisoEm === null (sem teto). faturamentoPodeEmitir não muda.
   Teste: dia 91 sem aviso prévio → aviso=true; dia 84 → false; já avisado → false.
6. C2 (contrato): ResultadoPortao ganha emergencia: boolean, calculada pela MESMA função de E1 do FN-01 (sem cópia).
   Teste: avaliarPortoesW10 sozinho com febre >37,8 + ANC <500 → emergencia=true; E1 não altera a fila (A7).
8. D-W9-82 (D2) — NUNCA PARAR O SERVIÇO: em src/server/leituras.ts (faixa estendida só para este item) o corte do salão recebe
   crCentesimos = valorAtual(série de creatinina do ledger, validade injetada do ruleset; padrão = validade do hemograma, 7 dias).
   Sem valor válido: NÃO gera pendência que mande à FILA_MEDICO; gera alerta visível "creatinina não disponível" (naoCorte).
   PAD (não coletada no salão): só avalia se informada; ausente não pendencia. Valor presente acima do limite continua cortando.
   Testes: Cr 1,2 de 3 dias → passa; Cr 1,6 → FILA_MEDICO; sem Cr → segue com alerta, destino não muda por isso; Cr de 10 dias → alerta "dado antigo".
7. M2: terceiraPessoa acrescenta irmão/irmã, avô/avó, neto/neta, tio/tia, sobrinho/a, cunhado/a, genro, nora,
   meu marido, minha mulher, cuidador/a, vizinho/a (sem acento e com acento). Teste: 1 frase por termo → alvo "contato".
Regras: nunca afrouxar teste existente; mudar uma expectativa antiga só se ela codificava o bug, com o comentário "F1-00 corrige <id>".
Prova: tsc · check-boundaries · validate-corpus · tests/rules tests/modules tests/corpus tests/contracts tests/f1-00 ·
redteam · adv-w8 (em blocos, --no-file-parallelism). Commit único "F1-00: higiene de regras (C1 C2 C3 A3 M1 M2 FN-05)". Sem documentos.
```

**D2 (creatinina) entrou na F1-00 como item 8 (D-W9-82: nunca parar o serviço).** Fica para depois só a D3: Corrigir exige fonte de dado real: a creatinina vem do último laboratório válido (`valorAtual`, W12-GROK-09); a PAD vem do formulário de triagem; a prescrição vigente vem do ledger de prescrição assinada. Isso é trabalho de F3 (salão), não de higiene.

## 3. F1-W0a · Entidade Tarefa, contrato antes da regra (ramo `f1/w0a-tarefa`)
A auditoria S2→S4 está correta: não existe entidade, então nenhum gate segura a regra. Aceito o desenho com três ajustes:
- **Nome dos eventos:** "E1…E6" colide com o alerta de emergência E1 (Q22/A7). Usar **EV-T1…EV-T6**.
- **Estados:** RASCUNHO · CONFIRMADA · CONCLUIDA · CANCELADA · SUPERSEDED são 5 e cabem no teto (Q9). É a dimensão nova **D12 Tarefa**, registrada como pedido de estado.
- **Data relativa:** "retorno em 14 dias" = data civil de hoje + n, com fuso −03:00 injetado (D-W5-01). O relógio entra por parâmetro, nunca dentro da regra.

**Sequência (cada passo é um commit; GOAL por passo):**

| Passo | Entrega | Prova |
|---|---|---|
| W0a | `src/contracts/f1/tarefa.ts`: `Tarefa` {tarefaId, patientId, encounterId, tipo `COLETAR_EXAMES_PRE_RETORNO`, texto, origem SISTEMA·DITADO·MANUAL, estado (5), vinculo {pedidoRef, retornoRef}, geradaPorEventoId, suprimeSistemaRef?, rulesetVersao, assinaturaRef?, criadoEm} + `corpus/rulesets/tarefas-coleta.v1.json` (tabela de decisão, `ativo:false` até a curadoria) | testes de contrato (valores válidos e inválidos) |
| S3 | FN-27 pura `gerarTarefaColeta(pedido, retorno{data│RELATIVA│null}, ditadoClassificado, hoje)` → {tarefa?, flagRevisar?, motivo}, seguindo a tabela §2.2 da auditoria (7 linhas, sem caminho silencioso) | A11 (a)–(f) |
| S4 | EV-T1 (prescrição assinada com pedido e retorno datado → cria), EV-T2 (retorno ganha data → cria), EV-T3 (retorno perde data → CANCELADA + REVISAR) no ledger; idempotência por `pedidoId+retornoId` (G-20) | A11 (f)(h)(i) |
| S5 | EV-T4 (resultado chega → CONCLUIDA por evento), EV-T5 (pedido cancelado → CANCELADA em cascata), EV-T6 (retorno antes da validade do exame → VERMELHO, nunca bloqueio); "o que falta" vem de uma só fonte, junto com as pendências R-17 | A11 (g) + teste sem tarefa zumbi |
| S6 | Tarefa RASCUNHO só na tela e no bundle; CONFIRMADA ao assinar o bundle (A1/G-25); RASCUNHO não sai em pedido impresso nem na visão da secretaria; CONCLUIDA/CANCELADA não entram no bundle | A11 (k)(l) |
| S7 | e2e do caso canônico "Pantoprazol… retorno em 14 dias" → receita + 2 pedidos + retorno + 1 tarefa SISTEMA rascunho → assinada | arquivo e2e verde 3× |

**A11 final (12 casos, todos GIVEN/WHEN/THEN):**
- (a) sem data → 0 tarefa + REVISAR
- (b) "em 14 dias" → 1 SISTEMA com data resolvida
- (c) data passada → 0 + REVISAR
- (d) ditado inequívoco → 1 DITADO, 0 SISTEMA, AuditEvent de supressão
- (e) ditado ambíguo → tarefa SISTEMA mantida + conflito ao médico (D-W9-81)
- (f) replay → 1 tarefa
- (g) resultado chega → CONCLUIDA, não reaparece
- (h) retorno ganha data → cria
- (i) retorno perde data → CANCELADA + REVISAR
- (j) dois retornos datados → 2 tarefas com vínculo
- (k) RASCUNHO fora do impresso e da secretaria
- (l) CONCLUIDA/CANCELADA fora do bundle

## 4. Paralelismo
- **Depois do merge do PR #4:** F1-00 ‖ F1-W0a. As faixas são disjuntas: F1-00 em `src/rules/*` + `regras.ts` + `dose`; W0a em `src/contracts/f1/**` + `corpus/rulesets/tarefas-coleta*` + `tests/f1-w0a/**`.
- A F1-00 entra primeiro na integração. S3–S7 são seriais entre si.
- A máquina tem pouca RAM: código em paralelo, baterias de teste em série.

## 5. Decisões do Dr. Silas (respondidas em 2026-10-10)
**1 = SIM:** PR #4 mergeado (`8d456ab`), tag `f0-fechada`. **2 = FICA** (D-W9-81). **3 = ADIANTA, nunca parar o serviço ou setor** (D-W9-82, item 8 da F1-00).
Base da F1: ramo `f1/integrado` a partir da `main`. Os ramos `f1/00-higiene` e `f1/w0a-tarefa` saem de `f1/integrado`.

### Perguntas originais
1. **Merge do PR #4 agora**, deixando a F1-00 para depois? Recomendado: **sim**.
2. **Ditado ambíguo** ("coletar em jejum", "já coletou ontem"): manter a tarefa SISTEMA + conflito ao médico (recomendado, coerente com INV-07 e D-W9-34a) **ou** segurar a tarefa até o médico resolver?
3. **Salão inerte (D2/D3):** aceitar até a F3 (todo paciente vai à fila do médico) **ou** antecipar só a creatinina do último laboratório válido?
