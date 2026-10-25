import type { BaseAtendimentoV6, DocumentoAtendimentoV6, EntradaAtendimentoV6 } from "../../contracts/api/atendimentoV6.js";

export const TITULOS_V6={RESUMO:"Resumo do caso",EVOLUCAO:"Evolução por diferenças",EXAMES:"Pedido de exames",RETORNO:"Retorno",PRESCRICAO:"Prescrição"} as const;
/** Composição local literal. Nenhum diagnóstico, dose, exame físico ou decisão é inferido. */
export function comporDocumentosAtendimentoV6(base:BaseAtendimentoV6,entrada:EntradaAtendimentoV6):DocumentoAtendimentoV6[]{
 const referencia=`${base.pacienteNome} · referência: ${base.dataReferencia??"data do encontro não informada"}`;
 const textos=base.citacoes.map((c,i)=>{
  const unidades=[...new Set(c.referencias.flatMap(f=>f.unidade?[f.unidade]:[]))];
  const datas=[...new Set(c.referencias.map(f=>f.tempoClinico??"não informada"))];
  return `${c.texto}${unidades.length?` Unidade registrada: ${unidades.join("; ")}.`:""} [${i+1}] · data clínica: ${datas.join("; ")}`;
 });
 const fontes=base.citacoes.map((c,i)=>`[${i+1}] ${c.referencias.map(f=>
  `${f.ref.eventId} · registro: ${f.tempoRegistro} · ${f.fontes.length?f.fontes.map(s=>`${s.sourceId} (${s.classe}) · ${s.localizador??"localizador não informado"} · versão ${s.versao} · data da fonte: ${s.dataClinica??"não informada"} · captura: ${s.dataCaptura}`).join("; "):"fonte documental não disponível"}`).join("; ")}`);
 const novas=new Set(base.delta.novos.map(r=>JSON.stringify(r)));
 const mudou=base.delta.encounterAnteriorId===null?"Sem comparação com encontro anterior disponível."
  :base.citacoes.filter(c=>c.referencias.some(f=>novas.has(JSON.stringify(f.ref)))).map(c=>c.texto).join("\n")||"Nenhuma diferença documental demonstrada pelo retrato recuperado.";
 const dataDeclaracao=base.dataReferencia??"data clínica não informada";
 const hoje=entrada.hoje?`Atualização informada pelo médico para ${dataDeclaracao}: ${entrada.hoje}`:"Atualização não informada; não equivale a ausência de sintomas.";
 const decisao=entrada.decisao?`Decisão médica informada para ${dataDeclaracao}: ${entrada.decisao}`:"Decisão médica de hoje: não informada.";
 const notas=(base.anotacoesChat??[]).map(n=>`${n.texto}\nAutor: ${n.autor} · registro: ${n.em} · mensagem: ${n.mensagemId} (${n.mensagemEventId}) · anotação: ${n.eventId}`).join("\n\n");
 return entrada.saidas.map(tipo=>{
  const pendencias=[...base.integridade];
  if(tipo==="EVOLUCAO")pendencias.push(...base.pendenciasAnotacoes??[]);
  if(tipo!=="RESUMO"&&tipo!=="EVOLUCAO")return {tipo,titulo:TITULOS_V6[tipo],estado:"FLUXO_ESPECIFICO_NECESSARIO" as const,
   texto:`${TITULOS_V6[tipo]} — preparação pendente\n${referencia}\n${decisao}`,
   pendencias:[`Concluir ${TITULOS_V6[tipo].toLowerCase()} no fluxo específico, com seus campos e validações. Esta síntese não emite esse documento.`]};
  if(tipo==="EVOLUCAO"&&!entrada.decisao)pendencias.push("Decisão médica de hoje não informada.");
  if(tipo==="EVOLUCAO"&&!base.dataReferencia)pendencias.push("Data clínica do atendimento não informada.");
  if(base.delta.substituidos.length)pendencias.push("Há referências substituídas; conferir o contraste com o histórico antes de concluir a revisão.");
  if(!base.citacoes.length&&!entrada.hoje)pendencias.push("Sem conteúdo clínico recuperado ou atualização informada para compor o texto.");
  const recuperado=textos.join("\n")||"Nenhum conteúdo recuperado para este contexto.";
  const corpo=tipo==="RESUMO"
   ?`AGORA\n${recuperado}\n\nMUDOU\n${mudou}\n${hoje}\n\n${decisao}`
   :`S — atualização informada\n${hoje}\n\nO — dados recuperados, com suas datas\n${recuperado}\nExame físico de hoje não acrescentado automaticamente.\n\nA — diferenças documentadas\n${mudou}\n${base.delta.substituidos.length?`${base.delta.substituidos.length} referência(s) substituída(s); conferir a retificação.\n`:""}\nP — decisão explícita\n${decisao}`;
  return {tipo,titulo:TITULOS_V6[tipo],estado:pendencias.length?"PENDENTE" as const:"PRONTO_PARA_REVISAO" as const,pendencias,
   apresentacao:{textoClinico:`RASCUNHO — revisão e assinatura pendentes\n${referencia}\n\n${corpo}${tipo==="EVOLUCAO"&&notas?`\n\nANOTAÇÕES MÉDICAS ACEITAS DO CHAT\n${(base.anotacoesChat??[]).map(n=>n.texto).join("\n\n")}`:""}`,
    detalhes:[...fontes,...(tipo==="EVOLUCAO"?(base.anotacoesChat??[]).map((n,i)=>`Anotação ${i+1} · Autor: ${n.autor} · registro: ${n.em} · mensagem: ${n.mensagemId} (${n.mensagemEventId}) · anotação: ${n.eventId}`):[])]},
   texto:`RASCUNHO — revisão e assinatura pendentes\n${referencia}\n\n${corpo}${tipo==="EVOLUCAO"&&notas?`\n\nANOTAÇÕES MÉDICAS ACEITAS DO CHAT\n${notas}`:""}${fontes.length?`\n\nFONTES E PROVENIÊNCIA\n${fontes.join("\n")}`:""}`};
 });
}
