# Auditoria hostil e adversarial — duas rodadas

Data: 06/10/2026. Escopo: pacote local onco-referencia, sete capítulos Markdown, três CSVs e consolidado Markdown/Word/PDF. Auditoria documental e estrutural, com verificação clínica dirigida. **Resultado global: PARTIAL; não homologado para uso automático clínico.** Nenhuma API de LLM foi chamada, nenhum dado de paciente foi enviado e nenhum arquivo foi integrado ao aplicativo/repositório.

## Rodada 1 — ataque e correções

| ID | Severidade | Ataque / achado | Correção e evidência |
|---|---|---|---|
| ADV-01 | Alta | Infecção inespecífica recupera Sepse como proxy e cria gravidade/diagnóstico indevido | Removido proxy nos capítulos, consolidado e Word; termo específico preservado. Não converter infecção automaticamente em sepse. |
| ADV-02 | Alta | Evitar, suspender, reduzir dose ou descontinuar vira contraindicação formal | Legenda corrigida para distinguir categorias. Tabela histórica continua editorial, não classificação executável; reclassificação linha a linha pendente. |
| ADV-03 | Alta | Orofaringe HPV associada diagnosticada em 2026 recebe AJCC 8 | Corrigida vigência para versão 9; não foram inventadas novas categorias TNM. Manual completo e particularidades por sítio permanecem a conferir. |
| ADV-04 | Alta | Todo adenocarcinoma gástrico/JEG é encaminhado automaticamente a FLOT/durvalumabe | Fluxo passa por estágio, ressecabilidade e elegibilidade. FDA não prova aprovação/acesso no Brasil. |
| ADV-05 | Alta | ClCr 59 em tumor diferente gera exclusão universal por Galsky | Explicitado contexto urotelial metastático; não equivale a inelegibilidade a toda platina. |
| ADV-06 | Média | Fluxo editorial é apresentado como aprovação do Dr. Silas | Retirada atribuição não comprovada; preservado como fluxo ilustrativo. |
| ADV-07 | Média | Parser CSV interpreta comentário inicial como cabeçalho | Removidas linhas de comentário; metadados separados, contagem preservada. |

Evidência: alteracoes-rodada-1.json. Originais e SHA-256: originais/ e manifesto-originais.json.

## Rodada 2 — novo ataque, correção e regressão

| ID | Severidade | Ataque / achado | Resultado |
|---|---|---|---|
| ADV-08 | Alta | Recuperação do consolidado omite ressalvas adicionadas só ao capítulo | Ressalvas transversais inseridas no consolidado e Word. |
| ADV-09 | Alta | Aspas curvas no Word escapam das substituições e mantêm proxy/legenda indevida | Identificado no novo ataque; corrigido por texto de parágrafo e verificado novamente. |
| ADV-10 | Alta | HTTP 200 e coluna SIM são tomados como validação atual de SIGTAP/APAC | Coluna histórica preservada com status novo explícito NAO_REVALIDADO_LOTE_OFICIAL e uso_apac_automatico=NAO. Não reimportado lote oficial. |
| ADV-11 | Média | Terapia IV implica cobertura ANS garantida | Corrigida generalização; cobertura depende de indicação, contrato e regra vigente. |
| ADV-12 | Média | Citação ou dose dentro de faixa implica validação integral da receita | Removida garantia categórica; explicadas apresentação, duração, quantidade e adequação individual pendentes. |

Evidência: alteracoes-rodada-2.json e verificacao-rodada-2.json. **36 controles documentais executados: 36 PASS, zero FAIL.** São controles de conteúdo/estrutura, não teste de comportamento de um aplicativo nem avaliação de resposta de LLM. O script finalizar.py registra as asserções; inspecionar.py compara CTCAE e inspeciona CSV/UTF-8.

## Conferência independente de CTCAE

Baixado o Excel oficial NCI ctcae-v6.0.xlsx; cópia local ctcae-v6.0-oficial.xlsx. Comparados os 55 registros do CSV por código MedDRA e dez campos: SOC, termo, cinco graus, definição, nota de navegação e mudança v6. Texto normalizado apenas quanto a espaços. **550 comparações de campos: zero divergências.** Tradução PT-BR e curadoria de fármacos não foram validadas integralmente; texto CTCAE não atribui causalidade a um antineoplásico. Graus indisponíveis não se tornam zero. Estudos históricos não são migrados de versão por esta revisão.

## Fontes primárias consultadas

- NCI/CTEP, CTCAE e regras de graduação/atribuição: https://dctd.cancer.gov/research/ctep-trials/for-sites/adverse-events
- Excel oficial: https://dctd.cancer.gov/research/ctep-trials/trial-development/ctcae-v6.0.xlsx
- AJCC/ACS, vigência orofaringe HPV associada v9: https://www.facs.org/for-medical-professionals/news-publications/news-and-articles/acs-brief/december-9-2025-issue/new-ajcc-staging-system-protocols-for-salivary-glands-and-oropharynx-are-live/
- AJCC sistemas vigentes por sítio: https://www.facs.org/media/c5ik5tkr/ajcc-current-staging-system-2026.pdf
- FDA, durvalumabe/FLOT no cenário ressecável: https://www.fda.gov/drugs/resources-information-approved-drugs/fda-approves-durvalumab-resectable-gastric-or-gastroesophageal-junction-adenocarcinoma
- EMA, Xeloda/brivudina: https://www.ema.europa.eu/en/documents/product-information/xeloda-epar-product-information_en.pdf . Confirmado que a fonte descreve os intervalos de quatro semanas e 24 horas em direções diferentes; não foi fabricado erro nesses intervalos.
- AUA/ASCO/SUO, contexto cisplatina: https://www.auanet.org/documents/Guidelines/PDF/2024%20Guidelines/MIBC%20Unabridged.pdf

## Residuais e limites — não chamar de aprovação integral

1. SIGTAP: 52 linhas parseadas e preservadas, mas valores, nomes, compatibilidades CID/CBO/CNES, competência e lote oficial não foram revalidados; NÃO HOMOLOGADO para APAC.
2. Tumor-packs contêm numerosos itens explicitamente não verificados. Não foram conferidos todos os ensaios, números, categorias TNM/FIGO, biomarcadores, bulas ANVISA, SUS e ANS. Ausência de revisão não é prova de erro nem de correção.
3. Receitas: doses, durações, apresentações, quantidades, receituário legal e todas as interações exigem revisão integral. Nenhuma prescrição individual foi produzida ou liberada.
4. Contraindicações: a legenda foi corrigida; a coluna Absoluta/Relativa não foi convertida em tabela clínica estruturada por indicação e jurisdição.
5. Runtime LLM/RAG: prompt injection em anexos, exfiltração, troca de paciente, integração na evolução, assinatura e evasão de guardrails = NOT_RUN. Nenhum consumidor clínico foi testado. Orientação em documento não constitui barreira técnica.
6. Word: ZIP/XML e trechos corrigidos conferidos; renderização em Microsoft Word e atualização do sumário/campos = NOT_RUN. PDF recomposto em 119 páginas; conteúdo é texto refluído, não réplica da paginação/diagramas originais. Primeira página inspecionada visualmente; inspeção de todas as páginas = NOT_RUN.

## Entrega e reversibilidade

MD/CSV e Word/PDF corrigidos na pasta informada. Originais completos em auditoria/originais. Duplicatas de Word/PDF em Downloads só podem ser sincronizadas após igualdade dos hashes com os originais; isso foi verificado nesta sessão. Scripts são evidência da execução desta auditoria, não importadores clínicos nem garantia de idempotência para novas revisões. Não executar corrigir.py novamente sem comparar o estado e preservar a versão atual.
