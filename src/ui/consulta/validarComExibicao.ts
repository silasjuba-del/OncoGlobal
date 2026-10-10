import type { ConfirmarBloco } from "../../contracts/operacao.js";
import type {
  PedidoBundle,
  PortaConsulta,
  ResultadoConfirmar,
} from "../api/porta.js";

/**
 * Um clique do médico: o que está na tela entra no bundle do servidor
 * (conteúdo + hash) e só então confirma. Sem segundo botão "exibir".
 */
export async function validarComExibicao(
  porta: Pick<PortaConsulta, "exibirBundle" | "confirmar">,
  pedido: PedidoBundle,
  bloco: ConfirmarBloco,
): Promise<ResultadoConfirmar> {
  await porta.exibirBundle(pedido);
  return porta.confirmar(bloco);
}

export function confirmacaoPreparouImpressao(codigo: string): boolean {
  return codigo === "GRAVADA" || codigo === "CONFIRMADO";
}
