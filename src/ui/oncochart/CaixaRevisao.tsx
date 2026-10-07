import { useState } from "react";
import { classeSemaforo } from "../tema/temas.js";
import {
  resumoExcecoes,
  type CandidatoJunção,
  type ExcecaoRevisao,
  type RevisaoCaixaUnica,
} from "./caixa-revisao-visao.js";

export function CaixaRevisao({
  revisao,
  onConfirmar,
  onCorrigir,
  onDescartar,
  onLigar,
  onAbrirFonte,
  onFechar,
}: {
  revisao: RevisaoCaixaUnica;
  onConfirmar: (id: string) => void;
  onCorrigir: (id: string) => void;
  onDescartar: (id: string) => void;
  onLigar: (excecaoId: string, patientId: string) => void;
  onAbrirFonte: (fonte: ExcecaoRevisao["fonte"]) => void;
  onFechar: () => void;
}) {
  const [ligando, setLigando] = useState<string | null>(null);

  return (
    <section className="oc-revisao" aria-label="Caixa de revisão">
      <header className="oc-revisao-h">
        <h3>Caixa de revisão</h3>
        <p className="oc-muted">origem: {revisao.origemRotulo}</p>
        <button type="button" onClick={onFechar} aria-label="Fechar revisão">
          Fechar
        </button>
      </header>

      <p className="oc-revisao-resumo" role="status" data-resumo="excecoes">
        {resumoExcecoes(revisao)}
      </p>

      <div className="oc-caixas-num" aria-label="Caixas numeradas">
        {revisao.caixas.map((c) => (
          <article key={c.numero} className="oc-caixa-n" data-caixa={c.numero}>
            <h4>
              <span className="oc-caixa-num">#{c.numero}</span> {c.nome}
            </h4>
            {c.valor == null ? (
              <p className={classeSemaforo("PENDENTE")}>PENDENTE</p>
            ) : (
              <p>{c.valor}</p>
            )}
          </article>
        ))}
      </div>

      <div className="oc-excecoes" aria-label="Exceções para confirmação">
        {revisao.excecoes.map((ex) => (
          <article key={ex.id} className="oc-excecao" data-excecao={ex.id}>
            <p>
              <b>Valor:</b> {ex.valor}
            </p>
            <p>
              <b>Fonte:</b>{" "}
              <button type="button" className="oc-link-fonte" onClick={() => onAbrirFonte(ex.fonte)}>
                “{ex.fonte.trecho}”
              </button>
            </p>
            {ex.patientId == null ? (
              <div className="oc-orfao" data-juncao="pendente">
                <p className={classeSemaforo("PENDENTE")}>
                  Sem paciente — junção só com clique (nunca automática)
                </p>
                {ligando === ex.id ? (
                  <ul aria-label="Candidatos para ligar">
                    {revisao.candidatos.map((c) => (
                      <li key={c.patientId}>
                        <button type="button" onClick={() => onLigar(ex.id, c.patientId)}>
                          Ligar a {c.nome} · {c.prontuario}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <button type="button" onClick={() => setLigando(ex.id)}>
                    Ligar ao paciente…
                  </button>
                )}
              </div>
            ) : (
              <p className="oc-muted">proposta para paciente aberto</p>
            )}
            <div className="oc-ex-acoes">
              <button type="button" onClick={() => onConfirmar(ex.id)}>
                Confirmar
              </button>
              <button type="button" onClick={() => onCorrigir(ex.id)}>
                Corrigir
              </button>
              <button type="button" onClick={() => onDescartar(ex.id)}>
                Descartar
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export type { CandidatoJunção };
