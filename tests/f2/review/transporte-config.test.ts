import {expect,it,vi} from 'vitest';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ContaSaidaWhatsApp,criarTransporteWhatsApp,type EnvioCanal} from '../../../src/kernel/gateway/executores/canal.js';
import {carregarOperacaoCanal,ConfiguracaoCanalLocal} from '../../../src/server/canalOperacao.js';
const conta={accountId:'conta-sintetica',phoneNumberId:'00000000',apiVersion:'v99.0',accessToken:'token-exclusivamente-sintetico'};
const envio:EnvioCanal={canal:'WHATSAPP_SERVICO',accountId:conta.accountId,destinatario:'5500'+'000007777',texto:'Retorno na quinta-feira.',respostaId:'resposta-sintetica',versao:1};
it('configuração local é opt-in, valida contas e nunca define um destino arbitrário de rede',()=>{
 const dir=mkdtempSync(join(tmpdir(),'f2-config-sintetica-'));try{
  expect(carregarOperacaoCanal(dir)).toEqual({contasWebhook:[]});
  const c={contasWebhook:[{accountId:conta.accountId,keyId:'key-sintetica',canal:'WHATSAPP_SERVICO',segredo:'segredo-sintetico',verifyToken:'verify-sintetico'}],whatsappSaida:[conta]};
  writeFileSync(join(dir,'canal.local.json'),JSON.stringify(c));expect(carregarOperacaoCanal(dir).transporteSaida).toBeTypeOf('function');
  expect(ConfiguracaoCanalLocal.safeParse({...c,contasWebhook:[...c.contasWebhook,...c.contasWebhook]}).success).toBe(false);
  expect(ConfiguracaoCanalLocal.safeParse({...c,whatsappSaida:[{...conta,accountId:'sem-ingresso'}]}).success).toBe(false);
  expect(ContaSaidaWhatsApp.safeParse({...conta,phoneNumberId:'../../outro-host'}).success).toBe(false);
  writeFileSync(join(dir,'canal.local.json'),'{');expect(()=>carregarOperacaoCanal(dir)).toThrow('CONFIGURACAO_CANAL_INVALIDA');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
it('transporte usa apenas conta e endpoint configurados e só aceita recibo real do provedor',async()=>{
 const http=vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({messages:[{id:'recibo-sintetico-provedor'}]}),{status:200}));
 const executar=criarTransporteWhatsApp([conta],http);expect(await executar(envio)).toEqual({ok:true,providerReceiptId:'recibo-sintetico-provedor'});
 const [url,opcoes]=http.mock.calls[0]!;expect(url).toBe('https://graph.facebook.com/v99.0/00000000/messages');expect(opcoes?.redirect).toBe('error');expect(JSON.parse(String(opcoes?.body))).toMatchObject({messaging_product:'whatsapp',to:envio.destinatario,text:{body:envio.texto}});
 expect(await executar({...envio,accountId:'outra-conta'})).toMatchObject({ok:false,incerto:false});expect(await executar({...envio,canal:'EMAIL'})).toMatchObject({ok:false,incerto:false});expect(http).toHaveBeenCalledTimes(1);
});
it.each([200,408,500])('HTTP %s sem recibo válido conserva resultado incerto, sem sucesso fabricado',async status=>{
 const http=vi.fn<typeof fetch>().mockResolvedValue(new Response('{}',{status}));expect(await criarTransporteWhatsApp([conta],http)(envio)).toMatchObject({ok:false,incerto:true});
});
it('erro de conexão é incerto; recusa explícita do provedor não é mensagem enviada',async()=>{
 const http=vi.fn<typeof fetch>().mockRejectedValue(new Error('erro sintético'));expect(await criarTransporteWhatsApp([conta],http)(envio)).toMatchObject({ok:false,incerto:true});
 http.mockResolvedValue(new Response('{}',{status:400}));expect(await criarTransporteWhatsApp([conta],http)(envio)).toMatchObject({ok:false,incerto:false});
});
