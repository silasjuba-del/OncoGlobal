import { createHash } from "node:crypto";
import { mkdtempSync,mkdirSync,writeFileSync,rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach,describe,expect,it } from "vitest";
import { BLOCOS_TUMOR_PACK,TumorPackExtract } from "../../src/contracts/fase2/tumorPack.js";
import { adaptarPackDocumental,carregarPacksTumor,hashExtracaoPack } from "../../src/kernel/corpus/tumorPacks.js";
import { montarFichaMinima,selecionarPack,packCorrespondeAoCid } from "../../src/modules/consulta/revisaoClinica.js";
import { completudeKitTumorLot } from "../../src/rules/kitTumorLot.js";
import { fato,retrato,packOriginal,fonte } from "./fixtures.js";
const dirs:string[]=[];afterEach(()=>{for(const d of dirs.splice(0))rmSync(d,{recursive:true,force:true});});
const sha=(s:string)=>createHash("sha256").update(s).digest("hex");
function base(){const dir=mkdtempSync(join(tmpdir(),"fase2-pack-"));dirs.push(dir);const sub=join(dir,"corpus","6-pack-tumor","sintetico");mkdirSync(sub,{recursive:true});
  const nome="pack-sintetico.v2.RASCUNHO.json",original=JSON.stringify(packOriginal);writeFileSync(join(sub,nome),original);
  const p=adaptarPackDocumental(packOriginal,`corpus/6-pack-tumor/sintetico/${nome}`,sha(original));return{dir,sub,p,nome};}
function conferirSomenteFixture(p:TumorPackExtract):TumorPackExtract {return {...p,estado:"ATIVO",revisaoClinica:{medicoId:"medico-sintetico",em:"2026-10-16T12:00:00Z",hashOriginal:p.original.hash,hashExtracao:p.referencia.hash}};}
describe("contrato documental separado",()=>{
  it("conserva doze blocos e fonte literal sem promover aprovação legada",()=>{
    const p=adaptarPackDocumental(packOriginal,"original.json",sha(JSON.stringify(packOriginal)));
    expect(Object.keys(p.blocos)).toEqual([...BLOCOS_TUMOR_PACK]);expect(p.estado).toBe("CONSULTAVEL");expect(p.revisaoClinica).toBeNull();
    expect(p.blocos.diagnostico.itens[0]?.conteudo).toEqual(packOriginal.diagnostico);expect(p.blocos.resposta.estado).toBe("AUSENTE");
    expect(p.blocos.tratamento.itens).toContainEqual({localizador:"tratamento.protocolos",conteudo:packOriginal.tratamento.protocolos});
    expect(p.requisitos.map(r=>r.exameCodigo)).toEqual(["EXAME_SINTETICO"]);expect(p.referencia.hash).toBe(hashExtracaoPack(p));
    expect(TumorPackExtract.safeParse({...p,estado:"ATIVO"}).success).toBe(false);
  });
  it("loader só aceita ativação sintética com original e extração intactos",()=>{
    const {dir,sub,p,nome}=base();const ativo=conferirSomenteFixture(p);writeFileSync(join(sub,"extract.json"),JSON.stringify(ativo));
    expect(carregarPacksTumor(dir).packs[0]?.estado).toBe("ATIVO");
    writeFileSync(join(sub,nome),JSON.stringify({...packOriginal,nota:"original mudou"}));
    const r=carregarPacksTumor(dir);expect(r.packs.every(p=>p.estado!=="ATIVO")).toBe(true);expect(r.rejeitados).toContainEqual(expect.objectContaining({motivo:"EXTRACAO_OU_ORIGINAL_DIVERGENTE"}));
  });
  it("edição de requisito ou duplicata não reutiliza a conferência",()=>{
    const {dir,sub,p}=base();const ativo=conferirSomenteFixture(p);
    writeFileSync(join(sub,"extract.json"),JSON.stringify({...ativo,requisitos:[{...ativo.requisitos[0]!,exameCodigo:"FORJADO"}]}));
    expect(carregarPacksTumor(dir).packs.every(p=>p.estado!=="ATIVO")).toBe(true);
    writeFileSync(join(sub,"extract.json"),JSON.stringify(ativo));writeFileSync(join(sub,"extract2.json"),JSON.stringify(ativo));
    const r=carregarPacksTumor(dir);expect(r.packs.every(p=>p.estado!=="ATIVO")).toBe(true);expect(r.rejeitados.filter(r=>r.motivo==="EXTRACAO_DUPLICADA")).toHaveLength(2);
  });
  it("kit sem requisito nunca aparece completo",()=>{
    expect(completudeKitTumorLot({},[])).toMatchObject({score:null,kitIncompleto:true});
    expect(completudeKitTumorLot({labsBaseline:[{id:"a",ativo:true},{id:"a",ativo:true}]},["a"])).toMatchObject({obrigatorios:["a"],score:1});
    expect(completudeKitTumorLot({labsBaseline:[{id:"a",ativo:true}],completudeKit:{limiarIncompleto:NaN}},["a"])).toMatchObject({limiar:null,kitIncompleto:true});
  });
});
describe("ficha mínima",()=>{
  it('CID dentro de faixa dispara o pack único, conservando limites e ambiguidade',()=>{
    const {p}=base(),pack={...p,cids:['C00-C14','C30-C32']};
    for(const cid of ['C00','C10','C14.9','C30','C31.1','C32.9']){
      expect(packCorrespondeAoCid(pack,[cid])).toBe(true);
      expect(selecionarPack(retrato([fato('cid',cid)]),[pack])).toBe(pack);
    }
    for(const cid of ['C15','C29.9','C33','D10','C10abc'])expect(packCorrespondeAoCid(pack,[cid])).toBe(false);
    expect(packCorrespondeAoCid({...pack,cids:['C14-C00']},['C10'])).toBe(false);
    expect(selecionarPack(retrato([fato('cid','C10')]),[pack,{...p,cids:['C10']}])).toBeNull();
  });
  it('lê Dado PRESENTE com fontes internas e não promove hipótese ou negação',()=>{
    const dado={valor:'C50',estado:'VERDE',campo:'PRESENTE',motivo:'fixture',fontes:[fonte],revisao:'CONFIRMADO'};
    const r=retrato([fato('cid',null,{tipo:'TumorLot',campo:null,fontes:[],tempoClinico:null,dados:{cid:dado}}),
      fato('extracao.histology','hipótese',{dados:{valor:'hipótese',evidence:'UNCERTAIN',requiresConfirmation:true}}),
      fato('comorbidades','diabetes',{dados:{valor:'diabetes',negated:true}})]);
    const ficha=montarFichaMinima(r);expect(ficha.find(f=>f.id==='cid')).toMatchObject({estado:'DOCUMENTADO',valor:'C50',data:'2026-10-16'});
    expect(ficha.find(f=>f.id==='histologia')).toMatchObject({estado:'PENDENTE',valor:null});
    expect(ficha.find(f=>f.id==='comorbidades')?.valor).toEqual({negado:true,conteudo:'diabetes'});
  });
  it('não escolhe estadiamento para protocolo apenas por ser o mais recente',()=>{
    expect(montarFichaMinima(retrato([fato('estadiamento','pT2N0')])).find(f=>f.id==='estadiamento')).toMatchObject({estado:'PENDENTE',valor:null});
  });
  it('negação mais recente não apaga comorbidade positiva ainda vigente',()=>{
    const r=retrato([fato('comorbidades','diabetes',{tempoClinico:'2026-10-01'}),
      fato('comorbidades','diabetes',{ref:{eventId:'negacao',revisao:'1'},dados:{valor:'diabetes',negated:true},tempoClinico:'2026-10-16'})]);
    expect(montarFichaMinima(r).find(f=>f.id==='comorbidades')).toMatchObject({estado:'CONFLITANTE',valor:null});
  });
  it("zero ECOG e lista vazia explícita são documentados; ausência não é zero",()=>{
    const ficha=montarFichaMinima(retrato([fato("ecog",0),fato("alergias",[])]));
    expect(ficha.find(f=>f.id==="ecog")).toMatchObject({estado:"DOCUMENTADO",valor:0});
    expect(ficha.find(f=>f.id==="alergias")).toMatchObject({estado:"DOCUMENTADO",valor:[]});
    expect(ficha.find(f=>f.id==="pesoKg")).toMatchObject({estado:"PENDENTE",valor:null});
  });
  it("fontes conflitantes ou ausentes não geram ficha completa",()=>{
    const r=retrato([fato("cid","C50"),fato("cid","C18",{ref:{eventId:"conflito",revisao:"1"}}),fato("ecog",0,{fontes:[]})]);
    expect(montarFichaMinima(r).find(f=>f.id==="cid")).toMatchObject({estado:"CONFLITANTE",valor:null});
    const {p}=base();expect(selecionarPack(r,[p])).toBeNull();
  });
  it("SC usa peso medido e altura com fonte, e conserva fórmula",()=>{
    const r=retrato([fato("kg",70,{tipo:"Weight",campo:null,dados:{kg:70,origem:"MEDIDO"}}),fato("alturaCm",170)]);
    expect(montarFichaMinima(r).find(f=>f.id==="sc")).toMatchObject({estado:"CALCULADO",valor:1.82});
    r.fatos[0]!.dados.origem="INFORMADO_PACIENTE";
    expect(montarFichaMinima(r).find(f=>f.id==="sc")).toMatchObject({estado:"PENDENTE",valor:null});
  });
});
