# W10-INT-PRESCRICAO · relatório (equipe interna, Claude Sonnet 5.5)

Faixa: `src/rules/prescricao/**`, `src/rules/morfometria/**`, `tests/rules-prescricao/**`, `tests/rules-morfometria/**`. Sem push. Barrel `src/rules/index.ts` não tocado.

## Fatias
| # | Entrega | Estado | Commit |
|---|---|---|---|
| 01 | `parserLinha` (QuickLine; o que não reconhece vai a `pendencias`) | FEITA | a332c2c |
| 02 | `instanciarProtocolo` (FIXED/MG_KG/MG_M2/AUC; PENDENTE sem dado; recusa se ≠ CONFERIDA_MEDICO) | FEITA | 4c0bc15 |
| 03 | `aplicarAjuste` (só −20/−30/−40, motivo obrigatório) | FEITA | 601ff29 |
| 04 | `diffCiclo` (só exceções) | FEITA | 7b90226 |
| 05 | `classificarDocumento` (tabela injetada; sem tabela embutida) | FEITA | 8f83cc1 |
| 06 | `safetyEngine` | FEITA | 7464123 |
| 07 | morfometria TS puro (+36 casos do Python) | FEITA | 2dd58b1 |

## Decisões de implementação (para o tech lead conferir)
- **Fronteira R-08**: `src/rules` não pode importar irmãos (nem de `src/rules/prescricao/`), então cada arquivo é autocontido; helpers pequenos (`norm`, arredondamento) estão duplicados de propósito. Não há `index.ts` na pasta (reexportar é do barrel, que não é meu).
- **FN-04 no 02/03**: a regra de arredondamento (meio para cima, inteiro, uma vez) foi COPIADA; os testes provam equivalência com `calcularDose` de `src/rules/dose.ts` (importado só nos testes).
- **BSA**: não há fórmula decidida; `bsaM2` vem pronta em `dados`. mg/m² sem peso ou sem altura ou sem BSA ⇒ PENDENTE.
- **Calvert (AUC)**: dose = AUC × (ClCr + 25), **sem teto de ClCr** (nenhum teto decidido em DECISOES) — `[VERIFICAR]` com o Dr. Silas.
- **Unidade**: item calculado (mg/m², mg/kg, AUC) passa a `unit="mg"`; a unidade original fica em `unidadePadrao`.
- **Ciclo anterior (02)**: a redução do ciclo anterior NÃO é repetida automaticamente; a dose prescrita anterior vai em `doseAnteriorPrescrita` (base do 03) e o 04 destaca a diferença.
- **03**: base = `item.prescribedDose` ou `opcoes.doseBase`; recusa ajuste sobre item já ajustado sem base explícita (não compõe).
- **06**: `ValidationRequirement` e `LabsEntrada` são tipos locais `PROVISORIO-W10` (o contrato não os define) → **pedido ao tech lead**: promover `ValidationRequirement` a `src/contracts/w10/`. `safetyEngine(itens, requisitos, labs, limiares?)` recebe os limiares de bula (`template.limiaresBula`) como 4º parâmetro. Precedência BLOCK_ARTEFATO > NOT_EVALUABLE > WARNING > PASS. Dado antigo/sem data/futuro (só quando `maximumDataAgeDays` declarado) = NOT_EVALUABLE.
- **05**: tabela injetada `TabelaRegulatoria`; fora da tabela = PENDENTE (padrão só se a própria tabela declarar); entradas divergentes = CONFLITO. A tabela real (Portaria 344/98, RDC 471/2021) continua `[VERIFICAR]` e fica no corpus (fora da minha faixa).
- **07**: nomes em camelCase (`dicomPointsMm`, `farthestPairMm`…), opções em objeto; SVD de Jacobi unilateral (singularidade precisa sem NumPy), autovalores por Jacobi cíclico. Entradas `string` numéricas, aceitas pelo NumPy, são recusadas aqui (mais estrito). Gabarito contra o Python não foi rodado nesta fatia; os 36 casos são o oráculo.

## Testes criados
tests/rules-prescricao: parserLinha (16), instanciarProtocolo (9), aplicarAjuste (7), diffCiclo (7), classificarDocumento (7), safetyEngine (14) · tests/rules-morfometria: morfometriaCore (36). Total 96. Sem `.adv.ts` tocado; sem PEDIDOS fora desta nota.

## Saídas reais (último ciclo, série)
```
== tsc
tsc exit 0
== boundaries
> node scripts/check-boundaries.mjs

fronteiras ok (163 arquivos)
```
```
 RUN  v5.0.3 C:/Users/silas/Projects/OncoGlobal-wt/w10-int-prescricao
 Test Files  7 passed (7)
      Tests  96 passed (96)
```
