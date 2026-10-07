// W8-MUSE · MU-04 · registro dos ícones (o Cursor importa daqui).
export { Icone } from "./Icone.js";
export {
  IconeAgenda,
  IconeApac,
  IconeConfiguracoes,
  IconeDocumentos,
  IconeEnfermagem,
  IconeExames,
  IconeFarmacia,
  IconePrescricao,
  IconeProntuario,
  IconeRelatorios,
  IconeResumo,
} from "./navegacao.js";
export {
  IconeAlerta,
  IconeAssinado,
  IconeConflito,
  IconeE1,
  IconePendente,
  IconeRascunho,
  IconeRiscado,
} from "./estados.js";
export {
  IconeBusca,
  IconeCanal,
  IconeChevron,
  IconeLua,
  IconeSalao,
  IconeSino,
  IconeSol,
  IconeUsuario,
} from "./cromo.js";

import { IconeBusca, IconeCanal, IconeChevron, IconeLua, IconeSalao, IconeSino, IconeSol, IconeUsuario } from "./cromo.js";
import { IconeAgenda } from "./navegacao.js";
import { IconeApac } from "./navegacao.js";
import { IconeConfiguracoes } from "./navegacao.js";
import { IconeDocumentos } from "./navegacao.js";
import { IconeEnfermagem } from "./navegacao.js";
import { IconeExames } from "./navegacao.js";
import { IconeFarmacia } from "./navegacao.js";
import { IconePrescricao } from "./navegacao.js";
import { IconeProntuario } from "./navegacao.js";
import { IconeRelatorios } from "./navegacao.js";
import { IconeResumo } from "./navegacao.js";
import { IconeAlerta } from "./estados.js";
import { IconeAssinado } from "./estados.js";
import { IconeConflito } from "./estados.js";
import { IconeE1 } from "./estados.js";
import { IconePendente } from "./estados.js";
import { IconeRascunho } from "./estados.js";
import { IconeRiscado } from "./estados.js";

/** Mapa nome → componente (11 navegação + 7 estado + 8 cromo). */
export const ICONES = {
  resumo: IconeResumo,
  prontuario: IconeProntuario,
  exames: IconeExames,
  prescricao: IconePrescricao,
  apac: IconeApac,
  documentos: IconeDocumentos,
  agenda: IconeAgenda,
  enfermagem: IconeEnfermagem,
  farmacia: IconeFarmacia,
  relatorios: IconeRelatorios,
  configuracoes: IconeConfiguracoes,
  alerta: IconeAlerta,
  pendente: IconePendente,
  conflito: IconeConflito,
  assinado: IconeAssinado,
  rascunho: IconeRascunho,
  e1: IconeE1,
  riscado: IconeRiscado,
  busca: IconeBusca,
  lua: IconeLua,
  sol: IconeSol,
  sino: IconeSino,
  chevron: IconeChevron,
  usuario: IconeUsuario,
  canal: IconeCanal,
  salao: IconeSalao,
} as const;

export type IconeNome = keyof typeof ICONES;
