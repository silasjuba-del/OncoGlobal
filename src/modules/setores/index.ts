import { z } from 'zod';
import { Retrato, type FatoRetrato } from '../../contracts/f1/retrato.js';
import { Correlacao, VersaoReferencia } from '../../contracts/f1/correlacao.js';
import { AchadosSetor, type SetorClinico } from '../../contracts/f1/achadosSetor.js';
import { PrescricaoProposta } from '../../contracts/f1/prescricaoProposta.js';
import { avaliarLabAlerts } from '../../rules/labAlerts.js';
import { avaliarValidadeExame } from '../../rules/f0c/clinica.js';
import { validadeHemograma } from '../../rules/validade.js';
import { ContextoInteracoesCondicionadas } from '../../contracts/f0c/interacoesCondicionadas.js';
import { identidadeFarmaco, casaTermoFarmaco, type CatalogoInteracoes } from '../../contracts/f0c/interacoes.js';
import { avaliarInteracoesCondicionadas } from '../../rules/f0c/interacoesCondicionadas.js';
import { avaliarInteracaoMedicamentosa, type RulesetInteracoes } from '../../rules/w8/interacoes.js';
import { avaliarCtcaeGrau } from '../../rules/ctcaeGrau.js';
import { avaliarRecist } from '../../rules/recist.js';
import { avaliarTetosExposicao, chaveDroga, type LimiteExposicaoCumulativa } from '../../rules/cumulativoAlerta.js';
import type { LabRuleset, CtcaeRuleset, RecistRuleset } from '../../rules/tipos-w3.js';
import type { SalaoRuleset } from '../../contracts/regras.js';

type ReferenciaRegra = z.infer<typeof VersaoReferencia>;
export interface RegraAprovada<T> { referencia: ReferenciaRegra; status: 'CONFERIDA_MEDICO'; fonte: string; conteudo: T }
export interface RegraComorbidade { comorbidade: string; droga: string; texto: string }
export interface OpcoesSetores {
  hoje?: string;
  agora?: string;
  validadeExame?: RegraAprovada<{ hemogramaHoras?: number; bioquimicaHoras?: number }>;
  laboratorio?: RegraAprovada<LabRuleset>;
  validadeHemograma?: RegraAprovada<SalaoRuleset>;
  interacoes?: RegraAprovada<RulesetInteracoes>;
  catalogoInteracoes?: CatalogoInteracoes;
  ctcae?: RegraAprovada<CtcaeRuleset>;
  recist?: RegraAprovada<RecistRuleset>;
  tetos?: RegraAprovada<LimiteExposicaoCumulativa[]>;
  regrasComorbidades?: RegraAprovada<RegraComorbidade[]>;
  biomarcadoresObrigatorios?: RegraAprovada<string[]>;
  proposta?: PrescricaoProposta;
  completudeCumulativos?: { confirmada: boolean; fonte: string };
}
const key = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const canon = (v: unknown): string => JSON.stringify(v, (_k,x: unknown) => x && typeof x === 'object' && !Array.isArray(x)
  ? Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))) : x);
const Data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => Number.isFinite(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0,10)===s);
const Lab = z.object({codigo:z.string().min(1),valor:z.number().finite(),unidade:z.string().min(1),data:z.union([Data,z.iso.datetime({offset:true})]).optional()});
const Lesao = z.object({codigo:z.string().min(1),diametroMm:z.number().nonnegative(),confirmadaPorMedico:z.boolean()});
const Recist = z.object({lesoesAtuais:z.array(Lesao),baseline:z.array(Lesao),nadir:z.array(Lesao)});
const Ctcae = z.object({termo:z.string().min(1),ctcae_version:z.string().nullable(),medidas:z.record(z.string(),z.union([z.number(),z.string(),z.boolean(),z.null()])),basal:z.record(z.string(),z.union([z.number(),z.string(),z.boolean(),z.null()])).optional()});
const Admin = z.object({adminId:z.string().min(1),patientId:z.string().min(1),episodioId:z.string().min(1),droga:z.string().min(1),status:z.enum(['COMPLETA','PARCIAL','INTERROMPIDA','OMITIDA']),quantidadeEfetivaMgM2:z.number().nonnegative().nullable(),unidade:z.string().min(1),fonte:z.string().nullable(),realizadaEm:z.string().nullable().optional()});
function dados(f: FatoRetrato): Record<string,unknown> {
  const v=f.dados.valor; return v && typeof v==='object' && !Array.isArray(v) ? v as Record<string,unknown> : f.dados;
}
/** Fronteira E (tipo × campo): portadores genéricos (FATO etc.) têm o domínio
 * decidido pelo campo e o multidomínio legítimo é preservado. Só há conflito
 * quando um tipo material específico (ex.: ImagingReport, PathologyReport)
 * carrega campo de outro domínio específico (ex.: extracao.lab): esse fato
 * não pode alimentar resultado clínico silencioso em setor alheio. */
function dominioTipoMaterial(tipo:string):'LABORATORIO'|'IMAGEM'|'PATOLOGIA'|null {
  const t=key(tipo);
  if(/labresult/.test(t)) return 'LABORATORIO';
  if(/imaging|imagem|radiolog|examelaudo/.test(t)) return 'IMAGEM';
  if(/patholog|patolog|biopsy|biopsia/.test(t)) return 'PATOLOGIA';
  return null;
}
function campoLaboratorial(f:FatoRetrato):boolean {
  return /extracao\.lab|laborat|labresult|hemograma/.test(key(f.campo??''));
}
function conflitoTipoCampoLab(f:FatoRetrato):boolean {
  const dominio=dominioTipoMaterial(f.tipo);
  return dominio!==null && dominio!=='LABORATORIO' && campoLaboratorial(f);
}
function lacunaConflitoTipoCampo(o:AchadosSetor,f:FatoRetrato,setorDono:string) {
  lacuna(o,'CONFLITO_TIPO_CAMPO',`Metadados tipo/campo divergentes: tipo ${f.tipo} (${setorDono}) com campo laboratorial ${f.campo??'não informado'}. Fato preservado no Retrato com tipo, campo e fontes originais, sem avaliação clínica derivada dele (laboratório, RECIST ou biomarcador) nem resultado VERDE a partir dele até reconciliação; nenhum fato clínico novo foi criado.`,[f]);
}
function inicio(r: Retrato,c: Correlacao,setor:SetorClinico,padrao:RegExp): {out:AchadosSetor; fatos:FatoRetrato[]} {
  Retrato.parse(r); Correlacao.parse(c);
  if(c.patientId!==r.patientId||c.encounterId!==r.encounterId||c.tumorLotId!==r.tumorLotId||c.revisaoFatos!==r.revisao
    ||canon(c.regras)!==canon(r.regras)||canon(c.biblioteca)!==canon(r.biblioteca)) throw new Error('CORRELACAO_RETRATO_DIVERGENTE');
  if(r.fatos.some(f=>f.patientId!==r.patientId||f.escopo==='TUMOR'&&f.tumorLotId!==r.tumorLotId)) throw new Error('FATO_FORA_ESCOPO');
  const fatos=r.fatos.filter(f=>padrao.test(key(`${f.tipo} ${f.campo??''}`)));
  const out:AchadosSetor={schema:'AchadosSetor@1',setor,correlacao:c,entradas:fatos.map(f=>f.ref),cobertura:{avaliados:0,semRegraAprovada:0},achados:[],lacunas:[]};
  const validos=fatos.filter(f=>{if(!f.fontes.length){lacuna(out,'FATO_SEM_FONTE','Fato sem fonte rastreável não pode sustentar avaliação clínica.',[f]);return false;}return true;});
  return {fatos:validos,out};
}
function lacuna(o:AchadosSetor,codigo:string,texto:string,fs:FatoRetrato[]=[],semRegra=false) {
  o.lacunas.push({codigo,texto,setor:o.setor,fatos:fs.map(f=>f.ref)}); if(semRegra)o.cobertura.semRegraAprovada++;
}
function regra<T>(o:AchadosSetor,r:RegraAprovada<T>|undefined): r is RegraAprovada<T> {
  return !!r && r.status==='CONFERIDA_MEDICO' && !!r.fonte.trim() && !r.fonte.includes('[VERIFICAR]')
    && (o.correlacao.regras.some(v=>canon(v)===canon(r.referencia))||canon(o.correlacao.biblioteca)===canon(r.referencia));
}
function achado(o:AchadosSetor,id:string,texto:string,estado:'VERDE'|'VERMELHO'|'PENDENTE',fs:FatoRetrato[],refs:ReferenciaRegra[]=[]) {
  o.achados.push({id:`${o.setor}:${id}`,texto,estado,fatos:fs.map(f=>f.ref),regras:refs,setores:[o.setor]});
}
function proposta(o:AchadosSetor,p:PrescricaoProposta|undefined): PrescricaoProposta|undefined {
  if(!p){lacuna(o,'PROPOSTA_AUSENTE','Prescrição proposta não disponível.');return;}
  PrescricaoProposta.parse(p);
  if(canon(p.correlacao)!==canon(o.correlacao)||o.correlacao.proposta?.id!==p.id||o.correlacao.proposta?.revisao!==p.revisao)throw new Error('CORRELACAO_PROPOSTA_DIVERGENTE');
  return p;
}
export function avaliarLaboratorio(r:Retrato,c:Correlacao,op:OpcoesSetores={}):AchadosSetor {
  const {out:o,fatos:selecionados}=inicio(r,c,'LABORATORIO',/laborat|labresult|hemograma|extracao.lab/);
  for(const f of selecionados.filter(conflitoTipoCampoLab)) lacunaConflitoTipoCampo(o,f,'domínio do tipo divergente do laboratório');
  const fatos=selecionados.filter(f=>!conflitoTipoCampoLab(f));
  if(!selecionados.length)lacuna(o,'LAB_AUSENTE','Nenhum resultado laboratorial confirmado.');
  if(!regra(o,op.laboratorio)){lacuna(o,'LAB_SEM_REGRA','Regras laboratoriais conferidas e versionadas ausentes.',fatos,true);return o;}
  const series=new Map<string,{f:FatoRetrato;v:z.infer<typeof Lab>}[]>();
  for(const f of fatos){const d=dados(f);const vs=Array.isArray(d.valores)?d.valores:[d];for(const raw of vs){const obj=raw && typeof raw==='object'?raw as Record<string,unknown>:{}; const p=Lab.safeParse({...obj,codigo:obj.codigo??obj.campo??obj.marker,valor:obj.value??obj.valor,unidade:obj.unit??obj.unidade});
    if(!p.success){lacuna(o,'LAB_DADO_INVALIDO','Resultado sem analito, valor numérico ou unidade válidos.',[f]);continue;}
    const data=p.data.data??(typeof f.dados.factDate==='string'?f.dados.factDate:f.tempoClinico);if(!data||!z.union([Data,z.iso.datetime({offset:true})]).safeParse(data).success){lacuna(o,'LAB_DATA_AUSENTE','Data clínica válida de coleta necessária.',[f]);continue;}
    if(op.hoje&&data.slice(0,10)>op.hoje){lacuna(o,'LAB_DATA_FUTURA','Coleta futura não representa função orgânica atual.',[f]);continue;}
    const lista=series.get(key(p.data.codigo))??[];lista.push({f,v:{...p.data,data}});series.set(key(p.data.codigo),lista);}}
  for(const [codigo,serie] of series){serie.sort((a,b)=>a.v.data!.localeCompare(b.v.data!));const data=serie.at(-1)!.v.data;
    const atuais=serie.filter(x=>x.v.data===data);const eHemograma=/hemoglobina|hemograma|neutrofil|plaquet|leucoc|anc|^hb$|^plq$/.test(codigo);const validade=eHemograma&&regra(o,op.validadeHemograma)&&op.hoje&&Data.safeParse(op.hoje).success?validadeHemograma(data!,op.hoje,op.validadeHemograma.conteudo):null;const vClinica=regra(o,op.validadeExame)?avaliarValidadeExame(eHemograma?'HEMOGRAMA':'BIOQUIMICA',data!,op.agora??op.hoje??null,eHemograma?op.validadeExame.conteudo.hemogramaHoras:op.validadeExame.conteudo.bioquimicaHoras):null;const resultado=avaliarLabAlerts(atuais.map(x=>({codigo:x.v.codigo,valor:x.v.valor,unidade:x.v.unidade,data:x.v.data!})),op.laboratorio.conteudo);
    for(const a of resultado.achados){if(a.estado==='PENDENTE')lacuna(o,`${a.codigo}_COBERTURA`,a.motivo,atuais.map(x=>x.f),true);
      else{o.cobertura.avaliados++;achado(o,`${codigo}:${data}`,`${codigo}: ${a.motivo}; coleta ${data}. Série documentada: ${serie.map(x=>`${x.v.data} ${x.v.valor} ${x.v.unidade}`).join('; ')}`,a.estado==='VERDE'&&(vClinica?vClinica.estado!=='VALIDO':eHemograma&&validade?.estado!=='VERDE')?'PENDENTE':a.estado,serie.map(x=>x.f),[op.laboratorio.referencia,...(regra(o,op.validadeExame)?[op.validadeExame.referencia]:eHemograma&&regra(o,op.validadeHemograma)?[op.validadeHemograma.referencia]:[])]);}}
    if(vClinica){if(vClinica.estado!=='VALIDO')lacuna(o,`${codigo}_VALIDADE`,vClinica.motivo??'Validade não demonstrada.',atuais.map(x=>x.f));}
    else if(validade){const v=validade;
      if(v.estado==='PENDENTE')lacuna(o,`${codigo}_VALIDADE`,v.motivo,atuais.map(x=>x.f));}
    else if(eHemograma)lacuna(o,`${codigo}_VALIDADE_NAO_AVALIADA`,'Validade não avaliada: relógio ou regra de validade ausente.',atuais.map(x=>x.f));
  }return AchadosSetor.parse(o);
}
export function avaliarImagem(r:Retrato,c:Correlacao,op:OpcoesSetores={}):AchadosSetor {
  const {out:o,fatos}=inicio(r,c,'IMAGEM',/imagem|imaging|radiolog/);
  if(!fatos.length)lacuna(o,'IMAGEM_AUSENTE','Laudo de imagem confirmado ausente.');
  for(const f of fatos){const contraditorio=conflitoTipoCampoLab(f);if(contraditorio)lacunaConflitoTipoCampo(o,f,'IMAGEM');
    const d=dados(f),texto=typeof d.textoLaudo==='string'?d.textoLaudo:typeof d.resumo==='string'?d.resumo:typeof f.dados.textoLaudo==='string'?f.dados.textoLaudo:typeof f.dados.resumo==='string'?f.dados.resumo:null;
    if(!texto){lacuna(o,'LAUDO_AUSENTE','Texto do laudo necessário; imagem bruta não é laudo.',[f]);continue;}
    lacuna(o,`IMAGEM_REVISAO:${f.ref.eventId}`,`Camada 1 (laudo preservado): ${texto}. Camada 2 (estrutura): ${JSON.stringify(d.achados??{})}. Camada 3 (resposta): apenas proposta para revisão médica.`,[f]);
    // Laudo/fontes/entradas acima ficam preservados, mas fato tipo×campo contraditório não alimenta cálculo clínico (RECIST).
    if(contraditorio)continue;
    const rec=Recist.safeParse(d.recist);if(!regra(o,op.recist)||!rec.success){lacuna(o,'RECIST_SEM_COBERTURA','RECIST exige lesões confirmadas, baseline, nadir e regra aprovada.',[f],true);continue;}
    const v=avaliarRecist(rec.data,op.recist.conteudo);if(v.candidate_response===null)lacuna(o,'RECIST_INCOMPLETO',v.achado.motivo,[f]);else{o.cobertura.avaliados++;achado(o,`RECIST:${f.ref.eventId}`,`RECIST proposto: ${v.candidate_response}; revisão médica obrigatória.`,'PENDENTE',[f],[op.recist.referencia]);}
  }return o;
}
export function avaliarPatologia(r:Retrato,c:Correlacao,op:OpcoesSetores={}):AchadosSetor {
  const {out:o,fatos}=inicio(r,c,'PATOLOGIA',/patolog|pathology|biomarc|biopsy|biopsia/);
  if(!fatos.length)lacuna(o,'PATOLOGIA_AUSENTE','Patologia e biomarcadores não documentados.');
  for(const f of fatos){if(conflitoTipoCampoLab(f)){lacunaConflitoTipoCampo(o,f,'PATOLOGIA');continue;}
    const d=dados(f);if(d.pT!=null && !['RESSECCAO','RESECTION'].includes(String(d.specimenRole??d.specimen_role)))
    lacuna(o,`PT:${f.ref.eventId}`,'pT não aplicável sem peça de ressecção identificada; não promover biópsia a estadiamento patológico.',[f]);
    if(d.specimenRole==null&&d.specimen_role==null)lacuna(o,'SPECIMEN_ROLE_AUSENTE','Papel da amostra não identificado.',[f]);}
  // Fontes excluídas por conflito tipo×campo não sustentam biomarcador, nem indiretamente.
  const fatosValidos=fatos.filter(f=>!conflitoTipoCampoLab(f));
  if(!regra(o,op.biomarcadoresObrigatorios))lacuna(o,'BIOMARCADOR_COBERTURA','Aplicabilidade de biomarcadores sem regra aprovada para o tumor.',fatos,true);
  else for(const nome of op.biomarcadoresObrigatorios.conteudo){const fs=fatosValidos.filter(f=>key(String(dados(f).nome??f.campo??''))===key(nome));
    if(!fs.length||fs.every(f=>dados(f).resultado==null&&dados(f).valor==null))lacuna(o,`BIOMARCADOR_${nome}`,'Biomarcador ausente ou não informado; ausência não é resultado negativo.',fs);
    else {o.cobertura.avaliados++;achado(o,nome,`${nome}: resultado documentado, aplicabilidade vinculada ao tumor.`,'PENDENTE',fs,[op.biomarcadoresObrigatorios.referencia]);}}
  return o;
}
function nomesMedicamentos(f:FatoRetrato):string[]{const d=dados(f);const lista=Array.isArray(f.dados.valor)?f.dados.valor:Array.isArray(d.medicamentos)?d.medicamentos:[d];return lista.flatMap(x=>{if(typeof x==='string')return [x];if(x&&typeof x==='object'){const n=(x as Record<string,unknown>).drug??(x as Record<string,unknown>).nome;return typeof n==='string'?[n]:[];}return [];});}
function condicionada(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false;
  const value = (item as Record<string, unknown>).avaliacaoCondicionada;
  // Any conditional metadata excludes the row from the blanket lexical evaluator.
  return value !== null && value !== undefined;
}
function avaliarCondicionadasDoRetrato(o: AchadosSetor, r: Retrato, p: PrescricaoProposta | undefined,
  fatosMedicamentos: FatoRetrato[], op: OpcoesSetores, regras: readonly unknown[]): void {
  if (!regras.length || !op.interacoes) return;
  const comTipo = regras.filter(row => {
    const c = (row as Record<string, unknown>).avaliacaoCondicionada;
    return c !== null && typeof c === 'object' && !Array.isArray(c)
      && typeof (c as Record<string, unknown>).tipo === 'string' && String((c as Record<string, unknown>).tipo).trim().length > 0;
  });
  if (comTipo.length !== regras.length) lacuna(o, 'INTERACOES_REGRA_CONDICIONADA_INVALIDA',
    'Metadado condicionado sem tipo válido; cobertura não demonstrada e avaliação lexical não autorizada.', fatosMedicamentos, true);
  if (!comTipo.length) return;
  const ctxs = r.fatos.filter(f => f.tipo === 'FATO' && f.campo === 'interacoesContexto'
    && f.encounterId === o.correlacao.encounterId && f.tumorLotId === o.correlacao.tumorLotId);
  const invalidar = (codigo: string, texto: string) => lacuna(o, codigo, texto, ctxs, true);
  if (!ctxs.length || ctxs.some(f => !f.fontes.length || Date.parse(f.tempoRegistro)>Date.parse(op.agora??r.geradoEm))
    || new Set(ctxs.map(f => canon(dados(f)))).size !== 1) {
    invalidar('INTERACOES_CONTEXTO_AUSENTE_OU_CONFLITANTE', 'Interações condicionadas exigem contexto reconciliado do encontro atual com fontes, sem conflito.'); return;
  }
  const parsed = ContextoInteracoesCondicionadas.safeParse({...dados(ctxs[0]!), referencia: op.agora ?? r.geradoEm});
  if (!parsed.success) { invalidar('INTERACOES_CONTEXTO_INVALIDO', 'Contexto temporal, formulação, função orgânica ou fonte inválidos.'); return; }
  const ctx = parsed.data;
  const referencias = [...(ctx.reconciliacao ? [ctx.reconciliacao.fonte] : []), ...ctx.exposicoes.map(x => x.fonte),
    ...ctx.coadministracoes.map(x => x.fonte), ...(ctx.clearance ? [ctx.clearance.fonte] : []),
    ...ctx.vacinas.map(x => x.fonte), ...(ctx.quimioterapia ? [ctx.quimioterapia.fonte] : []),
    ...(ctx.recuperacaoImune ? [ctx.recuperacaoImune.fonte] : [])];
  const conhecidas = new Set(r.fatos.filter(f => Date.parse(f.tempoRegistro) <= Date.parse(op.agora ?? r.geradoEm)).flatMap(f => f.fontes.map(x => x.sourceId)));
  if (referencias.some(id => !conhecidas.has(id))) { invalidar('INTERACOES_FONTE_NAO_REFERENCIADA', 'Contexto referencia fonte ausente do Retrato confirmado.'); return; }
  const nome = (v: string) => identidadeFarmaco(v, op.catalogoInteracoes);
  const meds = fatosMedicamentos.filter(f => f.encounterId === o.correlacao.encounterId && f.campo === 'medicamentos');
  const listas = meds.map(f => [...new Set(nomesMedicamentos(f).map(nome))].sort());
  const listaContexto = [...new Set((ctx.medicamentosAtuais ?? []).map(nome))].sort();
  if (!listas.length || listas.some(l => l.some(n => !n) || canon(l) !== canon(listaContexto))) {
    invalidar('INTERACOES_MEDICAMENTOS_DIVERGENTES', 'Contexto condicionado não corresponde à lista de medicamentos confirmada neste encontro.'); return;
  }
  const exposicoes = new Set(ctx.exposicoes.map(x => nome(x.droga)));
  if (p?.itens.some(item => !nome(item.drug) || !exposicoes.has(nome(item.drug)))) {
    invalidar('INTERACOES_PROPOSTA_NAO_COBERTA', 'Contexto não documenta exposição/formulação de todos os medicamentos propostos; não inferir do texto.'); return;
  }
  const fontesNecessarias = new Set(referencias);
  const evidencias = [...new Map([...ctxs, ...meds, ...r.fatos.filter(f => f.fontes.some(x => fontesNecessarias.has(x.sourceId)))].map(f => [canon(f.ref), f])).values()];
  o.entradas = [...new Map([...o.entradas, ...evidencias.map(f => f.ref)].map(ref => [canon(ref), ref])).values()];
  const resultados = avaliarInteracoesCondicionadas(ctx, comTipo, op.catalogoInteracoes);
  const tipos = new Set(comTipo.flatMap(row => { const obj = row as Record<string, unknown>; const c = obj.avaliacaoCondicionada as Record<string, unknown> | undefined; return typeof c?.tipo === 'string' ? [c.tipo] : []; }));
  for (const tipo of tipos) {
    const v = resultados.find(item => item.tipo === tipo);
    if (!v || v.estado === 'PENDENTE') { lacuna(o, `CONDICIONADA:${tipo}`, v?.motivo ?? 'Tipo de interação condicionada não implementado.', evidencias, true); continue; }
    o.cobertura.avaliados++;
    // AVISO is a sourced clinical warning, not a graded severity or contraindication inferred by code.
    achado(o, `CONDICIONADA:${tipo}`, `${v.estado === 'AVISO' ? 'Aviso condicionado: ' : 'Condição individual não aplicável: '}${v.motivo} Não determina elegibilidade geral e não altera prescrição.`,
      'PENDENTE', evidencias, [op.interacoes.referencia]);
  }
}
export function avaliarInteracoes(r:Retrato,c:Correlacao,op:OpcoesSetores={}):AchadosSetor {
  const {out:o,fatos}=inicio(r,c,'INTERACOES',/medic|reconcili/);const p=proposta(o,op.proposta);
  // Aliases aprovados são a mesma droga: comparar listas e pares pela identidade do catálogo; alias ambíguo fica distinto.
  const ident=(v:string)=>identidadeFarmaco(v,op.catalogoInteracoes)||`?${key(v.trim())}`;
  if(!fatos.length||!fatos.some(f=>key(f.campo??'')==='medicamentos'||dados(f).reconciliada===true||dados(f).reconciliacaoConfirmada===true)){lacuna(o,'MEDS_RECONCILIAR','Lista de medicamentos precisa de reconciliação explícita, inclusive antes do ciclo 1.',fatos);return o;}
  const atuais=fatos.flatMap(f=>nomesMedicamentos(f).map(nome=>({nome,f})));
  const listas = fatos.filter(f => key(f.campo ?? '') === 'medicamentos').map(f =>
    Array.isArray(f.dados.valor) && f.dados.valor.every(v => typeof v === 'string' && v.trim())
      ? [...new Set((f.dados.valor as string[]).map(ident))].sort() : null);
  if (new Set(listas.filter(l => l !== null).map(canon)).size > 1) {
    lacuna(o,'MEDS_RECONCILIACAO_CONFLITANTE','Listas completas confirmadas divergem; não unir medicamentos nem escolher uma lista.',
      fatos.filter(f => key(f.campo ?? '') === 'medicamentos'));
    return o;
  }
  const listaConhecida = listas.length > 0 && listas.every(l => l !== null) && new Set(listas.map(canon)).size === 1;
  const identidades = new Set([...atuais.map(m => m.nome), ...(p?.itens.map(i => i.drug) ?? [])].map(ident));
  const semParesLexicais = listaConhecida && identidades.size < 2;
  const temContextoCondicionado = r.fatos.some(f => f.tipo === 'FATO' && f.campo === 'interacoesContexto');
  // Ausência de par atual dispensa só o lexical; histórico explícito ainda exige avaliação temporal.
  if (semParesLexicais && !temContextoCondicionado) return o;
  if(!regra(o,op.interacoes)){lacuna(o,'INTERACAO_SEM_REGRA','Catálogo curado de interações ausente.',fatos,true);return o;}
  const rows = op.interacoes.conteudo.interacoes;
  const parCondicionado = (a: string, b: string) => rows.some(row => condicionada(row) &&
    ((casaTermoFarmaco(row.drogaA,a,op.catalogoInteracoes)&&casaTermoFarmaco(row.drogaBouClasse,b,op.catalogoInteracoes))
      ||(casaTermoFarmaco(row.drogaA,b,op.catalogoInteracoes)&&casaTermoFarmaco(row.drogaBouClasse,a,op.catalogoInteracoes))));
  const lexicais: RulesetInteracoes = {...op.interacoes.conteudo, interacoes: rows.filter(item => !condicionada(item))};
  avaliarCondicionadasDoRetrato(o,r,p,fatos,op,rows.filter(condicionada));
  if (semParesLexicais) return o;
  const pares=new Set<string>();
  for(const item of p?.itens??[])for(const med of atuais){if(ident(item.drug)===ident(med.nome))continue;const id=[ident(item.drug),ident(med.nome)].sort().join('+');if(pares.has(id))continue;pares.add(id);
    if(parCondicionado(item.drug,med.nome))continue;
    const v=avaliarInteracaoMedicamentosa(item.drug,med.nome,lexicais,op.catalogoInteracoes);if(!v.regraAtiva)lacuna(o,id,v.motivo,[med.f],true);else{o.cobertura.avaliados++;achado(o,id,v.severidade===null?`${v.motivo}; aviso de fonte sem severidade curada; não determina elegibilidade.`:v.motivo,v.severidade===null?'PENDENTE':v.estado,[med.f],[op.interacoes.referencia]);}}
  for(let i=0;i<(p?.itens.length??0);i++)for(let j=i+1;j<(p?.itens.length??0);j++){
    const drugA=p!.itens[i]!.drug,drugB=p!.itens[j]!.drug;if(ident(drugA)===ident(drugB))continue;
    const id=[ident(drugA),ident(drugB)].sort().join('+');if(pares.has(id))continue;pares.add(id);
    if(parCondicionado(drugA,drugB))continue;
    const v=avaliarInteracaoMedicamentosa(drugA,drugB,lexicais,op.catalogoInteracoes);
    if(!v.regraAtiva)lacuna(o,id,v.motivo,[],true);else{lacuna(o,`PROPOSTA:${id}`,`${v.motivo}; avaliação da proposta exige referência tipada ao rascunho.`);}
  }
  // An existing reconciled medication list is independently evaluable, even without a future Rx proposal.
  for (let i=0;i<atuais.length;i++) for (let j=i+1;j<atuais.length;j++) {
    const a=atuais[i]!,b=atuais[j]!;if(ident(a.nome)===ident(b.nome))continue;
    const id=[ident(a.nome),ident(b.nome)].sort().join('+');if(pares.has(id))continue;pares.add(id);
    if(parCondicionado(a.nome,b.nome))continue;
    const v=avaliarInteracaoMedicamentosa(a.nome,b.nome,lexicais,op.catalogoInteracoes);
    const refs=[...new Map([a.f,b.f].map(f=>[canon(f.ref),f])).values()];
    if(!v.regraAtiva)lacuna(o,id,v.motivo,refs,true);
    else {o.cobertura.avaliados++;achado(o,id,v.severidade===null?`${v.motivo}; aviso de fonte sem severidade curada; não determina elegibilidade.`:v.motivo,
      v.severidade===null?'PENDENTE':v.estado,refs,[op.interacoes.referencia]);}
  }
  if(!pares.size)lacuna(o,'INTERACAO_PARES_AUSENTES','Nenhum par medicamentoso distinto disponível para avaliação.',fatos);
  return o;
}
export function avaliarComorbidades(r:Retrato,c:Correlacao,op:OpcoesSetores={}):AchadosSetor {
  const {out:o,fatos}=inicio(r,c,'COMORBIDADES',/comorbid/);if(!fatos.length)lacuna(o,'COMORBIDADES_AUSENTES','Histórico de comorbidades não documentado.');
  const p=proposta(o,op.proposta);if(!regra(o,op.regrasComorbidades)){lacuna(o,'COMORBIDADE_COBERTURA','Cruzamento comorbidade × droga sem regras aprovadas.',fatos,true);return o;}if(!p)return o;
  for(const f of fatos){const nomes=Array.isArray(f.dados.valor)?f.dados.valor:[dados(f).nome??dados(f).descricao??dados(f).valor??''];for(const rawNome of nomes){const nome=String(rawNome);for(const item of p.itens){const rs=op.regrasComorbidades.conteudo.filter(x=>key(x.comorbidade)===key(nome)&&key(x.droga)===key(item.drug));
    if(!rs.length)lacuna(o,`${f.ref.eventId}:${item.drug}`,'Par comorbidade × medicamento sem cobertura.',[f],true);for(const reg of rs){o.cobertura.avaliados++;achado(o,`${f.ref.eventId}:${item.drug}`,reg.texto,'VERMELHO',[f],[op.regrasComorbidades.referencia]);}}}}return o;
}
export function avaliarToxicidades(r:Retrato,c:Correlacao,op:OpcoesSetores={}):AchadosSetor {
  const {out:o,fatos}=inicio(r,c,'TOXICIDADES',/toxic|ctcae/);if(!fatos.length)lacuna(o,'TOXICIDADE_AUSENTE','Toxicidades não documentadas; ausência não representa grau 0.');
  if(!regra(o,op.ctcae)||!/^v?6(?:\.0)?$/i.test(op.ctcae.conteudo.ctcae_version)){lacuna(o,'CTCAE_V6_COBERTURA','Regras CTCAE v6 conferidas ausentes; não aplicar v5.',fatos,true);return o;}
  for(const f of fatos){const p=Ctcae.safeParse(dados(f));if(!p.success){lacuna(o,'CTCAE_DADOS','Medidas, termo e versão CTCAE necessários.',[f]);continue;}
    const v=avaliarCtcaeGrau({termo:p.data.termo,ctcae_version:p.data.ctcae_version,medidas:p.data.medidas,...(p.data.basal?{basal:p.data.basal}:{})},op.ctcae.conteudo);if(v.candidate_grade===null)lacuna(o,'CTCAE_GRAU_AUSENTE',v.achado.motivo,[f]);else{o.cobertura.avaliados++;achado(o,f.ref.eventId,`CTCAE v6 grau candidato ${v.candidate_grade}; revisão médica obrigatória; nenhuma dose alterada.`,'PENDENTE',[f],[op.ctcae.referencia]);}}return o;
}
/** Portas de dados já documentados; sem regra de aplicabilidade não há conduta ou cálculo novos. */
function lacunasAplicabilidadeTratamento(o:AchadosSetor,r:Retrato,tratamentos:FatoRetrato[],op:OpcoesSetores):void {
  const campos=new Set(['riscofn','clearance','clcr','clcrcockcroftgault','funcaorenal']);
  for(const f of r.fatos.filter(f=>f.tipo==='FATO'&&campos.has(key(f.campo??'')))) {
    const risco=key(f.campo??'')==='riscofn',prefixo=risco?'RISCO_FN':'CLEARANCE';
    const refs=[...new Map([f,...tratamentos].map(x=>[canon(x.ref),x])).values()];
    o.entradas=[...new Map([...o.entradas,f.ref].map(ref=>[canon(ref),ref])).values()];
    if(!f.fontes.length){lacuna(o,`${prefixo}_FONTE_AUSENTE`,'Dado de aplicabilidade sem fonte rastreável.',refs);continue;}
    if(f.encounterId!==r.encounterId||Date.parse(f.tempoRegistro)>Date.parse(op.agora??r.geradoEm)){
      lacuna(o,`${prefixo}_CONTEXTO_NAO_ATUAL`,'Aplicabilidade do dado neste encontro não confirmada.',refs);continue;
    }
    if(risco){
      const valor=dados(f).valor;
      if(typeof valor!=='number'||!Number.isFinite(valor)){lacuna(o,'RISCO_FN_DADO_AUSENTE','Risco de neutropenia febril não informado como valor numérico finito.',refs);continue;}
      lacuna(o,'RISCO_FN_SEM_REGRA','Risco de neutropenia febril documentado; regra de aplicabilidade e suporte não disponível nesta avaliação. Revisão médica necessária, sem indicação automática.',refs,true);
      continue;
    }
    const d=dados(f),v=d.valorMlMin,unidade=Object.hasOwn(d,'unidade')?d.unidade:Object.hasOwn(d,'valorMlMin')?'mL/min':null;
    if(typeof d.fonte!=='string'||!f.fontes.some(s=>s.sourceId===d.fonte)){
      lacuna(o,'CLEARANCE_FONTE_DIVERGENTE','Fonte declarada do clearance não corresponde ao fato confirmado.',refs);continue;
    }
    if(typeof v!=='number'||!Number.isFinite(v)||v<=0||unidade!=='mL/min'||d.metodo!=='COCKCROFT_GAULT'){
      lacuna(o,'CLEARANCE_DADO_INVALIDO','Clearance requer valor explícito em mL/min e método documentado; não converter pela magnitude.',refs);continue;
    }
    if(d.validoParaDose!==true){lacuna(o,'CLEARANCE_APLICABILIDADE_NAO_CONFIRMADA','Aplicabilidade do clearance para dose não confirmada.',refs);continue;}
    if(!regra(o,op.validadeExame)){lacuna(o,'CLEARANCE_VALIDADE_SEM_REGRA','Validade do dado renal não demonstrada por regra aprovada.',refs,true);continue;}
    const validade=avaliarValidadeExame('BIOQUIMICA',typeof d.coleta==='string'?d.coleta:null,op.agora??r.geradoEm,op.validadeExame.conteudo.bioquimicaHoras);
    if(validade.estado!=='VALIDO'){lacuna(o,'CLEARANCE_VALIDADE',validade.motivo??'Validade do dado renal não demonstrada.',refs);continue;}
    lacuna(o,'RENAL_TRATAMENTO_SEM_REGRA','Clearance documentado; aplicação ao tratamento exige regra aprovada específica. Revisão médica necessária, sem substituir fármaco ou ajustar dose.',refs,true);
  }
}
export function avaliarTratamento(r:Retrato,c:Correlacao,op:OpcoesSetores={}):AchadosSetor {
  const {out:o,fatos}=inicio(r,c,'TRATAMENTO',/tratamento|treatment|administr|prescri|ciclo|exposicaocumulativa/);const p=proposta(o,op.proposta);
  lacunasAplicabilidadeTratamento(o,r,fatos,op);
  for(const f of fatos){const d=dados(f);const camada=String(d.camada??d.status??'NAO_INFORMADA');lacuna(o,`TRATAMENTO_CONTEXTO:${f.ref.eventId}`,`Registro de tratamento ${camada}; planejado, proposto, assinado e administrado são evidências distintas.`,[f]);}
  if(p)for(const item of p.itens){lacuna(o,`PROPOSTA:${item.sequence}`,`Proposta ${item.classe}: ${item.drug}; não comprova assinatura nem administração.`);
    if(item.calculatedDose===null||item.prescribedDose===null)lacuna(o,`DOSE:${item.sequence}`,'Dose calculada ou prescrita ausente; nenhum cálculo por LLM.');}
  if(!regra(o,op.tetos)){lacuna(o,'CUMULATIVO_COBERTURA','Tetos cumulativos aprovados ausentes.',fatos,true);return o;}
  // Administrações são sistêmicas: todos os episódios do paciente, mesmo fora do lote selecionado.
  const exposicoes=r.fatos.filter(f=>key(f.campo??'')==='exposicaocumulativa');
  const admins=r.fatos.filter(f=>/administr/.test(key(f.tipo))||key(f.campo??'')==='exposicaocumulativa').flatMap(f=>{
    const d=dados(f);const raw=Array.isArray(d.administracoes)?d.administracoes:[d];return raw.flatMap(v=>{
      if(!f.fontes.length){lacuna(o,'ADMINISTRACAO_SEM_FONTE','Administração sem fonte rastreável.',[f]);return [];}
      const a=Admin.safeParse(v);if(!a.success){lacuna(o,'ADMINISTRACAO_INCOMPLETA','Administração sem dose normalizada explícita, unidade, fonte ou escopo; não converter mg para mg/m².',[f]);return [];}
      if(a.data.patientId!==r.patientId)throw new Error('ADMINISTRACAO_PACIENTE_DIVERGENTE');
      if(!a.data.realizadaEm||!Number.isFinite(Date.parse(a.data.realizadaEm))||Date.parse(a.data.realizadaEm)>Date.parse(r.geradoEm)){
        lacuna(o,'ADMINISTRACAO_TEMPO_INVALIDO','Instante efetivo de administração ausente ou futuro.',[f]);return [];}
      return [{f,a:a.data}];});});
  const drogas=[...new Set([...(p?.itens.map(i=>i.drug)??[]),...admins.map(x=>x.a.droga)])];
  for(const droga of drogas){const limites=op.tetos.conteudo.filter(x=>chaveDroga(x.droga)===chaveDroga(droga));const evidencias=exposicoes.filter(f=>chaveDroga(String(dados(f).droga??''))===chaveDroga(droga));const completo=evidencias.length===1&&dados(evidencias[0]!).historicoCompleto===true;const fonteCompleto=evidencias.length===1&&typeof dados(evidencias[0]!).fonteCompletude==='string'?String(dados(evidencias[0]!).fonteCompletude):null;const v=avaliarTetosExposicao({patientId:r.patientId,droga,administracoes:admins.map(x=>({...x.a,realizadaEm:x.a.realizadaEm??null})),historicoCompleto:op.completudeCumulativos?.confirmada??completo,fonteCompletude:op.completudeCumulativos?.fonte??fonteCompleto},limites);
    const fs=admins.filter(x=>v.adminIds.includes(x.a.adminId)).map(x=>x.f);for(const motivo of v.pendencias)lacuna(o,`${droga}:${motivo}`,motivo,fs,motivo.includes('LIMITE'));
    if(v.estado==='AVISO'){o.cobertura.avaliados++;achado(o,`CUM:${droga}`,`${droga}: exposição efetiva conhecida ${v.totalConhecidoMgM2} ${v.unidade}; teto atingido; consulta segue.`,'VERMELHO',fs,[op.tetos.referencia]);}
    else if(v.estado==='ALARANJADO')lacuna(o,`CUMULATIVO_PARCIAL:${droga}`,'Histórico ou administração parcial; total conhecido não comprova exposição completa.',fs);
    else if(v.estado==='SEM_AVISO'&&!v.pendencias.length){o.cobertura.avaliados++;achado(o,`CUM:${droga}`,`${droga}: exposição efetiva documentada ${v.totalMgM2} ${v.unidade}; teto não atingido.`,'VERDE',fs,[op.tetos.referencia]);}
  }return o;
}
export function avaliarSetores(r:Retrato,c:Correlacao,op:OpcoesSetores={}):AchadosSetor[]{return [avaliarLaboratorio,avaliarImagem,avaliarPatologia,avaliarComorbidades,avaliarInteracoes,avaliarToxicidades,avaliarTratamento].map(fn=>AchadosSetor.parse(fn(r,c,op)));}
