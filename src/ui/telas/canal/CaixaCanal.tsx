import { useEffect, useState } from "react";
import type { ChavesIntencao } from "../../api/chaves.js";
import type { CaixaCanalVisao, MensagemCanalVisao, PortaConsulta } from "../../api/porta.js";
import { RespostaCanal } from "./RespostaCanal.js";
import { ErroPorta } from "../../api/porta.js";

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
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    let viva = true;
    porta.caixaCanal().then((proxima) => {
      if (viva) setVisao(proxima);
    }).catch(() => { if (viva) setMensagem("Não foi possível carregar as mensagens locais."); });
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

  async function vincular(contatoId: string, patientId: string) {
    if (ocupado) return;
    setOcupado(true); setMensagem("");
    try { setVisao(await porta.pedirVinculo(contatoId, patientId)); }
    catch (error) { setMensagem(error instanceof ErroPorta
      ? `Vínculo não registrado (${error.codigo}). Confirme paciente e contexto.`
      : "Vínculo não registrado. A seleção foi mantida para tentar novamente."); }
    finally { setOcupado(false); }
  }

  return (
    <section aria-label="Caixa do canal" className="pilha">
      <h1>Caixa do canal</h1>
      {mensagem ? <p role="alert">{mensagem}</p> : null}
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
            {mensagem.estadoVinculo === "CONFLITO" ? <p role="alert">Conflito de vínculos preservado. Destino pendente de decisão.</p> : null}
            {mensagem.estadoVinculo === "REVOGADO" ? <p role="alert">Contato revogado. Nenhum vínculo pode ser criado.</p> : null}
            {mensagem.estadoVinculo === "SEM_VINCULO" ? <p>Selecione explicitamente o paciente e confira o identificador exibido.</p> : null}
            {mensagem.candidatos.map((candidato) => (
              <span key={candidato.patientId}>
                <button type="button" disabled={ocupado || mensagem.estadoVinculo === "CONFLITO"
                  || mensagem.estadoVinculo === "REVOGADO"} aria-label={`vincular ${candidato.nome}`}
                  onClick={() => void vincular(mensagem.contatoId, candidato.patientId)}>
                  vincular {candidato.nome}
                </button>
                <small>Identificador: {candidato.patientId}</small>
              </span>
            ))}
          </article>
        ))}
      </section>
    </section>
  );
}
