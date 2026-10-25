import { it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
function avaliar(codigo: string, arquivo = 'src/modules/renal/index.ts', alterarScanner = (s: string) => s, alterarManifesto = (s: string) => s) {
 const dir=mkdtempSync(join(tmpdir(),'f1-network-boundary-'));
 try {
  const arquivos={
   'scripts/check-boundaries.mjs':alterarScanner(readFileSync(new URL('../../../scripts/check-boundaries.mjs',import.meta.url),'utf8')),
   'scripts/fronteiras-excecoes-aprovadas.json':alterarManifesto(readFileSync(new URL('../../../scripts/fronteiras-excecoes-aprovadas.json',import.meta.url),'utf8')),
   [arquivo]:codigo,
  };
  for(const [nome,texto] of Object.entries(arquivos)){const alvo=join(dir,nome);mkdirSync(join(alvo,'..'),{recursive:true});writeFileSync(alvo,texto);}
  const r=spawnSync(process.execPath,[join(dir,'scripts/check-boundaries.mjs'),'--fechar-fase=F1-S3'],{encoding:'utf8'});
  return {status:r.status,texto:r.stdout+r.stderr};
 } finally {rmSync(dir,{recursive:true,force:true});}
}
it.each([
 "import http from 'node:http';",
 "import { request } from 'node:http';",
 "import https from 'node:https';",
 "import { request } from 'node:https';",
 "import 'node:https';",
 "import { request } from 'https';",
])('satélite rejeita import de rede sem executar rede: %s',codigo=>{
 const r=avaliar(codigo);expect(r.status).toBe(1);expect(r.texto).toContain('INV-05');
});
it.each(["import { request as r } from 'node:http';", "import { get } from 'node:http';"])('servidor de entrada rejeita cliente HTTP named: %s',codigo=>{
 const r=avaliar(codigo,'src/server/ataque.ts');expect(r.status).toBe(1);expect(r.texto).toContain('rede de saída');
});
it('servidor pode importar createServer e scanner não contém U+0008',()=>{
 expect(avaliar("import { createServer } from 'node:http';",'src/server/entrada.ts').status).toBe(0);
 expect(readFileSync(new URL('../../../scripts/check-boundaries.mjs',import.meta.url),'utf8')).not.toContain(String.fromCharCode(8));
});
it.each(["import { confirmar } from '../kernel/ledger/writeRouter.js';",
 "import { confirmar as escrever } from '../kernel/ledger/writeRouter.js';",
 "export { confirmar } from '../kernel/ledger/writeRouter.js';"])("servidor não contorna a porta comum de confirmação: %s",codigo=>{
 const r=avaliar(codigo,'src/server/escrita.ts');expect(r.status).toBe(1);expect(r.texto).toContain('porta comum de confirmação');
});
it('servidor usa a porta comum de confirmação sem exceção de fronteira',()=>{
 expect(avaliar("import { executarConfirmacao } from '../kernel/comandos/index.js';",'src/server/escrita.ts').status).toBe(0);
});
it('manifesto simultaneamente ampliado não permite reintroduzir exceção sem violação de import',()=>{
 const ex={arquivo:'src/modules/renal/index.ts',import:'src/contracts/base.js',expira:'F1-S3',motivo:'ataque'};
 const r=avaliar("export const x=1;",'src/modules/renal/index.ts',s=>s.replace('const EXCECOES = [];',`const EXCECOES = ${JSON.stringify([ex])};`),s=>{const m=JSON.parse(s);m.pares.push(ex);return JSON.stringify(m);});
 expect(r.status).toBe(1);expect(r.texto).toContain('exige 0 exceções');
});
it('ditado admite somente a rota literal local na porta específica da UI',()=>{
 const local="new WebSocket('/consulta/ditado/stream',ticket)";
 expect(avaliar(local,'src/ui/api/ditado.ts').status).toBe(0);
 expect(avaliar(local,'src/ui/consulta/ataque.tsx').status).toBe(1);
 expect(avaliar("new WebSocket(url,ticket)",'src/ui/api/ditado.ts').status).toBe(1);
 expect(avaliar("new WebSocket('wss://externo.invalid',ticket)",'src/ui/api/ditado.ts').status).toBe(1);
 expect(avaliar(`${local}; new WebSocket(outro);`,'src/ui/api/ditado.ts').status).toBe(1);
});
