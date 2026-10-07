# PEDIDOS-GROK · W10

Faixa: `docs/ondas/W10-GROK.md`. Contrato que falta fica com tipo local `// PROVISORIO-W10` dentro da faixa. Nada aqui edita `src/contracts/**`, `package.json` ou `src/ui/**`.

## GROK-01

1. **Contrato C-08.** `Triagem` não tem PAD nem creatinina. O portão usa `SinaisExtraW10` em `src/rules/triagem.ts` e o espelho em `src/rules/index.ts` (`pad: number | null` em mmHg; `crCentesimos: number | null`, 150 = 1,50 mg/dL). Trocar por campo em `src/contracts/w10/` (ou na Triagem) e apagar o tipo local.
2. **R-08.** `src/rules/` não importa `src/rules/`. As funções `avaliarCorteSalao`, `avaliarTriagemCiclo` e `avaliarPortoesW10` estão copiadas em `triagem.ts` e `index.ts`. A paridade está em `tests/w10-grok/grok-01-portoes.test.ts`. Liberar o barrel a reexportar, ou aceitar as duas cópias.
3. **`header.versao` preso em 1.0.0.** A suíte FN-01 compara `rulesetVersao` com a constante `1.0.0`. O acréscimo D-W9-37/38/22g não bumpou o semver. Quando o tech lead autorizar, subir o ruleset e a expectativa juntos.
4. **`corpus/rulesets/lab-thresholds.v1.json` está fora da faixa** (`salao-*` / `rads-*` / `agenda-*` / `interacoes-*`). CREAT continua `ativo: false`. Pedido: ativar com `limiarSuperior` 150 (centésimos de mg/dL), fonte D-W9-37, sem limiar inventado no `.ts`.
5. **Religação.** `avaliarTriagem` (FN-01) continua com FC &lt; 50 em `naoCortes`. Os testes congelados e o comentário de `ResultadoTriagem` exigem isso. O corte D-W9-37 (FC &lt; 50 → `FILA_MEDICO`, alerta) está só em `avaliarCorteSalao`. Quem orquestra a tela precisa chamar `avaliarPortoesW10` além da FN-01. `src/ui/api/fake.ts` está fora da faixa e ainda não vê `portoes`.
6. **PAS &gt; 160 e FC &gt; 120** continuam só no objeto `cortes` da FN-01 (Q21). Não foram copiados para `corteSalao`, para não fundir os portões (D-W9-22g).

## GROK-02

1. **Ficha do protocolo.** `ProtocoloCiclo` e `LabsCiclo` estão em `src/rules/portaCiclo.ts` (`// PROVISORIO-W10`). Trocar pelos limiares de bula em `src/contracts/w10/` (neutrófilos, plaquetas, clearance, FEVE, cada um com mínimo inteiro).
2. **G1 de hemoglobina e de plaquetas** depende do LIN no CTCAE v6. A tabela não inventa LIN: valor nessa zona fica com grau `null`, estado `PENDENTE`, nunca 0.
3. **FEVE na porta** só compara o mínimo declarado na ficha. O alerta D-W9-34b (método, data, fármaco programado) fica para a GROK-03.
4. **Barrel.** `portaCiclo` e `grauCtcae` ficam em `src/rules/portaCiclo.ts`, no mesmo molde de `ctcaeGrau.ts` (R-08 impede o `index.ts` de reexportar).
