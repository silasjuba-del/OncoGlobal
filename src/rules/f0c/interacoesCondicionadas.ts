import { ContextoInteracoesCondicionadas, RegraInteracaoCondicionada, TiposInteracaoCondicionada,
  type ResultadoInteracaoCondicionada } from '../../contracts/f0c/interacoesCondicionadas.js';
import { identidadeFarmaco, type CatalogoInteracoes } from '../../contracts/f0c/interacoes.js';
type Contexto=ContextoInteracoesCondicionadas;
type Exposicao=Contexto['exposicoes'][number];
const HORA=3_600_000;
const ms=(s:string)=>Date.parse(s);
function mesesDepois(iso:string,meses:number,offset:string) {
  const sinal=offset[0]==='-'?-1:1;const minutos=sinal*(Number(offset.slice(1,3))*60+Number(offset.slice(4)));
  const d=new Date(ms(iso)+minutos*60_000),dia=d.getUTCDate();
  d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+meses);
  const ultimo=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(dia,ultimo));
  return d.getTime()-minutos*60_000;
}
const diaServico=(s:string,c:Contexto)=>{
  const off=c.offsetServico, minutos=(off[0]==='-'?-1:1)*(Number(off.slice(1,3))*60+Number(off.slice(4)));
  return new Date(ms(s)+minutos*60_000).toISOString().slice(0,10);
};
const diaNumero=(s:string,c:Contexto)=>Date.parse(`${diaServico(s,c)}T00:00:00Z`)/86_400_000;
/** Sem relógio global, sem conduta automática; fonte e cronologia são parte obrigatória do contexto. */
export function avaliarInteracoesCondicionadas(bruto:unknown,regras:readonly unknown[],catalogo?:CatalogoInteracoes):ResultadoInteracaoCondicionada[] {
  const parsed=ContextoInteracoesCondicionadas.safeParse(bruto);
  const validas=regras.flatMap(raw=>{const p=RegraInteracaoCondicionada.safeParse(raw);return p.success?[p.data]:[];});
  return TiposInteracaoCondicionada.map(tipo=>{
    const candidatas=validas.filter(r=>r.avaliacaoCondicionada.tipo===tipo),r=candidatas.length===1?candidatas[0]:undefined;
    const resultado=(estado:ResultadoInteracaoCondicionada['estado'],motivo:string,fontes:readonly string[]=[]):ResultadoInteracaoCondicionada=>({
      tipo,estado,motivo,bloqueiaSalvar:false,fontes:[...new Set([...(r?[r.fonte.referencia]:[]),...fontes])],regraId:r?.regraId??null,
    });
    const pend=(motivo:string)=>resultado('PENDENTE',motivo);
    const aviso=(motivo:string,fontes:string[])=>resultado('AVISO',motivo,fontes);
    const fora=(motivo:string)=>resultado('NAO_APLICAVEL',`${motivo} Apenas esta condição foi avaliada; não determina elegibilidade.`);
    if(!r)return pend('Regra condicionada ausente, ambígua ou sem parâmetros/fonte conferidos.');
    if(!parsed.success)return pend('Contexto temporal, formulação, fonte ou dados obrigatórios ausentes/inválidos.');
    const c=parsed.data,ref=ms(c.referencia),normal=(s:string)=>identidadeFarmaco(s,catalogo);
    if(!c.reconciliacao?.confirmada || !c.medicamentosAtuais || ms(c.reconciliacao.em)>ref
      || diaServico(c.reconciliacao.em,c)!==diaServico(c.referencia,c))return pend('Lista atual precisa de reconciliação documentada neste dia.');
    const ids=c.exposicoes.map(e=>normal(e.droga));
    if(ids.some(id=>!id)||new Set(ids).size!==ids.length)return pend('Exposição com identidade ambígua ou mais de um resumo por medicamento.');
    if(c.exposicoes.some(e=>(e.ultimaDose!==null&&ms(e.ultimaDose)>ref)||(e.proximaDose!==null&&ms(e.proximaDose)<ref)
      ||(e.termino!==null&&(ms(e.termino)>ref||(e.ultimaDose!==null&&ms(e.ultimaDose)>ms(e.termino))))))return pend('Cronologia de doses/término inconsistente.');
    const ex=(nome:string)=>c.exposicoes.find(e=>normal(e.droga)===normal(nome));
    const atual=(nome:string)=>c.medicamentosAtuais!.some(m=>normal(m)===normal(nome));
    const completo=c.historicoConferido&&c.exposicoesCompletas;
    const ausencia=(motivo:string)=>completo?fora(motivo):pend('Histórico e completude das exposições não conferidos.');
    const convencional=(e:Exposicao)=>e.formulacao==='SISTEMICA_CONVENCIONAL';
    const coadmin=(a:string,b:string)=>c.coadministracoes.find(v=>diaServico(v.data,c)>=diaServico(c.referencia,c)
      && ((normal(v.drogas[0])===normal(a)&&normal(v.drogas[1])===normal(b))||(normal(v.drogas[1])===normal(a)&&normal(v.drogas[0])===normal(b))));
    switch(tipo){
      case 'BRIVUDINA_FLUOROPIRIMIDINA':{
        const b=ex('brivudina');
        const fps=['capecitabina','fluorouracila','tegafur'];let incompleto=false,avaliado=false;
        for(const nome of fps){
          const f=ex(nome),sim=coadmin('brivudina',nome);
          if(sim){if(!b||!f||!convencional(b)||!convencional(f))return pend('Concomitância informada sem formulações sistêmicas verificadas.');
            return aviso('Brivudina e fluoropirimidina com coadministração explicitamente documentada.',[b.fonte,f.fonte,sim.fonte]);}
          if(!f && !atual(nome))continue;
          if(!b){if(atual('brivudina'))incompleto=true;continue;}
          if(!f||!convencional(b)||!convencional(f)){incompleto=true;continue;}
          if(f.proximaDose){
            if(!b.termino){incompleto=true;continue;}
            const horas=(ms(f.proximaDose)-ms(b.termino))/HORA;avaliado=true;
            if(horas>=0&&horas<672)return aviso('Fluoropirimidina prevista antes de completar 4 semanas após o término documentado da brivudina.',[b.fonte,f.fonte]);
          }
          if(b.proximaDose&&f.ultimaDose){
            if(nome!=='capecitabina'){incompleto=true;continue;}
            avaliado=true;const horas=(ms(b.proximaDose)-ms(f.ultimaDose))/HORA;
            if(horas>=0&&horas<24)return aviso('Brivudina prevista antes de 24 horas da última dose documentada de capecitabina.',[b.fonte,f.fonte]);
          } else if(b.proximaDose&&atual(nome))incompleto=true;
          if(atual(nome)&&!f.proximaDose&&!b.proximaDose)incompleto=true;
        }
        if(incompleto)return pend('Faltam término, próxima/última dose ou formulação para avaliar a janela da brivudina.');
        return ausencia(avaliado?'Datas documentadas fora das janelas implementadas.':'Sem nova exposição ao par no contexto conferido.');
      }
      case 'PEMETREXEDE_IBUPROFENO':{
        const p=ex('pemetrexede'),b=ex('ibuprofeno');
        if(!p&&!atual('pemetrexede'))return ausencia('Sem pemetrexede no contexto de exposição.');
        if(!b&&!atual('ibuprofeno'))return ausencia('Sem ibuprofeno no contexto de exposição.');
        if(!p||!b||!convencional(p)||!convencional(b)||!p.proximaDose)return pend('Próxima dose de pemetrexede e exposições sistêmicas de ibuprofeno não documentadas.');
        const cr=c.clearance;
        if(!cr||!cr.validoParaDose||ms(cr.coleta)>ref||ms(p.proximaDose)<ms(cr.coleta)||(ms(p.proximaDose)-ms(cr.coleta))/HORA>168)
          return pend('ClCr Cockcroft–Gault válido para a dose e coleta dentro de 7 dias não comprovados.');
        if(cr.valorMlMin<45)return pend('ClCr abaixo de 45 mL/min: fora desta regra de interação; exige avaliação renal própria.');
        if(cr.valorMlMin>=80)return fora('ClCr documentado fora do recorte 45–79 mL/min desta regra.');
        const doses=[b.ultimaDose,b.proximaDose].filter((s):s is string=>s!==null);
        if(!doses.length)return pend('Dose de ibuprofeno sem data.');
        if(doses.some(s=>Math.abs(diaNumero(s,c)-diaNumero(p.proximaDose!,c))<=2))
          return aviso('Ibuprofeno documentado entre 2 dias antes e 2 dias após pemetrexede, com ClCr de 45 a menos de 80 mL/min.',[p.fonte,b.fonte,cr.fonte]);
        if(atual('ibuprofeno')&&!b.termino)return pend('Uso atual de ibuprofeno sem término: uma dose fora da janela não prova ausência nas doses seguintes.');
        return ausencia('Doses conferidas fora da janela de ibuprofeno desta regra.');
      }
      case 'VACINA_VIVA_QT':{
        if(!c.vacinas.length)return ausencia('Sem vacina no contexto conferido.');
        if(c.vacinas.some(v=>v.tipo==='DESCONHECIDA'))return pend('Tipo de vacina não confirmado.');
        const vivas=c.vacinas.filter(v=>v.tipo==='VIVA');if(!vivas.length)return fora('As vacinas informadas são inativadas ou recombinantes.');
        const qt=c.quimioterapia;if(!qt)return pend('Exposição à quimioterapia citotóxica e seu término não documentados.');
        if(!qt.citotoxica)return pend('Tratamento fora do recorte citotóxico; não extrapolar imunossupressão.');
        if((qt.inicio&&ms(qt.inicio)>ref)||(qt.termino&&ms(qt.termino)>ref)||(qt.inicio&&qt.termino&&ms(qt.termino)<ms(qt.inicio))
          ||(qt.emCurso&&qt.termino))return pend('Cronologia ou estado de quimioterapia inconsistente.');
        let falta=false;
        for(const v of vivas){
          if(!v.data){falta=true;continue;}
          if(qt.inicio&&ms(v.data)<ms(qt.inicio))continue;
          if(qt.emCurso){
            if(qt.inicio&&ms(v.data)>=ms(qt.inicio)&&ms(v.data)<=ref)return aviso('Vacina viva documentada durante quimioterapia citotóxica em curso.',[v.fonte,qt.fonte]);
            falta=true;continue;
          }
          if(!qt.termino){falta=true;continue;}
          if(ms(v.data)<mesesDepois(qt.termino,3,c.offsetServico)){
            if(!qt.inicio&&ms(v.data)<ms(qt.termino)){falta=true;continue;}
            return aviso('Vacina viva dentro do tratamento documentado ou antes de 3 meses após seu término.',[v.fonte,qt.fonte]);
          }
          if(!c.recuperacaoImune?.confirmada||ms(c.recuperacaoImune.em)>ms(v.data)||ms(c.recuperacaoImune.em)>ref)falta=true;
        }
        return falta?pend('Data vacinal, período de quimioterapia ou recuperação imune ainda não demonstrados.'):ausencia('Vacina fora do período imunossupressor documentado e critérios desta regra.');
      }
      case 'DOXORRUBICINA_TRASTUZUMABE':{
        const d=ex('doxorrubicina'),t=ex('trastuzumabe'),sim=coadmin('doxorrubicina','trastuzumabe');
        if(sim){if(!d||!t||!convencional(d)||!convencional(t))return pend('Formulações do par concomitante não verificadas.');
          const fonte=r.avaliacaoCondicionada.tipo==='DOXORRUBICINA_TRASTUZUMABE'?r.avaliacaoCondicionada.fonteConcomitancia.referencia:r.fonte.referencia;
          return aviso('Coadministração de doxorrubicina convencional e trastuzumabe explicitamente documentada; risco cardíaco.',[d.fonte,t.fonte,sim.fonte,fonte]);}
        if(!d?.proximaDose&&!atual('doxorrubicina'))return ausencia('Sem nova doxorrubicina planejada; não confundir AC→TH com antraciclina após trastuzumabe.');
        if(!t&&!atual('trastuzumabe'))return ausencia('Sem exposição a trastuzumabe no histórico conferido.');
        if(!d||!t||!convencional(d)||!convencional(t)||!d.proximaDose||!t.termino)return pend('Formulação, próxima doxorrubicina ou término do trastuzumabe não demonstrados.');
        if(ms(d.proximaDose)>=ms(t.termino)&&ms(d.proximaDose)<mesesDepois(t.termino,7,c.offsetServico))
          return aviso('Doxorrubicina prevista antes de 7 meses após término documentado do trastuzumabe.',[d.fonte,t.fonte]);
        return ausencia('Doxorrubicina fora da janela de 7 meses após término do trastuzumabe documentado.');
      }
    }
  });
}
