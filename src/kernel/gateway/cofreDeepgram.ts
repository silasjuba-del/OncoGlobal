import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {existsSync,lstatSync,mkdirSync,readFileSync,writeFileSync,renameSync,unlinkSync} from 'node:fs';
import {isAbsolute,join,resolve} from 'node:path';

export interface CofreDeepgram {ler(medicoId:string):string|null;salvar(medicoId:string,chave:string):void;remover(medicoId:string):void}
const CABECALHO='OncoGlobal.Deepgram.DPAPI.CurrentUser.v1\n';
const valida=(s:string)=>/^[A-Za-z0-9_-]{20,256}$/.test(s);
type Criptografia=(operacao:'Protect'|'Unprotect',dados:Buffer,contexto:string)=>Buffer;
/** O segredo passa somente por stdin/stdout privados do subprocesso, nunca por argumentos, ambiente ou logs. */
export const dpapi:Criptografia=(operacao,dados,contexto)=>{
 if(process.platform!=='win32'||!process.env.SystemRoot)throw Error('COFRE_WINDOWS_INDISPONIVEL');
 const script=`$ErrorActionPreference='Stop'; try {
 Add-Type -AssemblyName System.Security
 $p=[Console]::In.ReadToEnd() | ConvertFrom-Json
 $bytes=[Convert]::FromBase64String($p.dados)
 $entropia=[Text.Encoding]::UTF8.GetBytes('OncoGlobal.Deepgram.v1|'+$p.contexto)
 if($p.operacao -eq 'Protect') { $saida=[Security.Cryptography.ProtectedData]::Protect($bytes,$entropia,[Security.Cryptography.DataProtectionScope]::CurrentUser) }
 elseif($p.operacao -eq 'Unprotect') { $saida=[Security.Cryptography.ProtectedData]::Unprotect($bytes,$entropia,[Security.Cryptography.DataProtectionScope]::CurrentUser) }
 else { throw 'OPERACAO_INVALIDA' }
 [Console]::Out.Write([Convert]::ToBase64String($saida))
 } catch { [Console]::Error.Write('COFRE_DPAPI_FALHOU'); exit 1 }
 finally { if($bytes){[Array]::Clear($bytes,0,$bytes.Length)}; if($saida){[Array]::Clear($saida,0,$saida.Length)} }`;
 try{
  const retorno=execFileSync(join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe'),
   ['-NoLogo','-NoProfile','-NonInteractive','-Command',script],{input:JSON.stringify({operacao,dados:dados.toString('base64'),contexto}),
    env:Object.fromEntries(['SystemRoot','WINDIR','USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP']
     .flatMap(nome=>process.env[nome]===undefined?[]:[[nome,process.env[nome]!]])),
    encoding:'utf8',windowsHide:true,timeout:10_000,maxBuffer:16_384,stdio:['pipe','pipe','pipe']});
  return Buffer.from(retorno.trim(),'base64');
 }catch{throw Error('COFRE_DPAPI_FALHOU');}
};

/** Arquivo contém somente envelope cifrado. Nome e entropia separam instalação e médico. Sem fallback em texto puro. */
export function criarCofreDeepgram(raiz:string,escopo:string,criptografia:Criptografia=dpapi):CofreDeepgram{
 if(!isAbsolute(raiz))throw Error('COFRE_CAMINHO_INVALIDO');
 const dir=resolve(raiz),id=(medico:string)=>createHash('sha256').update(JSON.stringify([escopo,medico])).digest('hex');
 function caminho(medico:string){if(existsSync(dir)&&lstatSync(dir).isSymbolicLink())throw Error('COFRE_LINK_RECUSADO');
  const arquivo=join(dir,`${id(medico)}.dpapi`);if(existsSync(arquivo)&&(!lstatSync(arquivo).isFile()||lstatSync(arquivo).isSymbolicLink()))throw Error('COFRE_ARQUIVO_INVALIDO');return arquivo;}
 return {
  ler(medico){const arquivo=caminho(medico);if(!existsSync(arquivo))return null;
   try{if(lstatSync(arquivo).size>8192)throw Error();const bruto=readFileSync(arquivo,'utf8');if(!bruto.startsWith(CABECALHO))throw Error();
    const bytes=criptografia('Unprotect',Buffer.from(bruto.slice(CABECALHO.length),'base64'),id(medico));
    try{const chave=bytes.toString('utf8');if(!valida(chave))throw Error();return chave;}finally{bytes.fill(0);}
   }catch{throw Error('COFRE_LEITURA_FALHOU');}
  },
  salvar(medico,chave){if(!valida(chave))throw Error('COFRE_CHAVE_INVALIDA');const arquivo=caminho(medico),claro=Buffer.from(chave,'utf8');
   let cifrado:Buffer;try{cifrado=criptografia('Protect',claro,id(medico));}finally{claro.fill(0);}
   if(!cifrado.length)throw Error('COFRE_CIFRAGEM_FALHOU');mkdirSync(dir,{recursive:true,mode:0o700});
   const temp=join(dir,`${id(medico)}.${randomUUID()}.tmp`);
   try{writeFileSync(temp,CABECALHO+cifrado.toString('base64'),{encoding:'utf8',mode:0o600,flag:'wx'});renameSync(temp,arquivo);}
   catch{throw Error('COFRE_GRAVACAO_FALHOU');}finally{if(existsSync(temp))unlinkSync(temp);}
  },
  remover(medico){const arquivo=caminho(medico);if(existsSync(arquivo))unlinkSync(arquivo);},
 };
}
export function cofreDeepgramWindows(escopo:string):CofreDeepgram|null{
 if(process.platform!=='win32'||!process.env.LOCALAPPDATA)return null;
 return criarCofreDeepgram(join(process.env.LOCALAPPDATA,'OncoGlobal','credenciais'),resolve(escopo).toLowerCase());
}
