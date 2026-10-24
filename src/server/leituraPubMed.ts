import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { LeituraPubMedResposta, LIMITE_LISTA_RASCUNHOS_PUBMED, ListaRascunhosPubMedResposta, ReferenciaPubMed } from "../contracts/leituraPubMed.js";
import { ReadIntent } from "../contracts/w10/closure.js";
import { executarLeitura, type ReadTransport } from "../kernel/gateway/gateway.js";
import { criarTransportePubMed } from "../kernel/gateway/executores/pubmed.js";
import type { DatabaseSync } from "node:sqlite";
import { lerDraft, listarDraftsGlobaisPorTipo, salvarDraft } from "../kernel/comandos/portas.js";
import type { GerenciadorSessao } from "./sessao.js";
import { lerPaciente } from "./leituras.js";

type DepsLeitura = {
  db: DatabaseSync;
  sessoes: GerenciadorSessao;
  agora: () => string;
  log: (entry: { rota: string; codigo: string; status: number }) => void;
  transportePubMed?: ReadTransport;
};

const KIND = "PUBMED_REFERENCIAS_RASCUNHO";
const Registro = z.object({
  kind: z.literal(KIND), consultaHash: z.string().regex(/^[a-f0-9]{64}$/),
  referencias: z.array(ReferenciaPubMed).max(8), criaEventoClinico: z.literal(false), consultaClinica: z.literal(false),
}).strict();

/** Pesquisa bibliográfica no território STUDY. O dicionário fica no processo e não sai na URL. */
export async function operarLeituraPubMed(deps: DepsLeitura, token: string, raw: unknown,
  _req: IncomingMessage, res: ServerResponse) {
  const parsed = ReadIntent.safeParse(raw);
  if (!parsed.success || parsed.data.destination !== "PUBMED" || parsed.data.purpose !== "RESEARCH")
    return { status: 400, body: { codigo: "PAYLOAD_INVALIDO" } };
  const sessao = deps.sessoes.obter(token);
  const consulta = deps.sessoes.consultaSelecionada(token);
  if (!sessao || !consulta) return { status: 409, body: { codigo: "CONTEXTO_CONSULTA_NAO_SELECIONADO" } };
  const paciente = lerPaciente(deps.db, consulta.patientId);
  if (!paciente) return { status: 409, body: { codigo: "PACIENTE_DESTINO_NAO_ENCONTRADO" } };
  const consultaHash = createHash("sha256").update(JSON.stringify({
    query: parsed.data.payload.query ?? null, refs: parsed.data.payload.refs ?? null,
  }), "utf8").digest("hex");
  const draftId = `pubmed-${createHash("sha256").update(parsed.data.requestId, "utf8").digest("hex").slice(0, 32)}`;
  const existente = lerDraft(deps.db, draftId);
  const gravado = existente ? Registro.safeParse(existente.payload) : null;
  if (gravado?.success) {
    if (gravado.data.consultaHash !== consultaHash) return { status: 409, body: { codigo: "READ_OPERACAO_DIVERGENTE" } };
    return { status: 200, body: LeituraPubMedResposta.parse({ codigo: "REPLAY", draftId, revision: existente!.revision,
      referencias: gravado.data.referencias, criaEventoClinico: false, consultaClinica: false }) };
  }
  const sinal = new AbortController();
  const cancelar = () => { if (!res.writableEnded) sinal.abort(); };
  res.on("close", cancelar);
  try {
    const transporte = deps.transportePubMed ?? criarTransportePubMed({ agora: deps.agora });
    const leitura = await executarLeitura(parsed.data, {
      agora: deps.agora, sessao, context: { territory: "STUDY" },
      provenance: { sourceId: "ncbi-eutils-pubmed", version: "esearch-esummary-v1" },
      dicionarioPaciente: { nomes: [paciente.nome], identificadores: [paciente.patientId, sessao.medicoId, sessao.crm,
        ...paciente.identificadores.map((item) => item.valor), ...(paciente.nascimento ? [paciente.nascimento] : [])] },
      auditar: (evento) => deps.log({ rota: "leituraPubMed", codigo: evento.motivoCodigo, status: evento.decisao === "PERMITIDA" ? 200 : 409 }),
      transportes: { PUBMED: transporte }, signal: sinal.signal,
    });
    if (leitura.estado !== "CONCLUIDA") return { status: leitura.estado === "FALHOU" ? 502 : 409, body: { codigo: leitura.motivoCodigo } };
    const referencias = z.object({ referencias: z.array(ReferenciaPubMed).max(8) }).strict().safeParse(leitura.resultado);
    if (!referencias.success) return { status: 502, body: { codigo: "READ_RESPOSTA_INVALIDA" } };
    const salvo = salvarDraft(deps.db, {
      draftId, patientId: null, sourceId: "ncbi-eutils-pubmed", rawRef: `pubmed-local:${draftId}`, revision: 0,
      criadoEm: deps.agora(), diagnostics: ["REFERENCIA_BIBLIOGRAFICA", "NAO_E_FATO_CLINICO"],
      payload: { kind: KIND, consultaHash, referencias: referencias.data.referencias, criaEventoClinico: false, consultaClinica: false },
    });
    return { status: 201, body: LeituraPubMedResposta.parse({ codigo: "REFERENCIAS_SALVAS", draftId: salvo.draftId,
      revision: salvo.revision, referencias: referencias.data.referencias, criaEventoClinico: false, consultaClinica: false }) };
  } finally {
    res.removeListener("close", cancelar);
  }
}

/** Lista rascunhos bibliográficos locais. Não chama a rede. A resposta não leva paciente nem prontuário. */
export function listarRascunhosPubMed(deps: DepsLeitura, token: string, raw: unknown) {
  if (!z.object({}).strict().safeParse(raw).success) return { status: 400, body: { codigo: "PAYLOAD_INVALIDO" } };
  const sessao = deps.sessoes.obter(token);
  const consulta = deps.sessoes.consultaSelecionada(token);
  if (!sessao || !consulta) return { status: 409, body: { codigo: "CONTEXTO_CONSULTA_NAO_SELECIONADO" } };
  if (!lerPaciente(deps.db, consulta.patientId)) return { status: 409, body: { codigo: "PACIENTE_DESTINO_NAO_ENCONTRADO" } };
  const linhas = listarDraftsGlobaisPorTipo(deps.db, KIND)
    .slice()
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm) || a.draftId.localeCompare(b.draftId));
  const validos: Array<z.infer<typeof ListaRascunhosPubMedResposta>["itens"][number]> = [];
  let omitidos = 0;
  for (const linha of linhas) {
    const registro = Registro.safeParse(linha.payload);
    if (!registro.success || registro.data.referencias.some((ref) => ref.url !== `https://pubmed.ncbi.nlm.nih.gov/${ref.pmid}/`)) {
      omitidos++;
      continue;
    }
    validos.push({
      draftId: linha.draftId, revision: linha.revision, criadoEm: linha.criadoEm,
      referencias: registro.data.referencias, criaEventoClinico: false, consultaClinica: false,
    });
  }
  return { status: 200, body: ListaRascunhosPubMedResposta.parse({
    codigo: "RASCUNHOS_PUBMED_LISTADOS", itens: validos.slice(0, LIMITE_LISTA_RASCUNHOS_PUBMED),
    omitidos, truncado: validos.length > LIMITE_LISTA_RASCUNHOS_PUBMED,
    criaEventoClinico: false, consultaClinica: false,
  }) };
}
