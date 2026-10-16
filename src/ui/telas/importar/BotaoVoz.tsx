import { useEffect, useRef, useState } from "react";

export interface ReconhecimentoLocal {
  processLocally: boolean; lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null; onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
export interface ConstrutorReconhecimentoLocal {
  new(): ReconhecimentoLocal;
  available(options: { langs: string[]; processLocally: true }): Promise<string>;
}
function construtor(): ConstrutorReconhecimentoLocal | undefined {
  return (globalThis as typeof globalThis & { SpeechRecognition?: ConstrutorReconhecimentoLocal }).SpeechRecognition;
}

/** Somente ditado no dispositivo. Nunca instala assets nem recorre a reconhecimento remoto. */
export function BotaoVoz({ aoTrecho, aoAtividade, desabilitado = false }: {
  aoTrecho?: (texto: string) => void; aoAtividade?: (ativa: boolean) => void; desabilitado?: boolean;
} = {}) {
  const [estado, setEstado] = useState<"PARADO" | "VERIFICANDO" | "OUVINDO">("PARADO");
  const [mensagem, setMensagem] = useState("");
  const geracao = useRef(0), reconhecimento = useRef<ReconhecimentoLocal | null>(null);
  const callbacks = useRef({ aoTrecho, aoAtividade }); callbacks.current = { aoTrecho, aoAtividade };
  const disponivel = typeof construtor()?.available === "function" && !!aoTrecho;
  useEffect(() => () => {
    geracao.current++;
    const atual = reconhecimento.current;
    if (atual) { atual.onresult = null; atual.onerror = null; atual.onend = null; atual.abort(); }
    reconhecimento.current = null;
  }, []);

  async function iniciar() {
    if (desabilitado || estado !== "PARADO" || reconhecimento.current) return;
    const Constructor = construtor();
    if (!Constructor || typeof Constructor.available !== "function") return;
    const atual = ++geracao.current;
    setEstado("VERIFICANDO"); setMensagem(""); callbacks.current.aoAtividade?.(true);
    try {
      const disponibilidade = await Constructor.available({ langs: ["pt-BR"], processLocally: true });
      if (geracao.current !== atual) return;
      if (disponibilidade !== "available") throw Error("IDIOMA_LOCAL_INDISPONIVEL");
      const captura = new Constructor();
      if (!("processLocally" in captura)) throw Error("RECONHECIMENTO_LOCAL_INDISPONIVEL");
      captura.processLocally = true;
      if (captura.processLocally !== true) throw Error("RECONHECIMENTO_LOCAL_INDISPONIVEL");
      captura.lang = "pt-BR"; captura.continuous = true; captura.interimResults = false;
      const entregues = new Set<number>();
      captura.onresult = event => {
        if (geracao.current !== atual) return;
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const resultado = event.results[i];
          if (!resultado?.isFinal || entregues.has(i)) continue;
          entregues.add(i);
          if (resultado[0].transcript.trim()) callbacks.current.aoTrecho?.(resultado[0].transcript.trim());
        }
      };
      captura.onerror = event => {
        if (geracao.current !== atual) return;
        setMensagem(event.error === "not-allowed" ? "Microfone não autorizado. Você pode colar o texto."
          : "Ditado interrompido. Confira o texto recebido antes de salvar.");
        geracao.current++; reconhecimento.current = null;
        captura.onresult = null; captura.onerror = null; captura.onend = null; captura.abort();
        setEstado("PARADO"); callbacks.current.aoAtividade?.(false);
      };
      captura.onend = () => {
        if (geracao.current !== atual) return;
        geracao.current++; reconhecimento.current = null; setEstado("PARADO"); callbacks.current.aoAtividade?.(false);
      };
      reconhecimento.current = captura; captura.start(); setEstado("OUVINDO");
    } catch {
      if (geracao.current !== atual) return;
      geracao.current++;
      const captura=reconhecimento.current;
      if(captura){captura.onresult=null;captura.onerror=null;captura.onend=null;captura.abort();}
      reconhecimento.current = null; setEstado("PARADO"); callbacks.current.aoAtividade?.(false);
      setMensagem("Ditado local em português indisponível neste navegador. Cole uma transcrição para revisar.");
    }
  }
  return <div>
    <button type="button" aria-label="comando de voz" disabled={desabilitado || !disponivel || estado === "VERIFICANDO"}
      onClick={() => { if (estado === "OUVINDO") reconhecimento.current?.stop(); else void iniciar(); }}>
      {!disponivel ? "capacidade não habilitada" : estado === "VERIFICANDO" ? "Verificando ditado local…"
        : estado === "OUVINDO" ? "Parar ditado" : "Ditar neste computador"}
    </button>
    {!disponivel ? <p>Ditado local indisponível. Cole uma transcrição para revisar.</p> : null}
    {estado === "OUVINDO" ? <p role="status">Ouvindo neste computador. A fala preenche somente o rascunho.</p> : null}
    {mensagem ? <p role="status">{mensagem}</p> : null}
  </div>;
}
