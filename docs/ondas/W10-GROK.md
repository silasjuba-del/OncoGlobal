# W10-GROK · 14 FATIAS · Regras clínicas puras: salão, agenda, RADS, interações, ownership, dedupe, manifesto, ledger APAC

> Leia primeiro `docs/ondas/W10-COMUM.md` (inteiro). Absorve integralmente a antiga `docs/ondas/W9-GROK.md` (GROK-01…10) e acrescenta salão, agenda e RADS.
> EXECUTOR = `GROK`. Worktree `C:\Users\silas\Projects\OncoGlobal-wt\w10-grok` · branch `f0/w10-grok`.
> **Faixa:** `src/rules/**` **exceto** `src/rules/prescricao/**` e os arquivos já existentes de `src/rules/w8/*` (pode criar novos ao lado; o pedido de import entre arquivos de `w8` continua NÃO liberado — quem orquestra importa); `src/modules/**`; `src/kernel/harness/ownership.ts` (novo); `scripts/verificar-manifesto.mjs` (novo); `corpus/rulesets/{rads-*,salao-*,agenda-*,interacoes*}`; `tests/{rules,rules-w8,modules}/**`, `tests/w10-grok/**`; `docs/progresso/W10-GROK.md`, `docs/w10/PEDIDOS-GROK.md`.
> **Natureza do trabalho:** funções **puras e determinísticas**, sem I/O, sem LLM, sem dependência nova. Toda tabela clínica vem de **arquivo de ruleset versionado** (`corpus/rulesets/*.v1.json`, header com fonte/decisão), nunca hard-coded no `.ts`. Saída sempre com `motivo` legível + referência à decisão (D-W9-xx) ou fonte.
> **Alvos vermelhos que você deve deixar verdes sem mudar expectativa:** `tests/adv-w8/{fn16-t34-semaforo-interacoes,t56-g16-owner-write,n19-manifesto-merge,k26-n17-ficha-inteira,caso07-dedupe}.adv.ts` (leia cada um antes da fatia correspondente; importe nomes/caminhos que o teste espera; caminho fora da sua faixa ⇒ função pura aqui + patch de religação em PEDIDOS).

## GROK-01 · Corte do salão (D-W9-37/38) — revisão completa de `src/rules/triagem.ts` e afins
Implemente/ajuste os portões **em ruleset** (`corpus/rulesets/salao-triagem.v1.json`): febre **estritamente > 37,8 °C** (37,8 passa; `tempDecimos` 378 passa, 379 corta); **SpO₂ < 88%**; **PAS < 90** (hipotensão); **FC < 50**; **Hb < 8**; **Cr > 1,5**; N < 1.500 e PLQ < 100.000 (limiar de bula); ECOG 3–4 ⇒ fila do médico. **Valor igual ao limite passa.** Dois portões distintos e nomeados: **triagem do ciclo** (febre 37,9, PA > 14/9, FC > 110) × **corte do salão** — nunca fundir (D-W9-22g). Resultado = destino FILA_MEDICO + motivo; **nunca bloqueia salvar** (alerta). Idade ausente continua PENDENTE (D-W9-03, já implementado — não regredir). Testes de fronteira para cada limite (igual, logo acima, logo abaixo).

## GROK-02 · Limiar de bula × grau CTCAE (D-W9-22a)
Função `portaCiclo(labs, protocolo)` usa **limiares de bula declarados no protocolo/ficha** (neutrófilos, plaquetas, clearance, FEVE); `grauCtcae(...)` serve **só** para toxicidade e é confirmado pelo médico. Teste adversarial: N 1.200 com "grau ≥ 2" como porta solta o paciente ⇒ sua implementação **não** solta. Fronteiras CTCAE v6: N 1.000 = G1 e 999 = G2; Hb 8,0 = G2 e < 8,0 = G3; PLQ 10.000 = G3 e < 10.000 = G4. Graus ausentes nunca viram 0.

## GROK-03 · Alerta FEVE (D-W9-34b)
FEVE < 50% com antraciclina ou anti-HER2 **programado** ⇒ ALERTA (nunca bloqueio), com valor, método (ex.: Simpson) e data; FEVE ausente com esses fármacos ⇒ PENDENTE.

## GROK-04 · Agenda de QT (D-W9-39)
`validarAgenda(sessoes, regras)`: tratamento ≥ 5 h só inicia **até 12h**; **máximo 5 inícios a cada 30 min**; grade de poltronas por hora (padrão do `docs/referencias/ui-modelos/PADROES-UI.md`: 13 poltronas — valor no ruleset `agenda-qt.v1.json`, editável). Geração de sessões a partir de 1º dia + nº de ciclos + intervalo do protocolo. Conflito = ALERTA, nunca reorganização automática ("Otimizar dia" proibido).

## GROK-05 · RADS: catálogo das 30 emergências (D-W9-51)
Ruleset `corpus/rulesets/rads-emergencias.v1.json` a partir de `docs/referencias/rads/EMERGENCIAS-RADIOLOGICAS-30.md`: cada emergência = **cadeia** de elos (sinônimos por elo) + modalidade preferencial. Função `detectarEmergencias(laudoTexto)`: a cadeia só dispara com elos suficientes em ordem/proximidade definida no ruleset; **negação anula o elo** ("sem sinais de", "não há", "ausência de"); devolve trecho-fonte, lateralidade e nível. Testes: laudo sintético PT08 abdome (hidronefrose acentuada à direita ⇒ linha 7 uropatia obstrutiva = ALERTA; L5 lítica/blástica ⇒ linha 27 fratura patológica iminente = ALERTA) e PT08 crânio ⇒ **nenhum** alerta (falso positivo proibido).

## GROK-06 · INTERVAL_PROGRESSION (D-W9-43)
`intervalProgression(exameAnterior, exameAtual)`: mesmo sítio anatômico + mesmo método + aumento (medida ou "aumentado em relação a") ⇒ FLAG `INTERVAL_PROGRESSION` + exame dirigido sugerido como pendência; nunca gera M1. Teste com o exemplo sintético PT10 do Modelo 10 (L5 CO 2028 → 2029).

## GROK-07 · Nódulo < 1 cm e "Mx" (D-W9-31)
Nódulo < 1 cm (ou "6–7 mm") ⇒ `INDETERMINADO` + pendência "TC em 4 meses comparando"; nunca M1. Estadiamento com "Mx" ⇒ sugestão "cM0 com nódulos indeterminados" (alerta ao médico, não troca o texto dele).

## GROK-08 · FN-16 semáforo de interações (antiga GROK-01)
Faça `fn16-t34-semaforo-interacoes.adv.ts` ficar verde. Base de dados: `docs/referencias/onco-referencia/03-interacoes-qt.csv` → ruleset `interacoes.v1.json` **todo `ativo:false`** (ativação é item a item pelo Dr. Silas). Lista de medicamentos inclui a classe **NÃO ONCOLÓGICAS** (D-W9-47); lista incompleta ⇒ PENDENTE; "sem interação" só com checagem completa + ruleset ativo; interação ativa com fonte ⇒ VERMELHO como **achado**, nunca bloqueio. A coluna "absoluta/relativa" é editorial e nunca vira bloqueio (D-W9-22d).

## GROK-09 · Regras de suporte ligadas às não oncológicas
(a) **Diarreia > 24 h ⇒ alerta "suspender anti-hipertensivo"** se houver anti-hipertensivo na lista; **vômito + diarreia ⇒ orientar PS para hidratação venosa** (D-W9-28). (b) **Corticoide + DM-2 ⇒ alerta de hiperglicemia**. (c) Febre > 37,8 no canal ⇒ red flag "ir ao PS → hemograma → ATB se neutropênico". Só alertas com texto da biblioteca aprovada (D-W9-28); a IA não escreve conduta.

## GROK-10 · T-56/G-16 ownership em runtime (antiga GROK-02)
`src/kernel/harness/ownership.ts` (arquivo **novo**; não edite `gates.ts`): veredito de write por dono (`ownerOf` de `src/contracts/agentes.ts` + `corpus/capabilities.v1.json`). Write alheio ⇒ rejeitado; dono ⇒ passa; leitura alheia não é write. Verde em `t56-g16-owner-write.adv.ts`. Peça em PEDIDOS o registro no harness.

## GROK-11 · N19 verificador de diff × manifesto (antiga GROK-03)
`scripts/verificar-manifesto.mjs` (novo): reprova diff fora da trilha declarada (`docs/MANIFESTO-W1-F0.md` + as faixas da W10 em `W10-COMUM.md`), nomeando o arquivo; pina base + contratos/rulesets por hash. Verde em `n19-manifesto-merge.adv.ts`. Script npm sugerido em PEDIDOS (não edite `package.json`).

## GROK-12 · Dedupe de exames caso 07 + ligação de `src/rules/w8` (antigas GROK-05/06)
Função pura de dedupe (chave laboratório + nº exame + data de entrada; reimpressão com data de extração diferente não impede; RTU × IHQ de mesmo diagnóstico = dois exames). Verde em `caso07-dedupe.adv.ts` (se o teste exigir `src/leitura` — faixa do Fugu — deixe a função aqui e o patch de religação em PEDIDOS). As funções do Antigravity em `src/rules/w8/*` são orquestradas pelo **Fugu** (`src/orchestration`); você entrega a fachada `src/rules/w8-fachada.ts` (nova) que expõe as funções com tipos estáveis para ele consumir.

## GROK-13 · CP-001b APAC no ledger + snapshot (antigas GROK-07/08)
Validação de emissão APAC persistida via `src/modules` (uma competência por lote, vários pacientes, aviso ≤ 1 dia adiantado, fuso −03:00; finalidades D-W9-12 escolhidas pelo médico, nunca deduzidas da intenção; CNS pelo algoritmo e-SUS D-W9-13; CNES configurável D-W9-10). **Não** implemente exportação SIA nem antiglosa (equipe interna, `src/apac`). Alinhe os tipos de snapshot de `src/modules` à projeção do Fugu (combine via PEDIDOS; contratos são do tech lead).

## GROK-14 · K-26/N17 biblioteca de fichas (mecanismo) + fechamento
Mecanismo em `src/modules/documentos/`: carrega **uma ficha inteira** por `templateId + version + hash`; dose remontada de trechos é recusada; versão inexistente = erro tipado; identidade da ficha = **tumor + nome + cenário + versão** (D-W9-22b). Conteúdo das fichas é da equipe interna (`corpus/fichas/`); use fichas sintéticas nos testes. Verde em `k26-n17-ficha-inteira.adv.ts`. Rode a config adv: os 5 alvos do Grok verdes. Relatório `docs/progresso/W10-GROK.md`.
