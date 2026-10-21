import {expect,it} from "vitest";
import {diferencaDiasCivis} from "../../src/rules/datas.js";
import {validadeHemograma} from "../../src/rules/validade.js";
import {validadeHemograma as validadeTriagem} from "../../src/rules/triagem.js";
import {avisoIntervaloPosQt} from "../../src/rules/prazos.js";
import {avaliarPeso} from "../../src/rules/peso.js";
import {salaoRuleset,prazosRuleset} from "../fixtures/rulesets.js";
it.each(["2026-02-30","2026-13-01","2026-2-01","2026-01-01T12:00:00Z",""])("data civil invalida %s nao normaliza nem libera hemograma",data=>{
 expect(diferencaDiasCivis(data,"2026-03-02")).toBeNull();
 expect(validadeHemograma(data,"2026-03-02",salaoRuleset).estado).toBe("PENDENTE");
 expect(validadeTriagem(data,"2026-03-02",salaoRuleset).estado).toBe("PENDENTE");
 expect(avisoIntervaloPosQt(data,"2026-03-02","CIRURGIA",prazosRuleset).estado).toBe("PENDENTE");
 expect(avaliarPeso([{data,kg:70,origem:"MEDIDO"},{data:"2026-03-02",kg:70,origem:"MEDIDO"}],"2026-03-02",salaoRuleset).estado).toBe("PENDENTE");
});
it("datas validas preservam diferenca e anos menores que 100",()=>{
 expect(diferencaDiasCivis("2024-02-29","2024-03-01")).toBe(1);
 expect(diferencaDiasCivis("0099-12-31","0100-01-01")).toBe(1);
});
