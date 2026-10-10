import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(here, "..");
const PLAN = "docs/PLANO-FINAL-ONCOGLOBAL-v1.1.md";
const DECISIONS = "docs/DECISOES.md";
const MATRIX = "docs/MATRIZ-RASTREABILIDADE-F0.md";
const A6_HEAD = "72ce726e92bf059eb9bde394c0b070e9389fe85f";

const laterByDecision = new Map([
  ["Q47", ["F1", "PLANO-FINAL §R-22 curadoria e §F1 provider/agentes/telas; LLM real e edição de pack ficam fora de F0"]],
  ["D-W9-01", ["F3", "PLANO-FINAL §R-19 (salão F3); liberação justificada do núcleo é verificada em F0, break-glass de salão é F3"]],
  ["D-W9-15", ["F1", "PLANO-FINAL §F0 proíbe LLM real e §F1 autoriza provider real sob gates; D-W9-66 mantém chamada desligada até G-02/G-27"]],
  ["D-W9-65", ["F1", "PLANO-FINAL §F1 permite provider real somente no gateway; D-W9-66 mantém PDF/LLM desligados até G-02/G-27"]],
  ["D-W9-66", ["F1", "PLANO-FINAL §F1 + D-W9-66: exceção só após adapter/provider e gates; a F0 mantém a saída externa fechada"]],
  ["D-W9-22b", ["F3", "PLANO-FINAL §R-19 e §F3: identidade de esquema e contexto de ciclo são integração clínica de ciclo"]],
  ["D-W9-22d", ["F3", "PLANO-FINAL §R-19 (salão F3): alertas e fila de médico na jornada do salão"]],
  ["D-W9-22e", ["F4", "PLANO-FINAL §R-20: dutos de prescrição e APAC persistida separados"]],
  ["D-W9-22f", ["F1", "PLANO-FINAL §R-22: fontes externas/conhecimento com rótulo e gateway"]],
  ["D-W9-22i", ["F3", "PLANO-FINAL §R-22/R-28: fichas de protocolo só após curadoria médica, na faixa de ciclo"]],
  ["D-W9-34b", ["F3", "PLANO-FINAL §R-19: alertas de risco no contexto de ciclo/salão"]],
  ["D-W9-34c", ["F1", "PLANO-FINAL §R-18: pré-medicação em receita e consulta"]],
  ["D-W9-34d", ["F1+", "FECHAMENTO-F0 §0.8: questão clínica requer fonte/autoridade médica; fichas seguem RASCUNHO"]],
  ["D-W9-34e", ["F1", "PLANO-FINAL §R-18: documento clínico longitudinal e suporte a O2"]],
  ["D-W9-34f", ["F3", "PLANO-FINAL §R-19: prescrição de sintoma e jornada de salão"]],
  ["Q14", ["F1", "R-18, caixa universal e roteamento na consulta"]],
  ["Q15", ["F1", "R-18, voz e merge na consulta"]],
  ["Q16", ["F1", "R-18, ciclo de áudio da consulta"]],
  ["Q19", ["F1", "R-16, pré-consulta"]],
  ["Q20", ["F1", "R-17, bundles adicionais além da primeira consulta; E6b trata a jornada completa separadamente"]],
  ["Q36", ["F4", "R-22, ApacBatch operacional em lote"]],
  ["Q36", ["F4", "R-22, ApacBatch operacional em lote"]],
  ["Q37", ["F4", "R-22, canal da farmácia"]],
  ["Q38", ["F4", "R-22, chip de estoque"]],
  ["Q39", ["F1", "R-17, chat por paciente/setor"]],
  ["Q40", ["F6", "R-28, permissão multiusuário"]],
  ["Q41", ["F2", "R-21, canal paciente"]],
  ["Q42", ["F2", "R-21, canais de contato"]],
  ["Q43", ["F2", "R-21, respostas fixas e limites do canal"]],
  ["Q44", ["F2", "R-21, leitura e aviso de contato"]],
  ["Q48", ["F4", "R-23, laudo para judicialização"]],
  ["Q55", ["F6", "R-28, telas por setor"]],
  ["Q57", ["F6", "R-28, topologia multiusuário"]],
  ["Q59", ["F2", "R-21, canal WhatsApp"]],
  ["A5", ["F1", "R-18, áudio validado na consulta"]],
  ["A6", ["F1", "R-18, motor de voz"]],
  ["A8", ["F1", "R-18, importação da transcrição Plaud"]],
  ["A9", ["F1", "R-18, comando de voz"]],
  ["A10", ["F2", "R-21, exceção de canal WhatsApp"]],
  ["D-W5-03", ["F1", "R-17, cabeçalho configurável"]],
  ["D-W5-04", ["F1", "R-17, impressão pelo gateway"]],
  ["D-W5-05", ["F1", "R-17, documentos da consulta"]],
  ["D-W5-06", ["F4", "R-22, laudo APAC"]],
  ["D-W5-07", ["F1", "R-17, tela da consulta"]],
  ["D-W9-02", ["F1", "R-18, atalhos de validação/impressão na UI da consulta"]],
  ["D-W9-14", ["F1", "R-14/R-18, comando explícito de imprimir na UI; validar só prepara"]],
  ["D-W5-10", ["F4", "R-22, lote APAC"]],
  ["D-W9-19", ["F4", "R-22, APAC e antiglosa"]],
  ["D-W9-27", ["F4", "R-23/Q48, forma do resumo de trial para laudo judicial; trials fora da v1"]],
  ["D-W9-28", ["F2", "R-21, canal do paciente e red flags"]],
  ["D-W9-49", ["F4", "R-28 F4, catálogo de medicamentos/modelos de prescrição"]],
  ["D-W9-50", ["F4", "R-28 F3/F4, conteúdo de protocolo/dose/ciclo e templates não é runtime do núcleo F0"]],
  ["D-W9-59", ["F4", "R-28 F3/F4, fichas/protocolos permanecem RASCUNHO até revisão humana"]],
  ["D-W9-60", ["F3", "R-28 F3, limites de dose/ciclo no módulo de prescrição"]],
  ["D-W9-61", ["F3", "R-28 F3, escolhas do esquema e dose pertencem à prescrição/ciclo"]],
  ["D-W9-62", ["F3", "R-28 F3, fichas de protocolo e ciclo, sem ativação clínica automática"]],
  ["D-W9-11", ["F4", "R-28 F4 reserva importação e tabela SIGTAP; a fonte oficial fica [VERIFICAR] até existir pacote aprovado"]],
  ["D-W9-34d", ["F1", "PLANO-FINAL §F1/R-19; FECHAMENTO-F0 §0.8: questão clínica requer fonte/autoridade; ficha permanece RASCUNHO"]],
  ["D-W9-75", ["F2", "R-21 / FECHAMENTO-F0 §4: canal do paciente; o corpus deve permanecer RASCUNHO até curadoria"]],
  ["D-W9-75b", ["F2", "R-21 / FECHAMENTO-F0 §4: conteúdo curado do canal do paciente é F2"]],
  ["D-W9-42", ["F5", "R-28, prompt mestre/assistente longitudinal; núcleo do bot é F5"]],
  ["D-W9-44", ["F6", "R-28, módulo de estatística em F6; SQLite local continua coberto por Q05"]],
  ["D-W9-63", ["F1", "R-18, resposta RECIST; código/t testes existentes não significam UI entregue"]],
  ["D-W9-65", ["F1", "PLANO-FINAL §F0 proíbe LLM real; §F1 provider real fica sob D-W9-66, G-02 e G-27"]],
  ["D-W9-66", ["F1", "PLANO-FINAL §F0 sem LLM real; §F1 só liga a exceção após adapter e gates G-02/G-27"]],
  ["D-W9-23", ["F3", "R-18 prescrição versionada e R-28 F3 protocolo/dose/ciclo"]],
  ["D-W9-23a", ["F3", "R-28 F3 protocolo/dose/ciclo"]],
  ["D-W9-23c", ["F1", "R-18 documentação e receitas da consulta"]],
  ["D-W9-24", ["F1", "R-18 workflow de prescrição e documentos"]],
  ["D-W9-29", ["F1", "R-18 receitas e retorno na consulta"]],
  ["D-W9-32", ["F1", "R-18 layout da receita de QT"]],
  ["D-W9-34c", ["F1", "R-18 pré-medicação em receita e consulta"]],
  ["D-W9-35", ["F1", "R-17, OncoChart como UI-alvo"]],
  ["D-W9-45", ["F1", "R-18 prescrição a partir de protocolo versionado"]],
  ["D-W9-46", ["F2", "R-21, porta do paciente"]],
  ["D-W9-48", ["F4", "R-23, laudo judicial"]],
  ["D-W9-69", ["F1", "R-19, extração RADS e léxico"]],
  ["D-W9-70", ["F1", "R-19, evidência RADS candidata"]],
  ["D-W9-79", ["F4", "R-23, documento judicial"]],
]);
const decisionOwner = new Map([
  ["Q05", { file: "src/kernel/ledger/db.ts", symbol: "abrirLedger" }],
  ["A3", { file: "src/kernel/extracao/reconciliacao.ts", symbol: "reconciliarCampos" }],
  ["Q06", { file: "src/contracts/operacao.ts", symbol: "ConfirmarBloco" }],
  ["Q08", { file: "src/app/oncoassist.ts", symbol: "criarOncoassistJev" }],
  ["Q11", { file: "src/orchestration/maestro.ts", symbol: "maestro" }],
  ["Q46", { file: "src/kernel/corpus/loader.ts", symbol: "validarRuleset" }],
  ["Q47", { file: "src/app/oncoassist.ts", symbol: "criarOncoassistJev" }],
  ["Q56", { file: "src/rules/intervaloQt.ts", symbol: "ultimaAdministracaoQtEfetiva" }],
  ["Q17", { file: "src/ui/consulta/BarraFechamento.tsx", symbol: "BarraFechamento" }],
  ["Q18", { file: "src/ui/consulta/BarraFechamento.tsx", symbol: "BarraFechamento" }],
  ["Q20", { file: "src/modules/consulta/bundles.ts", symbol: "montarBundle" }],
  ["T-41", { file: "src/rules/identidade.ts", symbol: "resolverIdentidade" }],
  ["G-06", { file: "src/modules/documentos/destaqueE1.ts", symbol: "g06E1Destaque" }],
  ["T-48", { file: "src/modules/documentos/destaqueE1.ts", symbol: "g06E1Destaque" }],
  ["G-22", { file: "src/kernel/harness/capabilityStatus.ts", symbol: "decidirFonteAlertaPorCapabilityStatus" }],
  ["T-61", { file: "src/kernel/harness/capabilityStatus.ts", symbol: "decidirFonteAlertaPorCapabilityStatus" }],
  ["D-W9-08", { file: "src/rules/w8/patologiaSitio.ts", symbol: "agregarCaso" }],
  ["Q09", { file: "src/contracts/estados.ts", symbol: "Revisao" }],
  ["A11", { file: "scripts/backup.mjs", symbol: "criarBackup" }],
  ["A4", { file: "src/rules/intervaloQt.ts", symbol: "ultimaAdministracaoQtEfetiva" }],
  ["D-W9-17", { file: "src/contracts/w10/clinico-w10.ts", symbol: "CaixaNumerada" }],
  ["D-W9-18", { file: "src/leitura/caixa-unica.ts", symbol: "converterEntradaLocalAsync" }],
  ["D-W9-58", { file: "src/leitura/caixa-unica.ts", symbol: "converterEntradaLocalAsync" }],
  ["D-W5-01", { file: "src/kernel/extracao/normalizacao.ts", symbol: "dataCivilDoInstante" }],
  ["D-W5-02", { file: "src/modules/apac/emissao.ts", symbol: "avaliarAdiantamento" }],
  ["D-W5-08", { file: "src/server/autorizacao.ts", symbol: "autorizarSaida" }],
  ["D-W8-01", { file: "src/kernel/extracao/deduplicacao.ts", symbol: "deduplicarFatos" }],
  ["D-W9-04", { file: "src/impressao/kit.ts", symbol: "renderizarKit" }],
  ["D-W9-05", { file: "src/kernel/harness/gates.ts", symbol: "g07Lateralidade" }],
  ["D-W9-09", { file: "src/leitura/caixa-unica.ts", symbol: "converterEntradaLocal" }],
  ["D-W9-16", { file: "src/config/settings.ts", symbol: "createSettingsService" }],
  ["D-W9-17", { file: "src/config/settings.ts", symbol: "createSettingsService" }],
  ["D-W9-10", { file: "src/modules/apac/emissao.ts", symbol: "avaliarCnes" }],
  ["D-W9-15", { file: "src/server/autorizacao.ts", symbol: "autorizarSaida" }],
  ["D-W9-12", { file: "src/modules/apac/emissao.ts", symbol: "classificarFinalidade" }],
  ["D-W9-41", { file: "src/impressao/kit.ts", symbol: "renderizarKit" }],
  ["D-W9-68", { file: "src/rules/radsEmergencias.ts", symbol: "detectarEmergencias" }],
  ["T-53", { file: "src/rules/apac.ts", symbol: "validarEmissaoApac" }],
  ["G-15", { file: "src/orchestration/ork.ts", symbol: "executarOrk" }],
  ["D-W9-13", { file: "src/rules/cns.ts", symbol: "validarCns" }],
  ["D-W9-26", { file: "src/contracts/w10/prescricao.ts", symbol: "PrescriptionItem" }],
  ["D-W9-31", { file: "src/rules/noduloIndeterminado.ts", symbol: "avaliarNodulo" }],
  ["D-W9-33", { file: "src/orchestration/pipeline-extracao.ts", symbol: "executarPipelineExtracao" }],
  ["D-W9-38", { file: "src/kernel/extracao/normalizacao.ts", symbol: "ehFebre" }],
  ["D-W9-39", { file: "src/rules/agendaQt.ts", symbol: "validarAgenda" }],
  ["D-W9-43", { file: "src/rules/intervalProgression.ts", symbol: "intervalProgression" }],
  ["D-W9-47", { file: "src/contracts/w10/prescricao.ts", symbol: "ClasseMedicacao" }],
  ["D-W9-51", { file: "src/rules/radsEmergencias.ts", symbol: "detectarEmergencias" }],
  ["D-W9-52", { file: "src/rules/morfometria/index.ts", symbol: "medirLesao" }],
  ["D-W9-57", { file: "src/rules/morfometria/index.ts", symbol: "medirLesao" }],
  ["D-W9-67", { file: "src/rules/kitTumorLot.ts", symbol: "completudeKitTumorLot" }],
  ["D-W9-73", { file: "src/rules/ctcaeGrau.ts", symbol: "avaliarCtcaeGrau" }],
  ["D-W9-74", { file: "src/contracts/clinico.ts", symbol: "Triagem" }],
  ["D-W9-75", { file: "src/rules/index.ts", symbol: "avaliarTextoCtcae" }],
  ["D-W9-75a", { file: "src/rules/index.ts", symbol: "avaliarTextoCtcae" }],
  ["D-W9-75b", { file: "src/rules/canalRedflags.ts", symbol: "avaliarCanalRedflags" }],
  ["D-W9-76", { file: "src/rules/tontura.ts", symbol: "alertarVertigemNova" }],
  ["D-W9-77", { file: "src/ui/consulta/ConsultaPersistida.tsx", symbol: "ConsultaPersistida" }],
  ["D-W9-78", { file: "src/ui/consulta/ConsultaPersistida.tsx", symbol: "ConsultaPersistida" }],
  ["D-W9-11", { file: "src/apac/sigtap.ts", symbol: "montarTabelaSigtap" }],
  ["D-W9-34d", { file: "src/contracts/w10/prescricao.ts", symbol: "ProtocolTemplate" }],
  ["D-W9-77d", { file: "src/rules/semaforoInteracoes.ts", symbol: "semaforoInteracoes" }],
  ["D-W9-22", { file: "src/rules/portaCiclo.ts", symbol: "portaCiclo" }],
  ["D-W9-22a", { file: "src/rules/portaCiclo.ts", symbol: "portaCiclo" }],
  ["D-W9-22c", { file: "src/kernel/extracao/reconciliacao.ts", symbol: "reconciliarCampos" }],
  ["D-W9-22g", { file: "src/rules/triagem.ts", symbol: "avaliarCorteSalao" }],
  ["D-W9-34a", { file: "src/kernel/extracao/patient-resolver.ts", symbol: "rankearPacientes" }],
]);
const consumerOverride = new Map([
  ["Q05", "src/app/oncoassistLocal.ts"],
  ["Q06", "src/server/rotas.ts"],
  ["Q08", "src/app/oncoassistLocal.ts"],
  ["Q11", "src/orchestration/ork.ts"],
  ["Q17", "src/ui/telas/TelaConsulta.tsx"],
  ["Q18", "src/ui/telas/TelaConsulta.tsx"],
  ["G-06", "src/impressao/kit.ts"],
  ["T-48", "src/impressao/kit.ts"],
  ["G-22", "src/kernel/harness/gates.ts"],
  ["T-61", "src/kernel/harness/gates.ts"],
  ["D-W9-08", "tests/rules-w8/patologiaSitio.test.ts"],
  ["G-18", "tests/modules/adv015-template.test.ts"],
  ["T-58", "tests/modules/adv015-template.test.ts"],
  ["D-W9-08", "tests/rules-w8/patologiaSitio.test.ts"],
  ["G-09", "src/server/rotas.ts"],
  ["G-19", "src/server/rotas.ts"],
  ["G-20", "src/app/oncoassistLocal.ts"],
  ["G-01", "src/kernel/identity/filaVinculo.ts"],
  ["T-41", "src/kernel/identity/filaVinculo.ts"],
  ["G-16", "src/kernel/harness/gates.ts"],
  ["G-17", "tests/corpus/loader.test.ts"],
  ["Q46", "tests/corpus/packs.test.ts"],
  ["Q47", "PENDENTE: sem consumer de produção de revisão da proposta"],
  ["Q56", "tests/cobertura/fuso.test.ts"],
  ["D-W9-11", "tests/apac-w10/cns-sigtap.test.ts"],
  ["D-W9-34d", "tests/corpus-fichas/fichas.test.ts"],
  ["A4", "tests/cobertura/fuso.test.ts"],
  ["D-W9-17", "src/server/corpus.ts"],
  ["D-W9-18", "tests/leitura/pdf-digital.test.ts"],
  ["D-W9-47", "src/rules/semaforoInteracoes.ts"],
  ["D-W9-57", "tests/rules-morfometria/index.test.ts"],
  ["D-W9-58", "src/orchestration/pipeline-extracao.ts"],
  ["Q09", "tests/contracts/dimensoes-limite.test.ts"],
  ["A11", "tests/backup/backup.test.ts"],
  ["A4", "tests/cobertura/fuso.test.ts"],
  ["D-W9-17", "src/server/corpus.ts"],
  ["D-W9-18", "tests/redteam/rt13-caixa-unica.test.ts"],
  ["D-W9-58", "src/orchestration/pipeline-extracao.ts"],
  ["D-W5-01", "tests/kernel/extracao/normalizacao.test.ts"],
  ["D-W5-02", "tests/w10-grok/grok-13-apac-snapshot.test.ts"],
  ["D-W5-08", "src/server/rotas.ts"],
  ["D-W8-01", "src/orchestration/pipeline-extracao.ts"],
  ["D-W9-04", "tests/impressao/kit-apac.test.ts"],
  ["D-W9-05", "tests/kernel/gates-w10/g07-lateralidade.test.ts"],
  ["D-W9-09", "tests/leitura/pdf-digital.test.ts"],
  ["D-W9-16", "src/server/http.ts"],
  ["D-W9-17", "src/server/http.ts"],
  ["D-W9-10", "tests/w10-grok/grok-13-apac-snapshot.test.ts"],
  ["D-W9-12", "tests/w10-grok/grok-13-apac-snapshot.test.ts"],
  ["D-W9-58", "tests/leitura/pdf-digital.test.ts"],
  ["D-W9-68", "src/server/rotas.ts"],
  ["D-W9-15", "src/server/rotas.ts"],
  ["A3", "tests/kernel/extracao/reconciliacao.test.ts"],
  ["D-W9-22a", "tests/w12-grok/grok-02-corpo.test.ts"],
  ["D-W9-22c", "src/orchestration/pipeline-extracao.ts"],
  ["D-W9-22g", "tests/w12-grok/grok-02-corpo.test.ts"],
  ["D-W9-34a", "src/orchestration/pipeline-extracao.ts"],
  ["G-15", "tests/orchestration/ork.test.ts"],
  ["T-53", "tests/apac/apac.test.ts"],
  ["D-W9-13", "src/apac/antiglosa.ts"],
  ["D-W9-26", "tests/contracts/w10.test.ts"],
  ["D-W9-31", "tests/w10-grok/grok-07-nodulo.test.ts"],
  ["D-W9-33", "tests/w10-fugu/e2e-pt10.test.ts"],
  ["D-W9-38", "tests/kernel/extracao/normalizacao.test.ts"],
  ["D-W9-39", "tests/w10-grok/grok-04-agenda.test.ts"],
  ["D-W9-43", "tests/w10-grok/grok-06-interval.test.ts"],
  ["D-W9-47", "tests/contracts/w10.test.ts"],
  ["D-W9-51", "tests/w10-grok/grok-05-rads.test.ts"],
  ["D-W9-57", "tests/rules-morfometria/index.test.ts"],
  ["D-W9-67", "tests/corpus/prostata-w8.test.ts"],
  ["D-W9-73", "tests/w3/w3.test.ts"],
  ["D-W9-74", "tests/ui/triagem.test.tsx"],
  ["D-W9-75", "tests/w12-grok/grok-04-texto.test.ts"],
  ["D-W9-76", "tests/w12-grok/grok-06-tontura.test.ts"],
  ["D-W9-77", "src/ui/OncoassistLocal.tsx"],
  ["D-W9-78", "src/ui/OncoassistLocal.tsx"],
  ["D-W9-75a", "tests/w12-grok/grok-04-texto.test.ts"],
  ["D-W9-75b", "tests/w12-grok/grok-08-canal.test.ts"],
  ["D-W9-77d", "tests/w10-grok/grok-08-semaforo.test.ts"],
  ["D-W9-22", "tests/w12-grok/grok-02-corpo.test.ts"],
  ["D-W9-77d", "tests/w10-grok/grok-08-semaforo.test.ts"],
  ["D-W9-22", "tests/w12-grok/grok-02-corpo.test.ts"],
  ["G-18", "tests/modules/adv015-template.test.ts"],
  ["T-58", "tests/modules/adv015-template.test.ts"],
  ["D-W9-17", "tests/f0-fecha/flash-producao.test.tsx"],
  ["D-W9-18", "tests/redteam/rt13-caixa-unica.test.ts"],
  ["D-W9-58", "tests/w10-fugu/e2e-pt10.test.ts"],
  ["D-W9-10", "tests/w10-grok/grok-13-apac-snapshot.test.ts"],
  ["D-W9-12", "tests/w10-grok/grok-13-apac-snapshot.test.ts"],
  ["D-W9-58", "tests/leitura/pdf-digital.test.ts"],
  ["D-W9-68", "src/server/rotas.ts"],
  ["G-15", "tests/orchestration/ork.test.ts"],
  ["T-53", "tests/apac/apac.test.ts"],
  ["Q11", "tests/orchestration/ork.test.ts"],
  ["D-W5-01", "tests/kernel/extracao/normalizacao.test.ts"],
  ["D-W5-02", "tests/w10-grok/grok-13-apac-snapshot.test.ts"],
  ["D-W9-04", "tests/impressao/kit-apac.test.ts"],
  ["D-W9-09", "tests/leitura/pdf-digital.test.ts"],
  ["D-W9-26", "tests/contracts/w10.test.ts"],
  ["D-W9-31", "tests/w10-grok/grok-07-nodulo.test.ts"],
  ["D-W9-33", "tests/w10-fugu/e2e-pt10.test.ts"],
  ["D-W9-38", "tests/kernel/extracao/normalizacao.test.ts"],
  ["D-W9-39", "tests/w10-grok/grok-04-agenda.test.ts"],
  ["D-W9-43", "tests/w10-grok/grok-06-interval.test.ts"],
  ["D-W9-47", "src/rules/semaforoInteracoes.ts"],
  ["D-W9-57", "tests/rules-morfometria/index.test.ts"],
  ["D-W9-67", "tests/corpus/prostata-w8.test.ts"],
  ["D-W9-73", "tests/w3/w3.test.ts"],
  ["D-W9-74", "tests/ui/triagem.test.tsx"],
  ["D-W9-75", "tests/w12-grok/grok-08-canal.test.ts"],
  ["D-W9-76", "tests/w12-grok/grok-06-tontura.test.ts"],
  ["D-W9-77", "src/ui/OncoassistLocal.tsx"],
  ["D-W9-78", "src/ui/OncoassistLocal.tsx"],
  ["D-W9-16", "src/server/http.ts"],
  ["D-W9-17", "src/server/http.ts"],
  ["A3", "tests/kernel/extracao/reconciliacao.test.ts"],
  ["D-W9-22a", "tests/w12-grok/grok-02-corpo.test.ts"],
  ["D-W9-22c", "src/orchestration/pipeline-extracao.ts"],
  ["D-W9-22g", "tests/w12-grok/grok-02-corpo.test.ts"],
  ["D-W9-34a", "src/orchestration/pipeline-extracao.ts"],
  ["G-03", "tests/kernel/kernel.test.ts"], ["G-05", "tests/kernel/kernel.test.ts"],
  ["G-10", "tests/kernel/kernel.test.ts"], ["G-13", "tests/kernel/kernel.test.ts"],
  ["G-14", "tests/kernel/kernel.test.ts"],
  ["G-11", "tests/apac/apac.test.ts"], ["G-12", "tests/apac/apac.test.ts"],
  ["G-17", "tests/corpus/loader.test.ts"],
  ["T-45", "tests/kernel/kernel.test.ts"], ["T-47", "tests/kernel/kernel.test.ts"],
  ["T-52", "tests/kernel/kernel.test.ts"], ["T-54", "tests/kernel/kernel.test.ts"],
  ["T-55", "tests/kernel/kernel.test.ts"], ["T-57", "tests/corpus/loader.test.ts"],
]);
const organizationalChecks = new Map([
  ["D-W9-22h", "confirmar docs/referencias/protocolos/*.md como fonte de verdade e registrar o limite do DOCX em DECISOES.md D-W9-22(h)"],
  ["Q01", "confirmar origin remoto e raiz OncoGlobal segundo docs/FECHAMENTO-F0.md §0"],
  ["Q02", "conferir autoria e writer em docs/ondas/F0-FECHAMENTO-ASTRA.md §2"],
  ["Q03", "confirmar CANONICA somente por ordem expressa em docs/FECHAMENTO-F0.md §2"],
  ["Q04", "conferir precedência de autoridade em docs/DECISOES.md Q04 e governança da missão"],
  ["Q07", "conferir decisão de stack em docs/DECISOES.md Q07 e stack do projeto"],
  ["Q12", "conferir fronteira documental BRAIN_OS em docs/DECISOES.md Q12 e PLANO R-28"],
  ["Q49", "conferir roadmap e fases em docs/DECISOES.md Q49 e PLANO R-28"],
  ["Q51", "conferir roster e faixa em docs/ondas/F0-FECHAMENTO-ASTRA.md §7"],
  ["Q53", "conferir nomenclatura de fases e legados superados em docs/DECISOES.md Q53"],
  ["Q54", "conferir fronteira de projetos em docs/DECISOES.md Q54 e D-W9-72"],
  ["D-W9-20", "conferir princípio código/regras versus conhecimento RAG em docs/DECISOES.md D-W9-20"],
  ["D-W9-21", "conferir a referência de intake e seu uso documental em docs/DECISOES.md D-W9-21"],
  ["D-W9-25", "conferir regra de curadoria e fonte pública em docs/DECISOES.md D-W9-25"],
  ["D-W9-30", "conferir modelos adotados e suas fontes documentais em docs/DECISOES.md D-W9-30"],
  ["D-W9-36", "conferir as referências de desenho e modelo em docs/DECISOES.md D-W9-36"],
  ["D-W9-40", "conferir referência visual aprovada e escopo de UI em docs/DECISOES.md D-W9-40"],
  ["D-W9-53", "conferir que a pasta citada é inventário de referência, não dado importado no runtime"],
  ["D-W9-54", "conferir roster histórico W10 e supersessão da missão atual D-W9-80"],
  ["D-W9-55", "conferir arquitetura documental e seus limites/gaps registrados em docs/specs/ARQUITETURA-ECOSSISTEMA.md"],
  ["D-W9-56", "conferir registro da atualização CANONICA autorizada em docs/DECISOES.md D-W9-56"],
  ["D-W9-64", "conferir status PROPOSTA e escolha pendente; não implementar como decisão aprovada"],
  ["D-W9-71", "conferir registro do documento WORK e conflitos declarados em docs/DECISOES.md D-W9-71"],
  ["D-W9-72", "conferir mapa de nomes do território em docs/DECISOES.md D-W9-72"],
  ["D-W9-80", "conferir autoridade, writer e etapas do fechamento em docs/DECISOES.md D-W9-80"],
]);
const multiTestEvidence = new Map([
  ["Q46", [
    ["tests/corpus/packs.test.ts", "estrutura TumorPack: pulmão/mama/colorretal vazios; próstata com kit D-W9-67"],
    ["tests/corpus/packs.test.ts", "nenhum campo dose numérico em nenhum pack (LLM/FN-04 calcula; corpus não carrega dose)"],
    ["tests/corpus/packs.test.ts", "nenhum código SIGTAP além de [VERIFICAR]"],
  ]],
  ["D-W9-16", [
    ["tests/w10-luna5/http-config-real.test.ts", "carrega o corpus compartilhado, nega leitura sem sessão e retorna o tema DIA por default"],
    ["tests/w10-luna5/http-config-real.test.ts", "reabre o SQLite local ao reiniciar o servidor e recupera perfil, caixa e trilha"],
  ]],
  ["D-W9-17", [
    ["tests/w10-luna5/http-config-real.test.ts", "grava CNES como texto com zeros, atribui a sessão e replay não duplica histórico nem vaza valores em logs"],
    ["tests/w10-luna5/http-config-real.test.ts", "reabre o SQLite local ao reiniciar o servidor e recupera perfil, caixa e trilha"],
  ]],
  ["D-W9-18", [
    ["tests/leitura/pdf-digital.test.ts", "extrai o texto por página com hash dos bytes, sem rede"],
    ["tests/leitura/pdf-digital.test.ts", "texto e DOCX seguem pelo caminho síncrono quando chamados pelo assíncrono"],
    ["tests/leitura/pdf-digital.test.ts", "PDF escaneado e imagem continuam PENDENTE (D-W9-09) e delegam no caminho assíncrono"],
  ]],
  ["A3", [
    ["tests/kernel/extracao/reconciliacao.test.ts", "TNM incompatível no mesmo tipo de avaliação é CONFLICT; tipos diferentes coexistem (A3)"],
  ]],
  ["D-W9-22a", [
    ["tests/w12-grok/grok-02-corpo.test.ts", "neutrófilos 1499 ficam abaixo da bula 1500; 1500 passa; grau não abre a porta"],
  ]],
  ["D-W9-22c", [
    ["tests/f0-fecha/consulta-completa.test.ts", "mantém duas fontes contraditórias como CONFLITO e sem eleição automática antes de decisão"],
  ]],
  ["D-W9-22g", [
    ["tests/w12-grok/grok-02-corpo.test.ts", "FC 49 corta o salão e não a triagem do ciclo; PAS 150 faz o inverso"],
  ]],
  ["D-W9-34a", [
    ["tests/f0-fecha/consulta-completa.test.ts", "percorre kit sintético, vínculo explícito, evolução exibida e Flash assinada; reabre o SQLite e preserva a história"],
  ]],
  ["D-W9-47", [
    ["tests/w10-grok/grok-09-suporte.test.ts", "os limiares e a classe vêm do ruleset"],
    ["tests/w12-grok/grok-05-retorno.test.ts", "diarreia acima de 24 h com HAS alerta suspender; 24 h exato não alerta"],
    ["tests/w10-grok/grok-08-semaforo.test.ts", "sem interação só com checagem completa e ruleset ativo, sem par casado"],
  ]],
  ["D-W9-17", [
    ["tests/w10-cursor/config.test.tsx", "abre DIA|NOITE|PERSONALIZAR, caixa de número e glossário"],
    ["tests/f0-fecha/flash-producao.test.tsx", "Configurações lê e grava o modelo pela porta autenticada, sem persistência em estado local"],
  ]],
  ["D-W9-68", [
    ["tests/w10-grok/grok-05-rads.test.ts", "o catálogo tem as 31 linhas e a negação declarada"],
    ["tests/w10-grok/grok-05-rads.test.ts", "exclusões anulam imuno quando há infecção; tiflite exige neutropenia e exclui pneumoperitônio"],
    ["tests/muse/rads-http.test.ts", "HTTP usa as cadeias RADS do corpus, preserva trecho/fonte e não confirma emergência"],
  ]],
  ["G-04", [
    ["tests/prompts/prompts.test.ts", "G-04 cada prompt repete contrato universal sem números de corte clínico"],
    ["tests/prompts/prompts.test.ts", "G-04 nenhum arquivo em corpus/prompts tem número de corte ou comparação com limiar"],
  ]],
  ["Q06", [
    ["tests/contracts/contratos.test.ts", "C-16 ConfirmarBloco (INV-04, A1, K-04)"],
    ["tests/ui-telas/api.test.ts", "confirmar e acao passam no contrato e não carregam medicoId"],
  ]],
  ["Q08", [
    ["tests/oncoassist-jev/oncoassist.test.ts", "envia só texto desidentificado e devolve proposta com hash do original"],
    ["tests/oncoassist-jev/oncoassist.test.ts", "barra PHI conhecido que permanece após a primeira desidentificação"],
  ]],
  ["Q11", [
    ["tests/orchestration/ork.test.ts", "Maestro só oferece tabela fixa sem impressão no validar"],
    ["tests/orchestration/ork.test.ts", "retry só error, missing não tenta; dependência falha vira unattempted"],
  ]],
  ["D-W9-75", [
    ["tests/w12-grok/grok-04-texto.test.ts", "vômito com observação hospitalar sugere G3 e mostra as duas leituras da quantidade"],
    ["tests/w12-grok/grok-08-canal.test.ts", "versão 1.1.0, 25 sinais em RASCUNHO e os 6 candidatos antigos continuam inativos"],
  ]],
  ["Q50", [
    ["tests/f0-fecha/consulta-completa.test.ts", "percorre kit sintético, vínculo explícito, evolução exibida e Flash assinada; reabre o SQLite e preserva a história"],
    ["tests/f0-fecha/consulta-completa.test.ts", "mantém duas fontes contraditórias como CONFLITO e sem eleição automática antes de decisão"],
    ["tests/f0-fecha/consulta-completa.test.ts", "preserva negação literal, data e unidade; ausência continua sem fato numérico inventado"],
    ["tests/f0-fecha/consulta-completa.test.ts", "repete após falha percebida pelo cliente sem duplicar o evento nem a evolução"],
    ["tests/f0-fecha/consulta-completa.test.ts", "recusa paciente trocado e conteúdo editado depois da exibição"],
    ["tests/f0-fecha/consulta-completa.test.ts", "conclui revisão e Flash manualmente com o caminho de IA ausente"],
  ]],
  ["D-W9-77", [
    ["tests/f0-fecha/retrato-ledger.test.ts", "copia histologia literal de AP com fonte e mantém os demais campos ausentes, salvo TNM literal prefixado"],
    ["tests/f0-fecha/c2-consulta-local.test.tsx", "exibe textos reais, assina por HTTP e reabre o histórico persistido sem dados de demonstração"],
    ["tests/f0-fecha/consulta-completa.test.ts", "percorre kit sintético, vínculo explícito, evolução exibida e Flash assinada; reabre o SQLite e preserva a história"],
  ]],
  ["D-W9-78", [
    ["tests/f0-fecha/flash-producao.test.tsx", "a caixa do modelo padrão existe no catálogo com o tipo REGRA_CLINICA suportado"],
    ["tests/f0-fecha/c2-consulta-local.test.tsx", "exibe textos reais, assina por HTTP e reabre o histórico persistido sem dados de demonstração"],
    ["tests/f0-fecha/c2-flash-retomada.test.ts", "retoma após reiniciar SQLite e sessão com nova chave sem duplicar preparação ou assinatura"],
    ["tests/f0-fecha/consulta-completa.test.ts", "percorre kit sintético, vínculo explícito, evolução exibida e Flash assinada; reabre o SQLite e preserva a história"],
  ]],
  ["D-W9-74", [
    ["tests/contracts/w12-regras-clinicas.test.ts", "representa histórico e início da vertigem desconhecidos como null"],
    ["tests/ui/triagem.test.tsx", "tontura nasce como não sei (null) e permite sim e não"],
    ["tests/w12-grok/grok-06-tontura.test.ts", "tontura null → PENDENTE na fila, nunca ausência"],
  ]],
  ["T-59", [
    ["tests/server/cp001-autorizacao.test.ts", "CP-001 · positivo: artefato ASSINADO do mesmo paciente/encontro/versão autoriza IMPRIMIR"],
    ["tests/kernel/kernel.test.ts", "sem sessão, sessão expirada ou intent incompleto ⇒ NO_ACTION/negado, sem efeito"],
  ]],
]);
const mappingPending = new Map([
  ["Q20", "os quatro bundles estão declarados e testados no módulo, mas nenhum consumidor de produção chama montarBundle no checkout"],
  ["Q50", "E6b HTTP/SQLite está integrada e passou 8/8; a condição normativa de Q50 ainda exige PR revisado e demo da fase (PLANO-FINAL §5), não entregues por esta faixa"],
  ["D-W9-14", "impressão usa a ação do servidor/gateway; não há prova observável de escolha/abertura da janela do sistema no percurso local real"],
  ["D-W9-50", "fichas e testes registram comparações SOnHe; dose sem fonte mantém [VERIFICAR], sem extrapolar aprovação clínica geral"],
  ["D-W9-55", "arquitetura e mapa de componentes estão documentados; model router multi-LLM, READ externo e agentes não são alegados como runtime F0"],
  ["D-W9-59", "fichas têm conteúdo e testes estruturais; a confirmação de cada dose protocolar continua limitada às fontes e itens [VERIFICAR] registrados"],
  ["D-W9-60", "limite Calvert está no código/testes, mas a conferência do contexto clínico completo deve ocorrer na faixa de prescrição"],
  ["D-W9-61", "respostas de dose estão registradas em fichas; não transformar notas [VERIFICAR] em protocolo universal ativo"],
  ["D-W9-62", "fichas e testes estruturais existem; notas sem fonte/finalização clínica continuam PENDENTE e não foram promovidas"],
  ["D-W9-64", "proposta aguardando escolha do Dr. Silas; não é requisito de implementação aprovado"],
  ["D-W9-65", "extração de PDF via LLM não está habilitada; D-W9-66 condiciona a ativação a provider, desidentificação e gates"],
  ["D-W9-66", "a exceção é autorizada sob condições, mas a LLM segue desligada até provider e gates; a prova é de contenção"],
]);
const residualClass = new Map();
const proofByDecision = new Map([
  ["Q46", "F0 estrutura/guard provados em tests/corpus/packs.test.ts: quatro packs incompletos carregam com protocolos inativos e SIGTAP [VERIFICAR]; curadoria clínica continua pendente"],
  ["A3", "contrato/projeção F0 e teste provam avaliações TNM distintas coexistem e conflito do mesmo tipo não é eleito; UI de seleção é F1/F4"],
  ["D-W9-16", "tests/w10-luna5/http-config-real.test.ts prova API local autenticada, perfil, histórico e replay; tela completa é F1"],
  ["D-W9-17", "HTTP real salva caixa versionada e reabre SQLite; editor/glossário completo da tela pertence a F1"],
  ["D-W9-18", "PDF digital, DOCX e texto têm conversão local pura testada; a caixa multimodal/roteamento na UI completa fica em F1"],
  ["D-W9-22a", "porta pura usa limiar de bula, nunca grau CTCAE; teste de neutrófilos inclui borda 1499/1500"],
  ["D-W9-22c", "reconciliação/exibição E6b preserva conflitos sem eleição automática antes da revisão humana"],
  ["D-W9-22g", "teste de regras prova distinção entre triagem do ciclo e corte do salão; nenhum runtime de salão é alegado em F0"],
  ["D-W9-34a", "pipeline/E6b mantém vínculo explícito e não faz junção automática de paciente"],
  ["D-W9-47", "classe é consumida em suporte, retorno e semáforo F0 com testes comportamentais; catálogo longitudinal/UI completa fica F1/F3"],
  ["D-W9-15", "F0 mantém o caminho externo fechado; provider real OpenAI/Responses é F1 segundo PLANO-FINAL §F1 e D-W9-66"],
  ["D-W9-41", "tests/f0-fecha/d41-fonte.test.ts verifica redação corrigida, frase original do PDF e preservação da proveniência no renderizador"],
  ["D-W9-74", "prova L3 C2 em `docs/f0-fecha/LUNA-3.md` e `evidencias/luna3/` (contrato, FormTriagem e regras W12)"],
  ["D-W9-08", "prova negativa A6: `agregarCaso` retorna PENDENTE com ruleset inativo; nenhum critério clínico foi promovido"],
  ["Q09", "prova C2 em `docs/f0-fecha/C2-L4-G22.md`: teste cobre dimensões D1-D11, teto de cinco e as quatro famílias de classificação"],
  ["G-22", "prova C2 em `docs/f0-fecha/C2-L4-G22.md`: estados TESTED/VALIDATED/OPERATING positivos; SPECIFIED/DISABLED/ausente/desconhecido ocultos"],
  ["T-61", "prova C2 em `docs/f0-fecha/C2-L4-G22.md`: status da capacidade fora da allowlist não aparece como fonte de alerta"],
  ["G-06", "prova C2 em `docs/f0-fecha/C2-L4-E1.md`: renderer real bloqueia folha operacional sem destaque e preserva evolução; upstream de salão é limite documentado"],
  ["T-48", "prova C2 em `docs/f0-fecha/C2-L4-E1.md`: positivo/negativo do destaque E1 no renderer, sem bloquear a tela"],
  ["D-W9-77", "prova C2 em `docs/f0-fecha/C2-L4-CARTAO.md` e `evidencias/C2-retomada-15.log`: projeção real + UI local; sem alegação de decisão clínica"],
  ["D-W9-78", "prova C2 em `evidencias/C2-retomada-15.log`: 7 arquivos/50 testes para reinício SQLite, sessão, replay e UI Flash real"],
]);

const linkedEvidence = new Map([
  ["Q05", ["abrirLedger"]], ["Q11", ["maestro"]],
  ["Q21", ["FN-01"]], ["Q22", ["FN-01"]], ["Q23", ["FN-05"]],
  ["Q24", ["FN-06"]], ["Q25", ["FN-06"]], ["Q26", ["FN-02", "FN-03"]],
  ["Q27", ["FN-01"]], ["Q28", ["FN-09"]], ["Q29", ["FN-04"]],
  ["Q30", ["FN-04"]], ["Q31", ["FN-04"]], ["Q32", ["FN-09"]],
  ["Q33", ["FN-10"]], ["Q34", ["FN-12"]], ["Q35", ["FN-12"]],
  ["Q36", ["FN-10"]], ["Q45", ["FN-17"]], ["Q52", ["FN-24", "G-02"]],
  ["A1", ["G-25"]], ["A2", ["FN-06"]], ["A7", ["FN-01"]],
]);

const fnSource = new Map([
  ["FN-01", "src/rules/triagem.ts"], ["FN-02", "src/rules/destino.ts"],
  ["FN-03", "src/rules/fila.ts"], ["FN-04", "src/rules/dose.ts"],
  ["FN-05", "src/rules/triagem.ts"], ["FN-06", "src/rules/peso.ts"],
  ["FN-07", "src/rules/prazos.ts"], ["FN-08", "src/rules/concomitancia.ts"],
  ["FN-09", "src/rules/cicloComMedico.ts"], ["FN-10", "src/rules/apac.ts"],
  ["FN-11", "src/rules/apac.ts"], ["FN-12", "src/rules/apac.ts"],
  ["FN-13", "src/rules/apac.ts"], ["FN-14", "src/rules/delta.ts"],
  ["FN-16", "src/rules/semaforoInteracoes.ts"], ["FN-17", "src/rules/ctcaeGrau.ts"],
  ["FN-18", "src/rules/recist/index.ts"], ["FN-19", "src/rules/labAlerts.ts"],
  ["FN-15", "src/kernel/projections/cumulativos.ts"], ["FN-20", "src/rules/radsEmergencias.ts"], ["FN-21", "src/rules/redFlagsCanal.ts"],
  ["FN-22", "src/kernel/extracao/reconciliacao.ts"], ["FN-23", "src/kernel/extracao/patient-resolver.ts"],
  ["FN-24", "src/kernel/llm/desidentificar.ts"], ["FN-25", "src/rules/caixa.ts"],
  ["FN-26", "src/rules/cumulativoAlerta.ts"],
]);
const fnSymbol = new Map([
  ["FN-05", "validadeHemograma"], ["FN-10", "apacGerar"], ["FN-11", "validarEmissaoApac"],
  ["FN-14", "delta"], ["FN-15", "cumulativos"], ["FN-16", "semaforoInteracoes"],
  ["FN-17", "avaliarCtcaeGrau"], ["FN-18", "avaliarSerieRecist"], ["FN-19", "avaliarLabAlerts"],
  ["FN-20", "detectarEmergencias"], ["FN-21", "avaliarRedFlagsCanal"], ["FN-22", "reconciliarCampos"],
  ["FN-23", "rankearPacientes"], ["FN-25", "rotearCaixa"], ["FN-26", "avaliarCumulativoAlerta"],
]);
const gateSource = new Map([
  ["G-01", "src/rules/identidade.ts"],
  ["G-06", "src/modules/documentos/destaqueE1.ts"],
  ["G-03", "src/kernel/harness/gates.ts"], ["G-05", "src/kernel/harness/gates.ts"],
  ["G-07", "src/kernel/harness/gates.ts"], ["G-10", "src/kernel/harness/gates.ts"],
  ["G-11", "src/rules/apac.ts"], ["G-12", "src/rules/apac.ts"],
  ["G-13", "src/kernel/harness/gates.ts"], ["G-14", "src/kernel/harness/gates.ts"],
  ["G-18", "src/modules/documentos/render.ts"],
  ["G-22", "src/kernel/harness/capabilityStatus.ts"],
  ["G-09", "src/kernel/harness/gates.ts"], ["G-19", "src/server/autorizacao.ts"],
  ["G-20", "src/kernel/gateway/gateway.ts"],
  ["G-16", "src/kernel/harness/ownership.ts"], ["G-17", "src/kernel/corpus/loader.ts"],
]);
const gateSymbol = new Map([
  ["G-01", "resolverIdentidade"], ["G-03", "g03Assinatura"], ["G-05", "g05VerdeHonesto"],
  ["G-07", "g07Lateralidade"], ["G-09", "g09PtDeBiopsia"], ["G-10", "g10DosePura"],
  ["G-11", "validarEmissaoApac"], ["G-12", "apacGerar"], ["G-13", "g13Letra"],
  ["G-14", "g14Interpolacao"], ["G-16", "g16Owner"], ["G-17", "carregarDiretorio"],
  ["G-06", "g06E1Destaque"], ["G-22", "decidirFonteAlertaPorCapabilityStatus"], ["T-61", "decidirFonteAlertaPorCapabilityStatus"],
  ["G-18", "EntradaRender"], ["G-19", "autorizarSaida"], ["G-20", "criarGateway"],
]);
const functionConsumer = new Map([
  ["FN-22", "src/server/leituras.ts"], ["FN-23", "src/orchestration/pipeline-extracao.ts"],
  ["FN-20", "src/server/rotas.ts"], ["FN-18", "src/server/leituras.ts"],
]);
const forceTestConsumer = new Set([
  "FN-10", "FN-11", "FN-13", "FN-17", "FN-19", "FN-21", "FN-25", "FN-26",
  "Q11", "D-W9-09", "G-03", "G-05", "G-07", "G-10", "G-11", "G-12", "G-13", "G-14", "G-17", "G-18",
  "D-W9-18", "A3", "D-W9-22a", "D-W9-22c", "D-W9-22g", "D-W9-34a",
  "A4", "A11", "G-15", "G-22", "Q09", "Q46", "D-W9-10", "D-W9-11", "D-W9-12", "D-W9-16", "D-W9-17", "D-W9-34d", "D-W9-58", "D-W9-75a", "D-W9-77d", "T-45", "T-47", "T-49", "T-52", "T-53", "T-54", "T-55", "T-57", "T-58", "T-61",
]);
const testConsumerRuntime = new Map([
  ["FN-10", "F4"], ["FN-11", "F4"], ["FN-13", "F4"], ["FN-16", "F1"],
  ["FN-17", "F1"], ["FN-19", "F1"], ["FN-21", "F2"], ["FN-25", "F1"], ["FN-26", "F3"],
  ["D-W9-77d", "F1"],
  ["D-W9-18", "F1"],
]);

const fnTest = new Map([
  ["FN-01", "tests/rules/triagem.test.ts"], ["FN-02", "tests/rules/triagem.test.ts"],
  ["FN-03", "tests/rules/fila.test.ts"], ["FN-04", "tests/rules/dose.test.ts"],
  ["FN-05", "tests/rules/validade.test.ts"], ["FN-06", "tests/rules/peso.test.ts"],
  ["FN-07", "tests/rules/prazos.test.ts"], ["FN-08", "tests/rules/prazos.test.ts"],
  ["FN-09", "tests/rules/ciclo.test.ts"], ["FN-10", "tests/apac/apac.test.ts"],
  ["FN-11", "tests/apac/apac.test.ts"], ["FN-12", "tests/apac/apac-prazo-cob.test.ts"],
  ["FN-13", "tests/apac/apac-retrograda-cob.test.ts"], ["FN-14", "tests/rules/delta-pendente-cob.test.ts"],
  ["FN-15", "tests/projections/projections.test.ts"], ["FN-16", "tests/adv-w8/fn16-t34-semaforo-interacoes.adv.ts"], ["FN-17", "tests/w3/w3.test.ts"],
  ["FN-18", "tests/w10-luna4/http-recist-estatistica.test.ts"], ["FN-19", "tests/w3/w3.test.ts"],
  ["FN-20", "tests/muse/rads-http.test.ts"], ["FN-21", "tests/w3/w3.test.ts"],
  ["FN-22", "tests/closure-luna1/f03-reconciliar-fontes.test.ts"], ["FN-23", "tests/closure-luna1/f04-vinculo-paciente.test.ts"],
  ["FN-24", "tests/kernel/kernel.test.ts"], ["FN-25", "tests/identity/caixa.test.ts"],
  ["FN-26", "tests/w3/w3.test.ts"],
]);

const gateTest = new Map([
  ["G-01", "tests/identity/g01-vinculo.test.ts"], ["G-02", "tests/kernel/adv005-phi.test.ts"],
  ["G-03", "tests/kernel/kernel.test.ts"], ["G-04", "tests/prompts/prompts.test.ts"],
  ["G-05", "tests/kernel/kernel.test.ts"], ["G-06", "tests/ui/banner-e1.test.tsx"],
  ["G-07", "tests/kernel/gates-w10/g07-lateralidade.test.ts"], ["G-08", "tests/kernel/gates-w10/g08-anatomia-sexo.test.ts"],
  ["G-09", "tests/kernel/gates-w10/g09-ptnm.test.ts"], ["G-10", "tests/kernel/kernel.test.ts"],
  ["G-11", "tests/apac/apac.test.ts"], ["G-12", "tests/apac/apac.test.ts"],
  ["G-13", "tests/kernel/kernel.test.ts"], ["G-14", "tests/kernel/kernel.test.ts"],
  ["G-15", "tests/kernel/kernel.test.ts"], ["G-16", "tests/w10-grok/grok-10-ownership.test.ts"],
  ["G-17", "tests/corpus/loader.test.ts"], ["G-18", "tests/w11-adv/apac-gates.test.ts"],
  ["G-19", "tests/server/cp001-autorizacao.test.ts"], ["G-20", "tests/ledger/adv001-idempotencia.test.ts"],
  ["G-22", "tests/corpus/capabilities.test.ts"],
  ["G-25", "tests/server/server.test.ts"],
]);
const decisionTest = new Map([["Q58", "tests/backup/backup.test.ts"], ["A11", "tests/backup/backup.test.ts"]]);
decisionTest.set("Q09", "tests/contracts/dimensoes-limite.test.ts");
decisionTest.set("Q11", "tests/orchestration/ork.test.ts");
decisionTest.set("A11", "tests/backup/backup.test.ts");
decisionTest.set("D-W5-01", "tests/kernel/extracao/normalizacao.test.ts");
decisionTest.set("D-W5-02", "tests/w10-grok/grok-13-apac-snapshot.test.ts");
decisionTest.set("D-W8-01", "tests/closure-fugu/f02-dedupe-pipeline.test.ts");
decisionTest.set("D-W9-04", "tests/impressao/kit-apac.test.ts");
decisionTest.set("D-W9-05", "tests/kernel/gates-w10/g07-lateralidade.test.ts");
decisionTest.set("D-W9-09", "tests/leitura/pdf-digital.test.ts");
decisionTest.set("D-W9-18", "tests/leitura/pdf-digital.test.ts");
decisionTest.set("D-W9-16", "tests/w10-cursor/config.test.tsx");
decisionTest.set("D-W9-16", "tests/w10-luna5/http-config-real.test.ts");
decisionTest.set("D-W9-17", "tests/w10-luna5/http-config-real.test.ts");
decisionTest.set("A3", "tests/kernel/extracao/reconciliacao.test.ts");
decisionTest.set("D-W9-22a", "tests/w12-grok/grok-02-corpo.test.ts");
decisionTest.set("D-W9-22c", "tests/f0-fecha/consulta-completa.test.ts");
decisionTest.set("D-W9-22g", "tests/w12-grok/grok-02-corpo.test.ts");
decisionTest.set("D-W9-34a", "tests/f0-fecha/consulta-completa.test.ts");
decisionTest.set("D-W9-10", "tests/w10-grok/grok-13-apac-snapshot.test.ts");
decisionTest.set("D-W9-15", "tests/cobertura/saida.test.ts");
decisionTest.set("D-W9-65", "tests/adv-w8/g27-saida-externa.adv.ts");
decisionTest.set("D-W9-66", "tests/adv-w8/g27-saida-externa.adv.ts");
decisionTest.set("D-W9-12", "tests/w10-grok/grok-13-apac-snapshot.test.ts");
decisionTest.set("D-W9-41", "tests/f0-fecha/d41-fonte.test.ts");
decisionTest.set("D-W9-58", "tests/leitura/pdf-digital.test.ts");
decisionTest.set("D-W9-68", "tests/w10-grok/grok-05-rads.test.ts");
decisionTest.set("G-15", "tests/ledger/ledger.test.ts");
decisionTest.set("T-53", "tests/apac/apac.test.ts");
decisionTest.set("D-W5-08", "tests/server/cp001-autorizacao.test.ts");
decisionTest.set("D-W5-09", "tests/kernel/adv013-fronteiras.test.ts");
decisionTest.set("G-15", "tests/orchestration/ork.test.ts");
decisionTest.set("T-53", "tests/apac/apac.test.ts");
decisionTest.set("D-W9-13", "tests/apac-w10/cns-sigtap.test.ts");
decisionTest.set("D-W9-26", "tests/contracts/w10.test.ts");
decisionTest.set("D-W9-47", "tests/w10-grok/grok-08-semaforo.test.ts");
decisionTest.set("D-W9-31", "tests/w10-grok/grok-07-nodulo.test.ts");
decisionTest.set("D-W9-33", "tests/w10-fugu/e2e-pt10.test.ts");
decisionTest.set("D-W9-38", "tests/kernel/extracao/normalizacao.test.ts");
decisionTest.set("D-W9-39", "tests/w10-grok/grok-04-agenda.test.ts");
decisionTest.set("D-W9-43", "tests/w10-grok/grok-06-interval.test.ts");
decisionTest.set("D-W9-47", "tests/w12-grok/grok-02-corpo.test.ts");
decisionTest.delete("D-W9-47");
decisionTest.set("D-W9-47", "tests/w10-grok/grok-09-suporte.test.ts");
decisionTest.set("D-W9-51", "tests/w10-grok/grok-05-rads.test.ts");
decisionTest.set("D-W9-57", "tests/rules-morfometria/index.test.ts");
decisionTest.set("D-W9-52", "tests/rules-morfometria/index.test.ts");
decisionTest.set("D-W9-67", "tests/corpus/prostata-w8.test.ts");
decisionTest.set("D-W9-73", "tests/w12-grok/grok-03-ctcae.test.ts");
decisionTest.set("D-W9-74", "tests/contracts/w12-regras-clinicas.test.ts");
decisionTest.set("D-W9-75", "tests/w12-grok/grok-04-texto.test.ts");
decisionTest.set("D-W9-76", "tests/w12-grok/grok-06-tontura.test.ts");
decisionTest.set("D-W9-77", "tests/f0-fecha/retrato-ledger.test.ts");
decisionTest.set("D-W9-78", "tests/f0-fecha/c2-flash-retomada.test.ts");
decisionTest.set("D-W9-08", "tests/rules-w8/patologiaSitio.test.ts");
decisionTest.set("D-W9-08", "tests/rules-w8/patologiaSitio.test.ts");
decisionTest.set("Q46", "tests/corpus/packs.test.ts");
decisionTest.set("Q47", "tests/oncoassist-jev/oncoassist.test.ts");
decisionTest.set("Q50", "tests/f0-fecha/consulta-completa.test.ts");
decisionTest.set("Q56", "tests/cobertura/fuso.test.ts");
decisionTest.set("D-W9-11", "tests/apac-w10/cns-sigtap.test.ts");
decisionTest.set("D-W9-34d", "tests/corpus-fichas/fichas.test.ts");
decisionTest.set("D-W9-75a", "tests/w12-grok/grok-04-texto.test.ts");
decisionTest.set("D-W9-75b", "tests/w12-grok/grok-08-canal.test.ts");
decisionTest.set("D-W9-77d", "tests/w10-grok/grok-08-semaforo.test.ts");
decisionTest.set("D-W9-22", "tests/w12-grok/grok-02-corpo.test.ts");
decisionTest.set("G-22", "tests/f0-fecha/capability-status.test.ts");
decisionTest.set("T-61", "tests/f0-fecha/capability-status.test.ts");
decisionTest.set("T-48", "tests/ui/banner-e1.test.tsx");
decisionTest.set("G-03", "tests/kernel/kernel.test.ts");
decisionTest.set("G-05", "tests/kernel/kernel.test.ts");
decisionTest.set("G-10", "tests/kernel/kernel.test.ts");
decisionTest.set("G-11", "tests/apac/apac.test.ts");
decisionTest.set("G-12", "tests/apac/apac.test.ts");
decisionTest.set("G-13", "tests/kernel/kernel.test.ts");
decisionTest.set("G-14", "tests/kernel/kernel.test.ts");
decisionTest.set("G-18", "tests/modules/adv015-template.test.ts");
decisionTest.set("T-45", "tests/kernel/kernel.test.ts");
decisionTest.set("T-46", "tests/prompts/prompts.test.ts");
decisionTest.set("T-47", "tests/kernel/kernel.test.ts");
decisionTest.set("T-52", "tests/kernel/kernel.test.ts");
decisionTest.set("T-53", "tests/apac/apac.test.ts");
decisionTest.set("T-54", "tests/kernel/kernel.test.ts");
decisionTest.set("T-55", "tests/kernel/kernel.test.ts");
decisionTest.set("T-58", "tests/modules/adv015-template.test.ts");
decisionTest.set("T-59", "tests/server/cp001-autorizacao.test.ts");
decisionTest.set("G-03", "tests/kernel/kernel.test.ts");
decisionTest.set("G-05", "tests/kernel/kernel.test.ts");
decisionTest.set("G-10", "tests/kernel/kernel.test.ts");
decisionTest.set("G-11", "tests/apac/apac.test.ts");
decisionTest.set("G-12", "tests/apac/apac.test.ts");
decisionTest.set("G-13", "tests/kernel/kernel.test.ts");
decisionTest.set("G-14", "tests/kernel/kernel.test.ts");
decisionTest.set("G-18", "tests/modules/adv015-template.test.ts");
decisionTest.set("T-45", "tests/kernel/kernel.test.ts");
decisionTest.set("T-47", "tests/kernel/kernel.test.ts");
decisionTest.set("T-52", "tests/kernel/kernel.test.ts");
decisionTest.set("T-53", "tests/apac/apac.test.ts");
decisionTest.set("T-54", "tests/kernel/kernel.test.ts");
decisionTest.set("T-55", "tests/kernel/kernel.test.ts");
decisionTest.set("T-58", "tests/modules/adv015-template.test.ts");
decisionTest.set("T-59", "tests/server/cp001-autorizacao.test.ts");
decisionTest.set("Q05", "tests/ledger/ledger.test.ts");
decisionTest.set("Q06", "tests/contracts/contratos.test.ts");
decisionTest.set("Q08", "tests/oncoassist-jev/oncoassist.test.ts");
decisionTest.set("Q11", "tests/orchestration/ork.test.ts");
decisionTest.set("Q17", "tests/ui/fechamento.test.tsx");
decisionTest.set("Q18", "tests/ui/fechamento.test.tsx");
decisionTest.set("Q20", "tests/modules/bundles.test.ts");
decisionTest.set("G-06", "tests/f0-fecha/e1-operacional.test.ts");
decisionTest.set("T-48", "tests/f0-fecha/e1-operacional.test.ts");
decisionTest.set("T-41", "tests/identity/identidade.test.ts");
decisionTest.set("T-29", "tests/apac/apac.test.ts");
decisionTest.set("T-40", "tests/closure-luna1/f03-reconciliar-fontes.test.ts");
decisionTest.set("G-19", "tests/server/cp001-autorizacao.test.ts");
decisionTest.set("G-20", "tests/ledger/adv001-idempotencia.test.ts");
decisionTest.set("G-16", "tests/w10-grok/grok-10-ownership.test.ts");
decisionTest.set("G-17", "tests/corpus/loader.test.ts");
decisionTest.set("FN-15", "tests/projections/projections.test.ts");
decisionTest.set("T-33", "tests/projections/projections.test.ts");
decisionTest.set("FN-17", "tests/w3/w3.test.ts");
decisionTest.set("FN-18", "tests/w10-luna4/http-recist-estatistica.test.ts");
decisionTest.set("T-35", "tests/w3/w3.test.ts");
decisionTest.set("T-36", "tests/w10-luna4/http-recist-estatistica.test.ts");
decisionTest.set("Q45", "tests/w3/w3.test.ts");
decisionTest.set("T-37", "tests/w3/w3.test.ts");
decisionTest.set("T-38", "tests/muse/rads-http.test.ts");
decisionTest.set("T-39", "tests/w3/w3.test.ts");
decisionTest.set("T-44", "tests/w3/w3.test.ts");
for (const id of ["FN-19", "FN-20", "FN-21", "FN-22", "FN-23", "FN-25", "FN-26"]) decisionTest.set(id, fnTest.get(id));
const testTitleOverride = new Map([
  ["D-W9-15", "KIMI-19 · G-02: canais externos nunca habilitados — WhatsApp/e-mail/agendar recusados mesmo com artefato assinado"],
  ["D-W9-16", "reabre o SQLite local ao reiniciar o servidor e recupera perfil, caixa e trilha"],
  ["D-W9-17", "grava CNES como texto com zeros, atribui a sessão e replay não duplica histórico nem vaza valores em logs"],
  ["A3", "TNM incompatível no mesmo tipo de avaliação é CONFLICT; tipos diferentes coexistem (A3)"],
  ["D-W9-22a", "neutrófilos 1499 ficam abaixo da bula 1500; 1500 passa; grau não abre a porta"],
  ["D-W9-22c", "mantém duas fontes contraditórias como CONFLITO e sem eleição automática antes de decisão"],
  ["D-W9-22g", "FC 49 corta o salão e não a triagem do ciclo; PAS 150 faz o inverso"],
  ["D-W9-34a", "percorre kit sintético, vínculo explícito, evolução exibida e Flash assinada; reabre o SQLite e preserva a história"],
  ["D-W9-18", "extrai o texto por página com hash dos bytes, sem rede"],
  ["D-W9-41", "D-W9-41 imprime a redação corrigida e conserva a frase original do PDF como proveniência"],
  ["D-W9-57", "anatomia média, máscara probabilística e modo desconhecido ⇒ recusado"],
  ["D-W9-47", "os limiares e a classe vêm do ruleset"],
  ["D-W9-10", "CNES ausente fica pendente e outro número de 7 dígitos vale se for o configurado"],
  ["D-W9-12", "intenção não preenche finalidade ausente e código desconhecido não é mapeado"],
  ["D-W9-58", "extrai o texto por página com hash dos bytes, sem rede"],
  ["D-W9-68", "o catálogo tem as 31 linhas e a negação declarada"],
  ["G-15", "A4 JSON com state não muda os cinco estados do run"],
  ["T-53", "G-12 nenhuma conversão de intenção em finalidade no código"],
  ["D-W5-08", "CP-001 · positivo: artefato ASSINADO do mesmo paciente/encontro/versão autoriza IMPRIMIR"],
  ["D-W5-09", "ADV-013 · check-boundaries rejeita ${vetor} fora de gateway/llm"],
  ["T-53", "T-28/29/N03 valida completude só na emissão; NEGADA e comprovante sobrevivem"],
  ["Q09", "mantém a tabela normativa completa, teto de cinco e rejeição fora do enum"],
  ["G-22", "aplica a regra positiva/negativa a cada estado declarado sem ordenar o enum"],
  ["T-61", "oculta status ausente/desconhecido sem coerção e informa em validação"],
  ["G-06", "bloqueia somente o artefato quando emergência ativa não tem destaque"],
  ["T-48", "bloqueia somente o artefato quando emergência ativa não tem destaque"],
  ["Q46", "os 4 packs têm header válido (G-17) e id correto"],
  ["Q47", "envia só texto desidentificado e devolve proposta com hash do original"],
  ["Q50", "percorre kit sintético, vínculo explícito, evolução exibida e Flash assinada; reabre o SQLite e preserva a história"],
  ["Q56", "intervalo pós-QT · FN-07/A4: 30 dias — igual passa (VERDE); 29 dispara aviso; concomitante nunca avisa"],
  ["D-W9-11", "busca por competência, sem cair em outra"],
  ["D-W9-34d", "hidratação com Mg/K (pré) e KCl (pós) em cada dia de cisplatina; manitol junto"],
  ["Q05", "N07 salva payload inerte e o recupera ao reabrir sem promovê-lo"],
  ["Q06", "C-16 ConfirmarBloco (INV-04, A1, K-04)"],
  ["Q08", "envia só texto desidentificado e devolve proposta com hash do original"],
  ["Q11", "Maestro só oferece tabela fixa sem impressão no validar"],
  ["Q17", "percurso de rotina ≤ 5 cliques; validar não imprime; payload estrito"],
  ["Q18", "percurso de rotina ≤ 5 cliques; validar não imprime; payload estrito"],
  ["G-06", "bloqueia somente o artefato quando emergência ativa não tem destaque"],
  ["T-48", "bloqueia somente o artefato quando emergência ativa não tem destaque"],
  ["Q20", "declara os quatro bundles da decisão"],
  ["T-41", "T-41 CNS exato liga; nome sozinho jamais; nome+nascimento só candidato"],
  ["G-19", "CP-001 · positivo: artefato ASSINADO do mesmo paciente/encontro/versão autoriza IMPRIMIR"],
  ["G-20", "ADV-001 · RESISTIU: replay no mesmo processo não duplica efeito"],
  ["G-16", "GROK-10 g16Owner"], ["G-17", "validarRuleset (G-17)"],
  ["T-46", "G-04 cada prompt repete contrato universal sem números de corte clínico"],
  ["D-W5-01", "instante com offset vira data civil em −03:00 (D-W5-01)"],
  ["D-W5-02", "1 dia civil no fuso −03:00 avisa; 0 não avisa; 2 não entra no aviso; data ausente não vira zero"],
  ["D-W9-04", "D-W9-04 · texto do kit sai acentuado e as âncoras de renderização continuam funcionando"],
  ["D-W9-08", "P2: agregarCaso retorna PENDENTE enquanto ruleset patologia-agregacao estiver inativo"],
  ["D-W9-09", "PDF escaneado e imagem continuam PENDENTE (D-W9-09) e delegam no caminho assíncrono"],
  ["D-W9-26", "ajuste de dose só −20/−30/−40 e com motivo (D-W9-26)"],
  ["D-W9-38", "°C com tempDecimos e febre estritamente > 37,8 (D-W9-38)"],
  ["D-W9-73", "25.000 não aparece como limite G4 de plaquetas (v6 pura, D-W9-73)"],
  ["D-W9-74", "representa histórico e início da vertigem desconhecidos como null"],
  ["D-W9-75", "vômito com observação hospitalar sugere G3 e mostra as duas leituras da quantidade"],
  ["D-W9-75a", "vômito com observação hospitalar sugere G3 e mostra as duas leituras da quantidade"],
  ["D-W9-75b", "versão 1.1.0, 25 sinais em RASCUNHO e os 6 candidatos antigos continuam inativos"],
  ["D-W9-76", "o corte por tontura não faz parte do contrato e o código não emite naoCorte.ecog.tontura"],
  ["D-W9-77", "aceita retrato todo 'não informado' sem inventar valor"],
  ["D-W9-77", "copia histologia literal de AP com fonte e mantém os demais campos ausentes, salvo TNM literal prefixado"],
  ["D-W9-78", "retoma após reiniciar SQLite e sessão com nova chave sem duplicar preparação ou assinatura"],
  ["D-W9-34d", "hidratação com Mg/K (pré) e KCl (pós) em cada dia de cisplatina; manitol junto"],
  ["D-W9-77d", "o catálogo importado continua todo inativo e não acrescenta par com TKI"],
  ["D-W9-22", "neutrófilos 1499 ficam abaixo da bula 1500; 1500 passa; grau não abre a porta"],
  ["G-11", "T-28/29/N03 valida completude só na emissão; NEGADA e comprovante sobrevivem"],
  ["G-12", "G-12 nenhuma conversão de intenção em finalidade no código"],
  ["G-18", "ADV-015 · fato com origem permitida permanece, inclusive ALERTA na folha operacional"],
  ["T-58", "ADV-015 · fato com origem permitida permanece, inclusive ALERTA na folha operacional"],
  ["T-59", "CP-001 · positivo: artefato ASSINADO do mesmo paciente/encontro/versão autoriza IMPRIMIR"],
  ["Q21", "PA 160 → SALAO; PA 161 → FILA_MEDICO"],
  ["Q22", "grau 4 → FILA_MEDICO + emergencia (E1)"],
  ["A1", "G-25 rejeita assinatura fora do bundle; validação grava N eventos e não imprime"],
  ["A7", "febre 379 + ANC 900 → emergencia true e destino FILA_MEDICO (emergência não muda destino)"],
  ["FN-10", "T-27 só prescrição ASSINADA gera rascunho; data app, finalidade pendente sem mapa"],
  ["FN-11", "T-28/29/N03 valida completude só na emissão; NEGADA e comprovante sobrevivem"],
  ["FN-14", "FN-14 / T-32: ausente nao significa resolvido no delta"],
  ["FN-16", "FN-16 / T-34 · semáforo de interações medicamentosas"],
  ["FN-15", "N14 cumulativo usa só administração efetiva; séries guardam origem"],
  ["T-33", "N14 cumulativo usa só administração efetiva; séries guardam origem"],
  ["FN-17", "W3 CDX-06 ctcaeGrau"], ["FN-18", "serve RECIST PD proposto do ledger e estatística deduplicada sem identificadores após replay"],
  ["T-35", "W3 CDX-06 ctcaeGrau"], ["T-36", "W3 CDX-07 recist"],
  ["FN-19", "W3 CDX-02 labAlerts"], ["FN-20", "HTTP usa as cadeias RADS do corpus, preserva trecho/fonte e não confirma emergência"],
  ["FN-21", "W3 CDX-04 redFlagsCanal"],
  ["FN-22", "retorna proposta com repetição preservada, sem escrever fatos ou operações"],
  ["FN-23", "preserva conflito nome × cadastro e não cria evento nem operação"],
  ["FN-25", "T-43 texto misto roteia para mais de um destino sem escolher só o primeiro"],
  ["FN-26", "W3 CDX-05 cumulativoAlerta"],
  ["Q45", "W3 CDX-06 ctcaeGrau"], ["T-37", "W3 CDX-02 labAlerts"],
  ["T-38", "HTTP usa as cadeias RADS do corpus, preserva trecho/fonte e não confirma emergência"],
  ["T-39", "W3 CDX-04 redFlagsCanal"], ["T-44", "W3 CDX-05 cumulativoAlerta"],
  ["T-40", "retorna proposta com repetição preservada, sem escrever fatos ou operações"],
  ["T-28", "T-28/29/N03 valida completude só na emissão; NEGADA e comprovante sobrevivem"],
  ["T-29", "T-28/29/N03 valida completude só na emissão; NEGADA e comprovante sobrevivem"],
  ["T-32", "FN-14 / T-32: ausente nao significa resolvido no delta"],
  ["T-34", "FN-16 / T-34 · semáforo de interações medicamentosas"],
  ["T-01", "PA 160 → SALAO; PA 161 → FILA_MEDICO"], ["T-02", "PA 90 → SALAO; PA 89 → FILA_MEDICO"],
  ["T-03", "FC 120 → SALAO; FC 121 → FILA_MEDICO"], ["T-04", "SpO2 88 → SALAO; SpO2 87 → FILA_MEDICO"],
  ["T-05", "temp 378 → SALAO; temp 379 → FILA_MEDICO"], ["T-06", "Hb 80 → SALAO; Hb 79 → FILA_MEDICO"],
  ["T-07", "ANC 1500 → SALAO; ANC 1499 → FILA_MEDICO"], ["T-08", "PLQ 100000 → SALAO; PLQ 99999 → FILA_MEDICO"],
  ["T-09", "grau 3 → FILA_MEDICO"], ["T-10", "grau 4 → FILA_MEDICO + emergencia (E1)"],
  ["T-11", "FN-01 grau CTCAE e ECOG"], ["T-12", "requisito aplicável ausente → pendente + FILA_MEDICO"],
  ["T-13", "hemograma coletado há 7 dias → sem pendência; há 8 dias → pendente; futura → pendente"],
  ["T-14", "CAMA sem corte e sem pendência → FRENTE"], ["T-15", "CAMA com febre → FILA_MEDICO (nunca frente com corte)"],
  ["T-16", "ordena ECOG4 → ECOG3 → CAMA → CADEIRA → >80 (T-16)"],
  ["T-17", "empate de nível desempata por ECOG maior (mesmo com chegada mais tardia)"],
  ["T-18", "base 100 com reduções 0/20/30/40 → 100/80/70/60"], ["T-19", "base 100 com reduções 0/20/30/40 → 100/80/70/60"],
  ["T-20", "base 100 com reduções 0/20/30/40 → 100/80/70/60"], ["T-21", "base 100 com reduções 0/20/30/40 → 100/80/70/60"],
  ["T-22", "coleta há 7 dias → VERDE"], ["T-23", "FN-06 tendência de peso"],
  ["T-24", "última QT 2026-09-05 e cirurgia 2026-10-05 (30 d) → VERDE"],
  ["T-25", "períodos sobrepostos → true"], ["T-26", "ciclo 3 sem corte e sem pendência → false (salta o médico)"],
  ["T-30", "positivo: D85 e D89 avisam sem atrasar e sem interromper a consulta"],
  ["T-31", "negativo: sem comprovante externo não cria pendência clínica"],
  ["T-49", "G-07 · lateralidade (D-W9-05)"], ["T-50", "G-08 · anatomia × sexo (D-W9-06)"],
]);
const testAnchors = new Map([["FN-10", ["T-27"]], ["FN-11", ["T-28", "T-29"]]]);
const supersededDecision = new Map([
  ["Q58", "substituída por A11: somente HD externo local cifrado, chave de recuperação fora do PC"],
  ["D-W9-52", "substituída por D-W9-57; a porta TypeScript e sua prova são rastreadas no item atual"],
]);

function walk(dir, root, accept) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(abs, root, accept));
    else if (accept(abs)) out.push({ abs, rel: path.relative(root, abs).replaceAll(path.sep, "/"), text: fs.readFileSync(abs, "utf8") });
  }
  return out;
}

function productionSources(root) {
  const sourceFilter = file => /\.(?:ts|tsx|js|mjs|json)$/.test(file);
  return ["src", "scripts"].flatMap(dir => walk(path.join(root, dir), root, sourceFilter))
    .filter(file => file.rel !== "scripts/matriz-f0.mjs");
}

function cleanSummary(value) {
  const clean = value.replace(/`/g, "").replace(/\*\*/g, "").replace(/\*/g, "").replace(/\|/g, ";").replace(/\s+/g, " ").trim();
  const words = clean.split(" ").filter(Boolean);
  if (words.length <= 12) return clean || "Descrição ausente na fonte normativa";
  words.length = 12;
  words[11] = `${words[11].replace(/[.,;:]?$/, "")}…`;
  return words.join(" ");
}

function decisionEntries(root) {
  const text = fs.readFileSync(path.join(root, DECISIONS), "utf8");
  const lines = text.split(/\r?\n/);
  const entries = new Map();
  for (let n = 1; n <= 59; n++) {
    const lineIndex = lines.findIndex(line => new RegExp(`^${n}\\.`).test(line));
    if (lineIndex >= 0) entries.set(`Q${String(n).padStart(2, "0")}`, { line: lineIndex + 1, summary: lines[lineIndex].replace(/^\d+\.\s*/, ""), source: DECISIONS });
  }
  for (let n = 1; n <= 11; n++) {
    const lineIndex = lines.findIndex(line => new RegExp(`^A${n}\\.`).test(line));
    if (lineIndex >= 0) entries.set(`A${n}`, { line: lineIndex + 1, summary: lines[lineIndex].replace(/^A\d+\.\s*/, ""), source: DECISIONS });
  }
  for (const id of [...Array.from({ length: 10 }, (_, i) => `D-W5-${String(i + 1).padStart(2, "0")}`), "D-W8-01", ...Array.from({ length: 80 }, (_, i) => `D-W9-${String(i + 1).padStart(2, "0")}`)]) {
    const escaped = id.replaceAll("-", "\\-");
    const lineIndex = lines.findIndex(line => new RegExp(`(?:\\*\\*)${escaped}(?:\\b|[a-z])`).test(line) && /^\s*[-*]|^\*\*/.test(line));
    if (lineIndex >= 0) entries.set(id, { line: lineIndex + 1, summary: lines[lineIndex].replace(/^\s*[-*]\s*/, "").replace(/^\*\*/, "").replace(new RegExp(`^${escaped}\\s*·?\\s*`), ""), source: DECISIONS });
  }
  // Decisões numeradas com sufixo são itens distintos e preservam também o item-pai.
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^\s*[-*]\s*\*\*(D-W9-\d{2}[a-z])\b/);
    if (match) entries.set(match[1], { line: i + 1, summary: lines[i].replace(/^\s*[-*]\s*\*\*[^·]+·?\s*/, ""), source: DECISIONS });
  }
  // These subitems are cited elsewhere as D-W9 decisions; keep them separate and retain parents.
  entries.set("D-W9-23a", { line: 158, summary: "Protocolos FOLFOX/FOLFIRI: 5-FU em infusão contínua de 46 h", source: DECISIONS });
  entries.set("D-W9-23c", { line: 160, summary: "Antiemese local: ondansetrona, dexametasona e difenidramina; sem aprepitanto", source: DECISIONS });
  entries.set("D-W9-34c", { line: 174, summary: "Atualiza pré-medicação local; inclui cimetidina e olanzapina opcional", source: DECISIONS });
  entries.set("D-W9-34d", { line: 175, summary: "Cisplatina D1/D8: magnésio e potássio na hidratação pré e pós", source: DECISIONS });
  // Parent rows remain; subitems with independent phases are traced individually.
  for (const parent of ["D-W9-22", "D-W9-34", "D-W9-75"]) {
    const parentLine = lines.findIndex(line => line.includes(`**${parent} ·`));
    if (parentLine < 0) continue;
    for (let i = parentLine + 1; i < lines.length && !/^\s*- \*\*D-W9-\d{2}/.test(lines[i] ?? ""); i++) {
      const part = lines[i]?.match(/^\s*\(([a-z])\)\s+(.*)$/);
      if (part) entries.set(`${parent}${part[1]}`, { line: i + 1, summary: part[2] ?? "", source: DECISIONS });
    }
  }
  const d77 = lines.findIndex(line => line.includes("**D-W9-77 ·"));
  const d77d = d77 >= 0 ? lines.slice(d77 + 1).findIndex(line => /^\s*\(d\)/.test(line)) : -1;
  if (d77 >= 0 && d77d >= 0) {
    const line = lines[d77 + d77d + 1] ?? "";
    entries.set("D-W9-77d", { line: d77 + d77d + 2, summary: line.replace(/^\s*\(d\)\s*/, ""), source: DECISIONS });
  }
  return entries;
}

function planEntries(root) {
  const text = fs.readFileSync(path.join(root, PLAN), "utf8");
  const lines = text.split(/\r?\n/);
  const entries = new Map();
  const section = (start, end) => {
    const startAt = lines.findIndex(line => line.startsWith(start));
    const endAt = lines.findIndex((line, index) => index > startAt && line.startsWith(end));
    return { startAt, endAt: endAt < 0 ? lines.length : endAt };
  };
  const r12 = section("## R-12", "## R-13");
  const r15 = section("## R-15", "---");
  const r28 = section("## R-28", "---");
  const part7 = section("# PARTE 7", "## Adversariais");
  for (const prefix of ["FN", "G", "T"]) {
    const max = prefix === "FN" ? 26 : prefix === "G" ? 22 : 61;
    const bounds = prefix === "FN" ? r12 : prefix === "G" ? r15 : part7;
    for (let n = 1; n <= max; n++) {
      const id = `${prefix}-${String(n).padStart(2, "0")}`;
      let matchLine = lines.findIndex((line, index) => index >= bounds.startAt && index < bounds.endAt && line.trimStart().startsWith("|") && new RegExp(`\\b${id}\\b`).test(line));
      if (prefix === "T" && n >= 27 && n <= 31 && matchLine < 0) {
        matchLine = lines.findIndex((line, index) => index >= part7.startAt && index < part7.endAt && line.trimStart().startsWith("|") && line.includes("T-27") && line.includes("T-31"));
      }
      if (prefix === "T" && matchLine < 0) {
        const g = (n >= 45 && n <= 54) ? n - 42 : n === 55 ? 14 : n >= 56 && n <= 60 ? n - 40 : n === 61 ? 22 : 0;
        if (g) matchLine = lines.findIndex((line, index) => index >= r15.startAt && index < r15.endAt && line.includes(`G-${String(g).padStart(2, "0")}`));
      }
      if (matchLine >= 0) entries.set(id, { line: matchLine + 1, summary: lines[matchLine].replace(/^\s*\|?\s*/, "").replace(/\s*\|\s*/g, "; "), source: PLAN });
      else entries.set(id, { line: 0, summary: `ID ${id} sem descrição literal nas seções normativas`, source: PLAN });
    }
  }
  return entries;
}

function requiredIds(root) {
  const decisions = decisionEntries(root);
  const plan = planEntries(root);
  const ids = [
    ...Array.from({ length: 59 }, (_, i) => `Q${String(i + 1).padStart(2, "0")}`),
    ...Array.from({ length: 11 }, (_, i) => `A${i + 1}`),
    ...Array.from({ length: 10 }, (_, i) => `D-W5-${String(i + 1).padStart(2, "0")}`),
    "D-W8-01",
    ...Array.from({ length: 80 }, (_, i) => `D-W9-${String(i + 1).padStart(2, "0")}`),
    ...[...decisions.keys()].filter(id => /^D-W9-\d{2}[a-z]$/.test(id)),
    ...Array.from({ length: 26 }, (_, i) => `FN-${String(i + 1).padStart(2, "0")}`),
    ...Array.from({ length: 22 }, (_, i) => `G-${String(i + 1).padStart(2, "0")}`),
    ...Array.from({ length: 61 }, (_, i) => `T-${String(i + 1).padStart(2, "0")}`),
  ];
  return { ids: [...new Set(ids)], decisions, plan };
}

function titleCandidates(text) {
  const titles = [];
  const re = /\b(?:describe|it|test)\s*\(\s*(["'`])([^\r\n]*?)\1/g;
  for (const match of text.matchAll(re)) titles.push(match[2].trim());
  return titles;
}

function containsToken(text, token) {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^A-Za-z0-9])${escaped}(?![A-Za-z0-9])`).test(text);
}

function importsOwner(candidate, source, symbol, sources) {
  const importRe = /\bimport\s+(?:type\s+)?([\s\S]*?)\s+from\s+["']([^"']+)["']/g;
  for (const match of candidate.text.matchAll(importRe)) {
    if (!new RegExp(`\\b${symbol}\\b`).test(match[1])) continue;
    const target = path.resolve(path.dirname(candidate.abs), match[2]);
    const normalizedTarget = target.replace(/\.(?:ts|tsx|js|mjs)$/, "");
    const ownerModule = source.abs.replace(/\.(?:ts|tsx|js|mjs)$/, "");
    if (normalizedTarget === ownerModule) return true;
    const barrel = sources.find(file => [".ts", ".tsx", ".js", ".mjs"].some(ext => `${normalizedTarget}${ext}` === file.abs) || [".ts", ".tsx", ".js", ".mjs"].some(ext => `${normalizedTarget}/index${ext}` === file.abs));
    if (!barrel || !barrel.text.includes(symbol)) continue;
    const reExport = /\bexport\s+\{([^}]+)\}\s+from\s+["']([^"']+)["']/g;
    for (const exported of barrel.text.matchAll(reExport)) {
      if (!new RegExp(`\\b${symbol}\\b`).test(exported[1])) continue;
      const exportTarget = path.resolve(path.dirname(barrel.abs), exported[2]).replace(/\.(?:ts|tsx|js|mjs)$/, "");
      if (exportTarget === ownerModule) return true;
    }
  }
  const exportRe = /\bexport\s+\{([^}]+)\}\s+from\s+["']([^"']+)['"]/g;
  for (const match of candidate.text.matchAll(exportRe)) {
    if (!new RegExp(`\\b${symbol}\\b`).test(match[1])) continue;
    const target = path.resolve(path.dirname(candidate.abs), match[2]).replace(/\.(?:ts|tsx|js|mjs)$/, "");
    if (target === source.abs.replace(/\.(?:ts|tsx|js|mjs)$/, "")) return true;
  }
  return false;
}

function phaseFor(id) {
  if (organizationalChecks.has(id)) return { phase: "ORGANIZACIONAL", why: "checklist documental permitido pela fonte normativa; sem consumidor clínico artificial" };
  const mapped = laterByDecision.get(id);
  if (mapped) return { phase: "F1+", why: `${mapped[0]} — ${mapped[1]}` };
  return { phase: "F0", why: "exigido para a F0; ausência de prova permanece VERMELHO" };
}

function evidenceFor(id, sources, tests) {
  const n = id.startsWith("T-") ? Number(id.slice(2)) : 0;
  const tAnchor = n >= 1 && n <= 13 ? "FN-01"
    : n <= 15 && n >= 14 ? "FN-02" : n <= 17 && n >= 16 ? "FN-03"
      : n <= 21 && n >= 18 ? "FN-04" : n === 22 ? "FN-05"
        : n === 23 ? "FN-06" : n === 24 ? "FN-07" : n === 25 ? "FN-08"
          : n === 26 ? "FN-09" : n === 27 ? "FN-10" : n >= 28 && n <= 29 ? "FN-11"
            : n === 30 ? "FN-12" : n === 31 ? "FN-13"
            : n === 32 ? "FN-14" : n === 33 ? "FN-15" : n === 34 ? "FN-16"
              : n === 35 ? "FN-17" : n === 36 ? "FN-18" : n === 37 ? "FN-19"
                : n === 38 ? "FN-20" : n === 39 ? "FN-21" : n === 40 ? "FN-22"
                  : n === 41 ? "FN-23" : n === 42 ? "FN-24" : n === 43 ? "FN-25"
                    : n === 44 ? "FN-26" : n >= 45 && n <= 53 ? `G-${String(n - 42).padStart(2, "0")}`
                      : n === 54 ? "G-13"
                      : n === 55 ? "G-14" : n >= 56 && n <= 60 ? `G-${String(n - 40).padStart(2, "0")}`
                        : n === 61 ? "G-22" : undefined;
  const anchors = [...new Set([...(linkedEvidence.get(id) ?? []), ...(testAnchors.get(id) ?? []), ...(tAnchor ? [tAnchor] : []), id])];
  const explicitOwner = decisionOwner.get(id);
  const sourceMatches = explicitOwner
    ? sources.filter(file => file.rel === explicitOwner.file && file.text.includes(explicitOwner.symbol))
    : anchors.flatMap(anchor => {
    const preferred = fnSource.get(anchor) ?? gateSource.get(anchor) ?? (anchor.startsWith("G-") ? "src/kernel/harness/gates.ts" : undefined);
    if (preferred) {
      const symbol = fnSymbol.get(anchor) ?? gateSymbol.get(anchor);
      return sources.filter(file => file.rel === preferred && (file.text.includes(anchor) || (symbol && file.text.includes(symbol))));
    }
    const matches = sources.filter(file => file.text.includes(anchor));
    return matches;
  });
  const preferredTests = [decisionTest.get(id), ...anchors.map(anchor => fnTest.get(anchor) ?? gateTest.get(anchor))].filter(Boolean);
  const testMatches = [
    ...preferredTests.map(file => tests.find(candidate => candidate.rel === file)).filter(Boolean),
    ...anchors.flatMap(anchor => tests.filter(file => file.text.includes(anchor))),
  ];
  let owner = null;
  let consumer = null;
  let selectedTest = null;

  for (const source of sourceMatches) {
    const exports = [...source.text.matchAll(/\bexport\s+(?:declare\s+)?(?:async\s+)?(?:function|const|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/g)];
    if (!exports.length) continue;
    const explicitSymbol = explicitOwner?.symbol ?? anchors.map(anchor => fnSymbol.get(anchor) ?? gateSymbol.get(anchor)).find(symbol => symbol && source.text.includes(symbol));
    const anchor = anchors.find(value => source.text.includes(value));
    const offset = explicitSymbol ? source.text.indexOf(explicitSymbol) : source.text.indexOf(anchor);
    const chosen = exports.reduce((best, current) => {
      const candidate = Math.abs(current.index - offset);
      const distance = Math.abs(best.index - offset);
      return candidate < distance ? current : best;
    });
    owner = { file: source.rel, symbol: explicitSymbol ?? chosen[1] };
    const consumerFile = consumerOverride.get(id) ?? functionConsumer.get(id);
    consumer = consumerFile?.startsWith("tests/")
      ? tests.find(candidate => candidate.rel === consumerFile)
      : consumerFile ? sources.find(candidate => candidate.rel === consumerFile) : sources.find(candidate => {
      return candidate.abs !== source.abs && importsOwner(candidate, source, explicitSymbol ?? chosen[1], sources);
    });
    if (consumer) consumer = { file: consumer.rel, testConsumer: consumer.rel.startsWith("tests/") };
    break;
  }
  for (const candidate of testMatches) {
    if (!candidate || (!anchors.some(anchor => containsToken(candidate.text, anchor)) && decisionTest.get(id) !== candidate.rel)) continue;
    const titles = titleCandidates(candidate.text);
    if (titles.length) {
      const override = testTitleOverride.get(id);
      if (override && candidate.text.includes(override)) {
        selectedTest = { file: candidate.rel, title: override };
        break;
      }
      const matchingTitle = titles.find(title => anchors.some(anchor => containsToken(title, anchor)));
      const directIdTitle = titles.find(title => containsToken(title, id));
      const hasExplicitTitle = directIdTitle || matchingTitle;
      if (!hasExplicitTitle && decisionTest.get(id) !== candidate.rel) continue;
      selectedTest = { file: candidate.rel, title: directIdTitle ?? matchingTitle };
      if (!selectedTest.title && decisionTest.get(id) === candidate.rel) selectedTest.title = titles[0];
      break;
    }
  }
  if (id === "G-04" || id === "T-46") {
    owner = { file: "tests/prompts/prompts.test.ts", symbol: "G-04" };
    consumer = { file: "package.json" };
    selectedTest = { file: "tests/prompts/prompts.test.ts", title: "G-04 cada prompt repete contrato universal sem números de corte clínico" };
  }
  if (id === "D-W5-09") {
    owner = { file: "scripts/check-boundaries.mjs", symbol: "RULES" };
    consumer = { file: "package.json", testConsumer: false };
    selectedTest = { file: "tests/kernel/adv013-fronteiras.test.ts", title: "ADV-013 · check-boundaries rejeita ${vetor} fora de gateway/llm" };
  }
  const runtimeAnchor = [...new Set([id, ...(linkedEvidence.get(id) ?? []), ...(testAnchors.get(id) ?? []), ...(tAnchor ? [tAnchor] : [])])]
    .find(anchor => testConsumerRuntime.has(anchor));
  const runtimePhase = runtimeAnchor ? testConsumerRuntime.get(runtimeAnchor) : undefined;
  const useTestConsumer = forceTestConsumer.has(id) || anchors.some(anchor => forceTestConsumer.has(anchor));
  if (selectedTest && runtimePhase && useTestConsumer) {
    consumer = { file: selectedTest.file, testConsumer: true, runtimePhase };
  } else if (consumer && runtimePhase && consumer.file === "src/rules/index.ts") {
    consumer = { ...consumer, runtimePhase };
  }
  return { owner, consumer, test: selectedTest };
}

function phaseEvidence(id, entry) {
  if (id === "G-21") return { phase: "F1+", why: "R-15 marca TrialMatch como futuro; Q48/R-13 mantém trials fora da v1" };
  if (id === "T-35") return { phase: "F1+", why: "R-12 K-20: jornada clínica CTCAE em F1; núcleo CTCAE v6 tipado e testado em F0, sem ativação clínica automática" };
  if (id === "T-36") return { phase: "F1+", why: "R-12 K-20: jornada clínica RECIST em F1; núcleo tipado conservado em F0" };
  if (id.startsWith("FN-") || id.startsWith("G-") || id.startsWith("T-")) {
    return { phase: "F0", why: "docs/FECHAMENTO-F0.md §2 e PLANO-FINAL R-12/R-15/R-28" };
  }
  if (entry.source === DECISIONS) {
    const phase = phaseFor(id);
    return { phase: phase.phase, why: phase.why };
  }
  return { phase: "F0", why: "fonte normativa da decisão; sem adiamento identificado" };
}

function suggestedOwner(id) {
  const anchor = [...(linkedEvidence.get(id) ?? [])].find(value => value.startsWith("FN-") || value.startsWith("G-"));
  const actualId = id.startsWith("FN-") || id.startsWith("G-") || id.startsWith("T-") ? id : anchor;
  if (actualId?.startsWith("FN-")) {
    const n = Number(actualId.slice(3));
    if (n <= 16) return "sugerido R-28 F0/E3 (Grok), rules; F0 T por E5 (Kimi)";
    return "sugerido R-25 nível 1 para a função/kernel; F0 T por E5 (Kimi)";
  }
  if (actualId?.startsWith("G-")) return "sugerido R-25 nível 1, kernel/harness; teste F0 por E5 (Kimi)";
  if (id.startsWith("T-")) return "sugerido R-28 F0/E5 (Kimi), teste/fixture; função dona conforme R-12";
  if (id.startsWith("Q") || id.startsWith("A") || id.startsWith("D-W")) return "sugerido R-25 nível 1; contrato/função da rubrica normativa";
  return "sugerido Astra em C2 conforme a faixa funcional de R-28";
}

function q50AcceptanceErrors(root) {
  try {
    const receipt = JSON.parse(fs.readFileSync(path.join(root, "docs/f0-fecha/Q50-ACEITE.json"), "utf8"));
    const errors = [];
    if (receipt.schemaVersion !== 1 || receipt.reviewStatus !== "SEM_ALTO_ABERTO" || receipt.reviewer !== "Claude"
      || !/^https:\/\/github\.com\/silasjuba-del\/OncoGlobal\/pull\/\d+$/.test(receipt.prUrl)
      || receipt.headBranch !== "f0/w1-integrado" || receipt.baseBranch !== "main"
      || !/^[a-f0-9]{40}$/.test(receipt.reviewedCodeHead)) errors.push("recibo Q50 incompleto");
    const refs = Array.isArray(receipt.evidence) ? receipt.evidence : [];
    for (const required of ["docs/f0-fecha/CLAUDE-REAUDITORIA-D1.md", "docs/F0-DEMO.md"])
      if (!refs.some(ref => ref.path === required)) errors.push(`evidência Q50 ausente: ${required}`);
    if (refs.filter(ref => /^docs\/f0-fecha\/demo\/\d{2}-[^/]+\.png$/.test(ref.path)).length !== 9)
      errors.push("Q50 exige as nove capturas revisadas");
    for (const ref of refs) {
      if (typeof ref.path !== "string" || !ref.path.startsWith("docs/") || ref.path.split("/").includes("..")
        || !/^[a-f0-9]{64}$/.test(ref.sha256)) { errors.push("referência Q50 inválida"); continue; }
      let bytes = fs.readFileSync(path.join(root, ref.path));
      if (ref.hashMode === "utf8-lf") bytes = Buffer.from(new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes).replaceAll("\r\n", "\n"));
      else if (ref.hashMode !== "raw") { errors.push(`modo Q50 inválido: ${ref.path}`); continue; }
      if (createHash("sha256").update(bytes).digest("hex") !== ref.sha256) errors.push(`evidência Q50 alterada: ${ref.path}`);
    }
    return errors;
  } catch { return ["recibo ou evidência Q50 ausente/ilegível"]; }
}

function rowFor(id, requirement, sources, tests, root) {
  const entry = requirement.decisions.get(id) ?? requirement.plan.get(id) ?? { source: DECISIONS, line: 0, summary: `ID ${id} sem descrição literal na fonte principal` };
  const phase = phaseEvidence(id, entry);
  const evidence = evidenceFor(id, sources, tests);
  let contract = entry.line ? `${entry.source}#L${entry.line}` : `${entry.source} (referência literal ausente)`;
  if (id === "Q05") contract += "; docs/PLANO-FINAL-ONCOGLOBAL-v1.1.md#L545 (SQLite local no escopo F0)";
  if (id === "Q11") contract += "; docs/PLANO-FINAL-ONCOGLOBAL-v1.1.md#L427 (R-14) e contrato Plano compartilhado";
  if (id === "D-W9-75") return [id, cleanSummary(entry.summary), `${contract}; ver D-W9-75a e D-W9-75b`,
    "não se aplica: item-pai", "não se aplica: subitens com fase própria", "—", "F0",
    "N-A — decomposição: 75a núcleo CTCAE F0; 75b canal F2, sem antecipar curadoria"];
  if (phase.phase === "ORGANIZACIONAL") {
    const check = organizationalChecks.get(id);
    return [id, cleanSummary(entry.summary), contract, "não se aplica: decisão de governança/referência documental", "docs/DECISOES.md", `checklist:${check}`, phase.phase, `N-A — ${phase.why}`];
  }
  if (phase.phase === "F1+") {
    const ownerText = evidence.owner ? `${evidence.owner.file}:${evidence.owner.symbol}` : "PENDENTE: dono de implementação não localizado";
    const consumerText = evidence.consumer?.file ?? "PENDENTE: consumidor de fase futura não localizado";
    const testText = evidence.test ? `${evidence.test.file}:${evidence.test.title}` : "PENDENTE: teste observável de fase futura não localizado";
    return [id, cleanSummary(entry.summary), `${contract}; ${phase.why}`, ownerText, consumerText, testText, phase.phase, `N-A — ${phase.why}`];
  }
  if (supersededDecision.has(id)) {
    if (id === "D-W9-52") {
      const testText = evidence.test ? `${evidence.test.file}:${evidence.test.title}` : "PENDENTE: teste da substituta não localizado";
      return [id, cleanSummary(entry.summary), `${contract}; SUPERADA por D-W9-57`, evidence.owner ? `${evidence.owner.file}:${evidence.owner.symbol}` : "PENDENTE: substituta D-W9-57", evidence.consumer?.file ?? "PENDENTE: consumidor da substituta não localizado", testText, "F0", `N-A — ${supersededDecision.get(id)}`];
    }
    return [id, cleanSummary(entry.summary), `${contract}; substituída por A11`, "scripts/backup.mjs:criarBackup", "tests/backup/backup.test.ts", evidence.test ? `${evidence.test.file}:${evidence.test.title}` : "tests/backup/backup.test.ts:N20 backup e restauração cifrados", "F0", `N-A — ${supersededDecision.get(id)}`];
  }
  if (id === "D-W9-22" || id === "D-W9-34") {
    return [id, cleanSummary(entry.summary), `${contract}; decomposição detalhada em subitens com fase própria`,
      "não se aplica: item-pai de subitens", "não se aplica: ver subitens na matriz", "—", "F0",
      "N-A — item-pai preservado; cada subitem (a–i / a–f) é rastreado separadamente abaixo"];
  }
  if (id === "Q50") {
    const testText = multiTestEvidence.get(id).map(([file, title]) => `${file}:${title}`).join(" || ");
    const pending = q50AcceptanceErrors(root);
    return [id, cleanSummary(entry.summary), `${contract}; PLANO-FINAL §5 exige testes positivos/negativos/borda + PR revisado + demo`,
      "não se aplica: gate de aceitação da fase", "não se aplica: PR e demo são evidência de fase",
      testText, "F0", pending.length ? `VERMELHO — GATE_FASE_PENDENTE: ${pending.join("; ")}`
        : "VERDE — PR existente e diff revisado pelo Claude; demo executada; recibo Q50-ACEITE.json fixa os artefatos. CI e merge humano são portões separados, não presumidos por esta linha"];
  }
  const complete = Boolean(evidence.owner && evidence.consumer && evidence.test);
  const ownerText = evidence.owner ? `${evidence.owner.file}:${evidence.owner.symbol}` : `PENDENTE: arquivo:símbolo; ${suggestedOwner(id)}`;
  const consumerText = evidence.consumer
    ? evidence.consumer.testConsumer
      ? `${evidence.consumer.file} (consumidor de teste F0${evidence.consumer.runtimePhase ? `; integração ${evidence.consumer.runtimePhase} não entregue` : ""})`
      : `${evidence.consumer.file}${evidence.consumer.runtimePhase ? ` (barrel/API F0; integração ${evidence.consumer.runtimePhase} não entregue)` : ""}`
    : "PENDENTE: consumidor em produção não localizado";
  const testList = multiTestEvidence.get(id);
  const testText = testList ? testList.map(([file, title]) => `${file}:${title}`).join(" || ") : evidence.test ? `${evidence.test.file}:${evidence.test.title}` : "PENDENTE: teste observável não localizado";
  const missing = [!evidence.owner && "arquivo:símbolo dono", !evidence.consumer && "consumidor", !evidence.test && "teste observável"].filter(Boolean);
  const pendingReason = mappingPending.get(id);
  const proof = proofByDecision.get(id) ?? `prova serial A6 em ${A6_HEAD} (ancestral direto do HEAD da worktree; A6 só é evidência para os arquivos que essa bateria executou)`;
  const state = complete && !pendingReason
    ? `VERDE — ${evidence.consumer?.runtimePhase ? `núcleo F0 provado; integração ${evidence.consumer.runtimePhase} não entregue; ` : ""}${proof}`
    : `VERMELHO — ${residualClass.get(id) ?? "PENDENTE_DE_MAPEAMENTO"}: ${pendingReason ?? missing.join(", ")}; esta linha não conclui ausência do produto`;
  return [id, cleanSummary(entry.summary), contract, ownerText, consumerText, testText, phase.phase, state];
}

function pipeCell(value) {
  return String(value).replaceAll("|", "\\|").replace(/\r?\n/g, " ");
}

export function buildMatrix(root = defaultRoot) {
  const requirement = requiredIds(root);
  const sources = productionSources(root);
  const tests = walk(path.join(root, "tests"), root, file => /\.(?:(?:test|spec)\.(?:ts|tsx|js|mjs)|adv\.ts)$/.test(file));
  const rows = requirement.ids.map(id => rowFor(id, requirement, sources, tests, root));
  const green = rows.filter(row => row[7].startsWith("VERDE")).length;
  const red = rows.filter(row => row[7].startsWith("VERMELHO")).length;
  const na = rows.length - green - red;
  const out = [
    "# Matriz de rastreabilidade F0 — R-34",
    "",
    "> Matriz final do integrado: C2/E6b HTTP/SQLite, ConsultaPersistida, Flash durável, G-06, G-22, Q09 e D-W9-41. Evidência vigente e limites de cada rodada em docs/f0-fecha/STATUS.md; aceite documental Q50 possui recibo próprio.",
    `> Estado observado na geração: ${green} VERDE com fonte, consumidor e teste rastreável; ${red} VERMELHO com causa específica registrada; ${na} N-A por adiamento normativo, decomposição, substituição ou checklist organizacional. N-A não significa implementado; VERMELHO não equivale automaticamente a defeito de produto.`,
    "",
    "| Decisão | Resumo (≤12 palavras) | Contrato/fonte | Dono (arquivo:símbolo) | Consumidor (arquivo) | Teste observável (arquivo:nome) | Fase | Estado |",
    "|---|---|---|---|---|---|---|---|",
    ...rows.map(row => `| ${row.map(pipeCell).join(" | ")} |`),
    "",
    "## Lacunas F0 — VERMELHO",
    "",
    ...rows.filter(row => row[7].startsWith("VERMELHO")).map(row => `- **${row[0]}** — ${row[7].replace(/^VERMELHO — /, "")}; dono/sugestão: ${row[3].replace(/^PENDENTE: arquivo:símbolo; /, "")}; consumidor: ${row[4]}; teste: ${row[5]}.`),
    "",
    "## Checklist organizacional (N-A)",
    "",
    "| ID | Verificação documental | Evidência |",
    "|---|---|---|",
    ...[...organizationalChecks].map(([id, check]) => {
      const entry = requirement.decisions.get(id) ?? requirement.plan.get(id);
      return `| ${id} | ${cleanSummary(entry?.summary ?? id)} | ${check} |`;
    }),
    "",
    "## Limites da evidência",
    "",
    "- A6 executou em `72ce726`: 2.240/2.240 testes regulares, 240/240 red team, 41/41 W8, tsc, fronteiras e corpus; seu HEAD é ancestral do checkout desta worktree.",
    "- `PENDENTE_DE_MAPEAMENTO` é falha de rastreabilidade, não conclusão de que a funcionalidade está ausente. Vermelhos com causa confirmada descrevem a evidência específica; os demais exigem revisão em C.",
    "- `VERDE` exige símbolo, import/reexport ou contrato consumidor e teste com nome existente; isso não substitui revisão semântica do caso nem reataque após mudanças em C.",
    "- Q50 exige E6b e recibo verificável de PR, revisão independente e demo. O recibo fixa arquivos por SHA; não presume CI verde, merge realizado nem aprovação clínica. E6b sozinha não fecha a decisão.",
    "- Falhas históricas da matriz foram preservadas em C2-L1 e C1-L1. O gate `red === 0` permanece obrigatório; é rastreabilidade, não substituto da bateria funcional final.",
    "- Q11 é VERDE para o núcleo F0: testes consumidores cobrem tabela Maestro e executor ORK separadamente conforme R-14/R-28; isso não afirma composição de runtime entre módulos.",
    "- C2 integra ConsultaPersistida, Flash durável, CartaoTransversal, G-06, G-22 e Q09. Demo real em docs/F0-DEMO.md; bateria integral, auditorias e CI devem ser conferidos em STATUS antes de merge.",
    "",
  ].join("\n");
  return out;
}

function parseMatrix(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith("| ") || line.startsWith("| Decisão") || line.startsWith("|---")) continue;
    const cells = line.slice(2, -1).split(/(?<!\\)\|/).map(cell => cell.trim().replaceAll("\\|", "|"));
    if (cells.length === 8) rows.push(cells);
  }
  return rows;
}

export function validateMatrix(root = defaultRoot) {
  const requirement = requiredIds(root);
  const matrixPath = path.join(root, MATRIX);
  const text = fs.readFileSync(matrixPath, "utf8");
  const rows = parseMatrix(text);
  const sources = productionSources(root);
  const errors = [];
  const ids = rows.map(row => row[0]);
  const rowCounts = new Map(ids.map(id => [id, ids.filter(candidate => candidate === id).length]));
  for (const id of requirement.ids) if (!rowCounts.has(id)) errors.push(`linha exigida ausente: ${id}`);
  for (const [id, count] of rowCounts) if (count !== 1) errors.push(`${id}: ${count} linhas (esperada 1)`);
  for (const row of rows) {
    const [id, summary, contract, owner, consumer, test, phase, state] = row;
    if (summary.split(/\s+/).filter(Boolean).length > 12) errors.push(`${id}: resumo excede 12 palavras`);
    if (!["F0", "F1+", "ORGANIZACIONAL"].includes(phase)) errors.push(`${id}: fase inválida: ${phase}`);
    if (!/^(?:VERDE|VERMELHO|N-A) —/.test(state)) errors.push(`${id}: estado sem classificação explícita`);
    const sourceRef = contract.match(/^([^;]+)#L(\d+)/);
    if (sourceRef) {
      const sourcePath = path.join(root, sourceRef[1]);
      if (!fs.existsSync(sourcePath)) errors.push(`${id}: fonte normativa inexistente: ${sourceRef[1]}`);
      else if (fs.readFileSync(sourcePath, "utf8").split(/\r?\n/).length < Number(sourceRef[2])) errors.push(`${id}: linha normativa inexistente: ${contract}`);
    }
    if (!owner.startsWith("PENDENTE") && !owner.startsWith("não se aplica")) {
      const [ownerFile, symbol] = owner.split(":");
      if (!ownerFile || !fs.existsSync(path.join(root, ownerFile))) errors.push(`${id}: arquivo dono inexistente: ${ownerFile}`);
      else if (!symbol || !fs.readFileSync(path.join(root, ownerFile), "utf8").includes(symbol)) errors.push(`${id}: símbolo dono não encontrado: ${owner}`);
    }
    const consumerPath = consumer.split(" (")[0];
    if (!consumer.startsWith("PENDENTE") && !consumer.startsWith("não se aplica") && !fs.existsSync(path.join(root, consumerPath))) errors.push(`${id}: consumidor inexistente: ${consumerPath}`);
    if (test !== "—" && !test.startsWith("PENDENTE") && !test.startsWith("checklist:")) {
      const testRefs = test.split(/\s+\|\|\s+/).map(reference => {
        const colonAt = reference.indexOf(":");
        return { file: reference.slice(0, colonAt), title: reference.slice(colonAt + 1) };
      });
      for (const testRef of testRefs) {
        if (!testRef.file || !fs.existsSync(path.join(root, testRef.file))) errors.push(`${id}: arquivo de teste inexistente: ${testRef.file}`);
        else if (!testRef.title || !fs.readFileSync(path.join(root, testRef.file), "utf8").includes(testRef.title)) errors.push(`${id}: nome de teste inexistente: ${testRef.file}:${testRef.title}`);
      }
    }
    if (phase === "F0" && state.startsWith("VERDE")) {
      if (id === "Q50") {
        errors.push(...q50AcceptanceErrors(root));
        if (owner !== "não se aplica: gate de aceitação da fase" || consumer !== "não se aplica: PR e demo são evidência de fase")
          errors.push("Q50: não representar aceite documental como consumidor de produto");
        continue;
      }
      if (owner.startsWith("PENDENTE") || consumer.startsWith("PENDENTE") || test.startsWith("PENDENTE")) errors.push(`${id}: VERDE F0 sem dono, consumidor e teste`);
      const [ownerFile, symbol] = owner.split(":");
      const ownerEntry = sources.find(file => file.rel === ownerFile);
      const consumerPath = consumer.split(" (")[0];
      const consumerEntry = sources.find(file => file.rel === consumerPath);
      const consumerTest = consumerPath.startsWith("tests/");
      const planoFile = sources.find(file => file.rel === "src/orchestration/tipos.ts");
      const q11Bridge = id === "Q11" && ownerEntry && consumerEntry && planoFile
        && importsOwner(ownerEntry, planoFile, "Plano", sources) && importsOwner(consumerEntry, planoFile, "Plano", sources);
      let staticGate = false;
      if (["G-04", "T-46", "D-W5-09"].includes(id) && consumerPath === "package.json" && fs.existsSync(path.join(root, ".github/workflows/verify.yml"))) {
        const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
        const workflow = fs.readFileSync(path.join(root, ".github/workflows/verify.yml"), "utf8");
        staticGate = id === "D-W5-09"
          ? String(packageJson.scripts?.["check:boundaries"] ?? "").includes("scripts/check-boundaries.mjs")
            && String(packageJson.scripts?.verify ?? "").includes("npm run check:boundaries")
            && workflow.includes("npm run verify")
          : String(packageJson.scripts?.test ?? "").includes("vitest run") && workflow.includes("npm run verify");
      }
      if (["G-04", "T-46", "D-W5-09"].includes(id) && !staticGate) errors.push(`${id}: gate estático não está ligado ao runner/CI`);
      else if (!["G-04", "T-46", "D-W5-09"].includes(id)) {
        const consumerLinked = Boolean(ownerEntry) && (consumerTest
          ? fs.readFileSync(path.join(root, consumerPath), "utf8").includes(symbol)
          : Boolean(consumerEntry && (q11Bridge || importsOwner(consumerEntry, ownerEntry, symbol, sources))));
        if (!consumerLinked) errors.push(`${id}: consumidor não importa/reexporta o símbolo ou não é consumidor de teste F0: ${consumer} -> ${owner}`);
      }
    }
    if (phase === "ORGANIZACIONAL" && !organizationalChecks.has(id)) errors.push(`${id}: checklist organizacional não permitido`);
    if (phase === "F1+" && (!state.startsWith("N-A —") || !/(?:R-\d+|K-\d+|docs\/FECHAMENTO-F0|FECHAMENTO-F0 §|PLANO-FINAL §F\d+)/.test(contract))) errors.push(`${id}: F1+ sem adiamento normativo rastreável`);
  }
  const gapSection = text.split("## Lacunas F0 — VERMELHO")[1]?.split("## Checklist organizacional")[0] ?? "";
  for (const row of rows.filter(candidate => candidate[7].startsWith("VERMELHO"))) {
    if (!gapSection.includes(`- **${row[0]}** —`)) errors.push(`${row[0]}: lacuna VERMELHO ausente da lista final`);
  }
  const orgIds = rows.filter(row => row[6] === "ORGANIZACIONAL").map(row => row[0]).sort();
  const expectedOrgIds = [...organizationalChecks.keys()].sort();
  if (orgIds.join(",") !== expectedOrgIds.join(",")) errors.push(`checklist organizacional esperado ${expectedOrgIds.join(",")}; encontrado ${orgIds.join(",")}`);
  return { errors, required: requirement.ids.length, rows: rows.length, green: rows.filter(row => row[7].startsWith("VERDE")).length, red: rows.filter(row => row[7].startsWith("VERMELHO")).length, na: rows.filter(row => row[7].startsWith("N-A")).length };
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const rootArg = process.argv.slice(2).find(argument => !argument.startsWith("--"));
  const root = path.resolve(rootArg ?? defaultRoot);
  if (process.argv.includes("--write")) {
    fs.writeFileSync(path.join(root, MATRIX), buildMatrix(root), "utf8");
    process.stdout.write(`Matriz gravada em ${MATRIX}\n`);
  } else {
    const result = validateMatrix(root);
    process.stdout.write(`Linhas=${result.rows}/${result.required}; VERDE=${result.green}; VERMELHO=${result.red}; N-A=${result.na}\n`);
    if (result.errors.length) {
      process.stderr.write(`${result.errors.map(error => `- ${error}`).join("\n")}\n`);
      process.exitCode = 1;
    }
  }
}
