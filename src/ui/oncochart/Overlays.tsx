import { useEffect, type ReactNode } from "react";
import { classeSemaforo } from "../tema/temas.js";

export type OverlayId =
  | "interacoes"
  | "liberacao"
  | "dx"
  | "paleta"
  | "whatsapp"
  | "flash"
  | "pack"
  | "trials"
  | null;

function Shell({
  titulo,
  onFechar,
  children,
}: {
  titulo: string;
  onFechar: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    function k(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onFechar]);

  return (
    <div className="oc-ov" role="dialog" aria-label={titulo}>
      <button type="button" className="oc-ov-backdrop" aria-label="Fechar overlay" onClick={onFechar} />
      <div className="oc-ov-card">
        <header className="oc-ov-h">
          <h3>{titulo}</h3>
          <button type="button" onClick={onFechar} aria-label={`Fechar ${titulo}`}>
            Fechar
          </button>
        </header>
        <div className="oc-ov-body">{children}</div>
      </div>
    </div>
  );
}

/** Overlays CURSOR-09 — interações como achado; liberação QT sem bloquear salvar. */
export function OverlayAtivo({
  id,
  onFechar,
  onAbrirPaleta,
}: {
  id: OverlayId;
  onFechar: () => void;
  onAbrirPaleta?: () => void;
}) {
  if (!id) return null;

  if (id === "whatsapp") {
    return (
      <Shell titulo="Encerrar · WhatsApp" onFechar={onFechar}>
        <p role="status" data-codigo="CANAL_EXTERNO_NAO_HABILITADO">
          Envio externo desligado até vínculo + consentimento (
          <code>CANAL_EXTERNO_NAO_HABILITADO</code>). O texto fica só para revisão local.
        </p>
      </Shell>
    );
  }

  if (id === "interacoes") {
    return (
      <Shell titulo="Interações" onFechar={onFechar}>
        <p className={classeSemaforo("VERMELHO")} data-fn="FN-16">
          Achado FN-16: interação apontada — semáforo como achado, não como bloqueio.
        </p>
        <p className="oc-muted">Fonte sintética · fluoxetina × tamoxifeno</p>
      </Shell>
    );
  }

  if (id === "liberacao") {
    return (
      <Shell titulo="Liberação QT" onFechar={onFechar}>
        <ul aria-label="Portões do salão">
          <li>Neutrófilos — motivo: corte do salão (alerta)</li>
          <li>Neuropatia G1 — motivo: bula (alerta)</li>
        </ul>
        <p className="oc-muted">Alertas não bloqueiam salvar a liberação.</p>
        <button type="button" className="oc-btn-primary">
          Salvar liberação
        </button>
      </Shell>
    );
  }

  if (id === "dx") {
    return (
      <Shell titulo="Diagnóstico / CID versionado" onFechar={onFechar}>
        <p>Edição versionada — histórico nunca sobrescreve o valor anterior.</p>
        <label>
          TNM proposto
          <input aria-label="TNM proposto" defaultValue="cT2N1M0" />
        </label>
      </Shell>
    );
  }

  if (id === "flash") {
    return (
      <Shell titulo="Consulta Flash" onFechar={onFechar}>
        <p>Resumo sintético em overlay — detalhe clínico nas fatias seguintes.</p>
      </Shell>
    );
  }

  if (id === "pack") {
    return (
      <Shell titulo="Tumor-pack" onFechar={onFechar}>
        <p>Pacote documental sintético do tumor lot.</p>
      </Shell>
    );
  }

  if (id === "trials") {
    return (
      <Shell titulo="Trials" onFechar={onFechar}>
        <p>Match sintético ONC-BR-207 — discussão clínica fora desta UI.</p>
      </Shell>
    );
  }

  if (id === "paleta") {
    return (
      <Shell titulo="Paleta de comandos" onFechar={onFechar}>
        <ul aria-label="Comandos">
          <li>
            <button type="button" onClick={onAbrirPaleta}>
              Abrir Interações
            </button>
          </li>
          <li>
            <button type="button">Validar tudo</button>
          </li>
        </ul>
      </Shell>
    );
  }

  return null;
}
