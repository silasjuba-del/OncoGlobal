import { useEffect, useState, type ReactNode } from "react";
import { Configuracoes } from "./Configuracoes.js";
import { PainelLateral } from "./PainelLateral.js";
import { Palco } from "./Palco.js";
import { gravarTemaOnco, lerTemaOnco, type TemaOnco } from "./tema.js";
import { Topbar } from "./Topbar.js";
import { Trilho } from "./Trilho.js";

export type TelaCasca = "agenda" | "consulta" | "salao" | "canal" | "apac";

export function CascaOncoChart({
  tela,
  onTela,
  pacienteNome,
  onBuscar,
  comandos,
  lateral,
  children,
}: {
  tela: TelaCasca;
  onTela: (tela: TelaCasca) => void;
  pacienteNome: string | null;
  onBuscar: () => void;
  comandos: ReactNode;
  lateral?: ReactNode;
  children: ReactNode;
}) {
  const [tema, setTema] = useState<TemaOnco>(lerTemaOnco);
  const [cfg, setCfg] = useState(false);

  useEffect(() => {
    gravarTemaOnco(tema);
  }, [tema]);

  return (
    <Palco tema={tema}>
      <div className="oc-app" data-grade="58-1fr-396">
        <Trilho tela={tela} onTela={onTela} />
        <main className="oc-main" data-coluna="principal">
          <Topbar
            tela={tela}
            pacienteNome={pacienteNome}
            tema={tema}
            onTema={setTema}
            onBuscar={onBuscar}
            onConfigurar={() => setCfg(true)}
            comandos={comandos}
          />
          <div className="oc-corpo">{children}</div>
        </main>
        <PainelLateral>{lateral}</PainelLateral>
        {cfg ? (
          <Configuracoes tema={tema} onTema={setTema} onFechar={() => setCfg(false)} />
        ) : null}
      </div>
    </Palco>
  );
}
