import {it,expect} from 'vitest';
import {calcularTotalExposicao,type EntradaExposicaoCumulativa} from '../../src/rules/cumulativoAlerta.js';
const entrada=(unidades:string[]):EntradaExposicaoCumulativa=>({patientId:'p-sintetico',droga:'bleomicina',historicoCompleto:true,fonteCompletude:'conferencia-sintetica',
 administracoes:unidades.map((unidade,i)=>({adminId:`a-${i}`,patientId:'p-sintetico',episodioId:'ep-sintetico',droga:'bleomicina',status:'COMPLETA',quantidadeEfetivaMgM2:10,unidade,fonte:'fonte-sintetica'}))});
it('total sem limite conserva a unidade documentada e não soma U com U/m²',()=>{
 expect(calcularTotalExposicao(entrada(['U']))).toMatchObject({estado:'TOTAL_DOCUMENTADO',unidade:'U',totalMgM2:10});
 expect(calcularTotalExposicao(entrada(['U','U/m2']))).toMatchObject({estado:'PENDENTE',totalMgM2:null,totalConhecidoMgM2:null,pendencias:['UNIDADES_INCOMPATIVEIS_PARA_SOMA']});
});
