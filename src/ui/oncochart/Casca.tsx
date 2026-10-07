import { useEffect, useState, type ReactNode } from "react";
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
  children,
}: {
  tela: TelaCasca;
  onTela: (tela: TelaCasca) => void;
  pacienteNome: string | null;
  onBuscar: () => void;
  comandos: ReactNode;
  children: ReactNode;
}) {
  const [tema, setTema] = useState<TemaOnco>(lerTemaOnco);

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
            comandos={comandos}
          />
          <div className="oc-corpo">{children}</div>
        </main>
        <PainelLateral />
      </div>
    </Palco>
  );
}
