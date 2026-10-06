import { resolve } from 'node:path';
import { iniciarEstudio } from './servidor.js';

export async function startCLI(args=process.argv.slice(2)){
  const arg=(name:string)=>{const i=args.indexOf(name);return i>=0?args[i+1]:undefined;};
  const dataDir=arg('--data-dir');const senha=process.env.ONCOGLOBAL_SENHA;
  if(!dataDir||!senha||senha.length<12)throw Error('Informe --data-dir e ONCOGLOBAL_SENHA (mínimo 12 caracteres). A senha não é salva.');
  const root=resolve(arg('--repo')||process.cwd());const port=Number(arg('--port')||'4180');if(!Number.isInteger(port)||port<0||port>65535)throw Error('PORTA_INVALIDA');
  const running=await iniciarEstudio({dataDir:resolve(dataDir),corpusDir:resolve(root,'corpus'),senha,medicoId:process.env.ONCOGLOBAL_MEDICO_ID||'medico-local',crm:process.env.ONCOGLOBAL_CRM||'PERFIL_PENDENTE',port});
  console.log(running.url);
  for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>{void running.encerrar().then(()=>process.exit(0))});
  return running;
}
