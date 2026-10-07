import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CaixaNumerada } from "../../src/contracts/w10/clinico-w10.js";
import type { PerfilConfiguracao } from "../../src/config/settings.js";

export const SESSION = {
  medicoId: "medico-sintetico-01", crm: "CRM-TESTE", emitidaEm: "2026-10-07T12:00:00.000Z", expiraEm: "2026-10-07T20:00:00.000Z",
};
export const NOW = () => "2026-10-07T13:00:00.000Z";

export const PROFILE_BOXES: CaixaNumerada[] = [
  [1, "config.medico.nome", "TEXTO"], [2, "config.medico.crm", "TEXTO"], [3, "config.medico.rqe", "TEXTO"],
  [4, "config.medico.telefone", "TEXTO"], [5, "config.medico.cns", "TEXTO"],
  [6, "config.instituicao.hospital", "TEXTO"], [7, "config.instituicao.cnes", "TEXTO"],
  [8, "config.preferencias.tema", "TEXTO"], [9, "config.preferencias.layoutPersonalizado", "TEXTO"],
  [10, "config.preferencias.impressora", "TEXTO"], [11, "config.preferencias.sincronizarTelefone", "BOOLEANO"],
  [12, "config.conexoes.sites", "TEXTO"], [13, "config.conexoes.redeImpressora", "TEXTO"],
  [14, "config.conexoes.skills", "LISTA"], [15, "config.conexoes.plugins", "LISTA"], [16, "config.conexoes.mcp", "LISTA"],
  [90, "config.regra.exemplo", "REGRA_CLINICA"],
  [99, "sistema.revisao", "NUMERO", "SISTEMA"],
  [120, "apac.cnesSolicitante", "TEXTO"],
].map(([numero, chave, tipo, editavelPor = "MEDICO"]) => ({
  numero: numero as number, chave: chave as string, nome: chave as string, significado: `Campo sintético ${chave}`,
  ondeAparece: ["CONFIGURACOES"], tipo: tipo as CaixaNumerada["tipo"], editavelPor: editavelPor as CaixaNumerada["editavelPor"],
}));

export function novoDiretorio(): string { return mkdtempSync(join(tmpdir(), "w10-luna5-")); }
export function removerDiretorio(path: string): void { rmSync(path, { recursive: true, force: true }); }

export const perfilVazio = (): PerfilConfiguracao => ({
  medico: { nome: null, crm: null, rqe: null, telefone: null, cns: null },
  instituicao: { hospital: null, cnes: null },
  preferencias: { tema: "DIA", layoutPersonalizado: null, impressora: null, sincronizarTelefone: false },
  conexoes: {
    sites: { endereco: null, habilitada: false }, telefone: { habilitada: false },
    impressoraRede: { endereco: null, habilitada: false }, skills: { selecionadas: [], habilitada: false },
    plugins: { selecionados: [], habilitada: false }, mcp: { selecionados: [], habilitada: false },
  },
});
