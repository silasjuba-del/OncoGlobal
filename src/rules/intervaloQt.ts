import { TreatmentAdministration } from "../contracts/clinico.js";
type EventoIntervaloQt = import("./tipos-w3.js").EventoIntervaloQt;
type IntervaloQtResult = import("./tipos-w3.js").IntervaloQtResult;

const VERSAO_PONTE = "A4-ponte-1"; // Adaptador de dados; nao aplica limiar clinico.
const TIPOS_ADMIN = ["TreatmentAdministration", "TREATMENT_ADMINISTRATION"];
function record(v: unknown): v is Record<string, unknown> { return typeof v === "object" && v !== null; }

/** A4: historico de um paciente; prazos.ts continua dono do intervalo.
 * Data civil no offset documentado. Fuso do servico [VERIFICAR].
 * Date.parse compara instantes fornecidos; nao consulta o relogio.
 */
export function ultimaAdministracaoQtEfetiva(eventos: readonly EventoIntervaloQt[], modalidadesPorCiclo: Readonly<Record<string, string>> = {}): IntervaloQtResult {
  const used: string[] = [];
  const missing: string[] = [];
  const resultado = (data: string | null, adminId: string | null): IntervaloQtResult => ({
    data, adminId, rulesetVersao: VERSAO_PONTE,
    inputs_used: used, inputs_missing: [...new Set(missing)],
  });
  const confirmados = eventos.filter((e) => "adminId" in e ||
    (TIPOS_ADMIN.includes(e.tipo) && (e.revisao === "CONFIRMADO" || e.revisao === "ASSINADO")));
  const pacientes = new Set(confirmados.flatMap((e) => "patientId" in e ? [e.patientId] : []));
  if (pacientes.size > 1) { missing.push("escopo_paciente_unico"); return resultado(null, null); }
  const substituidos = new Set(confirmados.flatMap((e) => "supersedesEventId" in e && e.supersedesEventId ? [e.supersedesEventId] : []));
  const candidatas = new Map<string, { data: string; instante: number; assinatura: string }>();
  for (const e of confirmados) {
    if ("eventId" in e && substituidos.has(e.eventId)) continue;
    const bruto: unknown = "adminId" in e ? e : e.payload;
    const payload: unknown = record(bruto) && "data" in bruto ? bruto.data : bruto;
    if (!record(payload)) { missing.push("administracao.payload"); continue; }
    const { modalidade, patientId: _paciente, episodioId: _episodio, unidadeEfetiva, ...dados } = payload;
    const modalidadeDoCiclo = typeof dados.cicloId === "string" && Object.hasOwn(modalidadesPorCiclo, dados.cicloId) ? modalidadesPorCiclo[dados.cicloId] : undefined;
    if (modalidade !== undefined && modalidadeDoCiclo !== undefined && modalidade !== modalidadeDoCiclo) { missing.push("administracao.modalidade_conflitante"); continue; }
    const modalidadeResolvida = modalidade ?? modalidadeDoCiclo;
    if (modalidadeResolvida === undefined) { missing.push("administracao.modalidade"); continue; }
    if (modalidadeResolvida !== "QT") continue;
    if (unidadeEfetiva !== undefined && unidadeEfetiva !== "mg") { missing.push("administracao.unidade"); continue; }
    const parsed = TreatmentAdministration.safeParse(dados);
    if (!parsed.success) { missing.push("administracao.contrato"); continue; }
    const a = parsed.data;
    used.push(`admin.${a.adminId}.status`, `admin.${a.adminId}.quantidadeEfetivaMg`);
    const data = a.fim ?? a.inicio;
    const assinatura = JSON.stringify([a.status, a.quantidadeEfetivaMg, a.inicio, a.fim, a.cicloId, a.item, a.droga, a.prescricaoRef]);
    const anterior = candidatas.get(a.adminId);
    if (anterior && anterior.assinatura !== assinatura) { missing.push(`admin.${a.adminId}.conflito`); continue; }
    if (a.status === "OMITIDA" || a.quantidadeEfetivaMg === 0) {
      candidatas.set(a.adminId, { data: "", instante: -Infinity, assinatura });
      continue;
    }
    if (!data || (a.fim && a.inicio && Date.parse(a.fim) < Date.parse(a.inicio))) { missing.push(`admin.${a.adminId}.data`); continue; }
    candidatas.set(a.adminId, { data, instante: Date.parse(data), assinatura });
    used.push(`admin.${a.adminId}.${a.fim ? "fim" : "inicio"}`);
  }
  if (missing.length) return resultado(null, null);
  const ultima = [...candidatas.entries()].filter(([, a]) => a.data).sort((a, b) =>
    a[1].instante - b[1].instante || a[0].localeCompare(b[0])).at(-1);
  if (!ultima) { missing.push("administracao_qt_efetiva"); return resultado(null, null); }
  return resultado(ultima[1].data.slice(0, 10), ultima[0]);
}
