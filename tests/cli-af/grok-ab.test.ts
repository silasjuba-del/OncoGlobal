import { describe, expect, it } from 'vitest';
import { avaliarCanalRedflags, lerCanalRedflags, type CanalLido } from '../../src/rules/canalRedflags.js';
const canal: CanalLido = { rulesetId:'fixture-sintetica', rulesetVersao:'1', fraseFinal:'Fixture sem uso clínico.', sinais:[
  {id:'FEBRE',termo:'febre',termos:['febre'],orientacao:'Texto sintético F.',status:'CONFERIDA_MEDICO',limiarDecimosExclusivo:378},
  {id:'DIARREIA',termo:'diarreia',termos:['diarreia'],orientacao:'Texto sintético D.',status:'APROVADO',limiarDecimosExclusivo:null},
] };
const ids=(texto:string,c=canal)=>avaliarCanalRedflags(texto,c).respostas.map(r=>r.id);
describe('AF A: curadoria e cobertura explícita', () => {
  it.each([null,undefined,{...canal,sinais:[]},{...canal,rulesetVersao:''},{...canal,rulesetId:''},
    {...canal,sinais:canal.sinais.map(s=>({...s,status:'RASCUNHO'}))}])('não declara avaliação normal sem regras disponíveis (%j)', c=>{
    const r=avaliarCanalRedflags('febre e diarreia',c);
    expect(r.estado).toBe('PENDENTE'); expect(r.cobertura).toBe('INDISPONIVEL');
    expect(r.respostas).toEqual([]);expect(r.alertaMedico).toBe(false);expect(r.pendencias.length).toBeGreaterThan(0);
  });
  it('corpus misto retorna somente orientação conferida e registra cobertura parcial sem reordenar a entrada',()=>{
    const c={...canal,sinais:canal.sinais.map(s=>s.id==='DIARREIA'?{...s,status:'RASCUNHO'}:s)},before=structuredClone(c);
    const r=avaliarCanalRedflags('Tenho febre 38,6 °C e diarreia agora.',c);
    expect(r.respostas.map(x=>x.id)).toEqual(['FEBRE']);expect(r.cobertura).toBe('PARCIAL');expect(r.pendencias.length).toBe(1);
    expect(c).toEqual(before);
  });
  it('leitor preserva índices usados pela associação de fontes e rejeita contrato incompleto',()=>{
    const raw={header:{id:canal.rulesetId,versao:'1'},fraseFinal:canal.fraseFinal,sinais:[{...canal.sinais[0],status:'RASCUNHO'},canal.sinais[1]]};
    expect(lerCanalRedflags(raw).sinais.map(s=>s.id)).toEqual(['FEBRE','DIARREIA']);
    expect(()=>lerCanalRedflags({...raw,header:{id:'fixture'}})).toThrow('header.versao');
  });
  it('ordem de entrada não muda resposta nem corpus',()=>{
    const before=structuredClone(canal);
    expect(avaliarCanalRedflags('Tenho febre e diarreia',canal)).toEqual(avaliarCanalRedflags('Tenho febre e diarreia',{...canal,sinais:[...canal.sinais].reverse()}));
    expect(canal).toEqual(before);
  });
});
describe('AF B: medida contextual, precisão e polaridade',()=>{
  it.each([
    ['Minha temperatura agora é 37,81 °C.',true],['Temperatura atual: 37,800 °C.',false],['Temperatura atual: 37,79 °C.',false],
    ['Temperatura -39 °C, sem febre.',false],['Temperatura −39 °C, sem febre.',false],['Temperatura 38,5 mg. Sem febre.',false],
    ['Não tive temperatura de 39 °C.',false],['Estou com febre agora. Meu pai mediu 36 °C.',true],['Plaquetas 38.000, sem febre.',false],
    ['Estou com temperatura de 38,6 °C agora; e se aumentar?',true],['Tenho 39 anos.',false],['Tomei 40 mg.',false],
    ['Minha temperatura é 37,80000000000000001 °C.',true],['temperatura 37,8',false],['temperatura 37,9',true],
    ['Caso tenha febre, aviso.',false],['Ontem temperatura 39 °C.',false],['Estou com febre agora?',false],
    ['Estou com febre, o que faço?',true],['Sem febre e estou com diarreia.',false],['Não tenho febre.',false],
    ['Estou com febre, talvez seja do remédio.',true],['Temperatura 38,6 °C, talvez seja do remédio.',true],
    ['Temperatura atual: 38,5 K.',false],['Temperatura atual: 38,5 XYZ.',false],
  ] as const)('%s => febre=%s',(texto,alerta)=>expect(ids(texto).includes('FEBRE')).toBe(alerta));
  it('negação de outra oração e medida de terceiro não apagam o relato atual',()=>{
    expect(ids('Sem febre e estou com diarreia.')).toEqual(['DIARREIA']);
    expect(ids('Meu pai mediu 36 °C. Estou com febre agora.')).toEqual(['FEBRE']);
    expect(ids('Nega febre, apresenta diarreia.')).toEqual(['DIARREIA']);
    expect(ids('Ontem tive febre, hoje temperatura 38,6 °C.')).toEqual(['FEBRE']);
    expect(ids('Estou com febre, meu pai mediu 36 °C.')).toEqual(['FEBRE']);
  });
});
