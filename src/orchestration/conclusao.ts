import { VisaoIntegrada } from "../contracts/f1/visaoIntegrada.js";
import type { DiagnosticoConclusao, Plano, PoliticaConclusao, ResultadoPasso } from "./tipos.js";

export function politicaConclusao(plano: Plano): PoliticaConclusao {
  return plano.conclusao ?? (plano.passos.some(p => p.id === "RECONCILIADOR")
    ? { tipo: "RECONCILIADOR", passoId: "RECONCILIADOR" }
    : { tipo: "ALGUM_TERMINAL" });
}

export function validarConclusao(plano: Plano): void {
  const politica = politicaConclusao(plano);
  if (politica.tipo !== "RECONCILIADOR") {
    // O identificador legado reserva a obrigação de validar VisaoIntegrada.
    if (plano.passos.some(p => p.id === "RECONCILIADOR")) throw new Error("PLANO_INVALIDO");
    return;
  }
  const final = plano.passos.find(p => p.id === politica.passoId);
  if (!final) throw new Error("PLANO_INVALIDO");
  // A política explícita precisa descrever um JOIN real. Planos legados mantêm
  // suas dependências anteriores; todos continuam sujeitos à prova de cobertura.
  if (!plano.conclusao) return;
  const anteriores = new Set<string>();
  const pendentes = [...final.dependsOn];
  while (pendentes.length) {
    const id = pendentes.pop()!;
    if (anteriores.has(id)) continue;
    anteriores.add(id);
    pendentes.push(...plano.passos.find(p => p.id === id)!.dependsOn);
  }
  if (anteriores.size !== plano.passos.length - 1) throw new Error("PLANO_INVALIDO");
  if (politica.passoId !== "RECONCILIADOR" && plano.passos.some(p => p.id === "RECONCILIADOR"))
    throw new Error("PLANO_INVALIDO");
}

/** Resolve a política e a cobertura sem publicar saídas dos agentes no diagnóstico. */
export function avaliarConclusao(plano: Plano, resultados: readonly ResultadoPasso[]): DiagnosticoConclusao {
  const politica = politicaConclusao(plano);
  const terminais = plano.passos.filter(p => !plano.passos.some(q => q.dependsOn.includes(p.id))).map(p => p.id).sort();
  const diagnostico: DiagnosticoConclusao = {
    politica: { ...politica }, criterioAtendido: false,
    passosEsperados: plano.passos.map(p => p.id).sort(),
    passosComSucesso: resultados.filter(r => r.resultado === "ok").map(r => r.id).sort(),
    terminais,
    falhas: resultados.flatMap(r => r.resultado === "ok" ? [] : [{ id: r.id, resultado: r.resultado, motivo: r.motivo }])
      .sort((a, b) => a.id.localeCompare(b.id)),
    reconciliacao: "NAO_APLICAVEL",
  };
  if (politica.tipo !== "RECONCILIADOR") {
    const sucesso = (id: string) => diagnostico.passosComSucesso.includes(id);
    diagnostico.criterioAtendido = terminais.length > 0 && (politica.tipo === "TODOS_TERMINAIS"
      ? terminais.every(sucesso) : terminais.some(sucesso));
    return diagnostico;
  }
  const resultado = resultados.find(r => r.id === politica.passoId);
  if (resultado?.resultado !== "ok") {
    diagnostico.reconciliacao = "AUSENTE_OU_FALHOU";
    return diagnostico;
  }
  const visao = VisaoIntegrada.safeParse(resultado.saida);
  if (!visao.success) {
    diagnostico.reconciliacao = "SAIDA_INVALIDA";
    return diagnostico;
  }
  const setores = plano.passos.filter(p => p.id !== politica.passoId).map(p => p.id);
  diagnostico.criterioAtendido = setores.every(s => visao.data.cobertura.setoresEsperados.some(setor => setor === s))
    && visao.data.cobertura.setoresEsperados.every(s => visao.data.cobertura.setoresAvaliados.includes(s)
      || visao.data.lacunas.some(l => l.setor === s));
  diagnostico.reconciliacao = diagnostico.criterioAtendido ? "VALIDA" : "COBERTURA_INCOMPLETA";
  return diagnostico;
}
