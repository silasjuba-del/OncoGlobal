# W10 Luna 4 — integração longitudinal

## Alterações preparadas

- A reconciliação de laboratório distingue dosagens do mesmo marcador por data clínica completa. Divergências no mesmo dia permanecem conflito; quando a data é desconhecida, os valores não formam série temporal e qualquer divergência pelo marcador continua sem resolução. Nenhum timestamp de captura ou `criadoEm` vira data do exame.
- O snapshot só ordena temporalmente observações cujo payload traz `observacaoDatada: true` e `dataClinica` válida (`YYYY-MM-DD`). Preserva a lista de observações por evento, mantém divergências na mesma data como VERMELHO e deixa os demais campos sob a reconciliação de conflito já existente. A observação de data posterior organiza a leitura, sem produzir dado na ausência de valor.
- `stageHistory` mantém os fatos TNM confirmados/assinados do horizonte do snapshot, inclusive os que foram supersedidos, com data clínica, `sourceIds` reais (podem estar vazios), id do evento, revisão original e marcador de supersessão. A lista participa do `contentHash` e tem ordenação determinística. Valores gerais vigentes continuam seguindo a relação `supersedesEventId`.
- A estatística inclui metadados de escopo: leitura do ledger completo, período clínico não filtrado (`null`), denominador limitado a pacientes com evento confirmado vigente e contadores das exclusões observáveis. Não afirma prevalência nem população atendida.
- Foram adicionados casos para série laboratorial, observações datadas, TNM supersedido, identidade/lote/encontro, linfonodo de 14 mm e crescimento de 36% com aumento absoluto abaixo de 5 mm. O código RECIST não foi reescrito.

## Interface para Luna 5 / consumidor HTTP

- RECIST: `avaliarSerieRecist(input: RecistSerieInput): RecistSerieResultado`, de `src/rules/recist/index.ts`; elegibilidade segue explícita e as categorias continuam `PROPOSTO`.
- Estatística: `projetarEstatisticaLedger(db): ProjecaoEstatistica`, de `src/estatistica/index.ts`. Os campos históricos permanecem; metadados novos são aditivos. `periodoClinico` é `null` porque não há filtro temporal nessa API.
- Snapshot: `projetarSnapshot(eventos, patientId, tumorLotId, encounterId, projectionVersion, propostas?)` retorna `CaseSnapshot.stageHistory`; cada valor inclui `valor`, `eventId`, `data`, `sourceIds`, `revisaoOriginal` e `superseded`. Campo observacional inclui `observacoes` com data clínica.

## Limites e estado de validação

- Esta entrega não acrescenta contratos canônicos. `observacaoDatada` é um marcador de payload local e precisa de contrato/produtor tipado antes de ser tratado como uma interface ampla.
- A API de estatística não aceita período nem cria categorias clínicas ausentes dos produtores tipados. As exclusões contam eventos não confirmados, supersedidos, linhas duplicadas e grupos de administração inválidos/conflitados observáveis na entrada.
- Testes desta entrega foram escritos, mas não executados a pedido do coordenador. Typecheck, suites existentes, consumer HTTP e a prova REDTEAM RT-10 também não foram executados aqui. Nenhuma fatia W10 é declarada completa por este documento.
