import { ResultadoJornada, type CorpusJornada } from "../../contracts/jornadaClinica.js";
import type { ClinicalFact } from "../../contracts/w10/extracao.js";
import type { ConfiguracaoPrimeiraConsulta, ExecucaoSkill } from "../../contracts/skillsClinicas.js";
import { prepararPrimeiraConsulta } from "./primeiraConsulta.js";

export function prepararJornadaClinica(input: {
  execucaoId: string; contexto: ExecucaoSkill["contexto"]; nome: string; skillId: ExecucaoSkill["skillId"];
  configuracao: ConfiguracaoPrimeiraConsulta; fontes: ExecucaoSkill["fontes"]; facts: readonly ClinicalFact[];
  pendenciasFontes: readonly string[]; corpus: CorpusJornada | null; corpusHash: string | null; ledgerHash: string; avaliacaoHash: string;
  alertas: ResultadoJornada["alertas"]; seguranca: string[]; mudancas: string[]; historico: string[];
  avaliacaoIndisponivel?: boolean;
}) {
  const tipo = input.skillId === "retorno" ? "RETORNO" : input.skillId === "follow-up" ? "FOLLOW_UP" : "PRIMEIRA_CONSULTA";
  const selecao = input.configuracao.jornada;
  const urgente = input.alertas.length > 0;
  const cartoes = urgente ? [] : input.corpus?.cartoes.filter(c => selecao?.cartoesIds.includes(c.id)) ?? [];
  const acoes = urgente ? [] : input.corpus?.acoes_consulta.filter(a => selecao?.acoesIds.includes(a.id)) ?? [];
  const divIds = new Set(cartoes.flatMap(c => c.divergencias));
  const divergencias = input.corpus?.divergencias.filter(d => divIds.has(d.id)) ?? [];
  const fonteIds = new Set([...cartoes.flatMap(c => [...c.fontes, ...Object.values(c.linhas).flatMap(l => l.fontes)]),
    ...acoes.flatMap(a => a.fontes), ...divergencias.flatMap(d => d.fontes)].map(f => f.fonte));
  const fontes = input.corpus?.fontes.filter(f => fonteIds.has(f.id)) ?? [];
  const pendencias = [...input.pendenciasFontes,
    "Aplicabilidade dos cartões depende de revisão médica de estadiamento, subtipo, exposições e condições; a seleção não confirma fatos.",
    "Edição TNM não é presumida; recidiva pós-adjuvância não equivale automaticamente a L2.",
    ...(input.corpus ? [] : ["CORPUS INDISPONÍVEL: não há referência terapêutica recuperável."]),
    ...(divergencias.length ? ["DIVERGÊNCIAS DE FONTE: revisar antes de aplicar as opções."] : []),
    ...(urgente ? ["SUSPEITA URGENTE: avaliação médica prioritária; propostas eletivas interrompidas."] : []),
    ...(input.avaliacaoIndisponivel ? ["AVALIAÇÃO CLÍNICA INDISPONÍVEL: urgência do prontuário não foi checada."] : []),
  ];
  const etapas: ResultadoJornada["etapas"] = [];
  const etapa = (id: string, titulo: string, estado: ResultadoJornada["etapas"][number]["estado"], motivo: string) => etapas.push({id,titulo,estado,motivo});
  etapa("S00", "Identidade e proveniência", "EXECUTADA", "Fontes vinculadas ao encontro por decisão registrada, revisão e hash conferidos pelo servidor.");
  etapa("S01", "Urgência clínica e radiológica", input.avaliacaoIndisponivel || urgente ? "PENDENTE" : "EXECUTADA", input.avaliacaoIndisponivel
    ? "Avaliação clínica indisponível; a checagem de urgência não foi executada."
    : urgente
    ? "Sinal identificado; exige avaliação imediata. Não é diagnóstico confirmado."
    : "Regras disponíveis avaliadas; ausência de achado não exclui emergências fora da cobertura.");
  etapa("S02", "Extração e reconciliação", "EXECUTADA", `${input.facts.length} informações recebidas com fonte; valores divergentes e temporalidade preservados.`);
  etapa("S03", "AP, IHQ e biomarcadores", "PENDENTE", "Conferir laudos, amostra, variante, clone e pendências; ausente não equivale a negativo.");
  etapa("S04", "Imagem, estadiamento e ressecabilidade", "PENDENTE", "Preservar TNM recebido e edição; comparação radiológica e avaliação multidisciplinar dependem de revisão.");
  if (tipo === "RETORNO") etapa("S06", "Resposta, administração e toxicidade", "PENDENTE", "Mudanças e histórico documentado abaixo; prescrito não equivale a administrado, menção de progressão não confirma RECIST.");
  etapa("S05", "Corpus por cenário e subtipo", urgente ? "INTERROMPIDA" : "EXECUTADA", `${cartoes.length} cartões de referência selecionados pelo médico, sem validação automática de aplicabilidade.`);
  etapa("S07", "Interações, comorbidades e função orgânica", "PENDENTE", "Avaliações do prontuário anexadas; lacuna de dado ou de regra continua indeterminada.");
  if (selecao?.discutirTratamento) etapa("S08", "Tratamento sistêmico", urgente ? "INTERROMPIDA" : "PENDENTE", "Opções documentais; dose, liberação e administração exigem seus fluxos próprios e decisão médica.");
  if (tipo === "FOLLOW_UP") etapa("S09", "Seguimento", urgente ? "INTERROMPIDA" : "PENDENTE", "Escolher rotina contextual e marco temporal; não somar protocolos nem emitir pedidos automaticamente.");
  etapa("S10", "Exames e encaminhamentos", urgente ? "INTERROMPIDA" : "PENDENTE", "Ações selecionadas são sugestões condicionais; conferir resultados, solicitações e agendamentos anteriores.");
  etapa("S11", "Rascunhos clínicos", "EXECUTADA", "Documentos locais não assinados, com propostas separadas das informações recebidas.");
  etapa("S12", "Conferência", "EXECUTADA", "Contratos, vínculo, fontes e integridade verificados; não certifica correção clínica.");
  etapa("S13", "Decisão médica", "PENDENTE", "Revisar, corrigir e assinar pelo fluxo próprio; a skill não libera tratamento nem envia mensagens.");
  const jornada = ResultadoJornada.parse({ versao:"1.0.0", tipo, estado:urgente ? "URGENTE" : "PARCIAL",
    corpusHash:input.corpusHash, ledgerHash:input.ledgerHash, avaliacaoHash:input.avaliacaoHash, etapas, alertas:input.alertas, seguranca:input.seguranca,
    mudancas:input.mudancas, cartoes, acoes, fontes, divergencias,
    criterios:[...cartoes.map(c=>({id:`aplicabilidade:${c.id}`,tipo:"ELEGIBILIDADE",estado:"INDETERMINADO",texto:`Verificar condições: ${c.subtipo}; ${c.estadiamento}. Critério decisivo: ${c.condicoes_e_limites.join("; ") || "escolha médica; a fonte não define preferência única"}`})),
      {id:"seguranca-integrada",tipo:"SEGURANCA",estado:urgente?"NAO_ATENDE":"INDETERMINADO",texto:urgente?"Avaliação urgente prioritária":"Verificar riscos e pendências; ausência de alerta não comprova segurança."}],
    pendencias:[...new Set(pendencias)],autorizaTratamento:false });
  const preparados = prepararPrimeiraConsulta({ ...input, pendenciasFontes:jornada.pendencias });
  const refs = (rs: {fonte:string;paginas_pdf?:number[]|undefined;secao?:string|null|undefined}[]) => rs.map(r=>`${r.fonte}${r.paginas_pdf ? ` p.${r.paginas_pdf.join(",")}` : r.secao ? ` — ${r.secao}` : ""}`).join("; ");
  const textosCartoes = jornada.cartoes.map(c=>`${c.id} — ${c.estadiamento} — ${c.subtipo}\n${c.modalidades.join(" + ")} | ${c.papeis.join(" / ")}\n${c.trilha}\n`
    + Object.entries(c.linhas).flatMap(([n,l]) => {
      if (!l.opcoes.length && (n === "4" || n === "5")) return [];
      if (!l.opcoes.length) return [`L${n}: sem opção extraída. ${l.condicao || l.estado} Sem dose neste cartão.`];
      return [`L${n}: ${l.opcoes.join(" OU ")}; ${l.condicao || "condição a conferir"}; ${refs(l.fontes)}. Sem dose neste cartão.`];
    }).join("\n")
    + `\nCondições: ${c.condicoes_e_limites.join("; ")}\nFontes: ${refs(c.fontes)}`);
  const textoJornada = ["Etapa 0 — workup, biomarcadores, segurança e decisão multidisciplinar",
    ...etapas.map(e=>`${e.id} ${e.titulo}: ${e.estado}. ${e.motivo}`),
    "Mudanças desde o estado anterior",...(input.mudancas.length ? input.mudancas : ["Sem comparação suficiente; conferir histórico."]),
    "Histórico documentado (não é administração presumida)",...input.historico,
    "Avaliações de segurança",...input.seguranca,
    "Cartão por estadiamento + subtipo — referência em revisão",...textosCartoes,
    ...divergencias.map(d=>`${d.id}: ${d.posicao_a} / ${d.posicao_b} ${d.tratamento} Fontes: ${refs(d.fontes)}`),
    ...fontes.map(f=>`Fonte ${f.id}: ${f.titulo}; edição ${f.edicao ?? "não declarada"}; consulta ${f.consultadoEm ?? "não registrada"}; ${f.url ?? f.arquivo ?? "localizador pendente"}; ${f.estado}`),
    ...input.alertas.map(a=>`URGENTE: ${a.texto}; fonte ${a.sourceId ?? "prontuário"}; ${a.trecho ?? ""}`),
  ].join("\n\n");
  for (const d of preparados.documentos) {
    if (input.skillId !== "primeira-consulta") d.titulo = d.titulo.replace(/primeira consulta/g,tipo === "RETORNO" ? "retorno" : "seguimento");
    if (urgente && ["RECEITA","PEDIDO_EXAMES","ENCAMINHAMENTO","ORIENTACOES"].includes(d.tipo))
      d.texto = "RASCUNHO — SUSPEITA URGENTE — avaliação médica prioritária. Propostas eletivas interrompidas.\n\n" + textoJornada;
    else if (["RESUMO_CASO","EVOLUCAO"].includes(d.tipo)) d.texto += "\n\n" + textoJornada;
    else if (["PEDIDO_EXAMES","ENCAMINHAMENTO"].includes(d.tipo)) {
      const pertinentes = jornada.acoes.filter(a=>d.tipo === "ENCAMINHAMENTO" ? a.id.startsWith("EN-") : !a.id.startsWith("EN-"));
      d.texto += "\n\nReferências selecionadas — não são pedidos emitidos:\n" + pertinentes.map(a=>`${a.id}: ${a.rascunho}\nCondição: ${a.condicao}\n${a.pendencia}\n${refs(a.fontes)}`).join("\n\n");
    }
    d.pendencias = [...new Set([...d.pendencias,...jornada.pendencias])];
  }
  return {...preparados,jornada};
}
