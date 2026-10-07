import { useState } from "react";
import type { TemaOnco } from "./tema.js";

const GLOSSARIO: readonly { n: number; nome: string }[] = [
  { n: 8, nome: "Identidade" },
  { n: 21, nome: "Laudo / texto" },
  { n: 34, nome: "Achado estruturado" },
  { n: 45, nome: "Prescrição antineoplásica" },
];

/** Configurações + caixa de número + glossário (CURSOR-11, D-W9-16/17). */
export function Configuracoes({
  tema,
  onTema,
  onFechar,
}: {
  tema: TemaOnco;
  onTema: (t: TemaOnco) => void;
  onFechar: () => void;
}) {
  const [caixaN, setCaixaN] = useState("");
  const [dado, setDado] = useState("");
  const [salvo, setSalvo] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [cnes] = useState("2605473");
  const [personalizar, setPersonalizar] = useState(false);

  const hits = GLOSSARIO.filter(
    (g) =>
      !busca.trim() ||
      String(g.n).includes(busca) ||
      g.nome.toLowerCase().includes(busca.toLowerCase()),
  );

  return (
    <div className="oc-cfg" role="dialog" aria-label="Configurações">
      <header className="oc-cfg-h">
        <h2>Configurações</h2>
        <button type="button" onClick={onFechar} aria-label="Fechar configurações">
          Fechar
        </button>
      </header>

      <section aria-label="Identidade profissional">
        <h3>Identidade</h3>
        <label>
          Telefone
          <input aria-label="Telefone" defaultValue="" />
        </label>
        <label>
          CRM
          <input aria-label="CRM" defaultValue="" />
        </label>
        <label>
          Hospital
          <input aria-label="Hospital" defaultValue="" />
        </label>
        <label>
          CNES (exemplo editável)
          <input aria-label="CNES" defaultValue={cnes} />
        </label>
        <label>
          CNS
          <input aria-label="CNS" defaultValue="" />
        </label>
      </section>

      <section aria-label="Layout e tema">
        <h3>Layout</h3>
        <div role="group" aria-label="Tema DIA NOITE PERSONALIZAR">
          <button
            type="button"
            aria-pressed={!personalizar && tema === "dia"}
            data-tema-opcao="dia"
            onClick={() => {
              setPersonalizar(false);
              onTema("dia");
            }}
          >
            DIA
          </button>
          <button
            type="button"
            aria-pressed={!personalizar && tema === "noite"}
            data-tema-opcao="noite"
            onClick={() => {
              setPersonalizar(false);
              onTema("noite");
            }}
          >
            NOITE
          </button>
          <button
            type="button"
            aria-pressed={personalizar}
            data-tema-opcao="personalizar"
            onClick={() => setPersonalizar(true)}
          >
            PERSONALIZAR
          </button>
        </div>
        <p className="oc-muted">MCP/plugins externos nascem desligados.</p>
      </section>

      <section aria-label="Caixa de número">
        <h3>Caixa de número</h3>
        <label>
          Nº da caixa
          <input
            aria-label="Número da caixa"
            value={caixaN}
            onChange={(e) => setCaixaN(e.target.value)}
          />
        </label>
        <label>
          Dado
          <input
            aria-label="Dado da caixa"
            value={dado}
            onChange={(e) => setDado(e.target.value)}
          />
        </label>
        {caixaN ? (
          <p>
            Caixa #{caixaN}: valor antigo ={" "}
            {GLOSSARIO.find((g) => String(g.n) === caixaN)?.nome ?? "PENDENTE"}
          </p>
        ) : null}
        <button
          type="button"
          className="oc-btn-primary"
          onClick={() => setSalvo(`salvo #${caixaN} → ${dado} (evento versionado sintético)`)}
        >
          Salvar (1 clique)
        </button>
        {salvo ? (
          <p role="status">{salvo}</p>
        ) : null}
      </section>

      <section aria-label="Glossário de caixas">
        <h3>Glossário</h3>
        <label>
          Pesquisar
          <input
            aria-label="Pesquisar glossário"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </label>
        <ul>
          {hits.map((g) => (
            <li key={g.n}>
              <button type="button" onClick={() => setCaixaN(String(g.n))}>
                #{g.n} {g.nome}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Esteira de UI">
        <h3>Esteira de UI</h3>
        <p className="oc-muted">Versões em uso — padrão PADROES-UI §4 (sintético).</p>
        <ul>
          <li>Consulta · W10-CURSOR</li>
          <li>Prescrição · Modelo 05</li>
          <li>Jornada 3D · CSS preserve-3d</li>
        </ul>
      </section>
    </div>
  );
}
