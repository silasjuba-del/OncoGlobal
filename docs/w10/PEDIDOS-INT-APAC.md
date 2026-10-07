# PEDIDOS · INT-APAC (W10)

## Dependências
- BLOQUEADO_DEPENDENCIA: `docs/referencias/Layout_Exportacao_APAC.pdf` (rev. 08/07/2026) não está no repo; `src/apac/lote.ts` só tem a interface `ExportadorSia` e o motivo (D-W9-12, C6).
- Contrato (tech lead): finalidades RT (Radical, Adjuvante, Antiálgica, Paliativa, Prévia, Anti-hemorrágica) não existem em `FinalidadeApac` (`src/contracts/estados.ts` só tem as 5 de QT). `src/apac/campos.ts` mantém as listas localmente. Pedido: enum RT e campo `modalidade` (QT/RT) no contrato.
- Contrato: `Apac.campos` é `Record<string, unknown>`; `src/apac` assume chaves planas (ver `CAMPOS_SOLICITACAO` em `laudo.ts` e `CAMPOS_OBRIGATORIOS_PADRAO` em `antiglosa.ts`). Pedido: fixar o schema dessas chaves e as caixas `apac.<campo>` (CaixaNumerada.chave) no glossário.
- C6 (importador SIGTAP): a estrutura `TabelaSigtap` espera sexo, faixa de idade (meses) e CIDs compatíveis por procedimento; o CSV de referência só tem código/nome/valores, então CID/idade/sexo ficam `null` (não verificados) até o pacote oficial por competência ser importado.

## [VERIFICAR] (regras NÃO implementadas por falta de fonte)
- Lista oficial de campos obrigatórios do SIA por tipo de APAC (hoje lista injetável baseada no laudo D-W5-06).
- Chave e severidade da duplicidade (hoje ALERTA com CNS + procedimento principal + competência).
- Quantidade máxima/mínima por procedimento, procedimento secundário compatível, CBO do solicitante, validação de CEP/IBGE/UF.
- Dígito verificador do CNES (hoje só 7 dígitos; diferente do configurado = ALERTA).
- D90 vencida bloqueia exportação (Q34) e D85 aviso: confirmar contagem (dia da geração = D0).
- Janela de validade da APAC (PERÍODO DE VALIDADE) e relação data da solicitação × competência.
- Finalidade QT/RT por grupo SIGTAP (AG-12 só compara a escolha com o grupo, como ALERTA).
