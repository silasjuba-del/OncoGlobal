import type { EstadoFarmacia, AcaoFarmacia, AtorFarmacia, EventoFarmacia, RegistroFarmacia, PedidoFarmacia, ErroFarmacia, ResultadoFarmacia } from '../../contracts/api/farmacia.js';
export type { EstadoFarmacia, AcaoFarmacia, AtorFarmacia, EventoFarmacia, RegistroFarmacia, PedidoFarmacia, ErroFarmacia, ResultadoFarmacia } from '../../contracts/api/farmacia.js';
import { ESTADOS_FARMACIA } from '../../contracts/api/farmacia.js';
export { ESTADOS_FARMACIA } from '../../contracts/api/farmacia.js';
// GRK-06 · D9. Farmácia não edita. Transição inválida devolve erro tipado e não trava o médico.

















export function registroEnviado(conteudoPrescricaoId: string): RegistroFarmacia {
  return { conteudoPrescricaoId, estado: "ENVIADA", historico: [] };
}

export function transicionarFarmacia(registro: RegistroFarmacia, pedido: PedidoFarmacia): ResultadoFarmacia {
  if (pedido.acao === "EDITAR") {
    return falha(registro, "FARMACIA_NAO_EDITA", "farmácia não edita a prescrição");
  }

  const destino = destinoDe(registro.estado, pedido);
  if (destino === null) {
    return falha(
      registro,
      "TRANSICAO_INVALIDA",
      `${pedido.ator} não pode ${pedido.acao} a partir de ${registro.estado}`,
    );
  }

  const motivo = pedido.acao === "PEDIR_CORRECAO" ? pedido.motivo : null;
  return {
    ok: true,
    bloqueiaMedico: false,
    erro: null,
    registro: {
      conteudoPrescricaoId: registro.conteudoPrescricaoId,
      estado: destino,
      historico: [...registro.historico, {
        ator: pedido.ator,
        acao: pedido.acao,
        estadoResultante: destino,
        motivo,
      }],
    },
  };
}

function destinoDe(estado: EstadoFarmacia, pedido: PedidoFarmacia): EstadoFarmacia | null {
  if (pedido.ator === "FARMACIA" && pedido.acao === "CONFERIR" && estado === "ENVIADA") return "CONFERIDA";
  if (pedido.ator === "FARMACIA" && pedido.acao === "PEDIR_CORRECAO" && estado === "ENVIADA") {
    return pedido.motivo.trim().length > 0 ? "CORRECAO_PEDIDA" : null;
  }
  if (pedido.ator === "MEDICO" && pedido.acao === "ACEITAR" && estado === "CORRECAO_PEDIDA") return "ACEITA";
  // Recusa não apaga o histórico nem troca o conteúdo: o estado pedido permanece visível.
  if (pedido.ator === "MEDICO" && pedido.acao === "RECUSAR" && estado === "CORRECAO_PEDIDA") return "CORRECAO_PEDIDA";
  return null;
}

function falha(registro: RegistroFarmacia, codigo: ErroFarmacia["codigo"], mensagem: string): ResultadoFarmacia {
  return {
    ok: false,
    bloqueiaMedico: false,
    erro: { codigo, mensagem },
    registro: {
      conteudoPrescricaoId: registro.conteudoPrescricaoId,
      estado: registro.estado,
      historico: [...registro.historico],
    },
  };
}
