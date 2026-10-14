import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { carregarCompetenciaSigtap, buscarProcedimento, buscarProcedimentoApac } from '../../src/apac/sigtap.js';
import { parseSigtapOficial } from '../../scripts/sigtap-import.mjs';
import { lerArquivosSigtapZip } from '../../scripts/sigtap-zip.mjs';
const root = new URL('../../corpus/f0c/sigtap/',import.meta.url);
const fonte = readFileSync(new URL('fontes/TabelaUnificada_202609_v2610050950.zip',root));
const pacote = () => JSON.parse(readFileSync(new URL('2026-09.json',root),'utf8'));
it('carrega154 oficiais offline por competência sem fallback nem curadoria clínica implícita',()=>{
 const r=carregarCompetenciaSigtap(pacote(),fonte); expect(r.ativo).toBe(true); if(!r.ativo)return;
 expect(Object.keys(r.tabela.procedimentos)).toHaveLength(154);
 expect(r.meta.estado).toBe('FONTE_OFICIAL_CONFERIDA');
 const tabelas={'2026-09':r.tabela};
 expect(buscarProcedimento(tabelas,'2026-10','0304050024')).toEqual({achou:false,motivo:'COMPETENCIA_SEM_TABELA'});
 expect(buscarProcedimento(tabelas,'2026-09','03.04.05.002-4')).toMatchObject({achou:true,proc:{codigo:'0304050024',valorSaCentavos:222400}});
 expect(r.tabela.procedimentos['0304020451']).toMatchObject({financiamentoCodigo:'04'});
 expect(r.tabela.procedimentos['0304050350']?.nome).toContain('MAMAHER-2');
 expect(r.tabela.procedimentos['0304050350']?.observacoesFonte).toContain('[sic]');
});
it('recusa hash do ZIP e do conteúdo divergentes, estado candidato e outra competência',()=>{
 expect(carregarCompetenciaSigtap(pacote(),new Uint8Array([0]))).toEqual({ativo:false,codigo:'SIGTAP_HASH_FONTE_DIVERGENTE'});
 const alterado=pacote();alterado.procedimentos[0].nome+=' alterado';
 expect(carregarCompetenciaSigtap(alterado,fonte)).toEqual({ativo:false,codigo:'SIGTAP_HASH_CONTEUDO_DIVERGENTE'});
 const candidato=pacote();candidato.meta.estado='CANDIDATO_NAO_CURADO';
 expect(carregarCompetenciaSigtap(candidato,fonte)).toEqual({ativo:false,codigo:'SIGTAP_NAO_CURADO'});
 const competencia=pacote();competencia.meta.validacao.competencia='2026-10';
 expect(carregarCompetenciaSigtap(competencia,fonte)).toEqual({ativo:false,codigo:'SIGTAP_VALIDACAO_DIVERGENTE'});
});
it('154 não significa154 APAC principais: rejeita AIH e APAC secundária como principal',()=>{
 const r=carregarCompetenciaSigtap(pacote(),fonte);if(!r.ativo)throw Error('cadastro ausente');
 const t={'2026-09':r.tabela};
 expect(buscarProcedimento(t,'2026-09','0304080020').achou).toBe(true);
 expect(buscarProcedimentoApac(t,'2026-09','0304080020')).toMatchObject({achou:false,motivo:'INSTRUMENTO_INCOMPATIVEL_APAC'});
 expect(buscarProcedimentoApac(t,'2026-09','0304080012')).toMatchObject({achou:false,motivo:'INSTRUMENTO_INCOMPATIVEL_APAC'});
 expect(buscarProcedimentoApac(t,'2026-09','0304080012','SECUNDARIO').achou).toBe(true);
});
it('importador segue layouts oficiais e recusa arquivo de outra competência',()=>{
 const arquivos=lerArquivosSigtapZip(fonte,'e2f1a210d8de4148f946e74f18b7726d4bc8145c97f48c2338874851789a03df');
 const r=parseSigtapOficial(arquivos,'2026-09'); expect(r.procedimentos).toHaveLength(154);
 expect(()=>parseSigtapOficial(arquivos,'2026-10')).toThrow('COMPETENCIA_FONTE_DIVERGENTE');
 const malformado={...arquivos,'tb_procedimento.txt':'linha curta'};
 expect(()=>parseSigtapOficial(malformado,'2026-09')).toThrow('LARGURA_OFICIAL_DIVERGENTE');
});

it('adulterar descrição e CIDs e recalcular hash do próprio pacote não supera o pin independente',()=>{
 const adulterado=pacote();adulterado.procedimentos[0].nome='Nome adulterado';adulterado.procedimentos[0].cidsCompativeis=['Z000'];
 adulterado.meta.hashConteudo=createHash('sha256').update(JSON.stringify({competencia:adulterado.competencia,procedimentos:adulterado.procedimentos})).digest('hex');
 expect(carregarCompetenciaSigtap(adulterado,fonte)).toEqual({ativo:false,codigo:'SIGTAP_CONTEUDO_NAO_CONFERIDO'});
 const desconhecida=pacote();desconhecida.meta.versao='2026-09.versao-inventada';
 expect(carregarCompetenciaSigtap(desconhecida,fonte)).toEqual({ativo:false,codigo:'SIGTAP_RELEASE_NAO_CONFERIDA'});
});
