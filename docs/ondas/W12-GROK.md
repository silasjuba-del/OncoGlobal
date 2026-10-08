# W12 · GROK · 10 fatias (regras puras) · 2026-10-08

> Worktree `C:\Users\silas\Projects\OncoGlobal-wt\w12-grok`, branch `f0/w12-grok` (base `f0/w1-integrado`). Retomada: `docs/progresso/W12-GROK.md` (tabela FEITA/PARCIAL/BLOQUEADA, commit, saída real dos comandos). Caiu? Continue da primeira fatia não FEITA.
> Em paralelo: **Astra** trabalha em `src/server/**`, `src/app/**`, `src/kernel/gateway/**`, `src/rules/recist/**`, `src/estatistica/**`, `src/config/**`. Não toque nesses caminhos.

## Leitura obrigatória (nesta ordem)
1. `docs/ondas/W10-COMUM.md`: regras de máquina, invariantes, faixa do GROK. **Continua valendo**; onde diz W10, leia W12.
2. `docs/DECISOES.md` inteiro: Q01–Q59, A1–A11, D-W5, D-W8, D-W9-01…72. Tudo isso foi decidido pelo Dr. Silas; não crie `[VERIFICAR]` para o que já está decidido.
3. `docs/progresso/W10-GROK.md` (seu fechamento anterior) e `docs/w10/PEDIDOS-GROK.md`.
4. As regras que você vai tocar: `src/rules/triagem.ts`, `src/rules/portaCiclo.ts`, `src/rules/elegibilidadeCiclo.ts`, `src/rules/retorno.ts`, `src/rules/plaquetasAlerta.ts`, `src/rules/peso.ts`, `src/rules/index.ts`, `corpus/rulesets/{salao-triagem,salao-ctcae,lab-thresholds,canal-redflags,salao-suporte}.v1.json`.

## Faixa (EXCLUSIVA)
`src/rules/**`, **exceto** `src/rules/{prescricao,morfometria,recist}/**`. Você pode criar arquivos novos ao lado de `src/rules/w8/*`, mas não editar os que já existem lá. Também são seus: `src/modules/**`, `corpus/rulesets/{salao-*,lab-thresholds*,canal-redflags*,ctcae*,intervalos*}`, `tests/{rules,modules}/**` e `tests/w12-grok/**`.
**Proibido:** `src/contracts/**` (contrato faltando → tipo local `// PROVISORIO-W12` + nota em `docs/w12/PEDIDOS-GROK.md`), `package*.json`, `tsconfig.json`, `scripts/check-boundaries.mjs`, `.github/**`, `docs/DECISOES.md`, `tests/redteam/**`, `tests/adv-w8/**`, `tests/w11-adv/**` (só rodar, nunca editar) e mudar a expectativa de qualquer teste existente.
**Ao começar cada fatia:** `git merge f0/w1-integrado`.

## Contrato já ajustado pelo tech lead
`Triagem.tontura` agora é `boolean | null` (`src/contracts/clinico.ts`). `null` = desconhecido.

## As 10 fatias

### GROK-01 · Corte do salão alinhado a D-W9-37/38 (sobra da W10)
- Reescrever a FN-01 conforme D-W9-58: FC < 50 corta, alinhado à expectativa congelada.
- Ativar CREAT em `lab-thresholds`: Cr > 1,5 corta; 1,5 exato passa.
- Subir `salao-triagem` para **1.1.0**, com fonte D-W9-37 em cada limiar: SpO₂ < 88, PAS < 90 ou > 160, FC < 50, Hb < 8, Cr > 1,5, febre **estritamente > 37,8**, N < 1.500, PLQ < 100.000, ECOG 3–4.
- Valor igual ao limite passa. Testes de borda para cada limiar (abaixo, igual, acima).

### GROK-02 · Um só corpo de triagem e de porta de ciclo
- Hoje o barrel `src/rules/index.ts` expõe corpos duplicados de triagem e de `portaCiclo`. Deixe um único corpo, com as outras exportações como apelido.
- `portaCiclo` passa a ler o limiar de **bula** pelo tipo `LimiaresBula` de `src/contracts/w10/prescricao.ts`. Não use grau CTCAE (D-W9-22a).
- Prove com teste que a triagem do ciclo e o corte do salão continuam sendo portões distintos (D-W9-22g).

### GROK-03 · CTCAE v6 · termos clínicos no corpus
- `salao-ctcae` vai para **1.1.0** e ganha os termos: diarreia, náusea, vômito, mucosite oral, fadiga, neuropatia periférica sensitiva e febre.
- O critério de cada grau é o texto literal da **v6** (fonte `docs/referencias/onco-referencia/02-ctcae-v6.md`, com trecho).
- Termo sem trecho v6 no repositório: entra `ativo:false` com `NAO_VERIFICADO`, e o pedido vai para PEDIDOS.
- **CTCAE v6 pura (decisão do Dr. Silas):** nenhum corte da v5. Teste que prova que o valor 25.000 de plaquetas não aparece como limite G4.

### GROK-04 · Avaliador CTCAE clínico (puro)
- `src/rules/ctcaeClinico.ts`: recebe o termo e os critérios estruturados (ex.: evacuações acima do basal/24 h, hidratação EV indicada, hospitalização indicada, limitação de AVD) e devolve `{ grauCandidato, criteriosUsados, criteriosFaltantes, status }`.
- Critério que falta = grau `null` e status PENDENTE. Nunca adivinha o grau.
- **A IA nunca define o grau.** O resultado é candidato e o médico confirma.
- Plaquetas 20.000 = **G3** (v6) e vão para a fila do médico, sem E1.

### GROK-05 · Cadeia do retorno com toxicidade (caso "Paciente Teste 91")
Em `src/rules/retorno.ts` ou num arquivo novo ao lado, a entrada "diarreia G3 + plaquetas 20.000" deve gerar:
- destino FILA_MEDICO, com os motivos `corte.grau` e `corte.plq.baixa`;
- alerta de plaquetas < 50.000 independente do CTCAE (decisão de 08/10);
- G4 → alerta E1, que **não altera a fila** (Q22, A7);
- diarreia > 24 h com HAS na lista NÃO ONCOLÓGICA → alerta "suspender anti-hipertensivo" (D-W9-28, D-W9-47);
- vômito + diarreia → alerta "PS para hidratação venosa".

Tudo isso é alerta: nunca bloqueia o clínico e nunca define dose ou causalidade.

### GROK-06 · Desconhecido nunca vira "não"
- `tontura: null` → PENDENTE com motivo `pendente.tontura`. Nunca é tratada como `false`.
- Ausência de E1 nunca equivale a liberação: a saída nunca contém "liberado", "aprovado" ou "apto".
- Teste para cada campo opcional da triagem: ausente → PENDENTE, nunca VERDE.

### GROK-07 · Intervalo de 30 dias (Q56, A4)
- `src/rules/intervaloPosQt.ts` + `corpus/rulesets/intervalos.v1.json`: da **última administração** de QT até a cirurgia ou o início de RT sequencial. Menos de 30 dias → aviso; 30 exatos passa.
- Não se aplica a QT+RT concomitante planejada.
- Data ausente → PENDENTE. Data civil com fuso −03:00 injetado (D-W5-01).
- Só aviso, nunca trava.

### GROK-08 · Red flags do canal paciente (avaliador)
`src/rules/canalRedflags.ts`, que consome `corpus/rulesets/canal-redflags.v1.json` (25 sinais, D-W9-28):
- febre estritamente > 37,8;
- a negação ("não tem febre") não dispara;
- a resposta ao paciente é o texto FIXO do corpus ("procure a emergência"), nunca escrito pelo código;
- sempre gera alerta ao médico;
- nunca orienta tratamento, dose ou diagnóstico (Q43).

### GROK-09 · Valor atual × série temporal
- `src/rules/valorAtual.ts` (puro) escolhe o valor mais recente válido de uma série datada, dentro da validade do campo (ex.: hemograma 7 dias, peso 30 dias).
- Valores diferentes em **datas diferentes** = evolução, não conflito.
- Valores diferentes na **mesma data e hora clínica** = conflito: os dois candidatos aparecem e nenhum é eleito.
- Nada é apagado, nada vira média. Valor fora da validade → PENDENTE com o "dado antigo" visível.
- Caso de teste: plaquetas 180.000 em 21/07 e 20.000 em 04/08 → valor atual 20.000, com a série preservada.

### GROK-10 · Fechamento
- Exportar tudo no barrel.
- Teste de pureza: as regras novas não importam relógio, rede nem `node:fs`.
- Teste de determinismo: mesma entrada = mesma saída, e a entrada congelada não é mutada.
- Rodar e anotar no relatório: `tests/w11-adv/fuzz-regras.test.ts`, o red team e o adv-w8. Só rodar, nunca editar.
- Relatório `docs/progresso/W12-GROK.md`.

## Regras que reprovam a fatia
IA propõe, código calcula, médico decide · ausente = PENDENTE · conflito nunca some · alerta nunca bloqueia o clínico · semáforo VERDE/VERMELHO/PENDENTE, sem amarelo · só "Paciente Teste NN" · sem dependência nova · sem `--no-verify` · **sem push**.

## Máquina (pouca RAM)
Feche cada fatia **em série**, nunca a suíte inteira:
- `npx tsc --noEmit`
- `npm run check:boundaries`
- `npm run check:corpus`
- `npx vitest run tests/w12-grok tests/rules tests/modules --no-file-parallelism`
- `npx vitest run tests/w3/auditoria-regressao.test.ts`

Commit por fatia: `W12-GROK-NN: <título>` + `Co-Authored-By: <seu modelo>`.
