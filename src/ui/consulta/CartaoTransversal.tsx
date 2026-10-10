// W12-F2 · Cartão TRANSVERSAL do anatomopatológico (somente leitura, intraconsulta).
// Grade fixa: todos os campos do núcleo + extensão do tumor, sempre na mesma ordem (lacuna visível).
// Cada campo mostra valor + ORIGEM. Conflito = candidatos lado a lado, ninguém eleito.
// Entrada inválida => aviso de erro de dados; nunca valores parciais. Sem amarelo; sem veredito de liberação.
import type { CSSProperties } from "react";
import { validarRetratoTransversal } from "../../contracts/index.js";
import { COPY_PT_BR } from "../copy/pt-BR.js";
import {
  CAMPOS_EXTENSAO,
  CAMPOS_NUCLEO,
  ROTULO_TUMOR,
  formatarData,
  formatarValor,
  type CampoSpec,
} from "./formatoTransversal.js";

const T = COPY_PT_BR.transversal;

// Forma estrutural mínima do campo já validado pelo contrato (campoAP).
interface OrigemVisao {
  readonly tipo: "LAUDO" | "ENCAMINHADOR";
  readonly documentoId: string;
  readonly dataDocumento: string | null;
}
interface CampoVisao {
  readonly estado: "VALOR" | "CONFLITO" | "NAO_INFORMADO" | "NAO_SE_APLICA";
  readonly valor: unknown;
  readonly origem: OrigemVisao | null;
  readonly candidatos: readonly { readonly valor: unknown; readonly origem: OrigemVisao }[];
  readonly confianca: "NORMAL" | "BAIXA";
}

const estiloLaudo: CSSProperties = { borderLeft: "4px solid var(--fg, currentColor)", paddingLeft: "0.5rem" };
const estiloEncaminhador: CSSProperties = {
  borderLeft: "4px dashed var(--muted)",
  paddingLeft: "0.5rem",
  fontStyle: "italic",
};

function Origem({ origem }: { origem: OrigemVisao }) {
  const ref = `${origem.documentoId} · ${formatarData(origem.dataDocumento)}`;
  const laudo = origem.tipo === "LAUDO";
  return (
    <div data-origem={origem.tipo} style={{ ...(laudo ? estiloLaudo : estiloEncaminhador), color: "var(--muted)", fontSize: "0.85em" }}>
      {laudo ? `${T.laudo} (${ref})` : `${T.encaminhador} · ${ref}`}
    </div>
  );
}

function MarcaBaixa() {
  return (
    <span data-marca="baixa-confianca" style={{ border: "1px solid var(--muted)", padding: "0 0.3rem", marginLeft: "0.4rem", fontSize: "0.8em" }}>
      {T.baixaConfianca}
    </span>
  );
}

function CelulaValor({ campo, spec }: { campo: CampoVisao; spec: CampoSpec }) {
  if (campo.estado === "NAO_INFORMADO") {
    return <span data-vazio="nao-informado" style={{ color: "var(--muted)" }}>{T.naoInformado}</span>;
  }
  if (campo.estado === "NAO_SE_APLICA") {
    return <span data-vazio="nao-se-aplica" style={{ color: "var(--muted)" }}>{T.naoSeAplica}</span>;
  }
  if (campo.estado === "CONFLITO") {
    return (
      <div>
        <strong style={{ color: "var(--danger)" }}>{T.conflito}</strong>
        <ul
          aria-label={`${spec.rotulo}: candidatos em conflito`}
          style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", listStyle: "none", margin: "0.25rem 0 0", padding: 0 }}
        >
          {campo.candidatos.map((c, i) => (
            <li key={`${c.origem.documentoId}-${i}`} data-candidato={c.origem.tipo}>
              <div>{formatarValor(c.valor, spec.unidade)}</div>
              <Origem origem={c.origem} />
            </li>
          ))}
        </ul>
        {campo.confianca === "BAIXA" ? <MarcaBaixa /> : null}
      </div>
    );
  }
  return (
    <div>
      <span>{formatarValor(campo.valor, spec.unidade)}</span>
      {campo.confianca === "BAIXA" ? <MarcaBaixa /> : null}
      {campo.origem ? <Origem origem={campo.origem} /> : null}
    </div>
  );
}

function Linha({ spec, campo, grupo }: { spec: CampoSpec; campo: CampoVisao; grupo: string }) {
  return (
    <tr data-campo={`${grupo}.${spec.chave}`} data-estado={campo.estado}>
      <th scope="row" style={{ textAlign: "left", verticalAlign: "top", fontWeight: 600, padding: "0.25rem 0.5rem" }}>
        {spec.rotulo}
      </th>
      <td style={{ padding: "0.25rem 0.5rem" }}>
        <CelulaValor campo={campo} spec={spec} />
      </td>
    </tr>
  );
}

function Grade({ titulo, grupo, specs, dados }: { titulo: string; grupo: string; specs: readonly CampoSpec[]; dados: Record<string, unknown> }) {
  return (
    <table aria-label={titulo} style={{ width: "100%", borderCollapse: "collapse" }}>
      <caption style={{ textAlign: "left", fontWeight: 700, padding: "0.5rem" }}>{titulo}</caption>
      <thead>
        <tr>
          <th scope="col" style={{ textAlign: "left", padding: "0.25rem 0.5rem" }}>{T.colunaCampo}</th>
          <th scope="col" style={{ textAlign: "left", padding: "0.25rem 0.5rem" }}>{T.colunaValor}</th>
        </tr>
      </thead>
      <tbody>
        {specs.map((s) => (
          <Linha key={s.chave} spec={s} campo={dados[s.chave] as CampoVisao} grupo={grupo} />
        ))}
      </tbody>
    </table>
  );
}

const DESTAQUE = ["metastase", "estadio", "cTNM", "pTNM", "ypTNM"] as const;

export function CartaoTransversal({ entrada }: { entrada: unknown }) {
  const r = validarRetratoTransversal(entrada);
  if (!r.ok) {
    const campos = [...new Set(r.erros.map((e) => e.split(":")[0] ?? ""))].filter(Boolean);
    return (
      <section aria-label={T.titulo} className="cartao" data-estado="ERRO_DADOS">
        <div role="alert" style={{ color: "var(--danger)", fontWeight: 600 }}>{T.erroDados}</div>
        {campos.length > 0 ? (
          <p style={{ color: "var(--muted)" }}>
            {T.erroCampos}: {campos.join(", ")}
          </p>
        ) : null}
      </section>
    );
  }
  const { retrato } = r;
  const nucleo = retrato.nucleo as unknown as Record<string, unknown>;
  const extensao = retrato.extensao as unknown as Record<string, unknown>;
  const specsDestaque = DESTAQUE.map((k) => CAMPOS_NUCLEO.find((s) => s.chave === k)).filter((s): s is CampoSpec => s !== undefined);
  const tumor = retrato.extensao?.tumor ?? null;

  return (
    <section aria-label={T.titulo} className="cartao" data-tumor={tumor ?? "NAO_INFORMADO"}>
      <h3 style={{ margin: "0 0 0.5rem" }}>
        {T.titulo} · {tumor ? ROTULO_TUMOR[tumor] : "tipo de tumor NÃO INFORMADO"}
      </h3>
      <div data-destaque="topo" style={{ border: "2px solid var(--fg, currentColor)", marginBottom: "0.75rem" }}>
        <Grade titulo={T.destaque} grupo="destaque" specs={specsDestaque} dados={nucleo} />
      </div>
      <Grade titulo={T.gradeTitulo} grupo="nucleo" specs={CAMPOS_NUCLEO} dados={nucleo} />
      {tumor ? <Grade
        titulo={`${T.extensaoTitulo}: ${ROTULO_TUMOR[tumor]}`}
        grupo="extensao"
        specs={CAMPOS_EXTENSAO[tumor] ?? []}
        dados={extensao}
      /> : <p>Extensão por tumor PENDENTE de classificação explícita.</p>}
    </section>
  );
}
