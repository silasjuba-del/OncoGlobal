import { describe, expect, it } from "vitest";
import {
  agregarCaso,
  calcularGrupoGrauISUP,
  validarSitioPatologia,
  type EntradaSitioPatologia,
} from "../../src/rules/w8/patologiaSitio.js";

describe("AG-07 · Patologia por sítio e validação ISUP (lições P1–P3)", () => {
  it("valida tabela canônica de conversão Gleason -> Grupo de Grau ISUP 2014/OMS [VERIFICAR edição]", () => {
    expect(calcularGrupoGrauISUP(3, 3)).toBe(1);
    expect(calcularGrupoGrauISUP(3, 4)).toBe(2);
    expect(calcularGrupoGrauISUP(4, 3)).toBe(3);
    expect(calcularGrupoGrauISUP(4, 4)).toBe(4);
    expect(calcularGrupoGrauISUP(3, 5)).toBe(4);
    expect(calcularGrupoGrauISUP(4, 5)).toBe(5);
    expect(calcularGrupoGrauISUP(5, 5)).toBe(5);
  });

  it("aprova sítio com percentuais Gleason somando 100% e ISUP consistente", () => {
    const sitio: EntradaSitioPatologia = {
      sitio: "Lobo direito - terço médio",
      lateralidade: "DIREITA",
      posicao: "TERCO_MEDIO",
      fragmentosComprometidos: 2,
      fragmentosAvaliados: 2,
      percentuaisGleason: [70, 30],
      gleasonPrimario: 3,
      gleasonSecundario: 4,
      grupoGrauISUP: 2,
      padraoCribriforme: "ausente", // negação preservada por sítio
    };

    const res = validarSitioPatologia(sitio);
    expect(res.valido).toBe(true);
    expect(res.conflito).toBe(false);
    expect(res.estado).toBe("VERDE");
  });

  it("detecta conflito VERMELHO se soma dos percentuais Gleason diferir de 100%", () => {
    const sitio: EntradaSitioPatologia = {
      sitio: "Lobo esquerdo - ápice",
      percentuaisGleason: [50, 40], // soma 90%
      gleasonPrimario: 3,
      gleasonSecundario: 3,
      grupoGrauISUP: 1,
    };

    const res = validarSitioPatologia(sitio);
    expect(res.valido).toBe(false);
    expect(res.conflito).toBe(true);
    expect(res.estado).toBe("VERMELHO");
    expect(res.motivo).toContain("diverge de 100%");
  });

  it("detecta conflito VERMELHO se Grupo de Grau ISUP do laudo divergir do padrão Gleason", () => {
    const sitio: EntradaSitioPatologia = {
      sitio: "Lobo direito - base",
      gleasonPrimario: 3,
      gleasonSecundario: 4, // Esperado ISUP 2
      grupoGrauISUP: 3, // Inconsistente!
    };

    const res = validarSitioPatologia(sitio);
    expect(res.valido).toBe(false);
    expect(res.conflito).toBe(true);
    expect(res.estado).toBe("VERMELHO");
    expect(res.motivo).toContain("inconsistência histológica");
    expect(res.isupEsperado).toBe(2);
  });

  it("P1: preserva negação e cribriforme por sítio em biópsia de 6 fragmentos do Caso 07", () => {
    const sitiosCaso07: EntradaSitioPatologia[] = [
      { sitio: "LD Base", gleasonPrimario: 3, gleasonSecundario: 3, grupoGrauISUP: 1, padraoCribriforme: "ausente" },
      { sitio: "LD Médio", gleasonPrimario: 3, gleasonSecundario: 4, grupoGrauISUP: 2, padraoCribriforme: "ausente" },
      { sitio: "LD Ápice", gleasonPrimario: 3, gleasonSecundario: 4, grupoGrauISUP: 2, padraoCribriforme: "presente" }, // Único presente!
      { sitio: "LE Base", gleasonPrimario: 3, gleasonSecundario: 3, grupoGrauISUP: 1, padraoCribriforme: "ausente" },
      { sitio: "LE Médio", gleasonPrimario: 3, gleasonSecundario: 3, grupoGrauISUP: 1, padraoCribriforme: "ausente" },
      { sitio: "LE Ápice", gleasonPrimario: 3, gleasonSecundario: 3, grupoGrauISUP: 1, padraoCribriforme: "ausente" },
    ];

    for (const s of sitiosCaso07) {
      const v = validarSitioPatologia(s);
      expect(v.valido).toBe(true);
      expect(v.estado).toBe("VERDE");
    }
  });

  it("P2: agregarCaso retorna PENDENTE enquanto ruleset patologia-agregacao estiver inativo", () => {
    const sitios: EntradaSitioPatologia[] = [
      { sitio: "LD Médio", grupoGrauISUP: 2, padraoCribriforme: "ausente" },
      { sitio: "LD Ápice", grupoGrauISUP: 2, padraoCribriforme: "presente" },
    ];

    // Sem ruleset
    const resSem = agregarCaso(sitios);
    expect(resSem.estado).toBe("PENDENTE");
    expect(resSem.grauDoCaso).toBeNull();
    expect(resSem.cribriformeNoCaso).toBeNull();
    expect(resSem.motivo).toContain("ruleset patologia-agregacao inativo");

    // Com ruleset inativo
    const resInativo = agregarCaso(sitios, { ativo: false });
    expect(resInativo.estado).toBe("PENDENTE");
    expect(resInativo.grauDoCaso).toBeNull();

    // Se o ruleset estivesse ativo (teste de integridade da regra)
    const resAtivo = agregarCaso(sitios, { ativo: true });
    expect(resAtivo.estado).toBe("VERDE");
    expect(resAtivo.grauDoCaso).toBe(2);
    expect(resAtivo.cribriformeNoCaso).toBe("presente");
  });
});
