import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { URL as NodeURL, fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { RulesetHeader } from "../../contracts/agentes.js";
import type { ConfigMotor } from "../orquestracao/runtime.js";
import type { OpcoesSetores } from "../../modules/setores/index.js";
import type { LabRuleset } from "../../rules/tipos-w3.js";
import type { RulesetInteracoes } from "../../rules/w8/interacoes.js";
import { SalaoRuleset } from "../../contracts/regras.js";
import { avaliarValidadeExame } from "../../rules/f0c/clinica.js";
import { criarCruzamentosMotor } from "./cruzamentos.js";
import { lerTetosCumulativos } from "../../rules/f0c/tetosCumulativos.js";

const sha=(s:string)=>createHash("sha256").update(s).digest("hex");
/** Local bytes pinned by version. Draft packs are never promoted by this adapter. */
export function carregarConfigMotor():ConfigMotor {
  const regras:ConfigMotor["regras"]=[],opcoes:OpcoesSetores={};
  const raizes:string[]=[];
  for(const inicio of [dirname(fileURLToPath(new NodeURL(import.meta.url))),process.cwd()]){
    let atual=inicio;
    while(true){if(!raizes.includes(atual))raizes.push(atual);const pai=dirname(atual);if(pai===atual)break;atual=pai;}
  }
  // Both source execution and the SSR bundle resolve the same checked-in assets.
  const raiz=raizes.find(p=>existsSync(join(p,"corpus","rulesets")));
  if(!raiz)return {regras,biblioteca:{id:"corpus-indisponivel",versao:"F1",hash:sha("SEM_ASSETS_LOCAIS")},opcoes};
  const ler=(path:string)=>{
    const texto=readFileSync(join(raiz,"corpus",path),"utf8"),json=JSON.parse(texto) as Record<string,unknown>;
    const header=RulesetHeader.parse(json.header),ref={id:header.id,versao:header.versao,hash:sha(texto)};
    regras.push(ref);return{json,header,ref};
  };
  try {
    const {json,header,ref}=ler("rulesets/lab-thresholds.v1.json");
    const analitos=Array.isArray(json.analitos)?json.analitos as Record<string,unknown>[]:[];
    const rs:LabRuleset={id:header.id,versao:header.versao,ativo:true,analitos:analitos.map(a=>{
      const codigo=String(a.codigo),unidade=typeof a.unidadeCanonica==="string"?a.unidadeCanonica:"NAO_CURADA";
      const aliases=codigo==="CREAT"?["creatinina","cr","creat"]:codigo==="HB"?["hemoglobina"]:codigo==="ANC"?["neutrofilos","neutrófilos"]:codigo==="PLQ"?["plaquetas"]:[];
      const threshold={regraId:`${header.id}:${codigo}`,ativo:a.ativo===true,unidade,
        ...(typeof a.limiarInferior==="number"?{min:a.limiarInferior}:{}),...(typeof a.limiarSuperior==="number"?{max:a.limiarSuperior}:{})};
      // Unit equivalence only: source cutoffs are copied, never adjusted by an LLM.
      const conversoes=codigo==="HB"?[{de:"g/dL",para:unidade,fator:10,regraId:"UNIDADE_G_DG",fonte:header.fonte.referencia}]
        :codigo==="CREAT"?[{de:"mg/dL",para:unidade,fator:100,regraId:"UNIDADE_CENTESIMOS",fonte:header.fonte.referencia}]:[];
      return{codigo,aliases,threshold,conversoes};
    })};
    opcoes.laboratorio={referencia:ref,status:"CONFERIDA_MEDICO",fonte:header.fonte.referencia,conteudo:rs};
  }catch{/* Missing or invalid source yields sector coverage gap. */}
  try {
    const {json,header,ref}=ler("rulesets/interacoes.v1.json");
    const conteudo=json as unknown as RulesetInteracoes;
    const fontes=conteudo.interacoes.filter(i=>i.ativo&&i.fonte?.referencia&&!i.fonte.referencia.includes("[VERIFICAR]")&&i.fonte.trecho).map(i=>i.fonte!.referencia!);
    if(fontes.length)opcoes.interacoes={referencia:ref,status:"CONFERIDA_MEDICO",fonte:[...new Set(fontes)].join("; "),conteudo};
  }catch{/* Inactive unverified rows remain non-operational. */}
  try {const{json,header,ref}=ler("rulesets/salao-triagem.v1.json");
    opcoes.validadeHemograma={referencia:ref,status:"CONFERIDA_MEDICO",fonte:header.fonte.referencia,conteudo:SalaoRuleset.parse(json)};
  }catch{/* Gap. */}
  try {const{json,header,ref}=ler("rulesets/cumulativo-tetos.v1.json");
    opcoes.tetos={referencia:ref,status:"CONFERIDA_MEDICO",fonte:header.fonte.referencia,conteudo:lerTetosCumulativos(json)};
  }catch{/* Gap. */}
  // Pin the actual approved validity table returned by the pure compiled rule.
  // Deployment does not depend on a TypeScript source file being present.
  try{const texto=readFileSync(join(raiz,"corpus","f0c","classes-farmacos.v1.json"),"utf8");
    const catalogo=JSON.parse(texto) as {id:string;versao:string;aliases:Record<string,string[]>;classes:Record<string,string[]>};
    if(catalogo.id&&catalogo.versao&&catalogo.aliases&&catalogo.classes){opcoes.catalogoInteracoes={aliases:catalogo.aliases,classes:catalogo.classes};regras.push({id:catalogo.id,versao:catalogo.versao,hash:sha(texto)});}
  }catch{/* No class/alias inference without the local catalog. */}
  const validadeConteudo={
    hemogramaHoras:avaliarValidadeExame("HEMOGRAMA",null,null).validadeHoras,
    bioquimicaHoras:avaliarValidadeExame("BIOQUIMICA",null,null).validadeHoras,
  };
  const validadeRef={id:"f0c-validade-exames",versao:"D-F0C-01-06",hash:sha(JSON.stringify(validadeConteudo))};
  regras.push(validadeRef);opcoes.validadeExame={referencia:validadeRef,status:"CONFERIDA_MEDICO",fonte:"docs/DECISOES.md · D-F0C-01..06",conteudo:validadeConteudo};
  return{regras,biblioteca:{id:"corpus-local",versao:"F1",hash:sha(JSON.stringify(regras))},opcoes,cruzamentos:criarCruzamentosMotor(opcoes,opcoes.catalogoInteracoes)};
}
