import { it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
function scanner(arquivos: Record<string,string>, prefixo = 'f1-fronteiras-') {
  const dir=mkdtempSync(join(tmpdir(),prefixo));
  try {
    for(const [nome,conteudo] of Object.entries({
      'scripts/check-boundaries.mjs':readFileSync(new URL('../../../scripts/check-boundaries.mjs',import.meta.url),'utf8'),
      'scripts/fronteiras-excecoes-aprovadas.json':readFileSync(new URL('../../../scripts/fronteiras-excecoes-aprovadas.json',import.meta.url),'utf8'),
      ...arquivos,
    })) {const file=join(dir,nome);mkdirSync(join(file,'..'),{recursive:true});writeFileSync(file,conteudo);}
    const r=spawnSync(process.execPath,[join(dir,'scripts/check-boundaries.mjs'),'--fechar-fase=F1-S3'],{encoding:'utf8'});
    return {status:r.status,texto:r.stdout+r.stderr};
  } finally {rmSync(dir,{recursive:true,force:true});}
}
it('setores distintos não importam entre si, nem como type-only',()=>{
 const r=scanner({'src/modules/setores/renal/index.ts':"import type { X } from '../toxicidade/index.js';",'src/modules/setores/toxicidade/index.ts':'export type X = string;'});
 expect(r.status).toBe(1);expect(r.texto).toContain('satélite');
});
it('mesmo satélite pode organizar internamente e consumidor pode usar contrato',()=>{
 const r=scanner({'src/modules/setores/renal/index.ts':"import { X } from './calculo.js'; import type { C } from '../../../contracts/renal.js';",'src/modules/setores/renal/calculo.ts':'export const X = 1;','src/contracts/renal.ts':'export type C = string;'});
 expect(r.status).toBe(0);
});
it('composition root exata não autoriza aplicação arbitrária a importar kernel',()=>{
 const permitido="import { criarGateway } from '../kernel/gateway/gateway.js';";
 expect(scanner({'src/app/oncoassistLocal.ts':permitido}).status).toBe(0);
 expect(scanner({'src/app/ataque.ts':permitido}).status).toBe(1);
 expect(scanner({'src/app/oncoassistLocal.ts':"import { x } from '../kernel/ledger/ledger.js';"}).status).toBe(1);
});
it('entrypoint legado só pode reexportar porta pública declarada',()=>{
 expect(scanner({'src/app/oncoassist.ts':"export * from '../kernel/llm/jev/oncoassist.js';"}).status).toBe(0);
 expect(scanner({'src/app/oncoassist.ts':"export * from '../kernel/llm/jev/oncoassist.js'; export const x = 1;"}).status).toBe(1);
 expect(scanner({'src/app/oncoassist.ts':"export * from '../kernel/ledger/ledger.js';"}).status).toBe(1);
});

it.each(['fronteiras com espaço-', 'fronteiras-á-'])('detecta violação em %s', prefixo => {
 const r=scanner({'src/rules/errado.ts':"import { x } from '../server/x.js';"}, prefixo);
 expect(r.status).toBe(1); expect(r.texto).toContain('errado.ts');
});
it('raiz sem src não passa como zero arquivos',()=>expect(scanner({}).status).toBe(1));
it('src sem fontes não passa como zero arquivos',()=>expect(scanner({'src/README.md':'vazio'}).status).toBe(1));
