import { expect,it } from "vitest";
import { comporDocumentosAtendimentoV6 } from "../../../src/modules/documentos/atendimentoV6.js";
import { BaseAtendimentoV6 } from "../../../src/contracts/api/atendimentoV6.js";
const antiga={eventId:"antigo",revisao:"r1"},nova={eventId:"novo",revisao:"r2"};
const base=BaseAtendimentoV6.parse({revisao:"a".repeat(64),pacienteNome:"Paciente Sintético",dataReferencia:"2026-10-12",recuperadoEm:"2026-10-24T12:00:00Z",
 citacoes:[{texto:"Exame anterior documentado.",referencias:[{ref:antiga,tempoClinico:"2026-09-01",tempoRegistro:"2026-09-02T12:00:00Z",unidade:null,fontes:[]}]},
 {texto:"Novo resultado documentado.",referencias:[{ref:nova,tempoClinico:"2026-10-10",tempoRegistro:"2026-10-11T12:00:00Z",unidade:null,fontes:[]}]}],
 delta:{encounterAnteriorId:"consulta-anterior",novos:[nova],substituidos:[]},integridade:[]});
it("mudanças mostram somente diferenças demonstradas; declaração atual mantém a data do encontro histórico",()=>{
 const docs=comporDocumentosAtendimentoV6(base,{hoje:"Sem mudanças no sintoma apresentado.",decisao:"Decisão sintética explícita.",saidas:["RESUMO","EVOLUCAO"]});
 const resumo=docs[0]!.texto,delta=resumo.split("MUDOU\n")[1]!;
 expect(delta).toContain("Novo resultado documentado.");expect(delta).not.toContain("Exame anterior documentado.");
 expect(resumo).toContain("para 2026-10-12");expect(resumo).not.toContain("para 2026-10-24");
 expect(docs[1]!.texto).toContain("Exame físico de hoje não acrescentado automaticamente.");
 expect(docs[1]!.texto).not.toContain("Exame físico normal");
});
it("substituição sem contraste clínico completo permanece pendência explícita nos documentos",()=>{
 const docs=comporDocumentosAtendimentoV6({...base,delta:{...base.delta,substituidos:[antiga]}},{hoje:"",decisao:"Decisão sintética",saidas:["RESUMO","EVOLUCAO"]});
 expect(docs.every(d=>d.estado==="PENDENTE")).toBe(true);
 expect(docs[0]!.pendencias).toContain("Há referências substituídas; conferir o contraste com o histórico antes de concluir a revisão.");
});
