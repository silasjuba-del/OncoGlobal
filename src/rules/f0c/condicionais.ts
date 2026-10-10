import type { DadoCondicional, EntradaCondicionais, EvidenciaToxicidadeComplementar, ExameHepatico,
  MedidaCondicional, RegraCondicional, RegraTermoComplementar, ResultadoCondicional } from "../../contracts/f0c/condicionais.js";

const texto = (s: string | null | undefined): s is string => typeof s === "string" && !!s.trim() && !s.includes("[VERIFICAR]");
const nome = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
const fonteValida = (f: RegraCondicional["fonte"]) => !!f && f.tipo === "LITERATURA" && texto(f.referencia) && texto(f.trecho) && texto(f.conferidoEm);
function dia(s: string | null): number | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const n = Date.parse(`${s}T00:00:00Z`);
  return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === s ? n / 86_400_000 : null;
}

function instanteExato(s: string | null | undefined): number | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(s) || dia(s.slice(0, 10)) === null) return null;
  if (Number(s.slice(11, 13)) > 23 || Number(s.slice(14, 16)) > 59 || Number(s.slice(17, 19)) > 59) return null;
  const offset = /([+-])(\d{2}):(\d{2})$/.exec(s);
  if (offset && (Number(offset[2]) > 14 || Number(offset[3]) > 59 || (Number(offset[2]) === 14 && Number(offset[3]) !== 0))) return null;
  const valor = Date.parse(s);
  return Number.isFinite(valor) ? valor : null;
}

/** Avisos condicionados ao elenco explícito. Não confirma aptidão nem executa conduta de bula. */
export function avaliarCondicionais(e: EntradaCondicionais, regras: readonly RegraCondicional[]): ResultadoCondicional[] {
  return regras.map((rs) => {
    const drogas = (e.programados ?? []).filter((d) => rs.drogas.some((alvo) => nome(alvo) === nome(d)));
    const r: ResultadoCondicional = { regraId: rs.id, tipo: rs.tipo, estado: "PENDENTE", drogas: [...new Set(drogas)], motivos: [],
      pendencias: [], fontesDados: [], fonteRegra: rs.fonte?.referencia ?? "", regraVersao: rs.versao,
      acao: null, bloqueiaConsulta: false, autorizaCiclo: false, ajustaDose: false };
    if (!e.programados || e.programados.some((d) => !d.trim())) { r.pendencias.push("ELENCO_DESCONHECIDO"); return r; }
    if (!drogas.length) return { ...r, estado: "NAO_APLICAVEL" };
    if (rs.ativo !== true || !fonteValida(rs.fonte) || !texto(rs.versao) || regras.filter((x) => x.id === rs.id).length !== 1) {
      r.pendencias.push("REGRA_NAO_CURADA_OU_AMBIGUA"); return r;
    }
    const registrar = (f: string) => { if (!r.fontesDados.includes(f)) r.fontesDados.push(f); };
    const dado = <T>(d: DadoCondicional<T> | undefined, campo: string): T | null => {
      if (!d || d.valor === null || !texto(d.fonte)) { r.pendencias.push(campo); return null; }
      registrar(d.fonte); return d.valor;
    };
    const numero = (m: MedidaCondicional | undefined, unidade: string, campo: string): number | null => {
      const n = dado(m, campo);
      if (n === null) return null;
      if (!Number.isFinite(n) || n < 0 || m!.unidade !== unidade) { r.pendencias.push(campo); return null; }
      const coleta = instanteExato(m!.coletadoEm), agora = instanteExato(e.agora);
      if (coleta === null || agora === null) { r.pendencias.push(`${campo}.COLETA_OU_RELOGIO_INCOMPLETO`); return null; }
      if (coleta > agora) { r.pendencias.push(`${campo}.COLETA_FUTURA`); return null; }
      if (agora - coleta > 7 * 24 * 60 * 60 * 1000) { r.pendencias.push(`${campo}.BIOQUIMICA_VENCIDA`); return null; }
      return n;
    };
    const vezesLsn = (m: ExameHepatico | undefined, unidade: string, campo: string): number | null => {
      const n = numero(m, unidade, campo);
      if (n === null) return null;
      if (m!.limiteSuperiorNormal === null || !Number.isFinite(m!.limiteSuperiorNormal) || m!.limiteSuperiorNormal! <= 0) {
        r.pendencias.push(`${campo}.LSN`); return null;
      }
      return n / m!.limiteSuperiorNormal!;
    };
    const parametro = (key: string): number | null => {
      const n = rs.parametros?.[key];
      if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) { r.pendencias.push(`parametro.${key}`); return null; }
      return n;
    };
    switch (rs.tipo) {
      case "DPYD": {
        const valor = dado(e.dpyd, "DPYD");
        if (valor === "DESCONHECIDO") r.pendencias.push("DPYD_DESCONHECIDO");
        else if (valor === "DEFICIENCIA_PARCIAL" || valor === "DEFICIENCIA_COMPLETA") r.motivos.push(`DPD: ${valor}; revisar fluoropirimidina e individualização médica`);
        else if (valor !== null && valor !== "SEM_DEFICIENCIA_IDENTIFICADA") r.pendencias.push("DPYD_INVALIDO");
        break;
      }
      case "ALERGIA": {
        if (!rs.alergenos?.length) { r.pendencias.push("ELENCO_ALERGENOS_AUSENTE"); break; }
        const historico = e.alergias;
        if (!historico || historico.historicoConferido !== true || !texto(historico.fonte)) r.pendencias.push("HISTORICO_ALERGIAS");
        if (historico && texto(historico.fonte)) registrar(historico.fonte);
        for (const a of historico?.lista ?? []) {
          if (!rs.alergenos.some((alvo) => nome(alvo) === nome(a.agente))) continue;
          if (!texto(a.fonte) || a.presente === null) { r.pendencias.push(`ALERGIA:${a.agente}`); continue; }
          registrar(a.fonte);
          if (a.presente === true) r.motivos.push(`Alergia documentada a ${a.agente}: revisar ${drogas.join(", ")}; não extrapolar aos demais fármacos`);
        }
        break;
      }
      case "GESTACAO": {
        if (e.gestacao?.aplicavel === false && texto(e.gestacao.resultado.fonte)) { registrar(e.gestacao.resultado.fonte); return { ...r, estado: "NAO_APLICAVEL" }; }
        if (e.gestacao?.aplicavel !== true) r.pendencias.push("APLICABILIDADE_GESTACAO");
        else {
          const gestante = dado(e.gestacao.resultado, "GESTACAO");
          if (gestante === true) r.motivos.push("Gestação documentada: revisar risco fetal do medicamento programado");
          else if (gestante !== null && gestante !== false) r.pendencias.push("GESTACAO_INVALIDA");
        }
        break;
      }
      case "DOCETAXEL_HEPATICO": {
        const b = vezesLsn(e.hepaticos?.bilirrubina, "mg/dL", "BILIRRUBINA"), ast = vezesLsn(e.hepaticos?.ast, "U/L", "AST"),
          alt = vezesLsn(e.hepaticos?.alt, "U/L", "ALT"), fa = vezesLsn(e.hepaticos?.fosfataseAlcalina, "U/L", "FA");
        const cb = parametro("bilirrubinaLsn"), ct = parametro("transaminasesLsn"), cf = parametro("fosfataseLsn");
        if (b !== null && cb !== null && b > cb) r.motivos.push("Docetaxel: bilirrubina acima do limite da bula; revisão médica");
        const alta = ct !== null && ((ast !== null && ast > ct) || (alt !== null && alt > ct));
        if (alta && fa !== null && cf !== null && fa > cf) r.motivos.push("Docetaxel: transaminase e fosfatase alcalina elevadas conjuntamente; revisão médica");
        else if (alta) r.motivos.push("Docetaxel: transaminase elevada; revisar conduta individual sem ajuste automático");
        break;
      }
      case "IRINOTECANO_HEPATICO": {
        const b = numero(e.hepaticos?.bilirrubina, "mg/dL", "BILIRRUBINA"), ast = vezesLsn(e.hepaticos?.ast, "U/L", "AST"), alt = vezesLsn(e.hepaticos?.alt, "U/L", "ALT");
        const metastase = dado(e.hepaticos?.metastaseHepatica, "METASTASE_HEPATICA");
        const cb = parametro("bilirrubinaMgDl"), sem = parametro("transaminasesSemMetastaseLsn"), com = parametro("transaminasesComMetastaseLsn");
        if (b !== null && cb !== null && b > cb) r.motivos.push("Irinotecano: bilirrubina fora da população estudada da bula; dose não recomendável automaticamente");
        const corte = metastase === true ? com : metastase === false ? sem : null;
        if (corte !== null && ((ast !== null && ast > corte) || (alt !== null && alt > corte))) r.motivos.push("Irinotecano: transaminase fora da população estudada conforme metástase hepática; revisão médica");
        break;
      }
      case "BEVACIZUMABE_PA": {
        const grave = dado(e.hipertensaoGraveNaoControlada, "PA_GRAVE_NAO_CONTROLADA");
        if (grave === true) r.motivos.push("Bevacizumabe: hipertensão grave não controlada documentada; revisão médica");
        else if (grave !== null && grave !== false) r.pendencias.push("PA_INVALIDA");
        break;
      }
      case "BEVACIZUMABE_PROTEINURIA": {
        const p = numero(e.proteinuria, "g/24h", "PROTEINURIA_24H"), nefrotica = dado(e.sindromeNefrotica, "SINDROME_NEFROTICA"), corte = parametro("proteinaG24h");
        if (p !== null && corte !== null && p >= corte) r.motivos.push("Bevacizumabe: proteinúria no limiar de revisão da bula");
        if (nefrotica === true) r.motivos.push("Bevacizumabe: síndrome nefrótica documentada; revisão médica");
        break;
      }
      case "BEVACIZUMABE_CIRURGIA": {
        const c = e.cirurgia, hoje = dia(e.hoje), janela = parametro("janelaDias");
        if (!c || c.historicoEAgendaConferidos !== true || !texto(c.fonte)) { r.pendencias.push("CIRURGIA_HISTORICO_E_AGENDA"); break; }
        registrar(c.fonte);
        if (hoje === null) { r.pendencias.push("DATA_ATUAL_INVALIDA"); break; }
        if (c.ultimaCirurgiaMaior !== null) {
          const ultima = dia(c.ultimaCirurgiaMaior);
          if (ultima === null || ultima > hoje) r.pendencias.push("DATA_CIRURGIA_PREVIA_INVALIDA");
          else if (janela !== null && hoje - ultima < janela) r.motivos.push("Bevacizumabe: cirurgia maior dentro da janela pós-operatória da bula");
          if (c.cicatrizacaoAdequada === false) r.motivos.push("Bevacizumabe: cicatrização não adequada documentada");
          else if (c.cicatrizacaoAdequada !== true) r.pendencias.push("CICATRIZACAO");
        }
        if (c.proximaCirurgiaEletiva !== null) {
          const proxima = dia(c.proximaCirurgiaEletiva);
          if (proxima === null || proxima < hoje) r.pendencias.push("DATA_CIRURGIA_PROGRAMADA_INVALIDA");
          else if (janela !== null && proxima - hoje < janela) r.motivos.push("Bevacizumabe: cirurgia eletiva programada dentro da janela pré-operatória da bula");
        }
        break;
      }
      default: r.pendencias.push("TIPO_NAO_SUPORTADO");
    }
    r.estado = r.motivos.length ? "AVISO" : r.pendencias.length ? "PENDENTE" : "SEM_AVISO";
    r.acao = r.estado === "AVISO" || r.estado === "PENDENTE" ? "REVISAO_MEDICA" : null;
    return r;
  });
}

/** Registro de termos com evidência explícita; não calcula grau nem propõe redução de dose. */
export function registrarTermosComplementares(evidencias: readonly EvidenciaToxicidadeComplementar[], regras: readonly RegraTermoComplementar[]) {
  return evidencias.map((e) => {
    const candidatas = regras.filter((r) => r.id === e.termo);
    const rs = candidatas.length === 1 ? candidatas[0] : null;
    const pendencias: string[] = [];
    if (!rs || !rs.ativo || !fonteValida(rs.fonte) || rs.ctcaeVersao !== e.ctcaeVersao) pendencias.push("TERMO_OU_VERSAO_NAO_CURADOS");
    if (!texto(e.fonte) || !texto(e.evidencia) || typeof e.presente !== "boolean") pendencias.push("EVIDENCIA_EXPLICITA_AUSENTE");
    const grau = e.grauDocumentado ?? null;
    if (grau !== null && (!Number.isInteger(grau) || !rs?.grausDisponiveis?.includes(grau) || e.presente !== true)) pendencias.push("GRAU_DOCUMENTADO_INCOMPATIVEL");
    return { termo: e.termo, nomeCtcae: rs?.nomeCtcae ?? null, ctcaeVersao: e.ctcaeVersao,
      estado: pendencias.length ? "PENDENTE" as const : e.presente ? "DOCUMENTADO" as const : "NEGADO" as const,
      fonte: e.fonte, evidencia: e.evidencia, grau: pendencias.length ? null : grau, pendencias, ajustaDose: false as const, bloqueiaConsulta: false as const };
  });
}
