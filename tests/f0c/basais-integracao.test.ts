import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
import {avaliarConsulta, type EntradaAvaliacaoConsulta} from '../../src/server/f0c/avaliacaoConsulta.js';
import {lerAlertaFeve} from '../../src/rules/alertaFeve.js';
import type {ClinicalEvent} from '../../src/contracts/operacao.js';
import {fonteSintetica,presente} from '../fixtures/triagem.js';
const base:EntradaAvaliacaoConsulta={eventos:[],patientId:'p-basal',encounterId:'e-basal',tumorLotId:null,
  agora:'2026-10-10T12:00:00-03:00',hoje:'2026-10-10',episodio:null,plaquetas:null,
  paciente:{patientId:'p-basal',nome:'Paciente sintético basal',identificadores:[],nascimento:'1970-01-01',sexoCadastral:'M',divergencia:false},
  ciclo:{cicloId:'c-basal',episodioId:'ep-basal',numero:1,previstoEm:'2026-10-10',pesoKg:presente(70),origemPeso:'MEDIDO',ciclosSemPesoConsecutivos:0,prescricaoRef:null,
    itens:[{item:1,droga:'doxorrubicina',doseMg:100,reducaoPct:0}],comMedico:true},
  feveRuleset:lerAlertaFeve(JSON.parse(readFileSync('corpus/rulesets/salao-feve.v1.json','utf8')))};
function fato(campo:string,valor:unknown,id=campo):ClinicalEvent{return {eventId:id,operationId:`op-${id}`,eventIndex:0,
  patientId:base.patientId,encounterId:base.encounterId,tumorLotId:null,tipo:'FATO',revisao:'CONFIRMADO',
  criadoEm:base.agora,criadoPor:{tipo:'SESSAO',id:'medico-sintetico'},supersedesEventId:null,fontes:[fonteSintetica('fonte-basal')],payload:{data:{campo,valor}}};}
const atual=fato('feve',{percentual:52,metodo:'Simpson',data:'2026-10-09'});
const basal={percentual:68,metodo:'Simpson',data:'2026-09-01',episodioId:'ep-basal'};
it.each([{requiresConfirmation:true},{evidence:'UNCERTAIN'},{negado:true},
 {qualificadores:{polaridade:'NEGADA',sujeito:'PACIENTE',temporalidade:'HISTORICA'}},
 {qualificadores:{polaridade:'AFIRMADA',sujeito:'TERCEIRO',temporalidade:'ATUAL'}}])('metadado do evento não é perdido ao selecionar basal: %j',meta=>{
 const b=fato('feveBasal',basal);
 b.payload={data:{campo:'feveBasal',valor:basal,...meta}};
 const r=avaliarConsulta({...base,eventos:[atual,b]});
 expect(r.avisosFlash.join(' ')).not.toContain('16 pontos');
 expect(r.elegibilidade.motivos.some(m=>m.texto.includes('basal'))).toBe(true);
 const audio=fato('audiometriaBasal',{estado:'REALIZADO',resultado:'Laudo sintético',data:'2026-10-08',episodioId:'ep-basal'});
 audio.payload={data:{...(audio.payload as {data:object}).data,...meta}};
 const a=avaliarConsulta({...base,ciclo:{...base.ciclo!,itens:[{item:1,droga:'cisplatina',doseMg:100,reducaoPct:0}]},eventos:[audio]});
 expect(a.sugestoesLaboratorio).toContain('Audiometria basal');
});
it('eco basal chega à avaliação e queda relativa aparece no retorno',()=>{
  const r=avaliarConsulta({...base,eventos:[atual,fato('feveBasal',basal)]});
  expect(r.avisosFlash.join(' ')).toContain('16 pontos');
  expect(r.elegibilidade.motivos.some(m=>m.texto.includes('eco basal ausente'))).toBe(false);
});
it.each([{...basal,data:'2026-12-01'},{...basal,data:'2026-02-30'},{...basal,episodioId:'ep-outro'},{...basal,metodo:null},
 {...basal,evidence:'INFERRED'}, {...basal,qualificadores:{polaridade:'NEGADA',sujeito:'PACIENTE',temporalidade:'HISTORICA'}},
 {...basal,qualificadores:{polaridade:'AFIRMADA',sujeito:'TERCEIRO',temporalidade:'ATUAL'}}])('basal inválido não elimina pendência (%j)',b=>{
  const r=avaliarConsulta({...base,eventos:[atual,fato('feveBasal',b)]});
  expect(r.avisosFlash.join(' ')).not.toContain('16 pontos');
  expect(r.elegibilidade.motivos.some(m=>m.texto.includes('basal'))).toBe(true);
});
it('basais conflitantes não elegem um percentual e outro paciente não completa o caso',()=>{
  for(const eventos of [[atual,fato('feveBasal',basal,'b1'),fato('feveBasal',{...basal,percentual:60},'b2')],
    [atual,{...fato('feveBasal',basal),patientId:'outro-paciente'}]]) {
    const r=avaliarConsulta({...base,eventos});expect(r.avisosFlash.join(' ')).not.toContain('16 pontos');
    expect(r.elegibilidade.motivos.some(m=>m.texto.includes('basal'))).toBe(true);
  }
});
it('audiometria realizada e atribuída ao episódio resolve a pendência de C1; agendada não',()=>{
  const ciclo={...base.ciclo!,itens:[{item:1,droga:'cisplatina',doseMg:100,reducaoPct:0}]};
  const audio={estado:'REALIZADO',resultado:'Laudo sintético disponível',data:'2026-10-08',episodioId:'ep-basal'};
  for(const [valor,presente] of [[audio,true],[{...audio,estado:'AGENDADO'},false],[{...audio,episodioId:'ep-outro'},false],[{...audio,data:'2027-01-01'},false]] as const) {
    const r=avaliarConsulta({...base,ciclo,eventos:[fato('audiometriaBasal',valor)]});
    expect(r.sugestoesLaboratorio.includes('Audiometria basal')).toBe(!presente);
    expect(r.elegibilidade.motivos.some(m=>m.texto.includes('audiometria'))).toBe(!presente);
  }
});

it('seleciona o episódio antes de comparar basais e preserva o histórico anterior',()=>{
 const anterior=fato('feveBasal',{...basal,episodioId:'ep-anterior',percentual:55},'basal-anterior');
 const eventos=[atual,anterior,fato('feveBasal',basal)];const copia=JSON.stringify(eventos);
 const r=avaliarConsulta({...base,eventos});expect(r.avisosFlash.join(' ')).toContain('16 pontos');expect(JSON.stringify(eventos)).toBe(copia);
 const ciclo={...base.ciclo!,itens:[{item:1,droga:'cisplatina',doseMg:100,reducaoPct:0}]};
 const audio={estado:'REALIZADO',resultado:'Laudo sintético',data:'2026-10-08',episodioId:'ep-basal'};
 const a=avaliarConsulta({...base,ciclo,eventos:[fato('audiometriaBasal',audio,'audio-atual'),fato('audiometriaBasal',{...audio,episodioId:'ep-anterior'},'audio-anterior')]});
 expect(a.sugestoesLaboratorio).not.toContain('Audiometria basal');
});
it('data clínica futura do envelope não é legitimada pela data antiga dentro do valor basal',()=>{
 const b=fato('feveBasal',basal);b.payload={data:{campo:'feveBasal',valor:basal,dataClinica:'2027-01-01'}};
 const r=avaliarConsulta({...base,eventos:[atual,b]});expect(r.avisosFlash.join(' ')).not.toContain('16 pontos');
 expect(r.elegibilidade.motivos.some(m=>m.texto.includes('basal'))).toBe(true);
});
