import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
try{
  execFileSync(process.execPath,[resolve(root,'node_modules/vite/bin/vite.js'),'build','--config','src/app/vite-estudio.config.ts'],{cwd:root,stdio:'pipe'});
  const {startCLI}=await import(pathToFileURL(resolve(root,'dist/w7-estudio/iniciar.mjs')).href);
  await startCLI([...process.argv.slice(2),'--repo',root]);
}catch(error){console.error(error instanceof Error?error.message:'Falha ao iniciar');process.exitCode=1;}
