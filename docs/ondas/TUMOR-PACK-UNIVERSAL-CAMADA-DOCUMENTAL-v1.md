# Tumor-Pack Universal — camada documental aditiva v1

Implementação de conteúdo do contrato apresentado no chat, sem alteração de contratos executáveis ou código da aplicação.

## Invariantes

1. Tipo de tumor abre o lote completo. Cenário, momento e fatos refinam a aplicabilidade, sem tornar CID ausente uma proibição conceitual de consulta.
2. Conhecimento, realidade do paciente e planejamento permanecem distintos. Esta camada contém somente conhecimento documental.
3. Todos os campos e itens legados permanecem semanticamente idênticos; a extensão não concede aprovação ao legado nem aos acréscimos.
4. Cada novo item tem identidade, condições, fonte com hash/página/seção, estado de extração, curadoria e pendências.
5. Doses, intervalos e classificações não extraídos permanecem pendentes. Nenhuma ausência significa normalidade ou não aplicabilidade.
6. Antiguidade, falta de referência completa ou limitação de acesso não removem um item. Divergências são preservadas; nenhuma fonte substitui outra silenciosamente.
7. Relações documentais podem representar caminhos e alternativas, mas não são regras clínicas executáveis. Não criam fatos, documentos assinados nem ações.
8. Indicação NCCN, registro Anvisa, incorporação, PCDT/DDT, SIGTAP/APAC, cobertura privada e acesso institucional são dimensões independentes.

## Estrutura nos arquivos

| Campo | Função |
|---|---|
| `metadados` | Versão/revisão da extensão, base Git, hashes originais e ausência de aprovação clínica. |
| `identidade_ref` | Referência à identidade tumoral original, sem renomear o registro clínico `TumorLot`. |
| `dominios` | Doze domínios do contrato universal, com referências ao legado e aos novos itens. |
| `indice_itens_legados` | Identificador, ponteiro JSON, hash e referência de origem para cada unidade indexada. O corpo completo continua no campo original. |
| `itens_nccn` | Novidades e detalhamentos documentais, incluindo relações com variantes já existentes. |
| `cenarios` | Referências separadas às listas de identidade e tratamento e às condições dos novos itens. |
| `fontes` | Identidade do PDF local, versão, SHA-256, quantidade de páginas e páginas examinadas. |
| `ensaios` | Referência integral ao legado; não transforma identificador de estudo não verificado em NCT confirmado. |
| `relacoes` | Condições extraídas e mapeamento operacional proposto, ambos explicitamente diferenciados. |
| `conflitos` | Novas divergências com referências às duas camadas, decisão médica nula e sem resolução automática. |
| `pendencias` | Lacunas da extração, curadoria, acesso e cobertura. |
| `mapa_de_cobertura` | Referência e hash de cada raiz original, abrangendo todos os valores descendentes, inclusive notas e correções. |
| `itens_adicionais_a_classificar` | Conteúdo transversal preservado, ainda não redistribuído entre domínios. |
| `relatorio_de_completude` | Distingue preservação integral do legado de extração parcial do NCCN. |

## Doze domínios

Diagnóstico/patologia; estadiamento/extensão/risco; biomarcadores/farmacogenética; exames/requisitos documentais; avaliação antes do tratamento; tratamento/protocolos; segurança/interações/toxicidades; suporte/cuidados; resposta/estado da doença; seguimento/sobrevivência; encaminhamentos/multiprofissional; documentos/acesso.

Os domínios organizam, mas não limitam conteúdo. Um item adicional não é descartado. A indexação por referência não equivale a reextração e normalização integral de todos os campos legados.

## Leitura e revisão

As referências JSON ao legado estão vinculadas ao hash do conteúdo original. Após uma futura reordenação de arrays ou alteração da base, o consumidor deverá revalidar o ponteiro e o hash, em vez de confiar na posição numérica. Essa regra é documental; nenhum consumidor foi implementado nesta rodada.

Os dados `A_CONFERIR` não podem ser promovidos a `ATIVO` por um validador técnico. Revisão humana futura deve registrar item, versão e conteúdo efetivamente conferidos. Aceitação de plano, emissão de pedido, realização do exame e revisão de resultado são eventos diferentes.

## Critério de validação desta entrega

Comparação recursiva de todos os valores antigos contra Git; hashes dos PDFs e dos trechos localizados; existência de todos os ponteiros; unicidade de IDs; correspondência entre índices/domínios/relações/conflitos; ausência de código alterado; validador de corpus original sem mudança de expectativas.

O inventário de fontes e as limitações estão em `FASE2-NCCN-DELTA-20261017.json`. Não interpretar a aprovação técnica dessa validação como validação de dose, recomendação clínica, cobertura assistencial ou fechamento integral do projeto.
