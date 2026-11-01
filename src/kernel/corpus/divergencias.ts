import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { CorpusDivergencias } from "../../contracts/divergencia.js";

export function carregarDivergenciasMama() {
  const bytes = readFileSync(new URL("../../../corpus/divergencias/mama-e-transversais.v1.json", import.meta.url));
  return { corpus: CorpusDivergencias.parse(JSON.parse(bytes.toString("utf8"))),
    corpusHash: createHash("sha256").update(bytes).digest("hex") };
}
