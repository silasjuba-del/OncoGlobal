import type { CorElegibilidade, NivelMotivoElegibilidade, OrigemElegibilidade, MotivoEntradaElegibilidade, SinalElegibilidade, EntradasElegibilidadeCiclo, MotivoElegibilidadeCiclo, SaidaElegibilidadeCiclo } from '../contracts/api/elegibilidadeCiclo.js';
export type { CorElegibilidade, NivelMotivoElegibilidade, OrigemElegibilidade, MotivoEntradaElegibilidade, SinalElegibilidade, EntradasElegibilidadeCiclo, MotivoElegibilidadeCiclo, SaidaElegibilidadeCiclo } from '../contracts/api/elegibilidadeCiclo.js';
// W11-H13 · elegibilidade de ciclo: CRUZA saídas já calculadas (porta, triagem, CTCAE, interações, plaquetas,
// função orgânica, intercorrência). Não recalcula nada. Entradas chegam por parâmetro (tipos estruturais locais):
// este módulo não importa outras regras.
// Semáforo de 3 cores SEM AMARELO: VERDE · VERMELHO · PENDENTE. "VERDE" significa só "sem impedimento identificado";
// verde nunca é liberação, aprovação nem aptidão. Ausente nunca é verde. Ato médico continua fora do sistema.







/** Saída já calculada por um módulo de regra. `null` = dado ausente (nunca vira verde). */








const ORDEM: readonly OrigemElegibilidade[] = [
  "portaCiclo",
  "triagem",
  "ctcae",
  "interacoes",
  "plaquetas",
  "funcaoOrganica",
  "intercorrencia",
  "emergencia", "feve", "basal", "condicionais", "intervalo", "cumulativo",
];

const ROTULO_NIVEL: Record<NivelMotivoElegibilidade, string> = {
  atencao: "atenção (moderada)",
  importante: "importante",
  contraindicacao: "contraindicação",
};

const ROTULO: Record<CorElegibilidade, string> = {
  VERDE: "sem impedimento identificado",
  VERMELHO: "revisar pelo médico",
  PENDENTE: "pendente de dados",
};

function motivosDe(origem: OrigemElegibilidade, sinal: SinalElegibilidade): MotivoElegibilidadeCiclo[] {
  return sinal.motivos.map((m) => {
    if (m.nivel === undefined) return { origem, texto: m.texto };
    return { origem, texto: `${m.texto} (nível: ${ROTULO_NIVEL[m.nivel]})`, nivel: m.nivel };
  });
}

function sinalDe(entradas: EntradasElegibilidadeCiclo, origem: OrigemElegibilidade): SinalElegibilidade | null | undefined {
  return entradas[origem];
}

/** Cruza as entradas já calculadas. Mesma entrada → mesma saída. Não muta a entrada. */
export function elegibilidadeCiclo(entradas: EntradasElegibilidadeCiclo): SaidaElegibilidadeCiclo {
  const criterios = Object.values(entradas).flatMap(s => s?.criterios ?? []);
  const motivos: MotivoElegibilidadeCiclo[] = [];
  let temVermelho = false;
  let temPendente = false;
  let total = 0;
  let pendentes = 0;

  for (const origem of ORDEM) {
    const original = sinalDe(entradas, origem);
    const sinal = original && original.criterios?.length ? { ...original,
      estado: original.estado === "VERMELHO" || original.criterios.some(c => c.estado === "NAO_ATENDE") ? "VERMELHO" as const
        : original.estado === "PENDENTE" || original.criterios.some(c => c.estado === "AUSENTE" || c.estado === "CONFLITO") ? "PENDENTE" as const
        : "VERDE" as const } : original;
    if (sinal === undefined) continue;
    total++;
    if (sinal === null) {
      pendentes++;
      temPendente = true;
      motivos.push({ origem, texto: "dado ausente para esta entrada" });
      continue;
    }
    const comNivel = sinal.motivos.some((m) => m.nivel !== undefined);
    // Interação/alerta com nível (moderada/atenção etc.) conta como VERMELHO, com o nível no texto.
    if (sinal.estado === "VERMELHO" || comNivel) {
      temVermelho = true;
      const textos = motivosDe(origem, sinal);
      if (textos.length === 0) motivos.push({ origem, texto: "impedimento sem descrição" });
      else motivos.push(...textos);
      continue;
    }
    if (sinal.estado === "PENDENTE") {
      pendentes++;
      temPendente = true;
      const textos = motivosDe(origem, sinal);
      if (textos.length === 0) motivos.push({ origem, texto: "pendente sem descrição" });
      else motivos.push(...textos);
    }
  }

  if (total === 0) temPendente = true;
  const cor: CorElegibilidade = temVermelho ? "VERMELHO" : temPendente ? "PENDENTE" : "VERDE";
  return { cor, motivos: cor === "VERDE" ? [] : motivos, rotulo: ROTULO[cor],
    cobertura: { avaliadas: total - pendentes, pendentes, total },
    ...(criterios.length ? { criterios, coberturaCriterios: {
      avaliados: criterios.filter(c => c.estado === "ATENDE" || c.estado === "NAO_ATENDE").length,
      pendentes: criterios.filter(c => c.estado === "AUSENTE" || c.estado === "CONFLITO").length, total: criterios.length } } : {}) };
}
