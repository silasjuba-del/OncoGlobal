import { useState } from "react";
import { marcadoInicialmente } from "./Bundle.js";
import type { MarcacaoTarefasRetorno } from "./TarefasRetorno.js";
// @ts-expect-error folha CSS pura, resolvida pelo Vite
import "./flash.css";

export type SituacaoExame = "DENTRO_DO_LIMITE" | "FORA_DO_LIMITE" | "SEM_REFERENCIA";
export interface ExameRecenteFlash { data: string; nome: string; fraseLaudo?: string; situacao: SituacaoExame }
export interface ItemFlash { id: string; rotulo: string; origem: "MODELO_MEDICO" | "SUGESTAO"; preMarcado: boolean }
export type EstadoApacFlash = "VALIDA" | "PENDENTE" | "INCOMPATIVEL";
export interface ApacFlash { cid: string; sigtap: string; finalidade: string; competencia: string; estado: EstadoApacFlash; pendencias: readonly string[] }
export interface RetornoFlash { dias: number | null; motivo?: string; examesAntesDoRetorno: readonly string[] }
export interface TarefasRetornoFlash { modeloPadraoSalvo: boolean; retorno: ItemFlash; laboratorio: ItemFlash; imagem: ItemFlash }
export interface ConsultaFlashProps {
  cabecalho: { diagnostico?: string; tnm?: string; estadio?: string; biomarcador?: string; antecedentes?: string; medicacoesUso?: string; alergia?: string; ecog?: string; tratamentoAtual?: string; linha?: string; cicloDia?: string; ultimoAdministrado?: string };
  exames: readonly ExameRecenteFlash[];
  laboratorios?: readonly ExameRecenteFlash[];
  toxicidades?: readonly string[];
  avisos?: readonly string[];
  parciaisCumulativos?: readonly string[];
  sugestoesLaboratorio?: readonly string[];
  pacienteNome?: string;
  hoje?: string;
  planoInicial?: PlanoFlash;
  modeloSolicitacoes?: {laboratorio:string[];imagem:string[]};
  acoesHoje: readonly ItemFlash[]; receitas: readonly ItemFlash[]; apac: ApacFlash; iaFala: readonly string[]; retorno: RetornoFlash;
  tarefasRetorno?: TarefasRetornoFlash; linhaPontualizada?: boolean;
  aoSalvarRascunho: (plano: PlanoFlash) => void; aoFinalizar: (plano: PlanoFlash) => void;
  aoAbrirApac?: () => void; ocupado?: boolean; rotuloFinalizar?: string;
}
/** Compatibilidade do envelope: APAC permanece apenas como rascunho legado, fora do fluxo Flash. */
export interface PlanoFlash {
  acoesMarcadas: readonly string[]; receitasMarcadas: readonly string[];
  apac: ApacFlash & { emitir: false }; retorno: RetornoFlash; tarefasRetorno?: MarcacaoTarefasRetorno;
  solicitacoes?: { laboratorio: string[]; imagem: string[] };
  decisaoQt?: { solicitarCiclo: boolean; data: string | null };
}
export function marcadoInicialFlash(item: ItemFlash): boolean {
  if (item.id === "liberar_tratamento") return false;
  return marcadoInicialmente({ documentId: item.id, documentVersion: 1, titulo: item.rotulo, preMarcado: item.preMarcado, visivel: true, origem: item.origem });
}
const LAB = ["HMG", "U", "Cr", "TGO", "TGP"];
const RAD = ["TC tórax", "TC abdome superior", "TC abdome inferior", "Cintilografia"];
const presente = (v?: string) => v?.trim() || "PENDENTE";
const limparOutros = (v: string) => v.split(";").map(x => x.trim()).filter(Boolean);
const situacao = { DENTRO_DO_LIMITE: "dentro do limite", FORA_DO_LIMITE: "fora do limite", SEM_REFERENCIA: "sem referência" };

export function ConsultaFlash(props: ConsultaFlashProps) {
  const { cabecalho: c, planoInicial: inicial } = props;
  const selecaoInicial = inicial ? inicial.solicitacoes : props.modeloSolicitacoes;
  const [labs, setLabs] = useState<string[]>(() => selecaoInicial?.laboratorio.filter(x => LAB.includes(x)) ?? []);
  const [rad, setRad] = useState<string[]>(() => selecaoInicial?.imagem.filter(x => RAD.includes(x)) ?? []);
  const [outrosLab, setOutrosLab] = useState(() => selecaoInicial?.laboratorio.filter(x => !LAB.includes(x)).join("; ") ?? "");
  const [outrosRad, setOutrosRad] = useState(() => selecaoInicial?.imagem.filter(x => !RAD.includes(x)).join("; ") ?? "");
  // Apenas a escolha expressa salva pelo médico pode restaurar esta seleção.
  const [ciclo, setCiclo] = useState(inicial?.decisaoQt?.solicitarCiclo ?? false);
  const [data, setData] = useState(inicial?.decisaoQt?.data ?? props.hoje ?? "");
  const [prazo, setPrazo] = useState(() => { const d = inicial ? inicial.retorno.dias : props.retorno.dias; return d == null ? "" : String(d); });
  const dias = prazo.trim() === "" ? null : Number(prazo);
  const invalido = dias !== null && (!Number.isInteger(dias) || dias < 1 || dias > 3650);
  function plano(): PlanoFlash {
    const laboratorio = [...new Set([...labs, ...limparOutros(outrosLab)])];
    const imagem = [...new Set([...rad, ...limparOutros(outrosRad)])];
    return { acoesMarcadas: [], receitasMarcadas: [], apac: { ...props.apac, emitir: false },
      retorno: { ...props.retorno, dias: invalido ? null : dias, examesAntesDoRetorno: [...laboratorio, ...imagem] },
      tarefasRetorno: { retorno: true, laboratorio: laboratorio.length > 0, imagem: imagem.length > 0 },
      solicitacoes: { laboratorio, imagem }, decisaoQt: { solicitarCiclo: ciclo, data: data || null } };
  }
  function selecao(titulo: string, nomes: string[], valores: string[], alterar: (v: string[]) => void, outros: string, alterarOutros: (v: string) => void, rotulo: string) {
    const todos = nomes.every(x => valores.includes(x));
    return <section className="flash-coluna" aria-label={rotulo}>
      <div className="flash-colhead"><h3>{titulo}</h3><button type="button" onClick={() => alterar(todos ? [] : [...nomes])} aria-label={`${todos ? "Desmarcar" : "Selecionar"} todos ${titulo}`}>{todos ? "Nenhum" : "Todos"}</button></div>
      {nomes.map(nome => <label className="flash-check" key={nome}><input type="checkbox" checked={valores.includes(nome)} onChange={() => alterar(valores.includes(nome) ? valores.filter(x => x !== nome) : [...valores, nome])} />{nome}</label>)}
      <label className="flash-outros">Outros<input type="text" aria-label={`Outros ${titulo}`} value={outros} onChange={e => alterarOutros(e.target.value)} placeholder="Médico escreve; separe por ;" maxLength={2000} /></label>
    </section>;
  }
  return <section className="consulta-flash" aria-label="Conteúdo da Consulta Flash">
    <header className="flash-cabecalho"><strong>Consulta Flash</strong>{props.pacienteNome && <span>{props.pacienteNome}</span>}{props.aoAbrirApac && <button type="button" onClick={props.aoAbrirApac}>Abrir APAC ↗</button>}</header>
    <div className="flash-corpo">
      <section aria-label="Revisão rápida"><h3>DIAGNÓSTICO</h3><p className="flash-diagnostico">{presente(c.diagnostico)} · TNM {presente(c.tnm)} · Estádio {presente(c.estadio)}</p>
        <p className="flash-evidencias" aria-label="Biópsia e imagem">{props.exames.length ? props.exames.map(e => `${e.data} · ${e.nome}: ${e.fraseLaudo || "PENDENTE"}`).join(" | ") : "Biópsia e imagem: PENDENTE"}</p>
      </section>
      <section className="flash-linha" aria-label="Resultados laboratoriais"><h3>LABS <small>· últimos resultados</small></h3><div className="flash-resultados">{props.laboratorios?.length ? props.laboratorios.map((e, i) => <span key={`${e.nome}-${i}`} title={situacao[e.situacao]}>{e.nome}: {e.fraseLaudo || "PENDENTE"} <small>({e.data}) · {situacao[e.situacao]}</small></span>) : <span>PENDENTE</span>}</div></section>
      <section className="flash-linha" aria-label="Tratamento vigente"><h3>QT</h3><p><strong>{presente(c.tratamentoAtual)} · ciclo {presente(c.cicloDia)}</strong> <small>Previsto · último administrado: {presente(c.ultimoAdministrado)}</small></p></section>
      <section className="flash-seguranca" aria-label="Toxicidades e alergia"><div><strong>TOX</strong> {props.toxicidades?.length ? props.toxicidades.join(" · ") : "Sem sintomas registrados"}</div><div><strong>ALERGIA</strong> {c.alergia?.trim() || "Não informada"}</div></section>
      {props.avisos?.length ? <p role="alert" aria-label="Lembretes agrupados">{props.avisos.join("; ")}</p> : null}
      {props.parciaisCumulativos?.length ? <p className="flash-alaranjado" data-cor="ALARANJADO">{props.parciaisCumulativos.join("; ")}</p> : null}
      {props.sugestoesLaboratorio?.length ? <button type="button" onClick={() => setOutrosLab(atual =>
        [...new Set([...limparOutros(atual),...props.sugestoesLaboratorio!])].join("; "))}>
        Incluir exames sugeridos: {props.sugestoesLaboratorio.join(", ")}</button> : null}
      {props.iaFala.length > 0 && <p className="flash-linha" aria-label="Pendências e alertas">{props.iaFala.join("; ")}</p>}
      <h3 className="flash-conduta">CONDUTA MÉDICA</h3>
      <fieldset className="flash-edicao" disabled={props.ocupado}><legend className="flash-sr">Solicitações e decisão médica</legend><div className="flash-colunas">
        {selecao("LAB", LAB, labs, setLabs, outrosLab, setOutrosLab, "Solicitações laboratoriais")}
        {selecao("RAD", RAD, rad, setRad, outrosRad, setOutrosRad, "Solicitações de imagem")}
        <section className="flash-coluna" aria-label="Decisão médica sobre o ciclo"><h3>QT</h3><p>{presente(c.tratamentoAtual)} · {presente(c.cicloDia)}</p><label className="flash-check"><input type="checkbox" checked={ciclo} onChange={e => setCiclo(e.target.checked)} />Liberar ciclo {c.cicloDia ?? ""}</label><label className="flash-outros">Data<input type="date" aria-label="Data do ciclo" value={data} onChange={e => setData(e.target.value)} /></label><small>Decisão do médico</small></section>
      </div></fieldset>
    </div>
    <footer className="flash-rodape"><label>Retorno em <input type="number" aria-label="Prazo do retorno em dias" min={1} max={3650} value={prazo} disabled={props.ocupado} aria-invalid={invalido} onChange={e => setPrazo(e.target.value)} /> dias</label><div><button type="button" disabled={props.ocupado || invalido} onClick={() => props.aoSalvarRascunho(plano())}>SALVAR RASCUNHO</button><button type="button" disabled={props.ocupado || invalido} onClick={() => props.aoFinalizar(plano())}>{props.rotuloFinalizar ?? "REVISAR · IMPRIMIR"}</button></div></footer>
    {invalido && <p role="alert">Informe um número inteiro entre 1 e 3650 dias, ou deixe vazio para PENDENTE.</p>}
  </section>;
}
