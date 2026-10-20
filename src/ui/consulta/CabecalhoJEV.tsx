import type { ConsultaIntegrada } from "../api/respostas.js";
import type { AfirmacaoVisao } from "../../contracts/api/evidencia.js";

function normalizar(rotulo: string) {
  return rotulo.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function evidencia(visao: ConsultaIntegrada, termos: readonly string[]): AfirmacaoVisao | undefined {
  return visao.evidencias.find(item => {
    const rotulo = normalizar(item.rotulo);
    return termos.some(termo => rotulo === normalizar(termo));
  });
}

function valorEvidencia(item?: AfirmacaoVisao) {
  if (!item) return { valor: "PENDENTE", estado: "PENDENTE" as const };
  if (item.campo === "CONFLITO") return { valor: "A CONFERIR", estado: "CONFLITO" as const };
  if (item.campo === "PRESENTE" && item.valorTexto?.trim()) return { valor: item.valorTexto,
    estado: item.estado === "VERMELHO" ? "ALERTA" as const : "PRESENTE" as const };
  return { valor: "PENDENTE", estado: "PENDENTE" as const };
}

function FonteInline({ item }: { item?: AfirmacaoVisao | undefined }) {
  if (!item) return null;
  return <details className="jev-metric__fonte">
    <summary>Fonte</summary>
    {item.fontes.length ? item.fontes.map((fonte, index) => <div className="jev-source" key={`${fonte.sourceId}-${index}`}>
      <strong>{fonte.sourceId}</strong>
      <span>{fonte.dataClinica ?? "Data clínica pendente"} · captura {fonte.dataCaptura}</span>
      <span>{fonte.localizador ?? "Localizador não informado"} · v{fonte.versao}</span>
      <code>{fonte.contentHash}</code>
    </div>) : <p>Fonte não retornada nesta visão.</p>}
  </details>;
}

function Metrica({ rotulo, valor, estado = "PRESENTE", fonte }: {
  rotulo: string; valor: string; estado?: "PRESENTE" | "PENDENTE" | "CONFLITO" | "ALERTA"; fonte?: AfirmacaoVisao | undefined;
}) {
  return <div className={`jev-metric jev-metric--${estado.toLowerCase()}`} data-state={estado}>
    <span className="jev-metric__label">{rotulo}</span>
    <strong className="jev-metric__value">{valor}</strong>
    {estado === "ALERTA" ? <span>Atenção</span> : null}
    <FonteInline item={fonte} />
  </div>;
}

function dado(rotulo: string, campo: { valor: string | null; campo: string } | undefined) {
  if (!campo) return { rotulo, valor: "PENDENTE", estado: "PENDENTE" as const };
  if (campo.campo === "CONFLITO") return { rotulo, valor: "A CONFERIR", estado: "CONFLITO" as const };
  if (campo.campo === "PRESENTE" && campo.valor?.trim()) return { rotulo, valor: campo.valor, estado: "PRESENTE" as const };
  return { rotulo, valor: "PENDENTE", estado: "PENDENTE" as const };
}

export function CabecalhoJEV({ visao, ocupado = false }: { visao: ConsultaIntegrada; ocupado?: boolean }) {
  const lote = visao.cabecalho.lotes.find(item => item.tumorLotId === visao.cabecalho.loteSelecionadoId);
  const idLote = visao.tumorLotId ?? visao.cabecalho.loteSelecionadoId;
  const nomeLote = lote && lote.topografia.campo === "PRESENTE" && lote.topografia.valor
    ? lote.topografia.valor : idLote ?? "Lote não selecionado";
  const alergia = visao.flash?.alergia?.trim()
    || (visao.cabecalho.alergiasPaciente.length ? visao.cabecalho.alergiasPaciente.join(" · ") : "PENDENTE");
  const ecog = valorEvidencia(evidencia(visao, ["ECOG", "Performance status ECOG"]));
  const sc = valorEvidencia(evidencia(visao, ["SC", "Superfície corporal", "Superficie corporal"]));
  const renal = valorEvidencia(evidencia(visao, ["Função renal", "Funcao renal", "Cockcroft-Gault", "ClCr Cockcroft-Gault"]));
  const biomarcadores = visao.evidencias.filter(item => {
    const rotulo = normalizar(item.rotulo);
    return rotulo.includes("pd-l1") || rotulo.includes("pdl1") || rotulo.includes("biomarcador");
  });
  const cumulativos = [
    ...(visao.flash?.parciaisCumulativos ?? []),
    ...(visao.elegibilidade?.motivos.filter(item => item.origem === "cumulativo").map(item => item.texto) ?? []),
  ];
  const ciclo = visao.cabecalho.ciclo;
  const planejado = ciclo ? `C${ciclo.numero} · previsto ${ciclo.previstoEm}` : "PENDENTE";
  const prescrito = ciclo?.prescricaoRef
    ? `${ciclo.prescricaoRef.documentId} · v${ciclo.prescricaoRef.documentVersion}${ciclo.itens.length
      ? ` · ${ciclo.itens.map(item => `${item.droga}: ${item.doseMg} mg${item.reducaoPct > 0 ? ` · redução ${item.reducaoPct}%` : ""}`).join("; ")}` : ""}`
    : "PENDENTE";
  const administrado = visao.flash?.ultimoAdministrado?.trim() || "PENDENTE";

  return <header className="jev-header" role="region" aria-label="Cabeçalho clínico JEV" aria-busy={ocupado}>
    <div className="jev-header__identity">
      <div>
        <p className="jev-eyebrow">CONSULTA · {visao.hoje}</p>
        <h1>{visao.cabecalho.paciente.nome}</h1>
        <p className="jev-header__context">Paciente <code>{visao.patientId}</code> · Encontro <code>{visao.encounterId}</code></p>
      </div>
      <div className="jev-header__tumor">
        <span>Tumor / lote</span>
        <strong>{nomeLote}</strong>
        <small>{idLote ?? "Lote não selecionado"}</small>
      </div>
    </div>
    <div className="jev-header__metrics" aria-label="Resumo clínico">
      <Metrica rotulo="ECOG" valor={ecog.valor} estado={ecog.estado} fonte={evidencia(visao, ["ECOG", "Performance status ECOG"])} />
      <Metrica rotulo="SC" valor={sc.valor} estado={sc.estado} fonte={evidencia(visao, ["SC", "Superfície corporal", "Superficie corporal"])} />
      <Metrica rotulo="Função renal" valor={renal.valor} estado={renal.estado}
        fonte={evidencia(visao, ["Função renal", "Funcao renal", "Cockcroft-Gault", "ClCr Cockcroft-Gault"])} />
      <Metrica rotulo="Alergias" valor={alergia} estado={alergia === "PENDENTE" || alergia === "Não informada" ? "PENDENTE" : "PRESENTE"}
        fonte={evidencia(visao, ["Alergias", "Alergia"])} />
      {biomarcadores.length ? biomarcadores.map(item => {
        const v = valorEvidencia(item);
        return <Metrica key={item.rotulo} rotulo={item.rotulo} valor={v.valor} estado={v.estado} fonte={item} />;
      }) : <Metrica rotulo="PD-L1 / biomarcadores" valor="PENDENTE" estado="PENDENTE" />}
      <Metrica rotulo="Cumulativos" valor={cumulativos.length ? cumulativos.join(" · ") : "PENDENTE"}
        estado={cumulativos.length ? "PRESENTE" : "PENDENTE"} />
    </div>
    <section className="jev-cycle-ruler" role="group" aria-label="Régua do ciclo">
      <div className="jev-cycle-ruler__step" data-track="planejado"><span>Planejado</span><strong>{planejado}</strong></div>
      <div className="jev-cycle-ruler__step" data-track="prescrito"><span>Prescrito</span><strong>{prescrito}</strong></div>
      <div className="jev-cycle-ruler__step" data-track="administrado"><span>Administrado</span><strong>{administrado}</strong></div>
    </section>
  </header>;
}
