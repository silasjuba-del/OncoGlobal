import { hashCanonico } from "../modules/tipos.js";
import { CSS_IMPRESSAO_A4 } from "./estilo.js";

export type OrigemTemplate = "TEXTO_FIXO" | "FATO_CONFIRMADO" | "DECISAO_MEDICA";
export interface CampoTemplate { id: string; rotulo: string; origem: OrigemTemplate; texto?: string; }
export interface SecaoKit { id: string; titulo: string; origem: OrigemTemplate; campos: readonly (string | CampoTemplate)[]; }
export interface KitTemplate {
  id: string; versao: string; header: { id: string; versao: string; vigenteDesde: string; aprovadoEm: string; curador: string; fonte: { tipo: "DECISAO_MEDICA"; referencia: string; trecho: string | null; edicao: string | null } };
  fonte: { tipo: "DECISAO_MEDICA"; referencia: "docs/referencias/kit-oncologia-2026-05.pdf"; pagina: number };
  secoes: readonly SecaoKit[]; proibidoConter: readonly string[];
  textoFonteOriginal?: string;
  itensReceita?: readonly { id: string; medicamento: string; dose: string; orientacao: string; via: "ORAL" | "ENDOVENOSA / PRONTO ATENDIMENTO" }[];
  exames?: readonly string[];
  gradeExames?: { ciclos: readonly number[]; adicionaisLivres: boolean };
  avisoVerificacao?: string;
}
export interface CabecalhoInstitucional { nomeInstituicao: string; linha2: string; cidadeUf: string; exemplo?: boolean; }
export interface PerfilMedico { nome: string; crm: string; rqes?: readonly string[]; }
export interface IdentificacaoPaciente { nome?: string; nasc?: string; cidade?: string; idade?: string; cpf?: string; cid?: string; }
export interface ExameCiclo { exame: string; ciclos: readonly [boolean, boolean, boolean, boolean]; }
export interface EntradaKit {
  documentId?: string; documentVersion?: number;
  cabecalho: CabecalhoInstitucional; medico: PerfilMedico; paciente: IdentificacaoPaciente;
  valores?: Readonly<Record<string, string | undefined>>; itensSelecionados?: readonly string[];
  exames?: readonly ExameCiclo[]; examesAdicionais?: readonly string[];
  prazoAfastamento?: string; dataInicioAfastamento?: string; dataImpressao?: string;
  datasCiclos?: readonly [string?, string?, string?, string?];
  modeloEmBranco?: boolean; assinatura?: { documentId: string; documentVersion: number; documentHash: string } | null;
  alertasOperacionais?: readonly string[]; folhaOperacionalSalao?: boolean;
  verificacaoAcentuacao?: { necessaria: true; fonte: string };
}
export interface ResultadoImpressaoKit { html: string; templateId: string; versao: string; hash: string; status: "ASSINADO" | "RASCUNHO" | "MODELO_EM_BRANCO"; motivoAssinatura: "REFERENCIA_COMPATIVEL" | "SEM_ASSINATURA" | "ID_VERSAO_OU_HASH_DIVERGENTE"; verificacaoAcentuacao?: { necessaria: true; fonte: string }; }

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c]!);
const p = (name: string, value?: string): string => `<div class="campo"><strong>${esc(name)}:</strong> ${value ? esc(value) : '<span class="pendente">PENDENTE</span>'}</div>`;
const cabecalho = (i: EntradaKit): string => `<header class="cabecalho"><strong>${esc(i.cabecalho.nomeInstituicao)}</strong><div>${esc(i.cabecalho.linha2)}</div><div>${esc(i.cabecalho.cidadeUf)}</div>${i.cabecalho.exemplo ? '<div class="aviso-configuracao">Cabeçalho de exemplo: altere nas configurações.</div>' : ''}<div class="medico">${esc(i.medico.nome)} · ${esc(i.medico.crm)}${i.medico.rqes?.length ? ` · ${i.medico.rqes.map(esc).join(" · ")}` : ""}</div></header>`;
const identificacao = (i: EntradaKit, templateId: string): string => {
  if (i.modeloEmBranco) return '<section><h2>IDENTIFICAÇÃO</h2><div>NOME: ________________________________</div><div>NASC.: ____/____/________</div><div>CIDADE: _____________________________</div><div>IDADE: ______</div></section>';
  return `<section><h2>IDENTIFICAÇÃO</h2>${p("NOME", i.paciente.nome)}${p("NASC.", i.paciente.nasc)}${p("CIDADE", i.paciente.cidade)}${p("IDADE", i.paciente.idade)}${templateId === "relatorio-pericial" ? `${p("CPF", i.paciente.cpf)}${p("CID", i.paciente.cid)}` : ""}</section>`;
};
function corpo(template: KitTemplate, i: EntradaKit): string {
  const docId = template.id;
  const top = `<h1>${esc(template.secoes[0]?.titulo ?? docId)}</h1>${identificacao(i, docId)}`;
  function textoConfiguravel(original: string): string {
    let text = original
      .replace(/Hospital do Bem - Unidade Oncológica - Patos\/PB \| Documento médico para impressão/g, `${i.cabecalho.nomeInstituicao} | Documento médico para impressão`)
      .replace(/Hospital do\s+Bem - Unidade Oncológica, Patos\/PB/g, `${i.cabecalho.nomeInstituicao}, ${i.cabecalho.cidadeUf}`)
      .replace(/Dr\. Silas Negrão Serra Jr\. - CRM-PB 17341/g, `${i.medico.nome} - ${i.medico.crm}`)
      .replace(/RQE Oncologia Clínica 9099 \| RQE Clínica Médica 9098/g, (i.medico.rqes ?? []).join(" | "));
    if (!i.modeloEmBranco) {
      const patientFields: readonly [RegExp, string, string | undefined][] = [
        [/NOME:\s*_+/g, "NOME", i.paciente.nome], [/NASC\.?:\s*[_/]+/g, "NASC.", i.paciente.nasc],
        [/CIDADE:\s*_+/g, "CIDADE", i.paciente.cidade], [/IDADE:\s*_+/g, "IDADE", i.paciente.idade],
        [/CPF:\s*_+/g, "CPF", i.paciente.cpf], [/CID:\s*_+/g, "CID", i.paciente.cid],
      ];
      for (const [pattern, label, value] of patientFields) text = text.replace(pattern, `${label}: ${value || "PENDENTE"}`);
      text = text.replace(/Data: ____\/____\/________/g, `Data: ${i.dataImpressao || "PENDENTE"}`);
    }
    if (docId === "relatorio-pericial") {
      const prazo = i.prazoAfastamento || "PENDENTE";
      text = text.replace(/Afastamento sugerido por 6 meses, passível/g, `Afastamento sugerido por ${prazo}, passível`)
        .replace(/afastamento das atividades laborais por 6 \(seis\) meses/g, `afastamento das atividades laborais por ${prazo}`)
        .replace(/a\s+contar de ____\/____\/________/g, `a contar de ${i.dataInicioAfastamento || "PENDENTE"}`);
    }
    return text;
  }
  if (docId === "receita-sintomaticos") {
    const text = String(template.secoes[0]?.campos.find((c): c is CampoTemplate => typeof c !== "string")?.texto ?? "");
    const selected = (template.itensReceita ?? []).filter(x => i.itensSelecionados?.includes(x.id));
    const table = (via: "ORAL" | "ENDOVENOSA / PRONTO ATENDIMENTO") => selected.filter(x => x.via === via).map(x => `<tr><td>${esc(x.medicamento)}</td><td>${esc(x.dose)}</td><td>${esc(x.orientacao)}</td></tr>`).join("");
    const noteStart = text.indexOf("Medicações de apoio");
    const noteEnd = text.indexOf("VIA ORAL");
    const note = noteStart >= 0 && noteEnd > noteStart ? `<div class="texto-fixo">${esc(textoConfiguravel(text.slice(noteStart, noteEnd).trim()))}</div>` : "";
    const observation = text.includes("OBSERVAÇÃO AO MÉDICO PLANTONISTA") ? text.slice(text.indexOf("OBSERVAÇÃO AO MÉDICO PLANTONISTA")) : "";
    const fixed = i.modeloEmBranco ? "" : `<div class="texto-fixo">${esc(textoConfiguravel(observation))}</div>`;
    return `${top}${note}<h2>VIA ORAL</h2><table class="grade"><thead><tr><th>MEDICAMENTO</th><th>DOSE</th><th>ORIENTAÇÃO</th></tr></thead><tbody>${table("ORAL")}</tbody></table><h2>VIA ENDOVENOSA / PRONTO ATENDIMENTO</h2><table class="grade"><thead><tr><th>MEDICAMENTO</th><th>DOSE</th><th>ORIENTAÇÃO</th></tr></thead><tbody>${table("ENDOVENOSA / PRONTO ATENDIMENTO")}</tbody></table>${fixed}`;
  }
  if (docId === "requisicao-exames-ciclos") {
    const source = String(template.secoes[0]?.campos.find((c): c is CampoTemplate => typeof c !== "string")?.texto ?? "");
    const tableStart = source.indexOf("\nEXAME\n");
    const dataStart = source.lastIndexOf("\nData: ____/____/________");
    const intro = tableStart >= 0 ? source.slice(0, tableStart) : "";
    const closing = dataStart >= 0 ? source.slice(dataStart + 1) : "";
    const selectedByName = new Map((i.modeloEmBranco ? [] : i.exames ?? []).map(x => [x.exame, x.ciclos]));
    const names = template.exames ?? (i.exames ?? []).map(x => x.exame);
    const rows = names.map(exame => `<tr><td>${esc(exame)}</td>${(selectedByName.get(exame) ?? [false, false, false, false]).map(v => `<td>${v ? "☒" : "☐"}</td>`).join("")}</tr>`).join("");
    const extra = i.examesAdicionais ?? ["", "", "", "", "", "", ""];
    const cycleHeads = [1, 2, 3, 4].map(n => `<th>CICLO ${n}<br>Data: ${esc(i.datasCiclos?.[n - 1] || (i.modeloEmBranco ? "___/___/___" : "PENDENTE"))}</th>`).join("");
    const added = `<section><h2>EXAMES ADICIONAIS / OBSERVACOES</h2><table class="grade"><thead><tr><th>EXAME</th>${cycleHeads}</tr></thead><tbody>${extra.map(x => `<tr><td>${x ? esc(x) : "____________________________"}</td><td>☐</td><td>☐</td><td>☐</td><td>☐</td></tr>`).join("")}</tbody></table></section>`;
    return `${top}<div class="texto-fixo">${esc(textoConfiguravel(intro))}</div><table class="grade"><thead><tr><th>EXAME</th>${cycleHeads}</tr></thead><tbody>${rows}</tbody></table>${added}<div class="texto-fixo">${esc(textoConfiguravel(closing))}</div>`;
  }
  const sections = template.secoes.map(s => `<section class="bloco"><h2>${esc(s.titulo)}</h2>${s.campos.map(c => typeof c === "string" ? `<p>${esc(c)}</p>` : c.texto !== undefined ? `<div class="texto-fixo">${esc(textoConfiguravel(c.texto))}</div>` : p(c.rotulo, i.valores?.[c.id])).join("")}</section>`).join("");
  return `${top}${sections}`;
}

export function renderizarKit(template: KitTemplate, entrada: EntradaKit): ResultadoImpressaoKit {
  const base = { template, templateId: template.id, versao: template.versao, documentId: entrada.documentId ?? template.id, documentVersion: entrada.documentVersion ?? Number(template.versao.split(".")[0]), cabecalho: entrada.cabecalho, medico: entrada.medico, paciente: entrada.paciente, dataImpressao: entrada.dataImpressao ?? "", valores: entrada.valores ?? {}, itensSelecionados: entrada.itensSelecionados ?? [], exames: entrada.exames ?? [], examesAdicionais: entrada.examesAdicionais ?? [], datasCiclos: entrada.datasCiclos ?? [], prazo: entrada.prazoAfastamento ?? "", inicio: entrada.dataInicioAfastamento ?? "", modeloEmBranco: entrada.modeloEmBranco === true };
  const hash = hashCanonico(base);
  const assinaturaOk = entrada.assinatura?.documentId === base.documentId && entrada.assinatura.documentVersion === base.documentVersion && entrada.assinatura.documentHash === hash;
  const status = entrada.modeloEmBranco ? "MODELO_EM_BRANCO" : assinaturaOk ? "ASSINADO" : "RASCUNHO";
  const alerta = template.id === "folha-operacional-salao" && entrada.folhaOperacionalSalao ? (entrada.alertasOperacionais ?? []).map(a => `<div class="operacional">${esc(a)}</div>`).join("") : "";
  const stamp = status === "RASCUNHO" ? '<div class="rascunho">RASCUNHO — NÃO VÁLIDO</div>' : status === "MODELO_EM_BRANCO" ? '<div class="rascunho">MODELO EM BRANCO</div>' : "";
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(template.id)}</title><style>${CSS_IMPRESSAO_A4}</style></head><body><main class="documento">${cabecalho(entrada)}${stamp}${corpo(template, entrada)}${alerta}<footer class="rodape">id: ${esc(base.documentId)} · versão: ${base.documentVersion} · hash: ${esc(hash)}</footer></main></body></html>`;
  const motivoAssinatura = assinaturaOk ? "REFERENCIA_COMPATIVEL" : entrada.assinatura ? "ID_VERSAO_OU_HASH_DIVERGENTE" : "SEM_ASSINATURA";
  return { html, templateId: template.id, versao: template.versao, hash, status, motivoAssinatura, ...(entrada.verificacaoAcentuacao ? { verificacaoAcentuacao: entrada.verificacaoAcentuacao } : {}) };
}
