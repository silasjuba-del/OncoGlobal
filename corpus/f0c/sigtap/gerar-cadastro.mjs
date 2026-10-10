import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseSigtapOficial } from '../../../scripts/sigtap-import.mjs';
import { lerArquivosSigtapZip } from '../../../scripts/sigtap-zip.mjs';
const root = new URL('./',import.meta.url);
const HASH_ZIP='e2f1a210d8de4148f946e74f18b7726d4bc8145c97f48c2338874851789a03df';
const HASH_CONTEUDO='8ef522e129455c030300c83fab5dc3f0e930f847e823eebe72c4760bf8143aa1';
const bytes = readFileSync(new URL('fontes/TabelaUnificada_202609_v2610050950.zip',root));
const arquivos = lerArquivosSigtapZip(bytes,HASH_ZIP);
const resultado = parseSigtapOficial(arquivos,'2026-09');
if (!process.argv[2]) throw new Error('Informe o caminho do M-AN para confronto documental.');
const doc = readFileSync(process.argv[2],'utf8');
let comparados=0;
for(const linha of doc.split(/\r?\n/).filter(l=>l.startsWith('| **'))){
 const col=linha.split('|'); const codigo=col[3].replace(/\D/g,'');
 const p=resultado.procedimentos.find(p=>p.codigo===codigo);
 const valor=Number(col[5].replace('R$','').replaceAll('.','').replace(',','.').trim());
 if(!p || p.nome!==col[4].trim() || p.valorSaCentavos!==Math.round(valor*100))throw new Error('CONFRONTO_DIVERGENTE:'+codigo);
 p.observacoesFonte=col[6].trim();comparados++;
}
if(resultado.procedimentos.length!==154 || comparados!==149)throw new Error('CONTAGEM_DIVERGENTE_DA_RELEASE');
if(createHash('sha256').update(JSON.stringify(resultado)).digest('hex')!==HASH_CONTEUDO)throw new Error('HASH_CONTEUDO_DIVERGENTE_DA_RELEASE');
const meta={versao:'2026-09.v2610050950.f0c-1',estado:'FONTE_OFICIAL_CONFERIDA',
 fonte:{url:'ftp://ftp2.datasus.gov.br/pub/sistemas/tup/downloads/TabelaUnificada_202609_v2610050950.zip',arquivo:'TabelaUnificada_202609_v2610050950.zip',sha256:createHash('sha256').update(bytes).digest('hex'),encoding:'windows-1252'},
 hashConteudo:createHash('sha256').update(JSON.stringify(resultado)).digest('hex'),
 decisao:{tipo:'INTEGRACAO_CADASTRO_OFICIAL',referencia:'docs/planejamento/F0-FECHAMENTO-PACOTE-AUDITORIA.md, §3B C13; execução autorizada pelo Dr. Silas: PODE SEGUIR ATÉ FECHAMENTO DA F0 (2026-10-10). Cadastro administrativo; não constitui curadoria clínica.'},
 validacao:{competencia:'2026-09',quantidade:resultado.procedimentos.length,confronto:`${comparados}/149 linhas M-AN conferidas: código, descrição literal e valor SA idênticos. 5 adicionais das formas03.04.02–08 preservam registro oficial.`,
 pendencias:['Idades: valores originais preservados; unidade do arquivo não confirmada em documentação primária; limites em meses permanecem null.','Finalidade clínica não derivada automaticamente do código.','CIDs carregados exclusivamente com ST_PRINCIPAL=S; tabelas de regras condicionadas e habilitações não integram este cadastro.']}};
writeFileSync(new URL('2026-09.json',root),JSON.stringify({...resultado,meta},null,2)+'\n');
console.log(JSON.stringify({quantidade:resultado.procedimentos.length,comparados,fonteHash:meta.fonte.sha256,conteudoHash:meta.hashConteudo}));
