// W11-H13 · elegibilidade de ciclo: cruzamento puro. Verde nunca é liberação; ausente nunca é verde; sem amarelo.
import { describe, expect, it } from "vitest";
import {
  elegibilidadeCiclo,
  type EntradasElegibilidadeCiclo,
  type SinalElegibilidade,
} from "../../src/rules/elegibilidadeCiclo.js";

const verde: SinalElegibilidade = { estado: "VERDE", motivos: [] };
const pendente: SinalElegibilidade = { estado: "PENDENTE", motivos: [{ texto: "hemograma ausente" }] };
const vermelho: SinalElegibilidade = { estado: "VERMELHO", motivos: [{ texto: "ANC abaixo do limiar de bula" }] };
const moderada: SinalElegibilidade = {
  estado: "VERDE",
  motivos: [{ texto: "interação com varfarina", nivel: "atencao" }],
};

function todasVerdes(): EntradasElegibilidadeCiclo {
  return {
    portaCiclo: verde,
    triagem: verde,
    ctcae: verde,
    interacoes: verde,
    plaquetas: verde,
    funcaoOrganica: verde,
  };
}

const PALAVRAS_PROIBIDAS = /liber|aprov|apto/i;

describe("elegibilidade de ciclo (cruzamento sem amarelo)", () => {
  it("todas verdes resultam em VERDE com rótulo neutro, sem liberação", () => {
    const saida = elegibilidadeCiclo(todasVerdes());
    expect(saida.cor).toBe("VERDE");
    expect(saida.rotulo).toBe("sem impedimento identificado");
    expect(saida.rotulo).not.toMatch(PALAVRAS_PROIBIDAS);
    expect(saida.motivos).toEqual([]);
  });

  it("uma entrada pendente sem nenhuma vermelha resulta em PENDENTE", () => {
    const saida = elegibilidadeCiclo({ ...todasVerdes(), triagem: pendente });
    expect(saida.cor).toBe("PENDENTE");
    expect(saida.motivos).toEqual([{ origem: "triagem", texto: "hemograma ausente" }]);
  });

  it("entrada ausente (null) nunca vira verde: resulta em PENDENTE", () => {
    const saida = elegibilidadeCiclo({ ...todasVerdes(), ctcae: null });
    expect(saida.cor).toBe("PENDENTE");
    expect(saida.motivos).toEqual([{ origem: "ctcae", texto: "dado ausente para esta entrada" }]);
  });

  it("uma vermelha somada a uma pendente resulta em VERMELHO", () => {
    const saida = elegibilidadeCiclo({ ...todasVerdes(), portaCiclo: vermelho, plaquetas: pendente });
    expect(saida.cor).toBe("VERMELHO");
    expect(saida.rotulo).toBe("revisar pelo médico");
    expect(saida.motivos.map((m) => m.origem)).toEqual(["portaCiclo", "plaquetas"]);
  });

  it("interação moderada/atenção vira VERMELHO com o nível no texto", () => {
    const saida = elegibilidadeCiclo({ ...todasVerdes(), interacoes: moderada });
    expect(saida.cor).toBe("VERMELHO");
    expect(saida.motivos).toEqual([
      { origem: "interacoes", texto: "interação com varfarina (nível: atenção (moderada))", nivel: "atencao" },
    ]);
  });

  it("intercorrência opcional: omitida não altera o resultado; informada segue as mesmas regras", () => {
    expect(elegibilidadeCiclo(todasVerdes()).cor).toBe("VERDE");
    expect(elegibilidadeCiclo({ ...todasVerdes(), intercorrencia: null }).cor).toBe("PENDENTE");
    expect(elegibilidadeCiclo({ ...todasVerdes(), intercorrencia: vermelho }).cor).toBe("VERMELHO");
  });

  it("nenhuma saída contém AMARELO e nenhuma cor fora do conjunto de 3", () => {
    const casos: EntradasElegibilidadeCiclo[] = [
      todasVerdes(),
      { ...todasVerdes(), triagem: pendente },
      { ...todasVerdes(), portaCiclo: vermelho, plaquetas: pendente },
      { ...todasVerdes(), interacoes: moderada },
    ];
    for (const caso of casos) {
      const saida = elegibilidadeCiclo(caso);
      expect(JSON.stringify(saida)).not.toMatch(/AMARELO/i);
      expect(["VERDE", "VERMELHO", "PENDENTE"]).toContain(saida.cor);
    }
  });

  it("é determinística: mesma entrada, mesma saída", () => {
    const entrada = { ...todasVerdes(), triagem: pendente, interacoes: moderada };
    expect(elegibilidadeCiclo(entrada)).toEqual(elegibilidadeCiclo(entrada));
  });

  it("é pura: não altera a entrada", () => {
    const entrada = { ...todasVerdes(), triagem: pendente, interacoes: moderada };
    const copia = JSON.parse(JSON.stringify(entrada));
    elegibilidadeCiclo(entrada);
    expect(entrada).toEqual(copia);
  });
});
