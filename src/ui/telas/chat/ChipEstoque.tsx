import type { ChipEstoque as Chip } from "../../../modules/estoque/chip.js";

/** Informa. Não desabilita prescrever e não sugere troca. */
export function ChipEstoque({ chip }: { chip: Chip }) {
  const rotulo = chip.estado === "DISPONIVEL"
    ? "disponível"
    : chip.estado === "INDISPONIVEL"
      ? "em falta"
      : "desconhecido";
  return <p>estoque: {rotulo}</p>;
}
