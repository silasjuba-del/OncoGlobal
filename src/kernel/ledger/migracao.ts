import type {DatabaseSync} from 'node:sqlite';
import {transacao} from './db.js';
/** Somente colunas aditivas nullable; nunca reescreve valores, tipos ou hashes existentes. */
export function garantirColunas(db:DatabaseSync,colunas:readonly (readonly [string,string,'TEXT'|'INTEGER'|'REAL'|'BLOB'])[]):void {
 for(const [tabela,nome,tipo] of colunas)if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tabela)||!/^[A-Za-z_][A-Za-z0-9_]*$/.test(nome)||!['TEXT','INTEGER','REAL','BLOB'].includes(tipo))throw Error('MIGRACAO_COLUNA_INVALIDA');
 transacao(db,()=>{for(const [tabela,nome,tipo] of colunas){const existentes=db.prepare(`PRAGMA table_info(${tabela})`).all();
   if(!existentes.length)throw Error('MIGRACAO_TABELA_AUSENTE');
   if(!existentes.some(c=>c.name===nome))db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${nome} ${tipo}`);
 }});
}
