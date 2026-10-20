import {z} from 'zod';

export const ContaSaidaWhatsApp=z.object({accountId:z.string().min(1),phoneNumberId:z.string().regex(/^\d+$/),
  apiVersion:z.string().regex(/^v\d+\.\d+$/),accessToken:z.string().min(1).max(4096)}).strict();
export type EnvioCanal={canal:'WHATSAPP_SERVICO'|'EMAIL';accountId:string;destinatario:string;texto:string;respostaId:string;versao:number};
export type ResultadoTransporteCanal={ok:true;providerReceiptId:string}|{ok:false;incerto:boolean;erro:string};
export type TransporteCanal=(envio:EnvioCanal)=>Promise<ResultadoTransporteCanal>;

/** Rede somente nesta porta do gateway. URL do provedor fixa; credenciais nunca saem para a UI. */
export function criarTransporteWhatsApp(contas:readonly z.infer<typeof ContaSaidaWhatsApp>[],cliente:typeof fetch=fetch):TransporteCanal {
  return async envio=>{
    const candidatas=contas.filter(c=>c.accountId===envio.accountId);
    if(envio.canal!=='WHATSAPP_SERVICO'||candidatas.length!==1||!/^\+?\d{8,15}$/.test(envio.destinatario))
      return {ok:false,incerto:false,erro:'TRANSPORTE_CANAL_NAO_CONFIGURADO'};
    const c=candidatas[0]!;
    try{
      const resposta=await cliente(`https://graph.facebook.com/${c.apiVersion}/${c.phoneNumberId}/messages`,{
        method:'POST',redirect:'error',signal:AbortSignal.timeout(15_000),headers:{Authorization:`Bearer ${c.accessToken}`,'Content-Type':'application/json'},
        body:JSON.stringify({messaging_product:'whatsapp',recipient_type:'individual',to:envio.destinatario.replace(/^\+/,''),type:'text',text:{preview_url:false,body:envio.texto}})});
      if(!resposta.ok)return {ok:false,incerto:resposta.status>=500||resposta.status===408,erro:'PROVEDOR_RECUSOU_ENVIO'};
      const p=z.object({messages:z.array(z.object({id:z.string().min(1)})).length(1)}).safeParse(await resposta.json());
      return p.success?{ok:true,providerReceiptId:p.data.messages[0]!.id}:{ok:false,incerto:true,erro:'RECIBO_PROVEDOR_INVALIDO'};
    }catch{return {ok:false,incerto:true,erro:'RESULTADO_TRANSPORTE_INCERTO'};}
  };
}
