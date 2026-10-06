# P1 RED · mapa semântico final G/INV (52 IDs)

Base auditada: integrado700f3ee (RED avançou por FF), limpeza c8ba652, rodada3 iniciada2725f4c. Este mapa lê comportamento e assertions, não promove IDs por referência literal. COBERTO significa regra testada no componente citado; não significa produção/dossiê clínico. PARCIAL declara a lacuna específica. SEM_TESTE significa nenhum teste positivo/negativo do requisito encontrado no escopo lido. Nenhum ID é FORA_DO_F0 por conveniência. G21 é explicitamente futuro; os novos G23–28 já possuem contratos ou componentes e permanecem PARCIAL quando consumidores faltam.

| ID / requisito | Implementação / limite observado | Teste / assertion semântica | Estado | Evidência faltante / consequência |
|---|---|---|---|---|
| G-01 identidade | rules/identidade.ts; kernel/identity/filaVinculo.ts | identity/g01-vinculo.test.ts: vínculo exato e conflito=>fila VERMELHO; rules/adv-009-ambiguidade: nome não liga | PARCIAL | bloqueio artefato ligado à fila não demonstrado; contato conhecido A com único identificador B merece revisão |
| G-02 PHI egress | kernel/harness/gates.ts:g02; llm/desidentificar.ts | kernel/kernel.test.ts:G02 PASSA/BLOQUEIA; adv005-phi residual DN | PARCIAL | função sem consumer de egress externo; ADV006 bypass da rota de saída segue bloqueado |
| G-03 assinatura humana | g03; server/rotas.ts; contracts/operacao.ts | kernel:G03 AGENTE bloqueia/SESSAO passa; server/bundle confirma sem imprimir; contratos rejeita medicoId cliente | PARCIAL | g03 não chamado no caminho HTTP; garantia jurídica e todas saídas não demonstradas |
| G-04 prompt sem thresholds | corpus/prompts; tests/prompts filtro regex | prompts/prompts.test.ts:G04 7 prompts rejeitam certos números e comparadores | PARCIAL | regex não cobre todo número/corte; mutação negativa do verificador não demonstrada |
| G-05 VERDE honesto | g05; contracts/base:dado; rules/triagem | kernel:G05 obrigatória1=>ALERTA; contratos AUSENTE/VERDE rejeita; w3/A07=>PENDENTE | PARCIAL | g05 sem consumer; negativo checksExecutados=false pouco coberto; consumer pré-consulta ADV017 achado |
| G-06 E1 destaque | ui/BannerE1; templates folha-operacional | ui/banner-e1: reconhecimento mantém alert; corpus/k12-folha-operacional: somente folha exibeE1 | PARCIAL | geração/render+impressão real folha com emergência não provada, templates isolados |
| G-07 lateralidade divergente | prompts PATH/RADS mencionam lateralidade | prompts:G04 exige literal lateralidade | SEM_TESTE | nenhum teste confronto PATH×RADS×procedimento com revisão obrigatória |
| G-08 anatomia×sexo | contracts/clinico:sexoCadastral/divergencia | sem prova de comparação próstata×cadastroF | SEM_TESTE | campo tipado não é gate de revisão |
| G-09 pT biópsia | contratos estadiamento/proveniência | sem prova rejeição pTNM com biópsia sem ressecção | SEM_TESTE | teste por prefixo/fonte/specimen necessário |
| G-10 dose pura | g10; rules/index:calcularDose | kernel:G10 rejeita doseFinalMg LLM, aceita literal; rules/dose reductions+half-up+null | PARCIAL | g10 sem consumer; gate sem rulesetVersao não prova recusa |
| G-11 APAC campos | rules/apac:validarEmissaoApac | apac/apac.test.ts:finalidade faltante=>podeEmitirfalse/documentoBLOQUEADO | PARCIAL | campos aplicáveis/contextos todos não demonstrados; /acao ADV006 não verifica artefato |
| G-12 sem mapa intenção→finalidade | rules/apac:apacGerar herda TumorLot | apac:Q33 finalidade confirmada herda; G12 intenção diferente mantém pendente | PARCIAL | prova estática limitada; não cobre toda biblioteca/lote futuro |
| G-13 termo≠letra | contracts/estados:intencao; g13 | kernel:G13 B bloqueia/ADJUVANTE passa | PARCIAL | persistência com enum pode resistir; gate sem consumer, não prova todos writers |
| G-14 interpolação≠observado | g14; kernel/projections/series.ts | kernel:G14 true/true bloqueia e true/false passa | PARCIAL | g14 sem consumer; passagem séries/render por gate não provada |
| G-15 texto sem autoridade | orchestration/ork.ts; ledger/drafts.ts | orchestration/ork:A4 stateENTREGUE não altera run; ledger:N07 rawstate recuperado sem eventos | PARCIAL | entrada extrator/prompts consumidores reais não demonstrados |
| G-16 dono objeto | contracts/agentes:ownerOf; corpus/capabilities | corpus/capabilities valida registros/donos | PARCIAL | nenhuma rejeição runtime write de objeto alheio demonstrada |
| G-17 fonte corpus | kernel/corpus/loader.ts; contracts/agentes:RulesetHeader | corpus/g17-packs-cob positivo pack/header, negativos fonte+versão; contratos fonte externa sem trecho rejeita | COBERTO | escopo estrutural loader packs/rulesets; não valida veracidade clínica da fonte |
| G-18 Alerta fora minuta | modules/documentos/render.ts; contracts/operacao:Alerta | modules/adv015-template:ALERTA/CORRECAO_IA campo vazio; contratos destinoPRONTUARIO rejeita | PARCIAL | tipo montarMinuta com Alerta rejeitado em compilação não demonstrado |
| G-19 intent completo | kernel/gateway:executar; server/rotas | kernel gateway sessão ausente/expirada/incompleto=>nenhum efeito | PARCIAL | action artifact autorizado ADV006 bloqueado; sem consumer G02 |
| G-20 idempotência | gateway; ledger/idempotencia.ts UNIQUE/reserva | ledger/adv001:concorrência1efeito, reinício REPLAY, incertoOUTCOME_UNKNOWN, hash diferenteNEGADA | COBERTO | escopo executores fake, não prova impressão física; backup/restauração nova máquina não executada |
| G-21 trials elegível | futuro por PLANO448–468 G21 '(futuro)'; DECISOES Q48 fora v1 | nenhum TrialMatch runtime | FORA_DO_F0 | referência normativa: plano468; Q48, não implementar elegibilidade |
| G-22 capability>=TESTED | contracts/estados:CapabilityStatus; corpus/capabilities | corpus/capabilities:AG15TESTED/AG20DISABLED | PARCIAL | nenhum consumer que oculte alertaSPECIFIED e mostre 'em validação' |
| G-23 comando curto | g23; contracts/agentes:VoiceIntent | kernel:G23 3<=10 passa/40bloqueia | PARCIAL | Deepgram não integrado; limite real [VERIFICAR], nome falado/log de retorno não provado |
| G-24 Plaud | desidentificar; g02 | kernel:tokeniza/reidentifica local; adv005 DN sintético | PARCIAL | importação Plaud real por entrada desidentificador não provada |
| G-25 assinatura no bundle | server/rotas g25; server/sessao hash e scope | server/bundle:fora=>ESCOPO_ASSINATURA_INVALIDO; A13 texto trocado409 | COBERTO | execução fake/local; mutação consumer ainda não executada; unitário detecta bypass, HTTP antigo não |
| G-26 visão sem autoridade | g26; VisualSuggestion; AG20DISABLED | kernel:G26 RECIST/visual bloqueia; contratos rótuloLaudo rejeita | PARCIAL | TNM/RESP/PROTOCOLO/APAC/SEMAFORO consumidores não provados |
| G-27 saída limpa metadados | SanitizationReport é só schema | sem teste PDF autor/paciente/metadado rumo serviço | SEM_TESTE | sanitizador PDF/DICOM/pixel e gate de saída ausentes; Parte10R30 F1 piloto não prova implementação |
| G-28 tema semântica | ui/tema/ThemeProvider | ui/tema:árvore sintética semântica igual gelo/contraste | PARCIAL | superfície fixture fixa não é app ativo; troca paciente/escopo/assinatura real precisa E2E |
| INV-01 autoridade | contratos ClinicalEvent; server/rotas; g03/g10 | contratos:medicoId/assinado cliente rejeita; kernel literal vs calculado | PARCIAL | ADV006 autorizado sem artefato persiste; IA runtime inexistente não equivale garantia |
| INV-02 ausência PENDENTE | dado schema; snapshot; triagem; delta | contratos AUSENTEVERDE rejeita; A07 nullPENDENTE; rules/dose baseNull | PARCIAL | ADV017 consumidor pré-consulta ausência=>RESOLVEUVERDE contradiz norma |
| INV-03 patientId único | identidade; filaVinculo | adv009 nome não liga/ids conflito; identity:g01 vínculo exato | PARCIAL | unicidade identificadores em todos writers/cadastro e contatoA×IDB não provada |
| INV-04 sessão servidor | ConfirmarBloco strict; sessao/rotas | server/server:medicoId400/expirada401; bundle escopo sessão não amplia | COBERTO | escopo rota confirmar; actor local só médico servidor |
| INV-05 gateway único | gateway; check-boundaries | kernel intent incompleto não executa; adv013 3 vetores scanner FALHAM | PARCIAL | scanner permite WebSocket/importdinâmico/fetch computado; CP002 congelado |
| INV-06 dose determinística | rules/index dose; g10 | dose:reduções0/20/30/40 e125×.7=88; kernel calculadoLLM bloqueia | PARCIAL | consumidor LLM gate ausente; não generalizar teste para todas APIs de dose |
| INV-07 conflito preservado | reconciliar; snapshot; ledger draft stale; delta | adv009 candidatos2; A08 proposta não apaga; adv010ausência mantém vermelho | COBERTO | núcleo lido conserva os candidatos; histórico após supersedes sob investigaçãoADV018 |
| INV-08 salvar/aplicar nunca bloqueado | salvarDraft envelope; farmacia; UI validar | ledger:N07raw persiste; stale cria novo draft; farmacia bloqMedicofalse | PARCIAL | matar processo em todos caminhos; UI sem rede/humano não cobre 'nenhum caminho' |
| INV-09 alertas/correções fora prontuário | Alerta destinoCHAT; render proibidoConter | contratos:PRONTUARIO rejeita; adv015 origins excluídas; folha permite alerta | PARCIAL | persistência chat completo e tipo minuta não provados |
| INV-10 QT/farmácia | modules/farmacia estados; packs/bundles | farmacia EDITAR recusado/conteudoPrescricaoId intacto/correçãochat | PARCIAL | impedir farmácia QT automática/receber só assinatura não provado; ADV006 |
| INV-11 dimensões ortogonais | contracts/estados; modules/tipos | contratos cores3; farmacia bloqueiaMedicofalse; revisão RAW ledger negada | PARCIAL | não há teste combinado5dimensões preservadas por promoção |
| INV-12 PHI só exceções | desidentificar/g02/g23; backup cifrado | kernel identificadores/DN removidos; backup arquivo sem patientName | PARCIAL | egress consumer ausente; não prova exceções Meta/Plaud/Deepgram e saída imagem |
| INV-13 regras com fonte | RulesetHeader; corpus loader; prompts | g17-packs/header falta rejeita; prompts thresholds selecionados ausentes | PARCIAL | corpus estrutural não sustenta clínica; varredura completa threshold no código/UI não provada |
| INV-14 provenance saída regra | rules/tipos-w3/index/triagem | w3/integracao e dose rulesetVersao; triagem inputs_used/missing | PARCIAL | nem toda função pura saída uniforme (e.g.diferencaDiasCivis) prova universal |
| INV-15 objeto um dono | AgentSpec.ownerOf; corpuscapabilities | corpus/capabilities estruturaAG14/AG13 | PARCIAL | enforcement runtime gravação alheia ausente |
| INV-16 texto autoridadezero | ork; maestro tabela; salvarDraft | ork stateENTREGUE ignorado; maestrotextoLivre null; N07inerte sem promoção | PARCIAL | injection no extrator real/PHI entry não rodado |
| INV-17 E1 apresentação | Alerta schema; BannerE1 | contratos authorityOverridetrue rejeita; UI banner persiste reconhecido | COBERTO | escopo contrato/banner; escalonamento externo futuro não demonstrado |
| INV-18 falha mínima artefato | farmacia; lote; UIfechamento; drafts | lote bloqueado sai outrosegue travafalse; farmacia erro bloqMedicofalse | PARCIAL | todos caminhos clínicos não testados; autorização artefato ADV006 faltante |
| INV-19 gate positivo+negativo | 9gates funções; kernel tests + mutation | _F05-MUTACAO:9bypasses detectados unitários; gaps G07/08/09/27 | PARCIAL | matriz possui SEM_TESTE normativos e consumers ausentes; onda não satisfaz universal |
| INV-20 negado AuditEvent | ledger/auditar; gateway auditar; SQLite triggers | ledger:N06/N04 auditmotivo; kernel payloadhash diferente auditNEGADA | PARCIAL | todos rejects HTTP auth/body geram evento? não demonstrado; appendonly conferido kernel/schema |
| INV-21 intenção≠finalidade | contratos enums4/5; rules/apac | apac intenção ignorada/finalidadeTumorLot herda; G12 não converte | COBERTO | escopo pure geração; formulário escolha humana completo não demonstrado |
| INV-22 APAC prescrição assinada | rules/apacGerar; Apac schema | apac:T27 sóASSINADO; dataGeracaoApphoje, referência versão | PARCIAL | assinatura material ledger confirmada na exportação não validada ADV006 |
| INV-23 interpolação≠observação | g14; series | kernel:G14 mistura bloqueia; preservado interpolado | PARCIAL | enforcement da persistência/render consumidor não demonstrado |
| INV-24 capability≠fact | enums separados; corpuscapabilities | corpus:AG15TESTED/AG20DISABLED/enum válido | PARCIAL | alertaSPECIFIED escondido precisa consumer/positivo/negativo; tipo isolado não basta |

## Mutação real já executada (F5)

Ver `docs/w5/achados/_F05-MUTACAO.md`: G02/G03/G05/G10/G13/G14/G23/G25/G26 semprePASSA em detached real @5e1093d. Cada teste unitário kernel respectivo ficou vermelho (exit1), logs222242/222245/222247/222250/222253/222256/222259/222302/222307-RED. Baseline23PASS log222235. Controle G25HTTP antigo1PASS log222304: não detecta mutação. Asserção unitária não estabelece consumer. Detached limpo removido. Outros gates não implementados como função: mutação NOT_RUN; nenhuma mutação nova é reivindicada neste mapa.

## Famílias / honestidade de alcance

R1/R2 (antes limpeza)14arquivos53testes: F1≥3, F2=3, F3=5, F4=4 PHI isolados, F5=9 mutações, F6=10 bordas/delta, F7=7 saídas/render, F8=7lote, F9=4scanner/hash, F10=3replay, F11=3comparações. Esses números são quantidade de ataques, não cobertura completa da família: F3 não é produto cartesiano de rota×método×sessão; F4 não é pipeline real da clínica; F9 sem varredura completa estados/fixtures/determinismo; F10 backup novo NOT_RUN, restauração máquina limpa/HD físico não executada; corte histórico e offsets R3 revelaram ADV018/019. R3:3preConsulta+6histórico/tempo (novos), logs231040-RED (1FAIL/2PASS) e231202-RED (2FAIL/4PASS); ADV017/018/019 S1 confirmados, donos DOMINIO/KERNEL, sem alegar3novos por todas11famílias. Min3 por família satisfez contagem acumulada, breadth original permanece PARCIAL. Zero FAIL após limpeza/promover não prova zero lacunas; negativos bloqueados continuam verdadeiros.

Contagem52IDs:7COBERTO /40PARCIAL /4SEM_TESTE /1FORA_DO_F0. Nenhuma etapa termina com A_AUDITAR; ausência de prova é explícita. As correções posteriores deverão atualizar evidência/estado sem eliminar estes limites.

## Verificação real da entrega RED (base700f3ee + testes novos)

Comando serial equivalente a verify: `npm run typecheck && npm run check:boundaries && npm run check:corpus && npx vitest run --no-file-parallelism`, lock RED. Log `_w5-locks/logs/20261005-231405-RED.log`:
```
fronteiras ok (80 arquivos)
corpus ok (20 arquivos)
Test Files 77 passed (77)
Tests 435 passed (435)
Duration 75.86s
EXIT_CODE=0
```
Regular exclui `tests/adv/`; portanto verde regular não contradiz os 3 S1 R3 confirmados, nem os10 negativos bloqueados/AMB. Foram preservadas expectativas e contratos. Últimos controles verdes antigos ainda presentes aguardam promoção KERNEL4f2fc0b e integração.
