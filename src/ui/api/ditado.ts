/** Transporte da UI restrito à rota fixa na mesma origem; recebe somente ticket descartável. */
export function abrirCanalDitado(ticket:string,eventos:{mensagem:(texto:string)=>void;erro:()=>void;fechado:()=>void}){
 if(!/^[a-f0-9]{64}$/.test(ticket))throw Error('DITADO_TICKET_INVALIDO');
 const socket=new WebSocket('/consulta/ditado/stream',ticket);
 socket.onmessage=e=>eventos.mensagem(String(e.data));socket.onerror=eventos.erro;socket.onclose=eventos.fechado;
 return {aberto:()=>socket.readyState===1,pendentes:()=>socket.bufferedAmount,enviar:(d:Blob|string)=>socket.send(d),fechar:()=>socket.close()};
}
export type CanalDitado=ReturnType<typeof abrirCanalDitado>;
