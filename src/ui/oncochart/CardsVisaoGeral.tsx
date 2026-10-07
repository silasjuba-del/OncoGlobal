import { useState } from "react";
import { classeSemaforo } from "../tema/temas.js";

export interface CardVisaoGeralProps {
  protocolo: string | null;
  ciclo: string | null;
  tnm: string | null;
  recist: string | null;
  ecog: string | null;
  ctcae: string | null;
  onSoltarArquivo: (nome: string) => void;
  onSalvarRascunho: (texto: string) => void;
}

/** Cards da Visão geral. Só mostra/coleta — sem regra clínica. */
export function CardsVisaoGeral({
  protocolo,
  ciclo,
  tnm,
  recist,
  ecog,
  ctcae,
  onSoltarArquivo,
  onSalvarRascunho,
}: CardVisaoGeralProps) {
  const [rascunho, setRascunho] = useState("");
  const [salvo, setSalvo] = useState<string | null>(null);
  const [arquivo, setArquivo] = useState<string | null>(null);

  function pendente(v: string | null): string {
    return v && v.trim().length > 0 ? v : "PENDENTE";
  }

  return (
    <div className="oc-cards-geral" role="region" aria-label="Visão geral">
      <article className="oc-card">
        <header className="oc-card-h">
          <h3>Protocolos ativos</h3>
        </header>
        <div className="oc-card-b">
          <p>{pendente(protocolo)}</p>
          <p className={ciclo ? undefined : classeSemaforo("PENDENTE")}>Ciclo: {pendente(ciclo)}</p>
        </div>
      </article>

      <article className="oc-card">
        <header className="oc-card-h">
          <h3>Documentos recentes</h3>
        </header>
        <div className="oc-card-b">
          <div
            className="oc-drop"
            aria-label="Caixa única — soltar PDF ou Word"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              const nome = f?.name ?? "arquivo-sintetico.pdf";
              setArquivo(nome);
              onSoltarArquivo(nome);
            }}
          >
            <p>Soltar PDF/Word — caixa única</p>
            <label>
              Anexar
              <input
                type="file"
                accept=".pdf,.doc,.docx,application/pdf"
                aria-label="Anexar documento"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setArquivo(f.name);
                  onSoltarArquivo(f.name);
                }}
              />
            </label>
          </div>
          {arquivo ? <p role="status">recebido: {arquivo}</p> : (
            <p className={classeSemaforo("PENDENTE")}>nenhum documento — PENDENTE</p>
          )}
        </div>
      </article>

      <article className="oc-card">
        <header className="oc-card-h">
          <h3>Estadiamento e avaliações</h3>
        </header>
        <div className="oc-card-b">
          <p>TNM: <span data-campo="tnm">{pendente(tnm)}</span></p>
          <p>RECIST: <span data-campo="recist">{pendente(recist)}</span></p>
          <p>ECOG: <span data-campo="ecog">{pendente(ecog)}</span></p>
          <p>CTCAE: <span data-campo="ctcae">{pendente(ctcae)}</span></p>
        </div>
      </article>

      <article className="oc-card">
        <header className="oc-card-h">
          <h3>Rascunho de evolução</h3>
        </header>
        <div className="oc-card-b">
          <label>
            Evolução
            <textarea
              aria-label="Rascunho de evolução"
              value={rascunho}
              onChange={(e) => setRascunho(e.target.value)}
              rows={4}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              onSalvarRascunho(rascunho);
              setSalvo("rascunho salvo — não bloqueia");
            }}
          >
            Salvar rascunho
          </button>
          {salvo ? <p role="status">{salvo}</p> : null}
        </div>
      </article>
    </div>
  );
}
