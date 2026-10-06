import { useEffect, useState } from "react";
import type { ChavesIntencao } from "../../api/chaves.js";
import type { CaixaCanalVisao, MensagemCanalVisao, PortaConsulta } from "../../api/porta.js";
import { RespostaCanal } from "./RespostaCanal.js";

interface GrupoCanal {
  patientId: string;
  nome: string;
  mensagens: MensagemCanalVisao[];
}

/** Agrupa na ordem da porta. Contato sem vínculo fica na fila; a UI não liga por nome. */
export function CaixaCanal({
  porta,
  chaves,
}: {
  porta: PortaConsulta;
  chaves: ChavesIntencao;
}) {
  const [visao, setVisao] = useState<CaixaCanalVisao | null>(null);

  useEffect(() => {
    let viva = true;
    porta.caixaCanal().then((proxima) => {
      if (viva) setVisao(proxima);
    });
    return () => {
      viva = false;
    };
  }, [porta]);

  if (!visao) return <p>carregando canal</p>;

  const grupos: GrupoCanal[] = [];
  const soltas: MensagemCanalVisao[] = [];
  for (const mensagem of visao.mensagens) {
    if (mensagem.patientId === null) {
      soltas.push(mensagem);
      continue;
    }
    const existente = grupos.find((grupo) => grupo.patientId === mensagem.patientId);
    if (existente) {
      existente.mensagens.push(mensagem);
      continue;
    }
    grupos.push({
      patientId: mensagem.patientId,
      nome: mensagem.nomePaciente ?? mensagem.patientId,
      mensagens: [mensagem],
    });
  }

  function vincular(contatoId: string, patientId: string) {
    void porta.pedirVinculo(contatoId, patientId).then(setVisao);
  }

  return (
    <section aria-label="Caixa do canal" className="pilha">
      <h1>Caixa do canal</h1>
      {grupos.map((grupo) => (
        <section key={grupo.patientId} aria-label={`Mensagens de ${grupo.nome}`} data-patient={grupo.patientId}>
          <h2>{grupo.nome}</h2>
          {grupo.mensagens.map((mensagem) => (
            <article key={mensagem.mensagemId} data-mensagem={mensagem.mensagemId} className="pilha">
              <p>{mensagem.texto}</p>
              {mensagem.redFlag ? <p className="semaforo semaforo-vermelho">red flag</p> : null}
              <RespostaCanal
                porta={porta}
                chaves={chaves}
                mensagemId={mensagem.mensagemId}
                patientId={mensagem.patientId}
                redFlag={mensagem.redFlag}
              />
            </article>
          ))}
        </section>
      ))}
      <section aria-label="vincular a paciente">
        <h2>vincular a paciente</h2>
        {soltas.length === 0 ? <p>nenhum contato sem vínculo</p> : soltas.map((mensagem) => (
          <article key={mensagem.mensagemId} data-mensagem={mensagem.mensagemId} className="pilha">
            <p>{mensagem.texto}</p>
            {mensagem.candidatos.map((candidato) => (
              <button
                key={candidato.patientId}
                type="button"
                onClick={() => vincular(mensagem.contatoId, candidato.patientId)}
              >
                vincular {candidato.nome}
              </button>
            ))}
          </article>
        ))}
      </section>
    </section>
  );
}
