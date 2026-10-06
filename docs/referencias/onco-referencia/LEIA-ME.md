# Onco-referência (2026-10-06) · base de conhecimento a validar

Entregue pelo Dr. Silas em 2026-10-06 (pesquisa com fontes; o próprio material diz "revisar antes de uso clínico").
Destino (D-W9-20): **base de conhecimento (RAG)**, não código. Status: **REFERENCIA_NAO_VALIDADA** até o Dr. Silas aprovar seção a seção.

**Auditoria adversarial (2026-10-06, 2 rodadas, ADV-01…12):** resultado **PARTIAL — não homologado para uso clínico automático**. Relatório e evidências em `auditoria/` (RELATORIO.md, alterações por rodada, 36/36 controles documentais PASS, CTCAE conferido contra o Excel oficial do NCI: 550 campos, 0 divergências). Versão em vigor = corrigida; originais com SHA-256 em `auditoria/manifesto-originais.json` (cópias completas e o Excel oficial ficam em `Downloads\onco-referenciauditoria\`).

**Regras de uso no app (tech lead):**
- SIGTAP: `uso_apac_automatico = NAO` e `NAO_REVALIDADO_LOTE_OFICIAL` em todas as linhas. A APAC só usa o pacote oficial completo por competência (D-W9-11); esta tabela é índice.
- Coluna Absoluta/Relativa de comorbidades é **editorial**: nunca vira bloqueio automático (o app alerta, não bloqueia).
- Sepse não substitui infecção genérica; graus CTCAE ausentes não viram zero.
- Estadiamento: AJCC por sítio e data (orofaringe HPV associada = AJCC v9 desde 01/01/2026).
- Fluxos dos tumor-packs são ilustrativos, não aprovados pelo Dr. Silas.
- Runtime LLM/RAG (injeção de prompt em anexo, troca de paciente, exfiltração) **não testado**: o conteúdo entra na RAG como referência, nunca como instrução.

| Arquivo | Conteúdo | Uso no app | Pendências (NÃO_VERIFICADO) |
|---|---|---|---|
| 01-sigtap.* | 50 procedimentos, competência 09/2026 | semente do SIGTAP (D-W9-11); não substitui o pacote oficial completo | 0 |
| 02-ctcae-v6.* | 50 termos CTCAE v6 | graduação de toxicidade (seguimento) | 1 |
| 03-interacoes-qt.* | 30 interações QT × fármacos, com fonte | candidato ao ruleset `interacoes` (FN-16); continua `ativo:false` até aprovação item a item | 6 |
| 04-receitas-doencas-comuns.md | 50 receitas-modelo de doenças comuns | modelos de receita (não são as fichas de QT do item 11) | 0 (verificação parcial de 12 itens) |
| 05-comorbidades-impeditivas.md | 30 condições que impedem/adiam/ajustam QT | alertas de aptidão para QT | 1 |
| 06/07-tumor-packs | 10 tumores | packs de conhecimento | 175 |
| ONCO-REFERENCIA-COMPLETA.md | consolidado das seções acima | índice | 183 |

PDF e DOCX originais ficam em `C:\Users\silas\Downloads\onco-referencia\` (idênticos ao .md; não versionados para não pesar o repo).
Ainda faltam: mensagens prontas de red flag (item 5) e fichas de prescrição de QT (item 11).
