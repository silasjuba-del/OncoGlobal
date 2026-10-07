import type { ComponentType } from "react";
import { COPY_PT_BR } from "../copy/pt-BR.js";
import { IconeAgenda, IconeApac, IconeDocumentos, IconeEnfermagem, IconeProntuario } from "../icones/index.js";
import type { TelaCasca } from "./Casca.js";

const ITENS: readonly { id: TelaCasca; rotulo: string; Icone: ComponentType }[] = [
  { id: "agenda", rotulo: COPY_PT_BR.navegacao.agenda, Icone: IconeAgenda },
  { id: "consulta", rotulo: COPY_PT_BR.navegacao.prontuario, Icone: IconeProntuario },
  { id: "salao", rotulo: "Salão", Icone: IconeEnfermagem },
  { id: "canal", rotulo: "Canal", Icone: IconeDocumentos },
  { id: "apac", rotulo: COPY_PT_BR.navegacao.apac, Icone: IconeApac },
];

/** Trilho de 58 px. Só troca a tela já ligada no App. */
export function Trilho({ tela, onTela }: { tela: TelaCasca; onTela: (tela: TelaCasca) => void }) {
  return (
    <nav className="oc-rail" aria-label="Seções" data-coluna="trilho">
      <div className="oc-logo" aria-hidden="true">On</div>
      {ITENS.map((item) => (
        <button
          key={item.id}
          type="button"
          className="oc-rail-btn"
          aria-label={item.rotulo}
          title={item.rotulo}
          aria-current={tela === item.id ? "page" : undefined}
          onClick={() => onTela(item.id)}
        >
          <item.Icone />
        </button>
      ))}
    </nav>
  );
}
