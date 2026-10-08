// W11-H23 · Cabeçalho das 4 datas fixas (decisão Dr. Silas, W11-H14).
// Componente de apresentação puro: recebe a visão por props próprias (sem importar o kernel).
// Ausente = PENDENTE (campo vazio com marca discreta); conflito = mostra as duas fontes; nunca cor amarela.

export type EstadoDataVisao =
  | { readonly estado: "PREENCHIDO"; readonly data: string; readonly fonte: string }
  | { readonly estado: "PENDENTE"; readonly motivo: "AUSENTE" }
  | {
      readonly estado: "PENDENTE";
      readonly motivo: "CONFLITO";
      readonly fontes: readonly { readonly rotulo: string; readonly data: string }[];
    };

export type DataEstadiamentoVisao = EstadoDataVisao & {
  readonly tipo: "STAGING" | "RESTAGING" | null;
};

export interface DatasFixasVisao {
  readonly dataReferencia: string;
  readonly biopsia: EstadoDataVisao;
  readonly c1d1: EstadoDataVisao;
  readonly ultimoEstadiamento: DataEstadiamentoVisao;
  readonly ultimaExposicao: EstadoDataVisao;
}

const DIA_MS = 86_400_000;

function diasEntre(referencia: string, data: string): number | null {
  const r = Date.parse(`${referencia}T00:00:00Z`);
  const d = Date.parse(`${data}T00:00:00Z`);
  if (!Number.isFinite(r) || !Number.isFinite(d)) return null;
  return Math.round((r - d) / DIA_MS);
}

function formatarData(data: string): string {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

function Valor({ campo, dataReferencia }: { campo: EstadoDataVisao; dataReferencia: string }) {
  if (campo.estado === "PREENCHIDO") {
    const dias = diasEntre(dataReferencia, campo.data);
    return (
      <>
        <span>{formatarData(campo.data)}</span>
        {dias !== null ? <span> · {dias} dias desde</span> : null}
      </>
    );
  }
  if (campo.motivo === "CONFLITO") {
    return (
      <ul aria-label="Fontes em conflito" style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
        <li>
          <span style={{ color: "var(--danger)" }}>CONFLITO</span>
        </li>
        {campo.fontes.map((f) => (
          <li key={f.rotulo} style={{ color: "var(--muted)" }}>
            {f.rotulo}: {formatarData(f.data)}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <>
      <span aria-hidden="true" style={{ color: "var(--muted)" }}>
        ____
      </span>
      <span style={{ color: "var(--muted)", fontSize: "0.85em" }}> pendente</span>
    </>
  );
}

function Campo({
  rotulo,
  campoDados,
  dataReferencia,
  dataAttr,
  subtitulo,
}: {
  rotulo: string;
  campoDados: EstadoDataVisao;
  dataReferencia: string;
  dataAttr: string;
  subtitulo?: string | undefined;
}) {
  return (
    <div data-campo={dataAttr} data-estado={campoDados.estado}>
      <dt>
        {rotulo}
        {subtitulo ? <span style={{ color: "var(--muted)" }}> ({subtitulo})</span> : null}
      </dt>
      <dd style={{ margin: 0 }}>
        <Valor campo={campoDados} dataReferencia={dataReferencia} />
      </dd>
    </div>
  );
}

const ROTULO_TIPO: Record<"STAGING" | "RESTAGING", string> = {
  STAGING: "estadiamento",
  RESTAGING: "reestadiamento",
};

export function CabecalhoDatasFixas({ visao }: { visao: DatasFixasVisao }) {
  const { dataReferencia } = visao;
  const tipoEstadiamento = visao.ultimoEstadiamento.tipo
    ? ROTULO_TIPO[visao.ultimoEstadiamento.tipo]
    : undefined;

  return (
    <section aria-label="Datas fixas do tratamento" className="cartao">
      <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(10rem, 1fr))", gap: "0.75rem", margin: 0 }}>
        <Campo rotulo="Biópsia" campoDados={visao.biopsia} dataReferencia={dataReferencia} dataAttr="biopsia" />
        <Campo rotulo="C1D1" campoDados={visao.c1d1} dataReferencia={dataReferencia} dataAttr="c1d1" />
        <Campo
          rotulo="Último estadiamento"
          subtitulo={tipoEstadiamento}
          campoDados={visao.ultimoEstadiamento}
          dataReferencia={dataReferencia}
          dataAttr="ultimo-estadiamento"
        />
        <Campo
          rotulo="Última exposição"
          campoDados={visao.ultimaExposicao}
          dataReferencia={dataReferencia}
          dataAttr="ultima-exposicao"
        />
      </dl>
    </section>
  );
}
