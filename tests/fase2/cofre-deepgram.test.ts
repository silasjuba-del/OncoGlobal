import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {mkdtempSync,readFileSync,readdirSync,rmSync,writeFileSync,realpathSync,symlinkSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {afterEach,expect,it} from 'vitest';
import {criarCofreDeepgram,dpapi} from '../../src/kernel/gateway/cofreDeepgram.js';
import {criarDitado} from '../../src/kernel/gateway/ditado.js';
import {criarGerenciadorSessao} from '../../src/server/sessao.js';
const dirs:string[]=[],servicos:ReturnType<typeof criarDitado>[]=[];
afterEach(()=>{for(const s of servicos.splice(0))s.fechar();for(const d of dirs.splice(0)){
 const p=realpathSync(d);if(dirname(p).toLowerCase()!==realpathSync(tmpdir()).toLowerCase())throw Error('TEMP_FORA_ESCOPO');rmSync(p,{recursive:true,force:true});}});
const temporario=()=>{const d=mkdtempSync(join(tmpdir(),'oncoglobal-cofre-'));dirs.push(d);return d;};
const segredo='synthetic-deepgram-fixture-not-a-real-key';
const material=randomBytes(32);
const cryptoTeste:Parameters<typeof criarCofreDeepgram>[2]=(op,dados,contexto)=>{
 if(op==='Protect'){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',material,iv);c.setAAD(Buffer.from(contexto));const bytes=Buffer.concat([c.update(dados),c.final()]);return Buffer.concat([iv,c.getAuthTag(),bytes]);}
 const c=createDecipheriv('aes-256-gcm',material,dados.subarray(0,12));c.setAAD(Buffer.from(contexto));c.setAuthTag(dados.subarray(12,28));return Buffer.concat([c.update(dados.subarray(28)),c.final()]);
};
it('grava somente envelope cifrado, recupera em nova instância e separa instalação/médico',()=>{
 const dir=temporario(),cofre=criarCofreDeepgram(dir,'app-a',cryptoTeste);cofre.salvar('medico-a',segredo);
 const arquivo=join(dir,readdirSync(dir)[0]!);expect(readFileSync(arquivo,'utf8')).not.toContain(segredo);
 expect(criarCofreDeepgram(dir,'app-a',cryptoTeste).ler('medico-a')).toBe(segredo);
 expect(cofre.ler('medico-b')).toBeNull();expect(criarCofreDeepgram(dir,'app-b',cryptoTeste).ler('medico-a')).toBeNull();
 cofre.remover('medico-a');expect(cofre.ler('medico-a')).toBeNull();expect(readdirSync(dir)).toEqual([]);
});
it('falha de proteção não grava texto puro nem apaga a credencial anterior',()=>{
 const dir=temporario(),cofre=criarCofreDeepgram(dir,'app',cryptoTeste);cofre.salvar('m',segredo);
 const antes=readFileSync(join(dir,readdirSync(dir)[0]!));
 expect(()=>criarCofreDeepgram(dir,'app',()=>{throw Error('falha sintética');}).salvar('m','outra-chave-sintetica-de-teste')).toThrow();
 expect(readFileSync(join(dir,readdirSync(dir)[0]!))).toEqual(antes);expect(cofre.ler('m')).toBe(segredo);
});
it('arquivo corrompido falha fechado e nome do médico não permite escapar da pasta',()=>{
 const dir=temporario(),cofre=criarCofreDeepgram(dir,'app',cryptoTeste);cofre.salvar('../../fora',segredo);
 expect(readdirSync(dir)).toHaveLength(1);const arquivo=join(dir,readdirSync(dir)[0]!);writeFileSync(arquivo,'texto adulterado');
 expect(()=>cofre.ler('../../fora')).toThrow('COFRE_LEITURA_FALHOU');
});
it('recusa pasta redirecionada por link',()=>{
 const d=temporario(),destino=join(d,'destino'),link=join(d,'link');mkdirSync(destino);symlinkSync(destino,link,'junction');
 expect(()=>criarCofreDeepgram(link,'app',cryptoTeste).salvar('m',segredo)).toThrow('COFRE_LINK_RECUSADO');
});
it.runIf(process.platform==='win32')('DPAPI real recupera a chave sintética em outra instância e recusa entropia divergente',()=>{
 const dir=temporario();criarCofreDeepgram(dir,'teste-dpapi').salvar('medico-sintetico',segredo);
 expect(criarCofreDeepgram(dir,'teste-dpapi').ler('medico-sintetico')).toBe(segredo);
 const bytes=dpapi('Protect',Buffer.from(segredo),'contexto-a');expect(()=>dpapi('Unprotect',bytes,'contexto-b')).toThrow('COFRE_DPAPI_FALHOU');
 expect(readFileSync(join(dir,readdirSync(dir)[0]!),'utf8')).not.toContain(segredo);
});
function abrir(cofre?:ReturnType<typeof criarCofreDeepgram>,chave?:string){const sessoes=criarGerenciadorSessao({medicoId:'medico-a',crm:'CRM-SINTETICO',senha:'senha-sintetica-comprida',agora:()=>new Date().toISOString(),duracaoMs:60_000});
 const token=sessoes.login('senha-sintetica-comprida')!.token,d=criarDitado(sessoes,{...(cofre?{cofre}:{}),...(chave?{chave}:{})});servicos.push(d);return{d,sessoes,token};}
it('configuração persistente sobrevive ao fechamento do serviço e login novo sem expor o valor',()=>{
 const dir=temporario(),a=abrir(criarCofreDeepgram(dir,'app',cryptoTeste));
 const r=a.d.rotear({acao:'CONFIGURAR',chave:segredo,persistir:true},a.token);expect(r.status).toBe(200);expect(r.body).toMatchObject({salva:true,configurada:true});
 expect(JSON.stringify(r)).not.toContain(segredo);a.d.fechar();
 const b=abrir(criarCofreDeepgram(dir,'app',cryptoTeste));expect(b.d.rotear({acao:'STATUS'},b.token).body).toMatchObject({configurada:true,salva:true});
 expect(b.d.rotear({acao:'ESQUECER_CHAVE_SALVA'},b.token).body).toMatchObject({configurada:false,salva:false});
});
it('salva chave já configurada na sessão sem reenviá-la e invalida cópias antigas após esquecer',()=>{
 const a=abrir(criarCofreDeepgram(temporario(),'app',cryptoTeste)),segundo=a.sessoes.login('senha-sintetica-comprida')!.token;
 a.d.rotear({acao:'CONFIGURAR',chave:segredo},a.token);a.d.rotear({acao:'CONFIGURAR',chave:segredo},segundo);
 expect(a.d.rotear({acao:'SALVAR_CHAVE_ATUAL'},a.token).body).toMatchObject({salva:true});
 expect(a.d.rotear({acao:'ESQUECER_CHAVE_SALVA'},a.token).status).toBe(200);
 expect(a.d.rotear({acao:'STATUS'},segundo).body).toMatchObject({configurada:false});
});
it('sem cofre ou sessão não persiste; falha do cofre não anuncia chave salva',()=>{
 const a=abrir();expect(a.d.rotear({acao:'CONFIGURAR',chave:segredo,persistir:true},a.token).status).toBe(503);
 expect(a.d.rotear({acao:'STATUS'},a.token).body).toMatchObject({configurada:false,persistenciaDisponivel:false});
 const c=criarCofreDeepgram(temporario(),'app',()=>{throw Error('ERRO_COM_SEGREDO_NAO_EXIBIR');}),b=abrir(c);
 expect(b.d.rotear({acao:'CONFIGURAR',chave:segredo,persistir:true},'invalido').status).toBe(401);
 const r=b.d.rotear({acao:'CONFIGURAR',chave:segredo,persistir:true},b.token);expect(r.status).toBe(503);expect(JSON.stringify(r)).not.toContain('ERRO_COM_SEGREDO');
});
it('distingue chave temporária da salva e permite recuperar de arquivo corrompido',()=>{
 const dir=temporario(),cofre=criarCofreDeepgram(dir,'app',cryptoTeste),a=abrir(cofre);
 a.d.rotear({acao:'CONFIGURAR',chave:segredo,persistir:true},a.token);
 const outra='outra-chave-sintetica-nao-real-987';
 expect(a.d.rotear({acao:'CONFIGURAR',chave:outra},a.token).body).toMatchObject({origem:'SESSAO',salva:true});
 expect(cofre.ler('medico-a')).toBe(segredo);
 expect(a.d.rotear({acao:'REMOVER_CHAVE'},a.token).body).toMatchObject({origem:'COFRE',salva:true});
 writeFileSync(join(dir,readdirSync(dir)[0]!),'corrompido');
 expect(a.d.rotear({acao:'STATUS'},a.token).body).toMatchObject({configurada:false,persistenciaDisponivel:true,cofreIndisponivel:true});
 expect(a.d.rotear({acao:'CONFIGURAR',chave:outra,persistir:true},a.token).body).toMatchObject({origem:'COFRE',salva:true});
});
it.each(['AMBIENTE','SESSAO'])('cofre ilegível não bloqueia a chave independente de %s',origem=>{
 const dir=temporario(),cofre=criarCofreDeepgram(dir,'app',cryptoTeste);cofre.salvar('medico-a',segredo);
 writeFileSync(join(dir,readdirSync(dir)[0]!),'corrompido');const a=abrir(cofre,origem==='AMBIENTE'?segredo:undefined);
 if(origem==='SESSAO')expect(a.d.rotear({acao:'CONFIGURAR',chave:segredo},a.token).status).toBe(200);
 const r=a.d.rotear({acao:'STATUS'},a.token);expect(r.body).toMatchObject({configurada:true,salva:false,origem,cofreIndisponivel:true});
 const contexto={patientId:'sintetico',encounterId:'encontro',tumorLotId:null};a.sessoes.selecionarConsulta(a.token,contexto);
 expect(a.d.rotear({acao:'INICIAR',contexto,autorizaEnvioAudio:true},a.token).body).toMatchObject({codigo:'DITADO_TICKET'});
 expect(a.d.rotear({acao:'SALVAR_CHAVE_ATUAL'},a.token).body).toMatchObject({salva:true,origem:'COFRE',cofreIndisponivel:false});
 expect(cofre.ler('medico-a')).toBe(segredo);
});
