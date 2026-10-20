import {useState,type Dispatch,type SetStateAction} from "react";
/** A selecao pertence a uma visita/contexto; nenhuma limpeza assincrona pode apagar um clique novo. */
export function useCienciaAlertas(chave:string):readonly [readonly string[],Dispatch<SetStateAction<readonly string[]>>] {
 const [estado,setEstado]=useState<{chave:string;ids:readonly string[]}>({chave,ids:[]});
 if(estado.chave!==chave)setEstado({chave,ids:[]});
 const ids=estado.chave===chave?estado.ids:[];
 const atualizar:Dispatch<SetStateAction<readonly string[]>>=valor=>setEstado(anterior=>{
   const atuais=anterior.chave===chave?anterior.ids:[];
   return {chave,ids:typeof valor==="function"?valor(atuais):valor};
 });
 return [ids,atualizar];
}
