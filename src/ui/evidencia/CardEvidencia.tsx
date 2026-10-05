import { useState } from "react";
import type { z } from "zod";
import type { Fonte } from "../../contracts/base.js";
import { EvidenceLayer, type Revisao, type Semaforo, type StatusCampo } from "../../contracts/estados.js";
import { classeSemaforo } from "../tema/temas.js";
import { GavetaFonte } from "./GavetaFonte.js";

type CamadaEvidencia = z.infer<typeof EvidenceLayer>;

export interface CandidatoVisao {
  valorTexto: string;
  fontes: readonly Fonte[];
}

/** Projeção de leitura do átomo C-03 + evidenceLayer. Não elege valor em CONFLITO. */
export interface AfirmacaoVisao {
  rotulo: string;
  valorTexto: string | null;
  estado: Semaforo;
  campo: StatusCampo;
  motivo: string;
  revisao: Revisao;
  fontes: readonly Fonte[];
  evidenceLayer: CamadaEvidencia;
  candidatos?: readonly CandidatoVisao[];
}

const CAMADA: Record<CamadaEvidencia, string> = {
  DOCUMENT_TEXT: "texto do laudo",
  IMAGE_OBSERVATION: "observação",
  INFERENCE: "inferência",
};

export function CardEvidencia({ afirmacao }: { afirmacao: AfirmacaoVisao }) {
  const [aberta, setAberta] = useState(false);
  const fontes = afirmacao.campo === "CONFLITO"
    ? (afirmacao.candidatos ?? []).flatMap((c) => [...c.fontes])
    : afirmacao.fontes;

  return (
    <article className="cartao pilha">
      <h3>{afirmacao.rotulo}</h3>
      <p className={classeSemaforo(afirmacao.estado)}>{afirmacao.estado}</p>
      <p>Revisão: {afirmacao.revisao}</p>
      <p>Camada: {CAMADA[afirmacao.evidenceLayer]}</p>
      {afirmacao.campo === "NAO_SE_APLICA" ? <p>Motivo: {afirmacao.motivo}</p> : null}
      {afirmacao.campo === "CONFLITO" ? (
        <div className="lado-a-lado" aria-label="candidatos em conflito">
          <p>sem valor eleito</p>
          {(afirmacao.candidatos ?? []).map((c) => (
            <p key={`${afirmacao.rotulo}-${c.valorTexto}`}>{c.valorTexto}</p>
          ))}
        </div>
      ) : (
        <p>Valor: {afirmacao.campo === "NAO_SE_APLICA" ? "não se aplica" : (afirmacao.valorTexto ?? "PENDENTE")}</p>
      )}
      <button type="button" aria-expanded={aberta} onClick={() => setAberta((v) => !v)}>
        Ver fonte
      </button>
      {aberta ? <GavetaFonte fontes={fontes} /> : null}
    </article>
  );
}
