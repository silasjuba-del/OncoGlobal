import { linhasCartaoModelo08, type CabecalhoChart } from "./chart-visao.js";

/** Cartão Modelo 08 na ordem do sistema hospitalar. */
export function CartaoCadastro({ chart }: { chart: CabecalhoChart }) {
  const linhas = linhasCartaoModelo08(chart);
  return (
    <section className="oc-cartao-cadastro" aria-label="Cartão de cadastro">
      <h3>Cartão de cadastro</h3>
      <dl>
        {linhas.map((linha) => (
          <div key={linha.rotulo} className="oc-cartao-linha">
            <dt>{linha.rotulo}</dt>
            <dd data-campo={linha.rotulo} data-pendente={linha.valor === "PENDENTE" ? "sim" : "nao"}>
              {linha.valor}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
