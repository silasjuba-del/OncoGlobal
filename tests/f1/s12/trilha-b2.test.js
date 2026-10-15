import { expect, it } from "vitest";
import { conferirTrilhaB2 } from "./browser-b2.js";
const esperado = { templateId:"fixture-b2",versao:"1.0.0",hash:"a".repeat(64) };
it("trilha aceita somente identidade, versão e hash realmente recebidos",()=>{
  expect(conferirTrilhaB2({...esperado}, esperado)).toEqual(esperado);
  for (const campo of ["templateId","versao","hash"]) {
    const ausente={...esperado};delete ausente[campo];
    expect(()=>conferirTrilhaB2(ausente,esperado)).toThrow("TRILHA_AUSENTE_OU_DIVERGENTE");
    expect(()=>conferirTrilhaB2({...esperado,[campo]:"adulterado"},esperado)).toThrow("TRILHA_AUSENTE_OU_DIVERGENTE");
  }
  expect(()=>conferirTrilhaB2(null,esperado)).toThrow("TRILHA_AUSENTE_OU_DIVERGENTE");
});
