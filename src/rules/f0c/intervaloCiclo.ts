/** Intervalo nominal entre inícios de ciclos; não determina adiamento nem ajuste. */
export interface EntradaIntervaloCiclo { inicioAnterior:string|null; dataProxima:string|null; intervaloDias:number|null }
export interface ResultadoIntervaloCiclo {
 estado:"AVISO"|"PENDENTE"|"SEM_AVISO"; diasObservados:number|null; antesDoPrevisto:boolean|null; atrasoDias:number|null;
 motivo:string|null; consultaSegue:true; condutaAutomatica:false;
}
function civil(s:string|null):number|null {
 if(!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
 const n=Date.parse(`${s}T00:00:00Z`);
 return Number.isFinite(n) && new Date(n).toISOString().slice(0,10)===s ? n : null;
}
export function avaliarIntervaloCiclo(i:EntradaIntervaloCiclo):ResultadoIntervaloCiclo {
 const base={diasObservados:null,antesDoPrevisto:null,atrasoDias:null,consultaSegue:true as const,condutaAutomatica:false as const};
 const anterior=civil(i.inicioAnterior),proxima=civil(i.dataProxima);
 if(anterior===null || proxima===null || i.intervaloDias===null || !Number.isSafeInteger(i.intervaloDias) || i.intervaloDias<=0)
  return {...base,estado:"PENDENTE",motivo:"ANCORA_DATA_OU_INTERVALO_AUSENTE_INVALIDO"};
 if(proxima<anterior) return {...base,estado:"PENDENTE",motivo:"PROXIMO_CICLO_ANTES_DO_INICIO_ANTERIOR"};
 const diasObservados=(proxima-anterior)/86400000, diferenca=diasObservados-i.intervaloDias;
 return {estado:diferenca===0?"SEM_AVISO":"AVISO",diasObservados,antesDoPrevisto:diferenca<0,atrasoDias:Math.max(0,diferenca),
  motivo:diferenca===0?null:diferenca<0?"ANTECIPACAO_DO_INTERVALO_NOMINAL":"ATRASO_DO_INTERVALO_NOMINAL",consultaSegue:true,condutaAutomatica:false};
}
