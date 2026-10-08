# W10-GLM · REDTEAM-ACHADOS (provas adversariais de ponta a ponta)

> Onda W10 · executor **GLM** · branch `f0/w10-redteam` · base `f0/w1-integrado` (worktree `w10-redteam`).
> Método (igual ao Kimi): teste que **passa** prova uma defesa e está em `tests/redteam/*.test.ts`;
> teste que **falha** prova falha real e está em `tests/redteam/*.adv.ts` (fora da suíte regular),
> cada um com o motivo no corpo da asserção. **Nenhuma expectativa foi ajustada para casar com o código.**
> Rodar: `npx vitest run --config tests/redteam/vitest.config.ts --no-file-parallelism`.
> Rodada final: **28 arquivos (14 de defesa + 14 adversariais) · 227 testes · 45 vermelhos (todos em `.adv.ts`) · 182 verdes** —
> os 154 testes das 14 suítes de defesa (`.test.ts`) passam integralmente (provas de base real);
> os 28 verdes restantes dentro dos `.adv.ts` são provas de base real ou casos guardados (`if (!fn) return`).

## Tabela de achados (ID × severidade × alvo × dono)

| ID | S | Alvo (arquivo/função) | Entrada (prova) | Esperado | Obtido | Dono provável |
|---|---|---|---|---|---|---|
| RT-01a | S0 | `src/orchestration/pipeline-extracao.ts` (sem executor) | `ReviewAction {acao:"LIGAR_PACIENTE", patientId}` do contrato `src/contracts/w10/extracao.ts` | Caixa de revisão fecha: ação aplica vínculo com médico+patientId | Contrato só schema; **nenhuma função aplica a ação** — exceção nunca é resolvida | Fugu (orchestration) + tech lead (kernel) |
| RT-01b | S0/S1 | `src/rules/w8/vinculoDocumento.ts` | Laudo com CNS do PT07 e nome do PT09 | Confronto nome×identificador gera exceção de revisão (D-W9-34a) | `EntradaVinculoDocumento` nem tem campo de nome: CNS válido liga sem ver o nome | Grok (rules/w8) |
| RT-01c | S2 | `pipeline-extracao.ts` (`reconciliarFontes`) | Duas entradas do mesmo laudo | Dedupe no pipeline; duplicata marcada | `reconciliarFontes` é no-op; `dedupeExame` sem consumidor | Fugu + Grok |
| RT-02a | S0 | `src/kernel/extracao/segmenter.ts` | Dois homônimos completos sem "chamo" ("Bom dia, Maria…" ×2, mesma idade/tumor) | Fronteira duvidosa separa + `REVISAR_FRONTEIRA` | **1 segmento único com os dois pacientes**, sem sinal de revisão | Fugu (segmenter) |
| RT-03a | S1 | `src/kernel/extracao/extrator.ts` | "сisplatina" (С cirílica U+0441); "cis\u200Bplatina" (zero-width) em prescrição | Fármaco incerto vira `UNCERTAIN` + confirmação (PIPELINE §5.5) | **Silêncio total**: regex literal não casa, nenhum fato, nenhuma exceção | Fugu (extrator) |
| RT-04a | S1 | `extrator.ts` (lista de negação) | "não se pode excluir recidiva: nódulo em L4 medindo 8 mm" | Negação/incerteza nunca vira achado positivo | Achado de imagem **EXPLICIT conf. 1 sem confirmação** | Fugu |
| RT-04b | S1 | `extrator.ts` | "lesão em L2 medindo 12 mm **sugestivo de** metástase"; "diagnóstico: … **compatível com** metástase" | UNCERTAIN/DERIVED com regra; nunca fato firme | EXPLICIT, `requiresConfirmation:false` | Fugu |
| RT-04c | S2 | `extrator.ts` (whitelist de unidades) | "creatinina 88 µmol/L"; "Hb 98 g/L" | Unidade ambígua/trocada = PENDENTE + confirmação | **Some sem rastro** (fora de `g/dL\|mg/dL\|ng/mL\|U/mL`) | Fugu |
| RT-04d | S2 | `extrator.ts` | "PSA: 1.400 ng/mL" (documento) | Milhar × decimal sinalizado | Valor literal sem sinal de ambiguidade | Fugu |
| RT-05a | S1 | `src/rules/radAlerts.ts` (`negado`) | PT08 crânio **negativo** ("Não observamos formações expansivas…") com termo ativo | Nenhum alerta (teste obrigatório PT08, D-W9-51) | **1 alerta VERMELHO**: negador só cobre `sem\|nega\|negativo para\|ausencia de\|ausente` | Grok (radAlerts) |
| RT-05b | S1 | `radAlerts.ts` + `corpus/rulesets/rad-emergencia.v1.json` | Cadeia das 30 emergências (D-W9-51) | Varredura elo a elo com trecho-fonte | Sem avaliador de cadeia; corpus tem shape `{header,negacoes,termos}` que o avaliador **não consome**; `negacoes` do corpus ignoradas | Grok + curadoria |
| RT-05c | S1 | `src/kernel/harness/gates.ts` | Lateralidade divergente achado × conclusão (rim direito × esquerda) | G-07: alerta de divergência | Nenhum confronto existe (redundante com KIMI T-49) | Tech lead (harness) |
| RT-06a | S1 | `src/rules/tipos-w3.ts` (`RecistInput`) | Nova lesão metastática entre baseline e atual | PD por nova lesão declarável | Input só tem `lesoesAtuais/baseline/nadir` com o mesmo conjunto de códigos: **PD por nova lesão é impossível** (o contrato `RecistAvaliacao` TEM `novasLesoes`; o runtime não) | Tech lead + contracts |
| RT-06b | S2 | `tipos-w3.ts` (`LesaoRecist`) | Linfonodo 8 mm de eixo curto | Não-alvo (< 10 mm) distinguível | Só `{codigo,diametroMm}`: linfonodo pode ser contado como alvo | Tech lead + contracts |
| RT-06c | S2 | `recist.ts` | 3,4 cm digitado como 34; cortes diferentes entre exames | Recusa/pendência de unidade e corte | Nenhuma validação de unidade nem conceito de slice | Grok + extrator |
| RT-06d | S1 | morfometria (D-W9-57) | Skill SNC v4.0: escala por anatomia média, MF ausente≠1,0, régua horizontal na vertical, polo truncado, máscara probabilística | Núcleo TS puro com os 36 casos portados | **Nenhum módulo de morfometria em `src/`** | Equipe interna (kernel) |
| RT-07a | S2 | `src/rules/triagem.ts` | Hb "9" (g/dL onde se espera décimos); Hb 12000 (g/L) | Plausibilidade/unidade sinalizada (PENDENTE + confirmação) | 9 **corta sem questionar**; 12000 **passa sem questionar** | Grok (triagem) |
| RT-08a | S0 | `src/rules/prescricao/**` (inexistente) | Gem+Cis bexiga × vias biliares; versão inexistente | Ficha inteira por templateId+tumor+cenário+versão; erro tipado (D-W9-22b) | Nenhum carregador: homônimas indistinguíveis, versão errada não rejeitada | Equipe interna + curadoria |
| RT-08b | S0 | `src/contracts/w10/prescricao.ts` | `ProtocolTemplate` com status RASCUNHO/INATIVA | Uso restrito a CONFERIDA_MEDICO (comentário do schema) | Schema aceita; **nada impede prescrever de ficha não conferida** | Tech lead |
| RT-08c | S1 | `src/rules/prescricao/**` | AUC sem clearance; mg/m² sem peso/altura | PENDENTE com campo faltante nomeado (Calvert é código — CANONICA §6) | Nenhuma engine de dose por `DoseBasis` | Equipe interna |
| RT-08d | S1 | idem | 5-FU "8 h sem bomba"; bolus 5-FU; antiemese com NK1 | BLOCK_ARTEFATO/alerta (D-W9-23a/50, 34c) | Nenhum validador de infusão/antiemese | Equipe interna + curadoria |
| RT-08e | S2 | idem | Peso de 60 dias atrás na dose | Dado reutilizado mostra fonte e idade (D-W9-24) | Nada registra idade do dado | Equipe interna + Cursor (UI) |
| RT-09a | S2 | `src/kernel/harness/gates.ts` | Agente escrevendo objeto de outro dono (T-56) | G-16 rejeita write alheio | Sem veredito runtime (redundante com KIMI T-56) | Tech lead/Grok (ownership.ts) |
| RT-09b | S2 | `src/orchestration/ork.ts` | Agente invocando agente dentro da própria saída | Composição só via ORK/plano, auditável | Sem restrição representável no runtime | Fugu + tech lead |
| RT-09c | S1 | `pipeline-extracao.ts` (`validarSeguranca`) | Extrator devolvendo fato fora do contrato (campo inventado) | Rejeição com motivo (contrato Zod existe) | `validarSeguranca`/`normalizarFatos` são no-op: **o pipeline não usa o contrato** | Fugu |
| RT-10a | S0 | `kernel/extracao/reconciliacao.ts` (`conflitoCronologia`) | PET 02/2030 × diagnóstico 11/2030 | `TEMPORAL_CONFLICT` (PIPELINE §5.6) | **Reataque observado:** função real `conflitoCronologia(ClinicalFact[])` é chamada por `detectarConflitos`; teste agora usa este contrato e verifica PET + diagnóstico. Teste alterado, execução pendente. | Fugu / integração |
| RT-10b | S0 | `src/contracts/w10/clinico-w10.ts` | `historicalMetastaticDisease: true → false` | Nunca volta a false (PIPELINE §5.7) | Schema **aceita o rebaixamento** (só há comentário; sem superRefine) | Tech lead (1 linha de contrato) |
| RT-10c | S0 | `kernel/projections/snapshot.ts` | TNM corrigido por supersede | `stageHistory` preserva o anterior (A3) | **Reataque observado:** snapshot retorna exatamente os dois TNM confirmados no horizonte, inclui revisão/fonte/superseded e exclui RAW, outro paciente/lote e evento futuro. Teste alterado, execução pendente. | Tech lead + equipe interna |
| RT-11a | S1 | trials (módulo inexistente) | Nó de trial com `status_resultado` negativo | Só POSSIBLE_MATCH; nunca "elegível" (D-W9-48) | Nenhum avaliador: negativo poderia ser apresentado como ganho | Equipe interna (BRAIN_OS) |
| RT-11b | S0 | `src/rules/prescricao/**` | Dose de braço de estudo (TPF, ddMVAC…) | Não vira ficha sem revisão (D-W9-22i) | Nenhuma barreira de origem de dose | Equipe interna + curadoria |
| RT-11c | S2 | grafo ragGRAFO (JSONL) | Aresta órfã (nó removido) | Loader valida arestas ao carregar | Dado declarado está íntegro, mas **nenhum loader/validador existe** para o dado vivo | Equipe interna |
| RT-11d | S1 | conhecimento (consumidor inexistente) | Nó de aula (NAO_VERIFICADO) × diretriz FINAL divergentes | Ambas mostradas; conflito nunca some (D-W9-22c) | Nenhum consumidor do grafo confronta fontes | Equipe interna + curadoria |
| RT-12a | S0 | `src/kernel/llm/desidentificar.ts` | `…/pacientes/MariaAlvesDeSouza/laudos` (nome compacto em URL/caminho) | PHI em URL barrado (G-02) | **Escapa**: casamento exige janelas separadas por espaço. *Mitigação atual: egress 100% fechado* (`CANAL_EXTERNO_NAO_HABILITADO`) | Tech lead (llm) |
| RT-12b | S0 latente | `kernel/llm` + `harness` | PDF com metadado de autor/paciente a caminho externo | G-27 sanitizador + relatório obrigatório | Nada existe (redundante com KIMI G-27); risco só quando o egress abrir | Tech lead |
| RT-12c | S2 | `src/kernel/gateway/gateway.ts` | Leitura externa (READ) | READ ≠ WORLD_EFFECT (CANONICA §7) | ActionIntent não tem verbo de leitura: seguro **por omissão**, sem gate para quando ligar | Tech lead |
| RT-13a | S2 | `src/leitura/caixa-unica.ts` | PDF digital com camada de texto | Conversão local (D-W9-18; pdfjs-dist aprovada D-W9-58 e instalada) | Tudo vira PENDENTE "sem conversor local aprovado" | W7/equipe interna |
| RT-13b | S2 | `caixa-unica.ts` (`lerZipDocx`) | DOCX gravado em Latin-1 | PENDENTE (ilegível) ou detecção de encoding | **PRONTO com mojibake** ("Creatinina s\uFFFDrica") — corrupção silenciosa | W7/equipe interna |
| RT-15a | S0/S1 | `pipeline-extracao.ts` (ReconciliationEngine) | Plaud: "cisplatina" × prescrição: carboplatina (PT10) | Exceção CONFLICT `planned_regimen != ordered_regimen` (spec §10) | `reconciliarFontes` no-op: **contradição central não é vista** | Fugu |
| RT-15b | S1 | `extrator.ts` | "o estadiamento é cN2, sem imagem de axila anexada" | Pendência de estadiamento sem prova | Regex TNM exige T-N-M completos: **o cN2 some em silêncio** | Fugu |
| RT-15c | S1 | `extrator.ts` + pipeline | "prednisona 10 mg por hora" dita em consulta | Entre as 4 exceções esperadas (spec §10) | Fármaco só sai de prescription e sem exceção: **some sem rastro** | Fugu |

## Contagem

- **45 testes vermelhos** em 14 arquivos `.adv.ts` (todos com motivo no corpo da asserção; nenhum ajustado ao código).
- **42 achados distintos** (RT-01a…RT-15c na tabela acima), mapeados dos 45 testes (alguns achados têm 2 provas).
- Redundâncias declaradas com a onda Kimi: RT-05c (G-07), RT-09a (T-56/G-16), RT-12b (G-27) — mantidas porque cada fatia desta onda pedia a prova.

## Top 10 para endurecer primeiro

1. **RT-12a** (S0) — desidentificador deixa escapar nome compacto em URL/caminho. Barreira obrigatória antes de ligar a LLM (D-W9-15); hoje a única defesa é o egress fechado.
2. **RT-10b** (S0) — `historicalMetastaticDisease` rebaixável em silêncio: uma linha de `superRefine` no contrato resolve.
3. **RT-15a** (S0/S1) — ReconciliationEngine: o coração do pipeline (§4/§7) não existe; resolve junto RT-01c e a contradição central de RT-15.
4. **RT-08a + RT-08b** (S0) — biblioteca de fichas versionadas + enforcement "só CONFERIDA_MEDICO": sem isso prescrição segura não destrava.
5. **RT-10c** (S0) — reataque do `stageHistory` observado no código; execução do teste permanece pendente.
6. **RT-05a** (S1) — negador incompleto dispara alerta VERMELHO num laudo **negativo** (PT08); fix pequeno em `radAlerts.ts`.
7. **RT-04a + RT-04b** (S1) — linguagem de incerteza virando fato firme (fix concentrado no extrator).
8. **RT-02a** (S0) — homônimos completos fundidos num segmento sem revisão de fronteira.
9. **RT-10a** (S0/S1) — implementação observada em `conflitoCronologia`; execução do teste permanece pendente.
10. **RT-13b + RT-01a** (S2/S0) — detecção de encoding na caixa única (barato) e executor das `ReviewAction` (fecha o ciclo da caixa de revisão).

## Bases reais comprovadas (defesas que passaram — resumo por fatia)

- **RT-01**: score nunca vincula (`requiresReview:true` literal); desidentificado pesa 0 sem renormalizar; CNS divergente ordena e não liga; dedupe distingue duplicata × conflito VERMELHO × concordância; reimpressão com data de extração diferente não quebra a chave.
- **RT-02**: segmenter separa pacientes com chamada explícita e ignora menção incidental; mãe/CNS (dados fortes) vencem o nome no ranking; acento/caixa normalizados; "M. I. R."/invertido/"Dona" não casam; CPF rotulado "Cartão SUS" classificado por valor com `conflitoRotulo`; demográfico ambíguo não escolhe.
- **RT-03**: injeção não produz dose/conduta/confirmação; pipeline não promove nada; ledger recusa evento sem `reviewDecisionId`; script/HTML viram dado com hash estável.
- **RT-04**: negações da lista nunca viram fato; "creatinina quatorze" vira UNCERTAIN com valor nulo; número falado em Plaud exige confirmação (e o contrato Zod reprova fatos plaud sem confirmação); vírgula decimal fica crua.
- **RT-05**: alerta só com termo ativo+fonte textual+trecho integral; negação/antecedente anulam; suspeita vira REVISAO_URGENTE; imagem bruta nunca inferida; ruleset inativo ⇒ PENDENTE.
- **RT-06**: RECIST calcula por código (BigInt): PR/PD/CR corretos, PD exige 20% **E** 5 mm, conjunto divergente/sem confirmação/nadir inconsistente recusam; categoria sempre candidata (PENDENTE).
- **RT-07**: todas as fronteiras (37,8/37,9; Hb 80/79; Cr 150/151; ANC 1500/1499; PLQ 100000/99999; SpO₂ 88/87; PAS 90/89; FC 50/49) — igual passa; ausente = PENDENTE + fila do médico; hemograma 7/8 dias e fuso −03:00 corretos; portões do ciclo × salão independentes; porta é bula (grau CTCAE ignorado).
- **RT-08**: −25% recusado; −20/−30/−40 com arredondamento meio-para-cima uma vez; sem dose anterior PENDENTE; sem peso PENDENTE→VERMELHO no 2º ciclo; peso informado marcado; contratos recusam ajuste sem motivo e MANUAL QT sem override.
- **RT-09**: maestro devolve null em evento desconhecido/hostil; ORK rejeita plano inválido/cíclico; agente ausente/quebrado não trava (2 tentativas); G-10 bloqueia dublê de LLM com dose; G-13 bloqueia letra A–D; contratos da caixa de revisão recusam ação incompleta; fatos do extrator determinístico obedecem o contrato.
- **RT-10**: ledger append-only por trigger; mesma operação com payload diferente ⇒ NEGADA + auditoria; RAW não entra; conflito VERMELHO preserva candidatos e não some com fonte nova; ausente PENDENTE; proposta nunca substitui valor; recomputação determinística; idempotência reusa chave só com payload igual.
- **RT-11**: interações/agregação com ruleset inativo ⇒ PENDENTE (nunca VERMELHO nem "sem interação"); ragGRAFO com status explícito (2.746 NAO_VERIFICADO + diretrizes FINAIS) e sem aresta órfã no dado declarado; corpus de regras nunca referencia o grafo.
- **RT-12**: G-02 barra nome/CNS/CPF/telefone/e-mail/DN; `/acao` sem artefato assinado/destino livre/WhatsApp ⇒ 409; replay imprime 1 vez; PHI não ecoa em resposta nem log; sessão ausente/expirada ⇒ 401; estúdio recusa Origin externo com 403.
- **RT-13**: PDF/imagem PENDENTE sem pedir foto; DOCX corrompido/bomba/ilegível PENDENTE sem extração; macro/script viram dado inerte; vazio/espaços PENDENTE; rasura PENDENTE; BOM/UTF-8/CRLF preservados.
- **RT-14**: tudo dentro do orçamento (2 s/200 MB) — ver `docs/progresso/W10-REDTEAM.md`.
- **RT-15**: no caso completo, nenhuma conclusão silenciosa (campos vazios, timeline nula, nada vinculado); histologia do AP extraída como candidata.
