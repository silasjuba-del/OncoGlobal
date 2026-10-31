import type { Retrato, FatoRetrato } from "../../contracts/f1/retrato.js";
import { FactQualifiers } from "../../contracts/w10/extracao.js";
import { TreatmentEpisode, Triagem } from "../../contracts/clinico.js";
import { avaliarValidadeExame } from "../../rules/f0c/clinica.js";
import { montarFichaMinima } from "./revisaoClinica.js";
import { entradaDesdeFicha, type EntradaTelaRevisao, type Declarado } from "./telaRevisao.js";
import { diaDaObservacao, observacaoNoHorizonte, observacoesMaisRecentes } from "./observacoesTemporais.js";

const objeto = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const informado = <T>(valor: T): Declarado<T> => ({ estado: "INFORMADO", valor });
const afirmado = (d: Record<string, unknown>): boolean => {
  if (d.negado === true || d.negated === true || d.requiresConfirmation === true || ["INFERRED", "UNCERTAIN"].includes(String(d.evidence))) return false;
  if (d.qualificadores !== undefined) {
    const q = FactQualifiers.safeParse(d.qualificadores);
    if (!q.success || q.data.polaridade !== "AFIRMADA" || q.data.sujeito !== "PACIENTE" || ["FUTURA", "NAO_DETERMINADA"].includes(q.data.temporalidade)) return false;
  }
  return true;
};

/** A mesma fotografia confirmada alimenta a revisão; nenhum dado vem de exemplos ou do navegador. */
export function entradaRevisaoDoRetrato(r: Retrato): { entrada: EntradaTelaRevisao; pendencias: string[] } {
  const hoje = r.dataClinicaEncontro ?? diaDaObservacao(r.geradoEm)!;
  const pendencias: string[] = [];
  const fatos = r.fatos.filter(f => f.patientId === r.patientId && (f.escopo === "PACIENTE" || f.tumorLotId === r.tumorLotId)
    && f.fontes.length > 0 && !r.integridade.some(i => i.eventoId === f.ref.eventId)
    && (f.tempoClinico === null || observacaoNoHorizonte(f.tempoClinico, hoje, Date.parse(r.geradoEm))));
  const selecionar = (candidatos: FatoRetrato[], valor: (f: FatoRetrato) => unknown, rotulo: string) => {
    const { atuais } = observacoesMaisRecentes(candidatos, f => f.tempoClinico);
    if (!atuais.length) return undefined;
    if (atuais.some(f => f.tempoClinico === null || !afirmado(f.dados) || !afirmado(objeto(f.dados.valor))) || new Set(atuais.map(f => JSON.stringify(valor(f)))).size !== 1) {
      pendencias.push(`${rotulo}: A CONFERIR — conflito, negação ou incerteza na fonte.`);
      return undefined;
    }
    return { fato: atuais[0]!, valor: valor(atuais[0]!) };
  };
  const campo = (...ids: string[]) => selecionar(fatos.filter(f => f.campo !== null && ids.includes(f.campo)), f => f.dados.valor, ids[0]!);
  const e: EntradaTelaRevisao = { ...entradaDesdeFicha(montarFichaMinima(r)), hoje };
  const episodio = selecionar(fatos.filter(f => ["TreatmentEpisode", "TreatmentEpisode@1"].includes(f.tipo)), f => f.dados, "Episódio");
  const ep = TreatmentEpisode.safeParse(episodio?.valor);
  if (ep.success && ep.data.tumorLotId === r.tumorLotId) {
    e.intencao = informado(ep.data.intencao); e.linha = informado(ep.data.linha);
    if (ep.data.inicio.valor && ep.data.inicio.revisao === "CONFIRMADO") e.dataInicioTratamento = informado(ep.data.inicio.valor);
  }
  // Campos documentados específicos prevalecem apenas quando não conflitam com o episódio.
  const intencao = campo("intencao"), linha = campo("linha");
  if (intencao && typeof intencao.valor === "string") {
    if (e.intencao && e.intencao.valor !== intencao.valor) { delete e.intencao; pendencias.push("Intenção: A CONFERIR — episódio e fato divergem."); }
    else e.intencao = informado(intencao.valor as NonNullable<EntradaTelaRevisao["intencao"]>["valor"] & string);
  }
  if (linha && typeof linha.valor === "number") {
    if (e.linha && e.linha.valor !== linha.valor) { delete e.linha; pendencias.push("Linha: A CONFERIR — episódio e fato divergem."); }
    else e.linha = informado(linha.valor);
  }
  for (const chave of ["dataDiagnosticoAP", "dataInicioTratamento", "validadeAPAC", "proximoCiclo", "dataReestadiamento"] as const) {
    const f = campo(chave); if (f && typeof f.valor === "string") e[chave] = informado(f.valor);
  }
  for (const chave of ["idadeAnos", "pesoAnteriorKg"] as const) {
    const f = campo(chave); if (f && typeof f.valor === "number") e[chave] = informado(f.valor);
  }
  const sexo = campo("sexoFormula");
  if (sexo && (sexo.valor === "MASCULINO" || sexo.valor === "FEMININO")) e.sexoFormula = informado(sexo.valor);
  const cirurgia = campo("cirurgiaRealizada");
  if (cirurgia?.valor === true) e.cirurgia = informado(true);
  if (cirurgia?.valor === false) e.cirurgia = { estado: "AUSENTE_CONFIRMADO" };
  const triagem = selecionar(fatos.filter(f => ["Triagem", "Triagem@1"].includes(f.tipo) && f.encounterId === r.encounterId), f => f.dados, "Triagem");
  const t = Triagem.safeParse(triagem?.valor);
  if (t.success && t.data.patientId === r.patientId && t.data.encounterId === r.encounterId && t.data.idadeAnos !== null) e.idadeAnos ??= informado(t.data.idadeAnos);
  const bio = fatos.filter(f => f.campo?.startsWith("extracao.biomarker:") || f.campo?.startsWith("biomarcador:"));
  const biomarcadores: { nome: string; resultado: string; data: string }[] = [];
  for (const id of new Set(bio.map(f => f.campo!))) {
    const b = campo(id); if (!b) continue;
    const v = objeto(b.valor), resultado = typeof b.valor === "string" ? b.valor : v.value ?? v.resultado;
    if (typeof resultado === "string" || typeof resultado === "number") biomarcadores.push({ nome: id.slice(id.indexOf(":") + 1), resultado: String(resultado), data: diaDaObservacao(b.fato.tempoClinico)! });
  }
  if (biomarcadores.length) e.biomarcadores = informado(biomarcadores);
  const labs: { exame: string; valor: string; data: string; validade: "VALIDO" | "PENDENTE" | "VENCIDO" }[] = [];
  for (const id of new Set(fatos.filter(f => f.campo?.startsWith("extracao.lab:")).map(f => f.campo!))) {
    const lab = campo(id); if (!lab) continue;
    const v = objeto(lab.valor), n = v.value ?? v.valor, unidade = v.unit ?? v.unidade;
    if (typeof n !== "number" || !Number.isFinite(n) || typeof unidade !== "string") continue;
    const data = diaDaObservacao(lab.fato.tempoClinico)!;
    const exame = id.slice(id.indexOf(":") + 1), codigo = exame.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    const hemo = ["HB", "HGB", "HT", "HCT", "ANC", "NEUTROFILOS", "PLQ", "PLAQUETAS", "LEUCOCITOS", "HEMOGRAMA"].includes(codigo);
    const bio = ["CR", "CREAT", "CREATININA", "UREIA", "NA", "SODIO", "K", "POTASSIO", "CA", "CALCIO", "MG", "MAGNESIO", "AST", "TGO", "ALT", "TGP", "BILIRRUBINA", "BT", "ALBUMINA"].includes(codigo);
    const validade = hemo || bio ? avaliarValidadeExame(hemo ? "HEMOGRAMA" : "BIOQUIMICA", lab.fato.tempoClinico, r.geradoEm).estado : "PENDENTE";
    labs.push({ exame, valor: `${n} ${unidade}`, data, validade });
    if (["extracao.lab:CR", "extracao.lab:CREATININA"].includes(id) && unidade === "mg/dL"
      && avaliarValidadeExame("BIOQUIMICA", lab.fato.tempoClinico, r.geradoEm).estado === "VALIDO") {
      e.creatininaMgDl = informado(n); e.fonteCreatinina = lab.fato.fontes.map(f => f.sourceId).join(", ");
    }
  }
  if (labs.length) e.labs = labs;
  const peso = montarFichaMinima(r).find(f => f.id === "pesoKg" && f.estado === "DOCUMENTADO");
  if (peso) e.fontePeso = peso.fontes.map(f => f.sourceId).join(", ");
  const acesso = campo("acessoVenoso");
  if (acesso && ["PERIFERICO", "PICC", "CATETER_IMPLANTADO"].includes(String(acesso.valor))) e.acessoVenoso = informado(acesso.valor as "PERIFERICO" | "PICC" | "CATETER_IMPLANTADO");
  // Toxicidade e resposta exigem o objeto estruturado; grau ou palavra soltos não viram avaliação completa.
  const tox = campo("toxicidadeAnterior"), resposta = campo("respostaDoenca");
  if (tox && typeof tox.valor === "object" && tox.valor !== null) e.toxicidade = informado(tox.valor as NonNullable<NonNullable<EntradaTelaRevisao["toxicidade"]>["valor"]>);
  if (resposta && typeof resposta.valor === "object" && resposta.valor !== null) e.resposta = informado(resposta.valor as NonNullable<NonNullable<EntradaTelaRevisao["resposta"]>["valor"]>);
  return { entrada: e, pendencias };
}
