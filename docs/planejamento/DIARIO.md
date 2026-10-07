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
