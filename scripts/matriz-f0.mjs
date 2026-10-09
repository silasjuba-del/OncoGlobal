import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(here, "..");
const PLAN = "docs/PLANO-FINAL-ONCOGLOBAL-v1.1.md";
const DECISIONS = "docs/DECISOES.md";
const MATRIX = "docs/MATRIZ-RASTREABILIDADE-F0.md";
const A6_HEAD = "72ce726e92bf059eb9bde394c0b070e9389fe85f";

const laterByDecision = new Map([
  ["Q14", ["F1", "R-18, caixa universal e roteamento na consulta"]],
  ["Q15", ["F1", "R-18, voz e merge na consulta"]],
  ["Q16", ["F1", "R-18, ciclo de áudio da consulta"]],
  ["Q19", ["F1", "R-16, pré-consulta"]],
  ["Q20", ["F1", "R-17, bundles adicionais além da primeira consulta; E6b trata a jornada completa separadamente"]],
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
  ["D-W5-10", ["F4", "R-22, lote APAC"]],
  ["D-W9-19", ["F4", "R-22, APAC e antiglosa"]],
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
  ["Q06", { file: "src/contracts/operacao.ts", symbol: "ConfirmarBloco" }],
  ["Q08", { file: "src/app/oncoassist.ts", symbol: "criarOncoassistJev" }],
  ["Q11", { file: "src/orchestration/maestro.ts", symbol: "maestro" }],
  ["Q17", { file: "src/ui/consulta/BarraFechamento.tsx", symbol: "BarraFechamento" }],
  ["Q18", { file: "src/ui/consulta/BarraFechamento.tsx", symbol: "BarraFechamento" }],
  ["Q20", { file: "src/modules/consulta/bundles.ts", symbol: "montarBundle" }],
  ["T-41", { file: "src/rules/identidade.ts", symbol: "resolverIdentidade" }],
  ["G-06", { file: "src/ui/consulta/BannerE1.tsx", symbol: "BannerE1" }],
]);
const consumerOverride = new Map([
  ["Q05", "src/app/oncoassistLocal.ts"],
  ["Q06", "src/server/rotas.ts"],
  ["Q08", "src/app/oncoassistLocal.ts"],
  ["Q11", "src/orchestration/ork.ts"],
  ["Q17", "src/ui/telas/TelaConsulta.tsx"],
  ["Q18", "src/ui/telas/TelaConsulta.tsx"],
  ["G-06", "src/ui/telas/TelaConsulta.tsx"],
  ["G-09", "src/server/rotas.ts"],
  ["G-19", "src/server/rotas.ts"],
  ["G-20", "src/app/oncoassistLocal.ts"],
  ["G-01", "src/kernel/identity/filaVinculo.ts"],
  ["T-41", "src/kernel/identity/filaVinculo.ts"],
  ["G-16", "src/kernel/harness/gates.ts"],
  ["G-17", "tests/corpus/loader.test.ts"],
]);
const multiTestEvidence = new Map([
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
]);
const mappingPending = new Map([
  ["Q11", "o checkout testa Maestro e ORK, mas não localiza uma chamada de produção que encaminhe maestro(evento) para executarOrk(plano)"],
  ["Q20", "os quatro bundles estão declarados e testados no módulo, mas nenhum consumidor de produção chama montarBundle no checkout"],
  ["Q50", "o teste E6b HTTP/SQLite real não está nesta worktree; testes de UI sintética não provam reconciliação antes da confirmação"],
  ["D-W9-78", "a missão atual inclui Flash no F0; não usar evidência futura de L4 para fechar modelo padrão e prazo visível"],
  ["G-06", "BannerE1 e TelaConsulta provam alerta visível na UI sintética e K-12 separa E1 da evolução; falta prova T-48 de bloqueio de documento e destaque na folha operacional em percurso real"],
  ["T-48", "prova parcial: banner E1 visível e K-12 separa templates; falta o positivo/negativo T-48 do bloqueio de documento sem impedir a tela"],
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
  ["G-09", "src/kernel/harness/gates.ts"], ["G-19", "src/server/autorizacao.ts"],
  ["G-20", "src/kernel/gateway/gateway.ts"],
  ["G-16", "src/kernel/harness/ownership.ts"], ["G-17", "src/kernel/corpus/loader.ts"],
]);
const gateSymbol = new Map([["G-01", "resolverIdentidade"], ["G-09", "g09PtDeBiopsia"], ["G-16", "g16Owner"], ["G-17", "carregarDiretorio"], ["G-19", "autorizarSaida"], ["G-20", "criarGateway"]]);
const functionConsumer = new Map([
  ["FN-22", "src/server/leituras.ts"], ["FN-23", "src/orchestration/pipeline-extracao.ts"],
  ["FN-20", "src/server/rotas.ts"], ["FN-18", "src/server/leituras.ts"],
]);
const forceTestConsumer = new Set(["FN-10", "FN-11", "FN-13", "FN-17", "FN-19", "FN-21", "FN-25", "FN-26"]);
const testConsumerRuntime = new Map([
  ["FN-10", "F4"], ["FN-11", "F4"], ["FN-13", "F4"], ["FN-16", "F1"],
  ["FN-17", "F1"], ["FN-19", "F1"], ["FN-21", "F2"], ["FN-25", "F1"], ["FN-26", "F3"],
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
decisionTest.set("Q05", "tests/ledger/ledger.test.ts");
decisionTest.set("Q06", "tests/contracts/contratos.test.ts");
decisionTest.set("Q08", "tests/oncoassist-jev/oncoassist.test.ts");
decisionTest.set("Q11", "tests/orchestration/ork.test.ts");
decisionTest.set("Q17", "tests/ui/fechamento.test.tsx");
decisionTest.set("Q18", "tests/ui/fechamento.test.tsx");
decisionTest.set("Q20", "tests/modules/bundles.test.ts");
decisionTest.set("G-06", "tests/ui/banner-e1.test.tsx");
decisionTest.set("T-48", "tests/ui/banner-e1.test.tsx");
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
  ["Q05", "N07 salva payload inerte e o recupera ao reabrir sem promovê-lo"],
  ["Q06", "C-16 ConfirmarBloco (INV-04, A1, K-04)"],
  ["Q08", "envia só texto desidentificado e devolve proposta com hash do original"],
  ["Q11", "Maestro só oferece tabela fixa sem impressão no validar"],
  ["Q17", "percurso de rotina ≤ 5 cliques; validar não imprime; payload estrito"],
  ["Q18", "percurso de rotina ≤ 5 cliques; validar não imprime; payload estrito"],
  ["G-06", "não fecha; reconhecer deixa o banner e o horário"],
  ["T-48", "não fecha; reconhecer deixa o banner e o horário"],
  ["Q20", "declara os quatro bundles da decisão"],
  ["T-41", "T-41 CNS exato liga; nome sozinho jamais; nome+nascimento só candidato"],
  ["G-19", "CP-001 · positivo: artefato ASSINADO do mesmo paciente/encontro/versão autoriza IMPRIMIR"],
  ["G-20", "ADV-001 · RESISTIU: replay no mesmo processo não duplica efeito"],
  ["G-16", "GROK-10 g16Owner"], ["G-17", "validarRuleset (G-17)"],
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
const supersededDecision = new Map([["Q58", "substituída por A11: somente HD externo local cifrado, chave de recuperação fora do PC" ]]);

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
  if (["Q01", "Q02", "Q03", "Q51"].includes(id)) return { phase: "ORGANIZACIONAL", why: "checklist documental permitido pelo GOAL L1" };
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
  if (id === "G-04") {
    owner = { file: "tests/prompts/prompts.test.ts", symbol: "G-04" };
    consumer = { file: "package.json" };
    selectedTest = { file: "tests/prompts/prompts.test.ts", title: "G-04 cada prompt repete contrato universal sem números de corte clínico" };
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
  if (id === "T-35" || id === "T-36") return { phase: "F1+", why: "R-12 K-20: funcionalidade e testes CTCAE/RECIST passam a F1; F0 conserva stub tipado" };
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

function rowFor(id, requirement, sources, tests) {
  const entry = requirement.decisions.get(id) ?? requirement.plan.get(id) ?? { source: DECISIONS, line: 0, summary: `ID ${id} sem descrição literal na fonte principal` };
  const phase = phaseEvidence(id, entry);
  const evidence = evidenceFor(id, sources, tests);
  let contract = entry.line ? `${entry.source}#L${entry.line}` : `${entry.source} (referência literal ausente)`;
  if (id === "Q05") contract += "; docs/PLANO-FINAL-ONCOGLOBAL-v1.1.md#L545 (SQLite local no escopo F0)";
  if (id === "Q11") contract += "; docs/PLANO-FINAL-ONCOGLOBAL-v1.1.md#L427 (R-14) e contrato Plano compartilhado";
  if (phase.phase === "ORGANIZACIONAL") {
    const check = id === "Q01" ? "confirmar origin remoto e raiz OncoGlobal segundo docs/FECHAMENTO-F0.md §0" : id === "Q02" ? "conferir autoria e writer em docs/ondas/F0-FECHAMENTO-ASTRA.md §2" : id === "Q03" ? "confirmar CANONICA somente por ordem expressa em docs/FECHAMENTO-F0.md §2" : "conferir roster e faixa em docs/ondas/F0-FECHAMENTO-ASTRA.md §7";
    return [id, cleanSummary(entry.summary), contract, "não se aplica: decisão de governança", "docs/DECISOES.md", `checklist:${check}`, phase.phase, `N-A — ${phase.why}`];
  }
  if (phase.phase === "F1+") {
    const ownerText = evidence.owner ? `${evidence.owner.file}:${evidence.owner.symbol}` : "PENDENTE: dono de implementação não localizado";
    const consumerText = evidence.consumer?.file ?? "PENDENTE: consumidor de fase futura não localizado";
    const testText = evidence.test ? `${evidence.test.file}:${evidence.test.title}` : "PENDENTE: teste observável de fase futura não localizado";
    return [id, cleanSummary(entry.summary), `${contract}; ${phase.why}`, ownerText, consumerText, testText, phase.phase, `N-A — ${phase.why}`];
  }
  if (supersededDecision.has(id)) {
    return [id, cleanSummary(entry.summary), `${contract}; substituída por A11`, "scripts/backup.mjs:criarBackup", "tests/backup/backup.test.ts", evidence.test ? `${evidence.test.file}:${evidence.test.title}` : "tests/backup/backup.test.ts:N20 backup e restauração cifrados", "F0", `N-A — ${supersededDecision.get(id)}`];
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
  const state = complete && !pendingReason
    ? `VERDE — ${evidence.consumer?.runtimePhase ? `núcleo F0 provado; integração ${evidence.consumer.runtimePhase} não entregue; ` : ""}prova serial A6 em ${A6_HEAD} (ancestral direto do HEAD da worktree)`
    : `VERMELHO — PENDENTE_DE_MAPEAMENTO: ${pendingReason ?? missing.join(", ")}; esta linha não conclui ausência do produto`;
  return [id, cleanSummary(entry.summary), contract, ownerText, consumerText, testText, phase.phase, state];
}

function pipeCell(value) {
  return String(value).replaceAll("|", "\\|").replace(/\r?\n/g, " ");
}

export function buildMatrix(root = defaultRoot) {
  const requirement = requiredIds(root);
  const sources = walk(path.join(root, "src"), root, file => /\.(?:ts|tsx|js|mjs|json)$/.test(file));
  const tests = walk(path.join(root, "tests"), root, file => /\.(?:(?:test|spec)\.(?:ts|tsx|js|mjs)|adv\.ts)$/.test(file));
  const rows = requirement.ids.map(id => rowFor(id, requirement, sources, tests));
  const green = rows.filter(row => row[7].startsWith("VERDE")).length;
  const red = rows.filter(row => row[7].startsWith("VERMELHO")).length;
  const na = rows.length - green - red;
  const out = [
    "# Matriz de rastreabilidade F0 — R-34",
    "",
    "> Fonte normativa: `docs/DECISOES.md`, `docs/PLANO-FINAL-ONCOGLOBAL-v1.1.md`, `docs/FECHAMENTO-F0.md` e `docs/ondas/F0-FECHAMENTO-ASTRA.md`. A prova A6 em `72ce726` é ancestral direto do HEAD `369db84`; vale apenas para arquivos executados naquela bateria. A prova do verificador R-34 está registrada em `docs/f0-fecha/LUNA-1.md`.",
    `> Estado observado na geração: ${green} VERDE com fonte, consumidor e teste rastreável; ${red} VERMELHO PENDENTE_DE_MAPEAMENTO; ${na} N-A com adiamento normativo, substituição ou checklist organizacional. N-A não significa implementado; VERMELHO tampouco prova produto ausente.`,
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
    "| Q01 | Repositório e remote pertencem ao OncoGlobal desta missão. | `docs/DECISOES.md` Q01; `docs/FECHAMENTO-F0.md` §0; registro do remote na evidência L1 |",
    "| Q02 | Writer e autoridade da missão estão definidos. | `docs/ondas/F0-FECHAMENTO-ASTRA.md` §2 |",
    "| Q03 | Atualização da CANONICA depende de ordem expressa. | `docs/FECHAMENTO-F0.md` §2 e §4b |",
    "| Q51 | Roster e limites da execução estão descritos. | `docs/ondas/F0-FECHAMENTO-ASTRA.md` §7 |",
    "",
    "## Limites da evidência",
    "",
    "- A6 executou em `72ce726`: 2.240/2.240 testes regulares, 240/240 red team, 41/41 W8, tsc, fronteiras e corpus; seu HEAD é ancestral do checkout desta worktree.",
    "- `PENDENTE_DE_MAPEAMENTO` é falha de rastreabilidade, não conclusão de que a funcionalidade está ausente. Cada caso vermelho precisa ser revisto em C para distinguir elo não localizado de lacuna real de F0.",
    "- `VERDE` exige símbolo, import/reexport ou contrato consumidor e teste com nome existente; isso não substitui revisão semântica do caso nem reataque após mudanças em C.",
    "- `tests/ui/fechamento.test.tsx` prova a interação da UI sintética para Q17/Q18; não prova a montagem HTTP/SQLite de E6b. Q50 permanece VERMELHO até essa jornada real, com o conflito pré-confirmação relatado pela Astra para C2.",
    "- `tests/f0-fecha/matriz.test.ts` verifica cobertura dos IDs, unicidade, referências e vínculo consumidor; não valida completude funcional da F0. A execução está registrada em `docs/f0-fecha/LUNA-1.md`.",
    "- Q11 continua vermelho porque os testes de Maestro/ORK não demonstram chamada de produção entre ambos. Q50/E6b continua vermelho: a evidência L2 reportou conflito de labs de duas fontes falso antes da confirmação; a correção C2 ainda não foi provada nesta base.",
    "- D-W9-78 continua vermelho até evidência integrada de modelo padrão e prazo visível na Flash. G-06/T-48 tem evidência parcial de banner e separação de templates, mas falta prova do gate em documento/folha operacional no percurso real.",
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
  const sources = walk(path.join(root, "src"), root, file => /\.(?:ts|tsx|js|mjs|json)$/.test(file));
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
      if (owner.startsWith("PENDENTE") || consumer.startsWith("PENDENTE") || test.startsWith("PENDENTE")) errors.push(`${id}: VERDE F0 sem dono, consumidor e teste`);
      const [ownerFile, symbol] = owner.split(":");
      const ownerEntry = sources.find(file => file.rel === ownerFile);
      const consumerPath = consumer.split(" (")[0];
      const consumerEntry = sources.find(file => file.rel === consumerPath);
      const consumerTest = consumerPath.startsWith("tests/");
      const planoFile = sources.find(file => file.rel === "src/orchestration/tipos.ts");
      const q11Bridge = id === "Q11" && ownerEntry && consumerEntry && planoFile
        && importsOwner(ownerEntry, planoFile, "Plano", sources) && importsOwner(consumerEntry, planoFile, "Plano", sources);
      let g04Static = false;
      if (id === "G-04" && consumerPath === "package.json" && fs.existsSync(path.join(root, ".github/workflows/verify.yml"))) {
        const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
        const workflow = fs.readFileSync(path.join(root, ".github/workflows/verify.yml"), "utf8");
        g04Static = String(packageJson.scripts?.test ?? "").includes("vitest run") && workflow.includes("npm run verify");
      }
      if (id === "G-04" && !g04Static) errors.push("G-04: gate estático não está ligado ao teste Vitest/CI");
      else if (id !== "G-04") {
        const consumerLinked = Boolean(ownerEntry) && (consumerTest
          ? fs.readFileSync(path.join(root, consumerPath), "utf8").includes(symbol)
          : Boolean(consumerEntry && (q11Bridge || importsOwner(consumerEntry, ownerEntry, symbol, sources))));
        if (!consumerLinked) errors.push(`${id}: consumidor não importa/reexporta o símbolo ou não é consumidor de teste F0: ${consumer} -> ${owner}`);
      }
    }
    if (phase === "ORGANIZACIONAL" && !["Q01", "Q02", "Q03", "Q51"].includes(id)) errors.push(`${id}: checklist organizacional não permitido`);
    if (phase === "F1+" && (!state.startsWith("N-A —") || !/(?:R-\d+|K-\d+|docs\/FECHAMENTO-F0)/.test(contract))) errors.push(`${id}: F1+ sem adiamento normativo rastreável`);
  }
  const gapSection = text.split("## Lacunas F0 — VERMELHO")[1]?.split("## Checklist organizacional")[0] ?? "";
  for (const row of rows.filter(candidate => candidate[7].startsWith("VERMELHO"))) {
    if (!gapSection.includes(`- **${row[0]}** —`)) errors.push(`${row[0]}: lacuna VERMELHO ausente da lista final`);
  }
  const orgIds = rows.filter(row => row[6] === "ORGANIZACIONAL").map(row => row[0]).sort();
  if (orgIds.join(",") !== "Q01,Q02,Q03,Q51") errors.push(`checklist organizacional esperado Q01,Q02,Q03,Q51; encontrado ${orgIds.join(",")}`);
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
