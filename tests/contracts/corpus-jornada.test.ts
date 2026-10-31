import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
import {CorpusJornada} from '../../src/contracts/jornadaClinica.js';
const corpus=()=>JSON.parse(readFileSync('corpus/jornadas/pulmao.v1.json','utf8'));
it('corpus inteiro valida, mantém linhas vazias e não inclui pacientes ou caminhos privados',()=>{
 const c=CorpusJornada.parse(corpus());expect(c.cartoes).toHaveLength(44);
 expect(c.cartoes.every(c=>c.linhas['4'].opcoes.length===0&&c.linhas['5'].opcoes.length===0)).toBe(true);
 expect(JSON.stringify(c)).not.toMatch(/C:\\Users|patientId|aprovadoMedico/);
});
it('recusa fonte órfã, opção sem fonte e ID duplicado em vez de publicar parcialmente',()=>{
 const a=corpus();a.cartoes[0].fontes[0].fonte='inventado';expect(CorpusJornada.safeParse(a).success).toBe(false);
 const b=corpus();b.cartoes[0].linhas['1']={opcoes:['inventada'],fontes:[],condicao:'',estado:'EXTRAIDO_PARA_REVISAO'};expect(CorpusJornada.safeParse(b).success).toBe(false);
 const c=corpus();c.cartoes.push(c.cartoes[0]);expect(CorpusJornada.safeParse(c).success).toBe(false);
});
