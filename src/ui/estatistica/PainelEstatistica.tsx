import { useEffect, useState } from "react";
import { DataCivil } from "../../contracts/base.js";
import type { PeriodoClinicoEstatisticaServico, VisaoEstatisticaServico } from "../../contracts/api/estatisticaServico.js";
// @ts-expect-error folha CSS resolvida pelo Vite
import "./estatistica-servico.css";

type Categoria = keyof VisaoEstatisticaServico["eventosPorCategoria"];
type EstadoAdministracao = keyof VisaoEstatisticaServico["administracoesPorStatus"];
const categorias: readonly { chave: Categoria; rotulo: string }[] = [
  { chave: "FATO", rotulo: "Fatos" }, { chave: "DOCUMENTO", rotulo: "Documentos" },
  { chave: "ADMINISTRACAO", rotulo: "Administrações" }, { chave: "OUTRO", rotulo: "Outros eventos" },
];
const estados: readonly { chave: EstadoAdministracao; rotulo: string }[] = [
  { chave: "COMPLETA", rotulo: "Completa" }, { chave: "PARCIAL", rotulo: "Parcial" },
  { chave: "OMITIDA", rotulo: "Omitida" }, { chave: "INTERROMPIDA", rotulo: "Interrompida" },
];
const exclusoes: readonly { chave: keyof VisaoEstatisticaServico["exclusoes"]; rotulo: string }[] = [
  { chave: "eventosNaoConfirmados", rotulo: "Eventos não confirmados" },
  { chave: "eventosSupersedidos", rotulo: "Eventos supersedidos" },
  { chave: "linhasDuplicadas", rotulo: "Linhas duplicadas" },
  { chave: "administracoesInvalidas", rotulo: "Administrações inválidas" },
  { chave: "administracoesConflito", rotulo: "Administrações em conflito" },
  { chave: "eventosSemDataClinica", rotulo: "Eventos sem data clínica" },
  { chave: "eventosDataClinicaInvalida", rotulo: "Eventos com data clínica inválida" },
  { chave: "eventosForaPeriodo", rotulo: "Eventos fora do período" },
];

function GraficoBarras({
  titulo, itens,
}: {
  titulo: string;
  itens: readonly { rotulo: string; valor: number }[];
}) {
  const escala = Math.max(1, ...itens.map(item => item.valor));
  const largura = 260;
  const alturaLinha = 32;
  return <svg className="estatistica-grafico" role="img" aria-label={titulo}
    viewBox={`0 0 440 ${itens.length * alturaLinha + 12}`}>
    <title>{titulo}</title>
    <desc>Barras horizontais proporcionais às contagens desta projeção.</desc>
    {itens.map((item, indice) => {
      const y = indice * alturaLinha + 5;
      const barra = item.valor === 0 ? 0 : Math.max(2, largura * item.valor / escala);
      return <g key={item.rotulo}>
        <text className="estatistica-grafico__rotulo" x="0" y={y + 15}>{item.rotulo}</text>
        <rect className="estatistica-grafico__trilho" x="142" y={y} width={largura} height="20" rx="4" />
        <rect className="estatistica-grafico__barra" x="142" y={y} width={barra} height="20" rx="4" />
        <text className="estatistica-grafico__valor" x={0} y={y + 15} transform={`translate(${150 + barra}, 0)`}>{item.valor}</text>
      </g>;
    })}
  </svg>;
}

function TabelaContagens({
  nome, itens,
}: {
  nome: string;
  itens: readonly { rotulo: string; eventos: number; pacientes: number }[];
}) {
  return <table className="estatistica-tabela" aria-label={nome}>
    <thead><tr><th scope="col">Categoria</th><th scope="col">Eventos</th><th scope="col">Pacientes</th></tr></thead>
    <tbody>{itens.map(item => <tr key={item.rotulo}><th scope="row">{item.rotulo}</th>
      <td>{item.eventos}</td><td>{item.pacientes}</td></tr>)}</tbody>
  </table>;
}

function percentual(parte: number, total: number): string {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    .format(parte / total * 100);
}

export function PainelEstatistica({
  dados, ocupado = false, aoPeriodo,
}: {
  dados: VisaoEstatisticaServico;
  ocupado?: boolean;
  aoPeriodo: (periodo: PeriodoClinicoEstatisticaServico | null) => void;
}) {
  const [inicio, setInicio] = useState(dados.periodoClinico?.inicio ?? "");
  const [fim, setFim] = useState(dados.periodoClinico?.fim ?? "");
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    setInicio(dados.periodoClinico?.inicio ?? "");
    setFim(dados.periodoClinico?.fim ?? "");
    setErro(null);
  }, [dados.periodoClinico?.inicio, dados.periodoClinico?.fim]);
  const periodoAplicado = dados.periodoClinico
    ? `${dados.periodoClinico.inicio} a ${dados.periodoClinico.fim}`
    : "Carteira completa — sem filtro de período clínico";
  const linhasCategorias = categorias.map(item => ({ rotulo: item.rotulo,
    eventos: dados.eventosPorCategoria[item.chave], pacientes: dados.pacientesPorCategoria[item.chave] }));
  const linhasEstados = estados.map(item => ({ rotulo: item.rotulo,
    eventos: dados.administracoesPorStatus[item.chave], pacientes: dados.pacientesPorStatusDeAdministracao[item.chave] }));

  function aplicarPeriodo() {
    setErro(null);
    if (!inicio && !fim) { aoPeriodo(null); return; }
    if (!inicio || !fim || !DataCivil.safeParse(inicio).success || !DataCivil.safeParse(fim).success) {
      setErro("Informe datas clínicas inicial e final válidas."); return;
    }
    if (inicio > fim) { setErro("A data inicial não pode ser depois do fim do período."); return; }
    const periodo: PeriodoClinicoEstatisticaServico = { inicio, fim };
    aoPeriodo(periodo);
  }

  return <section className="estatistica-servico" aria-label="Estatística derivada do ledger" aria-busy={ocupado}>
    <header className="estatistica-cabecalho">
      <div><h2>Estatística derivada</h2><p>Projeção {dados.versao} · {periodoAplicado}</p></div>
      <strong>{dados.totalPacientes} {dados.totalPacientes === 1 ? "paciente" : "pacientes"}</strong>
    </header>

    <fieldset className="estatistica-filtros" disabled={ocupado}>
      <legend>Período clínico</legend>
      <label>Início do período clínico<input type="date" aria-label="Início do período clínico" value={inicio}
        onChange={event => { setInicio(event.target.value); setErro(null); }} /></label>
      <label>Fim do período clínico<input type="date" aria-label="Fim do período clínico" value={fim}
        onChange={event => { setFim(event.target.value); setErro(null); }} /></label>
      <button type="button" onClick={aplicarPeriodo}>Aplicar período</button>
      {erro ? <p role="alert">{erro}</p> : null}
    </fieldset>

    <section aria-label="Carteira de pacientes" className="estatistica-resumo">
      <h3>Carteira</h3><p>{dados.totalPacientes} pacientes no escopo selecionado.</p>
      <p>Denominador: {dados.denominadorPacientes} pacientes com evento confirmado vigente.</p>
    </section>

    <section aria-label="Cobertura documental" className="estatistica-resumo">
      <h3>Cobertura documental assinada</h3>
      {dados.denominadorPacientes > 0
        ? <p>{dados.pacientesComDocumentoAssinado} de {dados.denominadorPacientes} pacientes ({percentual(dados.pacientesComDocumentoAssinado, dados.denominadorPacientes)}%); {dados.documentosAssinados} documentos.</p>
        : <p>Não calculável — sem pacientes no denominador. {dados.documentosAssinados} documentos assinados.</p>}
    </section>

    <section className="estatistica-bloco" aria-label="Eventos e pacientes por categoria">
      <h3>Eventos e pacientes por categoria</h3>
      <TabelaContagens nome="Eventos e pacientes por categoria" itens={linhasCategorias} />
      <GraficoBarras titulo="Eventos por categoria" itens={linhasCategorias.map(item => ({ rotulo: item.rotulo, valor: item.eventos }))} />
    </section>

    <section className="estatistica-bloco" aria-label="Administrações por estado">
      <h3>Administração registrada</h3>
      <p>Pendentes: {dados.administracoesPendentes} · conflitos: {dados.administracoesConflito}</p>
      <table className="estatistica-tabela" aria-label="Administrações por estado">
        <thead><tr><th scope="col">Estado</th><th scope="col">Administrações</th><th scope="col">Pacientes</th></tr></thead>
        <tbody>{linhasEstados.map(item => <tr key={item.rotulo}><th scope="row">{item.rotulo}</th>
          <td>{item.eventos}</td><td>{item.pacientes}</td></tr>)}</tbody>
      </table>
      <GraficoBarras titulo="Administrações por estado" itens={linhasEstados.map(item => ({ rotulo: item.rotulo, valor: item.eventos }))} />
    </section>

    <section className="estatistica-bloco" aria-label="Exclusões da projeção">
      <h3>Exclusões e limites do ledger</h3>
      <table className="estatistica-tabela" aria-label="Exclusões da projeção">
        <thead><tr><th scope="col">Motivo</th><th scope="col">Contagem</th></tr></thead>
        <tbody>{exclusoes.map(item => <tr key={item.chave}><th scope="row">{item.rotulo}</th>
          <td>{dados.exclusoes[item.chave]}</td></tr>)}</tbody>
      </table>
    </section>
  </section>;
}
