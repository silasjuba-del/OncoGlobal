// PROVISORIO-W10: trocar por ClinicalFact + EncounterSegment + reconciliação em src/contracts/w10/.

export interface CaixaNumerada {
  numero: number;
  nome: string;
  valor: string | null; // null = PENDENTE
}

export interface FonteExcecao {
  trecho: string;
  origem: string; // id do documento / "colar"
}

export interface ExcecaoRevisao {
  id: string;
  valor: string;
  fonte: FonteExcecao;
  /** null = sem paciente — junção só com clique (D-W9-34a). */
  patientId: string | null;
}

export interface CandidatoJunção {
  patientId: string;
  nome: string;
  prontuario: string;
}

export interface RevisaoCaixaUnica {
  origemRotulo: string;
  caixas: readonly CaixaNumerada[];
  fatosReconciliados: number;
  excecoes: readonly ExcecaoRevisao[];
  candidatos: readonly CandidatoJunção[];
  segmentoSemPaciente: boolean;
}

/** Distribuição sintética para a UI. Não é extração clínica nem junção automática. */
export function montarRevisaoSintetica(input: {
  origemRotulo: string;
  texto: string;
  patientIdAberto: string | null;
  candidatos: readonly CandidatoJunção[];
}): RevisaoCaixaUnica {
  const trecho = input.texto.trim().slice(0, 80) || "(arquivo sem texto legível)";
  const ilegivel = /escaneado|ilegivel|ilégivel/i.test(input.origemRotulo + input.texto);
  const caixas: CaixaNumerada[] = [
    { numero: 8, nome: "Identidade", valor: ilegivel ? null : "Paciente Teste (proposta)" },
    { numero: 21, nome: "Laudo / texto", valor: ilegivel ? null : trecho },
    { numero: 34, nome: "Achado estruturado", valor: ilegivel ? null : null },
  ];
  const pendentes = caixas.filter((c) => c.valor == null).length;
  const excecoes: ExcecaoRevisao[] = [];
  if (!ilegivel) {
    excecoes.push({
      id: "exc-1",
      valor: "topografia mencionada no texto",
      fonte: { trecho: trecho.slice(0, 40), origem: input.origemRotulo },
      patientId: input.patientIdAberto,
    });
  }
  // Sempre inclui um segmento órfão para exercitar D-W9-34a
  excecoes.push({
    id: "exc-orfao",
    valor: "segmento sem paciente ligado",
    fonte: { trecho: "…trecho sintético sem vínculo…", origem: input.origemRotulo },
    patientId: null,
  });
  const reconciliados = Math.max(0, caixas.length - pendentes);
  return {
    origemRotulo: input.origemRotulo,
    caixas,
    fatosReconciliados: reconciliados,
    excecoes,
    candidatos: input.candidatos,
    segmentoSemPaciente: excecoes.some((e) => e.patientId == null),
  };
}

export function resumoExcecoes(revisao: RevisaoCaixaUnica): string {
  const k = revisao.excecoes.length;
  return `✓ ${revisao.fatosReconciliados} fatos reconciliados · ⚠ ${k} precisam confirmação`;
}
