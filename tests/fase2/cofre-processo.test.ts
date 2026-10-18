import {afterEach,expect,it,vi} from 'vitest';
const processo=vi.hoisted(()=>({executar:vi.fn(()=>Buffer.from('resultado-cifrado-sintetico').toString('base64'))}));
vi.mock('node:child_process',()=>({execFileSync:processo.executar}));
import {dpapi} from '../../src/kernel/gateway/cofreDeepgram.js';
const plataforma=Object.getOwnPropertyDescriptor(process,'platform')!;
afterEach(()=>{Object.defineProperty(process,'platform',plataforma);vi.unstubAllEnvs();vi.restoreAllMocks();});
it('envia o segredo só por stdin e não herda credenciais no ambiente do processo nativo',()=>{
 Object.defineProperty(process,'platform',{...plataforma,value:'win32'});
 vi.stubEnv('SystemRoot','C:\\Windows');vi.stubEnv('DEEPGRAM_API_KEY','credencial-ambiente-sintetica');vi.stubEnv('OUTRO_SEGREDO','credencial-outra-sintetica');
 const chave='segredo-sintetico-para-protecao';dpapi('Protect',Buffer.from(chave),'perfil-sintetico');
 const chamada=processo.executar.mock.calls[0] as unknown as [string,string[],{env:Record<string,string>;input:string;windowsHide:boolean}];
 expect(chamada[2].windowsHide).toBe(true);
 // Asserções só em nomes/bools: uma regressão nunca imprime process.env nem valores reais no relatório.
 expect('DEEPGRAM_API_KEY' in chamada[2].env).toBe(false);expect('OUTRO_SEGREDO' in chamada[2].env).toBe(false);
 const permitidas=new Set(['SystemRoot','WINDIR','USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP']);
 expect(Object.keys(chamada[2].env).every(n=>permitidas.has(n))).toBe(true);
 expect(chamada[1].join(' ').includes(chave)).toBe(false);
 expect(JSON.parse(chamada[2].input).dados).toBe(Buffer.from(chave).toString('base64'));
});
