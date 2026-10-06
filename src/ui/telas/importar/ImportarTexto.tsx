import { useState, type ReactNode } from "react";
import { BotaoVoz } from "./BotaoVoz.js";

export interface RascunhoLocal {
  texto: string;
  revisao: "RAW";
  origem: "TRANSCRICAO" | "LAUDO";
}

function pareceIdentificador(valor: string): boolean {
  if (/\d{3}\.\d{3}\.\d{3}-\d{2}/.test(valor)) return true;
  if (/(?<!\d)\d{15}(?!\d)/.test(valor)) return true;
  if (/(?<!\d)\d{11}(?!\d)/.test(valor)) return true;
  if (/[^\s@]+@[^\s@]+\.[^\s@]+/.test(valor)) return true;
  if (/(?:\+55\s?)?\(?\d{2}\)?\s?9\d{4}-?\d{4}/.test(valor)) return true;
  return false;
}

function destacar(texto: string): ReactNode[] {
  return texto.split(/(⟨NOME_\d+⟩)/g).map((parte, indice) => (
    /^⟨NOME_\d+⟩$/.test(parte)
      ? <mark key={`${indice}-${parte}`}>{parte}</mark>
      : <span key={`${indice}-texto`}>{parte}</span>
  ));
}

/** Importação local. O texto vira rascunho RAW, nunca fato confirmado. */
export function ImportarTexto() {
  const [texto, setTexto] = useState("");
  const [aviso, setAviso] = useState(false);
  const [rascunho, setRascunho] = useState<RascunhoLocal | null>(null);

  function gravar(origem: RascunhoLocal["origem"], confirmado: boolean) {
    if (pareceIdentificador(texto) && !confirmado) {
      setAviso(true);
      return;
    }
    setAviso(false);
    setRascunho({ texto, revisao: "RAW", origem });
  }

  function aoArquivo(arquivo: File | undefined) {
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = () => {
      const lido = String(leitor.result ?? "");
      setTexto(lido);
      setAviso(false);
      setRascunho(null);
    };
    leitor.readAsText(arquivo);
  }

  return (
    <section aria-label="Importar texto" className="pilha">
      <h1>Importar texto</h1>
      <label>
        Transcrição
        <textarea
          aria-label="Transcrição desidentificada"
          value={texto}
          onChange={(evento) => {
            setTexto(evento.target.value);
            setAviso(false);
            setRascunho(null);
          }}
        />
      </label>
      <div aria-label="Pré-visualização">{destacar(texto)}</div>
      {aviso ? <p>parece conter identificador</p> : null}
      <button type="button" onClick={() => gravar("TRANSCRICAO", false)}>importar</button>
      {aviso ? (
        <button type="button" onClick={() => gravar("TRANSCRICAO", true)}>confirmar importação</button>
      ) : null}
      <label>
        Laudo
        <input
          aria-label="Anexar laudo"
          type="file"
          onChange={(evento) => aoArquivo(evento.target.files?.[0])}
        />
      </label>
      <BotaoVoz />
      {rascunho ? (
        <section aria-label="Rascunho importado">
          <p>rascunho</p>
          <p>revisao: {rascunho.revisao}</p>
          <p>{rascunho.texto}</p>
        </section>
      ) : null}
    </section>
  );
}
