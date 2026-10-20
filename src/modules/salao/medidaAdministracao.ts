import type { TreatmentAdministration } from '../../contracts/clinico.js';
import { hashCanonico } from '../../rules/conteudoCanonico.js';

// Aritmética decimal de unidades; não é faixa de dose nem limiar clínico.
function decimal(n:number) {
 const [m,e='0']=String(n).toLowerCase().split('e');
 return {n:BigInt(m!.replace('.','')),e:Number(e)-(m!.split('.')[1]?.length??0)};
}
export function validarMedidaAdministracao(a:TreatmentAdministration):{ok:true}|{ok:false;codigo:string} {
 const m=a.medidaInformada;if(!m)return {ok:true}; // legado: expor pendência, nunca inferir unidade
 const x=decimal(m.valor),y=decimal(m.unidade==='mL'?m.concentracaoSolucaoMgMl:1),z=decimal(a.quantidadeEfetivaMg);
 const exp=Math.min(x.e+y.e,z.e);
 return x.n*y.n*10n**BigInt(x.e+y.e-exp)===z.n*10n**BigInt(z.e-exp)
  ?{ok:true}:{ok:false,codigo:'MEDIDA_E_MG_DIVERGENTES'};
}

/** Avisos não descartam bolsas, não elegem duplicata e não decidem conduta. */
export function avisosAdministracao(a:TreatmentAdministration,outras:readonly TreatmentAdministration[]):string[] {
 const avisos:string[]=[];
 if(!a.medidaInformada)avisos.push('Unidade de entrada não documentada. Registro expresso em mg; conferir a medida original.');
 if(!a.superficieCorporalNoDia)avisos.push('SC da data da infusão não documentada; cumulativo em mg/m² pendente.');
 const pares=outras.filter(b=>b.adminId!==a.adminId&&b.cicloId===a.cicloId&&b.item===a.item&&b.droga===a.droga);
 if(pares.length)avisos.push(`Mais de uma administração do mesmo item/ciclo: ${[a,...pares].map(b=>`${b.adminId}: ${b.quantidadeEfetivaMg} mg, ${b.inicio??'hora não informada'}`).join('; ')}. Conferir bolsas distintas ou duplicidade; registros preservados.`);
 return avisos;
}

/** Cada medida histórica mantém sua SC/fonte. Não recebe SC atual nem soma fármacos diferentes. */
export function exposicaoLocalMgM2(administracoes:readonly TreatmentAdministration[],droga:string,provenienciaPendente:readonly string[]=[]) {
 const porId=new Map<string,TreatmentAdministration>();const conflitos=new Set<string>();
 for(const a of administracoes){
  const anterior=porId.get(a.adminId);
  if(anterior&&hashCanonico(anterior)!==hashCanonico(a))conflitos.add(a.adminId);
  else porId.set(a.adminId,a);
 }
 const itens=[...porId.values()].filter(a=>a.droga===droga&&a.status!=='OMITIDA'&&a.quantidadeEfetivaMg>0);
 const idsDroga=new Set(administracoes.filter(a=>a.droga===droga).map(a=>a.adminId));
 const pendentes=[...new Set([...itens.filter(a=>!a.superficieCorporalNoDia).map(a=>a.adminId),
  ...provenienciaPendente.filter(id=>idsDroga.has(id)),...conflitos].filter(id=>idsDroga.has(id)))];
 const valores=itens.map(a=>({adminId:a.adminId,mg:a.quantidadeEfetivaMg,sc:a.superficieCorporalNoDia??null,
  mgM2:a.superficieCorporalNoDia&&!pendentes.includes(a.adminId)?a.quantidadeEfetivaMg/a.superficieCorporalNoDia.valorM2:null,fonte:a.fonte}));
 return {droga,unidade:'mg/m2' as const,origem:'ADMINISTRADO_LOCAL' as const,pendentes,
  total:pendentes.length?null:valores.reduce((s,a)=>s+(a.mgM2??0),0),administracoes:valores};
}
