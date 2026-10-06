import { describe, expect, it } from "vitest";
import {
  deduplicarExames,
  gerarChaveDedupe,
  type EntradaExameDedupe,
} from "../../src/rules/w8/dedupeExame.js";

describe("AG-04 · Deduplicação de exame (lições D1–D3)", () => {
  it("D1: mesma cintilografia em duas páginas idênticas vira 1 exame único", () => {
    const p1: EntradaExameDedupe = {
      id: "cintilo-p1",
      tipo: "IMAGEM",
      servico: "MedNuclear",
      registro: "MN-9988",
      dataExame: "2026-03-12",
      conteudoHash: "hash-cintilo-123",
      conclusao: "Sem lesões neoplásicas secundárias",
      pagina: 7,
    };
    const p2: EntradaExameDedupe = {
      ...p1,
      id: "cintilo-p2",
      pagina: 8,
    };

    const res = deduplicarExames([p1, p2]);
    expect(res.totalPaginasOuEntradas).toBe(2);
    expect(res.totalExamesUnicos).toBe(1);
    expect(res.duplicatasDetectadas).toHaveLength(1);
    expect(res.duplicatasDetectadas[0]!.idsDuplicados).toEqual(["cintilo-p2"]);
    expect(res.conflitos).toHaveLength(0);
  });

  it("D2: IHQ original e reimpressão SISREG (outra data no topo) geram a mesma chave e viram 1 exame", () => {
    const ihqOriginal: EntradaExameDedupe = {
      id: "ihq-orig",
      tipo: "PATOLOGIA_IHQ",
      laboratorio: "LabOnco",
      numeroExame: "IHQ-4455",
      dataEntrada: "2026-02-15",
      conteudoHash: "hash-ihq-abc",
      conclusao: "Adenocarcinoma de próstata",
      pagina: 10,
    };
    const ihqSisreg: EntradaExameDedupe = {
      id: "ihq-sisreg",
      tipo: "PATOLOGIA_IHQ",
      laboratorio: "LabOnco",
      numeroExame: "IHQ-4455",
      dataEntrada: "2026-02-15", // data clínica de entrada idêntica
      conteudoHash: "hash-ihq-abc",
      conclusao: "Adenocarcinoma de próstata",
      pagina: 11,
    };

    expect(gerarChaveDedupe(ihqOriginal)).toBe(gerarChaveDedupe(ihqSisreg));

    const res = deduplicarExames([ihqOriginal, ihqSisreg]);
    expect(res.totalExamesUnicos).toBe(1);
    expect(res.duplicatasDetectadas).toHaveLength(1);
  });

  it("D3: AP de RTU e conclusão da IHQ repetem diagnóstico: exames distintos com concordância", () => {
    const rtu: EntradaExameDedupe = {
      id: "ap-rtu",
      tipo: "PATOLOGIA_IHQ",
      laboratorio: "LabOnco",
      numeroExame: "AP-1020",
      dataEntrada: "2026-01-20",
      conteudoHash: "hash-rtu-01",
      conclusao: "Adenocarcinoma acinar de próstata",
      pagina: 9,
    };
    const ihq: EntradaExameDedupe = {
      id: "ihq-orig",
      tipo: "PATOLOGIA_IHQ",
      laboratorio: "LabOnco",
      numeroExame: "IHQ-4455",
      dataEntrada: "2026-02-15",
      conteudoHash: "hash-ihq-abc",
      conclusao: "Adenocarcinoma acinar de próstata",
      pagina: 10,
    };

    const res = deduplicarExames([rtu, ihq]);
    expect(res.totalExamesUnicos).toBe(2);
    expect(res.concordancias).toHaveLength(1);
    expect(res.concordancias[0]!.conclusaoComum).toBe("Adenocarcinoma acinar de próstata");
  });

  it("conflito VERMELHO se a mesma chave apresentar conteúdos discordantes", () => {
    const versaoA: EntradaExameDedupe = {
      id: "laudo-v1",
      tipo: "IMAGEM",
      servico: "Radiologia",
      registro: "RM-101",
      dataExame: "2026-02-10",
      conteudoHash: "hash-versao-1",
      conclusao: "PIRADS 4",
    };
    const versaoB: EntradaExameDedupe = {
      id: "laudo-v2",
      tipo: "IMAGEM",
      servico: "Radiologia",
      registro: "RM-101",
      dataExame: "2026-02-10",
      conteudoHash: "hash-versao-2", // divergente!
      conclusao: "PIRADS 5",
    };

    const res = deduplicarExames([versaoA, versaoB]);
    expect(res.conflitos).toHaveLength(1);
    expect(res.conflitos[0]!.estado).toBe("VERMELHO");
    expect(res.conflitos[0]!.idsEmConflito).toEqual(["laudo-v1", "laudo-v2"]);
  });

  it("Aceite Caso 07: 8 páginas de exame resultam exatamente em 6 exames únicos", () => {
    const paginasCaso07: EntradaExameDedupe[] = [
      // 1. Biópsia Lobo Direito (página 4)
      {
        id: "bx-dir",
        tipo: "PATOLOGIA_IHQ",
        laboratorio: "LabPat",
        numeroExame: "BX-2026-A",
        dataEntrada: "2026-02-01",
        conteudoHash: "hash-bx-d",
        conclusao: "Adenocarcinoma acinar",
        pagina: 4,
      },
      // 2. Biópsia Lobo Esquerdo (página 5)
      {
        id: "bx-esq",
        tipo: "PATOLOGIA_IHQ",
        laboratorio: "LabPat",
        numeroExame: "BX-2026-B",
        dataEntrada: "2026-02-01",
        conteudoHash: "hash-bx-e",
        conclusao: "Adenocarcinoma acinar",
        pagina: 5,
      },
      // 3. RM de Próstata (página 6)
      {
        id: "rm-pros",
        tipo: "IMAGEM",
        servico: "DDI-Hospital",
        registro: "RM-7766",
        dataExame: "2026-02-20",
        conteudoHash: "hash-rm",
        conclusao: "Lesão em zona periférica",
        pagina: 6,
      },
      // 4. Cintilografia óssea (página 7)
      {
        id: "cintilo-p7",
        tipo: "IMAGEM",
        servico: "CintiloCentro",
        registro: "CO-1122",
        dataExame: "2026-03-01",
        conteudoHash: "hash-cintilo-dupla",
        conclusao: "Captação articular degenerativa, sem metástases",
        pagina: 7,
      },
      // 5. Cintilografia óssea duplicada (página 8)
      {
        id: "cintilo-p8",
        tipo: "IMAGEM",
        servico: "CintiloCentro",
        registro: "CO-1122",
        dataExame: "2026-03-01",
        conteudoHash: "hash-cintilo-dupla",
        conclusao: "Captação articular degenerativa, sem metástases",
        pagina: 8,
      },
      // 6. AP de RTU de próstata (página 9)
      {
        id: "ap-rtu",
        tipo: "PATOLOGIA_IHQ",
        laboratorio: "LabPat",
        numeroExame: "RTU-8899",
        dataEntrada: "2026-03-05",
        conteudoHash: "hash-rtu",
        conclusao: "Adenocarcinoma em fragmentos de RTU",
        pagina: 9,
      },
      // 7. IHQ original (página 10)
      {
        id: "ihq-p10",
        tipo: "PATOLOGIA_IHQ",
        laboratorio: "LabPat",
        numeroExame: "IHQ-3344",
        dataEntrada: "2026-03-06",
        conteudoHash: "hash-ihq-dupla",
        conclusao: "Perfil compatível com adenocarcinoma",
        pagina: 10,
      },
      // 8. IHQ reimpressão SISREG (página 11)
      {
        id: "ihq-p11",
        tipo: "PATOLOGIA_IHQ",
        laboratorio: "LabPat",
        numeroExame: "IHQ-3344",
        dataEntrada: "2026-03-06",
        conteudoHash: "hash-ihq-dupla",
        conclusao: "Perfil compatível com adenocarcinoma",
        pagina: 11,
      },
    ];

    const resultado = deduplicarExames(paginasCaso07);
    expect(resultado.totalPaginasOuEntradas).toBe(8);
    expect(resultado.totalExamesUnicos).toBe(6);
    expect(resultado.duplicatasDetectadas).toHaveLength(2);
    expect(resultado.conflitos).toHaveLength(0);
  });
});
