import { presente } from "../fixtures/triagem.js";
import { expect, it } from "vitest";
import { entradaRevisaoDoRetrato } from "../../src/modules/consulta/entradaRevisao.js";
import { montarTelaRevisao } from "../../src/modules/consulta/telaRevisao.js";
import { fato, retrato } from "./fixtures.js";
it("a revisão recebe intenção, linha, cirurgia e biomarcadores com fonte, além da antropometria", () => {
  const r = entradaRevisaoDoRetrato(retrato([
    fato("intencao", "NEOADJUVANTE"), fato("linha", 1), fato("cirurgiaRealizada", false),
    fato("extracao.biomarker:EGFR", { value: "não detectado" }), fato("pesoKg", 70, { dados: { campo: "pesoKg", valor: 70, origem: "MEDIDO" } }), fato("alturaCm", 170),
    fato("dataDiagnosticoAP", "2026-10-01"), fato("dataInicioTratamento", "2026-10-15"),
  ]));
  const tela = montarTelaRevisao(r.entrada);
  expect(tela.identidade.intencao.valor).toBe("NEOADJUVANTE"); expect(tela.identidade.linha.valor).toBe(1);
  expect(tela.identidade.cirurgia.estado).toBe("AUSENTE_CONFIRMADO");
  expect(tela.identidade.biomarcadores.itens[0]?.resultado).toBe("não detectado");
  expect(tela.identidade.datasSUS.diasDecorridos.valor).toBe(14);
  expect(tela.aptidaoHoje.antropometria.sc.valor).toBe(1.82);
});
it("fato negado, incerto, de outro paciente, futuro ou conflitante nunca preenche a revisão", () => {
  const f = fato("linha", 1);
  for (const alterado of [
    { ...f, dados: { ...f.dados, negated: true } }, { ...f, dados: { ...f.dados, requiresConfirmation: true } },
    { ...f, patientId: "outro-paciente" }, { ...f, tempoClinico: "2030-01-01" }, { ...f, fontes: [] },
  ]) expect(montarTelaRevisao(entradaRevisaoDoRetrato(retrato([alterado])).entrada).identidade.linha.estado).toBe("NAO_INFORMADO");
  const conflito = entradaRevisaoDoRetrato(retrato([f, fato("linha", 2, { ref: { eventId: "outro-evento", revisao: "1" } })]));
  expect(conflito.pendencias.join(" ")).toContain("A CONFERIR"); expect(conflito.entrada.linha).toBeUndefined();
});
it("bioquímica sem unidade não se transforma em creatinina mg/dL", () => {
  const r = entradaRevisaoDoRetrato(retrato([fato("extracao.lab:CR", { value: 88, unit: "µmol/L" })]));
  expect(r.entrada.creatininaMgDl).toBeUndefined();
  expect(r.entrada.labs?.[0]?.valor).toBe("88 µmol/L");
});

it("registro sem data não é descartado para eleger silenciosamente um valor antigo", () => {
 const r=entradaRevisaoDoRetrato(retrato([fato("linha",1),fato("linha",2,{tempoClinico:null,ref:{eventId:"sem-data",revisao:"1"}})]));
 expect(r.entrada.linha).toBeUndefined();expect(r.pendencias.join(" ")).toContain("A CONFERIR");
});

it('[pre-merge] datas de início divergentes conservam conflito e fontes',()=>{
 const r0=retrato();const ep=fato('episodio',null,{tipo:'TreatmentEpisode',campo:null,dados:{episodioId:'ep-sintetico',tumorLotId:r0.tumorLotId,modalidade:'QT',intencao:'PALIATIVA',intentModifier:null,linha:1,esquemaId:'esquema-sintetico',inicio:presente('2026-10-10'),fim:presente('2026-10-16')}});
 const r=entradaRevisaoDoRetrato(retrato([ep,fato('dataDiagnosticoAP','2026-10-01'),fato('dataInicioTratamento','2026-10-15')]));
 expect(r.entrada.dataInicioTratamento).toBeUndefined();expect(r.pendencias.join(' ')).toContain('A CONFERIR');
 expect(r.pendencias.join(' ')).toContain('2026-10-10');expect(r.pendencias.join(' ')).toContain('2026-10-15');
 expect(montarTelaRevisao(r.entrada).identidade.datasSUS.diasDecorridos.valor).toBeNull();
});
