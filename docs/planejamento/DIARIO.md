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
