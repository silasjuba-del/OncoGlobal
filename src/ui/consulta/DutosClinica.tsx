import { DutosClinicaVisao } from '../../contracts/api/dutos.js';
export function DutosClinica({dados}:{dados?:DutosClinicaVisao}) {
 const p=DutosClinicaVisao.safeParse(dados);
 if(!p.success)return <section aria-label="Setores da clínica"><h3>Setores da clínica</h3><p>Dados setoriais pendentes.</p></section>;
 const d=p.data;
 return <section aria-label="Setores da clínica" style={{fontSize:'1.125rem',lineHeight:1.6,color:'#111',background:'#fff',border:'2px solid #444',padding:'1rem',borderRadius:8}}>
  <h3>Farmácia</h3>{!d.farmacia.length?<p>Prescrição ainda não enviada à farmácia.</p>:<ul>{d.farmacia.map(f=><li key={f.eventId}><strong>{f.referenciaValida?f.registro.estado:'PENDENTE'}</strong> · {f.registro.prescricao.documentId}, versão {f.registro.prescricao.documentVersion}. {f.referenciaValida?f.registro.motivo:`Registro anterior: ${f.registro.estado}. ${f.motivo}`}<small> · evento {f.eventId}</small></li>)}</ul>}
  <h3>Recepção e agenda</h3>{!d.tarefas.length?<p>Nenhuma tarefa confirmada disponível.</p>:<ul>{d.tarefas.map(t=><li key={t.eventId}><strong>{t.tarefa.estado}</strong> · {t.tarefa.titulo} · responsável {t.tarefa.responsavel}. {t.tarefa.recebidoEm?`Recebida em ${t.tarefa.recebidoEm}.`:'Recebimento pendente.'} {t.tarefa.prazo?`Prazo: ${t.tarefa.prazo}.`:''}</li>)}</ul>}
  <h3>Administração observada</h3>{!d.administracoes.length?<p>Nenhuma administração efetiva registrada nesta consulta.</p>:<ul>{d.administracoes.map(a=><li key={a.eventId}><strong>{a.dados.status}</strong> · {a.dados.droga}: {a.dados.quantidadeEfetivaMg} mg efetivamente administrados. {a.dados.motivo} {!a.referenciaValida&&<span role="alert">{a.motivo}</span>}{a.avisos?.map(aviso=><p role="status" key={aviso}>{aviso}</p>)}<small> · evento {a.eventId}</small></li>)}</ul>}
  {dados?.exposicoesLocais?.map(c=><section key={c.droga} aria-label={`Exposição local ${c.droga}`}><h3>{c.droga}: administrado neste serviço</h3>
   <p>{c.total===null?'Total em mg/m² pendente':`${c.total.toLocaleString('pt-BR',{maximumFractionDigits:4})} mg/m²`}. Histórico externo separado; completude e limite não avaliados.</p>
   <ul>{c.administracoes.map(a=><li key={a.adminId}>{a.adminId}: {a.mg} mg infundidos · SC da infusão {a.sc?.valorM2??'não documentada'} m² · {a.mgM2===null?'mg/m² pendente':`${a.mgM2.toLocaleString('pt-BR',{maximumFractionDigits:4})} mg/m²`} · fonte {a.fonte.sourceId}</li>)}</ul>
  </section>)}
  <h3>APAC</h3>{!d.apacs.length?<p>APAC pendente nesta consulta.</p>:<ul>{d.apacs.map(a=><li key={a.eventId}><strong>{a.estado}</strong> · {a.apac.apacId}, versão {a.apac.versao} · competência {a.apac.competencia}. Estado da APAC: {a.apac.estado}. Comprovante externo: {a.apac.resultadoExterno?.valor??'não registrado'}. {a.motivo}{a.estado==='VALIDADA'&&' Validação administrativa; envio externo depende de executor configurado.'}</li>)}</ul>}
  {!!d.integridade.length&&<p role="alert">Integridade setorial pendente: {d.integridade.map(i=>`${i.eventId}: ${i.codigo}`).join('; ')}</p>}
 </section>;
}
