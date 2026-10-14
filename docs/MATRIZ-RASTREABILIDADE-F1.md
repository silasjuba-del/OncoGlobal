# Matriz de rastreabilidade F1 — S12

Esta matriz liga os aceites técnicos ao código e às provas. Os resultados executados e a versão integrada estão no [relatório S12](ondas/F1-S12-RELATORIO.md). `PASS técnico` não aprova regra clínica inativa, não transforma lacuna em normalidade e não comprova provider ao vivo. As decisões 1A/2A/3A e a dispensa do provider estão em `RELATORIO-F1.md`.

## Fatias

| Aceite | Implementação | Provas | Limite |
| --- | --- | --- | --- |
| S0: encontro, autoridade e assinatura | `src/server/leituras.ts`, `rotas.ts` | `tests/adv/f1-s0-encontro-leitura.adv.test.ts`, `tests/f1/s0/`, `tests/f1/s12/identidade-http.test.ts` | Identidade ambígua impede assinatura; médico confirma conteúdo exibido. |
| S1: comandos, envelope e transação | `src/kernel/comandos/`, `src/kernel/ledger/writeRouter.ts` | `tests/f1/s1/` | Autoridade e idempotência do servidor; proposta não é fato. |
| S2: Retrato e histórico | `src/kernel/projections/retrato/` | `tests/f1/s2/retrato-reassinatura-http.test.ts`, `retrato-encontro-historico.test.ts`, `resumo.test.ts` | Projeção v3, corte temporal e fontes; não inventa data clínica. |
| S3: biblioteca e fronteiras | `src/kernel/corpus/biblioteca.ts`, `configMotor.ts`, `cruzamentos.ts` | `tests/f1/s3/`, `check:boundaries:fechar-f1-s3` | Ativação/rollback técnico não equivale a aprovação clínica. |
| S3c: curadoria | Contrato S3 e arquivos versionados do corpus | `tests/f1/s12/corpus-auditoria-publica.test.ts` | Contínua. Material discutido permanece privado por 1A; sem aprovação item a item, sem alerta. |
| S4: sete setores | `src/modules/setores/index.ts` | `tests/f1/s4/`, `tests/f1/s12/formulas-*.test.ts` | Ausência de fonte, dado, validade ou regra vira lacuna. |
| S5: reconciliação | `src/modules/reconciliador/` | `tests/f1/s5/` | Referências correlacionadas; conflitos não são resolvidos por união ou escolha silenciosa. |
| S5b: fatia vertical | `src/kernel/orquestracao/runtime.ts`, extração e consulta local | `tests/f1/s5b/`, `tests/f0-fecha/e2e-colon-f1.test.ts`, scripts de navegador S12 | Caso cólon aceito 2A; cruzamento renal é prova complementar de software. |
| S6: Maestro/ORK e estímulos | `src/orchestration/`, `src/kernel/orquestracao/` | `tests/f1/s6/`, `tests/f1/s12/invalidacao-gatilhos.test.ts` | Invalida corretamente; reavaliação ainda alcança sete setores, sem otimização seletiva fina por domínio. |
| S7: tumor e investigação | `src/server/investigacao.ts`, `InvestigacaoMinima.tsx` | `tests/f1/s7/`, `tests/f1/s12/ui-propostas.test.tsx` | Pack disponível sustenta proposta; não emite pedido automaticamente. |
| S8: consulta integrada | `src/ui/OncoassistLocal.tsx`, `ConsultaPersistida.tsx`, `SinteseProposta.tsx` | `tests/f1/s8/`, `tests/f1/s12/ui-navegacao.test.tsx`, `ui-propostas.test.tsx`, navegador | Edição preservada; saída antiga ocultada; síntese continua proposta. |
| S9: documentos | `src/modules/documentos/consulta.ts`, `src/kernel/ledger/documentos.ts`, `src/server/flash.ts` | `tests/f1/s9/`, `tests/f1/s12/ui-receitas.test.tsx`, `identidade-http.test.ts`, `impressao-legada.test.ts` | Assinatura congela identidade/versão; campos não ditos pendentes; HTML não é impressão física. |
| S10: dutos locais | `src/server/dutos.ts`, `projecaoDutos.ts`, `DutosClinica.tsx` | `tests/f1/s10/` | Preparação monousuária; recebimento não comprova execução assistencial. |
| S11: OCR e portões LLM | `src/kernel/extracao/`, `src/kernel/llm/openai/`, `src/server/extracaoLlm.ts` | `tests/f1/s11/`, `tests/f1/s12/egresso-*.test.ts`, navegador com três formatos | OCR local real. LLM com transporte injetado; provider ao vivo dispensado, não PASS. |

## Red team A12–A19

Os identificadores são os de `docs/_arquivo/ondas/F1-CORPUS-PROMPT-REDTEAM-GLM.md`, não ataques homônimos de ondas anteriores.

| Ataque | Prova | Resultado e fronteira |
| --- | --- | --- |
| A12 portas/ilhas | `portas-publicas.test.ts`, `corpus-auditoria-publica.test.ts`, [mapa dos 33](ondas/F1-S12-PORTAS-CORPUS.md) | 210 JSON inventariados; cinco fontes operacionais testadas; 33 rascunhos originais mapeados, com bindings e suportes ausentes explicitados. Auditoria realizada; integração operacional dos 33 não comprovada. Privacidade 1A é decisão separada. |
| A13 X + Y → Z | `formulas-cobertura.test.ts`, `formulas-aplicabilidade.test.ts` | Nove cenários distinguem aviso existente, pendência de dado e ausência de regra. Tabela abaixo explicita o Z real. |
| A14 longitudinal | `longitudinal-mama.test.ts` | Diagnóstico até ciclo 4; fontes, substituição explícita, proposta, assinatura e administração separados; omissão não conta como administrado. Quantidades sentinela de software, não doses clínicas validadas. |
| A15 invalidação | `invalidacao-gatilhos.test.ts` | Sete gatilhos (esquema, dose, medicamentos, comorbidade, exame, toxicidade, peso) passam pelo writer; resultado anterior invalidado e replay sem duplicação. |
| A16 proposta | Testes de gatilhos, `tests/f1/s1/proposta.test.ts`, S4 | Avalia rascunho antes do ciclo; referências tipadas; nenhuma administração criada pela proposta. |
| A17 dutos | Portas públicas, `tests/f1/s10/versionamento.test.ts` | IDs/versões e consumidores locais verificáveis. Fluxos clínicos sem regra/pack ativo permanecem pendentes; não afirma operação de setores externos. |
| A18 conflitos | Auditoria pública, aplicabilidade, S2 | Dependência ausente/cíclica recusada; listas divergentes não são unidas; identidade ambígua bloqueada; fontes e histórico preservados. |
| A19 biblioteca/alerta | Auditoria pública, S3, `tests/f1/s8/flash-fatos-confirmados.test.tsx` | Consultável não ativa alerta; Flash sem semáforo geral; aprovação continua por item. |

Os nomes dos testes sem prefixo nesta tabela estão em `tests/f1/s12/`. Esta auditoria não promove os exemplos clínicos do prompt a regras aprovadas.

| Cenário A13 | Entrada/consumidor | Z efetivamente provado |
| --- | --- | --- |
| Capecitabina + varfarina | Medicamentos/proposta → interações | Aviso existente referenciado; não emite INR ou agenda sem ação médica. |
| Antraciclina + FEVE ausente/vencida | Regra pura `alertarFeve`, porta F0C `avaliacaoConsulta` | Pendência de dado/validade; não inventa FEVE. A prova não demonstra um consumidor específico FEVE dentro dos sete setores F1. |
| Fluoropirimidina + DPYD ausente | Regra pura `avaliarCondicionais`, porta F0C `condicionaisClinicas` | Pendência; ausência não equivale a normalidade. Não demonstra integração específica DPYD via PrescricaoProposta nos sete setores F1. |
| Tamoxifeno + paroxetina/fluoxetina | Medicamentos/proposta → interações | Lacuna de cobertura clínica; não troca medicamento. |
| Mielotóxico + risco FN | FATO riscoFN + tratamento → tratamento | Lacuna referenciada de regra/aplicabilidade; sem novo corte ou indicação de G-CSF. |
| Mama HER2 + antraciclina por fase | Fatos/tumor/proposta → setores | Dados/consumidores existem; regra de FEVE por fase não ativada. |
| Clearance + cisplatina/pemetrexede | FATO clearance + tratamento | Exige unidade, fonte, data e aplicabilidade; depois lacuna renal referenciada sem ajuste/substituição. |
| TKI + IBP | Medicamentos/proposta → interações | Lacuna de regra; não cria aviso clínico sem catálogo aprovado. |
| Imunoterapia + corticoide + sintoma | Medicamentos/toxicidade/tratamento | Lacuna de cobertura/contexto; não inventa toxicidade imune ou conduta. |

## Gates transversais

`npm run verify`, `npm run verify:f1`, red team W10/W8, matriz F0, PHI com índice igual à árvore, builds, CRIT-5 HTTP/navegador, demonstração documental, reinício e reimpressão compõem a prova. Consultar os números e limites do relatório S12; não substituir uma demonstração por teste unitário nem declarar provider real a partir de transporte injetado.
