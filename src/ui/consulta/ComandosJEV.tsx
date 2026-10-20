import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

export type ComandoJEV = "MANTER_CICLO" | "REDUZIR_DOSE" | "ADIAR_CICLO" | "TROCAR_PROTOCOLO"
  | "REVISAR_DOCUMENTOS" | "ABRIR_APAC" | "VER_HISTORICO";

const COMANDOS: readonly { id: ComandoJEV; titulo: string; descricao: string; termos: readonly string[] }[] = [
  { id: "MANTER_CICLO", titulo: "Manter ciclo", descricao: "Abrir rascunho para revisar o ciclo vigente.", termos: ["manter", "ciclo", "continuar"] },
  { id: "REDUZIR_DOSE", titulo: "Reduzir dose", descricao: "Abrir rascunho para selecionar medicamento, redução e motivo.", termos: ["reduzir", "dose", "medicamento"] },
  { id: "ADIAR_CICLO", titulo: "Adiar ciclo", descricao: "Abrir rascunho para revisar data e motivo.", termos: ["adiar", "atrasar", "data", "ciclo"] },
  { id: "TROCAR_PROTOCOLO", titulo: "Trocar protocolo ou linha", descricao: "Abrir rascunho para escolher destino e justificar a troca.", termos: ["trocar", "protocolo", "linha", "mudar"] },
  { id: "REVISAR_DOCUMENTOS", titulo: "Revisar documentos", descricao: "Abrir a revisão das fontes deste contexto.", termos: ["revisar", "documento", "fonte"] },
  { id: "ABRIR_APAC", titulo: "Abrir APAC", descricao: "Abrir a área de APAC deste contexto.", termos: ["apac", "autorização", "autorizacao"] },
  { id: "VER_HISTORICO", titulo: "Ver histórico", descricao: "Abrir o histórico deste contexto.", termos: ["histórico", "historico", "eventos"] },
];

function normalizar(valor: string) {
  return valor.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function alvoEditavel(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || !!target.closest("input, textarea, select, [contenteditable='true']");
}

export function ComandosJEV({ ocupado = false, aoComando }: {
  ocupado?: boolean;
  aoComando: (comando: ComandoJEV) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [indice, setIndice] = useState(0);
  const entrada = useRef<HTMLInputElement>(null);
  const dialogo = useRef<HTMLDivElement>(null);
  const acionador = useRef<HTMLButtonElement>(null);
  const focoAnterior = useRef<HTMLElement | null>(null);
  const restaurarFoco = useRef(false);
  const id = useId();
  const encontrados = COMANDOS.filter(comando => {
    const consulta = normalizar(busca);
    return !consulta || normalizar(`${comando.titulo} ${comando.termos.join(" ")}`).includes(consulta);
  });

  function abrir() {
    if (ocupado || aberto) return;
    focoAnterior.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
      ? document.activeElement : acionador.current;
    restaurarFoco.current = false;
    setBusca(""); setIndice(0); setAberto(true);
  }

  function fechar() {
    restaurarFoco.current = true;
    setAberto(false);
  }

  function selecionar(comando: ComandoJEV) {
    if (ocupado) return;
    aoComando(comando);
    fechar();
  }

  useEffect(() => {
    if (aberto) { entrada.current?.focus(); return; }
    if (restaurarFoco.current) {
      restaurarFoco.current = false;
      if (focoAnterior.current?.isConnected) focoAnterior.current.focus();
    }
  }, [aberto]);

  // O atalho fica disponível no mesmo quadro em que o cockpit se torna visível.
  useLayoutEffect(() => {
    function tecla(evento: KeyboardEvent) {
      if (!evento.ctrlKey || evento.key.toLowerCase() !== "k" || evento.isComposing || alvoEditavel(evento.target)) return;
      evento.preventDefault(); abrir();
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [ocupado, aberto]);

  function tecladoDialogo(evento: ReactKeyboardEvent<HTMLDivElement>) {
    if (evento.key === "Escape") { evento.preventDefault(); fechar(); return; }
    if (evento.key !== "Tab") return;
    const focaveis = Array.from(evento.currentTarget.querySelectorAll<HTMLElement>(
      "button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex='-1'])",
    ));
    const primeiro = focaveis[0], ultimo = focaveis[focaveis.length - 1];
    if (evento.shiftKey && (document.activeElement === primeiro || document.activeElement === evento.currentTarget)) {
      evento.preventDefault(); ultimo?.focus();
    } else if (!evento.shiftKey && (document.activeElement === ultimo || document.activeElement === evento.currentTarget)) {
      evento.preventDefault(); primeiro?.focus();
    }
  }

  function tecladoEntrada(evento: ReactKeyboardEvent<HTMLInputElement>) {
    if (evento.key === "ArrowDown" && encontrados.length) {
      evento.preventDefault(); setIndice(atual => (atual + 1) % encontrados.length);
    } else if (evento.key === "ArrowUp" && encontrados.length) {
      evento.preventDefault(); setIndice(atual => (atual - 1 + encontrados.length) % encontrados.length);
    } else if (evento.key === "Enter" && encontrados[indice]) {
      evento.preventDefault(); selecionar(encontrados[indice]!.id);
    }
  }

  const selecionadoId = encontrados[indice] ? `${id}-opcao-${indice}` : undefined;
  return <div className="jev-commands">
    <button ref={acionador} type="button" className="jev-commands__trigger" disabled={ocupado}
      aria-haspopup="dialog" onClick={abrir}>
      Comandos JEV <kbd>Ctrl+K</kbd>
    </button>
    {aberto ? <div className="jev-command-overlay" onMouseDown={evento => {
      if (evento.target === evento.currentTarget) fechar();
    }}>
      <div ref={dialogo} className="jev-command-sheet" role="dialog" aria-modal="true"
        aria-labelledby={`${id}-titulo`} aria-describedby={`${id}-descricao`} onKeyDown={tecladoDialogo}>
        <header className="jev-command-sheet__header">
          <div><p className="jev-eyebrow">Rascunhos de intenção</p><h2 id={`${id}-titulo`}>Comandos da consulta</h2></div>
          <button type="button" aria-label="Fechar comandos" onClick={fechar}>Fechar</button>
        </header>
        <p id={`${id}-descricao`}>Escolher um comando abre um rascunho para revisão. Nenhum comando executa cuidado clínico.</p>
        <label className="jev-command-search">Buscar comando
          <input ref={entrada} type="search" role="combobox" aria-label="Buscar comando" aria-expanded="true" disabled={ocupado}
            aria-controls={`${id}-lista`} aria-activedescendant={selecionadoId} value={busca}
            placeholder="Ex.: adiar ciclo, reduzir dose" onChange={evento => { setBusca(evento.target.value); setIndice(0); }}
            onKeyDown={tecladoEntrada} />
        </label>
        {encontrados.length ? <ul id={`${id}-lista`} className="jev-command-list" role="listbox" aria-label="Comandos disponíveis">
          {encontrados.map((comando, index) => <li key={comando.id} role="presentation">
            <button id={`${id}-opcao-${index}`} type="button" role="option" disabled={ocupado} aria-selected={indice === index}
              className={indice === index ? "jev-command-option is-active" : "jev-command-option"}
              onMouseEnter={() => setIndice(index)} onClick={() => selecionar(comando.id)}>
              <strong>{comando.titulo}</strong><span>{comando.descricao}</span>
            </button>
          </li>)}
        </ul> : <p className="jev-command-empty" role="status">Nenhum comando corresponde à busca.</p>}
      </div>
    </div> : null}
  </div>;
}
