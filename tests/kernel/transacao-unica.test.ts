import {expect,it} from "vitest";
import {DatabaseSync} from "node:sqlite";
import {mkdtempSync,rmSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {transacao} from "../../src/kernel/ledger/db.js";
it("obtem reserva de escrita antes da primeira leitura e permite aninhamento",()=>{
 const dir=mkdtempSync(join(tmpdir(),"transacao-sintetica-")),path=join(dir,"db.sqlite"),a=new DatabaseSync(path),b=new DatabaseSync(path);
 try{a.exec("PRAGMA journal_mode=WAL; CREATE TABLE prova(id INTEGER)");b.exec("PRAGMA busy_timeout=0");
 transacao(a,()=>{expect(a.prepare("SELECT COUNT(*) AS n FROM prova").get()?.n).toBe(0);expect(()=>b.exec("INSERT INTO prova VALUES(9)")).toThrow();
 transacao(a,()=>a.exec("INSERT INTO prova VALUES(1)"));});expect(b.prepare("SELECT COUNT(*) AS n FROM prova").get()?.n).toBe(1);
 }finally{b.close();a.close();rmSync(dir,{recursive:true,force:true});}
});
