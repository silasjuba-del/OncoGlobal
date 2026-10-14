import { ContextoInteracoesCondicionadas, RegraInteracaoCondicionada } from "../../contracts/f0c/interacoesCondicionadas.js";
import type { CatalogoInteracoes } from "../../contracts/f0c/interacoes.js";
import type { FatoRetrato } from "../../contracts/f1/retrato.js";
import type { RegraCruzamento } from "../../modules/reconciliador/index.js";
import type { OpcoesSetores } from "../../modules/setores/index.js";
import { avaliarInteracoesCondicionadas } from "../../rules/f0c/interacoesCondicionadas.js";
const objeto=(v:unknown):Record<string,unknown>|null=>v!==null&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:null;
const fontes=(f:FatoRetrato)=>f.fontes.filter(s=>s.sourceId.trim()&&!s.sourceId.includes("[VERIFICAR]")&&s.contentHash.trim()).map(s=>s.sourceId);
/** Reutiliza a condição renal existente. Creatinina não é transformada em clearance nem nova regra. */
export function criarCruzamentosMotor(opcoes:Pick<OpcoesSetores,"interacoes">,catalogo?:CatalogoInteracoes):RegraCruzamento[] {
  const configurada=opcoes.interacoes;
  if(!configurada||configurada.status!=="CONFERIDA_MEDICO"||!configurada.fonte.trim()||configurada.fonte.includes("[VERIFICAR]"))return [];
  const regras=configurada.conteudo.interacoes.flatMap(raw=>{const p=RegraInteracaoCondicionada.safeParse(raw);return p.success&&p.data.avaliacaoCondicionada.tipo==="PEMETREXEDE_IBUPROFENO"?[p.data]:[];});
  if(regras.length!==1)return [];
  const referencia=configurada.referencia;
  return [{aprovada:true,referencia,setores:["LABORATORIO","INTERACOES"],avaliar(retrato){
    if(!retrato.regras.some(r=>r.id===referencia.id&&r.versao===referencia.versao&&r.hash===referencia.hash))return [];
    const fatos=retrato.fatos.filter(f=>f.patientId===retrato.patientId&&(f.escopo==="PACIENTE"||f.tumorLotId===retrato.tumorLotId)
      &&Date.parse(f.tempoRegistro)<=Date.parse(retrato.geradoEm)&&fontes(f).length===f.fontes.length&&f.fontes.length>0);
    const contextos=fatos.filter(f=>f.tipo==="FATO"&&f.campo==="interacoesContexto"&&f.encounterId===retrato.encounterId&&f.tumorLotId===retrato.tumorLotId);
    if(contextos.length!==1)return [];
    const fatoContexto=contextos[0]!,valor=objeto(fatoContexto.dados.valor);
    const p=ContextoInteracoesCondicionadas.safeParse({...valor,referencia:retrato.geradoEm});
    if(!p.success||!p.data.clearance)return [];
    const contexto=p.data,cr=contexto.clearance!;
    // O contexto médico e um fato renal independente precisam concordar literalmente.
    const renais=fatos.filter(f=>["FATO","LabResult"].includes(f.tipo)&&f.ref.eventId!==fatoContexto.ref.eventId&&fontes(f).includes(cr.fonte)).filter(f=>{
      const v=objeto(f.dados.valor)??f.dados;
      return v.metodo==="COCKCROFT_GAULT"&&["clearance","clcr","clcrCockcroftGault","funcaoRenal"].includes(f.campo??String(f.dados.campo));
    });
    if(!renais.length||renais.some(f=>{
      const v=objeto(f.dados.valor)??f.dados;
      return v.valorMlMin!==cr.valorMlMin||v.coleta!==cr.coleta||v.validoParaDose!==true;
    }))return [];
    const conhecidas=new Set(fatos.flatMap(fontes));
    const refs=[...(contexto.reconciliacao?[contexto.reconciliacao.fonte]:[]),...contexto.exposicoes.map(e=>e.fonte),
      ...contexto.coadministracoes.map(e=>e.fonte),cr.fonte];
    if(refs.some(id=>!conhecidas.has(id)))return [];
    const r=avaliarInteracoesCondicionadas(contexto,regras,catalogo).find(r=>r.tipo==="PEMETREXEDE_IBUPROFENO");
    if(!r||r.estado!=="AVISO")return [];
    const envolvidos=[fatoContexto,...renais];
    return [{id:`cruzamento:${r.regraId}`,estado:"PENDENTE",texto:`Aviso condicionado: ${r.motivo} Classificação de risco não publicada nesta regra; revisão médica.`,fatos:envolvidos.map(f=>f.ref),regras:[referencia],setores:["LABORATORIO","INTERACOES"]}];
  }}];
}
