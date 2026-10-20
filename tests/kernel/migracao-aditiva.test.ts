import {expect,it,vi} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {garantirColunas} from '../../src/kernel/ledger/migracao.js';
import {garantirSchema} from '../../src/server/canalEntrada.js';
it('bancos novo e antigo convergem sem modificar linhas existentes',()=>{
 const velho=new DatabaseSync(':memory:'),novo=new DatabaseSync(':memory:');
 try{velho.exec('CREATE TABLE canal_resposta_envio(envioId TEXT PRIMARY KEY, recebidoEm TEXT); INSERT INTO canal_resposta_envio VALUES(\'sintetico\',\'2026-10-20\')');
 novo.exec('CREATE TABLE canal_resposta_envio(envioId TEXT PRIMARY KEY, recebidoEm TEXT, providerReceiptId TEXT)');
 garantirColunas(velho,[['canal_resposta_envio','providerReceiptId','TEXT']]);garantirColunas(velho,[['canal_resposta_envio','providerReceiptId','TEXT']]);
 expect(velho.prepare('PRAGMA table_info(canal_resposta_envio)').all()).toEqual(novo.prepare('PRAGMA table_info(canal_resposta_envio)').all());
 expect(velho.prepare('SELECT * FROM canal_resposta_envio').get()).toMatchObject({envioId:'sintetico',recebidoEm:'2026-10-20',providerReceiptId:null});
 }finally{velho.close();novo.close();}
});
it('rollback da primeira inicializacao nao deixa cache enganoso',()=>{
 const db=new DatabaseSync(':memory:');try{db.exec('BEGIN IMMEDIATE');garantirSchema(db);db.exec('ROLLBACK');
 expect(db.prepare("SELECT name FROM sqlite_master WHERE name='canal_mensagem'").get()).toBeUndefined();
 garantirSchema(db);expect(db.prepare("SELECT name FROM sqlite_master WHERE name='canal_mensagem'").get()).toBeTruthy();
 const spy=vi.spyOn(db,'exec');garantirSchema(db);expect(spy).not.toHaveBeenCalled();spy.mockRestore();
 }finally{db.close();}
});
