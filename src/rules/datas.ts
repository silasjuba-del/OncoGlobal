// Datas civis estritas, sem normalizacao de dia/mes impossivel e sem relogio de parede.
export function parseData(iso:string):{y:number;m:number;d:number}|null {
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);if(!match)return null;
  const y=Number(match[1]),m=Number(match[2]),d=Number(match[3]);
  const date=new Date(0);date.setUTCFullYear(y,m-1,d);date.setUTCHours(0,0,0,0);
  return date.getUTCFullYear()===y && date.getUTCMonth()===m-1 && date.getUTCDate()===d ? {y,m,d} : null;
}
export function utcCivil(iso:string):number|null {
  const p=parseData(iso);if(!p)return null;const date=new Date(0);date.setUTCFullYear(p.y,p.m-1,p.d);date.setUTCHours(0,0,0,0);return date.getTime();
}
/** ate - de; null exige PENDENTE no consumidor clinico. */
export function diferencaDiasCivis(de:string,ate:string):number|null {
 const a=utcCivil(de),b=utcCivil(ate);return a===null||b===null?null:Math.trunc((b-a)/86400000);
}
