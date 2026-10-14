import { afterEach,expect,it } from "vitest";
import { build } from "vite";
import { spawn,type ChildProcess } from "node:child_process";
import { mkdtempSync,cpSync,mkdirSync,writeFileSync,rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { createServer } from "node:net";

const raiz=process.cwd();
let filho:ChildProcess|undefined,temporario:string|undefined,cwdAlternativo:string|undefined,dataDir:string|undefined;
afterEach(async()=>{
  if(filho&&filho.exitCode===null){const atual=filho;await new Promise<void>(resolve=>{atual.once("exit",()=>resolve());atual.kill("SIGTERM");});}filho=undefined;
  for(const pasta of [temporario,cwdAlternativo,dataDir])if(pasta)rmSync(pasta,{recursive:true,force:true});
  temporario=undefined;cwdAlternativo=undefined;dataDir=undefined;
});
async function portaLivre():Promise<number>{const s=createServer();await new Promise<void>((ok,erro)=>{s.once("error",erro);s.listen(0,"127.0.0.1",ok);});const endereco=s.address();if(!endereco||typeof endereco==="string")throw Error("PORTA_AUSENTE");await new Promise<void>(r=>s.close(()=>r()));return endereco.port;}

it("SSR compilado inicia fora da raiz, com assets copiados e sem ler fonte TS; corpus mantém regras reais",async()=>{
  // Dentro de node_modules só para resolução das dependências externas do bundle;
  // corpus é uma cópia própria e cwd fica fora do repositório.
  temporario=mkdtempSync(join(raiz,"node_modules",".f1-runtime-"));cwdAlternativo=mkdtempSync(join(tmpdir(),"f1-cwd-alternativo-"));
  cpSync(join(raiz,"corpus"),join(temporario,"corpus"),{recursive:true});
  const outDir=join(temporario,"dist","f0-demo");mkdirSync(outDir,{recursive:true});
  await build({configFile:join(raiz,"scripts","vite-f0-demo.config.mjs"),logLevel:"silent",build:{outDir,emptyOutDir:true}});
  const preload=join(temporario,"sem-fontes-ts.mjs");
  writeFileSync(preload,`import fs from 'node:fs';import {fileURLToPath} from 'node:url';const original=fs.readFileSync;fs.readFileSync=function(p,...args){const nome=p instanceof URL?fileURLToPath(p):String(p);if(/\\.tsx?$/.test(nome))throw Error('RUNTIME_LEU_FONTE_TS');return original.call(this,p,...args);};`);
  const porta=await portaLivre();let stderr="";
  filho=spawn(process.execPath,["--import",pathToFileURL(preload).href,join(outDir,"demo-servidor.mjs")],{cwd:cwdAlternativo,
    env:{...process.env,ONCOGLOBAL_API_PORT:String(porta),ONCOASSIST_OPENAI_ENABLED:"true",ONCOASSIST_JEV_ENABLED:"true"},stdio:["ignore","pipe","pipe"]});
  filho.stderr!.on("data",b=>{stderr+=String(b);});
  const ready=await new Promise<Record<string,unknown>>((ok,erro)=>{
    let stdout="";const timer=setTimeout(()=>erro(Error(`DEMO_TIMEOUT: ${stderr.slice(-2000)}`)),10_000);
    filho!.once("exit",codigo=>{clearTimeout(timer);erro(Error(`DEMO_EXIT_${codigo}: ${stderr.slice(-2000)}`));});
    filho!.stdout!.on("data",b=>{stdout+=String(b);for(const linha of stdout.split("\n")){try{const r=JSON.parse(linha) as Record<string,unknown>;if(r.tipo==="DEMONSTRACAO_EXCLUSIVAMENTE_SINTETICA"){clearTimeout(timer);ok(r);}}catch{/* aguarda linha completa */}}});
  });
  expect(ready.fontesPendentes).toBe(3);expect(ready.llmExterna).toBe("DESLIGADA");dataDir=String(ready.dataDir);
  const post=async(path:string,body:unknown,token?:string)=>{
    const r=await fetch(`http://127.0.0.1:${porta}${path}`,{method:"POST",headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
    expect(r.status).toBe(200);return await r.json() as Record<string,unknown>;
  };
  const login=await post("/login",{senha:ready.senhaSintetica});
  const consulta=await post("/consulta/carregar",{patientId:ready.patientId,encounterId:ready.encounterId,tumorLotId:ready.tumorLotId},String(login.token));
  const retrato=consulta.retrato as {biblioteca:{id:string};regras:{id:string}[]};
  expect(retrato.biblioteca.id).toBe("corpus-local");expect(retrato.regras.map(r=>r.id)).toContain("lab-thresholds");expect(retrato.regras.map(r=>r.id)).toContain("f0c-validade-exames");
  expect(stderr).not.toContain("RUNTIME_LEU_FONTE_TS");
},30_000);
