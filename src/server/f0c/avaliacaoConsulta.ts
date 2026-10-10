import type { ClinicalEvent } from "../../contracts/operacao.js";
import type { Paciente, Ciclo, TreatmentEpisode } from "../../contracts/clinico.js";
import { Triagem } from "../../contracts/clinico.js";
import { SalaoRuleset } from "../../contracts/regras.js";
import { dadosDoEvento, eventosVigentes, projetarSnapshot } from "../../kernel/projections/snapshot.js";
import { labSeries, weightSeries, type PontoLab } from "../../kernel/projections/series.js";
import { avaliarTriagem } from "../../rules/triagem.js";
import { idadeDoDado, PESO_VALIDADE_DIAS } from "../../rules/prescricao/index.js";
import { DataCivil } from "../../contracts/base.js";
import { semaforoInteracoes, type RulesetSemaforo } from "../../rules/semaforoInteracoes.js";
import type { CatalogoInteracoes } from "../../contracts/f0c/interacoes.js";
import { elegibilidadeCiclo, type SinalElegibilidade } from "../../rules/elegibilidadeCiclo.js";
import { alertarFeve, type RulesetAlertaFeve } from "../../rules/alertaFeve.js";
import { avaliarCriticos, avaliarValidadeExame, cockcroftGault, lembrarHbvC1D1,
  type RegistroHbv, type SorologiaHbv } from "../../rules/f0c/clinica.js";

const key = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const aliases: Record<string, string> = { cr: "creatinina", creat: "creatinina", na: "sodio", k: "potassio",
  ca_total: "calcio total", calcio: "calcio total", plq: "plaquetas", anc: "neutrofilos" };
const analito = (s: string) => aliases[key(s)] ?? key(s);
const obj = (v: unknown): Record<string, unknown> | null => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null;
const sinal = (estado: SinalElegibilidade["estado"], textos: string[]): SinalElegibilidade => ({ estado, motivos: textos.map(texto => ({ texto })) });
const pend = (texto: string) => sinal("PENDENTE", [texto]);

/** Seleção com conflito explícito: não faz média, não usa upload como data de coleta. */
export function ultimoLab(pontos: readonly PontoLab[], campo: string, hoje: string) {
  const candidatos = pontos.filter(p => analito(p.campo) === analito(campo) && p.data.slice(0, 10) <= hoje
    && Number.isFinite(Date.parse(p.data)) && Number.isFinite(p.valor) && p.sourceId.trim())
    .sort((a, b) => Date.parse(b.data) - Date.parse(a.data));
  const primeiro = candidatos[0];
  if (!primeiro) return null;
  const iguais = candidatos.filter(p => Date.parse(p.data) === Date.parse(primeiro.data));
  if (new Set(iguais.map(p => `${p.valor}|${p.unidade}`)).size !== 1) return null;
  return primeiro;
}

export interface EntradaAvaliacaoConsulta {
  eventos: readonly ClinicalEvent[]; patientId: string; tumorLotId: string | null; encounterId: string;
  agora: string; hoje: string; paciente: Paciente; ciclo: Ciclo | null; episodio: TreatmentEpisode | null;
  plaquetas: SinalElegibilidade | null; salaoRuleset?: unknown; interacoes?: RulesetSemaforo;
  catalogo?: CatalogoInteracoes; feveRuleset?: RulesetAlertaFeve;
  condicionais?: SinalElegibilidade;
  intervalo?: SinalElegibilidade;
  interacoesCondicionadas?: SinalElegibilidade;
}

/** A avaliação consome o mesmo ledger da consulta; dado ausente continua com motivo explícito. */
export function avaliarConsulta(i: EntradaAvaliacaoConsulta) {
  const escopo = i.eventos.filter(e => e.patientId === i.patientId && (e.tumorLotId === null || e.tumorLotId === i.tumorLotId)
    && Date.parse(e.criadoEm) <= Date.parse(i.agora));
  const atuais = eventosVigentes(escopo);
  const snapshot = projetarSnapshot(escopo.filter(e => e.tipo === "FATO"), i.patientId, i.tumorLotId, i.encounterId, "f0c-avaliacao-v1");
  const atuaisSnapshot=projetarSnapshot(escopo.filter(e=>e.tipo==="FATO" && e.encounterId===i.encounterId),i.patientId,i.tumorLotId,i.encounterId,"f0c-atual-v1");
  const campo = (nome: string) => {
    const campoFonte=(nome==="medicamentos" ? atuaisSnapshot : snapshot).campos[nome];
    return campoFonte?.estado === "VERDE" && campoFonte.eventIds.every(id=>atuais.some(e=>e.eventId===id && e.fontes.length>0)) ? campoFonte.valor : null;
  };
  const labs = labSeries(atuais).filter(p => Date.parse(p.data) <= Date.parse(i.agora)
    && atuais.some(e => e.eventId === p.eventId && e.fontes.some(f=>f.sourceId === p.sourceId)));
  const medida = (nome: string) => {
    const p = ultimoLab(labs, nome, i.hoje);
    return p && avaliarValidadeExame("BIOQUIMICA",p.data,i.agora).estado === "VALIDO"
      ? { valor: p.valor, unidade: p.unidade, fonte: p.sourceId } : null;
  };
  const cr = ultimoLab(labs, "creatinina", i.hoje);
  const pesos = weightSeries(atuais).filter(p => p.origem === "MEDIDO" && p.data.slice(0,10) <= i.hoje
    && DataCivil.safeParse(p.data.slice(0,10)).success && Date.parse(p.data)<=Date.parse(i.agora) && atuais.some(e=>e.eventId===p.eventId && e.fontes.some(f=>f.sourceId===p.sourceId)))
    .sort((a,b) => Date.parse(b.data)-Date.parse(a.data));
  const peso=pesos[0];
  const pesosDia = peso ? pesos.filter(p => Date.parse(p.data) === Date.parse(peso.data)) : [];
  const idadePeso=idadeDoDado({valor:peso?.kg ?? null,fonte:peso?.sourceId ?? null,medidoEm:peso?.data ?? null},i.agora,PESO_VALIDADE_DIAS);
  const nascimento = i.paciente.nascimento;
  const idade = nascimento ? Number(i.hoje.slice(0,4)) - Number(nascimento.slice(0,4)) - (i.hoje.slice(5) < nascimento.slice(5) ? 1 : 0) : null;
  const crValidade = avaliarValidadeExame("BIOQUIMICA", cr?.data ?? null, i.agora);
  const renal = cockcroftGault({ idadeAnos: idade,
    sexoFormula: i.paciente.sexoCadastral === "M" ? "MASCULINO" : i.paciente.sexoCadastral === "F" ? "FEMININO" : null,
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
  const avalTriagem = triagem && rs.success ? avaliarTriagem(triagem, { hoje: i.hoje, prescricaoVigente: null,
    requisitosAplicaveis: ["pas","fc","spo2","tempDecimos","hbDgDl","anc","plq","coletaHemograma","ecog","grauCtcae"] }, rs.data) : null;
  const criticos = avaliarCriticos({ NA: medida("sodio"), K: medida("potassio"), CA_TOTAL: medida("calcio total") });
  const avisosCriticos = criticos.filter(c=>c.estado === "AVISO").map(c=>`${c.analito}: ${c.medida!.valor} ${c.medida!.unidade}`);
  const anc = ultimoLab(labs,"neutrofilos",i.hoje), plq = ultimoLab(labs,"plaquetas",i.hoje);
  const portaPendentes: string[] = [], portaAlertas: string[] = [];
  for (const [nome,p,minimo] of [["neutrófilos",anc,1500],["plaquetas",plq,100000]] as const) {
    if (!p || !["/µL","/uL","/μL"].includes(p.unidade)) { portaPendentes.push(`${nome}: dado/unidade ausente ou em conflito`); continue; }
    if (p.valor < minimo) portaAlertas.push(`${nome} abaixo do corte do serviço (${minimo}/µL)`);
    if (avaliarValidadeExame("HEMOGRAMA",p.data,i.agora).estado !== "VALIDO") portaPendentes.push(`${nome}: validade não confirmada`);
  }
  const dadoGrau = triagem?.grauCtcae;
  const grau = dadoGrau?.campo === "PRESENTE" && (dadoGrau.revisao === "CONFIRMADO" || dadoGrau.revisao === "ASSINADO")
    ? dadoGrau.valor : null;
  const ctcae = grau === null ? pend("toxicidade atual não graduada") : grau >= 2
    ? sinal("VERMELHO", ["toxicidade G2 ou maior: revisão médica, sem ajuste automático"]): sinal("VERDE",[]);
  const eco = obj(campo("feve"));
  const feve = i.feveRuleset ? alertarFeve({ hoje:i.hoje, feve: { percentual: typeof eco?.percentual === "number" ? eco.percentual : null,
    metodo: typeof eco?.metodo === "string" ? eco.metodo : null, data: typeof eco?.data === "string" ? eco.data : null },
    programados: (i.ciclo?.itens ?? []).map(item=>({nome:item.droga,classe:null})) },i.feveRuleset) : null;
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
    portaCiclo: sinal(portaAlertas.length ? "VERMELHO" : portaPendentes.length ? "PENDENTE" : "VERDE", [...portaAlertas,...portaPendentes]),
    triagem: avalTriagem ? sinal(avalTriagem.cortes.length ? "VERMELHO" : avalTriagem.pendentes.length ? "PENDENTE" : "VERDE",
      [...avalTriagem.cortes,...avalTriagem.pendentes].map(m=>m.texto)) : pend("triagem ausente ou ambígua"),
    ctcae, interacoes:sinalInteracoes,
    funcaoOrganica: renal.estado === "CALCULADO" ? pend("função renal calculada; limites renal/hepático por fármaco exigem ficha curada") : pend(`função renal: ${renal.motivo ?? crValidade.motivo}`),
    emergencia: emergencia ? sinal("VERMELHO",["emergência na triagem"]) : avalTriagem ? sinal("VERDE",[]) : pend("triagem de emergência ausente"),
    ...(avisosCriticos.length ? {intercorrencia:sinal("VERMELHO",avisosCriticos)} : {}),
    feve: !i.ciclo ? pend("esquema do ciclo não definido para avaliar FEVE") : feve
      ? sinal(feve.estado === "ALERTA" ? "VERMELHO" : feve.estado === "PENDENTE" || feve.pendentes.length ? "PENDENTE" : "VERDE",[...feve.motivos,...feve.pendentes].map(m=>m.texto)) : pend("regra FEVE indisponível"),
    ...(hbv.aplicavel ? {basal: hbv.faltantes.length ? pend(`HBV: verificar ${hbv.faltantes.join(", ")}`) : sinal("VERDE",[])} : {}),
  });
  const pesoAnterior = peso ? pesos.find(p=>Date.parse(p.data)<Date.parse(peso.data)) : null;
  const variacaoPeso = peso && pesoAnterior && pesoAnterior.kg>0 ? Math.abs(peso.kg-pesoAnterior.kg)/pesoAnterior.kg : null;
  const altura=campo("alturaCm");
  const dadosCorporais={pesoKg:renal.valoresUsados.peso.valor,alturaCm:typeof altura === "number" && altura>0 ? altura : null,
    bsaM2:null,clcr:renal.clcrMlMin,medidoEm:peso?.data ?? null};
  const avisosFlash = [...avisosCriticos,
    ...(variacaoPeso !== null && variacaoPeso>=0.10 ? ["Variação de peso de pelo menos 10%: revisar prescrição"] : []),
    ...(interacoes.estado === "VERMELHO" ? [interacoes.motivo] : []),
    ...(grau !== null && grau >= 2 ? ["Toxicidade registrada: revisar antes da decisão do ciclo"] : []),
    ...(feve?.estado === "ALERTA" ? feve.motivos.map(m=>m.texto) : []),
    ...(hbv.faltantes.length ? [`Verificar sorologias: ${hbv.faltantes.join(", ")}`] : [])];
  const sugestoesLaboratorio = [...(interacoes.achados.some(a=>key(a.drogaA).includes("capecitabina") && key(a.drogaBouClasse).includes("varfarina")) ? ["INR"] : []),...hbv.faltantes];
  return { elegibilidade, renal, dadosCorporais, variacaoPeso, criticos, hbv, interacoes, emergencia, avisosFlash, sugestoesLaboratorio,
    lembrete: elegibilidade.motivos.map(m=>m.texto).filter((t,index,a)=>a.indexOf(t)===index).join("; ") };
}
