export interface TarefaBasalC1 {
  id: "ECO_BASAL" | "AUDIOMETRIA_BASAL";
  texto: string;
  bloqueiaSalvar: false;
}

function chave(nome: string): string {
  return nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Tarefa do C1. Não bloqueia salvar e não dispensa o exame que já estiver no prontuário. */
export function preRequisitosC1(farmacos: readonly string[], numeroCiclo: number | null): TarefaBasalC1[] {
  if (numeroCiclo !== 1) return [];
  const nomes = farmacos.map(chave);
  const cardio = nomes.some((n) => /doxor|epirub|daunor|idarub|trastuz|pertuz|ado-trastuz|tucatinibe|lapatinib|neratinib|margetux/.test(n) || n.includes("anti-her2") || n.includes("antraciclina"));
  const platina = nomes.some((n) => n.includes("cisplatina") || n.includes("carboplatina"));
  const tarefas: TarefaBasalC1[] = [];
  if (cardio) tarefas.push({ id: "ECO_BASAL", texto: "C1 com antraciclina ou anti-HER2: registrar o eco basal antes de seguir", bloqueiaSalvar: false });
  if (platina) tarefas.push({ id: "AUDIOMETRIA_BASAL", texto: "C1 com platina: registrar a audiometria basal antes de seguir", bloqueiaSalvar: false });
  return tarefas;
}
