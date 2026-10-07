import { useState } from "react";
import {
  aplicarAjustePercentual,
  rotuloClasse,
  type PrescricaoVisao,
  type ProdutoPrescricao,
} from "./prescricao-visao.js";

/** UI dos 3 produtos (D-W9-45/47). Dose calculada vem da visão/porta — não do layout. */
export function PrescricaoPainel({
  inicial,
}: {
  inicial: PrescricaoVisao;
}) {
  const [visao, setVisao] = useState(inicial);
  const [motivo, setMotivo] = useState("");
  const [linhaSel, setLinhaSel] = useState<string | null>(
    inicial.linhas.find((l) => l.excecao)?.id ?? null,
  );
  const [msg, setMsg] = useState<string | null>(null);

  function setProduto(p: ProdutoPrescricao) {
    setVisao((v) => ({ ...v, produto: p }));
  }

  function ajustar(pct: 20 | 30 | 40) {
    if (!linhaSel) {
      setMsg("Selecione uma linha-exceção");
      return;
    }
    if (!motivo.trim()) {
      setMsg("Motivo obrigatório para −" + pct + "%");
      return;
    }
    // Ajuste percentual sintético = stub da função de dose (equipe interna).
    setVisao((v) => ({
      ...v,
      linhas: v.linhas.map((l) => {
        if (l.id !== linhaSel) return l;
        const dosePresc = aplicarAjustePercentual(l.dosePresc, pct);
        return {
          ...l,
          dosePresc,
          excecao: true,
          motivoExcecao: motivo.trim(),
        };
      }),
    }));
    setMsg(`ajuste −${pct}% aplicado via função sintética`);
  }

  const excecoes = visao.linhas.filter((l) => l.excecao);

  return (
    <section className="oc-rx" aria-label="Prescrição">
      <header className="oc-rx-h">
        <h3>Prescrição</h3>
        <p className="oc-muted">
          {visao.protocolo} · {visao.ciclo} — doses vêm da função (não calculadas aqui)
        </p>
      </header>

      <div className="oc-rx-classes" aria-label="Classes de prescrição">
        {visao.classes.map((c) => (
          <span key={c} className="oc-chip" data-classe={c}>
            {rotuloClasse(c)}
          </span>
        ))}
      </div>

      <div className="oc-rx-produtos" role="tablist" aria-label="Produtos de prescrição">
        {(
          [
            ["antineoplasica", "Antineoplásica"],
            ["posQtVo", "Receita pós-QT / VO"],
            ["evAvulsa", "EV avulsa"],
          ] as const
        ).map(([id, rotulo]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={visao.produto === id}
            onClick={() => setProduto(id)}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {visao.produto === "antineoplasica" ? (
        <div role="tabpanel" aria-label="Antineoplásica Modelo 05">
          <p className="oc-rx-note">
            Só as <b>exceções</b> do ciclo ({excecoes.length}). Layout Modelo 05.
          </p>
          <table className="oc-rx-table">
            <thead>
              <tr>
                <th>Fármaco</th>
                <th>Dose Prot</th>
                <th>Dose Presc</th>
                <th>Diluente</th>
                <th>Via</th>
                <th>Fase</th>
                <th>Tempo</th>
                <th>Dias</th>
              </tr>
            </thead>
            <tbody>
              {excecoes.map((l) => (
                <tr
                  key={l.id}
                  data-excecao="1"
                  data-linha={l.id}
                  className={linhaSel === l.id ? "is-sel" : undefined}
                  onClick={() => setLinhaSel(l.id)}
                >
                  <td>{l.farmaco}</td>
                  <td>{l.doseProt}</td>
                  <td>{l.dosePresc}</td>
                  <td>
                    {l.diluente}{" "}
                    <button
                      type="button"
                      className="oc-link-fonte"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMsg("ALTERAR PADRÃO → informe o motivo no campo abaixo");
                      }}
                    >
                      ALTERAR PADRÃO
                    </button>
                  </td>
                  <td>{l.via}</td>
                  <td>{l.fase}</td>
                  <td>{l.tempo}</td>
                  <td>{l.dias}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {excecoes.map((l) =>
            l.motivoExcecao ? (
              <p key={`m-${l.id}`} className="oc-muted">
                {l.farmaco}: {l.motivoExcecao}
              </p>
            ) : null,
          )}
          <label className="oc-rx-motivo">
            Motivo do ajuste
            <input
              aria-label="Motivo do ajuste"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </label>
          <div className="oc-rx-ajustes" role="group" aria-label="Ajuste percentual">
            {([20, 30, 40] as const).map((p) => (
              <button key={p} type="button" onClick={() => ajustar(p)}>
                −{p}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {visao.produto === "posQtVo" ? (
        <div role="tabpanel" aria-label="Receita pós-QT VO">
          <label>
            Uma linha (parser = equipe interna)
            <input
              aria-label="Linha de receita VO"
              value={visao.linhaVo}
              onChange={(e) => setVisao((v) => ({ ...v, linhaVo: e.target.value }))}
            />
          </label>
          <p className="oc-muted">Estrutura discreta editável — sem parser no componente.</p>
        </div>
      ) : null}

      {visao.produto === "evAvulsa" ? (
        <div role="tabpanel" aria-label="EV avulsa">
          <dl className="oc-rx-ev">
            <div>
              <dt>Fármaco</dt>
              <dd>{visao.evAvulsa.farmaco}</dd>
            </div>
            <div>
              <dt>Dose</dt>
              <dd>{visao.evAvulsa.dose}</dd>
            </div>
            <div>
              <dt>Diluente</dt>
              <dd>{visao.evAvulsa.diluente}</dd>
            </div>
            <div>
              <dt>Tempo</dt>
              <dd>{visao.evAvulsa.tempo}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      {msg ? (
        <p role="status" className="oc-flash-status">
          {msg}
        </p>
      ) : null}
    </section>
  );
}
