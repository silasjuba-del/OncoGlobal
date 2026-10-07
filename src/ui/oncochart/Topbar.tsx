import { useEffect, useRef, useState, type ReactNode } from "react";
import { classeSemaforo } from "../tema/temas.js";
import { IconeCromo } from "./icones-cromo.js";
import { revelarTema } from "./revelacao.js";
import { temaOposto, type TemaOnco } from "./tema.js";
import type { TelaCasca } from "./Casca.js";

const ROTULO: Record<TelaCasca, string> = {
  agenda: "Agenda",
  consulta: "Consulta",
  salao: "Salão",
  canal: "Canal",
  apac: "APAC",
};

function Menu({
  rotulo,
  className,
  children,
  painel,
}: {
  rotulo: string;
  className: string;
  children: ReactNode;
  painel: ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    function fora(evento: MouseEvent) {
      if (!ref.current?.contains(evento.target as Node)) setAberto(false);
    }
    function tecla(evento: KeyboardEvent) {
      if (evento.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  return (
    <div className="oc-pop" ref={ref}>
      <button
        type="button"
        className={className}
        aria-label={rotulo}
        aria-expanded={aberto}
        aria-haspopup="true"
        onClick={() => setAberto((valor) => !valor)}
      >
        {children}
      </button>
      {aberto ? (
        <div className="oc-menu" role="region" aria-label={rotulo}>
          {painel}
        </div>
      ) : null}
    </div>
  );
}

export function Topbar({
  tela,
  pacienteNome,
  tema,
  onTema,
  onBuscar,
  comandos,
}: {
  tela: TelaCasca;
  pacienteNome: string | null;
  tema: TemaOnco;
  onTema: (tema: TemaOnco) => void;
  onBuscar: () => void;
  comandos: ReactNode;
}) {
  function alternar(origem: HTMLElement) {
    revelarTema(origem, () => onTema(temaOposto(tema)));
  }

  return (
    <header className="oc-topbar">
      <nav className="oc-crumb" aria-label="Trilha">
        <h1>OncoGlobal — WORK</h1>
        <IconeCromo nome="chevron" />
        <span>dados sintéticos</span>
        <IconeCromo nome="chevron" />
        <span>{ROTULO[tela]}</span>
        {pacienteNome ? (
          <>
            <IconeCromo nome="chevron" />
            <b>{pacienteNome}</b>
          </>
        ) : null}
      </nav>
      <button
        type="button"
        className="oc-busca"
        aria-label="Buscar"
        aria-keyshortcuts="Control+K"
        onClick={onBuscar}
      >
        <IconeCromo nome="busca" />
        <span>Buscar pacientes, exames, protocolos…</span>
        <span className="oc-kbd">Ctrl K</span>
      </button>
      {comandos}
      <button
        type="button"
        className="oc-tema"
        aria-label={`Dia / noite, agora ${tema}`}
        aria-pressed={tema === "noite"}
        onClick={(evento) => alternar(evento.currentTarget)}
      >
        <IconeCromo nome="lua" />
        <IconeCromo nome="sol" />
        <span className="oc-knob">
          <IconeCromo nome={tema === "noite" ? "lua" : "sol"} />
        </span>
      </button>
      <Menu rotulo="Alertas" className="oc-icon-btn" painel={<AlertaPendente />}>
        <IconeCromo nome="sino" />
      </Menu>
      <Menu
        rotulo="Usuário"
        className="oc-avatar"
        painel={
          <>
            <p><b>Médico Teste</b></p>
            <p>Oncologia clínica · CRM 00000</p>
            <button type="button" onClick={(evento) => alternar(evento.currentTarget)}>
              {tema === "noite" ? "Modo dia" : "Modo noite"}
            </button>
          </>
        }
      >
        MT
      </Menu>
    </header>
  );
}

/** Fonte de alertas ainda não ligada: ausente fica PENDENTE, sem selo verde. */
function AlertaPendente() {
  return (
    <>
      <p>Alertas clínicos</p>
      <p className={classeSemaforo("PENDENTE")}>PENDENTE</p>
    </>
  );
}
