import { expect, it } from "vitest";
import { validarPayloadEvento } from "../../../src/contracts/envelope.js";
it.each(["ImagingReport","ExameLaudo","Radiotherapy","FatoRadioterapia","FatoRT","Surgery","FatoCirurgia","RecistSerie"])("%s recusa objeto sem identidade do domínio sem expor conteúdo",tipo=>{
 const r=validarPayloadEvento(tipo,{arbitrario:"sem domínio privado"});
 expect(r).toMatchObject({ok:false,motivo:"PAYLOAD_FORA_DO_CONTRATO",schema:`${tipo}@1`});
 expect(JSON.stringify(r)).not.toContain("privado");
});
it("imagem aceita laudo datado e conteúdo textual legado real do Retrato",()=>{
 expect(validarPayloadEvento("ImagingReport",{nome:"TC",dataClinica:"2026-10-05",fraseLaudo:"Resposta descrita"}).ok).toBe(true);
 expect(validarPayloadEvento("ImagingReport",{textoLaudo:"Lesão indeterminada",achados:{incerto:true}}).ok).toBe(true);
 expect(validarPayloadEvento("ExameLaudo",{nome:"Exame sintético",dataClinica:"2026-10-05",fraseLaudo:"Laudo sintético"}).ok).toBe(true);
 expect(validarPayloadEvento("ExameLaudo",{dataClinica:"2026-10-05",nome:"Sem laudo"}).ok).toBe(false);
});
it("cirurgia e RT aceitam o formato consumido pelo histórico com lacunas explícitas",()=>{
 const cirurgia={tipo:"CIRURGIA",id:"original",data:"2026-08-01",procedimento:"Colectomia",observacao:null};
 const rt={tipo:"RT",id:"original-rt",inicio:"2026-09-01",fim:null,fracoes:null,doseTotalGy:null,boost:null,topografia:null,medicoResponsavel:null,local:null,observacao:null};
 for(const tipo of ["Surgery","FatoCirurgia"])expect(validarPayloadEvento(tipo,cirurgia).ok).toBe(true);
 for(const tipo of ["Radiotherapy","FatoRadioterapia","FatoRT"])expect(validarPayloadEvento(tipo,rt).ok).toBe(true);
 expect(validarPayloadEvento("Radiotherapy",{...rt,fim:"2026-08-01"}).ok).toBe(false);
});
const alvo={codigo:"L1",tipo:"NAO_NODAL",eixo:"MAIOR",orgaoId:"orgao-sintetico",elegibilidadeBasal:"ELEGIVEL",fonteElegibilidadeIds:["fonte-elegibilidade"]};
const ponto={eventId:"baseline",patientId:"p",tumorLotId:"l",episodioId:"ep",data:"2026-01-01",metodo:"TC",tecnicaId:"tc",espessuraCorteMm:5,qualidadeMedicao:"ADEQUADA",lesoes:[{codigo:"L1",diametroMm:20,fonteIds:["fonte-medida"],unidadeOriginal:"cm",valorOriginal:2}],novasLesoes:false,naoAlvos:"AUSENTE_DOCUMENTADO",fonteIds:["fonte-laudo"]};
const serie={patientId:"p",tumorLotId:"l",episodioId:"ep",baselineEventId:"baseline",alvos:[alvo],pontos:[ponto]};
it("RECIST valida estrutura interna e conserva unidades originais opcionais",()=>{
 expect(validarPayloadEvento("RecistSerie",serie).ok).toBe(true);
 expect(validarPayloadEvento("RecistSerie",{...serie,pontos:[{arbitrario:true}]}).ok).toBe(false);
 expect(validarPayloadEvento("RecistSerie",{...serie,alvos:[{arbitrario:true}]}).ok).toBe(false);
 expect(validarPayloadEvento("RecistSerie",{...serie,pontos:[{...ponto,metodo:"inventado"}]}).ok).toBe(false);
});
