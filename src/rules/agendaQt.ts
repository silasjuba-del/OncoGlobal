// D-W9-39 · agenda de QT alerta conflito e não reorganiza o dia.
// PROVISORIO-W10: trocar SessaoAgenda / PedidoGeracao por src/contracts/w10/ quando a ficha publicar a grade.

export interface SessaoAgenda {
  sessaoId: string;
  ciclo: number;
  data: string;
  inicioMinutos: number;
  duracaoMinutos: number;
  poltrona: number | null;
}

export interface PedidoGeracao {
  protocoloId: string;
  primeiroDia: string;
  numeroCiclos: number;
  intervaloDias: number;
  inicioMinutos: number;
  duracaoMinutos: number;
}

export interface RulesetAgenda {
  id: string;
  versao: string;
  decisao: string;
  duracaoLongaMinutos: number;
  inicioLongoAteMinutos: number;
  janelaIniciosMinutos: number;
  maxIniciosPorJanela: number;
  poltronas: number;
  gradeInicioMinutos: number;
  gradeFimMinutos: number;
}

export interface MotivoAgenda {
  codigo: string;
  texto: string;
  regraId: string;
  rulesetVersao: string;
}

export interface ResultadoAgenda {
  estado: "ALERTA" | "PENDENTE" | "SEM_ALERTA";
  bloqueiaSalvar: false;
  reorganizou: false;
  motivos: MotivoAgenda[];
  pendentes: MotivoAgenda[];
  decisao: string;
  rulesetVersao: string;
  sessoes: SessaoAgenda[];
}

type Bruto = Record<string, unknown>;

function objeto(valor: unknown, caminho: string): Bruto {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
    throw new Error(`${caminho} ausente`);
  }
  return valor as Bruto;
}

function texto(valor: unknown, caminho: string): string {
  if (typeof valor !== "string" || valor.trim().length === 0) throw new Error(`${caminho} ausente`);
  return valor.trim();
}

function flag(valor: unknown, caminho: string, esperado: boolean): void {
  if (valor !== esperado) throw new Error(`${caminho} inválido`);
}

function inteiroPositivo(valor: unknown, caminho: string): number {
  if (typeof valor !== "number" || !Number.isInteger(valor) || valor <= 0) {
    throw new Error(`${caminho} não é inteiro positivo`);
  }
  return valor;
}

function motivo(codigo: string, corpo: string, rs: RulesetAgenda): MotivoAgenda {
  return { codigo, texto: `${corpo} (${rs.decisao})`, regraId: rs.decisao, rulesetVersao: rs.versao };
}

function hhmm(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Data civil YYYY-MM-DD. A soma usa o calendário UTC para não escorregar no fuso −03:00. */
export function somarDiasCivis(iso: string, dias: number): string {
  const m = DATA.exec(iso);
  if (!m) throw new Error("data inválida");
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  const dt = new Date(Date.UTC(ano, mes - 1, dia + dias));
  const y = dt.getUTCFullYear();
  const mo = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

export function lerAgendaQt(json: unknown): RulesetAgenda {
  const raiz = objeto(json, "ruleset");
  const header = objeto(raiz.header, "header");
  const bloco = objeto(raiz.agenda, "agenda");
  flag(bloco.bloqueiaSalvar, "bloqueiaSalvar", false);
  flag(bloco.otimizarDiaProibido, "otimizarDiaProibido", true);
  flag(bloco.igualAoLimitePassa, "igualAoLimitePassa", true);
  const gradeInicio = inteiroPositivo(bloco.gradeInicioMinutos, "gradeInicioMinutos");
  const gradeFim = inteiroPositivo(bloco.gradeFimMinutos, "gradeFimMinutos");
  if (gradeFim <= gradeInicio) throw new Error("grade invertida");
  return {
    id: texto(header.id, "header.id"),
    versao: texto(header.versao, "header.versao"),
    decisao: texto(bloco.decisao, "decisao"),
    duracaoLongaMinutos: inteiroPositivo(bloco.duracaoLongaMinutos, "duracaoLongaMinutos"),
    inicioLongoAteMinutos: inteiroPositivo(bloco.inicioLongoAteMinutos, "inicioLongoAteMinutos"),
    janelaIniciosMinutos: inteiroPositivo(bloco.janelaIniciosMinutos, "janelaIniciosMinutos"),
    maxIniciosPorJanela: inteiroPositivo(bloco.maxIniciosPorJanela, "maxIniciosPorJanela"),
    poltronas: inteiroPositivo(bloco.poltronas, "poltronas"),
    gradeInicioMinutos: gradeInicio,
    gradeFimMinutos: gradeFim,
  };
}

export function gerarSessoes(pedido: PedidoGeracao): SessaoAgenda[] {
  if (!Number.isInteger(pedido.numeroCiclos) || pedido.numeroCiclos < 1) {
    throw new Error("numeroCiclos inválido");
  }
  if (!Number.isInteger(pedido.intervaloDias) || pedido.intervaloDias < 1) {
    throw new Error("intervaloDias inválido");
  }
  if (!Number.isInteger(pedido.inicioMinutos) || pedido.inicioMinutos < 0 || pedido.inicioMinutos > 1439) {
    throw new Error("inicioMinutos inválido");
  }
  if (!Number.isInteger(pedido.duracaoMinutos) || pedido.duracaoMinutos < 1) {
    throw new Error("duracaoMinutos inválida");
  }
  if (pedido.protocoloId.trim().length === 0) throw new Error("protocoloId ausente");
  const sessoes: SessaoAgenda[] = [];
  for (let i = 0; i < pedido.numeroCiclos; i++) {
    sessoes.push({
      sessaoId: `${pedido.protocoloId}-c${i + 1}`,
      ciclo: i + 1,
      data: somarDiasCivis(pedido.primeiroDia, i * pedido.intervaloDias),
      inicioMinutos: pedido.inicioMinutos,
      duracaoMinutos: pedido.duracaoMinutos,
      poltrona: null,
    });
  }
  return sessoes;
}

function sessaoInteira(s: SessaoAgenda): boolean {
  return DATA.test(s.data)
    && Number.isInteger(s.inicioMinutos)
    && Number.isInteger(s.duracaoMinutos)
    && s.duracaoMinutos > 0
    && s.inicioMinutos >= 0
    && s.inicioMinutos <= 1439;
}

function copiar(s: SessaoAgenda): SessaoAgenda {
  return {
    sessaoId: s.sessaoId,
    ciclo: s.ciclo,
    data: s.data,
    inicioMinutos: s.inicioMinutos,
    duracaoMinutos: s.duracaoMinutos,
    poltrona: s.poltrona,
  };
}

export function validarAgenda(
  sessoes: readonly SessaoAgenda[],
  rs: RulesetAgenda,
  opcoes: { otimizarDia?: boolean } = {},
): ResultadoAgenda {
  const copia = sessoes.map(copiar);
  const motivos: MotivoAgenda[] = [];
  const pendentes: MotivoAgenda[] = [];
  if (opcoes.otimizarDia === true) {
    motivos.push(motivo(
      "agenda.otimizarDia.proibido",
      "Otimizar dia é proibido: as sessões permanecem na ordem e no horário recebidos",
      rs,
    ));
  }
  const porDia = new Map<string, SessaoAgenda[]>();
  for (const s of copia) {
    if (!sessaoInteira(s)) {
      pendentes.push(motivo("pendente.agenda.horario", `sessão ${s.sessaoId} com data ou horário ilegível; não vira 0`, rs));
      continue;
    }
    const lista = porDia.get(s.data) ?? [];
    lista.push(s);
    porDia.set(s.data, lista);
    if (s.duracaoMinutos >= rs.duracaoLongaMinutos && s.inicioMinutos > rs.inicioLongoAteMinutos) {
      motivos.push(motivo(
        "agenda.inicioLongo",
        `sessão ${s.sessaoId} dura ${s.duracaoMinutos} min e inicia às ${hhmm(s.inicioMinutos)}; tratamento longo só inicia até ${hhmm(rs.inicioLongoAteMinutos)}`,
        rs,
      ));
    }
    if (s.poltrona === null) {
      pendentes.push(motivo("pendente.agenda.poltrona", `sessão ${s.sessaoId} sem poltrona; a grade não é preenchida sozinha`, rs));
    } else if (!Number.isInteger(s.poltrona) || s.poltrona < 1 || s.poltrona > rs.poltronas) {
      motivos.push(motivo(
        "agenda.poltrona.fora",
        `sessão ${s.sessaoId} na poltrona ${s.poltrona}; a grade tem ${rs.poltronas} (${hhmm(rs.gradeInicioMinutos)}–${hhmm(rs.gradeFimMinutos)})`,
        rs,
      ));
    }
  }
  for (const [data, lista] of porDia) {
    const ordenadas = [...lista].sort((a, b) => a.inicioMinutos - b.inicioMinutos);
    const vistas = new Set<number>();
    for (const s of ordenadas) {
      if (vistas.has(s.inicioMinutos)) continue;
      vistas.add(s.inicioMinutos);
      const fim = s.inicioMinutos + rs.janelaIniciosMinutos;
      const n = ordenadas.filter((o) => o.inicioMinutos >= s.inicioMinutos && o.inicioMinutos < fim).length;
      if (n > rs.maxIniciosPorJanela) {
        motivos.push(motivo(
          "agenda.inicios.janela",
          `${n} inícios em ${data} a partir de ${hhmm(s.inicioMinutos)} (teto ${rs.maxIniciosPorJanela} a cada ${rs.janelaIniciosMinutos} min)`,
          rs,
        ));
      }
    }
    for (let i = 0; i < ordenadas.length; i++) {
      const a = ordenadas[i];
      if (a === undefined || a.poltrona === null) continue;
      for (let j = i + 1; j < ordenadas.length; j++) {
        const b = ordenadas[j];
        if (b === undefined || b.poltrona !== a.poltrona) continue;
        const aFim = a.inicioMinutos + a.duracaoMinutos;
        const bFim = b.inicioMinutos + b.duracaoMinutos;
        const sobrepoe = a.inicioMinutos < bFim && b.inicioMinutos < aFim;
        if (sobrepoe) {
          motivos.push(motivo(
            "agenda.poltrona.ocupada",
            `poltrona ${a.poltrona} em ${data} recebe ${a.sessaoId} e ${b.sessaoId} no mesmo intervalo`,
            rs,
          ));
        }
      }
    }
    let pico = 0;
    let horaPico = rs.gradeInicioMinutos;
    const eventos: { t: number; delta: number }[] = [];
    for (const s of ordenadas) {
      eventos.push({ t: s.inicioMinutos, delta: 1 });
      eventos.push({ t: s.inicioMinutos + s.duracaoMinutos, delta: -1 });
    }
    eventos.sort((a, b) => a.t - b.t || a.delta - b.delta);
    let atual = 0;
    for (const e of eventos) {
      atual += e.delta;
      if (atual > pico) {
        pico = atual;
        horaPico = e.t;
      }
    }
    if (pico > rs.poltronas) {
      motivos.push(motivo(
        "agenda.grade.lotada",
        `${pico} ocupações em ${data} às ${hhmm(horaPico)}; a grade ${hhmm(rs.gradeInicioMinutos)}–${hhmm(rs.gradeFimMinutos)} tem ${rs.poltronas} poltronas`,
        rs,
      ));
    }
  }
  const estado = motivos.length > 0 ? "ALERTA" : pendentes.length > 0 ? "PENDENTE" : "SEM_ALERTA";
  return {
    estado,
    bloqueiaSalvar: false,
    reorganizou: false,
    motivos,
    pendentes,
    decisao: rs.decisao,
    rulesetVersao: rs.versao,
    sessoes: copia,
  };
}
