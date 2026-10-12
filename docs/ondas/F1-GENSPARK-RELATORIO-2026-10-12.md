# Relatório do Genspark · Biblioteca Clínica F1 · 2026-10-12

Origem: resposta do Genspark (Segundo Cérebro), enviada pelo Dr. Silas em 2026-10-12. Resumo do Claude; sem PHI. **Nada aqui é regra clínica nem fonte verificada:** são afirmações do Genspark, `[VERIFICAR]` até leitura da fonte oficial.

## Fronteira e integração
- O repositório OncoGlobal é o corpus que o app consome. O Segundo Cérebro é a camada de curadoria, índice, fontes, pendências e pacote exportável. Ele aponta e cura; não redige em paralelo.
- **Não há API oficial** de leitura, busca ou atualização do acervo. Integração possível: **pacote exportado** com manifesto, checksums e importação validada. Sincronização contínua: declarada indisponível.

## Estado do acervo
- 19 arquivos de estrutura para os 8 pilares, a camada transversal, o schema do item, os enums, o contrato de integração e as pendências.
- 0 de 15 blocos com fonte primária verificada; 0 revisados; 0 aprovados; 0 publicados; 0 consumidos pelo app.
- 1 contradição: o grafo semente tem 52 arestas no documento e 51 no arquivo.
- Bloqueios herdados: `COMPILE_BLOCKER` no contrato de pipeline F1 do OncoMind (CB-01, CB-02); prova funcional do RAG pendente; índice MEMORY_OS vazio.
- Divergência de contagem das receitas ("50" × 47 fichas e 56 minutas). Não reconciliar por semelhança. Nota: as 50 receitas INT-MED já foram auditadas e não estão no repo do OncoGlobal.

## Lacunas apontadas (pendências de biblioteca, não de código)
| # | Lacuna | Referência citada pelo Genspark | Estado |
|---|---|---|---|
| 1 | Versão do CTCAE | NCI CTCAE v6.0 + mapeamento v5→v6 | declarar versão (Dr. Silas) · `[VERIFICAR]` |
| 2 | Controlados | RDC 1.036/2026 sobre a Portaria 344/98 | `[VERIFICAR]` por substância e receituário |
| 3 | Encaminhamento a paliativos | RBC/INCA 2025; Política Nacional de CP; manual SBOC | ler a norma integral; limiar "> 3 semanas" NÃO_VERIFICADO |
| 4 | Cardio-oncologia | ESC 2022 | ficha de avaliação basal e vigilância |
| 5 | RT e cirurgia | INCA; SBOC 2026; manual de radioterapia | padronizar o encaminhamento |
| 6 | Nefro, infecto, endócrino, nutrição, mastologia | sem material-base | abrir ficha antes de automatizar |
| 7 | Mensagens com paciente | diretriz SBOC sobre aplicativos de mensagens | fundamento da pendência do canal |
| 8 | Preservação de fertilidade | ASCO; pathway Einstein v.2 | ficha antes de esquemas gonadotóxicos |
| 9 | Aconselhamento genético | — | critérios objetivos ligados aos packs |
| 10 | Codificação SUS | Manual de Bases Técnicas INCA (29ª ed.); SIGTAP por competência; PCDT Conitec | código só com competência verificada; código não é indicação |

## Decisões que o Genspark pede ao Dr. Silas
Aprovar o pack gástrico e o da JEG; definir a coleção de trials; declarar a versão do CTCAE; autorizar itens consultáveis; resolver os `[VERIFICAR]` regulatórios; definir critérios de encaminhamento (paliativos, cardio, RT, genética); aprovar os textos para paciente.
