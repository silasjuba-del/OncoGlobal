import { hashCanonico } from "../modules/tipos.js";
import { CSS_IMPRESSAO_A4 } from "./estilo.js";
export interface CampoApac { id: string; campo: string; origem: string; tipo: "CAMPO" | "ROTULO"; bloco: string; valor: string; }
export interface TemplateApac { id: string; versao: string; campos: readonly Omit<CampoApac, "valor">[]; }
export interface EntradaApac {
  documentId?: string;
  documentVersion?: number;
  valores: Readonly<Record<string, string | undefined>>;
  modeloEmBranco?: boolean;
  assinatura?: { documentId: string; documentVersion: number; documentHash: string } | null;
  metadados?: { finalidadeLote?: string; cidLoteConfirmado?: string; cidSecundarioConfirmado?: string; cidCausasConfirmado?: string; diagnosticoLoteConfirmado?: string; temTabelaSigtap?: boolean };
}
export interface ResultadoApac { html: string; templateId: string; versao: string; hash: string; campos: readonly CampoApac[]; finalidadeLote: string; status: "ASSINADO" | "RASCUNHO" | "MODELO_EM_BRANCO"; motivoAssinatura: "REFERENCIA_COMPATIVEL" | "SEM_ASSINATURA" | "ID_VERSAO_OU_HASH_DIVERGENTE"; }
const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c]!);
const EM_BRANCO = new Set(["DATA DA AUTORIZAÇÃO ASSINATURA E CARIMBO (Nº DO REGISTRO DO CONSELHO)", "CÓD. ÓRGÃO EMISSOR", "Nº DA AUTORIZAÇÃO (APAC)", "NOME DO PROFISSIONAL AUTORIZADOR", "DATA DA AUTORIZAÇÃO", "ASSINATURA E CARIMBO (Nº DO REGISTRO DO CONSELHO)", "PERÍODO DE VALIDADE DA APAC", "CARTÃO NACIONAL DE SAÚDE DO PROFISSIONAL AUTORIZADOR"]);
export function renderizarApacLaudo(template: TemplateApac, entrada: EntradaApac): ResultadoApac {
  const campos = template.campos.map((f): CampoApac => {
    if (f.tipo === "ROTULO") return { ...f, valor: "" };
    if (f.bloco === "AUTORIZAÇÃO" || EM_BRANCO.has(f.campo)) return { ...f, valor: "" };
    if (entrada.modeloEmBranco) return { ...f, valor: "" };
    let v = entrada.valores[f.id]?.trim() ?? entrada.valores[f.campo]?.trim() ?? "";
    if (f.campo === "FINALIDADE APAC") v = entrada.metadados?.finalidadeLote || "PENDENTE";
    if (f.id === "cid-principal") v = entrada.metadados?.cidLoteConfirmado || "PENDENTE";
    if (f.id === "cid-secundario") v = entrada.metadados?.cidSecundarioConfirmado || "PENDENTE";
    if (f.id === "cid-causas") v = entrada.metadados?.cidCausasConfirmado || "PENDENTE";
    if (f.id === "diagnostico-descricao") v = entrada.metadados?.diagnosticoLoteConfirmado || "PENDENTE";
    if (/proced-(principal|sec-\d)-codigo/.test(f.id) && !entrada.metadados?.temTabelaSigtap) v = "PENDENTE [VERIFICAR]";
    if (f.id.endsWith("-cnes") && !v) v = "PENDENTE [VERIFICAR]";
    if (!v) v = "PENDENTE";
    return { ...f, valor: v };
  });
  const documentId = entrada.documentId ?? template.id;
  const documentVersion = entrada.documentVersion ?? Number(template.versao.split(".")[0]);
  const hash = hashCanonico({ template, templateId: template.id, versao: template.versao, documentId, documentVersion, campos: campos.map(({ campo, valor }) => [campo, valor]) });
  const signature = entrada.assinatura;
  const signatureValid = signature?.documentId === documentId && signature.documentVersion === documentVersion && signature.documentHash === hash;
  const status = entrada.modeloEmBranco ? "MODELO_EM_BRANCO" : signatureValid ? "ASSINADO" : "RASCUNHO";
  const body = `<section class="bloco"><div class="grade">${campos.map((f, index) => `${index === 0 || campos[index - 1]?.bloco !== f.bloco ? `<h2 class="apac-bloco">${esc(f.bloco)}</h2>` : ""}${f.tipo === "ROTULO" ? `<div class="apac-rotulo apac-rotulo-${esc(f.id)}">${esc(f.campo)}</div>` : `<div class="campo campo-${esc(f.id)}"><strong>${esc(f.campo)}</strong><br>${f.valor ? esc(f.valor) : ""}</div>`}`).join("")}</div></section>`;
  const stamp = status === "RASCUNHO" ? '<div class="rascunho">RASCUNHO — NÃO VÁLIDO</div>' : status === "MODELO_EM_BRANCO" ? '<div class="rascunho">MODELO EM BRANCO</div>' : "";
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>APAC · Laudo de Solicitação / Autorização</title><style>${CSS_IMPRESSAO_A4}
@page{size:A4;margin:8mm}body{font-size:6.5pt;line-height:1.1}.documento{font-size:6.5pt}.documento>header{border:1px solid #244879;padding:2mm;margin-bottom:1mm}.documento>header h1{font-size:11pt;margin:0}.documento>header div{font-size:6pt}.grade{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:1px}.campo{grid-column:span 3;border:1px solid #8ca0bb;padding:1mm;min-height:7mm;overflow-wrap:anywhere}.campo strong{font-size:5.5pt;font-weight:normal}.apac-bloco{grid-column:1/-1;background:#244879;color:white;text-align:center;font-size:7pt;margin:1px 0;padding:1mm}.apac-rotulo{font-size:6pt;grid-column:1/-1;font-weight:bold;padding:.5mm}.apac-rotulo-sus,.apac-rotulo-sistema-unico,.apac-rotulo-ministerio{grid-column:span 4}.apac-rotulo-sexo-masc,.apac-rotulo-sexo-fem{grid-column:span 1}.apac-rotulo-celular-label-telefone,.apac-rotulo-responsavel-label-telefone{grid-column:span 1}.campo-estab-solicitante-nome,.campo-paciente-nome,.campo-paciente-endereco,.campo-justificativa-observacoes{grid-column:span 10}.campo-estab-solicitante-cnes,.campo-paciente-prontuario{grid-column:span 2}.campo-paciente-cns,.campo-profissional-solicitante,.campo-cns-profissional-solicitante,.campo-profissional-autorizador,.campo-cns-profissional-autorizador{grid-column:span 6}.campo-paciente-nascimento,.campo-paciente-sexo,.campo-paciente-raca-cor,.campo-paciente-etnia{grid-column:span 2}.campo-paciente-mae,.campo-responsavel-nome{grid-column:span 8}.campo-celular-ddd,.campo-responsavel-ddd{grid-column:span 1}.campo-celular-numero,.campo-responsavel-contato{grid-column:span 3}.campo-paciente-municipio{grid-column:span 7}.campo-paciente-ibge{grid-column:span 3}.campo-paciente-uf,.campo-paciente-cep{grid-column:span 1}.campo-proced-principal-codigo,.campo-proced-sec-1-codigo,.campo-proced-sec-2-codigo,.campo-proced-sec-3-codigo,.campo-proced-sec-4-codigo,.campo-proced-sec-5-codigo{grid-column:span 3}.campo-proced-servico,.campo-proced-class{grid-column:span 1}.campo-proced-principal-nome,.campo-proced-sec-1-nome,.campo-proced-sec-2-nome,.campo-proced-sec-3-nome,.campo-proced-sec-4-nome,.campo-proced-sec-5-nome{grid-column:span 5}.campo-proced-principal-qtde,.campo-proced-sec-1-qtde,.campo-proced-sec-2-qtde,.campo-proced-sec-3-qtde,.campo-proced-sec-4-qtde,.campo-proced-sec-5-qtde{grid-column:span 2}.campo-diagnostico-descricao{grid-column:span 6}.campo-cid-principal,.campo-cid-secundario,.campo-cid-causas{grid-column:span 2}.campo-data-solicitacao{grid-column:span 2}.campo-assinatura-solicitante{grid-column:span 4}.campo-numero-autorizacao{grid-column:span 4;min-height:20mm}.campo-periodo-validade{grid-column:span 4}.rodape{font-size:5pt}
/* Disposição por blocos do formulário: rótulos repetidos não criam linhas extras. */
.campo{margin:0;min-height:8mm;padding:1mm}.apac-rotulo{display:none}.apac-bloco:first-child{display:none}.campo-paciente-cns{grid-column:span 6}.campo-paciente-nascimento{grid-column:span 2}.campo-paciente-sexo,.campo-paciente-raca-cor{grid-column:span 1}.campo-paciente-etnia{grid-column:span 2}.campo-paciente-endereco{grid-column:1/-1}.campo-proced-principal-codigo{grid-column:span 4}.campo-proced-servico,.campo-proced-class{grid-column:span 1}.campo-proced-principal-nome{grid-column:span 5}.campo-proced-principal-qtde{grid-column:span 1}.campo-proced-sec-1-codigo,.campo-proced-sec-2-codigo,.campo-proced-sec-3-codigo,.campo-proced-sec-4-codigo,.campo-proced-sec-5-codigo{grid-column:span 4;min-height:10mm}.campo-proced-sec-1-nome,.campo-proced-sec-2-nome,.campo-proced-sec-3-nome,.campo-proced-sec-4-nome,.campo-proced-sec-5-nome{grid-column:span 7}.campo-proced-sec-1-qtde,.campo-proced-sec-2-qtde,.campo-proced-sec-3-qtde,.campo-proced-sec-4-qtde,.campo-proced-sec-5-qtde{grid-column:span 1}.campo-justificativa-observacoes{grid-column:1/-1;min-height:25mm;white-space:pre-wrap}.campo-assinatura-solicitante{grid-column:span 4;grid-row:span 2}.campo-cns-profissional-solicitante{grid-column:span 8}.campo-profissional-autorizador{grid-column:span 6}.campo-codigo-orgao-emissor{grid-column:span 2}.campo-numero-autorizacao{grid-column:span 4;grid-row:span 2}.campo-cns-profissional-autorizador{grid-column:span 8}.campo-data-autorizacao{grid-column:span 2}.campo-assinatura-autorizador{grid-column:span 4}.campo-periodo-validade{grid-column:span 6}.campo-estab-executante-nome{grid-column:span 10}.campo-estab-executante-cnes{grid-column:span 2}
</style></head><body><main id="apac" class="documento"><header><div>Ministério da Saúde · Sistema Único de Saúde — SUS</div><h1>APAC · Autorização de Procedimentos Ambulatoriais</h1><div>Laudo de Solicitação / Autorização · pg. 1/2</div></header>${stamp}${body}<footer class="rodape">id: ${esc(documentId)} · versão: ${documentVersion} · hash: ${esc(hash)}</footer></main></body></html>`;
  const motivoAssinatura = signatureValid ? "REFERENCIA_COMPATIVEL" : signature ? "ID_VERSAO_OU_HASH_DIVERGENTE" : "SEM_ASSINATURA";
  return { html, templateId: template.id, versao: template.versao, hash, campos, finalidadeLote: entrada.metadados?.finalidadeLote || "PENDENTE", status, motivoAssinatura };
}
