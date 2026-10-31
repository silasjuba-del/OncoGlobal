import type { ClinicalEvent } from "../../contracts/operacao.js";
import type { Paciente, Ciclo, TreatmentEpisode } from "../../contracts/clinico.js";
import { Ciclo as CicloSchema, Triagem } from "../../contracts/clinico.js";
import { SalaoRuleset } from "../../contracts/regras.js";
import { dadosDoEvento, escopoDoEvento, eventosVigentes, projetarSnapshot } from "../../kernel/projections/snapshot.js";
import { labSeries, weightSeries, type PontoLab } from "../../kernel/projections/series.js";
import { avaliarTriagem } from "../../rules/triagem.js";
import { idadeDoDado, PESO_VALIDADE_DIAS } from "../../rules/prescricao/index.js";
import { hashCanonico, projetarRetrato } from "../../kernel/projections/retrato/index.js";
import { diaDaObservacao, observacaoNoHorizonte, observacoesMaisRecentes } from "../../modules/consulta/observacoesTemporais.js";
import { alturaDocumentada, exameBasalDocumentado } from "./dadosDocumentados.js";
import type { CriterioElegibilidade } from "../../contracts/api/criterioElegibilidade.js";
import { semaforoInteracoes, type RulesetSemaforo } from "../../rules/semaforoInteracoes.js";
import type { CatalogoInteracoes } from "../../contracts/f0c/interacoes.js";
import { elegibilidadeCiclo, type SinalElegibilidade } from "../../rules/elegibilidadeCiclo.js";
import { alertarFeve, type RulesetAlertaFeve } from "../../rules/alertaFeve.js";
import { analitosSemCortePorDroga, avaliarCriticos, avaliarValidadeExame, cockcroftGault, lembrarHbvC1D1,
  type RegistroHbv, type SorologiaHbv } from "../../rules/f0c/clinica.js";
import { preRequisitosC1 } from "../../rules/preRequisitosC1.js";
import { avaliarPeso } from "../../rules/peso.js";

const key = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const aliases: Record<string, string> = { cr: "creatinina", creat: "creatinina", na: "sodio", k: "potassio",
  ca_total: "calcio total", calcio: "calcio total", plq: "plaquetas", anc: "neutrofilos" };
const analito = (s: string) => aliases[key(s)] ?? key(s);
const obj = (v: unknown): Record<string, unknown> | null => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null;
const sinal = (estado: SinalElegibilidade["estado"], textos: string[]): SinalElegibilidade => ({ estado, motivos: textos.map(texto => ({ texto })) });
const pend = (texto: string) => sinal("PENDENTE", [texto]);

function labsMaisRecentes(pontos: readonly PontoLab[], campo: string, hoje: string) {
  const candidatos = pontos.filter(p => analito(p.campo) === analito(campo)
    && observacaoNoHorizonte(p.data, hoje, Infinity) && Number.isFinite(p.valor) && p.sourceId.trim());
  const { atuais, data } = observacoesMaisRecentes(candidatos, p => p.data);
  // Prefer the actual source with the least precise selected date. A matching
  // timed observation cannot confer an invented collection time on a civil day.
  return atuais.sort((a, b) => Number(b.data === data) - Number(a.data === data));
}

/** Seleção com conflito explícito: não faz média, não usa upload como data de coleta. */
export function ultimoLab(pontos: readonly PontoLab[], campo: string, hoje: string) {
  const iguais = labsMaisRecentes(pontos, campo, hoje);
  if (new Set(iguais.map(p => `${p.valor}|${p.unidade}`)).size !== 1) return null;
  return iguais[0]!;
}

export interface EntradaAvaliacaoConsulta {
  eventos: readonly ClinicalEvent[]; patientId: string; tumorLotId: string | null; encounterId: string;
  agora: string; hoje: string; paciente: Paciente; ciclo: Ciclo | null; episodio: TreatmentEpisode | null;
  plaquetas: SinalElegibilidade | null; salaoRuleset?: unknown; interacoes?: RulesetSemaforo;
  catalogo?: CatalogoInteracoes; feveRuleset?: RulesetAlertaFeve;
  condicionais?: SinalElegibilidade;
  intervalo?: SinalElegibilidade;
  interacoesCondicionadas?: SinalElegibilidade;
  cumulativo?: SinalElegibilidade;
}

/** Encontro reaberto: o horizonte termina onde começa o encontro seguinte; evidência posterior não reescreve a consulta antiga. */
export function horizonteDoEncontro(eventosDoPaciente: readonly ClinicalEvent[], encounterId: string, agora: string): number {
  const inicio = new Map<string, number>();
  for (const e of eventosDoPaciente) { const t = Date.parse(e.criadoEm); if (Number.isFinite(t) && t < (inicio.get(e.encounterId) ?? Infinity)) inicio.set(e.encounterId, t); }
  const inicioAtual = inicio.get(encounterId);
  const seguinte = inicioAtual === undefined ? Infinity
    : Math.min(Infinity, ...[...inicio].filter(([id, t]) => id !== encounterId && t > inicioAtual).map(([, t]) => t));
  return Math.min(Date.parse(agora), seguinte - 1);
}

/** Evidência medida e datada, ainda sem aplicar a validade específica do cálculo de dose. */
export function pesosMedidosDocumentados(atuais: readonly ClinicalEvent[], hoje: string, horizonte: number) {
  return weightSeries(atuais).filter(p => p.origem === "MEDIDO" && observacaoNoHorizonte(p.data, hoje, horizonte)
    && atuais.some(e => e.eventId === p.eventId && e.fontes.some(f => f.sourceId === p.sourceId)))
    .sort((a, b) => Date.parse(b.data) - Date.parse(a.data));
}

/** A avaliação consome o mesmo ledger da consulta; dado ausente continua com motivo explícito. */
export function avaliarConsulta(i: EntradaAvaliacaoConsulta) {
  const doPaciente = i.eventos.filter(e => e.patientId === i.patientId);
  const horizonte = horizonteDoEncontro(doPaciente, i.encounterId, i.agora);
  const instanteHorizonte = new Date(horizonte).toISOString();
  // Empty technical configuration: projection only, no clinical rule is asserted.
  const retrato = projetarRetrato(doPaciente, { patientId: i.patientId, encounterId: i.encounterId,
    tumorLotId: i.tumorLotId, agora: instanteHorizonte, regras: [],
    biblioteca: { id: "dados-documentados", versao: "1", hash: hashCanonico([]) } });
  const limiteClinico = [i.hoje, diaDaObservacao(instanteHorizonte)!, retrato.dataClinicaEncontro]
    .filter((dia): dia is string => dia !== undefined).sort()[0]!;
  // Fatos sistêmicos (labs, administrações, medicamentos…) são do paciente, independentemente do lote de origem.
  const escopo = doPaciente.filter(e => (e.tumorLotId === null || e.tumorLotId === i.tumorLotId || escopoDoEvento(e) === "PACIENTE")
    && Date.parse(e.criadoEm) <= horizonte);
  const atuais = eventosVigentes(escopo);
  // The canonical view rejects ambiguous encounter anchors. Raw measurements
  // must not bypass that decision and silently fall back to the current day.
  const materiaisDoRetrato = new Set(retrato.fatos.map(f => f.ref.eventId));
  const medidasAtuais = atuais.filter(e => materiaisDoRetrato.has(e.eventId));
  const snapshot = projetarSnapshot(escopo.filter(e => e.tipo === "FATO"), i.patientId, i.tumorLotId, i.encounterId, "f0c-avaliacao-v1");
  const atuaisSnapshot=projetarSnapshot(escopo.filter(e=>e.tipo==="FATO" && e.encounterId===i.encounterId),i.patientId,i.tumorLotId,i.encounterId,"f0c-atual-v1");
  const campo = (nome: string) => {
    const campoFonte=(nome==="medicamentos" ? atuaisSnapshot : snapshot).campos[nome];
    return campoFonte?.estado === "VERDE" && campoFonte.eventIds.every(id=>atuais.some(e=>e.eventId===id && e.fontes.length>0)) ? campoFonte.valor : null;
  };
  const labs = labSeries(medidasAtuais).filter(p => observacaoNoHorizonte(p.data, limiteClinico, horizonte)
    && atuais.some(e => e.eventId === p.eventId && e.fontes.some(f=>f.sourceId === p.sourceId)));
  const medida = (nome: string) => {
    const p = ultimoLab(labs, nome, limiteClinico);
    return p && avaliarValidadeExame("BIOQUIMICA",p.data,i.agora).estado === "VALIDO"
      ? { valor: p.valor, unidade: p.unidade, fonte: p.sourceId } : null;
  };
  const cr = ultimoLab(labs, "creatinina", limiteClinico);
  const pesos = pesosMedidosDocumentados(medidasAtuais, limiteClinico, horizonte);
  const peso=pesos[0];
  const pesosDia = peso ? pesos.filter(p => Date.parse(p.data) === Date.parse(peso.data)) : [];
  const idadePeso=idadeDoDado({valor:peso?.kg ?? null,fonte:peso?.sourceId ?? null,medidoEm:peso?.data ?? null},i.agora,PESO_VALIDADE_DIAS);
  const nascimento = i.paciente.nascimento;
  const idade = nascimento ? Number(i.hoje.slice(0,4)) - Number(nascimento.slice(0,4)) - (i.hoje.slice(5) < nascimento.slice(5) ? 1 : 0) : null;
  const crValidade = avaliarValidadeExame("BIOQUIMICA", cr?.data ?? null, i.agora);
  const alturaParaRenal = alturaDocumentada(retrato, instanteHorizonte);
  const renal = cockcroftGault({ idadeAnos: idade,
    sexoFormula: i.paciente.sexoCadastral === "M" ? "MASCULINO" : i.paciente.sexoCadastral === "F" ? "FEMININO" : null,
    alturaCm: alturaParaRenal,
    peso: { valor: peso && idadePeso.desatualizado===false && new Set(pesosDia.map(p=>p.kg)).size === 1 ? peso.kg : null, unidade: "kg", fonte: peso?.sourceId ?? null },
    creatinina: { valor: crValidade.estado === "VALIDO" ? cr?.valor ?? null : null, unidade: cr?.unidade ?? null, fonte: cr?.sourceId ?? null } });
  const medicamentosRaw = campo("medicamentos");
  const documentados = Array.isArray(medicamentosRaw) && medicamentosRaw.every(m => typeof m === "string") ? medicamentosRaw as string[] : [];
  const conjunto = [...new Set([...documentados,...(i.ciclo?.itens.map(item=>item.droga) ?? [])])];
  const medicamentos = conjunto.length ? conjunto : null;
  const interacoes = semaforoInteracoes({ medicamentos, checagemCompleta: false }, i.interacoes ?? {}, i.catalogo);
  const triagens = atuais.filter(e => e.tipo === "Triagem" && e.encounterId === i.encounterId)
    .flatMap(e => { const p = Triagem.safeParse(dadosDoEvento(e)); return p.success && p.data.patientId===i.patientId && p.data.encounterId===i.encounterId ? [p.data] : []; });
  const triagem = triagens.length === 1 ? triagens[0]! : null;
  const rs = SalaoRuleset.safeParse(i.salaoRuleset);
  const tendenciaPeso = rs.success ? avaliarPeso(pesos.flatMap(p=>{
    const data=diaDaObservacao(p.data);
    return data ? [{data,kg:p.kg,origem:"MEDIDO" as const,alturaCm:alturaParaRenal}] : [];
  }),limiteClinico,rs.data) : null;
  const avisoPeso = tendenciaPeso?.estado === "VERMELHO"
    ? `Perda ponderal: ${tendenciaPeso.motivo}. Avaliação nutricional e decisão médica sobre QT; sem adiamento automático.` : null;
  const avalTriagem = triagem && rs.success ? avaliarTriagem(triagem, { hoje: i.hoje, prescricaoVigente: null,
    requisitosAplicaveis: ["pas","fc","spo2","tempDecimos","hbDgDl","anc","plq","coletaHemograma","ecog","grauCtcae"] }, rs.data) : null;
  const criticos = avaliarCriticos({ NA: medida("sodio"), K: medida("potassio"), CA_TOTAL: medida("calcio total") });
  const avisosCriticos = criticos.filter(c=>c.estado === "AVISO").map(c=>`${c.analito}: ${c.medida!.valor} ${c.medida!.unidade}`);
  const anc = ultimoLab(labs,"neutrofilos",limiteClinico), plq = ultimoLab(labs,"plaquetas",limiteClinico);
  const portaPendentes: string[] = [], portaAlertas: string[] = [];
  const criteriosPorta: CriterioElegibilidade[] = [];
  const regraPorta = rs.success ? { id: rs.data.header.id, versao: rs.data.header.versao, fonte: rs.data.header.fonte.referencia } : null;
  for (const [nome,p,minimo] of [["neutrófilos",anc,1500],["plaquetas",plq,100000]] as const) {
    const id = key(nome);
    const ultimos = labsMaisRecentes(labs, nome, limiteClinico);
    const conflito = new Set(ultimos.map(l => `${l.valor}|${l.unidade}`)).size > 1;
    // Um valor concordante pode ter várias evidências; a escolha numérica não descarta suas fontes.
    const fontes = ultimos.flatMap(l => atuais.find(e => e.eventId === l.eventId)!.fontes
      .map(f => ({ eventId: l.eventId, sourceId: f.sourceId, medidoEm: l.data })));
    const unidadeValida = p && ["/µL","/uL","/μL"].includes(p.unidade);
    criteriosPorta.push({ schema: "CriterioElegibilidade@1", id: `${id}.limiar`,
      estado: conflito ? "CONFLITO" : !unidadeValida ? "AUSENTE" : p.valor < minimo ? "NAO_ATENDE" : "ATENDE",
      texto: `${nome}: mínimo do serviço ${minimo}/µL`, fontes,
      regra: rs.success && (nome === "neutrófilos" ? rs.data.cortes.ancMin : rs.data.cortes.plqMin) === minimo ? regraPorta : null });
    criteriosPorta.push({ schema: "CriterioElegibilidade@1", id: `${id}.validade`,
      estado: conflito ? "CONFLITO" : p && avaliarValidadeExame("HEMOGRAMA",p.data,i.agora).estado === "VALIDO" ? "ATENDE" : "AUSENTE",
      // A função de validade usa sua própria política; não atribuir seu prazo ao ruleset de triagem.
      texto: `${nome}: validade do hemograma`, fontes, regra: null });
    if (!p || !["/µL","/uL","/μL"].includes(p.unidade)) { portaPendentes.push(`${nome}: dado/unidade ausente ou em conflito`); continue; }
    if (p.valor < minimo) portaAlertas.push(`${nome} abaixo do corte do serviço (${minimo}/µL)`);
    if (avaliarValidadeExame("HEMOGRAMA",p.data,i.agora).estado !== "VALIDO") portaPendentes.push(`${nome}: validade não confirmada`);
  }
  const episodioBasal = i.ciclo?.episodioId ?? i.episodio?.episodioId ?? null;
  const audiometria = exameBasalDocumentado(campo("audiometriaBasal"), episodioBasal, limiteClinico);
  const audioDocumentada = audiometria && typeof audiometria.resultado === "string" && audiometria.resultado.trim()
    && audiometria.estado === "REALIZADO";
  for (const tarefa of preRequisitosC1((i.ciclo?.itens ?? []).map((item) => item.droga), i.ciclo?.numero ?? null)) {
    if (tarefa.id === "AUDIOMETRIA_BASAL" && !audioDocumentada) portaPendentes.push(tarefa.texto);
  }
  const dadoGrau = triagem?.grauCtcae;
  const grau = dadoGrau?.campo === "PRESENTE" && (dadoGrau.revisao === "CONFIRMADO" || dadoGrau.revisao === "ASSINADO")
    ? dadoGrau.valor : null;
  const ctcae = grau === null ? pend("toxicidade atual não graduada") : grau >= 2
    ? sinal("VERMELHO", ["toxicidade G2 ou maior: revisão médica, sem ajuste automático"]): sinal("VERDE",[]);
  const eco = obj(campo("feve"));
  const ecoBasal = exameBasalDocumentado(campo("feveBasal"), episodioBasal, limiteClinico);
  const feve = i.feveRuleset ? alertarFeve({ hoje:i.hoje, feve: { percentual: typeof eco?.percentual === "number" ? eco.percentual : null,
    metodo: typeof eco?.metodo === "string" ? eco.metodo : null, data: typeof eco?.data === "string" ? eco.data : null },
    feveBasal: ecoBasal ? { percentual: typeof ecoBasal.percentual === "number" ? ecoBasal.percentual : null,
      metodo: typeof ecoBasal.metodo === "string" ? ecoBasal.metodo : null, data: String(ecoBasal.data) } : null,
    programados: (i.ciclo?.itens ?? []).map(item=>({nome:item.droga,classe:null})),
    numeroCiclo: i.ciclo?.numero ?? null },i.feveRuleset) : null;
  const registrosHbv: Partial<Record<SorologiaHbv,RegistroHbv>> = {};
  for (const nome of ["HBsAg","anti-HBc","anti-HBs"] as const) {
    const v = campo(nome), f = snapshot.campos[nome];
    registrosHbv[nome] = { resultado: typeof v === "string" ? v : null, fonte: f?.eventIds[0] ?? null };
  }
  const hbv = lembrarHbvC1D1(i.ciclo?.numero ?? null, i.ciclo ? (i.ciclo.previstoEm === i.hoje ? 1 : null) : null, registrosHbv);
  const emergencia = avalTriagem?.emergencia === true;
  const sinalInteracoes=sinal(interacoes.estado,interacoes.estado === "VERDE"?[]:[interacoes.motivo]);
  if (i.interacoesCondicionadas) {
    const estado=i.interacoesCondicionadas.estado;
    if (estado==="VERMELHO" || (estado==="PENDENTE" && sinalInteracoes.estado!=="VERMELHO")) sinalInteracoes.estado=estado;
    sinalInteracoes.motivos = [...sinalInteracoes.motivos, ...i.interacoesCondicionadas.motivos];
  }
  const elegibilidade = elegibilidadeCiclo({ plaquetas:i.plaquetas,
    ...(i.condicionais ? {condicionais:i.condicionais} : {}),
    ...(i.intervalo ? {intervalo:i.intervalo} : {}),
    portaCiclo: { ...sinal(portaAlertas.length ? "VERMELHO" : portaPendentes.length ? "PENDENTE" : "VERDE", [...portaAlertas,...portaPendentes]), criterios: criteriosPorta },
    triagem: avalTriagem ? sinal(avalTriagem.cortes.length ? "VERMELHO" : avalTriagem.pendentes.length ? "PENDENTE" : "VERDE",
      [...avalTriagem.cortes,...avalTriagem.pendentes].map(m=>m.texto)) : pend("triagem ausente ou ambígua"),
    ctcae, interacoes:sinalInteracoes,
    funcaoOrganica: renal.estado === "CALCULADO"
      ? pend(["função renal calculada; limites renal/hepático por fármaco exigem ficha curada", ...analitosSemCortePorDroga(i.ciclo?.itens.map((item) => item.droga) ?? [], new Set([
        ...(ultimoLab(labs, "bilirrubina", limiteClinico) ? ["BILI"] : []),
        ...(ultimoLab(labs, "tgo", limiteClinico) ? ["AST"] : []),
        ...(ultimoLab(labs, "tgp", limiteClinico) ? ["ALT"] : []),
        ...(ultimoLab(labs, "magnesio", limiteClinico) ? ["MG"] : []),
        ...(ultimoLab(labs, "potassio", limiteClinico) ? ["K"] : []),
        ...(ultimoLab(labs, "calcio total", limiteClinico) ? ["CA"] : []),
      ])).map((a) => a.motivo)].join("; "))
      : pend(`função renal: ${renal.motivo ?? crValidade.motivo}`),
    emergencia: emergencia ? sinal("VERMELHO",["emergência na triagem"]) : avalTriagem ? sinal("VERDE",[]) : pend("triagem de emergência ausente"),
    ...(avisosCriticos.length || avisoPeso ? {intercorrencia:sinal("VERMELHO",[...avisosCriticos,...(avisoPeso?[avisoPeso]:[])])} : {}),
    feve: !i.ciclo ? pend("esquema do ciclo não definido para avaliar FEVE") : feve
      ? sinal(feve.estado === "ALERTA" ? "VERMELHO" : feve.estado === "PENDENTE" || feve.pendentes.length ? "PENDENTE" : "VERDE",[...feve.motivos,...feve.pendentes].map(m=>m.texto)) : pend("regra FEVE indisponível"),
    ...(hbv.aplicavel ? {basal: hbv.faltantes.length ? pend(`HBV: verificar ${hbv.faltantes.join(", ")}`) : sinal("VERDE",[])} : {}),
    ...(i.cumulativo ? {cumulativo: i.cumulativo} : {}),
  });
  const pesoAnterior = peso ? pesos.find(p=>Date.parse(p.data)<Date.parse(peso.data)) : null;
  const variacaoPeso = peso && pesoAnterior && pesoAnterior.kg>0 ? Math.abs(peso.kg-pesoAnterior.kg)/pesoAnterior.kg : null;
  // O peso de referência pertence ao ciclo anterior do mesmo episódio/lote, não à penúltima pesagem.
  const eventoCiclo = i.ciclo ? atuais.find(e=>/^Ciclo(?:@1)?$/.test(e.tipo)&&e.tumorLotId===i.tumorLotId&&dadosDoEvento(e)?.cicloId===i.ciclo!.cicloId) : null;
  // Antes de planejar o próximo ciclo, a consulta ainda projeta o último ciclo do encontro anterior.
  const numeroReferencia = i.ciclo ? i.ciclo.numero - (eventoCiclo && eventoCiclo.encounterId !== i.encounterId ? 0 : 1) : null;
  const ciclosAnteriores = i.ciclo && numeroReferencia !== null && numeroReferencia > 0 ? atuais.filter(e => e.tumorLotId === i.tumorLotId && /^Ciclo(?:@1)?$/.test(e.tipo)
    && ["CONFIRMADO","ASSINADO"].includes(e.revisao)).flatMap(e => {
      const c = CicloSchema.safeParse(dadosDoEvento(e));
      return c.success && c.data.episodioId === i.ciclo!.episodioId && c.data.numero === numeroReferencia ? [c.data] : [];
    }) : [];
  const cicloAnterior = ciclosAnteriores.length === 1 ? ciclosAnteriores[0]! : null;
  const dadoPesoAnterior = cicloAnterior?.pesoKg;
  const fontePesoAnterior = dadoPesoAnterior?.fontes.find(f => f.dataClinica && observacaoNoHorizonte(f.dataClinica,limiteClinico,horizonte));
  const pesoAnteriorCiclo = cicloAnterior?.origemPeso === "MEDIDO" && dadoPesoAnterior?.campo === "PRESENTE"
    && ["CONFIRMADO","ASSINADO"].includes(dadoPesoAnterior.revisao) && fontePesoAnterior && dadoPesoAnterior.valor !== null
    ? {kg:dadoPesoAnterior.valor,medidoEm:fontePesoAnterior.dataClinica!,cicloId:cicloAnterior.cicloId} : null;
  const variacaoPesoCiclo = peso && new Set(pesosDia.map(p=>p.kg)).size === 1 && pesoAnteriorCiclo
    ? Math.abs(peso.kg-pesoAnteriorCiclo.kg)/pesoAnteriorCiclo.kg : null;
  const altura = alturaDocumentada(retrato, instanteHorizonte);
  const dadosCorporais={pesoKg:renal.valoresUsados.peso.valor,alturaCm:altura,
    bsaM2:null,clcr:renal.clcrMlMin,medidoEm:peso?.data ?? null};
  // Nutrição usa a última medida documentada, sem confundir a validade para dose com ausência de medida.
  // A data/fonte acompanham a sugestão; isto não declara peso atual nem libera cálculo de dose.
  const pesosNutricionais = pesosMedidosDocumentados(medidasAtuais, limiteClinico, horizonte);
  const pesoNutricional = pesosNutricionais[0];
  const concordantes = pesoNutricional ? pesosNutricionais.filter(p => p.data === pesoNutricional.data) : [];
  const dadosNutricionais = { pesoKg: pesoNutricional && new Set(concordantes.map(p => p.kg)).size === 1 ? pesoNutricional.kg : null,
    alturaCm: dadosCorporais.alturaCm, medidoEm: pesoNutricional?.data ?? null, sourceId: pesoNutricional?.sourceId ?? null,
    fontes: concordantes.flatMap(p => doPaciente.find(e => e.eventId === p.eventId)!.fontes
      .map(f => ({eventId:p.eventId,sourceId:f.sourceId,medidoEm:p.data}))) };
  const avisosFlash = [...avisosCriticos,...(avisoPeso?[avisoPeso]:[]),
    ...(peso && diaDaObservacao(peso.data) !== i.hoje ? [`Peso documentado em ${peso.data}: não foi medido hoje; confira antes de prescrever.`] : []),
    ...(variacaoPesoCiclo !== null && variacaoPesoCiclo >= 0.10 ? [`Variação de peso de pelo menos 10% desde o ciclo anterior (${pesoAnteriorCiclo!.kg} kg em ${pesoAnteriorCiclo!.medidoEm}): revisar prescrição`] : []),
    ...(numeroReferencia !== null && numeroReferencia > 0 && variacaoPesoCiclo === null ? ["Comparação de peso com o ciclo anterior indisponível: revisar a referência documentada."] : []),
    ...(variacaoPeso !== null && variacaoPeso>=0.10 ? ["Variação de peso de pelo menos 10%: revisar prescrição"] : []),
    ...(interacoes.estado === "VERMELHO" ? [interacoes.motivo] : []),
    ...(grau !== null && grau >= 2 ? ["Toxicidade registrada: revisar antes da decisão do ciclo"] : []),
    ...(feve?.estado === "ALERTA" ? feve.motivos.map(m=>m.texto) : []),
    ...(hbv.faltantes.length ? [`Verificar sorologias: ${hbv.faltantes.join(", ")}`] : []),
    ...(i.cumulativo?.estado === "VERMELHO" ? i.cumulativo.motivos.map(m => m.texto) : [])];
  const sugestoesLaboratorio = [...(interacoes.achados.some(a=>key(a.drogaA).includes("capecitabina") && key(a.drogaBouClasse).includes("varfarina")) ? ["INR"] : []),...hbv.faltantes,
    ...(!audioDocumentada && preRequisitosC1((i.ciclo?.itens ?? []).map(item=>item.droga), i.ciclo?.numero ?? null).some(t=>t.id === "AUDIOMETRIA_BASAL") ? ["Audiometria basal"] : [])];
  return { elegibilidade, renal, dadosCorporais, dadosNutricionais, tendenciaPeso, variacaoPeso, variacaoPesoCiclo, pesoAnteriorCiclo, criticos, hbv, interacoes, emergencia, avisosFlash, sugestoesLaboratorio,
    lembrete: elegibilidade.motivos.map(m=>m.texto).filter((t,index,a)=>a.indexOf(t)===index).join("; ") };
}
