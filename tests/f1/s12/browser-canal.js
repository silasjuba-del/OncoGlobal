import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';

export async function jornadaCanalNoNavegador(page,{baseUrl,manifesto,segredo,efeitos}){
 const sender='5500'+'000007777',raw=JSON.stringify({object:'whatsapp_business_account',entry:[{id:'waba-sintetica',changes:[{field:'messages',value:{messaging_product:'whatsapp',metadata:{phone_number_id:'00000000'},messages:[{from:sender,id:'mensagem-navegador-sintetica',timestamp:String(Date.parse(manifesto.agora)/1000),type:'text',text:{body:'Quando será meu retorno?'}}]}}]}]});
 const recebido=await page.request.post(`${baseUrl}/canal/webhook/sintetica`,{headers:{'Content-Type':'application/json','X-Hub-Signature-256':`sha256=${createHmac('sha256',segredo).update(raw).digest('hex')}`},data:raw});assert.equal(recebido.status(),200);
 await page.getByRole('button',{name:'Canal',exact:true}).click();
 const caixa=page.getByRole('region',{name:'Caixa do canal'});await caixa.waitFor();
 const form=caixa.getByRole('form',{name:'Resposta do canal'});await form.getByLabel('Encontro para a resposta').selectOption({label:manifesto.b2.encounterId});
 await form.getByLabel('Texto da resposta',{exact:true}).fill('Retorno na quinta-feira.');await form.getByRole('button',{name:'Revisar resposta',exact:true}).click();
 await form.getByRole('region',{name:'Resposta preparada para confirmação'}).waitFor();assert.equal(efeitos(),0);
 await form.getByLabel('Texto da resposta',{exact:true}).fill('Retorno na sexta-feira.');assert.equal(await form.getByRole('region',{name:'Resposta preparada para confirmação'}).count(),0);
 await form.getByRole('button',{name:'Revisar resposta',exact:true}).click();await form.getByRole('region',{name:'Resposta preparada para confirmação'}).waitFor();
 await form.getByLabel('Confirmo destinatário, conteúdo e contexto da resposta').check();
 const envio=page.waitForResponse(r=>r.url().endsWith('/acao'));
 await form.getByRole('button',{name:'Confirmar e enviar resposta',exact:true}).click();assert.equal((await envio).status(),200);
 await form.getByText('Resposta enviada; recibo registrado.').waitFor();assert.equal(efeitos(),1);
 const replay=page.waitForResponse(r=>r.url().endsWith('/acao'));
 await form.getByRole('button',{name:'Confirmar e enviar resposta',exact:true}).click();assert.equal((await replay).status(),200);assert.equal(efeitos(),1);
 return {webhookHmac:true,previaInvalidadaAposEdicao:true,confirmacaoExplicita:true,envioUnico:true};
}
