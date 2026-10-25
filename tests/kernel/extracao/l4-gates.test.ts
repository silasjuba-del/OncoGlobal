import {expect,it} from 'vitest';
import {avaliarGatesExtracao,materialExplicito,type FatoGate} from '../../../src/kernel/extracao/gatesClinicos.js';
const q={polaridade:'AFIRMADA',sujeito:'PACIENTE',temporalidade:'ATUAL'} as const;
const fato=(id:string,sourceType:FatoGate['sourceType'],lateralidade:string,lesao='L1'):FatoGate=>({id,sourceId:id,sourceType,domain:'diagnosis',value:{sitioCanonico:'mama',lateralidade},rawEvidence:`Lesão ${lesao}: carcinoma de mama ${lateralidade}.`,evidence:'EXPLICIT',qualificadores:q});
it('compara só mesma lesão/sítio e mantém menções históricas fora do alerta',()=>{
 const a=fato('path','pathology','DIREITA'),b=fato('rads','imaging_report','ESQUERDA');
 expect(avaliarGatesExtracao([a,b],'',{sexoCadastral:'F',fatos:[],referencias:[]}).some(g=>g.gate==='G-07'&&g.decisao==='ALERTA')).toBe(true);
 expect(avaliarGatesExtracao([a,{...b,rawEvidence:'Lesão L2: carcinoma de mama esquerda.'}],'').some(g=>g.decisao==='ALERTA')).toBe(false);
 expect(avaliarGatesExtracao([a,{...b,qualificadores:{...q,temporalidade:'HISTORICA'}}],'').some(g=>g.decisao==='ALERTA')).toBe(false);
 expect(avaliarGatesExtracao([{...a,qualificadores:{...q,sujeito:'TERCEIRO'}}],'')).toEqual([]);
});
it('sexo não informado gera pendência, sem fabricar divergência; anatomia explícita usa cadastro',()=>{
 const p={...fato('p','pathology',''),value:{sitioCanonico:'prostata'}};
 expect(avaliarGatesExtracao([p],'').find(g=>g.gate==='G-08')?.decisao).toBe('PENDENTE');
 expect(avaliarGatesExtracao([p],'',{sexoCadastral:'F',fatos:[],referencias:[]}).find(g=>g.gate==='G-08')?.decisao).toBe('ALERTA');
});
it('pTNM normalizado requer material e literal explícitos; não infere peça de narrativa',()=>{
 const f:FatoGate={id:'tnm',sourceId:'s',sourceType:'pathology',domain:'stage',value:{literal:'pT2N0M0',prefixo:'p'},rawEvidence:'pT2N0M0',evidence:'EXPLICIT',qualificadores:q};
 expect(avaliarGatesExtracao([f],'Material: biópsia\npT2N0M0')[0]?.decisao).toBe('BLOQUEIA_ARTEFATO');
 expect(avaliarGatesExtracao([f],'Cirurgia prévia com margens livres\npT2N0M0')[0]?.decisao).toBe('PENDENTE');
 expect(avaliarGatesExtracao([f],'Material: ressecção cirúrgica\npT2N0M0')[0]?.decisao).toBe('PASSA');
 expect(avaliarGatesExtracao([{...f,rawEvidence:'TNM não descrito'}],'Material: ressecção cirúrgica')[0]?.decisao).toBe('PENDENTE');
 expect(materialExplicito('Material: biópsia anterior')).toBeUndefined();
 expect(avaliarGatesExtracao([{...f,value:{literal:'cT2N0M0',prefixo:'p'}}],'Material: ressecção cirúrgica')[0]?.decisao).toBe('PENDENTE');
});
