# M-AM → PLN-037 · FLUXO CLÍNICO = NORTE DO APP (Dr. Silas, 2026-10-08, via OPS-003/MARCO 2)

Fonte literal recebida no OPS-003 (texto ditado). Ver a mensagem OPS-003 para o texto integral; resumo fiel abaixo, sem reinterpretação.

## Literal (estrutura)
1. ENTRADA E RESUMO: documentos/caixa de texto → resumo (debate com agente?) → alocação na evolução; datas; segurança; anti-troca de exames; urgência/emergência no semáforo; o médico recebe tudo compilado com alertas.
2. EXAMES: buscar em site externo (laudo e/ou só imagem); a skill morfométrica é "norte", nunca laudo (D-W9-57); pedir em tumor packet.
3. CONSULTA: Flash genérica + idiossincrasias por tumor (rapid overview) sobre o prontuário completo.
4. PRESCRIÇÃO: dose, histórico, datas; receitas fáceis (sintomáticos VO/EV). Farmácia/estoque com prioridade menor (app do médico).
5. DOCUMENTOS: perícia (INSS, LOAS/BPC, transporte gratuito); pedidos de radiologia, patologia, IHQ e NGS.
6. SEGURANÇA: CTCAE; comorbidades que contraindicam ou descompensam; interações (fluoxetina × tamoxifeno).
- UI: o front é a extensão visual do backend; toda função na tela; AGRUPAMENTO FUNCIONAL pelo fluxo (retorno + laboratório + TC = 1 clique).
- EIXOS: LONGITUDINAL (interconsultas: progressivo, cumulativo, comparativo) e TRANSVERSAL (intraconsulta: retrato biopatológico holístico → metástase/SG).
- "Achei muito pouco as classificações; posso acrescentar mais. Não pesar o backend."

## Mapa ideia × código × lacuna (f0/w1-integrado@73c723f, leitura de nomes e grep)
| Bloco | Código existente | Lacuna |
|---|---|---|
| 1 Entrada/resumo | leitura/caixa-unica, pdf-digital; documentos/dedupe, resumoLongitudinal; rules/datas, identidade, reconciliar, emergenciasTransversais, radsEmergencias; ui RevisaoExtracaoLocal | modo "debate com agente" indefinido; anti-troca entre pacientes depende de identidade.ts (verificar cobertura) |
| 2 Exames | rules/morfometria, recist, kitTumorLot, labAlerts, radAlerts | importação de site externo/imagem sem laudo; UI de tumor packet |
| 3 Consulta | ui ConsultaFlash, PainelDelta, CabecalhoPaciente; consulta/preConsulta, fechamento, bundles (4) | camada de idiossincrasia por tumor (overview específico) |
| 4 Prescrição | rules/prescricao/* (safetyEngine, instanciarProtocolo, diffCiclo, receituarioEspecial), dose, ui CalculadoraDose | receitas rápidas de sintomáticos VO/EV como UI de 1 clique |
| 5 Documentos | impressao/kit, apacLaudo; documentos/biblioteca, render | **perícia INSS/LOAS/BPC/transporte: inexistente**; pedidos de IHQ/NGS: verificar |
| 6 Segurança | ctcaeGrau, triagem, semaforoInteracoes, w8/interacoes, cumulativoAlerta, plaquetasAlerta | **fluoxetina × tamoxifeno ausente**; **regras de comorbidade × droga ausentes**; D-W9-75 (texto livre → grau sugerido) a fazer |
| UI agrupamento | telas/TelaConsulta, BarraComando, bundles | agrupamento é por bundle documental, não por "tarefa do fluxo" |
| Eixo longitudinal | oncochart/Timeline2D, Jornada3D, rules/delta, resumoLongitudinal | comparativo lado a lado (ciclo × ciclo, exame × exame) |
| Eixo transversal | — | **sem modelo biopatológico** (pTNM/ypTNM, LVI, PNI, margem, grau, Ki-67/mitoses, necrose, pCR) |

## Fatias propostas (próxima onda, backend leve, UI primeiro)
- F1 UI · Painel "Tarefas do retorno": agrupa retorno + laboratório + imagem + pedidos em 1 cartão com ação única (reusa bundles/retorno/prazos).
- F2 UI · Cartão TRANSVERSAL (retrato biopatológico) somente leitura + schema mínimo do laudo AP.
- F3 UI · Timeline comparativa (lab e lesões alvo, ciclo × ciclo) sobre Timeline2D/delta.
- F4 Regra pura · Interações-chave (inibidores de CYP2D6 × tamoxifeno etc.) em w8/interacoes.
- F5 Regra pura · Comorbidade × droga (ICC × antraciclina, neuropatia × taxano/platina, DM × corticoide, HAS × anti-VEGF).
- F6 Documento · Laudo de perícia (INSS/LOAS-BPC/passe livre) preenchido do resumo.
- F7 UI · Receitas rápidas de sintomáticos (VO/EV) em 1 clique, respeitando AJ4.
- F8 UI · Overview por tumor (idiossincrasias) dentro da ConsultaFlash.

## Perguntas ao Dr. Silas
Q1 Resumo: (a) agente resume e o médico revisa; (b) debate em chat antes de alocar; (c) ambos, com debate opcional.
Q2 Agrupamento funcional: (a) por momento da consulta (antes/durante/fechamento); (b) por tarefa (retorno, QT, documentos); (c) sua lista própria.
Q3 Transversal: priorizar (a) cartão para todos os tumores; (b) mama/próstata/CCR primeiro.
Q4 Perícia: quais modelos primeiro: INSS, LOAS/BPC, passe livre?
Q5 Interações/comorbidades: lista curada sua ou fonte de referência (qual)?
Q6 Classificações adicionais que quer acrescentar aos 6 blocos.

## Respostas (OPS-004, D-W9-77)
- Q1 REVISAR: o app monta, o médico revisa e valida; debate não é padrão.
- Q2 A Flash é um rapid overview pontualizado (ex.: "biópsia, adenocarcinoma, TC tórax, nódulo 43 mm, cintilografia, captação T7"); com 1 clique: retorno + laboratório (sempre, pré-selecionado = modelo padrão do médico) ± imagem → finaliza. "Mantendo a consulta" = AMBÍGUO, confirmar.
- Q3 Transversal: mama, próstata, cólon, pulmão, colo uterino, gástrico.
- Q5 Fonte: bula ANVISA/FDA + literatura, rotuladas, em RASCUNHO até conferência item a item.
- Abertas: Q4, Q6.

## Adendo OPS-006 — tipologia de 3 kits reais (docs/referencias/tipologia/KITS-PRIMEIRA-VEZ-2026-10-08.md)
- Dr. Silas: resumo de primeira vez nasce NO CHAT, pela skill/template dele (em uso há mais de 1 ano); o app recebe, aloca na evolução, médico revisa (D-W9-77a). Skill será registrada como fonte literal quando enviada.
- Lacunas novas do bloco 1: (a) classificador de página clínica × administrativa (30–40% administrativas); (b) proveniência LAUDO × CITAÇÃO (exames só citados); (c) máscara de segredos (login/senha de portal em cabeçalho de laudo); (d) checagem de lateralidade/topografia e data impossível; (e) CID SISREG (ex.: R63.8) nunca como diagnóstico; (f) estadiamento do encaminhador sem base = não confirmado; (g) tumor-índice × incidental; (h) manuscrito/riscado = baixa confiança.
- F2 ajuste: cada campo do cartão transversal exibe a origem: "laudo" (documento + data) × "afirmado pelo encaminhador" × "não informado".
