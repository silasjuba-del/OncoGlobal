import { useState } from "react";
import type { PortaConsulta, SalaoVisao } from "../api/porta.js";

/** Revisão local explícita; relato nunca confirma alergia, droga ou tratamento executado. */
export function FilaRelatosInfusao({ porta, relatos, aoAtualizar, bloqueado=false }: {
  porta: PortaConsulta; relatos: NonNullable<SalaoVisao["relatosInfusao"]>; aoAtualizar: () => Promise<void>;
  bloqueado?:boolean;
}) {
  const [decisoes, setDecisoes] = useState<Record<string, string>>({});
  const [contextos, setContextos] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  if (!relatos.length) return null;
  return <section aria-label="Fila de relatos do canal para revisão médica">
    <h2>Relatos do canal · revisão médica pendente</h2>
    <p>Inclui pacientes fora da agenda de hoje. Cada revisão mantém seu paciente e encontro explícitos.</p>
    {erro && <p role="alert">{erro}</p>}
    {relatos.map(r => {
      const opcoes = r.contextosRevisao ?? [];
      const valor = contextos[r.mensagemId] ?? (opcoes.length === 1 ? JSON.stringify(opcoes[0]) : "");
      return <section key={r.mensagemId} aria-label="Relato de infusão pendente">
        <h3>Paciente {r.patientId}</h3>
        <p>Relato do canal; agente e diagnóstico não confirmados. Não impede a conduta do médico.</p>
        <ul>{r.contextoMensagens.map(m => <li key={m.mensagemId}>{m.em} · {m.texto}
          <small> · contato {m.contatoId ?? "não informado"} · {m.canal ?? "origem não informada"} · fonte {m.mensagemId}</small></li>)}</ul>
        {porta.revisarRelatoInfusao && <form onSubmit={async e => {
          e.preventDefault(); if (ocupado || bloqueado || !valor) return;
          const contexto = opcoes.find(c => JSON.stringify(c) === valor);
          if (!contexto || contexto.patientId !== r.patientId) return;
          setOcupado(true); setErro(null);
          let registrada = false;
          try { await porta.revisarRelatoInfusao!({ contexto: { ...contexto, operationId: crypto.randomUUID() },
            mensagemId: r.mensagemId, payloadSha256: r.payloadSha256, decisao: decisoes[r.mensagemId] ?? "" });
            registrada = true;
            await aoAtualizar();
          } catch { setErro(registrada ? "Revisão registrada; não foi possível atualizar a fila." : "Revisão não registrada. Confira paciente, encontro e fonte e tente novamente."); }
          finally { setOcupado(false); }
        }}>
          <label>Encontro para revisão do relato<select aria-label="Encontro para revisão do relato" value={valor} disabled={ocupado}
            onChange={e => setContextos(v => ({ ...v, [r.mensagemId]: e.target.value }))}>
            <option value="">Selecione o encontro</option>{opcoes.map(c => <option key={c.encounterId} value={JSON.stringify(c)}>{c.encounterId}</option>)}
          </select></label>
          <label>Decisão médica sobre o relato<textarea required maxLength={2000} disabled={ocupado} value={decisoes[r.mensagemId] ?? ""}
            onChange={e => setDecisoes(v => ({ ...v, [r.mensagemId]: e.target.value }))} /></label>
          <button type="submit" disabled={ocupado || bloqueado || !valor}>Registrar revisão deste relato</button>
        </form>}
      </section>;
    })}
  </section>;
}
