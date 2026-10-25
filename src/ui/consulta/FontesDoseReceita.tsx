import type {PropostaDoseReceita} from '../../contracts/api/propostaDoseReceita.js';
export function FontesDoseReceita({propostas}:{propostas:readonly PropostaDoseReceita[]}){
 if(!propostas.length)return null;
 return <details><summary>{propostas.some(p=>p.fonte.curadoria==='RASCUNHO')?'CHECAR DOSE · ':''}Conferir fontes das doses propostas</summary>{propostas.map(p=><section key={p.id}>
  <p>{p.medicamento}: proposta documental {p.dose} · {p.via}. Indicação da fonte: {p.indicacao}.</p>
  <p>{p.fonte.referencia} · versão {p.fonte.versao} · curadoria {p.fonte.curadoria}.</p>
  <blockquote>{p.fonte.trecho}</blockquote><ul>{p.restricoes.map((r,i)=><li key={i}>{r}</li>)}</ul>
  <p>Confira a dose final no documento acima. A assinatura registra sua validação dos valores exibidos.</p>
 </section>)}</details>;
}
