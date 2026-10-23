/**
 * Combinações curadas a partir do acervo local 21st.dev (outputs/21st-codigos).
 * Apenas preferência visual e agrupamento ergonômico de UI — nenhum dado ou regra clínica.
 */

export type Combinacao21stId =
  | "violet-halo"
  | "accessible-teal"
  | "violet-dusk-linen"
  | "amber-glow";

export type GrupoConsultaId =
  | "consulta-fase2"
  | "consulta-documentos"
  | "consulta-revisao"
  | "consulta-medicamentos"
  | "consulta-sintese";

export interface Combinacao21stMeta {
  id: Combinacao21stId;
  nome: string;
  subtitulo: string;
  temaCatalogoId: string;
  /** Proveniência de design (catálogo 21st.dev); nunca exibida na superfície clínica. */
  componentesCombinados: readonly string[];
  acentoHex: string;
  superficieHex: string;
  descricaoCurta: string;
}

export const COMBINACOES_21ST: readonly Combinacao21stMeta[] = [
  {
    id: "violet-halo",
    nome: "Violeta suave",
    subtitulo: "Leitura longitudinal com contraste moderado",
    temaCatalogoId: "435100ee-0e77-424f-8010-4b0fb4ba0334",
    componentesCombinados: [
      "BeUI Bouncy Accordion (#16042)",
      "Shifting Dropdown (#9865)",
      "Progressive Blur Modal (#4667)",
      "Expanding Tabs (#30168)",
    ],
    acentoHex: "#6e56cf",
    superficieHex: "#f5f5ff",
    descricaoCurta: "Bordas suaves e foco em leitura longitudinal do prontuário.",
  },
  {
    id: "accessible-teal",
    nome: "Verde-azulado alto contraste",
    subtitulo: "Máxima legibilidade, agrupamento compacto",
    temaCatalogoId: "dd16c289-7abf-4868-869b-bb8f8c871d4e",
    componentesCombinados: [
      "Shadcn Accordion (#10090)",
      "Help Dropdown Menu (#25361)",
      "Search Modal (#8115)",
      "Segmented Tabs (#26923)",
    ],
    acentoHex: "#0f766e",
    superficieHex: "#f2fbf9",
    descricaoCurta: "Contraste de alta legibilidade com agrupamento compacto.",
  },
  {
    id: "violet-dusk-linen",
    nome: "Linho claro",
    subtitulo: "Superfície calma para revisão extensa de laudos",
    temaCatalogoId: "f43e4808-e17a-48e6-9abb-493a26e48608",
    componentesCombinados: [
      "Accordion 05 (#8637)",
      "Sheet Drawer (#35214)",
      "Tabs Component (#6073)",
      "Partition Bar (#26545)",
    ],
    acentoHex: "#846feb",
    superficieHex: "#fbfbff",
    descricaoCurta: "Superfície calma para revisão extensa de laudos e reconciliação de fontes.",
  },
  {
    id: "amber-glow",
    nome: "Âmbar operacional",
    subtitulo: "Destaque para triagem, salão e decisão",
    temaCatalogoId: "0dd4f377-57a5-4dea-af4f-05c1a38cce01",
    componentesCombinados: [
      "Bento Dashboard (#9758)",
      "NotificationsWithActions (#7023)",
      "Partition Bar (#26545)",
      "Expanding Tabs (#30168)",
    ],
    acentoHex: "#d9531e",
    superficieHex: "#fffaf5",
    descricaoCurta: "Cartões em grade com destaque para triagem, salão e tomada de decisão.",
  },
] as const;

export const GRUPOS_CONSULTA_21ST: readonly {
  id: GrupoConsultaId;
  numero: string;
  titulo: string;
  resumo: string;
}[] = [
  {
    id: "consulta-fase2",
    numero: "01",
    titulo: "Ficha clínica & Tumor-packs",
    resumo: "Revisão estruturada do lote tumoral, estadiamento e diretrizes locais",
  },
  {
    id: "consulta-documentos",
    numero: "02",
    titulo: "Captura & Entrada única (PDF / Voz / Texto)",
    resumo: "Upload de exames locais, transcrição e ditado em um só bloco",
  },
  {
    id: "consulta-revisao",
    numero: "03",
    titulo: "Revisão de fontes & Alertas RADS",
    resumo: "Conferência humana de achados extraídos, vínculo e emergências radiológicas",
  },
  {
    id: "consulta-medicamentos",
    numero: "04",
    titulo: "Reconciliação de medicamentos",
    resumo: "Confronto entre medicamentos em uso, prescrição e propostas",
  },
  {
    id: "consulta-sintese",
    numero: "05",
    titulo: "Síntese clínica proposta",
    resumo: "Retrato consolidado para apoio à evolução médica",
  },
] as const;

const CHAVE_COMBO = "onco.combo21st.v1";

export function lerCombinacao21st(): Combinacao21stId {
  try {
    const salvo = localStorage.getItem(CHAVE_COMBO);
    if (
      salvo === "violet-halo" ||
      salvo === "accessible-teal" ||
      salvo === "violet-dusk-linen" ||
      salvo === "amber-glow"
    ) {
      return salvo;
    }
  } catch {
    /* localStorage indisponível */
  }
  return "violet-halo";
}

export function gravarCombinacao21st(id: Combinacao21stId): void {
  try {
    localStorage.setItem(CHAVE_COMBO, id);
  } catch {
    /* localStorage indisponível */
  }
}

export function estadoInicialGruposConsulta(): Record<GrupoConsultaId, boolean> {
  return {
    "consulta-fase2": true,
    "consulta-documentos": true,
    "consulta-revisao": true,
    "consulta-medicamentos": true,
    "consulta-sintese": true,
  };
}
