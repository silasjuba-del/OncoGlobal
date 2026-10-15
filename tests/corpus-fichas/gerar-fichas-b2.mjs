// F1-B2 · Gerador ADITIVO das fichas institucionais novas (D-F1-49: sem SISAC, fontes externas verificadas).
// Uso: node tests/corpus-fichas/gerar-fichas-b2.mjs
// Escreve APENAS as fichas novas listadas (nunca apaga as existentes; o gerador histórico gerar-fichas.mjs
// está congelado — as edições B1 vivem no corpus com manifesto próprio e regenerá-lo as apagaria).
// Também: acrescenta as fontes externas às 6 fichas de paclitaxel semanal (D-F1-28/D-F1-49) e gera
// corpus/manifesto/b2-fichas.v1.json (proveniência por campo, localizador estável = droga+dias).
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
// hashDe copiado de gerar-fichas.mjs (INT-FICHAS congelado): importar dali executaria o gerador
// antigo (efeitos no topo do módulo) e apagaria as edições B1 que vivem no corpus.
function canonico(v) {
  if (Array.isArray(v)) return `[${v.map(canonico).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonico(v[k])}`).join(",")}}`;
  return JSON.stringify(v);
}
const hashDe = (t) => { const { hash: _h, status: _s, ...resto } = t; return createHash("sha256").update(canonico(resto), "utf8").digest("hex"); };

const RAIZ = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SAIDA = join(RAIZ, "corpus", "fichas");
const VERSAO = "1.0.0";
const ACESSO = "2026-10-14"; // data de acesso das fontes externas (relatórios em f1-b2-fontes-externas)

// ---------- construtores (copiados de gerar-fichas.mjs — INT-FICHAS congelado) ----------
const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const UN = { m2: ["MG_M2", "mg/m²"], mg: ["FIXED", "mg"], auc: ["AUC", "AUC"], ugkg: ["MCG_KG", "µg/kg"], mgkg: ["MG_KG", "mg/kg"], fr: ["FIXED", "frasco"], ml: ["FIXED", "mL"] };
function it(drug, classe, dose, un, route, days, o = {}) {
  const [doseBasis, unit] = UN[un];
  return { drug, classe, sequence: 0, standardDose: dose, doseBasis, calculatedDose: null, prescribedDose: null, unit,
    adjustmentPercent: null, adjustmentReason: null, route, diluent: o.dil ?? null, finalVolumeMl: o.vol ?? null,
    infusionTime: o.t ?? null, days, observacao: o.obs ?? null, source: "PROTOCOL", overrideMotivo: null,
    ...(o.maxMg !== undefined ? { doseMaximaMg: o.maxMg } : {}),
    ...(o.maxMgMin !== undefined ? { taxaMaximaMgMin: o.maxMgMin } : {}),
    ...(o.resgateMtx ? { resgateMtx: o.resgateMtx } : {}) };
}
const qt = (drug, dose, un, days, o = {}) => it(drug, "QT", dose, un, o.route ?? "EV", days, o);
const D = (...n) => n.map((x) => `d${x}`);
const R = (a, b) => [`d${a}-d${b}`];
const CIS = (dose, days, o = {}) => ({ cis: true, dose, days, obsCis: o.obs ?? null, dil: o.dil ?? null, vol: o.vol ?? null, t: o.t ?? "60 min" });
function montar(s) {
  const itens = []; const pos = [];
  const temIV = !s.semPremed;
  const taxano = s.itens.some((i) => i.drug && /paclitaxel|docetaxel/i.test(i.drug));
  const diasTaxano = taxano ? s.itens.find((i) => /paclitaxel|docetaxel/i.test(i.drug ?? "")).days : null;
  const pd = [...new Set(s.itens.filter(i => i.cis || (i.classe === "QT" && i.route === "EV"
    && !/folinato|mesna/i.test(i.drug))).flatMap(i => i.days).flatMap(dia => {
      const r = /^d(\d+)-d(\d+)$/.exec(dia);
      return r ? Array.from({ length: Number(r[2]) - Number(r[1]) + 1 }, (_, n) => `d${Number(r[1]) + n}`) : [dia];
    }))].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  if (temIV) {
    itens.push(it("Soro fisiológico 0,9% 250 mL (lavagem de acesso)", "PRE_QT", 1, "fr", "EV", pd, { vol: 250, obs: "Lavar acesso venoso pré e pós QT (planilha)." }));
    itens.push(it("Ondansetrona", "PRE_QT", 8, "mg", "EV", pd, { t: "15 min", obs: "Padrão local (D-W9-23c/34c; D-F1-30)." }));
    itens.push(it("Dexametasona", "PRE_QT", 10, "mg", "EV", pd, { t: "15 min", obs: s.altoRisco ? "Alto risco emetogênico: olanzapina 5 mg VO opcional (D-W9-34c); sem NK1 (padrão local)." : "Antiemese local sem NK1 (D-W9-23c/34c)." }));
    itens.push(it("Prometazina", "PRE_QT", 25, "mg", "VO", pd, { obs: `Pré-medicação local (D-W9-34c).${taxano ? " 30 min antes do taxano (ficha real P1456)." : ""}` }));
    if (taxano) itens.push(it("Cimetidina", "PRE_QT", 300, "mg", "EV", diasTaxano, { t: "15 min", obs: "Todo taxano (D-W9-34c; D-F1-48: fixa — só P1399/P1426 são 'se necessário')." }));
  }
  for (const x of s.itens) {
    if (!x.cis) { itens.push(x); continue; }
    itens.push(it("Soro fisiológico 0,9% 500 mL (pré-cisplatina)", "PRE_QT", 1, "fr", "EV", x.days, { vol: 500, t: "20 min", obs: "Correr aberto antes da cisplatina (padrão local)." }));
    itens.push(it("Sulfato de magnésio 10% 10 mL", "PRE_QT", 10, "ml", "EV", x.days, { obs: "Aditivo da bolsa pré-cisplatina, em cada dia de cisplatina (D-W9-34d)." }));
    itens.push(it("Cloreto de potássio 19,1% 4 mL", "PRE_QT", 4, "ml", "EV", x.days, { obs: "Aditivo da bolsa pré-cisplatina, em cada dia de cisplatina (D-W9-34d)." }));
    itens.push(qt("Cisplatina", x.dose, "m2", x.days, { t: x.t, maxMgMin: 1, dil: x.dil, vol: x.vol, obs: `${x.obsCis ? x.obsCis + " " : ""}Taxa máxima 1 mg/min (padrão local das fichas reais); duração calculada nunca inferior ao tempo da fonte.` }));
    itens.push(qt("Manitol 20% frasco 250 mL", 1, "fr", x.days, { vol: 250, t: "60 min", obs: "Correr em Y com a cisplatina (padrão local)." }));
    pos.push(it("Soro fisiológico 0,9% 500 mL (pós-cisplatina)", "POS_QT", 1, "fr", "EV", x.days, { vol: 500, t: "20 min", obs: "Correr aberto após a cisplatina." }));
    pos.push(it("Cloreto de potássio 19,1% 4 mL", "POS_QT", 4, "ml", "EV", x.days, { obs: "Aditivo da bolsa pós-cisplatina (D-W9-34d)." }));
  }
  itens.push(...(s.posQt ?? []));
  itens.push(...pos);
  if (temIV) itens.push(it("Soro fisiológico 0,9% 250 mL (lavagem pós-QT)", "POS_QT", 1, "fr", "EV", pd, { vol: 250, obs: "Lavar acesso venoso pós-QT (planilha)." }));
  const finais = itens.map((x, i) => ({ ...x, sequence: i + 1 }));
  const baseId = s.slug ?? `${slug(s.nome)}__${slug(s.cenario)}`;
  const t = {
    templateId: `FICHA.${slug(s.tumor)}.${baseId}@${VERSAO}`,
    tumor: s.tumor, nome: s.nome, cenario: s.cenario, versao: VERSAO, hash: "",
    codigoInstitucional: s.codigo ?? null, intervaloDias: s.intervalo ?? null, ciclos: s.ciclos ?? null,
    itens: finais, limiaresBula: null, fonte: s.fonteDecisao, status: "RASCUNHO",
  };
  t.hash = hashDe(t);
  return { t, tumorSlug: slug(s.tumor), arquivo: `${baseId}.json` };
}

// ---------- fontes externas F1-B2 (relatórios e bytes: C:\...\2026-10-14\f1-b2-fontes-externas\{legado,sarcomas,cec-ntg-vulva,cup}) ----------
const EXT = {
  "EXT-LEG-001": { instituicao: "eviQ (Cancer Institute NSW)", titulo: "ID 1494 — Colorectal cancer adjuvant QUASAR weekly fluorouracil and folinic acid", url: "https://www.eviq.org.au/medical-oncology/colorectal/adjuvant/1494", versao: "v7", sha256: "15ccde66d16d4b3ac1e5f10664fa3ff1cd61e55563eb619b9623e934b677d147" },
  "EXT-LEG-002": { instituicao: "eviQ", titulo: "ID 98 — Colorectal cancer metastatic QUASAR weekly fluorouracil and folinic acid", url: "https://www.eviq.org.au/medical-oncology/colorectal/metastatic/98", versao: "v6", sha256: "0a2a3029662023f6764e6eb2c11b8f5287db288e21c25b38b6c1a3e99d3b83bf" },
  "EXT-LEG-004": { instituicao: "eviQ", titulo: "ID 1271 — Colorectal cancer adjuvant Roswell Park", url: "https://www.eviq.org.au/medical-oncology/colorectal/adjuvant/1271", versao: "v6", sha256: "ffef9ab7f139fb875d2217de532aaccc693bd438d9fe152dff8d9162226f1df7" },
  "EXT-LEG-005": { instituicao: "eviQ", titulo: "ID 1275 — Colorectal cancer metastatic Roswell Park", url: "https://www.eviq.org.au/medical-oncology/colorectal/metastatic/1275", versao: "v5", sha256: "19f7c18e533ac307c2e020a40030188f170d467a1f80eb624420854c2af647ab" },
  "EXT-LEG-006": { instituicao: "eviQ", titulo: "ID 79 — Colorectal cancer adjuvant Mayo Clinic (DESCONTINUADO)", url: "https://www.eviq.org.au/medical-oncology/colorectal/adjuvant/79", versao: "v3 (descontinuado)", sha256: "5c8eb97d75f04ff5844036416df75f0191fe92454ee9fe42e7dbe7d29e4a7c86" },
  "EXT-LEG-008": { instituicao: "eviQ", titulo: "ID 4103 — Breast cancer neo/adjuvant weekly paclitaxel", url: "https://www.eviq.org.au/medical-oncology/breast/neo-adjuvant/4103", versao: "v3", sha256: "87ae596953be152a84493a54488bee595c7f9fdd842ff6e72a3b7802e9c78269" },
  "EXT-LEG-009": { instituicao: "eviQ", titulo: "ID 42 — Breast cancer metastatic weekly paclitaxel", url: "https://www.eviq.org.au/medical-oncology/breast/metastatic/42", versao: "v10", sha256: "dbfe03a1cafd9609f58a62c65f4016165189dc5f4adbc889c811990da69b9932" },
  "EXT-LEG-012": { instituicao: "BC Cancer", titulo: "BRAVTW — Paclitaxel weekly (palliative)", url: "https://www.bccancer.bc.ca/chemotherapy-protocols-site/Documents/Breast/BRAVTW_Protocol.pdf", versao: "rev 2014", sha256: "c4bb07d88e848876e0b0b5df3542c6822973c99f3279869d5afa99f3374f5ea3" },
  "EXT-LEG-019": { instituicao: "Northern Cancer Alliance (NHS, Reino Unido)", titulo: "CR004 v1.4 — Weekly 5-Fluorouracil and Folinic Acid (CRP09)", url: "https://www.northerncanceralliance.nhs.uk/wp-content/uploads/2018/11/CR0045FU-Folinic-Acid-Weekly-CRP09-CR004-v1.4.pdf", versao: "v1.4", sha256: "bce06e52a9e212af45a707ad384f423059d6e4f80f8790762ad37e10266d5b6a" },
  "EXT-LEG-013": { instituicao: "BC Cancer", titulo: "Monografia — Paclitaxel", url: "https://www.bccancer.bc.ca/chemotherapy-protocols-site/Documents/Referral%20Forms%20for%20Chemotherapy%20Protocols/Paclitaxel-monograph.pdf", versao: "rev 30/12/2019", sha256: "309ea2204ac554704cf2c2c01bd8aa7869eab5283c62f9d0105e906a4bfc14cd" },
  "EXT-CUP-001": { instituicao: "Annals of Oncology (Minnie Pearl Network — Greco FA et al.)", titulo: "Carcinoma of unknown primary site: phase II trials with docetaxel plus cisplatin or carboplatin (Ann Oncol 2000;11(2):211-5)", url: "https://pubmed.ncbi.nlm.nih.gov/10761758/", versao: "PMID 10761758", sha256: "ee44761328d239808081378acb84a7ad22276147f56bd4f424fea13ebaabafce" },
  "EXT-CUP-003": { instituicao: "Am J Clin Oncol (Mukai H et al.)", titulo: "Safety and efficacy of docetaxel and cisplatin in unknown primary cancer (Am J Clin Oncol 2010;33(1):32-5)", url: "https://pubmed.ncbi.nlm.nih.gov/19786850/", versao: "PMID 19786850", sha256: "0397ebfcc446642090d14de9332de34ce7007e9c04cfa042fee0e3fbc67f354b" },
  "EXT-CUP-004": { instituicao: "BC Cancer", titulo: "PUCAT — Primary Treatment of Cancer of Unknown Primary using CARBOplatin and PACLitaxel", url: "https://www.bccancer.bc.ca/chemotherapy-protocols-site/Documents/Primary%20Unknown/PUCAT_Protocol.pdf", versao: "rev 01/12/2024", sha256: "f3a066472ea44a28619640bf2126c777fbef3509408e3f42a6970035ab1745f6" },
  "EXT-CUP-006": { instituicao: "J Clin Oncol (HeCOG — Briasoulis E et al.)", titulo: "Carboplatin plus paclitaxel in unknown primary carcinoma: phase II (JCO 2000;18(17):3101-7)", url: "https://pubmed.ncbi.nlm.nih.gov/10963638/", versao: "PMID 10963638", sha256: "ee6c095b3baad07c2699308fe5b9ce038441daeeae0fed87773fb81b8ba620a1" },
  "EXT-CUP-009": { instituicao: "Cancer (Pouessel D et al.)", titulo: "Gemcitabine and docetaxel as front-line chemotherapy in unknown primary (Cancer 2004;100(6):1257-61)", url: "https://pubmed.ncbi.nlm.nih.gov/15022294/", versao: "PMID 15022294", sha256: "38fcece6a64271f38e1ae004e5a9dd8e3c9a5ed0585df18ffa063eff673a735d" },
  "EXT-CUP-010": { instituicao: "Cancer Invest (Khansur T et al.)", titulo: "Cisplatin and 5-fluorouracil for metastatic squamous cell carcinoma from unknown primary (1995;13(3):263-6)", url: "https://pubmed.ncbi.nlm.nih.gov/7743377/", versao: "PMID 7743377", sha256: "e6cac6d4978fda5e2567dfe943a5726b820fb52fbcc8cf797c6f70605f30d281" },
  "EXT-CUP-011": { instituicao: "eviQ", titulo: "ID 288 — Head and neck SCC recurrent/metastatic ciSplatin and fluorouracil", url: "https://www.eviq.org.au/medical-oncology/head-and-neck/recurrent-or-metastatic/288", versao: "v5", sha256: "e4363157a12d8c03a9a7cafd5783b1f3b2a7bb26fc93a0eff16b86ce8a23727e" },
  "EXT-CUP-012": { instituicao: "Cancer (Palmeri S et al.)", titulo: "Cisplatin and gemcitabine with either vinorelbine or paclitaxel in CUP — TRIPLA (contexto/negação da dupla)", url: "https://pubmed.ncbi.nlm.nih.gov/17109447/", versao: "PMID 17109447", sha256: "1305f0ed4e7b0ad44586bf81231c45f97794761128ee7e5bfeb5276055dcbfab" },
  "EXT-CUP-016": { instituicao: "NCI (EUA)", titulo: "PDQ — Cancer of Unknown Primary Treatment (HP version)", url: "https://www.cancer.gov/types/unknown-primary/hp/unknown-primary-treatment-pdq", versao: "acesso 2026-10-14", sha256: "a2421ac280a1f922f92a65e5d621d3a7a50328ff9615e6afd18f8d89eef87b0e" },
  "EXT-SARC-001": { instituicao: "eviQ", titulo: "ID 3464 — Ewing sarcoma VDC/IE overview", url: "https://www.eviq.org.au/medical-oncology/sarcoma/bone-sarcoma/3464-ewing-sarcoma-vdc-ie-overview", versao: "v2 (review due 31/12/2026)", sha256: "53f7ba21100c67863026611c4d60947dbd61f7376afd975f13bf99748d38ff76" },
  "EXT-SARC-002": { instituicao: "eviQ", titulo: "ID 1916 — Ewing sarcoma VDC (part 1)", url: "https://www.eviq.org.au/medical-oncology/sarcoma/bone-sarcoma/1916-ewing-sarcoma-vdc-vincristine-doxorubicin", versao: "v8 (PDF v6 conferido)", sha256: "8983c9377e81a2d6820716f6e2ce15135df0eb7217bd8cb5fe4cde5765101f8a" },
  "EXT-SARC-003": { instituicao: "eviQ", titulo: "ID 3465 — Ewing sarcoma IE (part 2)", url: "https://www.eviq.org.au/medical-oncology/sarcoma/bone-sarcoma/3465-ewing-sarcoma-ie-ifosfamide-and-etoposide", versao: "v8 (PDF v5 conferido)", sha256: "483b41b9432901f6eca983da4dfa77503c6b49bb7cfd3aadf78f59b5c4d087bf" },
  "EXT-SARC-004": { instituicao: "eviQ", titulo: "ID 1901 — Osteosarcoma MAP", url: "https://www.eviq.org.au/medical-oncology/sarcoma/bone-sarcoma/1901-osteosarcoma-map-methotrexate-doxorubicin", versao: "v6 (PDF v5 conferido)", sha256: "df945221c9a78b4dfedfb6241007f36ce825f66e33a6eb525eb98bbcb7cff0c9" },
  "EXT-SARC-008": { instituicao: "eviQ", titulo: "ID 5066 — Tumour-agnostic advanced or metastatic pembrolizumab", url: "https://www.eviq.org.au/p/5066", versao: "v1 (acesso 2026-10-14)", sha256: "8f0d7dc3d23e5238b7f352e3f231f791b612f491cd6bfd562bbe79c19b3c5fd2" },
  "EXT-SARC-009": { instituicao: "BC Cancer", titulo: "SAALT2W — Ewing/EFT interval-compressed (2-week) alternation com filgrastim", url: "https://www.bccancer.bc.ca/chemotherapy-protocols-site/Documents/Sarcoma/SAALT2W_Protocol.pdf", versao: "rev 01/08/2026", sha256: "a3667f35a67bf51f4ea4536ea5fbfb228be85a7a8c6e9b393fae96fc444159c3" },
  "EXT-SARC-014": { instituicao: "BC Cancer", titulo: "SANAHDMAP — Osteosarcoma high-dose MTX + DOXOrubicin + CISplatin", url: "https://www.bccancer.bc.ca/chemotherapy-protocols-site/Documents/Sarcoma/SANAHDMAP_Protocol.pdf", versao: "rev 01/06/2026", sha256: "d9f85193d1184934d8d9b6cbd8382cc70144f8f4dd7ff88525cfd5218e33d214" },
  "EXT-SARC-015": { instituicao: "BC Cancer", titulo: "SAAVAP — Advanced osteosarcoma DOXOrubicin + CISplatin", url: "https://www.bccancer.bc.ca/chemotherapy-protocols-site/Documents/Sarcoma/SAAVAP_Protocol.pdf", versao: "rev 01/03/2022", sha256: "0215e9ba4f7ef5516e3474f4f7df2e2034e0c171078edcb19a7bf248787f5f3e" },
  "EXT-SARC-022": { instituicao: "J Clin Oncol (Womer RB et al. — AEWS0031)", titulo: "Interval-compressed chemotherapy for Ewing sarcoma (JCO 2012;30(33):4148-54)", url: "https://pubmed.ncbi.nlm.nih.gov/23091096/", versao: "PMID 23091096", sha256: "8861d1b15f22327329dd4b7e27482c825da556437bf39597b28830d4d6407a91" },
  "EXT-CNV-001": { instituicao: "eviQ", titulo: "ID 4151 — Cemiplimab monotherapy", url: "https://www.eviq.org.au/medical-oncology/skin/locally-advanced-or-metastatic-cutaneous-squamous-cell-carcinoma/4151", versao: "v5 (review due 31/12/2028)", sha256: "c006e4a23668402ff16cecbd7331b7167f04e2205a037126d557d46434b352fa" },
  "EXT-CNV-008": { instituicao: "eviQ", titulo: "ID 3579 — Head and neck SCC recurrent/metastatic CARBOplatin and PACLitaxel", url: "https://www.eviq.org.au/medical-oncology/head-and-neck/recurrent-or-metastatic/3579", versao: "acesso 2026-10-14", sha256: "4bc8230b130195125dcdc514782c8561826c9246d3272de834b2c18d5ce90313" },
  "EXT-CNV-016": { instituicao: "eviQ", titulo: "ID 292 — Head and neck locally advanced ciSplatin weekly with radiation therapy", url: "https://www.eviq.org.au/medical-oncology/head-and-neck/locally-advanced/292", versao: "v10 (PDF v8)", sha256: "1ade96c5a45617c0f4e7974493ae3cc2795d1ebc5a23fdbfa614d28e6d0bb8f1" },
  "EXT-CNV-021": { instituicao: "eviQ", titulo: "ID 1529 — Vulval SCC locally advanced ciPlatin (weekly) chemoradiation", url: "https://www.eviq.org.au/medical-oncology/gynaecological/vulval/locally-advanced/1529", versao: "v9 (11/02/2026; PDF v6 arquivado)", sha256: "001b974eb8c1d2fca26af44972e07f9a1f7952f7a7922f1ebf53738e3dfb6a3a" },
  "EXT-CNV-023": { instituicao: "BC Cancer", titulo: "GOCXCRT — Gynecologic locally advanced CISplatin weekly ×5 com RT (inclui vulva)", url: "https://www.bccancer.bc.ca/chemotherapy-protocols-site/Documents/Gynecology/GOCXCRT_Protocol.pdf", versao: "rev 01/08/2026", sha256: "c1d840871c5d654fd8b799b720e46756a2a6aa52bce3a683001616302a77d695" },
  "EXT-CNV-024": { instituicao: "BC Cancer", titulo: "GOCXCAT — Gynecologic CARBOplatin + PACLitaxel (inclui vulva)", url: "https://www.bccancer.bc.ca/chemotherapy-protocols-site/Documents/Gynecology/GOCXCAT_Protocol.pdf", versao: "rev 01/10/2025", sha256: "03ddeed2cc303dd05cba344c300d44662b5a80fb6a49fdedd8ee58240a064fb3" },
  "EXT-CNV-026": { instituicao: "eviQ", titulo: "ID 668 — Gestational trophoblastic neoplasia low risk methotrexate and folinic acid", url: "https://www.eviq.org.au/medical-oncology/gynaecological/gestational-trophoblastic/668", versao: "v4 (PDF v3)", sha256: "b66fbb8a28ce0787bee9788607f8dde30ac21673186ccac4f4ac6ae6633e3101" },
  "EXT-CNV-027": { instituicao: "eviQ", titulo: "ID 1018 — GTN low risk dactinomycin", url: "https://www.eviq.org.au/medical-oncology/gynaecological/gestational-trophoblastic/1018", versao: "acesso 2026-10-14", sha256: "e1d1ecd154c78a588baf362e03df95449c366334369e325ce9dfef0fdc7de613" },
  "EXT-CNV-028": { instituicao: "eviQ", titulo: "ID 599 — GTN high risk EMA-CO", url: "https://www.eviq.org.au/medical-oncology/gynaecological/gestational-trophoblastic/599", versao: "v8 (PDF v5)", sha256: "aa5e8ebebdd5a27279a6fefcb4790c5625f4c12c64498a8f2c5f49a2b72c2acf" },
  "EXT-CNV-029": { instituicao: "eviQ", titulo: "ID 1378 — GTN EP-EMA (equivalente operacional do EMA/EP)", url: "https://www.eviq.org.au/medical-oncology/gynaecological/gestational-trophoblastic/1378", versao: "v8 (PDF v5)", sha256: "1d2de6226e37f9df6f1b42ec5af664c0ff6967fcbd2f122e84ff8f8bdc63148e" },
  "EXT-CNV-030": { instituicao: "eviQ", titulo: "ID 1347 — GTN low dose EP (indução, escore alto/ultra-alto)", url: "https://www.eviq.org.au/medical-oncology/gynaecological/gestational-trophoblastic/1347", versao: "v5 (PDF v2)", sha256: "3e0e8bcb23e649e4e8ac9a257143e4120f3e8b08c43006dabb896730fed7b9d0" },
  "EXT-CNV-031": { instituicao: "J Clin Oncol (Lok C et al. — EOTTD/ESGO/ISSTD/GCIG)", titulo: "Practical Guidelines for the Treatment of Gestational Trophoblastic Disease (JCO 2025;43(18); DOI 10.1200/JCO-24-02326) — Tabela A5 e Figura A4", url: "https://doi.org/10.1200/JCO-24-02326", versao: "2025 (pós-print ORBi 2268/340461)", sha256: "c2ed13a3f7081dc4ef89aac4d7f434b021733072243e913f61ccf0ac25d57f6a" },
};
// Materiais locais recebidos (PDFs já inventariados com hash em f1-auditoria-fontes/conferencia-pdf/inventario.json)
const LOC = {
  "LOC-SBOC-OSSEOS": { instituicao: "SBOC", titulo: "Diretrizes SBOC 2026 — Sarcomas Ósseos v5 (VERSÃO PARA COLABORAÇÃO)", localizador: "p. 12 (MAP e AP); p. 14–15 (recidivas)", sha256: "592a805c7def2610ee6559bdd32b634ddb33659194dab482423414f6e75e6295" },
  "LOC-SONHE": { instituicao: "SOnHe", titulo: "Protocolos SOnHe 2024", localizador: "p. 313–318 (sarcomas); p. 89–91 (vulva); p. 236–238 (CEC pele); p. 314/317 (Ewing institucional)", sha256: "d201d11819acaf92a019bba22733abd55356012bce60b147728bfe4a5575d71d" },
};
// O sha256 INTEIRO vive no manifesto b2-fichas.v1.json; prefixos de 12 hex no texto das fichas geram
// runs >=7 digitos que a exportacao publica trata como SEQUENCIA_NUMERICA_LONGA (nao mascarada).
const ref = (ids) => ids.map((id) => EXT[id] ? `${id} (${EXT[id].instituicao}, ${EXT[id].titulo}, ${EXT[id].versao}, acesso ${ACESSO}; sha256 integro em corpus/manifesto/b2-fichas.v1.json)` : `${id} (${LOC[id].instituicao}, ${LOC[id].titulo}, ${LOC[id].localizador})`).join("; ");

const CAMPOS = (s) => s; // marcador de leitura

// ---------- fichas B2 ----------
const NE = "não especificado";
const FICHAS = [];
const F = (spec) => FICHAS.push(spec);

// ===== LEGADO (D-F1-26/27/49) =====
F({ tumor: "Não informado (ficha institucional)", nome: "Folinato + 5-FU semanal (P1577)", cenario: NE, codigo: "P1577", intervalo: 7, ciclos: null,
  identidade: "Folinato 20 mg/m² + 5-FU 425 mg/m² semanais IV bolus (D-F1-26 + D-F1-50; NHS CR004 casa exatamente com a identidade); dias locais D1–D36 (D-F1-26)",
  fontesItens: { "Folinato de cálcio (leucovorina)": { sourceIds: ["EXT-LEG-019"], decisaoLocal: "D-F1-26 (folinato 20 mg/m² semanal); CR004 corrobora 20 mg/m² IV bolus" }, "Fluoruracila (5-FU) em bolus": { sourceIds: ["EXT-LEG-019"], decisaoLocal: "D-F1-50 (dose 425 mg/m²)" } },
  divergencias: ["QUASAR (eviQ 1494/98): folinato 50 fixa + 5-FU 370; Roswell mod. (eviQ 1271/1275): folinato 50 fixa + 5-FU 500 em ciclo 56 d — variantes NAO adotadas", "CR004 corre 30 doses semanais (30 semanas); a duracao local D1–D36 vem de D-F1-26 [extensao a definir]"],
  lacunas: ["duração total do tratamento local (CR004: 30 semanas; D-F1-26: D1–D36) [VERIFICAR]"],
  fonteDecisao: `D-F1-26 (identidade: folinato 20 + 5-FU semanal D1–D36, sem vínculo com Roswell Park); D-F1-49; D-F1-50 (dose do 5-FU = 425 mg/m²). Fonte que casa com a identidade (${ACESSO}): ${ref(["EXT-LEG-019"])} — folinato 20 mg/m² IV bolus + 5-FU 425 mg/m² IV bolus (reduzível a 370; 300 com RT), semanal. Variantes não adotadas: ${ref(["EXT-LEG-001", "EXT-LEG-004"])}.`,
  itens: [
    qt("Folinato de cálcio (leucovorina)", 20, "m2", D(1, 8, 15, 22, 29, 36), { t: "bolus", obs: "CR004 v1.4: 20 mg/m² IV bolus (slow bolus via saline drip) — corrobora a dose local D-F1-26." }),
    qt("Fluoruracila (5-FU) em bolus", 425, "m2", D(1, 8, 15, 22, 29, 36), { t: "bolus", obs: "D-F1-50 (425 mg/m², NHS CR004). CR004: reduzível a 370 (PS); 300 com RT; slow bolus via saline drip; fonte corre 30 doses semanais — duração local D1–D36 (D-F1-26) [extensão a definir]." }),
  ] });

F({ tumor: "Não informado (ficha institucional)", nome: "LV5FU2 — 5-FU + folinato (P1512)", cenario: NE, codigo: "P1512", intervalo: 14, ciclos: null,
  identidade: "LV5FU2 (de Gramont sem terceiro fármaco): folinato 200 + 5-FU 400 bolus + 5-FU 600 CI 22 h, D1–D2, q14 (D-F1-27 + D-F1-50)",
  fontesItens: {
    "Folinato de cálcio (leucovorina)": { decisaoLocal: "D-F1-50: P1512 mapeado como LV5FU2 (= FOLFOX4 sem oxaliplatina; DECISAO_MEDICA 2026-10-08 traz LV 200 mg/m² 2 h D1–D2)" },
    "Fluoruracila (5-FU) em bolus": { decisaoLocal: "D-F1-50: LV5FU2 — 400 mg/m² bolus D1–D2 (DECISAO_MEDICA 2026-10-08 FOLFOX4)" },
    "Fluoruracila (5-FU) infusão contínua": { decisaoLocal: "D-F1-50: LV5FU2 — 600 mg/m² CI 22 h D1–D2 (DECISAO_MEDICA 2026-10-08 FOLFOX4)" },
  },
  divergencias: ["eviQ 97 (de Gramont MODIFICADO) usa LV 50 fixa + 2.400 CIV 46 h — variante NAO adotada", "FLOX original (NSABP C-07) e mFLOX levam oxaliplatina — não casam com o P1512", "Mayo (D1–D5 bolus) DESCONTINUADO (eviQ 79)"],
  lacunas: [],
  fonteDecisao: `D-F1-27 (P1512 = 5-FU + folinato em D1 E D2) e D-F1-49; D-F1-50 (mapeamento como LV5FU2 — doses da DECISAO_MEDICA 2026-10-08 do FOLFOX4 sem a oxaliplatina, corroborado pelo LV5FU2 das diretrizes digestivas na rodada v2). Contexto externo: ${ref(["EXT-LEG-006", "EXT-LEG-004"])}.`,
  itens: [
    qt("Folinato de cálcio (leucovorina)", 200, "m2", D(1, 2), { t: "2 h", obs: "LV5FU2 (D-F1-50): 200 mg/m² IV 2 h em D1 e D2." }),
    qt("Fluoruracila (5-FU) em bolus", 400, "m2", D(1, 2), { t: "bolus", obs: "LV5FU2 (D-F1-50): 400 mg/m² IV bolus em D1 e D2 — bolus é o desenho do esquema (de Gramont/FOLFOX4)." }),
    qt("Fluoruracila (5-FU) infusão contínua", 600, "m2", D(1, 2), { t: "22 h", obs: "LV5FU2 (D-F1-50): 600 mg/m² CI 22 h em D1 e D2. Não é a bomba de 46 h." }),
  ] });

// ===== CUP (D-F1-36/49) =====
const CUP = "Primário desconhecido (CUP)";
F({ tumor: CUP, nome: "Cisplatina + Docetaxel", cenario: NE, intervalo: 21, ciclos: null,
  identidade: "CUP metastático, 1ª linha (D-F1-36); variante preparada: Greco 2000 75/75 q3sem",
  fontesItens: { Docetaxel: { sourceIds: ["EXT-CUP-001"] }, Cisplatina: { sourceIds: ["EXT-CUP-001"] } },
  divergencias: ["Greco 2000: docetaxel 75 + cisplatina 75 q3sem (n=26, máx 8 ciclos, toxicidade GI substancial)", "Mukai 2010: docetaxel 60 (1 h, antes) + cisplatina 80 (2 h) q3sem (n=45, ORR 65%)"],
  lacunas: ["escolha de variante (75/75 × 60/80) pendente de decisão do Dr. Silas"],
  fonteDecisao: `D-F1-36 (lista de esquemas de CUP) e D-F1-49. Variante preparada: Greco 2000 (75/75 q3sem, máx 8 ciclos). Fontes: ${ref(["EXT-CUP-001", "EXT-CUP-003"])}. Antiemese/hidratação: padrão local (D-W9-23c/34c, D-F1-30).`,
  itens: [
    qt("Docetaxel", 75, "m2", D(1), { t: "60 min", dil: "SF 0,9%", vol: 250, obs: "Greco 2000: docetaxel 75 mg/m² IV q3sem. Variante Mukai: 60 mg/m² [decisão pendente]." }),
    CIS(75, D(1), { obs: "Greco 2000: cisplatina 75 mg/m² q3sem. Variante Mukai: 80 mg/m² em 2 h." }),
  ] });

F({ tumor: CUP, nome: "Carboplatina + Paclitaxel 21/21 dias", cenario: NE, intervalo: 21, ciclos: null,
  identidade: "CUP, 1ª linha (D-F1-36); variante preparada: BC PUCAT/HeCOG (paclitaxel 200 → carbo AUC 6)",
  fontesItens: { Paclitaxel: { sourceIds: ["EXT-CUP-004", "EXT-CUP-006"] }, Carboplatina: { sourceIds: ["EXT-CUP-004", "EXT-CUP-006"] } },
  divergencias: ["BC PUCAT (rev 12/2024, único protocolo institucional específico de CUP): paclitaxel 200 mg/m² 3 h PRIMEIRO + carboplatina AUC 6", "HeCOG (JCO 2000): mesmas doses com G-CSF D5–12", "SOnHe p. 379 (material local): AUC 5 + 175 — variante alternativa [decisão pendente]"],
  lacunas: ["escolha de variante (200/AUC6 × 175/AUC5) pendente de decisão do Dr. Silas"],
  fonteDecisao: `D-F1-36 e D-F1-49. Variante preparada: PUCAT/HeCOG. Fontes: ${ref(["EXT-CUP-004", "EXT-CUP-006"])}. Variante local SOnHe (AUC 5 + 175) documentada em ${LOC["LOC-SONHE"].titulo}, p. 379 (sha256 ${LOC["LOC-SONHE"].sha256.slice(0, 12)}…). Diluente/materiais do paclitaxel: não-PVC/DEHP-free + filtro ≤0,22 µm (PUCAT).`,
  itens: [
    qt("Paclitaxel", 200, "m2", D(1), { t: "3 h", obs: "PUCAT/HeCOG: 200 mg/m² em 3 h, ADMINISTRAR PRIMEIRO (antes da carboplatina). Variante SOnHe: 175 mg/m² [decisão pendente]. Equipamento não-PVC/DEHP-free e filtro ≤0,22 µm." }),
    qt("Carboplatina", 6, "auc", D(1), { t: "60 min", obs: "Calvert AUC 6 (GFR cap 125). Variante SOnHe: AUC 5 [decisão pendente]." }),
  ] });

F({ tumor: CUP, nome: "Docetaxel + Gemcitabina", cenario: NE, intervalo: 21, ciclos: null, premedDias: D(1, 8),
  identidade: "CUP, 1ª linha (D-F1-36); variante preparada: Pouessel 2004 (gem D1/D8 + doc D8)",
  fontesItens: { Gemcitabina: { sourceIds: ["EXT-CUP-009"] }, Docetaxel: { sourceIds: ["EXT-CUP-009"] } },
  divergencias: ["Pouessel 2004 (Cancer): gemcitabina 1.000 mg/m² D1 e D8 (30 min) + docetaxel 75 mg/m² D8 (1 h); q3sem, máx 6 — corrige o mapa local (que estimava 75/900 ou 60/800 e atribuía a Hainsworth)"],
  lacunas: [],
  fonteDecisao: `D-F1-36 e D-F1-49. Fonte: ${ref(["EXT-CUP-009"])}. Correção de citação registrada: o estudo original de CUP é Pouessel 2004, não Hainsworth.`,
  itens: [
    qt("Gemcitabina", 1000, "m2", D(1, 8), { t: "30 min", obs: "Pouessel 2004: 1.000 mg/m² em D1 e D8, infusão de 30 min." }),
    qt("Docetaxel", 75, "m2", D(8), { t: "60 min", dil: "SF 0,9%", vol: 250, obs: "Pouessel 2004: 75 mg/m² somente em D8 (após a gemcitabina do dia)." }),
  ] });

// Cisplatina + Vinorelbina RETIRADA por D-F1-50 (fonte direta NAO_LOCALIZADA após 7 estratégias; ficha-dossiê removida).

F({ tumor: CUP, nome: "Cisplatina + 5-Fluorouracil (CUP escamoso)", cenario: "escamoso metastático (primário oculto)", intervalo: 21, ciclos: null,
  identidade: "CUP de histologia escamosa com investigação de cabeça e pescoço completa negativa (Khansur 1995)",
  fontesItens: { Cisplatina: { sourceIds: ["EXT-CUP-010"] }, "Fluoruracila (5-FU) infusão contínua 24 h/dia": { sourceIds: ["EXT-CUP-010"] } },
  divergencias: ["Khansur 1995 (n=15): cisplatina 100 D1 + 5-FU 1.000 mg/m²/dia CI ×4 dias, q21d — população ESCAMOSA", "eviQ 288 (população H&N R/M, operacional): cisplatina 75 (100 no ensaio original, reduzida por consenso) + 5-FU 4.000 CIV 96 h"],
  lacunas: ["aplicabilidade restrita: NÃO generalizar para CUP não-escamoso"],
  fonteDecisao: `D-F1-36 e D-F1-49. Fonte: ${ref(["EXT-CUP-010"])}. Protocolo operacional análogo (população distinta — H&N): ${ref(["EXT-CUP-011"])}. População da variante preparada: escamosa, com investigação H&N completa negativa.`,
  itens: [
    CIS(100, D(1), { obs: "Khansur 1995: cisplatina 100 mg/m² D1 (variante eviQ 288 para H&N: 75)." }),
    qt("Fluoruracila (5-FU) infusão contínua 24 h/dia", 1000, "m2", R(1, 4), { t: "24 h", obs: "Khansur 1995: 1.000 mg/m²/dia em infusão contínua, D1–D4 (4.000 mg/m² em 96 h). NÃO generalizar para CUP não-escamoso." }),
  ] });

// ===== EWING (D-F1-34/49; dose-denso Womer 2012; SBOC local) =====
const EW = "Ewing";
F({ tumor: EW, nome: "Ewing VDC (ciclo A — alternado ao IE)", cenario: "1ª linha, dose-denso q14", intervalo: 14, ciclos: 7, altoRisco: true,
  identidade: "Ewing localizado/metastático, 1ª linha VDC/IE interval-compressed (SBOC 2026 ósseos p. 15; Womer 2012)",
  fontesItens: { Vincristina: { sourceIds: ["EXT-SARC-002", "EXT-SARC-009", "EXT-SARC-022"] }, Doxorrubicina: { sourceIds: ["EXT-SARC-002"] }, Ciclofosfamida: { sourceIds: ["EXT-SARC-002"] }, "Mesna (0 h)": { sourceIds: ["EXT-SARC-002"] }, "Mesna (2 h, VO)": { sourceIds: ["EXT-SARC-002"] }, "Mesna (6 h, VO)": { sourceIds: ["EXT-SARC-002"] }, Pegfilgrastim: { sourceIds: ["EXT-SARC-002"] } },
  divergencias: ["doxorrubicina: eviQ 37,5 mg/m² ×2 (D1–D2, 5–15 min) × BC SAALT2W 75 mg/m² IV push D1 (dose única) × Womer abstract 75 mg/m²", "vincristina: 1,5 mg/m² (cap 2 mg) no eviQ/BC × 2 mg/m² no abstract de Womer", "G-CSF: pegfilgrastim 6 mg D3 (eviQ) × filgrastim a partir do D8 (BC)", "antiesse local sem NK1 (D-F1-30) × esquema eviQ com netupitant/palonosetrona"],
  lacunas: ["versão convencional q3sem (eviQ 'VDC or IE every 21 days') disponível como alternativa — variante não preparada aqui"],
  fonteDecisao: `D-F1-34 e D-F1-49. Base do q2sem: Womer 2012 (AEWS0031) — ${ref(["EXT-SARC-022"])} (correção: 'Whelan JCO 2018' é Euro-E.W.I.N.G. 99/BuMel, não VDC/IE dose-denso). Protocolos operacionais: ${ref(["EXT-SARC-001", "EXT-SARC-002", "EXT-SARC-009"])}. Diretriz local: ${ref(["LOC-SBOC-OSSEOS"])}. Teto cumulativo de doxorrubicina 375 mg/m² (eviQ/BC): ao atingir, omitir (BC mantém VC; eviQ substitui por dactinomicina 1,25 mg/m² D1 só se cardiotoxicidade). Terapia local após 6 ciclos (eviQ 3464).`,
  itens: [
    qt("Vincristina", 1.5, "m2", D(1), { maxMg: 2, t: "15 min", obs: "Cap 2 mg (eviQ/BC). Womer 2012 (abstract): 2 mg/m² [variante]." }),
    qt("Doxorrubicina", 37.5, "m2", D(1, 2), { t: "15 min", obs: "37,5 mg/m²/dia D1–D2 (total 75/ciclo; eviQ 1916). BC: 75 IV push D1 [variante]. Teto cumulativo 375 mg/m²." }),
    qt("Ciclofosfamida", 1200, "m2", D(1), { t: "15 min", dil: "SF 0,9%", vol: 100, obs: "eviQ 1916: 1.200 mg/m² D1 em 100 mL SF 0,9% em 15 min." }),
    qt("Mesna (0 h)", 400, "m2", D(1), { t: "15 min", obs: "Carga IV 15 min antes da ciclofosfamia (eviQ 1916)." }),
    it("Mesna (2 h, VO)", "POS_QT", 800, "m2", "VO", D(1), { obs: "eviQ 1916: 800 mg/m² VO 2 h após o FIM da infusão de ciclofosfamida (dose oral = dobro da IV)." }),
    it("Mesna (6 h, VO)", "POS_QT", 800, "m2", "VO", D(1), { obs: "eviQ 1916: 800 mg/m² VO 6 h após o fim da infusão de ciclofosfamida." }),
    it("Pegfilgrastim", "POS_QT", 6, "mg", "SC", D(3), { obs: "eviQ 1916: 6 mg SC no D3 (24 h após a quimio do braço VDC, que termina no D2). BC SAALT2W: filgrastim a partir do D8 [variante]." }),
  ] });

F({ tumor: EW, nome: "Ewing IE (ciclo B — alternado ao VDC)", cenario: "1ª linha, dose-denso q14", intervalo: 14, ciclos: 7, premedDias: R(1, 5), altoRisco: true,
  identidade: "Ewing, braço IE do VDC/IE interval-compressed (ifosfamida+etoposídeo D1–D5)",
  fontesItens: { Etoposídeo: { sourceIds: ["EXT-SARC-003"] }, Ifosfamida: { sourceIds: ["EXT-SARC-003"] }, "Mesna (0 h)": { sourceIds: ["EXT-SARC-003"] }, "Mesna (4 h)": { sourceIds: ["EXT-SARC-003"] }, "Mesna (8 h)": { sourceIds: ["EXT-SARC-003"] }, Pegfilgrastim: { sourceIds: ["EXT-SARC-003"] } },
  divergencias: ["mesna IE eviQ: 600 IV carga + 600 IV 4 h e 8 h (alternativa VO às 2 h e 6 h após o fim, dose dobrada)", "teto cumulativo de ifosfamida usualmente ≤72 g/m² (BC)"],
  lacunas: [],
  fonteDecisao: `D-F1-34 e D-F1-49. Protocolo operacional: ${ref(["EXT-SARC-003", "EXT-SARC-001"])}. Elegibilidade SAALT2W <30 anos; cautelas eviQ (LVEF <45%, CrCl <60).`,
  itens: [
    qt("Etoposídeo", 100, "m2", R(1, 5), { t: "60 min", dil: "SF 0,9%", vol: 500, obs: "eviQ 3465: 100 mg/m²/dia D1–D5 em 500 mL SF em 30–60 min (Etopophos 113,6 mg ≡ 100 mg)." }),
    qt("Ifosfamida", 1800, "m2", R(1, 5), { t: "2 h", dil: "SF 0,9%", obs: "eviQ 3465: 1.800 mg/m²/dia D1–D5 em 500–1.000 mL SF em 2 h. Teto cumulativo usual ≤72 g/m² (BC)." }),
    qt("Mesna (0 h)", 600, "m2", R(1, 5), { t: "15 min", obs: "eviQ 3465: carga IV 15 min antes da ifosfamida." }),
    it("Mesna (4 h)", "POS_QT", 600, "m2", "EV", R(1, 5), { t: "15 min", obs: "eviQ 3465: 600 mg/m² IV 4 h após o início da ifosfamida (alternativa VO 2 h após o fim, dose dobrada)." }),
    it("Mesna (8 h)", "POS_QT", 600, "m2", "EV", R(1, 5), { t: "15 min", obs: "eviQ 3465: 600 mg/m² IV 8 h após o início da ifosfamida." }),
    it("Pegfilgrastim", "POS_QT", 6, "mg", "SC", D(6), { obs: "eviQ 3465: 6 mg SC no D6 (≥24 h após a quimio do braço IE, que termina no D5)." }),
  ] });

// ===== OSTEOSSARCOMA (D-F1-34/49; SBOC p.12 + eviQ 1901 + BC) =====
const OST = "Osteossarcoma";
const MAP_FONTES = { Doxorrubicina: { sourceIds: ["LOC-SBOC-OSSEOS"], variantes: "eviQ/BC/EURAMOS: 37,5 mg/m² ×2 D1–D2" }, Cisplatina: { sourceIds: ["LOC-SBOC-OSSEOS", "EXT-SARC-004"] }, Metotrexato: { sourceIds: ["EXT-SARC-004"] }, "Folinato de cálcio (resgate do MTX)": { sourceIds: ["EXT-SARC-004"] }, Pegfilgrastim: { sourceIds: ["EXT-SARC-004", "EXT-SARC-014"] } };
F({ tumor: OST, nome: "MAP (ciclos 1–4)", cenario: NE, intervalo: 35, ciclos: 4, premedDias: R(1, 2), altoRisco: true,
  identidade: "Osteossarcoma de alto grau, neoadjuvante/adjuvante; idade-limite local 40 ANOS por D-F1-50 (era 25 na SBOC; externo: eviQ nota >40, BC <40, EURAMOS ≤40, Onkopedia/AAOC <40)",
  fontesItens: MAP_FONTES,
  divergencias: ["cisplatina: SBOC 60 D1–D2 (= eviQ 1901 60×2 em 2 h) × BC SANAHDMAP 50×2 (60×2 excepcional) × ensaios 120/ciclo (contínua 72 h; D1)", "doxorrubicina: SBOC 25 D1–D3 (total 75) × eviQ/BC/EURAMOS 37,5×2 D1–D2 (mesmo total 75)", "folínico: eviQ 15 mg/m² q6h × BC 25 mg fixa q6h", "RESOLVIDO por D-F1-50: idade-limite local = 40 anos (5 apoios externos)", "cisplatina 80 mg/m² (SOnHe): NAO_LOCALIZADO nas fontes externas"],
  lacunas: ["cisplatina 80 (SOnHe) sem fonte externa — não adotada"],
  fonteDecisao: `D-F1-34 e D-F1-49. Diretriz local: ${ref(["LOC-SBOC-OSSEOS"])} — MAP: cisplatina 60 D1–D2 + doxorrubicina 25 D1–D3 + MTX 12 g/m². Protocolo operacional: ${ref(["EXT-SARC-004", "EXT-SARC-014"])}. Estrutura de ciclos (C1–4 = 35 d com MTX D22/D29; C5–6 = 28 d sem cisplatina com MTX D15/D22) e cirurgia entre C2–C3 segundo eviQ/BC. G-CSF primário obrigatório (BC). D-F1-50: idade-limite local = 40 anos.`,
  itens: [
    qt("Doxorrubicina", 25, "m2", D(1, 2, 3), { t: "15 min", obs: "SBOC p.12: 25 mg/m² D1–D3 (total 75). eviQ/BC/EURAMOS: 37,5 ×2 D1–D2 (mesmo total) [variante]." }),
    CIS(60, D(1, 2), { t: "2 h", obs: "SBOC p.12 e eviQ 1901: 60 mg/m² D1–D2 (eviQ: em 1.000 mL SF em 2 h; BC: 50×2, 60×2 excepcional)." }),
    qt("Metotrexato", 12000, "m2", D(22, 29), { maxMg: 20000, t: "4 h", dil: "SF 0,9%", vol: 1000, obs: "eviQ 1901: 12.000 mg/m² (máx 20 g) em 1.000 mL SF em 4 h; C1–C4 nas semanas 4 e 5. Alcalinização e níveis (BC SANAHDMAP: MTX h48 + diário até <0,1 µmol/L; pH urinário q6h)." }),
    qt("Folinato de cálcio (resgate do MTX)", 15, "m2", D(23, 30), { resgateMtx: { inicioAposHoras: 24, intervaloHoras: 6, primeirasDosesEV: 4, viasPosteriores: ["EV", "VO"], ateNivelInferiorMicromolL: 0.1, fonte: "EXT-SARC-004, eviQ 1901, Treatment schedule, nota de resgate do MTX" }, obs: "eviQ 1901: 15 mg/m² q6h iniciando EXATAMENTE 24 h após o início do MTX; IV nas 4 primeiras doses, depois VO até MTX <0,1 µmol/L [VERIFICAR — nº de dias conforme depuração/níveis]. BC: 25 mg fixa q6h [variante]." }),
    it("Pegfilgrastim", "POS_QT", 6, "mg", "SC", D(4), { obs: "D4, pelo menos 24 h após o fim da doxorrubicina D3 (D-F1-50/SBOC); adaptação temporal da condição eviQ 1901, não do D3 da variante com doxo D1-D2. Variante não adotada: BC SANAHDMAP: profilaxia primária obrigatória — pegfilgrastim 6 mg D3 OU filgrastim 5 µg/kg D3–D7; eviQ 1901: pegfilgrastim D3." }),
  ] });

F({ tumor: OST, nome: "MAP (ciclos 5–6 — sem cisplatina)", cenario: NE, intervalo: 28, ciclos: 2, premedDias: D(1), altoRisco: true,
  identidade: "Osteossarcoma, ciclos finais do MAP (eviQ 1901: sem cisplatina; MTX semanas 3–4); idade-limite 40 anos (D-F1-50)",
  fontesItens: MAP_FONTES,
  divergencias: ["mesmas divergências de dose do MAP C1–4 (doxo/fracionamento; folínico)"],
  lacunas: ["confirmação local da estrutura C5–6 sem cisplatina (SBOC descreve MAP sem separar) [VERIFICAR]"],
  fonteDecisao: `D-F1-34 e D-F1-49. Estrutura eviQ 1901 (C5–6 de 28 d: doxo semana 1 + MTX semanas 3–4, SEM cisplatina): ${ref(["EXT-SARC-004", "EXT-SARC-014"])}.`,
  itens: [
    qt("Doxorrubicina", 25, "m2", D(1, 2, 3), { t: "15 min", obs: "SBOC p.12 (25 D1–D3; total 75). eviQ/BC: 37,5 ×2 [variante]." }),
    qt("Metotrexato", 12000, "m2", D(15, 22), { maxMg: 20000, t: "4 h", dil: "SF 0,9%", vol: 1000, obs: "eviQ 1901 C5–6: 12.000 mg/m² em 4 h nas semanas 3 e 4 (D15 e D22)." }),
    qt("Folinato de cálcio (resgate do MTX)", 15, "m2", D(16, 23), { resgateMtx: { inicioAposHoras: 24, intervaloHoras: 6, primeirasDosesEV: 4, viasPosteriores: ["EV", "VO"], ateNivelInferiorMicromolL: 0.1, fonte: "EXT-SARC-004, eviQ 1901, Treatment schedule, nota de resgate do MTX" }, obs: "15 mg/m² q6h a partir de 24 h do início do MTX; IV ×4 doses, depois VO até <0,1 µmol/L [VERIFICAR]. BC: 25 mg fixa [variante]." }),
    it("Pegfilgrastim", "POS_QT", 6, "mg", "SC", D(4), { obs: "Pelo menos 24 h após o fim da doxorrubicina D3 (D-F1-50/SBOC); condição eviQ 1901, adaptada ao fracionamento local. Profilaxia primária obrigatória (BC SANAHDMAP)." }),
  ] });

F({ tumor: OST, nome: "AP (doxorrubicina + cisplatina)", cenario: NE, intervalo: 21, ciclos: null, altoRisco: true,
  identidade: "Osteossarcoma sem MTX; idade-limite local 40 anos por D-F1-50 (SBOC p.12 usava >25; SAAVAP cobre avançado)",
  fontesItens: { Doxorrubicina: { sourceIds: ["EXT-SARC-015", "LOC-SBOC-OSSEOS"] }, Cisplatina: { sourceIds: ["EXT-SARC-015", "LOC-SBOC-OSSEOS"] } },
  divergencias: ["SAAVAP: doxo 75 IV push + cis 100 em 2 h q21d até progressão/toxicidade; considerar doxo 60 se >40 anos", "RESOLVIDO por D-F1-50: idade-limite local = 40 anos", "eviQ 1901 nota: '>40 anos: considerar AP sem HDMTX'"],
  lacunas: ["AP adjuvante formal sem protocolo operacional dedicado (SAAVAP cobre avançado)"],
  fonteDecisao: `D-F1-34 e D-F1-49. Fonte operacional: ${ref(["EXT-SARC-015"])}. Diretriz local: ${ref(["LOC-SBOC-OSSEOS"])} (AP para >25 anos — corte sem apoio externo). Nota eviQ 1901: considerar AP sem HDMTX acima de 40 anos.`,
  itens: [
    qt("Doxorrubicina", 75, "m2", D(1), { t: "15 min", obs: "SAAVAP: 75 mg/m² IV push D1 (considerar 60 se >40 anos)." }),
    CIS(100, D(1), { t: "2 h", obs: "SAAVAP: 100 mg/m² em 1 L SF + manitol 30 g + KCl 10 mEq em 2 h." }),
  ] });

// ===== VULVA (D-F1-35/49; eviQ 1529 específico) =====
const VUL = "Vulva";
F({ tumor: VUL, nome: "Cisplatina semanal + RxT (vulva)", cenario: "concomitante à RT", intervalo: 7, ciclos: null,
  identidade: "CEC de vulva localmente avançado (T3/T4 não ressecável por vulvectomia radical), previamente não tratado (eviQ 1529)",
  fontesItens: { Cisplatina: { sourceIds: ["EXT-CNV-021", "EXT-CNV-023"] } },
  divergencias: ["eviQ 1529 (v.9, específico de vulva): 40 mg/m² IV q7d, 5–6 ciclos conforme duração da RT, no dia de RT (antes dela)", "BC GOCXCRT (inclui vulva): 40 mg/m² em 500 mL NS + manitol 30 g + MgSO4 2 g em 60 min, semanal ×5, sem pós-hidratação", "estudo de referência GOG 205 = Moore DH, Gynecol Oncol 2012;124(3):529-33 (PMID 22079361) — o 'Gill 2015' do material local é atribuição incorreta"],
  lacunas: [],
  fonteDecisao: `D-F1-35 e D-F1-49. Protocolo ESPECÍFICO de vulva: ${ref(["EXT-CNV-021"])}. Protocolo BC que inclui vulva: ${ref(["EXT-CNV-023"])}. Material local: ${ref(["LOC-SONHE"])} (p. 89–91).`,
  itens: [
    CIS(40, D(1), { obs: "eviQ 1529: 40 mg/m² semanal no dia de RT (antes), 5–6 ciclos. GOCXCRT: 500 mL + manitol 30 g + MgSO4 2 g em 60 min." }),
  ] });

F({ tumor: VUL, nome: "Carboplatina + Paclitaxel 21/21 dias (vulva)", cenario: NE, intervalo: 21, ciclos: null,
  identidade: "CEC/adenocarcinoma de vulva recorrente ou avançado, inelegível a quimiorradioterapia (GOCXCAT inclui vulva)",
  fontesItens: { Paclitaxel: { sourceIds: ["EXT-CNV-024"] }, Carboplatina: { sourceIds: ["EXT-CNV-024"] } },
  divergencias: ["GOCXCAT: paclitaxel 175 em 3 h + AUC 6 (AUC 5 se RT prévia extensa); q21/28d, máx 6", "SOnHe p. 89/91 (local): AUC 5 + 175 — variante [decisão pendente]", "infusão do paclitaxel: 3 h em TODAS as fontes (24 h NAO_LOCALIZADO)"],
  lacunas: ["variante de AUC (6 × 5) pendente de decisão local"],
  fonteDecisao: `D-F1-35 e D-F1-49. Protocolo BC que INCLUI vulva na elegibilidade: ${ref(["EXT-CNV-024"])}. Material local: ${ref(["LOC-SONHE"])} (p. 89–91, AUC 5 + 175).`,
  itens: [
    qt("Paclitaxel", 175, "m2", D(1), { t: "3 h", obs: "GOCXCAT: 175 mg/m² em 250–500 mL em 3 h (não-DEHP, filtro 0,2 µm). SOnHe: mesma dose; AUC divergente." }),
    qt("Carboplatina", 6, "auc", D(1), { t: "60 min", obs: "Calvert AUC 6 (GFR cap 125); AUC 5 se RT prévia extensa (GOCXCAT). SOnHe: AUC 5 [decisão pendente]." }),
  ] });

// ===== CEC DE PELE (D-F1-34/49) =====
const CEC = "CEC de pele (cutâneo)";
F({ tumor: CEC, nome: "Cemiplimabe", cenario: "localmente avançado/metastático — inelegível a cirurgia/RT curativas", intervalo: 21, ciclos: null, semPremed: true,
  identidade: "CSCC metastático ou localmente avançado sem candidatura a cirurgia/RT curativas (eviQ 4151)",
  fontesItens: { Cemiplimabe: { sourceIds: ["EXT-CNV-001"] } },
  divergencias: ["estudos pivô: Migden NEJM 2018;379(4):341-351 e Lancet Oncol 2020;21(2):294-305 (o material local cita o fascículo 7 do Lancet — corrigido)"],
  lacunas: ["dispensação/SUS: verificar"],
  fonteDecisao: `D-F1-34 e D-F1-49. Protocolo operacional: ${ref(["EXT-CNV-001"])} (página viva v5, 02/09/2026; PDF capturado v1) + BC SMAVCEM (rev 08/2025) + DailyMed LIBTAYO SPL (setid 4347ae1f…). Sem pré-medicação de rotina (eviQ/BC).`,
  itens: [
    qt("Cemiplimabe", 350, "mg", D(1), { dil: "SF 0,9%", vol: 50, t: "30 min", obs: "350 mg IV q21d em 50 mL SF 0,9% em 30 min; filtro in-line 0,2–5 µm; estabilidade ≤8 h TA ou ≤10 d 2–8 °C; até progressão/toxicidade (até 2 anos)." }),
    it("Soro fisiológico 0,9% 50 mL (flush pós-infusão)", "POS_QT", 1, "fr", "EV", D(1), { vol: 50, obs: "eviQ 4151: flush de 50 mL de SF 0,9% ao término." }),
  ] });

F({ tumor: CEC, nome: "Carboplatina + Paclitaxel 21/21 dias (CEC de pele)", cenario: NE, intervalo: 21, ciclos: null,
  identidade: "CEC cutâneo avançado — EXTRAPOLAÇÃO explícita de CECP recorrente/metastático (eviQ 3579)",
  fontesItens: { Paclitaxel: { sourceIds: ["EXT-CNV-008"] }, Carboplatina: { sourceIds: ["EXT-CNV-008"] } },
  divergencias: ["população do protocolo é CECP de cabeça e pescoço — extrapolação para CEC cutâneo declarada, não transcrição", "cisplatina 100 q21d monoterapia: NAO_LOCALIZADO como protocolo operacional (eviQ 288 reduz a 75 em combinação; BC HNAVP usa 25 ×2)"],
  lacunas: ["extrapolação requer aceite explícito do Dr. Silas"],
  fonteDecisao: `D-F1-34 e D-F1-49. Protocolo operacional (população CECP R/M — extrapolação explícita): ${ref(["EXT-CNV-008"])}. Material local: ${ref(["LOC-SONHE"])} (p. 236–238, opções incluem cemiplimabe preferencial).`,
  itens: [
    qt("Paclitaxel", 175, "m2", D(1), { t: "3 h", dil: "SF 0,9%", vol: 500, obs: "eviQ 3579: 175 mg/m² em 500 mL SF em 3 h (recipientes não-PVC). EXTRAPOLAÇÃO de CECP." }),
    qt("Carboplatina", 5, "auc", D(1), { t: "60 min", dil: "SG 5%", vol: 500, obs: "eviQ 3579: AUC 5 em 500 mL SG 5% em 30–60 min. 4–6 ciclos." }),
  ] });

F({ tumor: CEC, nome: "Cisplatina semanal + RxT (CEC de pele)", cenario: "concomitante à RT", intervalo: 7, ciclos: null,
  identidade: "CEC cutâneo localmente avançado — EXTRAPOLAÇÃO de CECP localmente avançado (eviQ 292)",
  fontesItens: { Cisplatina: { sourceIds: ["EXT-CNV-016"] } },
  divergencias: ["população do protocolo é CECP — extrapolação declarada", "eviQ 292: 40 mg/m² em 1.000 mL SF em 60 min q7d contínuo com RT (~6 semanas); pré MgSO4 10 mmol em 1.000 mL; sem manitol na versão vigente (dose baixa)"],
  lacunas: ["extrapolação requer aceite explícito do Dr. Silas"],
  fonteDecisao: `D-F1-34 e D-F1-49. Protocolo operacional (CECP localmente avançado — extrapolação explícita): ${ref(["EXT-CNV-016"])}.`,
  itens: [
    CIS(40, D(1), { obs: "eviQ 292: 40 mg/m² semanal concomitante à RT (~6 semanas). Extrapolação de CECP declarada." }),
  ] });

F({ tumor: CEC, nome: "Pembrolizumabe", cenario: "localmente avançado/metastático — inelegível a cirurgia/RT curativas", intervalo: 21, ciclos: null, semPremed: true,
  identidade: "CSCC cutâneo localmente avançado/metastático inelegível a terapia curativa (D-F1-50; NCCN CSCC v1.2026 prefere pembro/cemi 2A — rodada v2)",
  fontesItens: { Pembrolizumabe: { sourceIds: ["EXT-SARC-008"], decisaoLocal: "D-F1-50 (criação da ficha; dose 200 mg q21d)" } },
  divergencias: ["FDA aprovado p/ CSCC; EMA NÃO aprovou pembrolizumabe para CEC cutâneo (só cemiplimabe) — ressalva regulatória registrada (rodada v2)", "KEYNOTE-629 (PMID 34293460): ORR 50% (localmente avançado) / 35% (metastático)"],
  lacunas: ["disponibilidade SUS: VERIFICAR (H2)"],
  fonteDecisao: `D-F1-34, D-F1-49 e D-F1-50 (criação). Protocolo operacional: ${ref(["EXT-SARC-008"])} (200 mg IV q21d OU 400 mg q42d, em 50–100 mL SF 0,9% em 30 min, até 24 meses). Indicação em CEC pela diretriz NCCN CSCC v1.2026 (pembro preferido 2A com cemiplimabe) e KEYNOTE-629 — registrados na rodada v2 (RELATORIO-F1-B2-PENDENCIAS-V2 §E3). Ressalva: EMA negativa para esta indicação.`,
  itens: [
    qt("Pembrolizumabe", 200, "mg", D(1), { dil: "SF 0,9%", t: "30 min", obs: "200 mg IV q21d (D-F1-50; eviQ 5066). Alternativa da fonte: 400 mg q42d. Diluição 50–100 mL SF 0,9%; até 24 meses ou toxicidade." }),
  ] });

// ===== NTG (D-F1-34/49; Lok 2025 + eviQ) =====
const NTG = "Neoplasia trofoblástica gestacional";
F({ tumor: NTG, nome: "Metotrexato + ácido folínico (baixo risco)", cenario: "baixo risco (escore FIGO 0–4, D-F1-50)", intervalo: 14, ciclos: null, semPremed: true,
  identidade: "NTG de baixo risco — corte local 0–4 por D-F1-50 (BC; eviQ/Lok ≤6 como variante registrada), 1ª linha",
  fontesItens: { Metotrexato: { sourceIds: ["EXT-CNV-026", "EXT-CNV-031"] }, "Ácido folínico (resgate)": { sourceIds: ["EXT-CNV-026", "EXT-CNV-031"] } },
  divergencias: ["eviQ 668: MTX 50 mg fixa IM D1,3,5,7 + folínico 15 mg VO D2,4,6,8 (24 h pós MTX)", "Lok A5: MTX 1 mg/kg IM D1,3,5,7 OU 50 mg fixa (variante Charing Cross usada na Aula 31)", "BC GOTDLRM: folínico 30 h após o MTX (não 24 h); alternativa 5 dias 0,4 mg/kg/dia IV sem folínico", "cortes de risco: eviQ/Lok ≤6 × BC 0–4"],
  lacunas: [],
  fonteDecisao: `D-F1-34, D-F1-49 e D-F1-50 (corte 0–4; MTX 50 mg fixa; folínico 7,5 mg 24 h). Protocolo operacional: ${ref(["EXT-CNV-026"])}. Diretriz original: ${ref(["EXT-CNV-031"])}. Consolidação: 3 ciclos além da normalização do β-hCG.`,
  itens: [
    qt("Metotrexato", 50, "mg", D(1, 3, 5, 7), { route: "IM", obs: "D-F1-50: 50 mg fixa IM D1,3,5,7 (eviQ 668; PDQ/Charing Cross). Variante 1 mg/kg NAO_LOCALIZADA na verificação v2 — não usar." }),
    qt("Ácido folínico (resgate)", 7.5, "mg", D(2, 4, 6, 8), { route: "VO", obs: "D-F1-50: 7,5 mg VO (variante clássica Charing Cross) 24 h após cada MTX (BC: 30 h [variante]; versões modernas: 15 mg [variante])." }),
  ] });

F({ tumor: NTG, nome: "Dactinomicina em pulso (baixo risco)", cenario: "baixo risco (escore FIGO 0–4, D-F1-50)", intervalo: 14, ciclos: null,
  identidade: "NTG de baixo risco — alternativa ao MTX ou resistência/contraindicação a ele (eviQ 1018)",
  fontesItens: { Dactinomicina: { sourceIds: ["EXT-CNV-027", "EXT-CNV-031"] } },
  divergencias: ["eviQ 1018: 1,25 mg/m² IV (cap 2 mg) D1 q14d; consolidação 3 ciclos pós-β-hCG normal (BC: 2 ciclos)", "Lok A5: alternativa 0,5 mg IV/dia D1–5"],
  lacunas: [],
  fonteDecisao: `D-F1-34 e D-F1-49. Protocolo operacional: ${ref(["EXT-CNV-027"])}. Diretriz: ${ref(["EXT-CNV-031"])}.`,
  itens: [
    qt("Dactinomicina", 1.25, "m2", D(1), { maxMg: 2, t: "5 min", obs: "1,25 mg/m² IV em 3–5 min (cap 2 mg), q14d. Alternativa Lok: 0,5 mg/dia D1–5." }),
  ] });

F({ tumor: NTG, nome: "EMA-CO (alto risco)", cenario: "alto risco (escore FIGO ≥7)", intervalo: 14, ciclos: null, premedDias: D(1, 2, 8), altoRisco: true,
  identidade: "NTG de alto risco (escore ≥7) ou resistente a MTX/dactinomicina (eviQ 599)",
  fontesItens: { Etoposídeo: { sourceIds: ["EXT-CNV-028"] }, Metotrexato: { sourceIds: ["EXT-CNV-028"] }, Dactinomicina: { sourceIds: ["EXT-CNV-028"] }, "Folinato de cálcio (resgate do MTX)": { sourceIds: ["EXT-CNV-028"] }, Vincristina: { sourceIds: ["EXT-CNV-028"] }, Ciclofosfamida: { sourceIds: ["EXT-CNV-028"] }, Filgrastim: { sourceIds: ["EXT-CNV-028"] } },
  divergencias: ["vincristina: eviQ 1 mg/m² (cap 2) × BC/Lok 0,8 mg/m² (cap 2)", "BC GOTDEMACO: sem filgrastim; pós-hidratação alcalina após MTX", "consolidação: 3 ciclos além do β-hCG normal (eviQ/BC)"],
  lacunas: [],
  fonteDecisao: `D-F1-34 e D-F1-49. Protocolo operacional: ${ref(["EXT-CNV-028"])} (D1: ETO+MTX 12 h+dactino; D2: ETO+dactino+folínico 24 h pós-MTX; D8: VCR+CTX; filgrastim D3–5 e D9–11; q14d). Diretriz: ${ref(["EXT-CNV-031"])}.`,
  itens: [
    qt("Etoposídeo", 100, "m2", D(1, 2), { t: "60 min", dil: "SF 0,9%", vol: 500, obs: "100 mg/m²/dia D1 e D2 (Etopophos 113,6 ≡ 100)." }),
    qt("Metotrexato", 300, "m2", D(1), { t: "12 h", dil: "SF 0,9%", vol: 1000, obs: "300 mg/m² IV em 1.000 mL SF em 12 h (D1)." }),
    qt("Dactinomicina", 0.5, "mg", D(1, 2), { t: "5 min", obs: "0,5 mg IV D1 e D2." }),
    ...[24, 36, 48, 60].map(h => qt(`Folinato de cálcio (resgate do MTX +${h} h)`, 15, "mg", D(h < 48 ? 2 : 3), { route: "VO", obs: "15 mg VO a cada 12 h, quatro doses: +24/+36/+48/+60 h após o início do MTX (EXT-CNV-028/031). Não omitir D3." })),
    qt("Vincristina", 0.8, "m2", D(8), { maxMg: 2, t: "10 min", dil: "SF 0,9%", vol: 50, obs: "D-F1-50: 0,8 mg/m² (cap 2 mg; BC/Lok). eviQ 599: 1 mg/m² [variante registrada]." }),
    qt("Ciclofosfamida", 600, "m2", D(8), { t: "60 min", dil: "SF 0,9%", vol: 500, obs: "600 mg/m² D8." }),
    it("Filgrastim", "POS_QT", 5, "ugkg", "SC", [...R(3, 5), ...R(9, 11)], { obs: "5 µg/kg/dia SC D3–D5 e D9–D11 (eviQ nota: 2–3 dias frequentemente suficientes; BC: sem filgrastim)." }),
  ] });

F({ tumor: NTG, nome: "EMA/EP (resistência ao EMA-CO)", cenario: "resistente ao EMA-CO", intervalo: 14, ciclos: null, premedDias: D(1, 8), altoRisco: true,
  identidade: "NTG com resistência ao EMA-CO — estrutura EXATA da Tabela A5 de Lok 2025 (D2 sem etoposídeo/dactinomicina)",
  fontesItens: { Etoposídeo: { sourceIds: ["EXT-CNV-031", "EXT-CNV-029"] }, Metotrexato: { sourceIds: ["EXT-CNV-031"] }, Dactinomicina: { sourceIds: ["EXT-CNV-031"] }, "Folinato de cálcio (resgate do MTX)": { sourceIds: ["EXT-CNV-031"] }, Cisplatina: { sourceIds: ["EXT-CNV-031", "EXT-CNV-029"] } },
  divergencias: ["RESOLVIDO (ETAPA 3): EMA/EP NÃO tem etoposídeo/dactinomicina no D2 — D2 é SOMENTE leucovorina 15 mg 2×/dia ×4 (24 h pós-MTX). Confirmação dupla: Tabela A5 (p. 24) e Figura A4 ('EMA in EMA/EP, day 2 EA should be omitted') de Lok 2025; eviQ 1378 (EP-EMA, ordem invertida) também sem 2º dia de EA", "eviQ 1378 é EP-EMA (EP na 1ª semana) — equivalente operacional com ordem trocada"],
  lacunas: [],
  fonteDecisao: `D-F1-34 e D-F1-49. Diretriz ORIGINAL verificada (duas cópias independentes: ORBi + Radboud, dupla leitura visual + camada de texto): ${ref(["EXT-CNV-031"])}. Equivalente operacional: ${ref(["EXT-CNV-029"])} (EP-EMA: D1 EP 150/75; D8 EMA; D9 folínico; filgrastim D2–4 e D9–11).`,
  itens: [
    qt("Dactinomicina", 0.5, "mg", D(1), { t: "5 min", obs: "Tabela A5: actinomicina-D 0,5 mg IV D1 (somente)." }),
    qt("Etoposídeo", 100, "m2", D(1), { t: "60 min", dil: "SF 0,9%", vol: 500, obs: "Tabela A5: etoposídeo 100 mg/m² IV D1; no D8 a dose é 150 mg/m²." }),
    qt("Metotrexato", 300, "m2", D(1), { t: "12 h", dil: "SF 0,9%", vol: 1000, obs: "Tabela A5: MTX 300 mg/m² IV D1 (12 h no equivalente eviQ 1378)." }),
    ...[24, 36, 48, 60].map(h => qt(`Folinato de cálcio (resgate do MTX +${h} h)`, 15, "mg", D(h < 48 ? 2 : 3), { route: "VO", obs: "15 mg VO a cada 12 h, quatro doses: +24/+36/+48/+60 h após o início do MTX (EXT-CNV-028/031). Não omitir D3." })),
    qt("Etoposídeo (D8, 150 mg/m²)", 150, "m2", D(8), { t: "60 min", dil: "SF 0,9%", vol: 500, obs: "Tabela A5: etoposídeo 150 mg/m² IV D8." }),
    CIS(75, D(8), { obs: "Tabela A5: cisplatina 75 mg/m² IV D8 (eviQ 1378: em 1.000 mL SF em 60 min com hidratação)." }),
  ] });

F({ tumor: NTG, nome: "EP de indução (escore ultra-alto)", cenario: "escore alto/ultra-alto (FIGO ≥12, D-F1-50) — indução", intervalo: 7, ciclos: null, premedDias: D(1, 2),
  identidade: "NTG com doença extensa (tórax/fígado/SNC) e/ou hemorragia — indução antes do EMA-CO/EMA-EP; corte local FIGO ≥12 por D-F1-50 (eviQ 1347; Lok ≥13 [variante])",
  fontesItens: { Etoposídeo: { sourceIds: ["EXT-CNV-030", "EXT-CNV-031"] }, Cisplatina: { sourceIds: ["EXT-CNV-030", "EXT-CNV-031"] } },
  divergencias: ["corte de indicação RESOLVIDO por D-F1-50: ≥12 (eviQ 1347); Lok 2025 usa ≥13 [variante registrada]", "frequência: eviQ 1347 'Frequency: 7 days' (=semanal, D1–D2 por semana); Lok: 'once weekly' 1–3 ciclos"],
  lacunas: ["número de ciclos por paciente clínico (1–3) e transição para EMA-CO/EMA-EP: decisão clínica"],
  fonteDecisao: `D-F1-34 e D-F1-49. Protocolo operacional: ${ref(["EXT-CNV-030"])}. Diretriz: ${ref(["EXT-CNV-031"])} (Low-dose EP once weekly: etoposídeo 100 + cisplatina 20, D1–D2).`,
  itens: [
    qt("Etoposídeo", 100, "m2", D(1, 2), { t: "60 min", dil: "SF 0,9%", vol: 500, obs: "100 mg/m²/dia D1–D2." }),
    CIS(20, D(1, 2), { obs: "20 mg/m²/dia D1–D2 (dose baixa; hidratação para nefroproteção conforme eviQ 1347)." }),
  ] });

// ---------- execução ----------
const geradas = [];
for (const s of FICHAS) {
  const { t, tumorSlug, arquivo } = montar(s);
  const dir = join(SAIDA, tumorSlug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, arquivo), JSON.stringify(t, null, 2) + "\n", "utf8");
  geradas.push({ spec: s, t, caminho: `corpus/fichas/${tumorSlug}/${arquivo}` });
}

// ---------- acréscimo de fontes externas às 6 fichas de paclitaxel semanal (D-F1-28/D-F1-49) ----------
const PAC_SEMANAL = [
  "cabeca-e-pescoco/carboplatina-paclitaxel-semanal__nao-especificado.json",
  "esofago/carboplatina-paclitaxel-semanal-cross-rxt__concomitante-a-rt.json",
  "mama/ac-ct-fase-ct-carboplatina-paclitaxel-semanal__neo-adjuvante.json",
  "mama/ac-t-fase-t-paclitaxel-semanal__adjuvante.json",
  "mama/ac-th-fase-th-paclitaxel-semanal-trastuzumabe__neo-adjuvante.json",
  "prostata/carboplatina-paclitaxel-semanal__nao-especificado.json",
];
const ACRESCIMO_FONTE = ` F1-B2 (D-F1-49, ${ACESSO}): fontes externas do paclitaxel semanal — ${ref(["EXT-LEG-008", "EXT-LEG-009", "EXT-LEG-012", "EXT-LEG-013"])}. Conferido: 80 mg/m² q7d (eviQ 4103/42; 'usual' 80 na monografia BC; BRAVTW usa 90 [variante]); infusão 60 min; filtro inline ≤0,22 µm e materiais não-PVC/DEHP-free; hipersensibilidade típica nos 10 primeiros minutos das 2 primeiras infusões. Divergência de diluente REGISTRADA e não aplicada: eviQ 250 mL × decisão local SF 0,9% 500 mL (D-F1-28, mantida). Premeds das fontes (loratadina+dexa VO no eviQ; dexa+difenidramina+famotidina IV no BC) divergem do padrão local (D-W9-34c/D-F1-48) — padrão local mantido.`;
const alteradas = [];
for (const rel of PAC_SEMANAL) {
  const caminho = `corpus/fichas/${rel}`;
  const json = JSON.parse(readFileSync(join(RAIZ, caminho), "utf8"));
  const marco = json.fonte.indexOf(" F1-B2 (D-F1-49");
  if (marco >= 0) json.fonte = json.fonte.slice(0, marco);
  const cross = rel.startsWith("esofago/");
  const nota = cross
    ? " F1-B2 (D-F1-49): CROSS mantém paclitaxel 50 mg/m² da ficha. Fontes mamárias 80 mg/m² não confirmam dose/indicação CROSS; monografia BC sustenta somente filtro e materiais."
    : ACRESCIMO_FONTE;
  json.fonte += nota;
  const pac = json.itens.find(i => /^paclitaxel/i.test(i.drug));
  if (pac) {
    pac.observacao = (pac.observacao ?? "").split("F1-B2:")[0].trim();
    pac.observacao += cross
      ? " F1-B2: dose CROSS 50 mg/m² preservada; sem atribuir confirmação por fontes de mama 80 mg/m²."
      : " F1-B2: 80 mg/m²/60 min confirmados externamente (EXT-LEG-008/009); diluente SF 0,9% 500 mL é decisão local (D-F1-28) — eviQ usa 250 mL [divergência registrada].";
  }
  json.hash = hashDe(json);
  writeFileSync(join(RAIZ, caminho), JSON.stringify(json, null, 2) + "\n", "utf8");
  // registro idempotente: execução anterior já aplicou o acrescimo — o manifesto registra as 6 mesmo assim
  alteradas.push({ caminho, templateId: json.templateId });
}

// ---------- manifesto b2-fichas.v1.json (proveniência por campo; localizador estável = droga+dias) ----------
function camposDa(spec, t) {
  const mapa = spec.fontesItens ?? {};
  return t.itens.map((i) => {
    const chave = Object.keys(mapa).find((k) => i.drug === k || i.drug.startsWith(k.split(" (")[0]));
    const m = mapa[chave];
    const ehQT = i.classe === "QT";
    // Manitol acompanha o bloco de cisplatina (padrão local); demais itens de suporte mapeados carregam suas fontes.
    if (!ehQT || /^Manitol/.test(i.drug)) {
      if (m?.sourceIds?.length) return { campo: `itens[drug=${i.drug};days=${i.days.join(",")}].standardDose`, valor: i.standardDose, unidade: i.unit, situacao: "DOCUMENTADO", sourceIds: m.sourceIds, localizador: m.localizador ?? null, divergencias: [], aprovacaoClinica: null };
      return { campo: `itens[drug=${i.drug};days=${i.days.join(",")}].standardDose`, valor: i.standardDose, unidade: i.unit, situacao: "PADRAO_LOCAL", sourceIds: [], decisaoLocal: "D-W9-23c/34c/50; D-F1-30/48 (pré/pos-QT locais)", localizador: "padrão institucional das fichas", divergencias: [] };
    }
    if (!m) throw new Error(`Ficha "${t.nome}": item QT sem proveniência declarada: ${i.drug}`);
    if (m.situacao === "NAO_LOCALIZADO") {
      if (i.standardDose !== null) throw new Error(`Ficha "${t.nome}": ${i.drug} declarado NAO_LOCALIZADO mas tem dose`);
      if (!(i.observacao ?? "").includes("[VERIFICAR]") && !(i.observacao ?? "").includes("NAO_LOCALIZADO")) throw new Error(`Ficha "${t.nome}": ${i.drug} NAO_LOCALIZADO sem [VERIFICAR] na observacao`);
      return { campo: `itens[drug=${i.drug};days=${i.days.join(",")}].standardDose`, valor: null, unidade: i.unit, situacao: "NAO_LOCALIZADO", sourceIds: m.sourceIds ?? [], localizador: m.localizador ?? null, divergencias: [], aprovacaoClinica: null };
    }
    if (i.standardDose === null) throw new Error(`Ficha "${t.nome}": ${i.drug} DOCUMENTADO mas dose null`);
    const saida = { campo: `itens[drug=${i.drug};days=${i.days.join(",")}].standardDose`, valor: i.standardDose, unidade: i.unit, situacao: "DOCUMENTADO", sourceIds: m.sourceIds ?? [], localizador: m.localizador ?? null, divergencias: [], aprovacaoClinica: null };
    if (m.decisaoLocal) { saida.situacao = "DOCUMENTADO_POR_DECISAO_LOCAL"; saida.decisaoLocal = m.decisaoLocal; }
    return saida;
  });
}
const manifestoB2 = {
  versao: "1.0.0", fatia: "F1-B2", geradoEm: ACESSO, decisao: "D-F1-49",
  regras: { localizador: "itens[drug=<nome estavel>;days=<dias>] — identidade estável por droga+dias, nunca índice numérico", aprovacao: "toda ficha nova nasce RASCUNHO; ativação clínica exige aprovação identificada por item/versão/hash; mudança de fonte NÃO aprova doses (D-F1-49)" },
  fontesExternas: EXT, materiaisLocais: LOC,
  fichasNovas: geradas.map(({ spec, t, caminho }) => ({
    arquivo: caminho, templateId: t.templateId, hash: t.hash, versao: t.versao, status: t.status,
    identidadeClinica: spec.identidade, decisisoes: ["D-F1-49", ...(spec.decisisoes ?? [])],
    campos: camposDa(spec, t), divergencias: spec.divergencias ?? [], lacunas: spec.lacunas ?? [], aprovacaoClinica: null,
  })),
  fichasAlteradas: alteradas.map((a) => ({ ...a, motivo: "acréscimo de fontes externas do paclitaxel semanal (D-F1-28/D-F1-49); doses e diluente local inalterados", fontesAcrescentadas: ["EXT-LEG-008", "EXT-LEG-009", "EXT-LEG-012", "EXT-LEG-013"] })),
  destinacaoCodigosLegado: {
    P1577: "ficha nova criada com identidade própria (D-F1-26); código mantido como codigoInstitucional — identidade do código comprovada pela decisão local",
    P1512: "ficha nova criada (D-F1-27: D1 e D2); código mantido como codigoInstitucional — identidade comprovada pela decisão local",
    P1397: "mapeamento legado NÃO comprovado: as 6 fichas de paclitaxel semanal cobrem os contextos (D-F1-28/48); a qual delas o P1397 se refere permanece aberto — destino a decidir pelo Dr. Silas",
    "051": "mapeamento legado NÃO comprovado (paclitaxel semanal por D-F1-28, contexto exato aberto); série 050–054 é numeração de modelos de receita INT-MED (D-F1-44)",
    P1399: "sem identidade de esquema conhecida; a regra 'dipirona e cimetidina se necessário' (D-F1-43) já vive na ficha P1426; bulas de referência obtidas (dipirona 500 mg VO 1–2 cp até 4×/dia, Medley/EMS; cimetidina oral) — criação de ficha própria aguarda definição do esquema de origem",
    "053": "erro de duplicação da biblioteca INT-MED (D-F1-44) — a corrigir NAQUELA biblioteca (externa ao repositório); nenhuma ficha nova",
  },
};
mkdirSync(join(RAIZ, "corpus", "manifesto"), { recursive: true });
writeFileSync(join(RAIZ, "corpus", "manifesto", "b2-fichas.v1.json"), JSON.stringify(manifestoB2, null, 2) + "\n", "utf8");
console.log(`${geradas.length} fichas B2 novas; ${alteradas.length} fichas de paclitaxel semanal com fontes acrescentadas; manifesto b2-fichas.v1.json gravado.`);
