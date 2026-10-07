import { useMemo, useState } from "react";
import { classeSemaforo } from "../tema/temas.js";

const PASSOS = [
  { id: "id", titulo: "Identificação", proximo: "Sinais" },
  { id: "sinais", titulo: "Sinais", proximo: "Laboratorial" },
  { id: "lab", titulo: "Lab", proximo: "ECOG" },
  { id: "ecog", titulo: "ECOG", proximo: "CTCAE" },
  { id: "ctcae", titulo: "CTCAE", proximo: "Resumo" },
] as const;

/** Wizard de triagem em 5 passos — nunca trava avanço (vazio = PENDENTE). */
export function Triagem5Passos({
  pacienteNome,
  onResumo,
}: {
  pacienteNome: string;
  onResumo?: (texto: string) => void;
}) {
  const [passo, setPasso] = useState(0);
  const [alerta, setAlerta] = useState<string | null>(null);
  const [idNome, setIdNome] = useState(pacienteNome);
  const [pas, setPas] = useState("");
  const [hb, setHb] = useState("");
  const [ecog, setEcog] = useState<number | null>(null);
  const [ctcae, setCtcae] = useState("");

  const atual = PASSOS[passo]!;

  function alertarCampo(valor: string, rotulo: string) {
    // Alerta enquanto digita — resultado real viria da regra Grok/salão.
    if (valor.trim() === "") {
      setAlerta(`${rotulo}: PENDENTE (não trava avanço)`);
      return;
    }
    const n = Number(valor.replace(",", "."));
    if (rotulo === "PAS" && Number.isFinite(n) && n >= 180) {
      setAlerta("PAS elevada — corte do salão (alerta, sem bloqueio)");
      return;
    }
    if (rotulo === "Hb" && Number.isFinite(n) && n < 8) {
      setAlerta("Hb baixa — corte do salão (alerta, sem bloqueio)");
      return;
    }
    setAlerta(null);
  }

  const resumo = useMemo(() => {
    return [
      `Identificação: ${idNome || "PENDENTE"}`,
      `PAS: ${pas || "PENDENTE"}`,
      `Hb: ${hb || "PENDENTE"}`,
      `ECOG: ${ecog == null ? "PENDENTE" : ecog}`,
      `CTCAE: ${ctcae || "PENDENTE"}`,
    ].join("\n");
  }, [idNome, pas, hb, ecog, ctcae]);

  return (
    <section className="oc-tri5" aria-label="Triagem em 5 passos">
      <ol className="oc-tri5-steps" aria-label="Passos">
        {PASSOS.map((p, i) => (
          <li key={p.id} data-ativo={i === passo ? "1" : "0"}>
            {i + 1}. {p.titulo}
          </li>
        ))}
      </ol>

      <div role="group" aria-label={`Passo ${atual.titulo}`}>
        {atual.id === "id" ? (
          <label>
            Nome
            <input
              aria-label="Nome na triagem"
              value={idNome}
              onChange={(e) => setIdNome(e.target.value)}
            />
          </label>
        ) : null}
        {atual.id === "sinais" ? (
          <label>
            PAS
            <input
              aria-label="PAS"
              value={pas}
              onChange={(e) => {
                setPas(e.target.value);
                alertarCampo(e.target.value, "PAS");
              }}
            />
          </label>
        ) : null}
        {atual.id === "lab" ? (
          <label>
            Hb (g/dL)
            <input
              aria-label="Hemoglobina"
              value={hb}
              onChange={(e) => {
                setHb(e.target.value);
                alertarCampo(e.target.value, "Hb");
              }}
            />
          </label>
        ) : null}
        {atual.id === "ecog" ? (
          <div className="oc-tri5-ecog" role="group" aria-label="ECOG">
            {[0, 1, 2, 3, 4].map((g) => (
              <button
                key={g}
                type="button"
                aria-pressed={ecog === g}
                onClick={() => setEcog(g)}
              >
                ECOG {g}
              </button>
            ))}
          </div>
        ) : null}
        {atual.id === "ctcae" ? (
          <label>
            Toxicidade (texto)
            <input
              aria-label="CTCAE texto"
              value={ctcae}
              onChange={(e) => setCtcae(e.target.value)}
            />
          </label>
        ) : null}
      </div>

      {alerta ? (
        <p className={classeSemaforo("VERMELHO")} role="status" data-alerta-campo="">
          {alerta}
        </p>
      ) : null}

      <div className="oc-tri5-nav">
        <button
          type="button"
          disabled={passo === 0}
          onClick={() => setPasso((p) => Math.max(0, p - 1))}
        >
          Voltar
        </button>
        {passo < PASSOS.length - 1 ? (
          <button
            type="button"
            className="oc-btn-primary"
            onClick={() => {
              // Nunca trava — campo vazio vira PENDENTE no resumo.
              setPasso((p) => p + 1);
            }}
          >
            Próximo: {atual.proximo} →
          </button>
        ) : (
          <button
            type="button"
            className="oc-btn-primary"
            onClick={() => onResumo?.(resumo)}
          >
            Copiar resumo
          </button>
        )}
      </div>

      {passo === PASSOS.length - 1 ? (
        <pre className="oc-tri5-resumo" aria-label="Resumo final da triagem">
          {resumo}
        </pre>
      ) : null}
    </section>
  );
}
