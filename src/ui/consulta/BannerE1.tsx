import { useState } from "react";
import type { Alerta } from "../../contracts/operacao.js";

function horaCivil(iso: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(iso);
  if (!m?.[1] || !m[2]) return iso;
  return `${m[1]} ${m[2]}`;
}

function rotuloAlvo(alvo: Alerta["alvo"]): string {
  if ("contatoNaoVinculadoId" in alvo) return `contato não vinculado ${alvo.contatoNaoVinculadoId}`;
  return `paciente ${alvo.patientId}`;
}

/** Banner fixo. Reconhecer registra ciente; o alerta não some e não há fechar. */
export function BannerE1({
  alertas,
  agora,
  onReconhecer,
}: {
  alertas: readonly Alerta[];
  agora: string;
  onReconhecer: (alertaId: string, reconhecidoEm: string) => void;
}) {
  const [cientes, setCientes] = useState<Readonly<Record<string, string>>>({});
  const e1 = alertas.filter((a) => a.presentationOverride);
  if (e1.length === 0) return null;

  return (
    <div role="alert" className="banner-e1" data-banner="e1">
      <p>Emergência E1 — não dispensável</p>
      <ul>
        {e1.map((a) => {
          const quando = cientes[a.alertaId] ?? a.reconhecidoEm;
          return (
            <li key={a.alertaId}>
              <p>{a.texto}</p>
              <p>Alvo: {rotuloAlvo(a.alvo)}</p>
              {quando ? <p>Reconhecido em {horaCivil(quando)}</p> : null}
              <button
                type="button"
                onClick={() => {
                  const em = a.reconhecidoEm ?? agora;
                  setCientes((prev) => ({ ...prev, [a.alertaId]: em }));
                  onReconhecer(a.alertaId, em);
                }}
              >
                reconhecer
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
