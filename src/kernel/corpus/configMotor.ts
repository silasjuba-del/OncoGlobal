import { readFileSync } from "node:fs";
import { URL as NodeURL, fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { RulesetHeader } from "../../contracts/agentes.js";
import type { ConfigMotor } from "../orquestracao/runtime.js";
import type { OpcoesSetores } from "../../modules/setores/index.js";
import type { LabRuleset } from "../../rules/tipos-w3.js";
import type { RulesetInteracoes } from "../../rules/w8/interacoes.js";
import { SalaoRuleset } from "../../contracts/regras.js";
import { lerTetosCumulativos } from "../../rules/f0c/tetosCumulativos.js";

const sha=(s:string)=>createHash("sha256").update(s).digest("hex");
/** Local bytes pinned by version. Draft packs are never promoted by this adapter. */
export function carregarConfigMotor():ConfigMotor {
  const regras:ConfigMotor["regras"]=[],opcoes:OpcoesSetores={};
  const ler=(path:string)=>{
    const texto=readFileSync(fileURLToPath(new NodeURL(`../../../corpus/${path}`,import.meta.url)),"utf8"),json=JSON.parse(texto) as Record<string,unknown>;
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
  const validadeTexto=readFileSync(fileURLToPath(new NodeURL("../../rules/f0c/clinica.ts",import.meta.url)),"utf8");
  const validadeRef={id:"f0c-clinica",versao:"D-F0C-01-06",hash:sha(validadeTexto)};
  regras.push(validadeRef);opcoes.validadeExame={referencia:validadeRef,status:"CONFERIDA_MEDICO",fonte:"docs/DECISOES.md · D-F0C-01..06",conteudo:{}};
  return{regras,biblioteca:{id:"corpus-local",versao:"F1",hash:sha(JSON.stringify(regras))},opcoes};
}
