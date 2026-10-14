> Registro histórico de S12. Estado atual: [RELATORIO-F1](../RELATORIO-F1.md).

# Relatório F1 — encerramento S12

Estado: **entrega técnica e auditoria S12 concluídas**. [PR #14](https://github.com/silasjuba-del/OncoGlobal/pull/14) concentra o gate final de integração em `codex/f1-conclusao`. Base `5e1b9f7` validada: 3350/3350 testes padrão, 620/620 F1, 240/240 W10 e 41/41 W8. A correção final de risco FN nulo acrescenta regressões e exige nova CI do HEAD no PR. Curadoria e integração clínica dos rascunhos do catálogo permanecem explicitamente separadas abaixo.

## Escopo entregue

A consulta local incorpora documentos e OCR, exibe revisão com fonte, confirma fatos explicitamente, reavalia Retrato e setores, preserva edição em andamento, prepara documentos para conferência e assinatura e reabre versões históricas. Reconciliação de medicamentos, investigação, síntese proposta e dutos locais têm contratos e consumidores verificáveis. Maestro/ORK continua sendo o orquestrador; não foi introduzido outro backend.

Melhorias aproveitadas: identificação persistente do paciente/encontro, navegação por seções, fonte ao lado da revisão em telas largas e receitas manuais múltiplas sem perder as não selecionadas. Investigações e sínteses antigas saem da tela quando o contexto muda. Não foram adotados defaults de dose, liberação automática ou novos limiares clínicos das propostas externas.

## Correções de fechamento

- Cadastro de paciente ambíguo bloqueia preparação/assinatura, inclusive quando muda depois da prévia. A identidade única é congelada no documento.
- Impressos antigos sem metadados novos mantêm o render original; cadastro posterior não altera seus bytes.
- Falha, timeout ou resposta inválida após início de envio LLM preserva resultado desconhecido e impede duplicar a transmissão pela mesma chave, inclusive após reinício do SQLite. Auditoria registra metadados/códigos, sem conteúdo clínico nem chave.
- Metadado de interação condicionada inválido produz lacuna explícita. Lista completa sem par não gera falso aviso de falta de pares nem sinal verde. Exposição histórica permanece avaliada; listas conflitantes não são unidas. Reataque independente confirmou as correções.
- Risco FN e clearance documentados têm consumo referenciado e lacunas de dado/aplicabilidade/regra, sem criar indicação terapêutica, fórmula nova ou ajuste de dose. Risco FN com valor interno nulo, não numérico ou não finito é dado ausente; zero explícito não é tratado como ausência.

## Decisões e limites

1A mantém o corpus clínico discutido privado. Esta entrega não publica esse conteúdo nem o ativa por aprovação coletiva. S3c é curadoria contínua: consultável e alerta são estados distintos, com aprovação por item. Cobertura incompleta continua explícita.

A12 mapeou os 33 rascunhos originais, sem comprovar sua integração operacional: 17 células CTCAE não têm suporte vinculado, duas entradas de exames no pack gástrico antigo são textuais e faltam bindings de consumidores. Esses defeitos de catálogo estão em `ondas/F1-S12-PORTAS-CORPUS.md`. A entrega técnica e a auditoria S12 não equivalem ao encerramento da integração clínica de todo o corpus.

2A aceita o comportamento do caso sintético. 3A autorizou integrar PR #10 em `codex/f1-conclusao`, concluído em `3b7ec8f`. A entrega complementar de PR #11 é reconciliada nesta S12 com as correções posteriores. `main` e `f1/integrado` não são destinos desta entrega.

Ao pedido de credencial para prova ao vivo do provider, Silas decidiu: **“NAO PRECISA ESTE TOPICO”**. A prova ao vivo foi retirada do escopo por decisão humana, não marcada PASS. Os gates de código, PHI e transporte injetado permanecem. Voz, implantação multiusuária e aprovação de protocolos clínicos adicionais não fazem parte deste fechamento.

## Evidências

- [Matriz F1](../MATRIZ-RASTREABILIDADE-F1.md): aceites S0–S11, A12–A19, consumidores e testes.
- [Caso-guia](../ondas/F1-CASO-GUIA.md): entradas, percurso, documentos, cinco cliques e reprodução.
- [S12](../ondas/F1-S12-RELATORIO.md): resultados atuais dos gates, medições e integração.

Logs e vídeos sintéticos brutos permanecem locais. Reimpressão comprova geração HTML, não saída física em papel. Um setor avaliado com lacuna não equivale a cobertura clínica completa nem a prescrição liberada.
