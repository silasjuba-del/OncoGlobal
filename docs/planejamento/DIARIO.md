# Diário de planejamento · OncoGlobal

Chat de PLANEJAMENTO (não edita código, não faz merge/push). Operacional integra. Dr. Silas decide o clínico.
Regras: IA propõe, código calcula, médico decide e assina · ausente = PENDENTE · conflito nunca some · alerta sem bloquear · junção de paciente nunca automática · só dados sintéticos.

## PLN-001 · 2026-10-07 · Abertura do planejamento e estado atual
- Origem: Dr. Silas (prompt de papel)
- Liga a: `f0/w1-integrado@2690fe1`, DECISOES "Integração W10", D-W9-63…66, branch `codex/w10-entrega-integrada@8d060b5`
- Estado: Grok 19 + Cursor 7 + Astra/5 Lunas 29 integrados; tsc/fronteiras/corpus ok; adv-w8 41/41; red team 24/227 vermelhos.
- Astra corrigindo CI (`tests/cobertura/caso07.test.ts`); operacional em modo leitura.
- Decisão nova: CTCAE v6 pura; plaquetas 20.000 = G3 → fila do médico, sem alerta E1. DECIDIDO (Dr. Silas) → registrar como D-W9-67 (operacional).
- Simulação Paciente Teste 91 (próstata): PARCIAL/NÃO PRONTO. Lacunas: texto colado do PDF = 0 fatos; "nega dor" apaga linha; plaquetas/Gleason/ISUP/diarreia não extraídos; `voice_command`/`lab_feed` → 400 (FactSourceType sem LAB_FEED); série temporal vira conflito; sem ponte rascunho→ledger→evolução; estatística sem tumor/CTCAE/progressão; corpus sem diarreia; contrato não aceita `tontura:null`; ragGRAFO 2.971 nós/9.347 arestas sem vetores nem conector.
- OncoAssist × código: faltam roteador, cofre, persona versionada, custo/tarefa, gateway READ, conexões Drive/Agenda/Gmail (desligadas), memória de preferências, identidade persistente, `/flash`, conhecimento ligado.
- Fila do operacional (acompanhar): 1) integrar Astra; 2) 24 vermelhos × REDTEAM-DISTRIBUICAO; 3) Fugu rodada 2 (extrator + série temporal); 4) contratos voz/LAB_FEED/null; 5) onda OncoAssist.
- Decisão: DECIDIDO (Dr. Silas) — planejamento ativo.
- Próxima ação: avisar operacional (PLN-001); aguardar ideias do Dr. Silas. Dono: planejamento.

## OPS-001 ↳ PLN-001 · 2026-10-07 · Operacional confirma
- Origem: OPS-001 (MARCO 2)
- Operacional segue em modo leitura até a Astra fechar; D-W9-67 entra em DECISOES no 1º commit liberado, conferindo o corte na tabela oficial CTCAE v6.
- `f0/planejamento` será integrado junto com a Astra (merge --no-ff, só docs/planejamento/**), após liberação do Dr. Silas.
- Fila confirmada sem mudança. Pedido: fatias prontas vão com prompt + dono; pergunta clínica vai ao Dr. Silas.
- Decisão: DECIDIDO (operacional). Próxima ação: aguardar ideias do Dr. Silas. Dono: planejamento.

## PLN-002 · 2026-10-07 · Freeze prático: tipo de consulta + assinatura oncológica → X/Y/Z → cluster
- Origem: Dr. Silas (texto colado, revisado com ChatGPT; refs ascopubs JCO-25-02693, iRECIST, PCWG, RECIST 1.1, KEYNOTE-522)
- Liga a: D-W9-63 (RECIST linfonodo), PLN-001 (simulação Paciente Teste 91, próstata), Q01–Q59 (estados/consulta)
- Ideia (resumo): (0) gate TIPO_CONSULTA {CASO_NOVO, RETORNO_EM_TRATAMENTO, SEGUIMENTO} + PRIORIDADE paralela {ELETIVO, PRIORITÁRIO, URGENTE, EMERGÊNCIA} define a esteira; (1) ONCOLOGIC_FINGERPRINT = órgão+histologia+biomarcador+estágio+fase+tratamento+paciente (idade, comorbidades, MUC, ECOG, sintomas, toxicidades); (3) biomarcadores por órgão×histologia, com função diagnóstica/prognóstica/preditiva/monitorização; (6–7) retorno em tratamento = 4 eixos (clínico, lab/marcador, rad, toxicidade) → CONCORDANTE/DISCORDANTE, discordância = ⚠ REVISAR, IA não conclui progressão; (8) separar progressão verdadeira × pseudoprogressão imune (iUPD/iCPD) × flare (PSA/óssea, PCWG) × resposta mista; (9) progressão radiográfica ≠ troca automática; (10–11) seguimento: risco do paciente baixa o limiar de investigação; (12) sinal→órgão→hipótese→ação com saltos (emergência pula a árvore); (13) próstata M1 + déficit neurológico → EMERGÊNCIA, cluster SUSPEITA_COMPRESSAO_MEDULAR, opções marcáveis → artefatos (encaminhamento, resumo, medicação draft, pedido); (14) mapa de órgão como contrato comum; (16) IA monta a mesa, médico decide.
- O que o código tem hoje:
  - Tipo de consulta: **não existe** (nenhum `TipoConsulta`/`CASO_NOVO`). "Seguimento" só em `src/app/pesquisa/seguimento.ts` (pesquisa, não consulta).
  - Prioridade: existe `NaturezaAlerta` (`src/contracts/estados.ts:57`: AMEACA_IMEDIATA, REVISAO_URGENTE, ALERTA_ONCO, MUDANCA_RESPOSTA) — é alerta, não prioridade da consulta; não há os 4 níveis.
  - RECIST: cálculo longitudinal por código, categoria nasce PROPOSTA (`src/contracts/w10/clinico-w10.ts:82`) — coerente com "≠ troca automática". Sem iRECIST, sem PCWG, sem eixo de concordância.
  - Discordância entre eixos: **não existe**; "discordante" hoje só significa versões conflitantes de laudo (`src/rules/w8/index.ts:392`).
  - Biomarcadores: `src/kernel/extracao/dados/biomarcadoresRequeridos.ts` por tumor, só CPNPC adeno IV e mama; demais `[VERIFICAR]`. Sem função (diag/prog/pred/monit).
  - Assinatura oncológica: peças espalhadas (estadiamento em `contracts/clinico.ts`, biomarcadores, RECIST), sem objeto único.
  - Cluster / mapa de órgão / X-Y-Z: **nada no código**; X/Y/Z não aparece nas specs (só como eixo de imagem na morfometria).
  - Compressão medular: nenhuma regra.
- Lacuna: falta (a) contrato TipoConsulta+Prioridade no início do atendimento; (b) objeto OncologicFingerprint montado a partir dos fatos existentes (ausente = PENDENTE); (c) motor de concordância 4 eixos com estado DISCORDANTE→REVISAR e os 4 fenômenos separados; (d) contrato de mapa de órgão (cluster) como dado versionado, começando por próstata e mama; (e) clusters de emergência com opções marcáveis e geração de artefatos em rascunho.
- Decisão: PENDENTE (Dr. Silas):
  - P1 · Onde mora o X/Y/Z? (a) spec já existente fora deste repo — enviar ao planejamento; (b) formalizar agora a partir deste texto.
  - P2 · Prioridade: (a) nível dado pelo médico, IA só sugere; (b) IA calcula e o médico confirma; (c) EMERGÊNCIA por regra de código (ex.: déficit neurológico + M1 ósseo), demais pelo médico.
  - P3 · Próxima verticalização: (a) CASO NOVO; (b) EM TRATAMENTO (casa com a simulação da próstata e o RECIST já existente); (c) SEGUIMENTO.
  - P4 · Primeiros mapas de órgão: (a) próstata + mama; (b) próstata + mama + pulmão; (c) outro.
- Próxima ação: aguardar P1–P4; depois fatiar (contrato → regras → UI), com prompt por executor. Dono: planejamento. Nada vai ao operacional antes (ele está em modo leitura).
- Respostas do Dr. Silas (2026-10-07):
  - P1: DECIDIDO — tem texto pronto do X/Y/Z; vai enviar.
  - P2: DECIDIDO — **o médico define tudo, inclusive a prioridade.** A IA faz o burocrático: organiza, rascunha, checa e preenche. O médico valida, libera e despacha. Nenhum nível de prioridade é calculado por regra.
  - P3: em espera — "aguarde, sem perguntas, apenas analise os textos". Não fatiar ainda.
  - P4: DECIDIDO — primeiros mapas de órgão: próstata + mama + pulmão.
- Regra de trabalho (Dr. Silas): agora é só analisar os textos recebidos. Sem perguntas e sem fatias até ele liberar.

## PLN-003 · 2026-10-07 · Freeze v1.1: conhecimento tumoral + emergências + loop médico-IA
- Origem: Dr. Silas (texto colado; refs ascopubs JCO-25-02822 CPNPC, ASCO/IDSA neutropenia febril, guideline hipercalcemia, NICE MSCC)
- Liga a: PLN-002 (v1.0 permanece íntegro), D-W9-20 (código leve, conhecimento na RAG versionada), D-W9-15/66 (LLM via gateway), PLN-001 (voz 400, ragGRAFO sem conector)
- Ideia (resumo): 3 camadas separadas — A. KNOWLEDGE_TUMOR (órgão→histologia→molecular→estágio→**setting**→**linha**→paciente→opções; tabela tumoral = seed da KB, não regra); B. EMERGENCY_ENGINE transversal (14 emergências + OUTROS; tumor só se associa; contrato padrão→evidências presentes/ausentes→prioridade→kit; sem "%"; kit, não prescrição; KB de emergência versionada); C. CLINICAL_WORKFLOW (voz/dados→extração→contexto→detector→knowledge→UI→médico→drafts→médico assina/envia). Estadiamento como required/suggested/conditional/not_routine. Voz: congela contrato, não modelo; descrição abre cluster, ordem preenche draft. Desfecho → evento auditável → avaliação offline → nova versão; sem auto-learning. Envio final é ato explícito. 16 decisões congeladas.
- O que o código tem hoje:
  - D-W9-20 já diz "código leve, conhecimento na RAG versionada" → **coerente** com camadas A/B como KB versionada. Mas a KB tumoral estruturada não existe: só `src/kernel/extracao/dados/biomarcadoresRequeridos.ts` (CPNPC adeno IV + mama).
  - Setting/linha: nenhum contrato em `src/contracts`/`src/kernel` (aparece só em telas do estúdio). Lacuna direta do TUMOR_FINGERPRINT.
  - Emergências: **nenhuma biblioteca**. Neutropenia só em visual (`src/ui/oncochart/`); hipercalcemia, lise tumoral, MSCC: zero. `NaturezaAlerta` (`src/contracts/estados.ts:57`) é o gancho mais próximo.
  - Confiança: `confianca` 0–1 em `src/contracts/base.ts:47` e `confidence` em `src/contracts/w10/extracao.ts:61` — já é de extração; falta trava de nomenclatura/UI para nunca virar "probabilidade diagnóstica" (decisão 7).
  - Voz: `voice_command` existe no enum (`src/contracts/base.ts`) mas dá 400 (PLN-001); falta distinguir DESCRIÇÃO × ORDEM.
  - Envio: gateway registra efeito (`src/kernel/gateway/gateway.ts`); conforme D-W9-15/66 nada sai sem passo explícito → **coerente** com decisão 14.
  - Auto-learning: não existe no código → coerente com decisões 12–13; falta registrar o desfecho como evento auditável/dataset.
- Lacuna: (a) schema TUMOR_KNOWLEDGE versionado (com setting, linha, staging required/suggested/conditional/not_routine); (b) biblioteca ONCO_EMERGENCY com contrato evidências presentes/ausentes + kit; (c) relação tumor↔sítio↔morfologia/função↔sintoma (não lista fechada); (d) intent de voz descrição × ordem; (e) evento de desfecho para avaliação offline; (f) trava "extraction_confidence ≠ probabilidade".
- Conflito a vigiar: decisão "PRIORIDADE" no contrato de emergência × resposta do Dr. Silas em PLN-002/P2 (**médico define a prioridade**). Leitura compatível: o motor mostra o padrão e as evidências; o nível é marcado pelo médico. Não resolvido em silêncio — registrar quando ele liberar perguntas.
- Sugestão do texto (schema da TUMOR_KNOWLEDGE antes de alimentar órgãos): anotada. Mapas iniciais decididos em PLN-002/P4 = próstata + mama + pulmão (o texto cita também cólon).
- Decisão: PENDENTE — Dr. Silas pediu só análise, sem perguntas e sem fatias.
- Próxima ação: aguardar texto do X/Y/Z e liberação. Dono: planejamento.

## PLN-004 · 2026-10-07 · Addendum: linha temporal + texto bruto + voz + Plaud
- Origem: Dr. Silas (texto íntegro em `fontes/M-F_PLN-004_addendum-linha-temporal-voz-plaud.md`; exemplo sintético, sem PHI)
- Liga a: PLN-003 (workflow C, voz), PLN-001 (texto colado = 0 fatos; voice_command/lab_feed 400; série temporal vira conflito), D-W9-65/66, CHATPLAN nó M-F
- Ideia (sem perda): (1) 4 datas fixas no cabeçalho clínico: `biopsy_date`, `c1d1_date`, `last_staging_date` (tipo STAGING|RESTAGING), `last_treatment_date` (QT, IO, alvo…); dias desde C1D1/último tto/último reestadiamento calculados por código; (2) 3 fontes de entrada (escrita, Whisper realtime, Plaud em segundo plano) → MERGE → consulta estruturada, nenhuma substitui as outras; (3) caixa de texto bruto obrigatória + [PROCESSAR TEXTO] (aceita evolução anterior, resumo de ChatGPT, laudo, anotação, prontuário, resumo longitudinal, saída da Skill); (4) fluxo Skill→formato canônico→copiar→colar→parser→distribuição→checklist; Skill sempre no mesmo contrato, sem prosa livre; (5) `CLINICAL_IMPORT_V1` com blocos DIAGNOSTICO, DATAS, TRATAMENTO_ATUAL, ESTADO_ATUAL, LABS, RADS, PENDENCIAS, TEXTO_LIVRE; campo ausente fica vazio; (6) cada campo importado = `SOURCE: LLM_IMPORT`, `STATUS: NEEDS_REVIEW`, nunca CONFIRMED só por importar; (7) resumo vira checklist/roteiro flexível; (8) Whisper realtime → intent/comando → atualiza checklist/cluster/draft ("anemia" abre cluster sem conduta; "vou pedir ferritina, B12, folato" marca 3 exames + REQUEST_LAB_DRAFT); (9) Plaud só passivo, reconcilia depois (MERGE 1 = Whisper+escrita; MERGE 2 final = + Plaud); (10) hierarquia: médico editado/confirmado > ordem vocal explícita > import estruturado > Whisper > Plaud, sem apagar silenciosamente, conflito mostra opções [28/04][30/04][OUTRO]; (11) fluxo completo antes/durante/paralelo/final → FINALIZAR CONSULTA. Regra: ESCRITA estrutura · Whisper opera · Plaud recupera · Médico valida.
- O que o código tem hoje:
  - 4 datas: `c1d1` **zero** no código; biópsia só em telas/gates; sem campos canônicos nem "dias desde" de consulta (existe `diasDesde` só em `src/apac/antiglosa.ts`, `src/modules/consulta/preConsulta.ts`). Peso vale 30 dias (D-W9-63) é outro prazo.
  - Fontes: `FactSourceType` (`src/contracts/w10/extracao.ts:12`) = pathology, imaging_report, prescription, medical_note, nursing, **plaud**, administration — não tem import de Skill, Whisper/voz, texto manual nem lab_feed. Enum em `src/contracts/base.ts:10` tem PLAUD, VOICE_COMMAND, CHAT_TEXT, MANUAL, LAB_FEED (dois enums divergentes → causa provável do 400 da PLN-001).
  - Merge/conflito: `src/kernel/extracao/reconciliacao.ts` já reconcilia com hierarquia por domínio e conflito explícito → base aproveitável; hierarquia do Dr. Silas (F4) ainda não é a do código.
  - Revisão: `src/kernel/extracao/caixaRevisao.ts` e estados PROPOSTA/NEEDS_REVIEW já existem (29 arquivos) → coerente com F3 (nada confirma sozinho).
  - Parser de `CLINICAL_IMPORT_V1`: **não existe**; texto colado gera 0 fatos (PLN-001).
  - Whisper realtime: nada além de menção em telas/agentes; sem intent description × ordem.
- Lacuna: (a) contrato `CLINICAL_IMPORT_V1` versionado + parser determinístico; (b) fonte `LLM_IMPORT` (+ voz, manual, lab_feed) unificada num só enum; (c) campos das 4 datas + tipo STAGING|RESTAGING + dias desde (código); (d) hierarquia F4 na reconciliação; (e) roteiro/checklist gerado do resumo; (f) merge em 2 etapas (Whisper+escrita, depois Plaud); (g) intent descrição × ordem.
- Notas de vigilância: LLM no caminho Skill→app é externa (D-W9-65/66 já cobre kit documental; texto da Skill não passa por gateway do app, só o colado → ok); "médico define tudo" (PLN-002/B2) vale também aqui.
- Decisão: DECIDIDO (Dr. Silas) — regra congelada (ESCRITA estrutura, Whisper opera, Plaud recupera, médico valida) e 4 datas permanentes. PENDENTE: exemplo usa cólon (CAPOX) × mapas iniciais próstata+mama+pulmão (só exemplo?). Sugestão do texto ("dias desde…") = proposta "acrescentaria depois" → EM ESPERA.
- Próxima ação: aguardar texto do X/Y/Z e liberação para fatiar. Dono: planejamento.

## PLN-005 · 2026-10-07 · /CHATPLAN e registro literal
- Origem: Dr. Silas ("ANOTE TUDO, SEM PERDER DETALHES — /CHATPLAN = contexto com edição documental longitudinal entre as mensagens", com desenho de árvore A→B→C |C1,C2,C3| |_> E→F)
- Liga a: `docs/planejamento/CHATPLAN.md`, `docs/planejamento/fontes/*`
- Decisão: DECIDIDO (Dr. Silas) — método de trabalho: toda mensagem do Dr. Silas é guardada **literal** em `fontes/` (sem edição) e entra como nó na árvore do `CHATPLAN.md`; análise fica no DIARIO. Correções = nó novo, nunca sobrescrever.
- Feito: fontes literais M-0 (papel), M-B (v1.0), M-D (v1.1), M-F (addendum); CHATPLAN com ramos B1–B4, D1–D5, F1–F5 e ligações cruzadas.
- Próxima ação: manter CHATPLAN a cada mensagem. Dono: planejamento.

## PLN-006 · 2026-10-07 · Motor de continuidade: CTCAE→cruzamento→conduta + 7+1 clusters do retorno
- Origem: Dr. Silas (2 textos literais: `fontes/M-H_…` e `fontes/M-I_…`; exemplos sintéticos; refs NCI CTCAE v5/v6, ASCO emese de escape)
- Liga a: PLN-002 (§6–9 retorno, 4 eixos), PLN-003, D-W9-67 (CTCAE v6 pura), D-W9-63, CHATPLAN M-H/M-I
- Ideia (sem perda): (H) vômito 6x/dia não fecha G3 — G3 exige enteral/TPN ou internação, G2 hidratação EV ambulatorial; app extrai episódios mas pede os critérios; evento≠grau≠causalidade; cruzamento = tumor×tto×ECOG×CTCAE×comorbidades×MUC×labs/rads×tempo desde tto → espaço de conduta (exemplo cólon FOLFOX C4, DRC, losartana, Cr 1,9, K 3,1, D5); 7 perguntas do retorno; motor em 3 funis (oncologia → paciente → continuidade); UI do cluster com [EXPLICAR] (evidências, nunca %), [GERAR] → drafts, tudo desmarcado salvo ordem médica; matriz MANTER/SUPORTE/ADIAR/AJUSTAR/SUSPENDER. (I) 8 clusters: toxicidade, eficácia/doença, intercorrência/internação, interação/MUC, função orgânica (valor atual, anterior, delta, limite do protocolo), elegibilidade próximo ciclo (semáforo, nunca "aprovado"), suporte/sintomáticos (adequado/parcial/falha/não utilizou), novo problema (escape). Cada um com dados de entrada, perguntas de voz, regras de cruzamento e saídas sugeridas + OUTROS [+]. Regra: nenhum cluster decide isolado.
- O que o código tem hoje:
  - CTCAE: `src/rules/ctcaeGrau.ts` já devolve `pendente` com `inputs_missing` → coerente com H1. Vômito só em `rules/suporteNaoOncologico.ts` (sem ruleset G2×G3).
  - Cruzamento: peças separadas — interações (`rules/semaforoInteracoes.ts`), dose/ClCr (`rules/prescricao/safetyEngine.ts`), porta do ciclo (`portaCiclo.ts`), ciclo com médico (`cicloComMedico.ts`), delta (`delta.ts`), RECIST (`rules/recist*`), alertas lab/rad. Falta o cluster que cruza tudo e emite o semáforo de elegibilidade e a visão "valor atual/anterior/delta/limite do protocolo".
  - Eficácia como concordância clínica+marcador+rad: não existe (só RECIST por código, categoria PROPOSTA).
  - Intercorrência/internação estruturada, MUC como cluster, "suporte adequado/parcial/falha", "novo problema": não existem.
  - EXPLICAR/GERAR com "baseado em": não vistos.
- Lacuna: contrato dos 8 clusters; ruleset de vômito CTCAE v6; motor de elegibilidade com semáforo; evidência "baseada em" por sugestão; mapeamento voz→variável.
- Decisão: DECIDIDO (Dr. Silas) — nenhum cluster decide isolado; semáforo sem "aprovado"; cluster escape. EM ESPERA: congelar a matriz de retorno (Dr. Silas pediu só análise). Cuidado: corte de grau CTCAE v6 só com tabela oficial.
- Próxima ação: aguardar liberação. Dono: planejamento.

## PLN-007 · 2026-10-07 · Camada de conhecimento/assistência: scores, biomarcadores, SUS, agentes, ORK
- Origem: Dr. Silas (2 textos literais: `fontes/M-J_…` e `fontes/M-K_…`)
- Liga a: PLN-003 (KB versionada), D-W9-20, D-W9-64 (ExecSpec/CKG), D-W9-15 (gateway/LLM), PLN-001 (OncoAssist × código), CHATPLAN M-J/M-K
- Ideia (sem perda): 5 blocos (classificações, scores, biomarcadores/scoring path, tratamento/evidência, realidade SUS); código só roteia, cálculo/interpretação no agente/OncoAssist; retorno do agente = resultado + variáveis usadas/ausentes + versão + interpretação curta + fonte + incertezas + próximos passos; SUS primeira classe (indicado ≠ SUS ≠ instituição); 8 agentes; EXTERNAL_SOURCE → NEEDS_REVIEW; prompt do ORK com 10 regras; ORK-1 determinísticos (13 módulos, ver M-K).
- O que o código tem hoje:
  - **ORK e Maestro já existem**: `src/orchestration/maestro.ts` (tabela determinística R-14 evento→passos: LAB, RADS, PATH, CHEMO, CTCAE, COMORB, INTERACTION, EMERGENCY, DELTA, DOCUMENT, SINTESE…; comentário: "nenhum texto/LLM altera o ACTIVE_SET") e `ork.ts` (ondas, timeout, 2 tentativas, `AGENTE_INDISPONIVEL`). Agentes ainda são `AgenteFake`. O ORK-1 do texto bate com essa camada, mas nomes diferem (CHEMO × CHEMOSAFE/DOSE_SAFE/MED_SAFE; faltam STAGING, APAC, PROTOCOL/TRIALS, CLINICAL_DOCS, DOC_CONTROL como passos).
  - Scores: `src/rules/escores.ts` existe; Khorana/MASCC zero. PD-L1/CPS/TPS/CLDN18.2: sem contrato.
  - SUS: só APAC/CNS (`src/apac/`); sem camada de disponibilidade SUS × instituição.
  - Agentes de conhecimento: inexistentes; OncoAssist sem roteador/gateway READ.
  - EXTERNAL_SOURCE / NEEDS_DATA: zero (há NEEDS_REVIEW e `pendente` com campos ausentes → vocabulário a unificar).
- Lacuna: contrato universal "resposta de capacidade"; registro de capacidades com gatilhos; camada SUS/instituição; EXTERNAL_SOURCE; alinhar nomes ORK-1; fronteira ORK × LLM.
- Conflito a vigiar (não resolvido em silêncio): o texto descreve o ORK como orquestrador que "determina" capacidades (estilo agente/LLM); o código tem ORK/maestro determinístico por tabela e proíbe LLM de alterar o plano. Leitura compatível: ORK-1 = tabela de código (decide QUAIS capacidades); agentes/LLM só devolvem conteúdo. PENDENTE para o Dr. Silas.
- Decisão: DECIDIDO (Dr. Silas) nos princípios (J1–J6, J8, K1). PENDENTE: J7 (prompt final), K2 (nome da camada dos agentes), fronteira ORK × agente.
- Próxima ação: aguardar liberação. Dono: planejamento.

## PLN-008 · 2026-10-07 · Definição do OncoAssist (soma de 12 capacidades)
- Origem: Dr. Silas (`fontes/M-L_PLN-008_oncoassist-definicao.md`; mensagem curta, sem texto adicional)
- Liga a: `docs/specs/ONCOASSIST-PROGRAMA-X-CODIGO.md` (mesma lista de 12), PLN-001 (OncoAssist × código), PLN-007 (agentes/ORK), PLN-003 (KB versionada), D-W9-15/16/40
- Ideia: OncoAssist = identidade persistente + personalidade + memória longitudinal + voz/ouvido/visão + LLMs intercambiáveis + API keys por referência segura + MCP/plugins/skills + web/PC/sistemas externos + WORK+STUDY + agentes internos + conhecimento oncológico profundo + governança clínica.
- O que o código tem hoje (conforme o programa X-código, conferido): ✅ agentes internos (18 AG-xx, Maestro+ORK) e governança (gates G-02…G-28, red team) · 🟡 identidade (só rótulo/painel), memória (ledger/timeline existem; preferências do médico não), voz (comando curto Deepgram G-23 + Plaud manual; visão desligada D-W9-40), chaves (regra sem cofre), WORK sem STUDY (OncoMind fora do repo), conhecimento (corpus + 72 fichas + ragGRAFO 2.971 nós, sem RAG ligado) · ❌ personalidade (sem persona no código), LLMs intercambiáveis (sem model router; provider único D-W9-15 desligado) · ⏸ MCP/plugins/skills (desligados, D-W9-16), web/PC/externos (gateway só com 6 efeitos; READ não modelado).
- Lacuna: nenhuma nova; confirma a fila da onda OncoAssist já com o operacional: roteador + cofre → gateway READ → persona versionada (BRAIN_OS) → custo por tarefa → conexões desligadas → ragGRAFO com vetores + conector. Itens fora dessa fila e citados pelo Dr. Silas: STUDY (OncoMind) e visão → sem dono definido.
- Decisão: DECIDIDO (Dr. Silas) — definição. PENDENTE: onde entra o STUDY no repositório (hoje fora).
- Próxima ação: aguardar mais texto/liberação. Dono: planejamento.

## PLN-009 · 2026-10-07 · Refino: OncoAgent/OncoAssist, Maestro, determinístico, OncoBoard, circuito, segurança
- Origem: Dr. Silas (`fontes/M-M_PLN-009_oncoagent-maestro-governanca.md`)
- Liga a: PLN-007 (conflito ORK × agente), PLN-008, D-W9-15/16/20, RAIZ CANÔNICA/SSOT (MEMORY_OS, BRAIN_OS), CHATPLAN M-M
- Ideia (sem perda): OncoAgent = classe; OncoAssist = instância nominal; Maestro orquestra percurso/contexto, executores com contexto mínimo, setores desnecessários em STAND_BY; determinístico = controle da execução (não resposta clínica da LLM) → if/else terapêuticos recentes não pertencem ao núcleo; OncoBoard = Onco Clínica + Cirurgia + RT, debate limitado, divergência preservada, saída minuta/opinião; circuito MEMORY_OS→BRAIN_OS→Maestro→execução→Harness→minuta→revisão→registro, falha vira proposta de melhoria, nunca mudança silenciosa de regra; ferramentas externas = territórios sob contrato; chaves no backend, READ/EDIT/SEND separados, PHI não atravessa automaticamente territórios de comunicação; princípio pedido→contexto→execução→verificação→minuta→revisão→registro.
- O que o código tem hoje:
  - Maestro/ORK: `src/orchestration/maestro.ts` (tabela de eventos R-14) + `ork.ts` → **coerente** com M2/M3. "STAND_BY": 0 no código (só em docs de governança QT-HBEM) → hoje não-selecionado = simplesmente ausente do plano; falta estado explícito e "contexto mínimo por executor".
  - "OncoAgent": 0 no código (só 2 docs de referência) → nome da classe a formalizar nos contratos/AG-xx.
  - OncoBoard: `src/app/oncoboard` com 3 personas e desidentificação; provider desligado → coerente com M4; "divergências preservadas" e "debate limitado" a conferir nos testes.
  - MEMORY_OS/BRAIN_OS: citados em RAIZ CANÔNICA, SSOT e DECISOES; 1 menção em `src`; circuito completo não implementado ponta a ponta.
  - READ/EDIT/SEND: gateway só tem 6 efeitos de saída (SEND/EDIT); READ não modelado (PLN-001); PHI × territórios de comunicação: regra existe (A8–A10, D-W9-66), a conferir por gate.
  - "Falha → proposta de melhoria, nunca mudança silenciosa": coerente com decisão 12–13 de PLN-003; sem fila formal de propostas.
- Lacuna: (a) estado STAND_BY + contexto mínimo por executor no Maestro; (b) nome OncoAgent na taxonomia AG-xx; (c) READ no gateway; (d) fila de "propostas de melhoria" a partir de falhas do Harness; (e) **reclassificar as regras terapêuticas if/else recentes** (quais? Dr. Silas não listou — "aquelas") como conteúdo de KB versionada, fora do núcleo → PENDENTE identificar quais.
- Conflito PLN-007: **resolvido pelo Dr. Silas** (M3): Maestro/determinístico controla a execução; resposta clínica vem do agente/LLM, nunca do if/else.
- Decisão: DECIDIDO (Dr. Silas) — M1–M8. PENDENTE: quais "if/else terapêuticos recentes" saem do núcleo (referência não explícita).
- Próxima ação: aguardar liberação/texto X/Y/Z. Dono: planejamento.
