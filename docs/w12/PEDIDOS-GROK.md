# W12 · PEDIDOS · GROK

## GROK-01
1. **Contrato `SalaoRuleset.cortes.fcMinNaoCorta`.** O nome ficou no schema (`src/contracts/regras.ts`). D-W9-58 mudou o comportamento: FC abaixo desse inteiro corta na FN-01. Pedido: renomear o campo para `fcMin` quando o tech lead abrir o contrato. O JSON conserva a chave antiga para o parse não quebrar.
2. **Comentário de `ResultadoTriagem.naoCortes`** em `src/contracts/clinico.ts` ainda diz que FC&lt;50 é anotação. Fora da faixa. Pedido: atualizar o comentário para D-W9-58.

## GROK-04
1. **Contrato da sugestão de grau a partir de texto.** `ResultadoCtcaeClinico` está marcado `PROVISORIO-W12` em `src/rules/ctcaeClinico.ts`. Pedido: publicar o tipo quando o contrato abrir. O módulo não importa outras regras; o corpus entra por parâmetro.

## GROK-05
1. **Contrato da cadeia de retorno.** `EntradaRetornoToxicidade` e `ResultadoRetornoToxicidade` estão marcados `PROVISORIO-W12` em `src/rules/retornoToxicidade.ts`. Pedido: publicar os tipos quando o contrato abrir. O módulo não importa outras regras; corte, alerta de plaquetas e suporte entram prontos pelo barrel.
