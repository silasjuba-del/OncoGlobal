import { useEffect, useState } from "react";
import type { PortaConsulta, SalaoVisao } from "../api/porta.js";
import { AgendaQt } from "../oncochart/AgendaQt.js";
import { Triagem5Passos } from "../oncochart/Triagem5Passos.js";
import { FormTriagem } from "../salao/FormTriagem.js";
import { QuadroSalao } from "../salao/QuadroSalao.js";
import { ErroPorta } from "../api/porta.js";
import type { Fonte } from "../../contracts/base.js";

function textoErro(error: unknown) {
  return error instanceof ErroPorta ? `Operação não gravada (${error.codigo}).` : "Operação não gravada. Tente novamente após conferir a consulta.";
}
function erroCarregamento(error: unknown) {
  return error instanceof ErroPorta ? `Salão indisponível (${error.codigo}).` : "Não foi possível carregar o salão local.";
}

/** Triagem à esquerda, quadro à direita. A ordem continua sendo a de ordenarFila. */
export function TelaSalao({ porta }: { porta: PortaConsulta }) {
  const [visao, setVisao] = useState<SalaoVisao | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [resumoFlash, setResumoFlash] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let viva = true;
    setErro(null);
    porta.filaSalao().then(async (proxima) => {
      if (!viva) return;
      setVisao(proxima);
      const primeira = proxima.pacientes[0];
      setPatientId((atual) => atual ?? primeira?.patientId ?? null);
      if (primeira && porta.selecionarContexto) {
        try { await porta.selecionarContexto({ patientId: primeira.patientId,
          encounterId: primeira.encounterId, tumorLotId: null }); }
        catch (error) { if (viva) setErro(textoErro(error)); }
      }
    }).catch((error) => { if (viva) setErro(erroCarregamento(error)); });
    return () => {
      viva = false;
    };
  }, [porta, tentativa]);

  if (!visao) return erro ? <section aria-label="Salão indisponível">
    <p role="alert">{erro}</p>
    <button type="button" onClick={() => setTentativa((atual) => atual + 1)}>Tentar carregar novamente</button>
  </section> : <p>carregando salão</p>;
  const escolhido = visao.pacientes.find((p) => p.patientId === patientId) ?? visao.pacientes[0];
  if (!escolhido) return <p>salão vazio</p>;
  const fonteFormulario: Fonte = visao.fonte ?? { sourceId: `triagem-manual-${crypto.randomUUID()}`,
    classe: "MANUAL", localizador: "entrada manual em rascunho", dataClinica: visao.hoje,
    dataCaptura: new Date().toISOString(), versao: "triagem-form-local", contentHash: "PENDENTE_HASH_SERVIDOR" };

  return (
    <section aria-label="Salão" className="pilha">
      <label>
        Paciente em triagem
        <select
          aria-label="Paciente em triagem"
          value={escolhido.patientId}
          onChange={(evento) => {
            const proximo = visao.pacientes.find((p) => p.patientId === evento.target.value);
            if (!proximo) return;
            setErro(null);
            void (async () => {
              try {
                await porta.selecionarContexto?.({ patientId: proximo.patientId,
                  encounterId: proximo.encounterId, tumorLotId: null });
                setPatientId(proximo.patientId);
              } catch (error) { setErro(textoErro(error)); }
            })();
          }}
        >
          {visao.pacientes.map((paciente) => (
            <option key={paciente.patientId} value={paciente.patientId}>
              {paciente.nome} {paciente.patientId}
            </option>
          ))}
        </select>
      </label>
      {erro ? <p role="alert">{erro}</p> : null}
      {visao.avisos?.filter(a=>a.patientId === escolhido.patientId).length ? <p role="status" aria-label="Avisos do salão">
        {visao.avisos.filter(a=>a.patientId === escolhido.patientId).map(a=>a.texto).join("; ")}</p> : null}
      <Triagem5Passos
        pacienteNome={escolhido.nome}
        onResumo={(t) => {
          setResumoFlash("resumo copiado");
          if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
            void navigator.clipboard.writeText(t);
          }
        }}
      />
      {resumoFlash ? <p role="status">{resumoFlash}</p> : null}
      <div className="colunas">
        <FormTriagem
          patientId={escolhido.patientId}
          encounterId={escolhido.encounterId}
          chegadaEm={escolhido.chegadaEm}
          ruleset={visao.ruleset}
          contexto={visao.contexto}
          fonte={fonteFormulario}
          draftRevision={escolhido.revision ?? null}
          onSalvar={async (triagem, expectedRevision) => {
            setErro(null);
            try { setVisao(await porta.salvarTriagem(triagem, expectedRevision)); }
            catch (e) { setErro(textoErro(e)); throw e; }
          }}
        />
        <QuadroSalao
          cartoes={visao.cartoes}
          ruleset={visao.ruleset}
          onLiberarComCorte={async (id, motivo, idempotencyKey) => {
            const paciente = visao.pacientes.find((p) => p.patientId === id);
            if (!paciente || paciente.revision === null || paciente.revision === undefined) {
              const mensagem = "Salve e recarregue a triagem antes de registrar a liberação.";
              setErro(mensagem); throw new Error(mensagem);
            }
            setErro(null);
            try {
              const resultado = porta.selecionarContexto
                ? await porta.liberarComCorte(id, motivo, { encounterId: paciente.encounterId,
                  expectedRevision: paciente.revision, idempotencyKey })
                : await porta.liberarComCorte(id, motivo);
              setVisao(resultado);
            }
            catch (e) { setErro(textoErro(e)); throw e; }
          }}
        />
      </div>
      <AgendaQt />
      <section aria-label="Decisões do médico">
        <h2>Decisões do médico</h2>
        {visao.decisoes.length === 0 ? (
          <p>nenhuma decisão registrada</p>
        ) : (
          <ul>
            {visao.decisoes.map((decisao) => (
              <li key={`${decisao.patientId}-${decisao.motivo}`}>{decisao.motivo}</li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
