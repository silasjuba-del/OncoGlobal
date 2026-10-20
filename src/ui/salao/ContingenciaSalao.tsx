import { useEffect, useRef, useState } from "react";
import type { PortaConsulta } from "../api/porta.js";
import type { FolhaContingenciaSalao } from "../../contracts/f3/salaoOperacional.js";
import type { Destino } from "../../contracts/estados.js";

/** A folha registra informação operacional médica; não executa liberação nem administração. */
export function ContingenciaSalao({ porta, patientId, encounterId, nome }: {
  porta: PortaConsulta; patientId: string; encounterId: string; nome: string;
}) {
  const [resumo, setResumo] = useState("");
  const [destino, setDestino] = useState<Destino>("FILA_MEDICO");
  const [emergencia, setEmergencia] = useState(false);
  const [alerta, setAlerta] = useState("");
  const [folhas, setFolhas] = useState<FolhaContingenciaSalao[]>([]);
  const [exibida, setExibida] = useState<FolhaContingenciaSalao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const viva = useRef(true);
  const tentativa = useRef<{ conteudo: string; operationId: string } | null>(null);
  useEffect(() => {
    viva.current = true;
    void porta.historicoContingenciaSalao?.({ patientId, encounterId })
      .then(f => { if (viva.current) setFolhas(atuais => [...new Map([...f, ...atuais].map(folha => [folha.folhaId, folha])).values()]); })
      .catch(() => { if (viva.current) setErro("Não foi possível reabrir as folhas deste encontro."); });
    return () => { viva.current = false; };
  }, [porta, patientId, encounterId]);
  if (!porta.gerarContingenciaSalao || !porta.historicoContingenciaSalao) return null;
  return <section aria-label="Contingência do salão">
    <h2>Folha operacional de contingência</h2>
    <p>{nome} · {patientId} · {encounterId}</p>
    <p>Registre o resumo operacional e confira a folha antes de imprimir. Ela não substitui a prescrição assinada.</p>
    <form onSubmit={async e => {
      e.preventDefault(); if (ocupado) return;
      setOcupado(true); setErro(null); setExibida(null);
      const conteudo = JSON.stringify({ resumo: resumo.trim(), destino, emergencia, alerta: alerta.trim() });
      if (tentativa.current?.conteudo !== conteudo) tentativa.current = { conteudo, operationId: crypto.randomUUID() };
      try {
        const folha = await porta.gerarContingenciaSalao!({ patientId, encounterId,
          operationId: tentativa.current.operationId, destino, emergenciaAtiva: emergencia,
          alertasOperacionaisE1: emergencia ? [alerta.trim()] : [], resumoTriagem: { "Resumo médico": resumo.trim() } });
        if (!viva.current) return;
        setExibida(folha);
        setFolhas(atuais => [...atuais.filter(f => f.folhaId !== folha.folhaId), folha]);
      } catch { if (viva.current) setErro("Folha não gravada. Confira o contexto e tente novamente."); }
      finally { if (viva.current) setOcupado(false); }
    }}>
      <label>Resumo operacional informado pelo médico<textarea required maxLength={500} value={resumo}
        onChange={e => { setResumo(e.target.value); setExibida(null); }} /></label>
      <label>Destino registrado na folha<select value={destino} onChange={e => { setDestino(e.target.value as Destino); setExibida(null); }}>
        <option value="FILA_MEDICO">Fila do médico</option><option value="SALAO">Salão</option><option value="FRENTE">Frente</option>
      </select></label>
      <label><input type="checkbox" checked={emergencia} onChange={e => { setEmergencia(e.target.checked); setExibida(null); }} />Emergência ativa informada pelo médico</label>
      {emergencia && <label>Destaque E1 confirmado<textarea required maxLength={500} value={alerta}
        onChange={e => { setAlerta(e.target.value); setExibida(null); }} /></label>}
      <button type="submit" disabled={ocupado || !resumo.trim() || (emergencia && !alerta.trim())}>Conferir e gravar folha operacional</button>
    </form>
    {erro && <p role="alert">{erro}</p>}
    <ul>{folhas.map(f => <li key={f.folhaId}><button type="button" data-folha-id={f.folhaId} onClick={() => setExibida(f)}>Reabrir folha de {f.dataImpressao} · {f.geradoEm}</button></li>)}</ul>
    {exibida && <div>
      <p>Folha persistida em {exibida.geradoEm}</p>
      <iframe title="Folha operacional persistida" sandbox="allow-modals" srcDoc={exibida.htmlImprimivel} />
      <p>Use a opção de impressão do navegador sobre a folha conferida.</p>
    </div>}
  </section>;
}
