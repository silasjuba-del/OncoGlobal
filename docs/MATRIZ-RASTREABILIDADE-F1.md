# Matriz de rastreabilidade F1

Esta matriz liga os aceites técnicos ao código e às provas. O estado atual, os PRs e as dependências estão no [relatório F1](RELATORIO-F1.md). O [relatório S12](ondas/F1-S12-RELATORIO.md) registra a entrega anterior. `PASS técnico` não aprova regra clínica inativa, não transforma lacuna em normalidade e não comprova provider ao vivo. As decisões 1A/2A/3A e a dispensa do provider permanecem como aceites históricos.

## Retomada após Fugu — 2026-10-14

| Correção | Implementação | Prova |
|---|---|---|
| Horizonte antes de resolver versões, em sete projeções | `src/server/f0c/avaliacaoConsulta.ts`, projeções servidor/F0C | `tests/f1/s12/horizonte-projecoes.test.ts`, `tests/f0c/intervalo-ciclo.test.ts` |
| Nutrição com última medida documentada; conflito de lote explícito | `src/server/leituras.ts`, avaliação F0C e triagem nutricional | `tests/f1/b1/triagemNutricional-consulta.test.ts` |
| Fontes concordantes e critérios hematológicos independentes | `src/contracts/api/criterioElegibilidade.ts`, `src/server/f0c/avaliacaoConsulta.ts`, `src/rules/elegibilidadeCiclo.ts` | `tests/f0c/avaliacao-adversarial.test.ts`, `tests/w11-adv/elegibilidade-ciclo.test.ts` |
| Contratos de saída das 54 rotas e portas de transporte | `src/contracts/api/saidasHttp.ts`, `src/server/rotas.ts` | `tests/server/contratos-saida.test.ts`; não equivale à cobertura clínica completa de cada rota |
| Drenagem HTTP antes de liberar SQLite | `src/server/http.ts` | `tests/server/encerramento.test.ts`, `tests/f0c/impressao-runtime.test.ts` |
| Biblioteca e exportação sem promoção de curadoria | `src/kernel/corpus/biblioteca.ts`, `scripts/exportar-biblioteca.mjs` | `tests/f1/s3/biblioteca.test.ts`, `exportar-biblioteca.test.ts`; pacote real de 224 arquivos validado |
| Arquivo documental com consumidores preservados | `docs/_arquivo/MOVIMENTOS.json` | `tests/f1/s12/arquivo-documental.test.ts`; 403 movimentos mais relatório anterior preservado |

Essas provas complementam S12. Pesquisa recebida para seis packs e planilha de casos não encerram F1-B2; doses ainda exigem fonte aplicável e validação por ficha.

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

## Rodada F1-B2 sem SISAC + adendo ao eixo N (2026-10-14 — rótulos F-B2*)

Linha por requisito verificável (requisito → código/artefato → teste → execução/SHA → resultado → limite). Ramo `codex/f1-b2-fontes`, empilhado em `ea02ea2` (PR #18).

| Requisito | Código/artefato | Teste | SHA | Resultado | Limite |
|---|---|---|---|---|---|
| F-B2-1 Nova diretriz sem SISAC registrada preservando D-F1-48 | `docs/DECISOES.md` (D-F1-49) | leitura/auditoria | `7dd1e6b` | PASS | registro documental |
| F-B2-2 22 fichas novas RASCUNHO sem SISAC | `corpus/fichas/**` + `tests/corpus-fichas/gerar-fichas-b2.mjs` | `tests/corpus-fichas/fichas.test.ts` (bloco F1-B2, 10 its) | `7dd1e6b` | PASS (39/39) | nenhuma CONFERIDA_MEDICO; 5 campos NAO_LOCALIZADO |
| F-B2-3 Proveniência por campo com fonte verificada | `corpus/manifesto/b2-fichas.v1.json` | `scripts/corpus-b2.mjs` (via `npm run check:corpus`) | `7dd1e6b`/`5f56dfe` | PASS (240 arquivos) | DOCUMENTADO exige sourceId; decisões locais rotuladas |
| F-B2-4 6 packs com fichaId resolvendo para ficha | `corpus/6-pack-tumor/{ewing,osteossarcoma,cec-pele,ntg,vulva,cup}` | `scripts/corpus-b2.mjs` (fichaId+estado) | `5f56dfe` | PASS | packs RASCUNHO; aprovacaoClinica null |
| F-B2-5 Ambiguidades com localizador | `docs/ondas/F1-B2-DOSSIE-CURADORIA.md` §2 + conflitos dos packs | leitura/auditoria | `8b8de07` | PASS (12 temas) | 6 decisões humanas pendentes |
| F-B2-6 Apresentação legível gerada do artefato | `scripts/gerar-dossie-fichas.mjs` → `docs/ondas/F1-B2-QUADROS.md` | regeneração determinística | `8b8de07` | PASS | documento gerado; não editar à mão |
| F-B2-7 Jornada por ficha: carregamento/recusa/cálculo/pendência | — | `tests/f1/b2/jornadas-fichas-b2.test.ts` | `93ea1b4` | PASS (3/3) | promoção a CONFERIDA só em memória de teste; HTTP da rota coberto em leituras-http |
| F-N-1 Conversor snapshot→PacoteBiblioteca@1 com staging | `scripts/converter-biblioteca.mjs` | `tests/f1/s3/converter-biblioteca.test.ts` | `eb53645` | PASS (bateria obrigatória do adendo) | primeiro lote = 1 item (fonte com URL verificada); expansão exige mapeamento |
| F-N-2 Validação pela API interna real | idem (importarPacote na prova) | idem ("importação RASCUNHO…", "hash divergente…") | `eb53645` | PASS | validarConteudo privado não duplicado |
| F-N-3 Caminho HTTP completo importar→curar→ativar→consultar | — | idem ("F1-N ponte no HTTP real") | `eb53645` | PASS | ALERTA recusado inclusive REGRA; um pacote ativo por vez |
| F-N-4 Exceções PHI não transferidas | idem (exclusão com motivo) | idem ("PHI não atravessa") | `eb53645` | PASS | importador mais estrito que o export (por desenho) |
| F-N-5 Aplicabilidade desconhecida ≠ universal | idem | idem ("converte o primeiro lote…") | `eb53645` | PASS (APLICABILIDADE_DESCONHECIDA) | — |
| F-N-6 Fix do backtracking quadrático do kernel | `src/kernel/corpus/biblioteca.ts` | 4 baterias s3 (69/69, 5 s vs 418 s antes) | `eb53645` | PASS | semântica de rejeição preservada |
| F-N-7 P-02/P-03/P-30 localizados | `docs/_arquivo/w10/PEDIDOS-LUNA3.md` + relatório | leitura | `8b8de07`/RELATORIO | PASS (P-30 inexistente) | não tratados como decisões canônicas |
| F-B2-8 Gates do HEAD final | — | `verify`×2, `verify:f1`, W10, W8, `ui:build`, exportação+validarPacoteConsulta, conversor real | (ver seção de gates abaixo) | ver abaixo | crash/timeout/árvore alterada não contam como PASS |

### Gates do HEAD (preencher ao executar)

| Gate | Comando | Resultado |
|---|---|---|
| verify integral (2×) | `npm run verify` | (a executar) |
| verify:f1 | `npm run verify:f1` | (a executar) |
| red team W10 | vitest config redteam | (a executar) |
| adversarial W8 | vitest config adv-w8 | (a executar) |
| ui:build | `npm run ui:build` | (a executar) |
| exportação + validarPacoteConsulta | `node scripts/exportar-biblioteca.mjs <tmp>` + API | (a executar) |
| conversor real | `node scripts/converter-biblioteca.mjs <snap> <out>` | (a executar) |
