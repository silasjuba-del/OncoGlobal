import { useEffect, useRef, useState } from "react";
import type { PortaConsulta } from "../api/porta.js";
import type { BasePrescricaoExecutavelResposta } from "../../contracts/api/operacaoPrescricaoExecutavel.js";
import type { TreatmentAdministration } from "../../contracts/clinico.js";

type Status = TreatmentAdministration["status"];
interface Formulario { status: Status | ""; quantidadeMg: string; inicio: string; fim: string; reacaoInfusional: boolean; motivo: string }
const VAZIO: Formulario = { status: "", quantidadeMg: "", inicio: "", fim: "", reacaoInfusional: false, motivo: "" };
const ROTULOS: Record<Status, string> = { COMPLETA: "Completa", PARCIAL: "Parcial", INTERROMPIDA: "Interrompida", OMITIDA: "Não administrada" };

/** Justificativa obrigatória quando a administração não é completa ou houve reação infusional. */
export const exigeJustificativa = (f: Pick<Formulario, "status" | "reacaoInfusional">) => (f.status !== "" && f.status !== "COMPLETA") || f.reacaoInfusional;
const instante = (local: string) => local ? new Date(local).toISOString() : null;
async function sha256(texto: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto)));
  return [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Prescrito ≠ administrado: cada item do ciclo assinado recebe registro explícito do que foi administrado. */
export function AdministracaoCiclo({ porta, contexto, aoRegistrado }: {
  porta: PortaConsulta; contexto: { patientId: string; encounterId: string; tumorLotId: string | null }; aoRegistrado: () => void;
}) {
  const [base, setBase] = useState<BasePrescricaoExecutavelResposta | null>(null);
  const [aberto, setAberto] = useState<number | null>(null);
  const [form, setForm] = useState<Formulario>(VAZIO);
  const [erro, setErro] = useState(""), [mensagem, setMensagem] = useState(""), [salvando, setSalvando] = useState(false);
  const tentativa = useRef<{ conteudo: string; adminId: string; operationId: string } | null>(null);
  const chave = JSON.stringify(contexto);
  useEffect(() => {
    if (!porta.lerBasePrescricaoExecutavel || !contexto.tumorLotId) return;
    const abort = new AbortController();
    setBase(null); setAberto(null); setForm(VAZIO); setErro(""); setMensagem("");
    porta.lerBasePrescricaoExecutavel(contexto, abort.signal).then(setBase, () => { if (!abort.signal.aborted) setErro("Ciclo prescrito indisponível."); });
    return () => abort.abort();
  }, [porta, chave]);

  const ciclo = base?.ciclo;
  if (!porta.registrarAdministracao || !contexto.tumorLotId) return null;
  if (!ciclo?.prescricaoRef) return <section aria-label="Administração do ciclo"><h3>Administração do ciclo</h3>
    <p>{erro || "Nenhuma prescrição assinada neste encontro para registrar administração."}</p></section>;
  const prescricao = ciclo.prescricaoRef;
  const justificar = exigeJustificativa(form);
  const invalido = !form.status || form.quantidadeMg.trim() === "" || !Number.isFinite(Number(form.quantidadeMg.replace(",", ".")))
    || (form.status !== "OMITIDA" && !form.inicio) || (justificar && !form.motivo.trim());

  async function registrar(item: NonNullable<BasePrescricaoExecutavelResposta["ciclo"]>["itens"][number]) {
    if (invalido || salvando || !form.status) return;
    setSalvando(true); setErro(""); setMensagem("");
    const conteudo = JSON.stringify([chave, prescricao, item.item, form]);
    if (tentativa.current?.conteudo !== conteudo)
      tentativa.current = { conteudo, adminId: `adm-${ciclo!.cicloId}-${item.item}-${crypto.randomUUID()}`, operationId: crypto.randomUUID() };
    const agora = new Date().toISOString(), inicio = instante(form.inicio);
    const administracao: TreatmentAdministration = {
      adminId: tentativa.current.adminId, cicloId: ciclo!.cicloId, prescricaoRef: prescricao, item: item.item, droga: item.droga,
      quantidadeEfetivaMg: form.status === "OMITIDA" ? 0 : Number(form.quantidadeMg.replace(",", ".")),
      status: form.status, motivo: form.motivo.trim() || null, inicio: form.status === "OMITIDA" ? null : inicio, fim: instante(form.fim),
      reacaoInfusional: form.reacaoInfusional,
      fonte: { sourceId: `administracao-${tentativa.current.adminId}`, classe: "MANUAL", localizador: "registro no Salão",
        dataClinica: (inicio ?? agora).slice(0, 10), dataCaptura: agora, versao: "administracao-salao@1", contentHash: await sha256(conteudo) },
    };
    try {
      await porta.registrarAdministracao!({ contexto: { ...contexto, operationId: tentativa.current.operationId }, prescricao, administracao });
      tentativa.current = null; setAberto(null); setForm(VAZIO);
      setMensagem(`Administração de ${item.droga} registrada (${ROTULOS[administracao.status]}).`);
      aoRegistrado();
    } catch (e) { setErro(`Administração não registrada (${e instanceof Error ? e.message : "erro"}). Os dados foram preservados.`); }
    finally { setSalvando(false); }
  }

  return <section aria-label="Administração do ciclo">
    <h3>Administração do ciclo</h3>
    <p>Registre o que foi efetivamente administrado. A prescrição não conta como administração.</p>
    {mensagem ? <p role="status">{mensagem}</p> : null}
    {erro ? <p role="alert">{erro}</p> : null}
    <ul>{ciclo.itens.map(item => <li key={item.item}>
      <span>{item.item}. {item.droga} · prescrito {item.doseMg !== null ? `${item.doseMg} mg` : `${item.doseOriginal?.valor} ${item.doseOriginal?.unidade}`}</span>{" "}
      <button type="button" disabled={salvando} onClick={() => { setAberto(item.item); setForm(VAZIO); setErro(""); }}>Registrar administração de {item.droga}</button>
      {aberto === item.item ? <fieldset aria-label={`Administração de ${item.droga}`} disabled={salvando}>
        <label>Situação <select aria-label="Situação da administração" value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Status })}>
          <option value="">Selecione</option>{(Object.keys(ROTULOS) as Status[]).map(s => <option key={s} value={s}>{ROTULOS[s]}</option>)}
        </select></label>
        <label>Quantidade administrada (mg) <input aria-label="Quantidade administrada (mg)" inputMode="decimal" value={form.quantidadeMg}
          onChange={e => setForm({ ...form, quantidadeMg: e.target.value })} /></label>
        <label>Início <input aria-label="Início da administração" type="datetime-local" value={form.inicio} onChange={e => setForm({ ...form, inicio: e.target.value })} /></label>
        <label>Fim <input aria-label="Fim da administração" type="datetime-local" value={form.fim} onChange={e => setForm({ ...form, fim: e.target.value })} /></label>
        <label><input aria-label="Reação infusional" type="checkbox" checked={form.reacaoInfusional}
          onChange={e => setForm({ ...form, reacaoInfusional: e.target.checked })} /> Reação infusional</label>
        <label>Justificativa{justificar ? " (obrigatória)" : ""} <textarea aria-label="Justificativa da administração" rows={3} maxLength={2000}
          value={form.motivo} onChange={e => setForm({ ...form, motivo: e.target.value })} /></label>
        {justificar && !form.motivo.trim() ? <p role="status">Administração parcial, interrompida, omitida ou com reação infusional exige justificativa; ela volta ao médico no próximo encontro.</p> : null}
        <button type="button" disabled={invalido || salvando} onClick={() => void registrar(item)}>{salvando ? "Registrando…" : "Confirmar administração registrada"}</button>
        <button type="button" disabled={salvando} onClick={() => { setAberto(null); setForm(VAZIO); }}>Cancelar</button>
      </fieldset> : null}
    </li>)}</ul>
  </section>;
}
