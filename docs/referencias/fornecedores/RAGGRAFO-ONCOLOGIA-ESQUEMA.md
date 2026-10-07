# ragGRAFO/oncologia · esquema do grafo (extração das aulas PRO 2026)

Fonte: `C:\Users\silas\.aside\u\0\sessions\2026-10-06_0ihhrP1OmLV0syHe\artifacts\slides-pro-2026` (10 módulos, 96 PDFs, 340 MB). Material de estudo do Dr. Silas; **status de todo nó = NAO_VERIFICADO** (resumo de aula, não evidência primária). PDFs não são copiados.

## Saída por módulo
`oncologia/modulos/<NN-slug>/nos.jsonl`, `arestas.jsonl`, `RESUMO.md` (UTF-8, uma linha JSON por registro).

## Nós (`{"id","tipo","nome","embedding_text","fonte":{"modulo","aula","pagina"},"status":"NAO_VERIFICADO", ...extras}`)
| tipo | prefixo id | extras |
|---|---|---|
| tumor | `tum.<slug>` | cid10 (se citado), subtipos |
| cenario | `cen.<tumor>.<slug>` (ex.: localizado, localmente-avancado, metastatico-1a-linha, 2a-linha, adjuvante, neoadjuvante, perioperatorio) | intencao (curativa/paliativa) |
| diagnostico | `dx.<tumor>.<slug>` | exame (EDA, biópsia, IHQ, imagem), achado-chave |
| estadiamento | `est.<tumor>.<slug>` | sistema (AJCC 8/9, BCLC, FIGO…), regra/categoria |
| biomarcador | `bio.<slug>` (ex.: her2, msi-dmmr, pd-l1-cps, cldn18-2, kras-g12c) | metodo, limiar/corte (literal da aula), quando_testar |
| regime | `reg.<tumor>.<slug>` | drogas (lista), linha, intencao, observacao (sem dose, salvo se literal na aula → campo dose_literal) |
| farmaco | `far.<slug>` (mesmo prefixo do ragGRAFO/prescricao) | classe |
| trial | `tri.<slug>` | fase, populacao, bracos, desfecho_primario, resultado (HR, IC, medianas/landmark literais), ano, status (positivo/negativo/NS) |
| fonte | `src.<modulo>.<aula>` | arquivo, paginas |

## Arestas (`{"de","rel","para", ...attrs}`)
TEM_CENARIO (tumor→cenario) · DIAGNOSTICA_POR (tumor→dx) · ESTADIA_POR (tumor→est) · EXIGE_BIOMARCADOR (cenario→bio; attr `para_que`) · TRATA_COM (cenario→regime; attrs linha, intencao, condicao_biomarcador) · USA_FARMACO (regime→far) · SUSTENTADO_POR (regime→trial) · TESTOU (trial→regime) · FONTE (qualquer→src; attr pagina).

## Regras
- Só o que está na aula; número literal com página. Nada inventado; ausente = omitir campo.
- Tom de conduta da aula vira dado ("aula recomenda"), nunca regra do app.
- Não copiar trechos longos (direito autoral): paráfrase curta.
- Sem dado de paciente.
