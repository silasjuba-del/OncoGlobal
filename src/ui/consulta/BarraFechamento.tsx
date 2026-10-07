import { useState } from "react";
import type { z } from "zod";
import { ActionIntent, ConfirmarBloco, type Alerta } from "../../contracts/operacao.js";
import { Bundle, type DocumentoBundleVisao } from "./Bundle.js";

type Confirmar = z.infer<typeof ConfirmarBloco>;
type Bloco = Confirmar["bloco"];
type IntentImprimir = z.infer<typeof ActionIntent>;

export interface AlvoImpressao {
  tipo: string;
  id: string;
  versao: number;
}

function marcacaoInicial(documentos: readonly DocumentoBundleVisao[]): Readonly<Record<string, boolean>> {
  const marcados: Record<string, boolean> = {};
  for (const d of documentos) {
    if (d.visivel) marcados[d.documentId] = d.preMarcado;
  }
  return marcados;
}

/** Monta o comando. Não inclui medicoId, assinado nem liberado. Só documento visível e marcado. */
export function montarConfirmarBloco(input: {
  patientId: string;
  tumorLotId: string | null;
  encounterId: string;
  bloco: Bloco;
  registros: Confirmar["registros"];
  documentos: readonly DocumentoBundleVisao[];
  marcados: Readonly<Record<string, boolean>>;
  alertasVermelhosExibidos: readonly Alerta[];
  idempotencyKey: string;
}): Confirmar {
  return {
    patientId: input.patientId,
    tumorLotId: input.tumorLotId,
    encounterId: input.encounterId,
    bloco: input.bloco,
    registros: input.registros.map((r) => ({ id: r.id, expectedRevision: r.expectedRevision })),
    documentosExibidos: input.documentos
      .filter((d) => d.visivel && input.marcados[d.documentId] === true)
      .map((d) => ({ documentId: d.documentId, documentVersion: d.documentVersion })),
    reconhecerAlertas: input.alertasVermelhosExibidos.map((a) => a.alertaId),
    idempotencyKey: input.idempotencyKey,
  };
}

export function BarraFechamento({
  patientId,
  tumorLotId,
  encounterId,
  blocoAtual,
  registros,
  documentos,
  alertasVermelhosExibidos,
  idempotencyKey,
  autorExibido,
  alvoImpressao,
  chaveImpressao,
  onValidar,
  onImprimir,
  ocupado = false,
}: {
  patientId: string;
  tumorLotId: string | null;
  encounterId: string;
  blocoAtual: Exclude<Bloco, "TUDO">;
  registros: Confirmar["registros"];
  documentos: readonly DocumentoBundleVisao[];
  alertasVermelhosExibidos: readonly Alerta[];
  idempotencyKey: string;
  autorExibido: string;
  alvoImpressao: AlvoImpressao | null;
  chaveImpressao: string;
  onValidar: (payload: Confirmar) => void;
  onImprimir: (intent: IntentImprimir) => void;
  ocupado?: boolean;
}) {
  const [marcados, setMarcados] = useState(() => marcacaoInicial(documentos));
  const [aviso, setAviso] = useState<string | null>(null);

  function entregar(bloco: Bloco) {
    if (ocupado) return;
    const payload = montarConfirmarBloco({
      patientId,
      tumorLotId,
      encounterId,
      bloco,
      registros,
      documentos,
      marcados,
      alertasVermelhosExibidos,
      idempotencyKey,
    });
    const parsed = ConfirmarBloco.safeParse(payload);
    if (!parsed.success) {
      setAviso("comando incompleto");
      return;
    }
    setAviso(null);
    onValidar(parsed.data);
  }

  function imprimir() {
    if (!alvoImpressao) {
      setAviso("nada selecionado para imprimir");
      return;
    }
    const intent = {
      verbo: "IMPRIMIR" as const,
      objeto: { tipo: alvoImpressao.tipo, id: alvoImpressao.id, versao: alvoImpressao.versao },
      escopo: { patientId, encounterId },
      destino: null,
      idempotencyKey: chaveImpressao,
    };
    const parsed = ActionIntent.safeParse(intent);
    if (!parsed.success) {
      setAviso("comando incompleto");
      return;
    }
    setAviso(null);
    onImprimir(parsed.data);
  }

  const escopo = documentos
    .filter((d) => d.visivel && marcados[d.documentId] === true)
    .map((d) => `${d.titulo} v${d.documentVersion}`)
    .join(", ");

  return (
    <section aria-label="Fechamento" className="pilha">
      <Bundle
        documentos={documentos}
        marcados={marcados}
        onAlternar={(id) => {
          setMarcados((prev) => ({ ...prev, [id]: prev[id] !== true }));
        }}
      />
      <p aria-label="escopo de validar tudo">validar tudo — documentos exibidos e versões do bundle</p>
      <p>No escopo agora: {escopo || "nenhum documento marcado"}</p>
      <p aria-label="autor da assinatura">{autorExibido}</p>
      {alertasVermelhosExibidos.length > 0 ? (
        <section aria-label="Alertas que serão marcados como ciente">
          <p>Serão marcados como ciente:</p>
          <ul>
            {alertasVermelhosExibidos.map((a) => (
              <li key={a.alertaId}>{a.texto}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {aviso ? <p>{aviso}</p> : null}
      <button type="button" disabled={ocupado} onClick={() => entregar("TUDO")}>
        validar tudo
      </button>
      <button type="button" disabled={ocupado} onClick={() => entregar(blocoAtual)}>
        validar bloco
      </button>
      <button type="button" disabled={ocupado} onClick={imprimir}>imprimir</button>
    </section>
  );
}
