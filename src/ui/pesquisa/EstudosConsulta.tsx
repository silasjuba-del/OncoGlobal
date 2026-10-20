import { useEffect, useRef, useState } from "react";
import type { PortaConsulta } from "../api/porta.js";
import type { ContextoAcaoComposta } from "../../contracts/api/acoesCompostas.js";
import type { EstudoServico, FatosTrialsResposta } from "../../contracts/api/trialsServico.js";
import { PainelEstudos } from "./PainelEstudos.js";

export function EstudosConsulta({ porta, contexto, aoAlterarPendente, aoAlterarSalvamento }: {
  porta: PortaConsulta; contexto: ContextoAcaoComposta | null;
  aoAlterarPendente?: (pendente: boolean) => void;
  aoAlterarSalvamento?: (salvando: boolean) => void;
}) {
  const [estudos, setEstudos] = useState<EstudoServico[]>([]);
  const [catalogo, setCatalogo] = useState<FatosTrialsResposta | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [recarga, setRecarga] = useState(0);
  const geracao = useRef(0);
  const geracaoFatos = useRef(0);
  const c = contexto;
  const chave = JSON.stringify([c?.patientId, c?.encounterId, c?.tumorLotId]);
  const contextoAtual = useRef(chave); contextoAtual.current = chave;
  useEffect(() => {
    const atual = ++geracao.current, abort = new AbortController();
    setCarregando(true); setErro(""); setEstudos([]);
    if (!porta.listarEstudosTrials) { setErro("Estudos indisponíveis nesta conexão."); setCarregando(false); return; }
    void porta.listarEstudosTrials(abort.signal).then(r => {
      if (geracao.current === atual) setEstudos(r.estudos);
    }, () => { if (geracao.current === atual) setErro("Não foi possível carregar os estudos locais."); })
      .finally(() => { if (geracao.current === atual) setCarregando(false); });
    return () => { geracao.current++; abort.abort(); };
  }, [porta, recarga]);
  useEffect(() => {
    const leitura = ++geracaoFatos.current;
    setCatalogo(null);
    if (!c || !porta.lerFatosTrials) return;
    const abort = new AbortController();
    let ativo = true;
    void porta.lerFatosTrials(c, abort.signal).then(dados => {
      if (ativo && leitura === geracaoFatos.current) setCatalogo(dados);
    }, () => { /* Nenhum fato é fabricado em falha; o matching fará nova leitura autenticada. */ });
    return () => { ativo = false; geracaoFatos.current++; abort.abort(); };
  }, [porta, chave, recarga]);
  const atualizar = (estudo: EstudoServico) => setEstudos(lista => {
    const existente = lista.find(e => e.draftId === estudo.draftId);
    if (existente && existente.revision > estudo.revision) return lista;
    return [...lista.filter(e => e.draftId !== estudo.draftId), estudo];
  });
  const fatosAtuais = catalogo && c && catalogo.contexto.patientId === c.patientId
    && catalogo.contexto.encounterId === c.encounterId && catalogo.contexto.tumorLotId === c.tumorLotId ? catalogo.fatos : [];
  return <section aria-label="Estudos clínicos do consultório">
    {erro ? <p role="alert">{erro} <button type="button" onClick={() => setRecarga(v => v + 1)}>Tentar novamente</button></p> : null}
    <PainelEstudos estudos={estudos} contexto={contexto} fatosDisponiveis={fatosAtuais} ocupado={carregando}
      {...(aoAlterarPendente ? { aoAlterarPendente } : {})}
      {...(aoAlterarSalvamento ? { aoAlterarSalvamento } : {})}
      aoImportar={async pedido => {
        if (!porta.importarEstudoTrial) throw new Error("Importação indisponível.");
        const atual = geracao.current;
        const estudo = await porta.importarEstudoTrial(pedido);
        if (atual !== geracao.current) throw new Error("A conexão mudou. Reabra os estudos.");
        atualizar(estudo); return estudo;
      }}
      aoRevisar={async pedido => {
        if (!porta.revisarEstudoTrial) throw new Error("Revisão indisponível.");
        const atual = geracao.current;
        const estudo = await porta.revisarEstudoTrial(pedido);
        if (atual !== geracao.current) throw new Error("A conexão mudou. Reabra os estudos.");
        atualizar(estudo); return estudo;
      }}
      aoAvaliar={async pedido => {
        if (!porta.avaliarEstudoTrial || chave !== contextoAtual.current) throw new Error("Selecione a consulta novamente.");
        const atual = geracao.current, contextoSolicitado = chave;
        const leitura = ++geracaoFatos.current;
        const resposta = await porta.avaliarEstudoTrial(pedido);
        if (atual !== geracao.current || contextoSolicitado !== contextoAtual.current)
          throw new Error("A consulta mudou. Refaça a comparação.");
        if (leitura === geracaoFatos.current)
          setCatalogo({ contexto: resposta.contexto, revisaoFatos: resposta.revisaoFatos, fatos: resposta.fatos });
        return resposta;
      }} />
  </section>;
}
