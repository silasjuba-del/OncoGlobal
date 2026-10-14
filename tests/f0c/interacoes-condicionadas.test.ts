import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { ContextoInteracoesCondicionadas, type TipoInteracaoCondicionada } from '../../src/contracts/f0c/interacoesCondicionadas.js';
import { avaliarInteracoesCondicionadas } from '../../src/rules/f0c/interacoesCondicionadas.js';
const regras=JSON.parse(readFileSync('corpus/rulesets/interacoes.v1.json','utf8')).interacoes;
const catalogo=JSON.parse(readFileSync('corpus/f0c/classes-farmacos.v1.json','utf8'));
const ref='2026-10-10T12:00:00-03:00';
const c=():ContextoInteracoesCondicionadas=>({versao:1,referencia:ref,offsetServico:'-03:00',medicamentosAtuais:[],
 reconciliacao:{confirmada:true,em:ref,fonte:'reconciliacao-sintetica'},historicoConferido:true,exposicoesCompletas:true,exposicoes:[],coadministracoes:[],clearance:null,vacinas:[],quimioterapia:null,recuperacaoImune:null});
const e=(droga:string,over:Partial<ContextoInteracoesCondicionadas['exposicoes'][number]>={}):ContextoInteracoesCondicionadas['exposicoes'][number]=>({
 droga,formulacao:'SISTEMICA_CONVENCIONAL',ultimaDose:null,proximaDose:null,termino:null,fonte:'fonte-sintetica-'+droga,...over});
const avaliar=(ctx:unknown,tipo:TipoInteracaoCondicionada)=>avaliarInteracoesCondicionadas(ctx,regras,catalogo).find(r=>r.tipo===tipo)!;
it('dados ausentes não viram ausência de interação; nenhuma saída bloqueia salvar',()=>{
 const r=avaliarInteracoesCondicionadas(null,regras,catalogo);expect(r).toHaveLength(4);expect(r.every(x=>x.estado==='PENDENTE'&&!x.bloqueiaSalvar)).toBe(true);
});
it('brivudina histórica dentro de4semanas avisa mesmo ausente da lista atual',()=>{
 const ctx=c();ctx.medicamentosAtuais=['capecitabina'];ctx.exposicoes=[e('brivudina',{ultimaDose:'2026-09-20T12:00:00-03:00',termino:'2026-09-20T12:00:00-03:00'}),e('capecitabina',{proximaDose:ref})];
 expect(avaliar(ctx,'BRIVUDINA_FLUOROPIRIMIDINA')).toMatchObject({estado:'AVISO',bloqueiaSalvar:false});
});
it.each([['2026-09-12T12:00:00-03:00','NAO_APLICAVEL'],['2026-09-12T12:01:00-03:00','AVISO']])('limite exato672horas: término%s =>%s',(termino,estado)=>{
 const ctx=c();ctx.medicamentosAtuais=['capecitabina'];ctx.exposicoes=[e('brivudina',{ultimaDose:termino,termino}),e('capecitabina',{proximaDose:ref})];
 expect(avaliar(ctx,'BRIVUDINA_FLUOROPIRIMIDINA').estado).toBe(estado);
});
it.each([['2026-10-09T12:00:00-03:00','NAO_APLICAVEL'],['2026-10-09T12:01:00-03:00','AVISO']])('ordem inversa capecitabina→brivudina tem24horas próprias',(ultimaDose,estado)=>{
 const ctx=c();ctx.medicamentosAtuais=['brivudina'];ctx.exposicoes=[e('brivudina',{proximaDose:ref}),e('capecitabina',{ultimaDose})];
 expect(avaliar(ctx,'BRIVUDINA_FLUOROPIRIMIDINA').estado).toBe(estado);
});
it('reexposição não reutiliza término anterior contraditório',()=>{
 const ctx=c();ctx.exposicoes=[e('brivudina',{ultimaDose:'2026-10-09T12:00:00-03:00',termino:'2026-09-01T12:00:00-03:00'}),e('capecitabina',{proximaDose:ref})];
 expect(avaliar(ctx,'BRIVUDINA_FLUOROPIRIMIDINA').estado).toBe('PENDENTE');
});
function pem(){const ctx=c();ctx.medicamentosAtuais=['pemetrexede'];ctx.clearance={valorMlMin:60,metodo:'COCKCROFT_GAULT',coleta:'2026-10-09T12:00:00-03:00',fonte:'coleta-sintetica',validoParaDose:true};
 ctx.exposicoes=[e('pemetrexede',{proximaDose:ref}),e('ibuprofeno',{ultimaDose:'2026-10-08T01:00:00-03:00'})];return ctx;}
it.each([45,79,79.9])('pemetrexede/ibuprofeno-2dias comClCr%savisa',(clcr)=>{
 const ctx=pem();ctx.clearance!.valorMlMin=clcr;expect(avaliar(ctx,'PEMETREXEDE_IBUPROFENO').estado).toBe('AVISO');
});
it('janela inclui todo dia+2 e não equivale a48horas corridas',()=>{
 const ctx=pem();ctx.exposicoes[1]=e('ibuprofeno',{proximaDose:'2026-10-12T23:00:00-03:00'});expect(avaliar(ctx,'PEMETREXEDE_IBUPROFENO').estado).toBe('AVISO');
});
it('ClCr80 não aplica recorte45–79; função renal ausente/fora da validade permanece pendente',()=>{
 const ctx=pem();ctx.clearance!.valorMlMin=80;expect(avaliar(ctx,'PEMETREXEDE_IBUPROFENO').estado).toBe('NAO_APLICAVEL');
 ctx.clearance!.valorMlMin=44;expect(avaliar(ctx,'PEMETREXEDE_IBUPROFENO').estado).toBe('PENDENTE');
 ctx.clearance=null;expect(avaliar(ctx,'PEMETREXEDE_IBUPROFENO').estado).toBe('PENDENTE');
 const velho=pem();velho.clearance!.coleta='2026-10-01T12:00:00-03:00';expect(avaliar(velho,'PEMETREXEDE_IBUPROFENO').estado).toBe('PENDENTE');
});
it('não amplia ibuprofeno para naproxeno nem presume próximas doses de uso contínuo',()=>{
 const ctx=pem();ctx.exposicoes[1]=e('naproxeno',{proximaDose:ref});expect(avaliar(ctx,'PEMETREXEDE_IBUPROFENO').estado).toBe('NAO_APLICAVEL');
 ctx.exposicoes[1]=e('ibuprofeno',{ultimaDose:'2026-10-06T12:00:00-03:00'});ctx.medicamentosAtuais!.push('ibuprofeno');
 expect(avaliar(ctx,'PEMETREXEDE_IBUPROFENO').estado).toBe('PENDENTE');
});
it('vacina viva duranteQT avisa; vacina recombinante não herda esse risco',()=>{
 const ctx=c();ctx.quimioterapia={citotoxica:true,emCurso:true,inicio:'2026-10-01T12:00:00-03:00',termino:null,fonte:'qt-sintetica'};
 ctx.vacinas=[{nome:'vacina teste',tipo:'VIVA',data:ref,fonte:'vacina-sintetica'}];expect(avaliar(ctx,'VACINA_VIVA_QT').estado).toBe('AVISO');
 ctx.vacinas[0]!.tipo='RECOMBINANTE';expect(avaliar(ctx,'VACINA_VIVA_QT').estado).toBe('NAO_APLICAVEL');
 ctx.vacinas[0]!.tipo='DESCONHECIDA';expect(avaliar(ctx,'VACINA_VIVA_QT').estado).toBe('PENDENTE');
});
it('vacina apósQT exige3meses civis e recuperação imune; vacina anterior ao início não é coadministração',()=>{
 const ctx=c();ctx.quimioterapia={citotoxica:true,emCurso:false,inicio:'2026-06-01T12:00:00-03:00',termino:'2026-07-10T12:00:00-03:00',fonte:'qt-sintetica'};
 ctx.vacinas=[{nome:'vacina teste',tipo:'VIVA',data:ref,fonte:'vacina-sintetica'}];expect(avaliar(ctx,'VACINA_VIVA_QT').estado).toBe('PENDENTE');
 ctx.recuperacaoImune={confirmada:true,em:'2026-10-09T12:00:00-03:00',fonte:'avaliacao-imune-sintetica'};
 expect(avaliar(ctx,'VACINA_VIVA_QT').estado).toBe('NAO_APLICAVEL');
 ctx.quimioterapia.termino='2026-07-11T12:00:00-03:00';expect(avaliar(ctx,'VACINA_VIVA_QT').estado).toBe('AVISO');
 ctx.vacinas[0]!.data='2026-05-01T12:00:00-03:00';expect(avaliar(ctx,'VACINA_VIVA_QT').estado).toBe('NAO_APLICAVEL');
});
it('AC→TH não é trastuzumabe→doxo nem concomitância',()=>{
 const ctx=c();ctx.medicamentosAtuais=['trastuzumabe'];ctx.exposicoes=[e('doxorrubicina',{ultimaDose:'2026-09-01T12:00:00-03:00',termino:'2026-09-01T12:00:00-03:00'}),e('trastuzumabe',{proximaDose:ref})];
 expect(avaliar(ctx,'DOXORRUBICINA_TRASTUZUMABE').estado).toBe('NAO_APLICAVEL');
});
it.each([['2026-03-10T12:00:00-03:00','NAO_APLICAVEL'],['2026-03-11T12:00:00-03:00','AVISO']])('doxo apóstrastuzumabe usa7meses civis',(termino,estado)=>{
 const ctx=c();ctx.medicamentosAtuais=['doxorrubicina'];ctx.exposicoes=[e('doxorrubicina',{proximaDose:ref}),e('trastuzumabe',{ultimaDose:termino,termino})];
 expect(avaliar(ctx,'DOXORRUBICINA_TRASTUZUMABE').estado).toBe(estado);
});
it('concomitância exige relação explícita, formulação e fonte; coexistência lexical não basta',()=>{
 const ctx=c();ctx.medicamentosAtuais=['doxorrubicina','trastuzumabe'];ctx.exposicoes=[e('doxorrubicina',{proximaDose:ref}),e('trastuzumabe',{proximaDose:ref})];
 expect(avaliar(ctx,'DOXORRUBICINA_TRASTUZUMABE').estado).toBe('PENDENTE');
 ctx.coadministracoes=[{drogas:['doxorrubicina','trastuzumabe'],data:ref,fonte:'prescricao-concomitante'}];
 expect(avaliar(ctx,'DOXORRUBICINA_TRASTUZUMABE').estado).toBe('AVISO');
 ctx.exposicoes[0]!.formulacao='LIPOSSOMAL';expect(avaliar(ctx,'DOXORRUBICINA_TRASTUZUMABE').estado).toBe('PENDENTE');
});
it('schema recusa fonte ausente, date-only, dados futuros e resumos duplicados; regra semfonte não ativa',()=>{
 const ctx=pem();expect(avaliar({...ctx,reconciliacao:null},'PEMETREXEDE_IBUPROFENO').estado).toBe('PENDENTE');
 expect(avaliar({...ctx,referencia:'2026-10-10'},'PEMETREXEDE_IBUPROFENO').estado).toBe('PENDENTE');
 ctx.exposicoes.push(ctx.exposicoes[0]!);expect(avaliar(ctx,'PEMETREXEDE_IBUPROFENO').estado).toBe('PENDENTE');
 const r=regras.map((x:any)=>x.regraId==='F0C-INT-08'?{...x,fonte:{...x.fonte,referencia:'[VERIFICAR]'}}:x);
 expect(avaliarInteracoesCondicionadas(pem(),r,catalogo).find(x=>x.tipo==='PEMETREXEDE_IBUPROFENO')?.estado).toBe('PENDENTE');
});
