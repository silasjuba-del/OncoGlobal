/** Only these fixed labels can leave the machine. No matched substring, number,
 * source identifier, order, repetition count or unknown token is copied out.
 * This is a reduced document-organization signal, not the clinical document.
 */
const MARCADORES = [
  ["Hemograma", /\bhemograma\b/], ["Creatinina", /\bcreatinina\b/],
  ["Laboratorio", /\b(?:laboratorio|laboratorial|hemoglobina|plaquetas|leucocitos)\b/],
  ["Tomografia", /\b(?:tomografia|tc)\b/], ["Ressonancia", /\b(?:ressonancia|rm)\b/],
  ["Ultrassonografia", /\b(?:ultrassonografia|ultrassom)\b/],
  ["Radiografia", /\b(?:radiografia|raio x)\b/],
  ["Anatomopatologico", /\b(?:anatomopatologico|histopatologico|imuno-histoquimica)\b/],
  ["Biopsia", /\bbiopsia\b/], ["Evolucao", /\b(?:evolucao|anamnese)\b/],
  ["Consulta", /\bconsulta\b/], ["Prescricao", /\b(?:prescricao|receituario)\b/],
] as const;

export function marcadoresDocumentoJev(texto: string): string | null {
  const normalizado = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const sinais = MARCADORES.filter(([, regra]) => regra.test(normalizado)).map(([rotulo]) => rotulo);
  return sinais.length ? `Marcadores documentais (vocabulário fechado): ${sinais.join(", ")}.` : null;
}
