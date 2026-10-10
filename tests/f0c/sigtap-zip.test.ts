import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect,it } from 'vitest';
import { lerArquivosSigtapZip,ARQUIVOS_SIGTAP_NECESSARIOS } from '../../scripts/sigtap-zip.mjs';
const original=readFileSync(new URL('../../corpus/f0c/sigtap/fontes/TabelaUnificada_202609_v2610050950.zip',import.meta.url));
const pin='e2f1a210d8de4148f946e74f18b7726d4bc8145c97f48c2338874851789a03df';
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
function central(b:Buffer){
 const end=b.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));let p=b.readUInt32LE(end+16);
 const count=b.readUInt16LE(end+10);for(let i=0;i<count;i++){
  const n=b.readUInt16LE(p+28),size=46+n+b.readUInt16LE(p+30)+b.readUInt16LE(p+32);
  if(b.subarray(p+46,p+46+n).toString('utf8')==='tb_procedimento.txt')return {p,size,end};p+=size;
 }throw Error('fixture sem procedimento');
}
it('descompacta somente oito entradas necessárias com descrição Windows1252 fiel',()=>{
 const r=lerArquivosSigtapZip(original,pin);expect(Object.keys(r).sort()).toEqual([...ARQUIVOS_SIGTAP_NECESSARIOS].sort());
 expect(r['tb_procedimento.txt']).toContain('MAMAHER-2');expect(r['tb_procedimento.txt']).toContain('POSITIVO – 1ª LINHA');
 expect(r['tb_procedimento.txt']).not.toContain('\u0096');expect(Object.keys(r)).not.toContain('tb_descricao.txt');
});
it('fonte adulterada não passa pelo hash pinado',()=>{
 const b=Buffer.from(original);b[100]=b[100]!^1;expect(()=>lerArquivosSigtapZip(b,pin)).toThrow('SIGTAP_ZIP_HASH_DIVERGENTE');
});
it.each(['crc','size','offset','method','encryption'] as const)('mesmo com hash do fixture recalculado, rejeita corrupção %s',(kind)=>{
 const b=Buffer.from(original),{p}=central(b);
 if(kind==='crc')b.writeUInt32LE((b.readUInt32LE(p+16)^1)>>>0,p+16);
 if(kind==='size')b.writeUInt32LE(8*1024*1024+1,p+24);
 if(kind==='offset')b.writeUInt32LE(b.length+100,p+42);
 if(kind==='method')b.writeUInt16LE(99,p+10);
 if(kind==='encryption')b.writeUInt16LE(b.readUInt16LE(p+8)|1,p+8);
 expect(()=>lerArquivosSigtapZip(b,hash(b))).toThrow(/SIGTAP_ZIP_/);
});
it('entrada duplicada no diretório central é recusada, sem eleger primeira/última',()=>{
 const {p,size,end}=central(original),eocd=Buffer.from(original.subarray(end));
 eocd.writeUInt16LE(eocd.readUInt16LE(8)+1,8);eocd.writeUInt16LE(eocd.readUInt16LE(10)+1,10);
 eocd.writeUInt32LE(eocd.readUInt32LE(12)+size,12);
 const b=Buffer.concat([original.subarray(0,end),original.subarray(p,p+size),eocd]);
 expect(()=>lerArquivosSigtapZip(b,hash(b))).toThrow('SIGTAP_ZIP_ENTRADA_DUPLICADA');
});
it('nome de caminho não substitui entrada obrigatória e nenhuma extração em disco é feita',()=>{
 const b=Buffer.from(original),{p}=central(b);b.write('../',p+46,'ascii');
 expect(()=>lerArquivosSigtapZip(b,hash(b))).toThrow('SIGTAP_ZIP_ARQUIVO_OBRIGATORIO_AUSENTE');
});
it('ZIP truncado não tem diretório válido',()=>{
 const b=original.subarray(0,original.length-10);expect(()=>lerArquivosSigtapZip(b,hash(b))).toThrow('SIGTAP_ZIP_DIRETORIO_AUSENTE');
});
