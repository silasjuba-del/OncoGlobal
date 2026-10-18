import {it,expect} from 'vitest';
import {mkdtempSync,mkdirSync,copyFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
it('gerador histórico recusa execução antes de escrever packs já enriquecidos',()=>{
 const root=mkdtempSync(join(tmpdir(),'packs-congelados-'));
 mkdirSync(join(root,'scripts'));
 const script=join(root,'scripts/gerar-packs-b2.mjs');copyFileSync('scripts/gerar-packs-b2.mjs',script);
 const r=spawnSync(process.execPath,[script],{encoding:'utf8'});
 expect(r.status).not.toBe(0);expect(r.stderr).toContain('GERADOR_HISTORICO_CONGELADO');
 expect(existsSync(join(root,'corpus'))).toBe(false);
});
