// F1-B2 · Gerador dos 6 packs novos (D-F1-34/49): Ewing, osteossarcoma, CEC de pele, NTG, vulva e CUP.
// Uso: node scripts/gerar-packs-b2.mjs  — grava corpus/6-pack-tumor/<slug>/pack-<slug>.v2.RASCUNHO.json
// Estrutura espelha os packs v2 existentes (pack-ldgcb etc.): header RulesetHeader, status RASCUNHO,
// consultavel true, alerta false, identidade/diagnostico/estadiamento/tratamento/fichaId/ligacoes/
// pendencias/conflitos/curadoria. Aprovação clínica: null (D-F1-49 — nada aqui é ativo).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const DIA = "2026-10-14";

const fonte = (referencia, trecho, extra = {}) => ({ tipo: extra.tipo ?? "PROTOCOLO_INSTITUCIONAL", referencia, pagina: extra.pagina ?? null, trecho, estado: extra.estado ?? "CONSULTADO" });
const pendencia = (texto, classe, buscas) => ({ texto, classe, buscasFeitas: buscas });
const conflito = (tema, fonteA, fonteB, escolhaSeguranca, decisaoNecessaria) => ({ tema, fonteA, fonteB, escolhaSeguranca, decisaoNecessaria });
const proto = (p) => ({
  id: p.id, nome: p.nome, cenario: p.cenario, linha: p.linha,
  drogas: p.drogas.map((d) => ({ droga: d[0], dose: d[1], unidade: d[2], via: d[3] ?? "EV", dias: d[4], observacao: d[5] ?? "" })),
  cicloDias: p.cicloDias, numeroCiclos: p.numeroCiclos ?? null,
  premedicacao: p.premedicacao ?? "Padrão local (D-W9-23c/34c; D-F1-30/48)", ajusteObrigatorio: p.ajuste ?? "",
  fichaId: p.fichaId ?? null,
  sus: { disponivel: p.sus ?? "VERIFICAR", fonte: { tipo: "DECISAO_MEDICA", referencia: "D-F1-34/49 — disponibilidade SUS por item a verificar", pagina: null, trecho: "", estado: "PENDENTE" } },
  fonte: p.fonte, observacao: p.observagem ?? "", derivadoDe: null, criterioAplicacao: p.criterio ?? "",
});

const base = (slug, tumor, cid10, headerRef, headerTrecho) => ({
  header: { id: `pack-${slug}`, versao: "2.0.0", vigenteDesde: DIA, fonte: { tipo: "DIRETRIZ", referencia: headerRef, trecho: headerTrecho, edicao: `F1-B2 ${DIA}` }, curador: "Dr. Silas Negrão", aprovadoEm: DIA }, // registro do RASCUNHO (schema exige data); aprovação clínica real = curadoria.aprovacaoClinica: null
  status: "RASCUNHO", consultavel: true, alerta: false, substitui: [],
  identidade: { tumor, cid10, subtipos: [], cenarios: [], limitesAplicabilidade: "Pack novo F1-B2 (D-F1-34/49): RASCUNHO de curadoria; nenhum conteúdo ativo; doses somente nas fichas com fonte (b2-fichas.v1.json)." },
  _slug: slug,
});

const fecha = (p, secoes) => {
  const { _slug, ...cab } = p;
  const pack = {
    ...cab,
    diagnostico: secoes.diagnostico,
    estadiamento: secoes.estadiamento,
    tratamento: secoes.tratamento,
    ligacoes: { exames: secoes.exames ?? [], interacoesConsultar: [], ctcaeAcao: [], suporteReceitas: [], orientacoes: [], encaminhamentos: [], laudos: [], formulasXYZ: [] },
    pendencias: secoes.pendencias,
    conflitos: secoes.conflitos,
    curadoria: { redator: "GLM (agente curador, missão F1-B2) — rascunho para revisão", redigidoEm: DIA, fontesLidas: secoes.fontesLidas, aprovacaoClinica: null, rodadaPendencias: [{ data: DIA, redator: "GLM", resolvidas: 0, classificadas: secoes.pendencias.length, susPreenchidos: 0, notas: ["D-F1-49: fichas institucionais novas sem SISAC; mudança de fonte não aprova doses"] }] },
    escopo: { classe: "EXPANSAO_F1_B2_SEM_SISAC", nota: "Pack novo da D-F1-34 construído na F1-B2 (D-F1-49) com fontes externas verificadas; conteúdo consultável em RASCUNHO, sem ativação clínica." },
    correcoes: [],
  };
  mkdirSync(join(RAIZ, "corpus", "6-pack-tumor", _slug), { recursive: true });
  writeFileSync(join(RAIZ, "corpus", "6-pack-tumor", _slug, `pack-${_slug}.v2.RASCUNHO.json`), JSON.stringify(pack, null, 2) + "\n", "utf8");
};

const EST_PEND = { sistema: "[VERIFICAR]", edicao: null, fonte: { tipo: "DECISAO_MEDICA", referencia: "Estadiamento específico pendente de curadoria (D-F1-34/49)", pagina: null, trecho: "", estado: "PENDENTE" }, exames: [], gruposConduta: [], marcadores: { uteis: [], naoPedirDeRotina: [] } };

// ============================== EWING ==============================
const ewing = base("ewing", "Sarcoma de Ewing (ósseo e extraósseo, incl. PNET)", ["C41.9", "C49.9"],
  "D-F1-34/D-F1-49 + eviQ 3464 v2 + Womer 2012 (PMID 23091096)", "VDC/IE interval-compressed");
fecha(ewing, {
  diagnostico: { imagem: [
    { catalogoId: "RM_LOCAL", rotulo: "RM do sítio primário com contraste", indicacao: "universal", quando: "Diagnóstico e planejamento de terapia local", fonte: fonte("SBOC 2026 ósseos v5 p. 15 (LOC-SBOC-OSSEOS)", "estadiamento local com RM") },
    { catalogoId: "TC_TORAX", rotulo: "TC de tórax", indicacao: "universal", quando: "Estadiamento (metástases pulmonares)", fonte: fonte("SBOC 2026 ósseos v5 p. 15", "TC de tórax no estadiamento") },
    { catalogoId: "CINTILOGRAFIA_OSSSEA", rotulo: "Cintilografia óssea ou PET-CT", indicacao: "universal", quando: "Estadiamento (doença óssea à distância)", fonte: fonte("SBOC 2026 ósseos v5 p. 15", "rastreio de metástases ósseas") },
  ], endoscopicos: [], patologico: { obtencao: [{ tipo: "biópsia", quando: "antes da terapia sistêmica", catalogoId: "BIOPSIA", fonte: fonte("SBOC 2026 ósseos v5", "diagnóstico por biópsia") }], laudoDeveConter: ["histologia (células pequenas redondas)", "imuno-histoquímica (CD99; EWSR1-FLI1 quando necessário)"], molecular: [] } },
  estadiamento: { ...EST_PEND, fonte: { ...EST_PEND.fonte, referencia: "AJCC/ENEA pendente de conferência (D-F1-49)" } },
  tratamento: {
    cenarios: [{ cenario: "localizado/metastático — 1ª linha", intencao: "curativa", modalidades: ["QT", "cirurgia", "RT"], criterio: "D-F1-34; SBOC p. 15", fonte: fonte("SBOC 2026 ósseos v5 p. 15", "VDC/IE dose-denso NE ALTO/FR FORTE") }],
    protocolos: [
      proto({ id: "ewing-vdc", nome: "VDC (braço A do VDC/IE, q14)", cenario: "1ª linha", linha: "1ª linha", drogas: [["vincristina", 1.5, "mg/m2", "EV", "D1", "máx 2 mg"], ["doxorrubicina", 37.5, "mg/m2", "EV", "D1–D2", "teto 375 mg/m2"], ["ciclofosfamida", 1200, "mg/m2", "EV", "D1", ""], ["mesna", 400, "mg/m2", "EV", "D1", "+ 800 VO 2h/6h"], ["pegfilgrastim", 6, "mg", "SC", "D3", ""]], cicloDias: 14, numeroCiclos: 7, fichaId: "FICHA.ewing.ewing-vdc-ciclo-a-alternado-ao-ie__1-linha-dose-denso-q14@1.0.0", fonte: fonte("eviQ 1916 v8 (EXT-SARC-002)", "VDC: quimio D1–2; pegfilgrastim D3"), observagem: "Componente repete a cada 28 d alternando com IE (administração a cada 14 d)." }),
      proto({ id: "ewing-ie", nome: "IE (braço B do VDC/IE, q14)", cenario: "1ª linha", linha: "1ª linha", drogas: [["etoposídeo", 100, "mg/m2", "EV", "D1–D5", ""], ["ifosfamida", 1800, "mg/m2", "EV", "D1–D5", "teto cumulativo ≤72 g/m2"], ["mesna", 600, "mg/m2", "EV", "D1–D5 (0/4/8 h)", ""]], cicloDias: 14, numeroCiclos: 7, fichaId: "FICHA.ewing.ewing-ie-ciclo-b-alternado-ao-vdc__1-linha-dose-denso-q14@1.0.0", fonte: fonte("eviQ 3465 v8 (EXT-SARC-003)", "IE: quimio D1–5; pegfilgrastim D6"), observagem: "Pegfilgrastim 6 mg SC D6 (na ficha)." }),
      proto({ id: "ewing-17ciclos", nome: "VDC/IE 17 ciclos (opção eviQ/AEWS1031)", cenario: "1ª linha selecionada", linha: "1ª linha", drogas: [["vide eviQ 3464", null, "", "", "", "9 V[D]C com vincristina D1+D8 alternando com 8 IE; VC (sem doxo) após teto"]], cicloDias: 14, fonte: fonte("eviQ 3464 v2 (EXT-SARC-001) + Leavey 2021 (PMID 34652968)", "9 cycles of V[D]C (vincristine day 1 and 8) alternating with 8 cycles of IE"), observagem: "SEM ficha (dossiê): condicionado à decisão local." }),
      proto({ id: "ewing-iritemo", nome: "Irinotecano + temozolomida (recidiva)", cenario: "recidiva/refratário", linha: "salvamento", drogas: [["irinotecano", 50, "mg/m2", "EV", "D1–D5", ""], ["temozolomida", 100, "mg/m2", "VO", "D1–D5", "≥1 h antes do irinotecano"]], cicloDias: 21, numeroCiclos: 6, fonte: fonte("eviQ 3620 v3 (EXT-SARC-005)", "temozolomide 100 mg/m²/d VO D1-5 + irinotecan 50 mg/m²/d IV D1-5") }),
      proto({ id: "ewing-tc", nome: "Topotecano + ciclofosfamida (recidiva)", cenario: "recidiva/refratário", linha: "salvamento", drogas: [["topotecano", 0.75, "mg/m2", "EV", "D1–D5", ""], ["ciclofosfamida", 250, "mg/m2", "EV", "D1–D5", ""]], cicloDias: 21, fonte: fonte("eviQ 4245 v2 INTERIM (EXT-SARC-006)", "topotecan 0.75 + cyclophosphamide 250 D1-5; pegfilgrastim D6"), observagem: "Protocolo INTERIM (base em abstract não publicado — aviso da própria eviQ)." }),
    ],
    radioterapia: [{ cenario: "terapia local", doseTotalGy: null, fracoes: null, pendencia: "dose de RT a definir com radioterapia (SBOC p. 15)", concomitante: false, fonte: fonte("SBOC 2026 ósseos v5 p. 15", "RT conforme terapia local"), fonteIndicacao: null }],
    cirurgia: [{ procedimento: "Ressecção do primário", quando: "após 6 ciclos de QT (≈ semana 11–13)", fonte: fonte("eviQ 3464/SAALT2W", "local therapy after 6 cycles") }],
    biomarcadorTratamento: [], ensaios: [], seguimento: [],
    suporte: { emetogenicidade: "alto (D-F1-30 local: ondansetrona 1ª linha, sem NK1)", riscoNeutropeniaFebril: "alto — G-CSF por braço (pegfilgrastim D3 VDC / D6 IE)", outros: ["teto de doxorrubicina 375 mg/m²", "cap de ifosfamida 72 g/m² (Fanconi renal)"], fonte: fonte("eviQ 1916/3465 + BC SAALT2W", "suporte por braço"), mesna: { regra: "conforme braço (ver fichas)", fonte: fonte("eviQ 1916/3465", "mesna por braço") } },
  },
  exames: ["RM_LOCAL", "TC_TORAX", "CINTILOGRAFIA_OSSSEA", "BIOPSIA", "ECOCARDIOGRAMA", "HEMOGRAMA", "CREATININA", "CLEARANCE_CREATININA"],
  pendencias: [
    pendencia("Desenho institucional SOnHe p. 314/317 (17 ciclos com doxorrubicina C1–C11 e dactinomicina C11–C17): NAO_LOCALIZADO externamente — sobreposição doxo+dactinomicina no mesmo ciclo não corroborada", "CONFLITO_FONTE", ["eviQ 3464/1916/3465", "BC SAALT2W", "PubMed (Grier/Whelan/Leavey/Womer)"]),
    pendencia("Versão convencional q3sem (eviQ: 'VDC or IE every 21 days') disponível como alternativa", "VARIANTE_NAO_PREPARADA", ["eviQ 1916/3465 notas", "SAALT3W"]),
    pendencia("Elegibilidade <30 anos (SAALT2W) e cautelas (LVEF<45%, CrCl<60) a conferir no serviço", "APLICABILIDADE", ["SAALT2W ELIGIBILITY"]),
  ],
  conflitos: [
    conflito("Suporte G-CSF por braço (ambiguidade local do pegfilgrastim D3)", fonte("material local (SOnHe/pesquisa interna)", "pegfilgrastim D3 sem delimitação de braço"), fonte("eviQ 1916/3465", "pegfilgrastim D3 no VDC e D6 no IE"), "Adotado por braço conforme eviQ (fichas Ewing VDC/IE)", false),
    conflito("Citação-base do dose-denso", fonte("material local", "'Whelan JCO 2018;36(31)'"), fonte("Womer 2012 (PMID 23091096)", "interval compression 14 vs 21 d, EFS 73% vs 65%"), "Corrigido: Whelan 2018 é Euro-E.W.I.N.G. 99 (BuMel vs VAI); base do q2sem é Womer 2012", false),
    conflito("Doxorrubicina por administração", fonte("eviQ 1916", "37,5 mg/m² ×2 D1–D2"), fonte("BC SAALT2W", "75 mg/m² IV push D1"), "Ficha preparada com 37,5×2 (eviQ); variante registrada", "Dr. Silas pode preferir push único"),
  ],
  fontesLidas: ["eviQ 3464/1916/3465 (HTML vivo + PDF)", "BC Cancer SAALT2W/SAALT3W", "Womer 2012, Leavey 2021, Cash 2023 (PubMed)", "SBOC 2026 ósseos v5", "SOnHe 2024 p. 314/317", "eviQ 3620/4245 (recidiva)"],
});

// ============================== OSTEOSSARCOMA ==============================
const osteo = base("osteossarcoma", "Osteossarcoma", ["C41.9"],
  "D-F1-34/D-F1-49 + SBOC 2026 ósseos v5 p. 12 + eviQ 1901 v6", "MAP e AP");
fecha(osteo, {
  diagnostico: { imagem: [
    { catalogoId: "RM_LOCAL", rotulo: "RM do primário com contraste", indicacao: "universal", quando: "Diagnóstico/planejamento (salto pulmonar)", fonte: fonte("SBOC ósseos v5 p. 12", "RM do sítio") },
    { catalogoId: "TC_TORAX", rotulo: "TC de tórax", indicacao: "universal", quando: "Estadiamento (metástases pulmonares)", fonte: fonte("SBOC ósseos v5 p. 12", "TC de tórax") },
  ], endoscopicos: [], patologico: { obtencao: [{ tipo: "biópsia", quando: "antes da QT", catalogoId: "BIOPSIA", fonte: fonte("SBOC ósseos v5", "biópsia pré-quimioterapia") }], laudoDeveConter: ["subtipo histológico", "resposta à neoadjuvância (necrose %)"], molecular: [] } },
  estadiamento: { ...EST_PEND },
  tratamento: {
    cenarios: [{ cenario: "alto grau, localizado — neoadjuvante/adjuvante", intencao: "curativa", modalidades: ["QT", "cirurgia"], criterio: "idade-limite local 40 anos (D-F1-50; SBOC p. 12 usava ≤25)", fonte: fonte("SBOC ósseos v5 p. 12", "MAP") }],
    protocolos: [
      proto({ id: "osteo-map-c14", nome: "MAP — ciclos 1–4", cenario: "neoadjuvante/adjuvante", linha: "1ª linha", drogas: [["doxorrubicina", 25, "mg/m2", "EV", "D1–D3", "eviQ: 37,5×2 (variante)"], ["cisplatina", 60, "mg/m2", "EV", "D1–D2", "em 2 h (eviQ 1901)"], ["metotrexato", 12000, "mg/m2", "EV", "D22 e D29", "4 h; máx 20 g"], ["folínico", 15, "mg/m2", "EV nas primeiras 4 doses; depois EV/VO", "24 h pós-MTX q6h", "continuar até MTX <0,1 µmol/L; dose/via conforme níveis"], ["pegfilgrastim", 6, "mg", "SC", "D4", "≥24 h após fim da doxo D3; condição temporal eviQ adaptada ao fracionamento SBOC/D-F1-50"]], cicloDias: 35, numeroCiclos: 4, fichaId: "FICHA.osteossarcoma.map-ciclos-1-4__nao-especificado@1.0.0", fonte: fonte("SBOC ósseos v5 p. 12 + eviQ 1901 v6 (EXT-SARC-004)", "cisplatin 60 D1-2; MTX D22/D29; folinic 15 q6h") }),
      proto({ id: "osteo-map-c56", nome: "MAP — ciclos 5–6 (sem cisplatina)", cenario: "adjuvante", linha: "1ª linha (finalização)", drogas: [["doxorrubicina", 25, "mg/m2", "EV", "D1–D3", ""], ["metotrexato", 12000, "mg/m2", "EV", "D15 e D22", ""], ["folínico", 15, "mg/m2", "EV nas primeiras 4 doses; depois EV/VO", "24 h pós-MTX q6h", "continuar até MTX <0,1 µmol/L; dose/via conforme níveis"], ["pegfilgrastim", 6, "mg", "SC", "D4", "≥24 h após fim da doxo D3; condição temporal eviQ adaptada ao fracionamento SBOC/D-F1-50"]], cicloDias: 28, numeroCiclos: 2, fichaId: "FICHA.osteossarcoma.map-ciclos-5-6-sem-cisplatina__nao-especificado@1.0.0", fonte: fonte("eviQ 1901 v6", "C5-6: 28 d, sem cisplatina, MTX semanas 3–4") }),
      proto({ id: "osteo-ap", nome: "AP (doxorrubicina + cisplatina)", cenario: "sem MTX", linha: "conforme idade/função renal", drogas: [["doxorrubicina", 75, "mg/m2", "EV", "D1", "considerar 60 se >40 a"], ["cisplatina", 100, "mg/m2", "EV", "D1", "2 h; 1 L NS + manitol 30 g + KCl"]], cicloDias: 21, fichaId: "FICHA.osteossarcoma.ap-doxorrubicina-cisplatina__nao-especificado@1.0.0", fonte: fonte("BC SAAVAP (EXT-SARC-015) + SBOC p. 12", "doxo 75 + cis 100 q21d") }),
      proto({ id: "osteo-ifep", nome: "Ifosfamida + etoposídeo (recidiva)", cenario: "recidiva/refratário", linha: "salvamento", drogas: [["etoposídeo", 150, "mg/m2", "EV", "D1–D3", ""], ["ifosfamida", 3000, "mg/m2", "EV", "D1–D3", "+ mesna"]], cicloDias: 21, fonte: fonte("BC SAAVIME3 rev 22/09/2026 (EXT-SARC-018)", "etoposide 150 + ifosfamide 3000 D1-3; bony incluído") }),
      proto({ id: "osteo-gemdoc", nome: "Gemcitabina + docetaxel (recidiva)", cenario: "recidiva/refratário", linha: "salvamento", drogas: [["gemcitabina", 900, "mg/m2", "EV", "D1 e D8", "90 min"], ["docetaxel", 75, "mg/m2", "EV", "D8", ""]], cicloDias: 21, fonte: fonte("eviQ 1898 v5 (EXT-SARC-007) + BC SAAVGEMD", "gem 900 D1/D8 + doc 75 D8; indicação oficial STS — extrapolação para ósseo declarada"), observagem: "Indicação oficial dos protocolos é sarcoma de partes moles." }),
      proto({ id: "osteo-regorafenibe", nome: "Regorafenibe (recidiva)", cenario: "metastático pré-tratado", linha: "≥2ª linha", drogas: [["regorafenibe", 160, "mg", "VO", "21 de 28 dias", "REGOBONE"]], cicloDias: 28, fonte: fonte("Duffaud Lancet Oncol 2019;20(1):120-33 (PMID 30477937)", "160 mg/day, 21 of 28 days") }),
      proto({ id: "osteo-pembro-msi", nome: "Pembrolizumabe (MSI-H/dMMR)", cenario: "metastático MSI-H/dMMR", linha: "conforme biomarcador", drogas: [["pembrolizumabe", 200, "mg", "EV", "D1 q21d", "ou 400 mg q42d"]], cicloDias: 21, fonte: fonte("eviQ 5066 (EXT-SARC-008) + BC UTAAVPEM6", "tumour-agnostic dMMR/MSI-H") }),
    ],
    radioterapia: [{ cenario: "excepcional (metástases/irressecável)", doseTotalGy: null, fracoes: null, pendencia: "a definir com radioterapia", concomitante: false, fonte: fonte("SBOC ósseos v5", "RT papel limitado") }],
    cirurgia: [{ procedimento: "Ressecção ampla do primário (± metástasectomia pulmonar)", quando: "entre os ciclos 2 e 3 (reinício 2–3 semanas após)", fonte: fonte("BC SANAHDMAP/eviQ 1901", "surgery between cycles 2-3") }],
    biomarcadorTratamento: [{ seAlvo: "MSI-H/dMMR", opcao: "pembrolizumabe", evidencia: "tumour-agnostic (eviQ 5066)", sus: "VERIFICAR", fonte: fonte("eviQ 5066", "dMMR/MSI-H") }], ensaios: [], seguimento: [],
    suporte: { emetogenicidade: "alto (D-F1-30 local)", riscoNeutropeniaFebril: "alto — G-CSF primário obrigatório (BC SANAHDMAP)", outros: ["monitorização de MTX: níveis h48 + diário até <0,1 µmol/L; pH urinário q6h; alcalinização (BC)", "audiometria (cisplatina — D-F1-31)", "ECG/ECO antes de antraciclina"], fonte: fonte("BC SANAHDMAP (EXT-SARC-014)", "G-CSF mandatory; MTX levels"), mesna: { regra: "n/a", fonte: fonte("—", "—") } },
  },
  exames: ["RM_LOCAL", "TC_TORAX", "BIOPSIA", "ECOCARDIOGRAMA", "AUDIOMETRIA", "HEMOGRAMA", "CREATININA", "CLEARANCE_CREATININA"],
  pendencias: [
    pendencia("Corte de idade RESOLVIDO por D-F1-50: 40 anos (eviQ >40; BC <40; EURAMOS ≤40; Onkopedia/AAOC <40 — 5 apoios externos; SBOC usava 25)", "RESOLVIDO_POR_DECISAO", ["D-F1-50"]),
    pendencia("Cisplatina 80 mg/m² (SOnHe): NAO_LOCALIZADO nas fontes externas", "CONFLITO_FONTE", ["eviQ 1901", "BC SANAHDMAP (50×2; 60×2 excepcional)", "EURAMOS (120/ciclo)"]),
    pendencia("Estrutura C5–6 sem cisplatina é do eviQ (SBOC descreve MAP sem separar) — confirmar adesão local", "VARIANTE", ["eviQ 1901 C5-6"]),
  ],
  conflitos: [
    conflito("Cisplatina no MAP", fonte("SBOC p. 12", "60 mg/m² D1–D2"), fonte("BC SANAHDMAP", "50×2 (60×2 excepcional); ensaios 120/ciclo"), "Ficha com 60×2 (SBOC = eviQ 1901)", false),
    conflito("Fracionamento de doxorrubicina", fonte("SBOC p. 12", "25 mg/m² D1–D3"), fonte("eviQ/BC/EURAMOS", "37,5 ×2 D1–D2 (mesmo total 75)"), "Ficha com 25×3 (SBOC); variante registrada", "Dr. Silas decide o fracionamento"),
    conflito("Resgate folínico do MTX", fonte("eviQ 1901", "15 mg/m² q6h"), fonte("BC SANAHDMAP", "25 mg fixa q6h"), "Ficha com 15 mg/m² (eviQ)", false),
  ],
  fontesLidas: ["SBOC 2026 ósseos v5 (p. 12, 14-15)", "eviQ 1901 (HTML v6 + PDF v5)", "BC SANAHDMAP/SAAVAP/SAAVIME3/SAAVGEMD", "Meyers 2005, Bielack 2015/2016, Winkler 1988, Bacci 2000, BCCA 2012 (tabela eviQ)", "Duffaud 2019", "SOnHe 2024 p. 313-318", "Aula 79"],
});

// ============================== CEC DE PELE ==============================
const cec = base("cec-pele", "Carcinoma epidermoide cutâneo (CEC) avançado", ["C44.9"],
  "D-F1-34/D-F1-49 + eviQ 4151 v5 + SOnHe p. 236-238", "cemiplimabe preferencial; QT por extrapolação");
fecha(cec, {
  diagnostico: { imagem: [
    { catalogoId: "TC_CERVICO_TORACICA", rotulo: "TC cabeça/pescoço região acometida (linfonodos regionais)", indicacao: "regional", quando: "estadiamento locorregional", fonte: fonte("SOnHe p. 237", "avaliação linfonodal") },
    { catalogoId: "TC_TORAX_ABDOME", rotulo: "TC tórax/abdome (metástases a distância)", indicacao: "avançado", quando: "antes de terapia sistêmica", fonte: fonte("SOnHe p. 237", "estadiamento à distância") },
  ], endoscopicos: [], patologico: { obtencao: [{ tipo: "biópsia", quando: "confirmação histológica", catalogoId: "BIOPSIA", fonte: fonte("SOnHe p. 236", "biópsia") }], laudoDeveConter: ["histologia epidermoide", "grau", "profundidade/invasão perineural"], molecular: [] } },
  estadiamento: { ...EST_PEND },
  tratamento: {
    cenarios: [
      { cenario: "localmente avançado/metastático inelegível a cirurgia/RT curativas", intencao: "paliativa/controle", modalidades: ["imunoterapia"], criterio: "eviQ 4151", fonte: fonte("eviQ 4151 v5 (EXT-CNV-001)", "mCSCC or laCSCC not candidates for curative surgery or radiation") },
      { cenario: "QT sistêmica (alternativa)", intencao: "paliativa", modalidades: ["QT"], criterio: "EXTRAPOLAÇÃO de CECP (eviQ 3579/1948)", fonte: fonte("eviQ 3579 (EXT-CNV-008)", "head and neck SCC recurrent or metastatic") },
    ],
    protocolos: [
      proto({ id: "cec-cemiplimabe", nome: "Cemiplimabe", cenario: "laCSCC/mCSCC inelegível a terapia curativa", linha: "1ª linha", drogas: [["cemiplimabe", 350, "mg", "EV", "D1 q21d", "50 mL SF; 30 min; filtro 0,2–5 µm"]], cicloDias: 21, fichaId: "FICHA.cec-de-pele-cutaneo.cemiplimabe__localmente-avancado-metastatico-inelegivel-a-cirurgia-rt-curativas@1.0.0", fonte: fonte("eviQ 4151 v5 + BC SMAVCEM + DailyMed LIBTAYO", "350 mg IV q21d over 30 minutes"), premedicacao: "sem pré-medicação de rotina (eviQ/BC)", observagem: "Migden NEJM 2018;379(4):341-351 e Lancet Oncol 2020;21(2):294-305 (pivôs)." }),
      proto({ id: "cec-carbopac", nome: "Carboplatina + paclitaxel", cenario: "QT sistêmica", linha: "alternativa", drogas: [["paclitaxel", 175, "mg/m2", "EV", "D1", "3 h"], ["carboplatina", 5, "AUC", "EV", "D1", "Calvert"]], cicloDias: 21, numeroCiclos: 6, fichaId: "FICHA.cec-de-pele-cutaneo.carboplatina-paclitaxel-21-21-dias-cec-de-pele__nao-especificado@1.0.0", fonte: fonte("eviQ 3579 (população CECP R/M — EXTRAPOLAÇÃO)", "paclitaxel 175/3h + carbo AUC5") }),
      proto({ id: "cec-pembro", nome: "Pembrolizumabe", cenario: "laCSCC/mCSCC inelegível a terapia curativa", linha: "1ª linha (alternativa ao cemiplimabe)", drogas: [["pembrolizumabe", 200, "mg", "EV", "D1 q21d", "ou 400 mg q42d; ≤24 meses"]], cicloDias: 21, fichaId: "FICHA.cec-de-pele-cutaneo.pembrolizumabe__localmente-avancado-metastatico-inelegivel-a-cirurgia-rt-curativas@1.0.0", fonte: fonte("eviQ 5066 (EXT-SARC-008) + NCCN CSCC v1.2026 (rodada v2) + D-F1-50", "200 mg q21d/400 mg q42d; preferred 2A com cemiplimabe"), premedicacao: "sem pré-medicação de rotina", observagem: "KEYNOTE-629 (PMID 34293460): ORR 50% LA / 35% met. FDA aprovado; EMA NÃO aprovou p/ CEC cutâneo (ressalva regulatória)." }),
      proto({ id: "cec-cis-rt", nome: "Cisplatina semanal + RT", cenario: "localmente avançado", linha: "concomitante", drogas: [["cisplatina", 40, "mg/m2", "EV", "semanal com RT", ""]], cicloDias: 7, fonte: fonte("eviQ 292 v10 (EXT-CNV-016; CECP — EXTRAPOLAÇÃO)", "40 mg/m² weekly with RT"), fichaId: "FICHA.cec-de-pele-cutaneo.cisplatina-semanal-rxt-cec-de-pele__concomitante-a-rt@1.0.0" }),
      proto({ id: "cec-pac-semanal", nome: "Paclitaxel semanal (alternativa)", cenario: "QT sistêmica", linha: "alternativa", drogas: [["paclitaxel", 80, "mg/m2", "EV", "q7d contínuo", ""]], cicloDias: 7, fonte: fonte("eviQ 1948 (EXT-CNV-009; CECP)", "80 mg/m² weekly") }),
    ],
    radioterapia: [{ cenario: "adjuvante/definitiva", doseTotalGy: null, fracoes: null, pendencia: "esquema com radioterapia", concomitante: true, fonte: fonte("SOnHe p. 237-238", "RT conforme cenário") }],
    cirurgia: [{ procedimento: "Cirurgia do primário/linfonodos (quando elegível)", quando: "antes de terapia sistêmica se curativa", fonte: fonte("SOnHe p. 236", "cirurgia quando possível") }],
    biomarcadorTratamento: [], ensaios: [], seguimento: [],
    suporte: { emetogenicidade: "baixa (imunoterapia)/moderada (QT)", riscoNeutropeniaFebril: "conforme esquema", outros: ["manejo de toxicidade imune (tiroidite, colite, hepatite, pneumonite) — orientar reconhecimento precoce"], fonte: fonte("eviQ 4151 + BC SMAVCEM", "immune-related AEs") },
  },
  exames: ["BIOPSIA", "TC_CERVICO_TORACICA", "TC_TORAX_ABDOME", "HEMOGRAMA", "CREATININA", "TSH"],
  pendencias: [
    pendencia("Cisplatina 100 mg/m² q21d monoterapia: NAO_LOCALIZADO como protocolo operacional (eviQ 288 reduz a 75 em combinação; BC HNAVP 25×2)", "NAO_LOCALIZADO", ["eviQ índice", "BC Cancer", "CCO inacessível (403)"]),
    pendencia("Extrapolação CECP→CEC cutâneo para QT citotóxica exige aceite explícito", "DECISAO_MEDICA_PENDENTE", ["eviQ 3579/292/1948 (populações CECP)"]),
    pendencia("Pembrolizumabe no CEC: 'não encontrado' na busca local (não é afirmação de ausência de indicação)", "BUSCA_LOCAL_NEGATIVA", ["materiais locais 2026-10-14"]),
  ],
  conflitos: [
    conflito("População dos protocolos de QT", fonte("eviQ 3579/292/1948", "carcinoma espinocelular de cabeça e pescoço"), fonte("SOnHe p. 236-238", "CEC de pele"), "Fichas marcadas EXTRAPOLAÇÃO explícita", "Dr. Silas aceita ou recusa a extrapolação"),
    conflito("Fascículo do pivô do cemiplimabe", fonte("material local", "Lancet Oncol 2020 (fascículo 7)"), fonte("PubMed 31952975", "Lancet Oncol 2020;21(2):294-305"), "Corrigido na citação do pack/ficha", false),
  ],
  fontesLidas: ["eviQ 4151 (HTML vivo v5 + PDF)", "BC SMAVCEM", "DailyMed LIBTAYO SPL", "eviQ 3579/292/1948/288", "BC HNAVPC/HNAVPE/SMMCCPE/HNNLAPRT/HNLACARTW", "Migden 2018/2020 (PubMed)", "SOnHe 2024 p. 236-238", "Sv-Sau-EB p. 197-199"],
});

// ============================== NTG ==============================
const ntg = base("ntg", "Neoplasia trofoblástica gestacional (NTG)", ["D39.2", "C58"],
  "D-F1-34/D-F1-49 + Lok 2025 (DOI 10.1200/JCO-24-02326) + eviQ 668/1018/599/1378/1347", "escore FIGO 2000 dirige o tratamento");
fecha(ntg, {
  diagnostico: { imagem: [
    { catalogoId: "USG_PELVICA", rotulo: "Ultrassonografia pélvica/transvaginal", indicacao: "universal", quando: "seguimento pós-mola e estadiamento local", fonte: fonte("Lok 2025 + eviQ 668", "ultrasound in GTD follow-up") },
    { catalogoId: "TC_TORAX_ABDOME", rotulo: "TC tórax/abdome/pelve", indicacao: "antes de multiagente", quando: "estadiamento de alto risco", fonte: fonte("Lok 2025", "staging high-risk") },
    { catalogoId: "RM_CRANIO", rotulo: "RM de crânio", indicacao: "alto risco/sintomas", quando: "rastreio de metástase SNC", fonte: fonte("Lok 2025 (Fig A4 área SNC)", "CNS imaging when indicated") },
  ], endoscopicos: [], patologico: { obtencao: [{ tipo: "curetagem/histerectomia conforme cenário", quando: "conforme decisão", catalogoId: "ANATOMOPATOLOGICO", fonte: fonte("Lok 2025", "histology where feasible") }], laudoDeveConter: ["β-hCG pré-tratamento", "escore FIGO 2000 e grupo de risco"], molecular: [] } },
  estadiamento: { sistema: "FIGO/OMS 2000 (escore de risco + estádio)", edicao: "2000", fonte: fonte("Lok 2025 (metodologia)", "FIGO 2000 scoring confirmed"), exames: [], gruposConduta: [
    { grupo: "baixo risco (escore FIGO 0–4, D-F1-50; eviQ/Lok ≤6 como variante)", conduta: "monoterapia (MTX 50 mg fixa + folínico 7,5 mg, ou dactinomicina)", fonte: fonte("BC GOTDLRM + D-F1-50", "score 0-4 single agent") },
    { grupo: "alto risco (escore ≥7)", conduta: "EMA-CO", fonte: fonte("eviQ 599", "score ≥7 EMA-CO") },
    { grupo: "resistência ao EMA-CO", conduta: "EMA/EP", fonte: fonte("Lok 2025 Tabela A5/Fig A4", "EMA/EP; day 2 EA omitted") },
    { grupo: "ultra-alto (escore FIGO ≥12, D-F1-50; Lok ≥13 como variante)", conduta: "EP de indução", fonte: fonte("eviQ 1347 + D-F1-50", "low-dose EP induction") },
  ], marcadores: { uteis: [{ catalogoId: "BETA_HCG", uso: "diagnóstico, seguimento e consolidação", fonte: fonte("eviQ 668", "hCG normalization +3 cycles") }], naoPedirDeRotina: [] } },
  tratamento: {
    cenarios: [{ cenario: "pós-mola com β-hCG em plateau/subida", intencao: "curativa", modalidades: ["QT"], criterio: "escore FIGO 2000", fonte: fonte("Lok 2025", "treatment by risk score") }],
    protocolos: [
      proto({ id: "ntg-mtx-fa", nome: "Metotrexato + ácido folínico (baixo risco)", cenario: "baixo risco", linha: "1ª linha", drogas: [["metotrexato", 50, "mg", "IM", "D1,3,5,7", "variante 1 mg/kg (Lok/Charing Cross)"], ["ácido folínico", 7.5, "mg", "VO", "D2,4,6,8", "24 h pós-MTX (BC: 30 h)"]], cicloDias: 14, fichaId: "FICHA.neoplasia-trofoblastica-gestacional.metotrexato-acido-folinico-baixo-risco__baixo-risco-escore-figo-0-4-d-f1-50@1.0.0", fonte: fonte("D-F1-50 item 7 (DECISOES.md); Charing Cross clássico", "MTX 50 mg D1,3,5,7 + ácido folínico 7,5 mg D2,4,6,8; variante local selecionada"), ajuste: "Consolidar 3 ciclos além da normalização do β-hCG." }),
      proto({ id: "ntg-actd", nome: "Dactinomicina em pulso (baixo risco)", cenario: "baixo risco", linha: "alternativa/resistência a MTX", drogas: [["dactinomicina", 1.25, "mg/m2", "EV", "D1 q14d", "cap 2 mg"]], cicloDias: 14, fichaId: "FICHA.neoplasia-trofoblastica-gestacional.dactinomicina-em-pulso-baixo-risco__baixo-risco-escore-figo-0-4-d-f1-50@1.0.0", fonte: fonte("eviQ 1018 + Lok A5", "1.25 mg/m² IV bolus max 2 mg q2w") }),
      proto({ id: "ntg-emaco", nome: "EMA-CO (alto risco)", cenario: "alto risco ≥7", linha: "1ª linha", drogas: [["etoposídeo", 100, "mg/m2", "EV", "D1–D2", ""], ["metotrexato", 300, "mg/m2", "EV", "D1", "12 h"], ["dactinomicina", 0.5, "mg", "EV", "D1–D2", ""], ["vincristina", 0.8, "mg/m2", "EV", "D8", "cap 2 mg"], ["ciclofosfamida", 600, "mg/m2", "EV", "D8", ""]], cicloDias: 14, fichaId: "FICHA.neoplasia-trofoblastica-gestacional.ema-co-alto-risco__alto-risco-escore-figo-7@1.0.0", fonte: fonte("eviQ 599 v8 + D-F1-50 item 7 (vincristina BC/Lok)", "EMA D1-2; CO D8; vincristina local 0,8 mg/m², cap 2 mg; folínico q12h x4 em D2-D3") }),
      proto({ id: "ntg-emaep", nome: "EMA/EP (resistência ao EMA-CO)", cenario: "resistente ao EMA-CO", linha: "2ª linha", drogas: [["dactinomicina", 0.5, "mg", "EV", "D1", ""], ["etoposídeo", 100, "mg/m2", "EV", "D1", "no D8: 150"], ["metotrexato", 300, "mg/m2", "EV", "D1", "12 h"], ["cisplatina", 75, "mg/m2", "EV", "D8", ""]], cicloDias: 14, fichaId: "FICHA.neoplasia-trofoblastica-gestacional.ema-ep-resistencia-ao-ema-co__resistente-ao-ema-co@1.0.0", fonte: fonte("Lok 2025 Tabela A5 + Figura A4 (EXT-CNV-031) + eviQ 1378", "D2 only leucovorin; day 2 EA omitted"), ajuste: "Folínico 15 mg VO a cada 12 h, quatro doses em D2-D3 (+24/+36/+48/+60 h após início do MTX); D2 sem EA." }),
      proto({ id: "ntg-ep-inducao", nome: "EP de indução (ultra-alto)", cenario: "escore alto/ultra-alto", linha: "indução", drogas: [["etoposídeo", 100, "mg/m2", "EV", "D1–D2 semanal", ""], ["cisplatina", 20, "mg/m2", "EV", "D1–D2 semanal", ""]], cicloDias: 7, fichaId: "FICHA.neoplasia-trofoblastica-gestacional.ep-de-inducao-escore-ultra-alto__escore-alto-ultra-alto-figo-12-d-f1-50-inducao@1.0.0", fonte: fonte("eviQ 1347 v5 + Lok A5", "etoposide 100 + cisplatin 20 D1-2; once weekly") }),
    ],
    radioterapia: [], cirurgia: [{ procedimento: "Histerectomia (selecionada)", quando: "resistência localizada/controle de sangramento", fonte: fonte("Lok 2025", "surgery in selected cases") }],
    biomarcadorTratamento: [], ensaios: [], seguimento: [{ periodo: "após normalização do β-hCG", exames: ["BETA_HCG"], periodicidade: "conforme protocolo de consolidação + seguimento estendido", fonte: fonte("eviQ 668/599", "3 cycles beyond normal hCG") }],
    suporte: { emetogenicidade: "moderada/alta conforme bloco (D-F1-30 local)", riscoNeutropeniaFebril: "alto no EMA-CO/EMA-EP", outros: ["filgrastim D3–5 e D9–11 no EMA-CO (eviQ)", "resgate folínico obrigatório após MTX 300"], fonte: fonte("eviQ 599", "G-CSF and folinic rescue") },
  },
  exames: ["BETA_HCG", "USG_PELVICA", "TC_TORAX_ABDOME", "RM_CRANIO", "HEMOGRAMA", "CREATININA", "CLEARANCE_CREATININA"],
  pendencias: [
    pendencia("Corte de ultra-alto risco: ≥13 (Lok) × ≥12 (eviQ 1347)", "CONFLITO_FONTE", ["Lok 2025 High/Ultrahigh-risk", "eviQ 1347 Indications"]),
    pendencia("Cortes de baixo risco: ≤6 (eviQ/Lok) × 0–4 (BC GOTDLRM/GOTDLRA; 5–6 = 'moderado')", "CONFLITO_FONTE", ["eviQ 668/1018", "BC GOTDLRM"]),
    pendencia("Anticoncepção durante e após o tratamento — orientação e duração", "CONDUTA", ["Lok 2025"]),
  ],
  conflitos: [
    conflito("EMA/EP dia 2 (erro dos slides locais)", fonte("slides/aula local", "EMA/EP com EA no D2"), fonte("Lok 2025 Tabela A5 + Figura A4", "day 2 EA should be omitted — only leucovorin"), "RESOLVIDO: ficha EMA/EP com D2 somente folínico", false),
    conflito("Dose do MTX de baixo risco", fonte("Aula 31 (Charing Cross)", "1 mg/kg IM"), fonte("eviQ 668/Lok A5", "50 mg fixa (ou 1 mg/kg)"), "Ficha com 50 mg fixa; variante registrada", false),
    conflito("Vincristina do EMA-CO", fonte("eviQ 599", "1 mg/m² cap 2"), fonte("BC GOTDEMACO/Lok", "0,8 mg/m²"), "RESOLVIDO D-F1-50 item 7: ficha e pack com 0,8 mg/m² (BC/Lok); eviQ 1 mg/m² é variante não adotada", false),
  ],
  fontesLidas: ["Lok 2025 (DOI 10.1200/JCO-24-02326; cópias ORBi+Radboud, dupla leitura)", "eviQ 668/1018/599/1378/1347 (HTML+PDF)", "BC GOTDLRM/GOTDLRA/GOTDEMACO", "Berkowitz 2009 (referência Sv-Sau-EB)", "Aula 31", "Sv-Sau-EB p. 162-164"],
});

// ============================== VULVA ==============================
const vulva = base("vulva", "Carcinoma epidermoide de vulva", ["C51.9"],
  "D-F1-35/D-F1-49 + eviQ 1529 v9 + BC GOCXCRT/GOCXCAT", "cisplatina semanal + RT; carboplatina/paclitaxel q21d");
fecha(vulva, {
  diagnostico: { imagem: [
    { catalogoId: "EXAME_CLINICO_GINECOLOGICO", rotulo: "Exame clínico-ginecológico com biópsia", indicacao: "universal", quando: "diagnóstico", fonte: fonte("SOnHe p. 89", "exame + biópsia") },
    { catalogoId: "TC_PELVE", rotulo: "TC/MR pélvica (linfonodos inguino-femorais)", indicacao: "avançado", quando: "planejamento terapêutico", fonte: fonte("SOnHe p. 89", "imagem linfonodal") },
  ], endoscopicos: [], patologico: { obtencao: [{ tipo: "biópsia incisional", quando: "antes do tratamento", catalogoId: "BIOPSIA", fonte: fonte("SOnHe p. 89", "biópsia") }], laudoDeveConter: ["histologia", "HPV quando aplicável"], molecular: [] } },
  estadiamento: { sistema: "FIGO 2021 (vulva)", edicao: "2021", fonte: fonte("SOnHe p. 89 [VERIFICAR edição]", "estadiamento FIGO"), exames: [], gruposConduta: [
    { grupo: "localmente avançado (T3/T4 irressecável)", conduta: "quimiorradioterapia com cisplatina semanal", fonte: fonte("eviQ 1529 + GOG 205 (Moore 2012)", "weekly cisplatin + RT") },
    { grupo: "recorrente/metastático inelegível a QRT", conduta: "carboplatina + paclitaxel q21d", fonte: fonte("BC GOCXCAT (inclui vulva)", "CARBO+AUC/PACL 175") },
  ], marcadores: { uteis: [], naoPedirDeRotina: [] } },
  tratamento: {
    cenarios: [
      { cenario: "localmente avançado", intencao: "controle locorregional", modalidades: ["QT+RT"], criterio: "D-F1-35", fonte: fonte("eviQ 1529 v9", "Vulval SCC locally advanced cisPlatin weekly chemoradiation") },
      { cenario: "recorrente/avançado sem QRT", intencao: "paliativa", modalidades: ["QT"], criterio: "D-F1-35", fonte: fonte("BC GOCXCAT", "cervix, vulva, or vagina; recurrent or IIIb-IVb") },
    ],
    protocolos: [
      proto({ id: "vulva-cis-rt", nome: "Cisplatina semanal + RT", cenario: "localmente avançado", linha: "1ª linha (concomitante)", drogas: [["cisplatina", 40, "mg/m2", "EV", "D1 q7d com RT", "5–6 ciclos; no dia de RT"]], cicloDias: 7, fichaId: "FICHA.vulva.cisplatina-semanal-rxt-vulva__concomitante-a-rt@1.0.0", fonte: fonte("eviQ 1529 v9 (EXT-CNV-021) + BC GOCXCRT", "40 mg/m² IV weekly with RT") }),
      proto({ id: "vulva-carbopac", nome: "Carboplatina + paclitaxel q21d", cenario: "recorrente/avançado", linha: "1ª linha paliativa", drogas: [["paclitaxel", 175, "mg/m2", "EV", "D1", "3 h"], ["carboplatina", 6, "AUC", "EV", "D1", "AUC 5 se RT prévia extensa (GOCXCAT)"]], cicloDias: 21, numeroCiclos: 6, fichaId: "FICHA.vulva.carboplatina-paclitaxel-21-21-dias-vulva__nao-especificado@1.0.0", fonte: fonte("BC GOCXCAT rev 10/2025 (EXT-CNV-024) + SOnHe p. 89/91", "PACL 175 3h + CARBO AUC 6 (5 if prior RT)") }),
    ],
    radioterapia: [{ cenario: "localmente avançado", doseTotalGy: 57.6, fracoes: 32, pendencia: "fração 1,8 Gy ×32 (GOG 205); D-F1-50 ancorou a dose — replanejamento fino com radioterapia", concomitante: true, fonte: fonte("Moore 2012 — GOG 205 (PMID 22079361); D-F1-50", "57,6 Gy (1,8 Gy × 32) + cisplatina 40 mg/m² semanal (máx 7 semanas)") }],
    cirurgia: [{ procedimento: "Reavalição cirúrgica pós-QRT (ressecção de resíduo)", quando: "após quimiorradioterapia", fonte: fonte("eviQ 1529 + GOG 205", "surgical assessment after CRT") }],
    biomarcadorTratamento: [], ensaios: [], seguimento: [],
    suporte: { emetogenicidade: "baixa-moderada (cisplatina semanal 40)", riscoNeutropeniaFebril: "moderado", outros: ["CrCl >50-60 requerido (eviQ 1529/GOCXCRT)", "neuropatia/otoaudiologia prévia (cautelas eviQ)"], fonte: fonte("eviQ 1529 + GOCXCRT", "cautions") },
  },
  exames: ["BIOPSIA", "TC_PELVE", "HEMOGRAMA", "CREATININA", "CLEARANCE_CREATININA"],
  pendencias: [
    pendencia("Variante de AUC na carboplatina (6 × 5) e paclitaxel (175 × outras) — decisão local pendente", "DECISAO_MEDICA_PENDENTE", ["GOCXCAT (AUC 6→5)", "SOnHe p. 89/91 (AUC 5)", "eviQ 3579 (HNSCC, AUC 5)"]),
    pendencia("Dose total de RT do esquema concomitante — definir com radioterapia", "PENDENCIA_TECNICA", ["Moore 2012 (esquema ~40 Gy em frações?) — ler texto integral"]),
  ],
  conflitos: [
    conflito("Atribuição do estudo de referência da QRT", fonte("material local (Sv-Sau-EB)", "'Gill Gynecol Oncol 2015 (GOG 205?)'"), fonte("PubMed 22079361", "Moore DH et al., Gynecol Oncol 2012;124(3):529-33 (GOG 205)"), "Corrigido: GOG 205 = Moore 2012", false),
    conflito("AUC da carboplatina", fonte("BC GOCXCAT", "AUC 6; AUC 5 se RT prévia extensa"), fonte("SOnHe p. 89/91", "AUC 5 + 175"), "Ficha com AUC 6 (protocolo que inclui vulva); variante registrada", "Dr. Silas decide a variante"),
  ],
  fontesLidas: ["eviQ 1529 (HTML vivo v9 + PDF v6 arquivado)", "BC GOCXCRT/GOCXCAT (rev 08/2026 e 10/2025)", "Moore 2012 (GOG 205, PMID 22079361)", "eviQ 3579", "SOnHe p. 89-91", "Aula 32", "Sv-Sau-EB p. 143"],
});

// ============================== CUP ==============================
const cup = base("cup", "Carcinoma de primário desconhecido (CUP)", ["C80.9", "C77"],
  "D-F1-36/D-F1-49 + BC PUCAT + estudos originais (Greco/Mukai/Pouessel/Khansur)", "5 esquemas da decisão local");
fecha(cup, {
  diagnostico: { imagem: [
    { catalogoId: "TC_TORAX_ABDOME_PELVE", rotulo: "TC tórax/abdome/pelve", indicacao: "universal", quando: "investigação inicial padronizada", fonte: fonte("ESMO 2015/2023 (contexto)", "imaging-based standardized workup") },
    { catalogoId: "PET_CT_FDG", rotulo: "PET-CT (selecionados)", indicacao: "selecionados", quando: "quando pode mudar conduta", fonte: fonte("NCI PDQ (EXT-CUP-016)", "PET in selected CUP") },
  ], endoscopicos: [], patologico: { obtencao: [{ tipo: "biópsia do sítio acessível", quando: "diagnóstico", catalogoId: "BIOPSIA", fonte: fonte("NCI PDQ", "biopsy for diagnosis") }], laudoDeveConter: ["histologia", "imuno-histoquímica direcionada", "predictive biomarkers (quando aplicável)"], molecular: [] } },
  estadiamento: { ...EST_PEND },
  tratamento: {
    cenarios: [
      { cenario: "CUP de bom prognóstico/adenocarcinoma", intencao: "paliativa", modalidades: ["QT dupla"], criterio: "D-F1-36 (5 esquemas) ajustada pela D-F1-50 (retirada de cisplatina+vinorelbina — 4 esquemas)", fonte: fonte("D-F1-36 + D-F1-50", "lista decide esquemas, não doses") },
      { cenario: "CUP escamoso (investigação H&N completa negativa)", intencao: "paliativa", modalidades: ["QT"], criterio: "população de Khansur", fonte: fonte("Khansur 1995 (PMID 7743377)", "metastatic squamous cell carcinoma from unknown primary") },
    ],
    protocolos: [
      proto({ id: "cup-cis-doc", nome: "Cisplatina + docetaxel", cenario: "não especificado", linha: "conforme seleção", drogas: [["docetaxel", 75, "mg/m2", "EV", "D1", ""], ["cisplatina", 75, "mg/m2", "EV", "D1", ""]], cicloDias: 21, numeroCiclos: 8, fichaId: "FICHA.primario-desconhecido-cup.cisplatina-docetaxel__nao-especificado@1.0.0", fonte: fonte("Greco 2000 (PMID 10761758; EXT-CUP-001)", "docetaxel 75 + cisplatin 75 every three weeks; max 8"), observagem: "Variante Mukai (60/80) registrada na ficha." }),
      proto({ id: "cup-carbo-pac", nome: "Carboplatina + paclitaxel", cenario: "não especificado", linha: "conforme seleção", drogas: [["paclitaxel", 200, "mg/m2", "EV", "D1 (primeiro)", "3 h"], ["carboplatina", 6, "AUC", "EV", "D1", "Calvert; GFR cap 125"]], cicloDias: 21, fichaId: "FICHA.primario-desconhecido-cup.carboplatina-paclitaxel-21-21-dias__nao-especificado@1.0.0", fonte: fonte("BC PUCAT rev 12/2024 (EXT-CUP-004) + HeCOG (PMID 10963638)", "paclitaxel first + CARBO AUC 6; G-CSF D5-12 no estudo") }),
      proto({ id: "cup-doc-gem", nome: "Docetaxel + gemcitabina", cenario: "não especificado", linha: "conforme seleção", drogas: [["gemcitabina", 1000, "mg/m2", "EV", "D1 e D8", "30 min"], ["docetaxel", 75, "mg/m2", "EV", "D8", ""]], cicloDias: 21, numeroCiclos: 6, fichaId: "FICHA.primario-desconhecido-cup.docetaxel-gemcitabina__nao-especificado@1.0.0", fonte: fonte("Pouessel 2004 (PMID 15022294; EXT-CUP-009)", "gemcitabine D1/D8 + docetaxel D8 q3w") }),
      proto({ id: "cup-cis-5fu", nome: "Cisplatina + 5-FU (CUP escamoso)", cenario: "escamoso metastático (primário oculto)", linha: "conforme seleção", drogas: [["cisplatina", 100, "mg/m2", "EV", "D1", ""], ["fluoruracila", 1000, "mg/m2", "EV", "D1–D4 CI", "24 h/dia (96 h)"]], cicloDias: 21, fichaId: "FICHA.primario-desconhecido-cup.cisplatina-5-fluorouracil-cup-escamoso__escamoso-metastatico-primario-oculto@1.0.0", fonte: fonte("Khansur 1995 (PMID 7743377)", "cisplatin 100 D1 + 5-FU 1000 mg/m²/d ×4") }),
    ],
    radioterapia: [{ cenario: "linfonodos cervicais (suspeita de primário oculto H&N)", doseTotalGy: null, fracoes: null, pendencia: "fora do escopo D-F1-36", concomitante: false, fonte: fonte("NCI PDQ", "RT in nodal subsets") }],
    cirurgia: [], biomarcadorTratamento: [], ensaios: [], seguimento: [],
    suporte: { emetogenicidade: "alta com cisplatina (D-F1-30 local)", riscoNeutropeniaFebril: "conforme dupla", outros: ["hidratação e Mg/K da cisplatina (padrão local)"], fonte: fonte("padrão local D-W9-34d", "suporte locais") },
  },
  exames: ["BIOPSIA", "TC_TORAX_ABDOME_PELVE", "PET_CT_FDG", "HEMOGRAMA", "CREATININA", "CLEARANCE_CREATININA"],
  pendencias: [
    pendencia("Cisplatina + vinorelbina: RETIRADA da lista por D-F1-50 (fonte direta NAO_LOCALIZADA após 7 estratégias — registro de buscas preservado: PubMed, ClinicalTrials.gov, eviQ, BC, CCO-403, NCI PDQ, ESMO íntegra; tripla Palmeri não é derivável)", "RETIRADA_POR_DECISAO", ["PubMed", "ClinicalTrials.gov", "eviQ", "BC", "NCI PDQ", "ESMO 2023 íntegra"]),
    pendencia("Full text ESMO 2023 (PMID 36563965) e 2015 (PMID 26314775) bloqueados (403/Cloudflare) — registros PubMed retidos", "ACESSO", ["academic.oup.com", "annalsofoncology.org"]),
    pendencia("Escolha de variantes (75/75 × 60/80; 200/AUC6 × 175/AUC5) pendente de decisão", "DECISAO_MEDICA_PENDENTE", ["Greco vs Mukai", "PUCAT/HeCOG vs SOnHe"]),
  ],
  conflitos: [
    conflito("Doses de cisplatina+docetaxel", fonte("Greco 2000", "75/75 q3sem (n=26)"), fonte("Mukai 2010", "doc 60 + cis 80 (n=45)"), "Ficha com Greco 75/75; variante registrada", "Dr. Silas decide"),
    conflito("Variante de carboplatina+paclitaxel", fonte("BC PUCAT/HeCOG", "paclitaxel 200 + AUC 6"), fonte("SOnHe p. 379 (local)", "175 + AUC 5"), "Ficha com PUCAT (protocolo institucional específico de CUP); variante registrada", "Dr. Silas decide"),
    conflito("Dupla cisplatina+vinorelbina vs tripla", fonte("decisão local D-F1-36", "dupla cis+vinorelbina"), fonte("Palmeri 2006 (PMID 17109447)", "tripla cis+gem+vin"), "Não derivado: ficha-dossiê com doses NAO_LOCALIZADO", "Fonte direta da dupla ou alteração da lista"),
    conflito("População do cis+5-FU", fonte("Khansur 1995", "escamoso com investigação H&N negativa (n=15)"), fonte("eviQ 288 (operacional)", "população H&N R/M; cis 75"), "Ficha restrita ao cenário escamoso; generalização proibida", false),
  ],
  fontesLidas: ["Greco 2000, Mukai 2003/2010, Briasoulis 2000, Hayashi 2019, Huebner 2009, Pouessel 2004, Khansur 1995, Palmeri 2006 (PubMed efetch)", "BC PUCAT (protocolo+PPPO) e índice Primary Unknown", "eviQ 288 (PDF v5)", "Fizazi 2015 / Krämer 2023 (registros)", "NCI PDQ", "HemOnc (triangulação)", "ESMO 2015/2023 (contexto)"],
});

console.log("6 packs B2 gravados em corpus/6-pack-tumor/{ewing,osteossarcoma,cec-pele,ntg,vulva,cup}");
