# W12 · PEDIDOS · GROK

## GROK-01
1. **Contrato `SalaoRuleset.cortes.fcMinNaoCorta`.** O nome ficou no schema (`src/contracts/regras.ts`). D-W9-58 mudou o comportamento: FC abaixo desse inteiro corta na FN-01. Pedido: renomear o campo para `fcMin` quando o tech lead abrir o contrato. O JSON conserva a chave antiga para o parse não quebrar.
2. **Comentário de `ResultadoTriagem.naoCortes`** em `src/contracts/clinico.ts` ainda diz que FC&lt;50 é anotação. Fora da faixa. Pedido: atualizar o comentário para D-W9-58.

## GROK-04
1. **Contrato da sugestão de grau a partir de texto.** `ResultadoCtcaeClinico` está marcado `PROVISORIO-W12` em `src/rules/ctcaeClinico.ts`. Pedido: publicar o tipo quando o contrato abrir. O módulo não importa outras regras; o corpus entra por parâmetro.

## GROK-05
1. **Contrato da cadeia de retorno.** `EntradaRetornoToxicidade` e `ResultadoRetornoToxicidade` estão marcados `PROVISORIO-W12` em `src/rules/retornoToxicidade.ts`. Pedido: publicar os tipos quando o contrato abrir. O módulo não importa outras regras; corte, alerta de plaquetas e suporte entram prontos pelo barrel.

## GROK-06
1. **`SalaoRuleset.cortes.ecog2ComTonturaCorta`.** D-W9-76 tirou o ramo do corte. A chave continua no JSON porque o schema a exige. O código não lê mais o booleano e não emite `naoCorte.ecog.tontura`. Pedido: retirar o campo do contrato quando ele abrir.
2. **Histórico e início da vertigem.** `EntradaVertigem` está em `src/rules/tontura.ts` (`PROVISORIO-W12`). `Triagem` só tem `tontura`. Pedido: publicar histórico anterior e início novo. Ausente fica PENDENTE e não vira "novo".
3. **Formulário do salão.** `src/ui/salao/FormTriagem.tsx` ainda guarda tontura como checkbox que nasce em `false`. Fora da faixa desta onda. Pedido: o campo precisa aceitar desconhecido (`null`), não só sim/não.

## GROK-07
1. **Contrato do intervalo pós-QT.** `ResultadoIntervaloPosQt` está em `src/rules/intervaloPosQt.ts` (`PROVISORIO-W12`) e lê `corpus/rulesets/intervalos.v1.json`. A FN-07 (`avisoIntervaloPosQt` + `prazos.v1.json` 1.0.0) não mudou. Pedido: publicar o tipo quando o contrato abrir, sem fundir os dois rulesets.

## GROK-08
1. **Contrato do canal.** `ResultadoCanal` está em `src/rules/canalRedflags.ts` (`PROVISORIO-W12`). Não substitui `redFlagsCanal.ts`. Pedido: publicar o tipo. As 25 orientações estão em RASCUNHO para curadoria. A frase de febre ao paciente não traz início de antibiótico; o texto final é do Dr. Silas.
