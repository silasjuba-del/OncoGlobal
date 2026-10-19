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
 await form.getByRole('button',{name:'Confirmar e enviar resposta',exact:true}).click();const enviado=await envio;assert.equal(enviado.status(),200);
 await caixa.getByText('Resposta médica enviada; resolução clínica não registrada automaticamente.').waitFor();assert.equal(efeitos(),1);
 assert.equal(await form.count(),0);await caixa.getByRole('button',{name:'Preparar nova resposta médica',exact:true}).waitFor();
 // Replay de transporte do mesmo pedido não é uma nova resposta clínica.
 // A caixa reconstruída não oferece novamente o formulário já enviado.
 const pedido=enviado.request();
 const replay=await page.request.post(pedido.url(),{headers:await pedido.allHeaders(),data:pedido.postData()});
 assert.equal(replay.status(),200);assert.equal((await replay.json()).decisao,'REPLAY');assert.equal(efeitos(),1);
 return {webhookHmac:true,previaInvalidadaAposEdicao:true,confirmacaoExplicita:true,envioUnico:true,estadoRespondidaReaberto:true,novaRespostaExigeAcaoExplicita:true};
}

export async function jornadaDemonstracaoCanal(page){
 await page.goto(new URL('/',page.url()).href);
 await page.getByRole('button',{name:'Canal',exact:true}).click();
 const mensagem=page.locator('[data-mensagem="msg-red"]');
 const seletor=mensagem.getByLabel('Encontro para a resposta',{exact:true});
 await seletor.selectOption({label:'en-verde'});
 await mensagem.getByLabel('Texto da resposta',{exact:true}).fill('Retorno sintético escrito pelo médico.');
 await mensagem.getByRole('button',{name:'Revisar resposta',exact:true}).click();
 await mensagem.getByRole('region',{name:'Resposta preparada para confirmação'}).waitFor();
 await mensagem.getByLabel('Confirmo destinatário, conteúdo e contexto da resposta',{exact:true}).check();
 await mensagem.getByRole('button',{name:'Confirmar e enviar resposta',exact:true}).click();
 await mensagem.getByText('Resposta enviada; recibo registrado.').waitFor();
 return {demonstracaoSinteticaComWebCrypto:true};
}
