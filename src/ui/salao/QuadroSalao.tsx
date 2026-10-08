import { useState } from "react";
import type { EntradaFila, SalaoRuleset } from "../../contracts/regras.js";
import type { Destino } from "../../contracts/estados.js";
import { ordenarFila } from "../../rules/index.js";

export interface CartaoSalaoVisao {
  entrada: EntradaFila;
  destino: Destino;
  emergencia: boolean;
  temCorte: boolean;
  nome: string;
}

const COLUNAS: readonly { destino: Destino; titulo: string }[] = [
  { destino: "FRENTE", titulo: "FRENTE" },
  { destino: "FILA_MEDICO", titulo: "FILA DO MÉDICO" },
  { destino: "SALAO", titulo: "SALÃO" },
];

/** Ordem = ordenarFila. E1 é badge e escalonamento à parte; não reordena (A7). */
export function QuadroSalao({
  cartoes,
  ruleset,
  onLiberarComCorte,
}: {
  cartoes: readonly CartaoSalaoVisao[];
  ruleset: SalaoRuleset;
  onLiberarComCorte: (patientId: string, motivo: string, idempotencyKey: string) => void | Promise<void>;
}) {
  const [aberto, setAberto] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState("");

  const porId = new Map(cartoes.map((c) => [c.entrada.patientId, c]));
  const ordenados: CartaoSalaoVisao[] = [];
  for (const entrada of ordenarFila(cartoes.map((c) => c.entrada), ruleset)) {
    const cartao = porId.get(entrada.patientId);
    if (cartao) ordenados.push(cartao);
  }

  async function confirmar() {
    if (!aberto) return;
    if (salvando) return;
    if (motivo.trim() === "") {
      setErro("motivo obrigatório");
      return;
    }
    setSalvando(true); setErro(null);
    try {
      await onLiberarComCorte(aberto, motivo.trim(), idempotencyKey);
      setAberto(null); setMotivo(""); setIdempotencyKey("");
    } catch {
      setErro("Liberação não registrada. Confira o contexto e tente novamente.");
    } finally { setSalvando(false); }
  }

  return (
    <div className="pilha">
      <div className="colunas">
        {COLUNAS.map((col) => (
          <section key={col.destino} aria-label={col.titulo} className="coluna">
            <h2>{col.titulo}</h2>
            <ol>
              {ordenados.filter((c) => c.destino === col.destino).map((c) => (
                <li key={c.entrada.patientId} data-patient={c.entrada.patientId}>
                  <p>{c.nome}</p>
                  {c.emergencia ? <p>E1</p> : null}
                  {c.temCorte ? (
                    <button type="button" onClick={() => { setAberto(c.entrada.patientId); setMotivo(""); setErro(null);
                      setIdempotencyKey(`salao-release-${crypto.randomUUID()}`); }}>
                      liberar mesmo com corte
                    </button>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
      <section aria-label="Escalonamento">
        <h2>Escalonamento</h2>
        {ordenados.some((c) => c.emergencia) ? (
          <ul>
            {ordenados.filter((c) => c.emergencia).map((c) => (
              <li key={`e1-${c.entrada.patientId}`}>{c.nome} · E1</li>
            ))}
          </ul>
        ) : (
          <p>nenhum</p>
        )}
      </section>
      {aberto ? (
        <section aria-label="Liberar com corte">
          <label>
            Motivo
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </label>
          {erro ? <p>{erro}</p> : null}
          <button type="button" disabled={salvando} onClick={() => void confirmar()}>{salvando ? "registrando…" : "confirmar liberação"}</button>
        </section>
      ) : null}
    </div>
  );
}
