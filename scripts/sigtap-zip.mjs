import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';

export const ARQUIVOS_SIGTAP_NECESSARIOS=Object.freeze(['tb_procedimento','rl_procedimento_cid','rl_procedimento_registro','tb_financiamento']
  .flatMap(nome=>[`${nome}.txt`,`${nome}_layout.txt`]));
const MAX_ZIP=16*1024*1024,MAX_ENTRADA=8*1024*1024,MAX_TOTAL=16*1024*1024;
const tabelaCrc=Array.from({length:256},(_,i)=>{let c=i;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=tabelaCrc[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
/** ZIP32 somente em memória. Não interpreta caminhos nem escreve entradas no filesystem. */
export function lerArquivosSigtapZip(input,sha256Esperado){
  if(!(input instanceof Uint8Array)||input.byteLength<22||input.byteLength>MAX_ZIP)throw new Error('SIGTAP_ZIP_TAMANHO_INVALIDO');
  const zip=Buffer.from(input);
  if(zip.length<22||zip.length>MAX_ZIP)throw new Error('SIGTAP_ZIP_TAMANHO_INVALIDO');
  if(!/^[a-f0-9]{64}$/.test(sha256Esperado)||createHash('sha256').update(zip).digest('hex')!==sha256Esperado)
    throw new Error('SIGTAP_ZIP_HASH_DIVERGENTE');
  let eocd=-1;
  for(let p=zip.length-22;p>=Math.max(0,zip.length-65557);p--){
    if(zip.readUInt32LE(p)===0x06054b50&&p+22+zip.readUInt16LE(p+20)===zip.length){eocd=p;break;}
  }
  if(eocd<0)throw new Error('SIGTAP_ZIP_DIRETORIO_AUSENTE');
  const total=zip.readUInt16LE(eocd+10),tamanhoCentral=zip.readUInt32LE(eocd+12),inicioCentral=zip.readUInt32LE(eocd+16);
  if(zip.readUInt16LE(eocd+4)!==0||zip.readUInt16LE(eocd+6)!==0||zip.readUInt16LE(eocd+8)!==total
    ||total===0xffff||total>2000||tamanhoCentral===0xffffffff||inicioCentral===0xffffffff
    ||inicioCentral+tamanhoCentral!==eocd)throw new Error('SIGTAP_ZIP_DIRETORIO_INVALIDO');
  const wanted=new Set(ARQUIVOS_SIGTAP_NECESSARIOS),arquivos=Object.create(null),vistos=new Set();
  let p=inicioCentral,totalDescompactado=0;
  for(let n=0;n<total;n++){
    if(p+46>eocd||zip.readUInt32LE(p)!==0x02014b50)throw new Error('SIGTAP_ZIP_CENTRAL_INVALIDO');
    const flags=zip.readUInt16LE(p+8),metodo=zip.readUInt16LE(p+10),crc=zip.readUInt32LE(p+16),
      compactado=zip.readUInt32LE(p+20),original=zip.readUInt32LE(p+24),nomeLen=zip.readUInt16LE(p+28),
      extraLen=zip.readUInt16LE(p+30),comentarioLen=zip.readUInt16LE(p+32),disco=zip.readUInt16LE(p+34),local=zip.readUInt32LE(p+42);
    const fim=p+46+nomeLen+extraLen+comentarioLen;
    if(fim>eocd)throw new Error('SIGTAP_ZIP_CENTRAL_TRUNCADO');
    const nome=zip.subarray(p+46,p+46+nomeLen).toString('utf8');p=fim;
    if(!wanted.has(nome))continue;
    if(vistos.has(nome))throw new Error('SIGTAP_ZIP_ENTRADA_DUPLICADA');vistos.add(nome);
    if(disco!==0||(flags&1)!==0||![0,8].includes(metodo)||original>MAX_ENTRADA||compactado>MAX_ZIP
      ||local+30>inicioCentral||zip.readUInt32LE(local)!==0x04034b50)throw new Error('SIGTAP_ZIP_ENTRADA_INVALIDA');
    const localNomeLen=zip.readUInt16LE(local+26),localExtraLen=zip.readUInt16LE(local+28),inicio=local+30+localNomeLen+localExtraLen;
    if(zip.readUInt16LE(local+6)!==flags||zip.readUInt16LE(local+8)!==metodo
      ||zip.subarray(local+30,local+30+localNomeLen).toString('utf8')!==nome
      ||inicio+compactado>inicioCentral)throw new Error('SIGTAP_ZIP_CABECALHO_DIVERGENTE');
    if(totalDescompactado+original>MAX_TOTAL)throw new Error('SIGTAP_ZIP_LIMITE_TOTAL');
    const packed=zip.subarray(inicio,inicio+compactado);
    const bytes=metodo===0?packed:inflateRawSync(packed,{maxOutputLength:MAX_ENTRADA});
    if(bytes.length!==original||crc32(bytes)!==crc)throw new Error('SIGTAP_ZIP_INTEGRIDADE_ENTRADA');
    totalDescompactado+=bytes.length;
    arquivos[nome]=new TextDecoder('windows-1252',{fatal:true}).decode(bytes);
  }
  if(p!==eocd||ARQUIVOS_SIGTAP_NECESSARIOS.some(nome=>!Object.hasOwn(arquivos,nome)))throw new Error('SIGTAP_ZIP_ARQUIVO_OBRIGATORIO_AUSENTE');
  return arquivos;
}
