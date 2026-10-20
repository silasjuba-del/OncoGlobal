import { useEffect, useRef, useState } from "react";
import type { PortaConsulta } from "../api/porta.js";
import type { ContextoAcaoComposta } from "../../contracts/api/acoesCompostas.js";
import type { FichaProtocoloCatalogo, InstanciacaoFichaResposta } from "../../contracts/api/fichasPrescricao.js";
import { CatalogoFichasPrescricao } from "./CatalogoFichasPrescricao.js";

export function mensagemErroFicha(erro: unknown): string {
  const codigo = erro instanceof Error ? erro.message : "";
  const mensagens: Record<string, string> = {
    FICHA_NAO_CONFERIDA: "Confira a versão da ficha antes de usá-la nesta consulta.",
    FICHA_REVISAO_ALTERADA: "A revisão da ficha mudou. Atualize o catálogo e selecione a versão vigente.",
    FICHA_CONTEUDO_ALTERADO: "O conteúdo da ficha mudou. Atualize o catálogo e confira novamente esta versão.",
    FICHA_IDENTIDADE_DUPLICADA: "Há fichas com a mesma identidade e versão. O catálogo precisa ser corrigido antes do uso.",
    ORIGEM_FICHA_INVALIDA: "Não foi possível validar a origem. Selecione novamente a ficha para esta consulta.",
    ORIGEM_FICHA_FORA_DO_CONTEXTO: "A origem pertence a outro atendimento. Selecione a ficha nesta consulta.",
    ORIGEM_FICHA_FATOS_ALTERADOS: "Os dados clínicos mudaram depois do cálculo. Atualize a consulta e calcule a ficha novamente.",
    ORIGEM_FICHA_PROTOCOLO_ALTERADO: "O esquema foi alterado. Selecione outra ficha ou desvincule a origem para editar manualmente.",
    ORIGEM_PROTOCOLO_ALTERADA: "Um item foi alterado sem registrar a edição manual. Confira sua origem e o motivo.",
    BASE_PRESCRICAO_ALTERADA: "Os dados da prescrição mudaram. Atualize a consulta antes de preparar novamente.",
    PRESCRICAO_INCOMPLETA: "Há dados de prescrição ou preparo pendentes. Confira os itens antes de preparar a prévia.",
  };
  return mensagens[codigo] ?? (codigo || "Não foi possível concluir a operação da ficha.");
}

export function FichasPrescricaoConsulta({ porta, contexto, ocupado, aoInstanciar, aoAlterarSalvando }: {
  porta: PortaConsulta; contexto: ContextoAcaoComposta; ocupado: boolean;
  aoInstanciar: (origem: InstanciacaoFichaResposta) => void; aoAlterarSalvando: (salvando: boolean) => void;
}) {
  const [fichas, setFichas] = useState<FichaProtocoloCatalogo[]>([]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [catalogoAberto, setCatalogoAberto] = useState(false);
  const geracao = useRef(0), lendo = useRef(0), executando = useRef(false);
  const chaveContexto = JSON.stringify(contexto), contextoAtual = useRef(chaveContexto);
  contextoAtual.current = chaveContexto;
  const callbackBusy = useRef(aoAlterarSalvando); callbackBusy.current = aoAlterarSalvando;
  const tentativa = useRef<{ conteudo: string; chave: string } | null>(null);
  useEffect(() => {
    const atual = ++geracao.current, abort = new AbortController(), leitura = ++lendo.current;
    setFichas([]); setErro(""); setCarregando(true); tentativa.current = null; executando.current = false;
    void porta.listarFichasPrescricao?.(abort.signal).then(r => {
      if (atual === geracao.current && leitura === lendo.current) setFichas(r.fichas);
    }, () => { if (atual === geracao.current) setErro("Não foi possível carregar as fichas locais."); })
      .finally(() => { if (atual === geracao.current) setCarregando(false); });
    return () => { geracao.current++; lendo.current++; abort.abort(); callbackBusy.current(false); };
  }, [porta, chaveContexto]);

  async function executar<T>(acao: () => Promise<T>, aplicar: (r: T) => void): Promise<T> {
    if (ocupado || executando.current) throw new Error("Aguarde a operação da prescrição.");
    const atual = geracao.current, ctx = chaveContexto;
    executando.current = true; callbackBusy.current(true);
    try {
      const r = await acao();
      if (atual !== geracao.current || ctx !== contextoAtual.current) throw new Error("A consulta mudou. Selecione novamente a ficha.");
      aplicar(r); return r;
    } catch (error) {
      throw new Error(mensagemErroFicha(error));
    } finally {
      if (atual === geracao.current && ctx === contextoAtual.current) { executando.current = false; callbackBusy.current(false); }
    }
  }
  return <details className="prescricao-executavel__section"
    onToggle={event => { if (event.currentTarget.open) setCatalogoAberto(true); }}>
    <summary>Fichas de protocolo: conferir e usar na prescrição</summary>
    {catalogoAberto ? <CatalogoFichasPrescricao fichas={fichas} contextoChave={chaveContexto} ocupado={ocupado || carregando} erro={erro}
      aoRecarregar={async () => {
        if (!porta.listarFichasPrescricao) throw new Error("Catálogo indisponível.");
        const leitura = ++lendo.current;
        await executar(() => porta.listarFichasPrescricao!(), r => {
          if (leitura === lendo.current) { setFichas(r.fichas); setErro(""); }
        });
      }}
      aoRevisar={async pedido => {
        if (!porta.revisarFichaPrescricao) throw new Error("Conferência indisponível.");
        return executar(() => porta.revisarFichaPrescricao!(pedido), revisada => {
          lendo.current++;
          setFichas(atuais => atuais.map(f => f.template.templateId === revisada.template.templateId
            && f.template.versao === revisada.template.versao && f.revision <= revisada.revision ? revisada : f));
        });
      }}
      aoUsar={async ficha => {
        if (!porta.instanciarFichaPrescricao) throw new Error("Cálculo de ficha indisponível.");
        const conteudo = JSON.stringify([chaveContexto, ficha.template.templateId, ficha.template.versao, ficha.contentHash, ficha.revision]);
        if (tentativa.current?.conteudo !== conteudo) tentativa.current = { conteudo, chave: crypto.randomUUID() };
        await executar(() => porta.instanciarFichaPrescricao!({ contexto, templateId: ficha.template.templateId,
          versao: ficha.template.versao, expectedContentHash: ficha.contentHash, expectedRevision: ficha.revision,
          idempotencyKey: tentativa.current!.chave }), origem => { tentativa.current = null; aoInstanciar(origem); });
      }} /> : null}
  </details>;
}
